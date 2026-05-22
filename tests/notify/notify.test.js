/**
 * Testes — api/notify.js
 *
 * Unitários: fmtDate, fmtCurrency, buildMessage, buildLoteMessage
 * Integração: GET diagnóstico, POST validação, POST 405
 */
import { describe, it, expect } from 'vitest'

// ─── Helpers copiados de api/notify.js ───────────────────────────────────────

function fmtDate(d) {
  if (!d) return ''
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_LABELS = {
  rascunho:             'Rascunho',
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado:             'Aprovado',
  devolvido:            'Devolvido para Correção',
  corrigido:            'Corrigido / Reenviado',
  reprovado:            'Reprovado',
  cancelado:            'Cancelado',
  faturado:             'Faturado',
}

const STATUS_EMOJI = {
  rascunho:             '📝',
  aguardando_aprovacao: '⏳',
  aprovado:             '✅',
  devolvido:            '⚠️',
  corrigido:            '🔧',
  reprovado:            '❌',
  cancelado:            '🚫',
  faturado:             '💰',
}

function buildLoteMessage(status, loteCliente, totalItens, totalValor, gestorNome) {
  const emoji  = STATUS_EMOJI[status] || '🔔'
  const label  = STATUS_LABELS[status] || status
  const gestor = gestorNome ? `\n\n— _${gestorNome}_` : ''
  return (
    `${emoji} *Lote — ${label}*\n\n` +
    `Lote *${loteCliente}* foi marcado como *${label}*.\n` +
    `\n📦 Lançamentos: *${totalItens} ${totalItens === 1 ? 'item' : 'itens'}*` +
    `\n💵 Total: *${fmtCurrency(totalValor)}*` +
    gestor
  )
}

function buildMessage(status, dados, motivo, gestorNome) {
  const num    = dados.numero_diario ? `Nº *${dados.numero_diario}*` : 'um diário'
  const data   = dados.data ? ` de ${fmtDate(dados.data)}` : ''
  const cond   = dados.condutor ? `\n🚛 Motorista: *${dados.condutor}*` : ''
  const placa  = dados.placa    ? `\n🚗 Placa: *${dados.placa}*`        : ''
  const valor  = dados.valor    ? `\n💵 Valor: *R$ ${Number(dados.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*` : ''
  const emoji  = STATUS_EMOJI[status] || '🔔'
  const label  = STATUS_LABELS[status] || status
  const gestor = gestorNome ? `\n\n— _${gestorNome}_` : ''
  const motivoLine = motivo ? `\n\n📝 *Motivo:* ${motivo}` : ''

  return (
    `${emoji} *Lançamento — ${label}*\n\n` +
    `Diário ${num}${data} mudou de status para *${label}*.` +
    cond + placa + valor +
    motivoLine +
    gestor
  )
}

// ─── fmtDate ─────────────────────────────────────────────────────────────────

describe('fmtDate', () => {
  it('converte YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(fmtDate('2026-05-22')).toBe('22/05/2026')
  })

  it('data de primeiro de janeiro', () => {
    expect(fmtDate('2025-01-01')).toBe('01/01/2025')
  })

  it('null → string vazia', () => {
    expect(fmtDate(null)).toBe('')
  })

  it('undefined → string vazia', () => {
    expect(fmtDate(undefined)).toBe('')
  })
})

// ─── fmtCurrency ─────────────────────────────────────────────────────────────

describe('fmtCurrency', () => {
  it('valor positivo formata como BRL', () => {
    const result = fmtCurrency(1500)
    expect(result).toContain('1')
    expect(result).toContain('500')
    expect(result.toLowerCase()).toMatch(/r\$|brl/)
  })

  it('zero → R$ 0,00', () => {
    const result = fmtCurrency(0)
    expect(result).toContain('0')
  })

  it('null → trata como zero', () => {
    const result = fmtCurrency(null)
    expect(result).toContain('0')
  })

  it('valor fracionado mantém centavos', () => {
    const result = fmtCurrency(123.45)
    expect(result).toContain('45')
  })
})

// ─── STATUS_LABELS e STATUS_EMOJI ────────────────────────────────────────────

describe('STATUS_LABELS', () => {
  it('aprovado', () => expect(STATUS_LABELS.aprovado).toBe('Aprovado'))
  it('reprovado', () => expect(STATUS_LABELS.reprovado).toBe('Reprovado'))
  it('devolvido', () => expect(STATUS_LABELS.devolvido).toBe('Devolvido para Correção'))
  it('faturado', () => expect(STATUS_LABELS.faturado).toBe('Faturado'))
  it('cancelado', () => expect(STATUS_LABELS.cancelado).toBe('Cancelado'))
})

describe('STATUS_EMOJI', () => {
  it('aprovado → ✅', () => expect(STATUS_EMOJI.aprovado).toBe('✅'))
  it('reprovado → ❌', () => expect(STATUS_EMOJI.reprovado).toBe('❌'))
  it('faturado → 💰', () => expect(STATUS_EMOJI.faturado).toBe('💰'))
})

