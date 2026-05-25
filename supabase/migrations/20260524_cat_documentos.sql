-- ============================================================
-- CAMADA 2: Biblioteca de Documentos Técnicos
-- Vincula documentos oficiais (manuais, catálogos, boletins)
-- a modelos da tabela cat_modelos.
-- ============================================================

CREATE TABLE IF NOT EXISTS cat_documentos (
  id             uuid              DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo_id      uuid              REFERENCES cat_modelos(id) ON DELETE CASCADE,

  -- Identificação
  fabricante     text              NOT NULL,
  modelo_nome    text,
  tipo           text              NOT NULL,
  -- Valores permitidos:
  -- 'manual_operador' | 'manual_manutencao' | 'manual_servico'
  -- 'catalogo_pecas'  | 'quick_reference'   | 'boletim_tecnico'
  -- 'procedimento_interno' | 'vista_explodida'

  titulo         text              NOT NULL,
  codigo_pub     text,             -- ex: OMN400413, OMRG45340
  idioma         text              DEFAULT 'PT-BR',
  fonte          text,             -- nome da fonte / portal
  url_oficial    text,             -- link oficial (não redistribuir arquivo)
  pagina_ref     text,             -- ex: "p. 42", "Seção 3.4"
  data_doc       date,             -- data de publicação do documento
  data_consulta  date              DEFAULT CURRENT_DATE,

  -- Status
  status_licenca text              DEFAULT 'link_oficial',
  -- 'link_oficial' | 'licenciado' | 'interno_validado' | 'pendente'

  status_val     text              DEFAULT 'pendente_validacao',
  -- 'oficial' | 'referencial' | 'estimado' | 'pendente_validacao'

  observacoes    text,

  -- Auditoria
  created_at     timestamptz       DEFAULT now(),
  created_by     uuid              REFERENCES auth.users(id),
  updated_at     timestamptz       DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cat_documentos_modelo_id  ON cat_documentos(modelo_id);
CREATE INDEX IF NOT EXISTS idx_cat_documentos_fabricante ON cat_documentos(fabricante);
CREATE INDEX IF NOT EXISTS idx_cat_documentos_tipo       ON cat_documentos(tipo);
CREATE INDEX IF NOT EXISTS idx_cat_documentos_status_val ON cat_documentos(status_val);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_cat_documentos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_cat_documentos_updated_at ON cat_documentos;
CREATE TRIGGER trg_cat_documentos_updated_at
  BEFORE UPDATE ON cat_documentos
  FOR EACH ROW EXECUTE FUNCTION update_cat_documentos_updated_at();

-- RLS
ALTER TABLE cat_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cat_documentos_select" ON cat_documentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cat_documentos_insert" ON cat_documentos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "cat_documentos_update" ON cat_documentos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "cat_documentos_delete" ON cat_documentos
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Dados iniciais: John Deere 8400R
-- (modelo_id deve ser atualizado com o ID real do banco)
-- ============================================================

INSERT INTO cat_documentos (fabricante, modelo_nome, tipo, titulo, codigo_pub, idioma, fonte, url_oficial, pagina_ref, data_doc, status_licenca, status_val, observacoes)
VALUES
  ('John Deere', '8R Series', 'manual_manutencao',
   'Operation & Maintenance Manual — 8R/8RT/8RX Series',
   'OMN400413', 'PT-BR',
   'John Deere Service ADVISOR',
   'https://www.deere.com.br/pt/suporte/',
   NULL, '2022-06-01',
   'link_oficial', 'oficial',
   'Manual oficial de operação e manutenção da série 8R. Fonte primária para intervalos e procedimentos.'),

  ('John Deere', '8R Series', 'catalogo_pecas',
   'Parts Catalog — 8R Series Tractors',
   NULL, 'EN-US',
   'John Deere Parts Catalog Online',
   'https://partscatalog.deere.com/',
   NULL, NULL,
   'link_oficial', 'oficial',
   'Catálogo oficial de peças JD. Consultar para códigos RE/TY e equivalências.'),

  ('John Deere', '8R Series', 'quick_reference',
   'Fluids & Filters Quick Reference — 8R Tractors',
   'OMRE503690', 'PT-BR',
   'John Deere Brasil',
   'https://www.deere.com.br/pt/suporte/',
   NULL, '2023-01-01',
   'link_oficial', 'oficial',
   'Guia rápido de fluidos e filtros. Inclui especificações de viscosidade e capacidades por componente.'),

  ('Fendt', '700 Vario', 'manual_manutencao',
   'Fendt 700 Vario — Instruções de Utilização e Manutenção',
   NULL, 'PT-BR',
   'Fendt Agriservice',
   'https://www.fendt.com/br/service',
   NULL, NULL,
   'link_oficial', 'referencial',
   'Manual oficial Fendt série 700. Consultar concessionária Fendt para download autorizado.'),

  ('Caterpillar', 'Série 300', 'manual_manutencao',
   'Operation & Maintenance Manual — 320/323 Excavator',
   'SEBU8495', 'PT-BR',
   'Caterpillar SIS (Service Information System)',
   'https://sis.cat.com/',
   NULL, NULL,
   'link_oficial', 'referencial',
   'Acessar via portal SIS CAT com credenciais de concessionária.');
