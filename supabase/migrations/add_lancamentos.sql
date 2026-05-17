-- ============================================================
-- add_lancamentos.sql
-- Módulo de Lançamentos com Digitalização de Formulários
-- ============================================================

-- Tabela principal de lançamentos
CREATE TABLE IF NOT EXISTS lancamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL DEFAULT 'despesa',   -- despesa | receita | transferencia
  descricao       TEXT NOT NULL,
  valor           NUMERIC(12,2) NOT NULL DEFAULT 0,
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria       TEXT DEFAULT 'Outros',
  centro_custo    TEXT,
  status          TEXT DEFAULT 'pendente',           -- pendente | aprovado | rejeitado
  comprovante_url TEXT,                              -- URL do comprovante/imagem digitalizada
  observacoes     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS lancamentos_workspace_idx ON lancamentos(workspace_id);
CREATE INDEX IF NOT EXISTS lancamentos_user_idx      ON lancamentos(user_id);
CREATE INDEX IF NOT EXISTS lancamentos_data_idx      ON lancamentos(data DESC);
CREATE INDEX IF NOT EXISTS lancamentos_status_idx    ON lancamentos(status);

-- RLS
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;

-- Membros vêem lançamentos do próprio workspace
CREATE POLICY "members_see_lancamentos" ON lancamentos
  FOR SELECT USING (
    workspace_id IN (SELECT get_my_workspace_ids())
    OR auth.email() = 'ph.mar89s@gmail.com'
  );

-- Membros criam/editam/deletam no próprio workspace
CREATE POLICY "members_manage_lancamentos" ON lancamentos
  FOR ALL USING (
    workspace_id IN (SELECT get_my_workspace_ids())
    OR auth.email() = 'ph.mar89s@gmail.com'
  )
  WITH CHECK (
    workspace_id IN (SELECT get_my_workspace_ids())
    OR auth.email() = 'ph.mar89s@gmail.com'
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lancamentos_updated_at ON lancamentos;
CREATE TRIGGER lancamentos_updated_at
  BEFORE UPDATE ON lancamentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
