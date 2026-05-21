-- Adiciona campos de cadastro de empresa ao workspace
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS razao_social TEXT,
  ADD COLUMN IF NOT EXISTS endereco     TEXT,
  ADD COLUMN IF NOT EXISTS atividade    TEXT,
  ADD COLUMN IF NOT EXISTS proprietario TEXT,
  ADD COLUMN IF NOT EXISTS contato      TEXT;
