-- ─── CONTROLE DE EPI (entrega por turno/colaborador) ──────────────────────────
CREATE TABLE IF NOT EXISTS lider_controle_epi (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id         uuid NOT NULL REFERENCES lider_turnos(id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL,
  colaborador_id   uuid REFERENCES lider_colaboradores(id),
  colaborador_nome text,
  epi_id           uuid REFERENCES lider_epis(id),
  epi_nome         text,
  motivo           text,       -- novo | troca_danificado | troca_vencido
  validade         date,
  status           text DEFAULT 'entregue',
  foto_url         text,
  observacao       text,
  criado_por       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lider_controle_epi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_access_controle_epi"
  ON lider_controle_epi
  FOR ALL
  USING (workspace_id::text = current_setting('app.workspace_id', true));

-- ─── ADICIONAR COLUNAS DE AFERIÇÃO SÓLIDOS ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lider_epis' AND column_name = 'categoria'
  ) THEN
    ALTER TABLE lider_epis ADD COLUMN categoria text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lider_epis' AND column_name = 'vida_util_meses'
  ) THEN
    ALTER TABLE lider_epis ADD COLUMN vida_util_meses integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lider_afericoes' AND column_name = 'tipo_afericao'
  ) THEN
    ALTER TABLE lider_afericoes ADD COLUMN tipo_afericao text DEFAULT 'liquido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lider_afericoes' AND column_name = 'produto_aplicado'
  ) THEN
    ALTER TABLE lider_afericoes ADD COLUMN produto_aplicado text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lider_afericoes' AND column_name = 'dose_kg_ha'
  ) THEN
    ALTER TABLE lider_afericoes ADD COLUMN dose_kg_ha numeric(10,2);
  END IF;
END $$;
