-- ============================================================
-- Chamados WA: campos de contexto, rastreamento de interação técnica
-- Created: 2026-07-01
-- ============================================================

-- Campos extraídos pela IA / herdados do grupo na criação do SAT
ALTER TABLE solicitacoes_atendimento ADD COLUMN IF NOT EXISTS local    TEXT;
ALTER TABLE solicitacoes_atendimento ADD COLUMN IF NOT EXISTS cliente  TEXT;
ALTER TABLE solicitacoes_atendimento ADD COLUMN IF NOT EXISTS operacao TEXT;

-- Rastreamento de interação do técnico responsável (SLA)
ALTER TABLE solicitacoes_atendimento
  ADD COLUMN IF NOT EXISTS data_primeira_interacao_tecnico TIMESTAMPTZ;

ALTER TABLE solicitacoes_atendimento
  ADD COLUMN IF NOT EXISTS data_ultima_interacao TIMESTAMPTZ;

ALTER TABLE solicitacoes_atendimento
  ADD COLUMN IF NOT EXISTS quantidade_interacoes INTEGER NOT NULL DEFAULT 0;

-- Flag na mensagem para indicar se foi enviada pelo técnico responsável do grupo
ALTER TABLE mensagens_whatsapp_grupos
  ADD COLUMN IF NOT EXISTS eh_tecnico BOOLEAN NOT NULL DEFAULT false;

-- Índice para relatórios por cliente
CREATE INDEX IF NOT EXISTS idx_sat_cliente
  ON solicitacoes_atendimento (workspace_id, cliente)
  WHERE cliente IS NOT NULL;
