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
