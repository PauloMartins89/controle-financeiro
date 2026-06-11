-- Vincula um Tipo de Boletim a um form_template para OCR dinâmico
-- Quando form_template_id está preenchido, o OCR usa os campos do template
-- em vez do campos_json extraído da imagem de análise.

ALTER TABLE maquinas_boletim_tipos
  ADD COLUMN IF NOT EXISTS form_template_id uuid REFERENCES form_templates(id) ON DELETE SET NULL;

-- Verifica
SELECT id, nome, modulo_destino, form_template_id
FROM maquinas_boletim_tipos
ORDER BY nome;
