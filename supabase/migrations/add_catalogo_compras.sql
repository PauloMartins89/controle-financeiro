-- Catálogo de itens padronizados para o módulo de compras
-- Execute no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS catalogo_compras (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id           UUID NOT NULL,
  nome                   VARCHAR(200) NOT NULL,
  descricao              TEXT,
  unidade_medida         VARCHAR(50) DEFAULT 'un',
  categoria              VARCHAR(100),
  especificacoes         TEXT,
  preco_referencia       NUMERIC(14,2),
  fornecedor_preferido_nome VARCHAR(200),
  ativo                  BOOLEAN DEFAULT true,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_catalogo_compras_workspace ON catalogo_compras(workspace_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_compras_nome ON catalogo_compras(workspace_id, nome);
CREATE INDEX IF NOT EXISTS idx_catalogo_compras_categoria ON catalogo_compras(workspace_id, categoria);

-- RLS
ALTER TABLE catalogo_compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage catalog"
  ON catalogo_compras FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
