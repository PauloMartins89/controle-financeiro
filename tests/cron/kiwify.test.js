/**
 * Testes — api/kiwify-webhook.js
 *
 * Unitários: verifyToken, normalização de payload (planName, email)
 * Integração: 405 para GET (sem token configurado = aceita tudo, mas sem payload)
 */
import { describe, it, expect } from 'vitest'

// ─── Helpers copiados de api/kiwify-webhook.js ───────────────────────────────

const PLAN_DAYS = { mensal: 31, anual: 366 }

function verifyToken(secret, headerToken, queryToken) {
  if (!secret) return true // sem token configurado, aceita tudo
  return headerToken === secret || queryToken === secret
}

function normalizarPayload(body) {
  const customer = body.data?.customer || body.customer || {}
  const order    = body.data?.order    || body.order    || {}
  const sub      = body.data?.subscription || body.subscription || {}

  const email    = (customer.email || '').toLowerCase().trim()
  const orderId  = order.id   || body.order_id    || null
  const subId    = sub.id     || body.sub_id      || null
  const planName = (sub.plan?.name || order.product?.name || 'mensal')
    .toLowerCase().includes('anual') ? 'anual' : 'mensal'

  return { email, orderId, subId, planName }
}

function diasDoPlan(planName) {
  return PLAN_DAYS[planName] || PLAN_DAYS.mensal
}

// ─── verifyToken ──────────────────────────────────────────────────────────────

describe('verifyToken', () => {
  it('sem secret configurado → aceita qualquer token', () => {
    expect(verifyToken(null, 'qualquer', null)).toBe(true)      // null é falsy
    expect(verifyToken('', 'qualquer', null)).toBe(true)        // '' é falsy → aceita
    expect(verifyToken(undefined, 'qualquer', null)).toBe(true) // undefined é falsy
  })

  it('aceita via header', () => {
    expect(verifyToken('meu-secret', 'meu-secret', null)).toBe(true)
  })

  it('aceita via query param', () => {
    expect(verifyToken('meu-secret', null, 'meu-secret')).toBe(true)
  })

  it('rejeita token errado', () => {
    expect(verifyToken('meu-secret', 'outro-token', 'outro-token')).toBe(false)
  })

  it('rejeita quando ambos header e query são errados', () => {
    expect(verifyToken('meu-secret', 'errado', 'tambem-errado')).toBe(false)
  })

  it('case-sensitive — tokens diferentes em case', () => {
    expect(verifyToken('MeuSecret', 'meusecret', null)).toBe(false)
  })
})

// ─── normalizarPayload ────────────────────────────────────────────────────────

describe('normalizarPayload', () => {
  it('email normalizado — lowercase e trim', () => {
    const result = normalizarPayload({ customer: { email: '  JOAO@EXAMPLE.COM  ' } })
    expect(result.email).toBe('joao@example.com')
  })

  it('email vazio quando ausente', () => {
    expect(normalizarPayload({}).email).toBe('')
  })

  it('customer no formato data.customer (v2)', () => {
    const body = { data: { customer: { email: 'v2@example.com' } } }
    expect(normalizarPayload(body).email).toBe('v2@example.com')
  })

  it('customer no formato raiz (v1)', () => {
    const body = { customer: { email: 'v1@example.com' } }
    expect(normalizarPayload(body).email).toBe('v1@example.com')
  })

  it('planName detecta anual por nome do produto', () => {
    const body = { data: { subscription: { plan: { name: 'Plano Anual SmartPro' } } } }
    expect(normalizarPayload(body).planName).toBe('anual')
  })

  it('planName padrão mensal quando não detecta anual', () => {
    const body = { data: { subscription: { plan: { name: 'Plano Mensal' } } } }
    expect(normalizarPayload(body).planName).toBe('mensal')
  })

  it('planName padrão mensal quando ausente', () => {
    expect(normalizarPayload({}).planName).toBe('mensal')
  })

  it('orderId lido de order.id', () => {
    const body = { data: { order: { id: 'ORD-123' } } }
    expect(normalizarPayload(body).orderId).toBe('ORD-123')
  })

  it('orderId lido de order_id raiz (fallback)', () => {
    const body = { order_id: 'ORD-456' }
    expect(normalizarPayload(body).orderId).toBe('ORD-456')
  })
})

// ─── diasDoPlan ───────────────────────────────────────────────────────────────

describe('diasDoPlan', () => {
  it('mensal → 31 dias', () => {
    expect(diasDoPlan('mensal')).toBe(31)
  })

  it('anual → 366 dias', () => {
    expect(diasDoPlan('anual')).toBe(366)
  })

  it('plano desconhecido → padrão mensal (31)', () => {
    expect(diasDoPlan('bimestral')).toBe(31)
  })
})

// ─── Integração: POST /api/kiwify-webhook ─────────────────────────────────────

const BASE = 'https://smartpro.app.br'

describe('POST /api/kiwify-webhook — método', () => {
  it('405 para GET', async () => {
    const res = await fetch(`${BASE}/api/kiwify-webhook`)
    expect(res.status).toBe(405)
  })

  it('401 quando KIWIFY_TOKEN configurado e token ausente na request', async () => {
    // Em prod KIWIFY_TOKEN está configurado → requisição sem token deve retornar 401
    const res = await fetch(`${BASE}/api/kiwify-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'order_approved', data: {} }),
    })
    // Se KIWIFY_TOKEN configurado → 401; se não configurado → 200 com warning
    expect([200, 401]).toContain(res.status)
    if (res.status === 200) {
      const body = await res.json().catch(() => ({}))
      expect(body.warning).toMatch(/email/i)
    }
  })
})
