/**
 * Testes — api/whatsapp.js
 *
 * Unitários: formatBRL, safeNum, safeStr
 * Integração: GET (verificação Z-API), método inválido, POST ignorado (fromMe)
 */
import { describe, it, expect } from 'vitest'

// ─── Helpers copiados de api/whatsapp.js ─────────────────────────────────────

function formatBRL(v) {
  return 'R$ ' + Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function safeNum(v) {
  if (v === null || v === undefined || v === '' || v === 'null' || v === 'undefined') return null
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

function safeStr(v) {
  if (v === null || v === undefined || v === '' || v === 'null' || v === 'undefined') return null
  return String(v).trim() || null
}

// ─── formatBRL ────────────────────────────────────────────────────────────────

describe('formatBRL (whatsapp)', () => {
  it('valor simples', () => {
    expect(formatBRL(50)).toBe('R$ 50,00')
  })

  it('valor com separador de milhar', () => {
    expect(formatBRL(1234.56)).toBe('R$ 1.234,56')
  })

  it('valor negativo → usa Math.abs', () => {
    expect(formatBRL(-99.9)).toBe('R$ 99,90')
  })

  it('zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00')
  })
})

// ─── safeNum ─────────────────────────────────────────────────────────────────

describe('safeNum', () => {
  it('número normal → retorna float', () => {
    expect(safeNum(42.5)).toBe(42.5)
  })

  it('string numérica → converte', () => {
    expect(safeNum('123.45')).toBe(123.45)
  })

  it('string com vírgula → converte', () => {
    expect(safeNum('1,50')).toBe(1.5)
  })

  it('null → null', () => {
    expect(safeNum(null)).toBeNull()
  })

  it('undefined → null', () => {
    expect(safeNum(undefined)).toBeNull()
  })

  it('string vazia → null', () => {
    expect(safeNum('')).toBeNull()
  })

  it('string "null" → null', () => {
    expect(safeNum('null')).toBeNull()
  })

  it('string "undefined" → null', () => {
    expect(safeNum('undefined')).toBeNull()
  })

  it('texto não-numérico → null', () => {
    expect(safeNum('abc')).toBeNull()
  })

  it('zero → zero (não null)', () => {
    expect(safeNum(0)).toBe(0)
  })
})

// ─── safeStr ─────────────────────────────────────────────────────────────────

describe('safeStr', () => {
  it('string normal → retorna trimada', () => {
    expect(safeStr('  hello  ')).toBe('hello')
  })

  it('null → null', () => {
    expect(safeStr(null)).toBeNull()
  })

  it('undefined → null', () => {
    expect(safeStr(undefined)).toBeNull()
  })

  it('string vazia → null', () => {
    expect(safeStr('')).toBeNull()
  })

  it('string só de espaços → null', () => {
    expect(safeStr('   ')).toBeNull()
  })

  it('string "null" → null', () => {
    expect(safeStr('null')).toBeNull()
  })

  it('string "undefined" → null', () => {
    expect(safeStr('undefined')).toBeNull()
  })

  it('número → converte para string', () => {
    expect(safeStr(42)).toBe('42')
  })
})

// ─── Integração: /api/whatsapp ────────────────────────────────────────────────

const BASE = 'https://smartpro.app.br'

describe('GET /api/whatsapp — verificação Z-API', () => {
  it('200 OK para GET (verificação de webhook)', async () => {
    const res = await fetch(`${BASE}/api/whatsapp`)
    expect(res.status).toBe(200)
  })
})

describe('/api/whatsapp — métodos inválidos', () => {
  it('405 para DELETE', async () => {
    const res = await fetch(`${BASE}/api/whatsapp`, { method: 'DELETE' })
    expect(res.status).toBe(405)
  })

  it('405 para PUT', async () => {
    const res = await fetch(`${BASE}/api/whatsapp`, { method: 'PUT' })
    expect(res.status).toBe(405)
  })
})

