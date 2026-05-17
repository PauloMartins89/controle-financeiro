-- ════════════════════════════════════════════════════════════
-- Isolamento por usuário: cada login vê apenas seus próprios dados
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

-- 1. Adiciona coluna user_id em todas as tabelas
alter table pessoas       add column if not exists user_id uuid references auth.users(id);
alter table grupos        add column if not exists user_id uuid references auth.users(id);
alter table despesas      add column if not exists user_id uuid references auth.users(id);
alter table cartoes       add column if not exists user_id uuid references auth.users(id);
alter table recorrentes   add column if not exists user_id uuid references auth.users(id);
alter table acertos       add column if not exists user_id uuid references auth.users(id);
alter table veiculos      add column if not exists user_id uuid references auth.users(id);
alter table negocios      add column if not exists user_id uuid references auth.users(id);
alter table proventos     add column if not exists user_id uuid references auth.users(id);
-- closures pode não existir ainda — cria se necessário
create table if not exists closures (
  id                   text primary key,
  mes                  text not null,
  data_fechamento      timestamptz default now(),
  qtd_despesas         int default 0,
  total                numeric(12,2) default 0,
  total_pago           numeric(12,2) default 0,
  total_pendente       numeric(12,2) default 0,
  por_categoria        jsonb default '{}'::jsonb,
  por_pessoa           jsonb default '{}'::jsonb,
  por_grupo            jsonb default '{}'::jsonb,
  por_veiculo          jsonb default '{}'::jsonb,
  por_cartao           jsonb default '{}'::jsonb,
  cartoes_liberados    jsonb default '[]'::jsonb,
  expenses_alteradas   jsonb default '[]'::jsonb,
  ticket_medio         numeric(12,2) default 0,
  user_id              uuid references auth.users(id)
);
alter table closures enable row level security;
alter table closures      add column if not exists user_id uuid references auth.users(id);

-- 2. Configuracoes: troca a PK de (chave) para (user_id, chave)
create table if not exists configuracoes (
  chave      text not null,
  valor      jsonb,
  updated_at timestamptz default now(),
  user_id    uuid references auth.users(id)
);
alter table configuracoes enable row level security;
alter table configuracoes add column if not exists user_id uuid references auth.users(id);
alter table configuracoes drop constraint if exists configuracoes_pkey;
alter table configuracoes add constraint configuracoes_pkey primary key (user_id, chave);

-- 3. Closures: a unique constraint em (mes) vira (user_id, mes)
alter table closures drop constraint if exists closures_mes_key;
alter table closures add constraint closures_user_mes_key unique (user_id, mes);

-- 4. Remove políticas permissivas antigas
drop policy if exists "Allow all for anon" on pessoas;
drop policy if exists "Allow all for anon" on grupos;
drop policy if exists "Allow all for anon" on despesas;
drop policy if exists "Allow all for anon" on cartoes;
drop policy if exists "Allow all for anon" on recorrentes;
drop policy if exists "Allow all for anon" on acertos;
drop policy if exists "allow_all_veiculos"  on veiculos;
drop policy if exists "allow_all_negocios"  on negocios;
drop policy if exists "allow_all_proventos" on proventos;
drop policy if exists "allow_all_closures"  on closures;
drop policy if exists "Allow all for anon"  on configuracoes;

-- 5. Cria políticas de isolamento por usuário logado
create policy "user_isolation" on pessoas      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_isolation" on grupos       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_isolation" on despesas     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_isolation" on cartoes      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_isolation" on recorrentes  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_isolation" on acertos      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_isolation" on veiculos     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_isolation" on negocios     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_isolation" on proventos    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_isolation" on closures     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_isolation" on configuracoes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. DEFAULT: novos registros recebem automaticamente o user_id do usuário logado
alter table pessoas       alter column user_id set default auth.uid();
alter table grupos        alter column user_id set default auth.uid();
alter table despesas      alter column user_id set default auth.uid();
alter table cartoes       alter column user_id set default auth.uid();
alter table recorrentes   alter column user_id set default auth.uid();
alter table acertos       alter column user_id set default auth.uid();
alter table veiculos      alter column user_id set default auth.uid();
alter table negocios      alter column user_id set default auth.uid();
alter table proventos     alter column user_id set default auth.uid();
alter table closures      alter column user_id set default auth.uid();
alter table configuracoes alter column user_id set default auth.uid();
