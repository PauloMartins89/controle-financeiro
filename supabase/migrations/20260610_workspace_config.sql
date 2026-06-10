-- ─────────────────────────────────────────────────────────────────────────────
-- workspace_config — flags de comportamento por workspace (isolamento por cliente)
-- ─────────────────────────────────────────────────────────────────────────────
-- Objetivo: dar a cada cliente (workspace) um lugar para CUSTOMIZAR comportamento
-- (landing, rótulos, regras de cálculo, prompt de OCR, features-flag) SEM tocar no
-- código compartilhado de outros clientes.
--
-- Princípio: config AUSENTE = comportamento legado de hoje. Nada muda para quem
-- não tem linha aqui. Isolamento garantido por workspace_id + RLS.
--
-- Esta migration é 100% ADITIVA: cria tabela nova, não altera nenhuma existente.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspace_config (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspace_config IS
  'Flags de comportamento por workspace. config ausente = fallback legado. Isolado por workspace_id.';

ALTER TABLE public.workspace_config ENABLE ROW LEVEL SECURITY;

-- RLS: membros só acessam a config do próprio workspace (mesmo padrão de pfd_tables)
-- my_workspace_ids() é SECURITY DEFINER — evita recursão RLS em workspace_members.
DROP POLICY IF EXISTS "workspace_config_rw" ON public.workspace_config;
CREATE POLICY "workspace_config_rw" ON public.workspace_config
  FOR ALL
  USING      (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Exemplos de uso (NÃO executados aqui — apenas documentação do formato):
--
--   -- Cliente A: landing custom + rótulo + feature nova
--   INSERT INTO workspace_config (workspace_id, config) VALUES
--     ('<UUID_CLIENTE_A>', '{
--        "landing": "/lancamentos",
--        "labels": { "motorista": "Motorista" },
--        "features": { "nova_feature_a": true }
--      }'::jsonb)
--   ON CONFLICT (workspace_id) DO UPDATE SET config = EXCLUDED.config, updated_at = now();
--
--   -- Merge incremental de uma flag, sem sobrescrever o resto:
--   UPDATE workspace_config
--     SET config = config || '{"features": {"nova_feature_a": true}}'::jsonb,
--         updated_at = now()
--   WHERE workspace_id = '<UUID_CLIENTE_A>';
-- ─────────────────────────────────────────────────────────────────────────────
