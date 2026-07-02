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

  // ── Determina se o remetente é o técnico responsável do grupo ───────────────
  // Compara pelo sufixo numérico (ignora DDI variável) para ser tolerante a formatos
  const ehTecnico = !!(grupo.tecnicos?.whatsapp &&
    remetenteWa.replace(/\D/g, '').endsWith(grupo.tecnicos.whatsapp.replace(/\D/g, '').slice(-9)))

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
      eh_tecnico:         ehTecnico,
    })
    .select()
    .single()

  if (errMsg) {
    if (errMsg.code === '23505') return // constraint duplicidade, ignorar
    console.error('[_chamados-engine] Erro ao salvar mensagem:', errMsg.message)
    return
  }

  // ── Mensagem do técnico responsável → processar como interação, não como novo SAT ─
  if (ehTecnico) {
    await processarInteracaoTecnico(supabase, msgSalva, msgText, remetenteNome, grupo)
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

  // Nenhum chamado identificado pela IA
  if (!temChamado) {
    // Tenta fechar SAT existente via detecção de resolução.
    // Funciona para QUALQUER membro do grupo — não só o técnico.
    await tentarFecharSatPorResolucao(supabase, msgText, remetenteNome, grupo)
    return
  }

  // ── Dedup: SATs ABERTOS para o mesmo equipamento no grupo (sem janela de tempo) ─
  // Verifica todo o grupo (não só o remetente) para evitar SAT duplicado quando
  // duas pessoas diferentes reportam o mesmo equipamento.
  const { data: satsRecentesDb } = await supabase
    .from('solicitacoes_atendimento')
    .select('id, codigo, equipamento')
    .eq('grupo_id', grupo.id)
    .not('status', 'in', '(descartada,erro_classificacao,concluida)')

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
        // Sem equipamento identificado → sempre triagem (revisão humana obrigatória)
        status:               (virouChamado && (item.equipamento || item.veiculo_ou_maquina)) ? 'aberta' : 'triagem',
        confianca_ia:         item.confianca,
        motivo_classificacao: item.motivo || null,
        equipamento:          item.equipamento || item.veiculo_ou_maquina || null,
        local:                item.local    || null,
        cliente:              grupo.cliente  || null,
        operacao:             grupo.operacao || null,
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
 * Tenta fechar um SAT aberto com base numa mensagem de resolução de QUALQUER membro do grupo.
 * Chamado quando a classificação principal não identifica novo chamado.
 */
async function tentarFecharSatPorResolucao(supabase, msgText, remetenteNome, grupo) {
  try {
    const resolucao = await detectarResolucao(msgText, {
      grupoNome:     grupo.nome_grupo,
      nomeRemetente: remetenteNome,
    })

    if (!resolucao?.eh_resolucao || resolucao.confianca < 0.70) return

    // Busca SATs abertos no grupo
    const { data: abertos } = await supabase
      .from('solicitacoes_atendimento')
      .select('id, codigo, status, equipamento, quantidade_interacoes, data_primeira_interacao_tecnico')
      .eq('grupo_id', grupo.id)
      .not('status', 'in', '(descartada,erro_classificacao,concluida)')
      .order('created_at', { ascending: false })

    if (!abertos?.length) return

    let satAlvo = null

    // 1. Menção explícita ao código SAT
    const satCodeMatch = msgText.match(/SAT-\d+/i)
    if (satCodeMatch) {
      satAlvo = abertos.find(s => s.codigo?.toLowerCase() === satCodeMatch[0].toLowerCase())
    }

    // 2. Equipamento identificado pela IA
    if (!satAlvo && resolucao.equipamento) {
      const eqNorm = resolucao.equipamento.toLowerCase().replace(/[^a-z0-9]/g, '')
      satAlvo = abertos.find(s => {
        if (!s.equipamento) return false
        const sNorm = s.equipamento.toLowerCase().replace(/[^a-z0-9]/g, '')
        return sNorm === eqNorm || sNorm.includes(eqNorm) || eqNorm.includes(sNorm)
      })
    }

    // 3. Fallback: único SAT aberto no grupo
    if (!satAlvo && abertos.length === 1) {
      satAlvo = abertos[0]
    }

    if (!satAlvo) return

    const agora = new Date().toISOString()
    const primInteracao = satAlvo.data_primeira_interacao_tecnico ? {} : { data_primeira_interacao_tecnico: agora }

    const { error } = await supabase
      .from('solicitacoes_atendimento')
      .update({
        status:                'concluida',
        data_finalizacao:      agora,
        resolucao_descricao:   resolucao.resolucao_descricao || msgText.slice(0, 300),
        data_ultima_interacao: agora,
        quantidade_interacoes: (satAlvo.quantidade_interacoes || 0) + 1,
        ...primInteracao,
      })
      .eq('id', satAlvo.id)

    if (error) console.error('[_chamados-engine] tentarFecharSatPorResolucao update:', error.message)
    else console.log(`[_chamados-engine] SAT ${satAlvo.codigo} fechado por "${remetenteNome}" via resolucao (confianca: ${resolucao.confianca})`)
  } catch (e) {
    console.error('[_chamados-engine] tentarFecharSatPorResolucao exceção:', e?.message)
  }
}

/**
 * Processa mensagem do técnico responsável do grupo.
 * O técnico NÃO abre SATs — ele atualiza, interagem e fecha SATs existentes.
 *
 * Gatilho de atualização: mensagem menciona código SAT (ex: SAT-000011)
 *                         OU equipamento identificável pela IA.
 * Sem menção de equipamento/SAT: registra somente no log (mensagem salva, nada muda).
 */
async function processarInteracaoTecnico(supabase, msgSalva, msgText, remetenteNome, grupo) {
  // Sempre marca mensagem como processada (técnico não alimenta contexto de solicitantes)
  await supabase.from('mensagens_whatsapp_grupos').update({ processada: true }).eq('id', msgSalva.id)

  try {
    // 1. Verifica menção direta a código SAT (ex: "SAT-000011 resolvido")
    const satCodeMatch = msgText.match(/SAT-\d+/i)

    // 2. Detecta resolução e extrai equipamento via IA
    const resolucao = await detectarResolucao(msgText, {
      grupoNome:     grupo.nome_grupo,
      nomeRemetente: remetenteNome,
    })

    // 3. Localiza o SAT alvo
    let satAlvo = null

    if (satCodeMatch) {
      // Prioridade: SAT mencionado explicitamente pelo código
      const { data } = await supabase
        .from('solicitacoes_atendimento')
        .select('id, codigo, status, equipamento, data_primeira_interacao_tecnico, quantidade_interacoes')
        .eq('grupo_id', grupo.id)
        .ilike('codigo', satCodeMatch[0])
        .not('status', 'in', '(descartada,erro_classificacao,concluida)')
        .maybeSingle()
      satAlvo = data
    }

    if (!satAlvo && resolucao?.equipamento) {
      // Fallback: SAT com equipamento correspondente
      const eqNorm = resolucao.equipamento.toLowerCase().replace(/[^a-z0-9]/g, '')
      const { data: abertos } = await supabase
        .from('solicitacoes_atendimento')
        .select('id, codigo, status, equipamento, data_primeira_interacao_tecnico, quantidade_interacoes')
        .eq('grupo_id', grupo.id)
        .not('status', 'in', '(descartada,erro_classificacao,concluida)')
        .order('created_at', { ascending: false })

      satAlvo = (abertos || []).find(s => {
        if (!s.equipamento) return false
        const sNorm = s.equipamento.toLowerCase().replace(/[^a-z0-9]/g, '')
        return sNorm === eqNorm || sNorm.includes(eqNorm) || eqNorm.includes(sNorm)
      })
    }

    // Sem SAT alvo identificado → técnico falou algo genérico, nada a atualizar
    if (!satAlvo) return

    const agora     = new Date().toISOString()
    const ehFechamento = resolucao?.eh_resolucao && resolucao?.confianca >= 0.75
    const primInteracao = satAlvo.data_primeira_interacao_tecnico ? {} : { data_primeira_interacao_tecnico: agora }

    if (ehFechamento) {
      const { error } = await supabase
        .from('solicitacoes_atendimento')
        .update({
          status:               'concluida',
          data_finalizacao:     agora,
          resolucao_descricao:  resolucao.resolucao_descricao || msgText.slice(0, 300),
          data_ultima_interacao: agora,
          quantidade_interacoes: (satAlvo.quantidade_interacoes || 0) + 1,
          ...primInteracao,
        })
        .eq('id', satAlvo.id)
      if (error) console.error('[_chamados-engine] processarInteracaoTecnico close:', error.message)
      else console.log(`[_chamados-engine] SAT ${satAlvo.codigo} fechado pelo técnico: "${resolucao.resolucao_descricao}"`)
    } else {
      // Interação técnica: avança status se ainda estava parado na fila inicial
      const novoStatus = ['aberta', 'enviada_tecnico', 'triagem'].includes(satAlvo.status)
        ? 'em_atendimento'
        : satAlvo.status
      const { error } = await supabase
        .from('solicitacoes_atendimento')
        .update({
          status:                novoStatus,
          data_ultima_interacao: agora,
          quantidade_interacoes: (satAlvo.quantidade_interacoes || 0) + 1,
          ...primInteracao,
        })
        .eq('id', satAlvo.id)
      if (error) console.error('[_chamados-engine] processarInteracaoTecnico update:', error.message)
      else console.log(`[_chamados-engine] SAT ${satAlvo.codigo} interação técnica (→ ${novoStatus})`)
    }
  } catch (e) {
    console.error('[_chamados-engine] processarInteracaoTecnico exceção:', e?.message)
  }
}
