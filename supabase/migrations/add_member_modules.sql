-- Adiciona coluna de módulos por membro (whitelist por usuário)
-- NULL  = herda todos os módulos habilitados no workspace
-- []    = sem acesso a nenhum módulo
-- [...] = apenas estes moduleKeys são visíveis para este membro
ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS modules text[];
