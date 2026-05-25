-- ============================================================
-- Tabela: login_slides
-- Armazena as imagens do slideshow da tela de login.
-- Máx. 5 imagens, gerenciadas pelo Admin Panel.
-- ============================================================

create table if not exists public.login_slides (
  id          uuid        primary key default gen_random_uuid(),
  nome        text,
  url         text        not null,
  ordem       smallint    not null default 0,
  created_at  timestamptz default now()
);

-- Leitura pública (tela de login não requer autenticação)
alter table public.login_slides enable row level security;

create policy "login_slides_public_read"
  on public.login_slides for select
  using (true);

-- Escrita apenas para usuários autenticados (admin)
create policy "login_slides_auth_write"
  on public.login_slides for all
  using (auth.role() = 'authenticated');

-- ============================================================
-- Storage bucket: login-slides
-- Crie manualmente no painel do Supabase:
--   Storage → New bucket → nome: "login-slides" → Public: SIM
-- ============================================================
