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

const APP_URL = process.env.APP_URL || 'https://smartpro.app.br'

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
    const year = new Date().getFullYear()
    const { data: nextNum } = await db.rpc('get_next_refei_number', {
      p_workspace_id: sol.workspace_id,
      p_ano: year,
    })
    const numeroPedido = `REF-${year}-${String(nextNum || 1).padStart(6, '0')}`

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
    const supervisorTel = sol.supervisor_telefone
    const { data: equipeData } = await db.from('refei_equipes').select('nome').eq('id', sol.equipe_id).maybeSingle()
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

    // Confirma para o líder (fluxo WA — app mostra confirmação na própria UI)
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

    // Notifica restaurante se aprovado
    if (acao === 'aprovado') {
      const { data: rest } = await db.from('refei_restaurantes').select('*').eq('id', sol.restaurante_id).maybeSingle()
      const { data: itens } = await db.from('refei_itens').select('*').eq('solicitacao_id', sol.id)

      if (rest?.telefone_wa) {
        const qtdRef  = (itens || []).filter(i => i.refeicao).length
        const qtdCafe = (itens || []).filter(i => i.cafe).length
        const linhas = [
          `📋 *Pedido Aprovado: ${sol.numero_pedido}*`,
          `Data: ${fmtData(sol.data_refeicao)}`,
          `─────────────────────`,
          qtdRef  > 0 ? `🍽️ Refeição: ${qtdRef}` : null,
          qtdCafe > 0 ? `☕ Café: ${qtdCafe}` : null,
          `─────────────────────`,
          `*Total geral: ${fmtBRL(sol.valor_total)}*`,
          ``,
          `Responda *PREPARANDO* quando iniciar ou *ENTREGUE* após entregar.`,
        ].filter(v => v !== null)
        await sendWA(rest.telefone_wa, linhas.join('\n'))
      }

      // Notifica líder
      if (sol.lider_telefone) {
        await sendWA(sol.lider_telefone, `✅ Pedido *${sol.numero_pedido}* aprovado!\nData: ${fmtData(sol.data_refeicao)}\n\nO restaurante foi notificado para preparação.`)
      }
      // Agenda pesquisa de satisfação — disponível no dia da refeição
      await db.from('refei_avaliacoes').upsert({
        workspace_id:     sol.workspace_id,
        solicitacao_id:   sol.id,
        lider_id:         sol.owner_id,
        equipe_id:        sol.equipe_id,
        numero_pedido:    sol.numero_pedido,
        restaurante_nome: rest?.nome || null,
        data_refeicao:    sol.data_refeicao,
        disponivel_em:    sol.data_refeicao,
        status:           'pendente',
      }, { onConflict: 'solicitacao_id', ignoreDuplicates: true })
    } else {
      // Notifica líder da reprovação
      if (sol.lider_telefone) {
        await sendWA(sol.lider_telefone, `❌ Pedido *${sol.numero_pedido}* reprovado.\nMotivo: ${motivo || '—'}\n\nAcesse o link para editar e reenviar: ${APP_URL}/refeicao/${sol.token_lider}`)
      }
    }

    return res.status(200).json({ ok: true, mensagem: acao === 'aprovado' ? 'Pedido aprovado!' : 'Pedido reprovado' })
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

  // ── GET: carrega pedido para confirmação do restaurante (token_restaurante) ─
  if (req.method === 'GET' && action === 'load-confirmar-restaurante') {
    const { token } = req.query
    if (!token) return res.status(400).json({ error: 'Token obrigatório' })

    const { data: sol } = await db
      .from('refei_solicitacoes')
      .select('*')
      .eq('token_restaurante', token)
      .maybeSingle()

    if (!sol) return res.status(404).json({ error: 'Link inválido ou expirado' })

    const [
      { data: equipe },
      { data: restaurante },
      { data: itens },
    ] = await Promise.all([
      db.from('refei_equipes').select('nome, cdc').eq('id', sol.equipe_id).maybeSingle(),
      db.from('refei_restaurantes').select('*').eq('id', sol.restaurante_id).maybeSingle(),
      db.from('refei_itens').select('*').eq('solicitacao_id', sol.id).order('colaborador_nome'),
    ])

    return res.status(200).json({
      sol,
      equipe:          equipe || null,
      restaurante:     restaurante || null,
      itens:           itens || [],
      equipeNome:      equipe?.nome || null,
      equipeCdc:       equipe?.cdc  || null,
      restauranteNome: restaurante?.nome || null,
    })
  }

  // ── GET: carrega pedido para validação pelo líder (token_lider) ─────────────
  if (req.method === 'GET' && action === 'load-validar') {
    const { token } = req.query
    if (!token) return res.status(400).json({ error: 'Token obrigatório' })

    const { data: sol } = await db
      .from('refei_solicitacoes')
      .select('*')
      .eq('token_lider', token)
      .maybeSingle()

    if (!sol) return res.status(404).json({ error: 'Link inválido ou expirado' })

    const [
      { data: equipe },
      { data: restaurante },
      { data: itens },
    ] = await Promise.all([
      db.from('refei_equipes').select('nome, cdc').eq('id', sol.equipe_id).maybeSingle(),
      db.from('refei_restaurantes').select('nome').eq('id', sol.restaurante_id).maybeSingle(),
      db.from('refei_itens').select('*').eq('solicitacao_id', sol.id).order('colaborador_nome'),
    ])

    return res.status(200).json({
      sol,
      equipe:      equipe || null,
      restaurante: restaurante || null,
      itens:       itens || [],
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

      // Notifica restaurante se aprovado
      if (acao === 'aprovado') {
        const [{ data: rest }, { data: itens }] = await Promise.all([
          db.from('refei_restaurantes').select('*').eq('id', sol.restaurante_id).maybeSingle(),
          db.from('refei_itens').select('*').eq('solicitacao_id', sol.id),
        ])
        if (rest?.telefone_wa) {
          const refeicaoNomes = (itens || []).filter(i => i.refeicao).map(i => i.colaborador_nome)
          const cafeNomes     = (itens || []).filter(i => i.cafe).map(i => i.colaborador_nome)
          const linhas = [
            `📋 *Pedido Aprovado: ${sol.numero_pedido}*`,
            `Data: ${fmtData(sol.data_refeicao)}`,
            `─────────────────────`,
            refeicaoNomes.length > 0 ? `🍽️ Refeição (${refeicaoNomes.length}): ${refeicaoNomes.join(', ')}` : null,
            cafeNomes.length     > 0 ? `☕ Café (${cafeNomes.length}): ${cafeNomes.join(', ')}` : null,
            `─────────────────────`,
            `*Total: ${fmtBRL(sol.valor_total)}*`,
            ``,
            `Responda *PREPARANDO* quando iniciar ou *ENTREGUE* após entregar.`,
          ].filter(Boolean)
          await sendWA(rest.telefone_wa, linhas.join('\n'))
        }
        if (sol.lider_telefone) {
          await sendWA(sol.lider_telefone, `✅ Pedido *${sol.numero_pedido}* aprovado!\nData: ${fmtData(sol.data_refeicao)}\n\nO restaurante foi notificado para preparação.`)
        }
        // Agenda pesquisa de satisfação — disponível no dia da refeição
        await db.from('refei_avaliacoes').upsert({
          workspace_id:     sol.workspace_id,
          solicitacao_id:   sol.id,
          lider_id:         sol.owner_id,
          equipe_id:        sol.equipe_id,
          numero_pedido:    sol.numero_pedido,
          restaurante_nome: rest?.nome || null,
          data_refeicao:    sol.data_refeicao,
          disponivel_em:    sol.data_refeicao,
          status:           'pendente',
        }, { onConflict: 'solicitacao_id', ignoreDuplicates: true })
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
    if (sol.status !== 'pendente') return res.status(400).json({ error: 'Pedido não está pendente' })
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
    if (!['aprovado', 'consolidado'].includes(sol.status)) return res.status(409).json({ error: 'Pedido precisa estar aprovado ou consolidado' })
    const now = new Date().toISOString()
    const { data: itens } = await db.from('refei_itens').select('*').eq('solicitacao_id', sol.id).order('colaborador_nome')
    const rest = sol.refei_restaurantes
    const precisaConfirmar = !!rest?.confirma_pedido
    console.log(`[refeicoes] enviar_restaurante | sol=${solicitacaoId} | rest=${rest?.nome} | confirma_pedido=${rest?.confirma_pedido} | precisaConfirmar=${precisaConfirmar} | telefone_wa=${rest?.telefone_wa}`)

    // Auto-consolida se ainda estava em aprovado
    if (sol.status === 'aprovado') {
      await db.from('refei_solicitacoes').update({ status: 'consolidado', consolidado_em: now }).eq('id', sol.id)
      await logEvento(db, { solicitacaoId: sol.id, tipo: 'consolidado', descricao: 'Pedido consolidado automaticamente antes do envio', ator: 'Sistema', atorTipo: 'sistema' })
    }

    // Se restaurante não requer confirmação, já avança para confirmado_restaurante
    const novoStatus = precisaConfirmar ? 'enviado_restaurante' : 'confirmado_restaurante'
    const updatePayload = precisaConfirmar
      ? { status: 'enviado_restaurante',      env_restaurante_em:  now }
      : { status: 'confirmado_restaurante',   env_restaurante_em:  now, confirmado_rest_em: now }

    await db.from('refei_solicitacoes').update(updatePayload).eq('id', sol.id)
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'enviado_restaurante', descricao: `Pedido enviado ao restaurante ${rest?.nome || ''}`.trim(), ator: 'Sistema', atorTipo: 'sistema', dados: { restaurante: rest?.nome } })

    if (!precisaConfirmar) {
      await logEvento(db, { solicitacaoId: sol.id, tipo: 'confirmado_restaurante', descricao: 'Auto-confirmado — restaurante não requer confirmação via link', ator: 'Sistema', atorTipo: 'sistema' })
    }

    // Notifica restaurante via WA
    if (rest?.telefone_wa) {
      const qtdRef  = (itens || []).filter(i => i.refeicao).length
      const qtdCafe = (itens || []).filter(i => i.cafe).length
      const nomes   = (itens || []).map(i => `• ${i.colaborador_nome}${i.refeicao ? ' 🍽️' : ''}${i.cafe ? ' ☕' : ''}`)
      const confirmarUrl = `${APP_URL}/confirmar-restaurante/${sol.token_restaurante}`
      const msg = [
        `🏪 *Pedido para Preparo: ${sol.ticket || sol.numero_pedido}*`,
        `📅 Data: ${fmtData(sol.data_refeicao)}`,
        `─────────────────────`,
        ...nomes,
        `─────────────────────`,
        `🍽️ ${qtdRef} refeição(ões)  ☕ ${qtdCafe} café(s)`,
        `*Total: ${fmtBRL(sol.valor_total)}*`,
        precisaConfirmar ? `` : null,
        precisaConfirmar ? `✅ Confirme o recebimento: ${confirmarUrl}` : null,
      ].filter(v => v !== null).join('\n')
      await sendWA(rest.telefone_wa, msg)
    }

    return res.status(200).json({
      ok: true,
      mensagem: precisaConfirmar ? 'Pedido enviado ao restaurante! 🏪' : 'Pedido enviado e auto-confirmado! 🏪✅',
      status: novoStatus,
    })
  }

  // ── POST: confirmar recebimento pelo restaurante (token_restaurante) ─────────
  if (req.method === 'POST' && action === 'confirmar-restaurante') {
    const { token } = req.body || {}
    if (!token) return res.status(400).json({ error: 'Token obrigatório' })

    const { data: sol } = await db
      .from('refei_solicitacoes')
      .select('*')
      .eq('token_restaurante', token)
      .maybeSingle()

    if (!sol) return res.status(404).json({ error: 'Pedido não encontrado' })
    if (!['enviado_restaurante'].includes(sol.status)) {
      return res.status(409).json({ error: 'Pedido já confirmado ou em status inválido', status: sol.status })
    }

    const now = new Date().toISOString()
    await db.from('refei_solicitacoes').update({
      status:            'confirmado_restaurante',
      confirmado_rest_em: now,
    }).eq('id', sol.id)

    await logEvento(db, {
      solicitacaoId: sol.id,
      tipo:          'confirmado_restaurante',
      descricao:     'Restaurante confirmou o recebimento do pedido',
      ator:          null,
      atorTipo:      'restaurante',
    })

    return res.status(200).json({ ok: true, mensagem: 'Pedido confirmado! ✅' })
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
      const validUrl = `${APP_URL}/refeicao/validar/${sol.token_lider}`
      await sendWA(sol.lider_telefone, [
        `🍽️ *Confirmação de Entrega — ${sol.ticket || sol.numero_pedido}*`,
        `Olá${sol.lider_nome ? ', ' + sol.lider_nome : ''}!`,
        ``,
        `Sua refeição do dia ${fmtData(sol.data_refeicao)} foi entregue?`,
        ``,
        `✅ Tudo certo: ${validUrl}?ok=1`,
        `⚠️ Houve problema: ${validUrl}?ok=0`,
        ``,
        `_Responda para registrar a confirmação._`,
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

  // ── POST: validar-entrega-link (via token_lider — link enviado por WA) ────────
  if (req.method === 'POST' && action === 'validar-entrega-link') {
    const { token, resultado, ocorrencia } = req.body || {}
    if (!token || !resultado) return res.status(400).json({ error: 'token e resultado obrigatórios' })
    if (!['correto', 'com_ocorrencia'].includes(resultado)) return res.status(400).json({ error: 'resultado inválido' })

    const { data: sol } = await db
      .from('refei_solicitacoes')
      .select('*')
      .eq('token_lider', token)
      .maybeSingle()

    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })
    if (!['entregue', 'aguardando_validacao'].includes(sol.status)) {
      return res.status(409).json({ error: 'Status inválido para validação', status: sol.status })
    }

    const now = new Date().toISOString()
    const novoStatus = resultado === 'correto' ? 'finalizado' : 'finalizado_com_ocorrencia'
    await db.from('refei_solicitacoes').update({
      status:              novoStatus,
      validado_em:         now,
      resultado_validacao: resultado,
      ocorrencia:          ocorrencia || null,
    }).eq('id', sol.id)

    if (resultado === 'correto') {
      await logEvento(db, { solicitacaoId: sol.id, tipo: 'entrega_confirmada', descricao: 'Entrega confirmada pelo líder via link', ator: sol.lider_nome, atorTipo: 'lider' })
    } else {
      await logEvento(db, { solicitacaoId: sol.id, tipo: 'ocorrencia_registrada', descricao: 'Líder registrou ocorrência na entrega via link', ator: sol.lider_nome, atorTipo: 'lider', dados: { ocorrencia } })
    }
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'pedido_finalizado', descricao: resultado === 'correto' ? 'Pedido finalizado com sucesso' : 'Pedido finalizado com ocorrência registrada', ator: 'Sistema', atorTipo: 'sistema' })

    return res.status(200).json({ ok: true, mensagem: resultado === 'correto' ? 'Pedido finalizado! 🏁' : 'Pedido finalizado com ocorrência registrada ⚠️' })
  }

  // ── GET: avaliacao-pendente ────────────────────────────────────────────────
  // Retorna a avaliação de qualidade mais antiga não respondida do líder,
  // cujo dia de refeição já passou ou é hoje.
  if (req.method === 'GET' && action === 'avaliacao-pendente') {
    const { ownerId, workspaceId } = req.query
    if (!ownerId || !workspaceId) return res.status(400).json({ error: 'ownerId e workspaceId obrigatórios' })
    const today = new Date().toISOString().slice(0, 10)
    const { data: avaliacao } = await db
      .from('refei_avaliacoes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('lider_id', ownerId)
      .eq('status', 'pendente')
      .lte('disponivel_em', today)
      .order('data_refeicao', { ascending: false })
      .limit(1)
      .maybeSingle()
    return res.status(200).json({ avaliacao: avaliacao || null })
  }

  // ── POST: responder-avaliacao ──────────────────────────────────────────────
  if (req.method === 'POST' && action === 'responder-avaliacao') {
    const { id, nota_geral, quantidade_correta, temperatura_ok, sabor_ok, observacao } = req.body || {}
    if (!id || !nota_geral) return res.status(400).json({ error: 'id e nota_geral obrigatórios' })
    if (nota_geral < 1 || nota_geral > 5) return res.status(400).json({ error: 'nota_geral deve ser entre 1 e 5' })
    const { data: aval } = await db.from('refei_avaliacoes').select('id, status').eq('id', id).maybeSingle()
    if (!aval) return res.status(404).json({ error: 'Avaliação não encontrada' })
    if (aval.status === 'respondida') return res.status(409).json({ error: 'Avaliação já respondida' })
    await db.from('refei_avaliacoes').update({
      status:             'respondida',
      nota_geral,
      quantidade_correta: quantidade_correta ?? null,
      temperatura_ok:     temperatura_ok ?? null,
      sabor_ok:           sabor_ok ?? null,
      observacao:         observacao || null,
      respondida_em:      new Date().toISOString(),
    }).eq('id', id)
    return res.status(200).json({ ok: true })
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

  // ── POST: notify-mobile ────────────────────────────────────────────────────
  // Chamado pelo app SmartLíder após criar o pedido direto no Supabase.
  // Envia WhatsApp ao supervisor + confirmação ao líder + timeline + Flow Engine.
  if (req.method === 'POST' && action === 'notify-mobile') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id da solicitação obrigatório' })

    const { data: sol } = await db
      .from('refei_solicitacoes')
      .select('*, refei_restaurantes(nome, valor_refeicao, valor_cafe)')
      .eq('id', id)
      .maybeSingle()
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })

    const { data: itens } = await db
      .from('refei_itens')
      .select('colaborador_nome, refeicao, cafe, extra, justificativa')
      .eq('solicitacao_id', id)

    const rest       = sol.refei_restaurantes
    const totalRef   = sol.total_refeicoes  ?? 0
    const totalCafe  = sol.total_cafes      ?? 0
    const valorTotal = sol.valor_total      ?? 0

    // Timeline
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'pedido_criado',     descricao: `Pedido ${sol.numero_pedido} criado por ${sol.lider_nome || 'líder'}`, ator: sol.lider_nome, atorTipo: 'lider' })
    await logEvento(db, { solicitacaoId: sol.id, tipo: 'enviado_aprovacao', descricao: 'Enviado para aprovação do supervisor',                                  ator: sol.lider_nome, atorTipo: 'lider' })

    // WhatsApp → supervisor
    // Prioridade: 1) sol.supervisor_telefone, 2) refei_equipes via equipe_id,
    //             3) lider_equipes via owner_id → refei_equipe_id
    let supervisorTel = sol.supervisor_telefone
    let refeiEquipeId  = sol.equipe_id
    if (!supervisorTel && refeiEquipeId) {
      const { data: eq } = await db.from('refei_equipes').select('supervisor_telefone').eq('id', refeiEquipeId).maybeSingle()
      supervisorTel = eq?.supervisor_telefone || null
    }
    if (!supervisorTel && sol.owner_id) {
      // Fallback: busca via lider_equipes → refei_equipe_id
      const { data: le } = await db
        .from('lider_equipes')
        .select('refei_equipe_id')
        .eq('workspace_id', sol.workspace_id)
        .eq('lider_id', sol.owner_id)
        .not('refei_equipe_id', 'is', null)
        .limit(1)
        .maybeSingle()
      if (le?.refei_equipe_id) {
        refeiEquipeId = le.refei_equipe_id
        const { data: eq2 } = await db.from('refei_equipes').select('supervisor_telefone').eq('id', refeiEquipeId).maybeSingle()
        supervisorTel = eq2?.supervisor_telefone || null
      }
    }
    // Persiste para futuras consultas
    if (supervisorTel || refeiEquipeId) {
      const upd = {}
      if (supervisorTel && !sol.supervisor_telefone) upd.supervisor_telefone = supervisorTel
      if (refeiEquipeId  && !sol.equipe_id)          upd.equipe_id = refeiEquipeId
      if (Object.keys(upd).length) await db.from('refei_solicitacoes').update(upd).eq('id', sol.id)
    }
    if (supervisorTel) {
      const { data: equipeData } = await db.from('refei_equipes').select('nome, cdc').eq('id', refeiEquipeId).maybeSingle()
      const colaboradores = (itens || []).map(i => `• ${i.colaborador_nome}`).join('\n')
      const link = `${APP_URL}/ar/${sol.token_aprovacao}`

      const msgSup = [
        `🔔 *Nova Solicitação de Refeição*`,
        ``,
        `*Pedido:* ${sol.numero_pedido}`,
        `*Equipe:* ${equipeData?.nome || '—'}${equipeData?.cdc ? ' (CDC ' + equipeData.cdc + ')' : ''}`,
        `*Solicitante:* ${sol.lider_nome || '—'}`,
        `*Data:* ${fmtData(sol.data_refeicao)}`,
        `*Restaurante:* ${rest?.nome || '—'}`,
        `*Total:* ${fmtBRL(valorTotal)} (${totalRef}🍽️ ${totalCafe}☕)`,
        colaboradores ? `\n*Colaboradores:*\n${colaboradores}` : '',
        ``,
        `Toque para aprovar ou reprovar:`,
        link,
      ].filter(l => l !== null).join('\n')
      await sendWA(supervisorTel, msgSup)
    }

    // WhatsApp → líder (confirmação)
    // Prioridade: 1) sol.lider_telefone, 2) lider_perfis.celular, 3) efetivo.celular via matricula
    let liderTel = sol.lider_telefone
    if (!liderTel && sol.owner_id && sol.workspace_id) {
      const { data: lp } = await db
        .from('lider_perfis')
        .select('matricula, celular')
        .eq('user_id', sol.owner_id)
        .eq('workspace_id', sol.workspace_id)
        .maybeSingle()
      if (lp?.celular) {
        liderTel = lp.celular
      } else if (lp?.matricula) {
        // Fallback: busca em efetivo pelo matricula
        const { data: ef } = await db
          .from('efetivo')
          .select('celular')
          .eq('workspace_id', sol.workspace_id)
          .eq('matricula', lp.matricula)
          .maybeSingle()
        if (ef?.celular) liderTel = ef.celular
      }
      if (liderTel) {
        // Persiste para futuras chamadas
        await db.from('refei_solicitacoes').update({ lider_telefone: liderTel }).eq('id', sol.id)
      }
    }
    // Flow Engine auto-start
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
          dados_contexto: { valor_total: valorTotal, numero_pedido: sol.numero_pedido },
        })
        if (startResult.status === 201) {
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
      console.error('[refeicoes] notify-mobile flow error:', flowErr?.message)
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(404).json({ error: 'Endpoint não encontrado' })
}
