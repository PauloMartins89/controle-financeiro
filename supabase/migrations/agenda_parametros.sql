-- ═══════════════════════════════════════════════════════════════════════════
-- Parâmetros gerais do módulo de Agenda de Serviços
-- Uma linha por workspace. Controla o comportamento padrão dos alertas
-- e da lista diária enviada às 5h BRT.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists agenda_parametros (
  id                      uuid         primary key default gen_random_uuid(),
  workspace_id            uuid         unique,                        -- null = global
  lembrete_ativo          boolean      not null default true,         -- criar alerta ao agendar?
  lembrete_minutos_antes  int          not null default 10,           -- quantos min antes
  lista_diaria_ativa      boolean      not null default true,         -- enviar lista das 5h?
  updated_at              timestamptz  default now()
);

create index if not exists idx_agenda_parametros_workspace on agenda_parametros (workspace_id);

alter table agenda_parametros enable row level security;

create policy "service role all on agenda_parametros"
  on agenda_parametros for all using (true) with check (true);
