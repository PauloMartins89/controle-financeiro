-- =============================================================================
-- MÓDULO REFEIÇÕES — Fluxo Corporativo com Rastreabilidade Completa
-- Execute no Supabase SQL Editor
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ESTENDER refei_solicitacoes com campos do fluxo completo
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE refei_solicitacoes
  ADD COLUMN IF NOT EXISTS ticket              text,          -- REF-2026-000145
  ADD COLUMN IF NOT EXISTS consolidado_em      timestamptz,   -- momento da consolidação
  ADD COLUMN IF NOT EXISTS env_restaurante_em  timestamptz,   -- enviado ao restaurante
  ADD COLUMN IF NOT EXISTS validacao_env_em    timestamptz,   -- validação enviada ao líder
  ADD COLUMN IF NOT EXISTS validado_em         timestamptz,   -- líder confirmou
  ADD COLUMN IF NOT EXISTS resultado_validacao text,          -- 'correto' | 'com_ocorrencia'
  ADD COLUMN IF NOT EXISTS ocorrencia          text;          -- descrição da ocorrência

-- Migrar registros existentes: ticket = numero_pedido como fallback
UPDATE refei_solicitacoes
SET ticket = numero_pedido
WHERE ticket IS NULL AND numero_pedido IS NOT NULL;

-- Criar índice para busca rápida por ticket
CREATE INDEX IF NOT EXISTS idx_refei_sol_ticket ON refei_solicitacoes(ticket);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA DE EVENTOS — Audit trail de cada ação no ciclo do pedido
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refei_pedido_eventos (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid        NOT NULL REFERENCES refei_solicitacoes(id) ON DELETE CASCADE,
  tipo           text        NOT NULL,   -- ex: 'pedido_criado', 'aprovado', 'entrega_confirmada'
  descricao      text        NOT NULL,   -- texto legível para exibição na timeline
  ator           text,                   -- nome ou identificador de quem gerou o evento
  ator_tipo      text,                   -- 'lider' | 'supervisor' | 'sistema' | 'admin'
  dados          jsonb,                  -- payload extra (motivo, ocorrência, etc.)
  criado_em      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refei_eventos_sol ON refei_pedido_eventos (solicitacao_id, criado_em ASC);

ALTER TABLE refei_pedido_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refei_eventos_all" ON refei_pedido_eventos;
CREATE POLICY "refei_eventos_all"
  ON refei_pedido_eventos
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. MAPEAMENTO DE TIPOS DE EVENTO (referência — não afeta o schema)
-- ─────────────────────────────────────────────────────────────────────────────
-- pedido_criado            → Pedido criado pelo líder
-- enviado_aprovacao        → Enviado para aprovação do supervisor
-- aprovado                 → Pedido aprovado pelo supervisor
-- reprovado                → Pedido reprovado pelo supervisor
-- consolidado              → Sistema consolidou o pedido
-- enviado_restaurante      → Pedido enviado ao restaurante
-- em_acompanhamento        → Pedido em acompanhamento
-- entrega_registrada       → Entrega marcada pelo operador
-- validacao_enviada        → Validação enviada ao líder via WA
-- entrega_confirmada       → Líder confirmou entrega correta
-- ocorrencia_registrada    → Líder registrou ocorrência na entrega
-- pedido_finalizado        → Pedido encerrado com sucesso
-- pedido_finalizado_ocorr  → Pedido encerrado com ocorrência
-- reabertura               → Pedido reaberto após reprovação

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MAPEAMENTO DE STATUS COMPLETO (referência)
-- ─────────────────────────────────────────────────────────────────────────────
-- rascunho                → Formulário não enviado ainda
-- aguardando_aprovacao    → Enviado, aguarda supervisor (aliases: 'pendente')
-- aprovado                → Supervisor aprovou
-- reprovado               → Supervisor reprovou
-- consolidado             → Sistema gerou o ticket e consolidou
-- enviado_restaurante     → Pedido comunicado ao restaurante
-- em_acompanhamento       → Pedido está em preparo/trânsito
-- entregue                → Entrega registrada pelo operador
-- aguardando_validacao    → Aguarda confirmação do líder
-- finalizado              → Líder confirmou entrega correta
-- finalizado_com_ocorrencia → Líder registrou problema na entrega
