-- ============================================================
-- add_pagamentos.sql
-- Registra pagamentos em lote com NF/comprovante
-- Vários lançamentos aprovados → 1 pagamento com 1 NF
-- ============================================================

-- Tabela de pagamentos em lote
CREATE TABLE IF NOT EXISTS pagamentos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  descricao           text,
  valor_total         numeric(12,2) DEFAULT 0,
  data_pagamento      date,
  numero_nf           text,            -- número da NF emitida pelo cliente
  chave_nfe           text,            -- chave de 44 dígitos (opcional)
  comprovante_nf_url  text,            -- URL do PDF/imagem da NF no storage
  observacoes         text,
  criado_por          uuid,
  created_at          timestamptz DEFAULT now()
);

-- Vínculo do lançamento com o pagamento (muitos → um)
ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS pagamento_id uuid REFERENCES pagamentos(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_pagamentos_workspace  ON pagamentos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_data       ON pagamentos(data_pagamento DESC);
CREATE INDEX IF NOT EXISTS idx_lancamentos_pagamento ON lancamentos(pagamento_id);

-- RLS permissivo (igual ao padrão do projeto)
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_pagamentos" ON pagamentos;
CREATE POLICY "allow_all_pagamentos" ON pagamentos
  FOR ALL USING (true) WITH CHECK (true);
