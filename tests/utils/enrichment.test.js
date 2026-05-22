/**
 * Testes — api/enriquecer.js, api/proxycurl.js, api/apollo.js
 *
 * Todas são APIs de enrichment externas sem funções puras exportáveis.
 * Testes focam em: OPTIONS preflight, método inválido, campos obrigatórios.
 */
import { describe, it, expect } from 'vitest'

const BASE = 'https://smartpro.app.br'

// ─── /api/enriquecer ──────────────────────────────────────────────────────────

describe('/api/enriquecer', () => {
  it('200 para OPTIONS (CORS preflight)', async () => {
    const res = await fetch(`${BASE}/api/enriquecer`, { method: 'OPTIONS' })
    expect(res.status).toBe(200)
  })

  it('405 para GET', async () => {
    const res = await fetch(`${BASE}/api/enriquecer`)
    expect(res.status).toBe(405)
  })

  it('405 para DELETE', async () => {
    const res = await fetch(`${BASE}/api/enriquecer`, { method: 'DELETE' })
    expect(res.status).toBe(405)
  })

  it('400 ou 500 para POST sem nome — validação ou chaves ausentes', async () => {
    // Se HUNTER/LUSHA não configurados → 500 (checado antes da validação do body)
    // Se configurados → 400 (nome é obrigatório)
    const res = await fetch(`${BASE}/api/enriquecer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dominio: 'example.com' }),
    })
    expect([400, 500]).toContain(res.status)
  })

  it('400 ou 500 para POST com nome vazio', async () => {
    const res = await fetch(`${BASE}/api/enriquecer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: '   ' }),
    })
    expect([400, 500]).toContain(res.status)
  })
})

// ─── /api/proxycurl ───────────────────────────────────────────────────────────

describe('/api/proxycurl', () => {
  it('200 para OPTIONS (CORS preflight)', async () => {
    const res = await fetch(`${BASE}/api/proxycurl`, { method: 'OPTIONS' })
    expect(res.status).toBe(200)
  })

  it('405 para GET', async () => {
    const res = await fetch(`${BASE}/api/proxycurl`)
    expect(res.status).toBe(405)
  })

  it('405 para DELETE', async () => {
    const res = await fetch(`${BASE}/api/proxycurl`, { method: 'DELETE' })
    expect(res.status).toBe(405)
  })

  it('400 ou 500 para POST sem linkedinUrl', async () => {
    // Se PROXYCURL_API_KEY não configurada → 500 (antes da validação)
    // Se configurada → 400
    const res = await fetch(`${BASE}/api/proxycurl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect([400, 500]).toContain(res.status)
  })

  it('400 ou 500 para POST com linkedinUrl vazia', async () => {
    const res = await fetch(`${BASE}/api/proxycurl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedinUrl: '   ' }),
    })
    expect([400, 500]).toContain(res.status)
  })
})

// ─── /api/apollo ──────────────────────────────────────────────────────────────

describe('/api/apollo', () => {
  it('200 para OPTIONS (CORS preflight)', async () => {
    const res = await fetch(`${BASE}/api/apollo`)
    // OPTIONS preflight
    const opts = await fetch(`${BASE}/api/apollo`, { method: 'OPTIONS' })
    expect(opts.status).toBe(200)
  })

  it('405 para GET', async () => {
    const res = await fetch(`${BASE}/api/apollo`)
    expect(res.status).toBe(405)
  })

  it('405 para DELETE', async () => {
    const res = await fetch(`${BASE}/api/apollo`, { method: 'DELETE' })
    expect(res.status).toBe(405)
  })

  it('400 ou 500 para POST sem empresa', async () => {
    // Se APOLLO_API_KEY não configurada → 500 (antes da validação)
    // Se configurada → 400
    const res = await fetch(`${BASE}/api/apollo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect([400, 500]).toContain(res.status)
  })

  it('400 ou 500 para POST com empresa vazia', async () => {
    const res = await fetch(`${BASE}/api/apollo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa: '   ' }),
    })
    expect([400, 500]).toContain(res.status)
  })
})
