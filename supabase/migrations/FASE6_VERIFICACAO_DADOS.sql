-- ============================================================
-- FASE 6 — Verificação e correção de dados existentes
-- Execute no Supabase SQL Editor
-- Seguro: apenas UPDATE de valores NULL/incorretos, nenhum DROP
-- ============================================================

-- ════════════════════════════════════════════════
-- 1. Garantir que todos os workspaces existentes tenham tipo = 'empresa'
--    (exceto o workspace de plataforma criado na Fase 1)
-- ════════════════════════════════════════════════
UPDATE workspaces
SET tipo = 'empresa'
WHERE tipo IS NULL;

-- ════════════════════════════════════════════════
-- 2. Garantir que todos os workspace_members tenham ativo = true
--    (o DEFAULT já cuida dos novos, mas membros antigos podem ter NULL
--    se a coluna foi adicionada antes do DEFAULT ser aplicado)
-- ════════════════════════════════════════════════
UPDATE workspace_members
SET ativo = true
WHERE ativo IS NULL;

-- ════════════════════════════════════════════════
-- 3. Limpar referências orphaned de perfil_id
--    (casos onde o perfil foi deletado mas a FK ficou por algum motivo)
-- ════════════════════════════════════════════════
UPDATE workspace_members wm
SET perfil_id = NULL
WHERE wm.perfil_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM perfis p WHERE p.id = wm.perfil_id
  );

-- ════════════════════════════════════════════════
-- 4. Garantir cor padrão nos workspaces sem cor
-- ════════════════════════════════════════════════
UPDATE workspaces
SET cor = '#6366f1'
WHERE cor IS NULL;

-- ════════════════════════════════════════════════
-- 5. RLS: Garantir que perfis e perfil_permissoes
--    também têm políticas de INSERT/UPDATE/DELETE para empresa admin
-- ════════════════════════════════════════════════

-- Perfis: empresa admin pode criar/editar/excluir perfis do seu workspace
DROP POLICY IF EXISTS "empresa_admin_manage_perfis" ON perfis;
CREATE POLICY "empresa_admin_manage_perfis" ON perfis
  FOR ALL USING (
    workspace_id IN (SELECT my_workspace_ids())
    AND is_empresa_admin(workspace_id)
  )
  WITH CHECK (
    workspace_id IN (SELECT my_workspace_ids())
    AND is_empresa_admin(workspace_id)
  );

-- Perfil permissões: empresa admin pode gerenciar permissões dos perfis do seu workspace
DROP POLICY IF EXISTS "empresa_admin_manage_permissoes" ON perfil_permissoes;
CREATE POLICY "empresa_admin_manage_permissoes" ON perfil_permissoes
  FOR ALL USING (
    perfil_id IN (
      SELECT p.id FROM perfis p
      WHERE p.workspace_id IN (SELECT my_workspace_ids())
        AND is_empresa_admin(p.workspace_id)
    )
  )
  WITH CHECK (
    perfil_id IN (
      SELECT p.id FROM perfis p
      WHERE p.workspace_id IN (SELECT my_workspace_ids())
        AND is_empresa_admin(p.workspace_id)
    )
  );

-- workspace_members: empresa admin pode atualizar perfil_id e ativo dos membros
DROP POLICY IF EXISTS "empresa_admin_update_members" ON workspace_members;
CREATE POLICY "empresa_admin_update_members" ON workspace_members
  FOR UPDATE USING (
    workspace_id IN (SELECT my_workspace_ids())
    AND is_empresa_admin(workspace_id)
  );

-- workspaces: empresa admin pode atualizar enabled_modules do seu workspace
DROP POLICY IF EXISTS "empresa_admin_update_own_workspace" ON workspaces;
CREATE POLICY "empresa_admin_update_own_workspace" ON workspaces
  FOR UPDATE USING (
    id IN (SELECT my_workspace_ids())
    AND is_empresa_admin(id)
  );

-- ════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ════════════════════════════════════════════════
SELECT
  'Fase 6 concluída!' AS status,
  (SELECT COUNT(*) FROM workspaces WHERE tipo IS NULL)           AS workspaces_sem_tipo,
  (SELECT COUNT(*) FROM workspace_members WHERE ativo IS NULL)   AS members_sem_ativo,
  (SELECT COUNT(*) FROM workspace_members WHERE perfil_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM perfis p WHERE p.id = workspace_members.perfil_id)
  )                                                              AS perfil_orphan,
  (SELECT COUNT(*) FROM workspaces WHERE cor IS NULL)            AS workspaces_sem_cor,
  (SELECT COUNT(*) FROM perfis)                                  AS total_perfis,
  (SELECT COUNT(*) FROM perfil_permissoes)                       AS total_permissoes,
  (SELECT COUNT(*) FROM workspace_members WHERE ativo = true)    AS members_ativos;
