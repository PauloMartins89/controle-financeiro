-- ============================================================
-- HELPER: Criar acesso de Líder no SmartLíder App
--
-- Como funciona:
--   - O líder entra APENAS com a matrícula no app
--   - O app deriva internamente: email = "{matricula}@lider.smartpro"
--                                senha = matrícula
--
-- PASSO 1: Cole e execute o bloco CREATE FUNCTION abaixo
-- PASSO 2: Em seguida chame SELECT criar_acesso_lider(...)
-- ============================================================

-- Garante extensão de criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cria ou substitui a função
CREATE OR REPLACE FUNCTION criar_acesso_lider(
  p_workspace_id uuid,
  p_matricula    text,
  p_nome         text,
  p_equipe_id    uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public, auth
AS $$
DECLARE
  v_email    text;
  v_user_id  uuid;
BEGIN
  v_email := p_matricula || '@lider.smartpro';

  -- Verifica se já existe
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    -- Cria novo usuário
    INSERT INTO auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    )
    VALUES (
      gen_random_uuid(), 'authenticated', 'authenticated',
      v_email, crypt(p_matricula, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('matricula', p_matricula, 'nome', p_nome, 'role', 'lider'),
      false, now(), now(), '', '', '', ''
    )
    RETURNING id INTO v_user_id;

    -- ESSENCIAL: criar identity para o provider "email"
    -- Sem isso o Supabase Auth rejeita o login
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_email,
      now(), now(), now()
    );
  ELSE
    -- Atualiza metadados se já existir
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_build_object('matricula', p_matricula, 'nome', p_nome, 'role', 'lider'),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Vincula à equipe se informado
  IF p_equipe_id IS NOT NULL THEN
    UPDATE lider_equipes
    SET lider_id   = v_user_id,
        lider_nome = p_nome
    WHERE id           = p_equipe_id
      AND workspace_id = p_workspace_id;
  END IF;

  RETURN 'OK — Líder: ' || p_nome
      || ' | matrícula: ' || p_matricula
      || ' | login: ' || v_email;
END;
$$;

-- ─── EXEMPLOS DE USO (rode APÓS criar a função acima) ────────
--
-- Criar um líder simples:
-- SELECT criar_acesso_lider(
--   '00000000-0000-0000-0000-000000000001',
--   '1042',
--   'João da Silva'
-- );
--
-- Criar e já vincular à equipe:
-- SELECT criar_acesso_lider(
--   '00000000-0000-0000-0000-000000000001',
--   '1042',
--   'João da Silva',
--   (SELECT id FROM lider_equipes WHERE nome = 'Frente 07 - Equipe A')
-- );
