/**
 * api/_pdf/modulos/compras.js
 * Dashboard de Compras — fonte: tabela `solicitacoes_compra`.
 */

import { fmtBRL, fmtData, fmtNumero, COR } from '../layout.js'
import { PALETA } from '../charts.js'

const STATUS_PENDENTES = ['aguardando_aprovacao', 'leilao_aberto', 'leilao_encerrado']
const STATUS_CONCLUIDAS = ['aprovado', 'pedido_emitido', 'recebido', 'pago']

const STATUS_LABEL = {
  requisicao_nova: 'Requisição',
  em_cotacao: 'Em cotação',
  aguardando_aprovacao: 'Ag. Aprovação',
  leilao_aberto: 'Leilão aberto',
  leilao_encerrado: 'Selecionando',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  pedido_emitido: 'Pedido emitido',
  recebido: 'Recebido',
  pago: 'Pago',
}

export async function buildDashboardCompras(workspaceId, filtros, supabase, empresa) {
  const { data_inicio, data_fim, formato } = filtros
  const isLista = formato === 'lista' || formato === 'tabela'

  const { data, error } = await supabase
    .from('solicitacoes_compra')
    .select('id, titulo, descricao, valor_estimado, valor_aprovado, economia, fornecedor_vencedor, status, urgencia, tipo, created_at, data_aprovacao')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw new Error('Erro ao buscar compras: ' + error.message)

  const todas = data || []

  const noPeriodo = todas.filter(s => {
    const d = String(s.created_at || '').slice(0, 10)
    return d >= data_inicio && d <= data_fim
  })

  const sum = (arr, k) => arr.reduce((a, x) => a + Number(x[k] || 0), 0)

  // KPIs globais
  const pendentes  = todas.filter(s => STATUS_PENDENTES.includes(s.status))
  const aprovadas  = todas.filter(s => STATUS_CONCLUIDAS.includes(s.status))
  const recusadas  = todas.filter(s => s.status === 'recusado')
  const valorAprovado = sum(aprovadas, 'valor_aprovado')
  const economiaTotal = sum(todas, 'economia')

  // Pizza: distribuição por status
  const porStatus = {}
  for (const s of todas) {
    const k = STATUS_LABEL[s.status] || s.status || '—'
    porStatus[k] = (porStatus[k] || 0) + 1
  }
  const pizzaArr = Object.entries(porStatus).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // Barras: valor aprovado por mês (últimos 12)
  const porMes = {}
  for (const s of aprovadas) {
    const d = s.data_aprovacao || s.created_at
    const m = String(d || '').slice(0, 7)
    if (!m) continue
    porMes[m] = (porMes[m] || 0) + Number(s.valor_aprovado || 0)
  }
  const meses = Object.keys(porMes).sort().slice(-12)
  const labelsBarras = meses.map(m => {
    const [y, mm] = m.split('-')
    return `${mm}/${y.slice(2)}`
  })
  const dataBarras = meses.map(m => Number(porMes[m].toFixed(2)))

  // Tabela: até 200 no modo lista, 25 no dashboard
  const cap = isLista ? 200 : 25
  const linhas = noPeriodo.slice(0, cap).map(s => ({
    data:       fmtData(String(s.created_at || '').slice(0, 10)),
    titulo:     s.titulo || s.descricao || '—',
    fornecedor: s.fornecedor_vencedor || '—',
    valor:      fmtBRL(s.valor_aprovado || s.valor_estimado || 0),
    status:     (STATUS_LABEL[s.status] || s.status || '—').toUpperCase(),
  }))

  return {
    titulo:    isLista ? 'Lista — Compras' : 'Relatório de Compras',
    subtitulo: `${fmtData(data_inicio)} a ${fmtData(data_fim)}`,
    empresa,
    kpis: [
      { label: 'Total solicitações', value: fmtNumero(todas.length),    color: COR.primary, sub: `${noPeriodo.length} no período` },
      { label: 'Em aprovação',       value: fmtNumero(pendentes.length),color: pendentes.length ? COR.warning : COR.success },
      { label: 'Valor aprovado',     value: fmtBRL(valorAprovado),      color: COR.info,    sub: `${aprovadas.length} concluídas` },
      { label: 'Economia gerada',    value: fmtBRL(economiaTotal),      color: COR.success, sub: `${recusadas.length} recusadas` },
    ],
    pizza: !isLista && pizzaArr.length ? {
      titulo: 'Distribuição por status',
      labels: pizzaArr.map(([k]) => k),
      data:   pizzaArr.map(([, v]) => v),
      colors: pizzaArr.map((_, i) => PALETA[i % PALETA.length]),
    } : null,
    barras: !isLista && meses.length ? {
      titulo: 'Valor aprovado por mês (últimos 12)',
      labels: labelsBarras,
      data:   dataBarras,
      color:  COR.primary,
      label:  'R$',
    } : null,
    tabela: linhas.length ? {
      titulo: `Solicitações do período (${noPeriodo.length})`,
      colunas: [
        { key: 'data',       label: 'Data',       width: 60 },
        { key: 'titulo',     label: 'Título',     width: 180 },
        { key: 'fornecedor', label: 'Fornecedor', width: 110 },
        { key: 'valor',      label: 'Valor',      width: 80,  align: 'right' },
        { key: 'status',     label: 'Status',     width: 85,  align: 'center' },
      ],
      linhas,
    } : null,
  }
}
