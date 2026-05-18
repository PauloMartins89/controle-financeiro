-- ════════════════════════════════════════════════════════════
-- Módulo de Compras — Solicitações + Cotações (Leilão)
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

-- 1. Tabela principal de solicitações de compra
CREATE TABLE IF NOT EXISTS solicitacoes_compra (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Atores
  requisitante_nome       text,                          -- nome livre (pode vir do WA)
  requisitante_telefone   text,                          -- WhatsApp do requisitante
  comprador_id            uuid REFERENCES pessoas(id) ON DELETE SET NULL,
  aprovador_id            uuid REFERENCES pessoas(id) ON DELETE SET NULL,

  -- Dados do pedido
  titulo                  text NOT NULL,                 -- ex: "Óleo 15W40 — 50 litros"
  descricao               text,                          -- detalhamento
  valor_estimado          numeric(12,2),                 -- orçamento inicial do comprador
  valor_aprovado          numeric(12,2),                 -- valor final (pode diferir do estimado)
  fornecedor              text,                          -- nome do fornecedor sugerido
  fornecedor_vencedor     text,                          -- preenchido após leilão
  quantidade              text,                          -- "50 litros", "4 unidades", etc.
  urgencia                text DEFAULT 'media',          -- baixa | media | alta

  -- Tipo de compra
  tipo                    text DEFAULT 'direta',         -- direta | leilao
  prazo_cotacao           timestamptz,                   -- quando o leilão encerra

  -- Status
  -- requisicao_nova → em_cotacao → aguardando_aprovacao → aprovado | recusado | leilao_aberto
  -- leilao_aberto → leilao_encerrado → fornecedor_selecionado → pedido_emitido → recebido → pago
  status                  text DEFAULT 'requisicao_nova' NOT NULL,

  -- Resolução
  justificativa_recusa    text,
  observacao_aprovador    text,
  economia                numeric(12,2),                 -- valor_estimado - valor_aprovado
  comprovante_url         text,

  -- Datas
  data_necessidade        date,
  data_aprovacao          timestamptz,
  data_pagamento          date,

  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- 2. Cotações dos fornecedores (para o leilão)
CREATE TABLE IF NOT EXISTS cotacoes_compra (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id        uuid REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,

  -- Fornecedor
  fornecedor_nome       text NOT NULL,
  fornecedor_telefone   text,
  fornecedor_email      text,

  -- Token de acesso único (link público sem login)
  token_acesso          uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  token_expira_em       timestamptz,

  -- Proposta
  valor_unitario        numeric(12,2),
  valor_total           numeric(12,2),
  prazo_entrega_dias    int,
  condicao_pagamento    text,                            -- à vista | 30dd | 60dd | etc.
  observacoes           text,

  -- Status do fornecedor
  -- convidado → visualizado → enviado → ganhou | perdeu
  status                text DEFAULT 'convidado',

  submitted_at          timestamptz,
  created_at            timestamptz DEFAULT now()
);

-- 3. Trigger updated_at
CREATE OR REPLACE FUNCTION update_solicitacoes_compra_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS solicitacoes_compra_updated_at ON solicitacoes_compra;
CREATE TRIGGER solicitacoes_compra_updated_at
  BEFORE UPDATE ON solicitacoes_compra
  FOR EACH ROW EXECUTE FUNCTION update_solicitacoes_compra_updated_at();

-- 4. RLS
ALTER TABLE solicitacoes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacoes_compra     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compras_workspace_policy"   ON solicitacoes_compra;
DROP POLICY IF EXISTS "cotacoes_workspace_policy"  ON cotacoes_compra;
DROP POLICY IF EXISTS "cotacoes_public_token"      ON cotacoes_compra;

-- Membros do workspace veem e editam seus pedidos
CREATE POLICY "compras_workspace_policy" ON solicitacoes_compra
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Membros do workspace veem cotações
CREATE POLICY "cotacoes_workspace_policy" ON cotacoes_compra
  FOR ALL USING (
    solicitacao_id IN (
      SELECT id FROM solicitacoes_compra WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Fornecedor acessa SUA cotação via token (sem login) — SELECT e UPDATE
CREATE POLICY "cotacoes_public_token" ON cotacoes_compra
  FOR SELECT USING (true);

CREATE POLICY "cotacoes_public_update" ON cotacoes_compra
  FOR UPDATE USING (true) WITH CHECK (true);

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_solicitacoes_workspace  ON solicitacoes_compra(workspace_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status     ON solicitacoes_compra(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_comprador  ON solicitacoes_compra(comprador_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_solicitacao    ON cotacoes_compra(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_token          ON cotacoes_compra(token_acesso);
