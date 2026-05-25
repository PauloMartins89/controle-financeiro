-- ════════════════════════════════════════════════════════════════════════
-- CATÁLOGO — Mais Marcas: Deutz-Fahr, CLAAS, Kubota, Caterpillar, Komatsu, JCB
-- ~220 modelos adicionais para o mercado brasileiro e global
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════════════════

-- ── Fabricantes adicionais ────────────────────────────────────────────────────
INSERT INTO cat_fabricantes (nome, pais_origem, grupo, website) VALUES
  ('Deutz-Fahr',   'Germany',  'SDF Group',    'https://www.deutz-fahr.com.br'),
  ('CLAAS',        'Germany',  'CLAAS',        'https://www.claas.com.br'),
  ('Kubota',       'Japan',    'Kubota Corp',  'https://www.kubota.com.br'),
  ('Caterpillar',  'USA',      'Caterpillar',  'https://www.cat.com/pt_BR'),
  ('Komatsu',      'Japan',    'Komatsu',      'https://www.komatsu.com.br'),
  ('JCB',          'UK',       'JCB',          'https://www.jcb.com/pt-br'),
  ('Agrale',       'Brazil',   'Agrale',       'https://www.agrale.com.br'),
  ('Landini',      'Italy',    'SDF Group',    'https://www.landini.it'),
  ('Same',         'Italy',    'SDF Group',    'https://www.same-tractors.com'),
  ('Bobcat',       'USA',      'Doosan',       'https://www.bobcat.com/pt-br')
ON CONFLICT (nome) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- DEUTZ-FAHR
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO cat_modelos (fabricante, familia, modelo, configuracao, classe, tipo, ano_inicio, ano_fim, potencia_cv_min, potencia_cv_max, transmissao, tracao, motor_cilindros, motor_litros, mercado) VALUES

-- Agrotron 5 Series (compact)
('Deutz-Fahr','Agrotron 5','5090.4',  '4WD','agricola','trator',2015,NULL, 90, 90,'powershift','4x4',4,3.6,'GLOBAL'),
('Deutz-Fahr','Agrotron 5','5100.4',  '4WD','agricola','trator',2015,NULL,100,100,'powershift','4x4',4,3.6,'GLOBAL'),
('Deutz-Fahr','Agrotron 5','5110.4',  '4WD','agricola','trator',2015,NULL,110,110,'powershift','4x4',4,3.6,'GLOBAL'),
('Deutz-Fahr','Agrotron 5','5115.4',  '4WD','agricola','trator',2015,NULL,115,115,'powershift','4x4',4,3.6,'GLOBAL'),

-- Agrotron 6 Series (mid-range)
('Deutz-Fahr','Agrotron 6','6120.4',  '4WD','agricola','trator',2016,NULL,120,120,'powershift','4x4',4,4.1,'GLOBAL'),
('Deutz-Fahr','Agrotron 6','6130.4',  '4WD','agricola','trator',2016,NULL,130,130,'powershift','4x4',4,4.1,'GLOBAL'),
('Deutz-Fahr','Agrotron 6','6130C',   'CVT','agricola','trator',2018,NULL,130,130,'CVT',       '4x4',4,4.1,'GLOBAL'),
('Deutz-Fahr','Agrotron 6','6150.4',  '4WD','agricola','trator',2016,NULL,150,150,'powershift','4x4',4,4.1,'GLOBAL'),
('Deutz-Fahr','Agrotron 6','6150C',   'CVT','agricola','trator',2018,NULL,150,150,'CVT',       '4x4',4,4.1,'GLOBAL'),
('Deutz-Fahr','Agrotron 6','6165C',   'CVT','agricola','trator',2019,NULL,165,165,'CVT',       '4x4',4,4.1,'GLOBAL'),
('Deutz-Fahr','Agrotron 6','6175C',   'CVT','agricola','trator',2019,NULL,175,175,'CVT',       '4x4',4,4.1,'GLOBAL'),
('Deutz-Fahr','Agrotron 6','6175RC',  'CVT','agricola','trator',2020,NULL,175,175,'CVT',       '4x4',6,6.1,'GLOBAL'),
('Deutz-Fahr','Agrotron 6','6190P',   '4WD','agricola','trator',2020,NULL,190,190,'powershift','4x4',6,6.1,'GLOBAL'),
('Deutz-Fahr','Agrotron 6','6190RCShift','CVT','agricola','trator',2020,NULL,190,190,'CVT',    '4x4',6,6.1,'GLOBAL'),

