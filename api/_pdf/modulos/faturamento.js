/**
 * api/_pdf/modulos/faturamento.js
 * Dashboard de Faturamento — fonte: tabela `pagamentos` (Contas a Receber).
 *
 * Bate com a tela /pagamentos:
 *   TOTAL FATURADO      = SUM(valor_total)
 *   AG. RECEBIMENTO     = SUM(valor_total) WHERE status <> 'recebido'
 *   JÁ RECEBIDO         = SUM(valor_total) WHERE status = 'recebido'
 *   FATURADO ESTE MÊS   = SUM(valor_total) WHERE data_pagamento no mês atual
 */

import { fmtBRL, fmtData, COR } from '../layout.js'
import { PALETA } from '../charts.js'

export async function buildDashboardFaturamento(workspaceId, filtros, supabase, empresa) {
  const { data_inicio, data_fim, cliente, formato } = filtros
  const isLista = formato === 'lista' || formato === 'tabela'

  // 1) TODOS os pagamentos do workspace (KPIs precisam bater com a tela "Contas a Receber",
  //    que não filtra por data).
  let qAll = supabase
    .from('pagamentos')
    .select('id, descricao, valor_total, data_pagamento, data_recebimento, numero_nf, status')
    .eq('workspace_id', workspaceId)
    .order('data_pagamento', { ascending: false })

  if (cliente) qAll = qAll.ilike('descricao', `%${cliente}%`)

  const { data: dataAll, error: errAll } = await qAll.limit(5000)
  if (errAll) throw new Error('Erro ao buscar pagamentos: ' + errAll.message)
  const todos = dataAll || []

  // 2) Recortes do período (apenas para tabela detalhada)
  const noPeriodo = todos.filter(p => {
    const d = p.data_pagamento || ''
    return d >= data_inicio && d <= data_fim
  })

  // ── KPIs globais (espelham a tela /pagamentos) ──────────────────────────
  const recebidos = todos.filter(p => p.status === 'recebido')
  const pendentes = todos.filter(p => p.status !== 'recebido')
  const totalGeral    = todos.reduce((s, p) => s + Number(p.valor_total || 0), 0)
  const totalRecebido = recebidos.reduce((s, p) => s + Number(p.valor_total || 0), 0)
  const totalPendente = pendentes.reduce((s, p) => s + Number(p.valor_total || 0), 0)

  const mesAtual = new Date().toISOString().slice(0, 7)
  const totalMes = todos
    .filter(p => String(p.data_pagamento || '').startsWith(mesAtual))
    .reduce((s, p) => s + Number(p.valor_total || 0), 0)

  // ── Pizza: distribuição por status (global) ─────────────────────────────
  const pizzaData = [
    { label: 'Já Recebido',     value: totalRecebido, color: COR.success },
    { label: 'Ag. Recebimento', value: totalPendente, color: COR.warning },
  ].filter(x => x.value > 0)

  // ── Barras: faturado por mês (últimos 12 meses, global) ─────────────────
  const porMes = {}
  for (const p of todos) {
    const m = String(p.data_pagamento || '').slice(0, 7)
    if (!m) continue
    porMes[m] = (porMes[m] || 0) + Number(p.valor_total || 0)
  }
  const meses = Object.keys(porMes).sort().slice(-12)
  const labelsBarras = meses.map(m => {
    const [y, mm] = m.split('-')
    return `${mm}/${y.slice(2)}`
  })
  const dataBarras = meses.map(m => Number(porMes[m].toFixed(2)))

  // ── Tabela: lançamentos DO PERÍODO solicitado ───────────────────────────
  const cap = isLista ? 200 : 25
  const linhas = noPeriodo.slice(0, cap).map(p => ({
    data:     fmtData(p.data_pagamento),
    nf:       p.numero_nf || '—',
    desc:     p.descricao || '—',
    valor:    fmtBRL(p.valor_total),
    status:   p.status === 'recebido' ? 'RECEBIDO' : 'AG. RECEBIMENTO',
    _color: {
      status: p.status === 'recebido' ? COR.success : COR.warning,
    },
  }))

  return {
    titulo:    isLista ? 'Lista — Faturamento' : 'Relatório de Faturamento',
    subtitulo: `${fmtData(data_inicio)} a ${fmtData(data_fim)}` + (cliente ? `  •  ${cliente}` : ''),
    empresa,
    sumario: isLista ? [] : [
      `Faturamento total: ${fmtBRL(totalGeral)} em ${todos.length} pagamento(s).`,
      `${fmtBRL(totalPendente)} aguardando recebimento (${pendentes.length} pendentes).`,
      `${fmtBRL(totalRecebido)} já recebidos (${recebidos.length} confirmados).`,
      `Este mês: ${fmtBRL(totalMes)} faturados.`,
    ],
    kpis: [
      { label: 'Total Faturado',    value: fmtBRL(totalGeral),    color: COR.primary, sub: `${todos.length} faturamento(s)` },
      { label: 'Ag. Recebimento',   value: fmtBRL(totalPendente), color: COR.warning, sub: `${pendentes.length} pendente(s)` },
      { label: 'Já Recebido',       value: fmtBRL(totalRecebido), color: COR.success, sub: `${recebidos.length} confirmado(s)` },
      { label: 'Faturado Este Mês', value: fmtBRL(totalMes),      color: COR.info },
    ],
    pizza: !isLista && pizzaData.length ? {
      titulo: 'Distribuição por status',
      labels: pizzaData.map(x => x.label),
      data:   pizzaData.map(x => Number(x.value.toFixed(2))),
      colors: pizzaData.map(x => x.color),
    } : null,
    barras: !isLista && meses.length ? {
      titulo: 'Faturamento por mês (últimos 12)',
      labels: labelsBarras,
      data:   dataBarras,
      color:  COR.primary,
      label:  'R$',
    } : null,
    tabela: linhas.length ? {
      titulo: `Lançamentos do período (${noPeriodo.length})`,
      colunas: [
        { key: 'data',   label: 'Data',   width: 60 },
        { key: 'nf',     label: 'NF',     width: 70 },
        { key: 'desc',   label: 'Descrição', width: 220 },
        { key: 'valor',  label: 'Valor',  width: 80,  align: 'right' },
        { key: 'status', label: 'Status', width: 85,  align: 'center' },
      ],
      linhas,
    } : null,
  }
}
