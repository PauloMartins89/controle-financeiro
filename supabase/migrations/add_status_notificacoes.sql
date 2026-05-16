-- Tabela de destinatários de notificações por status de lançamento
-- Cada linha = "pessoa X recebe WhatsApp quando lançamento entrar no status Y"

CREATE TABLE IF NOT EXISTS status_notificacoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  status           text NOT NULL,          -- ex: 'aguardando_aprovacao', 'aprovado', 'devolvido', etc.
  nome_destinatario text NOT NULL,          -- nome legível (ex: "Paulo Gestor")
  phone_number     text NOT NULL,          -- somente dígitos, ex: 5516997286910
  ativo            boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_notif_workspace
  ON status_notificacoes (workspace_id, status, ativo);

-- RLS
ALTER TABLE status_notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage status_notificacoes"
  ON status_notificacoes
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
