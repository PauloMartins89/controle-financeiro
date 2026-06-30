// api/_chamados-engine.js
// Motor principal do módulo de Chamados por WhatsApp.
//
// Fluxo:
//  1. Recebe mensagem de grupo Z-API
//  2. Verifica se grupo está monitorado e ativo
//  3. Salva mensagem na tabela mensagens_whatsapp_grupos
//  4. Evita duplicidade por zapi_message_id
//  5. Agrupa mensagens do mesmo remetente nos últimos 5 min
//  6. Chama IA para classificar
//  7. Registra log da IA
//  8. Cria solicitação ou pré-solicitação conforme confiança
//  9. Notifica técnico se chamado confirmado (confiança ≥ 0.85)

import { createClient }     from '@supabase/supabase-js'
import ws                   from 'ws'
import { classificarChamado } from './_chamados-ia.js'
import { notificarTecnico }   from './_chamados-notificar.js'

const supabaseUrl        = process.env.SUPABASE_URL       || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

// Thresholds de confiança
const CONF_CHAMADO  = 0.85  // ≥ 85%: abre chamado automaticamente
const CONF_TRIAGEM  = 0.65  // ≥ 65%: cria pré-solicitação para triagem

// Janela de contexto: mensagens do mesmo remetente nos últimos N minutos
const JANELA_MIN = 5

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey, {
    realtime: { params: { log_level: 'disabled' }, transport: ws },
    global: {},
  })
}

/**
 * Processa uma mensagem de grupo recebida pela Z-API.
 * Chamado pelo webhook-whatsapp.js (fire-and-forget).
 *
 * @param {object} body - payload Z-API completo
 */
