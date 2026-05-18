-- Adiciona controle de recebimento na tabela pagamentos
-- status: faturado (NF emitida, aguardando $) | recebido ($ confirmado na conta)

ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS status              text DEFAULT 'faturado',
  ADD COLUMN IF NOT EXISTS data_recebimento    date,
  ADD COLUMN IF NOT EXISTS comprovante_pagamento_url text;

CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON pagamentos(status);

-- Normaliza registros existentes
UPDATE pagamentos SET status = 'faturado' WHERE status IS NULL;
