/**
 * GET /api/cron?type=lembretes  → envia lembrete semanal de saldos
 * GET /api/cron?type=relatorio  → envia relatório mensal
 * Ambos chamados pelo Vercel Cron (Authorization: Bearer CRON_SECRET)
 */
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const APP_URL = process.env.APP_URL || APP_URL

function getDb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { realtime: { params: { log_level: 'disabled' }, transport: ws }, global: {} })
}

function formatBRL(v) {
  return 'R$ ' + Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function calcularSaldos(despesas, pessoas) {
  const balances = {}
  pessoas.forEach(p => { balances[p.id] = 0 })
  despesas.filter(e => e.status !== 'pago').forEach(exp => {
    const { valor, pago_por, participantes, parcelas } = exp
    if (!participantes?.length || !pago_por) return
    const share = (valor / (parcelas || 1)) / participantes.length
    participantes.forEach(pid => {
      if (pid === pago_por) return
      if (balances[pid] !== undefined) balances[pid] -= share
      if (balances[pago_por] !== undefined) balances[pago_por] += share
    })
  })
  return pessoas.map(p => ({
    id: p.id,
    nome: p.nome,
    saldo: Math.round((balances[p.id] || 0) * 100) / 100,
  }))
}

async function sendWA(to, text) {
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    }
  )
  return res.ok
}

// ── Handler: lembretes semanais ──────────────────────────────────────────────
async function handleLembretes(db, res) {
  const [{ data: pessoas }, { data: despesas }, { data: canais }] = await Promise.all([
    db.from('pessoas').select('id, nome'),
    db.from('despesas').select('id, valor, pago_por, participantes, parcelas, status'),
    db.from('canais_mensagem').select('telefone, pessoa_id').eq('ativo', true),
  ])

  if (!canais?.length) return res.status(200).json({ sent: 0 })

  const saldos = calcularSaldos(despesas || [], pessoas || [])
  let sent = 0

  for (const canal of canais) {
    const saldo = saldos.find(s => s.id === canal.pessoa_id)
    if (!saldo || Math.abs(saldo.saldo) < 0.01) continue
    const msg = saldo.saldo < 0
      ? `👋 *Lembrete semanal — Dividi Aí*\n\nVocê ainda deve *${formatBRL(Math.abs(saldo.saldo))}*.\n\nQuer acertar? Me avise aqui ou acesse ${APP_URL} 😊`
      : `👋 *Lembrete semanal — Dividi Aí*\n\nVocê tem *${formatBRL(saldo.saldo)}* a receber.\n\nAcesse ${APP_URL} para ver os detalhes. 💰`
    await sendWA(canal.telefone, msg)
    sent++
  }
  return res.status(200).json({ sent })
}

// ── Handler: relatório mensal ────────────────────────────────────────────────
async function handleRelatorio(db, res) {
  const now = new Date()
  const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const mesStr  = mesAnterior.toISOString().slice(0, 7)
  const nomeMes = mesAnterior.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  const [{ data: pessoas }, { data: despesas }, { data: canais }] = await Promise.all([
    db.from('pessoas').select('id, nome'),
    db.from('despesas').select('id, descricao, valor, data, status, pago_por, participantes, parcelas'),
    db.from('canais_mensagem').select('telefone, pessoa_id').eq('ativo', true),
  ])

  if (!canais?.length) return res.status(200).json({ sent: 0 })

  const todasDespesas = despesas || []
  const todasPessoas  = pessoas  || []
  const doMes    = todasDespesas.filter(e => e.data?.slice(0, 7) === mesStr)
  const total    = doMes.reduce((s, e) => s + (e.valor || 0), 0)
  const pagos    = doMes.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
  const pendente = doMes.filter(e => e.status === 'pendente').reduce((s, e) => s + e.valor, 0)
  const saldos   = calcularSaldos(todasDespesas, todasPessoas).filter(s => Math.abs(s.saldo) > 0.01)

  let sent = 0
  for (const canal of canais) {
    const saldoPessoa = saldos.find(s => s.id === canal.pessoa_id)
    const saldoLinha  = saldoPessoa
      ? saldoPessoa.saldo > 0
        ? `\n💚 Você tem *${formatBRL(saldoPessoa.saldo)}* a receber`
        : `\n🔴 Você deve *${formatBRL(Math.abs(saldoPessoa.saldo))}*`
      : '\n✅ Você está quite'
    const msg = `📊 *Relatório de ${nomeMes}*\n\nTotal gasto: ${formatBRL(total)}\nPago: ${formatBRL(pagos)}\nPendente: ${formatBRL(pendente)}${saldoLinha}\n\nAcesse ${APP_URL} para ver o detalhamento completo.`
    await sendWA(canal.telefone, msg)
    sent++
  }
  return res.status(200).json({ sent })
}

// ── Handler: lembretes de refeições pendentes ────────────────────────────────
async function handleRefeicoesPendentes(db, res) {
  const fmtData = d => d ? String(d).split('-').reverse().join('/') : '—'
  const fmtBRL  = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  // Busca pendentes criados há mais de 2 horas
  const limite = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: pendentes } = await db
    .from('refei_solicitacoes')
    .select('id, numero_pedido, data_refeicao, valor_total, total_refeicoes, total_cafes, supervisor_telefone, token_aprovacao, refei_equipes(nome, cdc)')
    .in('status', ['pendente', 'aguardando_aprovacao'])
    .lt('criado_em', limite)

  if (!pendentes?.length) return res.status(200).json({ sent: 0, pendentes: 0 })

  // Agrupa por supervisor_telefone
  const porSupervisor = {}
  for (const sol of pendentes) {
    if (!sol.supervisor_telefone) continue
    if (!porSupervisor[sol.supervisor_telefone]) porSupervisor[sol.supervisor_telefone] = []
    porSupervisor[sol.supervisor_telefone].push(sol)
  }

  let sent = 0
  for (const [telefone, sols] of Object.entries(porSupervisor)) {
    const linhas = [
      `🔔 *${sols.length === 1 ? '1 pedido aguarda' : sols.length + ' pedidos aguardam'} sua aprovação*`,
      ``,
      ...sols.map(s => {
        const eq = s.refei_equipes
        return [
          `📋 *${s.numero_pedido}* — ${eq?.nome || '—'}${eq?.cdc ? ' (CDC ' + eq.cdc + ')' : ''}`,
          `   📅 ${fmtData(s.data_refeicao)}  ·  ${s.total_refeicoes}🍽️  ${s.total_cafes}☕  *${fmtBRL(s.valor_total)}*`,
          `   👉 ${APP_URL}/ar/${s.token_aprovacao}`,
        ].join('\n')
      }),
    ]

    const phone = String(telefone).replace(/\D/g, '')
    if (!phone) continue

    try {
      const r = await fetch(
        `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
          },
          body: JSON.stringify({ phone, message: linhas.join('\n') }),
        }
      )
      if (r.ok) sent++
      else console.error(`[cron:refeicoes] sendWA falhou ${r.status} para ${phone}`)
    } catch (err) {
      console.error(`[cron:refeicoes] sendWA exception para ${phone}:`, err.message)
    }
  }

  return res.status(200).json({ sent, pendentes: pendentes.length })
}

// ── Entry point ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const db = getDb()
  const type = req.query.type
  if (type === 'lembretes')          return handleLembretes(db, res)
  if (type === 'relatorio')          return handleRelatorio(db, res)
  if (type === 'refeicoes-pendentes') return handleRefeicoesPendentes(db, res)
  return res.status(400).json({ error: 'type param required: lembretes | relatorio | refeicoes-pendentes' })
}
