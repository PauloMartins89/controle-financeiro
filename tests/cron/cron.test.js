/**
 * Testes — api/cron.js
 *
 * Unitários: formatBRL, calcularSaldos
 * Integração: autenticação (401) — não requer CRON_SECRET
 *             type inválido (400) — requer CRON_SECRET via env var opcional
 */
import { describe, it, expect } from 'vitest'

// ─── Helpers copiados de api/cron.js ─────────────────────────────────────────

function formatBRL(v) {
  return 'R$ ' + Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function calcularSaldos(despesas, pessoas) {
  const balances = {}
  pessoas.forEach(p => { balances[p.id] = 0 })
  despesas.filter(e => e.status !== 'pago').forEach(exp => {
    const { valor, pago_por, participantes, parcelas } = exp
    if (!participantes?.length || !pago_por) return
    const share = (valor / (parcelas || 1)) / participantes.length
    participantes.forEach(pid => {
      if (pid === pago_por) return
      if (balances[pid] !== undefined) balances[pid] -= share
      if (balances[pago_por] !== undefined) balances[pago_por] += share
    })
  })
  return pessoas.map(p => ({
    id: p.id,
    nome: p.nome,
    saldo: Math.round((balances[p.id] || 0) * 100) / 100,
  }))
}

// ─── formatBRL ────────────────────────────────────────────────────────────────

describe('formatBRL', () => {
  it('valor inteiro simples', () => {
    expect(formatBRL(100)).toBe('R$ 100,00')
  })

  it('valor com centavos', () => {
    expect(formatBRL(1234.56)).toBe('R$ 1.234,56')
  })

  it('valor grande com separador de milhar', () => {
    expect(formatBRL(10000)).toBe('R$ 10.000,00')
  })

  it('valor muito grande — dois separadores', () => {
    expect(formatBRL(1000000)).toBe('R$ 1.000.000,00')
  })

  it('valor negativo — usa Math.abs (sempre positivo na exibição)', () => {
    expect(formatBRL(-250.5)).toBe('R$ 250,50')
  })

  it('zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00')
  })

  it('valor fracionado pequeno', () => {
    expect(formatBRL(0.01)).toBe('R$ 0,01')
  })
})

// ─── calcularSaldos ───────────────────────────────────────────────────────────

