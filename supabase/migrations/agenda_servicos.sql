-- ════════════════════════════════════════════════════════════════════════════
-- Agenda Operacional de Serviços — Migration
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Tipos de serviço disponíveis (enum de referência) ────────────────────
-- Não é uma tabela: a lista fica no frontend.
-- Exemplos: Caminhão Prancha, Caminhão Munck, Guindaste, Basculante, Betoneira,
--           Retroescavadeira, Motoniveladora, Pá Carregadeira, Locação de Equipamento, Outro

-- ── 2. Agendamentos de serviços ──────────────────────────────────────────────
create table if not exists agendamentos_servicos (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid,
  -- Dados do cliente
  cliente_id            uuid,
  cliente_nome          text not null,
  -- Dados do serviço
  tipo_servico          text not null,
  atividade             text,
  descricao             text,
  data_servico          date not null,
  horario_servico       time,
  data_hora_servico     timestamptz,
  previsao_duracao_min  int,
  origem                text,
  destino               text,
  observacao            text,
  -- Dados operacionais
  responsavel_id        uuid,
  responsavel_nome      text,
  responsavel_whatsapp  text,
  motorista_id          uuid,
  motorista_nome        text,
  motorista_whatsapp    text,
  veiculo_id            uuid,
  veiculo_nome          text,
  contato_cliente       text,
  whatsapp_cliente      text,
  -- Status
  status                text not null default 'agendado',
  -- Auditoria
  criado_por            uuid,
  criado_por_nome       text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ── 3. Alertas WhatsApp de cada agendamento ──────────────────────────────────
create table if not exists agendamento_alertas (
  id                        uuid primary key default gen_random_uuid(),
  agendamento_id            uuid not null references agendamentos_servicos(id) on delete cascade,
  canal                     text not null default 'whatsapp',
  destinatario_tipo         text,   -- responsavel | motorista | supervisor | cliente | personalizado
  destinatario_nome         text,
  destinatario_whatsapp     text not null,
  antecedencia_minutos      int not null default 180,
  horario_previsto_envio    timestamptz not null,
  status                    text not null default 'pendente',
  enviado_em                timestamptz,
  confirmado_em             timestamptz,
  resposta_recebida         text,
  erro_envio                text,
  tentativas_envio          int not null default 0,
  max_tentativas            int not null default 3,
  solicitar_confirmacao     boolean not null default false,
  reenviar_se_nao_confirmar boolean not null default false,
  intervalo_reenvio_min     int default 60,
  proximo_reenvio_em        timestamptz,
  idempotency_key           text unique,
  ativo                     boolean not null default true,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- ── 4. Regras automáticas de alerta ─────────────────────────────────────────
create table if not exists agendamento_regras_alerta (
  id                        uuid primary key default gen_random_uuid(),
  workspace_id              uuid,
  nome_regra                text not null,
  tipo_servico              text,   -- null = aplica a qualquer tipo
  cliente_id                uuid,
  responsavel_id            uuid,
  motorista_id              uuid,
  veiculo_id                uuid,
  destinatario_tipo         text not null default 'responsavel',
  destinatario_nome         text,
  destinatario_whatsapp     text,
  antecedencia_minutos      int not null default 180,
  mensagem_template         text,
  solicitar_confirmacao     boolean not null default false,
  reenviar_se_nao_confirmar boolean not null default false,
  intervalo_reenvio_min     int default 60,
  max_tentativas            int default 3,
  ativo                     boolean not null default true,
  criado_por                uuid,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- ── 5. Histórico / timeline de eventos ──────────────────────────────────────
create table if not exists agendamento_historico (
  id              uuid primary key default gen_random_uuid(),
  agendamento_id  uuid not null references agendamentos_servicos(id) on delete cascade,
  tipo_evento     text not null,
  descricao       text not null,
  usuario_id      uuid,
  usuario_nome    text,
  data_evento     timestamptz not null default now(),
  payload_json    jsonb
);

-- ── 6. Log centralizado de mensagens WhatsApp ────────────────────────────────
create table if not exists whatsapp_logs (
  id                  uuid primary key default gen_random_uuid(),
  reference_type      text,   -- agendamento_alerta | compra | lancamento | etc.
  reference_id        uuid,
  phone               text not null,
  message             text,
  provider            text default 'zapi',
  provider_message_id text,
  status              text not null default 'enviado',  -- enviado | falha | confirmado
  request_payload     jsonb,
  response_payload    jsonb,
  error_message       text,
  sent_at             timestamptz,
  created_at          timestamptz default now()
);

-- ── Triggers updated_at ──────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='agendamentos_servicos_updated_at') then
    create trigger agendamentos_servicos_updated_at
      before update on agendamentos_servicos
      for each row execute function update_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='agendamento_alertas_updated_at') then
    create trigger agendamento_alertas_updated_at
      before update on agendamento_alertas
      for each row execute function update_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname='agendamento_regras_updated_at') then
    create trigger agendamento_regras_updated_at
      before update on agendamento_regras_alerta
      for each row execute function update_updated_at();
  end if;
end $$;

-- ── Índices ──────────────────────────────────────────────────────────────────
create index if not exists idx_agendamentos_data         on agendamentos_servicos(data_servico);
create index if not exists idx_agendamentos_status       on agendamentos_servicos(status);
create index if not exists idx_agendamentos_workspace    on agendamentos_servicos(workspace_id);
create index if not exists idx_alertas_agendamento       on agendamento_alertas(agendamento_id);
create index if not exists idx_alertas_status            on agendamento_alertas(status);
create index if not exists idx_alertas_horario           on agendamento_alertas(horario_previsto_envio);
create index if not exists idx_alertas_ativo             on agendamento_alertas(ativo);
create index if not exists idx_historico_agendamento     on agendamento_historico(agendamento_id);
create index if not exists idx_whatsapp_logs_reference   on whatsapp_logs(reference_type, reference_id);

-- ── RLS básico (ajuste as policies conforme seu padrão) ──────────────────────
alter table agendamentos_servicos     enable row level security;
alter table agendamento_alertas       enable row level security;
alter table agendamento_regras_alerta enable row level security;
alter table agendamento_historico     enable row level security;
alter table whatsapp_logs             enable row level security;

-- Políticas abertas para service_role (backend); ajuste para usuários autenticados conforme necessário
create policy "service_role_all_agendamentos"
  on agendamentos_servicos for all using (true) with check (true);
create policy "service_role_all_alertas"
  on agendamento_alertas for all using (true) with check (true);
create policy "service_role_all_regras"
  on agendamento_regras_alerta for all using (true) with check (true);
create policy "service_role_all_historico"
  on agendamento_historico for all using (true) with check (true);
create policy "service_role_all_wa_logs"
  on whatsapp_logs for all using (true) with check (true);
