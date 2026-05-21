-- ════════════════════════════════════════════════════════════
-- SmartPro Flow Center — Migration Fase 0
-- Motor de processos configurável
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. DEFINIÇÃO DO PROCESSO
-- Ex: "Solicitação de Refeição", "Compra Direta"
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_definitions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  nome             text NOT NULL,
  descricao        text,
  modulo           text NOT NULL,
  -- modulo: 'refeicoes' | 'compras' | 'lancamentos' | 'financeiro' | 'documentos'
  tipo_entidade    text NOT NULL,
  -- tipo_entidade: nome da tabela de negócio vinculada
  -- ex: 'refei_solicitacoes' | 'solicitacoes_compra' | 'lancamentos'
  ativo            boolean DEFAULT true,
  is_template      boolean DEFAULT false,
  versao_atual_id  uuid,   -- FK para flow_versions (adicionada após criar a tabela)
  criado_por       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 2. VERSÕES IMUTÁVEIS DO PROCESSO
-- Cada publicação gera uma versão nova.
-- Instâncias antigas continuam na versão em que nasceram.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id   uuid NOT NULL REFERENCES flow_definitions(id) ON DELETE CASCADE,
  versao          int NOT NULL DEFAULT 1,
  descricao       text,
  publicado_em    timestamptz DEFAULT now(),
  publicado_por   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_current      boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (definition_id, versao)
);

