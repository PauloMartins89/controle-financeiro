-- ============================================================
-- Módulos SmartLíder por workspace
-- Controla quais módulos aparecem no app para cada cliente
--
-- Módulos disponíveis:
--   modulo_refeicao  → Solicitar Refeição + Histórico
--   modulo_efetivo   → Mão de Obra + Produtividade Equipe + Avaliação
--   modulo_maquina   → Máquina + Aferição + Produtividade Equipamento
--   modulo_epi       → Controle EPI + Solicitar EPI
--   modulo_insumo    → Insumo (apontamento + solicitação)
--
-- DDS e Mapas de Campo são integrados — não precisam de flag (sempre visíveis)
-- ============================================================

-- ── INSTRUÇÃO DE USO ──────────────────────────────────────────────────────
-- 1. Descubra o workspace_id do cliente:
--    SELECT id, nome FROM workspaces WHERE nome ILIKE '%nome_do_cliente%';
-- 2. Substitua o UUID abaixo pelo ID real
-- 3. Ajuste os valores true/false conforme o contrato do cliente
-- ─────────────────────────────────────────────────────────────────────────

-- EXEMPLO: Novo cliente com apenas módulo Refeição habilitado
-- Substitua 'WORKSPACE_ID_DO_CLIENTE' pelo UUID real

/*
INSERT INTO lider_workspace_features (workspace_id, feature, ativo)
VALUES
  ('WORKSPACE_ID_DO_CLIENTE', 'modulo_refeicao', true),
  ('WORKSPACE_ID_DO_CLIENTE', 'modulo_efetivo',  false),
  ('WORKSPACE_ID_DO_CLIENTE', 'modulo_maquina',  false),
  ('WORKSPACE_ID_DO_CLIENTE', 'modulo_epi',      false),
  ('WORKSPACE_ID_DO_CLIENTE', 'modulo_insumo',   false)
ON CONFLICT (workspace_id, feature)
  DO UPDATE SET ativo = EXCLUDED.ativo, updated_at = now();
*/

-- ── Verificar configuração de um workspace ────────────────────────────────
-- SELECT feature, ativo FROM lider_workspace_features
-- WHERE workspace_id = 'WORKSPACE_ID_DO_CLIENTE'
-- ORDER BY feature;

-- ── Habilitar todos os módulos (cliente full) ─────────────────────────────
-- INSERT INTO lider_workspace_features (workspace_id, feature, ativo)
-- SELECT 'WORKSPACE_ID_DO_CLIENTE', unnest(ARRAY[
--   'modulo_refeicao','modulo_efetivo','modulo_maquina','modulo_epi','modulo_insumo'
-- ]), true
-- ON CONFLICT (workspace_id, feature) DO UPDATE SET ativo = true, updated_at = now();
