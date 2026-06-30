// api/chamados-tecnicos.js
// CRUD de técnicos responsáveis

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

function getWorkspaceId(req) {
  return req.query.workspace_id || req.body?.workspace_id || null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const supabase    = getSupabase()
  const workspaceId = getWorkspaceId(req)
  const { id }      = req.query

  try {
    // GET — lista
    if (req.method === 'GET' && !id) {
      if (!workspaceId) return res.status(400).json({ error: 'workspace_id obrigatório' })
      const { data, error } = await supabase
        .from('tecnicos')
        .select('*, _grupos:whatsapp_grupos(id,nome_grupo,ativo)')
        .eq('workspace_id', workspaceId)
        .order('nome')
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }

    // GET — único
    if (req.method === 'GET' && id) {
      const { data, error } = await supabase
        .from('tecnicos')
        .select('*, _grupos:whatsapp_grupos(id,nome_grupo,ativo)')
        .eq('id', id)
        .single()
      if (error) return res.status(404).json({ error: error.message })
      return res.json(data)
    }

    // POST — criar
    if (req.method === 'POST') {
      const { nome, whatsapp, email, regiao, equipe, ativo, observacoes, workspace_id, owner_id } = req.body
      if (!nome?.trim()) return res.status(400).json({ error: 'Nome obrigatório' })
      const { data, error } = await supabase
        .from('tecnicos')
        .insert({ nome: nome.trim(), whatsapp, email, regiao, equipe, ativo: ativo !== false, observacoes, workspace_id, owner_id })
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(data)
    }

    // PUT — atualizar
    if (req.method === 'PUT' && id) {
      const { nome, whatsapp, email, regiao, equipe, ativo, observacoes } = req.body
      const { data, error } = await supabase
        .from('tecnicos')
        .update({ nome: nome?.trim(), whatsapp, email, regiao, equipe, ativo, observacoes })
        .eq('id', id)
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }

    // DELETE — inativar (soft delete)
    if (req.method === 'DELETE' && id) {
      const { error } = await supabase
        .from('tecnicos')
        .update({ ativo: false })
        .eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ ok: true })
    }

    return res.status(405).end()
  } catch (e) {
    console.error('[chamados-tecnicos]', e?.message)
    return res.status(500).json({ error: e?.message })
  }
}
