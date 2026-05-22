import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const SERPER_KEY = Deno.env.get('SERPER_API_KEY')
    if (!SERPER_KEY) throw new Error('SERPER_API_KEY não configurada')

    // ── Modo: busca CNPJ por nome de empresa ──────────────────────────────
    if (body.mode === 'cnpj_search') {
      const nome = (body.nome || '').trim()
      const cidade = (body.cidade || '').trim()
      if (!nome) {
        return new Response(JSON.stringify({ error: 'nome é obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const q = cidade ? `"${nome}" CNPJ ${cidade}` : `"${nome}" CNPJ`
      const sr = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: 'br', hl: 'pt-br', num: 10 }),
        signal: AbortSignal.timeout(8000),
      })
      if (!sr.ok) throw new Error(`Serper error ${sr.status}`)
      const sd = await sr.json()

      const cnpjRegex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g
      const cnpjSet = new Set<string>()
      const sources: string[] = [
        sd.answerBox?.answer || '',
        sd.answerBox?.snippet || '',
        sd.knowledgeGraph?.description || '',
        ...(sd.organic || []).map((r: { title?: string; snippet?: string }) =>
          `${r.title || ''} ${r.snippet || ''}`)
      ]
      for (const text of sources) {
        const matches = text.match(cnpjRegex) || []
        matches.forEach((c: string) => cnpjSet.add(c))
      }

      return new Response(JSON.stringify({ cnpjs: [...cnpjSet] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Modo: busca contatos LinkedIn de uma empresa ──────────────────────
    if (body.mode === 'linkedin_search') {
      const nomeEmpresa = (body.empresa || '').trim()
      if (!nomeEmpresa) {
        return new Response(JSON.stringify({ error: 'empresa é obrigatória' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const q = `site:linkedin.com/in "${nomeEmpresa}" (diretor OR gerente OR CEO OR sócio OR fundador OR presidente OR comprador OR superintendente)`
      const sr = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: 'br', hl: 'pt-br', num: 10 }),
        signal: AbortSignal.timeout(8000),
      })
      if (!sr.ok) throw new Error(`Serper error ${sr.status}`)
      const sd = await sr.json()

      type OrgResult = { title?: string; link?: string; snippet?: string }
      const contatos = ((sd.organic || []) as OrgResult[])
        .filter(r => r.link?.includes('linkedin.com/in/'))
        .map(r => {
          // Title format examples:
          // "João Silva - Diretor Comercial - Empresa X | LinkedIn"
          // "Maria Santos · Gerente de Compras | LinkedIn"
          const titleClean = (r.title || '').replace(/\s*\|\s*LinkedIn\s*$/, '').trim()
          const parts = titleClean.split(/\s+[-·]\s+/)
          const nome = parts[0]?.trim() || ''
          const cargo = parts[1]?.trim() || ''
          // Extract city from snippet if present
          const cidadeMatch = (r.snippet || '').match(/([A-ZÀ-Ú][a-zà-ú]+(?:\s[A-ZÀ-Ú][a-zà-ú]+)*),\s*([A-Z]{2})/)
          return {
            nome,
            cargo,
            linkedin: r.link || '',
            email: '',
            telefone: '',
            cidade: cidadeMatch ? `${cidadeMatch[1]}, ${cidadeMatch[2]}` : '',
            foto: '',
          }
        })
        .filter(c => c.nome && c.linkedin)

      return new Response(JSON.stringify({ contatos }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Modo padrão: busca por região (Google Maps) ───────────────────────
    const { query, cidade, uf } = body

    if (!query?.trim() || !cidade?.trim()) {
      return new Response(JSON.stringify({ error: 'query e cidade são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const location = uf?.trim()
      ? `${cidade.trim()}, ${uf.trim()}, Brasil`
      : `${cidade.trim()}, Brasil`

    const q = body.prospectMode
      ? `${query.trim()} em ${cidade.trim()}${uf?.trim() ? ` ${uf.trim()}` : ''} Brasil`
      : `fornecedor de ${query.trim()} em ${cidade.trim()}${uf?.trim() ? ` ${uf.trim()}` : ''} Brasil`

    const resp = await fetch('https://google.serper.dev/maps', {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, gl: 'br', hl: 'pt-br', location, num: 20 }),
      signal: AbortSignal.timeout(10000),
    })

    if (!resp.ok) {
      const errBody = await resp.text()
      throw new Error(`Serper error ${resp.status}: ${errBody}`)
    }

    const data = await resp.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fornecedores = (data.places || []).map((p: any) => ({
      id: p.cid || `${p.latitude}_${p.longitude}` || p.title,
      nome: p.title || '',
      endereco: p.address || '',
      telefone: p.phoneNumber || null,
      website: p.website || null,
      rating: p.rating || null,
      avaliacoes: p.ratingCount || 0,
      categoria: p.category || null,
      horario: typeof p.openingHours === 'string'
        ? p.openingHours
        : (p.openingHours && typeof p.openingHours === 'object')
          ? Object.entries(p.openingHours).slice(0,1).map(([d,h])=>`${d}: ${h}`).join(', ')
          : null,
      lat: p.latitude || null,
      lng: p.longitude || null,
    }))

    return new Response(
      JSON.stringify({ fornecedores, total: fornecedores.length, local: location }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
