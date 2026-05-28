-- ══════════════════════════════════════════════════════════════
-- add_wa_relatorio.sql
-- Grupo restrito de usuários que podem solicitar relatórios via WA.
-- Cada linha mapeia um telefone → workspace + relatórios permitidos.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wa_relatorio_acesso (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  telefone             TEXT NOT NULL,
  nome                 TEXT,
  -- lista dos slugs de relatório que este número pode solicitar:
  --   'lancamentos', 'compras', 'refeicoes', 'efetivo', 'todos'
  relatorios_permitidos TEXT[] NOT NULL DEFAULT ARRAY['lancamentos'],
  ativo                BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, telefone)
);

CREATE INDEX IF NOT EXISTS wa_relatorio_acesso_tel_idx ON wa_relatorio_acesso(telefone);

ALTER TABLE wa_relatorio_acesso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_wa_relatorio_acesso" ON wa_relatorio_acesso
  FOR ALL USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id IN (SELECT my_workspace_ids()));

-- Admins do workspace podem gerenciar entradas desta tabela pelo painel web.
-- O backend usa service_role key (bypassa RLS) para validar o telefone.
