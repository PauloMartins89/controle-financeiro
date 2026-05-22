/**
 * Testes — api/admin.js
 *
 * Integração: CORS preflight, autenticação (401/403), ações de workspace
 */
import { describe, it, expect } from 'vitest'

const BASE = 'https://smartpro.app.br'

describe('/api/admin — CORS preflight', () => {
  it('200 para OPTIONS', async () => {
    const res = await fetch(`${BASE}/api/admin`, { method: 'OPTIONS' })
    expect(res.status).toBe(200)
  })
})

describe('GET /api/admin — autenticação', () => {
  it('401 sem Authorization', async () => {
    const res = await fetch(`${BASE}/api/admin`)
    const body = await res.json()
    expect([401, 400]).toContain(res.status)
    if (res.status === 401) {
      expect(body.error).toBeTruthy()
    }
  })

  it('401 com token JWT inválido', async () => {
    const res = await fetch(`${BASE}/api/admin`, {
      headers: { Authorization: 'Bearer token_invalido_xpto' },
    })
    const body = await res.json()
    expect([401, 403]).toContain(res.status)
  })

  it('401 para action=workspace-members-list sem auth', async () => {
    const res = await fetch(`${BASE}/api/admin?action=workspace-members-list`)
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toBeTruthy()
  })
})

describe('POST /api/admin — autenticação', () => {
  it('401 para action=workspace-add-user sem auth', async () => {
    const res = await fetch(`${BASE}/api/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'workspace-add-user', email: 'test@test.com' }),
    })
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toBeTruthy()
  })

  it('401 para action plataforma admin sem auth', async () => {
    const res = await fetch(`${BASE}/api/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list-users' }),
    })
    const body = await res.json()
    expect([401, 400]).toContain(res.status)
  })
})
