-- Define filtro padrão de Lançamentos como 'rdo' para o workspace Birigui
-- Birigui não usa Diário do Motorista — a view deve abrir direto no RDO
-- workspace_config já existe (criada em 20260610_workspace_config.sql)

UPDATE workspace_config
SET config = config || '{"ui":{"lancamentos":{"default_filter":"rdo"}}}'
WHERE workspace_id = '71eee268-082e-49d9-a613-9387595ea6d5';

-- Se a linha ainda não existir (primeira vez rodando workspace_config):
INSERT INTO workspace_config (workspace_id, config)
VALUES (
  '71eee268-082e-49d9-a613-9387595ea6d5',
  '{"ui":{"lancamentos":{"valorColBg":"#fef9c3","default_filter":"rdo"}}}'
)
ON CONFLICT (workspace_id) DO NOTHING;

-- Verificação
SELECT workspace_id,
       config->'ui'->'lancamentos'->>'default_filter' AS default_filter,
       config->'ui'->'lancamentos'->>'valorColBg'     AS valor_col_bg
FROM workspace_config
WHERE workspace_id = '71eee268-082e-49d9-a613-9387595ea6d5';
