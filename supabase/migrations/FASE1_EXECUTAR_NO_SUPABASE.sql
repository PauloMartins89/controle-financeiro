-- ============================================================
-- FASE 1 COMPLETA — Execute este arquivo no Supabase SQL Editor
-- Ordem: migration 1 → 2 → 3 → 4
-- Seguro para rodar em produção: apenas ADD, nenhum DROP de dados
-- ============================================================

-- ════════════════════════════════════════════════
-- MIGRATION 1: Evolução de workspaces para empresas
-- ════════════════════════════════════════════════

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'empresa' CHECK (tipo IN ('empresa', 'platform'));
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS cor  TEXT DEFAULT '#6366f1';

ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS perfil_id UUID;
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

INSERT INTO workspaces (nome, descricao, tipo, plano)
SELECT 'Plataforma SmartPro', 'Workspace interno da plataforma', 'platform', 'isento'
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE tipo = 'platform');

CREATE INDEX IF NOT EXISTS idx_workspaces_tipo ON workspaces(tipo);
CREATE INDEX IF NOT EXISTS idx_workspace_members_perfil ON workspace_members(perfil_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ativo  ON workspace_members(ativo);


-- ════════════════════════════════════════════════
-- MIGRATION 2: Perfis e permissões
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS perfis (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  descricao    TEXT,
  is_padrao    BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, nome)
);

ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_see_own_perfis" ON perfis;
CREATE POLICY "members_see_own_perfis" ON perfis
  FOR SELECT USING (
    workspace_id IN (SELECT my_workspace_ids())
  );

CREATE TABLE IF NOT EXISTS perfil_permissoes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id UUID NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  modulo    TEXT NOT NULL,
  acao      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(perfil_id, modulo, acao)
);

ALTER TABLE perfil_permissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_see_own_permissoes" ON perfil_permissoes;
CREATE POLICY "members_see_own_permissoes" ON perfil_permissoes
  FOR SELECT USING (
    perfil_id IN (
      SELECT p.id FROM perfis p
      WHERE p.workspace_id IN (SELECT my_workspace_ids())
    )
  );

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

CREATE INDEX IF NOT EXISTS idx_perfis_workspace ON perfis(workspace_id);
CREATE INDEX IF NOT EXISTS idx_perfil_permissoes_perfil ON perfil_permissoes(perfil_id);
CREATE INDEX IF NOT EXISTS idx_perfil_permissoes_modulo ON perfil_permissoes(modulo, acao);


-- ════════════════════════════════════════════════
-- MIGRATION 3: Administradores da Plataforma
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS platform_admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_admins_see_list" ON platform_admins;
CREATE POLICY "platform_admins_see_list" ON platform_admins
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM platform_admins)
  );

INSERT INTO platform_admins (user_id, created_by)
SELECT id, id
FROM auth.users
WHERE email = 'ph.mar89s@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

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
        wm.perfil_id IS NULL
        OR p.nome = 'admin_empresa'
      )
  )
  OR is_platform_admin()
$$;

DROP POLICY IF EXISTS "members_see_own_workspace" ON workspaces;
DROP POLICY IF EXISTS "members_or_platform_admin_see_workspace" ON workspaces;

CREATE POLICY "members_or_platform_admin_see_workspace" ON workspaces
  FOR SELECT USING (
    id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "platform_admin_insert_workspace" ON workspaces;
CREATE POLICY "platform_admin_insert_workspace" ON workspaces
  FOR INSERT WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "platform_admin_update_workspace" ON workspaces;
CREATE POLICY "platform_admin_update_workspace" ON workspaces
  FOR UPDATE USING (is_platform_admin());


-- ════════════════════════════════════════════════
-- MIGRATION 4: Log de auditoria
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS logs_auditoria (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao         TEXT NOT NULL,
  tabela       TEXT,
  registro_id  TEXT,
  dados_antes  JSONB,
  dados_depois JSONB,
  ip           TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE logs_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_see_own_logs" ON logs_auditoria;
CREATE POLICY "members_see_own_logs" ON logs_auditoria
  FOR SELECT USING (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "authenticated_insert_logs" ON logs_auditoria;
CREATE POLICY "authenticated_insert_logs" ON logs_auditoria
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_logs_workspace  ON logs_auditoria(workspace_id);
CREATE INDEX IF NOT EXISTS idx_logs_user       ON logs_auditoria(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_acao       ON logs_auditoria(acao);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs_auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_tabela     ON logs_auditoria(tabela);

CREATE OR REPLACE FUNCTION public.registrar_auditoria(
  p_acao         TEXT,
  p_workspace_id UUID    DEFAULT NULL,
  p_tabela       TEXT    DEFAULT NULL,
  p_registro_id  TEXT    DEFAULT NULL,
  p_dados_antes  JSONB   DEFAULT NULL,
  p_dados_depois JSONB   DEFAULT NULL,
  p_ip           TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO logs_auditoria (
    workspace_id, user_id, acao,
    tabela, registro_id,
    dados_antes, dados_depois,
    ip
  ) VALUES (
    p_workspace_id, auth.uid(), p_acao,
    p_tabela, p_registro_id,
    p_dados_antes, p_dados_depois,
    p_ip
  )
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;


-- ════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ════════════════════════════════════════════════
SELECT 
  'Fase 1 concluída!' AS status,
  (SELECT COUNT(*) FROM workspaces)         AS total_workspaces,
  (SELECT COUNT(*) FROM workspaces WHERE tipo = 'platform') AS plataformas,
  (SELECT COUNT(*) FROM platform_admins)    AS platform_admins,
  (SELECT COUNT(*) FROM perfis)             AS perfis_criados,
  (SELECT COUNT(*) FROM logs_auditoria)     AS logs;
