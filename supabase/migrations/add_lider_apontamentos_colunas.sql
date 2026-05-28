-- MIGRATION: add_lider_apontamentos_colunas
-- Adiciona colunas usadas pelo app que estavam faltando no schema.
-- Corrige NOT NULL em campos _nome opcionais.

-- lider_apontamentos_maquina
ALTER TABLE lider_apontamentos_maquina
  ADD COLUMN IF NOT EXISTS criado_por       uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS status           text,
  ADD COLUMN IF NOT EXISTS horimetro_inicio numeric(10,1),
  ADD COLUMN IF NOT EXISTS horimetro_fim    numeric(10,1);

ALTER TABLE lider_apontamentos_maquina
  ALTER COLUMN maquina_nome DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lider_apt_maquina_turno_maq_uidx
  ON lider_apontamentos_maquina (turno_id, maquina_id);

-- lider_apontamentos_insumo
ALTER TABLE lider_apontamentos_insumo
  ADD COLUMN IF NOT EXISTS criado_por    uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS status        text,
  ADD COLUMN IF NOT EXISTS area_aplicada numeric(10,2);

ALTER TABLE lider_apontamentos_insumo
  ALTER COLUMN produto_nome DROP NOT NULL;

-- lider_produtividade_equipe
ALTER TABLE lider_produtividade_equipe
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users(id);