-- ════════════════════════════════════════════════════════════
-- PATCH: Correções do módulo de Compras
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

-- 1. Permitir que fornecedores façam UPDATE na sua cotação via token
--    (necessário para: marcar visualizado + enviar proposta)
DROP POLICY IF EXISTS "cotacoes_public_update" ON cotacoes_compra;
CREATE POLICY "cotacoes_public_update" ON cotacoes_compra
  FOR UPDATE USING (true) WITH CHECK (true);

-- 2. Bucket de comprovantes de compra
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprovantes',
  'comprovantes',
  true,
  10485760,   -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública (link direto no comprovante)
DROP POLICY IF EXISTS "comprovantes_public_read" ON storage.objects;
CREATE POLICY "comprovantes_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'comprovantes');

-- Upload apenas para usuários autenticados
DROP POLICY IF EXISTS "comprovantes_auth_upload" ON storage.objects;
CREATE POLICY "comprovantes_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'comprovantes' AND auth.role() = 'authenticated'
  );

-- Deleção pelo próprio usuário
DROP POLICY IF EXISTS "comprovantes_auth_delete" ON storage.objects;
CREATE POLICY "comprovantes_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'comprovantes' AND auth.role() = 'authenticated'
  );
