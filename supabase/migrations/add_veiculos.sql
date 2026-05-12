-- Tabela de veículos (Sem Parar / débitos por placa)
create table if not exists veiculos (
  id          text primary key,
  placa       text not null,
  apelido     text,
  pessoa_id   text,
  cor         text default '#6366f1',
  created_at  timestamptz default now()
);

-- RLS: acesso público (mesma política das outras tabelas)
alter table veiculos enable row level security;
create policy "allow_all_veiculos" on veiculos for all using (true) with check (true);