export async function processarMensagemGrupo(body) {
  const supabase = getSupabase()
  if (!supabase) {
    console.error('[_chamados-engine] Supabase não configurado')
    return
  }

  // ── Extrai campos do payload Z-API ─────────────────────────────────────────
  // Z-API group messages: phone = group JID, participantPhone = sender
  const zapiMsgId    = body.messageId || body.zaapId || null
  const groupJid     = body.phone || ''                    // ex: 5567999990000-1609459200@g.us
  const remetenteWa  = body.participantPhone || body.senderPhone || body.senderLid || ''
  const remetenteNome= body.participantName  || body.senderName  || remetenteWa.replace(/\D/g, '').slice(-9)
  const msgText      = body.text?.message || body.caption || body.body || ''
  const msgType      = (body.type || 'text').toLowerCase()
  const dataMensagem = body.moments
    ? new Date(body.moments * 1000).toISOString()
    : new Date().toISOString()

  // Ignora mensagens sem texto (imagens sem legenda, áudios, etc.) ou vazias
  if (!msgText.trim()) return
  // Ignora mensagens enviadas pelo próprio bot
  if (body.fromMe) return

  // ── Verifica duplicidade ────────────────────────────────────────────────────
  if (zapiMsgId) {
    const { data: existing } = await supabase
      .from('mensagens_whatsapp_grupos')
      .select('id')
      .eq('zapi_message_id', zapiMsgId)
      .maybeSingle()
    if (existing) return // já processada
  }

  // ── Busca grupo monitorado (por zapi_group_id) ──────────────────────────────
  const { data: grupo } = await supabase
    .from('whatsapp_grupos')
    .select('*, tecnicos!tecnico_id(*)')
    .eq('zapi_group_id', groupJid)
    .eq('ativo', true)
    .maybeSingle()

  if (!grupo) {
    // Grupo não cadastrado — salva mensagem mas não processa
    console.log(`[_chamados-engine] Grupo não monitorado: ${groupJid}`)
    return
  }

  // ── Salva a mensagem ────────────────────────────────────────────────────────
  const { data: msgSalva, error: errMsg } = await supabase
    .from('mensagens_whatsapp_grupos')
    .insert({
      workspace_id:       grupo.workspace_id,
      zapi_message_id:    zapiMsgId,
      grupo_id:           grupo.id,
      remetente_nome:     remetenteNome,
      remetente_whatsapp: remetenteWa,
      mensagem:           msgText,
      tipo_mensagem:      msgType,
      data_mensagem:      dataMensagem,
      processada:         false,
    })
    .select()
    .single()

  if (errMsg) {
    if (errMsg.code === '23505') return // constraint duplicidade, ignorar
    console.error('[_chamados-engine] Erro ao salvar mensagem:', errMsg.message)
    return
  }

  // ── Agrupa mensagens recentes do mesmo remetente (janela de contexto) ───────
  const janelaStart = new Date(Date.now() - JANELA_MIN * 60 * 1000).toISOString()
  const { data: msgRecentes } = await supabase
    .from('mensagens_whatsapp_grupos')
    .select('mensagem, data_mensagem')
    .eq('grupo_id', grupo.id)
    .eq('remetente_whatsapp', remetenteWa)
    .gte('data_mensagem', janelaStart)
    .order('data_mensagem', { ascending: true })

  const mensagensContexto = (msgRecentes || []).map(m => m.mensagem).filter(Boolean)
  if (!mensagensContexto.includes(msgText)) mensagensContexto.push(msgText)

  // ── Classifica com IA ────────────────────────────────────────────────────────
  let resultado
  try {
    resultado = await classificarChamado(mensagensContexto, {
      grupoNome:    grupo.nome_grupo,
      nomeRemetente: remetenteNome,
    })
  } catch (e) {
    console.error('[_chamados-engine] Erro IA:', e?.message)
    resultado = { erro: e?.message }
  }

  const confianca    = resultado?.confianca || 0
  const ehChamado    = resultado?.eh_chamado === true
  const virouChamado = ehChamado && confianca >= CONF_CHAMADO
  const ehTriagem    = ehChamado && confianca >= CONF_TRIAGEM && confianca < CONF_CHAMADO

  // ── Registra log da IA ───────────────────────────────────────────────────────
  await supabase.from('logs_classificacao_ia').insert({
    workspace_id:    grupo.workspace_id,
    mensagem_id:     msgSalva.id,
    grupo_id:        grupo.id,
    resultado:       resultado,
    confianca:       confianca,
    motivo:          resultado?.motivo || null,
    payload_entrada: resultado?.payloadEntrada || null,
    payload_saida:   resultado?.payloadSaida || null,
    virou_chamado:   virouChamado,
    eh_triagem:      ehTriagem,
  }).catch(e => console.error('[_chamados-engine] log IA:', e?.message))

  // Abaixo do limiar de triagem → encerra sem criar chamado
  if (!ehChamado || confianca < CONF_TRIAGEM) {
    await supabase
      .from('mensagens_whatsapp_grupos')
      .update({ processada: true })
      .eq('id', msgSalva.id)
    return
  }

  // ── Verifica duplicidade de chamado recente (mesmo remetente, mesmo grupo, últimos 30min) ───
  const trintaMin = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: satRecente } = await supabase
    .from('solicitacoes_atendimento')
    .select('id, codigo')
    .eq('grupo_id', grupo.id)
    .eq('solicitante_whatsapp', remetenteWa)
    .gte('created_at', trintaMin)
    .not('status', 'in', '("descartada","erro_classificacao")')
    .maybeSingle()

  if (satRecente) {
    // Chamado já aberto recentemente — evita duplicata
    await supabase
      .from('mensagens_whatsapp_grupos')
      .update({ processada: true })
      .eq('id', msgSalva.id)
    return
  }

  // ── Gera código SAT ──────────────────────────────────────────────────────────
  const { data: codigoRow } = await supabase
    .rpc('next_sat_codigo')
    .single()
    .catch(() => ({ data: `SAT-${Date.now()}` }))

  const codigo = codigoRow || `SAT-${Date.now()}`

  // ── Cria solicitação ─────────────────────────────────────────────────────────
  const statusInicial = virouChamado ? 'aberta' : 'triagem'
  const { data: sat, error: errSat } = await supabase
    .from('solicitacoes_atendimento')
    .insert({
      workspace_id:         grupo.workspace_id,
      codigo,
      grupo_id:             grupo.id,
      tecnico_id:           grupo.tecnico_id,
      solicitante_nome:     remetenteNome,
      solicitante_whatsapp: remetenteWa,
      mensagem_original:    mensagensContexto.join('\n---\n'),
      resumo_ia:            resultado?.resumo || null,
      categoria:            resultado?.categoria || 'outros',
      prioridade:           resultado?.prioridade || 'media',
      status:               statusInicial,
      confianca_ia:         confianca,
      motivo_classificacao: resultado?.motivo || null,
    })
    .select()
    .single()

  if (errSat) {
    console.error('[_chamados-engine] Erro ao criar SAT:', errSat.message)
    return
  }

  // ── Notifica técnico (apenas chamados confirmados, não triagem) ───────────────
  if (virouChamado && grupo.tecnicos) {
    await notificarTecnico(supabase, sat, grupo.tecnicos, grupo.nome_grupo)
  }

  // Marca mensagem como processada
  await supabase
    .from('mensagens_whatsapp_grupos')
    .update({ processada: true })
    .eq('id', msgSalva.id)
}
