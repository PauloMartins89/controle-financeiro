-- ════════════════════════════════════════════════════════════
-- SmartPro Flow Center — Diagnóstico e Teste
-- Execute passo a passo no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

-- ─── PASSO 1: Verificar se o processo foi criado ──────────────────────────────
SELECT
  d.id          AS definition_id,
  d.nome,
  d.modulo,
  d.tipo_entidade,
  d.ativo,
  v.id          AS version_id,
  v.versao,
  v.is_current
FROM flow_definitions d
JOIN flow_versions v ON v.definition_id = d.id
WHERE d.modulo = 'refeicoes';

-- ─── PASSO 2: Ver as etapas do processo ──────────────────────────────────────
SELECT
  s.ordem,
  s.nome,
  s.tipo,
  s.status_valor,
  s.is_initial,
  s.is_final,
  COUNT(a.id) AS qtd_acoes
FROM flow_steps s
LEFT JOIN flow_actions a ON a.step_id = s.id
JOIN flow_versions v ON v.id = s.version_id
JOIN flow_definitions d ON d.id = v.definition_id
WHERE d.modulo = 'refeicoes'
GROUP BY s.id, s.ordem, s.nome, s.tipo, s.status_valor, s.is_initial, s.is_final
ORDER BY s.ordem;

-- ─── PASSO 3: Ver as ações disponíveis por etapa ─────────────────────────────
SELECT
  s.nome AS etapa,
  a.nome,
  a.label,
  a.tipo,
  a.campos_obrigatorios
FROM flow_actions a
JOIN flow_steps s ON s.id = a.step_id
JOIN flow_versions v ON v.id = s.version_id
JOIN flow_definitions d ON d.id = v.definition_id
WHERE d.modulo = 'refeicoes'
ORDER BY s.ordem, a.tipo;

-- ─── PASSO 4: Ver as transições ──────────────────────────────────────────────
SELECT
  so.nome AS de,
  sd.nome AS para,
  a.label AS acao,
  t.condicao,
  t.ordem
FROM flow_transitions t
JOIN flow_steps so ON so.id = t.step_origem_id
JOIN flow_steps sd ON sd.id = t.step_destino_id
LEFT JOIN flow_actions a ON a.id = t.acao_id
JOIN flow_versions v ON v.id = t.version_id
JOIN flow_definitions d ON d.id = v.definition_id
WHERE d.modulo = 'refeicoes'
ORDER BY so.ordem, t.ordem;

-- ─── PASSO 5: Feature flag atual ─────────────────────────────────────────────
SELECT workspace_id, chave, valor, user_id
FROM configuracoes
WHERE chave = 'flow_engine_refeicoes';

-- ─── PASSO 6: Pegar uma solicitação pendente para teste ──────────────────────
SELECT id, numero_pedido, status, equipe_id, workspace_id
FROM refei_solicitacoes
WHERE status = 'pendente'
ORDER BY criado_em DESC
LIMIT 5;

-- ─── PASSO 7: Criar instância de teste para a 1ª solicitação pendente ─────────
-- (substitua os IDs pelos valores dos passos acima)
DO $$
DECLARE
  v_def_id      uuid;
  v_ver_id      uuid;
  v_step_id     uuid;
  v_sol_id      uuid;
  v_workspace   uuid;
  v_user_id     uuid;
  v_inst_id     uuid;
BEGIN
  -- Pegar definition + version
  SELECT d.id, v.id INTO v_def_id, v_ver_id
  FROM flow_definitions d
  JOIN flow_versions v ON v.definition_id = d.id AND v.is_current = true
  WHERE d.modulo = 'refeicoes' LIMIT 1;

  -- Pegar etapa inicial
  SELECT id INTO v_step_id FROM flow_steps WHERE version_id = v_ver_id AND is_initial = true;

  -- Pegar a primeira solicitação pendente (para ter dado real)
  SELECT id, workspace_id INTO v_sol_id, v_workspace
  FROM refei_solicitacoes WHERE status = 'pendente' ORDER BY criado_em DESC LIMIT 1;

  -- Pegar admin
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ph.mar89s@gmail.com' LIMIT 1;

  IF v_sol_id IS NULL THEN
    RAISE NOTICE 'Nenhuma solicitação pendente encontrada. Crie uma primeiro.';
    RETURN;
  END IF;

  -- Verificar se já existe instância ativa
  SELECT id INTO v_inst_id FROM flow_instances
  WHERE entidade_tipo = 'refei_solicitacoes' AND entidade_id = v_sol_id AND status = 'ativo';

  IF v_inst_id IS NOT NULL THEN
    RAISE NOTICE 'Instância já existe: %', v_inst_id;
    RETURN;
  END IF;

  -- Criar instância na etapa "pendente" (a sol já está pendente)
  -- Primeiro cria na etapa inicial (rascunho)
  INSERT INTO flow_instances (workspace_id, definition_id, version_id, entidade_tipo, entidade_id, current_step_id, status, iniciado_por, dados_contexto)
  VALUES (v_workspace, v_def_id, v_ver_id, 'refei_solicitacoes', v_sol_id, v_step_id, 'ativo', v_user_id, '{}')
  RETURNING id INTO v_inst_id;

  -- Avançar para etapa "pendente" (onde a sol já está)
  DECLARE
    v_step_pendente uuid;
    v_acao_enviar   uuid;
  BEGIN
    SELECT id INTO v_step_pendente FROM flow_steps WHERE version_id = v_ver_id AND status_valor = 'pendente';
    SELECT id INTO v_acao_enviar FROM flow_actions WHERE step_id = v_step_id AND nome = 'enviar';

    UPDATE flow_instances SET current_step_id = v_step_pendente WHERE id = v_inst_id;

    INSERT INTO flow_history (instance_id, step_id, workspace_id, acao_id, acao_nome, executado_por_id, origem, step_origem_nome, step_destino_nome, status_antes, status_depois)
    VALUES (v_inst_id, v_step_pendente, v_workspace, v_acao_enviar, 'enviar', v_user_id, 'sistema', 'Rascunho', 'Aguardando Aprovação', 'rascunho', 'pendente');
  END;

  RAISE NOTICE '✅ Instância criada: %', v_inst_id;
  RAISE NOTICE '   solicitacao_id: %', v_sol_id;
  RAISE NOTICE '   Agora acesse o painel, abra essa solicitação e clique Aprovar/Reprovar com a flag ligada.';
END $$;

-- ─── PASSO 8: Verificar instâncias criadas ────────────────────────────────────
SELECT
  i.id AS instance_id,
  i.entidade_id AS solicitacao_id,
  i.status,
  s.nome AS etapa_atual,
  s.status_valor,
  i.created_at
FROM flow_instances i
JOIN flow_steps s ON s.id = i.current_step_id
WHERE i.entidade_tipo = 'refei_solicitacoes'
ORDER BY i.created_at DESC
LIMIT 10;

-- ─── PASSO 9: Ver histórico de uma instância ─────────────────────────────────
-- (substitua <INSTANCE_ID> pelo id retornado no passo 8)
/*
SELECT acao_nome, step_origem_nome, step_destino_nome, status_antes, status_depois, executado_por_id, origem, created_at
FROM flow_history
WHERE instance_id = '<INSTANCE_ID>'
ORDER BY created_at;
*/

-- ─── PASSO 10: Ativar feature flag ───────────────────────────────────────────
-- Descomente quando quiser ligar o motor para Refeições:
/*
UPDATE configuracoes
SET valor = 'true'
WHERE chave = 'flow_engine_refeicoes';
*/