-- FK reversa: flow_definitions.versao_atual_id → flow_versions.id
ALTER TABLE flow_definitions
  ADD CONSTRAINT fk_flow_def_versao_atual
  FOREIGN KEY (versao_atual_id) REFERENCES flow_versions(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ─────────────────────────────────────────────
-- 3. ETAPAS DO PROCESSO (nós do grafo)
-- Ex: "Aguardando Aprovação", "Em Cotação", "Finalizado"
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_steps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      uuid NOT NULL REFERENCES flow_versions(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  descricao       text,
  ordem           int NOT NULL DEFAULT 0,
  tipo            text NOT NULL DEFAULT 'normal',
  -- tipo: inicio | normal | aprovacao | paralelo | fim | cancelado
  status_valor    text NOT NULL,
  -- valor que será gravado no campo .status da entidade de negócio
  -- ex: 'pendente', 'aprovado', 'em_cotacao', 'finalizado'
  is_initial      boolean DEFAULT false,
  is_final        boolean DEFAULT false,
  config          jsonb DEFAULT '{}',
  -- config: {
  --   campos_obrigatorios: ["campo1","campo2"],
  --   anexos_obrigatorios: ["nf","boleto"],
  --   cor: "#10b981",
  --   icone: "check"
  -- }
  created_at      timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 4. AÇÕES DISPONÍVEIS POR ETAPA
-- Ex: "Aprovar", "Reprovar", "Devolver para ajuste"
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_actions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id               uuid NOT NULL REFERENCES flow_steps(id) ON DELETE CASCADE,
  nome                  text NOT NULL,   -- chave interna: 'aprovar', 'reprovar'
  label                 text NOT NULL,   -- exibição: 'Aprovar', 'Reprovar'
  tipo                  text NOT NULL DEFAULT 'personalizado',
  -- tipo: aprovar | reprovar | devolver | avancar | cancelar | comentar | personalizado
  campos_obrigatorios   jsonb DEFAULT '[]',
  -- ex: ["motivo"] para reprovar; ["valor_aprovado"] para aprovar
  permissao_modulo      text,            -- ex: 'compras'
  permissao_acao        text,            -- ex: 'aprovar'
  requer_confirmacao    boolean DEFAULT false,
  config                jsonb DEFAULT '{}',
  created_at            timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 5. TRANSIÇÕES ENTRE ETAPAS (arestas do grafo)
-- Define: ao executar ação X na etapa A, ir para etapa B SE condição for verdadeira
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_transitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id      uuid NOT NULL REFERENCES flow_versions(id) ON DELETE CASCADE,
  step_origem_id  uuid NOT NULL REFERENCES flow_steps(id) ON DELETE CASCADE,
  step_destino_id uuid NOT NULL REFERENCES flow_steps(id) ON DELETE CASCADE,
  acao_id         uuid REFERENCES flow_actions(id) ON DELETE CASCADE,
  -- condicao: regra JSONb avaliada pelo motor contra dados_contexto da instância
  -- null = sempre executar (sem condição)
  -- Exemplos:
  --   { "campo": "valor_total", "operador": ">", "valor": 5000 }
  --   { "AND": [ {"campo":"...","operador":"...","valor":...}, {...} ] }
  --   { "OR":  [ {...}, {...} ] }
  condicao        jsonb DEFAULT NULL,
  ordem           int DEFAULT 0,
  label           text,
  created_at      timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 6. RESPONSÁVEIS DINÂMICOS POR ETAPA
-- Quem recebe a tarefa ao entrar nesta etapa
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_responsibles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id           uuid NOT NULL REFERENCES flow_steps(id) ON DELETE CASCADE,
  tipo              text NOT NULL,
  -- tipos:
  --   solicitante         → iniciador da instância
  --   usuario_fixo        → config.usuario_id
  --   perfil              → config.perfil_id (workspace_members)
  --   lider_equipe        → campo da entidade (ex: refei_equipes.lider_*)
  --   supervisor_equipe   → campo da entidade (ex: refei_equipes.supervisor_*)
  --   gestor_cdc          → configuracoes WHERE chave = 'gestor_cdc_{cdc}'
  --   comprador           → configuracoes WHERE chave = 'comprador_responsavel'
  --   aprovador_por_valor → config.faixas: [{ate: 5000, usuario_id}, ...]
  --   aprovador_por_cat   → config.categorias: {"frota": uuid, "ti": uuid}
  config            jsonb DEFAULT '{}',
  prioridade        int DEFAULT 0,   -- usado quando há múltiplos responsáveis
  created_at        timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 7. REGRAS DE SLA POR ETAPA
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_sla_rules (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id                   uuid NOT NULL REFERENCES flow_steps(id) ON DELETE CASCADE,
  prazo_horas               int NOT NULL DEFAULT 24,
  tipo_calendario           text DEFAULT 'corrido',
  -- tipo_calendario: corrido | util | horario_comercial
  acao_no_vencimento        text DEFAULT 'lembrete',
  -- acao_no_vencimento: lembrete | escalar | bloquear | notificar
  escalacao_responsavel_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  config                    jsonb DEFAULT '{}',
  created_at                timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 8. TEMPLATES DE NOTIFICAÇÃO POR ETAPA/AÇÃO
-- Suporta variáveis: {nome_responsavel}, {valor_total}, {link_acao}, etc.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id             uuid REFERENCES flow_steps(id) ON DELETE CASCADE,
  acao_id             uuid REFERENCES flow_actions(id) ON DELETE CASCADE,
  evento              text NOT NULL,
  -- evento: entrada_etapa | saida_etapa | acao_executada | sla_vencendo | sla_vencido
  canal               text NOT NULL DEFAULT 'whatsapp',
  -- canal: whatsapp | email | interno | push
  destinatario_tipo   text NOT NULL DEFAULT 'responsavel_atual',
  -- destinatario_tipo: responsavel_atual | solicitante | fixo | perfil
  destinatario_config jsonb DEFAULT '{}',
  template_texto      text NOT NULL,
  ativo               boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- RUNTIME — tabelas de execução (instâncias em andamento)
-- ════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 9. INSTÂNCIAS DO PROCESSO (runtime)
-- Uma instância = um processo real em andamento
-- Ex: "Solicitação de Refeição #1452"
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_instances (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  definition_id    uuid NOT NULL REFERENCES flow_definitions(id) ON DELETE RESTRICT,
  version_id       uuid NOT NULL REFERENCES flow_versions(id) ON DELETE RESTRICT,
  -- Referência à entidade de negócio (não FK para ser genérico)
  entidade_tipo    text NOT NULL,   -- 'refei_solicitacoes', 'solicitacoes_compra', etc.
  entidade_id      uuid NOT NULL,   -- id da linha na tabela de negócio
  current_step_id  uuid REFERENCES flow_steps(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'ativo',
  -- status: ativo | concluido | cancelado | suspenso
  iniciado_por     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  iniciado_em      timestamptz DEFAULT now(),
  concluido_em     timestamptz,
  -- Contexto congelado para avaliação de regras (snapshot dos dados relevantes)
  -- Ex: { "valor_total": 7000, "categoria": "frota", "fornecedor_novo": true }
  dados_contexto   jsonb DEFAULT '{}',
  sla_vence_em     timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS flow_instances_entidade_uidx
  ON flow_instances(entidade_tipo, entidade_id)
  WHERE status = 'ativo';

-- ─────────────────────────────────────────────
-- 10. TAREFAS PENDENTES (inbox do responsável)
-- O que está esperando ação de quem
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id       uuid NOT NULL REFERENCES flow_instances(id) ON DELETE CASCADE,
  step_id           uuid NOT NULL REFERENCES flow_steps(id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  responsavel_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responsavel_tipo  text,
  responsavel_nome  text,
  titulo            text NOT NULL,
  descricao         text,
  status            text NOT NULL DEFAULT 'pendente',
  -- status: pendente | em_andamento | concluida | expirada | cancelada
  prioridade        text DEFAULT 'normal',
  -- prioridade: baixa | normal | alta | urgente
  sla_vence_em      timestamptz,
  concluida_em      timestamptz,
  acao_executada    text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 11. HISTÓRICO IMUTÁVEL (auditoria completa)
-- NUNCA atualizar ou deletar linhas desta tabela
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_history (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id          uuid NOT NULL REFERENCES flow_instances(id) ON DELETE CASCADE,
  step_id              uuid REFERENCES flow_steps(id) ON DELETE SET NULL,
  workspace_id         uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  acao_id              uuid REFERENCES flow_actions(id) ON DELETE SET NULL,
  acao_nome            text,
  executado_por_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  executado_por_nome   text,
  origem               text DEFAULT 'humano',
  -- origem: humano | ia | whatsapp | email | sistema | webhook | cron
  step_origem_nome     text,
  step_destino_nome    text,
  status_antes         text,
  status_depois        text,
  dados                jsonb DEFAULT '{}',
  -- dados: campos preenchidos na ação (motivo, valor_aprovado, observacao, etc.)
  ip                   text,
  user_agent           text,
  created_at           timestamptz DEFAULT now()
  -- ⚠️  IMUTÁVEL: sem updated_at, sem trigger de update, sem policy de DELETE/UPDATE
);

-- ─────────────────────────────────────────────
-- 12. TEMPLATES DE PROCESSOS PRONTOS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  descricao   text,
  modulo      text,
  snapshot    jsonb NOT NULL DEFAULT '{}',
  -- snapshot = cópia completa do processo (steps, actions, transitions, responsibles)
  is_sistema  boolean DEFAULT false, -- true = template da plataforma; false = do workspace
  criado_por  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- TRIGGERS updated_at
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION flow_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS flow_definitions_updated_at ON flow_definitions;
CREATE TRIGGER flow_definitions_updated_at
  BEFORE UPDATE ON flow_definitions
  FOR EACH ROW EXECUTE FUNCTION flow_set_updated_at();

DROP TRIGGER IF EXISTS flow_instances_updated_at ON flow_instances;
CREATE TRIGGER flow_instances_updated_at
  BEFORE UPDATE ON flow_instances
  FOR EACH ROW EXECUTE FUNCTION flow_set_updated_at();

DROP TRIGGER IF EXISTS flow_tasks_updated_at ON flow_tasks;
CREATE TRIGGER flow_tasks_updated_at
  BEFORE UPDATE ON flow_tasks
  FOR EACH ROW EXECUTE FUNCTION flow_set_updated_at();

-- ════════════════════════════════════════════════════════════
-- ÍNDICES DE PERFORMANCE
-- ════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_flow_def_workspace      ON flow_definitions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_flow_def_modulo         ON flow_definitions(modulo);
CREATE INDEX IF NOT EXISTS idx_flow_ver_definition     ON flow_versions(definition_id);
CREATE INDEX IF NOT EXISTS idx_flow_steps_version      ON flow_steps(version_id);
CREATE INDEX IF NOT EXISTS idx_flow_steps_status       ON flow_steps(status_valor);
CREATE INDEX IF NOT EXISTS idx_flow_actions_step       ON flow_actions(step_id);
CREATE INDEX IF NOT EXISTS idx_flow_trans_version      ON flow_transitions(version_id);
CREATE INDEX IF NOT EXISTS idx_flow_trans_origem       ON flow_transitions(step_origem_id);
CREATE INDEX IF NOT EXISTS idx_flow_resp_step          ON flow_responsibles(step_id);
CREATE INDEX IF NOT EXISTS idx_flow_inst_workspace     ON flow_instances(workspace_id);
CREATE INDEX IF NOT EXISTS idx_flow_inst_entidade      ON flow_instances(entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_flow_inst_status        ON flow_instances(status);
CREATE INDEX IF NOT EXISTS idx_flow_inst_step          ON flow_instances(current_step_id);
CREATE INDEX IF NOT EXISTS idx_flow_tasks_workspace    ON flow_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_flow_tasks_responsavel  ON flow_tasks(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_flow_tasks_status       ON flow_tasks(status);
CREATE INDEX IF NOT EXISTS idx_flow_tasks_instance     ON flow_tasks(instance_id);
CREATE INDEX IF NOT EXISTS idx_flow_tasks_sla          ON flow_tasks(sla_vence_em);
CREATE INDEX IF NOT EXISTS idx_flow_hist_instance      ON flow_history(instance_id);
CREATE INDEX IF NOT EXISTS idx_flow_hist_workspace     ON flow_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_flow_hist_created       ON flow_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_hist_executado_por ON flow_history(executado_por_id);

-- ════════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- ════════════════════════════════════════════════════════════

ALTER TABLE flow_definitions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_steps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_actions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_transitions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_responsibles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_sla_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_instances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_templates     ENABLE ROW LEVEL SECURITY;

-- Membros do workspace veem as definições da própria empresa + templates do sistema
DROP POLICY IF EXISTS "flow_definitions_policy"  ON flow_definitions;
CREATE POLICY "flow_definitions_policy" ON flow_definitions
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "flow_versions_policy"  ON flow_versions;
CREATE POLICY "flow_versions_policy" ON flow_versions
  FOR ALL USING (
    definition_id IN (
      SELECT id FROM flow_definitions WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
    OR is_platform_admin()
  );

-- Steps, actions, transitions, responsibles, sla, notifications: via versão → definição
DROP POLICY IF EXISTS "flow_steps_policy"  ON flow_steps;
CREATE POLICY "flow_steps_policy" ON flow_steps
  FOR ALL USING (
    version_id IN (
      SELECT fv.id FROM flow_versions fv
      JOIN flow_definitions fd ON fd.id = fv.definition_id
      WHERE fd.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    )
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "flow_actions_policy"  ON flow_actions;
CREATE POLICY "flow_actions_policy" ON flow_actions
  FOR ALL USING (
    step_id IN (
      SELECT fs.id FROM flow_steps fs
      JOIN flow_versions fv ON fv.id = fs.version_id
      JOIN flow_definitions fd ON fd.id = fv.definition_id
      WHERE fd.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    )
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "flow_transitions_policy"  ON flow_transitions;
CREATE POLICY "flow_transitions_policy" ON flow_transitions
  FOR ALL USING (
    version_id IN (
      SELECT fv.id FROM flow_versions fv
      JOIN flow_definitions fd ON fd.id = fv.definition_id
      WHERE fd.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    )
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "flow_responsibles_policy"  ON flow_responsibles;
CREATE POLICY "flow_responsibles_policy" ON flow_responsibles
  FOR ALL USING (
    step_id IN (
      SELECT fs.id FROM flow_steps fs
      JOIN flow_versions fv ON fv.id = fs.version_id
      JOIN flow_definitions fd ON fd.id = fv.definition_id
      WHERE fd.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    )
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "flow_sla_rules_policy"  ON flow_sla_rules;
CREATE POLICY "flow_sla_rules_policy" ON flow_sla_rules
  FOR ALL USING (
    step_id IN (
      SELECT fs.id FROM flow_steps fs
      JOIN flow_versions fv ON fv.id = fs.version_id
      JOIN flow_definitions fd ON fd.id = fv.definition_id
      WHERE fd.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    )
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "flow_notifications_policy"  ON flow_notifications;
CREATE POLICY "flow_notifications_policy" ON flow_notifications
  FOR ALL USING (
    step_id IN (
      SELECT fs.id FROM flow_steps fs
      JOIN flow_versions fv ON fv.id = fs.version_id
      JOIN flow_definitions fd ON fd.id = fv.definition_id
      WHERE fd.workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    )
    OR is_platform_admin()
  );

-- Instâncias: membros do workspace veem as instâncias da própria empresa
DROP POLICY IF EXISTS "flow_instances_policy"  ON flow_instances;
CREATE POLICY "flow_instances_policy" ON flow_instances
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR is_platform_admin()
  );

-- Tarefas: usuário vê apenas suas próprias tarefas (+ admin vê todas do workspace)
DROP POLICY IF EXISTS "flow_tasks_own_policy"  ON flow_tasks;
CREATE POLICY "flow_tasks_own_policy" ON flow_tasks
  FOR ALL USING (
    responsavel_id = auth.uid()
    OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND perfil_id IS NULL)
    OR is_platform_admin()
  );

-- Histórico: membros do workspace veem o histórico (somente leitura para não-admin)
DROP POLICY IF EXISTS "flow_history_read_policy"  ON flow_history;
CREATE POLICY "flow_history_read_policy" ON flow_history
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR is_platform_admin()
  );

-- ⚠️ Histórico: apenas INSERT é permitido — nunca UPDATE ou DELETE
DROP POLICY IF EXISTS "flow_history_insert_policy"  ON flow_history;
CREATE POLICY "flow_history_insert_policy" ON flow_history
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    OR is_platform_admin()
  );

-- Templates: qualquer usuário autenticado vê templates do sistema; workspace vê os próprios
DROP POLICY IF EXISTS "flow_templates_policy"  ON flow_templates;
CREATE POLICY "flow_templates_policy" ON flow_templates
  FOR SELECT USING (is_sistema = true OR criado_por = auth.uid() OR is_platform_admin());

-- ════════════════════════════════════════════════════════════
-- FEATURE FLAGS (chaves de ativação por módulo)
-- Insere chaves na tabela configuracoes para controlar ativação do motor
-- ════════════════════════════════════════════════════════════
-- Executar apenas se a tabela configuracoes existir no workspace desejado
-- Substitua o workspace_id pelo UUID real antes de executar

-- INSERT INTO configuracoes (workspace_id, chave, valor) VALUES
--   ('<workspace_id>', 'flow_engine_refeicoes',   'false'),
--   ('<workspace_id>', 'flow_engine_compras',      'false'),
--   ('<workspace_id>', 'flow_engine_lancamentos',  'false')
-- ON CONFLICT (workspace_id, chave) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- FIM DA MIGRATION
-- Próximo passo: popular o processo de Refeições manualmente
-- ════════════════════════════════════════════════════════════
