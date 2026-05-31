-- ═══════════════════════════════════════════════════════════════════
-- FIX: Dependência circular entre RLS policies
-- Causa: public_cotacao_solicitacao_select em solicitacoes_compra
--        referenciava cotacoes_compra, cuja policy referenciava
--        solicitacoes_compra de volta → loop → 500 em todas as queries
-- ═══════════════════════════════════════════════════════════════════

-- Passo 1: Remove a policy circular
DROP POLICY IF EXISTS "public_cotacao_solicitacao_select" ON solicitacoes_compra;

-- Passo 2: Função SECURITY DEFINER que consulta cotacoes_compra
-- sem passar pelo RLS dela (roda como dono da função, não como anon)
CREATE OR REPLACE FUNCTION public.solicitacao_tem_cotacao_publica(sol_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
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

-- Passo 3: Recria a policy usando a função (sem dependência circular)
CREATE POLICY "public_cotacao_solicitacao_select" ON solicitacoes_compra FOR SELECT USING (
  public.solicitacao_tem_cotacao_publica(id)
);