-- Agrotron 7 Series (high power TTV)
('Deutz-Fahr','Agrotron 7','7210 TTV','TTV','agricola','trator',2013,2021,210,210,'CVT',       '4x4',6,7.1,'GLOBAL'),
('Deutz-Fahr','Agrotron 7','7230 TTV','TTV','agricola','trator',2013,2021,230,230,'CVT',       '4x4',6,7.1,'GLOBAL'),
('Deutz-Fahr','Agrotron 7','7250 TTV','TTV','agricola','trator',2013,2021,250,250,'CVT',       '4x4',6,7.1,'GLOBAL'),

-- Agrotron 9 Series (flagship TTV)
('Deutz-Fahr','Agrotron 9','9290 TTV','TTV','agricola','trator',2017,NULL,290,290,'CVT',       '4x4',6,7.8,'GLOBAL'),
('Deutz-Fahr','Agrotron 9','9310 TTV','TTV','agricola','trator',2017,NULL,310,310,'CVT',       '4x4',6,7.8,'GLOBAL'),
('Deutz-Fahr','Agrotron 9','9340 TTV','TTV','agricola','trator',2017,NULL,340,340,'CVT',       '4x4',6,7.8,'GLOBAL'),
('Deutz-Fahr','Agrotron 9','9360 TTV','TTV','agricola','trator',2019,NULL,360,360,'CVT',       '4x4',6,7.8,'GLOBAL'),

-- Agrofarm (small/compact)
('Deutz-Fahr','Agrofarm',  'Agrofarm 100','4WD','agricola','trator',2008,2016,100,100,'powershift','4x4',4,3.6,'BR'),
('Deutz-Fahr','Agrofarm',  'Agrofarm 115','4WD','agricola','trator',2008,2016,115,115,'powershift','4x4',4,3.6,'BR'),

-- ════════════════════════════════════════════════════════════════════════
-- CLAAS
-- ════════════════════════════════════════════════════════════════════════

-- Arion 400 Series
('CLAAS','Arion 400','Arion 420','4WD','agricola','trator',2016,NULL,100,100,'powershift','4x4',4,4.1,'GLOBAL'),
('CLAAS','Arion 400','Arion 430','4WD','agricola','trator',2016,NULL,110,110,'powershift','4x4',4,4.1,'GLOBAL'),
('CLAAS','Arion 400','Arion 440','4WD','agricola','trator',2016,NULL,125,125,'powershift','4x4',4,4.1,'GLOBAL'),
('CLAAS','Arion 400','Arion 450','4WD','agricola','trator',2016,NULL,140,140,'powershift','4x4',4,4.1,'GLOBAL'),
('CLAAS','Arion 400','Arion 460','4WD','agricola','trator',2016,NULL,150,150,'powershift','4x4',4,4.1,'GLOBAL'),

