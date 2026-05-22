-- ============================================================
-- add_maquinas_cadastros.sql
-- Hierarquia cadastral para Mapa de Apontamento de Máquinas
--
-- Hierarquia: classe_operacional → modelo → equipamento
-- Frentes: dimensão independente (onde a máquina está alocada)
-- ============================================================

-- 1. Classes operacionais
--    (ex: Escavadeira Hidráulica, Retroescavadeira, Motoniveladora)
CREATE TABLE IF NOT EXISTS maquinas_classes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maquinas_classes_ws_idx ON maquinas_classes(workspace_id);

ALTER TABLE maquinas_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_maquinas_classes" ON maquinas_classes
  FOR ALL USING   (workspace_id IN (SELECT get_my_workspace_ids()))
  WITH CHECK      (workspace_id IN (SELECT get_my_workspace_ids()));


-- 2. Modelos
--    (ex: CAT 320D, PC200-8, 740B)  — pertence a uma classe
CREATE TABLE IF NOT EXISTS maquinas_modelos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  classe_id    UUID REFERENCES maquinas_classes(id) ON DELETE SET NULL,
  nome         TEXT NOT NULL,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maquinas_modelos_ws_idx    ON maquinas_modelos(workspace_id);
CREATE INDEX IF NOT EXISTS maquinas_modelos_class_idx ON maquinas_modelos(classe_id);

ALTER TABLE maquinas_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_maquinas_modelos" ON maquinas_modelos
  FOR ALL USING   (workspace_id IN (SELECT get_my_workspace_ids()))
  WITH CHECK      (workspace_id IN (SELECT get_my_workspace_ids()));


-- 3. Equipamentos (máquinas físicas — a frota)
--    (ex: EH-03, REC-01)  — pertence a um modelo
CREATE TABLE IF NOT EXISTS maquinas_equipamentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  modelo_id    UUID REFERENCES maquinas_modelos(id) ON DELETE SET NULL,
  codigo       TEXT NOT NULL,   -- "EH-03" — matrícula / chapa
  nome         TEXT,            -- nome adicional / apelido (opcional)
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maquinas_equipamentos_ws_idx ON maquinas_equipamentos(workspace_id);
CREATE INDEX IF NOT EXISTS maquinas_equipamentos_mod_idx ON maquinas_equipamentos(modelo_id);

ALTER TABLE maquinas_equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_maquinas_equipamentos" ON maquinas_equipamentos
  FOR ALL USING   (workspace_id IN (SELECT get_my_workspace_ids()))
  WITH CHECK      (workspace_id IN (SELECT get_my_workspace_ids()));


-- 4. Frentes (locais / áreas de trabalho — dimensão independente)
--    (ex: Frente A, Corte Norte, Barragem Sul)
CREATE TABLE IF NOT EXISTS maquinas_frentes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maquinas_frentes_ws_idx ON maquinas_frentes(workspace_id);

ALTER TABLE maquinas_frentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_maquinas_frentes" ON maquinas_frentes
  FOR ALL USING   (workspace_id IN (SELECT get_my_workspace_ids()))
  WITH CHECK      (workspace_id IN (SELECT get_my_workspace_ids()));
