-- Migration: adiciona campos faltantes em agendamentos_servicos
-- veiculo_placa: placa do veículo usado no serviço
-- numero_agendamento: código legível auto-gerado (ex: AG-00001)

-- 1. Adicionar colunas
alter table agendamentos_servicos
  add column if not exists veiculo_placa text,
  add column if not exists numero_agendamento text;

-- 2. Sequência para numerar os agendamentos
create sequence if not exists agendamentos_num_seq start 1;

-- 3. Preencher numero_agendamento nos registros existentes (se houver)
update agendamentos_servicos
  set numero_agendamento = 'AG-' || lpad(nextval('agendamentos_num_seq')::text, 5, '0')
  where numero_agendamento is null;

-- 4. Trigger que auto-preenche o numero_agendamento no INSERT
create or replace function set_numero_agendamento()
returns trigger language plpgsql as $$
begin
  if new.numero_agendamento is null then
    new.numero_agendamento := 'AG-' || lpad(nextval('agendamentos_num_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_set_numero_agendamento') then
    create trigger trg_set_numero_agendamento
      before insert on agendamentos_servicos
      for each row execute function set_numero_agendamento();
  end if;
end $$;
