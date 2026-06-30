// api/chamados-logs.js
// Logs de classificação da IA — somente leitura

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
  if (req.method !== 'GET') return res.status(405).end()

  const { workspace_id, page = 1, per_page = 100, grupo_id, virou_chamado } = req.query
  if (!workspace_id) return res.status(400).json({ error: 'workspace_id obrigatório' })

  const supabase = getSupabase()

  let q = supabase
    .from('logs_classificacao_ia')
    .select(`
      *,
      grupo:whatsapp_grupos(id,nome_grupo),
      mensagem:mensagens_whatsapp_grupos(remetente_nome,remetente_whatsapp,mensagem)
    `)
    .eq('workspace_id', workspace_id)
    .order('created_at', { ascending: false })
    .range((Number(page) - 1) * Number(per_page), Number(page) * Number(per_page) - 1)

  if (grupo_id)                         q = q.eq('grupo_id', grupo_id)
  if (virou_chamado !== undefined)       q = q.eq('virou_chamado', virou_chamado === 'true')

  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
}
