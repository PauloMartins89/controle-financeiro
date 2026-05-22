/**
 * Testes de integração — API /api/agenda-link
 * Executa contra a produção: https://smartpro.app.br
 *
 * Cobertura:
 *   GET  — validações de entrada e lookup de token
 *   POST — validações de campos obrigatórios e token inválido/expirado
 *
 * Nota: o teste POST "happy path" requer token válido não-usado.
 *       O token de teste abaixo já foi utilizado → cobre o caso 410.
 */
import { describe, it, expect, beforeAll } from 'vitest'

const BASE = 'https://smartpro.app.br'
const USED_TOKEN = '21ea02171491431a8840b51bf43ee466' // token já utilizado (AG-00005)
const FAKE_TOKEN = '00000000000000000000000000000000'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  let body
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body }
}

async function post(payload) {
  const res = await fetch(`${BASE}/api/agenda-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let body
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body }
}

// ─── GET /api/agenda-link ─────────────────────────────────────────────────────
describe('GET /api/agenda-link', () => {
  it('400 se token não informado', async () => {
    const { status, body } = await get('/api/agenda-link')
    expect(status).toBe(400)
    expect(body.error).toMatch(/token/i)
  })

  it('404 se token inexistente', async () => {
    const { status, body } = await get(`/api/agenda-link?token=${FAKE_TOKEN}`)
    expect(status).toBe(404)
    expect(body.error).toBeDefined()
  })

  it('410 se token já foi utilizado', async () => {
    const { status, body } = await get(`/api/agenda-link?token=${USED_TOKEN}`)
    expect(status).toBe(410)
    expect(body.usado).toBe(true)
  })

  it('CORS headers presentes', async () => {
    const res = await fetch(`${BASE}/api/agenda-link?token=${FAKE_TOKEN}`)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('OPTIONS retorna 200', async () => {
    const res = await fetch(`${BASE}/api/agenda-link`, { method: 'OPTIONS' })
    expect(res.status).toBe(200)
  })
})

// ─── POST /api/agenda-link ────────────────────────────────────────────────────
describe('POST /api/agenda-link', () => {
  it('400 se token ausente', async () => {
    const { status, body } = await post({
      cliente_nome: 'Teste',
      tipo_servico: 'Guindaste',
      data_servico: '2026-06-01',
    })
    expect(status).toBe(400)
    expect(body.error).toMatch(/token/i)
  })

  it('400 se cliente_nome ausente', async () => {
    const { status, body } = await post({
      token: FAKE_TOKEN,
      tipo_servico: 'Guindaste',
      data_servico: '2026-06-01',
    })
    // Vai falhar na validação de campo OU no lookup do token — ambos são erros de cliente
    expect([400, 404]).toContain(status)
  })

  it('400 se tipo_servico ausente', async () => {
    const { status, body } = await post({
      token: FAKE_TOKEN,
      cliente_nome: 'Teste',
      data_servico: '2026-06-01',
    })
    expect([400, 404]).toContain(status)
  })

  it('400 se data_servico ausente', async () => {
    const { status, body } = await post({
      token: FAKE_TOKEN,
      cliente_nome: 'Teste',
      tipo_servico: 'Guindaste',
    })
    expect([400, 404]).toContain(status)
  })

  it('404 se token inválido (todos os campos presentes)', async () => {
    const { status, body } = await post({
      token: FAKE_TOKEN,
      cliente_nome: 'Construtora Teste',
      tipo_servico: 'Guindaste',
      data_servico: '2026-06-01',
    })
    expect(status).toBe(404)
    expect(body.error).toBeDefined()
  })

  it('410 se token já utilizado (todos os campos presentes)', async () => {
    const { status, body } = await post({
      token: USED_TOKEN,
      cliente_nome: 'Construtora Teste',
      tipo_servico: 'Guindaste',
      data_servico: '2026-06-01',
    })
    expect(status).toBe(410)
    expect(body.usado).toBe(true)
  })

  it('resposta 200 tem estrutura correta (happy path — precisa de token fresco)', async () => {
    // Este teste só passa quando executado com um token válido não-usado.
    // Para gerar: envie qualquer mensagem via WhatsApp para o gestor cadastrado.
    // Pule com: FRESH_TOKEN=<token> npm test
    const freshToken = process.env.FRESH_TOKEN
    if (!freshToken) {
      console.warn('[SKIP] FRESH_TOKEN não definido — pule ou defina env var para testar happy path')
      return
    }
    const { status, body } = await post({
      token: freshToken,
      cliente_nome: 'Construtora Alfa Ltda',
      tipo_servico: 'Caminhão Munck',
      data_servico: '2026-06-10',
      horario_servico: '09:00',
      origem: 'São Paulo/SP',
      destino: 'Guarulhos/SP',
      responsavel_nome: 'Carlos Mendonça',
      motorista_nome: 'João Ferreira',
      veiculo_placa: 'BRZ-4721',
    })
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.id).toBeDefined()
    expect(body.numero_agendamento).toMatch(/^AG-\d+$/)
  })
})
