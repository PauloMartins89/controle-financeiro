-- ============================================================
-- MIGRATION: Telemetria de Campo — SmartLíder
-- Registra trajetos GPS + acelerômetro dos líderes em campo.
-- Retenção: pontos deletados após 7 dias (cron diário).
-- Sessões resumidas são mantidas permanentemente.
-- ============================================================

-- ─── SESSÕES ────────────────────────────────────────────────────────────────
-- Uma sessão = uma saída a campo (app aberto → app fechado)

CREATE TABLE IF NOT EXISTS lider_telemetria_sessoes (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid        NOT NULL,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  iniciado_em         timestamptz NOT NULL DEFAULT now(),
  finalizado_em       timestamptz,                    -- NULL = em andamento
  distancia_total_m   float,                          -- calculado ao fechar
  duracao_min         float,                          -- calculado ao fechar
  pontos_count        int         DEFAULT 0,
  velocidade_media_ms float,                          -- calculado ao fechar
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lider_telemetria_sessoes ENABLE ROW LEVEL SECURITY;

-- Líder: insere e atualiza apenas suas próprias sessões
DROP POLICY IF EXISTS "telemetria_sessoes_insert" ON lider_telemetria_sessoes;
CREATE POLICY "telemetria_sessoes_insert"
  ON lider_telemetria_sessoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "telemetria_sessoes_update_own" ON lider_telemetria_sessoes;
CREATE POLICY "telemetria_sessoes_update_own"
  ON lider_telemetria_sessoes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Gestor (usuários sem role='lider'): lê tudo do workspace
DROP POLICY IF EXISTS "telemetria_sessoes_gestor_select" ON lider_telemetria_sessoes;
CREATE POLICY "telemetria_sessoes_gestor_select"
  ON lider_telemetria_sessoes FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'lider'
  );

-- ─── PONTOS GPS ─────────────────────────────────────────────────────────────
-- Um ponto = snapshot GPS + acelerômetro (adaptive sampling)

CREATE TABLE IF NOT EXISTS lider_telemetria_pontos (
  id            bigserial   PRIMARY KEY,
  sessao_id     uuid        NOT NULL REFERENCES lider_telemetria_sessoes(id) ON DELETE CASCADE,
  workspace_id  uuid        NOT NULL,
  user_id       uuid        NOT NULL,
  ts            timestamptz NOT NULL,
  lat           double precision NOT NULL,
  lng           double precision NOT NULL,
  accuracy_m    float,
  speed_ms      float,                 -- velocidade do GPS (m/s)
  heading       float,                 -- direção 0–360°
  altitude_m    float,
  accel_rms     float,                 -- RMS eixo Z acelerômetro, janela 1s
  via_osm       text,                  -- tag highway do OSM (preenchido pelo batch)
  surface_osm   text,                  -- tag surface do OSM (preenchido pelo batch)
  tipo_via      text GENERATED ALWAYS AS (
    CASE
      WHEN speed_ms IS NULL              THEN 'desconhecido'
      WHEN speed_ms < 0.5                THEN 'parado'
      WHEN speed_ms < 2.8                THEN 'lavoura_ou_pe'    -- < 10 km/h
      WHEN speed_ms > 16.7               THEN 'asfalto'           -- > 60 km/h
      -- 10–60 km/h: usa acelerômetro para classificar
      WHEN accel_rms IS NULL             THEN 'terra'
      WHEN accel_rms > 0.8               THEN 'terra_ruim'
      WHEN accel_rms > 0.3               THEN 'terra'
      ELSE                                    'terra_boa'
    END
  ) STORED,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_telemetria_pontos_sessao   ON lider_telemetria_pontos (sessao_id);
CREATE INDEX IF NOT EXISTS idx_telemetria_pontos_ts       ON lider_telemetria_pontos (ts DESC);
CREATE INDEX IF NOT EXISTS idx_telemetria_pontos_user     ON lider_telemetria_pontos (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_telemetria_pontos_osm_null ON lider_telemetria_pontos (id)
  WHERE via_osm IS NULL AND speed_ms > 2;   -- índice parcial para o batch OSM

ALTER TABLE lider_telemetria_pontos ENABLE ROW LEVEL SECURITY;

-- Líder: somente INSERT dos próprios pontos
DROP POLICY IF EXISTS "telemetria_pontos_insert" ON lider_telemetria_pontos;
CREATE POLICY "telemetria_pontos_insert"
  ON lider_telemetria_pontos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Gestor: SELECT de todos os pontos do workspace
DROP POLICY IF EXISTS "telemetria_pontos_gestor_select" ON lider_telemetria_pontos;
CREATE POLICY "telemetria_pontos_gestor_select"
  ON lider_telemetria_pontos FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'lider'
  );

-- Batch server: UPDATE para preencher via_osm / surface_osm (service role, bypassa RLS)

-- ─── CRON: deletar pontos > 7 dias ──────────────────────────────────────────
-- Para ativar a limpeza automática, habilite pg_cron em:
-- Supabase Dashboard → Database → Extensions → pg_cron
-- Depois execute manualmente:
--
--   SELECT cron.schedule(
--     'telemetria-purge-7d',
--     '0 3 * * *',
--     $$ DELETE FROM lider_telemetria_pontos WHERE ts < now() - interval '7 days'; $$
--   );
--
-- Alternativa: criar uma Edge Function agendada no Supabase para o mesmo DELETE.
