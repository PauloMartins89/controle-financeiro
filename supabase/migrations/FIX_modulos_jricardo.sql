-- ============================================================
-- DIAGNÓSTICO — rode este bloco PRIMEIRO para entender o estado
-- ============================================================

-- 1. User ID de Joao
SELECT id, email FROM auth.users WHERE email = 'jricardo.gpx@gmail.com';

-- 2. Workspaces onde Joao é membro (esperamos 0 linhas — esse é o bug)
SELECT wm.workspace_id, w.nome
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = (SELECT id FROM auth.users WHERE email = 'jricardo.gpx@gmail.com');

-- 3. Workspaces que podem ser dele (criados pela migration com mesmo nome)
SELECT id, nome, tipo, plano, created_at
FROM workspaces
WHERE nome ILIKE '%joao%' OR nome ILIKE '%ricardo%' OR nome ILIKE '%jricardo%'
ORDER BY created_at;


-- ============================================================
-- CORREÇÃO COMPLETA — rode este bloco depois de ver o diagnóstico
-- Cria workspace, vincula Joao e configura módulos
-- ============================================================

DO $$
DECLARE
  v_user_id      UUID;
  v_workspace_id UUID;
  modulos_habilitados TEXT[] := ARRAY[
    'refeicoes',
    'proventos',
    'chat_ia'
  ];
  todos_modulos TEXT[] := ARRAY[
    'dashboard','despesas','acertos','recorrentes','cartoes','grupos','pessoas',
    'veiculos','timeline','balanco','previsao','proventos','negocios',
    'central','lancamentos','cadastros','faturamento','compras','refeicoes',
    'importar','escanear','notas-fiscais','chat_ia',
    'inicio','historico','caixa'
  ];
  m TEXT;
BEGIN
  -- Busca user_id de Joao
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'jricardo.gpx@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário jricardo.gpx@gmail.com não encontrado em auth.users';
  END IF;

  RAISE NOTICE 'User ID de Joao: %', v_user_id;

  -- Tenta reaproveitar workspace já existente com nome parecido
  SELECT id INTO v_workspace_id
  FROM workspaces
  WHERE nome ILIKE '%joao%' OR nome ILIKE '%ricardo%' OR nome ILIKE '%jricardo%'
  ORDER BY created_at
  LIMIT 1;

  -- Se não encontrou, cria um novo
  IF v_workspace_id IS NULL THEN
    INSERT INTO workspaces (nome, descricao, tipo, plano)
    VALUES ('Joao Ricardo Martins', 'Workspace de Joao Ricardo', 'empresa', 'basico')
    RETURNING id INTO v_workspace_id;
    RAISE NOTICE 'Workspace criado: %', v_workspace_id;
  ELSE
    RAISE NOTICE 'Workspace reutilizado: %', v_workspace_id;
  END IF;

  -- Vincula Joao como membro (se ainda não for)
  INSERT INTO workspace_members (workspace_id, user_id, ativo)
  VALUES (v_workspace_id, v_user_id, true)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RAISE NOTICE 'Membro vinculado ao workspace';

  -- Configura todos os módulos: enabled=true apenas para os habilitados
  FOREACH m IN ARRAY todos_modulos LOOP
    INSERT INTO workspace_modules (workspace_id, module_key, enabled)
    VALUES (v_workspace_id, m, m = ANY(modulos_habilitados))
    ON CONFLICT (workspace_id, module_key)
    DO UPDATE SET enabled = m = ANY(modulos_habilitados);
  END LOOP;

  RAISE NOTICE 'Concluído! workspace_id=%, modulos_habilitados=%', v_workspace_id, modulos_habilitados;
END;
$$;

-- Confirma o resultado final:
SELECT wm.workspace_id, w.nome, wmod.module_key, wmod.enabled
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
JOIN workspace_modules wmod ON wmod.workspace_id = wm.workspace_id
WHERE wm.user_id = (SELECT id FROM auth.users WHERE email = 'jricardo.gpx@gmail.com')
ORDER BY wmod.enabled DESC, wmod.module_key;
