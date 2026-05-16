/**
 * POST /api/notify
 *
 * Envia notificação WhatsApp para o motorista quando o gestor
 * aprova, devolve ou reprova um lançamento no Faturamento.
 *
 * Body: {
 *   lancamentoId : string (uuid)
 *   status       : 'aprovado' | 'devolvido' | 'reprovado'
 *   motivo?      : string   (obrigatório em 'devolvido'/'reprovado')
 *   gestorNome?  : string
 * }
 *
 * Fluxo:
 *  1. Busca o lançamento pelo ID
 *  2. Extrai o nome do condutor de dados_extras.condutor
 *  3. Busca o telefone em whatsapp_config WHERE nome_motorista ILIKE condutor
 *  4. Monta a mensagem conforme o status
 *  5. Envia via Z-API
 *  6. Registra em mensagens_whatsapp (direção: saida)
 */

import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  )
}

async function sendWA(to, text) {
  const res = await fetch(
    `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
      },
      body: JSON.stringify({ phone: to, message: text }),
    }
  )
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    console.error(`[notify] sendWA falhou ${res.status} para ${to}:`, err)
    return false
  }
  return true
}

function fmtDate(d) {
  if (!d) return ''
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function buildMessage(status, dados, motivo, gestorNome) {
  const num  = dados.numero_diario ? `Nº *${dados.numero_diario}*` : 'seu diário'
  const data = dados.data ? ` de ${fmtDate(dados.data)}` : ''
  const valor = dados.valor
    ? `\nValor: *R$ ${Number(dados.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*`
    : ''
  const assinatura = gestorNome ? `\n— _${gestorNome}_` : ''

  if (status === 'aprovado') {
    return (
      `✅ *Diário Aprovado!*\n\n` +
      `${num}${data} foi *aprovado*.\n` +
      `${valor}\n\n` +
      `Tudo certo! Em breve o pagamento será processado.` +
      assinatura
    )
  }

  if (status === 'devolvido') {
    return (
      `⚠️ *Diário Devolvido para Correção*\n\n` +
      `${num}${data} foi devolvido.\n\n` +
      `📝 *Motivo:* ${motivo || 'Sem motivo informado.'}\n\n` +
      `Por favor, faça a correção e reenvie o diário.` +
      assinatura
    )
  }

  if (status === 'reprovado') {
    return (
      `❌ *Diário Reprovado*\n\n` +
      `${num}${data} foi *reprovado*.\n\n` +
      `📝 *Motivo:* ${motivo || 'Sem motivo informado.'}\n\n` +
      `Entre em contato com o gestor para mais informações.` +
      assinatura
    )
  }

  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { lancamentoId, status, motivo, gestorNome } = req.body || {}

  if (!lancamentoId || !status) {
    return res.status(400).json({ error: 'lancamentoId e status são obrigatórios' })
  }

  const NOTIFICAVEIS = ['aprovado', 'devolvido', 'reprovado']
  if (!NOTIFICAVEIS.includes(status)) {
    // Status sem notificação (ex: faturado, cancelado) — retorna ok silencioso
    return res.status(200).json({ sent: false, reason: 'status não notificável' })
  }

  const db = getDb()

  // 1. Busca o lançamento
  const { data: lancamento, error: errLanc } = await db
    .from('lancamentos')
    .select('id, data, valor, dados_extras, workspace_id')
    .eq('id', lancamentoId)
    .single()

  if (errLanc || !lancamento) {
    console.error('[notify] lancamento não encontrado:', errLanc)
    return res.status(404).json({ error: 'Lançamento não encontrado' })
  }

  const dados = lancamento.dados_extras || {}
  const condutor = (dados.condutor || '').trim()

  if (!condutor) {
    return res.status(200).json({ sent: false, reason: 'sem condutor no lançamento' })
  }

  // 2. Busca telefone em whatsapp_config (match case-insensitive + parcial)
  const { data: configs } = await db
    .from('whatsapp_config')
    .select('phone_number, nome_motorista, ativo')
    .eq('workspace_id', lancamento.workspace_id)
    .eq('ativo', true)

  if (!configs || configs.length === 0) {
    return res.status(200).json({ sent: false, reason: 'nenhum motorista cadastrado no whatsapp_config' })
  }

  // Match: nome_motorista contém partes do condutor ou vice-versa
  const condutorLower = condutor.toLowerCase()
  const match = configs.find(c => {
    const nome = c.nome_motorista?.toLowerCase() || ''
    return nome === condutorLower ||
           nome.includes(condutorLower) ||
           condutorLower.includes(nome)
  })

  if (!match) {
    console.warn(`[notify] condutor "${condutor}" não encontrado em whatsapp_config`)
    return res.status(200).json({ sent: false, reason: `condutor "${condutor}" não tem telefone cadastrado` })
  }

  // 3. Monta e envia a mensagem
  const dadosMsg = { ...dados, data: lancamento.data, valor: lancamento.valor }
  const texto = buildMessage(status, dadosMsg, motivo, gestorNome)

  if (!texto) {
    return res.status(200).json({ sent: false, reason: 'mensagem não montada' })
  }

  const enviado = await sendWA(match.phone_number, texto)

  // 4. Registra saída no log de mensagens
  db.from('mensagens_whatsapp').insert({
    workspace_id: lancamento.workspace_id,
    telefone:     match.phone_number,
    direcao:      enviado ? 'saida' : 'saida_erro',
    conteudo:     texto,
  }).then(() => {}).catch(() => {})

  return res.status(200).json({
    sent:  enviado,
    phone: match.phone_number,
    nome:  match.nome_motorista,
  })
}
