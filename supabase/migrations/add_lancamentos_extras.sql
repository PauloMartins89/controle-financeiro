-- ============================================================
-- add_lancamentos_extras.sql
-- Adiciona campos para formulários customizados por workspace.
-- tipo_formulario: identifica qual formulário será usado.
-- dados_extras:    JSONB com campos específicos do formulário.
-- ============================================================

ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS tipo_formulario TEXT DEFAULT 'padrao',
  ADD COLUMN IF NOT EXISTS dados_extras    JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS lancamentos_tipo_form_idx ON lancamentos(tipo_formulario);
