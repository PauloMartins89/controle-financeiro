-- ══════════════════════════════════════════════════════════════════════════
-- FIX v2: my_workspace_ids() agora inclui lider_perfis como fonte adicional
--
-- Problema identificado: o backfill anterior pode ter falhado silenciosamente
-- se workspace_id em lider_perfis não existir em workspaces (FK violation).
-- Além disso, usuários criados via signUp() no app ficam sem lider_perfis vinculada.
--
-- Solução definitiva: atualizar my_workspace_ids() para buscar workspaces
-- tanto de workspace_members quanto de lider_perfis — o que existir.
-- Assim, líderes com perfil ativo sempre passam pelo RLS, independente de
-- estarem ou não em workspace_members.
-- ══════════════════════════════════════════════════════════════════════════

-- ─── Atualiza my_workspace_ids() ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Fonte 1: web app / admin (workspace_members)
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  UNION
  -- Fonte 2: líderes do app SmartLíder (lider_perfis)
  SELECT workspace_id FROM lider_perfis WHERE user_id = auth.uid() AND ativo = true
$$;

-- Alias antigo — mesma lógica
CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  UNION
  SELECT workspace_id FROM lider_perfis WHERE user_id = auth.uid() AND ativo = true
$$;

-- ─── Diagnóstico (opcional — rode para verificar) ─────────────────────────────
-- SELECT lp.matricula, lp.nome, lp.workspace_id, lp.user_id,
--        wm.workspace_id IS NOT NULL AS em_workspace_members
-- FROM   lider_perfis lp
-- LEFT JOIN workspace_members wm
--        ON wm.workspace_id = lp.workspace_id AND wm.user_id = lp.user_id
-- WHERE  lp.ativo = true
-- ORDER  BY lp.nome;
