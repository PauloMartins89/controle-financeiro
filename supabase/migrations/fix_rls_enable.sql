-- Garante que o RLS está habilitado em TODAS as tabelas
-- Execute no SQL Editor do Supabase

alter table pessoas       enable row level security;
alter table grupos        enable row level security;
alter table despesas      enable row level security;
alter table cartoes       enable row level security;
alter table recorrentes   enable row level security;
alter table veiculos      enable row level security;
alter table negocios      enable row level security;
alter table proventos     enable row level security;
alter table closures      enable row level security;
alter table configuracoes enable row level security;

-- Garante que as políticas existem (recria se não existir)
do $$
declare
  t text;
begin
  foreach t in array array['pessoas','grupos','despesas','cartoes','recorrentes','veiculos','negocios','proventos','closures','configuracoes']
  loop
    if not exists (
      select 1 from pg_policies where tablename = t and policyname = 'user_isolation'
    ) then
      execute format(
        'create policy user_isolation on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        t
      );
    end if;
  end loop;
end $$;
