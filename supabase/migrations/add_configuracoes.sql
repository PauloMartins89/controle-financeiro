-- ════════════════════════════════════════════════════════════
-- Migração: tabela configuracoes (chave-valor para settings globais)
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

create table if not exists configuracoes (
  chave      text primary key,
  valor      jsonb,
  updated_at timestamptz default now()
);

alter table configuracoes enable row level security;
create policy "Allow all for anon" on configuracoes for all using (true) with check (true);

-- Valor inicial do saldo de caixa
insert into configuracoes (chave, valor)
values ('saldoCaixa', '0')
on conflict (chave) do nothing;
