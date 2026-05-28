/**
 * POST /api/notify-lider
 *
 * Envia notificação WhatsApp ao supervisor quando um líder cria
 * uma solicitação de EPI ou Insumo pelo app SmartLíder.
 *
 * Body: {
 *   tipo : 'epi' | 'insumo'
 *   id   : uuid  — id da solicitação
 * }
 *
 * Configuração necessária (tabela configuracoes, por workspace):
 *   chave = 'lider_supervisor_telefone'  → telefone do supervisor (só números, com DDI)
 *
 * Chamada fire-and-forget pelo app (falhas não bloqueiam o fluxo).
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
  if (!['epi', 'insumo'].includes(tipo)) return res.status(400).json({ error: 'tipo deve ser epi ou insumo' })

  const db = getDb()

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
