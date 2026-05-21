-- ════════════════════════════════════════════════════════════
-- SmartPro Flow Center — Seed: Processo de Refeições
-- Popula o fluxo de "Solicitação de Refeição" no banco.
--
-- ANTES DE EXECUTAR: execute add_flow_center.sql para criar as tabelas.
-- Os UUIDs de workspace e admin são detectados automaticamente.
--
-- Fluxo: Rascunho → Pendente → Aprovado → Entregue → Fechado
--                            ↘ Reprovado
-- ════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- detectados automaticamente
  v_workspace_id    uuid;
  v_admin_user_id   uuid;

  v_def_id          uuid;
  v_ver_id          uuid;

  -- steps
  v_step_rascunho   uuid;
  v_step_pendente   uuid;
  v_step_aprovado   uuid;
  v_step_reprovado  uuid;
  v_step_entregue   uuid;
  v_step_fechado    uuid;

  -- actions
  v_act_enviar      uuid;  -- rascunho → pendente
  v_act_aprovar     uuid;  -- pendente → aprovado
  v_act_reprovar    uuid;  -- pendente → reprovado
  v_act_confirmar   uuid;  -- aprovado → entregue
  v_act_fechar      uuid;  -- entregue → fechado
  v_act_reabrir     uuid;  -- reprovado → rascunho

