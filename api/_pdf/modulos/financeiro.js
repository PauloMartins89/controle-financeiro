/**
 * api/_pdf/modulos/financeiro.js
 * Constrói o shape padronizado para o relatório FINANCEIRO.
 * Fonte: tabela `lancamentos` no workspace.
 */

import { fmtBRL, fmtData, COR } from '../layout.js'
import { PALETA } from '../charts.js'

export async function buildDashboardFinanceiro(workspaceId, filtros, supabase, empresa) {
  const { data_inicio, data_fim, cliente, tipo = 'todos', formato } = filtros
  const isLista = formato === 'lista' || formato === 'tabela'

  // Filtra diretamente no banco pelo período solicitado
  let q = supabase
    .from('lancamentos')
    .select('id, tipo, descricao, valor, data, categoria, status')
    .eq('workspace_id', workspaceId)
    .gte('data', data_inicio)
    .lte('data', data_fim)
    .order('data', { ascending: false })

  if (tipo === 'entradas') q = q.eq('tipo', 'receita')
  if (tipo === 'saidas')   q = q.eq('tipo', 'despesa')
  if (cliente)             q = q.ilike('descricao', `%${cliente}%`)

  const { data, error } = await q.limit(2000)
  if (error) throw new Error('Erro ao buscar lançamentos: ' + error.message)

  // Todos os registros já estão no período solicitado
  const todos     = data || []
  const noPeriodo = todos

  // ── KPIs do período ───────────────────────────────────────────────────────
  const receitas = todos.filter(l => l.tipo === 'receita')
  const despesas = todos.filter(l => l.tipo === 'despesa')
  const sumEntradas = receitas.reduce((s, l) => s + Number(l.valor || 0), 0)
  const sumSaidas   = despesas.reduce((s, l) => s + Number(l.valor || 0), 0)
  const saldo       = sumEntradas - sumSaidas
  const pagos       = todos.filter(l => String(l.status || '').toLowerCase() === 'pago')
  const pctPago     = todos.length ? Math.round((pagos.length / todos.length) * 100) : 0

  // ── Pizza: top categorias de despesa (global) ───────────────────────────
  const porCategoria = {}
  for (const l of despesas) {
    const k = l.categoria || 'Sem categoria'
    porCategoria[k] = (porCategoria[k] || 0) + Number(l.valor || 0)
  }
  const topCat = Object.entries(porCategoria)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  // ── Barras: saldo diário DO PERÍODO solicitado ──────────────────────────
  const porDia = {}
  for (const l of noPeriodo) {
    const d = String(l.data).slice(0, 10)
    porDia[d] = porDia[d] || { receita: 0, despesa: 0 }
    porDia[d][l.tipo] = (porDia[d][l.tipo] || 0) + Number(l.valor || 0)
  }
  const dias = Object.keys(porDia).sort().slice(-14)
  const labelsBarras = dias.map(d => fmtData(d).slice(0, 5))   // dd/mm
  const dataBarras   = dias.map(d => Number((porDia[d].receita - porDia[d].despesa).toFixed(2)))

  // ── Tabela (sempre disponível; mais robusta no modo lista) ──────────────
  const cap = isLista ? 200 : 25
  const linhasTab = noPeriodo.slice(0, cap).map(l => ({
    data:     fmtData(String(l.data).slice(0, 10)),
    tipo:     l.tipo === 'receita' ? 'ENTRADA' : 'SAÍDA',
    desc:     (l.descricao || '—').slice(0, 60),
    categoria:l.categoria || '—',
    valor:    fmtBRL(l.valor),
    status:   String(l.status || '—').toUpperCase(),
    _color: {
      tipo:   l.tipo === 'receita' ? COR.success : COR.danger,
      status: String(l.status || '').toLowerCase() === 'pago' ? COR.success : COR.warning,
    },
  }))

  return {
    titulo:    'RELATÓRIO',
    modulo:    isLista ? 'LANÇAMENTOS FINANCEIROS' : 'FINANCEIRO',
    subtitulo: `Período de ${fmtData(data_inicio)} a ${fmtData(data_fim)}` + (cliente ? `  •  ${cliente}` : ''),
    empresa,
    meta: {
      periodo: `${fmtData(data_inicio)} a ${fmtData(data_fim)}`,
      geradoEm: new Date().toLocaleString('pt-BR'),
      geradoPor: typeof empresa === 'string' ? empresa : (empresa?.nome || 'SmartPro'),
    },
    visaoGeral: isLista
      ? `Listagem detalhada dos lançamentos financeiros no período. Total de ${noPeriodo.length} registro(s) entre receitas e despesas.`
      : `Panorama financeiro do período: ${todos.length} lançamento(s), saldo de ${fmtBRL(saldo)}, ${pctPago}% já quitados.`,
    analise: isLista ? null : [
      `Saldo do período: ${fmtBRL(saldo)} em ${todos.length} lançamento(s).`,
      `Entradas: ${fmtBRL(sumEntradas)} (${receitas.length} reg.) · Saídas: ${fmtBRL(sumSaidas)} (${despesas.length} reg.).`,
      topCat[0] ? `Maior despesa: ${topCat[0][0]} (${fmtBRL(topCat[0][1])}).` : 'Sem despesas registradas.',
    ],
    observacoes: isLista ? null : [
      `${pctPago}% dos lançamentos do período já estão quitados (${pagos.length} de ${todos.length}).`,
      'Para detalhes individuais, solicite o relatório em formato "lista".',
    ],
    kpis: [
      { label: 'Entradas',  value: fmtBRL(sumEntradas), tone: 'success', sub: `${receitas.length} registros`, icon: 'check' },
      { label: 'Saídas',    value: fmtBRL(sumSaidas),   tone: 'danger',  sub: `${despesas.length} registros`, icon: 'x' },
      { label: 'Saldo',     value: fmtBRL(saldo),       tone: saldo >= 0 ? 'info' : 'warning', icon: 'chart' },
      { label: '% Pago',    value: pctPago + '%',       tone: 'purple',  sub: `${pagos.length} de ${todos.length}`, icon: 'doc' },
    ],
    pizza: !isLista && topCat.length ? {
      titulo: 'DISTRIBUIÇÃO POR CATEGORIA',
      labels: topCat.map(([k]) => k),
      data:   topCat.map(([, v]) => Number(v.toFixed(2))),
      colors: topCat.map((_, i) => PALETA[i % PALETA.length]),
    } : null,
    linha: !isLista && dias.length ? {
      titulo: 'EVOLUÇÃO NO PERÍODO',
      labels: labelsBarras,
      data:   dataBarras,
      label:  'Saldo diário (R$)',
    } : null,
    tabela: linhasTab.length ? {
      titulo: `5. DETALHAMENTO — ${noPeriodo.length} lançamento(s)`,
      colunas: [
        { key: 'data',     label: 'Data',      width: 52 },
        { key: 'tipo',     label: 'Tipo',      width: 55, align: 'center' },
        { key: 'desc',     label: 'Descrição', width: 195 },
        { key: 'categoria',label: 'Categoria', width: 80 },
        { key: 'valor',    label: 'Valor',     width: 70, align: 'right' },
        { key: 'status',   label: 'Status',    width: 72, align: 'center' },
      ],
      linhas: linhasTab,
      totais: {
        desc: 'TOTAL',
        valor: fmtBRL(noPeriodo.reduce((s,l)=>s+(l.tipo==='receita'?1:-1)*Number(l.valor||0),0)),
        status: `${noPeriodo.length} reg.`,
      },
    } : null,
  }
}
