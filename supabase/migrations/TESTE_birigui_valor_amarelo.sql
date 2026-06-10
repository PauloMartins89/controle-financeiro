-- ═════════════════════════════════════════════════════════════════════════════
-- DIAGNÓSTICO + TESTE — coluna VALOR amarela só no cliente certo
-- ═════════════════════════════════════════════════════════════════════════════
-- Rode por PARTES no SQL Editor do Supabase, na ordem.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── PASSO 1: garante a tabela (idempotente) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_config (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspace_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_config_rw" ON public.workspace_config;
CREATE POLICY "workspace_config_rw" ON public.workspace_config
  FOR ALL
  USING      (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));


-- ── PASSO 2: DESCUBRA o nome real do workspace ───────────────────────────────
-- Rode SÓ esta query e olhe o resultado. Anote o "id" do workspace do Birigui.
-- (o nome pode ser "Três Lagoas", "Birigui Transportes", etc.)
SELECT w.id, w.nome, c.config #>> '{ui,lancamentos,valorColBg}' AS cor_atual
FROM public.workspaces w
LEFT JOIN public.workspace_config c ON c.workspace_id = w.id
ORDER BY w.nome;


-- ── PASSO 3: aplique a cor no workspace certo ────────────────────────────────
-- OPÇÃO A — se você JÁ sabe o id do passo 2, cole o id aqui (mais seguro):
--   INSERT INTO public.workspace_config (workspace_id, config)
--   VALUES ('COLE-O-ID-AQUI'::uuid, '{"ui":{"lancamentos":{"valorColBg":"#fef9c3"}}}'::jsonb)
--   ON CONFLICT (workspace_id)
--   DO UPDATE SET config = public.workspace_config.config || EXCLUDED.config, updated_at = now();
--
-- OPÇÃO B — por nome (ajuste o texto do ILIKE para o nome que apareceu no passo 2):
INSERT INTO public.workspace_config (workspace_id, config)
SELECT id, '{"ui":{"lancamentos":{"valorColBg":"#fef9c3"}}}'::jsonb
FROM public.workspaces
WHERE nome ILIKE '%BIRIGUI%'      -- ←← TROQUE por '%TRES LAGOAS%' ou o nome certo
ON CONFLICT (workspace_id)
DO UPDATE SET config = public.workspace_config.config || EXCLUDED.config,
              updated_at = now();


-- ── PASSO 4: confirme que gravou (deve mostrar 1 linha com a cor #fef9c3) ────
SELECT w.id, w.nome, c.config #>> '{ui,lancamentos,valorColBg}' AS cor_valor, c.updated_at
FROM public.workspace_config c
JOIN public.workspaces w ON w.id = c.workspace_id;


-- ── REVERTER (sem afetar ninguém) ────────────────────────────────────────────
--   DELETE FROM public.workspace_config WHERE workspace_id = 'COLE-O-ID-AQUI'::uuid;
