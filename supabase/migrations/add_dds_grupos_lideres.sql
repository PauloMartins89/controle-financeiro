-- ═══════════════════════════════════════════════════════════
-- Associação N:N entre Grupos DDS e Líderes (lider_perfis)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dds_grupos_lideres (
  grupo_id  uuid NOT NULL REFERENCES dds_grupos(id)   ON DELETE CASCADE,
  lider_id  uuid NOT NULL REFERENCES lider_perfis(id) ON DELETE CASCADE,
  PRIMARY KEY (grupo_id, lider_id)
);

ALTER TABLE dds_grupos_lideres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service full access dds_grupos_lideres"
  ON dds_grupos_lideres USING (true) WITH CHECK (true);
