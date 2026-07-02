// api/chamados-setup.js
// Endpoint auxiliar para descoberta de group JIDs e setup do módulo Chamados WA.
// Rotas:
//   GET  ?action=jids-descobertos           → lista JIDs de grupos que enviaram msg mas não estão cadastrados
//   POST ?action=registrar-grupo            → cadastra grupo com JID descoberto
//   GET  ?action=webhook-status             → verifica/reconfigura webhook na Z-API

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const supabaseUrl        = process.env.SUPABASE_URL       || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const zapiInstanceId     = process.env.ZAPI_INSTANCE_ID
const zapiToken          = process.env.ZAPI_TOKEN
const zapiClientToken    = process.env.ZAPI_CLIENT_TOKEN
const APP_URL            = process.env.APP_URL || 'https://smartpro.app.br'

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey, {
    realtime: { params: { log_level: 'disabled' }, transport: ws },
    global: {},
  })
}

async function zapiGet(path) {
  const r = await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}${path}`, {
    headers: { 'Client-Token': zapiClientToken || '' },
  })
  return r.ok ? r.json() : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  try {
  return await _handler(req, res)
  } catch (e) {
    console.error('[chamados-setup] crash não tratado:', e)
    return res.status(500).json({ error: 'Erro interno do servidor', detalhe: e.message })
  }
}

async function _handler(req, res) {
  const action = req.query.action
  const supabase = getSupabase()
  if (!supabase) return res.status(500).json({ error: 'Supabase não configurado' })

  // ── Listar JIDs descobertos (grupos que mandaram msg mas não cadastrados) ──
  if (action === 'jids-descobertos') {
    const { data } = await supabase
      .from('logs_classificacao_ia')
      .select('id, motivo, resultado, created_at')
      .is('grupo_id', null)
      .ilike('motivo', 'GRUPO_NAO_CADASTRADO%')
      .order('created_at', { ascending: false })
      .limit(20)

    const jids = (data || []).map(r => ({
      id:       r.id,
      jid:      r.resultado?.jid || '',
      remetente: r.resultado?.remetente || '',
      msg:      r.resultado?.msg || '',
      quando:   r.created_at,
    }))
    return res.json({ jids })
  }

  // ── Status + reconfigurar webhook ─────────────────────────────────────────
  if (action === 'webhook-status') {
    const webhookUrl = `${APP_URL}/api/webhook-whatsapp`

    // Lê config atual
    const atual = await zapiGet('/webhook-received').catch(() => null)

    // Reconfigura se necessário
    let configurou = false
    if (!atual || atual.value !== webhookUrl) {
      try {
        const r = await fetch(
          `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/update-webhook-received`,
          {
            method: 'PUT',
            headers: { 'Client-Token': zapiClientToken || '', 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: webhookUrl }),
          }
        )
        configurou = r.ok
      } catch {}
    }

    return res.json({ webhookUrl, atual: atual?.value, configurou })
  }

  // ── Bot entra no grupo via link de convite do WhatsApp ───────────────────
  if (action === 'entrar-grupo' && req.method === 'POST') {
    const { invite_link, nome_grupo, workspace_id, owner_id, cliente, operacao, tecnico_id } = req.body || {}
    if (!invite_link || !nome_grupo || !workspace_id) {
      return res.status(400).json({ error: 'invite_link, nome_grupo e workspace_id são obrigatórios' })
    }

    // Valida que é um link de convite WA
    if (!invite_link.includes('chat.whatsapp.com/')) {
      return res.status(400).json({ error: 'Link de convite inválido. Use o formato https://chat.whatsapp.com/XXXXX' })
    }
    const fullUrl = invite_link.trim()

    const zapiBase = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}`
    const zapiHeaders = { 'Client-Token': zapiClientToken || '', 'Content-Type': 'application/json' }

    // 1. Busca metadata do grupo pelo link → obtém o JID (phone)
    let zapi_group_id = null
    try {
      const meta = await fetch(`${zapiBase}/group-invitation-metadata?url=${encodeURIComponent(fullUrl)}`, {
        headers: zapiHeaders,
      })
      const metaRaw = await meta.text()
      console.log('[entrar-grupo] metadata status:', meta.status, 'body:', metaRaw.slice(0, 300))
      let metaData
      try { metaData = JSON.parse(metaRaw) } catch { metaData = { raw: metaRaw } }
      if (!meta.ok) {
        return res.status(502).json({ error: `Z-API metadata HTTP ${meta.status}`, detalhe: metaData })
      }
      zapi_group_id = metaData.phone || null
      if (!zapi_group_id) {
        return res.status(502).json({ error: 'Z-API não retornou o JID do grupo', detalhe: metaData })
      }
    } catch (e) {
      return res.status(502).json({ error: 'Falha ao buscar metadata do grupo', detalhe: e.message })
    }

    // 2. Bot aceita o convite e entra no grupo
    try {
      const join = await fetch(`${zapiBase}/accept-group-invite?url=${encodeURIComponent(fullUrl)}`, {
        method: 'POST',
        headers: zapiHeaders,
      })
      const joinRaw = await join.text()
      console.log('[entrar-grupo] accept status:', join.status, 'body:', joinRaw.slice(0, 300))
      let joinData
      try { joinData = JSON.parse(joinRaw) } catch { joinData = { raw: joinRaw } }
      if (!join.ok) {
        return res.status(502).json({ error: `Z-API accept HTTP ${join.status}`, detalhe: joinData })
      }
    } catch (e) {
      return res.status(502).json({ error: 'Falha ao entrar no grupo via Z-API', detalhe: e.message })
    }

    // 3. Registra/atualiza o grupo no Supabase
    const { data, error } = await supabase.from('whatsapp_grupos').upsert(
      {
        zapi_group_id,
        nome_grupo: nome_grupo.trim(),
        workspace_id,
        owner_id:   owner_id   || null,
        tecnico_id: tecnico_id || null,
        cliente:    cliente    || null,
        operacao:   operacao   || null,
        ativo:      true,
      },
      { onConflict: 'workspace_id,zapi_group_id' }
    ).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true, grupo: data, zapi_group_id })
  }

  // ── Registrar grupo descoberto ────────────────────────────────────────────
  if (action === 'registrar-grupo' && req.method === 'POST') {
    const { zapi_group_id, nome_grupo, workspace_id, owner_id, tecnico_id } = req.body || {}
    if (!zapi_group_id || !nome_grupo || !workspace_id) {
      return res.status(400).json({ error: 'zapi_group_id, nome_grupo e workspace_id são obrigatórios' })
    }

    const { data, error } = await supabase.from('whatsapp_grupos').upsert(
      { zapi_group_id, nome_grupo, workspace_id, owner_id: owner_id || null, tecnico_id: tecnico_id || null, ativo: true },
      { onConflict: 'workspace_id,zapi_group_id' }
    ).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true, grupo: data })
  }

  // ── Diagnóstico: logs recentes com status de criação de SAT ───────────────
  if (action === 'diagnostico') {
    const workspace_id = req.query.workspace_id || null

    // Logs recentes
    let logsQuery = supabase
      .from('logs_classificacao_ia')
      .select('id, workspace_id, grupo_id, confianca, virou_chamado, eh_triagem, motivo, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (workspace_id) logsQuery = logsQuery.eq('workspace_id', workspace_id)
    const { data: logs } = await logsQuery

    // SATs recentes
    let satsQuery = supabase
      .from('solicitacoes_atendimento')
      .select('id, codigo, status, confianca_ia, motivo_classificacao, equipamento, solicitante_nome, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (workspace_id) satsQuery = satsQuery.eq('workspace_id', workspace_id)
    const { data: sats } = await satsQuery

    // Verifica se colunas novas existem (tenta ler equipamento)
    const { error: colErr } = await supabase
      .from('solicitacoes_atendimento')
      .select('equipamento, data_finalizacao, resolucao_descricao')
      .limit(1)

    // Mensagens recentes (com filtro opcional por remetente)
    const remetente = req.query.remetente || null
    let msgsQuery = supabase
      .from('mensagens_whatsapp_grupos')
      .select('id, remetente_nome, remetente_whatsapp, mensagem, tipo_mensagem, data_mensagem, grupo:whatsapp_grupos(nome_grupo)')
      .order('data_mensagem', { ascending: false })
      .limit(20)
    if (workspace_id) msgsQuery = msgsQuery.eq('workspace_id', workspace_id)
    if (remetente)    msgsQuery = msgsQuery.ilike('remetente_nome', `%${remetente}%`)
    const { data: msgs } = await msgsQuery

    // Verifica plano Groq via rate-limit headers (chamada real de 1 token)
    let groqInfo = null
    const groqKey = process.env.GROQ_API_KEY
    if (groqKey) {
      try {
        const gr = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [{ role: 'user', content: 'ok' }],
            max_tokens: 1,
          }),
        })
        const h = (name) => gr.headers.get(name)
        groqInfo = {
          status:          gr.status,
          key_prefix:      groqKey.slice(0, 8) + '…',
          req_limit:       h('x-ratelimit-limit-requests'),
          req_remaining:   h('x-ratelimit-remaining-requests'),
          tokens_limit:    h('x-ratelimit-limit-tokens'),
          tokens_remaining:h('x-ratelimit-remaining-tokens'),
          reset_requests:  h('x-ratelimit-reset-requests'),
          plano:           Number(h('x-ratelimit-limit-requests')) >= 500 ? 'pago' : 'free',
        }
      } catch (e) {
        groqInfo = { erro: e.message }
      }
    } else {
      groqInfo = { erro: 'GROQ_API_KEY não configurada' }
    }

    return res.json({
      ok: true,
      colunas_novas_ok: !colErr,
      colunas_erro: colErr?.message || null,
      groq: groqInfo,
      logs_recentes: (logs || []).map(l => ({
        id:            l.id.slice(0, 8),
        workspace_id:  l.workspace_id?.slice(0, 8),
        grupo_id:      l.grupo_id?.slice(0, 8),
        confianca:     l.confianca,
        virou_chamado: l.virou_chamado,
        eh_triagem:    l.eh_triagem,
        motivo:        l.motivo?.slice(0, 120),
        quando:        l.created_at,
      })),
      sats_recentes: (sats || []).map(s => ({
        codigo:     s.codigo,
        status:     s.status,
        confianca:  s.confianca_ia,
        equipamento: s.equipamento,
        solicitante: s.solicitante_nome,
        motivo:     s.motivo_classificacao?.slice(0, 80),
        quando:     s.created_at,
      })),
      mensagens_recentes: (msgs || []).map(m => ({
        id:         m.id,
        grupo:      m.grupo?.nome_grupo || '—',
        remetente:  m.remetente_nome,
        whatsapp:   m.remetente_whatsapp,
        mensagem:   m.mensagem,
        tipo:       m.tipo_mensagem,
        quando:     m.data_mensagem,
      })),
    })
  }

  // ── Reprocessar mensagem bloqueada → força criação de SAT ────────────────
  if (action === 'reprocessar-mensagem' && req.method === 'POST') {
    const { mensagem_id } = req.body || {}
    if (!mensagem_id) return res.status(400).json({ error: 'mensagem_id obrigatório' })

    // Busca a mensagem original
    const { data: msg, error: errMsg } = await supabase
      .from('mensagens_whatsapp_grupos')
      .select('*, grupo:whatsapp_grupos(*, tecnicos!tecnico_id(*))')
      .eq('id', mensagem_id)
      .single()

    if (errMsg || !msg) return res.status(404).json({ error: 'Mensagem não encontrada' })

    const grupo = msg.grupo
    if (!grupo?.id) return res.status(400).json({ error: 'Grupo não encontrado' })

    // Chama o engine simulando um webhook reprocessado
    // Nota: zapi_message_id tem constraint UNIQUE na tabela; nunca reutilizamos o ID original
    // para não causar conflito 23505. Geramos sempre um ID temporário de reprocessamento.
    const { processarMensagemGrupo } = await import('./_chamados-engine.js')
    let engineError = null
    try {
      await processarMensagemGrupo({
        messageId:        `reprocess-${mensagem_id.slice(0, 8)}-${Date.now()}`,
        phone:            grupo.zapi_group_id,
        participantPhone: msg.remetente_whatsapp,
        participantName:  msg.remetente_nome,
        text:             { message: msg.mensagem },
        type:             msg.tipo_mensagem || 'text',
        moments:          msg.data_mensagem ? Math.floor(new Date(msg.data_mensagem).getTime() / 1000) : undefined,
        isGroup:          true,
        _reprocessado:    true,
      })
    } catch (e) {
      engineError = e?.message || String(e)
    }

    return res.json({ ok: !engineError, mensagem_id, grupo: grupo.nome_grupo, remetente: msg.remetente_nome, engineError })
  }

  // ── Criar SAT manual (para retroativos) ─────────────────────────────────────
  if (action === 'criar-sat-manual' && req.method === 'POST') {
    const { mensagem_id } = req.body || {}
    if (!mensagem_id) return res.status(400).json({ error: 'mensagem_id obrigatório' })

    const { data: msg } = await supabase
      .from('mensagens_whatsapp_grupos')
      .select('*, grupo:whatsapp_grupos(*, tecnicos!tecnico_id(*))')
      .eq('id', mensagem_id)
      .single()

    if (!msg) return res.status(404).json({ error: 'Mensagem não encontrada' })
    const grupo = msg.grupo
    if (!grupo?.id) return res.status(400).json({ error: 'Grupo não encontrado' })

    // Verifica se já existe SAT criado manualmente para o mesmo remetente/mensagem (últimas 2h)
    const duasHoras = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: existente } = await supabase
      .from('solicitacoes_atendimento')
      .select('id, codigo')
      .eq('grupo_id', grupo.id)
      .eq('solicitante_whatsapp', msg.remetente_whatsapp)
      .ilike('mensagem_original', `%${msg.mensagem.slice(0, 50).replace(/%/g, '\\%')}%`)
      .gte('created_at', duasHoras)
      .maybeSingle()
    if (existente) return res.json({ ok: true, codigo: existente.codigo, criado: false, msg: 'SAT já existe para esta mensagem' })

    // Gera código SAT
    let codigo
    const { data: codigoData } = await supabase.rpc('next_sat_codigo')
    codigo = typeof codigoData === 'string' ? codigoData
           : codigoData?.next_sat_codigo    ? String(codigoData.next_sat_codigo)
           : `SAT-${Date.now()}`

    const { data: sat, error: errSat } = await supabase
      .from('solicitacoes_atendimento')
      .insert({
        workspace_id:         grupo.workspace_id,
        codigo,
        grupo_id:             grupo.id,
        tecnico_id:           grupo.tecnico_id,
        solicitante_nome:     msg.remetente_nome,
        solicitante_whatsapp: msg.remetente_whatsapp,
        mensagem_original:    msg.mensagem,
        resumo_ia:            'SAT criado manualmente via reprocessamento',
        confianca_ia:         0.98,
        motivo_classificacao: 'Criado manualmente: mensagem bloqueada por anti-duplicata',
        status:               'aberta',
        prioridade:           'media',
      })
      .select()
      .single()

    if (errSat) return res.status(500).json({ error: errSat.message })

    return res.json({ ok: true, codigo: sat.codigo, criado: true, sat_id: sat.id })
  }

  return res.status(400).json({ error: 'action inválida' })
}

