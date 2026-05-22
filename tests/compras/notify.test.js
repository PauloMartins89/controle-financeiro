/**
 * Testes — módulo notify-compras.js
 *
 * Unitários: fmtCurrency, templates MENSAGENS
 * Integração: POST /api/notify-compras (validações de entrada)
 */
import { describe, it, expect } from 'vitest'

// ─── Helpers copiados de api/notify-compras.js ───────────────────────────────

const APP_URL = 'https://smartpro.app.br'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const MENSAGENS = {
  nova_solicitacao: (sol) =>
    `🛒 *Nova Solicitação de Compra*\n\n` +
    `📋 *${sol.titulo}*\n` +
    (sol.descricao ? `"${sol.descricao}"\n\n` : '\n') +
    (sol.quantidade ? `📦 Qtd: ${sol.quantidade}\n` : '') +
    (sol.valor_estimado ? `💰 Valor estimado: ${fmtCurrency(sol.valor_estimado)}\n` : '') +
    (sol.fornecedor ? `🏪 Fornecedor: ${sol.fornecedor}\n` : '') +
    (sol.requisitante_nome ? `👤 Solicitante: ${sol.requisitante_nome}\n` : '') +
    `⚡ Urgência: ${{ baixa: 'Baixa', media: 'Média', alta: '🔴 ALTA' }[sol.urgencia] || sol.urgencia}\n\n` +
    `*Toque para aprovar/recusar (sem precisar de login):*\n` +
    `${APP_URL}/aprovar/${sol.token_aprovador}`,

  aprovado: (sol) =>
    `✅ *Compra Aprovada!*\n\n` +
    `📋 *${sol.titulo}*\n` +
    (sol.valor_aprovado ? `💰 Valor aprovado: ${fmtCurrency(sol.valor_aprovado)}\n` : '') +
    (sol.fornecedor_vencedor ? `🏪 Fornecedor: ${sol.fornecedor_vencedor}\n` : sol.fornecedor ? `🏪 Fornecedor: ${sol.fornecedor}\n` : '') +
    (sol.observacao_aprovador ? `📝 Observação: "${sol.observacao_aprovador}"\n` : '') +
    `\n👉 Realize a compra e confirme em: ${APP_URL}/compras`,

  recusado: (sol) =>
    `❌ *Compra Recusada*\n\n` +
    `📋 *${sol.titulo}*\n` +
    (sol.justificativa_recusa ? `📝 Motivo: "${sol.justificativa_recusa}"\n` : '') +
    `\nCaso necessário, crie uma nova solicitação com os ajustes: ${APP_URL}/compras`,

  leilao_aberto: (sol) =>
    `🏷 *Leilão de Preços Aberto!*\n\n` +
    `📋 *${sol.titulo}*\n` +
    (sol.quantidade ? `📦 Qtd: ${sol.quantidade}\n` : '') +
    (sol.prazo_cotacao ? `⏱ Prazo para cotar: ${new Date(sol.prazo_cotacao).toLocaleDateString('pt-BR')}\n` : '') +
    `\nFornecedores foram convidados a enviar cotações. Acompanhe em: ${APP_URL}/compras/aprovar`,

  compra_paga: (sol) =>
    `💰 *Compra Concluída e Paga!*\n\n` +
    `📋 *${sol.titulo}*\n` +
    (sol.valor_aprovado ? `💵 Valor pago: ${fmtCurrency(sol.valor_aprovado)}\n` : '') +
    (sol.fornecedor_vencedor || sol.fornecedor ? `🏪 Fornecedor: ${sol.fornecedor_vencedor || sol.fornecedor}\n` : '') +
    (sol.economia > 0 ? `💚 Economia: ${fmtCurrency(sol.economia)} abaixo do orçamento\n` : '') +
    `\nComprovante registrado em: ${APP_URL}/compras`,
}

// ─── fmtCurrency ─────────────────────────────────────────────────────────────

describe('fmtCurrency', () => {
  it('formata valor inteiro', () => {
    expect(fmtCurrency(1000)).toMatch(/1\.000/)
  })

  it('formata valor com centavos', () => {
    expect(fmtCurrency(1234.56)).toMatch(/1\.234/)
  })

  it('valor zero → R$ 0,00', () => {
    expect(fmtCurrency(0)).toMatch(/0,00/)
  })

  it('valor null → trata como 0', () => {
    expect(fmtCurrency(null)).toMatch(/0,00/)
  })

  it('inclui símbolo R$', () => {
    expect(fmtCurrency(100)).toMatch(/R\$/)
  })
})

// ─── MENSAGENS.nova_solicitacao ───────────────────────────────────────────────

