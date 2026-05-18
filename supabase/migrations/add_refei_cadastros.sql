-- Centros de Custo
CREATE TABLE IF NOT EXISTS refei_centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  owner_id uuid,
  codigo text,
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE refei_centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON refei_centros_custo USING (true) WITH CHECK (true);

-- Regionais
CREATE TABLE IF NOT EXISTS refei_regionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  owner_id uuid,
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE refei_regionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON refei_regionais USING (true) WITH CHECK (true);

-- Tabela de Precos
CREATE TABLE IF NOT EXISTS refei_tabela_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  owner_id uuid,
  restaurante_id uuid REFERENCES refei_restaurantes(id) ON DELETE CASCADE,
  vigencia_inicio date,
  vigencia_fim date,
  valor_refeicao numeric(10,2) DEFAULT 0,
  valor_cafe numeric(10,2) DEFAULT 0,
  ativo boolean DEFAULT true,
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE refei_tabela_precos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON refei_tabela_precos USING (true) WITH CHECK (true);

-- Parametros (single-row por workspace)
CREATE TABLE IF NOT EXISTS refei_parametros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text UNIQUE NOT NULL,
  antecedencia_horas integer DEFAULT 2,
  teto_por_equipe integer,
  aprovacao_obrigatoria boolean DEFAULT true,
  permite_refeicao boolean DEFAULT true,
  permite_cafe boolean DEFAULT true,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);
ALTER TABLE refei_parametros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON refei_parametros USING (true) WITH CHECK (true);

-- Fechamentos
CREATE TABLE IF NOT EXISTS refei_fechamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  owner_id uuid,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  status text DEFAULT 'aberto',
  total_solicitacoes integer DEFAULT 0,
  total_refeicoes integer DEFAULT 0,
  total_cafes integer DEFAULT 0,
  total_valor numeric(12,2) DEFAULT 0,
  gerado_em timestamptz DEFAULT now(),
  fechado_em timestamptz
);
ALTER TABLE refei_fechamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON refei_fechamentos USING (true) WITH CHECK (true);
