-- ════════════════════════════════════════════════════════════
-- Isolamento de dados por usuário (owner_id + RLS)
-- Execute no SQL Editor do Supabase logado como admin
-- ════════════════════════════════════════════════════════════

-- ── 1. Adiciona owner_id em todas as tabelas principais ─────

alter table pessoas       add column if not exists owner_id uuid references auth.users(id) default auth.uid();
alter table grupos        add column if not exists owner_id uuid references auth.users(id) default auth.uid();
alter table despesas      add column if not exists owner_id uuid references auth.users(id) default auth.uid();
alter table cartoes       add column if not exists owner_id uuid references auth.users(id) default auth.uid();
alter table recorrentes   add column if not exists owner_id uuid references auth.users(id) default auth.uid();
alter table veiculos      add column if not exists owner_id uuid references auth.users(id) default auth.uid();
alter table negocios      add column if not exists owner_id uuid references auth.users(id) default auth.uid();
alter table proventos     add column if not exists owner_id uuid references auth.users(id) default auth.uid();
alter table closures      add column if not exists owner_id uuid references auth.users(id) default auth.uid();
alter table configuracoes add column if not exists owner_id uuid references auth.users(id) default auth.uid();
alter table canais_mensagem add column if not exists owner_id uuid references auth.users(id) default auth.uid();

-- ── 2. Atribui todos os dados existentes ao admin ──────────

do $$
declare
  admin_id uuid;
begin
  select id into admin_id from auth.users where email = 'ph.mar89s@gmail.com' limit 1;
  if admin_id is null then
    raise exception 'Admin user not found. Check the email in admin.js.';
  end if;

  update pessoas       set owner_id = admin_id where owner_id is null;
  update grupos        set owner_id = admin_id where owner_id is null;
  update despesas      set owner_id = admin_id where owner_id is null;
  update cartoes       set owner_id = admin_id where owner_id is null;
  update recorrentes   set owner_id = admin_id where owner_id is null;
  update veiculos      set owner_id = admin_id where owner_id is null;
  update negocios      set owner_id = admin_id where owner_id is null;
  update proventos     set owner_id = admin_id where owner_id is null;
  update closures      set owner_id = admin_id where owner_id is null;
  update configuracoes set owner_id = admin_id where owner_id is null;
  update canais_mensagem set owner_id = admin_id where owner_id is null;
end $$;

-- ── 3. Remove políticas permissivas antigas ────────────────

drop policy if exists "Allow all for anon"    on pessoas;
drop policy if exists "Allow all for anon"    on grupos;
drop policy if exists "Allow all for anon"    on despesas;
drop policy if exists "Allow all for anon"    on cartoes;
drop policy if exists "Allow all for anon"    on recorrentes;
drop policy if exists "allow_all_negocios"    on negocios;
drop policy if exists "allow_all_proventos"   on proventos;
drop policy if exists "allow_all_closures"    on closures;
drop policy if exists "allow_all_configuracoes" on configuracoes;
drop policy if exists "allow_all_canais"      on canais_mensagem;
-- Limpa qualquer outra política existente nessas tabelas
drop policy if exists "Allow all for anon"    on veiculos;

-- ── 4. Habilita RLS onde ainda não está ───────────────────

alter table veiculos      enable row level security;
alter table negocios      enable row level security;
alter table proventos     enable row level security;
alter table closures      enable row level security;
alter table configuracoes enable row level security;
alter table canais_mensagem enable row level security;

-- ── 5. Cria políticas isoladas por auth.uid() ─────────────
-- O service_role (bot WhatsApp) ignora RLS automaticamente.
-- O frontend (anon key) só vê dados do próprio owner_id.

-- pessoas
drop policy if exists "owner_only" on pessoas;
create policy "owner_only" on pessoas
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- grupos
drop policy if exists "owner_only" on grupos;
create policy "owner_only" on grupos
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- despesas
drop policy if exists "owner_only" on despesas;
create policy "owner_only" on despesas
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- cartoes
drop policy if exists "owner_only" on cartoes;
create policy "owner_only" on cartoes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- recorrentes
drop policy if exists "owner_only" on recorrentes;
create policy "owner_only" on recorrentes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- veiculos
drop policy if exists "owner_only" on veiculos;
create policy "owner_only" on veiculos
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- negocios
drop policy if exists "owner_only" on negocios;
create policy "owner_only" on negocios
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- proventos
drop policy if exists "owner_only" on proventos;
create policy "owner_only" on proventos
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- closures
drop policy if exists "owner_only" on closures;
create policy "owner_only" on closures
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- configuracoes
drop policy if exists "owner_only" on configuracoes;
create policy "owner_only" on configuracoes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- canais_mensagem: leitura restrita ao dono; service_role bypassa para o bot
drop policy if exists "owner_only" on canais_mensagem;
create policy "owner_only" on canais_mensagem
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ── 6. Índices de performance no owner_id ─────────────────

create index if not exists idx_despesas_owner      on despesas(owner_id);
create index if not exists idx_pessoas_owner       on pessoas(owner_id);
create index if not exists idx_grupos_owner        on grupos(owner_id);
create index if not exists idx_cartoes_owner       on cartoes(owner_id);
create index if not exists idx_recorrentes_owner   on recorrentes(owner_id);
create index if not exists idx_veiculos_owner      on veiculos(owner_id);
create index if not exists idx_negocios_owner      on negocios(owner_id);
create index if not exists idx_proventos_owner     on proventos(owner_id);
create index if not exists idx_closures_owner      on closures(owner_id);
create index if not exists idx_canais_owner        on canais_mensagem(owner_id);