describe('MENSAGENS.nova_solicitacao', () => {
  const base = {
    titulo: 'Compra de Pneus',
    urgencia: 'alta',
    token_aprovador: 'TOKEN-ABC-123',
  }

  it('contém emoji de carrinho', () => {
    expect(MENSAGENS.nova_solicitacao(base)).toContain('🛒')
  })

  it('contém título da solicitação', () => {
    expect(MENSAGENS.nova_solicitacao(base)).toContain('Compra de Pneus')
  })

  it('urgência alta exibe 🔴 ALTA', () => {
    expect(MENSAGENS.nova_solicitacao(base)).toContain('🔴 ALTA')
  })

  it('urgência baixa exibe "Baixa"', () => {
    const msg = MENSAGENS.nova_solicitacao({ ...base, urgencia: 'baixa' })
    expect(msg).toContain('Baixa')
  })

  it('urgência media exibe "Média"', () => {
    const msg = MENSAGENS.nova_solicitacao({ ...base, urgencia: 'media' })
    expect(msg).toContain('Média')
  })

  it('contém link de aprovação com token', () => {
    expect(MENSAGENS.nova_solicitacao(base)).toContain(`/aprovar/TOKEN-ABC-123`)
  })

  it('exibe valor estimado quando presente', () => {
    const msg = MENSAGENS.nova_solicitacao({ ...base, valor_estimado: 500 })
    expect(msg).toContain('Valor estimado')
    expect(msg).toMatch(/500/)
  })

  it('não exibe linha de valor quando ausente', () => {
    const msg = MENSAGENS.nova_solicitacao(base)
    expect(msg).not.toContain('Valor estimado')
  })

  it('exibe solicitante quando presente', () => {
    const msg = MENSAGENS.nova_solicitacao({ ...base, requisitante_nome: 'Maria Santos' })
    expect(msg).toContain('Maria Santos')
  })

  it('exibe descrição quando presente', () => {
    const msg = MENSAGENS.nova_solicitacao({ ...base, descricao: 'Pneus 205/65' })
    expect(msg).toContain('Pneus 205/65')
  })
})

// ─── MENSAGENS.aprovado ───────────────────────────────────────────────────────

describe('MENSAGENS.aprovado', () => {
  it('contém ✅', () => {
    expect(MENSAGENS.aprovado({ titulo: 'Teste' })).toContain('✅')
  })

  it('exibe fornecedor_vencedor quando presente', () => {
    const msg = MENSAGENS.aprovado({ titulo: 'T', fornecedor_vencedor: 'Fornecedor A' })
    expect(msg).toContain('Fornecedor A')
  })

  it('usa fornecedor como fallback quando fornecedor_vencedor ausente', () => {
    const msg = MENSAGENS.aprovado({ titulo: 'T', fornecedor: 'Fornecedor B' })
    expect(msg).toContain('Fornecedor B')
  })

  it('exibe observação quando presente', () => {
    const msg = MENSAGENS.aprovado({ titulo: 'T', observacao_aprovador: 'Ok, comprar.' })
    expect(msg).toContain('Ok, comprar.')
  })

  it('contém link /compras', () => {
    expect(MENSAGENS.aprovado({ titulo: 'T' })).toContain('/compras')
  })
})

// ─── MENSAGENS.recusado ───────────────────────────────────────────────────────

describe('MENSAGENS.recusado', () => {
  it('contém ❌', () => {
    expect(MENSAGENS.recusado({ titulo: 'Teste' })).toContain('❌')
  })

  it('exibe justificativa quando presente', () => {
    const msg = MENSAGENS.recusado({ titulo: 'T', justificativa_recusa: 'Sem orçamento' })
    expect(msg).toContain('Sem orçamento')
  })

  it('não exibe linha de motivo quando ausente', () => {
    const msg = MENSAGENS.recusado({ titulo: 'T' })
    expect(msg).not.toContain('Motivo')
  })
})

// ─── MENSAGENS.compra_paga ────────────────────────────────────────────────────

describe('MENSAGENS.compra_paga', () => {
  it('contém 💰', () => {
    expect(MENSAGENS.compra_paga({ titulo: 'Teste' })).toContain('💰')
  })

  it('exibe economia quando > 0', () => {
    const msg = MENSAGENS.compra_paga({ titulo: 'T', economia: 200 })
    expect(msg).toContain('Economia')
    expect(msg).toContain('💚')
  })

  it('não exibe economia quando = 0', () => {
    const msg = MENSAGENS.compra_paga({ titulo: 'T', economia: 0 })
    expect(msg).not.toContain('Economia')
  })

  it('não exibe economia quando negativa', () => {
    const msg = MENSAGENS.compra_paga({ titulo: 'T', economia: -50 })
    expect(msg).not.toContain('Economia')
  })
})

// ─── Integração: POST /api/notify-compras ────────────────────────────────────

const BASE_API = 'https://smartpro.app.br'

async function post(payload) {
  const res = await fetch(`${BASE_API}/api/notify-compras`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let body
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body }
}

describe('POST /api/notify-compras — validações', () => {
  it('405 para GET', async () => {
    const res = await fetch(`${BASE_API}/api/notify-compras`)
    expect(res.status).toBe(405)
  })

  it('400 sem body', async () => {
    const { status, body } = await post({})
    expect(status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('400 sem solicitacaoId', async () => {
    const { status, body } = await post({ evento: 'nova_solicitacao' })
    expect(status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('404 solicitacaoId fake sem evento — lookup falha antes de validar evento', async () => {
    // API valida presença do solicitacaoId antes do evento;
    // com ID inválido vai ao DB → 404
    const { status, body } = await post({ solicitacaoId: 'id-inexistente' })
    expect(status).toBe(404)
    expect(body.error).toBeDefined()
  })

  it('404 evento inválido com solicitacaoId fake — DB falha primeiro', async () => {
    const { status, body } = await post({ solicitacaoId: 'id-inexistente', evento: 'evento_invalido' })
    expect(status).toBe(404)
    expect(body.error).toBeDefined()
  })
})
