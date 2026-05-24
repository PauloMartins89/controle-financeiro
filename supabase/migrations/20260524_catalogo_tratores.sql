-- ════════════════════════════════════════════════════════════════════════
-- CATÁLOGO GLOBAL DE TRATORES AGRÍCOLAS — SmartPro Manutenção
-- ~270 modelos separados por fabricante e ano de fabricação
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Fabricantes ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cat_fabricantes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL UNIQUE,
  pais_origem text,
  grupo       text,
  website     text,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Catálogo de Modelos ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cat_modelos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fabricante      text NOT NULL,
  familia         text,
  modelo          text NOT NULL,
  configuracao    text,
  classe          text NOT NULL DEFAULT 'agricola',   -- agricola | florestal | construcao
  tipo            text NOT NULL DEFAULT 'trator',     -- trator | colheitadeira | pulverizador
  ano_inicio      int  NOT NULL,
  ano_fim         int,                                -- NULL = ainda em produção
  potencia_cv_min int,
  potencia_cv_max int,
  peso_kg         int,
  transmissao     text,   -- manual | powershift | autoshift | cvt | e23 | dyna-vt | powrquad
  tracao          text,   -- 4x2 | 4x4 | 4x4_articulado
  motor_cilindros int,
  motor_litros    numeric(4,1),
  mercado         text DEFAULT 'GLOBAL',              -- BR | GLOBAL
  observacoes     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Planos de Manutenção por Modelo ──────────────────────────────────

CREATE TABLE IF NOT EXISTS cat_planos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id      uuid NOT NULL REFERENCES cat_modelos(id) ON DELETE CASCADE,
  intervalo_h    int  NOT NULL,
  titulo         text NOT NULL,
  descricao      text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── 4. Itens do Plano (filtros, fluidos, peças, verificações) ───────────

CREATE TABLE IF NOT EXISTS cat_planos_itens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id      uuid NOT NULL REFERENCES cat_planos(id) ON DELETE CASCADE,
  categoria     text NOT NULL,   -- filtro | fluido | peca | verificacao | regulagem
  descricao     text NOT NULL,
  referencia    text,
  quantidade    numeric(8,3),
  unidade       text,            -- un | L | kg
  especificacao text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── RLS (leitura pública, escrita autenticada) ───────────────────────────

ALTER TABLE cat_fabricantes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_modelos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_planos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_planos_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cat_fab_read  ON cat_fabricantes;
DROP POLICY IF EXISTS cat_mod_read  ON cat_modelos;
DROP POLICY IF EXISTS cat_pla_read  ON cat_planos;
DROP POLICY IF EXISTS cat_ite_read  ON cat_planos_itens;
DROP POLICY IF EXISTS cat_fab_write ON cat_fabricantes;
DROP POLICY IF EXISTS cat_mod_write ON cat_modelos;
DROP POLICY IF EXISTS cat_pla_write ON cat_planos;
DROP POLICY IF EXISTS cat_ite_write ON cat_planos_itens;

CREATE POLICY cat_fab_read  ON cat_fabricantes  FOR SELECT USING (true);
CREATE POLICY cat_mod_read  ON cat_modelos      FOR SELECT USING (true);
CREATE POLICY cat_pla_read  ON cat_planos       FOR SELECT USING (true);
CREATE POLICY cat_ite_read  ON cat_planos_itens FOR SELECT USING (true);

CREATE POLICY cat_fab_write ON cat_fabricantes  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY cat_mod_write ON cat_modelos      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY cat_pla_write ON cat_planos       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY cat_ite_write ON cat_planos_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Índices ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cat_mod_fab  ON cat_modelos(fabricante);
CREATE INDEX IF NOT EXISTS idx_cat_mod_ano  ON cat_modelos(ano_inicio, ano_fim);
CREATE INDEX IF NOT EXISTS idx_cat_mod_mod  ON cat_modelos(modelo);
CREATE INDEX IF NOT EXISTS idx_cat_mod_fam  ON cat_modelos(familia);
CREATE INDEX IF NOT EXISTS idx_cat_pla_mod  ON cat_planos(modelo_id);
CREATE INDEX IF NOT EXISTS idx_cat_ite_pla  ON cat_planos_itens(plano_id);

-- ════════════════════════════════════════════════════════════════════════
-- DADOS: FABRICANTES
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO cat_fabricantes (nome, pais_origem, grupo, website) VALUES
  ('John Deere',      'USA',       'John Deere',     'https://www.deere.com.br'),
  ('Case IH',         'USA',       'CNH Industrial', 'https://www.caseih.com/br'),
  ('New Holland',     'USA',       'CNH Industrial', 'https://agriculture.newholland.com/br'),
  ('Valtra',          'Finland',   'AGCO',           'https://www.valtra.com.br'),
  ('Massey Ferguson', 'UK',        'AGCO',           'https://www.masseyferguson.com.br'),
  ('Fendt',           'Germany',   'AGCO',           'https://www.fendt.com/br'),
  ('Deutz-Fahr',      'Germany',   'SDF Group',      'https://www.deutz-fahr.com.br'),
  ('CLAAS',           'Germany',   'CLAAS',          'https://www.claas.com.br'),
  ('Kubota',          'Japan',     'Kubota',         'https://www.kubota.com.br'),
  ('Challenger',      'USA',       'AGCO',           'https://www.challenger-ag.com'),
  ('Versatile',       'Canada',    'Versatile',      'https://www.versatile-ag.com'),
  ('LS Tractor',      'Korea',     'LS Mtron',       'https://www.lstractor.com')
ON CONFLICT (nome) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- JOHN DEERE
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES

-- ── Série 5000 (1992–2002) ───────────────────────────────────────────────
('John Deere','Série 5000','5400',  '2WD',  'agricola','trator',1992,2002, 75, 75,'manual',    '4x2',4,4.5,'BR'),
('John Deere','Série 5000','5500',  '2WD',  'agricola','trator',1992,2002, 90, 90,'manual',    '4x2',4,4.5,'BR'),
('John Deere','Série 5000','5400N', '4WD',  'agricola','trator',1993,2002, 75, 75,'manual',    '4x4',4,4.5,'BR'),
('John Deere','Série 5000','5500N', '4WD',  'agricola','trator',1993,2002, 90, 90,'manual',    '4x4',4,4.5,'BR'),
('John Deere','Série 5000','5700',  'MFWD', 'agricola','trator',1997,2003,100,100,'manual',    '4x4',4,4.5,'BR'),

-- ── Série 5E (2012–2022) ────────────────────────────────────────────────
('John Deere','Série 5E','5078E','MFWD','agricola','trator',2012,2022, 78, 82,'powrquad','4x4',4,4.5,'BR'),
('John Deere','Série 5E','5090E','MFWD','agricola','trator',2012,2022, 90, 95,'powrquad','4x4',4,4.5,'BR'),
('John Deere','Série 5E','5100E','MFWD','agricola','trator',2012,2022,100,105,'powrquad','4x4',4,4.5,'BR'),

