-- MÓDULO REFEIÇÕES — SmartProd
-- Execute no Supabase SQL Editor

-- 1. Restaurantes
CREATE TABLE IF NOT EXISTS refei_restaurantes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid,
  owner_id        uuid,
  nome            text NOT NULL,
  cnpj            text,
  numero_pedido   text,
  valor_refeicao  numeric(10,2) DEFAULT 0,
  valor_cafe      numeric(10,2) DEFAULT 0,
  telefone_wa     text,
  ativo           boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- 2. Equipes
CREATE TABLE IF NOT EXISTS refei_equipes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid,
  owner_id             uuid,
  cdc                  text,
  nome                 text NOT NULL,
  lider_nome           text,
  lider_telefone       text,
  supervisor_nome      text,
  supervisor_telefone  text,
  ativo                boolean DEFAULT true,
  created_at           timestamptz DEFAULT now()
);

-- 3. Colaboradores da equipe
CREATE TABLE IF NOT EXISTS refei_colaboradores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id   uuid REFERENCES refei_equipes(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  cargo       text,
  ativo       boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- 4. Solicitações de refeição
CREATE TABLE IF NOT EXISTS refei_solicitacoes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid,
  owner_id            uuid,
  equipe_id           uuid REFERENCES refei_equipes(id),
  restaurante_id      uuid REFERENCES refei_restaurantes(id),
  data_refeicao       date,
  numero_pedido       text,
  lider_nome          text,
  lider_telefone      text,
  supervisor_telefone text,
  status              text DEFAULT 'rascunho',
  motivo_reprovacao   text,
  total_refeicoes     int DEFAULT 0,
  total_cafes         int DEFAULT 0,
  valor_refeicao      numeric(10,2) DEFAULT 0,
  valor_cafe          numeric(10,2) DEFAULT 0,
  valor_total         numeric(10,2) DEFAULT 0,
  token_lider         uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  token_aprovacao     uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  observacoes         text,
  criado_em           timestamptz DEFAULT now(),
  aprovado_em         timestamptz,
  entregue_em         timestamptz
);

-- 5. Itens por colaborador
CREATE TABLE IF NOT EXISTS refei_itens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id   uuid REFERENCES refei_solicitacoes(id) ON DELETE CASCADE,
  colaborador_id   uuid,
  colaborador_nome text NOT NULL,
  refeicao         boolean DEFAULT false,
  cafe             boolean DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

-- RLS (acesso público por token UUID)
ALTER TABLE refei_restaurantes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE refei_equipes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE refei_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE refei_solicitacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE refei_itens         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refei_restaurantes_all"  ON refei_restaurantes;
DROP POLICY IF EXISTS "refei_equipes_all"       ON refei_equipes;
DROP POLICY IF EXISTS "refei_colaboradores_all" ON refei_colaboradores;
DROP POLICY IF EXISTS "refei_solicitacoes_all"  ON refei_solicitacoes;
DROP POLICY IF EXISTS "refei_itens_all"         ON refei_itens;

CREATE POLICY "refei_restaurantes_all"  ON refei_restaurantes  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "refei_equipes_all"       ON refei_equipes       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "refei_colaboradores_all" ON refei_colaboradores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "refei_solicitacoes_all"  ON refei_solicitacoes  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "refei_itens_all"         ON refei_itens         FOR ALL USING (true) WITH CHECK (true);
