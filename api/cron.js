/**
 * GET /api/cron?type=lembretes  → envia lembrete semanal de saldos
 * GET /api/cron?type=relatorio  → envia relatório mensal
 * Ambos chamados pelo Vercel Cron (Authorization: Bearer CRON_SECRET)
 */
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const APP_URL = process.env.APP_URL || APP_URL

function getDb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { realtime: { params: { log_level: 'disabled' }, transport: ws }, global: {} })
}

function formatBRL(v) {
  return 'R$ ' + Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function calcularSaldos(despesas, pessoas) {
  const balances = {}
  pessoas.forEach(p => { balances[p.id] = 0 })
  despesas.filter(e => e.status !== 'pago').forEach(exp => {
    const { valor, pago_por, participantes, parcelas } = exp
    if (!participantes?.length || !pago_por) return
    const share = (valor / (parcelas || 1)) / participantes.length
    participantes.forEach(pid => {
      if (pid === pago_por) return
      if (balances[pid] !== undefined) balances[pid] -= share
      if (balances[pago_por] !== undefined) balances[pago_por] += share
    })
  })
  return pessoas.map(p => ({
    id: p.id,
    nome: p.nome,
    saldo: Math.round((balances[p.id] || 0) * 100) / 100,
  }))
}

async function sendWA(to, text) {
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    }
  )
  return res.ok
}

// ── Handler: lembretes semanais ──────────────────────────────────────────────
async function handleLembretes(db, res) {
  const [{ data: pessoas }, { data: despesas }, { data: canais }] = await Promise.all([
    db.from('pessoas').select('id, nome'),
    db.from('despesas').select('id, valor, pago_por, participantes, parcelas, status'),
    db.from('canais_mensagem').select('telefone, pessoa_id').eq('ativo', true),
  ])

  if (!canais?.length) return res.status(200).json({ sent: 0 })

  const saldos = calcularSaldos(despesas || [], pessoas || [])
  let sent = 0

  for (const canal of canais) {
    const saldo = saldos.find(s => s.id === canal.pessoa_id)
    if (!saldo || Math.abs(saldo.saldo) < 0.01) continue
    const msg = saldo.saldo < 0
      ? `👋 *Lembrete semanal — SmartPro*\n\nVocê ainda deve *${formatBRL(Math.abs(saldo.saldo))}*.\n\nQuer acertar? Me avise aqui ou acesse ${APP_URL} 😊`
      : `👋 *Lembrete semanal — SmartPro*\n\nVocê tem *${formatBRL(saldo.saldo)}* a receber.\n\nAcesse ${APP_URL} para ver os detalhes. 💰`
    await sendWA(canal.telefone, msg)
    sent++
  }
  return res.status(200).json({ sent })
}

// ── Handler: relatório mensal ────────────────────────────────────────────────
async function handleRelatorio(db, res) {
  const now = new Date()
  const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const mesStr  = mesAnterior.toISOString().slice(0, 7)
  const nomeMes = mesAnterior.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  const [{ data: pessoas }, { data: despesas }, { data: canais }] = await Promise.all([
    db.from('pessoas').select('id, nome'),
    db.from('despesas').select('id, descricao, valor, data, status, pago_por, participantes, parcelas'),
    db.from('canais_mensagem').select('telefone, pessoa_id').eq('ativo', true),
  ])

  if (!canais?.length) return res.status(200).json({ sent: 0 })

  const todasDespesas = despesas || []
  const todasPessoas  = pessoas  || []
  const doMes    = todasDespesas.filter(e => e.data?.slice(0, 7) === mesStr)
  const total    = doMes.reduce((s, e) => s + (e.valor || 0), 0)
  const pagos    = doMes.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
  const pendente = doMes.filter(e => e.status === 'pendente').reduce((s, e) => s + e.valor, 0)
  const saldos   = calcularSaldos(todasDespesas, todasPessoas).filter(s => Math.abs(s.saldo) > 0.01)

  let sent = 0
  for (const canal of canais) {
    const saldoPessoa = saldos.find(s => s.id === canal.pessoa_id)
    const saldoLinha  = saldoPessoa
      ? saldoPessoa.saldo > 0
        ? `\n💚 Você tem *${formatBRL(saldoPessoa.saldo)}* a receber`
        : `\n🔴 Você deve *${formatBRL(Math.abs(saldoPessoa.saldo))}*`
      : '\n✅ Você está quite'
    const msg = `📊 *Relatório de ${nomeMes}*\n\nTotal gasto: ${formatBRL(total)}\nPago: ${formatBRL(pagos)}\nPendente: ${formatBRL(pendente)}${saldoLinha}\n\nAcesse ${APP_URL} para ver o detalhamento completo.`
    await sendWA(canal.telefone, msg)
    sent++
  }
  return res.status(200).json({ sent })
}

