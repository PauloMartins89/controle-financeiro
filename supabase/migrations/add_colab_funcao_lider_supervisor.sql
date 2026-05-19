-- Adiciona funcao (substitui cargo), lider_nome e supervisor_nome em refei_colaboradores
ALTER TABLE refei_colaboradores
  ADD COLUMN IF NOT EXISTS funcao       text,
  ADD COLUMN IF NOT EXISTS lider_nome   text,
  ADD COLUMN IF NOT EXISTS supervisor_nome text;
