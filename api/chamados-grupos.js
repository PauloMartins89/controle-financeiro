// api/chamados-grupos.js
// CRUD de grupos monitorados

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

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
  const { id }      = req.query

  try {
    if (req.method === 'GET' && !id) {
      if (!workspaceId) return res.status(400).json({ error: 'workspace_id obrigatório' })
      const { data, error } = await supabase
        .from('whatsapp_grupos')
        .select('*, tecnico:tecnicos(id,nome,whatsapp)')
        .eq('workspace_id', workspaceId)
        .order('nome_grupo')
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }

    if (req.method === 'GET' && id) {
      const { data, error } = await supabase
        .from('whatsapp_grupos')
        .select('*, tecnico:tecnicos(id,nome,whatsapp)')
        .eq('id', id)
        .single()
      if (error) return res.status(404).json({ error: error.message })
      return res.json(data)
    }

    if (req.method === 'POST') {
      const { zapi_group_id, nome_grupo, cliente, operacao, regiao, tecnico_id, nivel_monitoramento, ativo, observacoes, workspace_id, owner_id } = req.body
      if (!zapi_group_id?.trim()) return res.status(400).json({ error: 'zapi_group_id obrigatório' })
      if (!nome_grupo?.trim())    return res.status(400).json({ error: 'nome_grupo obrigatório' })
      const { data, error } = await supabase
        .from('whatsapp_grupos')
        .insert({ zapi_group_id: zapi_group_id.trim(), nome_grupo: nome_grupo.trim(), cliente, operacao, regiao, tecnico_id: tecnico_id || null, nivel_monitoramento: nivel_monitoramento || 'medio', ativo: ativo !== false, observacoes, workspace_id, owner_id })
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(data)
    }

    if (req.method === 'PUT' && id) {
      const { zapi_group_id, nome_grupo, cliente, operacao, regiao, tecnico_id, nivel_monitoramento, ativo, observacoes } = req.body
      const { data, error } = await supabase
        .from('whatsapp_grupos')
        .update({ zapi_group_id, nome_grupo, cliente, operacao, regiao, tecnico_id: tecnico_id || null, nivel_monitoramento, ativo, observacoes })
        .eq('id', id)
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }

    if (req.method === 'DELETE' && id) {
      const { error } = await supabase
        .from('whatsapp_grupos')
        .update({ ativo: false })
        .eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ ok: true })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[chamados-grupos]', e?.message)
    return res.status(500).json({ error: e?.message })
  }
}