// ── Handler: lembretes de refeições pendentes ────────────────────────────────
async function handleRefeicoesPendentes(db, res) {
  const fmtData = d => d ? String(d).split('-').reverse().join('/') : '—'
  const fmtBRL  = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  // Busca pendentes criados há mais de 2 horas
  const limite = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: pendentes } = await db
    .from('refei_solicitacoes')
    .select('id, numero_pedido, data_refeicao, valor_total, total_refeicoes, total_cafes, supervisor_telefone, token_aprovacao, refei_equipes(nome, cdc)')
    .in('status', ['pendente', 'aguardando_aprovacao'])
    .lt('criado_em', limite)

  if (!pendentes?.length) return res.status(200).json({ sent: 0, pendentes: 0 })

  // Agrupa por supervisor_telefone
  const porSupervisor = {}
  for (const sol of pendentes) {
    if (!sol.supervisor_telefone) continue
    if (!porSupervisor[sol.supervisor_telefone]) porSupervisor[sol.supervisor_telefone] = []
    porSupervisor[sol.supervisor_telefone].push(sol)
  }

  let sent = 0
  for (const [telefone, sols] of Object.entries(porSupervisor)) {
    const linhas = [
      `🔔 *${sols.length === 1 ? '1 pedido aguarda' : sols.length + ' pedidos aguardam'} sua aprovação*`,
      ``,
      ...sols.map(s => {
        const eq = s.refei_equipes
        return [
          `📋 *${s.numero_pedido}* — ${eq?.nome || '—'}${eq?.cdc ? ' (CDC ' + eq.cdc + ')' : ''}`,
          `   📅 ${fmtData(s.data_refeicao)}  ·  ${s.total_refeicoes}🍽️  ${s.total_cafes}☕  *${fmtBRL(s.valor_total)}*`,
          `   👉 ${APP_URL}/ar/${s.token_aprovacao}`,
        ].join('\n')
      }),
    ]

    const phone = String(telefone).replace(/\D/g, '')
    if (!phone) continue

    try {
      const r = await fetch(
        `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
          },
          body: JSON.stringify({ phone, message: linhas.join('\n') }),
        }
      )
      if (r.ok) sent++
      else console.error(`[cron:refeicoes] sendWA falhou ${r.status} para ${phone}`)
    } catch (err) {
      console.error(`[cron:refeicoes] sendWA exception para ${phone}:`, err.message)
    }
  }

  return res.status(200).json({ sent, pendentes: pendentes.length })
}

// ── Cron: enviar link de validação de entrega ao líder (dia seguinte) ────────
// Executa diariamente às 10:00 UTC; busca pedidos com status enviado/confirmado
// onde data_refeicao = ontem → muda para aguardando_validacao e notifica líder.
async function handleRefeicoesValidacao(db, res) {
  const fmtData = d => d ? String(d).split('-').reverse().join('/') : '—'

  // Calcula "ontem" no formato YYYY-MM-DD
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: pedidos } = await db
    .from('refei_solicitacoes')
    .select('id, numero_pedido, ticket, data_refeicao, lider_telefone, token_lider')
    .in('status', ['enviado_restaurante', 'confirmado_restaurante', 'preparando', 'entregue'])
    .eq('data_refeicao', ontem)

  if (!pedidos?.length) return res.status(200).json({ sent: 0, validacoes: 0 })

  const now = new Date().toISOString()
  let sent = 0

  for (const sol of pedidos) {
    try {
      await db.from('refei_solicitacoes').update({
        status:           'aguardando_validacao',
        validacao_cron_em: now,
      }).eq('id', sol.id)

      if (sol.lider_telefone) {
        const codigo = sol.ticket || sol.numero_pedido
        const msg = [
          `🔔 *Validação de Entrega — ${codigo}*`,
          `📅 Data do pedido: ${fmtData(sol.data_refeicao)}`,
          ``,
          `A refeição foi entregue conforme esperado?`,
          ``,
          `Responda *SIM* se tudo certo, ou *NÃO* se houve algum problema.`,
          ``,
          `Ou acesse o link para mais opções:`,
          `${APP_URL}/vr/${sol.token_lider}`,
        ].join('\n')

        const phone = String(sol.lider_telefone).replace(/\D/g, '')
        const r = await fetch(
          `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
            },
            body: JSON.stringify({ phone, message: msg }),
          }
        )
        if (r.ok) sent++
        else console.error(`[cron:validacao] sendWA falhou ${r.status} para ${phone}`)
      }
    } catch (err) {
      console.error(`[cron:validacao] exception para sol ${sol.id}:`, err.message)
    }
  }

  return res.status(200).json({ sent, validacoes: pedidos.length })
}

