-- ============================================================
-- VERIFICAÇÃO: SmartLíder aplicado em workspaces indevidos?
-- Correto: apenas BIRIGUI deve ter SmartLíder
-- Execute este script no Supabase SQL Editor (Read-Only)
-- ============================================================

-- 1. workspace_modules: quais workspaces têm smartlider enabled=true?
SELECT
  w.nome                   AS workspace,
  wm.module_key,
  wm.enabled,
  w.created_at             AS ws_created
FROM workspace_modules wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.module_key = 'smartlider'
ORDER BY w.nome;

-- 2. lider_perfis: quais workspaces têm perfis de líder criados?
SELECT
  w.nome     AS workspace,
  COUNT(*)   AS total_perfis,
  MIN(lp.created_at) AS primeiro_criado
FROM lider_perfis lp
JOIN workspaces w ON w.id = lp.workspace_id
GROUP BY w.id, w.nome
ORDER BY w.nome;

-- 3. dds_temas: quais workspaces têm temas de DDS?
SELECT
  w.nome     AS workspace,
  COUNT(*)   AS total_temas
FROM dds_temas dt
JOIN workspaces w ON w.id = dt.workspace_id
GROUP BY w.id, w.nome
ORDER BY w.nome;

-- 4. lider_telemetria_sessoes: há sessões em workspaces indevidos?
SELECT
  w.nome     AS workspace,
  COUNT(*)   AS total_sessoes
FROM lider_telemetria_sessoes s
JOIN workspaces w ON w.id = s.workspace_id
GROUP BY w.id, w.nome
ORDER BY w.nome;

-- 5. Todos módulos de ph.mar89s (para ver o que está enabled/disabled)
SELECT
  wm.module_key,
  wm.enabled
FROM workspace_modules wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE w.nome ILIKE '%ph.mar%' OR w.nome ILIKE '%gmail%'
ORDER BY wm.module_key;
