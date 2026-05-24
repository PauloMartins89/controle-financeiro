/**
 * GET  /api/refeicoes?action=load&token=xxx
 *      → Carrega dados do formulário público (por token_lider)
 *
 * POST /api/refeicoes  { action:'submit', token, dataRefeicao, restauranteId, itens[], observacoes }
 *      → Salva pedido, muda status para pendente, notifica supervisor e líder
 *
 * POST /api/refeicoes  { action:'aprovar', token, acao:'aprovado'|'reprovado', motivo? }
 *      → Supervisor aprova ou reprova (via app admin)
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { handleStart, handleExecute } from './flow-engine.js'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
    { realtime: { params: { log_level: 'disabled' }, transport: ws }, global: {} }
  )
}

async function sendWA(to, text) {
  const phone = String(to).replace(/\D/g, '')
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
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error(`[refeicoes] sendWA falhou ${res.status} para ${phone}:`, errBody)
    }
    return res.ok
  } catch (err) {
    console.error(`[refeicoes] sendWA exception para ${phone}:`, err.message)
    return false
  }
}

const APP_URL = process.env.APP_URL || 'https://dividiai.app.br'

// ── Helper: disparar fluxo restaurante após aprovação ────────────────────────
// Chamado tanto pelo aprovar (admin) quanto pelo aprovar-link (supervisor).
// 1. Notifica restaurante via WA (com link de confirmação se confirma_pedido=true)
// 2. Atualiza status para 'enviado_restaurante'
// 3. Notifica líder que pedido foi aprovado e restaurante notificado
async function triggerRestauranteFlow(db, sol, itens) {
  const [{ data: rest }, { data: equipe }] = await Promise.all([
    db.from('refei_restaurantes').select('*').eq('id', sol.restaurante_id).maybeSingle(),
    db.from('refei_equipes').select('nome').eq('id', sol.equipe_id).maybeSingle(),
  ])

  const now     = new Date().toISOString()
  const nomes   = (itens || []).map(i => `• ${i.colaborador_nome}${i.refeicao ? ' 🍽️' : ''}${i.cafe ? ' ☕' : ''}`)
  const qtdRef  = (itens || []).filter(i => i.refeicao).length
  const qtdCafe = (itens || []).filter(i => i.cafe).length

  // Notifica restaurante — sempre com link externo (como o supervisor recebe /ar/:token)
  if (rest?.telefone_wa) {
    const linkRestaurante = `${APP_URL}/rc/${sol.token_restaurante}`
    const confirmaLinha = rest.confirma_pedido
      ? `\n\n✅ *Confirme o recebimento do pedido:*\n${linkRestaurante}`
      : `\n\n📋 *Acesse os detalhes do pedido:*\n${linkRestaurante}`

    const msg = [
      `🏪 *Pedido Confirmado: ${sol.ticket || sol.numero_pedido}*`,
      `Equipe: ${equipe?.nome || '—'}`,
      sol.lider_nome       ? `Solicitante: ${sol.lider_nome}` : null,
      sol.supervisor_nome  ? `Aprovador: ${sol.supervisor_nome}` : null,
      `📅 Data: ${fmtData(sol.data_refeicao)}`,
      `─────────────────────`,
      ...nomes,
      `─────────────────────`,
      `🍽️ ${qtdRef} refeição(ões)  ☕ ${qtdCafe} café(s)`,
      `*Total: ${fmtBRL(sol.valor_total)}*${confirmaLinha}`,
    ].filter(v => v !== null).join('\n')
    await sendWA(rest.telefone_wa, msg)
  }

  // Atualiza status → enviado_restaurante
  await db.from('refei_solicitacoes').update({
    status:              'enviado_restaurante',
    env_restaurante_em:  now,
  }).eq('id', sol.id)

  await logEvento(db, {
    solicitacaoId: sol.id,
    tipo:          'enviado_restaurante',
    descricao:     `Pedido enviado ao restaurante ${rest?.nome || ''}`.trim(),
    ator:          'Sistema',
    atorTipo:      'sistema',
  })

  // Notifica líder
  const msgLider = rest?.confirma_pedido
    ? `✅ Pedido *${sol.ticket || sol.numero_pedido}* aprovado!\n📅 Data: ${fmtData(sol.data_refeicao)}\n\nO restaurante receberá a solicitação e confirmará o recebimento.`
    : `✅ Pedido *${sol.ticket || sol.numero_pedido}* aprovado!\n📅 Data: ${fmtData(sol.data_refeicao)}\n\nO restaurante foi notificado. Você receberá confirmação no dia da entrega.`
  if (sol.lider_telefone) await sendWA(sol.lider_telefone, msgLider)

  return rest
}

function fmtBRL(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtData(d) {
  if (!d) return '—'
  return String(d).split('-').reverse().join('/')
}

// ── Helper: registra evento na timeline do pedido ────────────────────────────
async function logEvento(db, { solicitacaoId, tipo, descricao, ator, atorTipo = 'sistema', dados }) {
  const { error } = await db.from('refei_pedido_eventos').insert({
    solicitacao_id: solicitacaoId,
    tipo,
    descricao,
    ator:      ator || null,
    ator_tipo: atorTipo,
    dados:     dados || null,
  })
  if (error) console.error(`[refeicoes] logEvento(${tipo}):`, error.message)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // (flow engine rotas tratadas diretamente em /api/flow-engine)

  const db = getDb()
  const action = req.query?.action || req.body?.action

  // ── GET: carrega formulário por token do líder ────────────────────────────
  if (req.method === 'GET' && action === 'load') {
    const { token } = req.query
    if (!token) return res.status(400).json({ error: 'Token obrigatório' })

    const { data: sol } = await db
      .from('refei_solicitacoes')
      .select('*')
      .eq('token_lider', token)
      .maybeSingle()

    if (!sol) return res.status(404).json({ error: 'Link inválido ou expirado' })
    if (!['rascunho', 'reprovado'].includes(sol.status)) {
      return res.status(409).json({ error: 'Este pedido já foi enviado', status: sol.status, numeroPedido: sol.numero_pedido })
    }

    const [
      { data: equipe },
      { data: colaboradores },
      { data: restaurantes },
      { data: itens },
    ] = await Promise.all([
      db.from('refei_equipes').select('*').eq('id', sol.equipe_id).maybeSingle(),
      db.from('refei_colaboradores').select('*').eq('equipe_id', sol.equipe_id).eq('ativo', true).order('nome'),
      db.from('refei_restaurantes').select('*').eq('workspace_id', sol.workspace_id).eq('ativo', true).order('nome'),
      db.from('refei_itens').select('*').eq('solicitacao_id', sol.id),
    ])

    return res.status(200).json({
      sol,
      equipe:        equipe || null,
      colaboradores: colaboradores || [],
      restaurantes:  restaurantes || [],
      itens:         itens || [],
    })
  }

  // ── POST: submeter pedido ─────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'submit') {
    const { token, dataRefeicao, restauranteId, itens, observacoes } = req.body || {}

    if (!token)         return res.status(400).json({ error: 'Token obrigatório' })
    if (!restauranteId) return res.status(400).json({ error: 'Selecione um restaurante' })
    if (!dataRefeicao)  return res.status(400).json({ error: 'Selecione a data' })
    if (!itens?.some(i => i.refeicao || i.cafe)) return res.status(400).json({ error: 'Marque pelo menos um item' })

    // Extras precisam de justificativa
    const extrasSemJustificativa = (itens || []).filter(i => i.extra && !(i.justificativa || '').trim())
    if (extrasSemJustificativa.length > 0) {
      return res.status(400).json({ error: `Justificativa obrigatória para: ${extrasSemJustificativa.map(i => i.colaboradorNome).join(', ')}` })
    }

    const { data: sol } = await db.from('refei_solicitacoes').select('*').eq('token_lider', token).maybeSingle()
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })
    if (!['rascunho', 'reprovado'].includes(sol.status)) {
      return res.status(409).json({ error: 'Pedido já enviado', status: sol.status })
    }

    const { data: rest } = await db.from('refei_restaurantes').select('*').eq('id', restauranteId).maybeSingle()
    if (!rest) return res.status(400).json({ error: 'Restaurante não encontrado' })

    const totalRef  = itens.filter(i => i.refeicao).length
    const totalCafe = itens.filter(i => i.cafe).length
    const valorRef  = Number(rest.valor_refeicao || 0)
    const valorCafe = Number(rest.valor_cafe || 0)
    const valorTotal = (totalRef * valorRef) + (totalCafe * valorCafe)

    // Número sequencial do pedido por workspace
    const { count } = await db
      .from('refei_solicitacoes')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', sol.workspace_id)
      .neq('status', 'rascunho')
    const year = new Date().getFullYear()
    const numeroPedido = `REF-${year}-${String((count || 0) + 1).padStart(6, '0')}`

    // Atualiza solicitação — apenas campos garantidos pelo schema base
    const { error: updErr } = await db.from('refei_solicitacoes').update({
      restaurante_id:  restauranteId,
      data_refeicao:   dataRefeicao,
      numero_pedido:   numeroPedido,
      status:          'aguardando_aprovacao',
      total_refeicoes: totalRef,
      total_cafes:     totalCafe,
      valor_refeicao:  valorRef,
      valor_cafe:      valorCafe,
      valor_total:     valorTotal,
      observacoes:     observacoes || null,
    }).eq('id', sol.id)

    if (updErr) {
      console.error('[refeicoes] submit – update solicitacao falhou:', updErr.message)
      return res.status(500).json({ error: 'Erro ao salvar pedido. Tente novamente.' })
    }

    // Campo ticket (requer migration add_refei_fluxo.sql) — atualiza separado, falha silenciosa
    await db.from('refei_solicitacoes').update({ ticket: numeroPedido }).eq('id', sol.id)

    // Recria itens
    await db.from('refei_itens').delete().eq('solicitacao_id', sol.id)
    const itensInsert = itens
      .filter(i => i.refeicao || i.cafe)
      .map(i => ({
        solicitacao_id:   sol.id,
        colaborador_id:   i.colaboradorId || null,
        colaborador_nome: i.colaboradorNome,
        refeicao:         !!i.refeicao,
        cafe:             !!i.cafe,
        extra:            !!i.extra,
        justificativa:    i.extra ? (i.justificativa || null) : null,
      }))
    if (itensInsert.length) await db.from('refei_itens').insert(itensInsert)

    // Registra eventos na timeline
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'pedido_criado', descricao: `Pedido ${numeroPedido} criado por ${sol.lider_nome || 'líder'}`, ator: sol.lider_nome, atorTipo: 'lider' })
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'enviado_aprovacao', descricao: 'Enviado para aprovação do supervisor', ator: sol.lider_nome, atorTipo: 'lider' })

    // Notifica supervisor via WA com lista completa de colaboradores
    // Sempre busca da equipe para garantir telefone atualizado (ignora o valor do rascunho que pode estar desatualizado)
    const { data: equipeData } = await db.from('refei_equipes').select('nome, supervisor_telefone, supervisor_nome').eq('id', sol.equipe_id).maybeSingle()
    const supervisorTel = equipeData?.supervisor_telefone || sol.supervisor_telefone
    // Salva supervisor_telefone atualizado na solicitação para uso futuro (cron, reenvios)
    if (equipeData?.supervisor_telefone) {
      await db.from('refei_solicitacoes').update({ supervisor_telefone: equipeData.supervisor_telefone }).eq('id', sol.id)
    }
    if (!supervisorTel) {
      console.warn(`[refeicoes] submit – supervisor_telefone vazio para equipe ${sol.equipe_id}, pedido ${numeroPedido}`)
    }
    if (supervisorTel) {
      const itensNormais = itens.filter(i => !i.extra && (i.refeicao || i.cafe))
      const itensExtras  = itens.filter(i =>  i.extra && (i.refeicao || i.cafe))

      const linhasColab = itensNormais.map(i => {
        const icones = [i.refeicao ? '🍽️' : '', i.cafe ? '☕' : ''].filter(Boolean).join(' ')
        return `• ${i.colaboradorNome} — ${icones}`
      })
      const linhasExtras = itensExtras.map(i => {
        const icones = [i.refeicao ? '🍽️' : '', i.cafe ? '☕' : ''].filter(Boolean).join(' ')
        return `⚠️ ${i.colaboradorNome} — ${icones} — "${i.justificativa}"`
      })

      const msgSup = [
        `🍽️ *Solicitação de Refeição — ${numeroPedido}*`,
        `Equipe: ${equipeData?.nome || '—'}`,
        `Solicitante: ${sol.lider_nome || '—'}`,
        `📅 Data: ${fmtData(dataRefeicao)}`,
        `🏪 Restaurante: ${rest.nome}`,
        ``,
        `👥 *Colaboradores (${linhasColab.length}):*`,
        ...linhasColab,
        ...(linhasExtras.length > 0 ? [
          ``,
          `⚠️ *Extras (${linhasExtras.length}) — com justificativa:*`,
          ...linhasExtras,
        ] : []),
        ``,
        `🍽️ ${totalRef} refeição(ões)  ·  ☕ ${totalCafe} café(s)  ·  *${fmtBRL(valorTotal)}*`,
        ``,
        `👇 Toque para aprovar ou reprovar (sem logar):`,
        `${APP_URL}/ar/${sol.token_aprovacao}`,
        ``,
        `Responda *SIM* para aprovar ou *NÃO* para reprovar.`,
      ].join('\n')
      await sendWA(supervisorTel, msgSup)
    }

    // Confirma para o líder
    if (sol.lider_telefone) {
      const msgLider = [
        `✅ *Pedido ${numeroPedido} enviado!*`,
        `Data: ${fmtData(dataRefeicao)}`,
        `Restaurante: ${rest.nome}`,
        `${totalRef} refeição(ões)` + (totalCafe > 0 ? ` · ${totalCafe} café(s)` : ''),
        `*Total: ${fmtBRL(valorTotal)}*`,
        ``,
        `Aguardando aprovação do supervisor.`,
      ].join('\n')
      await sendWA(sol.lider_telefone, msgLider)
    }

    // Auto-iniciar instância no Flow Engine (sempre que existir definição ativa)
    try {
      const { data: flowDef } = await db
        .from('flow_definitions')
        .select('id')
        .eq('workspace_id', sol.workspace_id)
        .eq('modulo', 'refeicoes')
        .eq('ativo', true)
        .maybeSingle()

      if (flowDef) {
        const startResult = await handleStart(db, {
          definition_id:  flowDef.id,
          entidade_tipo:  'refei_solicitacoes',
          entidade_id:    sol.id,
          workspace_id:   sol.workspace_id,
          dados_contexto: { valor_total: valorTotal, numero_pedido: numeroPedido },
        })

        if (startResult.status === 201) {
          // Executar ação 'enviar' para avançar do rascunho para pendente
          const { data: acaoEnviar } = await db
            .from('flow_actions')
            .select('id')
            .eq('step_id', startResult.body.current_step.id)
            .eq('nome', 'enviar')
            .maybeSingle()

          if (acaoEnviar) {
            await handleExecute(db, {
              instance_id:   startResult.body.instance_id,
              acao_id:       acaoEnviar.id,
              executado_por: null,
              dados:         {},
              origem:        'sistema',
            })
          }
        }
      }
    } catch (flowErr) {
      console.error('[refeicoes] flow auto-start error:', flowErr?.message)
      // silencioso — não bloqueia o submit
    }

    return res.status(200).json({ ok: true, numeroPedido, valorTotal })
  }

  // ── POST: notificar supervisor/líder após criação pelo app móvel ────────────
  if (req.method === 'POST' && action === 'notify-mobile') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'ID obrigatório' })

    const { data: sol } = await db
      .from('refei_solicitacoes')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })

    const [{ data: equipeRefei }, { data: liderEquipe }, { data: rest }, { data: itens }] = await Promise.all([
      db.from('refei_equipes').select('nome, supervisor_telefone, supervisor_nome').eq('id', sol.equipe_id).maybeSingle(),
      db.from('lider_equipes').select('nome, codigo').eq('id', sol.equipe_id).maybeSingle(),
      db.from('refei_restaurantes').select('nome').eq('id', sol.restaurante_id).maybeSingle(),
      db.from('refei_itens').select('*').eq('solicitacao_id', sol.id),
    ])
    // Consolida info da equipe: prefere refei_equipes (web), cai back para lider_equipes (mobile)
    const equipe = equipeRefei || (liderEquipe ? { nome: liderEquipe.nome, supervisor_telefone: null, supervisor_nome: null } : null)

    // Salva supervisor_telefone atualizado (para uso futuro)
    if (equipeRefei?.supervisor_telefone) {
      await db.from('refei_solicitacoes')
        .update({ supervisor_telefone: equipeRefei.supervisor_telefone, supervisor_nome: equipeRefei.supervisor_nome })
        .eq('id', sol.id)
    }

    // Registra eventos na timeline
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'pedido_criado',      descricao: `Pedido ${sol.numero_pedido} criado pelo app SmartLíder`, ator: sol.lider_nome, atorTipo: 'lider' })
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'enviado_aprovacao',  descricao: 'Enviado para aprovação do supervisor',                    ator: sol.lider_nome, atorTipo: 'lider' })

    const supervisorTel = equipe?.supervisor_telefone || sol.supervisor_telefone
    if (supervisorTel) {
      const itensNormais = (itens || []).filter(i => !i.extra)
      const itensExtras  = (itens || []).filter(i =>  i.extra)
      const qtdRef  = (itens || []).filter(i => i.refeicao).length
      const qtdCafe = (itens || []).filter(i => i.cafe).length

      const linhasColab  = itensNormais.map(i => {
        const ic = [i.refeicao ? '🍽️' : '', i.cafe ? '☕' : ''].filter(Boolean).join(' ')
        return `• ${i.colaborador_nome} — ${ic}`
      })
      const linhasExtras = itensExtras.map(i => {
        const ic = [i.refeicao ? '🍽️' : '', i.cafe ? '☕' : ''].filter(Boolean).join(' ')
        return `⚠️ ${i.colaborador_nome} — ${ic} — "${i.justificativa}"`
      })

      const msgSup = [
        `🍽️ *Solicitação de Refeição — ${sol.numero_pedido}*`,
        `Equipe: ${equipe?.nome || '—'}`,
        `Solicitante: ${sol.lider_nome || '—'}`,
        `📅 Data: ${fmtData(sol.data_refeicao)}`,
        `🏪 Restaurante: ${rest?.nome || '—'}`,
        ``,
        `👥 *Colaboradores (${linhasColab.length}):*`,
        ...linhasColab,
        ...(linhasExtras.length > 0 ? [``, `⚠️ *Extras (${linhasExtras.length}):*`, ...linhasExtras] : []),
        ``,
        `🍽️ ${qtdRef} refeição(ões)  ·  ☕ ${qtdCafe} café(s)  ·  *${fmtBRL(sol.valor_total)}*`,
        ``,
        `👇 Aprovar ou reprovar (sem login):`,
        `${APP_URL}/ar/${sol.token_aprovacao}`,
        ``,
        `Responda *SIM* para aprovar ou *NÃO* para reprovar.`,
      ].join('\n')
      await sendWA(supervisorTel, msgSup)
    }

    // Confirma ao líder (se tiver telefone)
    if (sol.lider_telefone) {
      const msgLider = [
        `✅ *Pedido ${sol.numero_pedido} enviado!*`,
        `📅 Data: ${fmtData(sol.data_refeicao)}`,
        `🏪 Restaurante: ${rest?.nome || '—'}`,
        `🍽️ ${(itens || []).filter(i => i.refeicao).length} refeição(ões)  ·  ☕ ${(itens || []).filter(i => i.cafe).length} café(s)`,
        `💰 Total: ${fmtBRL(sol.valor_total)}`,
        ``,
        `Aguardando aprovação do supervisor.`,
      ].join('\n')
      await sendWA(sol.lider_telefone, msgLider)
    }

    return res.status(200).json({ ok: true })
  }

  if (req.method === 'POST' && action === 'aprovar') {
    const { solicitacaoId, acao, motivo } = req.body || {}
    if (!solicitacaoId || !acao) return res.status(400).json({ error: 'Dados incompletos' })
    if (!['aprovado', 'reprovado'].includes(acao)) return res.status(400).json({ error: 'Ação inválida' })

    const { data: sol } = await db.from('refei_solicitacoes').select('*').eq('id', solicitacaoId).maybeSingle()
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })

    const now = new Date().toISOString()
    await db.from('refei_solicitacoes').update({
      status:             acao,
      motivo_reprovacao:  motivo || null,
      aprovado_em:        acao === 'aprovado' ? now : null,
    }).eq('id', sol.id)

    // Registra evento na timeline
    await logEvento(db, {
      solicitacaoId: sol.id,
      tipo:          acao,
      descricao:     acao === 'aprovado' ? 'Pedido aprovado pelo supervisor' : 'Pedido reprovado pelo supervisor',
      ator:          null,
      atorTipo:      'supervisor',
      dados:         motivo ? { motivo } : null,
    })

    // Notifica restaurante e avança status → enviado_restaurante
    if (acao === 'aprovado') {
      const { data: itens } = await db.from('refei_itens').select('*').eq('solicitacao_id', sol.id)
      await triggerRestauranteFlow(db, sol, itens)
    } else {
      // Notifica líder da reprovação
      if (sol.lider_telefone) {
        await sendWA(sol.lider_telefone, `❌ Pedido *${sol.numero_pedido}* reprovado.\nMotivo: ${motivo || '—'}\n\nAcesse o link para editar e reenviar: ${APP_URL}/refeicao/${sol.token_lider}`)
      }
    }

    return res.status(200).json({ ok: true, mensagem: acao === 'aprovado' ? 'Pedido aprovado e restaurante notificado!' : 'Pedido reprovado' })
  }

  // ── GET: carrega resumo para aprovação pública (token_aprovacao) ─────────
  if (req.method === 'GET' && action === 'load-aprovar') {
    const { token } = req.query
    if (!token) return res.status(400).json({ error: 'Token obrigatório' })

    const { data: sol } = await db
      .from('refei_solicitacoes')
      .select('*')
      .eq('token_aprovacao', token)
      .maybeSingle()

    if (!sol) return res.status(404).json({ error: 'Link inválido ou expirado' })

    const [
      { data: equipe },
      { data: rest },
      { data: itens },
    ] = await Promise.all([
      db.from('refei_equipes').select('nome, cdc').eq('id', sol.equipe_id).maybeSingle(),
      db.from('refei_restaurantes').select('nome').eq('id', sol.restaurante_id).maybeSingle(),
      db.from('refei_itens').select('*').eq('solicitacao_id', sol.id).order('colaborador_nome'),
    ])

    return res.status(200).json({
      sol,
      equipeNome:      equipe?.nome || null,
      equipeCdc:       equipe?.cdc  || null,
      restauranteNome: rest?.nome   || null,
      itens:           itens || [],
    })
  }

  // ── POST: aprovar/reprovar por link público (token_aprovacao) ─────────────
  if (req.method === 'POST' && action === 'aprovar-link') {
    try {
      const { token, acao, motivo } = req.body || {}
      if (!token || !acao) return res.status(400).json({ error: 'Dados incompletos' })
      if (!['aprovado', 'reprovado'].includes(acao)) return res.status(400).json({ error: 'Ação inválida' })

      const { data: sol, error: solErr } = await db
        .from('refei_solicitacoes')
        .select('*')
        .eq('token_aprovacao', token)
        .maybeSingle()

      if (solErr) {
        console.error('[refeicoes] aprovar-link lookup error:', solErr)
        return res.status(500).json({ error: 'Erro ao buscar solicitação' })
      }
      if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })
      if (!['pendente', 'aguardando_aprovacao'].includes(sol.status)) {
        return res.status(409).json({ error: 'Este pedido já foi processado', status: sol.status })
      }

      const { error: updErr } = await db.from('refei_solicitacoes').update({
        status:            acao,
        motivo_reprovacao: motivo || null,
        aprovado_em:       acao === 'aprovado' ? new Date().toISOString() : null,
      }).eq('id', sol.id)

      if (updErr) {
        console.error('[refeicoes] aprovar-link update error:', updErr)
        return res.status(500).json({ error: 'Erro ao atualizar solicitação' })
      }

      // Notifica restaurante e avança status → enviado_restaurante
      if (acao === 'aprovado') {
        const { data: itens } = await db.from('refei_itens').select('*').eq('solicitacao_id', sol.id)
        await triggerRestauranteFlow(db, sol, itens)
      } else {
        if (sol.lider_telefone) {
          await sendWA(sol.lider_telefone, `❌ Pedido *${sol.numero_pedido}* reprovado.\nMotivo: ${motivo || '—'}\n\nAcesse o link para editar e reenviar: ${APP_URL}/refeicao/${sol.token_lider}`)
        }
      }

      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('[refeicoes] aprovar-link unhandled error:', err)
      return res.status(500).json({ error: 'Erro interno ao processar aprovação' })
    }
  }

  // ── POST: gerar/enviar link para o líder (pelo admin) ────────────────────
  if (req.method === 'POST' && action === 'gerar-link') {
    const { equipeId } = req.body || {}
    if (!equipeId) return res.status(400).json({ error: 'equipeId obrigatório' })

    const { data: equipe } = await db.from('refei_equipes').select('*').eq('id', equipeId).maybeSingle()
    if (!equipe) return res.status(404).json({ error: 'Equipe não encontrada' })
    if (!equipe.lider_telefone) return res.status(400).json({ error: 'Equipe sem telefone do líder cadastrado' })

    // ── Bloqueio: líder tem pedido aguardando validação de entrega? ──────────
    const { data: bloqueado } = await db
      .from('refei_solicitacoes')
      .select('numero_pedido, data_refeicao, token_lider')
      .eq('equipe_id', equipeId)
      .eq('status', 'aguardando_validacao')
      .order('data_refeicao', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (bloqueado) {
      return res.status(409).json({
        error:          'bloqueado',
        mensagem:       `Confirme a entrega do pedido ${bloqueado.numero_pedido} (${fmtData(bloqueado.data_refeicao)}) antes de criar um novo pedido.`,
        link_validacao: `${APP_URL}/vr/${bloqueado.token_lider}`,
        numero_pedido:  bloqueado.numero_pedido,
      })
    }
    // ────────────────────────────────────────────────────────────────────────

    // Reusa rascunho existente ou cria novo
    const { data: existente } = await db
      .from('refei_solicitacoes')
      .select('token_lider, status')
      .eq('equipe_id', equipeId)
      .in('status', ['rascunho', 'reprovado'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    let tokenLider
    if (existente) {
      tokenLider = existente.token_lider
      // Atualiza supervisor_telefone caso tenha sido cadastrado/alterado após o rascunho ser criado
      await db.from('refei_solicitacoes').update({
        supervisor_telefone: equipe.supervisor_telefone,
        lider_nome:          equipe.lider_nome,
        lider_telefone:      equipe.lider_telefone,
      }).eq('token_lider', tokenLider)
    } else {
      const { data: novo } = await db.from('refei_solicitacoes').insert({
        workspace_id:        equipe.workspace_id,
        owner_id:            equipe.owner_id,
        equipe_id:           equipe.id,
        lider_nome:          equipe.lider_nome,
        lider_telefone:      equipe.lider_telefone,
        supervisor_telefone: equipe.supervisor_telefone,
        status:              'rascunho',
      }).select('token_lider').single()
      tokenLider = novo?.token_lider
    }

    if (!tokenLider) return res.status(500).json({ error: 'Falha ao criar solicitação' })

    const link = `${APP_URL}/refeicao/${tokenLider}`
    const reutilizado = !!existente

    await sendWA(
      equipe.lider_telefone,
      [
        `🍽️ *Solicitação de Refeição*`,
        `Olá${equipe.lider_nome ? ', ' + equipe.lider_nome : ''}!`,
        ``,
        `Clique para fazer o pedido da sua equipe:`,
        link,
        ``,
        `_Após enviar, aguarde aprovação do supervisor._`,
      ].join('\n')
    )

    return res.status(200).json({ ok: true, link, liderNome: equipe.lider_nome, reutilizado })
  }

  // ── POST: reenviar lembrete ao supervisor (manual, pelo admin) ────────────
  if (req.method === 'POST' && action === 'reenviar-supervisor') {
    const { solicitacaoId } = req.body || {}
    if (!solicitacaoId) return res.status(400).json({ error: 'solicitacaoId obrigatório' })

    const { data: sol } = await db
      .from('refei_solicitacoes')
      .select('*, refei_equipes(nome, cdc), refei_restaurantes(nome)')
      .eq('id', solicitacaoId)
      .maybeSingle()

    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })
    if (!['pendente', 'aguardando_aprovacao'].includes(sol.status)) return res.status(400).json({ error: 'Pedido não está aguardando aprovação' })
    if (!sol.supervisor_telefone) return res.status(400).json({ error: 'Supervisor sem telefone cadastrado' })

    const link = `${APP_URL}/ar/${sol.token_aprovacao}`
    const equipeInfo = sol.refei_equipes
    const { data: itens } = await db.from('refei_itens').select('colaborador_nome').eq('solicitacao_id', sol.id).order('colaborador_nome')

    const colaboradores = (itens || []).map(i => `• ${i.colaborador_nome}`).join('\n')
    const msg = [
      `🔔 *Lembrete: Pedido aguardando sua aprovação*`,
      ``,
      `*Pedido:* ${sol.numero_pedido}`,
      `*Equipe:* ${equipeInfo?.nome || '—'}${equipeInfo?.cdc ? ' (CDC ' + equipeInfo.cdc + ')' : ''}`,
      `*Data:* ${fmtData(sol.data_refeicao)}`,
      `*Restaurante:* ${sol.refei_restaurantes?.nome || '—'}`,
      `*Total:* ${fmtBRL(sol.valor_total)} (${sol.total_refeicoes}🍽️ ${sol.total_cafes}☕)`,
      colaboradores ? `\n*Colaboradores:*\n${colaboradores}` : '',
      ``,
      `Toque para aprovar ou reprovar:`,
      link,
    ].filter(l => l !== null).join('\n')

    await sendWA(sol.supervisor_telefone, msg)

    return res.status(200).json({ ok: true })
  }

  // ── POST: consolidar ──────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'consolidar') {
    const { solicitacaoId, userId } = req.body || {}
    if (!solicitacaoId) return res.status(400).json({ error: 'solicitacaoId obrigatório' })
    const { data: sol } = await db.from('refei_solicitacoes').select('*').eq('id', solicitacaoId).maybeSingle()
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })
    if (sol.status !== 'aprovado') return res.status(409).json({ error: 'Apenas pedidos aprovados podem ser consolidados' })
    const now = new Date().toISOString()
    await db.from('refei_solicitacoes').update({ status: 'consolidado', consolidado_em: now }).eq('id', sol.id)
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'consolidado', descricao: 'Pedido consolidado — ticket gerado e pronto para envio', ator: 'Sistema', atorTipo: 'sistema' })
    return res.status(200).json({ ok: true, mensagem: 'Pedido consolidado! 📦' })
  }

  // ── POST: enviar_restaurante ───────────────────────────────────────────────
  if (req.method === 'POST' && action === 'enviar_restaurante') {
    const { solicitacaoId, userId } = req.body || {}
    if (!solicitacaoId) return res.status(400).json({ error: 'solicitacaoId obrigatório' })
    const { data: sol } = await db.from('refei_solicitacoes')
      .select('*, refei_restaurantes(nome, telefone_wa, confirma_pedido)')
      .eq('id', solicitacaoId).maybeSingle()
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })
    if (sol.status !== 'consolidado') return res.status(409).json({ error: 'Pedido precisa estar consolidado' })
    const now = new Date().toISOString()
    const { data: itens } = await db.from('refei_itens').select('*').eq('solicitacao_id', sol.id).order('colaborador_nome')
    await db.from('refei_solicitacoes').update({ status: 'enviado_restaurante', env_restaurante_em: now }).eq('id', sol.id)
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'enviado_restaurante', descricao: `Pedido enviado ao restaurante ${sol.refei_restaurantes?.nome || ''}`.trim(), ator: 'Sistema', atorTipo: 'sistema', dados: { restaurante: sol.refei_restaurantes?.nome } })
    // Notifica restaurante via WA
    if (sol.refei_restaurantes?.telefone_wa) {
      const qtdRef  = (itens || []).filter(i => i.refeicao).length
      const qtdCafe = (itens || []).filter(i => i.cafe).length
      const nomes   = (itens || []).map(i => `• ${i.colaborador_nome}${i.refeicao ? ' 🍽️' : ''}${i.cafe ? ' ☕' : ''}`)
      const linkRestaurante = `${APP_URL}/rc/${sol.token_restaurante}`
      const confirmaLinha = sol.refei_restaurantes?.confirma_pedido
        ? `\n\n✅ *Confirme o recebimento do pedido:*\n${linkRestaurante}`
        : `\n\n📋 *Acesse os detalhes:*\n${linkRestaurante}`
      const msg = [
        `🏪 *Pedido Confirmado: ${sol.ticket || sol.numero_pedido}*`,
        `📅 Data: ${fmtData(sol.data_refeicao)}`,
        `─────────────────────`,
        ...nomes,
        `─────────────────────`,
        `🍽️ ${qtdRef} refeição(ões)  ☕ ${qtdCafe} café(s)`,
        `*Total: ${fmtBRL(sol.valor_total)}*${confirmaLinha}`,
      ].join('\n')
      await sendWA(sol.refei_restaurantes.telefone_wa, msg)
    }
    return res.status(200).json({ ok: true, mensagem: 'Pedido enviado ao restaurante! 🏪' })
  }

  // ── POST: registrar_entrega ────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'registrar_entrega') {
    const { solicitacaoId, userId } = req.body || {}
    if (!solicitacaoId) return res.status(400).json({ error: 'solicitacaoId obrigatório' })
    const { data: sol } = await db.from('refei_solicitacoes').select('*').eq('id', solicitacaoId).maybeSingle()
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })
    if (!['enviado_restaurante', 'em_acompanhamento'].includes(sol.status)) return res.status(409).json({ error: 'Status inválido para registrar entrega' })
    const now = new Date().toISOString()
    await db.from('refei_solicitacoes').update({ status: 'entregue', entregue_em: now }).eq('id', sol.id)
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'entrega_registrada', descricao: 'Entrega registrada pelo operador', ator: 'Operador', atorTipo: 'admin' })
    return res.status(200).json({ ok: true, mensagem: 'Entrega registrada! 🚚' })
  }

  // ── POST: enviar_validacao ─────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'enviar_validacao') {
    const { solicitacaoId } = req.body || {}
    if (!solicitacaoId) return res.status(400).json({ error: 'solicitacaoId obrigatório' })
    const { data: sol } = await db.from('refei_solicitacoes').select('*').eq('id', solicitacaoId).maybeSingle()
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })
    if (sol.status !== 'entregue') return res.status(409).json({ error: 'Pedido precisa estar entregue' })
    const now = new Date().toISOString()
    await db.from('refei_solicitacoes').update({ status: 'aguardando_validacao', validacao_env_em: now }).eq('id', sol.id)
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'validacao_enviada', descricao: 'Validação enviada ao líder para confirmação', ator: 'Sistema', atorTipo: 'sistema' })
    if (sol.lider_telefone) {
      const validUrl = `${APP_URL}/vr/${sol.token_lider}`
      await sendWA(sol.lider_telefone, [
        `🍽️ *Confirmação de Entrega — ${sol.ticket || sol.numero_pedido}*`,
        `Olá${sol.lider_nome ? ', ' + sol.lider_nome : ''}!`,
        ``,
        `Sua refeição do dia ${fmtData(sol.data_refeicao)} foi entregue conforme esperado?`,
        ``,
        `Acesse o link para confirmar:`,
        validUrl,
        ``,
        `Ou responda *SIM* se tudo certo, *NÃO* se houve problema.`,
      ].join('\n'))
    }
    return res.status(200).json({ ok: true, mensagem: 'Validação enviada ao líder! 📱' })
  }

  // ── POST: validar_entrega ──────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'validar_entrega') {
    const { solicitacaoId, resultado, ocorrencia, userId } = req.body || {}
    if (!solicitacaoId || !resultado) return res.status(400).json({ error: 'solicitacaoId e resultado obrigatórios' })
    if (!['correto', 'com_ocorrencia'].includes(resultado)) return res.status(400).json({ error: 'resultado inválido' })
    const { data: sol } = await db.from('refei_solicitacoes').select('*').eq('id', solicitacaoId).maybeSingle()
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })
    if (!['entregue', 'aguardando_validacao'].includes(sol.status)) return res.status(409).json({ error: 'Status inválido para validação' })
    const now = new Date().toISOString()
    const novoStatus = resultado === 'correto' ? 'finalizado' : 'finalizado_com_ocorrencia'
    await db.from('refei_solicitacoes').update({
      status:              novoStatus,
      validado_em:         now,
      resultado_validacao: resultado,
      ocorrencia:          ocorrencia || null,
    }).eq('id', sol.id)
    if (resultado === 'correto') {
      await logEvento(db, { solicitacaoId: sol.id, tipo: 'entrega_confirmada', descricao: 'Entrega confirmada pelo líder', ator: sol.lider_nome, atorTipo: 'lider' })
    } else {
      await logEvento(db, { solicitacaoId: sol.id, tipo: 'ocorrencia_registrada', descricao: 'Líder registrou ocorrência na entrega', ator: sol.lider_nome, atorTipo: 'lider', dados: { ocorrencia } })
    }
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'pedido_finalizado', descricao: resultado === 'correto' ? 'Pedido finalizado com sucesso' : 'Pedido finalizado com ocorrência registrada', ator: 'Sistema', atorTipo: 'sistema' })
    return res.status(200).json({ ok: true, mensagem: resultado === 'correto' ? 'Pedido finalizado! 🏁' : 'Pedido finalizado com ocorrência registrada ⚠️' })
  }

  // ── POST: reabrir ──────────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'reabrir') {
    const { solicitacaoId } = req.body || {}
    if (!solicitacaoId) return res.status(400).json({ error: 'solicitacaoId obrigatório' })
    const { data: sol } = await db.from('refei_solicitacoes').select('*').eq('id', solicitacaoId).maybeSingle()
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })
    if (sol.status !== 'reprovado') return res.status(409).json({ error: 'Apenas pedidos reprovados podem ser reabertos' })
    await db.from('refei_solicitacoes').update({ status: 'rascunho', motivo_reprovacao: null }).eq('id', sol.id)
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'reabertura', descricao: 'Pedido reaberto para correção pelo líder', ator: null, atorTipo: 'admin' })
    if (sol.lider_telefone) {
      await sendWA(sol.lider_telefone, `🔄 Pedido *${sol.ticket || sol.numero_pedido}* reaberto para correção.\nAcesse o link para editar e reenviar: ${APP_URL}/refeicao/${sol.token_lider}`)
    }
    return res.status(200).json({ ok: true, mensagem: 'Pedido reaberto para correção! 🔄' })
  }

  // ── GET: carrega dados para confirmação pelo restaurante ─────────────────────
  if (req.method === 'GET' && action === 'load-confirmar-restaurante') {
    const { token } = req.query
    if (!token) return res.status(400).json({ error: 'Token obrigatório' })

    const { data: sol } = await db
      .from('refei_solicitacoes').select('*').eq('token_restaurante', token).maybeSingle()

    if (!sol) return res.status(404).json({ error: 'Pedido não encontrado' })

    const [{ data: itens }, { data: equipe }, { data: rest }] = await Promise.all([
      db.from('refei_itens').select('*').eq('solicitacao_id', sol.id),
      db.from('refei_equipes').select('nome, supervisor_nome').eq('id', sol.equipe_id).maybeSingle(),
      db.from('refei_restaurantes').select('nome, confirma_pedido').eq('id', sol.restaurante_id).maybeSingle(),
    ])

    return res.status(200).json({ sol, itens: itens || [], equipe, restaurante: rest })
  }

  // ── POST: restaurante confirma recebimento via link público ─────────────────
  if (req.method === 'POST' && action === 'confirmar-restaurante') {
    const { token } = req.body || {}
    if (!token) return res.status(400).json({ error: 'Token obrigatório' })

    const { data: sol } = await db
      .from('refei_solicitacoes').select('*').eq('token_restaurante', token).maybeSingle()

    if (!sol) return res.status(404).json({ error: 'Pedido não encontrado' })
    if (sol.status !== 'enviado_restaurante') {
      return res.status(409).json({ error: 'Este pedido já foi processado', status: sol.status })
    }

    const now = new Date().toISOString()
    await db.from('refei_solicitacoes').update({
      status:             'confirmado_restaurante',
      confirmado_rest_em: now,
    }).eq('id', sol.id)

    await logEvento(db, {
      solicitacaoId: sol.id,
      tipo:          'confirmado_restaurante',
      descricao:     'Restaurante confirmou o recebimento do pedido via link',
      atorTipo:      'restaurante',
    })

    // Notifica líder
    if (sol.lider_telefone) {
      const { data: rest } = await db.from('refei_restaurantes').select('nome').eq('id', sol.restaurante_id).maybeSingle()
      await sendWA(
        sol.lider_telefone,
        `✅ *${sol.ticket || sol.numero_pedido}* confirmado pelo restaurante${rest?.nome ? ` ${rest.nome}` : ''}!\n📅 Data: ${fmtData(sol.data_refeicao)}\n\nVocê receberá o link de confirmação de entrega no dia.`,
      )
    }

    return res.status(200).json({ ok: true })
  }

  // ── GET: carrega dados do pedido para validação de entrega pelo líder ────────
  if (req.method === 'GET' && action === 'load-validar') {
    const { token } = req.query
    if (!token) return res.status(400).json({ error: 'Token obrigatório' })

    const { data: sol } = await db
      .from('refei_solicitacoes').select('*').eq('token_lider', token).maybeSingle()

    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })

    const [{ data: itens }, { data: equipe }, { data: rest }] = await Promise.all([
      db.from('refei_itens').select('*').eq('solicitacao_id', sol.id),
      db.from('refei_equipes').select('nome').eq('id', sol.equipe_id).maybeSingle(),
      db.from('refei_restaurantes').select('nome').eq('id', sol.restaurante_id).maybeSingle(),
    ])

    return res.status(200).json({ sol, itens: itens || [], equipe, restaurante: rest })
  }

  // ── POST: líder valida entrega via link público ──────────────────────────────
  if (req.method === 'POST' && action === 'validar-entrega-link') {
    const { token, resultado, ocorrencia } = req.body || {}
    if (!token || !resultado) return res.status(400).json({ error: 'Dados incompletos' })
    if (!['correto', 'com_ocorrencia'].includes(resultado)) {
      return res.status(400).json({ error: 'resultado deve ser "correto" ou "com_ocorrencia"' })
    }

    const { data: sol } = await db
      .from('refei_solicitacoes').select('*').eq('token_lider', token).maybeSingle()

    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })
    if (!['entregue', 'aguardando_validacao', 'confirmado_restaurante'].includes(sol.status)) {
      return res.status(409).json({ error: 'Status inválido para validação', status: sol.status })
    }

    const now        = new Date().toISOString()
    const novoStatus = resultado === 'correto' ? 'finalizado' : 'finalizado_com_ocorrencia'

    await db.from('refei_solicitacoes').update({
      status:               novoStatus,
      validado_em:          now,
      resultado_validacao:  resultado,
      ocorrencia:           ocorrencia || null,
    }).eq('id', sol.id)

    await logEvento(db, {
      solicitacaoId: sol.id,
      tipo:          resultado === 'correto' ? 'entrega_confirmada' : 'ocorrencia_registrada',
      descricao:     resultado === 'correto' ? 'Entrega confirmada pelo líder' : `Líder registrou ocorrência: ${ocorrencia}`,
      atorTipo:      'lider',
      dados:         ocorrencia ? { ocorrencia } : null,
    })

    return res.status(200).json({ ok: true, status: novoStatus })
  }

  return res.status(404).json({ error: 'Endpoint não encontrado' })
}
