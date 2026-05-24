-- ════════════════════════════════════════════════════════════
-- Módulo de Manutenção
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

-- 1. Equipamentos
CREATE TABLE IF NOT EXISTS manut_equipamentos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  nome             text NOT NULL,
  codigo           text,
  tipo             text,             -- maquina | veiculo | instalacao | eletrico | outros
  modelo           text,
  fabricante       text,
  numero_serie     text,
  ano              int,
  horimetro_atual  numeric(10,1),
  lider_maquina_id uuid,              -- vínculo opcional com lider_maquinas
  ativo            boolean NOT NULL DEFAULT true,
  observacoes      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 2. Técnicos / Equipe de Manutenção
CREATE TABLE IF NOT EXISTS manut_tecnicos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  nome             text NOT NULL,
  especialidade    text,
  telefone         text,
  email            text,
  ativo            boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 3. Planos de Manutenção Preventiva
CREATE TABLE IF NOT EXISTS manut_planos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL,
  equipamento_id   uuid REFERENCES manut_equipamentos(id) ON DELETE SET NULL,
  equipamento_nome text,
  titulo           text NOT NULL,
  descricao        text,
  periodicidade    text NOT NULL,    -- diaria | semanal | quinzenal | mensal | trimestral | semestral | anual
  intervalo_horas  int,              -- alternativo: execução por horas (ex: a cada 250h)
  ultima_execucao  date,
  proxima_data     date,
  ativo            boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 4. Ordens de Serviço
CREATE TABLE IF NOT EXISTS manut_os (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL,
  numero               text,          -- ex: OS-2026-000001 (gerado pela aplicação)
  tipo                 text NOT NULL DEFAULT 'corretiva',  -- corretiva | preventiva | preditiva | melhoria
  prioridade           text NOT NULL DEFAULT 'media',      -- critica | alta | media | baixa
  status               text NOT NULL DEFAULT 'aberta',     -- aberta | em_andamento | aguardando_peca | concluida | cancelada
  equipamento_id       uuid REFERENCES manut_equipamentos(id) ON DELETE SET NULL,
  equipamento_nome     text,
  plano_id             uuid REFERENCES manut_planos(id) ON DELETE SET NULL,
  tecnico_id           uuid REFERENCES manut_tecnicos(id) ON DELETE SET NULL,
  tecnico_nome         text,
  solicitante          text,
  titulo               text NOT NULL,
  descricao            text,
  causa_raiz           text,
  resolucao            text,
  observacoes          text,
  horimetro_abertura   numeric(10,1),
  horimetro_fechamento numeric(10,1),
  data_abertura        date NOT NULL DEFAULT current_date,
  data_prevista        date,
  data_inicio          timestamptz,
  data_conclusao       timestamptz,
  tempo_parado_h       numeric(6,2),
  custo_total          numeric(12,2),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 5. Itens / Peças usadas na OS
CREATE TABLE IF NOT EXISTS manut_os_itens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id       uuid NOT NULL REFERENCES manut_os(id) ON DELETE CASCADE,
  descricao   text NOT NULL,
  quantidade  numeric(10,3) DEFAULT 1,
  unidade     text DEFAULT 'un',
  custo_unit  numeric(12,2),
  custo_total numeric(12,2),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Triggers de updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION manut_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS manut_equip_updated ON manut_equipamentos;
CREATE TRIGGER manut_equip_updated
  BEFORE UPDATE ON manut_equipamentos
  FOR EACH ROW EXECUTE FUNCTION manut_set_updated_at();

DROP TRIGGER IF EXISTS manut_planos_updated ON manut_planos;
CREATE TRIGGER manut_planos_updated
  BEFORE UPDATE ON manut_planos
  FOR EACH ROW EXECUTE FUNCTION manut_set_updated_at();

DROP TRIGGER IF EXISTS manut_os_updated ON manut_os;
CREATE TRIGGER manut_os_updated
  BEFORE UPDATE ON manut_os
  FOR EACH ROW EXECUTE FUNCTION manut_set_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE manut_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE manut_tecnicos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE manut_planos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE manut_os           ENABLE ROW LEVEL SECURITY;
ALTER TABLE manut_os_itens     ENABLE ROW LEVEL SECURITY;

-- Políticas: leitura/escrita para membros autenticados do workspace
-- (reutiliza o padrão das outras tabelas — acesso por workspace_id via workspace_members)

CREATE POLICY manut_equip_all   ON manut_equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY manut_tecnico_all ON manut_tecnicos     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY manut_planos_all  ON manut_planos       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY manut_os_all      ON manut_os           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY manut_os_itens_all ON manut_os_itens    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_manut_equip_ws   ON manut_equipamentos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_manut_tec_ws     ON manut_tecnicos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_manut_planos_ws  ON manut_planos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_manut_os_ws      ON manut_os(workspace_id);
CREATE INDEX IF NOT EXISTS idx_manut_os_status  ON manut_os(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_manut_os_equip   ON manut_os(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_manut_itens_os   ON manut_os_itens(os_id);
