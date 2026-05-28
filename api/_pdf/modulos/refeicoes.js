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
const STATUS_EM_PREPARO = ['confirmado_restaurante', 'enviado_restaurante', 'em_acompanhamento', 'novo_status']
const STATUS_ENTREGUES = ['entregue', 'finalizado']

export async function buildDashboardRefeicoes(workspaceId, filtros, supabase, empresa) {
  const { data_inicio, data_fim, formato } = filtros
  const isLista = formato === 'lista' || formato === 'tabela'

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

  // ── Tabela do período (modo lista exibe até 200) ────────────────────
  const STATUS_LABEL_REF = {
    pendente: 'AG. APROV.', aguardando_aprovacao: 'AG. APROV.',
    aprovado: 'APROVADO', consolidado: 'CONSOLIDADO',
    enviado_restaurante: 'NO RESTAURANTE', confirmado_restaurante: 'CONFIRMADO',
    em_acompanhamento: 'EM ACOMP.',
    entregue: 'ENTREGUE', finalizado: 'FINALIZADO',
    aguardando_validacao: 'AG. VALID.', finalizado_com_ocorrencia: 'OCORRÊNCIA',
  }
  const cap = isLista ? 200 : 25
  const linhasTab = noPeriodo.slice(0, cap).map(s => ({
    data:       fmtData(s.data_refeicao),
    equipe:     s.equipe_nome || '—',
    restaurante:s.restaurante_nome || '—',
    ref:        s.total_refeicoes ?? 0,
    caf:        s.total_cafes ?? 0,
    valor:      fmtBRL(s.valor_total),
    status:     STATUS_LABEL_REF[s.status] || String(s.status || '—').toUpperCase(),
  }))

  return {
    titulo:    'RELATÓRIO',
    modulo:    isLista ? 'REFEIÇÕES — LISTAGEM' : 'REFEIÇÕES',
    subtitulo: `Período de ${fmtData(data_inicio)} a ${fmtData(data_fim)}`,
    empresa,
    meta: {
      periodo: `${fmtData(data_inicio)} a ${fmtData(data_fim)}`,
      geradoEm: new Date().toLocaleString('pt-BR'),
      geradoPor: typeof empresa === 'string' ? empresa : (empresa?.nome || 'SmartPro'),
    },
    visaoGeral: isLista
      ? `Listagem detalhada das solicitações de refeição no período. ${noPeriodo.length} solicitação(ões) ativa(s).`
      : `Panorama operacional de refeições: ${refMes + cafMes} itens consumidos no mês, custo de ${fmtBRL(valorMes)}, ${pendentes.length} solicitação(ões) aguardando aprovação.`,
    analise: isLista ? null : [
      `${refMes + cafMes} itens no mês (${refMes} refeições · ${cafMes} cafés) em ${noMes.length} solicitações.`,
      `Custo do mês: ${fmtBRL(valorMes)}.`,
      pendentes.length ? `${pendentes.length} solicitações aguardando aprovação.` : 'Nenhuma solicitação pendente — fluxo em dia.',
    ],
    observacoes: isLista ? null : [
      topRest[0] ? `Restaurante líder no período: ${topRest[0][0]} (${fmtBRL(topRest[0][1])}).` : 'Sem custos registrados no período.',
      `Status final: ${entregues.length} entregues, ${emPreparo.length} em preparo.`,
    ],
    kpis: [
      { label: 'Refeições no mês', value: fmtNumero(refMes + cafMes), tone: 'info',    sub: `${refMes} ref · ${cafMes} cafés`, icon: 'chart' },
      { label: 'Custo no mês',     value: fmtBRL(valorMes),           tone: 'purple',  sub: `${noMes.length} solicitações`,    icon: 'doc' },
      { label: 'Ag. Aprovação',    value: fmtNumero(pendentes.length),tone: pendentes.length ? 'warning' : 'success', sub: `Aprovadas: ${aprovados.length}`, icon: 'clock' },
      { label: 'Entregues',         value: fmtNumero(entregues.length),tone: 'success', sub: `Em preparo: ${emPreparo.length}`,  icon: 'check' },
    ],
    pizza: !isLista && topRest.length ? {
      titulo: 'CUSTO POR RESTAURANTE',
      labels: topRest.map(([k]) => k),
      data:   topRest.map(([, v]) => Number(v.toFixed(2))),
      colors: topRest.map((_, i) => PALETA[i % PALETA.length]),
    } : null,
    linha: !isLista && dias.length ? {
      titulo: 'EVOLUÇÃO NO PERÍODO',
      labels: labelsBarras,
      data:   dataBarras,
      label:  'Itens por dia',
    } : null,
    tabela: linhasTab.length ? {
      titulo: `5. DETALHAMENTO — ${noPeriodo.length} solicitação(ões)`,
      colunas: [
        { key: 'data',        label: 'Data',       width: 55 },
        { key: 'equipe',      label: 'Equipe',     width: 110 },
        { key: 'restaurante', label: 'Restaurante',width: 110 },
        { key: 'ref',         label: 'Ref',        width: 35, align: 'center' },
        { key: 'caf',         label: 'Café',       width: 35, align: 'center' },
        { key: 'valor',       label: 'Valor',      width: 70, align: 'right' },
        { key: 'status',      label: 'Status',     width: 90, align: 'center' },
      ],
      linhas: linhasTab,
      totais: {
        equipe: 'TOTAL',
        ref:    noPeriodo.reduce((s, x) => s + Number(x.total_refeicoes || 0), 0),
        caf:    noPeriodo.reduce((s, x) => s + Number(x.total_cafes || 0), 0),
        valor:  fmtBRL(noPeriodo.reduce((s, x) => s + Number(x.valor_total || 0), 0)),
        status: `${noPeriodo.length} reg.`,
      },
    } : null,
  }
}
