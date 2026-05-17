-- Campos extraídos de notas fiscais / comprovantes
alter table despesas
  add column if not exists cnpj           text,
  add column if not exists endereco       text,
  add column if not exists telefone_local text,
  add column if not exists produto        text,
  add column if not exists quantidade     text,
  add column if not exists litros         numeric(10,3),
  add column if not exists valor_litro    numeric(10,4),
  add column if not exists hora           text,
  add column if not exists forma_pagamento text,
  add column if not exists nfe_url        text,
  add column if not exists origem         text default 'app'; -- app | whatsapp | upload
