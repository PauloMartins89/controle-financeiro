/**
 * GET /api/agenda-alertas  — chamado pelo Vercel Cron a cada 5 minutos
 *
 * Responsabilidades:
 *  1. Busca alertas ativos com status 'pendente' e horario_previsto_envio <= now()
 *  2. Confirma que o agendamento não está cancelado/concluído
 *  3. Monta a mensagem WhatsApp
 *  4. Envia via Z-API
 *  5. Registra em whatsapp_logs
 *  6. Atualiza status do alerta (enviado | falha)
 *  7. Registra evento no agendamento_historico
 *  8. Verifica reenvios pendentes (solicitar_confirmacao + não confirmado)
 *
 * Variáveis de ambiente:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 *   ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN (opcional)
 *   CRON_SECRET  — Authorization: Bearer CRON_SECRET
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { realtime: { params: { log_level: 'disabled' }, transport: ws }, global: {} }
  )
}

/** Normaliza telefone para o padrão 55DDDNÚMERO (apenas dígitos) */
function normalizarTelefone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (!digits || digits.length < 8) return null
  // Já tem DDI 55
  if (digits.startsWith('55') && digits.length >= 12) return digits
  // Adiciona DDI 55
  if (digits.length === 11 || digits.length === 10) return '55' + digits
  if (digits.length === 13 && digits.startsWith('55')) return digits
  return '55' + digits
}

/** Valida telefone normalizado */
function telefoneValido(normalized) {
  if (!normalized) return false
  return /^55\d{10,11}$/.test(normalized)
}

