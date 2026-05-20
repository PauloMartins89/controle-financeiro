-- ============================================================
-- APAGAR WORKSPACES — Execute no Supabase SQL Editor
-- Apaga Livia, Tiago e JOAO RICARDO LTDA com todos os dados
-- ============================================================

DO $$
DECLARE
  wids UUID[];
BEGIN
  -- Captura os IDs dos workspaces a apagar
  SELECT ARRAY_AGG(id) INTO wids
  FROM workspaces
  WHERE nome ILIKE ANY (ARRAY['Livia', 'Tiago', 'JOAO RICARDO LTDA']);

  IF wids IS NULL OR array_length(wids, 1) = 0 THEN
    RAISE EXCEPTION 'Nenhum workspace encontrado. Verifique os nomes.';
  END IF;

  RAISE NOTICE 'Apagando % workspace(s): %', array_length(wids, 1), wids;

  -- 1. Tabelas filhas que podem referenciar despesas/cartoes/pessoas/grupos
  --    Deletar antes para evitar violação de FK
  DELETE FROM lancamentos          WHERE workspace_id = ANY(wids);
  DELETE FROM pagamentos           WHERE workspace_id = ANY(wids);
  DELETE FROM lotes_cliente        WHERE workspace_id = ANY(wids);
  DELETE FROM solicitacoes_compra  WHERE workspace_id = ANY(wids);
  DELETE FROM status_notificacoes  WHERE workspace_id = ANY(wids);
  DELETE FROM whatsapp_config      WHERE workspace_id = ANY(wids);

  -- 2. Tabelas com NO ACTION (precisam ser apagadas antes do workspace)
  DELETE FROM despesas             WHERE workspace_id = ANY(wids);
  DELETE FROM recorrentes          WHERE workspace_id = ANY(wids);
  DELETE FROM proventos            WHERE workspace_id = ANY(wids);
  DELETE FROM negocios             WHERE workspace_id = ANY(wids);
  DELETE FROM veiculos             WHERE workspace_id = ANY(wids);
  DELETE FROM cartoes              WHERE workspace_id = ANY(wids);
  DELETE FROM closures             WHERE workspace_id = ANY(wids);
  DELETE FROM configuracoes        WHERE workspace_id = ANY(wids);
  DELETE FROM grupos               WHERE workspace_id = ANY(wids);
  DELETE FROM pessoas              WHERE workspace_id = ANY(wids);

  -- 3. Apaga os workspaces — CASCADE cuida de:
  --    workspace_members, workspace_modules, perfis, perfil_permissoes
  --    logs_auditoria (SET NULL, não apaga)
  DELETE FROM workspaces WHERE id = ANY(wids);

  RAISE NOTICE 'Concluído! % workspace(s) removido(s).', array_length(wids, 1);
END $$;
