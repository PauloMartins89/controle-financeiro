-- ═══════════════════════════════════════════════════════════════════
-- Torna user_id nullable em lancamentos para suportar lançamentos
-- criados por automação (OCR de boletins, webhooks, integrações)
-- que não têm um auth.users vinculado.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE lancamentos
  ALTER COLUMN user_id DROP NOT NULL;
