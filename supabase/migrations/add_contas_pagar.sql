-- ============================================================
-- add_contas_pagar.sql
-- Tabela de Contas a Pagar (entradas manuais do financeiro)
-- ============================================================

CREATE TABLE IF NOT EXISTS contas_pagar (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id    uuid,                                          -- nullable para compatibilidade
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  descricao       text NOT NULL,
  fornecedor      text,
  categoria       text,

  valor           numeric(12,2) NOT NULL DEFAULT 0,
  vencimento      date,
  data_emissao    date,
  data_pagamento  date,

  status          text NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','pago','vencido','reprovado','cancelado')),

  forma_pagamento text,
  observacoes     text,
  origem          text NOT NULL DEFAULT 'manual',

  comprovante_url text,
  nota_fiscal_url text,
  boleto_url      text,
  dados_extras    jsonb DEFAULT '{}'::jsonb,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Caso a tabela já existia sem as colunas novas, garante que existam
ALTER TABLE contas_pagar
  ADD COLUMN IF NOT EXISTS workspace_id    uuid,
  ADD COLUMN IF NOT EXISTS data_emissao    date,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS origem          text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS nota_fiscal_url text,
  ADD COLUMN IF NOT EXISTS boleto_url      text,
  ADD COLUMN IF NOT EXISTS dados_extras    jsonb DEFAULT '{}'::jsonb;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_contas_pagar_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contas_pagar_updated_at ON contas_pagar;
CREATE TRIGGER contas_pagar_updated_at
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW EXECUTE FUNCTION set_contas_pagar_updated_at();

-- RLS
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own contas_pagar" ON contas_pagar;
CREATE POLICY "Users see own contas_pagar" ON contas_pagar
  FOR ALL USING (
    auth.uid() = user_id
    OR auth.email() = 'ph.mar89s@gmail.com'
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_contas_pagar_user_id     ON contas_pagar(user_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_workspace   ON contas_pagar(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento  ON contas_pagar(vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status      ON contas_pagar(status);
