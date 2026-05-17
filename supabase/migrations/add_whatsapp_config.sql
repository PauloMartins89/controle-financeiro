-- Tabela de configuração WhatsApp por workspace
-- Mapeia número de telefone do motorista para workspace_id
-- Executar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS whatsapp_config (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_number    TEXT NOT NULL,           -- ex: "5567999990000" (somente dígitos)
  nome_motorista  TEXT,
  ativo           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(phone_number)  -- um número só pode estar em 1 workspace
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_workspace ON whatsapp_config(workspace_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_phone     ON whatsapp_config(phone_number);

-- RLS
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Membros do workspace podem ver e gerenciar configurações
CREATE POLICY "workspace_members_select_whatsapp" ON whatsapp_config
  FOR SELECT USING (
    workspace_id IN (SELECT get_my_workspace_ids())
  );

CREATE POLICY "workspace_members_insert_whatsapp" ON whatsapp_config
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_my_workspace_ids())
  );

CREATE POLICY "workspace_members_update_whatsapp" ON whatsapp_config
  FOR UPDATE USING (
    workspace_id IN (SELECT get_my_workspace_ids())
  );

CREATE POLICY "workspace_members_delete_whatsapp" ON whatsapp_config
  FOR DELETE USING (
    workspace_id IN (SELECT get_my_workspace_ids())
  );

-- Service role bypassa RLS (usado pelo webhook)
-- (nenhuma policy adicional necessária — service_role ignora RLS por padrão)
