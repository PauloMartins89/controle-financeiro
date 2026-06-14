/**
 * POST /api/wa-boletins
 *
 * Envia PDF de lançamentos/boletins selecionados via Z-API (WhatsApp).
 * Não exige lote — uso direto para compartilhar registros com qualquer número.
 *
 * Body: { telefone, pdfBase64, pdfNome?, mensagem? }
 */

import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  )
}

function zapiHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
  }
}

function zapiBase() {
  return `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { telefone, pdfBase64, pdfNome, mensagem } = req.body || {}

  if (!telefone || !pdfBase64) {
    return res.status(400).json({ error: 'telefone e pdfBase64 são obrigatórios' })
  }

  // Normaliza telefone
  const digits = telefone.replace(/\D/g, '')
  const phone  = digits.startsWith('55') ? digits : `55${digits}`
  if (phone.length < 12) {
    return res.status(400).json({ error: 'Telefone inválido — informe DDD + número' })
  }

  // Upload PDF no Supabase Storage → URL pública → Z-API aceita PDF sem truncar
  const db         = getDb()
  const pdfBuffer  = Buffer.from(pdfBase64, 'base64')
  const storageKey = `boletins/${Date.now()}_${phone}.pdf`

  let documentUrl = null
  const { data: uploaded, error: uploadErr } = await db.storage
    .from('comprovantes')
    .upload(storageKey, pdfBuffer, { contentType: 'application/pdf', upsert: false })

  if (!uploadErr && uploaded) {
    const { data: urlData } = db.storage.from('comprovantes').getPublicUrl(uploaded.path)
    documentUrl = urlData?.publicUrl || null
  }

  if (!documentUrl) {
    // fallback: data URI (pode falhar em alguns clientes WA)
    documentUrl = `data:application/pdf;base64,${pdfBase64}`
  }

  const caption  = mensagem || 'Segue relatório de lançamentos operacionais.'
  const fileName = (pdfNome || 'boletins.pdf').replace(/\.pdf$/i, '')

  const docRes = await fetch(`${zapiBase()}/send-document/pdf`, {
    method: 'POST',
    headers: zapiHeaders(),
    body: JSON.stringify({ phone, document: documentUrl, fileName, caption }),
  })

  if (!docRes.ok) {
    const errText = await docRes.text().catch(() => '')
    console.error('[wa-boletins] Z-API erro:', docRes.status, errText)
    return res.status(502).json({ error: `Falha ao enviar WhatsApp (${docRes.status})` })
  }

  return res.status(200).json({ ok: true })
}
