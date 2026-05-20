-- ============================================================
-- FASE 1 / MIGRATION 3 — Administradores da Plataforma
-- Substitui o check hardcoded de e-mail por tabela real.
-- Cria funções is_platform_admin() e is_empresa_admin().
-- ============================================================

-- 1. Tabela de admins da plataforma (super admins)
CREATE TABLE IF NOT EXISTS platform_admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- Platform admins veem a lista de outros admins
CREATE POLICY "platform_admins_see_list" ON platform_admins
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM platform_admins)
  );
-- INSERT/UPDATE/DELETE: service_role apenas

-- 2. Seed: inserir o admin atual (ph.mar89s@gmail.com) como platform_admin
--    Seguro: ON CONFLICT DO NOTHING caso já exista
INSERT INTO platform_admins (user_id, created_by)
SELECT id, id
FROM auth.users
WHERE email = 'ph.mar89s@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- 3. Função SECURITY DEFINER: is_platform_admin()
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
  )
$$;

COMMENT ON FUNCTION public.is_platform_admin IS
  'Retorna TRUE se o usuário logado é admin da plataforma (super admin).
   Substitui o check hardcoded de e-mail em src/lib/admin.js.';

-- 4. Função SECURITY DEFINER: is_empresa_admin(workspace_id)
--    Admin da empresa = membro sem perfil_id (acesso total) ou perfil com nome = 'admin_empresa'
CREATE OR REPLACE FUNCTION public.is_empresa_admin(p_workspace_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members wm
    LEFT JOIN perfis p ON p.id = wm.perfil_id
    WHERE wm.user_id      = auth.uid()
      AND wm.ativo        = true
      AND wm.workspace_id = COALESCE(p_workspace_id, wm.workspace_id)
      AND (
        wm.perfil_id IS NULL          -- sem perfil = admin total legado
        OR p.nome = 'admin_empresa'   -- perfil explicitamente admin
      )
  )
  OR is_platform_admin()  -- platform admin tem acesso total a tudo
$$;

COMMENT ON FUNCTION public.is_empresa_admin IS
  'Retorna TRUE se o usuário é admin da empresa especificada (ou qualquer empresa se NULL).
   Platform admins automaticamente têm acesso total.';

-- 5. Atualizar políticas de workspaces para aceitar platform_admin
--    (substituir a policy existente que só aceita membros)
DROP POLICY IF EXISTS "members_see_own_workspace" ON workspaces;

CREATE POLICY "members_or_platform_admin_see_workspace" ON workspaces
  FOR SELECT USING (
    id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  );

-- Platform admin pode inserir novos workspaces
DROP POLICY IF EXISTS "platform_admin_insert_workspace" ON workspaces;
CREATE POLICY "platform_admin_insert_workspace" ON workspaces
  FOR INSERT WITH CHECK (is_platform_admin());

-- Platform admin pode atualizar workspaces
DROP POLICY IF EXISTS "platform_admin_update_workspace" ON workspaces;
CREATE POLICY "platform_admin_update_workspace" ON workspaces
  FOR UPDATE USING (is_platform_admin());
