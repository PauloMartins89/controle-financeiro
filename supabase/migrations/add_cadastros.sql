-- ─────────────────────────────────────────────────────────────────────────────
-- Cadastros: Clientes, Fornecedores, Solicitantes, Condutores
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists cadastros_clientes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  owner_id     uuid references auth.users(id) on delete cascade,
  nome         text not null,
  razao_social text,
  cnpj         text,
  contato      text,
  telefone     text,
  email        text,
  observacoes  text,
  ativo        boolean default true,
  created_at   timestamptz default now()
);

create table if not exists cadastros_fornecedores (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  owner_id     uuid references auth.users(id) on delete cascade,
  nome         text not null,
  razao_social text,
  cnpj         text,
  categoria    text,
  contato      text,
  telefone     text,
  email        text,
  observacoes  text,
  ativo        boolean default true,
  created_at   timestamptz default now()
);

create table if not exists cadastros_solicitantes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  owner_id     uuid references auth.users(id) on delete cascade,
  nome         text not null,
  setor        text,
  telefone     text,
  email        text,
  observacoes  text,
  ativo        boolean default true,
  created_at   timestamptz default now()
);

create table if not exists cadastros_condutores (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid,
  owner_id        uuid references auth.users(id) on delete cascade,
  nome            text not null,
  cpf             text,
  cnh             text,
  categoria_cnh   text,
  placa_vinculada text,
  telefone        text,
  email           text,
  observacoes     text,
  ativo           boolean default true,
  created_at      timestamptz default now()
);

-- RLS
alter table cadastros_clientes     enable row level security;
alter table cadastros_fornecedores enable row level security;
alter table cadastros_solicitantes enable row level security;
alter table cadastros_condutores   enable row level security;

-- Policies: owner_id ou workspace compartilhado
create policy "clientes_rw"     on cadastros_clientes     using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "fornecedores_rw" on cadastros_fornecedores using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "solicitantes_rw" on cadastros_solicitantes using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "condutores_rw"   on cadastros_condutores   using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
