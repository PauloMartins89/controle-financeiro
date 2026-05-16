import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  )
  return res.ok
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const db = getDb()
  const now = new Date()

  // Mês anterior
  const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const mesStr = mesAnterior.toISOString().slice(0, 7) // "YYYY-MM"
  const nomeMes = mesAnterior.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  const [{ data: pessoas }, { data: despesas }, { data: canais }] = await Promise.all([
    db.from('pessoas').select('id, nome'),
    db.from('despesas').select('id, descricao, valor, data, status, pago_por, participantes, parcelas'),
    db.from('canais_mensagem').select('telefone, pessoa_id').eq('ativo', true),
  ])

  if (!canais?.length) return res.status(200).json({ sent: 0 })

  const todasDespesas = despesas || []
  const todasPessoas = pessoas || []

  const doMes = todasDespesas.filter(e => e.data?.slice(0, 7) === mesStr)
  const total = doMes.reduce((s, e) => s + (e.valor || 0), 0)
  const pagos = doMes.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
  const pendente = doMes.filter(e => e.status === 'pendente').reduce((s, e) => s + e.valor, 0)
  const saldos = calcularSaldos(todasDespesas, todasPessoas).filter(s => Math.abs(s.saldo) > 0.01)

  let sent = 0

  for (const canal of canais) {
    const saldoPessoa = saldos.find(s => s.id === canal.pessoa_id)
    const saldoLinha = saldoPessoa
      ? saldoPessoa.saldo > 0
        ? `\n💚 Você tem *${formatBRL(saldoPessoa.saldo)}* a receber`
        : `\n🔴 Você deve *${formatBRL(Math.abs(saldoPessoa.saldo))}*`
      : '\n✅ Você está quite'

    const msg = `📊 *Relatório de ${nomeMes}*\n\nTotal gasto: ${formatBRL(total)}\nPago: ${formatBRL(pagos)}\nPendente: ${formatBRL(pendente)}${saldoLinha}\n\nAcesse dividiai.app.br para ver o detalhamento completo.`

    await sendWA(canal.telefone, msg)
    sent++
  }

  return res.status(200).json({ sent })
}
