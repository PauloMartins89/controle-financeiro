-- ════════════════════════════════════════════════════════════
-- Módulo de Compras — Itens múltiplos + número de requisição
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

-- 1. Colunas extras na tabela de solicitações
ALTER TABLE solicitacoes_compra
  ADD COLUMN IF NOT EXISTS numero_requisicao    int,
  ADD COLUMN IF NOT EXISTS contato_fornecedor  text,
  ADD COLUMN IF NOT EXISTS telefone_fornecedor text,
  ADD COLUMN IF NOT EXISTS email_fornecedor    text;

-- 2. Sequência para numeração automática de requisições
CREATE SEQUENCE IF NOT EXISTS seq_numero_requisicao START 1000;

-- 3. Trigger que preenche numero_requisicao automaticamente no INSERT
CREATE OR REPLACE FUNCTION set_numero_requisicao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_requisicao IS NULL THEN
    NEW.numero_requisicao = nextval('seq_numero_requisicao');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_numero_requisicao ON solicitacoes_compra;
CREATE TRIGGER trg_set_numero_requisicao
  BEFORE INSERT ON solicitacoes_compra
  FOR EACH ROW EXECUTE FUNCTION set_numero_requisicao();

-- 4. Tabela de itens da requisição (múltiplos por solicitação)
CREATE TABLE IF NOT EXISTS itens_solicitacao_compra (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id  uuid REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
  descricao       text NOT NULL,
  quantidade      numeric(10,3) NOT NULL DEFAULT 1,
  valor_unitario  numeric(12,2),
  valor_total     numeric(12,2),
  ordem           int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- 5. RLS para itens
ALTER TABLE itens_solicitacao_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "itens_compra_workspace_policy" ON itens_solicitacao_compra;
CREATE POLICY "itens_compra_workspace_policy" ON itens_solicitacao_compra
  FOR ALL USING (
    solicitacao_id IN (
      SELECT id FROM solicitacoes_compra WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- 6. Coluna unidade (adicionada posteriormente)
ALTER TABLE itens_solicitacao_compra
  ADD COLUMN IF NOT EXISTS unidade text DEFAULT 'un';

-- 7. Índice
CREATE INDEX IF NOT EXISTS idx_itens_solicitacao ON itens_solicitacao_compra(solicitacao_id);
