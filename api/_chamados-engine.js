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
import { classificarChamado, detectarResolucao } from './_chamados-ia.js'
import { notificarTecnico }   from './_chamados-notificar.js'

const supabaseUrl        = process.env.SUPABASE_URL       || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

// Thresholds de confiança
const CONF_CHAMADO  = 0.90  // ≥ 90%: abre chamado automaticamente
const CONF_TRIAGEM  = 0.72  // ≥ 72%: cria pré-solicitação para triagem humana

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

  const reprocessado = !!body._reprocessado

  // ── Verifica duplicidade (ignora se for reprocessamento) ───────────────────
  if (zapiMsgId && !reprocessado) {
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
    // Grupo não cadastrado — salva JID no log para facilitar cadastro
    console.log(`[_chamados-engine] Grupo não monitorado: ${groupJid}`)
    // Tenta encontrar workspace_id mesmo sem grupo ativo (ex: grupo inativo ou recém-cadastrado)
    let discoveryWsId = null
    try {
      const { data: grupoInativo } = await supabase
        .from('whatsapp_grupos').select('workspace_id').eq('zapi_group_id', groupJid).maybeSingle()
      discoveryWsId = grupoInativo?.workspace_id || null
    } catch (_e) {}
    // Salva como log de descoberta para exibir no frontend
    try {
      await supabase.from('logs_classificacao_ia').insert({
        workspace_id: discoveryWsId,
        grupo_id:     null,
        confianca:    0,
        virou_chamado: false,
        eh_triagem:   false,
        motivo:       `GRUPO_NAO_CADASTRADO | JID: ${groupJid} | Nome remetente: ${remetenteNome}`,
        resultado:    { jid: groupJid, remetente: remetenteNome, msg: msgText.slice(0, 200) },
      })
    } catch (_e) {}
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
  // Filtra apenas processada=false para não misturar mensagens de SATs anteriores já resolvidos.
  // Mensagens classificadas como "não chamado" ficam processada=false e acumulam contexto.
  // Quando um SAT é criado, TODAS as mensagens do contexto são marcadas como processada=true.
  const janelaStart = new Date(Date.now() - JANELA_MIN * 60 * 1000).toISOString()
  const { data: msgRecentes } = await supabase
    .from('mensagens_whatsapp_grupos')
    .select('id, mensagem, data_mensagem')
    .eq('grupo_id', grupo.id)
    .eq('remetente_whatsapp', remetenteWa)
    .eq('processada', false)
    .gte('data_mensagem', janelaStart)
    .order('data_mensagem', { ascending: true })

  const mensagensContexto = (msgRecentes || []).map(m => m.mensagem).filter(Boolean)
  if (!mensagensContexto.includes(msgText)) mensagensContexto.push(msgText)

  // ── Classifica com IA → retorna array de chamados distintos ─────────────────
  let resultado
  try {
    resultado = await classificarChamado(mensagensContexto, {
      grupoNome:     grupo.nome_grupo,
      nomeRemetente: remetenteNome,
    })
  } catch (e) {
    console.error('[_chamados-engine] Erro IA:', e?.message)
    resultado = { chamados: [], erro: e?.message }
  }

  const chamados     = resultado?.chamados || []
  const temChamado   = chamados.some(c => c.eh_chamado && c.confianca >= CONF_TRIAGEM)
  const maxConfianca = chamados.length ? Math.max(...chamados.map(c => c.confianca || 0)) : 0

  // ── Registra log da IA (um log por processamento de período) ─────────────────
  try {
    await supabase.from('logs_classificacao_ia').insert({
      workspace_id:    grupo.workspace_id,
      mensagem_id:     msgSalva.id,
      grupo_id:        grupo.id,
      resultado:       resultado,
      confianca:       maxConfianca,
      motivo:          chamados.length
                         ? chamados.map(c => c.motivo).filter(Boolean).join(' | ')
                         : 'Nenhum chamado identificado no período',
      payload_entrada: resultado?.payloadEntrada || null,
      payload_saida:   resultado?.payloadSaida   || null,
      virou_chamado:   chamados.some(c => c.eh_chamado && c.confianca >= CONF_CHAMADO),
      eh_triagem:      chamados.some(c => c.eh_chamado && c.confianca >= CONF_TRIAGEM && c.confianca < CONF_CHAMADO),
    })
  } catch (e) { console.error('[_chamados-engine] log IA:', e?.message) }

  // Nenhum chamado → tenta detectar resolução e mantém mensagens no pool de contexto
  if (!temChamado) {
    await tentarFecharChamado(supabase, msgText, remetenteNome, grupo)
    return
  }

  // ── Busca SATs já abertos no período (dedup por equipamento) ─────────────────
  const trintaMin = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: satsRecentesDb } = await supabase
    .from('solicitacoes_atendimento')
    .select('id, codigo, equipamento')
    .eq('grupo_id', grupo.id)
    .eq('solicitante_whatsapp', remetenteWa)
    .gte('created_at', trintaMin)
    .not('status', 'in', '(descartada,erro_classificacao)')

  // Lista mutável para rastrear SATs criados no loop (dedup entre itens do mesmo período)
  const satsList = Array.isArray(satsRecentesDb) ? [...satsRecentesDb] : []

  // ── Cria um SAT para cada chamado distinto identificado ──────────────────────
  let criouAlgum = false

  for (const item of chamados) {
    if (!item.eh_chamado || item.confianca < CONF_TRIAGEM) continue

    const virouChamado = item.confianca >= CONF_CHAMADO
    const novoEquip    = (item.equipamento || item.veiculo_ou_maquina || '').toLowerCase().replace(/[^a-z0-9]/g, '')

    // Dedup: mesmo equipamento (match exato normalizado) já tem SAT no período?
    // Usa apenas igualdade estrita para evitar falsos positivos entre códigos similares
    // (ex: f-tpx0221 vs f-tpx0222 são equipamentos DIFERENTES e devem gerar SATs distintos)
    const satDuplicado = satsList.find(s => {
      const existeEquip = (s.equipamento || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      if (novoEquip && existeEquip) return novoEquip === existeEquip
      if (!novoEquip && !existeEquip) return true
      return false
    })

    if (satDuplicado) {
      console.log(`[_chamados-engine] Duplicata ignorada: ${satDuplicado.codigo} (equip: ${satDuplicado.equipamento || 'genérico'})`)
      continue
    }

    // Gera código SAT
    let codigo
    try {
      const { data: codigoData, error: rpcErr } = await supabase.rpc('next_sat_codigo')
      if (rpcErr) throw rpcErr
      codigo = typeof codigoData === 'string' ? codigoData
             : codigoData?.next_sat_codigo    ? String(codigoData.next_sat_codigo)
             : null
    } catch (_e) {
      console.error('[_chamados-engine] next_sat_codigo falhou:', _e?.message)
    }
    if (!codigo) codigo = `SAT-${Date.now()}`

    // Cria SAT
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
        resumo_ia:            item.resumo || null,
        categoria:            item.categoria || 'outros',
        prioridade:           item.prioridade || 'media',
        status:               virouChamado ? 'aberta' : 'triagem',
        confianca_ia:         item.confianca,
        motivo_classificacao: item.motivo || null,
        equipamento:          item.equipamento || item.veiculo_ou_maquina || null,
      })
      .select()
      .single()

    if (errSat) {
      console.error('[_chamados-engine] Erro ao criar SAT:', errSat.message, '| codigo:', codigo)
      continue
    }

    criouAlgum = true
    // Registra no satsList para dedup dos próximos itens do loop
    satsList.push({ id: sat.id, codigo: sat.codigo, equipamento: sat.equipamento })

    if (virouChamado && grupo.tecnicos) {
      await notificarTecnico(supabase, sat, grupo.tecnicos, grupo.nome_grupo)
    }
  }

  // Marca TODAS as mensagens do contexto como processadas (independente de criou SAT ou não)
  // para não poluir a janela de contexto de solicitações futuras do mesmo remetente.
  const ctxIds = (msgRecentes || []).map(m => m.id).filter(Boolean)
  if (ctxIds.length > 0) {
    await supabase.from('mensagens_whatsapp_grupos').update({ processada: true }).in('id', ctxIds)
  }
  await supabase.from('mensagens_whatsapp_grupos').update({ processada: true }).eq('id', msgSalva.id)
}