-- ── Série 6J (2002–2022) ────────────────────────────────────────────────
('John Deere','Série 6J','6110J','MFWD','agricola','trator',2002,2022,110,118,'powrquad','4x4',4,6.8,'BR'),
('John Deere','Série 6J','6120J','MFWD','agricola','trator',2002,2022,120,128,'powrquad','4x4',4,6.8,'BR'),
('John Deere','Série 6J','6130J','MFWD','agricola','trator',2002,2022,130,138,'powrquad','4x4',4,6.8,'BR'),
('John Deere','Série 6J','6145J','MFWD','agricola','trator',2010,2022,145,152,'powrquad','4x4',4,6.8,'BR'),
('John Deere','Série 6J','6155J','MFWD','agricola','trator',2010,2022,155,163,'powrquad','4x4',4,6.8,'BR'),

-- ── Série 6R (2019–atual) ───────────────────────────────────────────────
('John Deere','Série 6R','6120R','MFWD','agricola','trator',2019,NULL,120,132,'autoshift','4x4',4,4.5,'GLOBAL'),
('John Deere','Série 6R','6130R','MFWD','agricola','trator',2019,NULL,130,143,'autoshift','4x4',4,4.5,'GLOBAL'),
('John Deere','Série 6R','6140R','MFWD','agricola','trator',2019,NULL,140,154,'autoshift','4x4',4,4.5,'GLOBAL'),
('John Deere','Série 6R','6150R','MFWD','agricola','trator',2019,NULL,150,165,'autoshift','4x4',4,4.5,'GLOBAL'),
('John Deere','Série 6R','6175R','MFWD','agricola','trator',2019,NULL,175,192,'cvt',      '4x4',6,6.8,'GLOBAL'),
('John Deere','Série 6R','6195R','MFWD','agricola','trator',2019,NULL,195,213,'cvt',      '4x4',6,6.8,'GLOBAL'),
('John Deere','Série 6R','6215R','MFWD','agricola','trator',2020,NULL,215,235,'cvt',      '4x4',6,6.8,'GLOBAL'),

-- ── Série 7J (2005–2022) ────────────────────────────────────────────────
('John Deere','Série 7J','7185J','MFWD','agricola','trator',2005,2022,185,198,'powrquad','4x4',6,6.8,'BR'),
('John Deere','Série 7J','7195J','MFWD','agricola','trator',2005,2022,195,208,'powrquad','4x4',6,6.8,'BR'),
('John Deere','Série 7J','7205J','MFWD','agricola','trator',2005,2022,205,218,'powrquad','4x4',6,6.8,'BR'),
('John Deere','Série 7J','7215J','MFWD','agricola','trator',2005,2022,215,228,'powrquad','4x4',6,6.8,'BR'),

-- ── Série 7R (2015–atual) ───────────────────────────────────────────────
('John Deere','Série 7R','7210R','MFWD','agricola','trator',2015,NULL,210,228,'powrquad', '4x4',6,6.8,'GLOBAL'),
('John Deere','Série 7R','7230R','MFWD','agricola','trator',2015,NULL,230,250,'powrquad', '4x4',6,6.8,'GLOBAL'),
('John Deere','Série 7R','7250R','MFWD','agricola','trator',2015,NULL,250,272,'powrquad', '4x4',6,6.8,'GLOBAL'),
('John Deere','Série 7R','7270R','MFWD','agricola','trator',2015,NULL,270,294,'autoshift','4x4',6,6.8,'GLOBAL'),
('John Deere','Série 7R','7290R','MFWD','agricola','trator',2015,NULL,290,315,'autoshift','4x4',6,6.8,'GLOBAL'),
('John Deere','Série 7R','7310R','MFWD','agricola','trator',2015,NULL,310,337,'autoshift','4x4',6,6.8,'GLOBAL'),
('John Deere','Série 7R','7330R','MFWD','agricola','trator',2017,NULL,330,360,'autoshift','4x4',6,6.8,'GLOBAL'),