describe('POST /api/whatsapp — mensagem fromMe ignorada', () => {
  it('200 quando fromMe=true (eco do próprio bot)', async () => {
    const res = await fetch(`${BASE}/api/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromMe: true, phone: '5511999999999', type: 'ReceivedCallback' }),
    })
    expect(res.status).toBe(200)
  })
})

// ─── identificarBoletimPorImagem — parse da resposta numérica do Groq ─────────
// A nova abordagem passa os identificadores ao Groq e pede o número do match.
// Esta função replica o parse: parseInt(resposta) → tipos[idx-1]

function parseRespostaGroq(resposta, tipos) {
  if (!tipos?.length) return null
  const idx = parseInt((resposta || '').trim(), 10)
  if (idx >= 1 && idx <= tipos.length) return tipos[idx - 1]
  return null
}

describe('identificarBoletimPorImagem — parse da resposta numérica', () => {
  const tipos = [
    { id: 'uuid-birigui', nome: 'Boletim BIRIGUI', workspace_id: 'ws-1', identificador_visual: 'BIRIGUI SOLUÇÕES' },
    { id: 'uuid-carpelo', nome: 'Boletim CARPELO', workspace_id: 'ws-2', identificador_visual: 'CARPELO SERVIÇOS FLORESTAIS' },
  ]

  it('"1" → retorna primeiro tipo', () => {
    expect(parseRespostaGroq('1', tipos)?.id).toBe('uuid-birigui')
  })

  it('"2" → retorna segundo tipo', () => {
    expect(parseRespostaGroq('2', tipos)?.id).toBe('uuid-carpelo')
  })

  it('"0" → null (nenhum match)', () => {
    expect(parseRespostaGroq('0', tipos)).toBeNull()
  })

  it('resposta vazia → null', () => {
    expect(parseRespostaGroq('', tipos)).toBeNull()
  })

  it('índice fora do range → null', () => {
    expect(parseRespostaGroq('5', tipos)).toBeNull()
  })

  it('texto não-numérico → null', () => {
    expect(parseRespostaGroq('none', tipos)).toBeNull()
  })

  it('"1" com espaços extras → funciona', () => {
    expect(parseRespostaGroq('  1  ', tipos)?.id).toBe('uuid-birigui')
  })

  it('lista vazia → null', () => {
    expect(parseRespostaGroq('1', [])).toBeNull()
  })
})

// ─── casaIdentificador (legado — mantido para compatibilidade de testes) ──────
// Replica a lógica de casamento do identificador_visual (caso-insensitivo, includes)

function casaIdentificador(headerText, tipos) {
  if (!tipos?.length || !headerText) return null
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const texto = norm(headerText)
  for (const tipo of tipos) {
    const id = norm(tipo.identificador_visual || '')
    if (id && texto.includes(id)) return tipo
  }
  return null
}

describe('identificarBoletimPorImagem — casamento de identificador_visual', () => {
  const tipos = [
    { id: 'uuid-birigui', nome: 'Boletim BIRIGUI', workspace_id: 'ws-1', identificador_visual: 'BIRIGUI SOLUÇÕES' },
    { id: 'uuid-carpelo', nome: 'Boletim CARPELO', workspace_id: 'ws-2', identificador_visual: 'CARPELO SERVIÇOS FLORESTAIS' },
  ]

  it('casa por substring exata (case-insensitive)', () => {
    const r = casaIdentificador('birigui soluções sustentaveis ltda', tipos)
    expect(r?.id).toBe('uuid-birigui')
  })

  it('casa com texto em maiúsculas no header', () => {
    const r = casaIdentificador('BIRIGUI SOLUÇÕES SUSTENTAVEIS', tipos)
    expect(r?.id).toBe('uuid-birigui')
  })

  it('casa com identificador de segundo cliente', () => {
    const r = casaIdentificador('carpelo serviços florestais eireli', tipos)
    expect(r?.id).toBe('uuid-carpelo')
  })

  it('sem correspondência → null', () => {
    const r = casaIdentificador('total energia renovável s/a', tipos)
    expect(r).toBeNull()
  })

  it('header vazio → null', () => {
    const r = casaIdentificador('', tipos)
    expect(r).toBeNull()
  })

  it('lista de tipos vazia → null', () => {
    const r = casaIdentificador('BIRIGUI SOLUÇÕES', [])
    expect(r).toBeNull()
  })

  it('identificador_visual null no tipo → ignora esse tipo', () => {
    const r = casaIdentificador('BIRIGUI', [
      { id: 'x', identificador_visual: null },
      { id: 'uuid-birigui', identificador_visual: 'BIRIGUI' },
    ])
    expect(r?.id).toBe('uuid-birigui')
  })

  it('identificador_visual string vazia → ignora esse tipo', () => {
    const r = casaIdentificador('BIRIGUI', [
      { id: 'x', identificador_visual: '' },
    ])
    expect(r).toBeNull()
  })

  it('casa sem acentos — header tem "solucoes", identifier tem "SOLUÇÕES"', () => {
    const r = casaIdentificador('BIRIGUI SOLUCOES SUSTENTAVEIS', [
      { id: 'uuid-birigui', identificador_visual: 'BIRIGUI SOLUÇÕES SUSTENTÁVEIS' },
    ])
    expect(r?.id).toBe('uuid-birigui')
  })

  it('casa sem acentos — header tem "SOLUÇÕES", identifier tem "solucoes"', () => {
    const r = casaIdentificador('BIRIGUI SOLUÇÕES SUSTENTÁVEIS LTDA', [
      { id: 'uuid-birigui', identificador_visual: 'birigui solucoes' },
    ])
    expect(r?.id).toBe('uuid-birigui')
  })

  it('retorna o primeiro match (ordem importa)', () => {
    const tiposSimples = [
      { id: 'uuid-birigui', identificador_visual: 'BIRIGUI' },
      { id: 'uuid-carpelo', identificador_visual: 'CARPELO' },
    ]
    const r = casaIdentificador('relatorio birigui carpelo ltda', tiposSimples)
    expect(r?.id).toBe('uuid-birigui') // BIRIGUI vem primeiro na lista
  })
})

// ─── variants de telefone para lookup de colaborador ─────────────────────────

function phoneVariants(from) {
  const norm = from.replace(/\D/g, '')
  const sem55 = norm.replace(/^55/, '')
  const com9  = sem55.length === 10 ? sem55.slice(0, 2) + '9' + sem55.slice(2) : sem55
  const sem9  = sem55.length === 11 && sem55[2] === '9' ? sem55.slice(0, 2) + sem55.slice(3) : sem55
  return [...new Set([sem55, com9, sem9])]
}

describe('phoneVariants para lookup de colaborador', () => {
  it('número com 55 + 9 dígito → gera sem55, com9, sem9', () => {
    const v = phoneVariants('+5516996030901')
    expect(v).toContain('16996030901')   // sem55, com 9
    expect(v).toContain('1696030901')    // sem9 (10 dígitos)
    expect(v.every(x => !x.startsWith('55'))).toBe(true)
  })

  it('número sem 55 e sem 9 → gera variante com 9 adicionado', () => {
    const v = phoneVariants('1696030901')
    expect(v).toContain('1696030901')
    expect(v).toContain('16996030901')
  })

  it('número de 11 dígitos sem prefixo 55 → sem9 tem 10 dígitos', () => {
    const v = phoneVariants('11987654321')
    expect(v).toContain('11987654321')
    expect(v).toContain('1187654321')
  })

  it('sem duplicatas na lista', () => {
    const v = phoneVariants('5511987654321')
    expect(v.length).toBe(new Set(v).size)
  })
})
