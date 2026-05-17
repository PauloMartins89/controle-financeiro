import { supabase } from './supabase'

// Monta contexto compacto com os dados do store para enviar à IA
export function buildContext({ expenses, people, groups, cards, recurring = [], saldoCaixa = 0 }) {
  const hoje = new Date()
  const anoMes = (d) => d.toISOString().slice(0, 7)
  const mesAtual = anoMes(hoje)
  const mesAnterior = anoMes(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1))

  // Últimos 30 dias detalhados (limitado a 40 registros para caber no limite de tokens)
  const trinta = new Date(hoje)
  trinta.setDate(hoje.getDate() - 30)
  const recentes = expenses
    .filter(e => new Date(e.data) >= trinta)
    .slice(0, 40)
    .map(e => ({
      desc: e.descricao,
      val: e.valor,
      data: e.data,
      cat: e.categoria,
      st: e.status,
      pago_por: people.find(p => p.id === e.pago_por)?.nome || null,
    }))

  // Resumo mês atual
  const doMesAtual = expenses.filter(e => e.data?.slice(0, 7) === mesAtual)
  const totalMesAtual = doMesAtual.reduce((s, e) => s + (e.valor || 0), 0)
  const pendentesMes = doMesAtual.filter(e => e.status === 'pendente').reduce((s, e) => s + e.valor, 0)
  const pagosMes = doMesAtual.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)

  // Resumo mês anterior
  const doMesAnterior = expenses.filter(e => e.data?.slice(0, 7) === mesAnterior)
  const totalMesAnterior = doMesAnterior.reduce((s, e) => s + (e.valor || 0), 0)

  // Totais por categoria (mês atual)
  const porCategoria = {}
  doMesAtual.forEach(e => {
    if (e.categoria) porCategoria[e.categoria] = (porCategoria[e.categoria] || 0) + e.valor
  })

  // Saldos entre pessoas (despesas pendentes)
  const balances = {}
  people.forEach(p => { balances[p.id] = 0 })
  expenses.filter(e => e.status !== 'pago').forEach(exp => {
    const { valor, pago_por, participantes, tipo_divisao, parcelas } = exp
    if (!participantes?.length || !pago_por) return
    const vp = valor / (parcelas || 1)
    const share = vp / participantes.length
    participantes.forEach(pid => {
      if (pid === pago_por) return
      if (balances[pid] !== undefined) balances[pid] -= share
      if (balances[pago_por] !== undefined) balances[pago_por] += share
    })
  })
  const saldosPessoas = people.map(p => ({
    nome: p.nome,
    saldo: Math.round((balances[p.id] || 0) * 100) / 100,
  }))

  // Recorrentes ativos (só desc e valor)
  const recorrentesAtivos = (recurring || []).slice(0, 10).map(r => ({
    desc: r.descricao, val: r.valor, cat: r.categoria,
  }))

  const nomes = people.map(p => p.nome)

  return {
    hoje: hoje.toISOString().slice(0, 10),
    mes: mesAtual,
    mesAnt: mesAnterior,
    mesAtual: { total: Math.round(totalMesAtual * 100) / 100, pend: Math.round(pendentesMes * 100) / 100, pago: Math.round(pagosMes * 100) / 100 },
    mesAntTotal: Math.round(totalMesAnterior * 100) / 100,
    cats: porCategoria,
    saldos: saldosPessoas,
    caixa: saldoCaixa,
    recorrentes: recorrentesAtivos,
    despesas: recentes,
    pessoas: nomes,
  }
}

export async function chatWithAI(messages, context) {
  // Pega token de sessão do Supabase para autenticar na Vercel Function
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Não autenticado')

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ messages, context }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Erro ${res.status}`)
  }

  const { content } = await res.json()

  // Detecta intenção de inserir despesa
  const match = content.match(/<INSERIR>([\s\S]*?)<\/INSERIR>/)
  if (match) {
    try {
      const expense = JSON.parse(match[1].trim())
      return { type: 'insert', expense, text: null }
    } catch {
      return { type: 'text', text: content }
    }
  }

  return { type: 'text', text: content }
}