// ─── buildLoteMessage ─────────────────────────────────────────────────────────

describe('buildLoteMessage', () => {
  it('contém emoji, label e nome do lote', () => {
    const msg = buildLoteMessage('aprovado', 'LOTE-001', 3, 1500, null)
    expect(msg).toContain('✅')
    expect(msg).toContain('Aprovado')
    expect(msg).toContain('LOTE-001')
  })

  it('1 item → singular "item"', () => {
    const msg = buildLoteMessage('aprovado', 'L1', 1, 100, null)
    expect(msg).toContain('1 item')
    expect(msg).not.toContain('itens')
  })

  it('múltiplos itens → plural "itens"', () => {
    const msg = buildLoteMessage('aprovado', 'L1', 5, 500, null)
    expect(msg).toContain('5 itens')
  })

  it('inclui nome do gestor quando fornecido', () => {
    const msg = buildLoteMessage('aprovado', 'L1', 1, 100, 'João Silva')
    expect(msg).toContain('João Silva')
  })

  it('sem gestor → não inclui separador de gestor', () => {
    const msg = buildLoteMessage('aprovado', 'L1', 1, 100, null)
    expect(msg).not.toContain('_')
  })

  it('status desconhecido → usa status bruto como label e emoji 🔔', () => {
    const msg = buildLoteMessage('status_novo', 'L1', 1, 100, null)
    expect(msg).toContain('🔔')
    expect(msg).toContain('status_novo')
  })
})

// ─── buildMessage ─────────────────────────────────────────────────────────────

describe('buildMessage', () => {
  it('contém emoji e label do status', () => {
    const msg = buildMessage('aprovado', { numero_diario: 42, data: '2026-05-22' }, null, null)
    expect(msg).toContain('✅')
    expect(msg).toContain('Aprovado')
  })

  it('inclui numero_diario quando presente', () => {
    const msg = buildMessage('aprovado', { numero_diario: 99 }, null, null)
    expect(msg).toContain('99')
  })

  it('usa "um diário" quando numero_diario ausente', () => {
    const msg = buildMessage('aprovado', {}, null, null)
    expect(msg).toContain('um diário')
  })

  it('formata data para DD/MM/YYYY', () => {
    const msg = buildMessage('aprovado', { data: '2026-01-15' }, null, null)
    expect(msg).toContain('15/01/2026')
  })

  it('inclui condutor quando presente', () => {
    const msg = buildMessage('aprovado', { condutor: 'Carlos' }, null, null)
    expect(msg).toContain('Carlos')
    expect(msg).toContain('🚛')
  })

  it('inclui placa quando presente', () => {
    const msg = buildMessage('aprovado', { placa: 'ABC-1234' }, null, null)
    expect(msg).toContain('ABC-1234')
    expect(msg).toContain('🚗')
  })

  it('inclui motivo quando presente', () => {
    const msg = buildMessage('devolvido', {}, 'Falta de nota fiscal', null)
    expect(msg).toContain('Falta de nota fiscal')
    expect(msg).toContain('📝')
  })

  it('inclui gestor quando presente', () => {
    const msg = buildMessage('aprovado', {}, null, 'Maria Gestora')
    expect(msg).toContain('Maria Gestora')
  })

  it('sem campos opcionais → mensagem limpa sem artefatos', () => {
    const msg = buildMessage('cancelado', {}, null, null)
    expect(msg).toContain('🚫')
    expect(msg).not.toContain('undefined')
    expect(msg).not.toContain('null')
  })
})

// ─── Integração: /api/notify ──────────────────────────────────────────────────

const BASE = 'https://smartpro.app.br'

describe('GET /api/notify — diagnóstico', () => {
  it('401 sem Authorization header', async () => {
    const res = await fetch(`${BASE}/api/notify`)
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toBeTruthy()
  })

  it('401 com token inválido', async () => {
    const res = await fetch(`${BASE}/api/notify?lancamentoId=qualquer-uuid`, {
      headers: { Authorization: 'Bearer token-invalido' },
    })
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toBeTruthy()
  })

  it('401 com params completos mas sem service key', async () => {
    const res = await fetch(`${BASE}/api/notify?lancamentoId=00000000-0000-0000-0000-000000000000&status=aprovado`)
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toBeTruthy()
  })
})

describe('POST /api/notify — validação', () => {
  it('405 para DELETE', async () => {
    const res = await fetch(`${BASE}/api/notify`, { method: 'DELETE' })
    expect(res.status).toBe(405)
  })

  it('400 sem body', async () => {
    const res = await fetch(`${BASE}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBeTruthy()
  })

  it('400 com status mas sem lancamentoId/loteId', async () => {
    const res = await fetch(`${BASE}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'aprovado' }),
    })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/lancamentoId|loteId/i)
  })

  it('404 com lancamentoId fake e status válido', async () => {
    const res = await fetch(`${BASE}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lancamentoId: '00000000-0000-0000-0000-000000000000', status: 'aprovado' }),
    })
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error).toBeTruthy()
  })
})
