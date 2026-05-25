-- ============================================================
-- create_storage_bucket_lider_fotos.sql
-- Cria o bucket público "lider-fotos" no Supabase Storage
-- Usado pelo app SmartLíder para fotos de EPI e apontamentos
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lider-fotos',
  'lider-fotos',
  true,
  10485760,   -- 10 MB por arquivo
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'];

-- Leitura pública
DROP POLICY IF EXISTS "lider_fotos_public_read" ON storage.objects;
CREATE POLICY "lider_fotos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'lider-fotos');

-- Escrita para usuários autenticados
DROP POLICY IF EXISTS "lider_fotos_auth_insert" ON storage.objects;
CREATE POLICY "lider_fotos_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'lider-fotos' AND auth.role() = 'authenticated');

-- Update para usuários autenticados
DROP POLICY IF EXISTS "lider_fotos_auth_update" ON storage.objects;
CREATE POLICY "lider_fotos_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'lider-fotos' AND auth.role() = 'authenticated');

-- Delete para usuários autenticados
DROP POLICY IF EXISTS "lider_fotos_auth_delete" ON storage.objects;
CREATE POLICY "lider_fotos_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'lider-fotos' AND auth.role() = 'authenticated');
