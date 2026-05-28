-- Tabela para salvar perguntas não reconhecidas pela IA (recalibração)
CREATE TABLE IF NOT EXISTS wa_ia_feedback (
  id           BIGSERIAL PRIMARY KEY,
  workspace_id UUID        REFERENCES workspaces(id) ON DELETE SET NULL,
  from_phone   TEXT        NOT NULL,
  texto        TEXT        NOT NULL,
  -- 'nao_reconhecido' | 'modulo_desconhecido' | 'erro'
  motivo       TEXT        NOT NULL,
  -- JSON retornado pelo Groq (ou mensagem de erro)
  pedido_json  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wa_ia_feedback_workspace_idx ON wa_ia_feedback(workspace_id);
CREATE INDEX IF NOT EXISTS wa_ia_feedback_motivo_idx    ON wa_ia_feedback(motivo);
CREATE INDEX IF NOT EXISTS wa_ia_feedback_created_idx   ON wa_ia_feedback(created_at DESC);

-- service_role tem acesso total; usuários normais não lêem
ALTER TABLE wa_ia_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON wa_ia_feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);
