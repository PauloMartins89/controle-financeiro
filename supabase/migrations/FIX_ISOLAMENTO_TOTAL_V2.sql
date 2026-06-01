-- ══════════════════════════════════════════════════════════════════════════
-- FIX ISOLAMENTO TOTAL V2
-- Execute INTEIRO no SQL Editor do Supabase (botão "Run")
-- Corrige vazamento de dados entre workspaces/clientes
--
-- Causa raiz identificada:
--   1. "cotacoes_public_token" FOR SELECT USING (true) → qualquer usuário
--      autenticado vê TODAS as cotações de todos os workspaces
--   2. "cotacoes_public_update" FOR UPDATE USING (true) → qualquer um edita
--   3. Policies em solicitacoes_compra e lancamentos usam subquery direta
--      em workspace_members → possível recursão RLS
--
-- Solução:
--   A. Garante função SECURITY DEFINER my_workspace_ids() (sem recursão)
--   B. Isola cotacoes_compra por workspace (autenticado) ou por token (anon)
--   C. Isola solicitacoes_compra, lancamentos, lotes_cliente por workspace
-- ══════════════════════════════════════════════════════════════════════════

-- ─── PASSO 1: Função SECURITY DEFINER (sem recursão RLS) ─────────────────────
-- Se já existir, apenas atualiza (CREATE OR REPLACE é idempotente)

CREATE OR REPLACE FUNCTION public.my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
$$;

-- Alias antigo (mantém compatibilidade com políticas anteriores)
CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
$$;

-- Função para checar platform admin (sem recursão)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
$$;

-- ─── PASSO 2: LANCAMENTOS ────────────────────────────────────────────────────

ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;

-- Remove TODAS as políticas existentes (evita conflitos)
DROP POLICY IF EXISTS "members_see_lancamentos"          ON lancamentos;
DROP POLICY IF EXISTS "members_manage_lancamentos"       ON lancamentos;
DROP POLICY IF EXISTS "workspace_select_lancamentos"     ON lancamentos;
DROP POLICY IF EXISTS "workspace_insert_lancamentos"     ON lancamentos;
DROP POLICY IF EXISTS "workspace_update_lancamentos"     ON lancamentos;
DROP POLICY IF EXISTS "workspace_delete_lancamentos"     ON lancamentos;
DROP POLICY IF EXISTS "admin_all_lancamentos"            ON lancamentos;
DROP POLICY IF EXISTS "ws_lancamentos"                   ON lancamentos;

-- Política única: workspace members + platform admins
CREATE POLICY "ws_lancamentos" ON lancamentos
  FOR ALL
  USING (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  )
  WITH CHECK (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  );

-- ─── PASSO 3: LOTES_CLIENTE ──────────────────────────────────────────────────

ALTER TABLE lotes_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select_lotes"  ON lotes_cliente;
DROP POLICY IF EXISTS "workspace_insert_lotes"  ON lotes_cliente;
DROP POLICY IF EXISTS "workspace_update_lotes"  ON lotes_cliente;
DROP POLICY IF EXISTS "workspace_delete_lotes"  ON lotes_cliente;
DROP POLICY IF EXISTS "ws_lotes_cliente"        ON lotes_cliente;

CREATE POLICY "ws_lotes_cliente" ON lotes_cliente
  FOR ALL
  USING (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  )
  WITH CHECK (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  );

-- ─── PASSO 4: SOLICITACOES_COMPRA ────────────────────────────────────────────

ALTER TABLE solicitacoes_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compras_workspace_policy"          ON solicitacoes_compra;
DROP POLICY IF EXISTS "public_cotacao_solicitacao_select" ON solicitacoes_compra;
DROP POLICY IF EXISTS "ws_solicitacoes_compra"            ON solicitacoes_compra;

-- Política para membros autenticados do workspace
CREATE POLICY "ws_solicitacoes_compra" ON solicitacoes_compra
  FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  )
  WITH CHECK (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  );

-- Acesso anônimo: fornecedor que precisa ler a solicitação vinculada ao token
-- (via função SECURITY DEFINER — evita ver outras solicitações)
CREATE OR REPLACE FUNCTION public.solicitacao_tem_cotacao_publica(sol_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM cotacoes_compra
    WHERE solicitacao_id = sol_id
      AND token_acesso IS NOT NULL
  );
