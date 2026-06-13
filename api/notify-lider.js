/**
 * POST /api/notify-lider
 *
 * Body: { tipo: 'epi'|'insumo'|'epi_decisao'|'insumo_decisao', id }
 *
 * tipo = 'epi' | 'insumo'        → notifica supervisor de nova solicitação
 * tipo = 'epi_decisao' | 'insumo_decisao' → notifica líder da decisão (aprovado/reprovado)
 */

import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
}

async function sendWA(phone, text) {
  const p = phone.replace(/\D/g, '')
  if (!p) return false
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`,
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
        },
        body: JSON.stringify({ phone: p, message: text }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

const URGENCIA_LABEL = { baixa: 'Baixa ⬇️', media: 'Média ➡️', alta: '🔴 ALTA', urgente: '🚨 URGENTE' }
const MOTIVO_LABEL   = {
  novo:              'Primeiro fornecimento',
  troca_danificado:  'Troca — item danificado',
  troca_vencido:     'Troca — EPI vencido',
  Primeiro_fornecimento: 'Primeiro fornecimento',
  Reposicao:         'Reposição',
  Substituicao_por_dano: 'Substituição por dano',
  EPI_vencido:       'EPI vencido',
  Perda:             'Perda',
}

function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { tipo, id } = req.body || {}
  if (!tipo || !id) return res.status(400).json({ error: 'tipo e id obrigatórios' })
  if (!['epi', 'insumo', 'epi_decisao', 'insumo_decisao'].includes(tipo)) return res.status(400).json({ error: 'tipo inválido' })

  const db = getDb()

  // Notificação de decisão → líder
  if (tipo === 'epi_decisao' || tipo === 'insumo_decisao') {
    return handleDecisao(db, tipo, id, res)
  }

  try {
    // ── 1. Buscar solicitação ─────────────────────────────────────────────
    const tabela = tipo === 'epi' ? 'lider_solicitacoes_epi' : 'lider_solicitacoes_insumo'
    const { data: sol, error: solErr } = await db.from(tabela).select('*').eq('id', id).single()
    if (solErr || !sol) return res.status(404).json({ error: 'Solicitação não encontrada' })

    // ── 2. Buscar turno (frente, equipe, líder) ───────────────────────────
    const { data: turno } = await db
      .from('lider_turnos')
      .select('frente_nome, equipe_nome, lider_nome, turno, data')
      .eq('id', sol.turno_id)
      .single()

    // ── 3. Buscar telefone do supervisor (configuração do workspace) ───────
    const { data: cfg } = await db
      .from('configuracoes')
      .select('valor')
      .eq('workspace_id', sol.workspace_id)
      .eq('chave', 'lider_supervisor_telefone')
      .maybeSingle()

    const supervisorTel = cfg?.valor?.replace(/\D/g, '')
    if (!supervisorTel) {
      console.warn(`[notify-lider] lider_supervisor_telefone não configurado para workspace ${sol.workspace_id}`)
      return res.status(200).json({ ok: false, motivo: 'supervisor_sem_telefone' })
    }

    // ── 4. Montar mensagem ────────────────────────────────────────────────
    const liderNome  = turno?.lider_nome  || 'Líder'
    const frenteNome = turno?.frente_nome || '—'
    const equipeNome = turno?.equipe_nome || '—'
    const turnoLabel = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }[turno?.turno] || turno?.turno || '—'
    const dataStr    = turno?.data ? fmtDate(turno.data) : '—'

    let msg = ''

    if (tipo === 'epi') {
      msg =
        `🦺 *Nova Solicitação de EPI*\n\n` +
        `👤 *Líder:* ${liderNome}\n` +
        `🏗️ *Frente:* ${frenteNome} · Equipe ${equipeNome}\n` +
        `🕐 *Turno:* ${turnoLabel} — ${dataStr}\n\n` +
        `👷 *Colaborador:* ${sol.colaborador_nome}\n` +
        `🦺 *EPI:* ${sol.epi_nome}\n` +
        `📦 *Quantidade:* ${sol.quantidade}\n` +
        (sol.motivo ? `📝 *Motivo:* ${MOTIVO_LABEL[sol.motivo] || sol.motivo}\n` : '') +
        (sol.observacao ? `💬 *Obs:* ${sol.observacao}\n` : '') +
        `\n_Acesse o SmartPro para aprovar._`
    } else {
      msg =
        `🧪 *Nova Solicitação de Insumo*\n\n` +
        `👤 *Líder:* ${liderNome}\n` +
        `🏗️ *Frente:* ${frenteNome} · Equipe ${equipeNome}\n` +
        `🕐 *Turno:* ${turnoLabel} — ${dataStr}\n\n` +
        `📦 *Produto:* ${sol.produto_nome}\n` +
        `🔢 *Quantidade:* ${sol.quantidade} ${sol.unidade}\n` +
        `⚡ *Urgência:* ${URGENCIA_LABEL[sol.urgencia] || sol.urgencia}\n` +
        (sol.talhao_nome    ? `🌱 *Talhão:* ${sol.talhao_nome}\n` : '') +
        (sol.data_necessaria ? `📅 *Necessário em:* ${fmtDate(sol.data_necessaria)}\n` : '') +
        (sol.justificativa  ? `💬 *Justificativa:* ${sol.justificativa}\n` : '') +
        `\n_Acesse o SmartPro para aprovar._`
    }

    // ── 5. Enviar WA ──────────────────────────────────────────────────────
    const ok = await sendWA(supervisorTel, msg)

    // ── 6. Registrar envio (não bloqueia se falhar) ───────────────────────
    await db.from('mensagens_whatsapp').insert({
      workspace_id:  sol.workspace_id,
      telefone:      supervisorTel,
      mensagem:      msg,
      status:        ok ? 'enviado' : 'falha',
      referencia_id: id,
      origem:        `notify-lider-${tipo}`,
    }).then(() => {}).catch(() => {})

    return res.status(200).json({ ok, enviado_para: supervisorTel })

  } catch (err) {
    console.error('[notify-lider] erro:', err)
    return res.status(500).json({ error: err.message })
  }
}

// ── Notifica LÍDER sobre decisão do supervisor (aprovado/reprovado) ───────────
async function handleDecisao(db, tipo, id, res) {
  const tabela = tipo === 'epi_decisao' ? 'lider_solicitacoes_epi' : 'lider_solicitacoes_insumo'
  const tipoLabel = tipo === 'epi_decisao' ? 'EPI' : 'Insumo'
  try {
    const { data: sol } = await db.from(tabela).select('*').eq('id', id).single()
    if (!sol) return res.status(404).json({ error: 'Solicitação não encontrada' })

    // Busca telefone do líder via turno
    const { data: turno } = await db
      .from('lider_turnos')
      .select('lider_nome, lider_id')
      .eq('id', sol.turno_id)
      .maybeSingle()

    const { data: lider } = turno?.lider_id
      ? await db.from('lider_lideres').select('telefone').eq('id', turno.lider_id).maybeSingle()
      : { data: null }

    const telefone = lider?.telefone?.replace(/\D/g, '')
    if (!telefone) return res.status(200).json({ ok: false, motivo: 'lider_sem_telefone' })

    const item = tipo === 'epi_decisao' ? sol.epi_nome : sol.produto_nome
    const aprovado = sol.status === 'aprovado'
    const msg = aprovado
      ? `✅ *${tipoLabel} Aprovado!*\n\n` +
        `${tipo === 'epi_decisao' ? `🦺 *EPI:* ${item}\n👷 *Colaborador:* ${sol.colaborador_nome || '—'}` : `📦 *Produto:* ${item}\n🔢 *Qtd:* ${sol.quantidade} ${sol.unidade || ''}`}\n` +
        `📝 *Qtd aprovada:* ${sol.quantidade_aprovada || sol.quantidade}\n` +
        (sol.observacao_aprovador ? `💬 *Obs:* ${sol.observacao_aprovador}\n` : '') +
        `\nO item estará disponível em breve.`
      : `❌ *${tipoLabel} Reprovado*\n\n` +
        `${tipo === 'epi_decisao' ? `🦺 *EPI:* ${item}` : `📦 *Produto:* ${item}`}\n` +
        (sol.motivo_reprovacao ? `📝 *Motivo:* ${sol.motivo_reprovacao}\n` : '') +
        `\nEntre em contato com seu supervisor para mais detalhes.`

    const ok = await sendWA(telefone, msg)
    return res.status(200).json({ ok, enviado_para: telefone })
  } catch (err) {
    console.error('[notify-lider] decisao erro:', err)
    return res.status(500).json({ error: err.message })
  }
}
