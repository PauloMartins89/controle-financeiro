/**
 * agenda-link.js
 * API pública para o formulário de agendamento gerado via WhatsApp bot.
 *
 * GET  /api/agenda-link?token=xxx  → retorna dados do link pendente
 * POST /api/agenda-link            → body { token, ...campos } → cria agendamento
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const supabaseUrl        = process.env.SUPABASE_URL       || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const zapiInstanceId     = process.env.ZAPI_INSTANCE_ID
const zapiToken          = process.env.ZAPI_TOKEN
const APP_URL            = process.env.APP_URL || 'https://dividiai.app.br'

function getDb() {
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey, {
    realtime: { params: { log_level: 'disabled' }, transport: ws },
    global: {},
  })
}

async function zapiSendText(phone, message) {
  if (!zapiInstanceId || !zapiToken || !phone) return
  try {
    await fetch(
      `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
        },
        body: JSON.stringify({ phone, message }),
      }
    )
  } catch { /* silencioso */ }
}

function fmtData(iso) {
  if (!iso) return '—'
  return String(iso).split('-').reverse().join('/')
}

// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS para o formulário público (mesmo origin ou cross)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const db = getDb()
  if (!db) return res.status(500).json({ error: 'Banco não configurado' })

  // ─── GET: retorna dados do link pendente ────────────────────────────────
  if (req.method === 'GET') {
    const { token } = req.query
    if (!token) return res.status(400).json({ error: 'token obrigatório' })

    const { data: link, error } = await db
      .from('agenda_links_pendentes')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (error || !link) return res.status(404).json({ error: 'Link não encontrado' })
    if (link.usado)     return res.status(410).json({ error: 'Este link já foi utilizado', usado: true })
    if (new Date(link.expires_at) < new Date())
      return res.status(410).json({ error: 'Link expirado', expirado: true })

    return res.status(200).json({
      gestor_nome:    link.gestor_nome,
      dados_parciais: link.dados_parciais || {},
    })
  }

  // ─── POST: cria agendamento a partir do formulário ──────────────────────
  if (req.method === 'POST') {
    const {
      token,
      cliente_nome,
      tipo_servico,
      atividade,
      data_servico,
      horario_servico,
      origem,
      destino,
      responsavel_nome,
      motorista_nome,
      veiculo_placa,
      observacao,
    } = req.body || {}

    if (!token)         return res.status(400).json({ error: 'token obrigatório' })
    if (!cliente_nome)  return res.status(400).json({ error: 'cliente_nome obrigatório' })
    if (!tipo_servico)  return res.status(400).json({ error: 'tipo_servico obrigatório' })
    if (!data_servico)  return res.status(400).json({ error: 'data_servico obrigatório' })

    // Valida token
    const { data: link, error: linkErr } = await db
      .from('agenda_links_pendentes')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (linkErr || !link) return res.status(404).json({ error: 'Link não encontrado' })
    if (link.usado)       return res.status(410).json({ error: 'Link já utilizado', usado: true })
    if (new Date(link.expires_at) < new Date())
      return res.status(410).json({ error: 'Link expirado', expirado: true })

    // Cria agendamento
    const horario = horario_servico || null
    const { data: ag, error: agErr } = await db
      .from('agendamentos_servicos')
      .insert({
        workspace_id:      link.workspace_id,
        cliente_nome:      cliente_nome.trim(),
        tipo_servico:      tipo_servico.trim(),
        atividade:         atividade     || null,
        data_servico:      data_servico,
        horario_servico:   horario,
        data_hora_servico: horario
          ? new Date(`${data_servico}T${horario}:00`).toISOString()
          : new Date(`${data_servico}T00:00:00`).toISOString(),
        origem:            origem            || null,
        destino:           destino           || null,
        responsavel_nome:  responsavel_nome  || null,
        motorista_nome:    motorista_nome    || null,
        veiculo_placa:     veiculo_placa     || null,
        observacao:        observacao        || null,
        status:            'agendado',
        criado_por_nome:   link.gestor_nome  || 'Formulário público',
      })
      .select('id, numero_agendamento')
      .single()

    if (agErr) {
      console.error('[agenda-link] insert error:', agErr.message)
      return res.status(500).json({ error: 'Erro ao salvar agendamento', detail: agErr.message })
    }

    // Registra histórico
    await db.from('agendamento_historico').insert({
      agendamento_id: ag.id,
      tipo_evento:    'criacao',
      descricao:      `Agendamento criado via 📋 formulário público pelo gestor ${link.gestor_nome || '—'}`,
      usuario_nome:   link.gestor_nome || 'Formulário',
      payload_json:   { origem: 'link_publico', token },
    }).catch(() => {})

    // Marca link como usado
    await db
      .from('agenda_links_pendentes')
      .update({ usado: true })
      .eq('token', token)

    // Avisa gestor via WhatsApp
    if (link.gestor_telefone) {
      const msg = [
        `✅ *Agendamento criado via formulário!*`,
        ag.numero_agendamento ? `📋 *${ag.numero_agendamento}*` : '',
        ``,
        `🔧 Serviço: *${tipo_servico}*`,
        `👤 Cliente: *${cliente_nome}*`,
        atividade  ? `📌 Atividade: ${atividade}` : '',
        data_servico ? `📅 Data: *${fmtData(data_servico)}*` : '',
        horario    ? `⏰ Horário: *${horario}*` : '',
        origem     ? `📍 Origem: ${origem}` : '',
        destino    ? `🏁 Destino: ${destino}` : '',
        ``,
        `_Acesse o sistema para ver detalhes._`,
      ].filter(Boolean).join('\n')

      await zapiSendText(link.gestor_telefone, msg)
    }

    return res.status(200).json({
      ok:                  true,
      id:                  ag.id,
      numero_agendamento:  ag.numero_agendamento,
    })
  }

  return res.status(405).end()
}
