-- ============================================================
-- MIGRATION: lider_perfis
-- Tabela de perfis dos líderes do app SmartLíder.
-- Porta de acesso: ao fazer login, o app carrega tudo a partir
-- desta tabela (workspace, equipe, frente, turno habitual).
-- ============================================================

CREATE TABLE IF NOT EXISTS lider_perfis (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid        NOT NULL,
  user_id        uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  matricula      text        NOT NULL,
  nome           text,
  equipe_id      uuid        REFERENCES lider_equipes(id) ON DELETE SET NULL,
  ativo          boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (workspace_id, matricula)
);

-- RLS: mesma política dos demais objetos lider_ (authenticated pode tudo)
ALTER TABLE lider_perfis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lider_auth_all" ON lider_perfis;
CREATE POLICY "lider_auth_all" ON lider_perfis
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── Atualiza função criar_acesso_lider para popular lider_perfis ─────────
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

  RETURN 'OK — Líder: ' || p_nome
      || ' | matrícula: ' || p_matricula
      || ' | login: ' || v_email;
END;
$$;

-- ─── Backfill: popula lider_perfis com líderes já existentes ─────────────
-- DISTINCT ON garante uma linha por lider_id (evita conflito duplo no upsert)
INSERT INTO lider_perfis (workspace_id, user_id, matricula, nome, equipe_id)
SELECT DISTINCT ON (e.lider_id)
  e.workspace_id,
  e.lider_id,
  split_part(u.email, '@', 1) AS matricula,
  e.lider_nome,
  e.id
FROM lider_equipes e
JOIN auth.users u ON u.id = e.lider_id
WHERE e.lider_id IS NOT NULL
  AND e.ativo = true
ORDER BY e.lider_id, e.created_at DESC
ON CONFLICT (user_id)
DO UPDATE SET
  equipe_id  = EXCLUDED.equipe_id,
  nome       = COALESCE(EXCLUDED.nome, lider_perfis.nome),
  updated_at = now();
