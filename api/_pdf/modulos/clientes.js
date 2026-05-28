/**
 * api/_pdf/modulos/clientes.js
 * Dashboard de Aprovação de Clientes — fonte: tabela `pagamentos` (Contas a Receber).
 *
 * Foco: visão por cliente das cobranças (a receber + recebido), com lista detalhada
 *       de pendências de aprovação/recebimento.
 */

import { fmtBRL, fmtData, fmtNumero, COR } from '../layout.js'
import { PALETA } from '../charts.js'

// Heurística simples: usa a primeira parte da descrição como "cliente"
function extrairCliente(desc) {
  if (!desc) return 'Sem cliente'
  const s = String(desc).split(/\s*[-–|·]\s*/)[0].trim()
  return s.length > 32 ? s.slice(0, 30) + '…' : (s || 'Sem cliente')
}

export async function buildDashboardClientes(workspaceId, filtros, supabase, empresa) {
  const { data_inicio, data_fim, cliente, formato } = filtros
  const isLista = formato === 'lista' || formato === 'tabela'

  let q = supabase
    .from('pagamentos')
    .select('id, descricao, valor_total, data_pagamento, data_recebimento, numero_nf, status')
    .eq('workspace_id', workspaceId)
    .order('data_pagamento', { ascending: false })
  if (cliente) q = q.ilike('descricao', `%${cliente}%`)
  const { data, error } = await q.limit(5000)
  if (error) throw new Error('Erro ao buscar pagamentos: ' + error.message)

  const todos = data || []
  const noPeriodo = todos.filter(p => {
    const d = p.data_pagamento || ''
    return d >= data_inicio && d <= data_fim
  })

  // Agrupa por cliente
  const map = {}
  for (const p of todos) {
    const k = extrairCliente(p.descricao)
    if (!map[k]) map[k] = { cliente: k, total: 0, recebido: 0, pendente: 0, qtd: 0, qtdPend: 0 }
    const v = Number(p.valor_total || 0)
    map[k].total += v
    map[k].qtd   += 1
    if (p.status === 'recebido') map[k].recebido += v
    else { map[k].pendente += v; map[k].qtdPend += 1 }
  }
  const clientes = Object.values(map).sort((a, b) => b.pendente - a.pendente || b.total - a.total)

  // KPIs globais
  const totalGeral    = todos.reduce((s, p) => s + Number(p.valor_total || 0), 0)
  const totalRecebido = todos.filter(p => p.status === 'recebido').reduce((s, p) => s + Number(p.valor_total || 0), 0)
  const totalPendente = totalGeral - totalRecebido
  const inadimplentes = clientes.filter(c => c.pendente > 0).length

  // Top 6 clientes por valor total (para pizza)
  const top6 = clientes.slice(0, 6).filter(c => c.total > 0)

  // Top 10 (para barras)
  const top10 = clientes.slice(0, 10).filter(c => c.pendente > 0)

  // Tabela: itens do período pendentes, ou tudo no modo lista
  const itens = isLista ? noPeriodo : noPeriodo.filter(p => p.status !== 'recebido')
  const cap = isLista ? 200 : 30
  const linhas = itens.slice(0, cap).map(p => ({
    data:    fmtData(p.data_pagamento),
    nf:      p.numero_nf || '—',
    cliente: extrairCliente(p.descricao),
    desc:    (p.descricao || '—').slice(0, 60),
    valor:   fmtBRL(p.valor_total),
    status:  p.status === 'recebido' ? 'RECEBIDO' : 'PENDENTE',
    _color: { status: p.status === 'recebido' ? COR.success : COR.warning },
  }))

  return {
    titulo:    isLista ? 'Lista — Aprovação de Clientes' : 'Aprovação de Clientes',
    subtitulo: `${fmtData(data_inicio)} a ${fmtData(data_fim)}` + (cliente ? `  •  ${cliente}` : ''),
    empresa,
    kpis: [
      { label: 'Clientes ativos',     value: fmtNumero(clientes.length),    color: COR.primary, sub: `${inadimplentes} com pendência` },
      { label: 'A receber',           value: fmtBRL(totalPendente),         color: totalPendente ? COR.warning : COR.success, sub: `${noPeriodo.filter(p => p.status !== 'recebido').length} no período` },
      { label: 'Já recebido',         value: fmtBRL(totalRecebido),         color: COR.success, sub: `${todos.filter(p => p.status === 'recebido').length} confirmados` },
      { label: '% Recebimento',       value: totalGeral ? `${((totalRecebido / totalGeral) * 100).toFixed(1)}%` : '—', color: COR.info },
    ],
    pizza: !isLista && top6.length ? {
      titulo: 'Top 6 clientes por faturamento',
      labels: top6.map(c => c.cliente),
      data:   top6.map(c => Number(c.total.toFixed(2))),
      colors: top6.map((_, i) => PALETA[i % PALETA.length]),
    } : null,
    barras: !isLista && top10.length ? {
      titulo: 'Top 10 clientes com valor pendente',
      labels: top10.map(c => c.cliente.length > 14 ? c.cliente.slice(0, 12) + '…' : c.cliente),
      data:   top10.map(c => Number(c.pendente.toFixed(2))),
      color:  COR.warning,
      label:  'R$',
    } : null,
    tabela: linhas.length ? {
      titulo: isLista
        ? `Lançamentos do período (${noPeriodo.length})`
        : `Pendências do período (${itens.length})`,
      colunas: [
        { key: 'data',    label: 'Data',    width: 55 },
        { key: 'nf',      label: 'NF',      width: 55 },
        { key: 'cliente', label: 'Cliente', width: 140 },
        { key: 'desc',    label: 'Descrição', width: 165 },
        { key: 'valor',   label: 'Valor',   width: 70, align: 'right' },
        { key: 'status',  label: 'Status',  width: 65, align: 'center' },
      ],
      linhas,
    } : null,
  }
}
