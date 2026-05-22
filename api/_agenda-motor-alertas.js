/**
 * _agenda-motor-alertas.js
 * Motor de regras automáticas de alerta para agendamentos.
 *
 * Lê a tabela agendamento_regras_alerta e, para cada regra ativa que
 * corresponde ao agendamento recém-criado, insere um registro em
 * agendamento_alertas para que o cron (agenda-alertas.js) dispare no momento certo.
 *
 * Exporta: aplicarRegrasAlerta(supabase, ag)
 *   ag: { id, workspace_id, tipo_servico, data_hora_servico }
 *   → retorna { criados, ignorados, erros }
 */

/**
 * Calcula horario_previsto_envio = data_hora_servico - antecedencia_minutos.
 * Retorna null se a data for inválida ou se o horário já passou.
 */
function calcularHorarioEnvio(dataHoraServico, antecedenciaMinutos) {
  const dt = new Date(dataHoraServico)
  if (isNaN(dt.getTime())) return null
  return new Date(dt.getTime() - antecedenciaMinutos * 60 * 1000).toISOString()
}

/**
 * Aplica as regras de alerta configuradas para um agendamento recém-criado.
 *
 * Regras são filtradas por:
 *   - ativo = true
 *   - workspace_id = ag.workspace_id  OU  workspace_id IS NULL (regra global)
 *   - tipo_servico = ag.tipo_servico  OU  tipo_servico IS NULL (aplica a qualquer tipo)
 *
 * Usa idempotency_key = "{ag.id}:regra:{regra.id}" para evitar duplicatas
 * caso o motor seja chamado mais de uma vez para o mesmo agendamento.
 *
 * @param {object} supabase  - cliente Supabase (service key)
 * @param {object} ag        - { id, workspace_id, tipo_servico, data_hora_servico }
 * @returns {Promise<{ criados: number, ignorados: number, erros: number }>}
 */
export async function aplicarRegrasAlerta(supabase, ag) {
  if (!ag?.id || !ag?.data_hora_servico) {
    return { criados: 0, ignorados: 0, erros: 0 }
  }

  // ── Busca regras ativas para o workspace ────────────────────────────────
  let query = supabase
    .from('agendamento_regras_alerta')
    .select('*')
    .eq('ativo', true)

  if (ag.workspace_id) {
    // Regras do workspace OU regras globais (workspace_id null)
    query = query.or(`workspace_id.eq.${ag.workspace_id},workspace_id.is.null`)
  } else {
    // Agendamento sem workspace → apenas regras globais
    query = query.is('workspace_id', null)
  }

  const { data: regras, error } = await query

  if (error) {
    console.error('[motor-alertas] erro ao buscar regras:', error.message)
    return { criados: 0, ignorados: 0, erros: 1 }
  }
  if (!regras?.length) return { criados: 0, ignorados: 0, erros: 0 }

  // ── Filtra por tipo_servico (null = aplica a qualquer tipo) ──────────────
  const aplicaveis = regras.filter(r =>
    !r.tipo_servico || r.tipo_servico === ag.tipo_servico
  )
  if (!aplicaveis.length) return { criados: 0, ignorados: 0, erros: 0 }

  let criados  = 0
  let ignorados = 0
  let erros    = 0

  for (const regra of aplicaveis) {
    // Regra sem telefone não pode gerar alerta
    if (!regra.destinatario_whatsapp) {
      ignorados++
      continue
    }

    const horarioEnvio = calcularHorarioEnvio(ag.data_hora_servico, regra.antecedencia_minutos)
    if (!horarioEnvio) {
      ignorados++
      continue
    }

    const idempotencyKey = `${ag.id}:regra:${regra.id}`

    try {
      const { error: insertErr } = await supabase.from('agendamento_alertas').insert({
        agendamento_id:            ag.id,
        destinatario_tipo:         regra.destinatario_tipo          || 'personalizado',
        destinatario_nome:         regra.destinatario_nome          || null,
        destinatario_whatsapp:     regra.destinatario_whatsapp,
        antecedencia_minutos:      regra.antecedencia_minutos,
        horario_previsto_envio:    horarioEnvio,
        solicitar_confirmacao:     regra.solicitar_confirmacao      ?? false,
        reenviar_se_nao_confirmar: regra.reenviar_se_nao_confirmar  ?? false,
        intervalo_reenvio_min:     regra.intervalo_reenvio_min      ?? 60,
        max_tentativas:            regra.max_tentativas             ?? 3,
        ativo:                     true,
        status:                    'pendente',
        idempotency_key:           idempotencyKey,
      })

      if (!insertErr) {
        criados++
      } else if (insertErr.code === '23505') {
        // Violação de unique → alerta já existia (idempotente)
        ignorados++
      } else {
        console.error(`[motor-alertas] insert regra ${regra.id}:`, insertErr.message)
        erros++
      }
    } catch (e) {
      console.error(`[motor-alertas] exception regra ${regra.id}:`, e.message)
      erros++
    }
  }

  if (criados > 0 || erros > 0) {
    console.log(`[motor-alertas] ag=${ag.id} criados=${criados} ignorados=${ignorados} erros=${erros}`)
  }

  return { criados, ignorados, erros }
}
