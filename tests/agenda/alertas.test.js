/**
 * Testes de integração — agendamento_alertas helpers
 * Testa as funções utilitárias exportadas/copiadas do módulo de alertas
 * sem depender de rede ou banco de dados.
 */
import { describe, it, expect } from 'vitest'

// ─── Helpers de formatação de mensagem (copiados de agenda-alertas.js) ────────

function normalizarTelefone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (!digits || digits.length < 8) return null
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return '55' + digits
  if (digits.length === 13 && digits.startsWith('55')) return digits
  return '55' + digits
}

function telefoneValido(n) {
  if (!n) return false
  return /^55\d{10,11}$/.test(n)
}

function fmtHorario(timeStr) {
  if (!timeStr) return null
  return String(timeStr).slice(0, 5) // "HH:MM:SS" → "HH:MM"
}

function calcularHorarioAlerta(dataServico, horarioServico, antecedenciaMin) {
  const baseIso = horarioServico
    ? `${dataServico}T${horarioServico}:00`
    : `${dataServico}T08:00:00`
  const base = new Date(baseIso)
  return new Date(base.getTime() - antecedenciaMin * 60 * 1000)
}

// ─── fmtHorario ───────────────────────────────────────────────────────────────
describe('fmtHorario', () => {
  it('retorna HH:MM de "HH:MM:SS"', () => {
    expect(fmtHorario('08:30:00')).toBe('08:30')
  })

  it('já no formato HH:MM passa intacto', () => {
    expect(fmtHorario('14:00')).toBe('14:00')
  })

  it('retorna null para valor falsy', () => {
    expect(fmtHorario(null)).toBeNull()
    expect(fmtHorario('')).toBeNull()
  })
})

// ─── calcularHorarioAlerta ────────────────────────────────────────────────────
describe('calcularHorarioAlerta', () => {
  it('3 horas antes de 08:30 = 05:30', () => {
    const result = calcularHorarioAlerta('2026-05-28', '08:30', 180)
    expect(result.getHours()).toBe(5)
    expect(result.getMinutes()).toBe(30)
  })

  it('antecedência 0 = mesmo horário do serviço', () => {
    const result = calcularHorarioAlerta('2026-05-28', '10:00', 0)
    expect(result.getHours()).toBe(10)
    expect(result.getMinutes()).toBe(0)
  })

  it('sem horário usa 08:00 como base', () => {
    const result = calcularHorarioAlerta('2026-05-28', null, 60)
    expect(result.getHours()).toBe(7)
    expect(result.getMinutes()).toBe(0)
  })

  it('alerta no dia anterior se antecedência > horas do dia', () => {
    const result = calcularHorarioAlerta('2026-05-28', '07:00', 480) // 8h antes = 23h do dia anterior
    expect(result.getDate()).toBe(27)
    expect(result.getHours()).toBe(23)
  })
})

// ─── validação de regras de alerta ───────────────────────────────────────────

function regraAplicavel(regra, tipoServico) {
  // regra.tipo_servico === null → aplica a todos
  if (!regra.tipo_servico) return true
  return regra.tipo_servico === tipoServico
}

describe('regraAplicavel', () => {
  const regraGeral  = { tipo_servico: null, ativo: true }
  const regraPrancha = { tipo_servico: 'Caminhão Prancha', ativo: true }

  it('regra geral aplica a qualquer serviço', () => {
    expect(regraAplicavel(regraGeral, 'Guindaste')).toBe(true)
    expect(regraAplicavel(regraGeral, 'Caminhão Munck')).toBe(true)
  })

  it('regra específica só aplica ao tipo correto', () => {
    expect(regraAplicavel(regraPrancha, 'Caminhão Prancha')).toBe(true)
    expect(regraAplicavel(regraPrancha, 'Guindaste')).toBe(false)
  })

  it('regra específica não aplica a tipo diferente', () => {
    expect(regraAplicavel(regraPrancha, null)).toBe(false)
    expect(regraAplicavel(regraPrancha, '')).toBe(false)
  })
})

// ─── montarMensagemAlerta (estrutura mínima) ──────────────────────────────────

function montarMensagemAlerta({ tipo_servico, cliente_nome, data_servico, horario_servico, origem, destino, responsavel_nome }) {
  const linhas = [
    `🔔 *Lembrete de Serviço Agendado*`,
    ``,
    `🔧 *${tipo_servico}*`,
    `👤 Cliente: ${cliente_nome}`,
    data_servico  ? `📅 Data: ${data_servico.split('-').reverse().join('/')}` : null,
    horario_servico ? `⏰ Horário: ${horario_servico}` : null,
    origem        ? `📍 Saída: ${origem}` : null,
    destino       ? `🏁 Destino: ${destino}` : null,
    responsavel_nome ? `👷 Responsável: ${responsavel_nome}` : null,
  ].filter(Boolean)
  return linhas.join('\n')
}

describe('montarMensagemAlerta', () => {
  const base = {
    tipo_servico: 'Guindaste',
    cliente_nome: 'Construtora Alfa',
    data_servico: '2026-05-28',
    horario_servico: '08:30',
    origem: 'SP',
    destino: 'Guarulhos',
    responsavel_nome: 'Carlos',
  }

  it('contém todos os campos quando preenchidos', () => {
    const msg = montarMensagemAlerta(base)
    expect(msg).toContain('Guindaste')
    expect(msg).toContain('Construtora Alfa')
    expect(msg).toContain('28/05/2026')
    expect(msg).toContain('08:30')
    expect(msg).toContain('SP')
    expect(msg).toContain('Guarulhos')
    expect(msg).toContain('Carlos')
  })

  it('omite campos nulos/undefined', () => {
    const msg = montarMensagemAlerta({ ...base, origem: null, destino: undefined, responsavel_nome: null })
    expect(msg).not.toContain('Saída')
    expect(msg).not.toContain('Destino')
    expect(msg).not.toContain('Responsável')
  })

  it('começa com emoji de lembrete', () => {
    const msg = montarMensagemAlerta(base)
    expect(msg.startsWith('🔔')).toBe(true)
  })
})
