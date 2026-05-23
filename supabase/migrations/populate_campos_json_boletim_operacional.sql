-- ============================================================
-- populate_campos_json_boletim_operacional.sql
-- Popula o campos_json do Tipo de Boletim "BOLETIM OPERACIONAL
-- DO EQUIPAMENTO / FICHA DE TRABALHO" com todos os campos
-- identificados manualmente no template.
--
-- Execute no Supabase SQL Editor.
-- Substitua 'BOLETIM' pelo nome exato que você cadastrou,
-- ou use o id diretamente.
-- ============================================================

UPDATE maquinas_boletim_tipos
SET campos_json = '{
  "numero_boletim":        { "label": "N° DO BOLETIM:",               "tipo": "texto"       },
  "data":                  { "label": "DATA:",                         "tipo": "data"        },
  "turno":                 { "label": "TURNO:",                        "tipo": "texto"       },
  "equipamento":           { "label": "EQUIPAMENTO:",                  "tipo": "equipamento" },
  "classe":                { "label": "CLASSE OPERACIONAL:",           "tipo": "classe"      },
  "frota":                 { "label": "FROTA:",                        "tipo": "texto"       },
  "colaborador":           { "label": "NOME DO COLABORADOR:",          "tipo": "colaborador" },
  "cdc":                   { "label": "CDC (CENTRO DE CUSTO):",        "tipo": "texto"       },
  "frente":                { "label": "LOCAL / FRENTE DE TRABALHO:",   "tipo": "frente"      },
  "atividade":             { "label": "ATIVIDADE REALIZADA:",          "tipo": "texto"       },
  "descritivo":            { "label": "DESCRITIVO DO TRABALHO:",       "tipo": "texto"       },
  "observacoes":           { "label": "OBSERVAÇÕES / OCORRÊNCIAS:",    "tipo": "texto"       },
  "produtividade":         { "label": "PRODUTIVIDADE:",                "tipo": "numero"      },
  "unidade_medida":        { "label": "UNIDADE DE MEDIDA:",            "tipo": "texto"       },
  "quantidade_produzida":  { "label": "QUANTIDADE PRODUZIDA:",         "tipo": "numero"      },
  "produtividade_hora":    { "label": "PRODUTIVIDADE POR HORA:",       "tipo": "numero"      },
  "horimetro_inicial":     { "label": "HORÍMETRO INICIAL:",            "tipo": "numero"      },
  "horimetro_final":       { "label": "HORÍMETRO FINAL:",              "tipo": "numero"      },
  "horas_trabalhadas":     { "label": "TOTAL DE HORAS TRABALHADAS:",   "tipo": "numero"      },
  "combustivel_tipo":      { "label": "TIPO DE COMBUSTÍVEL:",          "tipo": "texto"       },
  "combustivel_qtd":       { "label": "QUANTIDADE (L):",               "tipo": "numero"      },
  "combustivel_km":        { "label": "LEITURA / KM:",                 "tipo": "numero"      },
  "checklist_oleo":        { "label": "ÓLEO DO MOTOR:",                "tipo": "texto"       },
  "checklist_filtro":      { "label": "FILTRO DE AR:",                 "tipo": "texto"       },
  "checklist_hidraulico":  { "label": "SISTEMA HIDRÁULICO:",           "tipo": "texto"       },
  "checklist_pneus":       { "label": "PNEUS / ESTEIRAS:",             "tipo": "texto"       },
  "checklist_combustivel": { "label": "NÍVEL DE COMBUSTÍVEL:",         "tipo": "texto"       },
  "checklist_eletrico":    { "label": "SISTEMA ELÉTRICO:",             "tipo": "texto"       },
  "checklist_freios":      { "label": "FREIOS:",                       "tipo": "texto"       },
  "checklist_outros":      { "label": "OUTROS:",                       "tipo": "texto"       },
  "obs_checklist":         { "label": "OBSERVAÇÕES DO CHECKLIST:",     "tipo": "texto"       }
}'::jsonb
WHERE workspace_id = 'd0261b4e-450a-47ce-a751-2ba9a12fe7d5'
  AND nome ILIKE '%BOLETIM%';

-- Confirma quantos registros foram atualizados:
SELECT id, nome, jsonb_object_keys(campos_json) AS campo
FROM maquinas_boletim_tipos
WHERE workspace_id = 'd0261b4e-450a-47ce-a751-2ba9a12fe7d5'
  AND campos_json IS NOT NULL;
