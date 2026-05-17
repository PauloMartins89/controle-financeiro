-- Fix: recursão infinita nas policies de workspace_members
-- Causa: policy na tabela consulta ela mesma → loop infinito
-- Solução: função SECURITY DEFINER que bypassa RLS para buscar workspace_ids do usuário

-- 1. Cria função que retorna os workspace_ids do usuário atual sem ativar RLS
CREATE OR REPLACE FUNCTION get_my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid();
$$;

-- 2. Remove policies antigas que causam recursão
DROP POLICY IF EXISTS "members_see_own_workspace"  ON workspaces;
DROP POLICY IF EXISTS "members_see_own_members"    ON workspace_members;
DROP POLICY IF EXISTS "members_see_own_modules"    ON workspace_modules;

-- Remove também policies de admin antigas se existirem
DROP POLICY IF EXISTS "admin_all_workspaces"         ON workspaces;
DROP POLICY IF EXISTS "admin_all_workspace_members"  ON workspace_members;
DROP POLICY IF EXISTS "admin_all_workspace_modules"  ON workspace_modules;

-- 3. Recria policies usando a função (sem recursão)

-- workspaces
CREATE POLICY "members_see_own_workspace" ON workspaces
  FOR SELECT USING (
    id IN (SELECT get_my_workspace_ids())
    OR auth.email() = 'ph.mar89s@gmail.com'
  );

CREATE POLICY "admin_manage_workspaces" ON workspaces
  FOR ALL USING (auth.email() = 'ph.mar89s@gmail.com')
  WITH CHECK (auth.email() = 'ph.mar89s@gmail.com');

-- workspace_members: usa a função para evitar recursão
CREATE POLICY "members_see_own_members" ON workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT get_my_workspace_ids())
    OR auth.email() = 'ph.mar89s@gmail.com'
  );

CREATE POLICY "admin_manage_members" ON workspace_members
  FOR ALL USING (auth.email() = 'ph.mar89s@gmail.com')
  WITH CHECK (auth.email() = 'ph.mar89s@gmail.com');

-- workspace_modules
CREATE POLICY "members_see_own_modules" ON workspace_modules
  FOR SELECT USING (
    workspace_id IN (SELECT get_my_workspace_ids())
    OR auth.email() = 'ph.mar89s@gmail.com'
  );

CREATE POLICY "admin_manage_modules" ON workspace_modules
  FOR ALL USING (auth.email() = 'ph.mar89s@gmail.com')
  WITH CHECK (auth.email() = 'ph.mar89s@gmail.com');
