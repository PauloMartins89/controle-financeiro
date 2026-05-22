/**
 * Testes — api/refeicoes.js
 *
 * Integração: CORS preflight, load sem token, load com token inválido,
 *             submit com campos faltando.
 */
import { describe, it, expect } from 'vitest'

const BASE = 'https://smartpro.app.br'

describe('/api/refeicoes — CORS preflight', () => {
  it('200 para OPTIONS', async () => {
    const res = await fetch(`${BASE}/api/refeicoes`, { method: 'OPTIONS' })
    expect(res.status).toBe(200)
  })
})

describe('GET /api/refeicoes?action=load — validação de token', () => {
  it('400 sem token', async () => {
    const res = await fetch(`${BASE}/api/refeicoes?action=load`)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/token/i)
  })

  it('404 com token inválido', async () => {
    const res = await fetch(`${BASE}/api/refeicoes?action=load&token=token_inexistente_xpto_123`)
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error).toBeTruthy()
  })
})

describe('POST /api/refeicoes?action=submit — validação', () => {
  it('400 sem token no body', async () => {
    const res = await fetch(`${BASE}/api/refeicoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit', restauranteId: 'r1', dataRefeicao: '2026-05-22', itens: [{ refeicao: true }] }),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/token/i)
  })

  it('400 sem restauranteId', async () => {
    const res = await fetch(`${BASE}/api/refeicoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit', token: 'tok', dataRefeicao: '2026-05-22', itens: [{ refeicao: true }] }),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/restaurante/i)
  })

  it('400 sem dataRefeicao', async () => {
    const res = await fetch(`${BASE}/api/refeicoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit', token: 'tok', restauranteId: 'r1', itens: [{ refeicao: true }] }),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/data/i)
  })

  it('400 sem itens marcados', async () => {
    const res = await fetch(`${BASE}/api/refeicoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit', token: 'tok', restauranteId: 'r1', dataRefeicao: '2026-05-22', itens: [{ refeicao: false, cafe: false }] }),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/item|marque/i)
  })
})

describe('POST /api/refeicoes?action=aprovar — validação', () => {
  it('400 sem token quando action=aprovar', async () => {
    const res = await fetch(`${BASE}/api/refeicoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'aprovar', acao: 'aprovado' }),
    })
    const body = await res.json()
    // Sem token → não encontra solicitação → 400 ou 404
    expect([400, 404]).toContain(res.status)
  })
})
