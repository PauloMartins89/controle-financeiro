-- ============================================================
-- fix_trigger_exceptions.sql
-- Torna os triggers on_auth_user_confirmed tolerantes a falhas.
-- Sem este fix, qualquer erro interno (constraint, etc.) impede
-- a confirmação de e-mail via Admin API (retorna 500).
-- ============================================================

-- 1. Trigger de assinaturas: tolerante a erros
CREATE OR REPLACE FUNCTION create_trial_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.assinaturas (user_id, email, status, trial_expires_at)
  VALUES (NEW.id, NEW.email, 'trial', now() + interval '7 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_trial_on_signup] erro ignorado: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Trigger de workspace: tolerante a erros + evita workspace duplicado
CREATE OR REPLACE FUNCTION create_workspace_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ws_id  UUID;
  u_nome TEXT;
  MODULES TEXT[] := ARRAY[
    'inicio','despesas','acertos','recorrentes','cartoes',
    'grupos','pessoas','veiculos','historico','balanco','caixa',
    'negocios','proventos','importar','escanear','notas-fiscais'
  ];
  m TEXT;
BEGIN
  -- Se usuário já tem workspace (admin vinculou via painel), não cria outro
  SELECT workspace_id INTO ws_id
  FROM workspace_members
  WHERE user_id = NEW.id
  LIMIT 1;

  IF ws_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  u_nome := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email);

  INSERT INTO workspaces (nome, descricao, tipo)
  VALUES (u_nome, 'Workspace pessoal', 'empresa')
  RETURNING id INTO ws_id;

  INSERT INTO workspace_members (workspace_id, user_id, ativo)
  VALUES (ws_id, NEW.id, true)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  FOREACH m IN ARRAY MODULES LOOP
    INSERT INTO workspace_modules (workspace_id, module_key, enabled)
    VALUES (ws_id, m, true)
    ON CONFLICT (workspace_id, module_key) DO NOTHING;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_workspace_on_signup] erro ignorado: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Função auxiliar: confirmar e-mail diretamente via SQL (bypass GoTrue API)
--    Chamada via db.rpc('admin_confirm_user_email', { p_email: '...' })
--    SECURITY DEFINER garante que roda com permissão de superusuário
CREATE OR REPLACE FUNCTION admin_confirm_user_email(p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE email = lower(trim(p_email))
    AND email_confirmed_at IS NULL;
END;
$$;

-- Restringe execução: apenas service_role pode chamar esta função
REVOKE ALL ON FUNCTION admin_confirm_user_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_confirm_user_email(text) TO service_role;
