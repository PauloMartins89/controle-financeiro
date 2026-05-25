-- ============================================================
-- MIGRATION: App do Líder Operacional
-- Todas as tabelas prefixadas com lider_
-- Isolado do sistema web existente (sem quebrar nada)
-- ============================================================

-- ─── CATÁLOGOS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lider_fazendas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  nome         text NOT NULL,
  codigo       text,
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_talhoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id   uuid REFERENCES lider_fazendas(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  nome         text NOT NULL,
  codigo       text,
  area_ha      numeric(10,2),
  cultura      text,
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_frentes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  nome         text NOT NULL,
  codigo       text,
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_equipes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  frente_id    uuid REFERENCES lider_frentes(id),
  nome         text NOT NULL,
  codigo       text,
  lider_id     uuid REFERENCES auth.users(id),
  lider_nome   text,
  lider_email  text,
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_colaboradores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id    uuid REFERENCES lider_equipes(id) ON DELETE SET NULL,
  workspace_id uuid NOT NULL,
  nome         text NOT NULL,
  matricula    text,
  cargo        text,
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_maquinas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  nome         text NOT NULL,
  modelo       text,
  codigo       text,
  tipo         text, -- trator, pulverizador, colheitadeira, etc.
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_implementos (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid NOT NULL,
  nome                   text NOT NULL,
  modelo                 text,
  codigo                 text,
  largura_m              numeric(6,2),
  volume_recomendado_lha numeric(8,2),
  ativo                  boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_produtos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  nome         text NOT NULL,
  tipo         text, -- herbicida, inseticida, fertilizante, combustivel, semente
  unidade      text, -- L, kg, t, un, sc
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_epis (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  nome         text NOT NULL,
  ca           text, -- certificado de aprovação
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── TURNO (CONTEXTO BASE DE TODOS OS APONTAMENTOS) ─────────

CREATE TABLE IF NOT EXISTS lider_turnos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  frente_id    uuid REFERENCES lider_frentes(id),
  frente_nome  text,
  equipe_id    uuid REFERENCES lider_equipes(id),
  equipe_nome  text,
  lider_id     uuid REFERENCES auth.users(id),
  lider_nome   text,
  data         date NOT NULL,
  turno        text NOT NULL DEFAULT 'manha', -- manha | tarde | noite
  status       text NOT NULL DEFAULT 'aberto', -- aberto | fechado
  fechado_em   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipe_id, data, turno)
);

-- ─── APONTAMENTOS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lider_mao_obra (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id          uuid NOT NULL REFERENCES lider_turnos(id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL,
  colaborador_id    uuid REFERENCES lider_colaboradores(id),
  colaborador_nome  text NOT NULL,
  cargo             text,
  presente          boolean NOT NULL DEFAULT true,
  hora_entrada      text, -- HH:MM
  hora_saida        text,
  horas_trabalhadas numeric(4,1),
  observacao        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turno_id, colaborador_id)
);

CREATE TABLE IF NOT EXISTS lider_apontamentos_maquina (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id          uuid NOT NULL REFERENCES lider_turnos(id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL,
  maquina_id        uuid REFERENCES lider_maquinas(id),
  maquina_nome      text NOT NULL,
  operador_id       uuid REFERENCES lider_colaboradores(id),
  operador_nome     text,
  horimetro_inicial numeric(10,1),
  horimetro_final   numeric(10,1),
  horas_trabalhadas numeric(5,1),  -- (final - inicial), preenchido no app
  horas_paradas     numeric(5,1) DEFAULT 0,
  motivo_parada     text,
  atividade         text,
  talhao_id         uuid REFERENCES lider_talhoes(id),
  talhao_nome       text,
  observacao        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_apontamentos_insumo (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id     uuid NOT NULL REFERENCES lider_turnos(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  produto_id   uuid REFERENCES lider_produtos(id),
  produto_nome text NOT NULL,
  quantidade   numeric(12,3) NOT NULL,
  unidade      text NOT NULL,
  talhao_id    uuid REFERENCES lider_talhoes(id),
  talhao_nome  text,
  maquina_id   uuid REFERENCES lider_maquinas(id),
  maquina_nome text,
  atividade    text,
  foto_url     text,
  observacao   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_afericoes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id               uuid NOT NULL REFERENCES lider_turnos(id) ON DELETE CASCADE,
  workspace_id           uuid NOT NULL,
  implemento_id          uuid REFERENCES lider_implementos(id),
  implemento_nome        text,
  maquina_id             uuid REFERENCES lider_maquinas(id),
  maquina_nome           text,
  vazao_medida_lmin      numeric(8,2),
  velocidade_kmh         numeric(6,2),
  largura_m              numeric(6,2),
  volume_calda_lha       numeric(8,2),  -- calculado no app: (vazao*60)/(vel*largura)
  volume_recomendado_lha numeric(8,2),
  status                 text,          -- dentro_padrao | fora_padrao
  observacao             text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- ─── PRODUTIVIDADE ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lider_produtividade_equipamento (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id            uuid NOT NULL REFERENCES lider_turnos(id) ON DELETE CASCADE,
  workspace_id        uuid NOT NULL,
  maquina_id          uuid REFERENCES lider_maquinas(id),
  maquina_nome        text,
  atividade           text,
  area_ha             numeric(10,2),
  quantidade_aplicada numeric(12,3),
  unidade_aplicada    text,
  horas_trabalhadas   numeric(5,1),
  produtividade_hah   numeric(6,2),  -- calculado no app: area/horas
  observacao          text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_produtividade_equipe (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id       uuid NOT NULL REFERENCES lider_turnos(id) ON DELETE CASCADE,
  workspace_id   uuid NOT NULL,
  equipe_id      uuid REFERENCES lider_equipes(id),
  equipe_nome    text,
  atividade      text,
  meta_ha        numeric(10,2),
  realizado_ha   numeric(10,2),
  eficiencia_pct numeric(5,1),  -- calculado no app: (realizado/meta)*100
  motivo_desvio  text,
  observacao     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── AVALIAÇÃO ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lider_avaliacoes_equipe (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id      uuid NOT NULL REFERENCES lider_turnos(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL,
  equipe_id     uuid REFERENCES lider_equipes(id),
  equipe_nome   text,
  presenca      smallint CHECK (presenca BETWEEN 1 AND 5),
  produtividade smallint CHECK (produtividade BETWEEN 1 AND 5),
  qualidade     smallint CHECK (qualidade BETWEEN 1 AND 5),
  seguranca     smallint CHECK (seguranca BETWEEN 1 AND 5),
  uso_epi       smallint CHECK (uso_epi BETWEEN 1 AND 5),
  disciplina    smallint CHECK (disciplina BETWEEN 1 AND 5),
  nota_geral    numeric(3,1),  -- calculado no app: média dos 6 critérios
  comentario    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turno_id, equipe_id)
);

-- ─── SOLICITAÇÕES ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lider_solicitacoes_insumo (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id          uuid REFERENCES lider_turnos(id),
  workspace_id      uuid NOT NULL,
  produto_id        uuid REFERENCES lider_produtos(id),
  produto_nome      text NOT NULL,
  quantidade        numeric(12,3) NOT NULL,
  unidade           text NOT NULL,
  talhao_id         uuid REFERENCES lider_talhoes(id),
  talhao_nome       text,
  data_necessaria   date,
  urgencia          text DEFAULT 'media', -- baixa | media | alta
  justificativa     text,
  status            text DEFAULT 'pendente', -- pendente | aprovado | reprovado | entregue
  motivo_reprovacao text,
  solicitado_por    uuid REFERENCES auth.users(id),
  solicitado_em     timestamptz DEFAULT now(),
  aprovado_por      text,
  aprovado_em       timestamptz,
  excluido_em       timestamptz,   -- soft delete
  excluido_por      uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_solicitacoes_epi (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id          uuid REFERENCES lider_turnos(id),
  workspace_id      uuid NOT NULL,
  colaborador_id    uuid REFERENCES lider_colaboradores(id),
  colaborador_nome  text NOT NULL,
  epi_id            uuid REFERENCES lider_epis(id),
  epi_nome          text NOT NULL,
  quantidade        integer NOT NULL DEFAULT 1,
  motivo            text, -- novo | troca_danificado | troca_vencido
  foto_url          text,
  observacao        text,
  status            text DEFAULT 'pendente', -- pendente | aprovado | reprovado | entregue
  motivo_reprovacao text,
  solicitado_por    uuid REFERENCES auth.users(id),
  solicitado_em     timestamptz DEFAULT now(),
  aprovado_por      text,
  aprovado_em       timestamptz,
  excluido_em       timestamptz,   -- soft delete
  excluido_por      uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lider_solicitacoes_refeicao (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id          uuid REFERENCES lider_turnos(id),
  workspace_id      uuid NOT NULL,
  tipo              text NOT NULL, -- Almoço | Jantar | Café da manhã | Lanche
  local             text,         -- Base | Campo | Frente F07 | etc.
  quantidade        integer NOT NULL DEFAULT 1,
  data_necessaria   date,
  observacao        text,
  status            text NOT NULL DEFAULT 'pendente', -- pendente | aprovado | reprovado | entregue
  motivo_reprovacao text,
  solicitado_por    uuid REFERENCES auth.users(id),
  solicitado_em     timestamptz NOT NULL DEFAULT now(),
  aprovado_por      text,
  aprovado_em       timestamptz,
  excluido_em       timestamptz,   -- soft delete
  excluido_por      uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────────

ALTER TABLE lider_fazendas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_talhoes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_frentes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_equipes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_colaboradores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_maquinas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_implementos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_produtos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_epis                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_turnos                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_mao_obra                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_apontamentos_maquina       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_apontamentos_insumo        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_afericoes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_produtividade_equipamento  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_produtividade_equipe       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_avaliacoes_equipe          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_solicitacoes_insumo        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_solicitacoes_epi           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lider_solicitacoes_refeicao      ENABLE ROW LEVEL SECURITY;

-- Policies: usuários autenticados têm acesso total (refinar por workspace_id em produção)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'lider_fazendas','lider_talhoes','lider_frentes','lider_equipes',
    'lider_colaboradores','lider_maquinas','lider_implementos',
    'lider_produtos','lider_epis','lider_turnos','lider_mao_obra',
    'lider_apontamentos_maquina','lider_apontamentos_insumo',
    'lider_afericoes','lider_produtividade_equipamento',
    'lider_produtividade_equipe','lider_avaliacoes_equipe',
    'lider_solicitacoes_insumo','lider_solicitacoes_epi','lider_solicitacoes_refeicao'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE POLICY "lider_auth_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- ─── DADOS DE EXEMPLO (seed) ─────────────────────────────────

INSERT INTO lider_frentes (workspace_id, nome, codigo) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Frente 07',    'F07'),
  ('00000000-0000-0000-0000-000000000001', 'Frente 08',    'F08'),
  ('00000000-0000-0000-0000-000000000001', 'Frente Prêmio','FP')
ON CONFLICT DO NOTHING;

INSERT INTO lider_fazendas (workspace_id, nome, codigo) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Fazenda Boa Vista', 'FBV'),
  ('00000000-0000-0000-0000-000000000001', 'Fazenda Santa Cruz', 'FSC')
ON CONFLICT DO NOTHING;

INSERT INTO lider_produtos (workspace_id, nome, tipo, unidade) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Herbicida Premium', 'herbicida', 'L'),
  ('00000000-0000-0000-0000-000000000001', 'Inseticida Max', 'inseticida', 'L'),
  ('00000000-0000-0000-0000-000000000001', 'Diesel S10', 'combustivel', 'L'),
  ('00000000-0000-0000-0000-000000000001', 'Semente Soja RR', 'semente', 'sc')
ON CONFLICT DO NOTHING;

INSERT INTO lider_epis (workspace_id, nome, ca) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Luva de proteção', 'CA-12345'),
  ('00000000-0000-0000-0000-000000000001', 'Capacete', 'CA-23456'),
  ('00000000-0000-0000-0000-000000000001', 'Bota de segurança', 'CA-34567'),
  ('00000000-0000-0000-0000-000000000001', 'Óculos de proteção', 'CA-45678')
ON CONFLICT DO NOTHING;

INSERT INTO lider_maquinas (workspace_id, nome, modelo, codigo, tipo) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Trator John Deere', '6125J', 'TR-001', 'trator'),
  ('00000000-0000-0000-0000-000000000001', 'Pulverizador', '4000L Bar 24m', 'PV-001', 'pulverizador'),
  ('00000000-0000-0000-0000-000000000001', 'Colheitadeira', 'S680', 'CO-001', 'colheitadeira')
ON CONFLICT DO NOTHING;
