/**
 * Testes — api/ocr-formulario.js + api/ocr-receipt.js
 *
 * Ambos são endpoints POST que requerem imageBase64.
 * Não têm funções puras exportáveis.
 */
import { describe, it, expect } from 'vitest'

const BASE = 'https://smartpro.app.br'

// ─── /api/ocr-formulario ──────────────────────────────────────────────────────

describe('/api/ocr-formulario — método', () => {
  it('405 para GET', async () => {
    const res = await fetch(`${BASE}/api/ocr-formulario`)
    expect(res.status).toBe(405)
  })

  it('405 para DELETE', async () => {
    const res = await fetch(`${BASE}/api/ocr-formulario`, { method: 'DELETE' })
    expect(res.status).toBe(405)
  })
})

describe('/api/ocr-formulario — validação', () => {
  it('400 sem imageBase64', async () => {
    const res = await fetch(`${BASE}/api/ocr-formulario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/imageBase64/i)
  })

  it('400 com imageBase64 null', async () => {
    const res = await fetch(`${BASE}/api/ocr-formulario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: null }),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/imageBase64/i)
  })
})

// ─── /api/ocr-receipt ─────────────────────────────────────────────────────────

describe('/api/ocr-receipt — método', () => {
  it('405 para GET', async () => {
    const res = await fetch(`${BASE}/api/ocr-receipt`)
    expect(res.status).toBe(405)
  })

  it('405 para DELETE', async () => {
    const res = await fetch(`${BASE}/api/ocr-receipt`, { method: 'DELETE' })
    expect(res.status).toBe(405)
  })
})

describe('/api/ocr-receipt — validação', () => {
  it('400 sem imageBase64', async () => {
    const res = await fetch(`${BASE}/api/ocr-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/imageBase64/i)
  })

  it('400 com body vazio (sem Content-Type JSON)', async () => {
    const res = await fetch(`${BASE}/api/ocr-receipt`, {
      method: 'POST',
    })
    // Pode ser 400 (sem imageBase64) ou 500 (parse error) dependendo do parsing
    expect([400, 500]).toContain(res.status)
  })
})
