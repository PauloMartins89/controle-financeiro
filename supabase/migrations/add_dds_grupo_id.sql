-- Vincula dds_registros à equipe (grupo) — lider_equipes já tem lider_nome, lider_id
ALTER TABLE dds_registros
  ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES lider_equipes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dds_registros_grupo ON dds_registros(grupo_id);
