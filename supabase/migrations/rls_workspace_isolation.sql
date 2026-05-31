-- ═══════════════════════════════════════════════════════════════════
-- RLS — Isolamento de dados por workspace (EXECUTE NO SUPABASE)
-- Garante que cada cliente só vê seus próprios dados,
-- independente do que o frontend faz.
-- ═══════════════════════════════════════════════════════════════════

-- Helper: retorna os workspace_ids do usuário logado
-- (reusado em todas as políticas abaixo)
-- Não é necessário criar função — usamos inline subquery.

-- ─── MACRO: padrão de política para cada tabela ──────────────────
-- SELECT: só vê linhas do próprio workspace
-- INSERT: só insere no próprio workspace
-- UPDATE/DELETE: só afeta linhas do próprio workspace
-- Admin (platform_admins): bypassa tudo
-- ────────────────────────────────────────────────────────────────

-- ── lancamentos ────────────────────────────────────────────────
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select_lancamentos"  ON lancamentos;
DROP POLICY IF EXISTS "workspace_insert_lancamentos"  ON lancamentos;
DROP POLICY IF EXISTS "workspace_update_lancamentos"  ON lancamentos;
DROP POLICY IF EXISTS "workspace_delete_lancamentos"  ON lancamentos;
DROP POLICY IF EXISTS "admin_all_lancamentos"         ON lancamentos;

CREATE POLICY "workspace_select_lancamentos" ON lancamentos FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_insert_lancamentos" ON lancamentos FOR INSERT WITH CHECK (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_update_lancamentos" ON lancamentos FOR UPDATE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_delete_lancamentos" ON lancamentos FOR DELETE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

-- ── lotes_cliente ──────────────────────────────────────────────
ALTER TABLE lotes_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select_lotes"  ON lotes_cliente;
DROP POLICY IF EXISTS "workspace_insert_lotes"  ON lotes_cliente;
DROP POLICY IF EXISTS "workspace_update_lotes"  ON lotes_cliente;
DROP POLICY IF EXISTS "workspace_delete_lotes"  ON lotes_cliente;

CREATE POLICY "workspace_select_lotes" ON lotes_cliente FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_insert_lotes" ON lotes_cliente FOR INSERT WITH CHECK (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_update_lotes" ON lotes_cliente FOR UPDATE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_delete_lotes" ON lotes_cliente FOR DELETE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

-- ── pagamentos ─────────────────────────────────────────────────
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select_pagamentos"  ON pagamentos;
DROP POLICY IF EXISTS "workspace_insert_pagamentos"  ON pagamentos;
DROP POLICY IF EXISTS "workspace_update_pagamentos"  ON pagamentos;
DROP POLICY IF EXISTS "workspace_delete_pagamentos"  ON pagamentos;

CREATE POLICY "workspace_select_pagamentos" ON pagamentos FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_insert_pagamentos" ON pagamentos FOR INSERT WITH CHECK (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_update_pagamentos" ON pagamentos FOR UPDATE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_delete_pagamentos" ON pagamentos FOR DELETE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

-- ── contas_pagar ───────────────────────────────────────────────
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select_contas_pagar"  ON contas_pagar;
DROP POLICY IF EXISTS "workspace_insert_contas_pagar"  ON contas_pagar;
DROP POLICY IF EXISTS "workspace_update_contas_pagar"  ON contas_pagar;
DROP POLICY IF EXISTS "workspace_delete_contas_pagar"  ON contas_pagar;

CREATE POLICY "workspace_select_contas_pagar" ON contas_pagar FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_insert_contas_pagar" ON contas_pagar FOR INSERT WITH CHECK (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_update_contas_pagar" ON contas_pagar FOR UPDATE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_delete_contas_pagar" ON contas_pagar FOR DELETE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

-- ── solicitacoes_compra ────────────────────────────────────────
ALTER TABLE solicitacoes_compra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select_solicitacoes"  ON solicitacoes_compra;
DROP POLICY IF EXISTS "workspace_insert_solicitacoes"  ON solicitacoes_compra;
DROP POLICY IF EXISTS "workspace_update_solicitacoes"  ON solicitacoes_compra;
DROP POLICY IF EXISTS "workspace_delete_solicitacoes"  ON solicitacoes_compra;

CREATE POLICY "workspace_select_solicitacoes" ON solicitacoes_compra FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_insert_solicitacoes" ON solicitacoes_compra FOR INSERT WITH CHECK (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_update_solicitacoes" ON solicitacoes_compra FOR UPDATE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_delete_solicitacoes" ON solicitacoes_compra FOR DELETE USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);

-- ── lancamento_eventos ─────────────────────────────────────────
ALTER TABLE lancamento_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_select_eventos"  ON lancamento_eventos;
DROP POLICY IF EXISTS "workspace_insert_eventos"  ON lancamento_eventos;

CREATE POLICY "workspace_select_eventos" ON lancamento_eventos FOR SELECT USING (
  lancamento_id IN (
    SELECT id FROM lancamentos
    WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  )
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
CREATE POLICY "workspace_insert_eventos" ON lancamento_eventos FOR INSERT WITH CHECK (
  lancamento_id IN (
    SELECT id FROM lancamentos
    WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND ativo = true)
  )
  OR EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
);
