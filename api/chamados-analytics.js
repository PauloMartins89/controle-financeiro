// api/chamados-analytics.js
// Painel Analítico — Chamados WA
// GET ?workspace_id=&data_inicio=&data_fim=&grupo_id=&tecnico_id=&status=

import { createClient } from '@supabase/supabase-js'

const supabaseUrl        = process.env.SUPABASE_URL       || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

// Diferença em dias entre duas datas
function diasDiff(d1, d2) {
  return Math.round((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24))
}

// Formata data como YYYY-MM-DD
function ymd(d) { return new Date(d).toISOString().slice(0, 10) }

// Diferença em horas entre dois timestamps
function horasDiff(a, b) {
  if (!a || !b) return null
  return (new Date(b) - new Date(a)) / (1000 * 60 * 60)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const supabase    = getSupabase()
  const { workspace_id, grupo_id, tecnico_id, status: filtroStatus } = req.query

  if (!workspace_id) return res.status(400).json({ error: 'workspace_id obrigatório' })

  // ── Intervalo do período principal ─────────────────────────────────────────
  const hoje = new Date()
  hoje.setHours(23, 59, 59, 999)

  const dataFimRaw   = req.query.data_fim    || hoje.toISOString()
  const dataFim      = new Date(dataFimRaw)
  dataFim.setHours(23, 59, 59, 999)

  const dataInicioRaw = req.query.data_inicio || (() => {
    const d = new Date(dataFim)
    d.setDate(d.getDate() - 29)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  })()
  const dataInicio = new Date(dataInicioRaw)
  dataInicio.setHours(0, 0, 0, 0)

  // ── Período anterior (mesmo comprimento) ───────────────────────────────────
  const periodoLen       = diasDiff(dataInicio, dataFim) + 1
  const dataFimAnt       = new Date(dataInicio)
  dataFimAnt.setDate(dataFimAnt.getDate() - 1)
  dataFimAnt.setHours(23, 59, 59, 999)
  const dataInicioAnt    = new Date(dataFimAnt)
  dataInicioAnt.setDate(dataInicioAnt.getDate() - periodoLen + 1)
  dataInicioAnt.setHours(0, 0, 0, 0)

  try {
    // ── Busca registros do período principal ───────────────────────────────
    let q = supabase
      .from('solicitacoes_atendimento')
      .select('id, status, prioridade, confianca_ia, created_at, data_finalizacao, updated_at, tecnico_id, grupo_id, resumo_ia, solicitante_nome, equipamento, local, grupo:whatsapp_grupos(nome_grupo, sla_resolucao_h), tecnico:tecnicos(nome)')
      .eq('workspace_id', workspace_id)
      .gte('created_at', dataInicio.toISOString())
      .lte('created_at', dataFim.toISOString())

    if (grupo_id)       q = q.eq('grupo_id', grupo_id)
    if (tecnico_id)     q = q.eq('tecnico_id', tecnico_id)
    if (filtroStatus)   q = q.eq('status', filtroStatus)

    const { data: rows = [], error: errRows } = await q
    if (errRows) throw errRows

    // ── Busca período anterior (sem filtros de grupo/tecnico/status) ──────
    const { data: rowsAnt = [] } = await supabase
      .from('solicitacoes_atendimento')
      .select('id, status, data_finalizacao, created_at, grupo:whatsapp_grupos(sla_resolucao_h)')
      .eq('workspace_id', workspace_id)
      .gte('created_at', dataInicioAnt.toISOString())
      .lte('created_at', dataFimAnt.toISOString())

    // ── Busca grupos para filtros ──────────────────────────────────────────
    const { data: grupos = [] } = await supabase
      .from('whatsapp_grupos')
      .select('id, nome_grupo, sla_resolucao_h')
      .eq('workspace_id', workspace_id)
      .eq('ativo', true)

    // ── Busca técnicos para filtros ───────────────────────────────────────
    const { data: tecnicos = [] } = await supabase
      .from('tecnicos')
      .select('id, nome')
      .eq('workspace_id', workspace_id)
      .eq('ativo', true)

    // ═══════════════════════════════════════════════════════════════════════
    // AGREGAÇÕES JS
    // ═══════════════════════════════════════════════════════════════════════

    const STATUS_ATIVOS   = ['aberta', 'triagem', 'enviada_tecnico', 'em_atendimento', 'aguardando_informacao']
    const STATUS_RESOLVIDO = 'concluida'

    function isSlaVencida(row) {
      const slaH = row.grupo?.sla_resolucao_h || 24
      const slaMs = slaH * 60 * 60 * 1000
      const abertoEm = new Date(row.created_at)
      const referenciaFim = row.data_finalizacao ? new Date(row.data_finalizacao) : new Date()
      return (referenciaFim - abertoEm) > slaMs
    }

    // ── KPIs período atual ────────────────────────────────────────────────
    const novos      = rows.filter(r => r.status !== 'descartada').length
    const emAndamento = rows.filter(r => STATUS_ATIVOS.includes(r.status)).length
    const resolvidos  = rows.filter(r => r.status === STATUS_RESOLVIDO).length
    const atrasados   = rows.filter(r => STATUS_ATIVOS.includes(r.status) && isSlaVencida(r)).length

    const resolvidosComTempo = rows.filter(r => r.status === STATUS_RESOLVIDO && r.data_finalizacao)
    const temposH = resolvidosComTempo.map(r => horasDiff(r.created_at, r.data_finalizacao)).filter(Boolean)
    const tempoMedioH = temposH.length ? temposH.reduce((a, b) => a + b, 0) / temposH.length : 0

    const totalComSLA = rows.filter(r => r.status !== 'descartada').length
    const slaCumpridos = rows.filter(r => r.status !== 'descartada' && !isSlaVencida(r)).length
    const slaPct = totalComSLA ? (slaCumpridos / totalComSLA) * 100 : 0

    // ── KPIs período anterior ────────────────────────────────────────────
    const novosAnt     = rowsAnt.filter(r => r.status !== 'descartada').length
    const resolvidosAnt = rowsAnt.filter(r => r.status === STATUS_RESOLVIDO).length
    const atrasadosAnt  = rowsAnt.filter(r => STATUS_ATIVOS.includes(r.status) && isSlaVencida(r)).length
    const emAndamentoAnt = rowsAnt.filter(r => STATUS_ATIVOS.includes(r.status)).length
    const totalAnt = rowsAnt.filter(r => r.status !== 'descartada').length
    const slaCumpridosAnt = rowsAnt.filter(r => r.status !== 'descartada' && !isSlaVencida(r)).length
    const slaPctAnt = totalAnt ? (slaCumpridosAnt / totalAnt) * 100 : 0

    function delta(atual, ant) {
      const d = atual - ant
      const pct = ant > 0 ? (d / ant) * 100 : 0
      return { delta: d, pct: +pct.toFixed(1) }
    }

    // ── Evolução por dia ──────────────────────────────────────────────────
    const diasMap = {}
    rows.forEach(r => {
      const d = ymd(r.created_at)
      if (!diasMap[d]) diasMap[d] = { data: d, novos: 0, resolvidos: 0, atrasados: 0 }
      if (r.status !== 'descartada') diasMap[d].novos++
      if (r.status === STATUS_RESOLVIDO) diasMap[d].resolvidos++
      if (STATUS_ATIVOS.includes(r.status) && isSlaVencida(r)) diasMap[d].atrasados++
    })
    // Preencher dias sem dados
    const evolucaoDia = []
    const cursor = new Date(dataInicio)
    while (cursor <= dataFim) {
      const d = ymd(cursor)
      evolucaoDia.push(diasMap[d] || { data: d, novos: 0, resolvidos: 0, atrasados: 0 })
      cursor.setDate(cursor.getDate() + 1)
    }

    // ── Distribuição por status ───────────────────────────────────────────
    const STATUS_LABELS = {
      aberta: 'Novo', triagem: 'Em triagem', enviada_tecnico: 'Enviado ao Técnico',
      em_atendimento: 'Em atendimento', aguardando_informacao: 'Aguard. informação',
      concluida: 'Resolvido', descartada: 'Descartado', erro_classificacao: 'Erro IA',
    }
    const STATUS_COLORS = {
      aberta: '#6366f1', triagem: '#f59e0b', enviada_tecnico: '#0ea5e9',
      em_atendimento: '#8b5cf6', aguardando_informacao: '#f97316',
      concluida: '#10b981', descartada: '#94a3b8', erro_classificacao: '#ef4444',
    }
    const statusMap = {}
    rows.forEach(r => {
      statusMap[r.status] = (statusMap[r.status] || 0) + 1
    })
    const porStatus = Object.entries(statusMap)
      .map(([status, total]) => ({ status, label: STATUS_LABELS[status] || status, color: STATUS_COLORS[status] || '#94a3b8', total }))
      .sort((a, b) => b.total - a.total)

    // ── Por grupo WA ──────────────────────────────────────────────────────
    const grupoMap = {}
    rows.forEach(r => {
      const nome = r.grupo?.nome_grupo || r.grupo_id || 'Sem grupo'
      grupoMap[nome] = (grupoMap[nome] || 0) + 1
    })
    const porGrupo = Object.entries(grupoMap)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // ── Ranking de técnicos ───────────────────────────────────────────────
    const tecMap = {}
    rows.filter(r => r.status === STATUS_RESOLVIDO).forEach(r => {
      const nome = r.tecnico?.nome || 'Sem técnico'
      tecMap[nome] = (tecMap[nome] || 0) + 1
    })
    const rankingTecnicos = Object.entries(tecMap)
      .map(([nome, resolvidos]) => ({ nome, resolvidos }))
      .sort((a, b) => b.resolvidos - a.resolvidos)
      .slice(0, 8)

    // ── SLA cumprido x vencido ────────────────────────────────────────────
    const slaVencidoN  = rows.filter(r => r.status !== 'descartada' && isSlaVencida(r)).length
    const slaCumpridoN = totalComSLA - slaVencidoN > 0 ? totalComSLA - slaVencidoN : slaCumpridos

    // ── Atrasos por prioridade ────────────────────────────────────────────
    const priorMap = { critica: 0, alta: 0, media: 0, baixa: 0 }
    rows.filter(r => STATUS_ATIVOS.includes(r.status) && isSlaVencida(r)).forEach(r => {
      const p = r.prioridade || 'media'
      if (priorMap[p] !== undefined) priorMap[p]++
      else priorMap['media']++
    })

    // ── Automático x manual ───────────────────────────────────────────────
    const automaticos = rows.filter(r => r.confianca_ia && r.confianca_ia > 0).length
    const manuais     = rows.length - automaticos

    // ── Confiança da IA ───────────────────────────────────────────────────
    const confBuckets = [
      { label: '90–100%', min: 0.9, max: 1.01, total: 0, color: '#10b981' },
      { label: '80–89%',  min: 0.8, max: 0.9,  total: 0, color: '#6366f1' },
      { label: '70–79%',  min: 0.7, max: 0.8,  total: 0, color: '#f59e0b' },
      { label: '<70%',    min: 0,   max: 0.7,  total: 0, color: '#ef4444' },
    ]
    rows.filter(r => r.confianca_ia > 0).forEach(r => {
      const b = confBuckets.find(b => r.confianca_ia >= b.min && r.confianca_ia < b.max)
      if (b) b.total++
    })

    // ═══════════════════════════════════════════════════════════════════════
    // RESPOSTA
    // ═══════════════════════════════════════════════════════════════════════
    return res.json({
      periodo: {
        inicio: dataInicio.toISOString(),
        fim:    dataFim.toISOString(),
        dias:   periodoLen,
      },
      kpis: {
        novos,          ...delta(novos, novosAnt),         novos_ant: novosAnt,
        emAndamento,    ...Object.fromEntries(Object.entries(delta(emAndamento, emAndamentoAnt)).map(([k,v]) => ['em_andamento_'+k,v])),
        atrasados,      atrasados_delta: delta(atrasados, atrasadosAnt).delta,  atrasados_pct: delta(atrasados, atrasadosAnt).pct,
        resolvidos,     resolvidos_delta: delta(resolvidos, resolvidosAnt).delta, resolvidos_pct: delta(resolvidos, resolvidosAnt).pct,
        slaPct:         +slaPct.toFixed(1),
        slaDelta:       +(slaPct - slaPctAnt).toFixed(1),
        tempoMedioH:    +tempoMedioH.toFixed(2),
        total:          rows.length,
      },
      evolucaoDia,
      porStatus,
      porGrupo,
      rankingTecnicos,
      slaStats: {
        cumprido:  slaCumpridoN,
        vencido:   slaVencidoN,
        pct:       +slaPct.toFixed(1),
      },
      atrasosPrioridade: priorMap,
      automaticosVsManuais: { automaticos, manuais, total: rows.length },
      confiancaIA: confBuckets,
      filtros: { grupos, tecnicos },
    })
  } catch (err) {
    console.error('[chamados-analytics]', err)
    return res.status(500).json({ error: err.message })
  }
}
