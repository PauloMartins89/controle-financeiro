import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'ph.mar89s@gmail.com'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  )
}

async function verifyAdmin(req) {
  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const db = getDb()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return null
  if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return null
  return user
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const admin = await verifyAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Não autorizado' })

  const db = getDb()

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { action } = req.query

    // Lista de todas as pessoas + canais + mensagens recentes
    if (action === 'dashboard') {
      const [
        { data: pessoas },
        { data: canais },
        { data: msgs },
        { data: assinaturas },
        authResult,
      ] = await Promise.all([
        db.from('pessoas').select('id, nome, telefone, owner_id, is_owner').order('nome'),
        db.from('canais_mensagem').select('*').order('created_at', { ascending: false }),
        db.from('mensagens_whatsapp').select('*').order('created_at', { ascending: false }).limit(100),
        db.from('assinaturas').select('*').order('created_at', { ascending: false }),
        db.auth.admin.listUsers({ perPage: 200 }),
      ])

      return res.status(200).json({
        pessoas:      pessoas      || [],
        canais:       canais       || [],
        msgs:         msgs         || [],
        assinaturas:  assinaturas  || [],
        authUsers:    authResult.data?.users || [],
      })
    }

    // Lista motoristas cadastrados no whatsapp_config
    if (action === 'list_motoristas') {
      const { data } = await db.from('whatsapp_config')
        .select('*, workspaces(nome)')
        .order('created_at', { ascending: false })
      return res.status(200).json({ motoristas: data || [] })
    }

    return res.status(400).json({ error: 'Ação inválida' })
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { action } = req.body

    // Atualiza telefone de uma pessoa e recria o canal automaticamente
    if (action === 'update_telefone') {
      const { pessoa_id, telefone } = req.body
      if (!pessoa_id) return res.status(400).json({ error: 'pessoa_id obrigatório' })
      const tel = telefone?.replace(/\D/g, '') || null

      const { error: errPessoa } = await db.from('pessoas').update({ telefone: tel || null }).eq('id', pessoa_id)
      if (errPessoa) return res.status(400).json({ error: errPessoa.message })

      // Remove canal antigo e recria com o novo número
      await db.from('canais_mensagem').delete().eq('pessoa_id', pessoa_id)
      if (tel) {
        const { data: pessoa } = await db.from('pessoas').select('owner_id').eq('id', pessoa_id).single()
        const { error: errCanal } = await db.from('canais_mensagem').upsert(
          { telefone: tel, pessoa_id, owner_id: pessoa?.owner_id || null, ativo: true },
          { onConflict: 'telefone' }
        )
        if (errCanal) return res.status(400).json({ error: errCanal.message })
      }

      return res.status(200).json({ ok: true })
    }

    // Reatribui o owner_id de um canal para o auth user correto
    if (action === 'fix_owner') {
      const { canal_id } = req.body
      if (!canal_id) return res.status(400).json({ error: 'canal_id obrigatório' })
      const { data: canal } = await db.from('canais_mensagem').select('pessoa_id').eq('id', canal_id).single()
      if (!canal?.pessoa_id) return res.status(400).json({ error: 'Canal sem pessoa vinculada' })
      const { data: pessoa } = await db.from('pessoas').select('owner_id').eq('id', canal.pessoa_id).single()
      if (!pessoa?.owner_id) return res.status(400).json({ error: 'Pessoa sem owner_id' })
      const { error } = await db.from('canais_mensagem').update({ owner_id: pessoa.owner_id }).eq('id', canal_id)
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true, owner_id: pessoa.owner_id })
    }

    // Liga/desliga um canal
    if (action === 'toggle_ativo') {
      const { canal_id, ativo } = req.body
      if (!canal_id) return res.status(400).json({ error: 'canal_id obrigatório' })
      const { error } = await db.from('canais_mensagem').update({ ativo: Boolean(ativo) }).eq('id', canal_id)
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    // Vincula um número manualmente a uma pessoa (sem alterar pessoas.telefone)
    if (action === 'link_canal') {
      const { pessoa_id, telefone } = req.body
      if (!pessoa_id || !telefone) return res.status(400).json({ error: 'pessoa_id e telefone obrigatórios' })
      const tel = telefone.replace(/\D/g, '')
      if (!tel) return res.status(400).json({ error: 'Telefone inválido' })
      const { data: pessoa } = await db.from('pessoas').select('owner_id').eq('id', pessoa_id).single()
      const { data, error } = await db.from('canais_mensagem')
        .upsert({ telefone: tel, pessoa_id, owner_id: pessoa?.owner_id || null, ativo: true }, { onConflict: 'telefone' })
        .select().single()
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ canal: data })
    }

    // Remove canal
    if (action === 'unlink_canal') {
      const { canal_id } = req.body
      if (!canal_id) return res.status(400).json({ error: 'canal_id obrigatório' })
      const { error } = await db.from('canais_mensagem').delete().eq('id', canal_id)
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    // Limpa log de mensagens antigas (mantém os últimos N dias)
    if (action === 'limpar_logs') {
      const { dias = 30 } = req.body
      const cutoff = new Date(Date.now() - dias * 24 * 3600 * 1000).toISOString()
      const { error } = await db.from('mensagens_whatsapp').delete().lt('created_at', cutoff)
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    // Deleta uma pessoa e seu canal (admin only — service role bypassa FK)
    if (action === 'delete_pessoa') {
      const { pessoa_id } = req.body
      if (!pessoa_id) return res.status(400).json({ error: 'pessoa_id obrigatório' })
      // Remove canal vinculado primeiro
      await db.from('canais_mensagem').delete().eq('pessoa_id', pessoa_id)
      // Remove a pessoa
      const { error } = await db.from('pessoas').delete().eq('id', pessoa_id)
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    // Cria usuário com e-mail + senha (admin cria conta sem confirmação de e-mail)
    if (action === 'create_user') {
      const { email, password, nome, telefone } = req.body
      if (!email || !password || !nome) return res.status(400).json({ error: 'email, password e nome são obrigatórios' })
      // Cria o usuário via admin API (email_confirm = true → não precisa confirmar e-mail)
      const { data: newUser, error: createErr } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: nome, whatsapp: telefone || null },
      })
      if (createErr) return res.status(400).json({ error: createErr.message })
      // Marca como isento (piloto)
      await db.from('assinaturas').upsert({
        user_id: newUser.user.id,
        email,
        status: 'isento',
        plan: 'isento',
        trial_expires_at: null,
        expires_at: null,
      }, { onConflict: 'user_id' })
      return res.status(200).json({ ok: true, user_id: newUser.user.id })
    }

    // Cria ou atualiza assinatura manualmente (admin concede/revoga acesso)
    if (action === 'set_assinatura') {
      const { user_id, email, status, expires_at, plan } = req.body
      if (!email) return res.status(400).json({ error: 'email obrigatório' })
      const payload = {
        email,
        status: status || 'ativo',
        plan: plan || 'mensal',
        updated_at: new Date().toISOString(),
      }
      if (expires_at !== undefined) payload.expires_at = expires_at
      if (status === 'isento') { payload.expires_at = null; payload.trial_expires_at = null; payload.plan = 'isento' }
      if (user_id) {
        payload.user_id = user_id
        const { error } = await db.from('assinaturas').upsert(payload, { onConflict: 'user_id' })
        if (error) return res.status(400).json({ error: error.message })
      } else {
        // Sem user_id — upsert por e-mail (usuário ainda não criou conta)
        const { error } = await db.from('assinaturas').upsert(payload, { onConflict: 'email' })
        if (error) return res.status(400).json({ error: error.message })
      }
      return res.status(200).json({ ok: true })
    }

    // Adiciona/atualiza motorista no whatsapp_config
    if (action === 'add_motorista') {
      const { workspace_id, phone_number, nome_motorista } = req.body
      if (!workspace_id || !phone_number) return res.status(400).json({ error: 'workspace_id e phone_number obrigatórios' })
      const tel = phone_number.replace(/\D/g, '')
      // Busca user_id do owner do workspace para preencher automaticamente
      const { data: wsMember } = await db.from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspace_id)
        .limit(1)
        .maybeSingle()
      const { data, error } = await db.from('whatsapp_config')
        .upsert({
          workspace_id,
          phone_number: tel,
          nome_motorista: nome_motorista || null,
          ativo: true,
          user_id: wsMember?.user_id || null,
        }, { onConflict: 'phone_number' })
        .select().single()
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true, motorista: data })
    }

    // Remove motorista
    if (action === 'delete_motorista') {
      const { id } = req.body
      if (!id) return res.status(400).json({ error: 'id obrigatório' })
      const { error } = await db.from('whatsapp_config').delete().eq('id', id)
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    // Ativa/inativa motorista
    if (action === 'toggle_motorista') {
      const { id, ativo } = req.body
      if (!id) return res.status(400).json({ error: 'id obrigatório' })
      const { error } = await db.from('whatsapp_config').update({ ativo: Boolean(ativo) }).eq('id', id)
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    // Diagnóstico Z-API: verifica variáveis de ambiente e status da instância
    if (action === 'test_zapi') {
      const instanceId  = process.env.ZAPI_INSTANCE_ID  || null
      const token       = process.env.ZAPI_TOKEN         || null
      const clientToken = process.env.ZAPI_CLIENT_TOKEN  || null
      const report = {
        ts: new Date().toISOString(),
        env: {
          ZAPI_INSTANCE_ID:   instanceId   ? '✅ definido' : '❌ AUSENTE',
          ZAPI_TOKEN:         token        ? '✅ definido' : '❌ AUSENTE',
          ZAPI_CLIENT_TOKEN:  clientToken  ? '✅ definido' : '⚠️  ausente (recomendado)',
          APP_URL:            process.env.APP_URL ? `✅ ${process.env.APP_URL}` : '⚠️  ausente (usa fallback dividiai.app.br)',
        },
        zapi: null,
        teste_envio: null,
      }
      if (!instanceId || !token) {
        report.zapi = { status: 'PULADO', motivo: 'ZAPI_INSTANCE_ID ou ZAPI_TOKEN não configurados' }
        return res.status(200).json(report)
      }
      try {
        const statusRes = await fetch(
          `https://api.z-api.io/instances/${instanceId}/token/${token}/status`,
          { headers: clientToken ? { 'Client-Token': clientToken } : {} }
        )
        const body = await statusRes.json().catch(() => ({}))
        // Multi Device instances may return connected:false even when fully operational.
        // Use HTTP 200 as the primary health indicator (credentials valid + instance active).
        const apiAtiva = statusRes.status === 200 && !body.error?.toLowerCase().includes('not found')
        report.zapi = {
          http_status: statusRes.status,
          conectado: apiAtiva ? '✅ CONECTADO (Multi Device)' : '❌ DESCONECTADO',
          whatsappConnected: body.connected === true ? '✅ sim' : '⚠️ offline (normal em Multi Device)',
          smartphoneConnected: body.smartphoneConnected ?? null,
          session: body.session || null,
          raw: body,
        }
      } catch (e) {
        report.zapi = { status: 'ERRO', mensagem: e?.message }
      }
      // Teste real de envio se ?to= for fornecido
      const testTo = req.query.to || null
      if (testTo) {
        try {
          const sendRes = await fetch(
            `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(clientToken ? { 'Client-Token': clientToken } : {}),
              },
              body: JSON.stringify({ phone: testTo, message: '✅ Teste Z-API — diagnóstico DividiaI' }),
            }
          )
          const sendBody = await sendRes.json().catch(() => ({}))
          report.teste_envio = {
            para: testTo,
            http_status: sendRes.status,
            ok: sendRes.ok ? '✅ ENVIADO' : '❌ FALHOU',
            raw: sendBody,
          }
        } catch (e) {
          report.teste_envio = { status: 'ERRO', mensagem: e?.message }
        }
      } else {
        report.teste_envio = { status: 'PULADO', dica: 'Adicione &to=5511999999999 para testar envio real' }
      }
      return res.status(200).json(report)
    }

    return res.status(400).json({ error: 'Ação inválida' })
  }

  return res.status(405).end()
}
