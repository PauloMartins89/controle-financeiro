-- ============================================================
-- HOTFIX: Corrigir RLS recursiva na tabela platform_admins
-- Causa: a policy usava SELECT FROM platform_admins para avaliar
-- permissão de SELECT → stack overflow → HTTP 500 para todos os usuários
-- Solução: usar is_platform_admin() que é SECURITY DEFINER (sem RLS)
-- ============================================================

-- Substitui a policy recursiva por uma não-recursiva
DROP POLICY IF EXISTS "platform_admins_see_list" ON platform_admins;

-- is_platform_admin() é SECURITY DEFINER → consulta a tabela como superuser
-- não dispara RLS → sem recursão
-- Efeito: platform admins veem as linhas; não-admins recebem [] (sem erro 500)
CREATE POLICY "platform_admins_see_list" ON platform_admins
  FOR SELECT USING (is_platform_admin());

-- Verificação
SELECT 'Hotfix platform_admins RLS aplicado!' AS status,
  (SELECT COUNT(*) FROM platform_admins) AS total_admins;
