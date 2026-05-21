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

  // ── POST: busca CNPJ por nome de empresa via Casa dos Dados (gratuito) ───────
  if (req.method === 'POST') {
    const { mode, nome, cidade, uf } = req.body || {}

    if (mode !== 'cnpj_search') {
      return res.status(400).json({ error: 'mode inválido' })
    }
    if (!nome?.trim()) {
      return res.status(400).json({ error: 'nome é obrigatório' })
    }

    const cidadeNorm = cidade?.trim()
      ? cidade.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      : null

    const body = {
      query: {
        termo: [nome.trim()],
        atividade_principal: [],
        ...(cidadeNorm ? { municipio: [cidadeNorm] } : {}),
        ...(uf?.trim()  ? { uf: [uf.trim().toUpperCase()] } : {}),
        situacao_cadastral: 'ATIVA',
      },
      extras: {
        somente_mei: false,
        excluir_mei: false,
        com_contato_telefonico: false,
        somente_fixo: false,
        somente_celular: false,
        somente_matriz: true,
      },
      page: 1,
    }

    try {
      const r = await fetch('https://api.casadosdados.com.br/v2/public/cnpj/pesquisa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Origin': 'https://casadosdados.com.br',
          'Referer': 'https://casadosdados.com.br/',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      })
      if (!r.ok) throw new Error(`Casa dos Dados retornou ${r.status}`)

      const data = await r.json()
      const cnpjs = (data.data?.cnpj || []).map(item => {
        const c = (item.cnpj || '').replace(/\D/g, '')
        if (c.length !== 14) return null
        return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`
      }).filter(Boolean)

      return res.status(200).json({ cnpjs })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