/**
 * Tenta detectar mensagem de resolução e fechar SATs abertos correspondentes.
 */
async function tentarFecharChamado(supabase, msgText, remetenteNome, grupo) {
  try {
    const resolucao = await detectarResolucao(msgText, {
      grupoNome:     grupo.nome_grupo,
      nomeRemetente: remetenteNome,
    })

    if (!resolucao?.eh_resolucao || resolucao.confianca < 0.75) return

    const equipamento = resolucao.equipamento
    console.log(`[_chamados-engine] Resolução detectada: equipamento="${equipamento}" confianca=${resolucao.confianca}`)

    // Busca SATs abertos no grupo (com ou sem equipamento específico)
    const query = supabase
      .from('solicitacoes_atendimento')
      .select('id, codigo, equipamento, status')
      .eq('grupo_id', grupo.id)
      .in('status', ['aberta', 'enviada_tecnico', 'em_atendimento', 'triagem'])
      .order('created_at', { ascending: false })

    const { data: satsAbertos } = await query
    if (!satsAbertos?.length) return

    // Encontra o SAT mais compatível pelo equipamento
    let satAlvo = null
    if (equipamento) {
      const eqNorm = equipamento.toLowerCase().replace(/[^a-z0-9]/g, '')
      satAlvo = satsAbertos.find(s => {
        if (!s.equipamento) return false
        const sNorm = s.equipamento.toLowerCase().replace(/[^a-z0-9]/g, '')
        return sNorm.includes(eqNorm) || eqNorm.includes(sNorm)
      })
    }
    // Fallback: fecha o SAT mais recente do grupo
    if (!satAlvo) satAlvo = satsAbertos[0]
    if (!satAlvo) return

    await supabase
      .from('solicitacoes_atendimento')
      .update({
        status:               'concluida',
        data_finalizacao:     new Date().toISOString(),
        resolucao_descricao:  resolucao.resolucao_descricao || msgText.slice(0, 300),
        updated_at:           new Date().toISOString(),
      })
      .eq('id', satAlvo.id)

    console.log(`[_chamados-engine] SAT ${satAlvo.codigo} fechado por resolução: "${resolucao.resolucao_descricao}"`)
  } catch (e) {
    console.error('[_chamados-engine] tentarFecharChamado:', e?.message)
  }
}
