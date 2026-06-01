-- add_diario_tarifas.sql
-- Tabela de valorização de horas por período (diurno, noturno, FDS, feriado)
-- Usada no Diário de Obra para calcular valor faturável por lançamento.

CREATE TABLE IF NOT EXISTS diario_tarifas (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                   uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  nome                       text        NOT NULL,
  descricao                  text,
  -- Limite horário que separa diurno / noturno (configurável por tabela)
  hora_inicio_diurno         time        DEFAULT '05:00',
  hora_fim_diurno            time        DEFAULT '22:00',
  -- Dias úteis (segunda a sexta)
  valor_hora_diurno          numeric(10,2),
  valor_hora_noturno         numeric(10,2),
  -- Fins de semana (sábado e domingo)
  valor_hora_fds_diurno      numeric(10,2),
  valor_hora_fds_noturno     numeric(10,2),
  -- Feriados
  valor_hora_feriado_diurno  numeric(10,2),
  valor_hora_feriado_noturno numeric(10,2),
  ativo                      boolean     DEFAULT true,
  created_at                 timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diario_tarifas_owner_idx ON diario_tarifas(owner_id);

ALTER TABLE diario_tarifas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_diario_tarifas" ON diario_tarifas;
CREATE POLICY "owner_diario_tarifas" ON diario_tarifas
  USING  (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
