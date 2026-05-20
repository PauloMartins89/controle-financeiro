-- ============================================================
-- FASE 1 / MIGRATION 4 — Log de auditoria
-- Registra ações sensíveis para rastreabilidade.
-- Cria função registrar_auditoria() para uso via API.
-- ============================================================

-- 1. Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS logs_auditoria (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao         TEXT NOT NULL,
  -- acao: 'criar_usuario', 'excluir_registro', 'aprovar_compra', etc.
  tabela       TEXT,
  registro_id  TEXT,
  dados_antes  JSONB,
  dados_depois JSONB,
  ip           TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE logs_auditoria ENABLE ROW LEVEL SECURITY;

-- Membros veem os logs da própria empresa
CREATE POLICY "members_see_own_logs" ON logs_auditoria
  FOR SELECT USING (
    workspace_id IN (SELECT my_workspace_ids())
    OR is_platform_admin()
  );

-- INSERT: qualquer usuário autenticado pode inserir logs (via API)
CREATE POLICY "authenticated_insert_logs" ON logs_auditoria
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Índices para consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_logs_workspace  ON logs_auditoria(workspace_id);
CREATE INDEX IF NOT EXISTS idx_logs_user       ON logs_auditoria(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_acao       ON logs_auditoria(acao);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs_auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_tabela     ON logs_auditoria(tabela);

-- 3. Função helper: registrar_auditoria(...)
--    Pode ser chamada via SQL ou de dentro de triggers
CREATE OR REPLACE FUNCTION public.registrar_auditoria(
  p_acao         TEXT,
  p_workspace_id UUID    DEFAULT NULL,
  p_tabela       TEXT    DEFAULT NULL,
  p_registro_id  TEXT    DEFAULT NULL,
  p_dados_antes  JSONB   DEFAULT NULL,
  p_dados_depois JSONB   DEFAULT NULL,
  p_ip           TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO logs_auditoria (
    workspace_id, user_id, acao,
    tabela, registro_id,
    dados_antes, dados_depois,
    ip
  ) VALUES (
    p_workspace_id, auth.uid(), p_acao,
    p_tabela, p_registro_id,
    p_dados_antes, p_dados_depois,
    p_ip
  )
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  -- Nunca falha silenciosamente — não deve bloquear a operação principal
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.registrar_auditoria IS
  'Insere um registro de auditoria. Nunca lança exceção para não bloquear a operação principal.';

-- 4. Retenção automática: limpar logs com mais de 1 ano
--    (opcional — ativar quando houver volume)
-- CREATE OR REPLACE FUNCTION public.limpar_logs_antigos()
-- RETURNS void LANGUAGE SQL SECURITY DEFINER AS $$
--   DELETE FROM logs_auditoria WHERE created_at < now() - interval '1 year';
-- $$;
