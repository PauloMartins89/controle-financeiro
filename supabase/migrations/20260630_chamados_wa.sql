-- ============================================================
-- Módulo: Gestão de Chamados por WhatsApp
-- Created: 2026-06-30
-- ============================================================

-- 1. Técnicos responsáveis --------------------------------------------------------
CREATE TABLE IF NOT EXISTS tecnicos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid,
  owner_id      uuid,
  nome          text NOT NULL,
  whatsapp      text,
  email         text,
  regiao        text,
  equipe        text,
  ativo         boolean NOT NULL DEFAULT true,
  observacoes   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Grupos monitorados ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_grupos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid,
  owner_id             uuid,
  zapi_group_id        text NOT NULL,
  nome_grupo           text NOT NULL,
  cliente              text,
  operacao             text,
  regiao               text,
  tecnico_id           uuid REFERENCES tecnicos(id) ON DELETE SET NULL,
  nivel_monitoramento  text NOT NULL DEFAULT 'medio'
                         CHECK (nivel_monitoramento IN ('baixo','medio','alto')),
  ativo                boolean NOT NULL DEFAULT true,
  observacoes          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_grupos_zapi_id
  ON whatsapp_grupos (workspace_id, zapi_group_id);

-- 3. Mensagens recebidas dos grupos ---------------------------------------------
CREATE TABLE IF NOT EXISTS mensagens_whatsapp_grupos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid,
  zapi_message_id     text UNIQUE,
  grupo_id            uuid REFERENCES whatsapp_grupos(id) ON DELETE CASCADE,
  remetente_nome      text,
  remetente_whatsapp  text,
  mensagem            text,
  tipo_mensagem       text NOT NULL DEFAULT 'text',
  data_mensagem       timestamptz,
  processada          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msg_grupo_remetente_data
  ON mensagens_whatsapp_grupos (grupo_id, remetente_whatsapp, data_mensagem DESC);

-- 4. Solicitações de Atendimento Técnico ----------------------------------------
CREATE TABLE IF NOT EXISTS solicitacoes_atendimento (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid,
  codigo                text UNIQUE NOT NULL,
  grupo_id              uuid REFERENCES whatsapp_grupos(id) ON DELETE SET NULL,
  tecnico_id            uuid REFERENCES tecnicos(id) ON DELETE SET NULL,
  solicitante_nome      text,
  solicitante_whatsapp  text,
  mensagem_original     text,
  resumo_ia             text,
  categoria             text,
  prioridade            text NOT NULL DEFAULT 'media'
                          CHECK (prioridade IN ('baixa','media','alta','critica')),
  status                text NOT NULL DEFAULT 'aberta'
                          CHECK (status IN (
                            'aberta','enviada_tecnico','em_atendimento',
                            'aguardando_informacao','concluida',
                            'descartada','erro_classificacao','triagem'
                          )),
  confianca_ia          numeric(5,4),
  motivo_classificacao  text,
  enviado_tecnico       boolean NOT NULL DEFAULT false,
  data_envio_tecnico    timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sat_workspace_status
  ON solicitacoes_atendimento (workspace_id, status, created_at DESC);

-- Sequence para código SAT-XXXXXX ------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS sat_codigo_seq START 1;

-- Função para gerar código ------------------------------------------------------
CREATE OR REPLACE FUNCTION next_sat_codigo()
RETURNS text LANGUAGE sql AS $$
  SELECT 'SAT-' || LPAD(nextval('sat_codigo_seq')::text, 6, '0');
$$;

-- 5. Logs de classificação da IA ------------------------------------------------
CREATE TABLE IF NOT EXISTS logs_classificacao_ia (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid,
  mensagem_id     uuid,
  grupo_id        uuid REFERENCES whatsapp_grupos(id) ON DELETE SET NULL,
  resultado       jsonb,
  confianca       numeric(5,4),
  motivo          text,
  payload_entrada jsonb,
  payload_saida   jsonb,
  virou_chamado   boolean NOT NULL DEFAULT false,
  eh_triagem      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_ia_workspace_created
  ON logs_classificacao_ia (workspace_id, created_at DESC);

-- 6. Notificações enviadas aos técnicos -----------------------------------------
CREATE TABLE IF NOT EXISTS notificacoes_tecnicos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id    uuid REFERENCES solicitacoes_atendimento(id) ON DELETE CASCADE,
  tecnico_id        uuid REFERENCES tecnicos(id) ON DELETE SET NULL,
  whatsapp_destino  text,
  mensagem_enviada  text,
  status_envio      text NOT NULL DEFAULT 'pendente'
                      CHECK (status_envio IN ('pendente','enviado','erro')),
  resposta_api      jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Trigger: atualiza updated_at automaticamente ─────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_tecnicos_updated_at
    BEFORE UPDATE ON tecnicos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_grupos_updated_at
    BEFORE UPDATE ON whatsapp_grupos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_sat_updated_at
    BEFORE UPDATE ON solicitacoes_atendimento
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RLS: habilita mas deixa policies permissivas (service_key bypassa) ────────
ALTER TABLE tecnicos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_grupos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_whatsapp_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_atendimento  ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_classificacao_ia     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes_tecnicos     ENABLE ROW LEVEL SECURITY;

-- Policies: service_role bypassa RLS; usuários autenticados veem só seu workspace
CREATE POLICY "tecnicos_workspace" ON tecnicos
  FOR ALL TO authenticated USING (
    owner_id = auth.uid() OR workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true
    )
  );

CREATE POLICY "grupos_workspace" ON whatsapp_grupos
  FOR ALL TO authenticated USING (
    owner_id = auth.uid() OR workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true
    )
  );

CREATE POLICY "mensagens_workspace" ON mensagens_whatsapp_grupos
  FOR ALL TO authenticated USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true
    )
  );

CREATE POLICY "sat_workspace" ON solicitacoes_atendimento
  FOR ALL TO authenticated USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true
    )
  );

CREATE POLICY "logs_workspace" ON logs_classificacao_ia
  FOR ALL TO authenticated USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true
    )
  );

CREATE POLICY "notif_workspace" ON notificacoes_tecnicos
  FOR ALL TO authenticated USING (
    tecnico_id IN (SELECT id FROM tecnicos WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true
    ))
  );
