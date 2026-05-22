// api/proxycurl.js — Person enrichment via Proxycurl (LinkedIn URL → phone + email)
// 10 free credits; $49/mês para 500 créditos (~R$0,55/contato)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const KEY = process.env.PROXYCURL_API_KEY
  if (!KEY) return res.status(500).json({ error: 'PROXYCURL_API_KEY não configurada no Vercel' })

  const { linkedinUrl } = req.body || {}
  if (!linkedinUrl?.trim()) return res.status(400).json({ error: 'linkedinUrl é obrigatório' })

  // Normalise URL — Proxycurl requires full URL
  let url = linkedinUrl.trim()
  if (!url.startsWith('http')) url = `https://${url}`

  const endpoint = new URL('https://nubela.co/proxycurl/api/v2/linkedin')
  endpoint.searchParams.set('linkedin_profile_url', url)
  endpoint.searchParams.set('use_cache', 'if-present')   // avoid double-charging
  endpoint.searchParams.set('personal_email', 'include') // +1 credit per reveal
  endpoint.searchParams.set('personal_contact_number', 'include') // +1 credit per reveal

  try {
    const r = await fetch(endpoint.toString(), {
      headers: { Authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(12000),
    })

    const data = await r.json()

    if (!r.ok) {
      return res.status(r.status).json({
        error: data.message || data.description || `Proxycurl retornou ${r.status}`,
      })
    }

    // Extract best phone: work > personal
    const telefone =
      data.personal_numbers?.[0] ||
      data.phone_numbers?.[0]?.sanitized_number ||
      ''

    // Extract best email: personal preferred (more reliable for outreach)
    const email =
      data.personal_emails?.[0] ||
      data.emails?.[0] ||
      ''

    if (!telefone && !email) {
      return res.status(404).json({ error: 'Telefone e e-mail não encontrados para este perfil' })
    }

    res.json({
      nome:     data.full_name || '',
      cargo:    data.occupation || '',
      email,
      telefone,
      foto:     data.profile_pic_url || '',
      cidade:   [data.city, data.state, data.country_full_name].filter(Boolean).join(', '),
      linkedin: url,
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erro ao consultar Proxycurl' })
  }
}
