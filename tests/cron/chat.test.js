/**
 * Testes — api/chat.js
 *
 * Integração: autenticação e validação de request
 * Nota: testes de resposta real requerem token Supabase válido + GROQ_API_KEY
 */
import { describe, it, expect } from 'vitest'

const BASE = 'https://smartpro.app.br'

describe('POST /api/chat — método', () => {
  it('405 para GET', async () => {
    const res = await fetch(`${BASE}/api/chat`)
    expect(res.status).toBe(405)
  })

  it('405 para PUT', async () => {
    const res = await fetch(`${BASE}/api/chat`, { method: 'PUT' })
    expect(res.status).toBe(405)
  })
})

describe('POST /api/chat — autenticação', () => {
  it('401 sem Authorization header', async () => {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }),
    })
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toBeTruthy()
  })

  it('401 com token JWT inválido', async () => {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token_jwt_invalido_xpto',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }),
    })
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toBeTruthy()
  })

  it('401 com Authorization vazio', async () => {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'oi' }] }),
    })
    // Token vazio → não autenticado
    expect([401, 400]).toContain(res.status)
  })
})

describe('POST /api/chat — validação de payload', () => {
  // Nota: validação de messages só ocorre após autenticação,
  // então sem token válido sempre recebe 401 antes.
  // Estes testes confirmam que auth vem antes de payload validation.

  it('mensagem sem messages → 401 (auth verificada primeiro)', async () => {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(401)
  })

  it('messages inválido (string) → 401 (auth verificada primeiro)', async () => {
    const res = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: 'not-an-array' }),
    })
    expect(res.status).toBe(401)
  })
})
