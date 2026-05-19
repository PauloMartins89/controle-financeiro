-- Vincula refei_equipes a refei_centros_custo via FK
ALTER TABLE refei_equipes ADD COLUMN IF NOT EXISTS cdc_id uuid REFERENCES refei_centros_custo(id) ON DELETE SET NULL;
