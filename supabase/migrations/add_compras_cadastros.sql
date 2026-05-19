-- Tabela de fornecedores do módulo Compras
CREATE TABLE IF NOT EXISTS fornecedores_compra (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL,
  nome          TEXT NOT NULL,
  cnpj          TEXT,
  contato       TEXT,
  telefone      TEXT,
  email         TEXT,
  observacoes   TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fornecedores_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_fornecedores" ON fornecedores_compra
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Tabela de categorias do módulo Compras
CREATE TABLE IF NOT EXISTS categorias_compra (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL,
  nome          TEXT NOT NULL,
  descricao     TEXT,
  cor           TEXT DEFAULT '#6366f1',
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categorias_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_categorias" ON categorias_compra
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
