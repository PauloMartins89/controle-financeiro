-- Configuração de módulos visíveis para Birigui
-- Workspace: BIRIGUI - SOLUCOES SUSTENTAVEIS (71eee268-082e-49d9-a613-9387595ea6d5)
-- Módulos ativos: gerencial, compras, agendamentos
-- Todos os demais desabilitados → sidebar mostra apenas os 3 grupos

INSERT INTO workspace_modules (workspace_id, module_key, enabled)
VALUES
  -- ✅ habilitados
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'gerencial',      true),
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'compras',        true),
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'agendamentos',   true),
  -- ❌ desabilitados
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'financeiropro',  false),
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'prospectar',     false),
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'faturamento',    false),
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'automacao',      false),
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'refeicoes',      false),
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'smartlider',     false),
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'manutencao',     false),
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'maquinas',       false),
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'importar',       false),
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'escanear',       false),
  ('71eee268-082e-49d9-a613-9387595ea6d5', 'notas-fiscais',  false)
ON CONFLICT (workspace_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled;

-- Verificar resultado
SELECT module_key, enabled
FROM workspace_modules
WHERE workspace_id = '71eee268-082e-49d9-a613-9387595ea6d5'
ORDER BY enabled DESC, module_key;
