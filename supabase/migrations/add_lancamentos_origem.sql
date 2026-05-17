-- ============================================================
-- add_lancamentos_origem.sql
-- Adiciona coluna origem na tabela lancamentos para rastrear
-- de onde veio o lançamento (whatsapp | manual | importacao)
-- ============================================================

ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'whatsapp';

CREATE INDEX IF NOT EXISTS lancamentos_origem_idx ON lancamentos(origem);
