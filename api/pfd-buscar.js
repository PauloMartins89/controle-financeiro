// api/pfd-buscar.js
// Motor de busca de publicações técnicas John Deere (TechPubs)
//
// Tenta descobrir a API interna do techpubs.deere.com.
// Como o site é um SPA, a busca simples retorna HTML — então
// tentamos os endpoints conhecidos com Accept: application/json.
// Se falhar, retorna os resultados parseados do HTML como fallback.
//
// Parâmetros de busca (query string):
//   kw     — palavra-chave / modelo (ex: 8400R)
//   pg     — grupo de publicação (ex: "Operator's Manuals")
//   ed     — edição (ex: South America)
//   ln     — idioma (ex: Portuguese)
//   page   — página de resultados (default 0)

const BASE = 'https://techpubs.deere.com'

// Endpoint provável da API interna (descoberto via inspeção de SPAs similares JD)
const API_CANDIDATES = [
  '/api/search/equipment',
  '/api/pubs/search',
  '/en/api/search/equipment',
  '/pt-BR/api/search/equipment',
]

// Faz a requisição proxy (server-side) para contornar CORS
async function proxyFetch(url, opts = {}) {
  const headers = {
    'Accept': 'application/json, text/html, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ...(opts.headers || {}),
  }
  const res = await fetch(url, { ...opts, headers })
  return res
}

// Tenta API interna JSON primeiro
async function tryJsonApi(params) {
  for (const path of API_CANDIDATES) {
    try {
      const url = `${BASE}${path}?${params}`
      const res = await proxyFetch(url, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) continue
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('json')) continue
      const data = await res.json()
      return { ok: true, data }
    } catch (_) {
      // próximo candidato
    }
  }
  return { ok: false }
}

// Parseia resultados da página HTML do TechPubs (fallback)
// A página renderizada pelo SSR ainda inclui os dados de busca em meta tags / structured data
function parseHtmlResults(html) {
  const results = []

  // Extrai blocos de resultado usando padrões do HTML do TechPubs
  // Padrão: títulos de modelo aparecem como <h5> seguidos de família, classificação, série, edição
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi
  let row

  // Tenta encontrar JSON embutido na página (algumas SPAs serializam estado inicial)
  const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/)
    || html.match(/window\.__STATE__\s*=\s*({[\s\S]*?});/)
    || html.match(/"searchResults"\s*:\s*(\[[\s\S]*?\])/m)

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      if (Array.isArray(parsed)) return parsed
      if (parsed.results) return parsed.results
    } catch (_) { }
  }

  // Fallback: leitura de texto estruturado
  // O fetch retorna texto tipo: "8400R\nTractors\nBase Unit\n120001 - 140000\nEurope"
  const lines = html.replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  let i = 0
  while (i < lines.length) {
    // Detecta padrão: modelo + família + classificação + série + edição
    const modelMatch = lines[i]?.match(/^([A-Z0-9]{3,10}[A-Z]?)$/)
    if (modelMatch && lines[i + 1] && lines[i + 2] && lines[i + 3]) {
      const serialLine = lines[i + 3] || ''
      const [serieInicio, serieFim] = serialLine.includes(' - ')
        ? serialLine.split(' - ').map(s => s.trim())
        : [serialLine.trim(), 'Current']
      results.push({
        modelo: lines[i],
        familia: lines[i + 1],
        classificacao: lines[i + 2],
        serie_inicio: serieInicio,
        serie_fim: serieFim,
        edicao: lines[i + 4] || '',
      })
      i += 5
      continue
    }
    i++
  }

  return results
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    kw = '',
    pg = "Operator's Manuals",
    ed = '',
    ln = 'Portuguese',
    page = '0',
  } = req.query

  if (!kw.trim()) {
    return res.status(400).json({ error: 'Parâmetro kw (modelo) obrigatório' })
  }

  const params = new URLSearchParams({
    page, sug: 'True', st: 'model', kw: kw.trim(), ln, pg,
    ...(ed ? { ed } : {}),
  }).toString()

  // 1. Tenta API JSON interna
  const jsonResult = await tryJsonApi(params)
  if (jsonResult.ok) {
    return res.json({ fonte: 'api', resultados: jsonResult.data })
  }

  // 2. Fallback: scraping da página HTML
  try {
    const url = `${BASE}/pt-BR/Search/Equipment?${params}`
    const htmlRes = await proxyFetch(url)
    const html = await htmlRes.text()

    const resultados = parseHtmlResults(html)

    // Se parseou pelo menos alguma coisa, retorna
    if (resultados.length > 0) {
      return res.json({ fonte: 'html_parse', resultados })
    }

    // Retorna a URL para o usuário abrir manualmente
    return res.json({
      fonte: 'link_externo',
      resultados: [],
      url_busca: url,
      msg: 'O site TechPubs é renderizado por JavaScript. Abra o link para visualizar resultados.',
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
