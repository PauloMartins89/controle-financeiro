-- Adiciona campos de dados do CNPJ na tabela de restaurantes
ALTER TABLE refei_restaurantes
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS email       text,
  ADD COLUMN IF NOT EXISTS endereco    text;
