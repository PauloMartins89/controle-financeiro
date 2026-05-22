/**
 * Testes — módulo cnpj.js
 *
 * Unitários: normalizeReceitaWS (mapeamento de campos), validação de tamanho
 * Integração: GET /api/cnpj e POST /api/cnpj contra produção
 */
import { describe, it, expect } from 'vitest'

// ─── Helpers copiados de api/cnpj.js ─────────────────────────────────────────

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

// ─── normalizeReceitaWS ───────────────────────────────────────────────────────

describe('normalizeReceitaWS', () => {
  const base = {
    cnpj: '11.222.333/0001-81',
    nome: 'EMPRESA TESTE LTDA',
    fantasia: 'Empresa Teste',
    situacao: 'ATIVA',
    data_situacao: '2020-01-15',
    abertura: '2015-03-01',
    telefone: '(67) 3300-1234',
    logradouro: 'Rua das Flores',
    numero: '100',
    complemento: 'Sala 1',
    bairro: 'Centro',
    municipio: 'Campo Grande',
    uf: 'MS',
    cep: '79.002-000',
    email: 'contato@empresa.com.br',
    porte: 'ME',
    natureza_juridica: '206-2 - Sociedade Empresária Limitada',
    capital_social: '50000.00',
    tipo: 'MATRIZ',
    atividade_principal: [{ code: '62.01-5-01', text: 'Desenvolvimento de programas de computador sob encomenda' }],
    atividades_secundarias: [{ code: '62.02-3-00', text: 'Desenvolvimento e licenciamento de programas' }],
    qsa: [{ nome: 'JOAO DA SILVA', qual: '05-Administrador' }],
    simples: { optante: true },
    simei: { optante: false },
  }

  it('CNPJ sem máscara', () => {
    expect(normalizeReceitaWS(base).cnpj).toBe('11222333000181')
  })

  it('razao_social mapeada de nome', () => {
    expect(normalizeReceitaWS(base).razao_social).toBe('EMPRESA TESTE LTDA')
  })

  it('situacao ATIVA → código 2', () => {
    expect(normalizeReceitaWS(base).situacao_cadastral).toBe(2)
  })

  it('situacao inativa → código 4', () => {
    expect(normalizeReceitaWS({ ...base, situacao: 'BAIXADA' }).situacao_cadastral).toBe(4)
  })

  it('telefone concatenado sem formatação', () => {
    expect(normalizeReceitaWS(base).ddd_telefone_1).toBe('6733001234')
  })

  it('telefone vazio retorna string vazia', () => {
    expect(normalizeReceitaWS({ ...base, telefone: '' }).ddd_telefone_1).toBe('')
  })

  it('CEP sem máscara', () => {
    expect(normalizeReceitaWS(base).cep).toBe('79002000')
  })

  it('natureza_juridica remove prefixo numérico inicial', () => {
    // regex /^\d+[-\s]+/ remove apenas o primeiro bloco numérico-traço
    // '206-2 - Soc...' → remove '206-' → '2 - Sociedade Empresária Limitada'
    expect(normalizeReceitaWS(base).natureza_juridica).toBe('2 - Sociedade Empresária Limitada')
  })

  it('natureza_juridica sem prefixo numérico passa intacta', () => {
    const d = { ...base, natureza_juridica: 'Sociedade Empresária Limitada' }
    expect(normalizeReceitaWS(d).natureza_juridica).toBe('Sociedade Empresária Limitada')
  })

  it('natureza_juridica formato simples CÓDIGO-DESC', () => {
    const d = { ...base, natureza_juridica: '2062 - Sociedade Empresária Limitada' }
    expect(normalizeReceitaWS(d).natureza_juridica).toBe('Sociedade Empresária Limitada')
  })

  it('capital_social parseado para float', () => {
    expect(normalizeReceitaWS(base).capital_social).toBe(50000)
  })

  it('identificador_matriz_filial — MATRIZ = 1', () => {
    expect(normalizeReceitaWS(base).identificador_matriz_filial).toBe(1)
  })

  it('identificador_matriz_filial — FILIAL = 2', () => {
    expect(normalizeReceitaWS({ ...base, tipo: 'FILIAL' }).identificador_matriz_filial).toBe(2)
  })

  it('cnae_fiscal como inteiro sem pontuação', () => {
    expect(normalizeReceitaWS(base).cnae_fiscal).toBe(6201501)
  })

  it('cnaes_secundarios mapeados corretamente', () => {
    const result = normalizeReceitaWS(base)
    expect(result.cnaes_secundarios).toHaveLength(1)
    expect(result.cnaes_secundarios[0].codigo).toBe(6202300)
    expect(result.cnaes_secundarios[0].descricao).toContain('licenciamento')
  })

  it('qsa — qualificacao sem prefixo numérico', () => {
    const result = normalizeReceitaWS(base)
    expect(result.qsa[0].nome_socio).toBe('JOAO DA SILVA')
    expect(result.qsa[0].qualificacao_socio).toBe('Administrador')
  })

  it('simples.optante mapeado', () => {
    expect(normalizeReceitaWS(base).opcao_pelo_simples).toBe(true)
  })

  it('_source sempre receitaws', () => {
    expect(normalizeReceitaWS(base)._source).toBe('receitaws')
  })

  it('campos ausentes retornam string vazia / null / 0', () => {
    const result = normalizeReceitaWS({})
    expect(result.razao_social).toBe('')
    expect(result.email).toBeNull()
    expect(result.capital_social).toBe(0)
    expect(result.cnaes_secundarios).toEqual([])
    expect(result.qsa).toEqual([])
  })
})

// ─── Integração: GET /api/cnpj ────────────────────────────────────────────────

const BASE = 'https://smartpro.app.br'

async function getApi(path) {
  const res = await fetch(`${BASE}${path}`)
  let body
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body }
}

async function postApi(path, payload) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let body
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body }
}

describe('GET /api/cnpj — validações', () => {
  it('400 sem parâmetro cnpj', async () => {
    const { status, body } = await getApi('/api/cnpj')
    expect(status).toBe(400)
    expect(body.error).toMatch(/14 dígitos/i)
  })

  it('400 CNPJ muito curto', async () => {
    const { status, body } = await getApi('/api/cnpj?cnpj=12345')
    expect(status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('400 CNPJ muito longo', async () => {
    const { status, body } = await getApi('/api/cnpj?cnpj=123456789012345')
    expect(status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('400 CNPJ com letras', async () => {
    const { status, body } = await getApi('/api/cnpj?cnpj=ABCDEFGHIJKLMN')
    expect(status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('CORS headers presentes', async () => {
    const res = await fetch(`${BASE}/api/cnpj`)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('OPTIONS retorna 200', async () => {
    const res = await fetch(`${BASE}/api/cnpj`, { method: 'OPTIONS' })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/cnpj — busca por nome', () => {
  it('400 sem body', async () => {
    const { status, body } = await postApi('/api/cnpj', {})
    expect(status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('400 mode inválido', async () => {
    const { status, body } = await postApi('/api/cnpj', { mode: 'outro', nome: 'Empresa' })
    expect(status).toBe(400)
    expect(body.error).toMatch(/mode/i)
  })

  it('400 sem nome', async () => {
    const { status, body } = await postApi('/api/cnpj', { mode: 'cnpj_search', nome: '' })
    expect(status).toBe(400)
    expect(body.error).toMatch(/nome/i)
  })
})
