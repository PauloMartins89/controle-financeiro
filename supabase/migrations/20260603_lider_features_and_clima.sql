-- ============================================================
-- MIGRATION: lider_workspace_features + lider_condicoes_climaticas
-- ============================================================

-- ── Feature flags por workspace ───────────────────────────
CREATE TABLE IF NOT EXISTS lider_workspace_features (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL,
  feature      text        NOT NULL,
  ativo        boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, feature)
);

ALTER TABLE lider_workspace_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lider_features_all" ON lider_workspace_features;
CREATE POLICY "lider_features_all" ON lider_workspace_features
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Condições climáticas por turno ────────────────────────
CREATE TABLE IF NOT EXISTS lider_condicoes_climaticas (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id        uuid        NOT NULL REFERENCES lider_turnos(id) ON DELETE CASCADE,
  workspace_id    uuid        NOT NULL,
  equipe_id       uuid,
  condicao        text        NOT NULL,  -- sol | parcial | nublado | chuva | tempestade | vento_forte
  temperatura_c   numeric(5,1),
  umidade_pct     integer,
  vento_kmh       numeric(5,1),
  precipitacao_mm numeric(5,1),
  observacao      text,
  registrado_por  uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lider_condicoes_climaticas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lider_clima_all" ON lider_condicoes_climaticas;
CREATE POLICY "lider_clima_all" ON lider_condicoes_climaticas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índice para busca rápida por turno
CREATE INDEX IF NOT EXISTS idx_lider_clima_turno
  ON lider_condicoes_climaticas (turno_id, created_at DESC);
