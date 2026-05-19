// Motor de Pesquisa de Precos — Serper.dev (Google Shopping) + Mercado Livre API
// Deploy: supabase functions deploy busca-precos
// Secrets: supabase secrets set SERPER_API_KEY=xxx ML_CLIENT_ID=xxx ML_CLIENT_SECRET=xxx

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SERPER_KEY     = Deno.env.get('SERPER_API_KEY')    ?? ''
const ML_CLIENT_ID   = Deno.env.get('ML_CLIENT_ID')      ?? ''
const ML_CLIENT_SEC  = Deno.env.get('ML_CLIENT_SECRET')  ?? ''

// Cache de token ML dentro do isolate (best-effort)
let _mlToken = ''
let _mlTokenExpiry = 0

async function getMlToken(): Promise<string | null> {
  if (!ML_CLIENT_ID || !ML_CLIENT_SEC) return null
  if (_mlToken && Date.now() < _mlTokenExpiry) return _mlToken
  try {
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${ML_CLIENT_ID}&client_secret=${ML_CLIENT_SEC}`,
    })
    if (!res.ok) return null
    const d = await res.json()
    _mlToken = d.access_token
    _mlTokenExpiry = Date.now() + (d.expires_in - 300) * 1000
    return _mlToken
  } catch { return null }
}

function parsePreco(str: string): number {
  if (!str) return 0
  // "R$ 18,90" | "R$18.90" | "18,90" | "18.90"
  const s = str.replace(/[R$\s]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')
  return parseFloat(s) || 0
}

async function buscaML(query: string) {
  try {
    const token = await getMlToken()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=10&sort=price_asc`
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []

    const data = await res.json()
    return (data.results ?? [])
      .filter((r: any) => r.price > 0)
      .map((r: any) => ({
        titulo:      r.title,
        preco:       r.price,
        site:        'Mercado Livre',
        url:         r.permalink,
        imagem:      r.thumbnail,
        frete:       r.shipping?.free_shipping ? 'Frete gratis' : '',
        vendedor:    r.seller?.nickname ?? '',
        condicao:    r.condition === 'new' ? 'Novo' : 'Usado',
        fonte:       'ml',
      }))
  } catch { return [] }
}

async function buscaSerper(query: string) {
  if (!SERPER_KEY) return []
  try {
    const res = await fetch('https://google.serper.dev/shopping', {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'br', hl: 'pt-br', num: 10 }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []

    const data = await res.json()
    return (data.shopping ?? [])
      .map((r: any) => ({
        titulo:   r.title,
        preco:    parsePreco(r.price ?? ''),
        site:     r.source ?? 'Loja Online',
        url:      r.link,
        imagem:   r.imageUrl ?? '',
        frete:    '',
        vendedor: r.source ?? '',
        condicao: 'Novo',
        fonte:    'google',
      }))
      .filter((r: any) => r.preco > 0)
  } catch { return [] }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { query } = await req.json()
    if (!query?.trim()) {
      return new Response(JSON.stringify({ error: 'query obrigatorio' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [resML, resSerper] = await Promise.allSettled([
      buscaML(query),
      buscaSerper(query),
    ])

    const ml     = resML.status     === 'fulfilled' ? resML.value     : []
    const google = resSerper.status === 'fulfilled' ? resSerper.value : []

    const resultados = [...ml, ...google]
      .filter(r => r.preco > 0)
      .sort((a, b) => a.preco - b.preco)

    const precos    = resultados.map(r => r.preco)
    const menor     = precos.length ? Math.min(...precos)                             : null
    const maior     = precos.length ? Math.max(...precos)                             : null
    const media     = precos.length ? precos.reduce((s, p) => s + p, 0) / precos.length : null

    return new Response(JSON.stringify({
      resultados,
      resumo: {
        menor,
        maior,
        media,
        total: resultados.length,
        fontes: { ml: ml.length, google: google.length },
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