-- Arion 500 Series
('CLAAS','Arion 500','Arion 510','4WD','agricola','trator',2016,NULL,125,125,'powershift','4x4',4,4.5,'GLOBAL'),
('CLAAS','Arion 500','Arion 520','4WD','agricola','trator',2016,NULL,130,130,'powershift','4x4',4,4.5,'GLOBAL'),
('CLAAS','Arion 500','Arion 530','4WD','agricola','trator',2016,NULL,145,145,'powershift','4x4',4,4.5,'GLOBAL'),
('CLAAS','Arion 500','Arion 540','4WD','agricola','trator',2016,NULL,160,160,'powershift','4x4',4,4.5,'GLOBAL'),
('CLAAS','Arion 500','Arion 550','4WD','agricola','trator',2016,NULL,175,175,'powershift','4x4',4,4.5,'GLOBAL'),
('CLAAS','Arion 500','Arion 560','4WD','agricola','trator',2018,NULL,185,185,'powershift','4x4',4,4.5,'GLOBAL'),

-- Arion 600 Series
('CLAAS','Arion 600','Arion 620','4WD','agricola','trator',2013,NULL,130,130,'powershift','4x4',6,6.1,'GLOBAL'),
('CLAAS','Arion 600','Arion 630','4WD','agricola','trator',2013,NULL,145,145,'powershift','4x4',6,6.1,'GLOBAL'),
('CLAAS','Arion 600','Arion 640','4WD','agricola','trator',2013,NULL,155,155,'powershift','4x4',6,6.1,'GLOBAL'),
('CLAAS','Arion 600','Arion 650','4WD','agricola','trator',2013,NULL,165,165,'powershift','4x4',6,6.1,'GLOBAL'),
('CLAAS','Arion 600','Arion 660','4WD','agricola','trator',2013,NULL,180,180,'powershift','4x4',6,6.1,'GLOBAL'),

-- Axion 800 Series
('CLAAS','Axion 800', 'Axion 810','CMATIC','agricola','trator',2018,NULL,200,200,'CVT','4x4',6,6.8,'GLOBAL'),
('CLAAS','Axion 800', 'Axion 820','CMATIC','agricola','trator',2018,NULL,215,215,'CVT','4x4',6,6.8,'GLOBAL'),
('CLAAS','Axion 800', 'Axion 830','CMATIC','agricola','trator',2018,NULL,230,230,'CVT','4x4',6,6.8,'GLOBAL'),
('CLAAS','Axion 800', 'Axion 840','CMATIC','agricola','trator',2018,NULL,245,245,'CVT','4x4',6,6.8,'GLOBAL'),
('CLAAS','Axion 800', 'Axion 850','CMATIC','agricola','trator',2018,NULL,260,260,'CVT','4x4',6,6.8,'GLOBAL'),
('CLAAS','Axion 800', 'Axion 870','CMATIC','agricola','trator',2021,NULL,295,295,'CVT','4x4',6,6.8,'GLOBAL'),

-- Axion 900 Series (flagship)
('CLAAS','Axion 900', 'Axion 920','CMATIC','agricola','trator',2012,NULL,225,225,'CVT','4x4',6,8.7,'GLOBAL'),
('CLAAS','Axion 900', 'Axion 930','CMATIC','agricola','trator',2012,NULL,245,245,'CVT','4x4',6,8.7,'GLOBAL'),
('CLAAS','Axion 900', 'Axion 940','CMATIC','agricola','trator',2012,NULL,270,270,'CVT','4x4',6,8.7,'GLOBAL'),
('CLAAS','Axion 900', 'Axion 950','CMATIC','agricola','trator',2012,NULL,295,295,'CVT','4x4',6,8.7,'GLOBAL'),
('CLAAS','Axion 900', 'Axion 960','CMATIC','agricola','trator',2015,NULL,325,325,'CVT','4x4',6,8.7,'GLOBAL'),

-- Xerion (articulado de alta potência)
('CLAAS','Xerion','Xerion 3800','TRAC','agricola','trator',2014,NULL,370,370,'CVT','4x4',6,12.8,'GLOBAL'),
('CLAAS','Xerion','Xerion 4000','TRAC','agricola','trator',2014,NULL,395,395,'CVT','4x4',6,12.8,'GLOBAL'),
('CLAAS','Xerion','Xerion 4500','TRAC','agricola','trator',2014,NULL,450,450,'CVT','4x4',6,12.8,'GLOBAL'),
('CLAAS','Xerion','Xerion 5000','TRAC','agricola','trator',2019,NULL,530,530,'CVT','4x4',6,12.8,'GLOBAL'),

