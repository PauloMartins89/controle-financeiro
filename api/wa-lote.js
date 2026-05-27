/**
 * POST /api/wa-lote
 *
 * Envia mensagem de aprovação de lote via Z-API (sem abrir WhatsApp pessoal).
 *
 * Body: { telefone, cliente, link, loteId? }
 */

import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  )
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { telefone, cliente, link, loteId } = req.body || {}

  if (!telefone || !link) {
    return res.status(400).json({ error: 'telefone e link são obrigatórios' })
  }

  // Normaliza o telefone: apenas dígitos + prefixo 55 se necessário
  const digits = telefone.replace(/\D/g, '')
  const phone = digits.startsWith('55') ? digits : `55${digits}`

  if (phone.length < 12) {
    return res.status(400).json({ error: 'Telefone inválido' })
  }

  const msg = `Olá! Segue o link para aprovação do lote *"${cliente || 'Lote'}"*:\n\n${link}\n\nPor favor, acesse e confirme o De Acordo.`

  const zapiUrl = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`

  const zapiRes = await fetch(zapiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
    },
    body: JSON.stringify({ phone, message: msg }),
  })

  if (!zapiRes.ok) {
    const errText = await zapiRes.text().catch(() => '')
    console.error('[wa-lote] Z-API erro:', zapiRes.status, errText)
    return res.status(502).json({ error: `Falha ao enviar WhatsApp (${zapiRes.status})` })
  }

  // Atualiza status do lote para enviado_cliente
  if (loteId) {
    const db = getDb()
    await db
      .from('lotes_cliente')
      .update({ status: 'enviado_cliente', updated_at: new Date().toISOString() })
      .eq('id', loteId)
  }

  return res.status(200).json({ ok: true })
}
