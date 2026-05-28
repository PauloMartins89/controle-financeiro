-- Adiciona token público de acesso para aprovação pelo cliente sem login
ALTER TABLE lotes_cliente
  ADD COLUMN IF NOT EXISTS token_acesso uuid DEFAULT gen_random_uuid();

-- Gera tokens para lotes existentes que ainda não têm
UPDATE lotes_cliente SET token_acesso = gen_random_uuid() WHERE token_acesso IS NULL;

-- Index único para busca por token
CREATE UNIQUE INDEX IF NOT EXISTS idx_lotes_cliente_token_acesso
  ON lotes_cliente (token_acesso);

-- Permite leitura pública pelo token (sem autenticação)
DROP POLICY IF EXISTS "lotes_public_read_token" ON lotes_cliente;
CREATE POLICY "lotes_public_read_token" ON lotes_cliente
  FOR SELECT USING (token_acesso IS NOT NULL);
