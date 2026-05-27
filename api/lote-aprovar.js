/**
 * POST /api/lote-aprovar
 *
 * Endpoint público — cliente aprova ou recusa o lote sem fazer login.
 * Autentica via token_acesso do lote.
 *
 * Body: {
 *   token : string (uuid — token_acesso do lote)
 *   acao  : 'aprovar' | 'recusar'
 *   obs?  : string   — obrigatório se recusar
 * }
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

  const { token, acao, obs, confirmadoPor, assinatura } = req.body || {}

  if (!token || !acao) {
    return res.status(400).json({ error: 'token e acao são obrigatórios' })
  }
  if (!['aprovar', 'recusar'].includes(acao)) {
    return res.status(400).json({ error: 'acao inválida' })
  }

  const db = getDb()

  const { data: lote, error: errLote } = await db
    .from('lotes_cliente')
    .select('id, status')
    .eq('token_acesso', token)
    .single()

  if (errLote || !lote) {
    return res.status(404).json({ error: 'Lote não encontrado.' })
  }

  if (['aprovado_cliente', 'recusado_cliente'].includes(lote.status)) {
    return res.status(409).json({ error: 'Este lote já foi finalizado anteriormente.' })
  }

  if (acao === 'aprovar') {
    // Upload da assinatura PNG para Supabase Storage
    let assinaturaUrl = null
    let aprovadoEm = new Date().toISOString()

    if (assinatura) {
      try {
        const buf = Buffer.from(assinatura, 'base64')
        const key = `assinaturas/${lote.id}.png`
        const { data: uploaded } = await db.storage
          .from('comprovantes')
          .upload(key, buf, { contentType: 'image/png', upsert: true })
        if (uploaded) {
          const { data: urlData } = db.storage.from('comprovantes').getPublicUrl(key)
          assinaturaUrl = urlData?.publicUrl || null
        }
      } catch (_) {}
    }

    const { error: e1 } = await db
      .from('lotes_cliente')
      .update({
        status: 'aprovado_cliente',
        confirmado_por: confirmadoPor || null,
        assinatura_url: assinaturaUrl,
        aprovado_em: aprovadoEm,
        updated_at: aprovadoEm,
      })
      .eq('id', lote.id)
    if (e1) return res.status(500).json({ error: e1.message })

    // Avança lançamentos para aguardando_aprovacao interna
    await db
      .from('lancamentos')
      .update({ status: 'aguardando_aprovacao' })
      .eq('lote_cliente_id', lote.id)
      .in('status', ['rascunho', 'em_revisao'])

    return res.status(200).json({ ok: true, assinaturaUrl, aprovadoEm })
  } else {
    const { error: e1 } = await db
      .from('lotes_cliente')
      .update({
        status: 'recusado_cliente',
        observacoes: obs || null,
        confirmado_por: confirmadoPor || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lote.id)
    if (e1) return res.status(500).json({ error: e1.message })

    // Volta lançamentos para rascunho
    await db
      .from('lancamentos')
      .update({ status: 'rascunho' })
      .eq('lote_cliente_id', lote.id)
      .eq('status', 'aguardando_aprovacao')

    return res.status(200).json({ ok: true })
  }
}
