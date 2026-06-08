-- =============================================================================
-- MÓDULO DDS — Diálogo Diário de Segurança
-- Execute no Supabase SQL Editor
-- =============================================================================

-- Biblioteca de temas
CREATE TABLE IF NOT EXISTS dds_temas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  titulo       text NOT NULL,
  categoria    text NOT NULL DEFAULT 'Segurança',
  conteudo     text,
  imagem_url   text,
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Sessão DDS por turno
CREATE TABLE IF NOT EXISTS dds_registros (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  turno_id         uuid,
  lider_id         uuid,
  tema_id          uuid REFERENCES dds_temas(id) ON DELETE SET NULL,
  data             date NOT NULL,
  status           text NOT NULL DEFAULT 'em_andamento',
  total_assinantes int  NOT NULL DEFAULT 0,
  concluido_em     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Assinaturas individuais
CREATE TABLE IF NOT EXISTS dds_assinaturas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id      uuid NOT NULL REFERENCES dds_registros(id) ON DELETE CASCADE,
  colaborador_id   uuid,
  colaborador_nome text NOT NULL,
  assinatura_svg   text,
  assinado_em      timestamptz NOT NULL DEFAULT now()
);

-- RLS: acesso apenas pelo workspace
ALTER TABLE dds_temas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dds_registros  ENABLE ROW LEVEL SECURITY;
ALTER TABLE dds_assinaturas ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (service key bypassa RLS — OK para API)
CREATE POLICY "service full access dds_temas"       ON dds_temas       USING (true) WITH CHECK (true);
CREATE POLICY "service full access dds_registros"   ON dds_registros   USING (true) WITH CHECK (true);
CREATE POLICY "service full access dds_assinaturas" ON dds_assinaturas USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_dds_temas_workspace ON dds_temas(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dds_registros_workspace ON dds_registros(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dds_registros_turno ON dds_registros(turno_id);
CREATE INDEX IF NOT EXISTS idx_dds_assinaturas_registro ON dds_assinaturas(registro_id);
