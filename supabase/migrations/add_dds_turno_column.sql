-- Adiciona coluna turno (text) em dds_registros
-- 'manha' | 'tarde' | 'noite' — espelhado de lider_turnos.turno
ALTER TABLE dds_registros
  ADD COLUMN IF NOT EXISTS turno text;
