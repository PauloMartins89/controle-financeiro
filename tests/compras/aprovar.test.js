/**
 * Testes de integração — POST /api/aprovar-compra
 *
 * Testa validações de entrada e tokens inválidos.
 * Não testa happy-path (requer token válido não-usado na DB).
 */
import { describe, it, expect } from 'vitest'

const BASE = 'https://smartpro.app.br'
const FAKE_TOKEN = '00000000-0000-0000-0000-000000000000'

async function post(payload) {
  const res = await fetch(`${BASE}/api/aprovar-compra`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let body
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body }
}

describe('POST /api/aprovar-compra — validações de entrada', () => {
  it('405 para GET', async () => {
    const res = await fetch(`${BASE}/api/aprovar-compra`)
    expect(res.status).toBe(405)
  })

  it('400 sem token e sem acao', async () => {
    const { status, body } = await post({})
    expect(status).toBe(400)
    expect(body.error).toMatch(/token|acao/i)
  })

  it('400 sem token', async () => {
    const { status, body } = await post({ acao: 'aprovar' })
    expect(status).toBe(400)
    expect(body.error).toMatch(/token|acao/i)
  })

  it('400 sem acao', async () => {
    const { status, body } = await post({ token: FAKE_TOKEN })
    expect(status).toBe(400)
    expect(body.error).toMatch(/token|acao/i)
  })

  it('400 acao inválida', async () => {
    const { status, body } = await post({ token: FAKE_TOKEN, acao: 'deletar' })
    expect(status).toBe(400)
    expect(body.error).toMatch(/acao/i)
  })

  it('CORS headers presentes', async () => {
    const res = await fetch(`${BASE}/api/aprovar-compra`, { method: 'OPTIONS' })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })
})

describe('POST /api/aprovar-compra — token inexistente', () => {
  it('404 ao aprovar com token fake', async () => {
    const { status, body } = await post({ token: FAKE_TOKEN, acao: 'aprovar' })
    // Solicitação não encontrada pelo token
    expect(status).toBe(404)
    expect(body.error).toBeDefined()
  })

  it('404 ao recusar com token fake', async () => {
    const { status, body } = await post({ token: FAKE_TOKEN, acao: 'recusar' })
    expect(status).toBe(404)
    expect(body.error).toBeDefined()
  })

  it('404 ao abrir leilão com token fake', async () => {
    const { status, body } = await post({
      token: FAKE_TOKEN,
      acao: 'leilao',
      fornecedores: [{ nome: 'Fornecedor A', telefone: '67999001234' }],
      prazo: '2026-12-31',
    })
    expect(status).toBe(404)
    expect(body.error).toBeDefined()
  })
})
