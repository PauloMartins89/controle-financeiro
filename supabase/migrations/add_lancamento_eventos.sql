-- ════════════════════════════════════════════════════════════
-- Rota do Lançamento — Tabela de eventos/histórico
-- Execute no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════

-- Tabela principal de eventos
create table if not exists lancamento_eventos (
  id              uuid primary key default gen_random_uuid(),
  lancamento_id   uuid not null references lancamentos(id) on delete cascade,
  tipo            text not null,
  -- Tipos: criado | enviado_aprovacao | aprovado | devolvido | corrigido
  --        reprovado | cancelado | faturado | editado | comentario
  status_de       text,                   -- status anterior (quando houver mudança)
  status_para     text,                   -- status novo (quando houver mudança)
  descricao       text,                   -- mensagem/comentário livre
  usuario_id      uuid,                   -- quem executou a ação
  usuario_nome    text,                   -- nome do usuário (denormalizado p/ histórico)
  dados           jsonb default '{}'::jsonb, -- payload extra (ex: campos editados)
  created_at      timestamptz default now()
);

-- Índices
create index if not exists idx_lev_lancamento on lancamento_eventos(lancamento_id);
create index if not exists idx_lev_created   on lancamento_eventos(created_at desc);
create index if not exists idx_lev_tipo      on lancamento_eventos(tipo);

-- RLS
alter table lancamento_eventos enable row level security;
drop policy if exists "allow_all_lancamento_eventos" on lancamento_eventos;
create policy "allow_all_lancamento_eventos" on lancamento_eventos
  for all using (true) with check (true);
