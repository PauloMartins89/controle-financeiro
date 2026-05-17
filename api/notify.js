/**
 * POST /api/notify
 *
 * Envia notificações WhatsApp para todas as pessoas configuradas
 * para receber mensagem quando um lançamento entrar em determinado status.
 *
 * Body: {
 *   lancamentoId : string (uuid)
 *   status       : string  — status que foi aplicado (ex: 'aprovado', 'devolvido', ...)
 *   motivo?      : string  — motivo (devolvido / reprovado)
 *   gestorNome?  : string  — nome de quem executou a ação
 * }
 *
 * Fluxo:
 *  1. Busca o lançamento pelo ID
 *  2. Busca todos os destinatários em status_notificacoes WHERE status = :status AND ativo = true
 *  3. Para cada destinatário monta a mensagem e envia via Z-API
 *  4. Registra cada envio em mensagens_whatsapp
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

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

export default async function handler(req, res) {
  // GET ?lancamentoId=xxx&status=faturado  → diagnóstico sem envio
  if (req.method === 'GET') {
    const { lancamentoId, status } = req.query || {}
    if (!lancamentoId || !status) {
      return res.status(400).json({ error: 'lancamentoId e status são obrigatórios' })
    }
    const db = getDb()
    const { data: lanc, error: errL } = await db.from('lancamentos').select('id, workspace_id, status').eq('id', lancamentoId).single()
    if (errL || !lanc) return res.status(404).json({ error: 'Lançamento não encontrado', detail: errL?.message })
    const { data: dests, error: errD } = await db.from('status_notificacoes').select('*').eq('workspace_id', lanc.workspace_id).eq('status', status).eq('ativo', true)
    const { data: allNotif, error: errAll } = await db.from('status_notificacoes').select('*').eq('workspace_id', lanc.workspace_id)
    return res.status(200).json({ lancamento_workspace_id: lanc.workspace_id, lancamento_status_atual: lanc.status, destinatarios_para_status: dests, errD: errD?.message, todos_para_workspace: allNotif, errAll: errAll?.message })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { lancamentoId, loteId, status, motivo, gestorNome } = req.body || {}

  if ((!lancamentoId && !loteId) || !status) {
    return res.status(400).json({ error: 'lancamentoId ou loteId, e status são obrigatórios' })
  }

  const db = getDb()

  // ── Caminho LOTE: 1 mensagem resumida para o lote inteiro ──────────────────
  if (loteId) {
    const { data: lote, error: errLote } = await db
      .from('lotes_cliente')
      .select('id, cliente, workspace_id')
      .eq('id', loteId)
      .single()

    if (errLote || !lote) {
      console.error('[notify] lote não encontrado:', errLote)
      return res.status(404).json({ error: 'Lote não encontrado' })
    }

    const { data: itens } = await db
      .from('lancamentos')
      .select('id, valor')
      .eq('lote_cliente_id', loteId)

    const totalItens = itens?.length || 0
    const totalValor = (itens || []).reduce((s, l) => s + (Number(l.valor) || 0), 0)

    const { data: destinatarios, error: errDest } = await db
      .from('status_notificacoes')
      .select('id, nome_destinatario, phone_number')
      .eq('workspace_id', lote.workspace_id)
      .eq('status', status)
      .eq('ativo', true)

    console.log(`[notify-lote] lote=${loteId} workspace=${lote.workspace_id} status=${status} destinatários=${destinatarios?.length ?? 'ERR'}`)

    if (errDest || !destinatarios || destinatarios.length === 0) {
      return res.status(200).json({ sent: 0, reason: `Nenhum destinatário configurado para status "${status}"` })
    }

    const texto = buildLoteMessage(status, lote.cliente, totalItens, totalValor, gestorNome || null)

    const resultados = await Promise.all(
      destinatarios.map(async dest => {
        const enviado = await sendWA(dest.phone_number, texto)
        db.from('mensagens_whatsapp').insert({
          telefone: dest.phone_number,
          direcao:  enviado ? 'saida' : 'saida_erro',
          conteudo: texto,
        }).then(() => {}).catch(() => {})
        return { nome: dest.nome_destinatario, phone: dest.phone_number, enviado }
      })
    )

    const totalEnviado = resultados.filter(r => r.enviado).length
    return res.status(200).json({ sent: totalEnviado, total: resultados.length, resultados })
  }

  // ── Caminho ITEM: mensagem individual por lançamento ──────────────────────
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

  // 2. Busca destinatários configurados para este status
  const { data: destinatarios, error: errDest } = await db
    .from('status_notificacoes')
    .select('id, nome_destinatario, phone_number')
    .eq('workspace_id', lancamento.workspace_id)
    .eq('status', status)
    .eq('ativo', true)

  console.log(`[notify] workspace=${lancamento.workspace_id} status=${status} destinatários=${destinatarios?.length ?? 'ERR'} errDest=${errDest?.message || 'none'}`)

  if (errDest) {
    console.error('[notify] erro ao buscar destinatários:', errDest)
    return res.status(500).json({ error: 'Erro ao buscar destinatários', detail: errDest.message })
  }

  if (!destinatarios || destinatarios.length === 0) {
    return res.status(200).json({ sent: 0, reason: `Nenhum destinatário configurado para status "${status}"` })
  }

  // 3. Monta a mensagem (igual para todos os destinatários deste status)
  const dados = {
    ...(lancamento.dados_extras || {}),
    data:  lancamento.data,
    valor: lancamento.valor,
  }
  const texto = buildMessage(status, dados, motivo || null, gestorNome || null)

  // 4. Envia para cada destinatário
  const resultados = await Promise.all(
    destinatarios.map(async dest => {
      const enviado = await sendWA(dest.phone_number, texto)
      // Registra no log
      db.from('mensagens_whatsapp').insert({
        telefone: dest.phone_number,
        direcao:  enviado ? 'saida' : 'saida_erro',
        conteudo: texto,
      }).then(() => {}).catch(() => {})
      return { nome: dest.nome_destinatario, phone: dest.phone_number, enviado }
    })
  )

  const totalEnviado = resultados.filter(r => r.enviado).length
  return res.status(200).json({ sent: totalEnviado, total: resultados.length, resultados })
}
