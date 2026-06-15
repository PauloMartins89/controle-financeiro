/**
 * POST /api/notify-compras
 *
 * Envia notificação WhatsApp para o ator certo quando o status
 * de uma solicitação de compra muda.
 *
 * Body: {
 *   solicitacaoId : string (uuid)
 *   evento        : 'nova_solicitacao' | 'aprovado' | 'recusado' | 'leilao_aberto' | 'compra_paga'
 *   destinos?     : string[]   -- telefones extras opcionais (sobrepõe config)
 * }
 *
 * O telefone do aprovador é lido automaticamente de:
 *   configuracoes WHERE chave = 'aprovador_compras_telefone' (do workspace da solicitação)
 */

import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  )
}

async function sendWA(to, text) {
  const phone = to.replace(/\D/g, '')
  if (!phone) return false
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
        },
        body: JSON.stringify({ phone, message: text }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

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
    `� *Toque para aprovar/recusar (sem precisar de login):*\n` +
    `https://smartpro.app.br/aprovar/${sol.token_aprovador}`,

  aprovado: (sol) =>
    `✅ *Compra Aprovada!*\n\n` +
    `📋 *${sol.titulo}*\n` +
    (sol.valor_aprovado ? `💰 Valor aprovado: ${fmtCurrency(sol.valor_aprovado)}\n` : '') +
    (sol.fornecedor_vencedor ? `🏪 Fornecedor: ${sol.fornecedor_vencedor}\n` : sol.fornecedor ? `🏪 Fornecedor: ${sol.fornecedor}\n` : '') +
    (sol.observacao_aprovador ? `📝 Observação: "${sol.observacao_aprovador}"\n` : '') +
    `\n👉 Realize a compra e confirme em: https://smartpro.app.br/compras`,

  recusado: (sol) =>
    `❌ *Compra Recusada*\n\n` +
    `📋 *${sol.titulo}*\n` +
    (sol.justificativa_recusa ? `📝 Motivo: "${sol.justificativa_recusa}"\n` : '') +
    `\nCaso necessário, crie uma nova solicitação com os ajustes: https://smartpro.app.br/compras`,

  leilao_aberto: (sol) =>
    `🏷 *Leilão de Preços Aberto!*\n\n` +
    `📋 *${sol.titulo}*\n` +
    (sol.quantidade ? `📦 Qtd: ${sol.quantidade}\n` : '') +
    (sol.prazo_cotacao ? `⏱ Prazo para cotar: ${new Date(sol.prazo_cotacao).toLocaleDateString('pt-BR')}\n` : '') +
    `\nFornecedores foram convidados a enviar cotações. Acompanhe em: https://smartpro.app.br/compras/aprovar`,

  leilao_encerrado: (sol) => {
    const vencedor = sol.fornecedor_vencedor || sol.fornecedor || '—'
    const valor = sol.valor_aprovado || sol.valor_vencedor || sol.melhor_preco || null
    return (
      `🏁 *Leilão Encerrado*\n\n` +
      `📋 *${sol.titulo}*\n` +
      (valor ? `💰 Melhor preço: ${fmtCurrency(valor)}\n` : '') +
      (vencedor ? `🏪 Fornecedor: ${vencedor}\n` : '') +
      (sol.economia ? `💚 Economia estimada: ${fmtCurrency(sol.economia)}\n` : '') +
      `\nAtualize a seleção em: https://smartpro.app.br/compras/aprovar`
    )
  },

  compra_paga: (sol) =>
    `💰 *Compra Concluída e Paga!*\n\n` +
    `📋 *${sol.titulo}*\n` +
    (sol.valor_aprovado ? `💵 Valor pago: ${fmtCurrency(sol.valor_aprovado)}\n` : '') +
    (sol.fornecedor_vencedor || sol.fornecedor ? `🏪 Fornecedor: ${sol.fornecedor_vencedor || sol.fornecedor}\n` : '') +
    (sol.economia > 0 ? `💚 Economia: ${fmtCurrency(sol.economia)} abaixo do orçamento\n` : '') +
    `\nComprovante registrado em: https://smartpro.app.br/compras`,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { solicitacaoId, evento, destinos, telefone: telTeste } = req.body || {}

  if (!solicitacaoId && evento !== '_teste') {
    return res.status(400).json({ error: 'solicitacaoId e evento são obrigatórios' })
  }

  // Evento de teste direto — envia mensagem de verificação sem solicitação
  if (evento === '_teste') {
    const tel = (telTeste || '').replace(/\D/g, '')
    if (!tel) return res.status(400).json({ error: 'telefone obrigatório para teste' })
    const ok = await sendWA(tel,
      `✅ *Teste — Notificações de Compras*\n\nEste número está configurado como aprovador de compras no DividiAí.\n\nVocê receberá avisos automáticos a cada nova solicitação. 🛒`
    )
    return res.status(200).json({ ok, sent: ok ? 1 : 0 })
  }

  if (!evento) {
    return res.status(400).json({ error: 'evento é obrigatório' })
  }

  if (!MENSAGENS[evento]) {
    return res.status(400).json({ error: `Evento desconhecido: ${evento}` })
  }

  const db = getDb()

  // Busca a solicitação
  const { data: sol, error: solErr } = await db
    .from('solicitacoes_compra')
    .select('*')
    .eq('id', solicitacaoId)
    .single()

  if (solErr || !sol) {
    return res.status(404).json({ error: 'Solicitação não encontrada' })
  }

  const mensagem = MENSAGENS[evento](sol)
  const resultados = []

  // Coleta destinatários
  const telefones = new Set()

  // 1. Telefone do aprovador salvo nas configurações do workspace (lê automaticamente)
  if (['nova_solicitacao', 'leilao_encerrado'].includes(evento) && sol.workspace_id) {
    let cfgValor = null
    const cfgComWorkspace = await db
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'aprovador_compras_telefone')
      .eq('workspace_id', sol.workspace_id)
      .limit(1)

    if (!cfgComWorkspace.error) {
      cfgValor = cfgComWorkspace.data?.[0]?.valor || null
    }

    if (!cfgValor) {
      const { data: cfgFallback } = await db
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'aprovador_compras_telefone')
        .limit(1)
      cfgValor = cfgFallback?.[0]?.valor || null
    }

    if (cfgValor) {
      const tel = String(cfgValor).replace(/\"/g, '').replace(/\D/g, '')
      if (tel) telefones.add(tel)
    }
  }

  // 2. Destinos extras passados pelo chamador (override / adicional)
  if (Array.isArray(destinos)) {
    destinos.filter(Boolean).forEach(t => telefones.add(t.replace(/\D/g, '')))
  }

  // 3. Telefone do requisitante (quem pediu a compra)
  if (sol.requisitante_telefone && ['aprovado', 'recusado', 'leilao_aberto', 'leilao_encerrado', 'compra_paga'].includes(evento)) {
    telefones.add(sol.requisitante_telefone.replace(/\D/g, ''))
  }

  if (telefones.size === 0) {
    return res.status(200).json({ ok: true, sent: 0, message: 'Nenhum destinatário configurado' })
  }

  // Envia para cada destinatário
  for (const tel of telefones) {
    const ok = await sendWA(tel, mensagem)
    resultados.push({ tel, ok })

    // Registra log em mensagens_whatsapp (se tabela existir)
    try {
      await db.from('mensagens_whatsapp').insert({
        telefone: tel,
        mensagem: mensagem,
        status: ok ? 'enviado' : 'erro',
        modulo: 'compras',
        referencia_id: solicitacaoId,
      })
    } catch {
      // Tabela pode não existir — ignora silenciosamente
    }
  }

  const enviados = resultados.filter(r => r.ok).length
  return res.status(200).json({ ok: true, sent: enviados, total: resultados.length, resultados })
}
