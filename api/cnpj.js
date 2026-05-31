// api/cnpj.js
// GET  /api/cnpj?cnpj=DIGITS   — consulta CNPJ (BrasilAPI → ReceitaWS)
// POST /api/cnpj                — busca CNPJ por nome via Casa dos Dados

function normalizeReceitaWS(d) {
  const telRaw = (d.telefone || '').replace(/\D/g, '')
  const ddd1   = telRaw.length >= 10 ? telRaw.slice(0, 2) : ''
  const tel1   = telRaw.length >= 10 ? telRaw.slice(2)    : ''
  const natJur = (d.natureza_juridica || '').replace(/^\d+[-\s]+/, '')

  return {
    cnpj:                              (d.cnpj || '').replace(/\D/g, ''),
    razao_social:                      d.nome || '',
    nome_fantasia:                     d.fantasia || '',
    situacao_cadastral:                d.situacao === 'ATIVA' ? 2 : 4,
    descricao_situacao_cadastral:      d.situacao || '',
    data_situacao_cadastral:           d.data_situacao || null,
    data_inicio_atividade:             d.abertura || null,
    logradouro:                        d.logradouro || '',
    descricao_tipo_de_logradouro:      '',
    numero:                            d.numero || '',
    complemento:                       d.complemento || '',
    bairro:                            d.bairro || '',
    municipio:                         d.municipio || '',
    uf:                                d.uf || '',
    cep:                               (d.cep || '').replace(/\D/g, ''),
    email:                             d.email || null,
    ddd_telefone_1:                    ddd1 + tel1,
    ddd_telefone_2:                    '',
    ddd_fax:                           '',
    porte:                             d.porte || '',
    natureza_juridica:                 natJur,
    capital_social:                    parseFloat(d.capital_social) || 0,
    descricao_identificador_matriz_filial: d.tipo || '',
    identificador_matriz_filial:       d.tipo === 'MATRIZ' ? 1 : 2,
    cnae_fiscal_descricao:             d.atividade_principal?.[0]?.text || '',
    cnae_fiscal:                       parseInt((d.atividade_principal?.[0]?.code || '').replace(/\D/g, '')) || 0,
    cnaes_secundarios:                 (d.atividades_secundarias || []).map(a => ({
      codigo:   parseInt((a.code || '').replace(/\D/g, '')) || 0,
      descricao: a.text || '',
    })),
    qsa:                               (d.qsa || []).map(s => ({
      nome_socio:         s.nome || '',
      qualificacao_socio: (s.qual || '').replace(/^\d+-/, ''),
    })),
    opcao_pelo_simples:    d.simples?.optante ?? null,
    opcao_pelo_mei:        d.simei?.optante ?? null,
    situacao_especial:     d.situacao_especial || '',
    motivo_situacao_cadastral: 0,
    _source: 'receitaws',
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── GET: consulta CNPJ ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const digits = (req.query.cnpj || '').replace(/\D/g, '')
    if (digits.length !== 14) {
      return res.status(400).json({ error: 'CNPJ deve ter 14 dígitos' })
    }

    // 1ª tentativa: BrasilAPI
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000),
      })
      if (r.ok) {
        const data = await r.json()
        data._source = 'brasilapi'
        return res.status(200).json(data)
      }
    } catch { /* cai no fallback */ }

    // 2ª tentativa: ReceitaWS (fallback)
    try {
      const r = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      })
      if (!r.ok) throw new Error(`ReceitaWS ${r.status}`)
      const d = await r.json()
      if (d.status === 'ERROR') throw new Error(d.message || 'CNPJ não encontrado')
      return res.status(200).json(normalizeReceitaWS(d))
    } catch (err) {
      return res.status(502).json({ error: err.message || 'Serviço de CNPJ indisponível. Tente novamente.' })
    }
  }

  // ── POST: busca CNPJ por nome de empresa via Casa dos Dados ───────────────
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
        return {
          cnpj:         `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`,
          razao_social: item.razao_social || item.nome_fantasia || '',
          municipio:    item.municipio    || '',
          uf:           item.uf           || '',
        }
      }).filter(Boolean)

      return res.status(200).json({ cnpjs })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}