-- ════════════════════════════════════════════════════════════════════════
-- KUBOTA
-- ════════════════════════════════════════════════════════════════════════

-- Série B (compacto, hortifruti)
('Kubota','Série B','B2650',  '4WD','agricola','trator',2014,NULL, 26, 26,'manual',    '4x4',3,1.5,'GLOBAL'),
('Kubota','Série B','B3350',  '4WD','agricola','trator',2014,NULL, 33, 33,'manual',    '4x4',3,1.8,'GLOBAL'),

-- Série L (médio porte)
('Kubota','Série L','L3560',  '4WD','agricola','trator',2018,NULL, 37, 37,'manual',    '4x4',4,2.2,'GLOBAL'),
('Kubota','Série L','L4060',  '4WD','agricola','trator',2018,NULL, 40, 40,'manual',    '4x4',4,2.5,'GLOBAL'),
('Kubota','Série L','L4760',  '4WD','agricola','trator',2018,NULL, 48, 48,'powershift','4x4',4,2.5,'GLOBAL'),
('Kubota','Série L','L5060',  '4WD','agricola','trator',2018,NULL, 52, 52,'powershift','4x4',4,2.5,'GLOBAL'),
('Kubota','Série L','L5460',  '4WD','agricola','trator',2018,NULL, 55, 55,'powershift','4x4',4,3.3,'GLOBAL'),
('Kubota','Série L','L6060',  '4WD','agricola','trator',2018,NULL, 60, 60,'powershift','4x4',4,3.3,'GLOBAL'),

-- Série M5 (mid-power)
('Kubota','Série M5','M5-091','4WD','agricola','trator',2019,NULL, 92, 92,'powershift','4x4',4,3.8,'GLOBAL'),
('Kubota','Série M5','M5-111','4WD','agricola','trator',2019,NULL,112,112,'powershift','4x4',4,3.8,'GLOBAL'),

-- Série M7 (high-power)
('Kubota','Série M7','M7-131','4WD','agricola','trator',2015,NULL,131,131,'powershift','4x4',6,6.1,'GLOBAL'),
('Kubota','Série M7','M7-151','4WD','agricola','trator',2015,NULL,151,151,'powershift','4x4',6,6.1,'GLOBAL'),
('Kubota','Série M7','M7-171','4WD','agricola','trator',2019,NULL,171,171,'CVT',       '4x4',6,6.1,'GLOBAL'),
('Kubota','Série M7','M7-173','4WD','agricola','trator',2019,NULL,173,173,'CVT',       '4x4',6,6.1,'GLOBAL'),

-- Série M8 (novos)
('Kubota','Série M8','M8-201','4WD','agricola','trator',2022,NULL,201,201,'CVT',       '4x4',6,7.4,'GLOBAL'),
('Kubota','Série M8','M8-211','4WD','agricola','trator',2022,NULL,211,211,'CVT',       '4x4',6,7.4,'GLOBAL'),

-- ════════════════════════════════════════════════════════════════════════
-- CATERPILLAR — Construção
-- ════════════════════════════════════════════════════════════════════════

