-- Adiciona colunas numero_os e numero_req à tabela solicitacoes_compra
-- Ambas opcionais (texto livre), indexadas para buscas futuras

ALTER TABLE solicitacoes_compra
  ADD COLUMN IF NOT EXISTS numero_os   TEXT,
  ADD COLUMN IF NOT EXISTS numero_req  TEXT;

COMMENT ON COLUMN solicitacoes_compra.numero_os  IS 'Número da Ordem de Serviço vinculada à requisição';
COMMENT ON COLUMN solicitacoes_compra.numero_req IS 'Número interno da requisição (identificador do solicitante)';

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'solicitacoes_compra'
  AND column_name IN ('numero_os', 'numero_req');
