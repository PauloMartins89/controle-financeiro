/**
 * Testes — src/lib/workspaceConfig.js
 *
 * Foco: o CONTRATO DE ISOLAMENTO.
 *  - config ausente / parcial → fallback legado (nunca quebra, nunca vaza)
 *  - getFlag só é true quando === true
 *  - loadWorkspaceConfig sem supabase/workspaceId → {} (comportamento de hoje)
 */
import { describe, it, expect } from 'vitest'
import { getConfig, getFlag, loadWorkspaceConfig } from '../../src/lib/workspaceConfig.js'

describe('getConfig — leitura com fallback legado', () => {
  const cfg = {
    landing: '/lancamentos',
    labels: { motorista: 'Motorista', cliente: 'Fazenda' },
    features: { nova_feature_a: true, desligada: false },
  }

  it('lê valor de topo', () => {
    expect(getConfig(cfg, 'landing')).toBe('/lancamentos')
  })

  it('lê caminho aninhado "a.b"', () => {
    expect(getConfig(cfg, 'labels.motorista')).toBe('Motorista')
    expect(getConfig(cfg, 'labels.cliente')).toBe('Fazenda')
  })

  it('retorna fallback quando o caminho NÃO existe (cliente B sem a chave)', () => {
    expect(getConfig(cfg, 'labels.inexistente', 'Padrão')).toBe('Padrão')
    expect(getConfig(cfg, 'caminho.que.nao.existe', 'legado')).toBe('legado')
  })

  it('config vazio → sempre fallback (comportamento de hoje)', () => {
    expect(getConfig({}, 'labels.motorista', 'Motorista')).toBe('Motorista')
    expect(getConfig(undefined, 'qualquer', 'legado')).toBe('legado')
    expect(getConfig(null, 'qualquer', 'legado')).toBe('legado')
  })

  it('não confunde valor false com ausência', () => {
    expect(getConfig(cfg, 'features.desligada', 'fallback')).toBe(false)
  })

  it('fallback é undefined quando não informado', () => {
    expect(getConfig(cfg, 'nao.existe')).toBeUndefined()
  })
})

describe('getFlag — feature-flag booleana', () => {
  const cfg = { features: { liga: true, desliga: false, texto: 'true' } }

  it('true somente quando === true', () => {
    expect(getFlag(cfg, 'features.liga')).toBe(true)
  })

  it('false quando explicitamente false', () => {
    expect(getFlag(cfg, 'features.desliga')).toBe(false)
  })

  it('flag ausente → false (cliente sem a flag mantém comportamento legado)', () => {
    expect(getFlag(cfg, 'features.inexistente')).toBe(false)
    expect(getFlag({}, 'features.x')).toBe(false)
    expect(getFlag(undefined, 'features.x')).toBe(false)
  })

  it('string "true" NÃO é tratada como flag ativa (evita ativação acidental)', () => {
    expect(getFlag(cfg, 'features.texto')).toBe(false)
  })
})

describe('loadWorkspaceConfig — fallback de segurança', () => {
  it('sem workspaceId → {} (legado), nunca lança', async () => {
    await expect(loadWorkspaceConfig(null)).resolves.toEqual({})
    await expect(loadWorkspaceConfig(undefined)).resolves.toEqual({})
  })

  it('sem supabase configurado (env de teste) → {} (legado)', async () => {
    // No ambiente de teste não há VITE_SUPABASE_*, então supabase === null.
    // O isolamento exige que isso NUNCA quebre — apenas cai no comportamento de hoje.
    const cfg = await loadWorkspaceConfig('00000000-0000-0000-0000-000000000000')
    expect(cfg).toEqual({})
  })
})
