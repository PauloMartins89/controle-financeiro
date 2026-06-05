-- ══════════════════════════════════════════════════════════════════════════
-- FIX IMEDIATO: Re-vincula lider_perfis ao auth.user mais recentemente logado
--
-- Problema: o app pode ter criado um SEGUNDO usuário via signUp() com UUID
-- diferente do criado por criar_acesso_lider(). O lider_perfis continua
-- apontando para o UUID antigo. O usuário loga como UUID novo mas o
-- workspace_members/lider_perfis ainda usa o UUID antigo → RLS falha.
--
-- Este script:
--   1. Para cada email @lider.smartpro, pega o usuário com last_sign_in mais recente
--   2. Atualiza lider_perfis.user_id para esse UUID
--   3. O trigger trg_lider_auto_workspace_member adiciona o novo UUID ao workspace_members
-- ══════════════════════════════════════════════════════════════════════════

-- ─── DIAGNÓSTICO: ver se há duplicatas ────────────────────────────────────────
-- SELECT id, email, created_at, last_sign_in_at, confirmed_at
-- FROM auth.users
-- WHERE email LIKE '%@lider.smartpro'
-- ORDER BY email, created_at DESC;

-- ─── FIX: re-vincula ao usuário com login mais recente ───────────────────────
WITH ultimo_login AS (
  SELECT DISTINCT ON (email)
    id,
    email,
    split_part(email, '@', 1) AS matricula
  FROM auth.users
  WHERE email LIKE '%@lider.smartpro'
  ORDER BY email, last_sign_in_at DESC NULLS LAST, created_at DESC
)
UPDATE lider_perfis lp
SET
  user_id    = ul.id,
  updated_at = now()
FROM ultimo_login ul
WHERE ul.matricula = lp.matricula
  AND (lp.user_id IS NULL OR lp.user_id != ul.id)
  AND lp.ativo = true;

-- ─── Garante workspace_members para todos após o re-vínculo ──────────────────
INSERT INTO workspace_members (workspace_id, user_id)
SELECT workspace_id, user_id
FROM   lider_perfis
WHERE  user_id IS NOT NULL
  AND  workspace_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- ─── Confirmação: mostra estado final ────────────────────────────────────────
SELECT
  lp.matricula,
  lp.nome,
  lp.user_id AS lider_perfis_user_id,
  u.last_sign_in_at,
  wm.workspace_id IS NOT NULL AS em_workspace_members
FROM lider_perfis lp
JOIN auth.users u ON u.id = lp.user_id
LEFT JOIN workspace_members wm
       ON wm.workspace_id = lp.workspace_id AND wm.user_id = lp.user_id
WHERE lp.ativo = true
ORDER BY lp.matricula;
