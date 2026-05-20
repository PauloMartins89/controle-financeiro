-- ============================================================
-- add_workspace_admin.sql
-- Permite que o admin da empresa (membro sem perfil_id = acesso total)
-- gerencie os membros e perfis do próprio workspace diretamente
-- via cliente Supabase (anon key + JWT do usuário logado).
-- ============================================================

-- ── 1. Perfis: workspace admin pode criar / editar / excluir ─────────────────
CREATE POLICY "workspace_admin_insert_perfis" ON perfis
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = perfis.workspace_id
        AND wm.user_id      = auth.uid()
        AND wm.perfil_id    IS NULL
        AND wm.ativo        IS NOT FALSE
    )
  );

CREATE POLICY "workspace_admin_update_perfis" ON perfis
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = perfis.workspace_id
        AND wm.user_id      = auth.uid()
        AND wm.perfil_id    IS NULL
        AND wm.ativo        IS NOT FALSE
    )
  );

CREATE POLICY "workspace_admin_delete_perfis" ON perfis
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = perfis.workspace_id
        AND wm.user_id      = auth.uid()
        AND wm.perfil_id    IS NULL
        AND wm.ativo        IS NOT FALSE
    )
  );

-- ── 2. Permissões do perfil: workspace admin gerencia ────────────────────────
CREATE POLICY "workspace_admin_insert_permissoes" ON perfil_permissoes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfis p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE p.id          = perfil_permissoes.perfil_id
        AND wm.user_id    = auth.uid()
        AND wm.perfil_id  IS NULL
        AND wm.ativo      IS NOT FALSE
    )
  );

CREATE POLICY "workspace_admin_delete_permissoes" ON perfil_permissoes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM perfis p
      JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE p.id          = perfil_permissoes.perfil_id
        AND wm.user_id    = auth.uid()
        AND wm.perfil_id  IS NULL
        AND wm.ativo      IS NOT FALSE
    )
  );

-- ── 3. Membros: workspace admin pode atualizar (perfil / ativo) ──────────────
CREATE POLICY "workspace_admin_update_members" ON workspace_members
  FOR UPDATE USING (
    workspace_id IN (
      SELECT wm2.workspace_id FROM workspace_members wm2
      WHERE wm2.user_id   = auth.uid()
        AND wm2.perfil_id IS NULL
        AND wm2.ativo     IS NOT FALSE
    )
  );
