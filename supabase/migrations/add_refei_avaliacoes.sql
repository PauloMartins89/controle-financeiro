-- ════════════════════════════════════════════════════════════════════════════
-- Pesquisa de satisfação de refeições (refei_avaliacoes)
-- Criada quando o supervisor aprova o pedido.
-- Disponível para resposta no dia da refeição (data_refeicao).
-- Se não respondida, torna-se passo obrigatório antes de novo pedido.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS refei_avaliacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  solicitacao_id   uuid REFERENCES refei_solicitacoes(id) ON DELETE SET NULL,
  lider_id         uuid,           -- owner_id do pedido
  equipe_id        uuid,
  numero_pedido    text,
  restaurante_nome text,
  data_refeicao    date NOT NULL,
  disponivel_em    date NOT NULL,  -- mesmo que data_refeicao
  status           text NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'respondida')),
  -- Respostas
  nota_geral          smallint CHECK (nota_geral BETWEEN 1 AND 5),
  quantidade_correta  boolean,
  temperatura_ok      boolean,
  sabor_ok            boolean,
  observacao          text,
  respondida_em       timestamptz,
  criado_em           timestamptz DEFAULT now(),
  -- Garante apenas uma avaliação por pedido
  UNIQUE (solicitacao_id)
);

-- Índices para queries frequentes
CREATE INDEX IF NOT EXISTS idx_refei_aval_lider_pendente
  ON refei_avaliacoes (lider_id, status, disponivel_em);

CREATE INDEX IF NOT EXISTS idx_refei_aval_workspace
  ON refei_avaliacoes (workspace_id, status);

-- RLS
ALTER TABLE refei_avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members refei_avaliacoes" ON refei_avaliacoes;
CREATE POLICY "workspace members refei_avaliacoes" ON refei_avaliacoes
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    OR lider_id = auth.uid()  -- líderes acessam as próprias avaliações
  );
