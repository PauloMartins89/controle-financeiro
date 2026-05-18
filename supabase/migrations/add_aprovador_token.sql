-- ════════════════════════════════════════════════════════════
-- Token público para aprovação sem login
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

ALTER TABLE solicitacoes_compra
  ADD COLUMN IF NOT EXISTS token_aprovador uuid DEFAULT gen_random_uuid() UNIQUE;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_token_aprovador
  ON solicitacoes_compra(token_aprovador);

-- Permite leitura pública via token (sem login)
DROP POLICY IF EXISTS "solicitacoes_public_token" ON solicitacoes_compra;
CREATE POLICY "solicitacoes_public_token" ON solicitacoes_compra
  FOR SELECT USING (token_aprovador IS NOT NULL);
