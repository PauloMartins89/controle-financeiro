import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  )
}

async function sendWA(to, text) {
  const phone = String(to || '').replace(/\D/g, '')
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

function norm(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { cotacaoId } = req.body || {}
  if (!cotacaoId) {
    return res.status(400).json({ ok: false, error: 'cotacaoId obrigatorio' })
  }

  const db = getDb()

  const { data: cot, error: cotErr } = await db
    .from('cotacoes_compra')
    .select('id, solicitacao_id, fornecedor_nome, fornecedor_telefone, token_acesso, status')
    .eq('id', cotacaoId)
    .single()

  if (cotErr || !cot) {
    return res.status(404).json({ ok: false, error: 'Cotacao nao encontrada' })
  }

  let tokenAcesso = cot.token_acesso || null
  if (!tokenAcesso) {
    tokenAcesso = crypto.randomUUID()
    const { error: tokenErr } = await db
      .from('cotacoes_compra')
      .update({ token_acesso: tokenAcesso })
      .eq('id', cot.id)

    if (tokenErr) {
      return res.status(400).json({ ok: false, error: 'Cotacao sem token de acesso' })
    }
  }

  const { data: sol } = await db
    .from('solicitacoes_compra')
    .select('id, workspace_id, titulo, descricao, quantidade, prazo_cotacao')
    .eq('id', cot.solicitacao_id)
    .single()

  let telefoneFornecedor = cot.fornecedor_telefone || null
  if (!telefoneFornecedor && sol?.workspace_id && cot?.fornecedor_nome) {
    const { data: fornecedoresAtivos } = await db
      .from('fornecedores_compra')
      .select('id, nome, telefone')
      .eq('workspace_id', sol.workspace_id)
      .eq('ativo', true)
      .order('nome', { ascending: true })

    const nomeCotacao = norm(cot.fornecedor_nome)
    const fornecedorMatch = (fornecedoresAtivos || []).find(f => norm(f.nome) === nomeCotacao)
      || (fornecedoresAtivos || []).find(f => norm(f.nome).includes(nomeCotacao) || nomeCotacao.includes(norm(f.nome)))

    if (fornecedorMatch?.telefone) {
      telefoneFornecedor = fornecedorMatch.telefone
      await db
        .from('cotacoes_compra')
        .update({ fornecedor_telefone: telefoneFornecedor })
        .eq('id', cot.id)
    }
  }

  if (!telefoneFornecedor) {
    return res.status(400).json({ ok: false, error: 'Fornecedor sem WhatsApp/telefone no cadastro' })
  }

  const appUrl = (process.env.APP_URL || 'https://smartpro.app.br').replace(/\/$/, '')
  const link = `${appUrl}/cotacao/${tokenAcesso}`

  const msg =
    `Ola ${cot.fornecedor_nome || 'fornecedor'}!\n\n` +
    `Voce foi convidado para enviar cotacao de compra.\n` +
    (sol?.titulo ? `Item: *${sol.titulo}*\n` : '') +
    (sol?.quantidade ? `Quantidade: ${sol.quantidade}\n` : '') +
    (sol?.prazo_cotacao ? `Prazo: ${new Date(sol.prazo_cotacao).toLocaleDateString('pt-BR')}\n` : '') +
    `\nLink para cotar:\n${link}`

  const ok = await sendWA(telefoneFornecedor, msg)

  if (!ok) {
    return res.status(502).json({ ok: false, error: 'Falha no envio via Z-API' })
  }

  try {
    await db.from('mensagens_whatsapp').insert({
      telefone: String(telefoneFornecedor).replace(/\D/g, ''),
      mensagem: msg,
      status: 'enviado',
      modulo: 'compras',
      referencia_id: cot.solicitacao_id,
    })
  } catch {
    // tabela pode nao existir neste ambiente
  }

  return res.status(200).json({ ok: true, sent: 1, link })
}
