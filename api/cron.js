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

// ── Retry de boletins com erro (Gemini 503 etc.) ────────────────────────────
// Reprocessa boletins em status 'erro' das últimas 4 horas (máx 5 por execução)
async function handleBoletinsRetry(db, req, res) {
  const quatro_horas_atras = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  const cinco_min_atras    = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data: boletins } = await db
    .from('maquinas_boletins')
    .select('id, numero, wa_from')
    .eq('status', 'erro')
    .gte('created_at', quatro_horas_atras)
    .lte('updated_at', cinco_min_atras)   // só retenta se parado há >5 min
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

// ── Entry point ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const db = getDb()
  const type = req.query.type
  if (type === 'lembretes')            return handleLembretes(db, res)
  if (type === 'relatorio')            return handleRelatorio(db, res)
  if (type === 'refeicoes-pendentes')  return handleRefeicoesPendentes(db, res)
  if (type === 'refeicoes-validacao')  return handleRefeicoesValidacao(db, res)
  if (type === 'boletins-retry')       return handleBoletinsRetry(db, req, res)
  if (type === 'dds-abertos')          return handleDdsAbertos(db, res)
  return res.status(400).json({ error: 'type param required: lembretes | relatorio | refeicoes-pendentes | refeicoes-validacao | boletins-retry | dds-abertos' })
}