// ── Fila sequencial de boletins (recebido + erro) ───────────────────────────
// Processa até 8 boletins por execução, 1 por vez, com 4s de intervalo.
// Chamado a cada 5 min via cron → suporta ~96 boletins/hora sem saturar o Groq.
async function handleBoletinsFila(db, req, res) {
  // Pega boletins em status 'recebido' (novos) OU 'erro' (retry) — em ordem de chegada
  // Sem limite de tempo: o status é suficiente para evitar reprocessamento
  const { data: boletins } = await db
    .from('maquinas_boletins')
    .select('id, numero, wa_from, status')
    .in('status', ['recebido', 'erro'])
    .order('created_at', { ascending: true })
    .limit(8)

  if (!boletins?.length) return res.status(200).json({ processados: 0 })

  const host = req.headers.host || process.env.APP_URL?.replace('https://', '')
  const selfBase = `https://${host}`
  let processados = 0

  for (const bol of boletins) {
    // Marca como 'processando' antes de disparar — evita dupla execução
    await db.from('maquinas_boletins').update({ status: 'processando' }).eq('id', bol.id)
    try {
      // Espera resposta (OCR pode levar até 60s — maxDuration do endpoint)
      const resp = await fetch(`${selfBase}/api/ocr-boletim-maquina`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boletimId: bol.id }),
      })
      if (resp.ok) {
        processados++
        console.log(`[cron:boletins-fila] ✓ ${bol.numero} (${bol.id})`)
      } else {
        console.warn(`[cron:boletins-fila] HTTP ${resp.status} para ${bol.id}`)
        await db.from('maquinas_boletins').update({ status: 'erro' }).eq('id', bol.id)
      }
    } catch (e) {
      console.error(`[cron:boletins-fila] falha ${bol.id}:`, e.message)
      await db.from('maquinas_boletins').update({ status: 'erro' }).eq('id', bol.id)
    }
    // 4s entre chamadas para não saturar o Groq
    await new Promise(r => setTimeout(r, 4000))
  }

  return res.status(200).json({ processados, total: boletins.length })
}

// ── Retry de boletins com erro (Gemini 503 etc.) ────────────────────────────
// Reprocessa boletins em status 'erro' das últimas 4 horas (máx 5 por execução)
async function handleBoletinsRetry(db, req, res) {
  // Reprocessa boletins em status 'erro' — sem limite de tempo
  const { data: boletins } = await db
    .from('maquinas_boletins')
    .select('id, numero, wa_from')
    .eq('status', 'erro')
    .order('created_at', { ascending: true })
    .limit(5)

  if (!boletins?.length) return res.status(200).json({ retried: 0 })

  const host = req.headers.host || process.env.APP_URL?.replace('https://', '')
  const selfBase = `https://${host}`
  let retried = 0

  for (const bol of boletins) {
    // Marca como 'recebido' antes de disparar para evitar dupla-execução
    await db.from('maquinas_boletins').update({ status: 'recebido' }).eq('id', bol.id)
    try {
      await fetch(`${selfBase}/api/ocr-boletim-maquina`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boletimId: bol.id }),
      })
      retried++
      console.log(`[cron:boletins-retry] disparado OCR para boletim ${bol.numero} (${bol.id})`)
    } catch (e) {
      console.error(`[cron:boletins-retry] falha ao disparar OCR para ${bol.id}:`, e.message)
      await db.from('maquinas_boletins').update({ status: 'erro' }).eq('id', bol.id)
    }
    await new Promise(r => setTimeout(r, 3000))  // 3s entre requests para não saturar Gemini
  }

  return res.status(200).json({ retried, total: boletins.length })
}

