-- Adiciona colunas lider_nome e equipe_nome em dds_registros
-- (o app mobile armazena esses valores para exibição sem JOIN)

ALTER TABLE dds_registros
  ADD COLUMN IF NOT EXISTS lider_nome  text,
  ADD COLUMN IF NOT EXISTS equipe_nome text;
