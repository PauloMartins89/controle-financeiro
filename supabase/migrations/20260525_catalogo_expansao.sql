-- ════════════════════════════════════════════════════════════════════════════
-- EXPANSÃO DO CATÁLOGO DE MODELOS — Ano 2000+
-- Cobertura: Tratores, Colhedoras, Pulverizadores, Construção Civil, Florestal
-- Execute no Supabase SQL Editor
-- Usa INSERT ... ON CONFLICT DO NOTHING para ser idempotente
-- ════════════════════════════════════════════════════════════════════════════

-- Garante índice único para evitar duplicatas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename='cat_modelos' AND indexname='cat_modelos_unique_modelo'
  ) THEN
    CREATE UNIQUE INDEX cat_modelos_unique_modelo
      ON cat_modelos (fabricante, modelo, COALESCE(configuracao,''), ano_inicio);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- JOHN DEERE — TRATORES SÉRIE 5000 / 5E / 5M
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
-- Série 5E Brasil (2012–2024)
('John Deere','Série 5E','5065E', 'MFWD','agricola','trator',2012,NULL, 65, 68,'manual',   '4x4',4,2.9,'BR'),
('John Deere','Série 5E','5075E', 'MFWD','agricola','trator',2012,NULL, 75, 80,'manual',   '4x4',4,3.4,'BR'),
('John Deere','Série 5E','5076EF','MFWD','agricola','trator',2012,NULL, 76, 80,'powrquad', '4x4',4,4.5,'BR'),
('John Deere','Série 5E','5086EF','MFWD','agricola','trator',2012,NULL, 86, 90,'powrquad', '4x4',4,4.5,'BR'),
('John Deere','Série 5E','5093E', 'MFWD','agricola','trator',2014,NULL, 93, 98,'powrquad', '4x4',4,4.5,'BR'),
('John Deere','Série 5E','5100E', 'MFWD','agricola','trator',2012,NULL,100,107,'powrquad', '4x4',4,4.5,'BR'),
-- Série 5M (2018+)
('John Deere','Série 5M','5075M', 'MFWD','agricola','trator',2018,NULL, 75, 80,'powrquad', '4x4',4,3.4,'GLOBAL'),
('John Deere','Série 5M','5090M', 'MFWD','agricola','trator',2018,NULL, 90, 95,'powrquad', '4x4',4,4.5,'GLOBAL'),
('John Deere','Série 5M','5100M', 'MFWD','agricola','trator',2018,NULL,100,106,'powrquad', '4x4',4,4.5,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- JOHN DEERE — TRATORES SÉRIE 6J / 6R / 6M
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
-- Série 6R (2020+) — substitui 6J no Brasil
('John Deere','Série 6R','6110R', 'MFWD','agricola','trator',2020,NULL,110,120,'autopowr', '4x4',4,4.5,'BR'),
('John Deere','Série 6R','6120R', 'MFWD','agricola','trator',2020,NULL,120,130,'autopowr', '4x4',4,4.5,'BR'),
('John Deere','Série 6R','6130R', 'MFWD','agricola','trator',2020,NULL,130,140,'autopowr', '4x4',4,4.5,'BR'),
('John Deere','Série 6R','6145R', 'MFWD','agricola','trator',2020,NULL,145,155,'autopowr', '4x4',4,4.5,'BR'),
('John Deere','Série 6R','6155R', 'MFWD','agricola','trator',2020,NULL,155,165,'autopowr', '4x4',4,4.5,'BR'),
('John Deere','Série 6R','6175R', 'MFWD','agricola','trator',2020,NULL,175,185,'autopowr', '4x4',4,6.8,'BR'),
('John Deere','Série 6R','6195R', 'MFWD','agricola','trator',2020,NULL,195,200,'autopowr', '4x4',4,6.8,'BR'),
('John Deere','Série 6R','6215R', 'MFWD','agricola','trator',2020,NULL,215,220,'autopowr', '4x4',6,6.8,'BR')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- JOHN DEERE — TRATORES SÉRIE 7R
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('John Deere','Série 7R','7200R','MFWD','agricola','trator',2012,NULL,200,215,'autopowr','4x4',6,6.8,'GLOBAL'),
('John Deere','Série 7R','7215R','MFWD','agricola','trator',2012,NULL,215,230,'autopowr','4x4',6,6.8,'GLOBAL'),
('John Deere','Série 7R','7230R','MFWD','agricola','trator',2012,NULL,230,250,'autopowr','4x4',6,6.8,'GLOBAL'),
('John Deere','Série 7R','7250R','MFWD','agricola','trator',2012,NULL,250,270,'autopowr','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 7R','7270R','MFWD','agricola','trator',2016,NULL,270,290,'autopowr','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 7R','7290R','MFWD','agricola','trator',2016,NULL,290,310,'autopowr','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 7R','7310R','MFWD','agricola','trator',2016,NULL,310,330,'autopowr','4x4',6,9.0,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- JOHN DEERE — TRATORES SÉRIE 8R / 8RT
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('John Deere','Série 8R','8235R','ILS', 'agricola','trator',2012,NULL,235,255,'e23','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R','8270R','ILS', 'agricola','trator',2012,NULL,270,295,'e23','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R','8295R','ILS', 'agricola','trator',2016,NULL,295,318,'e23','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R','8320R','ILS', 'agricola','trator',2016,NULL,320,345,'e23','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R','8345R','ILS', 'agricola','trator',2016,NULL,345,370,'e23','4x4',6,9.0,'GLOBAL'),
('John Deere','Série 8R','8370R','ILS', 'agricola','trator',2016,NULL,370,400,'e23','4x4',6,9.0,'GLOBAL'),
-- 8RT esteiras
('John Deere','Série 8RT','8320RT','RT','agricola','trator',2016,NULL,320,345,'e23','esteira',6,9.0,'GLOBAL'),
('John Deere','Série 8RT','8370RT','RT','agricola','trator',2016,NULL,370,400,'e23','esteira',6,9.0,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- JOHN DEERE — TRATORES SÉRIE 9R / 9RX
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('John Deere','Série 9R','9360R','MFWD','agricola','trator',2014,NULL,360,400,'powershift','4x4',6,13.5,'GLOBAL'),
('John Deere','Série 9R','9420R','MFWD','agricola','trator',2014,NULL,420,460,'powershift','4x4',6,13.5,'GLOBAL'),
('John Deere','Série 9R','9470R','MFWD','agricola','trator',2014,NULL,470,510,'powershift','4x4',6,13.5,'GLOBAL'),
('John Deere','Série 9R','9520R','MFWD','agricola','trator',2014,NULL,520,570,'powershift','4x4',6,13.5,'GLOBAL'),
('John Deere','Série 9R','9570R','MFWD','agricola','trator',2016,NULL,570,620,'powershift','4x4',6,13.5,'GLOBAL'),
-- 9RX esteiras duplas
('John Deere','Série 9RX','9470RX','RX','agricola','trator',2016,NULL,470,510,'powershift','esteira',6,13.5,'GLOBAL'),
('John Deere','Série 9RX','9520RX','RX','agricola','trator',2016,NULL,520,570,'powershift','esteira',6,13.5,'GLOBAL'),
('John Deere','Série 9RX','9570RX','RX','agricola','trator',2016,NULL,570,620,'powershift','esteira',6,13.5,'GLOBAL'),
('John Deere','Série 9RX','9620RX','RX','agricola','trator',2018,NULL,620,680,'powershift','esteira',6,13.5,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- JOHN DEERE — COLHEDORAS SÉRIE S / T / X
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('John Deere','Série S','S560',  'MFWD','agricola','colhedora',2012,2020,354,395,'CVT','4x2',6,9.0,'BR'),
('John Deere','Série S','S580',  'MFWD','agricola','colhedora',2012,2020,395,430,'CVT','4x2',6,9.0,'BR'),
('John Deere','Série S','S680',  'MFWD','agricola','colhedora',2012,2020,430,473,'CVT','4x2',6,13.5,'BR'),
('John Deere','Série S','S690',  'MFWD','agricola','colhedora',2012,2020,450,500,'CVT','4x2',6,13.5,'BR'),
('John Deere','Série X','X9 1000','4WD','agricola','colhedora',2021,NULL,563,631,'CVT','4x2',6,13.5,'GLOBAL'),
('John Deere','Série T','T550',  'MFWD','agricola','colhedora',2004,2014,270,300,'CVT','4x2',6,9.0,'BR'),
('John Deere','Série T','T560',  'MFWD','agricola','colhedora',2004,2014,296,330,'CVT','4x2',6,9.0,'BR'),
('John Deere','Série T','T670',  'MFWD','agricola','colhedora',2004,2014,380,420,'CVT','4x2',6,9.0,'BR')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- JOHN DEERE — PULVERIZADORES SÉRIE M / R
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('John Deere','Série M','M4030',NULL,'agricola','pulverizador',2012,2020,240,265,'CVT','4x4',6,9.0,'BR'),
('John Deere','Série R','R4023',NULL,'agricola','pulverizador',2016,NULL,265,290,'CVT','4x4',6,9.0,'BR'),
('John Deere','Série R','R4030',NULL,'agricola','pulverizador',2016,NULL,290,320,'CVT','4x4',6,9.0,'BR'),
('John Deere','Série R','R4038',NULL,'agricola','pulverizador',2020,NULL,320,360,'CVT','4x4',6,9.0,'BR')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- CASE IH — TRATORES FARMALL / MAXXUM / PUMA / MAGNUM
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
-- Farmall utilidade (2010+)
('Case IH','Farmall A','Farmall 75A', NULL,'agricola','trator',2010,NULL, 75, 80,'powershuttle','4x4',4,3.2,'GLOBAL'),
('Case IH','Farmall A','Farmall 85A', NULL,'agricola','trator',2010,NULL, 85, 90,'powershuttle','4x4',4,3.2,'GLOBAL'),
('Case IH','Farmall A','Farmall 95A', NULL,'agricola','trator',2010,NULL, 95,100,'powershuttle','4x4',4,3.2,'GLOBAL'),
('Case IH','Farmall A','Farmall 105A',NULL,'agricola','trator',2010,NULL,105,110,'powershuttle','4x4',4,3.2,'GLOBAL'),
('Case IH','Farmall A','Farmall 115A',NULL,'agricola','trator',2010,NULL,115,120,'powershuttle','4x4',4,3.2,'GLOBAL'),
-- Farmall C (Brasil)
('Case IH','Farmall C','Farmall 70C', NULL,'agricola','trator',2014,NULL, 70, 76,'powershuttle','4x4',4,3.4,'BR'),
('Case IH','Farmall C','Farmall 80C', NULL,'agricola','trator',2014,NULL, 80, 85,'powershuttle','4x4',4,3.4,'BR'),
('Case IH','Farmall C','Farmall 90C', NULL,'agricola','trator',2014,NULL, 90, 96,'powershuttle','4x4',4,4.4,'BR'),
('Case IH','Farmall C','Farmall 100C',NULL,'agricola','trator',2014,NULL,100,107,'powershuttle','4x4',4,4.4,'BR'),
('Case IH','Farmall C','Farmall 110C',NULL,'agricola','trator',2014,NULL,110,118,'powershuttle','4x4',4,4.4,'BR'),
-- Maxxum (2010+)
('Case IH','Maxxum','Maxxum 110',NULL,'agricola','trator',2010,NULL,110,120,'multicontroller','4x4',4,4.5,'GLOBAL'),
('Case IH','Maxxum','Maxxum 120',NULL,'agricola','trator',2010,NULL,120,130,'multicontroller','4x4',4,4.5,'GLOBAL'),
('Case IH','Maxxum','Maxxum 130',NULL,'agricola','trator',2010,NULL,130,140,'multicontroller','4x4',4,4.5,'GLOBAL'),
('Case IH','Maxxum','Maxxum 140',NULL,'agricola','trator',2010,NULL,140,150,'multicontroller','4x4',4,4.5,'GLOBAL'),
-- Puma (2010+)
('Case IH','Puma','Puma 140',  NULL,'agricola','trator',2010,NULL,140,155,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 150',  NULL,'agricola','trator',2010,NULL,150,165,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 165',  NULL,'agricola','trator',2010,NULL,165,180,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 185',  NULL,'agricola','trator',2010,NULL,185,205,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 200',  NULL,'agricola','trator',2010,NULL,200,218,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 220',  NULL,'agricola','trator',2014,NULL,220,240,'powershift','4x4',6,6.7,'GLOBAL'),
('Case IH','Puma','Puma 240',  NULL,'agricola','trator',2016,NULL,240,260,'CVX','4x4',6,6.7,'GLOBAL'),
-- Magnum (2010+)
('Case IH','Magnum','Magnum 250',NULL,'agricola','trator',2010,NULL,250,280,'powershift','4x4',6,8.7,'GLOBAL'),
('Case IH','Magnum','Magnum 280',NULL,'agricola','trator',2010,NULL,280,310,'powershift','4x4',6,8.7,'GLOBAL'),
('Case IH','Magnum','Magnum 310',NULL,'agricola','trator',2010,NULL,310,340,'powershift','4x4',6,8.7,'GLOBAL'),
('Case IH','Magnum','Magnum 340',NULL,'agricola','trator',2010,NULL,340,380,'powershift','4x4',6,8.7,'GLOBAL'),
('Case IH','Magnum','Magnum 380',NULL,'agricola','trator',2014,NULL,380,420,'powershift','4x4',6,12.9,'GLOBAL'),
-- Steiger/Quadtrac (2010+)
('Case IH','Steiger','Steiger 450',NULL,'agricola','trator',2010,NULL,450,500,'powershift','4x4',6,12.9,'GLOBAL'),
('Case IH','Steiger','Steiger 500',NULL,'agricola','trator',2010,NULL,500,550,'powershift','4x4',6,12.9,'GLOBAL'),
('Case IH','Quadtrac','Quadtrac 450',NULL,'agricola','trator',2010,NULL,450,500,'powershift','esteira',6,12.9,'GLOBAL'),
('Case IH','Quadtrac','Quadtrac 500',NULL,'agricola','trator',2010,NULL,500,550,'powershift','esteira',6,12.9,'GLOBAL'),
('Case IH','Quadtrac','Quadtrac 540',NULL,'agricola','trator',2016,NULL,540,600,'powershift','esteira',6,12.9,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- CASE IH — COLHEDORAS AXIAL-FLOW
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('Case IH','Axial-Flow','5140',NULL,'agricola','colhedora',2010,2018,260,290,'CVT','4x2',6,8.7,'GLOBAL'),
('Case IH','Axial-Flow','6140',NULL,'agricola','colhedora',2010,2018,318,355,'CVT','4x2',6,8.7,'GLOBAL'),
('Case IH','Axial-Flow','7140',NULL,'agricola','colhedora',2010,2018,380,420,'CVT','4x2',6,12.9,'GLOBAL'),
('Case IH','Axial-Flow','7240',NULL,'agricola','colhedora',2012,2020,420,460,'CVT','4x2',6,12.9,'GLOBAL'),
('Case IH','Axial-Flow','8240',NULL,'agricola','colhedora',2012,2020,460,505,'CVT','4x2',6,12.9,'GLOBAL'),
('Case IH','Axial-Flow','9240',NULL,'agricola','colhedora',2016,NULL,505,555,'CVT','4x2',6,12.9,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- NEW HOLLAND — TRATORES T5 / T6 / T7 / T8 / T9
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
-- T5 (2014+)
('New Holland','T5','T5.100',NULL,'agricola','trator',2014,NULL,100,110,'powercommand','4x4',4,3.4,'GLOBAL'),
('New Holland','T5','T5.110',NULL,'agricola','trator',2014,NULL,110,120,'powercommand','4x4',4,3.4,'GLOBAL'),
('New Holland','T5','T5.115',NULL,'agricola','trator',2014,NULL,115,125,'powercommand','4x4',4,3.4,'GLOBAL'),
('New Holland','T5','T5.120',NULL,'agricola','trator',2014,NULL,120,132,'powercommand','4x4',4,3.4,'GLOBAL'),
-- T6 (2014+)
('New Holland','T6','T6.140',NULL,'agricola','trator',2014,NULL,140,155,'autocommand','4x4',4,4.5,'GLOBAL'),
('New Holland','T6','T6.155',NULL,'agricola','trator',2014,NULL,155,170,'autocommand','4x4',4,4.5,'GLOBAL'),
('New Holland','T6','T6.160',NULL,'agricola','trator',2014,NULL,160,175,'autocommand','4x4',4,4.5,'GLOBAL'),
('New Holland','T6','T6.175',NULL,'agricola','trator',2014,NULL,175,190,'autocommand','4x4',4,4.5,'GLOBAL'),
-- T7 (2014+)
('New Holland','T7','T7.195',NULL,'agricola','trator',2014,NULL,195,215,'autocommand','4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.210',NULL,'agricola','trator',2014,NULL,210,230,'autocommand','4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.225',NULL,'agricola','trator',2014,NULL,225,245,'autocommand','4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.245',NULL,'agricola','trator',2014,NULL,245,265,'autocommand','4x4',6,6.7,'GLOBAL'),
('New Holland','T7','T7.270',NULL,'agricola','trator',2014,NULL,270,295,'autocommand','4x4',6,6.7,'GLOBAL'),
-- T8 (2014+)
('New Holland','T8','T8.320',NULL,'agricola','trator',2014,NULL,320,350,'autocommand','4x4',6,8.7,'GLOBAL'),
('New Holland','T8','T8.350',NULL,'agricola','trator',2014,NULL,350,385,'autocommand','4x4',6,8.7,'GLOBAL'),
('New Holland','T8','T8.380',NULL,'agricola','trator',2014,NULL,380,415,'autocommand','4x4',6,8.7,'GLOBAL'),
('New Holland','T8','T8.410',NULL,'agricola','trator',2014,NULL,410,450,'autocommand','4x4',6,8.7,'GLOBAL'),
('New Holland','T8','T8.435',NULL,'agricola','trator',2014,NULL,435,475,'autocommand','4x4',6,8.7,'GLOBAL'),
-- T9 (2014+)
('New Holland','T9','T9.390',NULL,'agricola','trator',2014,NULL,390,430,'powershift','4x4',6,12.9,'GLOBAL'),
('New Holland','T9','T9.450',NULL,'agricola','trator',2014,NULL,450,490,'powershift','4x4',6,12.9,'GLOBAL'),
('New Holland','T9','T9.505',NULL,'agricola','trator',2014,NULL,505,550,'powershift','4x4',6,12.9,'GLOBAL'),
('New Holland','T9','T9.560',NULL,'agricola','trator',2016,NULL,560,615,'powershift','4x4',6,12.9,'GLOBAL'),
('New Holland','T9','T9.615',NULL,'agricola','trator',2016,NULL,615,680,'powershift','4x4',6,12.9,'GLOBAL'),
-- TL Brasil (2000–2012)
('New Holland','TL','TL75',  NULL,'agricola','trator',2000,2012, 75, 80,'manual','4x4',4,3.4,'BR'),
('New Holland','TL','TL85',  NULL,'agricola','trator',2000,2012, 85, 90,'manual','4x4',4,3.4,'BR'),
('New Holland','TL','TL95',  NULL,'agricola','trator',2000,2012, 95,100,'manual','4x4',4,3.4,'BR'),
('New Holland','TL','TL100', NULL,'agricola','trator',2000,2012,100,107,'manual','4x4',4,3.4,'BR'),
-- TM (2000–2012)
('New Holland','TM','TM115', NULL,'agricola','trator',2000,2012,115,125,'powershift','4x4',6,6.0,'GLOBAL'),
('New Holland','TM','TM125', NULL,'agricola','trator',2000,2012,125,135,'powershift','4x4',6,6.0,'GLOBAL'),
('New Holland','TM','TM135', NULL,'agricola','trator',2000,2012,135,145,'powershift','4x4',6,6.0,'GLOBAL'),
('New Holland','TM','TM150', NULL,'agricola','trator',2000,2012,150,165,'powershift','4x4',6,6.0,'GLOBAL'),
('New Holland','TM','TM175', NULL,'agricola','trator',2000,2012,175,190,'powershift','4x4',6,6.0,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- NEW HOLLAND — COLHEDORAS CR / TC
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('New Holland','CR','CR5.80', NULL,'agricola','colhedora',2014,NULL,275,305,'CVT','4x2',6,8.7,'GLOBAL'),
('New Holland','CR','CR6.80', NULL,'agricola','colhedora',2014,NULL,305,340,'CVT','4x2',6,8.7,'GLOBAL'),
('New Holland','CR','CR7.90', NULL,'agricola','colhedora',2014,NULL,405,450,'CVT','4x2',6,12.9,'GLOBAL'),
('New Holland','CR','CR8.90', NULL,'agricola','colhedora',2014,NULL,450,500,'CVT','4x2',6,12.9,'GLOBAL'),
('New Holland','CR','CR9.90', NULL,'agricola','colhedora',2016,NULL,500,554,'CVT','4x2',6,12.9,'GLOBAL'),
('New Holland','TC','TC5.90', NULL,'agricola','colhedora',2014,NULL,185,205,'CVT','4x2',4,4.5,'BR'),
('New Holland','TC','TC5080',NULL,'agricola','colhedora',2008,2016,145,160,'CVT','4x2',4,4.5,'BR')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- VALTRA — SÉRIE A / B / BM / N / T / S (mercado brasileiro é muito importante)
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
-- BM (2000–2020) — icônico no Brasil
('Valtra','BM','BM85',  NULL,'agricola','trator',2000,2016, 85, 90,'powershuttle','4x4',4,4.4,'BR'),
('Valtra','BM','BM100', NULL,'agricola','trator',2000,2016,100,107,'powershuttle','4x4',4,4.4,'BR'),
('Valtra','BM','BM105i',NULL,'agricola','trator',2008,2016,105,112,'powershuttle','4x4',4,4.4,'BR'),
('Valtra','BM','BM110', NULL,'agricola','trator',2000,2016,110,118,'powershuttle','4x4',4,4.4,'BR'),
('Valtra','BM','BM120', NULL,'agricola','trator',2002,2016,120,128,'powershuttle','4x4',4,4.4,'BR'),
('Valtra','BM','BM125i',NULL,'agricola','trator',2008,2020,125,133,'powershuttle','4x4',4,4.4,'BR'),
-- A (2012+)
('Valtra','Série A','A750',NULL,'agricola','trator',2012,NULL, 75, 80,'manual','4x4',4,3.6,'BR'),
('Valtra','Série A','A950',NULL,'agricola','trator',2012,NULL, 95,100,'manual','4x4',4,3.6,'BR'),
-- B (2018+) — nova geração Brazil
('Valtra','Série B','B95',  NULL,'agricola','trator',2018,NULL, 95,100,'manual','4x4',4,3.6,'BR'),
('Valtra','Série B','B110', NULL,'agricola','trator',2018,NULL,110,118,'powershuttle','4x4',4,3.6,'BR'),
('Valtra','Série B','B120', NULL,'agricola','trator',2018,NULL,120,128,'powershuttle','4x4',4,3.6,'BR'),
('Valtra','Série B','B125', NULL,'agricola','trator',2018,NULL,125,132,'powershuttle','4x4',4,3.6,'BR'),
-- N (2012+)
('Valtra','Série N','N110',NULL,'agricola','trator',2012,NULL,110,120,'powershift','4x4',4,4.9,'GLOBAL'),
('Valtra','Série N','N130',NULL,'agricola','trator',2012,NULL,130,140,'powershift','4x4',4,4.9,'GLOBAL'),
('Valtra','Série N','N155',NULL,'agricola','trator',2012,NULL,155,165,'powershift','4x4',4,4.9,'GLOBAL'),
('Valtra','Série N','N175',NULL,'agricola','trator',2012,NULL,175,185,'powershift','4x4',4,4.9,'GLOBAL'),
-- T (2014+)
('Valtra','Série T','T150e',NULL,'agricola','trator',2014,NULL,150,165,'powershift','4x4',6,6.6,'GLOBAL'),
('Valtra','Série T','T175e',NULL,'agricola','trator',2014,NULL,175,190,'powershift','4x4',6,6.6,'GLOBAL'),
('Valtra','Série T','T195e',NULL,'agricola','trator',2014,NULL,195,205,'powershift','4x4',6,6.6,'GLOBAL'),
('Valtra','Série T','T215',NULL,'agricola','trator',2014,NULL,215,235,'powershift','4x4',6,6.6,'GLOBAL'),
-- S (2016+) de alta potência
('Valtra','Série S','S294',NULL,'agricola','trator',2016,NULL,294,320,'CVT','4x4',6,8.4,'GLOBAL'),
('Valtra','Série S','S324',NULL,'agricola','trator',2016,NULL,324,365,'CVT','4x4',6,8.4,'GLOBAL'),
('Valtra','Série S','S354',NULL,'agricola','trator',2016,NULL,354,390,'CVT','4x4',6,8.4,'GLOBAL'),
('Valtra','Série S','S374',NULL,'agricola','trator',2016,NULL,374,420,'CVT','4x4',6,8.4,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- MASSEY FERGUSON — SÉRIE 4700 / 5700 / 6700 / 7700 / 8700
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
-- Clássicos Brasil (2000–2015)
('Massey Ferguson','Série 200','MF 275', NULL,'agricola','trator',2000,2015, 75, 80,'manual','4x4',4,4.1,'BR'),
('Massey Ferguson','Série 200','MF 283', NULL,'agricola','trator',2000,2015, 83, 88,'manual','4x4',4,4.1,'BR'),
('Massey Ferguson','Série 200','MF 290', NULL,'agricola','trator',2000,2015, 90, 95,'manual','4x4',4,4.1,'BR'),
('Massey Ferguson','Série 200','MF 292', NULL,'agricola','trator',2000,2015, 92, 98,'manual','4x4',4,4.1,'BR'),
-- 4700 (2015+)
('Massey Ferguson','Série 4700','MF 4707',NULL,'agricola','trator',2015,NULL, 75, 80,'multiformance','4x4',4,3.3,'GLOBAL'),
('Massey Ferguson','Série 4700','MF 4708',NULL,'agricola','trator',2015,NULL, 85, 90,'multiformance','4x4',4,3.3,'GLOBAL'),
('Massey Ferguson','Série 4700','MF 4709',NULL,'agricola','trator',2015,NULL, 95,100,'multiformance','4x4',4,3.3,'GLOBAL'),
-- 5700 (2015+)
('Massey Ferguson','Série 5700','MF 5707',NULL,'agricola','trator',2015,NULL,105,115,'dyna-4','4x4',4,4.4,'GLOBAL'),
('Massey Ferguson','Série 5700','MF 5708',NULL,'agricola','trator',2015,NULL,115,125,'dyna-4','4x4',4,4.4,'GLOBAL'),
('Massey Ferguson','Série 5700','MF 5709',NULL,'agricola','trator',2015,NULL,125,135,'dyna-4','4x4',4,4.4,'GLOBAL'),
('Massey Ferguson','Série 5700','MF 5710',NULL,'agricola','trator',2015,NULL,130,142,'dyna-4','4x4',4,4.4,'GLOBAL'),
('Massey Ferguson','Série 5700','MF 5711',NULL,'agricola','trator',2015,NULL,140,152,'dyna-4','4x4',4,4.4,'GLOBAL'),
-- 6700 (2015+)
('Massey Ferguson','Série 6700','MF 6711',NULL,'agricola','trator',2015,NULL,125,138,'dyna-6','4x4',6,6.6,'GLOBAL'),
('Massey Ferguson','Série 6700','MF 6712',NULL,'agricola','trator',2015,NULL,135,148,'dyna-6','4x4',6,6.6,'GLOBAL'),
('Massey Ferguson','Série 6700','MF 6713',NULL,'agricola','trator',2015,NULL,145,158,'dyna-6','4x4',6,6.6,'GLOBAL'),
('Massey Ferguson','Série 6700','MF 6714',NULL,'agricola','trator',2015,NULL,155,168,'dyna-6','4x4',6,6.6,'GLOBAL'),
('Massey Ferguson','Série 6700','MF 6715',NULL,'agricola','trator',2015,NULL,165,180,'dyna-6','4x4',6,6.6,'GLOBAL'),
-- 7700 (2015+)
('Massey Ferguson','Série 7700','MF 7719',NULL,'agricola','trator',2015,NULL,190,210,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','Série 7700','MF 7720',NULL,'agricola','trator',2015,NULL,205,225,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','Série 7700','MF 7722',NULL,'agricola','trator',2015,NULL,225,245,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','Série 7700','MF 7724',NULL,'agricola','trator',2015,NULL,245,265,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','Série 7700','MF 7726',NULL,'agricola','trator',2015,NULL,265,285,'dyna-vt','4x4',6,8.4,'GLOBAL'),
-- 8700 (2015+)
('Massey Ferguson','Série 8700','MF 8730',NULL,'agricola','trator',2015,NULL,280,310,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','Série 8700','MF 8732',NULL,'agricola','trator',2015,NULL,310,340,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','Série 8700','MF 8735',NULL,'agricola','trator',2015,NULL,340,365,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','Série 8700','MF 8737',NULL,'agricola','trator',2015,NULL,365,400,'dyna-vt','4x4',6,8.4,'GLOBAL'),
('Massey Ferguson','Série 8700','MF 8740',NULL,'agricola','trator',2020,NULL,400,440,'dyna-vt','4x4',6,8.4,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- FENDT — SÉRIE 200 / 300 / 500 / 700 / 800 / 900 / 1000 VARIO
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
-- 200 Vario (2010+)
('Fendt','200 Vario','Fendt 209V',NULL,'agricola','trator',2010,NULL, 95,105,'CVT','4x4',4,3.6,'GLOBAL'),
('Fendt','200 Vario','Fendt 210V',NULL,'agricola','trator',2010,NULL,105,115,'CVT','4x4',4,3.6,'GLOBAL'),
('Fendt','200 Vario','Fendt 211V',NULL,'agricola','trator',2010,NULL,115,125,'CVT','4x4',4,3.6,'GLOBAL'),
-- 300 Vario (2010+)
('Fendt','300 Vario','Fendt 307',NULL,'agricola','trator',2010,NULL,125,140,'CVT','4x4',4,4.1,'GLOBAL'),
('Fendt','300 Vario','Fendt 308',NULL,'agricola','trator',2010,NULL,135,150,'CVT','4x4',4,4.1,'GLOBAL'),
('Fendt','300 Vario','Fendt 309',NULL,'agricola','trator',2010,NULL,145,165,'CVT','4x4',4,4.1,'GLOBAL'),
('Fendt','300 Vario','Fendt 310',NULL,'agricola','trator',2010,NULL,155,175,'CVT','4x4',4,4.1,'GLOBAL'),
('Fendt','300 Vario','Fendt 312',NULL,'agricola','trator',2014,NULL,165,185,'CVT','4x4',4,4.1,'GLOBAL'),
-- 500 Vario (2010+)
('Fendt','500 Vario','Fendt 510',NULL,'agricola','trator',2010,NULL,165,185,'CVT','4x4',4,4.1,'GLOBAL'),
('Fendt','500 Vario','Fendt 512',NULL,'agricola','trator',2010,NULL,185,205,'CVT','4x4',4,4.1,'GLOBAL'),
('Fendt','500 Vario','Fendt 514',NULL,'agricola','trator',2010,NULL,205,225,'CVT','4x4',4,4.1,'GLOBAL'),
('Fendt','500 Vario','Fendt 516',NULL,'agricola','trator',2014,NULL,225,250,'CVT','4x4',4,4.1,'GLOBAL'),
-- 700 Vario (2010+)
('Fendt','700 Vario','Fendt 714',NULL,'agricola','trator',2010,NULL,148,165,'CVT','4x4',6,6.1,'GLOBAL'),
('Fendt','700 Vario','Fendt 716',NULL,'agricola','trator',2010,NULL,165,180,'CVT','4x4',6,6.1,'GLOBAL'),
('Fendt','700 Vario','Fendt 718',NULL,'agricola','trator',2010,NULL,180,200,'CVT','4x4',6,6.1,'GLOBAL'),
('Fendt','700 Vario','Fendt 720',NULL,'agricola','trator',2010,NULL,200,220,'CVT','4x4',6,6.1,'GLOBAL'),
('Fendt','700 Vario','Fendt 722',NULL,'agricola','trator',2010,NULL,220,240,'CVT','4x4',6,6.1,'GLOBAL'),
('Fendt','700 Vario','Fendt 724',NULL,'agricola','trator',2016,NULL,240,260,'CVT','4x4',6,6.1,'GLOBAL'),
-- 900 Vario (2010+)
('Fendt','900 Vario','Fendt 924',NULL,'agricola','trator',2010,NULL,240,260,'CVT','4x4',6,12.4,'GLOBAL'),
('Fendt','900 Vario','Fendt 927',NULL,'agricola','trator',2010,NULL,270,295,'CVT','4x4',6,12.4,'GLOBAL'),
('Fendt','900 Vario','Fendt 930',NULL,'agricola','trator',2010,NULL,305,330,'CVT','4x4',6,12.4,'GLOBAL'),
('Fendt','900 Vario','Fendt 933',NULL,'agricola','trator',2010,NULL,330,360,'CVT','4x4',6,12.4,'GLOBAL'),
('Fendt','900 Vario','Fendt 936',NULL,'agricola','trator',2010,NULL,360,390,'CVT','4x4',6,12.4,'GLOBAL'),
('Fendt','900 Vario','Fendt 939',NULL,'agricola','trator',2010,NULL,390,430,'CVT','4x4',6,12.4,'GLOBAL'),
-- 1000 Vario (2014+)
('Fendt','1000 Vario','Fendt 1038',NULL,'agricola','trator',2014,NULL,380,420,'CVT','4x4',6,12.4,'GLOBAL'),
('Fendt','1000 Vario','Fendt 1042',NULL,'agricola','trator',2014,NULL,420,460,'CVT','4x4',6,12.4,'GLOBAL'),
('Fendt','1000 Vario','Fendt 1046',NULL,'agricola','trator',2014,NULL,460,500,'CVT','4x4',6,12.4,'GLOBAL'),
('Fendt','1000 Vario','Fendt 1050',NULL,'agricola','trator',2014,NULL,500,530,'CVT','4x4',6,12.4,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- DEUTZ-FAHR — SÉRIE AGROTRON / 6 / 7 / 8 / 9
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('Deutz-Fahr','Agrotron','Agrotron 115',NULL,'agricola','trator',2000,2012,115,125,'powrshift','4x4',4,4.4,'GLOBAL'),
('Deutz-Fahr','Agrotron','Agrotron 130',NULL,'agricola','trator',2000,2012,130,140,'powrshift','4x4',4,4.4,'GLOBAL'),
('Deutz-Fahr','Série 6','6130 TTV',NULL,'agricola','trator',2012,NULL,130,145,'CVT','4x4',4,4.4,'GLOBAL'),
('Deutz-Fahr','Série 6','6150 TTV',NULL,'agricola','trator',2012,NULL,150,165,'CVT','4x4',4,4.4,'GLOBAL'),
('Deutz-Fahr','Série 7','7230 TTV',NULL,'agricola','trator',2014,NULL,230,250,'CVT','4x4',6,6.1,'GLOBAL'),
('Deutz-Fahr','Série 7','7250 TTV',NULL,'agricola','trator',2014,NULL,250,275,'CVT','4x4',6,6.1,'GLOBAL'),
('Deutz-Fahr','Série 9','9340 TTV',NULL,'agricola','trator',2016,NULL,340,380,'CVT','4x4',6,7.8,'GLOBAL'),
('Deutz-Fahr','Série 9','9380 TTV',NULL,'agricola','trator',2016,NULL,380,420,'CVT','4x4',6,7.8,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- CLAAS — TRATORES AXION / ARION / XERION + COLHEDORAS LEXION
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
-- Arion (2010+)
('CLAAS','Arion 500','Arion 510', NULL,'agricola','trator',2010,NULL,120,135,'cmatic','4x4',4,4.5,'GLOBAL'),
('CLAAS','Arion 500','Arion 530', NULL,'agricola','trator',2010,NULL,145,160,'cmatic','4x4',4,4.5,'GLOBAL'),
('CLAAS','Arion 500','Arion 550', NULL,'agricola','trator',2010,NULL,165,185,'cmatic','4x4',4,4.5,'GLOBAL'),
-- Axion (2010+)
('CLAAS','Axion 800','Axion 810', NULL,'agricola','trator',2010,NULL,215,235,'cmatic','4x4',6,6.7,'GLOBAL'),
('CLAAS','Axion 800','Axion 830', NULL,'agricola','trator',2010,NULL,255,275,'cmatic','4x4',6,6.7,'GLOBAL'),
('CLAAS','Axion 800','Axion 850', NULL,'agricola','trator',2010,NULL,295,320,'cmatic','4x4',6,6.7,'GLOBAL'),
('CLAAS','Axion 900','Axion 930', NULL,'agricola','trator',2012,NULL,295,320,'cmatic','4x4',6,6.7,'GLOBAL'),
('CLAAS','Axion 900','Axion 950', NULL,'agricola','trator',2012,NULL,320,345,'cmatic','4x4',6,6.7,'GLOBAL'),
-- Xerion
('CLAAS','Xerion','Xerion 3300',NULL,'agricola','trator',2012,NULL,330,370,'cmatic','4x4',6,7.8,'GLOBAL'),
('CLAAS','Xerion','Xerion 4000',NULL,'agricola','trator',2012,NULL,400,450,'cmatic','4x4',6,7.8,'GLOBAL'),
-- Lexion colhedoras
('CLAAS','Lexion','Lexion 5300',NULL,'agricola','colhedora',2012,2020,360,400,'CVT','4x2',6,12.0,'GLOBAL'),
('CLAAS','Lexion','Lexion 6700',NULL,'agricola','colhedora',2014,NULL,445,490,'CVT','4x2',6,12.0,'GLOBAL'),
('CLAAS','Lexion','Lexion 7700',NULL,'agricola','colhedora',2016,NULL,520,590,'CVT','4x2',6,12.0,'GLOBAL'),
('CLAAS','Lexion','Lexion 8900',NULL,'agricola','colhedora',2018,NULL,620,680,'CVT','4x2',6,15.6,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- CATERPILLAR — MOTONIVELADORAS SÉRIE H / K / M
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
-- Série H (2000–2010)
('Caterpillar','Série H','120H',  NULL,'construcao','moto-niveladora',2000,2010,125,140,'powershift','AWD',6,7.2,'GLOBAL'),
('Caterpillar','Série H','140H',  NULL,'construcao','moto-niveladora',2000,2010,155,175,'powershift','AWD',6,7.2,'GLOBAL'),
('Caterpillar','Série H','143H',  NULL,'construcao','moto-niveladora',2000,2010,175,195,'powershift','AWD',6,7.2,'GLOBAL'),
('Caterpillar','Série H','160H',  NULL,'construcao','moto-niveladora',2000,2010,185,210,'powershift','AWD',6,7.2,'GLOBAL'),
-- Série K (2010–2015)
('Caterpillar','Série K','120K',  NULL,'construcao','moto-niveladora',2010,2015,130,150,'powershift','AWD',6,7.2,'GLOBAL'),
('Caterpillar','Série K','140K',  NULL,'construcao','moto-niveladora',2010,2015,160,180,'powershift','AWD',6,7.2,'GLOBAL'),
('Caterpillar','Série K','160K',  NULL,'construcao','moto-niveladora',2010,2015,190,215,'powershift','AWD',6,7.2,'GLOBAL'),
-- Série M (2014+)
('Caterpillar','Série M','120M',  NULL,'construcao','moto-niveladora',2014,NULL,155,175,'powershift','AWD',6,7.2,'GLOBAL'),
('Caterpillar','Série M','120M2', NULL,'construcao','moto-niveladora',2016,NULL,160,180,'powershift','AWD',6,7.2,'GLOBAL'),
('Caterpillar','Série M','140M',  NULL,'construcao','moto-niveladora',2014,NULL,185,210,'powershift','AWD',6,7.2,'GLOBAL'),
('Caterpillar','Série M','140M2', NULL,'construcao','moto-niveladora',2016,NULL,190,215,'powershift','AWD',6,7.2,'GLOBAL'),
('Caterpillar','Série M','140M3', NULL,'construcao','moto-niveladora',2018,NULL,200,225,'powershift','AWD',6,7.2,'GLOBAL'),
('Caterpillar','Série M','160M',  NULL,'construcao','moto-niveladora',2014,NULL,225,255,'powershift','AWD',6,7.2,'GLOBAL'),
('Caterpillar','Série M','160M3', NULL,'construcao','moto-niveladora',2018,NULL,235,265,'powershift','AWD',6,7.2,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- CATERPILLAR — PÁS CARREGADEIRAS SÉRIE D / F / H / K
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('Caterpillar','938','938G',  NULL,'construcao','pa-carregadeira',2000,2008,138,155,'powershift','4x4',6,7.2,'GLOBAL'),
('Caterpillar','938','938H',  NULL,'construcao','pa-carregadeira',2008,2014,155,175,'powershift','4x4',6,7.2,'GLOBAL'),
('Caterpillar','938','938K',  NULL,'construcao','pa-carregadeira',2014,NULL,175,195,'powershift','4x4',6,7.2,'GLOBAL'),
('Caterpillar','950','950G',  NULL,'construcao','pa-carregadeira',2000,2008,155,175,'powershift','4x4',6,7.2,'GLOBAL'),
('Caterpillar','950','950H',  NULL,'construcao','pa-carregadeira',2008,2014,175,195,'powershift','4x4',6,7.2,'GLOBAL'),
('Caterpillar','950','950M',  NULL,'construcao','pa-carregadeira',2014,NULL,195,215,'powershift','4x4',6,7.2,'GLOBAL'),
('Caterpillar','966','966D',  NULL,'construcao','pa-carregadeira',2000,2004,220,245,'powershift','4x4',6,12.5,'GLOBAL'),
('Caterpillar','966','966G',  NULL,'construcao','pa-carregadeira',2004,2010,240,270,'powershift','4x4',6,12.5,'GLOBAL'),
('Caterpillar','966','966H',  NULL,'construcao','pa-carregadeira',2010,2016,265,295,'powershift','4x4',6,12.5,'GLOBAL'),
('Caterpillar','966','966M',  NULL,'construcao','pa-carregadeira',2016,NULL,295,325,'powershift','4x4',6,12.5,'GLOBAL'),
('Caterpillar','972','972M',  NULL,'construcao','pa-carregadeira',2016,NULL,325,365,'powershift','4x4',6,15.2,'GLOBAL'),
('Caterpillar','980','980M',  NULL,'construcao','pa-carregadeira',2016,NULL,370,420,'powershift','4x4',6,15.2,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- CATERPILLAR — ESCAVADEIRAS SÉRIE D / E
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('Caterpillar','320','320D',  NULL,'construcao','escavadeira',2007,2014,138,155,'hidrostática','esteira',6,7.2,'GLOBAL'),
('Caterpillar','320','320E',  NULL,'construcao','escavadeira',2014,NULL,155,175,'hidrostática','esteira',6,7.2,'GLOBAL'),
('Caterpillar','320','320GC', NULL,'construcao','escavadeira',2018,NULL,170,190,'hidrostática','esteira',6,7.2,'GLOBAL'),
('Caterpillar','323','323D',  NULL,'construcao','escavadeira',2008,2016,168,190,'hidrostática','esteira',6,7.2,'GLOBAL'),
('Caterpillar','336','336D',  NULL,'construcao','escavadeira',2008,2016,270,310,'hidrostática','esteira',6,12.5,'GLOBAL'),
('Caterpillar','336','336E',  NULL,'construcao','escavadeira',2016,NULL,310,350,'hidrostática','esteira',6,12.5,'GLOBAL'),
('Caterpillar','374','374D',  NULL,'construcao','escavadeira',2010,2018,395,440,'hidrostática','esteira',6,15.2,'GLOBAL'),
('Caterpillar','374','374F',  NULL,'construcao','escavadeira',2018,NULL,440,490,'hidrostática','esteira',6,15.2,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- CATERPILLAR — TRATORES DE ESTEIRA DOZER
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('Caterpillar','D5','D5M',  NULL,'construcao','trator-esteira',2000,2008,105,120,'powershift','esteira',6,7.2,'GLOBAL'),
('Caterpillar','D5','D5N',  NULL,'construcao','trator-esteira',2008,2016,120,135,'powershift','esteira',6,7.2,'GLOBAL'),
('Caterpillar','D6','D6T',  NULL,'construcao','trator-esteira',2008,NULL,155,180,'powershift','esteira',6,7.2,'GLOBAL'),
('Caterpillar','D6','D6R',  NULL,'construcao','trator-esteira',2000,2008,140,160,'powershift','esteira',6,7.2,'GLOBAL'),
('Caterpillar','D7','D7E',  NULL,'construcao','trator-esteira',2009,NULL,235,265,'elétrica','esteira',6,9.3,'GLOBAL'),
('Caterpillar','D8','D8T',  NULL,'construcao','trator-esteira',2008,NULL,305,350,'powershift','esteira',6,12.5,'GLOBAL'),
('Caterpillar','D9','D9T',  NULL,'construcao','trator-esteira',2008,NULL,410,460,'powershift','esteira',6,18.1,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- KOMATSU — MOTONIVELADORAS / PÁS / ESCAVADEIRAS / DOZERS
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
-- Motoniveladoras GD
('Komatsu','GD 500','GD505A-2',NULL,'construcao','moto-niveladora',2000,2010,128,145,'powershift','AWD',6,8.5,'GLOBAL'),
('Komatsu','GD 500','GD505A-2E',NULL,'construcao','moto-niveladora',2000,2010,128,145,'powershift','AWD',6,8.5,'GLOBAL'),
('Komatsu','GD 600','GD655A-3', NULL,'construcao','moto-niveladora',2000,2014,168,190,'powershift','AWD',6,8.5,'GLOBAL'),
('Komatsu','GD 700','GD705A-4', NULL,'construcao','moto-niveladora',2005,2016,195,220,'powershift','AWD',6,11.0,'GLOBAL'),
('Komatsu','GD 800','GD825A-2', NULL,'construcao','moto-niveladora',2005,NULL,255,290,'powershift','AWD',6,11.0,'GLOBAL'),
-- Pás carregadeiras WA
('Komatsu','WA320','WA320-6',NULL,'construcao','pa-carregadeira',2010,NULL,168,190,'powershift','4x4',6,8.3,'GLOBAL'),
('Komatsu','WA380','WA380-7',NULL,'construcao','pa-carregadeira',2014,NULL,210,235,'powershift','4x4',6,8.3,'GLOBAL'),
('Komatsu','WA430','WA430-7',NULL,'construcao','pa-carregadeira',2014,NULL,235,265,'powershift','4x4',6,8.3,'GLOBAL'),
('Komatsu','WA470','WA470-8',NULL,'construcao','pa-carregadeira',2016,NULL,275,310,'powershift','4x4',6,8.3,'GLOBAL'),
('Komatsu','WA500','WA500-7',NULL,'construcao','pa-carregadeira',2012,NULL,330,370,'powershift','4x4',6,11.0,'GLOBAL'),
-- Escavadeiras PC
('Komatsu','PC210','PC210LC-10',NULL,'construcao','escavadeira',2010,NULL,148,165,'hidrostática','esteira',6,6.7,'GLOBAL'),
('Komatsu','PC290','PC290LC-11',NULL,'construcao','escavadeira',2012,NULL,203,225,'hidrostática','esteira',6,6.7,'GLOBAL'),
('Komatsu','PC360','PC360LC-10',NULL,'construcao','escavadeira',2012,NULL,268,300,'hidrostática','esteira',6,9.0,'GLOBAL'),
('Komatsu','PC490','PC490LC-11',NULL,'construcao','escavadeira',2014,NULL,352,395,'hidrostática','esteira',6,11.0,'GLOBAL'),
-- Dozers D
('Komatsu','D65','D65EX-16',NULL,'construcao','trator-esteira',2010,NULL,168,190,'powershift','esteira',6,8.3,'GLOBAL'),
('Komatsu','D85','D85EX-15',NULL,'construcao','trator-esteira',2008,NULL,220,250,'powershift','esteira',6,11.0,'GLOBAL'),
('Komatsu','D155','D155AX-7',NULL,'construcao','trator-esteira',2014,NULL,310,350,'powershift','esteira',6,15.2,'GLOBAL'),
('Komatsu','D375','D375A-6',NULL,'construcao','trator-esteira',2012,NULL,520,590,'powershift','esteira',12,38.0,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- VOLVO CE — MOTONIVELADORAS G / PÁS L / ESCAVADEIRAS EC
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
-- Motoniveladoras G-Series
('Volvo CE','G-Series','G710B', NULL,'construcao','moto-niveladora',2000,2008,156,175,'powershift','AWD',6,8.5,'GLOBAL'),
('Volvo CE','G-Series','G720B', NULL,'construcao','moto-niveladora',2000,2008,170,190,'powershift','AWD',6,8.5,'GLOBAL'),
('Volvo CE','G-Series','G726B', NULL,'construcao','moto-niveladora',2000,2012,186,210,'powershift','AWD',6,8.5,'GLOBAL'),
('Volvo CE','G-Series','G730B', NULL,'construcao','moto-niveladora',2008,2016,206,230,'powershift','AWD',6,8.5,'GLOBAL'),
('Volvo CE','G-Series','G930',  NULL,'construcao','moto-niveladora',2005,NULL,186,210,'powershift','AWD',6,8.5,'GLOBAL'),
('Volvo CE','G-Series','G940',  NULL,'construcao','moto-niveladora',2005,NULL,206,235,'powershift','AWD',6,11.1,'GLOBAL'),
('Volvo CE','G-Series','G946',  NULL,'construcao','moto-niveladora',2005,NULL,215,245,'powershift','AWD',6,11.1,'GLOBAL'),
('Volvo CE','G-Series','G960',  NULL,'construcao','moto-niveladora',2005,NULL,240,270,'powershift','AWD',6,11.1,'GLOBAL'),
('Volvo CE','G-Series','G970',  NULL,'construcao','moto-niveladora',2010,NULL,270,310,'powershift','AWD',6,11.1,'GLOBAL'),
('Volvo CE','G-Series','G976',  NULL,'construcao','moto-niveladora',2010,NULL,285,325,'powershift','AWD',6,11.1,'GLOBAL'),
-- Pás carregadeiras L
('Volvo CE','L-Series','L70F',  NULL,'construcao','pa-carregadeira',2006,2014,115,130,'torque-conv','4x4',4,6.7,'GLOBAL'),
('Volvo CE','L-Series','L90F',  NULL,'construcao','pa-carregadeira',2006,2014,148,168,'torque-conv','4x4',6,7.2,'GLOBAL'),
('Volvo CE','L-Series','L110F', NULL,'construcao','pa-carregadeira',2006,2014,168,190,'torque-conv','4x4',6,7.2,'GLOBAL'),
('Volvo CE','L-Series','L120F', NULL,'construcao','pa-carregadeira',2006,2014,195,220,'torque-conv','4x4',6,7.2,'GLOBAL'),
('Volvo CE','L-Series','L150F', NULL,'construcao','pa-carregadeira',2008,2016,220,250,'torque-conv','4x4',6,13.0,'GLOBAL'),
('Volvo CE','L-Series','L180F', NULL,'construcao','pa-carregadeira',2008,2016,270,305,'torque-conv','4x4',6,13.0,'GLOBAL'),
-- Geração H
('Volvo CE','L-Series','L90H',  NULL,'construcao','pa-carregadeira',2014,NULL,168,190,'CVT','4x4',6,7.2,'GLOBAL'),
('Volvo CE','L-Series','L120H', NULL,'construcao','pa-carregadeira',2014,NULL,200,225,'CVT','4x4',6,7.2,'GLOBAL'),
('Volvo CE','L-Series','L150H', NULL,'construcao','pa-carregadeira',2016,NULL,235,265,'CVT','4x4',6,13.0,'GLOBAL'),
('Volvo CE','L-Series','L180H', NULL,'construcao','pa-carregadeira',2016,NULL,285,320,'CVT','4x4',6,13.0,'GLOBAL'),
-- Escavadeiras EC
('Volvo CE','EC-Series','EC210B',NULL,'construcao','escavadeira',2004,2012,150,168,'hidrostática','esteira',6,6.7,'GLOBAL'),
('Volvo CE','EC-Series','EC210D',NULL,'construcao','escavadeira',2012,NULL,156,175,'hidrostática','esteira',6,6.7,'GLOBAL'),
('Volvo CE','EC-Series','EC290B',NULL,'construcao','escavadeira',2004,2012,195,218,'hidrostática','esteira',6,6.7,'GLOBAL'),
('Volvo CE','EC-Series','EC300D',NULL,'construcao','escavadeira',2012,NULL,218,245,'hidrostática','esteira',6,9.4,'GLOBAL'),
('Volvo CE','EC-Series','EC380D',NULL,'construcao','escavadeira',2012,NULL,275,310,'hidrostática','esteira',6,9.4,'GLOBAL'),
('Volvo CE','EC-Series','EC480D',NULL,'construcao','escavadeira',2014,NULL,360,405,'hidrostática','esteira',6,12.8,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- JCB — RETROESCAVADEIRAS / MINICARREGADEIRAS / ESCAVADEIRAS
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('JCB','3CX','3CX',       NULL,'construcao','retroescavadeira',2000,NULL, 90,100,'powershift','4x4',4,4.4,'GLOBAL'),
('JCB','4CX','4CX',       NULL,'construcao','retroescavadeira',2000,NULL,110,120,'powershift','4x4',4,4.4,'GLOBAL'),
('JCB','JS','JS220 LC',   NULL,'construcao','escavadeira',2005,NULL,148,165,'hidrostática','esteira',4,4.8,'GLOBAL'),
('JCB','JS','JS290 LC',   NULL,'construcao','escavadeira',2005,NULL,180,200,'hidrostática','esteira',6,7.2,'GLOBAL'),
('JCB','413S','413S',     NULL,'construcao','pa-carregadeira',2012,NULL,110,125,'powershift','4x4',4,4.4,'GLOBAL'),
('JCB','437','437',       NULL,'construcao','pa-carregadeira',2012,NULL,148,168,'powershift','4x4',4,7.2,'GLOBAL'),
('JCB','457','457',       NULL,'construcao','pa-carregadeira',2012,NULL,240,270,'powershift','4x4',6,7.2,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- KOMATSU FLORESTAL — PROCESSADORES / FORWARDERS
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('Komatsu Forest','Harvester','911.5',NULL,'florestal','harvester',2010,NULL,218,245,'hidrostática','6x6',6,8.3,'GLOBAL'),
('Komatsu Forest','Harvester','931XC',NULL,'florestal','harvester',2012,NULL,265,300,'hidrostática','6x6',6,8.3,'GLOBAL'),
('Komatsu Forest','Forwarder','895',  NULL,'florestal','forwarder', 2010,NULL,218,245,'hidrostática','8x8',6,8.3,'GLOBAL'),
('Komatsu Forest','Forwarder','875',  NULL,'florestal','forwarder', 2010,NULL,180,200,'hidrostática','8x8',6,8.3,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- JOHN DEERE FLORESTAL — HARVESTERS / FORWARDERS
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES
('John Deere','1270','1270G',NULL,'florestal','harvester',2016,NULL,218,245,'hidrostática','8x8',6,9.0,'GLOBAL'),
('John Deere','1470','1470G',NULL,'florestal','harvester',2016,NULL,268,300,'hidrostática','8x8',6,9.0,'GLOBAL'),
('John Deere','1510','1510G',NULL,'florestal','forwarder',2016,NULL,175,200,'hidrostática','8x8',6,9.0,'GLOBAL'),
('John Deere','1910','1910G',NULL,'florestal','forwarder',2016,NULL,218,245,'hidrostática','8x8',6,9.0,'GLOBAL')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- VIEW: atualiza cat_modelos_por_ano para incluir todos os modelos novos
-- ════════════════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS cat_modelos_por_ano;
CREATE VIEW cat_modelos_por_ano AS
SELECT
  m.*,
  (SELECT COUNT(*) FROM cat_planos p WHERE p.modelo_id = m.id) AS total_planos
FROM cat_modelos m
ORDER BY m.fabricante, m.familia, m.ano_inicio DESC;

-- ════════════════════════════════════════════════════════════════════════════
-- RESUMO — contagem por fabricante
-- ════════════════════════════════════════════════════════════════════════════
SELECT fabricante, COUNT(*) AS total_modelos
FROM cat_modelos
GROUP BY fabricante
ORDER BY total_modelos DESC;
