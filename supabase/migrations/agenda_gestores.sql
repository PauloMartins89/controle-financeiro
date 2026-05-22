-- ═══════════════════════════════════════════════════════════════════════════
-- Gestores WhatsApp da Agenda de Serviços
-- Registra os telefones de gestores que podem criar agendamentos via WA bot,
-- com flags individuais por modalidade (áudio / texto / link).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists agenda_gestores (
  id                uuid         primary key default gen_random_uuid(),
  workspace_id      uuid,
  nome              text         not null,
  telefone          text         not null unique,          -- normalizado: 5511999999999
  audio_habilitado  boolean      not null default false,   -- pode criar via áudio
  texto_habilitado  boolean      not null default false,   -- pode criar via texto
  link_habilitado   boolean      not null default true,    -- pode receber link de formulário
  ativo             boolean      not null default true,
  created_at        timestamptz  default now(),
  updated_at        timestamptz  default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Links pendentes gerados para o formulário público de agendamento.
-- Criados quando o bot gera um link e enviados ao gestor via WA.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists agenda_links_pendentes (
  id               uuid         primary key default gen_random_uuid(),
  token            text         not null unique,
  workspace_id     uuid,
  gestor_id        uuid         references agenda_gestores(id) on delete set null,
  gestor_telefone  text,
  gestor_nome      text,
  dados_parciais   jsonb,       -- dados pré-extraídos por IA (pode ser null)
  usado            boolean      not null default false,
  expires_at       timestamptz  not null,
  created_at       timestamptz  default now()
);

-- índices
create index if not exists idx_agenda_gestores_telefone   on agenda_gestores (telefone);
create index if not exists idx_agenda_gestores_workspace  on agenda_gestores (workspace_id, ativo);
create index if not exists idx_agenda_links_token         on agenda_links_pendentes (token);
create index if not exists idx_agenda_links_usado         on agenda_links_pendentes (usado, expires_at);
