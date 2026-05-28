/**
 * api/_pdf/modulos/compras.js
 * Dashboard de Compras — fonte: tabela `solicitacoes_compra`.
 */

import { fmtBRL, fmtData, fmtNumero, COR } from '../layout.js'
import { PALETA } from '../charts.js'

const STATUS_PENDENTES  = ['aguardando_aprovacao', 'leilao_aberto', 'leilao_encerrado']
const STATUS_CONCLUIDAS = ['aprovado', 'pedido_emitido', 'recebido', 'pago']

const STATUS_LABEL = {
  requisicao_nova:      'Requisição',
  em_cotacao:           'Em cotação',
  aguardando_aprovacao: 'Ag. Aprovação',
  leilao_aberto:        'Leilão aberto',
  leilao_encerrado:     'Selecionando',
  aprovado:             'Aprovado',
  recusado:             'Recusado',
  pedido_emitido:       'Pedido emitido',
  recebido:             'Recebido',
  pago:                 'Pago',
}

export async function buildDashboardCompras(workspaceId, filtros, supabase, empresa) {
  const { data_inicio, data_fim, formato } = filtros
  const isLista = formato === 'lista' || formato === 'tabela'

  const { data, error } = await supabase
    .from('solicitacoes_compra')
    .select('id, titulo, descricao, valor_estimado, valor_aprovado, economia, fornecedor_vencedor, status, urgencia, tipo, created_at, data_aprovacao')
    .eq('workspace_id', workspaceId)
    .gte('created_at', data_inicio)
    .lte('created_at', data_fim + 'T23:59:59')
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) throw new Error('Erro ao buscar compras: ' + error.message)

  // Todos os registros já estão filtrados pelo período solicitado
  const noPeriodo = data || []
  const todas = noPeriodo

  const sum = (arr, k) => arr.reduce((a, x) => a + Number(x[k] || 0), 0)

  const pendentes  = noPeriodo.filter(s => STATUS_PENDENTES.includes(s.status))
  const aprovadas  = noPeriodo.filter(s => STATUS_CONCLUIDAS.includes(s.status))
  const recusadas  = noPeriodo.filter(s => s.status === 'recusado')
  const valorAprovado = sum(aprovadas, 'valor_aprovado')
  const economiaTotal = sum(noPeriodo, 'economia')

  // Pizza: distribuição por status no período
  const porStatus = {}
  for (const s of noPeriodo) {
    const k = STATUS_LABEL[s.status] || s.status || '—'
    porStatus[k] = (porStatus[k] || 0) + 1
  }
  const pizzaArr = Object.entries(porStatus).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // Linha: valor aprovado por dia no período
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
    titulo:    'RELATÓRIO',
    modulo:    isLista ? 'COMPRAS — LISTAGEM' : 'COMPRAS',
    subtitulo: `Período de ${fmtData(data_inicio)} a ${fmtData(data_fim)}`,
    empresa,
    meta: {
      periodo:   `${fmtData(data_inicio)} a ${fmtData(data_fim)}`,
      geradoEm:  new Date().toLocaleString('pt-BR'),
      geradoPor: typeof empresa === 'string' ? empresa : (empresa?.nome || 'SmartPro'),
    },
    visaoGeral: isLista
      ? `Listagem detalhada das solicitações de compra no período. ${noPeriodo.length} solicitação(ões) registrada(s).`
      : `Panorama de compras no período: ${noPeriodo.length} solicitação(ões), ${pendentes.length} aguardando aprovação, valor aprovado de ${fmtBRL(valorAprovado)} com economia de ${fmtBRL(economiaTotal)}.`,
    analise: isLista ? null : [
      `${noPeriodo.length} solicitação(ões) no período — ${pendentes.length} aguardando, ${aprovadas.length} concluídas.`,
      `${pendentes.length} em aprovação; ${aprovadas.length} concluídas (${recusadas.length} recusadas).`,
      pizzaArr[0] ? `Maior bloco de pedidos: ${pizzaArr[0][0]} (${pizzaArr[0][1]} solicitações).` : 'Sem pedidos registrados.',
    ],
    observacoes: isLista ? null : [
      `Valor aprovado: ${fmtBRL(valorAprovado)} — economia gerada: ${fmtBRL(economiaTotal)}.`,
      aprovadas.length ? `Média por compra aprovada: ${fmtBRL(valorAprovado / aprovadas.length)}.` : 'Nenhuma compra aprovada ainda.',
    ],
    kpis: [
      { label: 'Solicitações',       value: fmtNumero(noPeriodo.length), tone: 'info',    sub: `${fmtData(data_inicio)} a ${fmtData(data_fim)}`, icon: 'doc' },
      { label: 'Em aprovação',       value: fmtNumero(pendentes.length), tone: pendentes.length ? 'warning' : 'success', sub: `${aprovadas.length} concluídas`, icon: 'clock' },
      { label: 'Valor aprovado',     value: fmtBRL(valorAprovado),       tone: 'success', sub: `${aprovadas.length} compras`,       icon: 'check' },
      { label: 'Economia gerada',    value: fmtBRL(economiaTotal),       tone: 'purple',  sub: `${recusadas.length} recusadas`,     icon: 'chart' },
    ],
    pizza: !isLista && pizzaArr.length ? {
      titulo: 'DISTRIBUIÇÃO POR STATUS',
      labels: pizzaArr.map(([k]) => k),
      data:   pizzaArr.map(([, v]) => v),
      colors: pizzaArr.map((_, i) => PALETA[i % PALETA.length]),
    } : null,
    linha: !isLista && meses.length ? {
      titulo: 'VALOR APROVADO POR MÊS',
      labels: labelsBarras,
      data:   dataBarras,
      label:  'R$ aprovado',
    } : null,
    tabela: linhas.length ? {
      titulo: `5. DETALHAMENTO — ${noPeriodo.length} solicitação(ões)`,
      colunas: [
        { key: 'data',       label: 'Data',       width: 52 },
        { key: 'titulo',     label: 'Título',     width: 185 },
        { key: 'fornecedor', label: 'Fornecedor', width: 105 },
        { key: 'valor',      label: 'Valor',      width: 75,  align: 'right' },
        { key: 'status',     label: 'Status',     width: 107, align: 'center' },
      ],
      linhas,
      totais: {
        titulo: 'TOTAL',
        valor:  fmtBRL(noPeriodo.reduce((s, x) => s + Number(x.valor_aprovado || x.valor_estimado || 0), 0)),
        status: `${noPeriodo.length} reg.`,
      },
    } : null,
  }
}
