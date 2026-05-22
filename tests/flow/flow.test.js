/**
 * Testes — api/flow-engine.js + api/flow-action.js
 *
 * flow-engine: parâmetro action obrigatório, método inválido, ação desconhecida
 * flow-action:  token obrigatório, token inválido
 */
import { describe, it, expect } from 'vitest'

const BASE = 'https://smartpro.app.br'

// ─── /api/flow-engine ─────────────────────────────────────────────────────────

describe('GET /api/flow-engine — validação de action', () => {
  it('400 sem action', async () => {
    const res = await fetch(`${BASE}/api/flow-engine`)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/action/i)
  })

  it('400 action GET desconhecida', async () => {
    const res = await fetch(`${BASE}/api/flow-engine?action=naoexiste`)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/naoexiste/i)
  })
})

describe('POST /api/flow-engine — validação de action', () => {
  it('400 sem action no body', async () => {
    const res = await fetch(`${BASE}/api/flow-engine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/action/i)
  })

  it('400 action POST desconhecida', async () => {
    const res = await fetch(`${BASE}/api/flow-engine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acao_inexistente' }),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/acao_inexistente/i)
  })
})

describe('/api/flow-engine — método inválido', () => {
  it('405 para DELETE', async () => {
    const res = await fetch(`${BASE}/api/flow-engine?action=tasks`, { method: 'DELETE' })
    const body = await res.json()
    expect(res.status).toBe(405)
  })

  it('405 para PATCH', async () => {
    const res = await fetch(`${BASE}/api/flow-engine?action=tasks`, { method: 'PATCH' })
    expect(res.status).toBe(405)
  })
})

// ─── /api/flow-action ─────────────────────────────────────────────────────────

describe('GET /api/flow-action — token obrigatório', () => {
  it('400 sem token — retorna HTML com mensagem de erro', async () => {
    const res = await fetch(`${BASE}/api/flow-action`)
    expect(res.status).toBe(400)
    // Retorna HTML
    const text = await res.text()
    expect(text).toMatch(/token|inválido/i)
  })
})

describe('GET /api/flow-action — token inválido', () => {
  it('404 com token inexistente — retorna HTML de link inválido', async () => {
    const res = await fetch(`${BASE}/api/flow-action?token=token_inexistente_xpto_123456`)
    expect(res.status).toBe(404)
    const text = await res.text()
    expect(text).toMatch(/inválido|não exist|removido/i)
  })
})

describe('POST /api/flow-action — token obrigatório', () => {
  it('400 sem token no body', async () => {
    const res = await fetch(`${BASE}/api/flow-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'aprovar' }),
    })
    expect(res.status).toBe(400)
  })
})
