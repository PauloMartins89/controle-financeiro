-- Adiciona colunas usadas pelo app SmartLíder no formulário de refeição
ALTER TABLE refei_solicitacoes
  ADD COLUMN IF NOT EXISTS lider_id          uuid,
  ADD COLUMN IF NOT EXISTS ticket            text,
  ADD COLUMN IF NOT EXISTS token_restaurante uuid DEFAULT gen_random_uuid();
