-- Migração: adiciona suporte a WhatsApp diretamente em cadastros_condutores
-- Substitui whatsapp_config como fonte de identificação do motorista

ALTER TABLE cadastros_condutores
  ADD COLUMN IF NOT EXISTS ativo_whatsapp BOOLEAN DEFAULT FALSE;

-- Index para lookup rápido por telefone + whatsapp ativo
CREATE INDEX IF NOT EXISTS idx_condutores_telefone ON cadastros_condutores(telefone);
CREATE INDEX IF NOT EXISTS idx_condutores_wa ON cadastros_condutores(ativo_whatsapp) WHERE ativo_whatsapp = true;

-- Migra dados existentes de whatsapp_config para cadastros_condutores
-- (insere só quem ainda não existir por telefone no workspace)
INSERT INTO cadastros_condutores (workspace_id, owner_id, nome, telefone, ativo_whatsapp, ativo)
SELECT
  wc.workspace_id,
  wc.user_id,
  wc.nome_motorista,
  wc.phone_number,
  true,
  true
FROM whatsapp_config wc
WHERE wc.nome_motorista IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cadastros_condutores cc
    WHERE cc.workspace_id = wc.workspace_id
      AND cc.telefone = wc.phone_number
  );

-- Ativa WhatsApp para condutores cujo telefone coincide com whatsapp_config
UPDATE cadastros_condutores cc
SET ativo_whatsapp = true
FROM whatsapp_config wc
WHERE cc.workspace_id = wc.workspace_id
  AND cc.telefone = wc.phone_number
  AND wc.ativo = true;
