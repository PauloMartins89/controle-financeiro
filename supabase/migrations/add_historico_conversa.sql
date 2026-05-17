-- Adiciona coluna de histórico de conversa em canais_mensagem
alter table canais_mensagem
  add column if not exists historico jsonb default '[]'::jsonb;
