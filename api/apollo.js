// api/apollo.js — Apollo.io People Search
// Busca contatos enriquecidos por empresa/domínio via Apollo.io API

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const APOLLO_KEY = process.env.APOLLO_API_KEY
  if (!APOLLO_KEY) return res.status(500).json({ error: 'APOLLO_API_KEY não configurada' })

  const { empresa, dominio, cargos } = req.body || {}
  if (!empresa?.trim()) return res.status(400).json({ error: 'Nome da empresa é obrigatório' })

  try {
    const payload = {
      api_key: APOLLO_KEY,
      q_organization_name: empresa.trim(),
      page: 1,
      per_page: 15,
    }

    // Domain increases precision when available
    if (dominio?.trim()) {
      const cleanDomain = dominio.trim().replace(/^https?:\/\//, '').split('/')[0]
      payload.q_organization_domains = [cleanDomain]
    }

    // Filter by seniority titles if provided
    if (Array.isArray(cargos) && cargos.length) {
      payload.person_titles = cargos
    }

    const r = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify(payload),
    })

    const data = await r.json()
    if (!r.ok) {
      return res.status(r.status).json({ error: data.message || `Apollo retornou ${r.status}` })
    }

    const contatos = (data.people || []).map(p => ({
      nome: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      cargo: p.title || '',
      email: p.email || '',
      telefone: p.phone_numbers?.[0]?.sanitized_number || p.phone_numbers?.[0]?.raw_number || '',
      linkedin: p.linkedin_url || '',
      cidade: [p.city, p.state].filter(Boolean).join(', '),
      foto: p.photo_url || '',
    }))

    res.json({ contatos, total: data.pagination?.total_entries || contatos.length })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erro ao consultar Apollo' })
  }
}
