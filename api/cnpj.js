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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
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

  return res.status(405).json({ error: 'Method not allowed' })
}