// ── Handler: DDS abertos há mais de 24h ─────────────────────────────────────
async function handleDdsAbertos(db, res) {
  const limite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: abertos, error } = await db
    .from('dds_registros')
    .select('id, workspace_id, data, turno_id, lider_id')
    .eq('status', 'em_andamento')
    .lt('created_at', limite)
  if (error) return res.status(500).json({ error: error.message })
  if (!abertos?.length) return res.status(200).json({ encerrados: 0 })

  // Encerra como "expirado" e notifica supervisor do workspace
  let encerrados = 0
  for (const reg of abertos) {
    await db.from('dds_registros')
      .update({ status: 'expirado', encerrado_em: new Date().toISOString() })
      .eq('id', reg.id)
    encerrados++
  }
  return res.status(200).json({ encerrados })
}

// ── Handler: encerra cotações de compra com prazo vencido ───────────────────
async function handleCotacoesExpiradas(db, res) {
  const agora = new Date().toISOString()
  // Busca solicitações com leilão aberto e prazo vencido
  const { data: expiradas, error } = await db
    .from('solicitacoes_compra')
    .select('id, workspace_id, titulo, token_aprovador')
    .eq('status', 'leilao_aberto')
    .lt('prazo_cotacao', agora)
  if (error) return res.status(500).json({ error: error.message })
  if (!expiradas?.length) return res.status(200).json({ encerradas: 0 })

  let encerradas = 0
  for (const sol of expiradas) {
    // Marca como leilão encerrado
    await db.from('solicitacoes_compra')
      .update({ status: 'leilao_encerrado', updated_at: agora })
      .eq('id', sol.id)

    // Marca cotações pendentes como expiradas
    await db.from('cotacoes_compra')
      .update({ status: 'expirado' })
      .eq('solicitacao_id', sol.id)
      .in('status', ['convidado', 'enviado'])

    // Registra evento de auditoria
    await db.from('solicitacao_compra_eventos').insert({
      solicitacao_id: sol.id,
      workspace_id:   sol.workspace_id,
      acao:           'leilao_encerrado',
      status_de:      'leilao_aberto',
      status_para:    'leilao_encerrado',
      observacao:     'Encerrado automaticamente por prazo vencido',
      ator:           'cron',
      criado_em:      agora,
    }).catch(() => {}) // silencioso se tabela não existir ainda

    encerradas++
  }
  return res.status(200).json({ encerradas })
}

// ── Handler: limpa flow_action_tokens expirados ──────────────────────────────
async function handleFlowTokensLimpeza(db, res) {
  const agora = new Date().toISOString()
  const { data, error } = await db
    .from('flow_action_tokens')
    .delete()
    .lt('expira_em', agora)
    .in('status', ['pendente', 'expirado'])
    .select('id')
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ removidos: (data || []).length })
}

// ── Handler: cria OS preventivas a partir de manut_planos com proxima_data vencida ─
async function handleOsPreventivas(db, res) {
  const hoje = new Date().toISOString().slice(0, 10)
  // Planos ativos com proxima_data <= hoje (vencidos ou vencendo hoje)
  const { data: planos, error } = await db
    .from('manut_planos')
    .select('id, workspace_id, titulo, descricao, equipamento_id, equipamento_nome, periodicidade, proxima_data')
    .eq('ativo', true)
    .lte('proxima_data', hoje)
    .not('proxima_data', 'is', null)
  if (error) return res.status(500).json({ error: error.message })
  if (!planos?.length) return res.status(200).json({ criadas: 0 })

  // Mapa de periodicidade → dias
  const PERIODICIDADE_DIAS = {
    diaria: 1, semanal: 7, quinzenal: 15, mensal: 30,
    trimestral: 90, semestral: 180, anual: 365,
  }

  let criadas = 0
  for (const plano of planos) {
    // Verifica se já existe OS aberta gerada por este plano (evita duplicatas)
    const { data: osExistente } = await db
      .from('manut_os')
      .select('id')
      .eq('plano_id', plano.id)
      .in('status', ['aberta', 'em_andamento'])
      .maybeSingle()
    if (osExistente) continue // já tem OS em aberto para este plano

    // Gera número sequencial simples
    const seq = String(Date.now()).slice(-6)
    const numero = `OS-PREV-${seq}`

    await db.from('manut_os').insert({
      workspace_id:    plano.workspace_id,
      numero,
      tipo:            'preventiva',
      prioridade:      'media',
      status:          'aberta',
      plano_id:        plano.id,
      equipamento_id:  plano.equipamento_id || null,
      equipamento_nome: plano.equipamento_nome || null,
      titulo:          `[PREVENTIVA] ${plano.titulo}`,
      descricao:       plano.descricao || null,
      solicitante:     'Cron Automático',
      data_abertura:   hoje,
      data_prevista:   hoje,
    })

    // Avança proxima_data conforme periodicidade
    const dias = PERIODICIDADE_DIAS[plano.periodicidade] || 30
    const proxima = new Date(hoje)
    proxima.setDate(proxima.getDate() + dias)
    await db.from('manut_planos')
      .update({ ultima_execucao: hoje, proxima_data: proxima.toISOString().slice(0, 10), updated_at: new Date().toISOString() })
      .eq('id', plano.id)

    criadas++
  }
  return res.status(200).json({ criadas })
}

