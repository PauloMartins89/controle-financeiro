// api/cnpj.js
// GET  /api/cnpj?cnpj=DIGITS → proxy BrasilAPI (evita CORS no browser)
// POST /api/cnpj { mode:'cnpj_search', nome, cidade } → busca CNPJ por nome via Serper

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── GET: lookup de CNPJ via BrasilAPI ──────────────────────────────────────
  if (req.method === 'GET') {
    const digits = (req.query.cnpj || '').replace(/\D/g, '')
    if (digits.length !== 14) {
      return res.status(400).json({ error: 'CNPJ deve ter 14 dígitos' })
    }
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(12000),
      })
      const data = await r.json()
      return res.status(r.status).json(data)
    } catch (err) {
      return res.status(502).json({ error: 'Falha ao consultar BrasilAPI. Tente novamente.' })
    }
  }

  // ── POST: busca CNPJ por nome de empresa via Serper ────────────────────────
  if (req.method === 'POST') {
    const { mode, nome, cidade } = req.body || {}

    if (mode !== 'cnpj_search') {
      return res.status(400).json({ error: 'mode inválido' })
    }
    if (!nome?.trim()) {
      return res.status(400).json({ error: 'nome é obrigatório' })
    }

    const SERPER_KEY = process.env.SERPER_API_KEY
    if (!SERPER_KEY) {
      return res.status(500).json({ error: 'SERPER_API_KEY não configurada no servidor' })
    }

    const q = cidade?.trim()
      ? `"${nome.trim()}" CNPJ ${cidade.trim()}`
      : `"${nome.trim()}" CNPJ`

    try {
      const sr = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: 'br', hl: 'pt-br', num: 10 }),
        signal: AbortSignal.timeout(10000),
      })
      if (!sr.ok) throw new Error(`Serper retornou ${sr.status}`)

      const sd = await sr.json()
      const cnpjRegex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g
      const cnpjSet = new Set()
      const sources = [
        sd.answerBox?.answer || '',
        sd.answerBox?.snippet || '',
        sd.knowledgeGraph?.description || '',
        ...(sd.organic || []).map(r => `${r.title || ''} ${r.snippet || ''}`),
      ]
      for (const text of sources) {
        for (const m of text.matchAll(cnpjRegex)) cnpjSet.add(m[0])
      }

      return res.status(200).json({ cnpjs: [...cnpjSet] })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
