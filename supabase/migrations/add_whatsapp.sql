-- ════════════════════════════════════════════════════════════
-- WhatsApp Integration — tabelas e campos
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

-- 1. Adiciona telefone às pessoas (para vincular número ao perfil)
alter table pessoas
  add column if not exists telefone text;

create index if not exists idx_pessoas_telefone on pessoas(telefone);

-- 2. Canais de mensagem — vincula telefone ↔ pessoa + guarda estado de sessão
create table if not exists canais_mensagem (
  id              uuid primary key default gen_random_uuid(),
  telefone        text not null unique,
  pessoa_id       uuid references pessoas(id) on delete cascade,
  sessao_pendente jsonb,
  ativo           boolean default true,
  created_at      timestamptz default now()
);

alter table canais_mensagem enable row level security;
drop policy if exists "allow_all_canais" on canais_mensagem;
create policy "allow_all_canais" on canais_mensagem for all using (true) with check (true);

create index if not exists idx_canais_telefone on canais_mensagem(telefone);

-- 3. Log de auditoria das mensagens
create table if not exists mensagens_whatsapp (
  id          uuid primary key default gen_random_uuid(),
  telefone    text not null,
  direcao     text not null,   -- 'entrada' | 'saida'
  conteudo    text,
  intencao    text,
  created_at  timestamptz default now()
);

alter table mensagens_whatsapp enable row level security;
drop policy if exists "allow_all_mensagens_wa" on mensagens_whatsapp;
create policy "allow_all_mensagens_wa" on mensagens_whatsapp for all using (true) with check (true);

create index if not exists idx_mensagens_wa_telefone on mensagens_whatsapp(telefone, created_at desc);