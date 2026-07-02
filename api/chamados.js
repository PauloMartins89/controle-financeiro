// api/chamados.js
// Solicitações de Atendimento Técnico: CRUD + triagem + notificação manual

import { createClient }   from '@supabase/supabase-js'
import ws                 from 'ws'
import { notificarTecnico } from './_chamados-notificar.js'

const supabaseUrl        = process.env.SUPABASE_URL       || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    realtime: { params: { log_level: 'disabled' }, transport: ws },
    global: {},
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const supabase    = getSupabase()
  const workspaceId = req.query.workspace_id || req.body?.workspace_id
  const { id, action } = req.query

  try {
    // ── GET /api/chamados?action=dashboard – KPIs ────────────────────────────
    if (req.method === 'GET' && action === 'dashboard') {
      if (!workspaceId) return res.status(400).json({ error: 'workspace_id obrigatório' })
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const hojeISO = hoje.toISOString()

      const [
        { count: total },
        { count: abertasHoje },
        { count: emTriagem },
        { count: enviadasTecnico },
        { count: descartadas },
        { data: logsHoje },
        { data: ultimos },
        { count: totalGrupos },
      ] = await Promise.all([
        supabase.from('solicitacoes_atendimento').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
        supabase.from('solicitacoes_atendimento').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gte('created_at', hojeISO).neq('status', 'descartada'),
        supabase.from('solicitacoes_atendimento').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'triagem'),
        supabase.from('solicitacoes_atendimento').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'enviada_tecnico'),
        supabase.from('solicitacoes_atendimento').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'descartada'),
        supabase.from('logs_classificacao_ia').select('confianca').eq('workspace_id', workspaceId).gte('created_at', hojeISO),
        supabase.from('solicitacoes_atendimento').select('*, grupo:whatsapp_grupos(nome_grupo), tecnico:tecnicos(nome)').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(8),
        supabase.from('whatsapp_grupos').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('ativo', true),
      ])

      const confias = (logsHoje || []).map(l => l.confianca).filter(c => c > 0)
      const mediaConfianca = confias.length ? confias.reduce((a, b) => a + b, 0) / confias.length : 0

      return res.json({
        total:           total          ?? 0,
        abertasHoje:     abertasHoje    ?? 0,
        emTriagem:       emTriagem      ?? 0,
        enviadasTecnico: enviadasTecnico ?? 0,
        descartadas:     descartadas    ?? 0,
        totalGrupos:     totalGrupos    ?? 0,
        mediaConfianca: Math.round(mediaConfianca * 100),
        ultimos:        ultimos || [],
      })
    }

    // ── GET /api/chamados  – lista solicitações ──────────────────────────────
    if (req.method === 'GET' && !id) {
      if (!workspaceId) return res.status(400).json({ error: 'workspace_id obrigatório' })
      const { status, page = 1, per_page = 50 } = req.query
      let q = supabase
        .from('solicitacoes_atendimento')
        .select(`
          *,
          grupo:whatsapp_grupos(id,nome_grupo,cliente),
          tecnico:tecnicos(id,nome,whatsapp)
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .range((page - 1) * per_page, page * per_page - 1)
      if (status) q = q.eq('status', status)
      const { data, error } = await q
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }

    // ── GET /api/chamados?id=xxx  – único ────────────────────────────────────
    if (req.method === 'GET' && id) {
      const { data, error } = await supabase
        .from('solicitacoes_atendimento')
        .select(`
          *,
          grupo:whatsapp_grupos(id,nome_grupo,cliente,regiao),
          tecnico:tecnicos(id,nome,whatsapp,email),
          notificacoes:notificacoes_tecnicos(*)
        `)
        .eq('id', id)
        .single()
      if (error) return res.status(404).json({ error: error.message })
      return res.json(data)
    }

    // ── PUT /api/chamados?id=xxx&action=status  – atualiza status ────────────
    if (req.method === 'PUT' && id && action === 'status') {
      const { status } = req.body
      const VALID = ['aberta','enviada_tecnico','em_atendimento','aguardando_informacao','concluida','descartada','erro_classificacao','triagem']
      if (!VALID.includes(status)) return res.status(400).json({ error: `Status inválido: ${status}` })
      const { data, error } = await supabase
        .from('solicitacoes_atendimento')
        .update({ status })
        .eq('id', id)
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }

    // ── PUT /api/chamados?id=xxx  – atualiza campos ──────────────────────────
    if (req.method === 'PUT' && id) {
      const allowed = [
        'status','prioridade','categoria','resumo_ia','tecnico_id',
        'equipamento','local','cliente','operacao','resolucao_descricao',
      ]
      const update  = {}
      for (const k of allowed) {
        if (req.body[k] !== undefined) update[k] = req.body[k]
      }
      const { data, error } = await supabase
        .from('solicitacoes_atendimento')
        .update(update)
        .eq('id', id)
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }

    // ── POST /api/chamados?id=xxx&action=notificar  – renotifica técnico ─────
    if (req.method === 'POST' && id && action === 'notificar') {
      const { data: sat } = await supabase
        .from('solicitacoes_atendimento')
        .select('*, grupo:whatsapp_grupos(nome_grupo), tecnico:tecnicos(*)')
        .eq('id', id)
        .single()
      if (!sat) return res.status(404).json({ error: 'Chamado não encontrado' })
      if (!sat.tecnico) return res.status(400).json({ error: 'Técnico não vinculado ao chamado' })
      const result = await notificarTecnico(supabase, sat, sat.tecnico, sat.grupo?.nome_grupo)
      return res.json(result)
    }

    // ── POST /api/chamados?id=xxx&action=aprovar-triagem  – aprova pré-sol ───
    if (req.method === 'POST' && id && action === 'aprovar-triagem') {
      const { tecnico_id, prioridade, resumo_ia } = req.body

      const update = {
        status:    'aberta',
        ...(tecnico_id ? { tecnico_id } : {}),
        ...(prioridade ? { prioridade } : {}),
        ...(resumo_ia  ? { resumo_ia  } : {}),
      }

      const { data: sat, error: errUpd } = await supabase
        .from('solicitacoes_atendimento')
        .update(update)
        .eq('id', id)
        .select('*, grupo:whatsapp_grupos(nome_grupo), tecnico:tecnicos(*)')
        .single()

      if (errUpd) return res.status(500).json({ error: errUpd.message })

      // Notifica técnico após aprovação da triagem
      if (sat.tecnico) {
        await notificarTecnico(supabase, sat, sat.tecnico, sat.grupo?.nome_grupo)
      }

      return res.json(sat)
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[chamados]', e?.message)
    return res.status(500).json({ error: e?.message })
  }
}
