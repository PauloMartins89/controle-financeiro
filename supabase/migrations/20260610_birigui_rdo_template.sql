-- ─────────────────────────────────────────────────────────────────────────────
-- Relatório Diário de Obra (RDO) — Birigui Limpeza Técnica
-- Workspace: BIRIGUI - SOLUCOES SUSTENTAVEIS (71eee268-082e-49d9-a613-9387595ea6d5)
-- Template tipo_base = 'rdo' → escopo automático por workspace_id/RLS
-- Apenas Birigui verá este formulário na lista de filtros e no OCR
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove versão anterior caso exista (idempotente)
DELETE FROM form_templates
WHERE workspace_id = '71eee268-082e-49d9-a613-9387595ea6d5'
  AND tipo_base = 'rdo';

INSERT INTO form_templates (workspace_id, nome, tipo_base, ativo, campos)
VALUES (
  '71eee268-082e-49d9-a613-9387595ea6d5',
  'Relatório Diário de Obra',
  'rdo',
  true,
  '[
    {
      "key": "numero_rdo",
      "label": "Nº do Relatório",
      "type": "text",
      "required": true,
      "section": "Identificação",
      "ocr_hint": "número do relatório impresso no canto superior direito do formulário (ex: 2351)",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "data",
      "label": "Data",
      "type": "date",
      "required": true,
      "section": "Identificação",
      "ocr_hint": "data do relatório — use a data da primeira linha da tabela JORNADA DE TRABALHO, formato YYYY-MM-DD",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "empresa",
      "label": "Empresa",
      "type": "text",
      "required": true,
      "section": "Cliente",
      "ocr_hint": "nome da empresa cliente no campo EMPRESA",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "full",
      "options": ""
    },
    {
      "key": "cidade_estado",
      "label": "Cidade / Estado",
      "type": "text",
      "required": false,
      "section": "Cliente",
      "ocr_hint": "cidade e estado no campo CIDADE / ESTADO",
      "show_in_table": false,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "solicitante",
      "label": "Solicitante",
      "type": "text",
      "required": false,
      "section": "Cliente",
      "ocr_hint": "nome do solicitante no campo SOLICITANTE",
      "show_in_table": false,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "fone",
      "label": "Fone",
      "type": "text",
      "required": false,
      "section": "Cliente",
      "ocr_hint": "telefone do solicitante no campo FONE",
      "show_in_table": false,
      "show_in_pdf": false,
      "width": "half",
      "options": ""
    },
    {
      "key": "veiculo_placa",
      "label": "Veículo Placa",
      "type": "text",
      "required": false,
      "section": "Acompanhamento",
      "ocr_hint": "placa do veículo no campo VEÍCULO PLACA",
      "show_in_table": false,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "equipamento",
      "label": "Equipamento",
      "type": "text",
      "required": false,
      "section": "Acompanhamento",
      "ocr_hint": "equipamento utilizado no campo EQUIPAMENTO (ex: hidrojato, bomba, etc.)",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "equipe_diurna",
      "label": "Equipe Diurna",
      "type": "textarea",
      "required": false,
      "section": "Acompanhamento",
      "ocr_hint": "nomes dos colaboradores listados na coluna EQUIPE DIURNA",
      "show_in_table": false,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "equipe_noturna",
      "label": "Equipe Noturna",
      "type": "textarea",
      "required": false,
      "section": "Acompanhamento",
      "ocr_hint": "nomes dos colaboradores listados na coluna EQUIPE NOTURNA (deixe vazio se não houver turno noturno)",
      "show_in_table": false,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "acessorios",
      "label": "Acessórios Utilizados",
      "type": "textarea",
      "required": false,
      "section": "Acompanhamento",
      "ocr_hint": "lista de acessórios registrados no campo ACESSÓRIOS UTILIZADOS",
      "show_in_table": false,
      "show_in_pdf": true,
      "width": "full",
      "options": ""
    },
    {
      "key": "locais_servico",
      "label": "Local de Realização dos Serviços",
      "type": "textarea",
      "required": false,
      "section": "Serviços",
      "ocr_hint": "locais com checkbox marcado na seção LOCAL DE REALIZAÇÃO DOS SERVIÇOS — liste apenas os marcados separados por vírgula, ex: Rotinas-1, Caldeira de Recuperação-2, ETE-1. Opções disponíveis: Rotinas-1, Linha de Fibras-1, Linha de Fibras-2, Preparação Madeira-1, Preparação Madeira-2, Secagem-1, Secagem-2, Forno de Cal-1, Forno de Cal-2, Caldeira de Recuperação-1, Caldeira de Recuperação-2, Aterro Industrial, Sistema de Refrigeração, Caldeira de Força, ETE-1, ETE-2, Cap./Tratamento de água-1, Cap./Tratamento de água-2, Central Ar Compr-1, Central Ar Compr-2, TGs-1, TGs-2, DHO/Refeitório, Logística",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "full",
      "options": ""
    },
    {
      "key": "jornada_inicio",
      "label": "Início da Jornada",
      "type": "text",
      "required": false,
      "section": "Jornada",
      "ocr_hint": "hora da PRIMEIRA ENTRADA na tabela JORNADA DE TRABALHO (ex: 07:00). Formato HH:MM.",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "jornada_fim",
      "label": "Fim da Jornada",
      "type": "text",
      "required": false,
      "section": "Jornada",
      "ocr_hint": "hora da ÚLTIMA SAÍDA na tabela JORNADA DE TRABALHO. Pode passar da meia-noite (ex: 02:00 = 02:00 do dia seguinte). Formato HH:MM.",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "jornada_total_horas",
      "label": "Total de Horas",
      "type": "text",
      "required": false,
      "section": "Jornada",
      "ocr_hint": "SOMA de todos os valores da coluna TOTAL da tabela JORNADA DE TRABALHO. Some todas as linhas preenchidas (ex: 19h + 19h = 38h). Formato: número decimal (ex: 19.0) ou texto com h (ex: 19h).",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "horas_diurnas",
      "label": "H Diurnas (Seg–Sex)",
      "type": "text",
      "required": false,
      "section": "Jornada",
      "ocr_hint": "horas trabalhadas em dias ÚTEIS (segunda a sexta, não feriado) no período DIURNO (07:00–22:00). Calcule a interseção de cada linha da jornada com esse intervalo e some. Formato: número decimal (ex: 8.0).",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "horas_noturnas",
      "label": "H Noturnas (Seg–Sex)",
      "type": "text",
      "required": false,
      "section": "Jornada",
      "ocr_hint": "horas trabalhadas em dias ÚTEIS (segunda a sexta, não feriado) no período NOTURNO (22:00–07:00). Calcule a interseção de cada linha da jornada com esse intervalo e some. Formato: número decimal (ex: 9.0).",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "h_fds_diurnas",
      "label": "H FDS Diurnas",
      "type": "text",
      "required": false,
      "section": "Jornada",
      "ocr_hint": "horas trabalhadas em SÁBADO ou DOMINGO (não feriado) no período DIURNO (07:00–22:00). Verifique o dia da semana de cada data da jornada. Formato: número decimal (ex: 8.0). Zero se não houver.",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "h_fds_noturnas",
      "label": "H FDS Noturnas",
      "type": "text",
      "required": false,
      "section": "Jornada",
      "ocr_hint": "horas trabalhadas em SÁBADO ou DOMINGO (não feriado) no período NOTURNO (22:00–07:00). Verifique o dia da semana de cada data da jornada. Formato: número decimal (ex: 0.0). Zero se não houver.",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "h_feriado_diurnas",
      "label": "H Feriado Diurnas",
      "type": "text",
      "required": false,
      "section": "Jornada",
      "ocr_hint": "horas trabalhadas em dia de FERIADO NACIONAL BRASILEIRO no período DIURNO (07:00–22:00). Consulte os feriados nacionais (1/jan, carnaval, páscoa, tiradentes 21/abr, trabalho 1/mai, corpus christi, independência 7/set, aparecida 12/out, finados 2/nov, proclamação 15/nov, natal 25/dez). Formato: número decimal. Zero se não houver.",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "h_feriado_noturnas",
      "label": "H Feriado Noturnas",
      "type": "text",
      "required": false,
      "section": "Jornada",
      "ocr_hint": "horas trabalhadas em dia de FERIADO NACIONAL BRASILEIRO no período NOTURNO (22:00–07:00). Mesma lógica de h_feriado_diurnas mas para o período noturno. Formato: número decimal. Zero se não houver.",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "jornada",
      "label": "Jornada de Trabalho (detalhes)",
      "type": "textarea",
      "required": false,
      "section": "Jornada",
      "ocr_hint": "transcreva TODAS as linhas preenchidas da tabela JORNADA DE TRABALHO, uma por linha, no formato: data | entrada1 | saída1 | entrada2 | saída2 | total | serviço executado. Exemplo:\n11/06 | 07:00 | 15:00 | 15:00 | 02:00 | 19h | Limpeza caldeira\n12/06 | 07:00 | 15:00 | 15:00 | 02:00 | 19h | Limpeza ETE-1",
      "show_in_table": false,
      "show_in_pdf": true,
      "width": "full",
      "options": ""
    },
    {
      "key": "observacoes",
      "label": "Observações",
      "type": "textarea",
      "required": false,
      "section": "Observações",
      "ocr_hint": "texto livre registrado no campo OBSERVAÇÕES",
      "show_in_table": false,
      "show_in_pdf": true,
      "width": "full",
      "options": ""
    },
    {
      "key": "assinatura_cliente_assinado",
      "label": "Cliente — Assinado",
      "type": "checkbox",
      "required": false,
      "section": "Aprovações",
      "ocr_hint": "seção APROVAÇÕES lado esquerdo (ASSINATURA POR EXTENSO E MATRÍCULA CLIENTE) — há assinatura ou nome manuscrito? true se sim, false se o campo estiver em branco",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "assinatura_cliente_nome",
      "label": "Cliente — Nome / Matrícula",
      "type": "text",
      "required": false,
      "section": "Aprovações",
      "ocr_hint": "nome por extenso e matrícula escritos pelo cliente no campo ASSINATURA POR EXTENSO E MATRÍCULA CLIENTE (lado esquerdo das aprovações)",
      "show_in_table": false,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "assinatura_birigui_assinado",
      "label": "Birigui — Assinado",
      "type": "checkbox",
      "required": false,
      "section": "Aprovações",
      "ocr_hint": "seção APROVAÇÕES lado direito (ASSINATURA POR EXTENSO BIRIGUI) — há assinatura ou nome manuscrito? true se sim, false se o campo estiver em branco",
      "show_in_table": true,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    },
    {
      "key": "assinatura_birigui_nome",
      "label": "Birigui — Nome por Extenso",
      "type": "text",
      "required": false,
      "section": "Aprovações",
      "ocr_hint": "nome por extenso do responsável Birigui escrito no campo ASSINATURA POR EXTENSO BIRIGUI (lado direito das aprovações)",
      "show_in_table": false,
      "show_in_pdf": true,
      "width": "half",
      "options": ""
    }
  ]'::jsonb
);

-- Verificação
SELECT id, nome, tipo_base, ativo,
       jsonb_array_length(campos) AS total_campos
FROM form_templates
WHERE workspace_id = '71eee268-082e-49d9-a613-9387595ea6d5'
  AND tipo_base = 'rdo';
