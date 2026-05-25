-- ============================================================
-- Tabelas do motor independente Planos PFD
-- Motor de importação de manuais técnicos John Deere (TechPubs)
-- ============================================================

-- Publicações cadastradas (uma por manual/PDF)
CREATE TABLE IF NOT EXISTS pfd_publicacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  codigo_pub      varchar,                         -- ex: OMN400413 (código JD)
  titulo          varchar,                         -- ex: "Manual do Operador 8400R"
  fabricante      varchar DEFAULT 'John Deere',
  modelo          varchar,                         -- ex: 8400R
  familia         varchar,                         -- ex: Tractors
  classificacao   varchar,                         -- ex: Base Unit
  serie_inicio    varchar,                         -- ex: 100000
  serie_fim       varchar,                         -- ex: Current
  edicao          varchar,                         -- ex: South America
  idioma          varchar DEFAULT 'pt',
  url_fonte       varchar,                         -- URL no techpubs.deere.com
  url_pdf         varchar,                         -- URL direta do PDF (se disponível)
  pdf_storage_path varchar,                        -- caminho no Supabase Storage (se feito upload)
  paginas_total   int,
  status          varchar DEFAULT 'pendente'
                    CHECK (status IN ('pendente','processando','processado','erro')),
  erro_msg        text,
  importado_por   uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Plano extraído de uma publicação — intervalos e tarefas
CREATE TABLE IF NOT EXISTS pfd_planos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacao_id   uuid REFERENCES pfd_publicacoes(id) ON DELETE CASCADE,
  workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  modelo          varchar,
  fabricante      varchar,
  -- Array JSON de intervalos:
  -- [{ horas: 10, nome: 'A cada 10 horas', tarefas: [{ sistema, tarefa, codigo, capacidade, unidade }] }]
  intervalos      jsonb DEFAULT '[]',
  total_intervalos int DEFAULT 0,
  total_tarefas   int DEFAULT 0,
  paginas_usadas  int[],                           -- quais páginas do PDF foram usadas
  extraido_em     timestamptz DEFAULT now(),
  revisado        boolean DEFAULT false,
  revisado_por    uuid REFERENCES auth.users(id),
  revisado_em     timestamptz
);

-- RLS
ALTER TABLE pfd_publicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pfd_planos      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pfd_publicacoes_workspace" ON pfd_publicacoes
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "pfd_planos_workspace" ON pfd_planos
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  ));

-- Índices
CREATE INDEX IF NOT EXISTS idx_pfd_pub_workspace  ON pfd_publicacoes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pfd_pub_modelo     ON pfd_publicacoes(modelo);
CREATE INDEX IF NOT EXISTS idx_pfd_pub_status     ON pfd_publicacoes(status);
CREATE INDEX IF NOT EXISTS idx_pfd_planos_pub     ON pfd_planos(publicacao_id);
CREATE INDEX IF NOT EXISTS idx_pfd_planos_ws      ON pfd_planos(workspace_id);
