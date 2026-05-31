-- ═══════════════════════════════════════════════════════════════════
-- ADD: modulo_destino em maquinas_boletim_tipos
-- Define para qual módulo o OCR encaminha o lançamento após processar.
-- null / vazio → comportamento padrão (Máquinas, tipo_formulario: 'maquina')
-- 'gerencial'  → Gerencial — Diário de Campo (tipo_formulario: 'diario')
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE maquinas_boletim_tipos
  ADD COLUMN IF NOT EXISTS modulo_destino TEXT DEFAULT NULL;

-- Constraint opcional para garantir só valores válidos
ALTER TABLE maquinas_boletim_tipos
  DROP CONSTRAINT IF EXISTS check_modulo_destino;

ALTER TABLE maquinas_boletim_tipos
  ADD CONSTRAINT check_modulo_destino
  CHECK (modulo_destino IS NULL OR modulo_destino IN ('gerencial'));
