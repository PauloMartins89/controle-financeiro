-- Deduplicação de mensagens WhatsApp: cada message.id do Meta é único
alter table mensagens_whatsapp add column if not exists message_id text;

create unique index if not exists mensagens_whatsapp_message_id_idx
  on mensagens_whatsapp(message_id)
  where message_id is not null;