-- Motoniveladoras
('Caterpillar','Motoniveladora','120',   'AWD','construcao','moto-niveladora',2018,NULL,164,164,'powershift','AWD',6,9.3,'GLOBAL'),
('Caterpillar','Motoniveladora','120 AWD','AWD','construcao','moto-niveladora',2020,NULL,164,164,'powershift','AWD',6,9.3,'GLOBAL'),
('Caterpillar','Motoniveladora','12M3','4WD','construcao','moto-niveladora',2016,NULL,174,174,'powershift','4x4',6,9.3,'GLOBAL'),
('Caterpillar','Motoniveladora','14M3','4WD','construcao','moto-niveladora',2016,NULL,252,252,'powershift','4x4',6,15.2,'GLOBAL'),
('Caterpillar','Motoniveladora','16M3','4WD','construcao','moto-niveladora',2016,NULL,333,333,'powershift','4x4',6,18.1,'GLOBAL'),
('Caterpillar','Motoniveladora','18M3','4WD','construcao','moto-niveladora',2016,NULL,400,400,'powershift','4x4',6,23.1,'GLOBAL'),

-- Pás Carregadeiras (Wheel Loaders)
('Caterpillar','Wheel Loader','950 GC',  NULL,'construcao','pa-carregadeira',2016,NULL,197,197,'powershift',NULL,6,9.3,'GLOBAL'),
('Caterpillar','Wheel Loader','962',     NULL,'construcao','pa-carregadeira',2019,NULL,220,220,'powershift',NULL,6,9.3,'GLOBAL'),
('Caterpillar','Wheel Loader','966',     NULL,'construcao','pa-carregadeira',2018,NULL,263,263,'powershift',NULL,6,13.6,'GLOBAL'),
('Caterpillar','Wheel Loader','972',     NULL,'construcao','pa-carregadeira',2019,NULL,321,321,'powershift',NULL,6,13.6,'GLOBAL'),
('Caterpillar','Wheel Loader','980',     NULL,'construcao','pa-carregadeira',2019,NULL,370,370,'powershift',NULL,6,18.1,'GLOBAL'),

-- Escavadeiras
('Caterpillar','Escavadeira','320',   NULL,'construcao','escavadeira',2019,NULL,157,157,'hidrostática',NULL,4,4.5,'GLOBAL'),
('Caterpillar','Escavadeira','323',   NULL,'construcao','escavadeira',2019,NULL,170,170,'hidrostática',NULL,4,4.5,'GLOBAL'),
('Caterpillar','Escavadeira','326',   NULL,'construcao','escavadeira',2020,NULL,189,189,'hidrostática',NULL,4,4.5,'GLOBAL'),
('Caterpillar','Escavadeira','330',   NULL,'construcao','escavadeira',2019,NULL,270,270,'hidrostática',NULL,6,7.8,'GLOBAL'),
('Caterpillar','Escavadeira','340',   NULL,'construcao','escavadeira',2019,NULL,313,313,'hidrostática',NULL,6,7.8,'GLOBAL'),
('Caterpillar','Escavadeira','349',   NULL,'construcao','escavadeira',2020,NULL,374,374,'hidrostática',NULL,6,9.3,'GLOBAL'),
('Caterpillar','Escavadeira','390',   NULL,'construcao','escavadeira',2020,NULL,503,503,'hidrostática',NULL,6,15.2,'GLOBAL'),

-- Tratores de Esteira (Dozers)
('Caterpillar','Dozer','D6 XE',  NULL,'construcao','trator-esteira',2019,NULL,215,215,'elétrica','esteira',6,9.3,'GLOBAL'),
('Caterpillar','Dozer','D7',     NULL,'construcao','trator-esteira',2015,NULL,263,263,'powershift','esteira',6,9.3,'GLOBAL'),
('Caterpillar','Dozer','D8T',    NULL,'construcao','trator-esteira',2015,NULL,322,322,'powershift','esteira',6,13.6,'GLOBAL'),
('Caterpillar','Dozer','D9T',    NULL,'construcao','trator-esteira',2015,NULL,410,410,'powershift','esteira',6,18.1,'GLOBAL'),
('Caterpillar','Dozer','D10T',   NULL,'construcao','trator-esteira',2015,NULL,580,580,'powershift','esteira',6,23.1,'GLOBAL'),
('Caterpillar','Dozer','D11',    NULL,'construcao','trator-esteira',2019,NULL,850,850,'powershift','esteira',6,27.0,'GLOBAL'),

