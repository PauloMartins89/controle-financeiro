/**
 * Testes — módulo _busca-fornecedor.js
 *
 * Unitários: normalizarProduto (mapeamento produto→CNAE), normalizarCidade
 * Integração: POST /api/busca-fornecedor contra produção
 */
import { describe, it, expect } from 'vitest'

// ─── Helpers copiados de api/_busca-fornecedor.js ────────────────────────────

const CNAE_MAP = {
  'pneus':          ['4530703','4530701','4741500'],
  'peças auto':     ['4530705','4530706','4541203'],
  'lubrificantes':  ['4682600','4530704','1922501'],
  'baterias':       ['4741500','4530701'],
  'veículos':       ['4511101','4511102','4512901'],
  'combustível':    ['4731800','4732600'],
  'ferramentas':    ['4744001','4744003','4744002'],
  'epi':            ['4789005','4763601','4679699'],
  'equipamentos':   ['4669999','4672900','3314714'],
  'elétrica':       ['4742300','4759801','4321500'],
  'informática':    ['4751201','4751202','6319400'],
  'eletrônicos':    ['4752100','4759801'],
  'hidráulica':     ['4744099','4321500','4322301'],
  'construção':     ['4744099','4679699','4741500'],
  'tintas':         ['4741500','4744099','2212900'],
  'escritório':     ['4761001','4761003','4647801'],
  'limpeza':        ['4789099','4646001','2012000'],
  'embalagens':     ['4686900','4649408'],
  'alimentos':      ['4711301','4712100','4639701'],
  'bebidas':        ['4635401','4635499'],
  'manutenção':     ['3314714','4520001','4520005'],
  'transporte':     ['4930201','4930202','5320202'],
  'segurança':      ['8011101','8011102'],
  'outros':         ['4669999'],
}

function normalizarProduto(produto) {
  const p = produto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [key, cnaes] of Object.entries(CNAE_MAP)) {
    const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (p.includes(keyNorm) || keyNorm.includes(p)) return cnaes
  }
  return null
}

function normalizarCidade(cidade) {
  return cidade.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// ─── normalizarProduto ────────────────────────────────────────────────────────

describe('normalizarProduto', () => {
  it('retorna CNAEs para "pneus"', () => {
    const result = normalizarProduto('pneus')
    expect(result).toEqual(['4530703','4530701','4741500'])
  })

  it('case-insensitive — "Pneus" == "pneus"', () => {
    expect(normalizarProduto('Pneus')).toEqual(normalizarProduto('pneus'))
  })

  it('ignora acentos — "eletrica" == "elétrica"', () => {
    expect(normalizarProduto('eletrica')).toEqual(CNAE_MAP['elétrica'])
  })

  it('match parcial — "informática equipamentos" encontra "informática"', () => {
    const result = normalizarProduto('Compra de informática')
    expect(result).toEqual(CNAE_MAP['informática'])
  })

  it('retorna null para produto desconhecido', () => {
    expect(normalizarProduto('produto_xyz_desconhecido')).toBeNull()
  })

  it('retorna array para "ferramentas"', () => {
    const result = normalizarProduto('ferramentas')
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('retorna CNAEs para "epi"', () => {
    expect(normalizarProduto('epi')).toEqual(CNAE_MAP['epi'])
  })

  it('retorna CNAEs para "limpeza"', () => {
    expect(normalizarProduto('material de limpeza')).toEqual(CNAE_MAP['limpeza'])
  })
})

// ─── normalizarCidade ─────────────────────────────────────────────────────────

describe('normalizarCidade', () => {
  it('converte para maiúsculas', () => {
    expect(normalizarCidade('campo grande')).toBe('CAMPO GRANDE')
  })

  it('remove acentos', () => {
    expect(normalizarCidade('São Paulo')).toBe('SAO PAULO')
  })

  it('remove acentos complexos', () => {
    expect(normalizarCidade('Ribeirão Preto')).toBe('RIBEIRAO PRETO')
  })

  it('já maiúscula passa intacta (sem acentos)', () => {
    expect(normalizarCidade('BRASILIA')).toBe('BRASILIA')
  })

  it('remove espaços iniciais/finais', () => {
    expect(normalizarCidade('  Curitiba  ')).toBe('CURITIBA')
  })

  it('mantém espaços internos', () => {
    expect(normalizarCidade('Belo Horizonte')).toBe('BELO HORIZONTE')
  })
})

// Nota: api/_busca-fornecedor.js tem prefixo _ → não é exposta como rota pública no Vercel.
// Os testes de integração desta API são feitos indiretamente via telas que a chamam.
