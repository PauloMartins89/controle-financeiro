-- Liga contas_pagar com solicitacoes_compra
ALTER TABLE contas_pagar
  ADD COLUMN IF NOT EXISTS solicitacao_id uuid REFERENCES solicitacoes_compra(id) ON DELETE SET NULL;

-- Remove índice parcial se existir (criado em versão anterior)
DROP INDEX IF EXISTS uidx_contas_pagar_solicitacao;

-- Constraint única para evitar duplicatas
DO $$ BEGIN
  ALTER TABLE contas_pagar ADD CONSTRAINT contas_pagar_solicitacao_id_key UNIQUE (solicitacao_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