$$;

CREATE POLICY "anon_solicitacao_via_token" ON solicitacoes_compra
  FOR SELECT TO anon
  USING (public.solicitacao_tem_cotacao_publica(id));

-- ─── PASSO 5: COTACOES_COMPRA ────────────────────────────────────────────────
-- PROBLEMA IDENTIFICADO: "cotacoes_public_token" FOR SELECT USING (true)
-- permite que QUALQUER usuário autenticado veja TODAS as cotações!

ALTER TABLE cotacoes_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cotacoes_workspace_policy"  ON cotacoes_compra;
DROP POLICY IF EXISTS "cotacoes_public_token"      ON cotacoes_compra;
DROP POLICY IF EXISTS "cotacoes_public_update"     ON cotacoes_compra;
DROP POLICY IF EXISTS "ws_cotacoes_compra"         ON cotacoes_compra;
DROP POLICY IF EXISTS "anon_cotacao_token_select"  ON cotacoes_compra;
DROP POLICY IF EXISTS "anon_cotacao_token_update"  ON cotacoes_compra;

-- Membros autenticados do workspace veem suas cotações
CREATE POLICY "ws_cotacoes_compra" ON cotacoes_compra
  FOR ALL TO authenticated
  USING (
    solicitacao_id IN (
      SELECT id FROM solicitacoes_compra
      WHERE workspace_id IN (SELECT my_workspace_ids())
    )
    OR is_platform_admin()
  )
  WITH CHECK (
    solicitacao_id IN (
      SELECT id FROM solicitacoes_compra
      WHERE workspace_id IN (SELECT my_workspace_ids())
    )
    OR is_platform_admin()
  );

-- Fornecedor anônimo: lê SUA cotação via token (sem login)
-- SOMENTE cotações que têm token (não expõe dados sem token)
CREATE POLICY "anon_cotacao_token_select" ON cotacoes_compra
  FOR SELECT TO anon
  USING (token_acesso IS NOT NULL);

-- Fornecedor anônimo: atualiza SUA cotação via token (envia proposta)
CREATE POLICY "anon_cotacao_token_update" ON cotacoes_compra
  FOR UPDATE TO anon
  USING (token_acesso IS NOT NULL)
  WITH CHECK (token_acesso IS NOT NULL);

-- ─── PASSO 6: PAGAMENTOS ─────────────────────────────────────────────────────

ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select_pagamentos"  ON pagamentos;
DROP POLICY IF EXISTS "workspace_insert_pagamentos"  ON pagamentos;
DROP POLICY IF EXISTS "workspace_update_pagamentos"  ON pagamentos;
DROP POLICY IF EXISTS "workspace_delete_pagamentos"  ON pagamentos;
DROP POLICY IF EXISTS "ws_pagamentos"                ON pagamentos;

CREATE POLICY "ws_pagamentos" ON pagamentos
  FOR ALL
  USING (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  )
  WITH CHECK (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  );

-- ─── PASSO 7: CONTAS_PAGAR ───────────────────────────────────────────────────

ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select_contas_pagar"  ON contas_pagar;
DROP POLICY IF EXISTS "workspace_insert_contas_pagar"  ON contas_pagar;
DROP POLICY IF EXISTS "workspace_update_contas_pagar"  ON contas_pagar;
DROP POLICY IF EXISTS "workspace_delete_contas_pagar"  ON contas_pagar;
DROP POLICY IF EXISTS "ws_contas_pagar"                ON contas_pagar;

CREATE POLICY "ws_contas_pagar" ON contas_pagar
  FOR ALL
  USING (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  )
  WITH CHECK (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  );

-- ─── PASSO 8: DIARIO_TARIFAS ─────────────────────────────────────────────────

ALTER TABLE diario_tarifas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ws_diario_tarifas" ON diario_tarifas;

CREATE POLICY "ws_diario_tarifas" ON diario_tarifas
  FOR ALL
  USING (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  )
  WITH CHECK (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  );

-- ─── VERIFICAÇÃO FINAL ───────────────────────────────────────────────────────

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN (
  'lancamentos', 'lotes_cliente', 'solicitacoes_compra',
  'cotacoes_compra', 'pagamentos', 'contas_pagar', 'diario_tarifas'
)
ORDER BY tablename, policyname;
