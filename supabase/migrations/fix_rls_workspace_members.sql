-- Corrige o erro 403 no INSERT de catalogo_compras causado pela política RLS
-- auto-referencial em workspace_members.
--
-- O problema: catalogo_compras INSERT usa subquery em workspace_members,
-- que por sua vez tem política SELECT com outra subquery em workspace_members
-- (auto-referencial). O PostgreSQL avalia o RLS recursivamente, resultando
-- em subquery vazia → INSERT bloqueado com 403.
--
-- A solução: uma função SECURITY DEFINER que executa fora do RLS e é usada
-- nas políticas das tabelas dependentes.
--
-- Execute no Supabase SQL Editor.

-- ─── 1. Função SECURITY DEFINER ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
$$;

-- ─── 2. Corrigir política SELECT de workspace_members ────────────────────────
-- Substitui a subquery auto-referencial por verificação direta + função
DROP POLICY IF EXISTS "members_see_own_members" ON workspace_members;

CREATE POLICY "members_see_own_members" ON workspace_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR workspace_id IN (SELECT my_workspace_ids())
  );

-- ─── 3. Recriar políticas das tabelas de compras usando a função ──────────────

-- catalogo_compras
DROP POLICY IF EXISTS "workspace members can manage catalog" ON catalogo_compras;
CREATE POLICY "workspace members can manage catalog"
  ON catalogo_compras FOR ALL
  USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

-- fornecedores_compra
DROP POLICY IF EXISTS "workspace_members_fornecedores" ON fornecedores_compra;
CREATE POLICY "workspace_members_fornecedores"
  ON fornecedores_compra FOR ALL
  USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

-- categorias_compra
DROP POLICY IF EXISTS "workspace_members_categorias" ON categorias_compra;
CREATE POLICY "workspace_members_categorias"
  ON categorias_compra FOR ALL
  USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

-- solicitacoes_compra
DROP POLICY IF EXISTS "compras_workspace_policy" ON solicitacoes_compra;
CREATE POLICY "compras_workspace_policy"
  ON solicitacoes_compra FOR ALL
  USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
