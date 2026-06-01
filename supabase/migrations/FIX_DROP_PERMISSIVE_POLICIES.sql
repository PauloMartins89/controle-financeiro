-- ══════════════════════════════════════════════════════════════════════════
-- FIX: Remove políticas permissivas USING (true) que vazam dados
-- Execute no SQL Editor do Supabase APÓS rodar FIX_ISOLAMENTO_TOTAL_V2.sql
--
-- Problema: em Supabase, se QUALQUER policy permite acesso, a linha aparece.
-- Três políticas antigas com USING (true) anulavam todo o isolamento:
--   · authed_all_lancamentos  (lancamentos)
--   · authed_all_lotes        (lotes_cliente)
--   · allow_all_pagamentos    (pagamentos)
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1. LANCAMENTOS: remove política permissiva ───────────────────────────────
DROP POLICY IF EXISTS "authed_all_lancamentos" ON lancamentos;

-- ─── 2. LOTES_CLIENTE: remove política permissiva e duplicata ────────────────
DROP POLICY IF EXISTS "authed_all_lotes"             ON lotes_cliente;
DROP POLICY IF EXISTS "members_manage_lotes_cliente" ON lotes_cliente;

-- Corrige acesso público por token: restringe a usuários anônimos
-- (evita que usuário autenticado de outro workspace veja todos os lotes com token)
DROP POLICY IF EXISTS "public_read_by_token" ON lotes_cliente;
CREATE POLICY "anon_lote_token_select" ON lotes_cliente
  FOR SELECT TO anon
  USING (token_acesso IS NOT NULL);

-- ─── 3. PAGAMENTOS: remove política permissiva ───────────────────────────────
DROP POLICY IF EXISTS "allow_all_pagamentos" ON pagamentos;

-- ─── 4. CONTAS_PAGAR: remove política por user_id (substituída por workspace) ─
DROP POLICY IF EXISTS "Users see own contas_pagar" ON contas_pagar;

-- ─── 5. SOLICITACOES_COMPRA: remove políticas duplicatas e permissivas ────────
-- "public_token_aprovador_select" e "solicitacoes_public_token" são idênticas
-- e expõem todas as solicitações com token_aprovador a qualquer autenticado
DROP POLICY IF EXISTS "public_token_aprovador_select" ON solicitacoes_compra;
DROP POLICY IF EXISTS "solicitacoes_public_token"     ON solicitacoes_compra;
-- Recria restrito a anon (aprovador recebe link, não precisa estar logado)
DROP POLICY IF EXISTS "anon_solicitacao_aprovador_token" ON solicitacoes_compra;
CREATE POLICY "anon_solicitacao_aprovador_token" ON solicitacoes_compra
  FOR SELECT TO anon
  USING (token_aprovador IS NOT NULL);

-- Remove também políticas inline antigas (usam subquery direta sem SECURITY DEFINER)
DROP POLICY IF EXISTS "workspace_select_solicitacoes" ON solicitacoes_compra;
DROP POLICY IF EXISTS "workspace_insert_solicitacoes" ON solicitacoes_compra;
DROP POLICY IF EXISTS "workspace_update_solicitacoes" ON solicitacoes_compra;
DROP POLICY IF EXISTS "workspace_delete_solicitacoes" ON solicitacoes_compra;

-- ─── VERIFICAÇÃO ─────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN (
  'lancamentos','lotes_cliente','solicitacoes_compra',
  'cotacoes_compra','pagamentos','contas_pagar'
)
ORDER BY tablename, policyname;
