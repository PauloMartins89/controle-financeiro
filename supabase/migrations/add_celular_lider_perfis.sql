-- Adiciona campo celular/WhatsApp ao perfil do líder
-- Usado para envio de notificações WA sem depender da tabela efetivo

ALTER TABLE lider_perfis
  ADD COLUMN IF NOT EXISTS celular text;

COMMENT ON COLUMN lider_perfis.celular IS 'Celular/WhatsApp do líder (formato: 5567999990000). Usado para notificações automáticas.';