-- ── Série 8000 (1994–1999) ──────────────────────────────────────────────
('John Deere','Série 8000','8100','MFWD','agricola','trator',1994,1999,175,185,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8000','8200','MFWD','agricola','trator',1994,1999,200,212,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8000','8300','MFWD','agricola','trator',1994,1999,225,240,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8000','8400','MFWD','agricola','trator',1994,1999,260,275,'powershift','4x4',6,8.1,'GLOBAL'),

-- ── Série 8010 (2000–2002) ──────────────────────────────────────────────
('John Deere','Série 8010','8110','MFWD','agricola','trator',2000,2002,175,188,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8010','8210','MFWD','agricola','trator',2000,2002,200,215,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8010','8310','MFWD','agricola','trator',2000,2002,225,242,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8010','8410','MFWD','agricola','trator',2000,2002,260,278,'powershift','4x4',6,8.1,'GLOBAL'),

-- ── Série 8020 (2003–2006) ──────────────────────────────────────────────
('John Deere','Série 8020','8120','MFWD','agricola','trator',2003,2006,175,188,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8020','8220','MFWD','agricola','trator',2003,2006,200,215,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8020','8320','MFWD','agricola','trator',2003,2006,225,242,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8020','8420','MFWD','agricola','trator',2003,2006,260,278,'powershift','4x4',6,8.1,'GLOBAL'),

-- ── Série 8030 (2006–2011) ──────────────────────────────────────────────
('John Deere','Série 8030','8130','MFWD','agricola','trator',2006,2011,175,190,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8030','8230','MFWD','agricola','trator',2006,2011,200,217,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8030','8330','MFWD','agricola','trator',2006,2011,225,244,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8030','8430','MFWD','agricola','trator',2006,2011,260,282,'powershift','4x4',6,8.1,'GLOBAL'),
('John Deere','Série 8030','8530','MFWD','agricola','trator',2006,2011,295,320,'powershift','4x4',6,8.1,'GLOBAL'),

-- ── Série 8R (2011–atual) ───────────────────────────────────────────────
('John Deere','Série 8R','8235R','MFWD','agricola','trator',2011,2020,235,255,'powershift','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R','8260R','MFWD','agricola','trator',2011,2020,260,283,'powershift','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R','8285R','MFWD','agricola','trator',2011,2020,285,310,'powershift','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R','8310R','MFWD','agricola','trator',2011,NULL, 310,337,'powershift','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R','8335R','MFWD','agricola','trator',2011,NULL, 335,363,'powershift','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R','8345R','MFWD','agricola','trator',2014,NULL, 345,375,'powershift','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R','8370R','MFWD','agricola','trator',2014,NULL, 370,402,'powershift','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R','8400R','ILS', 'agricola','trator',2018,NULL, 400,435,'e23',       '4x4',6,9.0,'GLOBAL'),

-- ── Série 8R nova geração (2021–atual) ──────────────────────────────────
('John Deere','Série 8R Gen2','8R 230','MFWD','agricola','trator',2021,NULL,230,252,'powershift','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R Gen2','8R 250','MFWD','agricola','trator',2021,NULL,250,273,'powershift','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R Gen2','8R 280','MFWD','agricola','trator',2021,NULL,280,305,'powershift','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R Gen2','8R 310','MFWD','agricola','trator',2021,NULL,310,338,'powershift','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R Gen2','8R 340','MFWD','agricola','trator',2021,NULL,340,370,'e23',       '4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R Gen2','8R 370','ILS', 'agricola','trator',2021,NULL,370,403,'e23',       '4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R Gen2','8R 410','ILS', 'agricola','trator',2021,NULL,410,447,'e23',       '4x4',6,9.0,'GLOBAL'),

-- ── Série 9R articulados (2015–atual) ───────────────────────────────────
('John Deere','Série 9R','9R 390','4WD-Art.','agricola','trator',2015,NULL,390,424,'e23','4x4_articulado',6,13.5,'GLOBAL'),
('John Deere','Série 9R','9R 440','4WD-Art.','agricola','trator',2015,NULL,440,478,'e23','4x4_articulado',6,13.5,'GLOBAL'),
('John Deere','Série 9R','9R 490','4WD-Art.','agricola','trator',2015,NULL,490,533,'e23','4x4_articulado',6,13.5,'GLOBAL'),
('John Deere','Série 9R','9R 540','4WD-Art.','agricola','trator',2015,NULL,540,587,'e23','4x4_articulado',6,13.5,'GLOBAL'),
('John Deere','Série 9R','9R 590','4WD-Art.','agricola','trator',2018,NULL,590,641,'e23','4x4_articulado',6,13.5,'GLOBAL'),
('John Deere','Série 9R','9R 640','4WD-Art.','agricola','trator',2020,NULL,640,695,'e23','4x4_articulado',6,13.5,'GLOBAL');

-- ════════════════════════════════════════════════════════════════════════
-- CASE IH
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES

-- ── MX Series (1996–2003) ───────────────────────────────────────────────
('Case IH','MX','MX110','MFWD','agricola','trator',1996,2003,110,120,'powershift','4x4',6,7.4,'GLOBAL'),
('Case IH','MX','MX120','MFWD','agricola','trator',1996,2003,120,130,'powershift','4x4',6,7.4,'GLOBAL'),
('Case IH','MX','MX135','MFWD','agricola','trator',1996,2003,135,146,'powershift','4x4',6,7.4,'GLOBAL'),
('Case IH','MX','MX150','MFWD','agricola','trator',1996,2003,150,163,'powershift','4x4',6,7.4,'GLOBAL'),
('Case IH','MX','MX170','MFWD','agricola','trator',1996,2003,170,185,'powershift','4x4',6,7.4,'GLOBAL'),

-- ── MXM Series (2002–2009) ──────────────────────────────────────────────
('Case IH','MXM','MXM120','MFWD','agricola','trator',2002,2009,120,130,'powershift','4x4',6,7.4,'GLOBAL'),
('Case IH','MXM','MXM130','MFWD','agricola','trator',2002,2009,130,141,'powershift','4x4',6,7.4,'GLOBAL'),
('Case IH','MXM','MXM140','MFWD','agricola','trator',2002,2009,140,152,'powershift','4x4',6,7.4,'GLOBAL'),
('Case IH','MXM','MXM155','MFWD','agricola','trator',2002,2009,155,168,'powershift','4x4',6,7.4,'GLOBAL'),
('Case IH','MXM','MXM175','MFWD','agricola','trator',2002,2009,175,190,'powershift','4x4',6,7.4,'GLOBAL'),
('Case IH','MXM','MXM190','MFWD','agricola','trator',2002,2009,190,206,'powershift','4x4',6,7.4,'GLOBAL'),

-- ── Maxxum Series (2003–atual) ──────────────────────────────────────────
('Case IH','Maxxum','Maxxum 110','MFWD','agricola','trator',2003,NULL,110,120,'powershift','4x4',4,4.5,'GLOBAL'),
('Case IH','Maxxum','Maxxum 115','MFWD','agricola','trator',2003,NULL,115,125,'powershift','4x4',4,4.5,'GLOBAL'),
('Case IH','Maxxum','Maxxum 120','MFWD','agricola','trator',2003,NULL,120,130,'powershift','4x4',4,4.5,'GLOBAL'),
('Case IH','Maxxum','Maxxum 125','MFWD','agricola','trator',2003,NULL,125,136,'powershift','4x4',4,4.5,'GLOBAL'),
('Case IH','Maxxum','Maxxum 130','MFWD','agricola','trator',2003,NULL,130,141,'powershift','4x4',4,4.5,'GLOBAL'),
('Case IH','Maxxum','Maxxum 140','MFWD','agricola','trator',2003,NULL,140,152,'powershift','4x4',4,4.5,'GLOBAL'),
('Case IH','Maxxum','Maxxum 150','MFWD','agricola','trator',2008,NULL,150,163,'powershift','4x4',4,4.5,'GLOBAL'),

-- ── Puma Series (2007–atual) ────────────────────────────────────────────
('Case IH','Puma','Puma 115','MFWD','agricola','trator',2007,NULL,115,125,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 125','MFWD','agricola','trator',2007,NULL,125,136,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 130','MFWD','agricola','trator',2007,NULL,130,141,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 140','MFWD','agricola','trator',2007,NULL,140,152,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 150','MFWD','agricola','trator',2007,NULL,150,163,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 165','MFWD','agricola','trator',2007,NULL,165,179,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 180','MFWD','agricola','trator',2007,NULL,180,195,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 185','MFWD','agricola','trator',2015,NULL,185,201,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 195','MFWD','agricola','trator',2010,NULL,195,212,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 200','MFWD','agricola','trator',2015,NULL,200,217,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 210','MFWD','agricola','trator',2010,NULL,210,228,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 215','MFWD','agricola','trator',2015,NULL,215,234,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 225','MFWD','agricola','trator',2010,NULL,225,245,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 230','MFWD','agricola','trator',2015,NULL,230,250,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 240','MFWD','agricola','trator',2010,NULL,240,261,'powershift','4x4',6,6.7,'GLOBAL'),

-- ── Optum Series (2015–atual) ───────────────────────────────────────────
('Case IH','Optum','Optum 250','CVT','agricola','trator',2015,NULL,250,272,'cvt','4x4',6,6.7,'GLOBAL'),
('Case IH','Optum','Optum 270','CVT','agricola','trator',2015,NULL,270,294,'cvt','4x4',6,6.7,'GLOBAL'),
('Case IH','Optum','Optum 300','CVT','agricola','trator',2015,NULL,300,326,'cvt','4x4',6,6.7,'GLOBAL'),

-- ── Magnum Series (1987–atual) ──────────────────────────────────────────
('Case IH','Magnum','Magnum 180','MFWD','agricola','trator',1987,2000,180,195,'powershift','4x4',6,8.3,'GLOBAL'),
('Case IH','Magnum','Magnum 210','MFWD','agricola','trator',1990,2000,210,228,'powershift','4x4',6,8.3,'GLOBAL'),
('Case IH','Magnum','Magnum 235','MFWD','agricola','trator',1995,2005,235,255,'powershift','4x4',6,8.3,'GLOBAL'),
('Case IH','Magnum','Magnum 260','MFWD','agricola','trator',2000,NULL, 260,283,'powershift','4x4',6,8.7,'GLOBAL'),
('Case IH','Magnum','Magnum 280','MFWD','agricola','trator',2000,NULL, 280,304,'powershift','4x4',6,8.7,'GLOBAL'),
('Case IH','Magnum','Magnum 310','MFWD','agricola','trator',2005,NULL, 310,337,'powershift','4x4',6,8.7,'GLOBAL'),
('Case IH','Magnum','Magnum 340','MFWD','agricola','trator',2005,NULL, 340,370,'powershift','4x4',6,8.7,'GLOBAL'),
('Case IH','Magnum','Magnum 380','MFWD','agricola','trator',2010,NULL, 380,413,'powershift','4x4',6,8.7,'GLOBAL'),
('Case IH','Magnum','Magnum 400','MFWD','agricola','trator',2015,NULL, 400,435,'powershift','4x4',6,8.7,'GLOBAL'),

-- ── Steiger articulados (2012–atual) ────────────────────────────────────
('Case IH','Steiger','Steiger 350','4WD-Art.','agricola','trator',2012,NULL,350,380,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('Case IH','Steiger','Steiger 370','4WD-Art.','agricola','trator',2012,NULL,370,402,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('Case IH','Steiger','Steiger 400','4WD-Art.','agricola','trator',2012,NULL,400,435,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('Case IH','Steiger','Steiger 420','4WD-Art.','agricola','trator',2012,NULL,420,456,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('Case IH','Steiger','Steiger 450','4WD-Art.','agricola','trator',2012,NULL,450,489,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('Case IH','Steiger','Steiger 500','4WD-Art.','agricola','trator',2012,NULL,500,543,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('Case IH','Steiger','Steiger 540','4WD-Art.','agricola','trator',2015,NULL,540,587,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('Case IH','Steiger','Steiger 580','4WD-Art.','agricola','trator',2015,NULL,580,630,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('Case IH','Steiger','Steiger 620','4WD-Art.','agricola','trator',2018,NULL,620,673,'powershift','4x4_articulado',6,12.9,'GLOBAL');

-- ════════════════════════════════════════════════════════════════════════
-- NEW HOLLAND
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES

-- ── TL Series (1998–2012) ───────────────────────────────────────────────
('New Holland','TL','TL 60','MFWD','agricola','trator',1998,2012, 60, 65,'manual',    '4x4',3,3.0,'BR'),
('New Holland','TL','TL 70','MFWD','agricola','trator',1998,2012, 70, 76,'manual',    '4x4',4,4.0,'BR'),
('New Holland','TL','TL 80','MFWD','agricola','trator',1998,2012, 80, 87,'manual',    '4x4',4,4.0,'BR'),
('New Holland','TL','TL 85','MFWD','agricola','trator',1998,2012, 85, 92,'manual',    '4x4',4,4.0,'BR'),
('New Holland','TL','TL 95','MFWD','agricola','trator',1998,2012, 95,103,'manual',    '4x4',4,4.0,'BR'),

-- ── TM Series (1999–2008) ───────────────────────────────────────────────
('New Holland','TM','TM 120','MFWD','agricola','trator',1999,2008,120,130,'powershift','4x4',6,7.5,'GLOBAL'),
('New Holland','TM','TM 135','MFWD','agricola','trator',1999,2008,135,147,'powershift','4x4',6,7.5,'GLOBAL'),
('New Holland','TM','TM 150','MFWD','agricola','trator',1999,2008,150,163,'powershift','4x4',6,7.5,'GLOBAL'),
('New Holland','TM','TM 165','MFWD','agricola','trator',1999,2008,165,179,'powershift','4x4',6,7.5,'GLOBAL'),
('New Holland','TM','TM 175','MFWD','agricola','trator',2002,2008,175,190,'powershift','4x4',6,7.5,'GLOBAL'),
('New Holland','TM','TM 190','MFWD','agricola','trator',2002,2008,190,206,'powershift','4x4',6,7.5,'GLOBAL'),

-- ── T6 Series (2009–atual) ──────────────────────────────────────────────
('New Holland','T6','T6.110','MFWD','agricola','trator',2009,NULL,110,120,'powershift', '4x4',4,4.5,'GLOBAL'),
('New Holland','T6','T6.120','MFWD','agricola','trator',2009,NULL,120,130,'powershift', '4x4',4,4.5,'GLOBAL'),
('New Holland','T6','T6.130','MFWD','agricola','trator',2009,NULL,130,141,'powershift', '4x4',4,4.5,'GLOBAL'),
('New Holland','T6','T6.140','MFWD','agricola','trator',2009,NULL,140,152,'powershift', '4x4',4,4.5,'GLOBAL'),
('New Holland','T6','T6.155','MFWD','agricola','trator',2012,NULL,155,168,'autoshift',  '4x4',4,4.5,'GLOBAL'),
('New Holland','T6','T6.160','MFWD','agricola','trator',2012,NULL,160,174,'autoshift',  '4x4',4,4.5,'GLOBAL'),
('New Holland','T6','T6.175','MFWD','agricola','trator',2015,NULL,175,190,'autoshift',  '4x4',4,4.5,'GLOBAL'),
('New Holland','T6','T6.180','MFWD','agricola','trator',2018,NULL,180,196,'autoshift',  '4x4',4,4.5,'GLOBAL'),

-- ── T7 Series (2009–atual) ──────────────────────────────────────────────
('New Holland','T7','T7.175','MFWD','agricola','trator',2009,NULL,175,190,'powershift','4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.185','MFWD','agricola','trator',2009,NULL,185,201,'powershift','4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.195','MFWD','agricola','trator',2009,NULL,195,212,'powershift','4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.210','MFWD','agricola','trator',2009,NULL,210,228,'powershift','4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.225','MFWD','agricola','trator',2009,NULL,225,245,'powershift','4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.245','MFWD','agricola','trator',2012,NULL,245,266,'powershift','4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.260','MFWD','agricola','trator',2012,NULL,260,283,'autoshift', '4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.270','MFWD','agricola','trator',2015,NULL,270,294,'autoshift', '4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.290','MFWD','agricola','trator',2015,NULL,290,315,'autoshift', '4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.315','MFWD','agricola','trator',2017,NULL,315,342,'autoshift', '4x4',6,6.7,'GLOBAL'),

-- ── T8 Series (2008–atual) ──────────────────────────────────────────────
('New Holland','T8','T8.320','MFWD','agricola','trator',2008,NULL,320,348,'powershift','4x4',6,8.7,'GLOBAL'),
('New Holland','T8','T8.350','MFWD','agricola','trator',2008,NULL,350,380,'powershift','4x4',6,8.7,'GLOBAL'),
('New Holland','T8','T8.380','MFWD','agricola','trator',2008,NULL,380,413,'powershift','4x4',6,8.7,'GLOBAL'),
('New Holland','T8','T8.410','MFWD','agricola','trator',2010,NULL,410,446,'powershift','4x4',6,8.7,'GLOBAL'),
('New Holland','T8','T8.435','MFWD','agricola','trator',2012,NULL,435,472,'powershift','4x4',6,8.7,'GLOBAL'),

-- ── T9 Series articulados (2011–atual) ──────────────────────────────────
('New Holland','T9','T9.450','4WD-Art.','agricola','trator',2011,NULL,450,489,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('New Holland','T9','T9.480','4WD-Art.','agricola','trator',2011,NULL,480,522,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('New Holland','T9','T9.530','4WD-Art.','agricola','trator',2011,NULL,530,576,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('New Holland','T9','T9.565','4WD-Art.','agricola','trator',2012,NULL,565,614,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('New Holland','T9','T9.615','4WD-Art.','agricola','trator',2015,NULL,615,668,'powershift','4x4_articulado',6,12.9,'GLOBAL'),
('New Holland','T9','T9.670','4WD-Art.','agricola','trator',2018,NULL,670,728,'powershift','4x4_articulado',6,12.9,'GLOBAL');

-- ════════════════════════════════════════════════════════════════════════
-- VALTRA
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES

-- ── Série A clássica (1992–2010) ────────────────────────────────────────
('Valtra','Série A','A 550','MFWD','agricola','trator',1992,2002, 55, 60,'manual',    '4x4',3,2.8,'BR'),
('Valtra','Série A','A 650','MFWD','agricola','trator',1992,2002, 65, 70,'manual',    '4x4',3,2.8,'BR'),
('Valtra','Série A','A 750','MFWD','agricola','trator',2000,2010, 75, 80,'manual',    '4x4',4,3.4,'BR'),
('Valtra','Série A','A 850','MFWD','agricola','trator',2000,2010, 85, 92,'manual',    '4x4',4,3.4,'BR'),

-- ── Série A nova (2018–atual) ────────────────────────────────────────────
('Valtra','Série A','A 114','MFWD','agricola','trator',2018,NULL,114,123,'powershift','4x4',4,3.4,'BR'),
('Valtra','Série A','A 134','MFWD','agricola','trator',2018,NULL,134,144,'powershift','4x4',4,3.4,'BR'),
('Valtra','Série A','A 154','MFWD','agricola','trator',2018,NULL,154,166,'powershift','4x4',4,3.4,'BR'),

-- ── Série BM (1995–2020) ────────────────────────────────────────────────
('Valtra','Série BM','BM 85',   'MFWD','agricola','trator',1995,2018, 85, 92,'manual',    '4x4',4,4.4,'BR'),
('Valtra','Série BM','BM 100',  'MFWD','agricola','trator',1995,2018,100,108,'manual',    '4x4',4,4.4,'BR'),
('Valtra','Série BM','BM 110',  'MFWD','agricola','trator',2000,2018,110,118,'powershift','4x4',4,4.4,'BR'),
('Valtra','Série BM','BM 120i', 'MFWD','agricola','trator',2005,2018,120,129,'powershift','4x4',4,4.4,'BR'),
('Valtra','Série BM','BM 125i', 'MFWD','agricola','trator',2008,2020,125,135,'powershift','4x4',4,4.4,'BR'),

-- ── Série BH (2000–2020) ────────────────────────────────────────────────
('Valtra','Série BH','BH 140','MFWD','agricola','trator',2000,2018,140,151,'powershift','4x4',6,6.0,'BR'),
('Valtra','Série BH','BH 145','MFWD','agricola','trator',2000,2018,145,157,'powershift','4x4',6,6.0,'BR'),
('Valtra','Série BH','BH 165','MFWD','agricola','trator',2003,2018,165,178,'powershift','4x4',6,6.0,'BR'),
('Valtra','Série BH','BH 180','MFWD','agricola','trator',2003,2018,180,194,'powershift','4x4',6,6.0,'BR'),
('Valtra','Série BH','BH 205','MFWD','agricola','trator',2007,2020,205,221,'powershift','4x4',6,6.0,'BR'),
('Valtra','Série BH','BH 210','MFWD','agricola','trator',2007,2020,210,227,'powershift','4x4',6,6.0,'BR'),

-- ── Série Q (2018–atual) ────────────────────────────────────────────────
('Valtra','Série Q','Q 205','MFWD','agricola','trator',2018,NULL,205,222,'autoshift','4x4',6,7.4,'GLOBAL'),
('Valtra','Série Q','Q 265','MFWD','agricola','trator',2018,NULL,265,287,'autoshift','4x4',6,7.4,'GLOBAL'),

-- ── Série S (2010–atual) ────────────────────────────────────────────────
('Valtra','Série S','S 265','MFWD','agricola','trator',2010,NULL,265,288,'autoshift','4x4',6,8.4,'GLOBAL'),
('Valtra','Série S','S 295','MFWD','agricola','trator',2010,NULL,295,320,'autoshift','4x4',6,8.4,'GLOBAL'),
('Valtra','Série S','S 320','MFWD','agricola','trator',2010,NULL,320,347,'autoshift','4x4',6,8.4,'GLOBAL'),
('Valtra','Série S','S 350','MFWD','agricola','trator',2010,NULL,350,380,'autoshift','4x4',6,8.4,'GLOBAL'),
('Valtra','Série S','S 380','MFWD','agricola','trator',2012,NULL,380,412,'autoshift','4x4',6,8.4,'GLOBAL'),

-- ── Série T (2018–atual) ────────────────────────────────────────────────
('Valtra','Série T','T 132e','MFWD','agricola','trator',2018,NULL,132,143,'autoshift','4x4',4,4.4,'GLOBAL'),
('Valtra','Série T','T 152e','MFWD','agricola','trator',2018,NULL,152,164,'autoshift','4x4',4,4.4,'GLOBAL'),
('Valtra','Série T','T 172e','MFWD','agricola','trator',2018,NULL,172,186,'autoshift','4x4',4,4.4,'GLOBAL'),
('Valtra','Série T','T 194e','MFWD','agricola','trator',2020,NULL,194,210,'autoshift','4x4',6,6.6,'GLOBAL'),
('Valtra','Série T','T 214e','MFWD','agricola','trator',2020,NULL,214,231,'autoshift','4x4',6,6.6,'GLOBAL'),
('Valtra','Série T','T 234e','MFWD','agricola','trator',2020,NULL,234,253,'autoshift','4x4',6,6.6,'GLOBAL'),
('Valtra','Série T','T 254e','MFWD','agricola','trator',2022,NULL,254,275,'autoshift','4x4',6,6.6,'GLOBAL');

-- ════════════════════════════════════════════════════════════════════════
-- MASSEY FERGUSON
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES

-- ── Série clássica (1985–2008) ───────────────────────────────────────────
('Massey Ferguson','Clássica','MF 275','MFWD','agricola','trator',1985,2000, 75, 81,'manual','4x4',4,4.0,'BR'),
('Massey Ferguson','Clássica','MF 283','MFWD','agricola','trator',1990,2005, 83, 90,'manual','4x4',4,4.0,'BR'),
('Massey Ferguson','Clássica','MF 290','MFWD','agricola','trator',1990,2005, 90, 97,'manual','4x4',4,4.0,'BR'),
('Massey Ferguson','Clássica','MF 292','MFWD','agricola','trator',1995,2008, 92, 99,'manual','4x4',4,4.0,'BR'),
('Massey Ferguson','Clássica','MF 296','MFWD','agricola','trator',1995,2008, 96,104,'manual','4x4',4,4.0,'BR'),
('Massey Ferguson','Clássica','MF 297','MFWD','agricola','trator',2000,2010, 97,105,'manual','4x4',4,4.0,'BR'),

-- ── Série 4275/4700 (2000–atual) ────────────────────────────────────────
('Massey Ferguson','MF 4700','MF 4275','MFWD','agricola','trator',2000,2010, 75, 81,'manual',    '4x4',4,4.0,'BR'),
('Massey Ferguson','MF 4700','MF 4283','MFWD','agricola','trator',2000,2012, 83, 90,'manual',    '4x4',4,4.0,'BR'),
('Massey Ferguson','MF 4700','MF 4292','MFWD','agricola','trator',2002,2015, 92, 99,'manual',    '4x4',4,4.0,'BR'),
('Massey Ferguson','MF 4700','MF 4707','MFWD','agricola','trator',2015,NULL, 105,114,'manual',    '4x4',4,4.4,'BR'),
('Massey Ferguson','MF 4700','MF 4708','MFWD','agricola','trator',2015,NULL, 115,125,'manual',    '4x4',4,4.4,'BR'),
('Massey Ferguson','MF 4700','MF 4709','MFWD','agricola','trator',2015,NULL, 125,135,'manual',    '4x4',4,4.4,'BR'),
('Massey Ferguson','MF 4700','MF 4710','MFWD','agricola','trator',2015,NULL, 130,141,'powershift','4x4',4,4.4,'BR'),

-- ── Série 5700 (2015–atual) ─────────────────────────────────────────────
('Massey Ferguson','MF 5700','MF 5707','MFWD','agricola','trator',2015,NULL,120,130,'powershift','4x4',4,4.4,'GLOBAL'),
('Massey Ferguson','MF 5700','MF 5708','MFWD','agricola','trator',2015,NULL,130,141,'powershift','4x4',4,4.4,'GLOBAL'),
('Massey Ferguson','MF 5700','MF 5709','MFWD','agricola','trator',2015,NULL,140,152,'powershift','4x4',4,4.4,'GLOBAL'),
('Massey Ferguson','MF 5700','MF 5710','MFWD','agricola','trator',2015,NULL,150,163,'powershift','4x4',4,4.4,'GLOBAL'),
('Massey Ferguson','MF 5700','MF 5711','MFWD','agricola','trator',2015,NULL,160,174,'powershift','4x4',4,4.4,'GLOBAL'),
('Massey Ferguson','MF 5700','MF 5712','MFWD','agricola','trator',2018,NULL,170,185,'powershift','4x4',4,4.4,'GLOBAL'),

-- ── Série 6700 (2012–atual) ─────────────────────────────────────────────
('Massey Ferguson','MF 6700','MF 6712','MFWD','agricola','trator',2012,NULL,130,141,'dyna-vt','4x4',6,6.6,'GLOBAL'),
('Massey Ferguson','MF 6700','MF 6713','MFWD','agricola','trator',2012,NULL,140,152,'dyna-vt','4x4',6,6.6,'GLOBAL'),
('Massey Ferguson','MF 6700','MF 6714','MFWD','agricola','trator',2012,NULL,150,163,'dyna-vt','4x4',6,6.6,'GLOBAL'),
('Massey Ferguson','MF 6700','MF 6715','MFWD','agricola','trator',2012,NULL,160,174,'dyna-vt','4x4',6,6.6,'GLOBAL'),
('Massey Ferguson','MF 6700','MF 6716','MFWD','agricola','trator',2012,NULL,172,187,'dyna-vt','4x4',6,6.6,'GLOBAL'),
('Massey Ferguson','MF 6700','MF 6718','MFWD','agricola','trator',2015,NULL,185,201,'dyna-vt','4x4',6,6.6,'GLOBAL'),
('Massey Ferguson','MF 6700','MF 6719','MFWD','agricola','trator',2015,NULL,200,217,'dyna-vt','4x4',6,6.6,'GLOBAL'),
('Massey Ferguson','MF 6700','MF 6720','MFWD','agricola','trator',2018,NULL,215,233,'dyna-vt','4x4',6,6.6,'GLOBAL'),

-- ── Série 7700 (2014–atual) ─────────────────────────────────────────────
('Massey Ferguson','MF 7700','MF 7715','MFWD','agricola','trator',2014,NULL,175,190,'dyna-vt','4x4',6,7.4,'GLOBAL'),
('Massey Ferguson','MF 7700','MF 7716','MFWD','agricola','trator',2014,NULL,190,206,'dyna-vt','4x4',6,7.4,'GLOBAL'),
('Massey Ferguson','MF 7700','MF 7718','MFWD','agricola','trator',2014,NULL,210,228,'dyna-vt','4x4',6,7.4,'GLOBAL'),
('Massey Ferguson','MF 7700','MF 7719','MFWD','agricola','trator',2014,NULL,225,245,'dyna-vt','4x4',6,7.4,'GLOBAL'),
('Massey Ferguson','MF 7700','MF 7720','MFWD','agricola','trator',2016,NULL,240,261,'dyna-vt','4x4',6,7.4,'GLOBAL'),
('Massey Ferguson','MF 7700','MF 7722','MFWD','agricola','trator',2018,NULL,255,277,'dyna-vt','4x4',6,7.4,'GLOBAL'),
('Massey Ferguson','MF 7700','MF 7724','MFWD','agricola','trator',2018,NULL,270,293,'dyna-vt','4x4',6,7.4,'GLOBAL'),

-- ── Série 8700 (2016–atual) ─────────────────────────────────────────────
('Massey Ferguson','MF 8700','MF 8727','MFWD','agricola','trator',2016,NULL,270,293,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','MF 8700','MF 8730','MFWD','agricola','trator',2016,NULL,300,326,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','MF 8700','MF 8732','MFWD','agricola','trator',2016,NULL,320,348,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','MF 8700','MF 8735','MFWD','agricola','trator',2016,NULL,350,380,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','MF 8700','MF 8737','MFWD','agricola','trator',2018,NULL,370,402,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','MF 8700','MF 8740','MFWD','agricola','trator',2018,NULL,400,435,'dyna-vt','4x4',6,8.4,'GLOBAL');

-- ════════════════════════════════════════════════════════════════════════
-- FENDT (CVT — todas as séries)
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES

-- ── Série 700 (2001–atual) ──────────────────────────────────────────────
('Fendt','Série 700','Fendt 714','MFWD','agricola','trator',2001,NULL,145,157,'cvt','4x4',6,6.1,'GLOBAL'),
('Fendt','Série 700','Fendt 716','MFWD','agricola','trator',2001,NULL,165,178,'cvt','4x4',6,6.1,'GLOBAL'),
('Fendt','Série 700','Fendt 718','MFWD','agricola','trator',2001,NULL,185,200,'cvt','4x4',6,6.1,'GLOBAL'),
('Fendt','Série 700','Fendt 720','MFWD','agricola','trator',2001,NULL,205,222,'cvt','4x4',6,6.1,'GLOBAL'),
('Fendt','Série 700','Fendt 722','MFWD','agricola','trator',2005,NULL,225,244,'cvt','4x4',6,6.1,'GLOBAL'),
('Fendt','Série 700','Fendt 724','MFWD','agricola','trator',2008,NULL,245,266,'cvt','4x4',6,6.1,'GLOBAL'),
('Fendt','Série 700','Fendt 726','MFWD','agricola','trator',2010,NULL,265,288,'cvt','4x4',6,6.1,'GLOBAL'),
('Fendt','Série 700','Fendt 728','MFWD','agricola','trator',2012,NULL,285,310,'cvt','4x4',6,6.1,'GLOBAL'),

-- ── Série 800 (2005–atual) ──────────────────────────────────────────────
('Fendt','Série 800','Fendt 818','MFWD','agricola','trator',2005,NULL,185,201,'cvt','4x4',6,7.5,'GLOBAL'),
('Fendt','Série 800','Fendt 820','MFWD','agricola','trator',2005,NULL,205,222,'cvt','4x4',6,7.5,'GLOBAL'),
('Fendt','Série 800','Fendt 822','MFWD','agricola','trator',2008,NULL,225,244,'cvt','4x4',6,7.5,'GLOBAL'),
('Fendt','Série 800','Fendt 824','MFWD','agricola','trator',2010,NULL,245,266,'cvt','4x4',6,7.5,'GLOBAL'),
('Fendt','Série 800','Fendt 826','MFWD','agricola','trator',2013,NULL,265,288,'cvt','4x4',6,7.5,'GLOBAL'),

-- ── Série 900 (2001–atual) ──────────────────────────────────────────────
('Fendt','Série 900','Fendt 924','MFWD','agricola','trator',2001,NULL,245,266,'cvt','4x4',6,8.4,'GLOBAL'),
('Fendt','Série 900','Fendt 927','MFWD','agricola','trator',2001,NULL,275,299,'cvt','4x4',6,8.4,'GLOBAL'),
('Fendt','Série 900','Fendt 930','MFWD','agricola','trator',2001,NULL,305,331,'cvt','4x4',6,8.4,'GLOBAL'),
('Fendt','Série 900','Fendt 933','MFWD','agricola','trator',2005,NULL,335,364,'cvt','4x4',6,8.4,'GLOBAL'),
('Fendt','Série 900','Fendt 936','MFWD','agricola','trator',2008,NULL,365,397,'cvt','4x4',6,8.4,'GLOBAL'),
('Fendt','Série 900','Fendt 939','MFWD','agricola','trator',2012,NULL,390,424,'cvt','4x4',6,8.4,'GLOBAL'),

-- ── Série 1000 (2016–atual) ─────────────────────────────────────────────
('Fendt','Série 1000','Fendt 1038','MFWD','agricola','trator',2016,NULL,390,424,'cvt','4x4',6,12.4,'GLOBAL'),
('Fendt','Série 1000','Fendt 1042','MFWD','agricola','trator',2016,NULL,430,467,'cvt','4x4',6,12.4,'GLOBAL'),
('Fendt','Série 1000','Fendt 1046','MFWD','agricola','trator',2016,NULL,470,511,'cvt','4x4',6,12.4,'GLOBAL'),
('Fendt','Série 1000','Fendt 1050','MFWD','agricola','trator',2016,NULL,510,554,'cvt','4x4',6,12.4,'GLOBAL');

-- ════════════════════════════════════════════════════════════════════════
-- PLANOS DE MANUTENÇÃO — John Deere Série 8R (referência completa)
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_mod_id uuid;
BEGIN
  -- pega o ID do modelo 8400R ILS como referência
  SELECT id INTO v_mod_id FROM cat_modelos WHERE fabricante = 'John Deere' AND modelo = '8400R' LIMIT 1;
  IF v_mod_id IS NULL THEN RETURN; END IF;

  -- Plano 10h
  INSERT INTO cat_planos (modelo_id, intervalo_h, titulo, descricao) VALUES
    (v_mod_id, 10,   'Inspeção diária — 10h',    'Verificações operacionais diárias'),
    (v_mod_id, 100,  'Manutenção 100h',           'Troca de filtro de ar pré-limpador e verificações'),
    (v_mod_id, 250,  'Manutenção 250h',           'Troca de óleo motor + filtros primários'),
    (v_mod_id, 500,  'Manutenção 500h',           'Troca filtros hidráulico e combustível'),
    (v_mod_id, 1000, 'Manutenção 1000h',          'Revisão completa: óleo câmbio + diferencial + ILS'),
    (v_mod_id, 1500, 'Manutenção 1500h',          'Troca filtro transmissão e inibidor DCA4'),
    (v_mod_id, 2000, 'Manutenção 2000h',          'Revisão do sistema de arrefecimento'),
    (v_mod_id, 3000, 'Manutenção 3000h',          'Revisão suspensão ILS e eixo dianteiro'),
    (v_mod_id, 4500, 'Revisão maior — 4500h',     'Overhaul completo do motor e sistemas');
END $$;

-- Itens do plano 10h
INSERT INTO cat_planos_itens (plano_id, categoria, descricao, quantidade, unidade, especificacao)
SELECT p.id, 'verificacao', 'Verificar nível de óleo do motor',           1, 'un', 'John Deere Plus-50 II 15W-40'
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id
WHERE m.modelo = '8400R' AND p.intervalo_h = 10
UNION ALL
SELECT p.id, 'verificacao', 'Verificar nível do líquido de arrefecimento', 1, 'un', 'John Deere Cool-Gard II'
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id
WHERE m.modelo = '8400R' AND p.intervalo_h = 10
UNION ALL
SELECT p.id, 'verificacao', 'Verificar pressão dos pneus',                 1, 'un', 'Conforme manual'
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id
WHERE m.modelo = '8400R' AND p.intervalo_h = 10
UNION ALL
SELECT p.id, 'verificacao', 'Verificar nível de combustível',              1, 'un', NULL
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id
WHERE m.modelo = '8400R' AND p.intervalo_h = 10
UNION ALL
SELECT p.id, 'verificacao', 'Inspeção visual de vazamentos',               1, 'un', NULL
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id
WHERE m.modelo = '8400R' AND p.intervalo_h = 10;

-- Itens do plano 250h
INSERT INTO cat_planos_itens (plano_id, categoria, descricao, referencia, quantidade, unidade, especificacao)
SELECT p.id, 'fluido',  'Óleo motor — troca completa',        'RE509672', 31,  'L',  'John Deere Plus-50 II 15W-40'
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 250
UNION ALL
SELECT p.id, 'filtro',  'Filtro de óleo motor primário',      'RE504836', 1,   'un', NULL
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 250
UNION ALL
SELECT p.id, 'filtro',  'Filtro de óleo motor secundário',    'RE522878', 1,   'un', NULL
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 250
UNION ALL
SELECT p.id, 'filtro',  'Filtro de ar primário',              'RE282714', 1,   'un', NULL
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 250
UNION ALL
SELECT p.id, 'filtro',  'Filtro de ar secundário (segurança)', 'RE282715',1,   'un', NULL
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 250
UNION ALL
SELECT p.id, 'filtro',  'Filtro de combustível primário',     'RE541736', 1,   'un', 'Separador água'
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 250
UNION ALL
SELECT p.id, 'filtro',  'Filtro de combustível secundário',   'RE541737', 1,   'un', NULL
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 250;

-- Itens do plano 500h
INSERT INTO cat_planos_itens (plano_id, categoria, descricao, referencia, quantidade, unidade, especificacao)
SELECT p.id, 'fluido',  'Óleo sistema hidráulico/transmissão', 'TY22041',  190, 'L',  'John Deere Hy-Gard'
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 500
UNION ALL
SELECT p.id, 'filtro',  'Filtro hidráulico carga',            'RE210857', 1,   'un', NULL
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 500
UNION ALL
SELECT p.id, 'filtro',  'Filtro hidráulico retorno',          'AT365869', 1,   'un', NULL
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 500
UNION ALL
SELECT p.id, 'filtro',  'Filtro de cabine — painel',          'AH216338', 2,   'un', NULL
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 500
UNION ALL
SELECT p.id, 'filtro',  'Filtro de cabine — recirculação',    'AH216339', 1,   'un', NULL
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 500;

-- Itens do plano 1000h
INSERT INTO cat_planos_itens (plano_id, categoria, descricao, referencia, quantidade, unidade, especificacao)
SELECT p.id, 'fluido',  'Óleo câmbio PowerShift e23',         'TY22041',  167, 'L',  'John Deere Hy-Gard'
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 1000
UNION ALL
SELECT p.id, 'fluido',  'Óleo eixo ILS (dianteiro)',          'TY6341',   12,  'L',  'John Deere GL-5 80W-90'
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 1000
UNION ALL
SELECT p.id, 'fluido',  'Óleo eixo traseiro / diferencial',  'TY6341',   18,  'L',  'John Deere GL-5 80W-90'
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 1000
UNION ALL
SELECT p.id, 'filtro',  'Filtro transmissão e23',             'RE566435', 1,   'un', NULL
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 1000
UNION ALL
SELECT p.id, 'verificacao', 'Calibração de injetores',       NULL, 1, 'un', 'Pressão conforme manual OMN400413'
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 1000;

-- Itens do plano 1500h (inibidor DCA4)
INSERT INTO cat_planos_itens (plano_id, categoria, descricao, referencia, quantidade, unidade, especificacao)
SELECT p.id, 'fluido',  'Inibidor de corrosão DCA4 — aditivo', 'TY16004', 6, 'un', 'John Deere Cool-Gard II DCA4'
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 1500
UNION ALL
SELECT p.id, 'verificacao', 'Teste de concentração DCA4 no arrefecimento', NULL, 1, 'un', 'Kit teste JD ou parceiro'
FROM cat_planos p JOIN cat_modelos m ON p.modelo_id = m.id WHERE m.modelo = '8400R' AND p.intervalo_h = 1500;

-- ════════════════════════════════════════════════════════════════════════
-- PLANOS DE MANUTENÇÃO — Case IH Puma 195 (referência)
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE v_mod_id uuid;
BEGIN
  SELECT id INTO v_mod_id FROM cat_modelos WHERE fabricante = 'Case IH' AND modelo = 'Puma 195' LIMIT 1;
  IF v_mod_id IS NULL THEN RETURN; END IF;
  INSERT INTO cat_planos (modelo_id, intervalo_h, titulo) VALUES
    (v_mod_id, 10,   'Inspeção diária — 10h'),
    (v_mod_id, 250,  'Manutenção 250h — óleo motor'),
    (v_mod_id, 500,  'Manutenção 500h — filtros'),
    (v_mod_id, 1000, 'Manutenção 1000h — câmbio e hidráulico'),
    (v_mod_id, 2000, 'Revisão maior — 2000h');
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- PLANOS DE MANUTENÇÃO — Valtra BM 125i (referência BR)
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE v_mod_id uuid;
BEGIN
  SELECT id INTO v_mod_id FROM cat_modelos WHERE fabricante = 'Valtra' AND modelo = 'BM 125i' LIMIT 1;
  IF v_mod_id IS NULL THEN RETURN; END IF;
  INSERT INTO cat_planos (modelo_id, intervalo_h, titulo) VALUES
    (v_mod_id, 10,   'Inspeção diária — 10h'),
    (v_mod_id, 200,  'Manutenção 200h — óleo motor + filtros'),
    (v_mod_id, 400,  'Manutenção 400h — hidráulico'),
    (v_mod_id, 800,  'Manutenção 800h — câmbio e diferencial'),
    (v_mod_id, 1600, 'Revisão maior — 1600h');
END $$;

-- ════════════════════════════════════════════════════════════════════════
-- VIEW DE CONSULTA: modelos por faixa de ano
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW cat_modelos_por_ano AS
SELECT
  fabricante,
  familia,
  modelo,
  configuracao,
  ano_inicio,
  COALESCE(ano_fim::text, 'atual') AS ano_fim,
  potencia_cv_min || '–' || potencia_cv_max || ' cv' AS potencia,
  transmissao,
  tracao,
  mercado,
  CASE
    WHEN ano_inicio < 2000 THEN 'Geração 1 (antes de 2000)'
    WHEN ano_inicio < 2010 THEN 'Geração 2 (2000–2009)'
    WHEN ano_inicio < 2018 THEN 'Geração 3 (2010–2017)'
    ELSE                        'Geração 4 (2018+)'
  END AS geracao
FROM cat_modelos
ORDER BY fabricante, ano_inicio, modelo;
