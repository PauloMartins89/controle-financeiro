-- Adiciona URL do comprovante (imagem enviada via WhatsApp) na despesa
alter table despesas
  add column if not exists comprovante_url text;