describe('calcularSaldos', () => {
  const p1 = { id: 'p1', nome: 'Ana' }
  const p2 = { id: 'p2', nome: 'Bruno' }
  const p3 = { id: 'p3', nome: 'Carla' }

  it('sem despesas → todos saldo zero', () => {
    const result = calcularSaldos([], [p1, p2])
    expect(result.find(r => r.id === 'p1').saldo).toBe(0)
    expect(result.find(r => r.id === 'p2').saldo).toBe(0)
  })

  it('despesa paga é ignorada', () => {
    const despesas = [{ valor: 100, pago_por: 'p1', participantes: ['p1', 'p2'], status: 'pago', parcelas: 1 }]
    const result = calcularSaldos(despesas, [p1, p2])
    expect(result.find(r => r.id === 'p1').saldo).toBe(0)
    expect(result.find(r => r.id === 'p2').saldo).toBe(0)
  })

  it('p1 paga 100 para p1+p2 → p1 +50, p2 -50', () => {
    const despesas = [{ valor: 100, pago_por: 'p1', participantes: ['p1', 'p2'], status: 'pendente', parcelas: 1 }]
    const result = calcularSaldos(despesas, [p1, p2])
    expect(result.find(r => r.id === 'p1').saldo).toBe(50)
    expect(result.find(r => r.id === 'p2').saldo).toBe(-50)
  })

  it('dividido entre 3 — share correto', () => {
    const despesas = [{ valor: 90, pago_por: 'p1', participantes: ['p1', 'p2', 'p3'], status: 'pendente', parcelas: 1 }]
    const result = calcularSaldos(despesas, [p1, p2, p3])
    expect(result.find(r => r.id === 'p1').saldo).toBe(60)   // pagou 90, deve receber 30+30
    expect(result.find(r => r.id === 'p2').saldo).toBe(-30)
    expect(result.find(r => r.id === 'p3').saldo).toBe(-30)
  })

  it('parcelado em 2 — divide o valor pela parcela', () => {
    // valor=100, parcelas=2 → share por parcela = 50/2 = 25
    const despesas = [{ valor: 100, pago_por: 'p1', participantes: ['p1', 'p2'], status: 'pendente', parcelas: 2 }]
    const result = calcularSaldos(despesas, [p1, p2])
    expect(result.find(r => r.id === 'p1').saldo).toBe(25)
    expect(result.find(r => r.id === 'p2').saldo).toBe(-25)
  })

  it('múltiplas despesas acumulam', () => {
    const despesas = [
      { valor: 100, pago_por: 'p1', participantes: ['p1', 'p2'], status: 'pendente', parcelas: 1 },
      { valor: 60,  pago_por: 'p2', participantes: ['p1', 'p2'], status: 'pendente', parcelas: 1 },
    ]
    const result = calcularSaldos(despesas, [p1, p2])
    // p1: +50 (paga 100÷2) - 30 (deve metade de 60) = +20
    // p2: -50 (deve metade de 100) + 30 (paga 60÷2) = -20
    expect(result.find(r => r.id === 'p1').saldo).toBe(20)
    expect(result.find(r => r.id === 'p2').saldo).toBe(-20)
  })

  it('pessoa sem participação tem saldo zero', () => {
    const despesas = [{ valor: 100, pago_por: 'p1', participantes: ['p1', 'p2'], status: 'pendente', parcelas: 1 }]
    const result = calcularSaldos(despesas, [p1, p2, p3])
    expect(result.find(r => r.id === 'p3').saldo).toBe(0)
  })

  it('despesa sem participantes é ignorada', () => {
    const despesas = [{ valor: 100, pago_por: 'p1', participantes: [], status: 'pendente', parcelas: 1 }]
    const result = calcularSaldos(despesas, [p1, p2])
    expect(result.find(r => r.id === 'p1').saldo).toBe(0)
    expect(result.find(r => r.id === 'p2').saldo).toBe(0)
  })

  it('despesa sem pago_por é ignorada', () => {
    const despesas = [{ valor: 100, pago_por: null, participantes: ['p1', 'p2'], status: 'pendente', parcelas: 1 }]
    const result = calcularSaldos(despesas, [p1, p2])
    expect(result.find(r => r.id === 'p1').saldo).toBe(0)
    expect(result.find(r => r.id === 'p2').saldo).toBe(0)
  })

  it('resultado arredondado a 2 casas decimais', () => {
    // 10 / 3 = 3.333... → arredondado
    const despesas = [{ valor: 10, pago_por: 'p1', participantes: ['p1', 'p2', 'p3'], status: 'pendente', parcelas: 1 }]
    const result = calcularSaldos(despesas, [p1, p2, p3])
    const saldoP1 = result.find(r => r.id === 'p1').saldo
    expect(Number.isFinite(saldoP1)).toBe(true)
    // p1 pagou 10, devem receber ~3.33 de p2 e ~3.33 de p3 → saldo ≈ 6.67
    expect(saldoP1).toBeCloseTo(6.67, 1)
  })
})

// ─── Integração: GET /api/cron — autenticação ─────────────────────────────────

const BASE = 'https://smartpro.app.br'

describe('GET /api/cron — autenticação', () => {
  it('401 sem Authorization header', async () => {
    const res = await fetch(`${BASE}/api/cron`)
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toMatch(/unauthorized/i)
  })

  it('401 com token errado', async () => {
    const res = await fetch(`${BASE}/api/cron`, {
      headers: { Authorization: 'Bearer token_invalido_xyz' },
    })
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toMatch(/unauthorized/i)
  })

  it('401 com Authorization malformado (sem Bearer)', async () => {
    const res = await fetch(`${BASE}/api/cron`, {
      headers: { Authorization: 'token_sem_bearer' },
    })
    expect(res.status).toBe(401)
  })

  // Requer CRON_SECRET configurado no ambiente de teste
  it('400 sem type quando autenticado', async () => {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      console.warn('[SKIP] CRON_SECRET não definido — pule ou defina env var para testar type inválido')
      return
    }
    const res = await fetch(`${BASE}/api/cron`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/type/i)
  })

  it('400 type desconhecido quando autenticado', async () => {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      console.warn('[SKIP] CRON_SECRET não definido')
      return
    }
    const res = await fetch(`${BASE}/api/cron?type=invalido`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/type/i)
  })
})
