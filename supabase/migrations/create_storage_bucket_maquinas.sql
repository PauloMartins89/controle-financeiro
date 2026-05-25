-- ============================================================
-- create_storage_bucket_maquinas.sql
-- Cria o bucket público "maquinas" no Supabase Storage
-- ============================================================

-- Bucket principal
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maquinas',
  'maquinas',
  true,
  10485760,   -- 10 MB por arquivo
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public              = true,
  file_size_limit     = 10485760,
  allowed_mime_types  = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'];

-- Política: leitura pública (bucket é público)
DROP POLICY IF EXISTS "maquinas_public_read" ON storage.objects;
CREATE POLICY "maquinas_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'maquinas');

-- Política: escrita autenticada (service role e usuários autenticados)
DROP POLICY IF EXISTS "maquinas_auth_insert" ON storage.objects;
CREATE POLICY "maquinas_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'maquinas');

-- Política: update/delete autenticado
DROP POLICY IF EXISTS "maquinas_auth_update" ON storage.objects;
CREATE POLICY "maquinas_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'maquinas');

DROP POLICY IF EXISTS "maquinas_auth_delete" ON storage.objects;
CREATE POLICY "maquinas_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'maquinas');
