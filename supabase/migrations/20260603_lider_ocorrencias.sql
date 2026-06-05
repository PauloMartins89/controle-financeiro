-- ─── MÓDULO DE OCORRÊNCIAS DE CAMPO ──────────────────────────────────────────
-- Registra incidentes durante o turno: quebras, acidentes, chuva, etc.
-- Executar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS lider_ocorrencias (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id      uuid        NOT NULL REFERENCES lider_turnos(id) ON DELETE CASCADE,
  workspace_id  uuid        NOT NULL,
  equipe_id     uuid        REFERENCES lider_equipes(id),
  tipo          text        NOT NULL,  -- 'quebra_equipamento' | 'acidente_pessoal' | 'chuva_vento' | 'qualidade' | 'seguranca' | 'outro'
  descricao     text        NOT NULL,
  gravidade     text        DEFAULT 'media', -- 'baixa' | 'media' | 'alta' | 'critica'
  foto_url      text,
  status        text        DEFAULT 'aberta', -- 'aberta' | 'em_tratamento' | 'resolvida'
  observacao    text,
  criado_por    uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_turno    ON lider_ocorrencias (turno_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_workspace ON lider_ocorrencias (workspace_id);

ALTER TABLE lider_ocorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_access_ocorrencias"
  ON lider_ocorrencias
  FOR ALL
  USING (workspace_id::text = current_setting('app.workspace_id', true));