BEGIN

  -- ─────────────────────────────────────────────
  -- 0. AUTO-DETECTAR workspace e admin
  -- ─────────────────────────────────────────────
  SELECT id INTO v_workspace_id FROM workspaces WHERE ativo = true ORDER BY created_at LIMIT 1;
  IF v_workspace_id IS NULL THEN
    SELECT id INTO v_workspace_id FROM workspaces ORDER BY created_at LIMIT 1;
  END IF;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum workspace encontrado. Verifique a tabela workspaces.';
  END IF;

  SELECT id INTO v_admin_user_id FROM auth.users WHERE email = 'ph.mar89s@gmail.com' LIMIT 1;
  IF v_admin_user_id IS NULL THEN
    SELECT id INTO v_admin_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  END IF;

  RAISE NOTICE 'workspace_id detectado: %', v_workspace_id;
  RAISE NOTICE 'admin_user_id detectado: %', v_admin_user_id;

  -- ─────────────────────────────────────────────
  -- 1. DEFINIÇÃO DO PROCESSO
  -- ─────────────────────────────────────────────
  INSERT INTO flow_definitions (workspace_id, nome, descricao, modulo, tipo_entidade, ativo, criado_por)
  VALUES (
    v_workspace_id,
    'Solicitação de Refeição',
    'Fluxo completo de solicitação de refeição para equipes de campo',
    'refeicoes',
    'refei_solicitacoes',
    true,
    v_admin_user_id
  )
  RETURNING id INTO v_def_id;

  -- ─────────────────────────────────────────────
  -- 2. VERSÃO 1 (corrente)
  -- ─────────────────────────────────────────────
  INSERT INTO flow_versions (definition_id, versao, descricao, publicado_por, is_current)
  VALUES (v_def_id, 1, 'Versão inicial', v_admin_user_id, true)
  RETURNING id INTO v_ver_id;

  -- Atualizar versao_atual_id
  UPDATE flow_definitions SET versao_atual_id = v_ver_id WHERE id = v_def_id;

  -- ─────────────────────────────────────────────
  -- 3. ETAPAS
  -- ─────────────────────────────────────────────
  INSERT INTO flow_steps (version_id, nome, descricao, ordem, tipo, status_valor, is_initial, config)
  VALUES (v_ver_id, 'Rascunho', 'Solicitação iniciada pelo líder, ainda não enviada', 0, 'inicio', 'rascunho', true,
    '{"cor":"#64748b","icone":"draft"}'::jsonb)
  RETURNING id INTO v_step_rascunho;

  INSERT INTO flow_steps (version_id, nome, descricao, ordem, tipo, status_valor, config)
  VALUES (v_ver_id, 'Aguardando Aprovação', 'Solicitação enviada, aguardando aprovação do supervisor', 1, 'aprovacao', 'pendente',
    '{"cor":"#f59e0b","icone":"clock"}'::jsonb)
  RETURNING id INTO v_step_pendente;

  INSERT INTO flow_steps (version_id, nome, descricao, ordem, tipo, status_valor, config)
  VALUES (v_ver_id, 'Aprovado', 'Aprovado pelo supervisor, aguardando confirmação de entrega', 2, 'normal', 'aprovado',
    '{"cor":"#10b981","icone":"check"}'::jsonb)
  RETURNING id INTO v_step_aprovado;

  INSERT INTO flow_steps (version_id, nome, descricao, ordem, tipo, status_valor, config)
  VALUES (v_ver_id, 'Reprovado', 'Reprovado pelo supervisor', 3, 'normal', 'reprovado',
    '{"cor":"#ef4444","icone":"x-circle"}'::jsonb)
  RETURNING id INTO v_step_reprovado;

  INSERT INTO flow_steps (version_id, nome, descricao, ordem, tipo, status_valor, config)
  VALUES (v_ver_id, 'Entregue', 'Refeição entregue, aguardando fechamento', 4, 'normal', 'entregue',
    '{"cor":"#6366f1","icone":"truck"}'::jsonb)
  RETURNING id INTO v_step_entregue;

  INSERT INTO flow_steps (version_id, nome, descricao, ordem, tipo, status_valor, is_final, config)
  VALUES (v_ver_id, 'Fechado', 'Processo finalizado com sucesso', 5, 'fim', 'fechado', true,
    '{"cor":"#94a3b8","icone":"flag"}'::jsonb)
  RETURNING id INTO v_step_fechado;

  -- ─────────────────────────────────────────────
  -- 4. AÇÕES
  -- ─────────────────────────────────────────────
  INSERT INTO flow_actions (step_id, nome, label, tipo, campos_obrigatorios, requer_confirmacao)
  VALUES (v_step_rascunho, 'enviar', 'Enviar para Aprovação', 'avancar', '[]'::jsonb, false)
  RETURNING id INTO v_act_enviar;

  INSERT INTO flow_actions (step_id, nome, label, tipo, campos_obrigatorios, requer_confirmacao, permissao_modulo, permissao_acao)
  VALUES (v_step_pendente, 'aprovar', 'Aprovar', 'aprovar', '[]'::jsonb, false, 'refeicoes', 'aprovar')
  RETURNING id INTO v_act_aprovar;

  INSERT INTO flow_actions (step_id, nome, label, tipo, campos_obrigatorios, requer_confirmacao, permissao_modulo, permissao_acao)
  VALUES (v_step_pendente, 'reprovar', 'Reprovar', 'reprovar', '["motivo"]'::jsonb, true, 'refeicoes', 'aprovar')
  RETURNING id INTO v_act_reprovar;

  INSERT INTO flow_actions (step_id, nome, label, tipo, campos_obrigatorios, requer_confirmacao)
  VALUES (v_step_aprovado, 'confirmar_entrega', 'Confirmar Entrega', 'avancar', '[]'::jsonb, false)
  RETURNING id INTO v_act_confirmar;

  INSERT INTO flow_actions (step_id, nome, label, tipo, campos_obrigatorios, requer_confirmacao)
  VALUES (v_step_entregue, 'fechar', 'Fechar Processo', 'avancar', '[]'::jsonb, false)
  RETURNING id INTO v_act_fechar;

  INSERT INTO flow_actions (step_id, nome, label, tipo, campos_obrigatorios, requer_confirmacao)
  VALUES (v_step_reprovado, 'reabrir', 'Reabrir para Correção', 'devolver', '[]'::jsonb, false)
  RETURNING id INTO v_act_reabrir;

  -- ─────────────────────────────────────────────
  -- 5. TRANSIÇÕES
  -- ─────────────────────────────────────────────
  -- rascunho → pendente (ao enviar)
  INSERT INTO flow_transitions (version_id, step_origem_id, step_destino_id, acao_id, ordem, label)
  VALUES (v_ver_id, v_step_rascunho, v_step_pendente, v_act_enviar, 0, 'Enviar para aprovação');

  -- pendente → aprovado (ao aprovar)
  INSERT INTO flow_transitions (version_id, step_origem_id, step_destino_id, acao_id, ordem, label)
  VALUES (v_ver_id, v_step_pendente, v_step_aprovado, v_act_aprovar, 0, 'Aprovação confirmada');

  -- pendente → reprovado (ao reprovar)
  INSERT INTO flow_transitions (version_id, step_origem_id, step_destino_id, acao_id, ordem, label)
  VALUES (v_ver_id, v_step_pendente, v_step_reprovado, v_act_reprovar, 0, 'Reprovação registrada');

  -- aprovado → entregue (ao confirmar entrega)
  INSERT INTO flow_transitions (version_id, step_origem_id, step_destino_id, acao_id, ordem, label)
  VALUES (v_ver_id, v_step_aprovado, v_step_entregue, v_act_confirmar, 0, 'Entrega confirmada');

  -- entregue → fechado (ao fechar)
  INSERT INTO flow_transitions (version_id, step_origem_id, step_destino_id, acao_id, ordem, label)
  VALUES (v_ver_id, v_step_entregue, v_step_fechado, v_act_fechar, 0, 'Processo encerrado');

  -- reprovado → rascunho (ao reabrir)
  INSERT INTO flow_transitions (version_id, step_origem_id, step_destino_id, acao_id, ordem, label)
  VALUES (v_ver_id, v_step_reprovado, v_step_rascunho, v_act_reabrir, 0, 'Reaberto para correção');

  -- ─────────────────────────────────────────────
  -- 6. RESPONSÁVEIS POR ETAPA
  -- ─────────────────────────────────────────────
  -- rascunho: líder da equipe (quem iniciou)
  INSERT INTO flow_responsibles (step_id, tipo, config, prioridade)
  VALUES (v_step_rascunho, 'solicitante', '{}'::jsonb, 0);

  -- pendente: supervisor da equipe
  INSERT INTO flow_responsibles (step_id, tipo, config, prioridade)
  VALUES (v_step_pendente, 'supervisor_equipe', '{}'::jsonb, 0);

  -- aprovado: líder (confirma entrega)
  INSERT INTO flow_responsibles (step_id, tipo, config, prioridade)
  VALUES (v_step_aprovado, 'lider_equipe', '{}'::jsonb, 0);

  -- entregue: solicitante (fecha)
  INSERT INTO flow_responsibles (step_id, tipo, config, prioridade)
  VALUES (v_step_entregue, 'solicitante', '{}'::jsonb, 0);

  -- reprovado: solicitante (corrige e reabre)
  INSERT INTO flow_responsibles (step_id, tipo, config, prioridade)
  VALUES (v_step_reprovado, 'solicitante', '{}'::jsonb, 0);

  -- ─────────────────────────────────────────────
  -- 7. SLA POR ETAPA
  -- ─────────────────────────────────────────────
  -- Aprovação deve ocorrer em até 2 horas (horário comercial)
  INSERT INTO flow_sla_rules (step_id, prazo_horas, tipo_calendario, acao_no_vencimento)
  VALUES (v_step_pendente, 2, 'horario_comercial', 'lembrete');

  -- Confirmação de entrega em até 4 horas
  INSERT INTO flow_sla_rules (step_id, prazo_horas, tipo_calendario, acao_no_vencimento)
  VALUES (v_step_aprovado, 4, 'corrido', 'lembrete');

  -- ─────────────────────────────────────────────
  -- 8. FEATURE FLAG (desligada por padrão)
  -- ─────────────────────────────────────────────
  INSERT INTO configuracoes (workspace_id, chave, valor, user_id)
  SELECT v_workspace_id, 'flow_engine_refeicoes', 'false', v_admin_user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM configuracoes
    WHERE workspace_id = v_workspace_id AND chave = 'flow_engine_refeicoes'
  );

  RAISE NOTICE '✅ Processo "Solicitação de Refeição" criado com sucesso!';
  RAISE NOTICE '   definition_id: %', v_def_id;
  RAISE NOTICE '   version_id:    %', v_ver_id;
  RAISE NOTICE '   Etapas: rascunho → pendente → aprovado → entregue → fechado';
  RAISE NOTICE '   Para ativar: UPDATE configuracoes SET valor = ''true'' WHERE chave = ''flow_engine_refeicoes'' AND workspace_id = ''%'';', v_workspace_id;

END $$;
