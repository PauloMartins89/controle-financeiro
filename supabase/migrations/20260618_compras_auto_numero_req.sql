-- Auto-geração de numero_req por workspace
-- Formato: REQ-YYYY-NNNN (ex: REQ-2026-0001)
-- Usa tabela de sequência com upsert atômico para evitar colisão concorrente

-- 1. Tabela de sequências por workspace
CREATE TABLE IF NOT EXISTS workspace_sequences (
  workspace_id UUID NOT NULL,
  seq_key      TEXT NOT NULL,
  ultimo       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, seq_key)
);

ALTER TABLE workspace_sequences ENABLE ROW LEVEL SECURITY;

-- Admins podem ler/escrever; sem política de leitura pública (acesso apenas via SECURITY DEFINER)
CREATE POLICY "workspace_sequences_service" ON workspace_sequences
  USING (false) WITH CHECK (false);

-- 2. Função que incrementa atomicamente e retorna o próximo número
CREATE OR REPLACE FUNCTION next_workspace_seq(p_workspace_id UUID, p_key TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  INSERT INTO workspace_sequences (workspace_id, seq_key, ultimo)
    VALUES (p_workspace_id, p_key, 1)
  ON CONFLICT (workspace_id, seq_key)
    DO UPDATE SET ultimo = workspace_sequences.ultimo + 1
  RETURNING ultimo INTO v_next;
  RETURN v_next;
END;
$$;

-- 3. Trigger: auto-preenche numero_req no INSERT se não informado
CREATE OR REPLACE FUNCTION trg_auto_numero_req()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ano TEXT;
  v_num INTEGER;
BEGIN
  IF NEW.numero_req IS NULL OR TRIM(NEW.numero_req) = '' THEN
    v_ano := TO_CHAR(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY');
    v_num := next_workspace_seq(NEW.workspace_id, 'req_' || v_ano);
    NEW.numero_req := 'REQ-' || v_ano || '-' || LPAD(v_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_numero_req ON solicitacoes_compra;
CREATE TRIGGER tg_numero_req
  BEFORE INSERT ON solicitacoes_compra
  FOR EACH ROW EXECUTE FUNCTION trg_auto_numero_req();

-- 4. Preenche retroativamente registros que ficaram sem numero_req
-- (executa numa transação separada para não travar a migration)
DO $$
DECLARE
  r RECORD;
  v_ano TEXT;
  v_num INTEGER;
BEGIN
  FOR r IN
    SELECT id, workspace_id, created_at
    FROM solicitacoes_compra
    WHERE numero_req IS NULL
    ORDER BY created_at ASC
  LOOP
    v_ano := TO_CHAR(r.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY');
    v_num := next_workspace_seq(r.workspace_id, 'req_' || v_ano);
    UPDATE solicitacoes_compra
    SET numero_req = 'REQ-' || v_ano || '-' || LPAD(v_num::TEXT, 4, '0')
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- Verificar
SELECT id, titulo, numero_req, created_at
FROM solicitacoes_compra
ORDER BY created_at DESC
LIMIT 10;
