-- Contador atômico para numeração de pedidos de refeição
-- Garante unicidade mesmo com múltiplas requisições simultâneas

CREATE TABLE IF NOT EXISTS refei_contadores (
  workspace_id uuid NOT NULL,
  ano          int  NOT NULL,
  ultimo       int  NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, ano)
);

-- Inicializa contadores para workspaces já existentes
INSERT INTO refei_contadores (workspace_id, ano, ultimo)
SELECT
  workspace_id,
  CAST(SPLIT_PART(numero_pedido, '-', 2) AS int) AS ano,
  MAX(CAST(SPLIT_PART(numero_pedido, '-', 3) AS int)) AS ultimo
FROM refei_solicitacoes
WHERE numero_pedido ~ '^REF-[0-9]{4}-[0-9]+$'
GROUP BY workspace_id, CAST(SPLIT_PART(numero_pedido, '-', 2) AS int)
ON CONFLICT (workspace_id, ano) DO UPDATE
  SET ultimo = GREATEST(refei_contadores.ultimo, EXCLUDED.ultimo);

-- Função atômica: INSERT na primeira chamada (inicializa do MAX existente),
-- UPDATE nas demais. O ON CONFLICT garante que requisições simultâneas
-- se serializam via row-level lock do PostgreSQL.
CREATE OR REPLACE FUNCTION get_next_refei_number(p_workspace_id uuid, p_ano int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_num int;
BEGIN
  INSERT INTO refei_contadores (workspace_id, ano, ultimo)
  VALUES (
    p_workspace_id,
    p_ano,
    COALESCE((
      SELECT MAX(CAST(SPLIT_PART(numero_pedido, '-', 3) AS int))
      FROM refei_solicitacoes
      WHERE workspace_id = p_workspace_id
        AND numero_pedido ~ ('^REF-' || p_ano || '-[0-9]+$')
    ), 0) + 1
  )
  ON CONFLICT (workspace_id, ano)
  DO UPDATE SET ultimo = refei_contadores.ultimo + 1
  RETURNING ultimo INTO v_num;

  RETURN v_num;
END;
$$;
