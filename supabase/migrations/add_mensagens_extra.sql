-- ═══════════════════════════════════════════════════════════════════
-- mensagens_whatsapp — colunas extras para rastreio de contexto e pendentes
-- Additive: nenhuma coluna existente alterada
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE mensagens_whatsapp
  ADD COLUMN IF NOT EXISTS workspace_id        text,
  ADD COLUMN IF NOT EXISTS modulo              text,          -- ex: 'refeicoes', 'compras', 'lancamentos'
  ADD COLUMN IF NOT EXISTS referencia_id       uuid,          -- id do objeto relacionado (solicitacao, compra, etc.)
  ADD COLUMN IF NOT EXISTS aguardando_resposta boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS respondido_em       timestamptz,
  ADD COLUMN IF NOT EXISTS resposta_recebida   text,
  ADD COLUMN IF NOT EXISTS tempo_resposta_s    integer,
  ADD COLUMN IF NOT EXISTS canal               text DEFAULT 'whatsapp';  -- 'whatsapp' | 'email'

CREATE INDEX IF NOT EXISTS idx_mwa_pendentes
  ON mensagens_whatsapp (workspace_id, aguardando_resposta, respondido_em)
  WHERE aguardando_resposta = true AND respondido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_mwa_modulo
  ON mensagens_whatsapp (modulo, referencia_id);
