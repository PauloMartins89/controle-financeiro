-- ════════════════════════════════════════════════════════════
-- Sincronização completa: recorrentes, negócios, proventos, closures
-- Garante que todos os dados sejam compartilhados entre dispositivos.
-- Execute no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════

-- 1. Recorrentes — adiciona campo pagos_meses (controle de mensal pago)
alter table recorrentes
  add column if not exists pagos_meses jsonb default '[]'::jsonb;

-- 2. Negócios
create table if not exists negocios (
  id          text primary key,
  nome        text not null,
  descricao   text,
  cor         text default '#6366f1',
  icone       text default '🏢',
  ativo       boolean default true,
  tipo        text default 'empresa',
  socios      jsonb default '[]'::jsonb,
  created_at  timestamptz default now()
);

alter table negocios enable row level security;
drop policy if exists "allow_all_negocios" on negocios;
create policy "allow_all_negocios" on negocios for all using (true) with check (true);

-- 3. Proventos
create table if not exists proventos (
  id           text primary key,
  negocio_id   text references negocios(id) on delete cascade,
  descricao    text not null,
  valor        numeric(12,2) not null,
  data         date not null default current_date,
  categoria    text default 'Receita',
  tipo         text default 'receita',
  status       text default 'pendente',
  observacoes  text,
  created_at   timestamptz default now()
);

alter table proventos enable row level security;
drop policy if exists "allow_all_proventos" on proventos;
create policy "allow_all_proventos" on proventos for all using (true) with check (true);

create index if not exists idx_proventos_negocio on proventos(negocio_id);
create index if not exists idx_proventos_data on proventos(data desc);

-- 4. Fechamentos mensais (closures)
create table if not exists closures (
  id                   text primary key,
  mes                  text not null unique,
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
  ticket_medio         numeric(12,2) default 0
);

alter table closures enable row level security;
drop policy if exists "allow_all_closures" on closures;
create policy "allow_all_closures" on closures for all using (true) with check (true);

create index if not exists idx_closures_mes on closures(mes);
