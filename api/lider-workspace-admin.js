/**
 * api/lider-workspace-admin.js
 * Gerenciamento de líderes por workspace — sem exigir platform_admin.
 * Cada cliente (dono do workspace) pode criar/editar/excluir líderes
 * APENAS do próprio workspace.
 *
 * POST /api/lider-workspace-admin
 *   { action: 'criar-usuario',    workspace_id, matricula, nome, celular? }
 *   { action: 'listar-usuarios',  workspace_id }
 *   { action: 'resetar-senha',    workspace_id, user_id, nova_senha }
 *   { action: 'excluir-usuario',  workspace_id, user_id }
 *   { action: 'atualizar-celular',workspace_id, perfil_id, celular }
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

/**
 * Verifica se o token pertence ao dono (owner_id) do workspace informado.
 * Retorna o user se autorizado, null caso contrário.
 */
async function verifyWorkspaceOwner(req, workspace_id) {
  const auth = req.headers.authorization || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token || !workspace_id) return null

  const db = getDb()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return null

  // Verifica se é platform_admin (acesso total) OU dono do workspace
  const [{ data: adminRow }, { data: wsRow }] = await Promise.all([
    db.from('platform_admins').select('id').eq('user_id', user.id).maybeSingle(),
    db.from('workspaces').select('id').eq('id', workspace_id).eq('owner_id', user.id).maybeSingle(),
  ])

  if (adminRow || wsRow) return user
  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  const { action, workspace_id, matricula, nome, celular, user_id, nova_senha, perfil_id } = req.body || {}

  if (!workspace_id) return res.status(400).json({ error: 'workspace_id é obrigatório' })

  const user = await verifyWorkspaceOwner(req, workspace_id)
  if (!user) return res.status(403).json({ error: 'Acesso negado — você não é o dono deste workspace' })

  const db = getDb()

  // ── criar-usuario ──────────────────────────────────────────────────────────
  if (action === 'criar-usuario') {
    if (!matricula) return res.status(400).json({ error: 'matricula é obrigatória' })
    const celularFmt = (celular || '').replace(/\D/g, '') || null
    const email    = `${matricula.toLowerCase().trim()}@lider.smartpro`
    const password = matricula.trim().padEnd(8, matricula.trim())

    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { workspace_id, nome: nome || `Líder ${matricula}`, matricula },
    })

    if (createErr) {
      if (createErr.message?.includes('already') || createErr.code === 'email_exists') {
        // Usuário auth já existe — só garante o perfil
        const { data: existing } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const existingUser = existing?.users?.find(u => u.email === email)
        if (existingUser) {
          await db.from('lider_perfis').upsert({
            workspace_id, user_id: existingUser.id,
            matricula: matricula.toLowerCase().trim(),
            nome: nome || `Líder ${matricula}`,
            ...(celularFmt ? { celular: celularFmt } : {}),
          }, { onConflict: 'user_id' })
        }
        return res.status(200).json({ ok: true, ja_existia: true, email })
      }
      return res.status(400).json({ error: createErr.message })
    }

    const newUserId = created.user?.id
    if (newUserId) {
      await db.from('lider_perfis').upsert({
        workspace_id, user_id: newUserId,
        matricula: matricula.toLowerCase().trim(),
        nome: nome || `Líder ${matricula}`,
        ...(celularFmt ? { celular: celularFmt } : {}),
      }, { onConflict: 'user_id' })
    }
    return res.status(200).json({ ok: true, ja_existia: false, email, user_id: newUserId })
  }

  // ── listar-usuarios ────────────────────────────────────────────────────────
  if (action === 'listar-usuarios') {
    const { data: perfis, error: perfisErr } = await db
      .from('lider_perfis')
      .select('id, user_id, matricula, nome, equipe_id, ativo, celular, created_at')
      .eq('workspace_id', workspace_id)
      .order('matricula')
    if (perfisErr) return res.status(500).json({ error: perfisErr.message })
    return res.status(200).json({
      usuarios: (perfis || []).map(p => ({
        id: p.user_id, perfil_id: p.id,
        email: `${p.matricula}@lider.smartpro`,
        matricula: p.matricula, nome: p.nome || '',
        celular: p.celular || '', equipe_id: p.equipe_id || null,
        workspace_id, ativo: p.ativo, created_at: p.created_at,
      })),
    })
  }

  // ── resetar-senha ──────────────────────────────────────────────────────────
  if (action === 'resetar-senha') {
    if (!user_id || !nova_senha) return res.status(400).json({ error: 'user_id e nova_senha são obrigatórios' })
    // Verifica que o user_id pertence ao workspace antes de resetar
    const { data: perfil } = await db.from('lider_perfis').select('id').eq('user_id', user_id).eq('workspace_id', workspace_id).maybeSingle()
    if (!perfil) return res.status(403).json({ error: 'Líder não pertence ao seu workspace' })
    const { error } = await db.auth.admin.updateUserById(user_id, { password: nova_senha })
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ── excluir-usuario ────────────────────────────────────────────────────────
  if (action === 'excluir-usuario') {
    if (!user_id) return res.status(400).json({ error: 'user_id é obrigatório' })
    // Verifica que o user_id pertence ao workspace antes de excluir
    const { data: perfil } = await db.from('lider_perfis').select('id').eq('user_id', user_id).eq('workspace_id', workspace_id).maybeSingle()
    if (!perfil) return res.status(403).json({ error: 'Líder não pertence ao seu workspace' })
    const { error } = await db.auth.admin.deleteUser(user_id)
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ── atualizar-celular ──────────────────────────────────────────────────────
  if (action === 'atualizar-celular') {
    if (!perfil_id) return res.status(400).json({ error: 'perfil_id é obrigatório' })
    const cel = (celular || '').replace(/\D/g, '') || null
    const { error } = await db.from('lider_perfis').update({ celular: cel }).eq('id', perfil_id).eq('workspace_id', workspace_id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: `Ação desconhecida: ${action}` })
}
