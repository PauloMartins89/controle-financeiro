-- Histórico de eventos de solicitações de compra
-- Registra cada transição de status (aprovado, recusado, leilao_aberto, etc.)

create table if not exists solicitacao_compra_eventos (
  id              uuid primary key default gen_random_uuid(),
  solicitacao_id  uuid not null references solicitacoes_compra(id) on delete cascade,
  workspace_id    uuid,
  acao            text not null,         -- 'aprovado' | 'recusado' | 'leilao_aberto' | etc.
  status_de       text,
  status_para     text,
  observacao      text,
  ator            text,                  -- nome ou telefone do aprovador externo
  criado_em       timestamptz default now()
);

create index if not exists idx_sce_solicitacao on solicitacao_compra_eventos(solicitacao_id);
create index if not exists idx_sce_workspace   on solicitacao_compra_eventos(workspace_id);

-- RLS: leitura permitida para membros do workspace via service key (API já usa service key)
alter table solicitacao_compra_eventos enable row level security;
create policy "service_key_all" on solicitacao_compra_eventos for all using (true) with check (true);
