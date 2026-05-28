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
  const { data_inicio, data_fim, cliente } = filtros

  let q = supabase
    .from('pagamentos')
    .select('id, descricao, valor_total, data_pagamento, data_recebimento, numero_nf, status')
    .eq('workspace_id', workspaceId)
    .gte('data_pagamento', data_inicio)
    .lte('data_pagamento', data_fim)
    .order('data_pagamento', { ascending: false })

  if (cliente) q = q.ilike('descricao', `%${cliente}%`)

  const { data, error } = await q.limit(1000)
  if (error) throw new Error('Erro ao buscar pagamentos: ' + error.message)

  const pags     = data || []
  const recebidos = pags.filter(p => p.status === 'recebido')
  const pendentes = pags.filter(p => p.status !== 'recebido')
  const totalGeral    = pags.reduce((s, p) => s + Number(p.valor_total || 0), 0)
  const totalRecebido = recebidos.reduce((s, p) => s + Number(p.valor_total || 0), 0)
  const totalPendente = pendentes.reduce((s, p) => s + Number(p.valor_total || 0), 0)

  // Faturado no mês atual (independente do filtro, igual à tela)
  const mesAtual = new Date().toISOString().slice(0, 7)
  const totalMes = pags
    .filter(p => String(p.data_pagamento || '').startsWith(mesAtual))
    .reduce((s, p) => s + Number(p.valor_total || 0), 0)

  // Pizza: distribuição por status
  const pizzaData = [
    { label: 'Já Recebido',     value: totalRecebido, color: COR.success },
    { label: 'Ag. Recebimento', value: totalPendente, color: COR.warning },
  ].filter(x => x.value > 0)

  // Barras: faturado por mês (até 12 meses dentro do range)
  const porMes = {}
  for (const p of pags) {
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

  // Tabela detalhada (até 25 lançamentos)
  const linhas = pags.slice(0, 25).map(p => ({
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
    titulo:    'Relatório de Faturamento',
    subtitulo: `${fmtData(data_inicio)} a ${fmtData(data_fim)}` + (cliente ? `  •  ${cliente}` : ''),
    empresa,
    kpis: [
      { label: 'Total Faturado',    value: fmtBRL(totalGeral),    color: COR.primary, sub: `${pags.length} faturamento(s)` },
      { label: 'Ag. Recebimento',   value: fmtBRL(totalPendente), color: COR.warning, sub: `${pendentes.length} pendente(s)` },
      { label: 'Já Recebido',       value: fmtBRL(totalRecebido), color: COR.success, sub: `${recebidos.length} confirmado(s)` },
      { label: 'Faturado Este Mês', value: fmtBRL(totalMes),      color: COR.info },
    ],
    pizza: pizzaData.length ? {
      titulo: 'Distribuição por status',
      labels: pizzaData.map(x => x.label),
      data:   pizzaData.map(x => Number(x.value.toFixed(2))),
      colors: pizzaData.map(x => x.color),
    } : null,
    barras: meses.length ? {
      titulo: 'Faturamento por mês',
      labels: labelsBarras,
      data:   dataBarras,
      color:  COR.primary,
      label:  'R$',
    } : null,
    tabela: linhas.length ? {
      titulo: 'Lançamentos do período',
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
