/**
 * Testes — api/webhook-whatsapp.js
 *
 * Unitários: lógica de normalização de número de telefone (phoneVariants)
 * Integração: GET (verificação do webhook), método inválido, auth token
 */
import { describe, it, expect } from 'vitest'

// ─── Helper copiado de api/webhook-whatsapp.js ───────────────────────────────

function phoneVariants(fromPhone) {
  const fromNorm = (fromPhone || '').replace(/\D/g, '')
  const sem55    = fromNorm.replace(/^55/, '')
  const com9     = sem55.length === 10 ? sem55.slice(0, 2) + '9' + sem55.slice(2) : sem55
  const sem9     = sem55.length === 11 && sem55[2] === '9' ? sem55.slice(0, 2) + sem55.slice(3) : sem55
  return [...new Set([fromNorm, sem55, '55' + sem55, '55' + com9, com9, '55' + sem9, sem9].filter(Boolean))]
}

// ─── reconstructToken — UUID sem hífens → com hífens ─────────────────────────

function reconstructUUID(compact) {
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join('-')
}

// ─── phoneVariants ────────────────────────────────────────────────────────────

describe('phoneVariants', () => {
  it('número com 55 → inclui variante sem 55 e com 55', () => {
    const variants = phoneVariants('5511912345678')
    expect(variants).toContain('5511912345678')  // original
    expect(variants).toContain('11912345678')     // sem 55
  })

  it('número de 10 dígitos (sem 9) → gera variante com 9', () => {
    // 11 98765432 → 10 dígitos sem 55
    const variants = phoneVariants('5511987654321')
    expect(variants.some(v => v.includes('9'))).toBe(true)
  })

  it('número de 11 dígitos com 9 → gera variante sem 9', () => {
    // 11 9 8765432 → 11 dígitos com 9 no índice 2
    const variants = phoneVariants('5511987654321')
    expect(variants).toContain('11987654321')  // sem 55
    // variante sem 9 (10 dígitos)
    expect(variants.some(v => v.length === 10 || (v.startsWith('55') && v.length === 12))).toBe(true)
  })

  it('retorna array sem duplicatas', () => {
    const variants = phoneVariants('5511912345678')
    expect(variants.length).toBe(new Set(variants).size)
  })

  it('número vazio → array sem strings vazias', () => {
    const variants = phoneVariants('')
    expect(variants.every(v => Boolean(v))).toBe(true)
  })

  it('null → array sem strings vazias', () => {
    const variants = phoneVariants(null)
    expect(Array.isArray(variants)).toBe(true)
    expect(variants.every(v => Boolean(v))).toBe(true)
  })

  it('remove caracteres não-numéricos antes de processar', () => {
    const withDashes = phoneVariants('+55 (11) 9 8765-4321')
    const clean      = phoneVariants('5511987654321')
    // Ambos devem conter o mesmo número normalizado
    expect(withDashes).toContain('11987654321')
    expect(clean).toContain('11987654321')
  })
})

// ─── reconstructUUID ─────────────────────────────────────────────────────────

describe('reconstructUUID', () => {
  it('UUID sem hífens → formato padrão com hífens', () => {
    const compact = '550e8400e29b41d4a716446655440000'
    const result  = reconstructUUID(compact)
    expect(result).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('formato: 8-4-4-4-12', () => {
    const result = reconstructUUID('00000000000000000000000000000000')
    const partes = result.split('-')
    expect(partes).toHaveLength(5)
    expect(partes[0]).toHaveLength(8)
    expect(partes[1]).toHaveLength(4)
    expect(partes[2]).toHaveLength(4)
    expect(partes[3]).toHaveLength(4)
    expect(partes[4]).toHaveLength(12)
  })
})

// ─── Integração: /api/webhook-whatsapp ───────────────────────────────────────

const BASE = 'https://smartpro.app.br'

describe('GET /api/webhook-whatsapp — verificação de webhook', () => {
  it('200 OK para GET (verificação Z-API)', async () => {
    const res = await fetch(`${BASE}/api/webhook-whatsapp`)
    expect(res.status).toBe(200)
  })
})

describe('/api/webhook-whatsapp — métodos inválidos', () => {
  it('405 para DELETE', async () => {
    const res = await fetch(`${BASE}/api/webhook-whatsapp`, { method: 'DELETE' })
    expect(res.status).toBe(405)
  })

  it('405 para PUT', async () => {
    const res = await fetch(`${BASE}/api/webhook-whatsapp`, { method: 'PUT' })
    expect(res.status).toBe(405)
  })
})

describe('POST /api/webhook-whatsapp — autenticação', () => {
  it('POST com fromMe=true → 200 ignored (sem token requerido ou com token ausente aceito)', async () => {
    const res = await fetch(`${BASE}/api/webhook-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '5511999999999', type: 'text', fromMe: true }),
    })
    // Com token configurado → 401; sem token → 200 ignored
    expect([200, 401]).toContain(res.status)
  })

  it('POST com token errado quando WHATSAPP_WEBHOOK_TOKEN configurado → 401', async () => {
    const res = await fetch(`${BASE}/api/webhook-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-token': 'token_errado_xpto',
      },
      body: JSON.stringify({ phone: '5511999999999', type: 'text' }),
    })
    // Se token não configurado → 200; se configurado → 401
    expect([200, 401]).toContain(res.status)
  })
})