/** Envia mensagem via Z-API — retorna { ok, messageId, error } */
async function sendZAPI(phone, message) {
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token = process.env.ZAPI_TOKEN
  if (!instanceId || !token) {
    return { ok: false, error: 'ZAPI_INSTANCE_ID ou ZAPI_TOKEN não configurado' }
  }
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
        },
        body: JSON.stringify({ phone, message }),
      }
    )
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(body)}`, body }
    }
    return { ok: true, messageId: body?.zaapId || body?.messageId || null, body }
  } catch (e) {
    return { ok: false, error: e?.message || 'Erro desconhecido' }
  }
}

/** Formata data pt-BR */
function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

/** Formata hora pt-BR */
function fmtTime(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

/** Monta mensagem WhatsApp para o agendamento */
function montarMensagem(agendamento, alerta) {
  const linhas = [
    `🔔 *Lembrete de Agendamento*`,
    ``,
    `Serviço: *${agendamento.tipo_servico || '—'}*`,
    `Cliente: *${agendamento.cliente_nome || '—'}*`,
    agendamento.atividade ? `Atividade: *${agendamento.atividade}*` : null,
    ``,
    `📅 Data: *${fmtDate(agendamento.data_hora_servico || agendamento.data_servico)}*`,
    agendamento.horario_servico ? `⏰ Horário: *${agendamento.horario_servico.slice(0, 5)}*` : null,
    agendamento.origem ? `📍 Origem: ${agendamento.origem}` : null,
    agendamento.destino ? `🏁 Destino: ${agendamento.destino}` : null,
    agendamento.responsavel_nome ? `👤 Responsável: ${agendamento.responsavel_nome}` : null,
    agendamento.motorista_nome ? `🚛 Motorista: ${agendamento.motorista_nome}` : null,
    agendamento.veiculo_nome ? `🚚 Veículo: ${agendamento.veiculo_nome}` : null,
    agendamento.observacao ? `📝 Obs.: ${agendamento.observacao}` : null,
    ``,
    `Status: *Agendado* ✅`,
  ].filter(l => l !== null)

  if (alerta.solicitar_confirmacao) {
    linhas.push(``, `Responda:`, `*1* - Confirmar ciência`, `*2* - Solicitar ajuste`, `*3* - Cancelar/Reagendar`)
  }

  return linhas.join('\n')
}

/** Salva log de envio */
async function salvarLog(db, { referenceId, phone, message, status, requestPayload, responsePayload, errorMessage }) {
  await db.from('whatsapp_logs').insert({
    reference_type: 'agendamento_alerta',
    reference_id: referenceId,
    phone,
    message,
    provider: 'zapi',
    status,
    request_payload: requestPayload,
    response_payload: responsePayload,
    error_message: errorMessage || null,
    sent_at: status === 'enviado' ? new Date().toISOString() : null,
  })
}

/** Registra evento no histórico do agendamento */
async function registrarHistorico(db, { agendamentoId, tipoEvento, descricao, payload }) {
  await db.from('agendamento_historico').insert({
    agendamento_id: agendamentoId,
    tipo_evento: tipoEvento,
    descricao,
    usuario_nome: 'Sistema',
    payload_json: payload || null,
  })
}

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Valida CRON_SECRET (Vercel injeta automaticamente em Cron Jobs)
  const authHeader = req.headers.authorization || ''
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const db = getDb()
  const now = new Date().toISOString()
  const results = { processados: 0, enviados: 0, falhas: 0, reenvios: 0 }

  try {
    // ── 1. Busca alertas pendentes com horário de envio chegado ──────────────
    const { data: alertas, error: errAlertas } = await db
      .from('agendamento_alertas')
      .select(`
        *,
        agendamentos_servicos (
          id, cliente_nome, tipo_servico, atividade, descricao,
          data_servico, horario_servico, data_hora_servico,
          origem, destino, responsavel_nome, motorista_nome,
          veiculo_nome, observacao, status
        )
      `)
      .eq('status', 'pendente')
      .eq('ativo', true)
      .lte('horario_previsto_envio', now)

    if (errAlertas) {
      console.error('[agenda-alertas] Erro ao buscar alertas:', errAlertas)
      return res.status(500).json({ error: errAlertas.message })
    }

    // ── 2. Busca alertas enviados aguardando reenvio ──────────────────────────
    const { data: reenvioAlertas } = await db
      .from('agendamento_alertas')
      .select(`
        *,
        agendamentos_servicos (
          id, cliente_nome, tipo_servico, atividade, descricao,
          data_servico, horario_servico, data_hora_servico,
          origem, destino, responsavel_nome, motorista_nome,
          veiculo_nome, observacao, status
        )
      `)
      .eq('status', 'enviado')
      .eq('ativo', true)
      .eq('reenviar_se_nao_confirmar', true)
      .not('proximo_reenvio_em', 'is', null)
      .lte('proximo_reenvio_em', now)

    const todosAlertas = [...(alertas || []), ...(reenvioAlertas || [])]

    for (const alerta of todosAlertas) {
      results.processados++
      const agendamento = alerta.agendamentos_servicos

      // Pula se agendamento não existe ou está cancelado/concluído
      if (!agendamento || ['cancelado', 'concluido'].includes(agendamento.status)) {
        await db.from('agendamento_alertas').update({ status: 'cancelado', ativo: false }).eq('id', alerta.id)
        continue
      }

      // Normaliza e valida telefone
      const phoneRaw = alerta.destinatario_whatsapp
      const phone = normalizarTelefone(phoneRaw)
      if (!telefoneValido(phone)) {
        await db.from('agendamento_alertas').update({
          status: 'falha',
          erro_envio: `Telefone inválido: "${phoneRaw}"`,
          updated_at: new Date().toISOString(),
        }).eq('id', alerta.id)
        await registrarHistorico(db, {
          agendamentoId: agendamento.id,
          tipoEvento: 'falha_whatsapp',
          descricao: `Falha ao enviar WhatsApp: telefone inválido "${phoneRaw}"`,
        })
        results.falhas++
        continue
      }

      // Monta mensagem
      const message = montarMensagem(agendamento, alerta)

      // Envia
      const sendResult = await sendZAPI(phone, message)

      // Atualiza alerta
      const isReenvio = alerta.status === 'enviado'
      const novasTentativas = (alerta.tentativas_envio || 0) + 1

      if (sendResult.ok) {
        const proximoReenvio = (alerta.solicitar_confirmacao && alerta.reenviar_se_nao_confirmar && novasTentativas < (alerta.max_tentativas || 3))
          ? new Date(Date.now() + (alerta.intervalo_reenvio_min || 60) * 60 * 1000).toISOString()
          : null

        await db.from('agendamento_alertas').update({
          status: isReenvio ? 'reenviado' : 'enviado',
          enviado_em: new Date().toISOString(),
          tentativas_envio: novasTentativas,
          proximo_reenvio_em: proximoReenvio,
          erro_envio: null,
          updated_at: new Date().toISOString(),
        }).eq('id', alerta.id)

        await salvarLog(db, {
          referenceId: alerta.id,
          phone,
          message,
          status: 'enviado',
          requestPayload: { phone, message: message.slice(0, 200) },
          responsePayload: sendResult.body,
        })

        await registrarHistorico(db, {
          agendamentoId: agendamento.id,
          tipoEvento: isReenvio ? 'reenvio_whatsapp' : 'whatsapp_enviado',
          descricao: `WhatsApp ${isReenvio ? 'reenviado' : 'enviado'} para ${alerta.destinatario_nome || phone} (tentativa ${novasTentativas})`,
          payload: { phone, destinatario_tipo: alerta.destinatario_tipo },
        })

        // Atualiza status do agendamento para "alerta_enviado" se ainda estava em "agendado"
        if (!isReenvio && agendamento.status === 'agendado') {
          await db.from('agendamentos_servicos').update({ status: 'alerta_enviado' }).eq('id', agendamento.id)
        }

        isReenvio ? results.reenvios++ : results.enviados++
      } else {
        // Falha no envio
        const tentativasMax = alerta.max_tentativas || 3
        const statusFinal = novasTentativas >= tentativasMax ? 'falha' : 'pendente'
        const proximaRetentativa = statusFinal === 'pendente'
          ? new Date(Date.now() + 5 * 60 * 1000).toISOString() // retenta em 5 min
          : null

        await db.from('agendamento_alertas').update({
          status: statusFinal,
          tentativas_envio: novasTentativas,
          erro_envio: sendResult.error,
          proximo_reenvio_em: proximaRetentativa,
          updated_at: new Date().toISOString(),
        }).eq('id', alerta.id)

        await salvarLog(db, {
          referenceId: alerta.id,
          phone,
          message,
          status: 'falha',
          requestPayload: { phone },
          errorMessage: sendResult.error,
        })

        if (statusFinal === 'falha') {
          await registrarHistorico(db, {
            agendamentoId: agendamento.id,
            tipoEvento: 'falha_whatsapp',
            descricao: `Falha ao enviar WhatsApp para ${alerta.destinatario_nome || phone}: ${sendResult.error}`,
          })
        }

        results.falhas++
      }
    }

    return res.status(200).json({ ok: true, timestamp: now, ...results })
  } catch (e) {
    console.error('[agenda-alertas] Erro geral:', e)
    return res.status(500).json({ error: e?.message || 'Erro interno' })
  }
}
