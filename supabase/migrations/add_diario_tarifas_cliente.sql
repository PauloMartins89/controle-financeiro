-- Adiciona vínculo de cliente à tabela diario_tarifas
ALTER TABLE diario_tarifas
  ADD COLUMN IF NOT EXISTS cliente_id   uuid REFERENCES cadastros_clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome text;
