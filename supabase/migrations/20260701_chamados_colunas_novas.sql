-- ============================================================
-- Chamados WA: colunas adicionais em solicitacoes_atendimento
-- Created: 2026-07-01
-- ============================================================

-- Equipamento/veículo extraído pela IA da mensagem
ALTER TABLE solicitacoes_atendimento
  ADD COLUMN IF NOT EXISTS equipamento TEXT;

-- Data em que o chamado foi concluído/fechado
ALTER TABLE solicitacoes_atendimento
  ADD COLUMN IF NOT EXISTS data_finalizacao TIMESTAMPTZ;

-- Descrição da resolução (extraída pelo detectarResolucao ou digitada manualmente)
ALTER TABLE solicitacoes_atendimento
  ADD COLUMN IF NOT EXISTS resolucao_descricao TEXT;

-- Índice para consultas por equipamento
CREATE INDEX IF NOT EXISTS idx_sat_equipamento
  ON solicitacoes_atendimento (workspace_id, equipamento)
  WHERE equipamento IS NOT NULL;
