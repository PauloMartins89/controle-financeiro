/**
 * Testes unitários — helpers internos do módulo de agenda
 * Não dependem de rede ou banco de dados.
 */
import { describe, it, expect } from 'vitest'

// ─── helpers copiados/extraídos dos arquivos de produção ─────────────────────

function normalizarTelefone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (!digits || digits.length < 8) return null
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return '55' + digits
  if (digits.length === 13 && digits.startsWith('55')) return digits
  return '55' + digits
}

function telefoneValido(normalized) {
  if (!normalized) return false
  return /^55\d{10,11}$/.test(normalized)
}

function fmtData(iso) {
  if (!iso) return '—'
  return String(iso).split('-').reverse().join('/')
}

/** Lê token do pathname — mesmo padrão do agendar.html */
function lerTokenDoPathname(pathname) {
  const parts = pathname.split('/')
  const last = parts[parts.length - 1]
  return (last && last.length > 0) ? last : null
}

/** Lê token com fallback para query string */
function lerToken(pathname, search) {
  const fromPath = lerTokenDoPathname(pathname)
  if (fromPath) return fromPath
  return new URLSearchParams(search).get('token')
}

// ─── normalizarTelefone ───────────────────────────────────────────────────────
describe('normalizarTelefone', () => {
  it('retorna null para valor vazio', () => {
    expect(normalizarTelefone(null)).toBeNull()
    expect(normalizarTelefone('')).toBeNull()
    expect(normalizarTelefone(undefined)).toBeNull()
  })

  it('retorna null para número muito curto', () => {
    expect(normalizarTelefone('1234')).toBeNull()
  })

  it('adiciona 55 em número de 11 dígitos (celular)', () => {
    expect(normalizarTelefone('67999001234')).toBe('5567999001234')
  })

  it('adiciona 55 em número de 10 dígitos (fixo)', () => {
    expect(normalizarTelefone('6733001234')).toBe('556733001234')
  })

  it('mantém número que já tem DDI 55 com 13 dígitos', () => {
    expect(normalizarTelefone('5567999001234')).toBe('5567999001234')
  })

  it('remove formatação (traços, parênteses, espaços)', () => {
    expect(normalizarTelefone('(67) 99900-1234')).toBe('5567999001234')
  })

  it('remove formatação com +55', () => {
    expect(normalizarTelefone('+55 (67) 99900-1234')).toBe('5567999001234')
  })
})

// ─── telefoneValido ───────────────────────────────────────────────────────────
describe('telefoneValido', () => {
  it('válido — celular 13 dígitos', () => {
    expect(telefoneValido('5567999001234')).toBe(true)
  })

  it('válido — fixo 12 dígitos', () => {
    expect(telefoneValido('556733001234')).toBe(true)
  })

  it('inválido — sem DDI 55', () => {
    expect(telefoneValido('67999001234')).toBe(false)
  })

  it('inválido — null', () => {
    expect(telefoneValido(null)).toBe(false)
  })

  it('inválido — muito curto', () => {
    expect(telefoneValido('5567')).toBe(false)
  })
})

// ─── fmtData ─────────────────────────────────────────────────────────────────
describe('fmtData', () => {
  it('converte ISO para DD/MM/AAAA', () => {
    expect(fmtData('2026-05-28')).toBe('28/05/2026')
  })

  it('retorna — para valor falsy', () => {
    expect(fmtData(null)).toBe('—')
    expect(fmtData('')).toBe('—')
    expect(fmtData(undefined)).toBe('—')
  })

  it('converte data de início de ano', () => {
    expect(fmtData('2026-01-01')).toBe('01/01/2026')
  })
})

// ─── lerToken (agendar.html) ──────────────────────────────────────────────────
describe('lerToken — parsing do pathname (Vercel rewrite)', () => {
  it('lê token de /ag/TOKEN', () => {
    expect(lerToken('/ag/abc123', '')).toBe('abc123')
  })

  it('lê token UUID sem hífens (32 chars)', () => {
    const token = '21ea02171491431a8840b51bf43ee466'
    expect(lerToken(`/ag/${token}`, '')).toBe(token)
  })

  it('fallback para query string se pathname não tiver token', () => {
    expect(lerToken('/ag/', '?token=xyz789')).toBe('xyz789')
    expect(lerToken('/', '?token=xyz789')).toBe('xyz789')
  })

  it('retorna null se não houver token em lugar algum', () => {
    expect(lerToken('/', '')).toBeNull()
    expect(lerToken('/ag/', '')).toBeNull()
  })

  it('pathname vence query string', () => {
    expect(lerToken('/ag/frompath', '?token=fromquery')).toBe('frompath')
  })
})
