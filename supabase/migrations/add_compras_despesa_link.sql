-- ════════════════════════════════════════════════════════════
-- Integração Compras ↔ Financeiro (Contas a Pagar)
-- Quando uma compra é aprovada, cria automaticamente uma
-- despesa com status 'pendente' no módulo financeiro.
-- Execute no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════

-- Vincula cada solicitação de compra à sua despesa financeira
ALTER TABLE solicitacoes_compra
  ADD COLUMN IF NOT EXISTS despesa_id uuid REFERENCES despesas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_despesa ON solicitacoes_compra(despesa_id);
