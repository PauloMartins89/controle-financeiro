-- ════════════════════════════════════════════════════════════
-- Adiciona colunas usadas pelo frontend mas faltando em despesas:
--  - valor_total: valor original antes da divisão por parcelas
--  - lote_parcelamento: ID que agrupa parcelas mensais geradas como despesas separadas
--  - veiculo_placa: placa do veículo (Sem Parar) para atribuição automática
--    (renomeia a propriedade interna `_veiculo` para uma coluna real)
-- Execute no SQL Editor do Supabase.
-- ════════════════════════════════════════════════════════════

alter table despesas
  add column if not exists valor_total numeric(12,2),
  add column if not exists lote_parcelamento text,
  add column if not exists veiculo_placa text;

create index if not exists idx_despesas_lote on despesas(lote_parcelamento);
