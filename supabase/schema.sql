-- ════════════════════════════════════════════════════════════
-- RateioPro — Supabase Schema
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

-- 1. Pessoas
create table if not exists pessoas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  apelido     text,
  cor         text default '#6366f1',
  avatar      text,
  is_owner    boolean default false,
  created_at  timestamptz default now()
);

-- 2. Grupos
create table if not exists grupos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cor         text default '#6366f1',
  icone       text default '💰',
  descricao   text,
  created_at  timestamptz default now()
);

-- 3. Despesas Compartilhadas (entidade principal)
create table if not exists despesas (
  id              uuid primary key default gen_random_uuid(),
  descricao       text not null,
  valor           numeric(12,2) not null,
  data            date not null default current_date,
  categoria       text default 'Outros',
  grupo_id        uuid references grupos(id) on delete set null,
  pago_por        uuid references pessoas(id) on delete set null,
  participantes   uuid[] default '{}',
  tipo_divisao    text default 'igual',   -- igual | porcentagem | valor_fixo
  porcentagens    jsonb default '{}',     -- { personId: percentual }
  valores_fixos   jsonb default '{}',     -- { personId: valor }
  parcelas        int default 1,
  parcela_atual   int default 1,
  recorrente      boolean default false,
  status          text default 'pendente', -- pendente | pago | cancelado
  card_id         uuid references cartoes(id) on delete set null,
  observacoes     text,
  comprovante_url text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 4. Cartões de crédito
create table if not exists cartoes (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  bandeira         text default 'Visa',
  limite           numeric(12,2) default 0,
  dia_fechamento   int default 15,
  dia_vencimento   int default 22,
  cor              text default '#6366f1',
  created_at       timestamptz default now()
);

-- 5. Contas recorrentes
create table if not exists recorrentes (
  id               uuid primary key default gen_random_uuid(),
  descricao        text not null,
  valor            numeric(12,2) not null,
  dia_vencimento   int not null default 5,
  categoria        text default 'Serviços',
  grupo_id         uuid references grupos(id) on delete set null,
  ativo            boolean default true,
  created_at       timestamptz default now()
);

-- 6. Acertos / Liquidações
create table if not exists acertos (
  id          uuid primary key default gen_random_uuid(),
  de_pessoa   uuid references pessoas(id),
  para_pessoa uuid references pessoas(id),
  valor       numeric(12,2) not null,
  data        date default current_date,
  metodo      text default 'pix',       -- pix | dinheiro | ted | outro
  observacoes text,
  created_at  timestamptz default now()
);

-- ── Triggers ────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger despesas_updated_at
  before update on despesas
  for each row execute function update_updated_at();

-- ── RLS (Row Level Security) ─────────────────────────────────
-- Habilite RLS nas tabelas e crie políticas de acordo com sua auth strategy.
-- Para desenvolvimento rápido sem auth:
alter table pessoas    enable row level security;
alter table grupos     enable row level security;
alter table despesas   enable row level security;
alter table cartoes    enable row level security;
alter table recorrentes enable row level security;
alter table acertos    enable row level security;

-- Política permissiva para MVP (sem autenticação):
create policy "Allow all for anon" on pessoas    for all using (true) with check (true);
create policy "Allow all for anon" on grupos     for all using (true) with check (true);
create policy "Allow all for anon" on despesas   for all using (true) with check (true);
create policy "Allow all for anon" on cartoes    for all using (true) with check (true);
create policy "Allow all for anon" on recorrentes for all using (true) with check (true);
create policy "Allow all for anon" on acertos    for all using (true) with check (true);

-- ── Índices de performance ───────────────────────────────────
create index if not exists idx_despesas_data       on despesas(data desc);
create index if not exists idx_despesas_grupo      on despesas(grupo_id);
create index if not exists idx_despesas_pago_por   on despesas(pago_por);
create index if not exists idx_despesas_status     on despesas(status);
create index if not exists idx_despesas_participantes on despesas using gin(participantes);
