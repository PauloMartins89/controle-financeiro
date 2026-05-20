-- ============================================================
-- FASE 1 / MIGRATION 1 — Evolução de workspaces para empresas
-- Adiciona tipo (empresa | platform), cnpj e dados extras.
-- Adiciona perfil_id em workspace_members.
-- SEGURO: apenas ADD COLUMN, sem renomear nem dropar nada.
-- ============================================================

-- 1. Estender tabela workspaces
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS tipo    TEXT NOT NULL DEFAULT 'empresa'
    CHECK (tipo IN ('empresa', 'platform')),
  ADD COLUMN IF NOT EXISTS cnpj    TEXT,
  ADD COLUMN IF NOT EXISTS logo    TEXT,
  ADD COLUMN IF NOT EXISTS cor     TEXT DEFAULT '#6366f1';

COMMENT ON COLUMN workspaces.tipo IS
  'empresa = cliente contratante | platform = workspace interno da plataforma';

-- 2. Estender workspace_members com referência ao perfil
--    (a FK será adicionada na migration 2, depois de criar a tabela perfis)
ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS perfil_id UUID,
  ADD COLUMN IF NOT EXISTS ativo     BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN workspace_members.perfil_id IS
  'Perfil de acesso deste usuário nesta empresa. NULL = herda acesso total.';

-- 3. Criar workspace especial de plataforma (corre apenas se ainda não existe)
INSERT INTO workspaces (nome, descricao, tipo, plano)
SELECT 'Plataforma SmartPro', 'Workspace interno da plataforma', 'platform', 'isento'
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE tipo = 'platform');

-- 4. Índices úteis
CREATE INDEX IF NOT EXISTS idx_workspaces_tipo ON workspaces(tipo);
CREATE INDEX IF NOT EXISTS idx_workspace_members_perfil ON workspace_members(perfil_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ativo  ON workspace_members(ativo);
