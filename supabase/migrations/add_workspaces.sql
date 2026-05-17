-- ============================================================
-- add_workspaces.sql
-- Sistema multi-workspace: cada empresa contratante é um workspace.
-- Usuários vinculados ao workspace compartilham os mesmos dados.
-- Admin (você) gerencia workspaces e módulos via /admin.
-- ============================================================

-- 1. Workspaces (empresas contratantes)
CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  descricao   TEXT,
  plano       TEXT DEFAULT 'basico',
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Membros do workspace (usuários vinculados à empresa)
CREATE TABLE IF NOT EXISTS workspace_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- 3. Módulos habilitados por workspace
CREATE TABLE IF NOT EXISTS workspace_modules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  module_key   TEXT NOT NULL,
  enabled      BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, module_key)
);

-- 4. Adicionar workspace_id nas tabelas de dados existentes
ALTER TABLE pessoas       ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE grupos        ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE despesas      ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE cartoes       ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE recorrentes   ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE veiculos      ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE negocios      ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE proventos     ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE closures      ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);

-- 5. RLS nas novas tabelas
ALTER TABLE workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_modules ENABLE ROW LEVEL SECURITY;

-- workspaces: membro vê o próprio workspace
CREATE POLICY "members_see_own_workspace" ON workspaces
  FOR SELECT USING (
    id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- workspace_members: membro vê outros membros do mesmo workspace
CREATE POLICY "members_see_own_members" ON workspace_members
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- workspace_modules: membro vê os módulos do próprio workspace
CREATE POLICY "members_see_own_modules" ON workspace_modules
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- 6. Migração dos dados existentes:
--    Para cada usuário que já tem dados, cria um workspace pessoal
--    e popula workspace_id em todas as tabelas.
DO $$
DECLARE
  rec    RECORD;
  ws_id  UUID;
  MODULES TEXT[] := ARRAY[
    'inicio','despesas','acertos','recorrentes','cartoes',
    'grupos','pessoas','veiculos','historico','balanco','caixa',
    'negocios','proventos','importar','escanear','notas-fiscais'
  ];
  m TEXT;
BEGIN
  FOR rec IN
    SELECT DISTINCT u.id, u.email,
           u.raw_user_meta_data->>'full_name' AS nome
    FROM auth.users u
    WHERE u.id IN (
      SELECT DISTINCT user_id FROM pessoas WHERE user_id IS NOT NULL
      UNION
      SELECT DISTINCT user_id FROM despesas WHERE user_id IS NOT NULL
    )
  LOOP
    -- Cria workspace pessoal para o usuário
    INSERT INTO workspaces (nome, descricao)
    VALUES (COALESCE(NULLIF(TRIM(rec.nome), ''), rec.email), 'Workspace pessoal')
    RETURNING id INTO ws_id;

    -- Adiciona usuário como membro
    INSERT INTO workspace_members (workspace_id, user_id)
    VALUES (ws_id, rec.id)
    ON CONFLICT DO NOTHING;

    -- Popula workspace_id em todas as tabelas desse usuário
    UPDATE pessoas       SET workspace_id = ws_id WHERE user_id = rec.id AND workspace_id IS NULL;
    UPDATE grupos        SET workspace_id = ws_id WHERE user_id = rec.id AND workspace_id IS NULL;
    UPDATE despesas      SET workspace_id = ws_id WHERE user_id = rec.id AND workspace_id IS NULL;
    UPDATE cartoes       SET workspace_id = ws_id WHERE user_id = rec.id AND workspace_id IS NULL;
    UPDATE recorrentes   SET workspace_id = ws_id WHERE user_id = rec.id AND workspace_id IS NULL;
    UPDATE veiculos      SET workspace_id = ws_id WHERE user_id = rec.id AND workspace_id IS NULL;
    UPDATE negocios      SET workspace_id = ws_id WHERE user_id = rec.id AND workspace_id IS NULL;
    UPDATE proventos     SET workspace_id = ws_id WHERE user_id = rec.id AND workspace_id IS NULL;
    UPDATE closures      SET workspace_id = ws_id WHERE user_id = rec.id AND workspace_id IS NULL;
    UPDATE configuracoes SET workspace_id = ws_id WHERE user_id = rec.id AND workspace_id IS NULL;

    -- Habilita todos os módulos por padrão
    FOREACH m IN ARRAY MODULES LOOP
      INSERT INTO workspace_modules (workspace_id, module_key, enabled)
      VALUES (ws_id, m, true)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- 7. Trigger: cria workspace automaticamente ao confirmar email
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

-- Trigger dispara junto com o de assinaturas (mesmo evento de email confirmado)
DROP TRIGGER IF EXISTS on_auth_user_confirmed_workspace ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_workspace
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION create_workspace_on_signup();

-- 8. Admin (ph.mar89s@gmail.com) bypassa RLS — pode ver e gerenciar todos os workspaces
CREATE POLICY "admin_all_workspaces" ON workspaces
  FOR ALL USING (auth.email() = 'ph.mar89s@gmail.com')
  WITH CHECK (auth.email() = 'ph.mar89s@gmail.com');

CREATE POLICY "admin_all_members" ON workspace_members
  FOR ALL USING (auth.email() = 'ph.mar89s@gmail.com')
  WITH CHECK (auth.email() = 'ph.mar89s@gmail.com');

CREATE POLICY "admin_all_modules" ON workspace_modules
  FOR ALL USING (auth.email() = 'ph.mar89s@gmail.com')
  WITH CHECK (auth.email() = 'ph.mar89s@gmail.com');
