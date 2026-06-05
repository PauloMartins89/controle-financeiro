-- Adiciona coluna `conta` na tabela despesas
-- Usada para armazenar o cartão/banco de origem (ex: "Nubank •••• 1851")
-- gerado pelo parser de faturas PDF.

alter table despesas
  add column if not exists conta text;
