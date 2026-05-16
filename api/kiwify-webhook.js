// Webhook do Kiwify para ativar/cancelar assinaturas
// Configure no painel Kiwify: Configurações → Webhooks → URL: https://dividiai.app.br/api/kiwify-webhook
//
// Para segurança, defina a variável KIWIFY_TOKEN no Vercel (um token secreto qualquer)
// e configure o mesmo token no campo "Token" do webhook Kiwify.

import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
}

// Kiwify envia o token no header X-Kiwify-Token ou como query param ?token=
function verifyToken(req) {
  const secret = process.env.KIWIFY_TOKEN
  if (!secret) return true // sem token configurado, aceita tudo (configure depois)
  const header = req.headers['x-kiwify-token'] || req.headers['x-hub-signature']
  const query  = req.query?.token
  return header === secret || query === secret
}

// Quantos dias de acesso cada plano concede na renovação
const PLAN_DAYS = {
  mensal: 31,
  anual:  366,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (!verifyToken(req)) {
    return res.status(401).json({ error: 'Token inválido' })
  }

  const db = getDb()
  const body = req.body || {}

  // ── Normaliza payload Kiwify ──────────────────────────────
  // Kiwify pode enviar em formatos ligeiramente diferentes por versão
  const event    = body.event || body.type || ''
  const customer = body.data?.customer || body.customer || {}
  const order    = body.data?.order    || body.order    || {}
  const sub      = body.data?.subscription || body.subscription || {}

  const email       = (customer.email || '').toLowerCase().trim()
  const orderId     = order.id   || body.order_id    || null
  const subId       = sub.id     || body.sub_id      || null
  const planName    = (sub.plan?.name || order.product?.name || 'mensal').toLowerCase().includes('anual') ? 'anual' : 'mensal'

  if (!email) {
    console.log('[kiwify-webhook] Sem e-mail no payload:', JSON.stringify(body).slice(0, 300))
    return res.status(200).json({ ok: true, warning: 'sem email' })
  }

  console.log(`[kiwify-webhook] event=${event} email=${email}`)

  // ── Busca user_id pelo e-mail ─────────────────────────────
  const { data: { users }, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) return res.status(500).json({ error: listErr.message })

  const authUser = users?.find(u => u.email?.toLowerCase() === email)
  const userId   = authUser?.id || null

  // ── Processa eventos ──────────────────────────────────────
  if (['order_approved', 'order.approved', 'purchase_approved'].includes(event)) {
    // Pagamento confirmado: ativa assinatura
    const days = PLAN_DAYS[planName] || 31
    const expiresAt = new Date(Date.now() + days * 86400 * 1000).toISOString()

    if (userId) {
      await db.from('assinaturas').upsert({
        user_id:                userId,
        email,
        status:                 'ativo',
        plan:                   planName,
        expires_at:             expiresAt,
        kiwify_order_id:        orderId,
        kiwify_subscription_id: subId,
        updated_at:             new Date().toISOString(),
      }, { onConflict: 'user_id' })
    } else {
      // Usuário ainda não criou conta — salva por e-mail para ativar no primeiro login
      await db.from('assinaturas').upsert({
        user_id:                null,
        email,
        status:                 'ativo',
        plan:                   planName,
        expires_at:             expiresAt,
        kiwify_order_id:        orderId,
        kiwify_subscription_id: subId,
        updated_at:             new Date().toISOString(),
      }, { onConflict: 'email' })
    }
    console.log(`[kiwify-webhook] Ativado: ${email} (${planName}, expira ${expiresAt})`)
  }

  else if (['subscription_renewed', 'subscription.renewed'].includes(event)) {
    // Renovação: estende expires_at a partir de hoje
    const days = PLAN_DAYS[planName] || 31
    const expiresAt = new Date(Date.now() + days * 86400 * 1000).toISOString()

    await db.from('assinaturas')
      .update({ status: 'ativo', expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('email', email)
    console.log(`[kiwify-webhook] Renovado: ${email} até ${expiresAt}`)
  }

  else if (['order_refunded', 'order.refunded', 'subscription_canceled', 'subscription.canceled'].includes(event)) {
    await db.from('assinaturas')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('email', email)
    console.log(`[kiwify-webhook] Cancelado: ${email}`)
  }

  else {
    console.log(`[kiwify-webhook] Evento não tratado: ${event}`)
  }

  return res.status(200).json({ ok: true })
}