-- ════════════════════════════════════════════════════════════════════════
-- KOMATSU — Construção
-- ════════════════════════════════════════════════════════════════════════

-- Motoniveladoras
('Komatsu','Motoniveladora','GD555-5',  NULL,'construcao','moto-niveladora',2015,NULL,155,155,'powershift',NULL,6,8.9,'GLOBAL'),
('Komatsu','Motoniveladora','GD655-5',  NULL,'construcao','moto-niveladora',2015,NULL,170,170,'powershift',NULL,6,8.9,'GLOBAL'),
('Komatsu','Motoniveladora','GD675-5A', NULL,'construcao','moto-niveladora',2015,NULL,215,215,'powershift',NULL,6,8.9,'GLOBAL'),

-- Carregadeiras
('Komatsu','Wheel Loader','WA320-8',  NULL,'construcao','pa-carregadeira',2016,NULL,175,175,'powershift',NULL,6,8.9,'GLOBAL'),
('Komatsu','Wheel Loader','WA380-8',  NULL,'construcao','pa-carregadeira',2016,NULL,215,215,'powershift',NULL,6,8.9,'GLOBAL'),
('Komatsu','Wheel Loader','WA430-8',  NULL,'construcao','pa-carregadeira',2018,NULL,240,240,'powershift',NULL,6,12.5,'GLOBAL'),
('Komatsu','Wheel Loader','WA470-8',  NULL,'construcao','pa-carregadeira',2018,NULL,282,282,'powershift',NULL,6,12.5,'GLOBAL'),
('Komatsu','Wheel Loader','WA500-8',  NULL,'construcao','pa-carregadeira',2018,NULL,340,340,'powershift',NULL,6,15.2,'GLOBAL'),

-- Escavadeiras
('Komatsu','Escavadeira','PC200-11',  NULL,'construcao','escavadeira',2020,NULL,148,148,'hidrostática',NULL,4,5.2,'GLOBAL'),
('Komatsu','Escavadeira','PC210-11',  NULL,'construcao','escavadeira',2020,NULL,160,160,'hidrostática',NULL,6,6.7,'GLOBAL'),
('Komatsu','Escavadeira','PC240-11',  NULL,'construcao','escavadeira',2020,NULL,186,186,'hidrostática',NULL,6,6.7,'GLOBAL'),
('Komatsu','Escavadeira','PC290-11',  NULL,'construcao','escavadeira',2020,NULL,223,223,'hidrostática',NULL,6,8.9,'GLOBAL'),
('Komatsu','Escavadeira','PC300-11',  NULL,'construcao','escavadeira',2020,NULL,238,238,'hidrostática',NULL,6,8.9,'GLOBAL'),
('Komatsu','Escavadeira','PC360-11',  NULL,'construcao','escavadeira',2021,NULL,270,270,'hidrostática',NULL,6,8.9,'GLOBAL'),
('Komatsu','Escavadeira','PC490-11',  NULL,'construcao','escavadeira',2021,NULL,375,375,'hidrostática',NULL,6,15.2,'GLOBAL'),

-- Tratores de Esteira
('Komatsu','Dozer','D65PX-18', NULL,'construcao','trator-esteira',2018,NULL,206,206,'powershift','esteira',6,8.9,'GLOBAL'),
('Komatsu','Dozer','D85EX-18', NULL,'construcao','trator-esteira',2018,NULL,264,264,'powershift','esteira',6,10.5,'GLOBAL'),
('Komatsu','Dozer','D155AX-8', NULL,'construcao','trator-esteira',2018,NULL,410,410,'powershift','esteira',6,15.2,'GLOBAL'),

-- ════════════════════════════════════════════════════════════════════════
-- JCB
-- ════════════════════════════════════════════════════════════════════════

