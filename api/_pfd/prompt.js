export function buildGeminiPrompt(modelo, fabricante) {
  const modeloHint = modelo
    ? `Equipamento informado: ${fabricante || 'John Deere'} ${modelo}`
    : `Fabricante informado: ${fabricante || 'John Deere'} — detecte o modelo pela capa`

  return `Você é um especialista em planos de manutenção. Analise TODAS as páginas deste PDF de Manual do Operador.

${modeloHint}

═══════════════════════════════════════════════════════════
PASSO 1 — IDENTIFICAR O EQUIPAMENTO (página de capa / folha de rosto)
═══════════════════════════════════════════════════════════
Leia a primeira página e extraia:
• modelo: série/modelo do equipamento (ex: "8R", "8R 410", "S790", "X9 1100")
• modelos_cobertos: todos os modelos cobertos pelo manual, quando a capa listar mais de um (ex: ["5060E", "5070E", "5080E"])
• marca: fabricante (ex: "John Deere", "Case IH", "New Holland")
• codigo_manual: código do documento (ex: "OMRE591477")
• edicao: edição (ex: "C8", "Issue J6")
• regiao: região/mercado/edição regional, se aparecer (ex: "South America", "Brazil")
• serie: faixa de número de série (ex: "120001-", "700000-799999")
Se o parâmetro já trouxer modelo/fabricante, confirme ou corrija pelo que está na capa.

═══════════════════════════════════════════════════════════
PASSO 2 — LOCALIZAR TODOS OS INTERVALOS DE MANUTENÇÃO
═══════════════════════════════════════════════════════════
Procure TODOS os títulos de seção com os seguintes padrões:
  "Manutenção de X horas" → h = X
  "Serviço a Cada X Horas" / "Service Every X Hours" → h = X
  "Diariamente" / "Diário" / "Daily" → h = 10
  "Semanalmente" / "Weekly" → h = 50
  "Mensalmente" / "Monthly" → h = 200
  "Serviço Anual" / "Annual Service" → h = 8760
  "Serviço Conforme Necessário" / "As Required" / "When Required" → h = -1
  "Amaciamento" / "Break-In" / "Primeiras X horas" → h = 0 (com u:"uma_vez")
Inclua TODOS os intervalos encontrados, incluindo os não-convencionais (ex: 750h, 1250h, 1750h, 2250h, 3000h, 3500h, 4500h, 4750h, 6000h).

═══════════════════════════════════════════════════════════
PASSO 3 — EXTRAIR TAREFAS — LÓGICA DE 3 COLUNAS
═══════════════════════════════════════════════════════════
ATENÇÃO: As tabelas deste tipo de manual têm 3 COLUNAS por linha.
Cada item (bullet •, checkbox □ ou marcador) em CADA coluna é uma tarefa SEPARADA.
Se uma linha da tabela tem 3 células com itens, são 3 tarefas distintas.
NUNCA agrupe colunas numa mesma tarefa — extraia cada célula individualmente.

Dentro de cada intervalo, identifique as SUB-SEÇÕES e mapeie para o campo "tp":
  "Verificar:" / "Verifique:" / "Check:" → tp: "verificacao"
  "Lubrificação:" / "Lubrificar:" / "Lubrication:" → tp: "lubrificacao"
  "Troca:" / "Trocar:" / "Change:" / "Replace:" → tp: "substituicao"
  "Torque:" / "Torque Check:" → tp: "ajuste"
  "Limpeza:" / "Limpar:" / "Clean:" → tp: "limpeza"
  "Elétrica:" / "Electrical:" → tp: "inspecao"
  "Ajuste:" / "Adjust:" → tp: "ajuste"
  "Inspecionar:" / "Inspect:" → tp: "inspecao"
Quando não houver sub-seção explícita, infira o tipo pelo verbo da tarefa.

═══════════════════════════════════════════════════════════
PASSO 4 — PROCESSAR CONDIÇÕES (notas de rodapé)
═══════════════════════════════════════════════════════════
Itens com letra sobrescrita (ᵃ ᵇ ᶜ ou a b c) fazem referência a notas em itálico abaixo da tabela.
Para cada item com sobrescrito, leia a nota correspondente e preencha:
  cn: true
  ap: texto exato da nota de rodapé (ex: "Se usado em condições extremamente úmidas, lubrifique diariamente")
Inclua SEMPRE esses itens condicionais — nunca os omita.

═══════════════════════════════════════════════════════════
PASSO 5 — PREENCHER LUBRIFICANTES E QUANTIDADES
═══════════════════════════════════════════════════════════
Manuais John Deere e de outros fabricantes geralmente têm uma seção separada chamada
"Lubrificantes e Fluidos", "Lubrication Chart", "Fluid Specifications" ou similar.
Leia ESSA seção e use as informações para preencher "ins" e "qty" em cada tarefa de troca/lubrificação.
Regras:
• Para tarefas de TROCA DE ÓLEO: preencha "ins" com o tipo de óleo (ex: "JD Plus-50 II", "Hy-Gard") e "qty" com a capacidade (ex: "10,2 L")
• Para tarefas de LUBRIFICAÇÃO: preencha "ins" com o tipo de graxa ou fluido (ex: "JD Grease SD Polyurea", "Pasta multiusos")
• Para tarefas de TROCA DE FILTRO: preencha "pn" com o número de peça do filtro, se mencionado
• Para tarefas de VERIFICAÇÃO ou LIMPEZA que não envolvem fluidos: deixe "ins" vazio (omitir)
• "esp" = especificação técnica do fluido quando mencionada (ex: "SAE 15W-40 / API CK-4", "ISO VG 46")
Se o lubrificante não for explicitamente mencionado mas for óbvio pelo contexto (ex: "Troque o óleo do motor"), infira o lubrificante padrão do fabricante para aquele componente.

═══════════════════════════════════════════════════════════
SCHEMA JSON DE SAÍDA — OMITA CAMPOS VAZIOS (""), false, null, []
═══════════════════════════════════════════════════════════
{
  "eq": {
    "marca": "John Deere",
    "modelo": "8R",
    "modelos_cobertos": ["8R"],
    "codigo_manual": "OMRE591477",
    "edicao": "C8",
    "regiao": "South America",
    "serie": "120001-",
    "idioma": "pt"
  },
  "iv": [
    {
      "h": 500,
      "n": "Manutenção de 500 horas",
      "pgi": "207-16",
      "pgf": "207-16",
      "tv": [
        {"s": "Motor", "cmp": "Cárter", "a": "Verificar nível de óleo do motor", "tp": "verificacao", "ins": "JD Plus-50 II", "pn": "TY26674", "qty": "10,2 L", "esp": "SAE 15W-40 / API CK-4", "pg": 8},
        {"s": "Motor", "cmp": "Filtro de óleo", "a": "Trocar filtro e óleo do motor", "tp": "substituicao", "ins": "Filtro RE504836", "pn": "RE504836", "pg": 8, "cn": true, "ap": "Troque pelo menos uma vez por ano"},
        {"s": "Transmissão", "cmp": "Eixo de tração dianteira", "a": "Lubrificar pinos mestres e extremidades da haste de ligação", "tp": "lubrificacao", "ins": "JD Grease SD Polyurea", "pts": "pinos mestres, conexões do pivô, cilindros de direção", "pg": 8, "cn": true, "ap": "Lubrificação normal a cada 500 horas. Em condições extremamente úmidas, lubrifique diariamente ou a cada 10 horas"},
        {"s": "Freios", "cmp": "Rodas", "a": "Verificar torque dos parafusos da roda e peso da roda", "tp": "ajuste", "pg": 8},
        {"s": "Motor", "cmp": "Filtro de ar", "a": "Trocar filtros de ar primário e secundário do motor", "tp": "substituicao", "pg": 8, "cn": true, "ap": "Troque a cada 500 horas ou conforme indicado"},
        {"s": "Elétrico", "cmp": "Sensor", "a": "Limpar sensor do radar de feixe duplo", "tp": "limpeza", "pg": 8, "cn": true, "ap": "Se usado regularmente em condições extremamente úmidas, limpe a cada 500 horas"}
      ]
    },
    {
      "h": -1,
      "n": "Serviço Conforme Necessário",
      "tv": [
        {"s": "Geral", "a": "Executar serviço quando o desempenho ou instrumentos do trator indicarem a necessidade", "tp": "inspecao", "pg": 3}
      ]
    }
  ]
}

MAPEAMENTO COMPLETO DE CAMPOS:
• eq = equipamento: marca, modelo, codigo_manual, edicao, serie, idioma
• iv = intervalos (array, ordenar por h crescente)
  • h  = horas (número inteiro). Conforme Necessário = -1. Amaciamento = 0. Anual = 8760.
  • n  = título exato do intervalo conforme aparece no PDF
  • pgi = página/referência inicial do intervalo (ex: "207-7") — use a referência interna do manual quando existir
  • pgf = página/referência final do intervalo (ex: "207-9") — use a referência interna do manual quando existir
  • u  = "uma_vez" SOMENTE para Amaciamento (h=0) e Primeiras X horas — OMITA para recorrente
  • st = OMITA se ok; use "falha" se sem tarefas identificáveis; "nao_enc" se não consta no manual
  • tv = tarefas (array) — UMA tarefa por bullet/checkbox/item
    • s   = sistema: Motor | Transmissão | Hidráulico | Eixo Dianteiro | Freios | Cabine | Combustível | Elétrico | Geral | outro
    • cmp = componente específico (ex: "Cárter", "Filtro de ar", "Radiador") — infira sempre que possível
    • a   = atividade: descrição completa e fiel ao manual
    • tp  = tipo (ver mapeamento Passo 3 acima)
    • ins = insumo/lubrificante/peça — preserve nome exato ("JD Plus-50 II", "Hy-Gard", "Cool-Gard II")
    • pn  = código/part number da peça (ex: "RE504836", "AT174893") — OMITA se não mencionado
    • qty = quantidade com unidade (ex: "10,2 L", "500 g") — OMITA se não há
    • esp = especificação técnica: viscosidade, norma API, torque (ex: "SAE 15W-40 / API CK-4", "torque: 110 Nm")
    • pts = pontos de lubrificação (ex: "pinos mestres, conexões do pivô, cilindros de direção")
    • seg = aviso de segurança específico desta tarefa (ex: "CUIDADO: Aliviar pressão antes de abrir")
    • pg  = número da página ou referência interna do manual (ex: 8 ou "207-7")
    • raw = texto exato do manual — OMITA se idêntico a "a"
    • cn  = true se item tem condição (letra sobrescrita ou condicional explícito) — OMITA se false
    • ap  = texto exato da condição/nota de rodapé — OMITA se não condicional
    • ob  = observação adicional relevante — OMITA se não há
    • cf  = "media" ou "baixa" — OMITA se alta (padrão)

REGRAS ABSOLUTAS:
1. TODOS os intervalos — não pule nenhum, incluindo não-convencionais (750h, 2250h, 3500h, 4750h)
2. TODAS as tarefas de cada intervalo — se a seção "Verificar" tem 9 itens em 3 colunas (3 linhas × 3 col), são 9 tarefas
3. Tarefas condicionais (letras sobrescritas): sempre inclua com cn:true e ap:nota de rodapé
4. Preserve nomes de lubrificantes exatamente ("JD Plus-50 II", "Hy-Gard", "Cool-Gard II", "BioHy-Gard")
5. "Serviço Conforme Necessário" → intervalo com h:-1 e as tarefas listadas nessa seção
6. OMITA apenas campos com valor vazio, false, null ou [] — nunca omita "a" (atividade)`
}