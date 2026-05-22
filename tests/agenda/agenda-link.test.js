/**
 * Testes — api/agenda-link.js
 *
 * Endpoint público para o formulário de agendamento gerado via WhatsApp bot.
 *
 * Unitários: fmtData
 * Integração: OPTIONS, GET (token obrigatório / inválido / expirado), POST validação
 */
import { describe, it, expect } from 'vitest'

// ─── Helper copiado de api/agenda-link.js ────────────────────────────────────

function fmtData(iso) {
  if (!iso) return '—'
  return String(iso).split('-').reverse().join('/')
}

// ─── fmtData ─────────────────────────────────────────────────────────────────

describe('fmtData', () => {
  it('converte YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(fmtData('2026-05-22')).toBe('22/05/2026')
  })

  it('primeiro de janeiro', () => {
    expect(fmtData('2025-01-01')).toBe('01/01/2025')
  })

  it('null → "—"', () => {
    expect(fmtData(null)).toBe('—')
  })

  it('undefined → "—"', () => {
    expect(fmtData(undefined)).toBe('—')
  })

  it('string vazia → "—"', () => {
    expect(fmtData('')).toBe('—')
  })
})

// ─── Integração: /api/agenda-link ────────────────────────────────────────────

const BASE = 'https://smartpro.app.br'

describe('/api/agenda-link — CORS preflight', () => {
  it('200 para OPTIONS', async () => {
    const res = await fetch(`${BASE}/api/agenda-link`, { method: 'OPTIONS' })
    expect(res.status).toBe(200)
  })
})

describe('GET /api/agenda-link — validação de token', () => {
  it('400 sem token', async () => {
    const res = await fetch(`${BASE}/api/agenda-link`)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/token/i)
  })

  it('404 com token inexistente', async () => {
    const res = await fetch(`${BASE}/api/agenda-link?token=token_inexistente_xpto_000`)
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error).toBeTruthy()
  })
})

describe('POST /api/agenda-link — campos obrigatórios', () => {
  it('400 sem token', async () => {
    const res = await fetch(`${BASE}/api/agenda-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_nome: 'João', data_servico: '2026-05-22' }),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/token/i)
  })

  it('400 com token mas sem cliente_nome', async () => {
    const res = await fetch(`${BASE}/api/agenda-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'tok_fake', data_servico: '2026-05-22' }),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/cliente_nome/i)
  })
})
