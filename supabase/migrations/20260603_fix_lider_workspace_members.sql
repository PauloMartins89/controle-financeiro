-- ══════════════════════════════════════════════════════════════════════════
-- FIX: Líderes não estavam sendo adicionados a workspace_members
-- Causa: criar_acesso_lider() inseria em lider_perfis mas não em workspace_members
-- O RLS de lider_turnos (e demais lider_*) depende de my_workspace_ids()
-- que consulta workspace_members — retornava vazio → INSERT bloqueado.
--
-- Solução:
--   1. Backfill: insere todos os lider_perfis existentes em workspace_members
--   2. Trigger: auto-insere em workspace_members ao inserir/atualizar lider_perfis
--   3. Atualiza criar_acesso_lider() para incluir o upsert em workspace_members
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1. BACKFILL ─────────────────────────────────────────────────────────────
-- Insere todos os líderes com user_id definido em workspace_members
INSERT INTO workspace_members (workspace_id, user_id)
SELECT workspace_id, user_id
FROM   lider_perfis
WHERE  user_id IS NOT NULL
  AND  workspace_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- ─── 2. TRIGGER FUNCTION ────────────────────────────────────────────────────
-- Garante que qualquer novo perfil (ou update com user_id) também entre
-- em workspace_members automaticamente
CREATE OR REPLACE FUNCTION auto_add_lider_to_workspace_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.workspace_id IS NOT NULL THEN
    INSERT INTO workspace_members (workspace_id, user_id)
    VALUES (NEW.workspace_id, NEW.user_id)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lider_auto_workspace_member ON lider_perfis;
CREATE TRIGGER trg_lider_auto_workspace_member
  AFTER INSERT OR UPDATE OF user_id, workspace_id
  ON lider_perfis
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_lider_to_workspace_members();

-- ─── 3. ATUALIZA criar_acesso_lider() ────────────────────────────────────────
-- Adiciona upsert em workspace_members após inserir em lider_perfis
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
      jsonb_build_object('matricula', p_matricula, 'nome', p_nome, 'role', 'lider', 'workspace_id', p_workspace_id),
      false, now(), now(), '', '', '', ''
    )
    RETURNING id INTO v_user_id;

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
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_build_object(
          'matricula', p_matricula, 'nome', p_nome,
          'role', 'lider', 'workspace_id', p_workspace_id
        ),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Vincula à equipe se informado
  IF p_equipe_id IS NOT NULL THEN
    UPDATE lider_equipes
    SET lider_id    = v_user_id,
        lider_nome  = p_nome,
        lider_email = v_email
    WHERE id           = p_equipe_id
      AND workspace_id = p_workspace_id;
  END IF;

  -- Upsert em lider_perfis
  INSERT INTO lider_perfis (workspace_id, user_id, matricula, nome, equipe_id)
  VALUES (p_workspace_id, v_user_id, p_matricula, p_nome, p_equipe_id)
  ON CONFLICT (user_id)
  DO UPDATE SET
    nome       = EXCLUDED.nome,
    equipe_id  = COALESCE(EXCLUDED.equipe_id, lider_perfis.equipe_id),
    updated_at = now();

  -- Garante entrada em workspace_members (o trigger já faz isso, mas por segurança)
  INSERT INTO workspace_members (workspace_id, user_id)
  VALUES (p_workspace_id, v_user_id)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN 'OK — Líder: ' || p_nome
      || ' | matrícula: ' || p_matricula
      || ' | login: ' || v_email;
END;
$$;
