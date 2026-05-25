-- Adiciona tipo de entrega nas solicitações de refeição
ALTER TABLE refei_solicitacoes
  ADD COLUMN IF NOT EXISTS tipo_entrega text DEFAULT 'entrega';
