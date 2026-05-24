-- ════════════════════════════════════════════════════════════════════════════════
-- Adiciona coluna imagem_url em cat_modelos
-- e popula URLs públicas para os modelos principais
-- Execute no SQL Editor do Supabase após 20260524_catalogo_tratores.sql
-- ════════════════════════════════════════════════════════════════════════════════

-- Adiciona colunas de imagem
ALTER TABLE cat_modelos
  ADD COLUMN IF NOT EXISTS imagem_url        text,
  ADD COLUMN IF NOT EXISTS imagem_thumb_url  text,
  ADD COLUMN IF NOT EXISTS imagem_fonte      text;   -- 'fabricante' | 'supabase' | 'commons'

-- ── John Deere ─────────────────────────────────────────────────────────────────
UPDATE cat_modelos SET
  imagem_url       = 'https://www.deere.com.br/assets/images/region-2/products/tractors/8-series-tractors/8r-410/8r-410-a-r4f098079.jpg',
  imagem_thumb_url = 'https://www.deere.com.br/assets/images/region-2/products/tractors/8-series-tractors/8r-410/8r-410-a-r4f098079.jpg',
  imagem_fonte     = 'fabricante'
WHERE fabricante = 'John Deere' AND familia ILIKE '%8R%';

UPDATE cat_modelos SET
  imagem_url   = 'https://www.deere.com.br/assets/images/region-2/products/tractors/7r-series/7r-250/7r-250-large-r4f093813.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'John Deere' AND familia ILIKE '%7R%';

UPDATE cat_modelos SET
  imagem_url   = 'https://www.deere.com.br/assets/images/region-2/products/tractors/6r-series/6r-195/6r-195-r4f081843.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'John Deere' AND familia ILIKE '%6R%';

UPDATE cat_modelos SET
  imagem_url   = 'https://www.deere.com.br/assets/images/region-2/products/tractors/5e-series/5090e/5090e-large.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'John Deere' AND familia ILIKE '%5E%';

-- ── Case IH ────────────────────────────────────────────────────────────────────
UPDATE cat_modelos SET
  imagem_url   = 'https://www.caseih.com/content/dam/case-ih/na/products/tractors/optum/optum-cvx/images/case-ih-optum-300-cvx-front-right.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'Case IH' AND familia ILIKE '%Optum%';

UPDATE cat_modelos SET
  imagem_url   = 'https://www.caseih.com/content/dam/case-ih/na/products/tractors/puma/puma-avx/images/case-ih-puma-240-avx.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'Case IH' AND familia ILIKE '%Puma%';

UPDATE cat_modelos SET
  imagem_url   = 'https://www.caseih.com/content/dam/case-ih/na/products/tractors/magnum/magnum-400/images/case-ih-magnum-400-afs-connect.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'Case IH' AND familia ILIKE '%Magnum%';

-- ── New Holland ────────────────────────────────────────────────────────────────
UPDATE cat_modelos SET
  imagem_url   = 'https://agriculture.newholland.com/content/dam/nhag/na/en-us/equipment/tractors/t8/t8-435/images/new-holland-t8-435.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'New Holland' AND familia ILIKE '%T8%';

UPDATE cat_modelos SET
  imagem_url   = 'https://agriculture.newholland.com/content/dam/nhag/na/en-us/equipment/tractors/t7/t7-270/images/new-holland-t7-270.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'New Holland' AND familia ILIKE '%T7%';

-- ── Valtra ─────────────────────────────────────────────────────────────────────
UPDATE cat_modelos SET
  imagem_url   = 'https://www.valtra.com.br/-/media/images/products/t-series/valtra-t174-t4.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'Valtra' AND familia ILIKE '%T%';

UPDATE cat_modelos SET
  imagem_url   = 'https://www.valtra.com.br/-/media/images/products/s-series/valtra-s374.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'Valtra' AND familia ILIKE '%S%';

-- ── Massey Ferguson ────────────────────────────────────────────────────────────
UPDATE cat_modelos SET
  imagem_url   = 'https://www.masseyferguson.com/content/dam/massey-ferguson/na/products/tractors/mf8700s/mf-8740s/images/mf-8740s-001.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'Massey Ferguson' AND familia ILIKE '%8700%';

UPDATE cat_modelos SET
  imagem_url   = 'https://www.masseyferguson.com/content/dam/massey-ferguson/na/products/tractors/mf7700s/mf-7718s/images/mf-7718s-001.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'Massey Ferguson' AND familia ILIKE '%7700%';

-- ── Fendt ──────────────────────────────────────────────────────────────────────
UPDATE cat_modelos SET
  imagem_url   = 'https://www.fendt.com/content/dam/fendt/na/products/tractors/fendt-1000-vario/fendt-1042-vario/images/fendt-1042-vario-front.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'Fendt' AND familia ILIKE '%1000%';

UPDATE cat_modelos SET
  imagem_url   = 'https://www.fendt.com/content/dam/fendt/na/products/tractors/fendt-900-vario/fendt-942-vario/images/fendt-942-vario.jpg',
  imagem_fonte = 'fabricante'
WHERE fabricante = 'Fendt' AND familia ILIKE '%900%';

-- ── Índice de busca por imagem ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cat_modelos_imagem
  ON cat_modelos (fabricante, familia)
  WHERE imagem_url IS NOT NULL;

-- ── View atualizada com imagem ─────────────────────────────────────────────────
-- (drop + recreate para incluir imagem_url)
DROP VIEW IF EXISTS cat_modelos_por_ano;

CREATE VIEW cat_modelos_por_ano AS
SELECT
  m.*,
  f.pais_origem,
  f.grupo         AS grupo_fabricante,
  CASE
    WHEN m.ano_inicio < 2000 THEN 'Geração 1 (pré-2000)'
    WHEN m.ano_inicio < 2010 THEN 'Geração 2 (2000–2009)'
    WHEN m.ano_inicio < 2018 THEN 'Geração 3 (2010–2017)'
    ELSE                          'Geração 4 (2018+)'
  END AS geracao,
  (
    SELECT COUNT(*) FROM cat_planos p WHERE p.modelo_id = m.id
  ) AS total_planos
FROM cat_modelos m
JOIN cat_fabricantes f ON f.nome = m.fabricante
ORDER BY m.fabricante, m.ano_inicio, m.modelo;

-- Permissão pública de leitura
GRANT SELECT ON cat_modelos_por_ano TO anon, authenticated;
