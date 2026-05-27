/**
 * POST /api/wa-lote
 *
 * Envia mensagem de aprovação de lote via Z-API (sem abrir WhatsApp pessoal).
 *
 * Body: { telefone, cliente, link, loteId?, pdfBase64?, pdfNome? }
 *
 * Se pdfBase64 for informado, envia o PDF como documento com o link como legenda.
 * Caso contrário, envia somente a mensagem de texto.
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

  const { telefone, cliente, link, loteId, pdfBase64, pdfNome } = req.body || {}

  if (!telefone || !link) {
    return res.status(400).json({ error: 'telefone e link são obrigatórios' })
  }

  // Normaliza o telefone: apenas dígitos + prefixo 55 se necessário
  const digits = telefone.replace(/\D/g, '')
  const phone = digits.startsWith('55') ? digits : `55${digits}`

  if (phone.length < 12) {
    return res.status(400).json({ error: 'Telefone inválido' })
  }

  if (pdfBase64) {
    // ── Upload PDF no Supabase Storage → URL pública → Z-API ─────────────
    // Usar URL em vez de base64 garante MIME type application/pdf correto
    // e o iPhone/WhatsApp reconhece como PDF (não .document)
    const db = getDb()
    const pdfBuffer = Buffer.from(pdfBase64, 'base64')
    const storageKey = `lotes/${Date.now()}_${phone}.pdf`

    const { data: uploaded, error: uploadErr } = await db.storage
      .from('comprovantes')
      .upload(storageKey, pdfBuffer, { contentType: 'application/pdf', upsert: false })

    let documentUrl = null
    if (!uploadErr && uploaded) {
      const { data: urlData } = db.storage.from('comprovantes').getPublicUrl(uploaded.path)
      documentUrl = urlData?.publicUrl || null
    }

    if (!documentUrl) {
      // fallback: envia data URI se upload falhar
      documentUrl = `data:application/pdf;base64,${pdfBase64}`
    }

    const caption = `Lote *"${cliente || 'Lote'}"* — aprovação:\n${link}`
    // fileName SEM extensão — Z-API adiciona .pdf automaticamente no endpoint /send-document/pdf
    const fileName = (pdfNome || `lote-${(cliente || 'lote').replace(/[^a-z0-9]/gi, '_')}.pdf`)
      .replace(/\.pdf$/i, '')

    const docRes = await fetch(`${zapiBase()}/send-document/pdf`, {
      method: 'POST',
      headers: zapiHeaders(),
      body: JSON.stringify({ phone, document: documentUrl, fileName, caption }),
    })

    if (!docRes.ok) {
      const errText = await docRes.text().catch(() => '')
      console.error('[wa-lote] Z-API send-document erro:', docRes.status, errText)
      return res.status(502).json({ error: `Falha ao enviar PDF WhatsApp (${docRes.status})` })
    }
  } else {
    // ── Envia somente texto ───────────────────────────────────────────────
    const msg = `Olá! Segue o link para aprovação do lote *"${cliente || 'Lote'}"*:\n\n${link}\n\nPor favor, acesse e confirme o De Acordo.`

    const textRes = await fetch(`${zapiBase()}/send-text`, {
      method: 'POST',
      headers: zapiHeaders(),
      body: JSON.stringify({ phone, message: msg }),
    })

    if (!textRes.ok) {
      const errText = await textRes.text().catch(() => '')
      console.error('[wa-lote] Z-API send-text erro:', textRes.status, errText)
      return res.status(502).json({ error: `Falha ao enviar WhatsApp (${textRes.status})` })
    }
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
