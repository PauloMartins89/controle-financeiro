/**
 * api/_pdf/modulos/agendamentos.js
 * Dashboard de Agendamentos — fonte: tabela `agendamentos_servicos`.
 */

import { fmtData, fmtNumero, COR } from '../layout.js'
import { PALETA } from '../charts.js'

const STATUS_LABEL = {
  agendado:                  'Agendado',
  alerta_pendente:           'Alerta Pendente',
  alerta_enviado:            'Alerta Enviado',
  confirmado:                'Confirmado',
  ajuste_solicitado:         'Ajuste Solicitado',
  reagendamento_solicitado:  'Reagendamento',
  em_execucao:               'Em Execução',
  concluido:                 'Concluído',
  cancelado:                 'Cancelado',
}

const STATUS_CONCLUIDO  = ['concluido']
const STATUS_CONFIRMADO = ['confirmado', 'em_execucao']
const STATUS_PENDENTES  = ['agendado', 'alerta_pendente', 'alerta_enviado', 'ajuste_solicitado', 'reagendamento_solicitado']
const STATUS_CANCELADO  = ['cancelado']

export async function buildDashboardAgendamentos(workspaceId, filtros, supabase, empresa) {
  const { data_inicio, data_fim, formato } = filtros
  const isLista = formato === 'lista' || formato === 'tabela'

  const { data, error } = await supabase
    .from('agendamentos_servicos')
    .select('id, cliente_nome, tipo_servico, atividade, data_servico, horario_servico, status, motorista_nome, veiculo_nome, origem, destino, workspace_id')
    .eq('workspace_id', workspaceId)
    .gte('data_servico', data_inicio)
    .lte('data_servico', data_fim)
    .order('data_servico', { ascending: false })
    .limit(2000)
  if (error) throw new Error('Erro ao buscar agendamentos: ' + error.message)

  // Todos os registros já estão filtrados pelo período solicitado
  const noPeriodo = data || []
  const todos = noPeriodo

  const pendentes  = noPeriodo.filter(s => STATUS_PENDENTES.includes(s.status))
  const confirmados= noPeriodo.filter(s => STATUS_CONFIRMADO.includes(s.status))
  const concluidos = noPeriodo.filter(s => STATUS_CONCLUIDO.includes(s.status))
  const cancelados = noPeriodo.filter(s => STATUS_CANCELADO.includes(s.status))

  // Pizza: distribuição por status (período)
  const porStatus = {}
  for (const s of noPeriodo) {
    const k = STATUS_LABEL[s.status] || s.status || '—'
    porStatus[k] = (porStatus[k] || 0) + 1
  }
  const pizzaArr = Object.entries(porStatus).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // Linha: agendamentos por dia no período (máx 14 dias)
  const porDia = {}
  for (const s of noPeriodo) {
    const d = String(s.data_servico || '').slice(0, 10)
    if (!d) continue
    porDia[d] = (porDia[d] || 0) + 1
  }
  const dias = Object.keys(porDia).sort().slice(-14)
  const labelsLinha = dias.map(d => fmtData(d).slice(0, 5))
  const dataLinha   = dias.map(d => porDia[d])

  // Top tipo_servico
  const porTipo = {}
  for (const s of noPeriodo) {
    const k = s.tipo_servico || 'Outros'
    porTipo[k] = (porTipo[k] || 0) + 1
  }
  const topTipo = Object.entries(porTipo).sort((a, b) => b[1] - a[1])

  // Tabela
  const cap = isLista ? 200 : 25
  const linhasTab = noPeriodo.slice(0, cap).map(s => ({
    data:      fmtData(String(s.data_servico || '').slice(0, 10)),
    horario:   s.horario_servico ? String(s.horario_servico).slice(0, 5) : '—',
    cliente:   (s.cliente_nome || '—').slice(0, 35),
    servico:   (s.tipo_servico || s.atividade || '—').slice(0, 30),
    motorista: (s.motorista_nome || '—').slice(0, 25),
    status:    (STATUS_LABEL[s.status] || s.status || '—').toUpperCase(),
    _color: {
      status: STATUS_CONCLUIDO.includes(s.status) ? COR.success
            : STATUS_CANCELADO.includes(s.status) ? COR.danger
            : STATUS_CONFIRMADO.includes(s.status) ? COR.info
            : COR.warning,
    },
  }))

  return {
    titulo:    'RELATÓRIO',
    modulo:    isLista ? 'AGENDAMENTOS — LISTAGEM' : 'AGENDAMENTOS',
    subtitulo: `Período de ${fmtData(data_inicio)} a ${fmtData(data_fim)}`,
    empresa,
    meta: {
      periodo:   `${fmtData(data_inicio)} a ${fmtData(data_fim)}`,
      geradoEm:  new Date().toLocaleString('pt-BR'),
      geradoPor: typeof empresa === 'string' ? empresa : (empresa?.nome || 'SmartPro'),
    },
    visaoGeral: isLista
      ? `Listagem de ${noPeriodo.length} agendamento(s) de serviço no período.`
      : `Panorama de agendamentos no período: ${noPeriodo.length} agendamento(s), ${pendentes.length} pendentes, ${confirmados.length} confirmados/em execução, ${concluidos.length} concluídos.`,
    analise: isLista ? null : [
      `${noPeriodo.length} agendamento(s) registrado(s) no período selecionado.`,
      `${confirmados.length} confirmado(s)/em execução · ${concluidos.length} concluído(s) · ${cancelados.length} cancelado(s).`,
      topTipo[0] ? `Serviço mais solicitado: ${topTipo[0][0]} (${topTipo[0][1]} vez(es)).` : 'Nenhum serviço registrado no período.',
    ],
    observacoes: isLista ? null : [
      pendentes.length
        ? `${pendentes.length} agendamento(s) aguardando confirmação ou alerta.`
        : 'Nenhum agendamento pendente.',
      cancelados.length
        ? `${cancelados.length} cancelamento(s) no período — verificar motivo.`
        : 'Nenhum cancelamento no período.',
    ],
    kpis: [
      { label: 'Total no período',    value: fmtNumero(noPeriodo.length),  tone: 'info',    sub: `${fmtData(data_inicio)} a ${fmtData(data_fim)}`, icon: 'cal' },
      { label: 'Pendentes',           value: fmtNumero(pendentes.length),   tone: pendentes.length ? 'warning' : 'success', sub: 'aguardando ação', icon: 'clock' },
      { label: 'Confirmados',         value: fmtNumero(confirmados.length), tone: 'info',    sub: 'ou em execução', icon: 'check' },
      { label: 'Concluídos',          value: fmtNumero(concluidos.length),  tone: 'success', sub: `${cancelados.length} cancelados`, icon: 'chart' },
    ],
    pizza: !isLista && pizzaArr.length ? {
      titulo: 'DISTRIBUIÇÃO POR STATUS',
      labels: pizzaArr.map(([k]) => k),
      data:   pizzaArr.map(([, v]) => v),
      colors: pizzaArr.map((_, i) => PALETA[i % PALETA.length]),
    } : null,
    linha: !isLista && dias.length ? {
      titulo: 'AGENDAMENTOS POR DIA',
      labels: labelsLinha,
      data:   dataLinha,
      label:  'qtd',
    } : null,
    tabela: linhasTab.length ? {
      titulo: `5. DETALHAMENTO — ${noPeriodo.length} agendamento(s)`,
      colunas: [
        { key: 'data',      label: 'Data',     width: 52 },
        { key: 'horario',   label: 'Horário',  width: 45, align: 'center' },
        { key: 'cliente',   label: 'Cliente',  width: 120 },
        { key: 'servico',   label: 'Serviço',  width: 105 },
        { key: 'motorista', label: 'Motorista',width: 100 },
        { key: 'status',    label: 'Status',   width: 102, align: 'center' },
      ],
      linhas: linhasTab,
      totais: {
        cliente: 'TOTAL',
        status:  `${noPeriodo.length} reg.`,
      },
    } : null,
  }
}
