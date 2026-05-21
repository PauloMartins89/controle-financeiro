-- ════════════════════════════════════════════════════════════
-- SmartPro Flow Center — Backfill: Instâncias para solicitações existentes
--
-- Cria instâncias de fluxo para todas as refei_solicitacoes
-- que ainda não possuem uma instância no flow engine.
--
-- REQUISITO: seed_flow_refeicoes.sql e enable_flow_refeicoes.sql já executados.
-- ════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_workspace_id  uuid;
  v_def_id        uuid;
  v_ver_id        uuid;
  v_sol           record;
  v_step_id       uuid;
  v_inst_id       uuid;
  v_admin_user_id uuid;
  v_count         int := 0;
BEGIN
  -- Detectar workspace e admin
  SELECT id INTO v_workspace_id FROM workspaces WHERE ativo = true ORDER BY created_at LIMIT 1;
  SELECT id INTO v_admin_user_id FROM auth.users WHERE email = 'ph.mar89s@gmail.com' LIMIT 1;

  -- Definição ativa de refeições
  SELECT fd.id, fd.versao_atual_id
  INTO v_def_id, v_ver_id
  FROM flow_definitions fd
  WHERE fd.workspace_id = v_workspace_id
    AND fd.modulo = 'refeicoes'
    AND fd.ativo = true
  LIMIT 1;

  IF v_def_id IS NULL THEN
    RAISE EXCEPTION 'Definição de fluxo para refeições não encontrada. Execute seed_flow_refeicoes.sql primeiro.';
  END IF;

  -- Loop em todas solicitações sem instância
  FOR v_sol IN
    SELECT s.id, s.status, s.workspace_id, s.valor_total,
           s.numero_pedido, s.criado_em
    FROM refei_solicitacoes s
    WHERE s.workspace_id = v_workspace_id
      AND s.status NOT IN ('rascunho')  -- rascunho não entra no flow ainda
      AND NOT EXISTS (
        SELECT 1 FROM flow_instances fi
        WHERE fi.entidade_tipo = 'refei_solicitacoes'
          AND fi.entidade_id   = s.id
      )
    ORDER BY s.criado_em
  LOOP
    -- Encontrar o step correspondente ao status atual
    SELECT fs.id INTO v_step_id
    FROM flow_steps fs
    WHERE fs.version_id   = v_ver_id
      AND fs.status_valor = v_sol.status
    LIMIT 1;

    -- Se não achou step, pular
    IF v_step_id IS NULL THEN
      RAISE NOTICE 'Status "%" sem etapa correspondente, pulando solicitação %', v_sol.status, v_sol.id;
      CONTINUE;
    END IF;

    -- Criar instância diretamente no step atual
    INSERT INTO flow_instances (
      definition_id, version_id, workspace_id,
      entidade_tipo, entidade_id,
      status, current_step_id,
      dados_contexto, iniciado_por, created_at
    ) VALUES (
      v_def_id, v_ver_id, v_workspace_id,
      'refei_solicitacoes', v_sol.id,
      v_sol.status, v_step_id,
      jsonb_build_object('valor_total', v_sol.valor_total, 'numero_pedido', v_sol.numero_pedido),
      v_admin_user_id,
      v_sol.criado_em
    )
    RETURNING id INTO v_inst_id;

    -- Registrar no histórico como "backfill"
    INSERT INTO flow_history (instance_id, step_id, acao_nome, executado_por, origem, created_at)
    VALUES (v_inst_id, v_step_id, 'backfill', v_admin_user_id, 'sistema', now());

    -- Criar tarefa pendente apenas para steps não-finais
    IF v_sol.status NOT IN ('fechado', 'reprovado') THEN
      INSERT INTO flow_tasks (instance_id, step_id, workspace_id, titulo, status, created_at)
      VALUES (v_inst_id, v_step_id, v_workspace_id,
              'Backfill: ' || v_sol.status || ' - ' || COALESCE(v_sol.numero_pedido, v_sol.id::text),
              'pendente', now());
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE '✅ Backfill concluído: % instâncias criadas', v_count;
END $$;

-- Verificar resultado
SELECT
  fi.status,
  COUNT(*) as total,
  SUM(CASE WHEN fi.status != 'fechado' THEN 1 ELSE 0 END) as ativas
FROM flow_instances fi
JOIN flow_definitions fd ON fd.id = fi.definition_id
WHERE fd.modulo = 'refeicoes'
GROUP BY fi.status
ORDER BY fi.status;
