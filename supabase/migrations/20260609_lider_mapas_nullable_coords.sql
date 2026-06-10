-- Torna as coordenadas de lider_mapas opcionais.
-- Necessário para uploads via web sem informação GPS (ex: imagens avulsas).
-- Mapas sem coordenadas ficam visíveis na listagem mas não são exibidos
-- no mapa GPS do app móvel (filtro já tratado no mobile: sw_lat IS NOT NULL).
ALTER TABLE lider_mapas
  ALTER COLUMN sw_lat DROP NOT NULL,
  ALTER COLUMN sw_lng DROP NOT NULL,
  ALTER COLUMN ne_lat DROP NOT NULL,
  ALTER COLUMN ne_lng DROP NOT NULL;
