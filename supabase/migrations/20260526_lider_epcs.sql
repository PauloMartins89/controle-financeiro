-- ─── Catálogo EPC (Equipamento de Proteção Coletiva) ─────────────────────────
CREATE TABLE IF NOT EXISTS lider_epcs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  nome         text NOT NULL,
  ca           text,
  frente_nome  text,  -- módulo / frente de trabalho onde o EPC está instalado
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lider_epcs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lider_epcs' AND policyname = 'lider_auth_all'
  ) THEN
    CREATE POLICY lider_auth_all ON lider_epcs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
