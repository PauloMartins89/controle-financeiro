-- Adiciona coluna obrigatorio em dds_grupos
ALTER TABLE dds_grupos
  ADD COLUMN IF NOT EXISTS obrigatorio boolean NOT NULL DEFAULT false;
