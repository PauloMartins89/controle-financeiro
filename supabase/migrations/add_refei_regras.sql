-- Extensão da tabela refei_parametros com regras avançadas de refeição
-- Execute no Supabase SQL Editor

ALTER TABLE refei_parametros
  ADD COLUMN IF NOT EXISTS dias_semana            integer[]      DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS horario_corte          text           DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS tipo_aprovacao         text           DEFAULT 'obrigatoria',
  ADD COLUMN IF NOT EXISTS valor_aprovacao_automatica numeric(10,2),
  ADD COLUMN IF NOT EXISTS prazo_aprovacao_horas  integer        DEFAULT 24,
  ADD COLUMN IF NOT EXISTS permite_extra          boolean        DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_refeicoes_dia      integer        DEFAULT 1,
  ADD COLUMN IF NOT EXISTS teto_valor_colaborador numeric(10,2),
  ADD COLUMN IF NOT EXISTS notifica_lider_resultado     boolean  DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifica_supervisor_pendente boolean  DEFAULT true;

-- Atualizar linhas existentes com os defaults nos campos novos
UPDATE refei_parametros
SET
  dias_semana                  = COALESCE(dias_semana,                  '{1,2,3,4,5}'),
  horario_corte                = COALESCE(horario_corte,                '10:00'),
  tipo_aprovacao               = COALESCE(tipo_aprovacao,               'obrigatoria'),
  prazo_aprovacao_horas        = COALESCE(prazo_aprovacao_horas,        24),
  permite_extra                = COALESCE(permite_extra,                true),
  max_refeicoes_dia            = COALESCE(max_refeicoes_dia,            1),
  notifica_lider_resultado     = COALESCE(notifica_lider_resultado,     true),
  notifica_supervisor_pendente = COALESCE(notifica_supervisor_pendente, true)
WHERE
  dias_semana IS NULL
  OR horario_corte IS NULL
  OR tipo_aprovacao IS NULL;
