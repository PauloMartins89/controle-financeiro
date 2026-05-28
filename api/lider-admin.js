/**
 * api/lider-admin.js
 * Endpoints admin para o SmartLíder (requer platform admin autenticado).
 *
 * POST /api/lider-admin
 *   { action: 'criar-usuario', workspace_id, matricula, nome }
 *   { action: 'listar-usuarios', workspace_id }
 *   { action: 'resetar-senha', user_id, nova_senha }
 */
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
    { realtime: { params: { log_level: 'disabled' }, transport: ws }, global: {} }
  )
}

/** Verifica se o token pertence a um platform_admin */
async function verifyPlatformAdmin(req) {
  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const db = getDb()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return null
  const { data: adminRow } = await db
    .from('platform_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  return adminRow ? user : null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const admin = await verifyPlatformAdmin(req)
  if (!admin) return res.status(403).json({ error: 'Acesso negado — requer platform admin' })

  const db = getDb()
  const { action, workspace_id, matricula, nome, user_id, nova_senha } = req.body || {}

  // ── criar-usuario ────────────────────────────────────────────────────────
  if (action === 'criar-usuario') {
    if (!workspace_id || !matricula) return res.status(400).json({ error: 'workspace_id e matricula são obrigatórios' })
    const email    = `${matricula.toLowerCase()}@lider.smartpro`
    const password = matricula

    // Tenta criar
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        workspace_id,
        nome: nome || `Líder ${matricula}`,
        matricula,
      },
    })

    if (createErr) {
      // Se já existe, busca o user_id existente e faz upsert no perfil
      if (createErr.message?.includes('already') || createErr.code === 'email_exists') {
        const { data: existing } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const existingUser = existing?.users?.find(u => u.email === email)
        if (existingUser) {
          await db.from('lider_perfis').upsert({
            workspace_id,
            user_id:  existingUser.id,
            matricula: matricula.toLowerCase(),
            nome:      nome || `Líder ${matricula}`,
          }, { onConflict: 'user_id' })
        }
        return res.status(200).json({ ok: true, ja_existia: true, email })
      }
      return res.status(400).json({ error: createErr.message })
    }

    const newUserId = created.user?.id
    // Insere perfil na tabela lider_perfis
    if (newUserId) {
      await db.from('lider_perfis').upsert({
        workspace_id,
        user_id:   newUserId,
        matricula: matricula.toLowerCase(),
        nome:      nome || `Líder ${matricula}`,
      }, { onConflict: 'user_id' })
    }

    return res.status(200).json({ ok: true, ja_existia: false, email, user_id: newUserId })
  }

  // ── listar-usuarios ───────────────────────────────────────────────────────
  if (action === 'listar-usuarios') {
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id é obrigatório' })

    // Usa lider_perfis diretamente — muito mais rápido que varrer auth.users
    const { data: perfis, error: perfisErr } = await db
      .from('lider_perfis')
      .select('id, user_id, matricula, nome, equipe_id, ativo, created_at')
      .eq('workspace_id', workspace_id)
      .order('matricula')

    if (perfisErr) return res.status(500).json({ error: perfisErr.message })

    return res.status(200).json({
      usuarios: (perfis || []).map(p => ({
        id:           p.user_id,
        perfil_id:    p.id,
        email:        `${p.matricula}@lider.smartpro`,
        matricula:    p.matricula,
        nome:         p.nome || '',
        equipe_id:    p.equipe_id || null,
        workspace_id,
        ativo:        p.ativo,
        created_at:   p.created_at,
      })),
    })
  }

  // ── resetar-senha ──────────────────────────────────────────────────────────
  if (action === 'resetar-senha') {
    if (!user_id || !nova_senha) return res.status(400).json({ error: 'user_id e nova_senha são obrigatórios' })
    const { error } = await db.auth.admin.updateUserById(user_id, { password: nova_senha })
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ── excluir-usuario ────────────────────────────────────────────────────────
  if (action === 'excluir-usuario') {
    if (!user_id) return res.status(400).json({ error: 'user_id é obrigatório' })
    const { error } = await db.auth.admin.deleteUser(user_id)
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: `Ação desconhecida: ${action}` })
}
