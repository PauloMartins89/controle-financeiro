-- Tabelas de cadastro: Funções, Líderes, Supervisores
CREATE TABLE IF NOT EXISTS refei_funcoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  owner_id     uuid,
  nome         text NOT NULL,
  ativo        boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE refei_funcoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "refei_funcoes_all" ON refei_funcoes;
CREATE POLICY "refei_funcoes_all" ON refei_funcoes FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS refei_lideres (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  owner_id     uuid,
  nome         text NOT NULL,
  ativo        boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE refei_lideres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "refei_lideres_all" ON refei_lideres;
CREATE POLICY "refei_lideres_all" ON refei_lideres FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS refei_supervisores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  owner_id     uuid,
  nome         text NOT NULL,
  ativo        boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE refei_supervisores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "refei_supervisores_all" ON refei_supervisores;
CREATE POLICY "refei_supervisores_all" ON refei_supervisores FOR ALL USING (true) WITH CHECK (true);

-- Adicionar FK columns em refei_colaboradores
ALTER TABLE refei_colaboradores
  ADD COLUMN IF NOT EXISTS funcao_id      uuid REFERENCES refei_funcoes(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lider_id       uuid REFERENCES refei_lideres(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_id  uuid REFERENCES refei_supervisores(id)  ON DELETE SET NULL;
