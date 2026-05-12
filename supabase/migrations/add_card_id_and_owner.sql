-- ════════════════════════════════════════════════════════════
-- Migração: adiciona card_id em despesas e is_owner em pessoas
-- Execute no SQL Editor do Supabase
-- ════════════════════════════════════════════════════════════

-- 1. Adicionar card_id na tabela despesas
alter table despesas
  add column if not exists card_id uuid references cartoes(id) on delete set null;

create index if not exists idx_despesas_card on despesas(card_id);

-- 2. Adicionar is_owner na tabela pessoas
alter table pessoas
  add column if not exists is_owner boolean default false;
