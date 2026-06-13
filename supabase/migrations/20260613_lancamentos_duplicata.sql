-- Controle de duplicidade em lançamentos gerados por OCR
-- duplicata = true  → mesmo número de documento E mesmos dados → excluído dos cálculos
-- duplicata_de_id   → aponta para o lançamento original (o primeiro recebido)

ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS duplicata       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicata_de_id uuid REFERENCES lancamentos(id) ON DELETE SET NULL;

-- Índice para filtrar duplicatas rapidamente na UI
CREATE INDEX IF NOT EXISTS idx_lancamentos_duplicata ON lancamentos(workspace_id, duplicata)
  WHERE duplicata = true;
