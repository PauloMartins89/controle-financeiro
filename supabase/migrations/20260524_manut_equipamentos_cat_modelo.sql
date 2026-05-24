-- ============================================================
-- ELO: Vincula manut_equipamentos ao catálogo técnico
-- Adiciona FK cat_modelo_id → cat_modelos(id)
-- ============================================================

ALTER TABLE manut_equipamentos
  ADD COLUMN IF NOT EXISTS cat_modelo_id uuid REFERENCES cat_modelos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_manut_equipamentos_cat_modelo_id
  ON manut_equipamentos(cat_modelo_id);

-- Comentário explicativo
COMMENT ON COLUMN manut_equipamentos.cat_modelo_id IS
  'Vínculo com cat_modelos — habilita planos de manutenção, documentos técnicos e alertas por horímetro';
