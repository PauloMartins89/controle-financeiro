import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const ADMIN_EMAIL = 'ph.mar89s@gmail.com'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
    { realtime: { params: { log_level: 'disabled' }, transport: ws }, global: {} }
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

// Verifica se o usuário logado é membro ativo de algum workspace.
// isAdmin = true quando perfil_id IS NULL (acesso total ao workspace).
async function verifyWorkspaceMember(req) {
  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const db = getDb()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return null
  const { data: member } = await db
    .from('workspace_members')
    .select('workspace_id, perfil_id, ativo')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return null
  return {
    user,
    workspaceId: member.workspace_id,
    isAdmin: member.perfil_id === null, // sem perfil restrito = admin da empresa
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── Ações de workspace admin (não exigem ser plataforma admin) ────────────
  const wsAction = req.method === 'POST' ? req.body?.action
                 : req.method === 'GET'  ? req.query?.action
                 : null

  if (wsAction === 'workspace-add-user' || wsAction === 'workspace-members-list') {
    const wsMember = await verifyWorkspaceMember(req)
    if (!wsMember) return res.status(401).json({ error: 'Não autorizado' })
    if (!wsMember.isAdmin) return res.status(403).json({ error: 'Apenas o admin do workspace pode realizar esta ação' })
    const db = getDb()

    // Lista membros do workspace com e-mails
    if (wsAction === 'workspace-members-list') {
      const { data: members } = await db
        .from('workspace_members')
        .select('id, user_id, perfil_id, ativo, created_at')
        .eq('workspace_id', wsMember.workspaceId)
        .order('created_at')
      if (!members || members.length === 0) return res.status(200).json({ members: [] })
      const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 })
      const userMap = {}
      users.forEach(u => {
        userMap[u.id] = {
          email: u.email,
          nome: u.user_metadata?.full_name || u.email,
        }
      })
      const result = members.map(m => ({
        ...m,
        email: userMap[m.user_id]?.email || '—',
        nome:  userMap[m.user_id]?.nome  || '—',
      }))
      return res.status(200).json({ members: result })
    }

    // Cria usuário (se ainda não existe) e adiciona ao workspace
    if (wsAction === 'workspace-add-user') {
      const { email, nome, password } = req.body
      if (!email || !nome) return res.status(400).json({ error: 'email e nome são obrigatórios' })

      // Verifica se já existe
      const listResult = await db.auth.admin.listUsers({ perPage: 1000 })
      const existingUser = (listResult.data?.users || []).find(
        u => u.email?.toLowerCase() === email.toLowerCase()
      )
      let userId = existingUser?.id

      if (!userId) {
        // Cria novo usuário
        const pwd = password?.trim() || (Math.random().toString(36).slice(2) + 'Aa1!')
        const createRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            email,
            password: pwd,
            email_confirm: false,
            user_metadata: { full_name: nome },
          }),
        })
        const createData = await createRes.json()
        if (!createRes.ok || !createData.id) {
          return res.status(400).json({ error: createData.message || 'Erro ao criar usuário' })
        }
        userId = createData.id

        // Assinatura isento
        await db.from('assinaturas').upsert({
          user_id: userId, email, status: 'isento', plan: 'isento',
          trial_expires_at: null, expires_at: null,
        }, { onConflict: 'user_id' })

        // Confirma e-mail (ignora erro — triggers são tolerantes a falha)
        await db.auth.admin.updateUserById(userId, { email_confirm: true }).catch(() => {})
      }

      // Adiciona ao workspace (upsert — idempotente)
      const { error: addError } = await db.from('workspace_members').upsert(
        { workspace_id: wsMember.workspaceId, user_id: userId, ativo: true },
        { onConflict: 'workspace_id,user_id' }
      )
      if (addError) return res.status(400).json({ error: addError.message })

      return res.status(200).json({ ok: true, user_id: userId, is_new: !existingUser })
    }
  }

  // ── Ações de plataforma admin ─────────────────────────────────────────────
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

    // Lista membros de um workspace com e-mails (via auth.admin)
    if (action === 'workspace-members') {
      const { workspace_id } = req.query
      if (!workspace_id) return res.status(400).json({ error: 'workspace_id obrigatório' })
      const { data: members } = await db.from('workspace_members')
        .select('id, user_id, perfil_id, ativo, created_at')
        .eq('workspace_id', workspace_id)
        .order('created_at')
      if (!members || members.length === 0) return res.status(200).json({ members: [] })
      const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 })
      const userMap = {}
      users.forEach(u => { userMap[u.id] = u.email })
      const result = members.map(m => ({ ...m, email: userMap[m.user_id] || m.user_id }))
      return res.status(200).json({ members: result })
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

    // Adiciona um usuário existente a um workspace
    if (action === 'add-member') {
      const { workspace_id, email } = req.body
      if (!workspace_id || !email) return res.status(400).json({ error: 'workspace_id e email obrigatórios' })
      const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 })
      const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado. Verifique se o e-mail está cadastrado na plataforma.' })
      const { data: existing } = await db.from('workspace_members')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (existing) return res.status(409).json({ error: 'Usuário já é membro desta empresa.' })
      const { error } = await db.from('workspace_members').insert({ workspace_id, user_id: user.id, ativo: true })
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true, email: user.email, user_id: user.id })
    }

    // Remove um membro de um workspace
    if (action === 'remove-member') {
      const { member_id } = req.body
      if (!member_id) return res.status(400).json({ error: 'member_id obrigatório' })
      const { error } = await db.from('workspace_members').delete().eq('id', member_id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    // Cria usuário com e-mail + senha (admin cria conta sem confirmação de e-mail)
    if (action === 'create_user') {
      const { email, password, nome, telefone } = req.body
      if (!email || !password || !nome) return res.status(400).json({ error: 'email, password e nome são obrigatórios' })

      // Usa a REST Admin API diretamente para evitar problemas com hooks/triggers do SDK
      const supabaseUrl = process.env.SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_KEY
      if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY não configurada no servidor' })

      // Passo 1: cria sem confirmar o e-mail (evita trigger on_auth_user_confirmed)
      const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: false,
          user_metadata: { full_name: nome, whatsapp: telefone || null },
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) {
        console.error('[create_user] Supabase error:', JSON.stringify(createData))
        return res.status(400).json({ error: createData.message || createData.msg || JSON.stringify(createData) })
      }
      const userId = createData.id

      // Passo 2: insere assinatura isento ANTES de confirmar (evita conflito com trigger)
      await db.from('assinaturas').upsert({
        user_id: userId,
        email,
        status: 'isento',
        plan: 'isento',
        trial_expires_at: null,
        expires_at: null,
      }, { onConflict: 'user_id' })

      // Passo 3: confirma o e-mail via SDK (mais confiável que fetch manual)
      const { error: confirmError } = await db.auth.admin.updateUserById(userId, { email_confirm: true })
      if (confirmError) {
        console.error('[create_user] Erro ao confirmar e-mail:', confirmError.message)
        // Não bloqueia — usuário foi criado, admin pode confirmar depois
      }

      return res.status(200).json({ ok: true, user_id: userId })
    }

    // Confirma o e-mail de um usuário existente (corrige "Email not confirmed")
    if (action === 'confirm-email') {
      const { email } = req.body
      if (!email) return res.status(400).json({ error: 'email obrigatório' })
      const supabaseUrl = process.env.SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_KEY
      if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY não configurada' })
      try {
        const listResult = await db.auth.admin.listUsers({ perPage: 1000 })
        if (listResult.error) return res.status(500).json({ error: listResult.error.message })
        const users = listResult.data?.users || []
        const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' })

        // Tenta via REST API (GoTrue Admin)
        const confirmRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ email_confirm: true }),
        })

        if (confirmRes.ok) {
          return res.status(200).json({ ok: true })
        }

        // Fallback: confirma diretamente via SQL (requer função admin_confirm_user_email no DB)
        console.warn('[confirm-email] REST falhou, tentando via RPC...')
        const { error: rpcError } = await db.rpc('admin_confirm_user_email', { p_email: email.toLowerCase() })
        if (rpcError) {
          console.error('[confirm-email] RPC falhou:', rpcError.message)
          return res.status(500).json({ error: rpcError.message })
        }
        return res.status(200).json({ ok: true, via: 'rpc' })
      } catch (err) {
        console.error('[confirm-email] exceção:', err.message)
        return res.status(500).json({ error: err.message })
      }
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
