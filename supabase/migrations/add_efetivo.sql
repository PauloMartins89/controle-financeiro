-- ═══════════════════════════════════════════════════════════════════
-- Cadastro Central de Efetivo
-- Cria funcoes_efetivo (papéis com flags) e efetivo (pessoas da empresa)
-- Adiciona colunas FK em tabelas existentes (additive — nada removido)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Funções / Papéis do Efetivo
--    Define defaults comportamentais: um "Supervisor" herda pode_aprovar=true, etc.
CREATE TABLE IF NOT EXISTS funcoes_efetivo (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          text NOT NULL,
  owner_id              uuid,
  nome                  text NOT NULL,
  descricao             text,
  usa_whatsapp          boolean DEFAULT false,
  usa_email             boolean DEFAULT false,
  pode_aprovar          boolean DEFAULT false,
  pode_solicitar        boolean DEFAULT false,
  recebe_notificacoes   boolean DEFAULT false,
  ativo                 boolean DEFAULT true,
  criado_em             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funcoes_efetivo_workspace
  ON funcoes_efetivo (workspace_id);

ALTER TABLE funcoes_efetivo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "funcoes_efetivo_all" ON funcoes_efetivo;
CREATE POLICY "funcoes_efetivo_all" ON funcoes_efetivo
  FOR ALL USING (true) WITH CHECK (true);


-- 2. Cadastro de Efetivo (colaboradores / motoristas / supervisores / aprovadores)
CREATE TABLE IF NOT EXISTS efetivo (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          text NOT NULL,
  owner_id              uuid,
  nome                  text NOT NULL,
  cpf                   text,
  matricula             text,
  cargo                 text,
  celular               text,
  email                 text,
  funcao_id             uuid REFERENCES funcoes_efetivo(id) ON DELETE SET NULL,
  equipe_id             uuid,               -- FK lógica para refei_equipes (sem FK hard: refei_equipes usa uuid workspace)
  -- flags individuais — sobrescrevem os defaults da função quando preenchidos
  usa_whatsapp          boolean DEFAULT false,
  usa_email             boolean DEFAULT false,
  pode_aprovar          boolean DEFAULT false,
  pode_solicitar        boolean DEFAULT false,
  recebe_notificacoes   boolean DEFAULT false,
  ativo                 boolean DEFAULT true,
  criado_em             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_efetivo_workspace
  ON efetivo (workspace_id);
CREATE INDEX IF NOT EXISTS idx_efetivo_celular
  ON efetivo (celular);
CREATE INDEX IF NOT EXISTS idx_efetivo_funcao
  ON efetivo (funcao_id);
CREATE INDEX IF NOT EXISTS idx_efetivo_equipe
  ON efetivo (equipe_id);

ALTER TABLE efetivo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "efetivo_all" ON efetivo;
CREATE POLICY "efetivo_all" ON efetivo
  FOR ALL USING (true) WITH CHECK (true);


-- 3. FK columns em tabelas existentes (additive — colunas legadas mantidas)
-- refei_equipes: lider e supervisor passam a apontar para efetivo
ALTER TABLE refei_equipes
  ADD COLUMN IF NOT EXISTS lider_efetivo_id     uuid REFERENCES efetivo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_efetivo_id uuid REFERENCES efetivo(id) ON DELETE SET NULL;

-- status_notificacoes: destinatário pode ser um registro de efetivo
ALTER TABLE status_notificacoes
  ADD COLUMN IF NOT EXISTS efetivo_id uuid REFERENCES efetivo(id) ON DELETE SET NULL;
