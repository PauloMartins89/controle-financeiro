-- ═══════════════════════════════════════════════════════════
-- Grupos DDS — programas temáticos com líder responsável
-- ═══════════════════════════════════════════════════════════

-- 1. Tabela de grupos
CREATE TABLE IF NOT EXISTS dds_grupos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  nome         text NOT NULL,
  descricao    text,
  lider_id     uuid,
  lider_nome   text,
  cor          text NOT NULL DEFAULT '#6366f1',
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dds_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service full access dds_grupos" ON dds_grupos USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_dds_grupos_workspace ON dds_grupos(workspace_id);

-- 2. Temas pertencem a um grupo (auto-associação ao registrar DDS)
ALTER TABLE dds_temas
  ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES dds_grupos(id) ON DELETE SET NULL;

-- 3. Registros DDS → grupo (recriar apontando para dds_grupos)
ALTER TABLE dds_registros DROP COLUMN IF EXISTS grupo_id;
ALTER TABLE dds_registros
  ADD COLUMN grupo_id uuid REFERENCES dds_grupos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_dds_registros_grupo ON dds_registros(grupo_id);
