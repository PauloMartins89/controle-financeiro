-- =============================================================================
-- MÓDULO REFEIÇÕES — Fluxo Automático (sem passos manuais do admin)
-- Execute no Supabase SQL Editor
-- =============================================================================

-- Flag no restaurante: exige confirmação via link ou apenas recebe
ALTER TABLE refei_restaurantes
  ADD COLUMN IF NOT EXISTS confirma_pedido boolean DEFAULT false;

COMMENT ON COLUMN refei_restaurantes.confirma_pedido IS
  'true = restaurante confirma recebimento via link antes do dia; false = apenas recebe notificação';

-- Token único para confirmação pelo restaurante
ALTER TABLE refei_solicitacoes
  ADD COLUMN IF NOT EXISTS token_restaurante uuid DEFAULT gen_random_uuid() UNIQUE;

-- Timestamps do novo fluxo automático
ALTER TABLE refei_solicitacoes
  ADD COLUMN IF NOT EXISTS confirmado_rest_em  timestamptz,  -- restaurante confirmou
  ADD COLUMN IF NOT EXISTS validacao_cron_em   timestamptz;  -- cron enviou msg de validação ao líder

COMMENT ON COLUMN refei_solicitacoes.token_restaurante IS
  'Token público para confirmação de recebimento pelo restaurante (/rc/:token)';

-- Preenche token_restaurante em solicitações existentes que ficaram NULL
UPDATE refei_solicitacoes
SET token_restaurante = gen_random_uuid()
WHERE token_restaurante IS NULL;
