-- Pedido Extra com justificativa obrigatória
ALTER TABLE refei_itens ADD COLUMN IF NOT EXISTS extra        boolean DEFAULT false;
ALTER TABLE refei_itens ADD COLUMN IF NOT EXISTS justificativa text;
