/**
 * api/_pdf/modulos/financeiro.js
 * Constrói o shape padronizado para o relatório FINANCEIRO.
 * Fonte: tabela `lancamentos` no workspace.
 */

import { fmtBRL, fmtData, COR } from '../layout.js'
import { PALETA } from '../charts.js'

export async function buildDashboardFinanceiro(workspaceId, filtros, supabase, empresa) {
  const { data_inicio, data_fim, cliente, tipo = 'todos' } = filtros

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

  const { data, error } = await q.limit(1000)
  if (error) throw new Error('Erro ao buscar lançamentos: ' + error.message)

  const lanc = data || []
  const receitas = lanc.filter(l => l.tipo === 'receita')
  const despesas = lanc.filter(l => l.tipo === 'despesa')
  const sumEntradas = receitas.reduce((s, l) => s + Number(l.valor || 0), 0)
  const sumSaidas   = despesas.reduce((s, l) => s + Number(l.valor || 0), 0)
  const saldo       = sumEntradas - sumSaidas

  const pagos      = lanc.filter(l => String(l.status || '').toLowerCase() === 'pago')
  const pctPago    = lanc.length ? Math.round((pagos.length / lanc.length) * 100) : 0

  // Pizza: top categorias de despesa
  const porCategoria = {}
  for (const l of despesas) {
    const k = l.categoria || 'Sem categoria'
    porCategoria[k] = (porCategoria[k] || 0) + Number(l.valor || 0)
  }
  const topCat = Object.entries(porCategoria)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  // Barras: entradas x saídas por dia (limitado a 14 últimos dias do range)
  const porDia = {}
  for (const l of lanc) {
    const d = String(l.data).slice(0, 10)
    porDia[d] = porDia[d] || { receita: 0, despesa: 0 }
    porDia[d][l.tipo] = (porDia[d][l.tipo] || 0) + Number(l.valor || 0)
  }
  const dias = Object.keys(porDia).sort().slice(-14)
  const labelsBarras = dias.map(d => fmtData(d).slice(0, 5))   // dd/mm
  const dataBarras   = dias.map(d => Number((porDia[d].receita - porDia[d].despesa).toFixed(2)))

  return {
    titulo:    'Relatório Financeiro',
    subtitulo: `${fmtData(data_inicio)} a ${fmtData(data_fim)}` + (cliente ? `  •  ${cliente}` : ''),
    empresa,
    kpis: [
      { label: 'Entradas',  value: fmtBRL(sumEntradas), color: COR.success, sub: `${receitas.length} registros` },
      { label: 'Saídas',    value: fmtBRL(sumSaidas),   color: COR.danger,  sub: `${despesas.length} registros` },
      { label: 'Saldo',     value: fmtBRL(saldo),       color: saldo >= 0 ? COR.info : COR.warning },
      { label: '% Pago',    value: pctPago + '%',       color: COR.primary, sub: `${pagos.length} de ${lanc.length}` },
    ],
    pizza: topCat.length ? {
      titulo: 'Top categorias de despesa',
      labels: topCat.map(([k]) => k),
      data:   topCat.map(([, v]) => Number(v.toFixed(2))),
      colors: topCat.map((_, i) => PALETA[i % PALETA.length]),
    } : null,
    barras: dias.length ? {
      titulo: 'Saldo diário (entradas − saídas)',
      labels: labelsBarras,
      data:   dataBarras,
      color:  COR.primary,
      label:  'R$',
    } : null,
  }
}
