/**
 * api/_pdf/modulos/efetivo.js
 * Dashboard de Efetivo — fonte: tabela `efetivo` (+ join `funcoes_efetivo`).
 *
 * KPIs refletem ESTADO ATUAL do quadro (ignoram data_inicio/data_fim).
 */

import { fmtNumero, COR } from '../layout.js'
import { PALETA } from '../charts.js'

export async function buildDashboardEfetivo(workspaceId, filtros, supabase, empresa) {
  const { formato } = filtros || {}
  const isLista = formato === 'lista' || formato === 'tabela'
  const { data } = await supabase
    .from('efetivo')
    .select('id, nome, cargo, ativo, funcao_id, equipe_id, funcoes_efetivo(nome)')
    .eq('workspace_id', workspaceId)
    .order('nome')
    .limit(5000)

  const todos = data || []
  const ativos   = todos.filter(e => e.ativo)
  const inativos = todos.filter(e => !e.ativo)

  // Mapas
  const porFuncao = {}
  const porCargo  = {}
  for (const e of ativos) {
    const f = e.funcoes_efetivo?.nome || 'Sem função'
    porFuncao[f] = (porFuncao[f] || 0) + 1
    const c = e.cargo || 'Sem cargo'
    porCargo[c] = (porCargo[c] || 0) + 1
  }
  const funcoesUnicas = Object.keys(porFuncao).filter(k => k !== 'Sem função').length
  const cargosUnicos  = Object.keys(porCargo).filter(k => k !== 'Sem cargo').length

  const topFuncoes = Object.entries(porFuncao).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const topCargos  = Object.entries(porCargo).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // Tabela: no modo lista exibe todos os ativos
  const linhasTab = isLista
    ? todos.slice(0, 300).map(e => ({
        nome:   e.nome || '—',
        cargo:  e.cargo || '—',
        funcao: e.funcoes_efetivo?.nome || '—',
        status: e.ativo ? 'ATIVO' : 'INATIVO',
        _color: { status: e.ativo ? COR.success : COR.danger },
      }))
    : []

  return {
    titulo:    'RELATÓRIO',
    modulo:    isLista ? 'EFETIVO — LISTAGEM' : 'EFETIVO',
    subtitulo: `Quadro atual · ${todos.length} colaborador(es) cadastrado(s)`,
    empresa,
    meta: {
      periodo:   'Quadro atual',
      geradoEm:  new Date().toLocaleString('pt-BR'),
      geradoPor: typeof empresa === 'string' ? empresa : (empresa?.nome || 'SmartPro'),
    },
    visaoGeral: isLista
      ? `Listagem completa do quadro de efetivo: ${todos.length} colaborador(es) cadastrado(s), ${ativos.length} ativo(s).`
      : `Quadro de efetivo com ${ativos.length} colaboradores ativos em ${funcoesUnicas} funções e ${cargosUnicos} cargos distintos.`,
    analise: isLista ? null : [
      `${ativos.length} colaboradores ativos · ${inativos.length} inativos de ${todos.length} cadastrados.`,
      `${funcoesUnicas} funções distintas · ${cargosUnicos} cargos distintos no quadro ativo.`,
      topFuncoes[0] ? `Função mais frequente: ${topFuncoes[0][0]} (${topFuncoes[0][1]} pessoa(s)).` : 'Nenhuma função cadastrada.',
    ],
    observacoes: isLista ? null : [
      topCargos[0] ? `Cargo mais comum: ${topCargos[0][0]} (${topCargos[0][1]} pessoa(s)).` : 'Nenhum cargo cadastrado.',
      inativos.length ? `${inativos.length} colaborador(es) inativo(s) — revisar cadastro.` : 'Todos os colaboradores estão ativos.',
    ],
    kpis: [
      { label: 'Colaboradores ativos', value: fmtNumero(ativos.length),   tone: 'success', sub: `${inativos.length} inativos`,     icon: 'check' },
      { label: 'Total cadastro',       value: fmtNumero(todos.length),    tone: 'info',    sub: `${todos.length} registros`,        icon: 'user' },
      { label: 'Funções distintas',    value: fmtNumero(funcoesUnicas),   tone: 'warning', sub: 'funções cadastradas',              icon: 'doc' },
      { label: 'Cargos distintos',     value: fmtNumero(cargosUnicos),    tone: 'purple',  sub: 'cargos cadastrados',               icon: 'chart' },
    ],
    pizza: !isLista && topFuncoes.length ? {
      titulo: 'DISTRIBUIÇÃO POR FUNÇÃO',
      labels: topFuncoes.map(([k]) => k),
      data:   topFuncoes.map(([, v]) => v),
      colors: topFuncoes.map((_, i) => PALETA[i % PALETA.length]),
    } : null,
    linha: !isLista && topCargos.length ? {
      titulo: 'COLABORADORES POR CARGO (TOP 10)',
      labels: topCargos.map(([k]) => k.length > 12 ? k.slice(0, 10) + '…' : k),
      data:   topCargos.map(([, v]) => v),
      label:  'qtd',
    } : null,
    tabela: linhasTab.length ? {
      titulo: `5. DETALHAMENTO — ${todos.length} colaborador(es)`,
      colunas: [
        { key: 'nome',   label: 'Nome',   width: 185 },
        { key: 'cargo',  label: 'Cargo',  width: 130 },
        { key: 'funcao', label: 'Função', width: 130 },
        { key: 'status', label: 'Status', width: 79, align: 'center' },
      ],
      linhas: linhasTab,
      totais: {
        nome:   'TOTAL',
        status: `${todos.length} reg.`,
      },
    } : null,
  }
}
