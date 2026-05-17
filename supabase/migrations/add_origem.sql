-- Adiciona coluna origem para rastrear de onde vieram as mensagens/despesas
alter table mensagens_whatsapp
  add column if not exists origem text default 'whatsapp';

alter table despesas
  add column if not exists origem text;
