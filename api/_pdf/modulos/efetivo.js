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
    titulo:    isLista ? 'Lista — Efetivo' : 'Relatório de Efetivo',
    subtitulo: `Quadro atual · ${todos.length} colaborador(es) cadastrado(s)`,
    empresa,
    kpis: [
      { label: 'Ativos',          value: fmtNumero(ativos.length),   color: COR.success, sub: `${inativos.length} inativos` },
      { label: 'Funções',         value: fmtNumero(funcoesUnicas),   color: COR.primary },
      { label: 'Cargos',          value: fmtNumero(cargosUnicos),    color: COR.info },
      { label: 'Total cadastro',  value: fmtNumero(todos.length),    color: COR.warning },
    ],
    pizza: !isLista && topFuncoes.length ? {
      titulo: 'Distribuição por função',
      labels: topFuncoes.map(([k]) => k),
      data:   topFuncoes.map(([, v]) => v),
      colors: topFuncoes.map((_, i) => PALETA[i % PALETA.length]),
    } : null,
    barras: !isLista && topCargos.length ? {
      titulo: 'Colaboradores por cargo (top 10)',
      labels: topCargos.map(([k]) => k.length > 14 ? k.slice(0, 12) + '…' : k),
      data:   topCargos.map(([, v]) => v),
      color:  COR.primary,
      label:  'qtd',
    } : null,
    tabela: linhasTab.length ? {
      titulo: `Quadro de efetivo (${todos.length})`,
      colunas: [
        { key: 'nome',   label: 'Nome',    width: 180 },
        { key: 'cargo',  label: 'Cargo',   width: 130 },
        { key: 'funcao', label: 'Função',  width: 130 },
        { key: 'status', label: 'Status',  width: 75, align: 'center' },
      ],
      linhas: linhasTab,
    } : null,
  }
}
