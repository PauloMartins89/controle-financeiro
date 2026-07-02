-- Parâmetros de SLA configuráveis por grupo/cliente
-- sla_resolucao_h : meta de resolução em horas (padrão 4h)
-- sla_vencido_h   : a partir de quantas horas o chamado fica "vencido" (padrão 24h)

ALTER TABLE whatsapp_grupos
  ADD COLUMN IF NOT EXISTS sla_resolucao_h  int NOT NULL DEFAULT 4
    CHECK (sla_resolucao_h >= 1),
  ADD COLUMN IF NOT EXISTS sla_vencido_h    int NOT NULL DEFAULT 24
    CHECK (sla_vencido_h >= 1);

COMMENT ON COLUMN whatsapp_grupos.sla_resolucao_h IS 'Meta de resolução em horas (usado nos relatórios SLA)';
COMMENT ON COLUMN whatsapp_grupos.sla_vencido_h   IS 'Horas até o chamado ser considerado vencido nos relatórios';
