-- Garante que todos os módulos conhecidos existam e estejam habilitados
-- para todos os workspaces existentes.
-- Módulos que não existiam no trigger original (central, lancamentos, etc.)
-- são inseridos como enabled=true via INSERT ... ON CONFLICT DO UPDATE.

DO $$
DECLARE
  ALL_MODULES TEXT[] := ARRAY[
    'inicio','despesas','acertos','recorrentes','cartoes',
    'grupos','pessoas','veiculos','historico','balanco','caixa',
    'negocios','proventos','importar','escanear','notas-fiscais',
    'central','lancamentos','cadastros','faturamento',
    'compras','refeicoes'
  ];
  ws RECORD;
  m  TEXT;
BEGIN
  FOR ws IN SELECT id FROM workspaces LOOP
    FOREACH m IN ARRAY ALL_MODULES LOOP
      INSERT INTO workspace_modules (workspace_id, module_key, enabled)
      VALUES (ws.id, m, true)
      ON CONFLICT (workspace_id, module_key)
      DO UPDATE SET enabled = true;
    END LOOP;
  END LOOP;
END;
$$;

-- Atualiza o trigger de novo cadastro para incluir TODOS os módulos atuais
CREATE OR REPLACE FUNCTION create_workspace_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ws_id  UUID;
  u_nome TEXT;
  MODULES TEXT[] := ARRAY[
    'inicio','despesas','acertos','recorrentes','cartoes',
    'grupos','pessoas','veiculos','historico','balanco','caixa',
    'negocios','proventos','importar','escanear','notas-fiscais',
    'central','lancamentos','cadastros','faturamento',
    'compras','refeicoes'
  ];
  m TEXT;
BEGIN
  u_nome := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email);

  INSERT INTO workspaces (nome, descricao)
  VALUES (u_nome, 'Workspace pessoal')
  RETURNING id INTO ws_id;

  INSERT INTO workspace_members (workspace_id, user_id)
  VALUES (ws_id, NEW.id)
  ON CONFLICT DO NOTHING;

  FOREACH m IN ARRAY MODULES LOOP
    INSERT INTO workspace_modules (workspace_id, module_key, enabled)
    VALUES (ws_id, m, true)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;
