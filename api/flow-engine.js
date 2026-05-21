/**
 * SmartPro Flow Center — Motor de Execução
 *
 * Endpoints:
 *   POST /api/flow-engine?action=start      → cria instância de processo
 *   POST /api/flow-engine?action=execute    → executa uma ação (avança etapa)
 *   GET  /api/flow-engine?action=tasks      → tarefas pendentes do usuário
 *   GET  /api/flow-engine?action=instance   → estado atual de uma instância
 *   GET  /api/flow-engine?action=actions    → ações disponíveis para o usuário
 *   POST /api/flow-engine?action=simulate   → simula um fluxo sem criar instância
 *
 * Todos os endpoints autenticados (exceto simulate com flag allow_public).
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
    { realtime: { params: { log_level: 'disabled' }, transport: ws }, global: {} }
  )
}

async function sendWA(to, text) {
  const phone = String(to || '').replace(/\D/g, '')
  if (phone.length < 10) return { ok: false, error: 'phone inválido' }
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
    const body = await res.json().catch(() => ({}))
    return { ok: res.ok, body }
  } catch (e) {
    return { ok: false, error: e?.message }
  }
}

// ─────────────────────────────────────────────
// Motor de Regras — avalia condição JSONb contra contexto
// ─────────────────────────────────────────────
function avaliarCondicao(condicao, contexto) {
  if (!condicao) return true // sem condição = sempre verdadeiro

  // Operador AND
  if (condicao.AND) {
    return condicao.AND.every(c => avaliarCondicao(c, contexto))
  }

  // Operador OR
  if (condicao.OR) {
    return condicao.OR.some(c => avaliarCondicao(c, contexto))
  }

  // NOT
  if (condicao.NOT) {
    return !avaliarCondicao(condicao.NOT, contexto)
  }

  // Regra simples: { campo, operador, valor }
  const { campo, operador, valor } = condicao
  const val = contexto[campo]

  switch (operador) {
    case '==':
    case '=':    return val == valor
    case '!=':   return val != valor
    case '>':    return Number(val) > Number(valor)
    case '>=':   return Number(val) >= Number(valor)
    case '<':    return Number(val) < Number(valor)
    case '<=':   return Number(val) <= Number(valor)
    case 'in':   return Array.isArray(valor) && valor.includes(val)
    case 'not_in': return Array.isArray(valor) && !valor.includes(val)
    case 'contains': return String(val || '').toLowerCase().includes(String(valor).toLowerCase())
    case 'empty':  return !val || val === '' || val === null
    case 'not_empty': return !!val && val !== ''
    default: return false
  }
}

// ─────────────────────────────────────────────
// Resolver responsável dinâmico da etapa
// Retorna { user_id, nome, tipo } ou null
// ─────────────────────────────────────────────
async function resolverResponsavel(db, responsible, instancia, entidadeData) {
  const { tipo, config } = responsible

  switch (tipo) {
    case 'solicitante': {
      if (!instancia.iniciado_por) return null
      const { data: u } = await db
        .from('auth.users')
        .select('id, email, raw_user_meta_data')
        .eq('id', instancia.iniciado_por)
        .single()
        .catch(() => ({ data: null }))
      return u
        ? { user_id: u.id, nome: u.raw_user_meta_data?.full_name || u.email, tipo }
        : { user_id: instancia.iniciado_por, nome: 'Solicitante', tipo }
    }

    case 'usuario_fixo': {
      if (!config?.usuario_id) return null
      return { user_id: config.usuario_id, nome: config.nome || 'Responsável', tipo }
    }

    case 'perfil': {
      if (!config?.perfil_id) return null
      const { data: membro } = await db
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', instancia.workspace_id)
        .eq('perfil_id', config.perfil_id)
        .eq('ativo', true)
        .limit(1)
        .single()
        .catch(() => ({ data: null }))
      if (!membro) return null
      return { user_id: membro.user_id, nome: config.nome || 'Responsável do perfil', tipo }
    }

    case 'lider_equipe': {
      // Busca lider do campo da entidade (refei_equipes)
      const equipeId = entidadeData?.equipe_id
      if (!equipeId) return null
      const { data: equipe } = await db
        .from('refei_equipes')
        .select('lider_nome, lider_telefone')
        .eq('id', equipeId)
        .single()
        .catch(() => ({ data: null }))
      if (!equipe) return null
      return { user_id: null, nome: equipe.lider_nome, telefone: equipe.lider_telefone, tipo }
    }

    case 'supervisor_equipe': {
      const equipeId = entidadeData?.equipe_id
      if (!equipeId) return null
      const { data: equipe } = await db
        .from('refei_equipes')
        .select('supervisor_nome, supervisor_telefone')
        .eq('id', equipeId)
        .single()
        .catch(() => ({ data: null }))
      if (!equipe) return null
      return { user_id: null, nome: equipe.supervisor_nome, telefone: equipe.supervisor_telefone, tipo }
    }

    case 'comprador': {
      const { data: cfg } = await db
        .from('configuracoes')
        .select('valor')
        .eq('workspace_id', instancia.workspace_id)
        .eq('chave', 'comprador_responsavel_id')
        .maybeSingle()
        .catch(() => ({ data: null }))
      if (!cfg?.valor) return null
      return { user_id: cfg.valor, nome: 'Comprador', tipo }
    }

    case 'aprovador_por_valor': {
      const valorTotal = Number(instancia.dados_contexto?.valor_total || 0)
      const faixas = config?.faixas || [] // [{ ate: 5000, usuario_id, nome }, ...]
      const faixasOrdenadas = [...faixas].sort((a, b) => Number(a.ate) - Number(b.ate))
      const faixa = faixasOrdenadas.find(f => valorTotal <= Number(f.ate))
        || faixasOrdenadas[faixasOrdenadas.length - 1]
      if (!faixa) return null
      return { user_id: faixa.usuario_id, nome: faixa.nome || 'Aprovador', tipo }
    }

    case 'aprovador_por_cat': {
      const categoria = instancia.dados_contexto?.categoria
      const mapa = config?.categorias || {} // { "frota": uuid, "ti": uuid }
      const userId = mapa[categoria] || mapa['_default']
      if (!userId) return null
      return { user_id: userId, nome: `Aprovador (${categoria})`, tipo }
    }

    default:
      return null
  }
}

// ─────────────────────────────────────────────
// Renderizar template de notificação com variáveis
// ─────────────────────────────────────────────
function renderTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

// ─────────────────────────────────────────────
// Calcular SLA (data de vencimento)
// ─────────────────────────────────────────────
function calcularSlaVence(prazoHoras, tipoCalendario) {
  const agora = new Date()
  if (!prazoHoras) return null

  if (tipoCalendario === 'horario_comercial') {
    // Aproximação: considera apenas 8h/dia úteis
    let horas = prazoHoras
    const dataVence = new Date(agora)
    while (horas > 0) {
      dataVence.setHours(dataVence.getHours() + 1)
      const h = dataVence.getHours()
      const d = dataVence.getDay()
      if (d !== 0 && d !== 6 && h >= 8 && h < 18) horas--
    }
    return dataVence.toISOString()
  }

  if (tipoCalendario === 'util') {
    let horas = prazoHoras
    const dataVence = new Date(agora)
    while (horas > 0) {
      dataVence.setHours(dataVence.getHours() + 1)
      const d = dataVence.getDay()
      if (d !== 0 && d !== 6) horas--
    }
    return dataVence.toISOString()
  }

  // corrido: soma direto
  const dataVence = new Date(agora.getTime() + prazoHoras * 3600 * 1000)
  return dataVence.toISOString()
}

// ─────────────────────────────────────────────
// AÇÃO: start — cria nova instância de processo
// ─────────────────────────────────────────────
async function handleStart(db, body) {
  const {
    definition_id,   // uuid do processo
    entidade_tipo,   // 'refei_solicitacoes' | 'solicitacoes_compra' | ...
    entidade_id,     // uuid da linha na tabela de negócio
    iniciado_por,    // user_id de quem inicia
    workspace_id,
    dados_contexto,  // { valor_total, categoria, ... }
  } = body

  if (!definition_id || !entidade_tipo || !entidade_id || !workspace_id) {
    return { status: 400, body: { error: 'definition_id, entidade_tipo, entidade_id e workspace_id são obrigatórios' } }
  }

  // Verificar se já existe instância ativa para essa entidade
  const { data: jaExiste } = await db
    .from('flow_instances')
    .select('id, status')
    .eq('entidade_tipo', entidade_tipo)
    .eq('entidade_id', entidade_id)
    .eq('status', 'ativo')
    .maybeSingle()

  if (jaExiste) {
    return { status: 409, body: { error: 'Já existe uma instância ativa para esta entidade', instance_id: jaExiste.id } }
  }

  // Buscar definição + versão atual
  const { data: def, error: defErr } = await db
    .from('flow_definitions')
    .select('*, flow_versions!flow_versions_definition_id_fkey(*)')
    .eq('id', definition_id)
    .eq('ativo', true)
    .single()

  if (defErr || !def) {
    return { status: 404, body: { error: 'Processo não encontrado ou inativo' } }
  }

  const version = def.flow_versions?.find(v => v.is_current)
  if (!version) {
    return { status: 404, body: { error: 'Nenhuma versão ativa para este processo' } }
  }

  // Buscar etapa inicial
  const { data: stepInicial, error: stepErr } = await db
    .from('flow_steps')
    .select('*')
    .eq('version_id', version.id)
    .eq('is_initial', true)
    .single()

  if (stepErr || !stepInicial) {
    return { status: 500, body: { error: 'Processo sem etapa inicial configurada' } }
  }

  // Criar instância
  const { data: instancia, error: instErr } = await db
    .from('flow_instances')
    .insert({
      workspace_id,
      definition_id,
      version_id: version.id,
      entidade_tipo,
      entidade_id,
      current_step_id: stepInicial.id,
      status: 'ativo',
      iniciado_por: iniciado_por || null,
      dados_contexto: dados_contexto || {},
    })
    .select()
    .single()

  if (instErr || !instancia) {
    return { status: 500, body: { error: 'Erro ao criar instância', detail: instErr?.message } }
  }

  // Registrar no histórico
  await db.from('flow_history').insert({
    instance_id:       instancia.id,
    step_id:           stepInicial.id,
    workspace_id,
    acao_nome:         'inicio',
    executado_por_id:  iniciado_por || null,
    origem:            'sistema',
    step_destino_nome: stepInicial.nome,
    status_depois:     stepInicial.status_valor,
    dados:             dados_contexto || {},
  })

  // Atualizar status na entidade de negócio
  if (def.tipo_entidade) {
    await db.from(def.tipo_entidade)
      .update({ status: stepInicial.status_valor, updated_at: new Date().toISOString() })
      .eq('id', entidade_id)
    // silencioso — tabela pode não ter updated_at
  }

  // Resolver responsável e criar tarefa
  await criarTarefaParaEtapa(db, instancia, stepInicial, null)

  return {
    status: 201,
    body: {
      ok: true,
      instance_id: instancia.id,
      current_step: { id: stepInicial.id, nome: stepInicial.nome, status_valor: stepInicial.status_valor },
    }
  }
}

// ─────────────────────────────────────────────
// AÇÃO: execute — executa uma ação e avança a instância
// ─────────────────────────────────────────────
async function handleExecute(db, body) {
  const {
    instance_id,     // uuid da instância
    acao_id,         // uuid da ação a executar
    executado_por,   // user_id de quem executa
    dados,           // { motivo, valor_aprovado, observacao, ... }
    origem,          // 'humano' | 'whatsapp' | 'sistema' | 'webhook'
  } = body

  if (!instance_id || !acao_id) {
    return { status: 400, body: { error: 'instance_id e acao_id são obrigatórios' } }
  }

  // ── 1. Carregar instância atual ──────────────────────────
  const { data: instancia, error: instErr } = await db
    .from('flow_instances')
    .select('*')
    .eq('id', instance_id)
    .single()

  if (instErr || !instancia) {
    return { status: 404, body: { error: 'Instância não encontrada' } }
  }

  if (instancia.status !== 'ativo') {
    return { status: 409, body: { error: `Instância está ${instancia.status} e não pode ser avançada` } }
  }

  // ── 2. Carregar etapa atual e ação ───────────────────────
  const { data: stepAtual } = await db
    .from('flow_steps')
    .select('*')
    .eq('id', instancia.current_step_id)
    .single()

  if (!acao_id) {
    return { status: 400, body: { error: 'acao_id é obrigatório' } }
  }

  // Buscar ação apenas pelo id (sem filtro step_id para evitar falsos negativos)
  const { data: acao, error: acaoErr } = await db
    .from('flow_actions')
    .select('*')
    .eq('id', acao_id)
    .maybeSingle()

  console.error('[flow-engine execute] debug', {
    acao_id, current_step_id: instancia.current_step_id,
    acao_step_id: acao?.step_id, found: !!acao, acaoErr: acaoErr?.message,
  })

  if (!acao) {
    return { status: 403, body: { error: 'Ação não encontrada no banco de dados' } }
  }

  // Validar que a ação pertence à etapa atual
  if (acao.step_id !== instancia.current_step_id) {
    return { status: 403, body: { error: `Ação não pertence à etapa atual (step esperado: ${instancia.current_step_id}, step da ação: ${acao.step_id})` } }
  }

  // ── 3. Validar campos obrigatórios da ação ───────────────
  const camposObrig = acao.campos_obrigatorios || []
  for (const campo of camposObrig) {
    if (!dados?.[campo] && dados?.[campo] !== 0) {
      return { status: 422, body: { error: `Campo obrigatório ausente: ${campo}` } }
    }
  }

  // ── 4. Determinar próxima etapa via transições ───────────
  const { data: transicoes, error: transErr } = await db
    .from('flow_transitions')
    .select('*')
    .eq('version_id', instancia.version_id)
    .eq('step_origem_id', instancia.current_step_id)
    .eq('acao_id', acao_id)
    .order('ordem', { ascending: true })

  console.error('[flow-engine execute] transicoes', {
    version_id: instancia.version_id, step_origem_id: instancia.current_step_id,
    acao_id, found: transicoes?.length ?? 0, err: transErr?.message,
  })

  // Contexto de avaliação = dados_contexto da instância + dados da ação
  const contextoAvaliacao = {
    ...(instancia.dados_contexto || {}),
    ...(dados || {}),
  }

  let proximaStep = null
  for (const transicao of transicoes || []) {
    if (avaliarCondicao(transicao.condicao, contextoAvaliacao)) {
      // Buscar step destino diretamente (mais confiável que join)
      if (transicao.step_destino_id) {
        const { data: s } = await db
          .from('flow_steps')
          .select('*')
          .eq('id', transicao.step_destino_id)
          .single()
        proximaStep = s
      }
      break
    }
  }

  if (!proximaStep) {
    // Se a ação não tem transição, e a etapa atual é de aprovação, verificar ação.tipo
    if (acao.tipo === 'cancelar' || acao.nome === 'cancelar') {
      // Buscar etapa de cancelamento
      const { data: stepCancel } = await db
        .from('flow_steps')
        .select('*')
        .eq('version_id', instancia.version_id)
        .eq('tipo', 'cancelado')
        .maybeSingle()
      proximaStep = stepCancel
    }
  }

  if (!proximaStep) {
    return { status: 422, body: { error: 'Nenhuma transição válida encontrada para esta ação e contexto' } }
  }

  // ── 5. Calcular SLA da próxima etapa ─────────────────────
  const { data: slaRule } = await db
    .from('flow_sla_rules')
    .select('*')
    .eq('step_id', proximaStep.id)
    .maybeSingle()

  const slaVenceEm = slaRule
    ? calcularSlaVence(slaRule.prazo_horas, slaRule.tipo_calendario)
    : null

  // ── 6. Atualizar instância ────────────────────────────────
  const isFinal = proximaStep.is_final

  const { error: updErr } = await db
    .from('flow_instances')
    .update({
      current_step_id: proximaStep.id,
      status:          isFinal ? 'concluido' : 'ativo',
      sla_vence_em:    slaVenceEm,
      concluido_em:    isFinal ? new Date().toISOString() : null,
      dados_contexto:  { ...(instancia.dados_contexto || {}), ...contextoAvaliacao },
      updated_at:      new Date().toISOString(),
    })
    .eq('id', instance_id)

  if (updErr) {
    return { status: 500, body: { error: 'Erro ao atualizar instância', detail: updErr.message } }
  }

  // ── 7. Registrar histórico imutável ───────────────────────
  await db.from('flow_history').insert({
    instance_id:       instance_id,
    step_id:           proximaStep.id,
    workspace_id:      instancia.workspace_id,
    acao_id:           acao_id,
    acao_nome:         acao.nome,
    executado_por_id:  executado_por || null,
    origem:            origem || 'humano',
    step_origem_nome:  stepAtual?.nome,
    step_destino_nome: proximaStep.nome,
    status_antes:      stepAtual?.status_valor,
    status_depois:     proximaStep.status_valor,
    dados:             dados || {},
  })

  // ── 8. Fechar tarefas anteriores da instância ─────────────
  await db.from('flow_tasks')
    .update({ status: 'concluida', concluida_em: new Date().toISOString(), acao_executada: acao.nome, updated_at: new Date().toISOString() })
    .eq('instance_id', instance_id)
    .eq('status', 'pendente')

  // ── 9. Atualizar status na entidade de negócio ────────────
  const { data: def } = await db
    .from('flow_definitions')
    .select('tipo_entidade')
    .eq('id', instancia.definition_id)
    .single()

  if (def?.tipo_entidade) {
    const updatePayload = { status: proximaStep.status_valor }
    // Campos opcionais que a entidade pode ter
    if (dados?.valor_aprovado !== undefined)      updatePayload.valor_aprovado = dados.valor_aprovado
    if (dados?.justificativa_recusa !== undefined) updatePayload.justificativa_recusa = dados.justificativa_recusa
    if (dados?.observacao !== undefined)           updatePayload.observacoes = dados.observacao

    await db.from(def.tipo_entidade)
      .update(updatePayload)
      .eq('id', instancia.entidade_id)
    // erro ignorado silenciosamente
  }

  // ── 10. Criar tarefas para o responsável da próxima etapa ─
  if (!isFinal) {
    await criarTarefaParaEtapa(db, { ...instancia, current_step_id: proximaStep.id }, proximaStep, acao)
  }

  // ── 11. Disparar notificações configuradas ────────────────
  await dispararNotificacoes(db, instancia, proximaStep, acao, dados, executado_por)

  return {
    status: 200,
    body: {
      ok: true,
      instance_id,
      step_anterior: { id: stepAtual?.id, nome: stepAtual?.nome, status: stepAtual?.status_valor },
      step_atual:    { id: proximaStep.id, nome: proximaStep.nome, status: proximaStep.status_valor },
      concluido:     isFinal,
      sla_vence_em:  slaVenceEm,
    }
  }
}

// ─────────────────────────────────────────────
// Cria tarefa para o responsável da etapa
// ─────────────────────────────────────────────
async function criarTarefaParaEtapa(db, instancia, step, acaoAnterior) {
  // Buscar responsáveis configurados para a etapa
  const { data: responsaveis } = await db
    .from('flow_responsibles')
    .select('*')
    .eq('step_id', step.id)
    .order('prioridade', { ascending: true })

  if (!responsaveis || responsaveis.length === 0) return

  // Buscar dados da entidade para resolução dinâmica
  const { data: def } = await db
    .from('flow_definitions')
    .select('tipo_entidade')
    .eq('id', instancia.definition_id)
    .single()
    .catch(() => ({ data: null }))

  let entidadeData = null
  if (def?.tipo_entidade) {
    const { data } = await db
      .from(def.tipo_entidade)
      .select('*')
      .eq('id', instancia.entidade_id)
      .single()
      .catch(() => ({ data: null }))
    entidadeData = data
  }

  // Calcular SLA
  const { data: slaRule } = await db
    .from('flow_sla_rules')
    .select('*')
    .eq('step_id', step.id)
    .maybeSingle()
    .catch(() => ({ data: null }))

  const slaVenceEm = slaRule
    ? calcularSlaVence(slaRule.prazo_horas, slaRule.tipo_calendario)
    : null

  // Resolver o primeiro responsável com sucesso
  for (const resp of responsaveis) {
    const resolvido = await resolverResponsavel(db, resp, instancia, entidadeData)
    if (!resolvido) continue

    await db.from('flow_tasks').insert({
      instance_id:     instancia.id,
      step_id:         step.id,
      workspace_id:    instancia.workspace_id,
      responsavel_id:  resolvido.user_id || null,
      responsavel_tipo: resp.tipo,
      responsavel_nome: resolvido.nome,
      titulo:          `${step.nome}`,
      descricao:       step.descricao || null,
      status:          'pendente',
      sla_vence_em:    slaVenceEm,
    })
    break // apenas o primeiro responsável resolvido
  }
}

// ─────────────────────────────────────────────
// Disparar notificações configuradas
// ─────────────────────────────────────────────
async function dispararNotificacoes(db, instancia, proximaStep, acao, dados, executadoPorId) {
  const { data: notifs } = await db
    .from('flow_notifications')
    .select('*')
    .eq('step_id', proximaStep.id)
    .eq('evento', 'entrada_etapa')
    .eq('ativo', true)

  if (!notifs || notifs.length === 0) return

  // Buscar dados do executor
  let nomeExecutor = 'Sistema'
  if (executadoPorId) {
    const { data: userMeta } = await db
      .rpc('get_user_name', { uid: executadoPorId })
    nomeExecutor = userMeta || 'Usuário'
  }

  // Variáveis disponíveis para templates
  const vars = {
    processo_nome:    '',
    etapa_nome:       proximaStep.nome,
    status:           proximaStep.status_valor,
    executado_por:    nomeExecutor,
    ...(instancia.dados_contexto || {}),
    ...(dados || {}),
  }

  for (const notif of notifs) {
    if (notif.canal !== 'whatsapp') continue // outros canais: implementar futuramente

    const texto = renderTemplate(notif.template_texto, vars)

    if (notif.destinatario_tipo === 'responsavel_atual') {
      // Buscar tarefa recém-criada para obter o telefone
      const { data: task } = await db
        .from('flow_tasks')
        .select('responsavel_nome, responsavel_id')
        .eq('instance_id', instancia.id)
        .eq('step_id', proximaStep.id)
        .eq('status', 'pendente')
        .maybeSingle()
        .catch(() => ({ data: null }))

      if (task?.responsavel_id) {
        // Tentar buscar telefone do usuário nas configurações
        const { data: cfgTel } = await db
          .from('configuracoes')
          .select('valor')
          .eq('workspace_id', instancia.workspace_id)
          .eq('chave', `telefone_usuario_${task.responsavel_id}`)
          .maybeSingle()
          .catch(() => ({ data: null }))

        if (cfgTel?.valor) {
          await sendWA(cfgTel.valor, texto)
        }
      }
    }

    if (notif.destinatario_tipo === 'fixo' && notif.destinatario_config?.telefone) {
      await sendWA(notif.destinatario_config.telefone, texto)
    }
  }
}

// ─────────────────────────────────────────────
// AÇÃO: tasks — tarefas pendentes do usuário
// ─────────────────────────────────────────────
async function handleTasks(db, query) {
  const { user_id, workspace_id, status = 'pendente' } = query

  if (!user_id && !workspace_id) {
    return { status: 400, body: { error: 'user_id ou workspace_id é obrigatório' } }
  }

  let q = db.from('flow_tasks')
    .select(`
      *,
      flow_instances!inner(entidade_tipo, entidade_id, dados_contexto, definition_id),
      flow_steps(nome, status_valor, config)
    `)
    .eq('status', status)
    .order('sla_vence_em', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (user_id)      q = q.eq('responsavel_id', user_id)
  if (workspace_id) q = q.eq('workspace_id', workspace_id)

  const { data, error } = await q

  if (error) {
    return { status: 500, body: { error: error.message } }
  }

  // Enriquecer com nome do processo
  const tasks = await Promise.all((data || []).map(async (task) => {
    const defId = task.flow_instances?.definition_id
    let processo_nome = null
    if (defId) {
      const { data: def } = await db
        .from('flow_definitions')
        .select('nome')
        .eq('id', defId)
        .single()
        .catch(() => ({ data: null }))
      processo_nome = def?.nome
    }
    return { ...task, processo_nome }
  }))

  return { status: 200, body: { tasks, total: tasks.length } }
}

// ─────────────────────────────────────────────
// AÇÃO: instance — estado atual da instância
// ─────────────────────────────────────────────
async function handleInstance(db, query) {
  const { instance_id, entidade_tipo, entidade_id } = query

  let instancia = null

  if (instance_id) {
    const { data } = await db
      .from('flow_instances')
      .select('*, flow_steps(nome, status_valor, tipo, config)')
      .eq('id', instance_id)
      .single()
    instancia = data
  } else if (entidade_tipo && entidade_id) {
    const { data } = await db
      .from('flow_instances')
      .select('*, flow_steps(nome, status_valor, tipo, config)')
      .eq('entidade_tipo', entidade_tipo)
      .eq('entidade_id', entidade_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    instancia = data
  }

  if (!instancia) {
    return { status: 404, body: { error: 'Instância não encontrada' } }
  }

  // Histórico recente
  const { data: historico } = await db
    .from('flow_history')
    .select('*')
    .eq('instance_id', instancia.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Tarefas pendentes
  const { data: tarefas } = await db
    .from('flow_tasks')
    .select('*')
    .eq('instance_id', instancia.id)
    .eq('status', 'pendente')

  return {
    status: 200,
    body: { instancia, historico: historico || [], tarefas_pendentes: tarefas || [] }
  }
}

// ─────────────────────────────────────────────
// AÇÃO: actions — ações disponíveis para o usuário na instância
// ─────────────────────────────────────────────
async function handleActions(db, query) {
  const { instance_id } = query

  if (!instance_id) {
    return { status: 400, body: { error: 'instance_id é obrigatório' } }
  }

  const { data: instancia } = await db
    .from('flow_instances')
    .select('*')
    .eq('id', instance_id)
    .eq('status', 'ativo')
    .single()

  if (!instancia) {
    return { status: 404, body: { error: 'Instância ativa não encontrada' } }
  }

  const { data: acoes } = await db
    .from('flow_actions')
    .select('*')
    .eq('step_id', instancia.current_step_id)
    .order('tipo', { ascending: true })

  return {
    status: 200,
    body: {
      instance_id,
      current_step_id: instancia.current_step_id,
      acoes: acoes || [],
    }
  }
}

// ─────────────────────────────────────────────
// AÇÃO: simulate — simula fluxo sem criar instância
// ─────────────────────────────────────────────
async function handleSimulate(db, body) {
  const { definition_id, cenario } = body

  if (!definition_id || !cenario) {
    return { status: 400, body: { error: 'definition_id e cenario são obrigatórios' } }
  }

  const { data: def } = await db
    .from('flow_definitions')
    .select('*, flow_versions!flow_versions_definition_id_fkey(*, flow_steps(*, flow_actions(*), flow_transitions(*)))')
    .eq('id', definition_id)
    .single()

  if (!def) {
    return { status: 404, body: { error: 'Processo não encontrado' } }
  }

  const version = def.flow_versions?.find(v => v.is_current)
  if (!version) {
    return { status: 404, body: { error: 'Sem versão ativa' } }
  }

  const steps = version.flow_steps || []
  const stepMap = Object.fromEntries(steps.map(s => [s.id, s]))
  const stepInicial = steps.find(s => s.is_initial)

  if (!stepInicial) {
    return { status: 422, body: { error: 'Processo sem etapa inicial' } }
  }

  // Percorrer o fluxo automaticamente baseado no cenário
  const caminho = []
  let stepAtual = stepInicial
  const visitados = new Set()
  const contexto = { ...cenario }

  while (stepAtual && !stepAtual.is_final && !visitados.has(stepAtual.id)) {
    visitados.add(stepAtual.id)
    caminho.push({
      id:     stepAtual.id,
      nome:   stepAtual.nome,
      status: stepAtual.status_valor,
      acoes:  stepAtual.flow_actions?.map(a => a.label) || [],
    })

    // Encontrar a primeira transição válida sem ação específica (caminho padrão)
    const transicoes = stepAtual.flow_transitions?.filter(t => !t.acao_id) || []
    const transicaoValida = transicoes.find(t => avaliarCondicao(t.condicao, contexto))

    if (!transicaoValida) break
    stepAtual = stepMap[transicaoValida.step_destino_id] || null
  }

  if (stepAtual && stepAtual.is_final) {
    caminho.push({ id: stepAtual.id, nome: stepAtual.nome, status: stepAtual.status_valor, acoes: [] })
  }

  return {
    status: 200,
    body: {
      processo: def.nome,
      versao:   version.versao,
      cenario,
      caminho,
      total_etapas: caminho.length,
    }
  }
}

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  const action = req.query?.action || (req.body?.action)

  if (!action) {
    return res.status(400).json({ error: 'Parâmetro action é obrigatório' })
  }

  const db = getDb()
  let result

  try {
    if (req.method === 'POST') {
      switch (action) {
        case 'start':    result = await handleStart(db, req.body);    break
        case 'execute':  result = await handleExecute(db, req.body);  break
        case 'simulate': result = await handleSimulate(db, req.body); break
        default:
          return res.status(400).json({ error: `Ação POST desconhecida: ${action}` })
      }
    } else if (req.method === 'GET') {
      switch (action) {
        case 'tasks':    result = await handleTasks(db, req.query);   break
        case 'instance': result = await handleInstance(db, req.query); break
        case 'actions':  result = await handleActions(db, req.query);  break
        default:
          return res.status(400).json({ error: `Ação GET desconhecida: ${action}` })
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    return res.status(result.status).json(result.body)
  } catch (err) {
    console.error('[flow-engine] erro inesperado:', err)
    return res.status(500).json({ error: 'Erro interno do motor de fluxo', detail: err?.message })
  }
}

export { handleStart, handleExecute }
