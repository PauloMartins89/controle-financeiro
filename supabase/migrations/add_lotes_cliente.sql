-- Tabela de lotes enviados ao cliente para aprovação (De Acordo)
CREATE TABLE IF NOT EXISTS lotes_cliente (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  cliente          text NOT NULL,
  status           text NOT NULL DEFAULT 'rascunho',
  -- rascunho | enviado_cliente | aprovado_cliente | recusado_cliente
  comprovante_url  text,          -- comprovante do De Acordo anexado pela analista
  observacoes      text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lotes_cliente_workspace
  ON lotes_cliente (workspace_id, status);

-- FK em lancamentos aponta para o lote
ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS lote_cliente_id uuid REFERENCES lotes_cliente(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lancamentos_lote_cliente
  ON lancamentos (lote_cliente_id);

-- RLS
ALTER TABLE lotes_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_manage_lotes_cliente"
  ON lotes_cliente FOR ALL
  USING (
    workspace_id IN (SELECT get_my_workspace_ids())
    OR auth.email() = 'ph.mar89s@gmail.com'
  )
  WITH CHECK (
    workspace_id IN (SELECT get_my_workspace_ids())
    OR auth.email() = 'ph.mar89s@gmail.com'
  );
