// api/enriquecer.js — Contact enrichment via Hunter.io (email) + Lusha (phone/email)
// Tries whichever keys are configured; falls back gracefully.

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'https://smartpro.app.br')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verificar JWT do usuário autenticado
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Não autenticado' })
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const HUNTER_KEY = process.env.HUNTER_API_KEY
  const LUSHA_KEY  = process.env.LUSHA_API_KEY

  if (!HUNTER_KEY && !LUSHA_KEY) {
    return res.status(500).json({
      error: 'Nenhuma chave configurada. Configure HUNTER_API_KEY e/ou LUSHA_API_KEY no Vercel.',
    })
  }

  const { nome, dominio, linkedin } = req.body || {}
  if (!nome?.trim()) return res.status(400).json({ error: 'nome é obrigatório' })

  const resultado = { email: null, telefone: null, score: 0, fonte: null }

  // ── 1. Hunter.io — email finder (25 free/mês) ─────────────────────────────
  if (HUNTER_KEY && dominio?.trim()) {
    try {
      const partes = nome.trim().split(/\s+/)
      const firstName = partes[0]
      const lastName  = partes.slice(1).join(' ')
      const cleanDomain = dominio.trim().replace(/^https?:\/\//, '').split('/')[0]

      const url = new URL('https://api.hunter.io/v2/email-finder')
      url.searchParams.set('domain', cleanDomain)
      url.searchParams.set('first_name', firstName)
      if (lastName) url.searchParams.set('last_name', lastName)
      url.searchParams.set('api_key', HUNTER_KEY)

      const r = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) })
      const data = await r.json()

      if (r.ok && data.data?.email) {
        resultado.email  = data.data.email
        resultado.score  = data.data.score || 0
        resultado.fonte  = 'Hunter.io'
        if (data.data.linkedin && !resultado.linkedin) resultado.linkedin = data.data.linkedin
      }
    } catch (_) { /* Hunter failed — continue */ }
  }

  // ── 2. Lusha — phone + email via LinkedIn URL (5 free/mês) ────────────────
  if (LUSHA_KEY && linkedin?.trim()) {
    try {
      const r = await fetch('https://api.lusha.com/v2/person', {
        method: 'POST',
        headers: {
          'api_key': LUSHA_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ linkedinUrl: linkedin.trim() }),
        signal: AbortSignal.timeout(8000),
      })
      const data = await r.json()

      if (r.ok) {
        // Lusha returns emails array and phones array
        if (!resultado.email && data.emails?.[0]?.emailAddress) {
          resultado.email = data.emails[0].emailAddress
          resultado.fonte = resultado.fonte ? `${resultado.fonte} + Lusha` : 'Lusha'
        }
        if (data.phoneNumbers?.[0]?.localizedNumber) {
          resultado.telefone = data.phoneNumbers[0].localizedNumber
          resultado.fonte = resultado.fonte ? `${resultado.fonte} + Lusha` : 'Lusha'
        }
      }
    } catch (_) { /* Lusha failed — continue */ }
  }

  if (!resultado.email && !resultado.telefone) {
    const motivo = []
    if (HUNTER_KEY && !dominio?.trim()) motivo.push('Hunter.io precisa do domínio da empresa')
    if (LUSHA_KEY && !linkedin?.trim()) motivo.push('Lusha precisa da URL do LinkedIn')
    if (!motivo.length) motivo.push('Contato não encontrado nas bases consultadas')
    return res.status(404).json({ error: motivo.join(' | ') })
  }

  res.json(resultado)
}
