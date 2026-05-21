-- ════════════════════════════════════════════════════════════
-- SmartPro Flow Center — Fase 1: Multicanal (E-mail + Webhook)
-- Adiciona suporte a e-mail, tokens de ação e configuração de canais
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. TOKENS DE AÇÃO SEGUROS
--    Links únicos enviados por e-mail:
--    /api/flow-action?token=xxx&acao=aprovar
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flow_action_tokens (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token             text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  instance_id       uuid        NOT NULL REFERENCES flow_instances(id) ON DELETE CASCADE,
  step_id           uuid        NOT NULL REFERENCES flow_steps(id)     ON DELETE CASCADE,
  acao_id           uuid        NOT NULL REFERENCES flow_actions(id)   ON DELETE CASCADE,
  workspace_id      uuid        NOT NULL REFERENCES workspaces(id)     ON DELETE CASCADE,
  -- Quem deve usar este token
  participante_ref  text,
  -- ex: 'p1' | 'p2' | 'supervisor@empresa.com' | 'responsavel_externo'
  -- Quais ações este token autoriza (separadas por vírgula)
  acao_permitida    text        NOT NULL,
  -- ex: 'aprovar' | 'reprovar' | 'confirmar' | 'corrigir' | 'aprovar,reprovar'
  expira_em         timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  uso_unico         boolean     DEFAULT true,
  usado_em          timestamptz,
  usado_origem      text,
  -- usado_origem: email_link | whatsapp_link | painel | api
  status            text        NOT NULL DEFAULT 'pendente',
  -- status: pendente | usado | expirado | cancelado
  dados_extras      jsonb       DEFAULT '{}',
  -- dados_extras: { descricao, processo, solicitante, valor } para exibir na página do link
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fat_token      ON flow_action_tokens(token);
CREATE INDEX IF NOT EXISTS idx_fat_instance   ON flow_action_tokens(instance_id);
CREATE INDEX IF NOT EXISTS idx_fat_status     ON flow_action_tokens(status);
CREATE INDEX IF NOT EXISTS idx_fat_expira     ON flow_action_tokens(expira_em) WHERE status = 'pendente';

-- ─────────────────────────────────────────────
-- 2. ESTENDER flow_notifications COM CAMPOS DE E-MAIL E WEBHOOK
--    Adições não-destrutivas: apenas ADD COLUMN IF NOT EXISTS
-- ─────────────────────────────────────────────

-- Campos de e-mail
ALTER TABLE flow_notifications
  ADD COLUMN IF NOT EXISTS email_to              text,
  -- Destinatário principal (pode ser {email_responsavel}, {email_solicitante} ou fixo)
  ADD COLUMN IF NOT EXISTS email_cc              text,
  ADD COLUMN IF NOT EXISTS email_bcc             text,
  ADD COLUMN IF NOT EXISTS email_subject         text,
  -- Suporta variáveis: "Aprovação necessária: {processo_nome} #{cod}"
  ADD COLUMN IF NOT EXISTS email_body_html       text,
  -- HTML completo do e-mail. Suporta variáveis {nome_responsavel}, {link_aprovar}, {link_reprovar}
  ADD COLUMN IF NOT EXISTS email_tipo_acao       text DEFAULT 'notificacao',
  -- email_tipo_acao:
  --   notificacao    → apenas informa, sem ação esperada
  --   aprovacao      → espera aprovação/reprovação
  --   confirmacao    → espera confirmação de recebimento
  --   resumo         → resumo periódico do status
  --   correcao       → solicita correção ao solicitante
  --   cobranca       → lembrete de resposta pendente
  --   escalonamento  → notifica escalador quando SLA vence
  ADD COLUMN IF NOT EXISTS email_reply_keywords  text[],
  -- Palavras-chave aceitas em resposta: ARRAY['aprovado','de acordo','ok','confirmo']
  ADD COLUMN IF NOT EXISTS email_gerar_token     boolean DEFAULT false,
  -- Se true: gerar flow_action_token ao enviar este e-mail
  ADD COLUMN IF NOT EXISTS email_expirar_horas   int     DEFAULT 168,
  -- Validade do token gerado (padrão: 7 dias = 168h)

-- Campos de webhook/API
  ADD COLUMN IF NOT EXISTS webhook_url           text,
  ADD COLUMN IF NOT EXISTS webhook_method        text    DEFAULT 'POST',
  -- webhook_method: GET | POST | PUT | PATCH
  ADD COLUMN IF NOT EXISTS webhook_payload       jsonb   DEFAULT '{}',
  -- Payload enviado. Suporta variáveis via template
  ADD COLUMN IF NOT EXISTS webhook_headers       jsonb   DEFAULT '{}';
  -- Headers HTTP adicionais: { "Authorization": "Bearer {api_key}" }

-- ─────────────────────────────────────────────
-- 3. ESTENDER flow_responsibles COM DADOS DE CONTATO E CANAIS
--    Permite configurar e-mail e canal preferencial por responsável
-- ─────────────────────────────────────────────
ALTER TABLE flow_responsibles
  ADD COLUMN IF NOT EXISTS email                  text,
  -- E-mail do responsável (pode ser fixo ou variável: {email_solicitante})
  ADD COLUMN IF NOT EXISTS canal_preferencial     text    DEFAULT 'whatsapp',
  -- canal_preferencial: whatsapp | email | ambos | painel
  ADD COLUMN IF NOT EXISTS recebe_whatsapp        boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS recebe_email           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_aprovar_email     boolean DEFAULT false,
  -- Se true: ação de aprovação via link de e-mail é válida
  ADD COLUMN IF NOT EXISTS pode_reprovar_email    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_confirmar_email   boolean DEFAULT false;

-- ─────────────────────────────────────────────
-- Referência: tipos de evento de e-mail para flow_history.acao_nome
-- (já suportados pelo campo origem = 'email' existente)
--
--   email_enviado      → e-mail disparado pelo sistema
--   email_entregue     → confirmação do provedor (bounce = não entregue)
--   email_aberto       → pixel de rastreamento (se provider suportar)
--   email_respondido   → e-mail de resposta recebido via inbound webhook
--   email_aprovado     → aprovação via link ou palavra-chave em resposta
--   email_reprovado    → reprovação via link ou palavra-chave em resposta
--   email_erro         → falha no envio
--   whatsapp_enviado   → (já existia)
--   webhook_executado  → chamada a endpoint externo
--   painel_visualizado → tarefa visualizada no painel interno
-- ─────────────────────────────────────────────

-- Fim da migration add_flow_email_channels.sql
