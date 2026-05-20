-- ============================================================
-- FASE 1 / MIGRATION 2 — Perfis e permissões por empresa
-- Cria perfis (roles) e suas permissões granulares.
-- Cria função SECURITY DEFINER para verificar permissão.
-- ============================================================

-- 1. Tabela de perfis (por empresa)
CREATE TABLE IF NOT EXISTS perfis (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  descricao    TEXT,
  is_padrao    BOOLEAN DEFAULT false,  -- se true, não pode ser excluído
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, nome)
);

ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

-- Membros veem os perfis da própria empresa
CREATE POLICY "members_see_own_perfis" ON perfis
  FOR SELECT USING (
    workspace_id IN (SELECT my_workspace_ids())
  );

-- Somente o backend (service_role) insere/atualiza/deleta
-- (admin da empresa gerencia via API)

-- 2. Tabela de permissões por perfil
CREATE TABLE IF NOT EXISTS perfil_permissoes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  modulo    TEXT NOT NULL,
  -- modulo: 'compras', 'refeicoes', 'financeiro', 'admin', etc.
  acao      TEXT NOT NULL,
  -- acao: 'ver', 'criar', 'editar', 'excluir', 'aprovar'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(perfil_id, modulo, acao)
);

ALTER TABLE perfil_permissoes ENABLE ROW LEVEL SECURITY;

-- Membros veem as permissões dos perfis da própria empresa
CREATE POLICY "members_see_own_permissoes" ON perfil_permissoes
  FOR SELECT USING (
    perfil_id IN (
      SELECT p.id FROM perfis p
      WHERE p.workspace_id IN (SELECT my_workspace_ids())
    )
  );

-- 3. Adicionar FK de workspace_members.perfil_id → perfis.id
--    (safe: ADD CONSTRAINT IF NOT EXISTS só no PG 9.x+, usamos DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'workspace_members_perfil_id_fkey'
  ) THEN
    ALTER TABLE workspace_members
      ADD CONSTRAINT workspace_members_perfil_id_fkey
      FOREIGN KEY (perfil_id) REFERENCES perfis(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Função SECURITY DEFINER: tenho_permissao(modulo, acao)
--    Retorna TRUE se o usuário logado tem a permissão no workspace ativo.
CREATE OR REPLACE FUNCTION public.tenho_permissao(p_modulo TEXT, p_acao TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_members wm
    JOIN perfil_permissoes pp ON pp.perfil_id = wm.perfil_id
    WHERE wm.user_id      = auth.uid()
      AND wm.ativo        = true
      AND wm.workspace_id IN (SELECT my_workspace_ids())
      AND pp.modulo       = p_modulo
      AND pp.acao         = p_acao
  )
$$;

COMMENT ON FUNCTION public.tenho_permissao IS
  'Retorna TRUE se o usuário logado tem permissão para modulo+acao na empresa ativa.
   Quando perfil_id é NULL (admin total), use is_empresa_admin() separadamente.';

-- 5. Função helper: my_perfil_id()
--    Retorna o perfil_id do usuário no workspace ativo.
CREATE OR REPLACE FUNCTION public.my_perfil_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT perfil_id
  FROM workspace_members
  WHERE user_id = auth.uid()
    AND ativo   = true
    AND workspace_id IN (SELECT my_workspace_ids())
  LIMIT 1
$$;

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_perfis_workspace ON perfis(workspace_id);
CREATE INDEX IF NOT EXISTS idx_perfil_permissoes_perfil ON perfil_permissoes(perfil_id);
CREATE INDEX IF NOT EXISTS idx_perfil_permissoes_modulo ON perfil_permissoes(modulo, acao);