-- Retroescavadeiras
('JCB','Retroescavadeira','3CX',       '4WD','construcao','escavadeira',2015,NULL,109,109,'powershift','4x4',4,4.4,'GLOBAL'),
('JCB','Retroescavadeira','3CX Pro',   '4WD','construcao','escavadeira',2018,NULL,109,109,'powershift','4x4',4,4.4,'GLOBAL'),
('JCB','Retroescavadeira','4CX',       '4WD','construcao','escavadeira',2015,NULL,109,109,'powershift','4x4',4,4.4,'GLOBAL'),
('JCB','Retroescavadeira','4CX Pro',   '4WD','construcao','escavadeira',2018,NULL,109,109,'powershift','4x4',4,4.4,'GLOBAL'),

-- Escavadeiras JS
('JCB','Escavadeira JS','JS131',   NULL,'construcao','escavadeira',2018,NULL, 81, 81,'hidrostática',NULL,4,3.6,'GLOBAL'),
('JCB','Escavadeira JS','JS145',   NULL,'construcao','escavadeira',2018,NULL, 99, 99,'hidrostática',NULL,4,4.4,'GLOBAL'),
('JCB','Escavadeira JS','JS160',   NULL,'construcao','escavadeira',2018,NULL,109,109,'hidrostática',NULL,4,4.4,'GLOBAL'),
('JCB','Escavadeira JS','JS190',   NULL,'construcao','escavadeira',2018,NULL,130,130,'hidrostática',NULL,4,4.4,'GLOBAL'),
('JCB','Escavadeira JS','JS205',   NULL,'construcao','escavadeira',2018,NULL,143,143,'hidrostática',NULL,6,6.7,'GLOBAL'),
('JCB','Escavadeira JS','JS220',   NULL,'construcao','escavadeira',2018,NULL,163,163,'hidrostática',NULL,6,6.7,'GLOBAL'),
('JCB','Escavadeira JS','JS300',   NULL,'construcao','escavadeira',2018,NULL,203,203,'hidrostática',NULL,6,7.2,'GLOBAL'),

-- Tratores Fastrac (agrícolas)
('JCB','Fastrac','Fastrac 4160',   '4WD','agricola','trator',2016,NULL,160,160,'powershift','4x4',6,6.7,'GLOBAL'),
('JCB','Fastrac','Fastrac 4190',   '4WD','agricola','trator',2016,NULL,190,190,'powershift','4x4',6,6.7,'GLOBAL'),
('JCB','Fastrac','Fastrac 4220',   '4WD','agricola','trator',2016,NULL,220,220,'CVT',       '4x4',6,6.7,'GLOBAL'),
('JCB','Fastrac','Fastrac 4220 Plus','4WD','agricola','trator',2019,NULL,220,220,'CVT',     '4x4',6,6.7,'GLOBAL'),
('JCB','Fastrac','Fastrac 8280',   '4WD','agricola','trator',2019,NULL,280,280,'CVT',       '4x4',6,7.4,'GLOBAL'),
('JCB','Fastrac','Fastrac 8330',   '4WD','agricola','trator',2019,NULL,330,330,'CVT',       '4x4',6,7.4,'GLOBAL'),

-- ════════════════════════════════════════════════════════════════════════
-- AGRALE — Fabricante nacional (Brasil)
-- ════════════════════════════════════════════════════════════════════════

('Agrale','Série BX','BX 5.90',  '4WD','agricola','trator',2010,2020, 85, 85,'manual',    '4x4',4,3.5,'BR'),
('Agrale','Série BX','BX 6.110', '4WD','agricola','trator',2010,2020,110,110,'powershift','4x4',4,3.5,'BR'),
('Agrale','Série BX','BX 6.130', '4WD','agricola','trator',2012,2021,130,130,'powershift','4x4',4,3.5,'BR'),
('Agrale','Série BX','BX 6.150', '4WD','agricola','trator',2012,2021,150,150,'powershift','4x4',4,3.5,'BR'),
('Agrale','Série BX','BX 6.180', '4WD','agricola','trator',2015,2022,180,180,'powershift','4x4',6,5.9,'BR'),
('Agrale','Série BSBX','BSBX 5.75','4WD','agricola','trator',2016,NULL, 75, 75,'manual',  '4x4',4,2.9,'BR'),
('Agrale','Série BSBX','BSBX 5.90','4WD','agricola','trator',2016,NULL, 90, 90,'manual',  '4x4',4,3.5,'BR'),

