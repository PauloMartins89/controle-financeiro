/**
 * POST /api/aprovar-compra
 *
 * Endpoint público — aprovador decide sem fazer login.
 * Autentica via token_aprovador da solicitação.
 *
 * Body: {
 *   token    : string (uuid — token_aprovador da solicitacao)
 *   acao     : 'aprovar' | 'recusar' | 'leilao'
 *   obs?     : string
 *   fornecedores? : [{ nome, telefone }]  — para leilao
 *   prazo?   : string (date YYYY-MM-DD)  — para leilao
 * }
 */

import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  )
}

function notifyCompras(evento, solicitacaoId) {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://dividiai.app.br'
  fetch(`${base}/api/notify-compras`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento, solicitacaoId }),
  }).catch(() => {})
}

// Registra evento de auditoria na solicitacao de compra (fire-and-forget)
function logEventoCompra(db, { solicitacaoId, workspaceId, acao, statusDe, statusPara, obs, ator }) {
  db.from('solicitacao_compra_eventos').insert({
    solicitacao_id: solicitacaoId,
    workspace_id:   workspaceId || null,
    acao,
    status_de:      statusDe || null,
    status_para:    statusPara || null,
    observacao:     obs || null,
    ator:           ator || 'aprovador_externo',
    criado_em:      new Date().toISOString(),
  }).then(() => {}).catch(e => console.error('[aprovar-compra] logEvento error:', e?.message))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token, acao, obs, fornecedores, prazo } = req.body || {}

  if (!token || !acao) {
    return res.status(400).json({ error: 'token e acao são obrigatórios' })
  }
  if (!['aprovar', 'recusar', 'leilao'].includes(acao)) {
    return res.status(400).json({ error: 'acao inválida' })
  }

  const db = getDb()

  // Busca solicitação pelo token
  const { data: sol, error: solErr } = await db
    .from('solicitacoes_compra')
    .select('*')
    .eq('token_aprovador', token)
    .single()

  if (solErr || !sol) {
    return res.status(404).json({ error: 'Token inválido ou solicitação não encontrada.' })
  }

  // Bloqueia ações em solicitações já decididas
  const decididos = ['aprovado', 'recusado', 'leilao_aberto', 'leilao_encerrado', 'pedido_emitido', 'pago']
  if (decididos.includes(sol.status)) {
    return res.status(409).json({
      error: 'Esta solicitação já foi decidida.',
      status: sol.status,
    })
  }

  // ── Executar ação ──────────────────────────────────────────────────────────
  try {
    if (acao === 'aprovar') {
      const { error } = await db.from('solicitacoes_compra').update({
        status: 'aprovado',
        observacao_aprovador: obs?.trim() || null,
        data_aprovacao: new Date().toISOString(),
      }).eq('id', sol.id)
      if (error) throw error

      // Cria despesa contas a pagar — somente se não existir uma vinculada
      if (!sol.despesa_id && sol.workspace_id) {
        const fornDesc = sol.fornecedor_vencedor || sol.fornecedor
        const { data: novaDespesa, error: errDesp } = await db.from('despesas').insert({
          workspace_id:  sol.workspace_id,
          descricao:     `[Compra] ${sol.titulo}${fornDesc ? ' — ' + fornDesc : ''}`,
          valor:         sol.valor_aprovado || sol.valor_estimado || 0,
          data:          sol.data_necessidade || new Date().toISOString().split('T')[0],
          categoria:     'Compras',
          status:        'pendente',
          observacoes:   `Pedido #${sol.id.slice(-6).toUpperCase()}${obs?.trim() ? ' | ' + obs.trim() : ''}`,
          parcelas:      1,
          parcela_atual: 1,
        }).select('id').single()
        if (!errDesp && novaDespesa?.id) {
          await db.from('solicitacoes_compra').update({ despesa_id: novaDespesa.id }).eq('id', sol.id)
        }
      }

      notifyCompras('aprovado', sol.id)
      logEventoCompra(db, { solicitacaoId: sol.id, workspaceId: sol.workspace_id, acao: 'aprovado', statusDe: sol.status, statusPara: 'aprovado', obs: obs?.trim() || null })
      return res.status(200).json({ ok: true, acao: 'aprovado' })

    } else if (acao === 'recusar') {
      if (!obs?.trim()) {
        return res.status(400).json({ error: 'Informe o motivo da recusa.' })
      }
      const { error } = await db.from('solicitacoes_compra').update({
        status: 'recusado',
        justificativa_recusa: obs.trim(),
      }).eq('id', sol.id)
      if (error) throw error
      notifyCompras('recusado', sol.id)
      logEventoCompra(db, { solicitacaoId: sol.id, workspaceId: sol.workspace_id, acao: 'recusado', statusDe: sol.status, statusPara: 'recusado', obs: obs?.trim() })
      return res.status(200).json({ ok: true, acao: 'recusado' })

    } else if (acao === 'leilao') {
      const lista = (fornecedores || []).filter(f => f?.nome?.trim())
      if (lista.length === 0) {
        return res.status(400).json({ error: 'Informe pelo menos 1 fornecedor.' })
      }
      const prazoTs = prazo
        ? new Date(prazo + 'T23:59:00').toISOString()
        : new Date(Date.now() + 48 * 3600000).toISOString()

      const { error: updErr } = await db.from('solicitacoes_compra').update({
        status: 'leilao_aberto',
        tipo: 'leilao',
        prazo_cotacao: prazoTs,
        data_aprovacao: new Date().toISOString(),
      }).eq('id', sol.id)
      if (updErr) throw updErr

      const cotacoes = lista.map(f => ({
        solicitacao_id:    sol.id,
        fornecedor_nome:   f.nome.trim(),
        fornecedor_telefone: f.telefone?.trim() || null,
        token_expira_em:   prazoTs,
        status:            'convidado',
      }))
      const { error: cErr } = await db.from('cotacoes_compra').insert(cotacoes)
      if (cErr) throw cErr

      notifyCompras('leilao_aberto', sol.id)
      logEventoCompra(db, { solicitacaoId: sol.id, workspaceId: sol.workspace_id, acao: 'leilao_aberto', statusDe: sol.status, statusPara: 'leilao_aberto', obs: `${cotacoes.length} fornecedor(es) convidado(s)` })
      return res.status(200).json({ ok: true, acao: 'leilao_aberto', fornecedores: cotacoes.length })
    }
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
