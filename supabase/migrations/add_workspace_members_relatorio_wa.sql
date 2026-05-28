-- ══════════════════════════════════════════════════════════════
-- add_workspace_members_relatorio_wa.sql
-- Adiciona campos para controle de acesso ao relatório WhatsApp
-- diretamente em workspace_members, sem precisar gerenciar
-- manualmente a tabela wa_relatorio_acesso.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS whatsapp     TEXT,
  ADD COLUMN IF NOT EXISTS relatorio_wa BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS workspace_members_whatsapp_idx
  ON workspace_members(whatsapp)
  WHERE whatsapp IS NOT NULL;

COMMENT ON COLUMN workspace_members.whatsapp     IS 'Número WhatsApp do membro (55DDxxxxxxxx)';
COMMENT ON COLUMN workspace_members.relatorio_wa IS 'Permite solicitar relatórios via WhatsApp. Admins (perfil_id IS NULL) têm acesso automático se whatsapp estiver preenchido.';
