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

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
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

function fmtBRL(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtData(d) {
  if (!d) return '—'
  return String(d).split('-').reverse().join('/')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

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
    const numeroPedido = `REF-${String((count || 0) + 1).padStart(4, '0')}`

    // Atualiza solicitação
    await db.from('refei_solicitacoes').update({
      restaurante_id:  restauranteId,
      data_refeicao:   dataRefeicao,
      numero_pedido:   numeroPedido,
      status:          'pendente',
      total_refeicoes: totalRef,
      total_cafes:     totalCafe,
      valor_refeicao:  valorRef,
      valor_cafe:      valorCafe,
      valor_total:     valorTotal,
      observacoes:     observacoes || null,
    }).eq('id', sol.id)

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

    return res.status(200).json({ ok: true, numeroPedido, valorTotal })
  }

  // ── POST: aprovar / reprovar (admin) ──────────────────────────────────────
  if (req.method === 'POST' && action === 'aprovar') {
    const { solicitacaoId, acao, motivo } = req.body || {}
    if (!solicitacaoId || !acao) return res.status(400).json({ error: 'Dados incompletos' })
    if (!['aprovado', 'reprovado'].includes(acao)) return res.status(400).json({ error: 'Ação inválida' })

    const { data: sol } = await db.from('refei_solicitacoes').select('*').eq('id', solicitacaoId).maybeSingle()
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })

    await db.from('refei_solicitacoes').update({
      status:             acao,
      motivo_reprovacao:  motivo || null,
      aprovado_em:        acao === 'aprovado' ? new Date().toISOString() : null,
    }).eq('id', sol.id)

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
    } else {
      // Notifica líder da reprovação
      if (sol.lider_telefone) {
        await sendWA(sol.lider_telefone, `❌ Pedido *${sol.numero_pedido}* reprovado.\nMotivo: ${motivo || '—'}\n\nAcesse o link para editar e reenviar: ${APP_URL}/refeicao/${sol.token_lider}`)
      }
    }

    return res.status(200).json({ ok: true })
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
      if (!['pendente'].includes(sol.status)) {
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

  return res.status(404).json({ error: 'Endpoint não encontrado' })
}
