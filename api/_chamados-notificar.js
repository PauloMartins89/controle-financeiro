// api/_chamados-notificar.js
// Serviço de notificação: envia mensagem privada WA ao técnico responsável

const zapiInstanceId  = process.env.ZAPI_INSTANCE_ID
const zapiToken       = process.env.ZAPI_TOKEN
const zapiClientToken = process.env.ZAPI_CLIENT_TOKEN

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Campo_Grande',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function buildMensagemTecnico(sat, grupoNome) {
  const prioEmoji = {
    critica: '🔴', alta: '🟠', media: '🟡', baixa: '🟢'
  }
  const emoji = prioEmoji[sat.prioridade] || '🟡'
  const catDisplay = (sat.categoria || 'outros').charAt(0).toUpperCase() + (sat.categoria || 'outros').slice(1)

  return [
    `🔔 *Novo Atendimento Técnico Identificado*`,
    ``,
    `📋 *Código:* ${sat.codigo}`,
    `🏢 *Grupo:* ${grupoNome || '—'}`,
    `👤 *Solicitante:* ${sat.solicitante_nome || '—'}`,
    `📱 *Telefone:* ${sat.solicitante_whatsapp || '—'}`,
    `🏷️ *Categoria:* ${catDisplay}`,
    `${emoji} *Prioridade:* ${(sat.prioridade || 'media').charAt(0).toUpperCase() + (sat.prioridade || 'media').slice(1)}`,
    ``,
    `📝 *Resumo:*`,
    sat.resumo_ia || sat.mensagem_original || '—',
    ``,
    `💬 *Mensagem original:*`,
    `"${sat.mensagem_original || '—'}"`,
    ``,
    `🕐 *Data/hora:* ${fmtDate(sat.created_at)}`,
  ].join('\n')
}

/**
 * Envia notificação privada para o técnico via Z-API e registra na tabela.
 * @param {object} supabase  - client Supabase (service_role)
 * @param {object} sat       - linha da tabela solicitacoes_atendimento
 * @param {object} tecnico   - linha da tabela tecnicos
 * @param {string} grupoNome - nome do grupo de origem
 */
export async function notificarTecnico(supabase, sat, tecnico, grupoNome) {
  if (!tecnico?.whatsapp) {
    console.warn('[_chamados-notificar] Técnico sem WhatsApp configurado:', tecnico?.id)
    return { ok: false, motivo: 'sem_whatsapp' }
  }
  if (!zapiInstanceId || !zapiToken) {
    console.error('[_chamados-notificar] ZAPI_INSTANCE_ID/TOKEN não configurados')
    return { ok: false, motivo: 'zapi_nao_configurado' }
  }

  const mensagem = buildMensagemTecnico(sat, grupoNome)

  let respostaApi = null
  let statusEnvio = 'erro'

  try {
    const resp = await fetch(
      `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(zapiClientToken ? { 'Client-Token': zapiClientToken } : {}),
        },
        body: JSON.stringify({
          phone:   tecnico.whatsapp,
          message: mensagem,
        }),
      }
    )

    respostaApi = await resp.json().catch(() => ({ status: resp.status }))
    if (resp.ok) {
      statusEnvio = 'enviado'
    } else {
      console.error('[_chamados-notificar] Z-API erro:', resp.status, respostaApi)
    }
  } catch (e) {
    console.error('[_chamados-notificar] exceção Z-API:', e?.message)
    respostaApi = { erro: e?.message }
  }

  // Registra na tabela de notificações
  await supabase.from('notificacoes_tecnicos').insert({
    solicitacao_id:   sat.id,
    tecnico_id:       tecnico.id,
    whatsapp_destino: tecnico.whatsapp,
    mensagem_enviada: mensagem,
    status_envio:     statusEnvio,
    resposta_api:     respostaApi,
  }).catch(e => console.error('[_chamados-notificar] insert notif:', e?.message))

  // Atualiza solicitação
  if (statusEnvio === 'enviado') {
    await supabase.from('solicitacoes_atendimento').update({
      enviado_tecnico:    true,
      data_envio_tecnico: new Date().toISOString(),
      status:             'enviada_tecnico',
    }).eq('id', sat.id).catch(e => console.error('[_chamados-notificar] update sat:', e?.message))
  }

  return { ok: statusEnvio === 'enviado', mensagem, respostaApi }
}
