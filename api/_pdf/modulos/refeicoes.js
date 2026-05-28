/**
 * api/_pdf/modulos/refeicoes.js
 * Dashboard de Refeições — fonte: tabela `refei_solicitacoes`.
 *
 * Bate com a tela /refeicoes:
 *   - Filtra OUT status 'rascunho' e 'reprovado' (igual `ativos` na UI)
 *   - Refeições/Cafés/Custo por mês usam SUM(total_refeicoes, total_cafes, valor_total)
 */

import { fmtBRL, fmtData, fmtNumero, COR } from '../layout.js'
import { PALETA } from '../charts.js'

const STATUS_PENDENTES = ['pendente', 'aguardando_aprovacao']
const STATUS_EM_PREPARO = ['confirmado_restaurante', 'enviado_restaurante', 'em_acompanhamento']
const STATUS_ENTREGUES = ['entregue', 'finalizado']

export async function buildDashboardRefeicoes(workspaceId, filtros, supabase, empresa) {
  const { data_inicio, data_fim } = filtros

  const { data, error } = await supabase
    .from('refei_solicitacoes')
    .select('id, status, valor_total, total_refeicoes, total_cafes, data_refeicao, restaurante_id, equipe_id, refei_restaurantes(nome), refei_equipes(nome)')
    .eq('workspace_id', workspaceId)
    .order('data_refeicao', { ascending: false })
    .limit(5000)
  if (error) throw new Error('Erro ao buscar refeições: ' + error.message)

  const sols = (data || [])
    .map(s => ({ ...s, restaurante_nome: s.refei_restaurantes?.nome || null, equipe_nome: s.refei_equipes?.nome || null }))
    .filter(s => s.status !== 'rascunho' && s.status !== 'reprovado')

  // KPIs globais (todo o workspace + recorte mês)
  const mesAtual = new Date().toISOString().slice(0, 7)
  const noMes = sols.filter(s => String(s.data_refeicao || '').startsWith(mesAtual))
  const noPeriodo = sols.filter(s => {
    const d = s.data_refeicao || ''
    return d >= data_inicio && d <= data_fim
  })

  const sum = (arr, k) => arr.reduce((a, x) => a + Number(x[k] || 0), 0)

  const pendentes  = sols.filter(s => STATUS_PENDENTES.includes(s.status))
  const aprovados  = sols.filter(s => s.status === 'aprovado')
  const emPreparo  = sols.filter(s => STATUS_EM_PREPARO.includes(s.status))
  const entregues  = sols.filter(s => STATUS_ENTREGUES.includes(s.status))

  const refMes    = sum(noMes, 'total_refeicoes')
  const cafMes    = sum(noMes, 'total_cafes')
  const valorMes  = sum(noMes, 'valor_total')

  // ── Pizza: por restaurante (top 6, no período) ──────────────────────────
  const porRest = {}
  for (const s of noPeriodo) {
    const k = s.restaurante_nome || 'Sem restaurante'
    porRest[k] = (porRest[k] || 0) + Number(s.valor_total || 0)
  }
  const topRest = Object.entries(porRest).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // ── Barras: refeições por dia (período, máx 14 dias) ────────────────────
  const porDia = {}
  for (const s of noPeriodo) {
    const d = String(s.data_refeicao || '').slice(0, 10)
    if (!d) continue
    porDia[d] = (porDia[d] || 0) + Number(s.total_refeicoes || 0) + Number(s.total_cafes || 0)
  }
  const dias = Object.keys(porDia).sort().slice(-14)
  const labelsBarras = dias.map(d => fmtData(d).slice(0, 5))
  const dataBarras   = dias.map(d => porDia[d])

  return {
    titulo:    'Relatório de Refeições',
    subtitulo: `${fmtData(data_inicio)} a ${fmtData(data_fim)}`,
    empresa,
    kpis: [
      { label: 'Refeições no mês', value: fmtNumero(refMes + cafMes), color: COR.primary, sub: `${refMes} refeições · ${cafMes} cafés` },
      { label: 'Custo no mês',     value: fmtBRL(valorMes),           color: COR.info,    sub: `${noMes.length} solicitações` },
      { label: 'Aguardando Aprov.',value: fmtNumero(pendentes.length),color: pendentes.length ? COR.danger : COR.success, sub: `Aprovadas: ${aprovados.length}` },
      { label: 'Entregues',        value: fmtNumero(entregues.length),color: COR.success, sub: `Em preparo: ${emPreparo.length}` },
    ],
    pizza: topRest.length ? {
      titulo: 'Custo por restaurante (período)',
      labels: topRest.map(([k]) => k),
      data:   topRest.map(([, v]) => Number(v.toFixed(2))),
      colors: topRest.map((_, i) => PALETA[i % PALETA.length]),
    } : null,
    barras: dias.length ? {
      titulo: `Refeições por dia (período)`,
      labels: labelsBarras,
      data:   dataBarras,
      color:  COR.primary,
      label:  'qtd',
    } : null,
  }
}