// ── Handler: limpeza de arquivos órfãos em comprovantes/whatsapp/ ────────────
// Remove arquivos com mais de 7 dias que não têm referência em nenhum lançamento.
// Seguro: só apaga o que já foi confirmado como sem uso.
async function handleStorageLimpeza(db, res) {
  const BUCKET = 'comprovantes'
  const PASTA  = 'whatsapp'
  const DIAS   = 7
  const limite = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000)

  // Lista arquivos na pasta whatsapp/
  const { data: arquivos, error: listErr } = await db.storage.from(BUCKET).list(PASTA, {
    limit: 200,
    sortBy: { column: 'created_at', order: 'asc' },
  })
  if (listErr) return res.status(500).json({ error: listErr.message })
  if (!arquivos?.length) return res.status(200).json({ removidos: 0, total: 0 })

  // Filtra apenas arquivos mais antigos que DIAS dias
  const candidatos = arquivos.filter(f => {
    const dt = f.created_at ? new Date(f.created_at) : null
    return dt && dt < limite
  })
  if (!candidatos.length) return res.status(200).json({ removidos: 0, total: arquivos.length })

  // Monta URLs públicas para cruzar com lancamentos.comprovante_url
  const paths = candidatos.map(f => `${PASTA}/${f.name}`)
  const urlBase = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`
  const urls = paths.map(p => `${urlBase}${p}`)

  // Verifica quais URLs ainda são referenciadas em lancamentos
  const { data: usados } = await db
    .from('lancamentos')
    .select('comprovante_url')
    .in('comprovante_url', urls)
  const urlsUsadas = new Set((usados || []).map(l => l.comprovante_url))

  // Filtra apenas os realmente órfãos
  const orphanPaths = paths.filter(p => !urlsUsadas.has(`${urlBase}${p}`))
  if (!orphanPaths.length) return res.status(200).json({ removidos: 0, total: candidatos.length, orfaos: 0 })

  // Remove em lotes de 50 (limite da API)
  let removidos = 0
  for (let i = 0; i < orphanPaths.length; i += 50) {
    const lote = orphanPaths.slice(i, i + 50)
    const { error: delErr } = await db.storage.from(BUCKET).remove(lote)
    if (delErr) {
      console.error('[cron:storage-limpeza] erro ao remover lote:', delErr.message)
    } else {
      removidos += lote.length
    }
  }
  console.log(`[cron:storage-limpeza] ${removidos} arquivo(s) órfão(s) removidos de ${BUCKET}/${PASTA}/`)
  return res.status(200).json({ removidos, total: candidatos.length, orfaos: orphanPaths.length })
}

// ── Entry point ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const isVercelCron = req.headers['user-agent']?.startsWith('vercel-cron')
  const hasSecret    = process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`
  if (!isVercelCron && !hasSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const db = getDb()
  const type = req.query.type
  if (type === 'lembretes')              return handleLembretes(db, res)
  if (type === 'relatorio')              return handleRelatorio(db, res)
  if (type === 'refeicoes-pendentes')    return handleRefeicoesPendentes(db, res)
  if (type === 'refeicoes-validacao')    return handleRefeicoesValidacao(db, res)
  if (type === 'boletins-fila')          return handleBoletinsFila(db, req, res)
  if (type === 'boletins-retry')         return handleBoletinsRetry(db, req, res)
  if (type === 'dds-abertos')            return handleDdsAbertos(db, res)
  if (type === 'cotacoes-expiradas')     return handleCotacoesExpiradas(db, res)
  if (type === 'flow-tokens-limpeza')    return handleFlowTokensLimpeza(db, res)
  if (type === 'os-preventivas')         return handleOsPreventivas(db, res)
  if (type === 'storage-limpeza')        return handleStorageLimpeza(db, res)
  return res.status(400).json({ error: 'type param required: lembretes | relatorio | refeicoes-pendentes | refeicoes-validacao | boletins-fila | boletins-retry | dds-abertos | cotacoes-expiradas | flow-tokens-limpeza | os-preventivas | storage-limpeza' })
}
