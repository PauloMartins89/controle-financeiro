// api/chamados-setup.js
// Endpoint auxiliar para descoberta de group JIDs e setup do módulo Chamados WA.
// Rotas:
//   GET  ?action=jids-descobertos           → lista JIDs de grupos que enviaram msg mas não estão cadastrados
//   POST ?action=registrar-grupo            → cadastra grupo com JID descoberto
//   GET  ?action=webhook-status             → verifica/reconfigura webhook na Z-API

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const supabaseUrl        = process.env.SUPABASE_URL       || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const zapiInstanceId     = process.env.ZAPI_INSTANCE_ID
const zapiToken          = process.env.ZAPI_TOKEN
const zapiClientToken    = process.env.ZAPI_CLIENT_TOKEN
const APP_URL            = process.env.APP_URL || 'https://smartpro.app.br'

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey, {
    realtime: { params: { log_level: 'disabled' }, transport: ws },
    global: {},
  })
}

async function zapiGet(path) {
  const r = await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}${path}`, {
    headers: { 'Client-Token': zapiClientToken || '' },
  })
  return r.ok ? r.json() : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const action = req.query.action
  const supabase = getSupabase()
  if (!supabase) return res.status(500).json({ error: 'Supabase não configurado' })

  // ── Listar JIDs descobertos (grupos que mandaram msg mas não cadastrados) ──
  if (action === 'jids-descobertos') {
    const { data } = await supabase
      .from('logs_classificacao_ia')
      .select('id, motivo, resultado, created_at')
      .is('grupo_id', null)
      .ilike('motivo', 'GRUPO_NAO_CADASTRADO%')
      .order('created_at', { ascending: false })
      .limit(20)

    const jids = (data || []).map(r => ({
      id:       r.id,
      jid:      r.resultado?.jid || '',
      remetente: r.resultado?.remetente || '',
      msg:      r.resultado?.msg || '',
      quando:   r.created_at,
    }))
    return res.json({ jids })
  }

  // ── Status + reconfigurar webhook ─────────────────────────────────────────
  if (action === 'webhook-status') {
    const webhookUrl = `${APP_URL}/api/webhook-whatsapp`

    // Lê config atual
    const atual = await zapiGet('/webhook-received').catch(() => null)

    // Reconfigura se necessário
    let configurou = false
    if (!atual || atual.value !== webhookUrl) {
      try {
        const r = await fetch(
          `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/update-webhook-received`,
          {
            method: 'PUT',
            headers: { 'Client-Token': zapiClientToken || '', 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: webhookUrl }),
          }
        )
        configurou = r.ok
      } catch {}
    }

    return res.json({ webhookUrl, atual: atual?.value, configurou })
  }

  // ── Registrar grupo descoberto ────────────────────────────────────────────
  if (action === 'registrar-grupo' && req.method === 'POST') {
    const { zapi_group_id, nome_grupo, workspace_id, owner_id, tecnico_id } = req.body || {}
    if (!zapi_group_id || !nome_grupo || !workspace_id) {
      return res.status(400).json({ error: 'zapi_group_id, nome_grupo e workspace_id são obrigatórios' })
    }

    const { data, error } = await supabase.from('whatsapp_grupos').upsert(
      { zapi_group_id, nome_grupo, workspace_id, owner_id: owner_id || null, tecnico_id: tecnico_id || null, ativo: true },
      { onConflict: 'workspace_id,zapi_group_id' }
    ).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true, grupo: data })
  }

  // ── Diagnóstico: logs recentes com status de criação de SAT ───────────────
  if (action === 'diagnostico') {
    const workspace_id = req.query.workspace_id || null

    // Logs recentes
    let logsQuery = supabase
      .from('logs_classificacao_ia')
      .select('id, workspace_id, grupo_id, confianca, virou_chamado, eh_triagem, motivo, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (workspace_id) logsQuery = logsQuery.eq('workspace_id', workspace_id)
    const { data: logs } = await logsQuery

    // SATs recentes
    let satsQuery = supabase
      .from('solicitacoes_atendimento')
      .select('id, codigo, status, confianca_ia, motivo_classificacao, equipamento, solicitante_nome, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (workspace_id) satsQuery = satsQuery.eq('workspace_id', workspace_id)
    const { data: sats } = await satsQuery

    // Verifica se colunas novas existem (tenta ler equipamento)
    const { error: colErr } = await supabase
      .from('solicitacoes_atendimento')
      .select('equipamento, data_finalizacao, resolucao_descricao')
      .limit(1)

    return res.json({
      ok: true,
      colunas_novas_ok: !colErr,
      colunas_erro: colErr?.message || null,
      logs_recentes: (logs || []).map(l => ({
        id:            l.id.slice(0, 8),
        workspace_id:  l.workspace_id?.slice(0, 8),
        grupo_id:      l.grupo_id?.slice(0, 8),
        confianca:     l.confianca,
        virou_chamado: l.virou_chamado,
        eh_triagem:    l.eh_triagem,
        motivo:        l.motivo?.slice(0, 120),
        quando:        l.created_at,
      })),
      sats_recentes: (sats || []).map(s => ({
        codigo:     s.codigo,
        status:     s.status,
        confianca:  s.confianca_ia,
        equipamento: s.equipamento,
        solicitante: s.solicitante_nome,
        motivo:     s.motivo_classificacao?.slice(0, 80),
        quando:     s.created_at,
      })),
    })
  }

  return res.status(400).json({ error: 'action inválida' })
}
