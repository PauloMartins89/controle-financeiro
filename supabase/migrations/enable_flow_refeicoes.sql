-- ════════════════════════════════════════════════════════════
-- SmartPro Flow Center — Ativar Flow Engine para Refeições
--
-- Execute no Supabase SQL Editor para habilitar o flow engine
-- no módulo de Refeições.
--
-- REQUISITO: seed_flow_refeicoes.sql já executado.
-- ════════════════════════════════════════════════════════════

-- Ativar a flag (todos os workspaces que possuem a flag)
UPDATE configuracoes
SET valor = 'true'
WHERE chave = 'flow_engine_refeicoes';

-- Confirmar
SELECT workspace_id, chave, valor, updated_at
FROM configuracoes
WHERE chave = 'flow_engine_refeicoes';
