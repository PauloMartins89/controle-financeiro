-- ═══════════════════════════════════════════════════════════════════
-- ADD: identificador_visual em maquinas_boletim_tipos
-- Texto único que aparece no cabeçalho/título do formulário físico.
-- Ex: "BIRIGUI SOLUÇÕES", "CARPELO SERVIÇOS FLORESTAIS"
-- Usado pelo WhatsApp para identificar automaticamente de qual cliente
-- é o boletim recebido, sem depender do número de telefone do remetente.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE maquinas_boletim_tipos
  ADD COLUMN IF NOT EXISTS identificador_visual TEXT DEFAULT NULL;