-- ════════════════════════════════════════════════════════════════════════
-- LANDINI
-- ════════════════════════════════════════════════════════════════════════

('Landini','Rex','Rex 80','4WD','agricola','trator',2016,NULL, 80, 80,'manual',    '4x4',4,3.3,'GLOBAL'),
('Landini','Rex','Rex 90','4WD','agricola','trator',2016,NULL, 90, 90,'manual',    '4x4',4,3.3,'GLOBAL'),
('Landini','Rex','Rex 100','4WD','agricola','trator',2016,NULL,100,100,'manual',   '4x4',4,3.3,'GLOBAL'),
('Landini','Rex','Rex 110','4WD','agricola','trator',2016,NULL,110,110,'powershift','4x4',4,3.3,'GLOBAL'),
('Landini','Rex','Rex 120','4WD','agricola','trator',2016,NULL,120,120,'powershift','4x4',4,3.3,'GLOBAL'),
('Landini','6H','6-130H','4WD','agricola','trator',2019,NULL,130,130,'powershift','4x4',4,4.5,'GLOBAL'),
('Landini','6H','6-145H','4WD','agricola','trator',2019,NULL,145,145,'powershift','4x4',4,4.5,'GLOBAL'),
('Landini','7H','7-160H','4WD','agricola','trator',2019,NULL,160,160,'powershift','4x4',4,4.5,'GLOBAL'),
('Landini','7H','7-185H','4WD','agricola','trator',2019,NULL,185,185,'powershift','4x4',4,4.5,'GLOBAL'),

-- ════════════════════════════════════════════════════════════════════════
-- SAME
-- ════════════════════════════════════════════════════════════════════════

('Same','Dorado','Dorado 70',  '4WD','agricola','trator',2015,NULL, 72, 72,'manual',    '4x4',4,3.3,'GLOBAL'),
('Same','Dorado','Dorado 80',  '4WD','agricola','trator',2015,NULL, 82, 82,'manual',    '4x4',4,3.3,'GLOBAL'),
('Same','Dorado','Dorado 90',  '4WD','agricola','trator',2015,NULL, 92, 92,'manual',    '4x4',4,3.3,'GLOBAL'),
('Same','Dorado','Dorado 100', '4WD','agricola','trator',2015,NULL,103,103,'powershift','4x4',4,3.3,'GLOBAL'),
('Same','Dorado','Dorado 110', '4WD','agricola','trator',2015,NULL,112,112,'powershift','4x4',4,3.3,'GLOBAL'),
('Same','Iron','Iron 100',     '4WD','agricola','trator',2018,NULL,100,100,'powershift','4x4',4,4.5,'GLOBAL'),
('Same','Iron','Iron 115',     '4WD','agricola','trator',2018,NULL,115,115,'powershift','4x4',4,4.5,'GLOBAL'),
('Same','Iron','Iron 130',     '4WD','agricola','trator',2018,NULL,130,130,'powershift','4x4',4,4.5,'GLOBAL'),
('Same','Iron','Iron 150',     '4WD','agricola','trator',2018,NULL,150,150,'powershift','4x4',4,4.5,'GLOBAL'),
('Same','Iron','Iron 165',     '4WD','agricola','trator',2020,NULL,165,165,'powershift','4x4',6,6.1,'GLOBAL')

ON CONFLICT DO NOTHING;
