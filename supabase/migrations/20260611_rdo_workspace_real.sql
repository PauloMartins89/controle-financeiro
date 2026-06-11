-- ─────────────────────────────────────────────────────────────────────────────
-- RDO Birigui — workspace CORRETO: d0261b4e-450a-47ce-a751-2ba9a12fe7d5
-- Corrige: template estava em workspace 71eee268 (workspace sem boletins)
-- Esta migração:
--   1. Cria/atualiza template RDO no workspace real dos boletins (d0261b4e)
--   2. Vincula o tipo "boletin casa grande" (57e58164) ao novo template
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove versão anterior neste workspace, se houver
DELETE FROM form_templates
WHERE workspace_id = 'd0261b4e-450a-47ce-a751-2ba9a12fe7d5'
  AND tipo_base    = 'rdo';

INSERT INTO form_templates (workspace_id, nome, tipo_base, ativo, campos)
VALUES (
  'd0261b4e-450a-47ce-a751-2ba9a12fe7d5',
  'Relatório Diário de Obra',
  'rdo',
  true,
  '[
    {"key":"numero_rdo","label":"Nº do Relatório","type":"text","required":true,"section":"Identificação","ocr_hint":"número do relatório impresso no canto superior direito do formulário (ex: 2351)","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"data","label":"Data","type":"date","required":true,"section":"Identificação","ocr_hint":"data do relatório — use a data da primeira linha da tabela JORNADA DE TRABALHO, formato YYYY-MM-DD","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"empresa","label":"Empresa","type":"text","required":true,"section":"Cliente","ocr_hint":"nome da empresa cliente no campo EMPRESA","show_in_table":true,"show_in_pdf":true,"width":"full","options":""},
    {"key":"cidade_estado","label":"Cidade / Estado","type":"text","required":false,"section":"Cliente","ocr_hint":"cidade e estado no campo CIDADE / ESTADO","show_in_table":false,"show_in_pdf":true,"width":"half","options":""},
    {"key":"solicitante","label":"Solicitante","type":"text","required":false,"section":"Cliente","ocr_hint":"nome do solicitante no campo SOLICITANTE","show_in_table":false,"show_in_pdf":true,"width":"half","options":""},
    {"key":"fone","label":"Fone","type":"text","required":false,"section":"Cliente","ocr_hint":"telefone do solicitante no campo FONE","show_in_table":false,"show_in_pdf":false,"width":"half","options":""},
    {"key":"veiculo_placa","label":"Veículo Placa","type":"text","required":false,"section":"Acompanhamento","ocr_hint":"placa do veículo no campo VEÍCULO PLACA","show_in_table":false,"show_in_pdf":true,"width":"half","options":""},
    {"key":"equipamento","label":"Equipamento","type":"text","required":false,"section":"Acompanhamento","ocr_hint":"equipamento utilizado no campo EQUIPAMENTO (ex: HJ-22, hidrojato, bomba)","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"equipe_diurna","label":"Equipe Diurna","type":"textarea","required":false,"section":"Acompanhamento","ocr_hint":"nomes dos colaboradores listados na coluna EQUIPE DIURNA","show_in_table":false,"show_in_pdf":true,"width":"half","options":""},
    {"key":"equipe_noturna","label":"Equipe Noturna","type":"textarea","required":false,"section":"Acompanhamento","ocr_hint":"nomes dos colaboradores listados na coluna EQUIPE NOTURNA (deixe vazio se não houver turno noturno)","show_in_table":false,"show_in_pdf":true,"width":"half","options":""},
    {"key":"acessorios","label":"Acessórios Utilizados","type":"textarea","required":false,"section":"Acompanhamento","ocr_hint":"lista de acessórios registrados no campo ACESSÓRIOS UTILIZADOS","show_in_table":false,"show_in_pdf":true,"width":"full","options":""},
    {"key":"locais_servico","label":"Local de Realização dos Serviços","type":"textarea","required":false,"section":"Serviços","ocr_hint":"locais com checkbox marcado na seção LOCAL DE REALIZAÇÃO DOS SERVIÇOS — liste apenas os marcados separados por vírgula, ex: Rotinas-1, Caldeira de Recuperação-2, ETE-1. Opções disponíveis: Rotinas-1, Linha de Fibras-1, Linha de Fibras-2, Preparação Madeira-1, Preparação Madeira-2, Secagem-1, Secagem-2, Forno de Cal-1, Forno de Cal-2, Caldeira de Recuperação-1, Caldeira de Recuperação-2, Aterro Industrial, Sistema de Refrigeração, Caldeira de Força, ETE-1, ETE-2, Cap./Tratamento de água-1, Cap./Tratamento de água-2, Central Ar Compr-1, Central Ar Compr-2, TGs-1, TGs-2, DHO/Refeitório, Logística","show_in_table":true,"show_in_pdf":true,"width":"full","options":""},
    {"key":"jornada_inicio","label":"Início da Jornada","type":"text","required":false,"section":"Jornada","ocr_hint":"hora da PRIMEIRA ENTRADA na tabela JORNADA DE TRABALHO (ex: 03:00). Formato HH:MM.","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"jornada_fim","label":"Fim da Jornada","type":"text","required":false,"section":"Jornada","ocr_hint":"hora da ÚLTIMA SAÍDA na tabela JORNADA DE TRABALHO (ex: 18:00). Pode passar da meia-noite (ex: 02:00 = 02:00 do dia seguinte). Formato HH:MM.","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"jornada_total_horas","label":"Total de Horas","type":"text","required":false,"section":"Jornada","ocr_hint":"SOMA de todos os valores da coluna TOTAL da tabela JORNADA DE TRABALHO. Some todas as linhas preenchidas. Formato: número decimal (ex: 15.0) ou texto com h (ex: 15h).","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"horas_diurnas","label":"H Diurnas (Seg–Sex)","type":"text","required":false,"section":"Jornada","ocr_hint":"horas trabalhadas em dias ÚTEIS (segunda a sexta, não feriado) no período DIURNO (07:00–22:00). Calcule a interseção de cada linha da jornada com esse intervalo e some. Formato: número decimal (ex: 11.0).","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"horas_noturnas","label":"H Noturnas (Seg–Sex)","type":"text","required":false,"section":"Jornada","ocr_hint":"horas trabalhadas em dias ÚTEIS (segunda a sexta, não feriado) no período NOTURNO (22:00–07:00). Calcule a interseção de cada linha da jornada com esse intervalo e some. Formato: número decimal (ex: 4.0).","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"h_fds_diurnas","label":"H FDS Diurnas","type":"text","required":false,"section":"Jornada","ocr_hint":"horas trabalhadas em SÁBADO ou DOMINGO (não feriado) no período DIURNO (07:00–22:00). Verifique o dia da semana de cada data da jornada. Formato: número decimal. Zero se não houver.","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"h_fds_noturnas","label":"H FDS Noturnas","type":"text","required":false,"section":"Jornada","ocr_hint":"horas trabalhadas em SÁBADO ou DOMINGO (não feriado) no período NOTURNO (22:00–07:00). Formato: número decimal. Zero se não houver.","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"h_feriado_diurnas","label":"H Feriado Diurnas","type":"text","required":false,"section":"Jornada","ocr_hint":"horas trabalhadas em dia de FERIADO NACIONAL BRASILEIRO no período DIURNO (07:00–22:00). Feriados: 1/jan, carnaval, páscoa, tiradentes 21/abr, trabalho 1/mai, corpus christi, independência 7/set, aparecida 12/out, finados 2/nov, proclamação 15/nov, natal 25/dez. Formato: número decimal. Zero se não houver.","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"h_feriado_noturnas","label":"H Feriado Noturnas","type":"text","required":false,"section":"Jornada","ocr_hint":"horas trabalhadas em dia de FERIADO NACIONAL BRASILEIRO no período NOTURNO (22:00–07:00). Mesmo critério de h_feriado_diurnas. Formato: número decimal. Zero se não houver.","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"jornada","label":"Jornada de Trabalho (detalhes)","type":"textarea","required":false,"section":"Jornada","ocr_hint":"transcreva TODAS as linhas preenchidas da tabela JORNADA DE TRABALHO, uma por linha, no formato: data | entrada1 | saída1 | entrada2 | saída2 | total | serviço executado","show_in_table":false,"show_in_pdf":true,"width":"full","options":""},
    {"key":"observacoes","label":"Observações","type":"textarea","required":false,"section":"Observações","ocr_hint":"texto livre registrado no campo OBSERVAÇÕES","show_in_table":false,"show_in_pdf":true,"width":"full","options":""},
    {"key":"assinatura_cliente_assinado","label":"Cliente — Assinado","type":"checkbox","required":false,"section":"Aprovações","ocr_hint":"true se o campo ASSINATURA POR EXTENSO E MATRÍCULA CLIENTE estiver preenchido com nome e matrícula","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"assinatura_cliente_nome","label":"Cliente — Nome","type":"text","required":false,"section":"Aprovações","ocr_hint":"nome por extenso do cliente assinante","show_in_table":false,"show_in_pdf":true,"width":"half","options":""},
    {"key":"assinatura_birigui_assinado","label":"Birigui — Assinado","type":"checkbox","required":false,"section":"Aprovações","ocr_hint":"true se o campo ASSINATURA POR EXTENSO BIRIGUI estiver preenchido com nome e matrícula","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
    {"key":"assinatura_birigui_nome","label":"Birigui — Nome","type":"text","required":false,"section":"Aprovações","ocr_hint":"nome por extenso do responsável Birigui assinante","show_in_table":false,"show_in_pdf":true,"width":"half","options":""}
  ]'::jsonb
)
RETURNING id, nome, workspace_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vincula o tipo "boletin casa grande" ao template recém-criado
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE maquinas_boletim_tipos
SET form_template_id = (
  SELECT id FROM form_templates
  WHERE workspace_id = 'd0261b4e-450a-47ce-a751-2ba9a12fe7d5'
    AND tipo_base    = 'rdo'
  LIMIT 1
)
WHERE id = '57e58164-504b-4a15-9f21-13636aa3bb0c';

-- Verifica
SELECT bt.id, bt.nome, bt.form_template_id, ft.nome AS template_nome, ft.workspace_id
FROM maquinas_boletim_tipos bt
LEFT JOIN form_templates ft ON ft.id = bt.form_template_id
WHERE bt.id = '57e58164-504b-4a15-9f21-13636aa3bb0c';
