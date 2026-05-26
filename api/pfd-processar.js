// api/pfd-processar.js
// Extrai planos de manutenção de PDFs de manuais técnicos
//
// Provider IA configurável via AI_PROVIDER env var:
//   gemini (padrão) — envia PDF nativo ao Gemini 1.5 Flash (lê tabelas visualmente)
//   openai           — envia texto extraído pelo pdf-parse ao GPT-4o-mini (fallback explícito)
//
// Modos de entrada (JSON body):
//   { modo: 'storage', storage_path, workspace_id, ... }
//   { modo: 'url',     url_pdf,      workspace_id, ... }
//   { modo: 'upload',  pdf_base64,   workspace_id, ... }

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager } from '@google/generative-ai/server'
import OpenAI from 'openai'
import { createRequire } from 'module'
import fs from 'fs'
import os from 'os'
import path from 'path'
const require = createRequire(import.meta.url)
// Usa lib interno do pdf-parse para evitar bug de leitura de arquivo de teste
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

const supabaseUrl        = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const geminiApiKey       = process.env.GEMINI_API_KEY
const openaiApiKey       = process.env.OPENAI_API_KEY

// Limite seguro para inline data do Gemini (18 MB — limite oficial é 20 MB)
const GEMINI_INLINE_LIMIT = 18 * 1024 * 1024

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PROVIDER: GEMINI 1.5 Flash — PDF nativo ───────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Schema compacto para caber no limite de 8.192 output tokens do Gemini 1.5 Flash.
// Chaves curtas + omitir campos vazios reduz ~7.000 → ~1.700 tokens para 70+ tarefas.
function buildGeminiPrompt(modelo, fabricante) {
  const modeloHint  = modelo    ? `Equipamento informado: ${fabricante || 'John Deere'} ${modelo}` : `Fabricante informado: ${fabricante || 'John Deere'} — detecte o modelo pela capa`
  return `Você é um especialista em planos de manutenção. Analise TODAS as páginas deste PDF de Manual do Operador.

${modeloHint}

═══════════════════════════════════════════════════════════
PASSO 1 — IDENTIFICAR O EQUIPAMENTO (página de capa / folha de rosto)
═══════════════════════════════════════════════════════════
Leia a primeira página e extraia:
• modelo: série/modelo do equipamento (ex: "8R", "8R 410", "S790", "X9 1100")
• marca: fabricante (ex: "John Deere", "Case IH", "New Holland")
• codigo_manual: código do documento (ex: "OMRE591477")
• edicao: edição (ex: "C8", "Issue J6")
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
SCHEMA JSON DE SAÍDA — OMITA CAMPOS VAZIOS (""), false, null, []
═══════════════════════════════════════════════════════════
{
  "eq": {
    "marca": "John Deere",
    "modelo": "8R",
    "codigo_manual": "OMRE591477",
    "edicao": "C8",
    "serie": "120001-",
    "idioma": "pt"
  },
  "iv": [
    {
      "h": 500,
      "n": "Manutenção de 500 horas",
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
    • pg  = número da página do manual
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

// Converte schema compacto do Gemini para schema completo interno
function expandGeminiCompact(compact) {
  if (!compact?.iv) throw new Error('Resposta Gemini não contém campo "iv" (intervalos)')
  return {
    equipamento: {
      marca:          compact.eq?.marca         || 'John Deere',
      modelo:         compact.eq?.modelo        || '',
      manual:         compact.eq?.codigo_manual || '',
      regiao:         compact.eq?.serie         || compact.eq?.regiao || '',
      idioma:         compact.eq?.idioma        || 'pt',
      edicao:         compact.eq?.edicao        || '',
    },
    intervalos: compact.iv.map(iv => ({
      intervalo_horas:  iv.h ?? 0,
      titulo_intervalo: iv.n || `A cada ${iv.h} horas`,
      periodicidade:    iv.u || 'recorrente',
      tarefas: (iv.tv || []).map(t => ({
        sistema:             t.s   || '',
        componente:          t.cmp || '',
        atividade:           t.a   || t.d || '',   // a=novo, d=retrocompat
        descricao_tarefa:    t.a   || t.d || '',   // alias
        tipo_atividade:      t.tp  || 'outro',
        tipo:                t.tp  || 'outro',     // alias
        insumo_ou_peca:      t.ins || t.l  || '',  // ins=novo, l=retrocompat
        lubrificante_fluido: t.ins || t.l  || '',  // alias
        codigo_peca:         t.pn  || '',
        quantidade:          t.qty || t.cap || '', // qty=novo, cap=retrocompat
        capacidade:          t.qty || t.cap || '', // alias
        especificacao:       t.esp || '',
        pontos_lubrificacao: t.pts || '',
        aviso_seguranca:     t.seg || '',
        pagina_fonte:        t.pg  ?? null,
        texto_original:      t.raw || '',
        pecas_citadas:       [],
        condicional:         t.cn  || false,
        aplicabilidade:      t.ap  || '',
        observacao:          t.ob  || '',
        confianca:           t.cf  || 'alta',
      })),
      status_extracao:
        iv.st === 'falha'   ? 'falha_extracao' :
        iv.st === 'nao_enc' ? 'intervalo_nao_encontrado' : 'ok',
    })),
    alertas: [],
  }
}

async function extrairComGemini(pdfBuffer, modelo, fabricante, L) {
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY não configurada')

  const mbSize = (pdfBuffer.length / 1024 / 1024).toFixed(2)
  L(`Gemini: PDF ${mbSize} MB`)

  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const genAI = new GoogleGenerativeAI(geminiApiKey)
  const model = genAI.getGenerativeModel({
    model: geminiModel,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 65536, // máximo do Gemini 2.5-flash: thinking (até 16K) + JSON de saída (49K+)
      temperature: 0,
      thinkingConfig: { thinkingBudget: 10000 }, // cap de thinking para garantir ~55K de output
    },
  })
  L(`Gemini model: ${geminiModel}`)

  const prompt = buildGeminiPrompt(modelo, fabricante)
  let pdfPart

  if (pdfBuffer.length <= GEMINI_INLINE_LIMIT) {
    // PDF pequeno: envia inline (mais rápido, sem upload)
    L('Modo: inline data')
    pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') } }
  } else {
    // PDF grande: usa Gemini File API (suporta até 2 GB)
    L(`PDF ${mbSize} MB > 18 MB — usando Gemini File API`)
    const fileManager = new GoogleAIFileManager(geminiApiKey)
    const tmpPath = path.join(os.tmpdir(), `pfd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`)
    fs.writeFileSync(tmpPath, pdfBuffer)
    L(`Arquivo temporário: ${tmpPath}`)
    try {
      L('Enviando ao Gemini File API...')
      const upload = await fileManager.uploadFile(tmpPath, {
        mimeType: 'application/pdf',
        displayName: `${fabricante || 'JD'}_${modelo || ''}.pdf`,
      })
      L(`Upload concluído: ${upload.file.uri}`)

      // Aguarda o arquivo ficar ACTIVE (normalmente imediato)
      let file = upload.file
      let retries = 0
      while (file.state === 'PROCESSING' && retries < 12) {
        await new Promise(r => setTimeout(r, 5000))
        file = await fileManager.getFile(file.name)
        retries++
        L(`File API estado: ${file.state} (${retries}/12)`)
      }
      if (file.state !== 'ACTIVE') {
        throw new Error(`Gemini File API: estado inesperado ${file.state}`)
      }

      pdfPart = { fileData: { mimeType: 'application/pdf', fileUri: file.uri } }
    } finally {
      // Remove sempre o arquivo temporário
      try { fs.unlinkSync(tmpPath) } catch (_) {}
    }
  }

  L('Enviando PDF + prompt ao Gemini...')
  const result = await model.generateContent([pdfPart, { text: prompt }])

  // Loga uso de tokens para diagnóstico
  const usage = result.response.usageMetadata
  if (usage) {
    const thinkingTokens = usage.thoughtsTokenCount || 0
    const outputTokens   = usage.candidatesTokenCount || 0
    L(`Gemini tokens: entrada=${usage.promptTokenCount}, thinking=${thinkingTokens}, saída=${outputTokens}, total=${usage.totalTokenCount}`)
    if (outputTokens >= 60000) L('⚠️ AVISO: saída próxima do limite máximo — possível truncamento')
  }

  const text = result.response.text()
  L(`Gemini respondeu: ${text.length} chars`)

  // Verifica truncamento: JSON truncado começa com { mas não fecha
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (parseErr) {
    L(`⚠️ JSON inválido (${parseErr.message}) — ${text.length} chars recebidos. Verificar limites de token.`)
    // Tenta extrair o que veio antes do truncamento
    const match = text.match(/"iv"\s*:\s*(\[[\s\S]*)/)
    if (match) {
      L('Tentando recuperação parcial do JSON...')
      // Não conseguimos recuperar de forma confiável — joga o erro
    }
    throw new Error(`Resposta Gemini truncada (JSON inválido): ${parseErr.message}. Chars recebidos: ${text.length}. Tokens de saída: ${usage?.candidatesTokenCount || '?'}`)
  }

  const expanded = expandGeminiCompact(parsed)
  L(`Gemini extraiu: ${expanded.intervalos.length} intervalos, ${expanded.intervalos.reduce((a, iv) => a + iv.tarefas.length, 0)} tarefas`)
  return expanded
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PROVIDER: OPENAI GPT-4o-mini — texto via pdf-parse (fallback) ─────────────
// ══════════════════════════════════════════════════════════════════════════════

async function openaiWithRetry(client, params, maxAttempts = 2) {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await client.chat.completions.create(params)
    } catch (err) {
      lastErr = err
      const status = err?.status || err?.response?.status
      const retriable = status === 429 || (status >= 500 && status < 600)
      if (!retriable || attempt === maxAttempts) throw err
      const retryAfter = Number(err?.headers?.['retry-after'] || 0)
      // Cap em 12s — retry-after do OpenAI pode ser 60s+ e estoura os 300s do Vercel
      const delay = Math.min(
        retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 2000 + Math.floor(Math.random() * 1000),
        12000
      )
      console.log(`[pfd] OpenAI ${status} — aguardando ${Math.round(delay / 1000)}s (tentativa ${attempt}/${maxAttempts})`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

// Extrai texto de páginas do PDF com suporte a faixa (opcoes.minPagina / opcoes.maxPagina).
// Páginas antes de minPagina são contadas mas não têm texto extraído (evita timeout).
async function pdfParaTexto(pdfBuffer, opcoes = {}) {
  const { minPagina = 1, maxPagina = 9999 } = opcoes
  const paginas = []
  let paginaAtual = 0
  async function renderPage(pageData) {
    paginaAtual++
    if (paginaAtual > maxPagina) return ''
    if (paginaAtual < minPagina) return ''  // conta mas não extrai texto
    const textContent = await pageData.getTextContent()
    const texto = textContent.items.map(item => item.str || '').join(' ').replace(/\s+/g, ' ').trim()
    if (texto.length > 10) paginas.push({ pagina: paginaAtual, texto })
    return texto
  }
  const opts = { pagerender: renderPage }
  if (maxPagina < 9999) opts.max = maxPagina
  await pdfParse(pdfBuffer, opts)
  return paginas
}

// ── MOTOR DE BUSCA DA SEÇÃO DE MANUTENÇÃO ──────────────────────────────────

// 1. Detecta o sumário/índice e extrai as referências de página internas (ex: "207-1")
function detectarSumario(paginas) {
  const TITULOS = [
    /tabela\s+de\s+intervalos\s+de\s+servi[çc]o/i,
    /manuten[çc][ãa]o\s*[—–\-]\s*a\s+cada\s+\d/i,
    /manuten[çc][ãa]o\s*[—–\-]\s*(diariamente|semanalmente|anualmente)/i,
    /maintenance\s+(interval|schedule)/i,
    /service\s+interval/i,
  ]
  for (const p of paginas) {
    const hits = TITULOS.filter(pat => pat.test(p.texto)).length
    if (hits >= 2) {
      const refs = [...p.texto.matchAll(/\b(\d{3}-\d{1,3})\b/g)].map(m => m[1])
      if (refs.length >= 3) {
        return { paginaToc: p.pagina, refs: [...new Set(refs)] }
      }
    }
  }
  return null
}

// 2. Localiza as páginas físicas que contêm a seção de manutenção
//    Estratégia 1: usa refs do sumário (ex: "207-1" no rodapé/cabeçalho da página)
//    Estratégia 2: busca por texto real se sumário não encontrado
function localizarSecaoManutencao(paginas, sumario) {
  let candidatas = []

  if (sumario?.refs?.length > 0) {
    for (const p of paginas) {
      if (sumario.refs.some(ref => p.texto.includes(ref))) {
        candidatas.push(p)
      }
    }
  }

  if (candidatas.length < 3) {
    candidatas = paginas.filter(p =>
      /manuten[çc][ãa]o\s*[—–\-]\s*(a\s+cada|diariamente|semanalmente)/i.test(p.texto) ||
      /tabela\s+de\s+intervalos\s+de\s+servi[çc]o/i.test(p.texto) ||
      /intervalos\s+de\s+servi[çc]o/i.test(p.texto) ||
      /service\s+interval\s+chart/i.test(p.texto)
    )
  }

  return candidatas
}

// 3. Extrai o bloco contínuo — limitado a 20 páginas para caber em 300s do Vercel
//    (pdfParse cold start = ~120s; cada batch OpenAI = ~15s; 20 págs / batchSize=5 = 4 batches = ~60s)
function extrairBlocoManutencao(todasPaginas, paginasLocalizadas) {
  if (paginasLocalizadas.length === 0) return []
  const nums = paginasLocalizadas.map(p => p.pagina)
  const min = Math.max(1, Math.min(...nums) - 1)
  const ultimoPagMax = Math.max(...nums) + 10
  const janelaMax    = min + 20
  const max = Math.min(todasPaginas[todasPaginas.length - 1]?.pagina || 9999, Math.max(ultimoPagMax, janelaMax))
  const bloco = todasPaginas.filter(p => p.pagina >= min && p.pagina <= max)
  // Hard cap: nunca mais de 20 páginas para garantir que cabe em 300s
  return bloco.length > 20 ? bloco.slice(0, 20) : bloco
}

async function extrairComOpenAI(openai, textoBloco, modelo) {
  const res = await openaiWithRetry(openai, {
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Você é um especialista em extrair dados estruturados de manuais técnicos de equipamentos agrícolas John Deere. Responda APENAS com JSON válido.',
      },
      {
        role: 'user',
        content: `Abaixo está o texto extraído das páginas de manutenção do manual do operador do equipamento ${modelo || 'John Deere'}.

O texto pode estar desformatado (tabelas viram texto corrido). Identifique TODOS os intervalos de manutenção e TODAS as tarefas de cada intervalo.

Intervalos típicos John Deere: Amaciamento, Primeiras 600h, 10h/Diário, 50h/Semanal, 100h, 125h, 200h/Mensal, 250h, 400h, 500h, 750h, 1000h, 1500h/2 anos, 2000h/2 anos, Anual, 6000h/6 anos.

TEXTO DAS PÁGINAS DE MANUTENÇÃO (cada bloco começa com === PÁGINA N ===):
${textoBloco}

Retorne este JSON:
{
  "intervalos": [
    {
      "horas": 10,
      "nome": "Diariamente ou a cada 10 horas de operação",
      "tarefas": [
        {
          "sistema": "Motor",
          "componente": "Cárter",
          "tarefa": "Verificar nível do óleo do motor",
          "tipo": "verificacao",
          "insumo": "JD Plus-50 II",
          "quantidade": "10,2 L",
          "pagina": 120
        },
        {
          "sistema": "Motor",
          "componente": "Filtro de ar",
          "tarefa": "Verificar filtro de ar",
          "tipo": "verificacao",
          "pagina": 121,
          "condicional": true,
          "condicao": "Se equipado com pré-filtro"
        }
      ]
    }
  ]
}

Regras OBRIGATÓRIAS:
- Inclua TODOS os intervalos encontrados no texto — não resuma nem agrupe
- Para cada intervalo, inclua TODAS as tarefas listadas sem exceção
- "horas": número inteiro (Amaciamento=0, Primeiras 600h=600, Anual=1000, A cada 2 anos ou 1500h=1500, A cada 6 anos=6000)
- "sistema": Motor | Transmissão | Hidráulico | Eixo Dianteiro | Freios | Cabine | Combustível | Geral | outro
- "componente": SEMPRE infira a parte do equipamento envolvida: "Cárter" (óleo motor), "Filtro de óleo", "Filtro de ar", "Radiador", "Transmissão", "Diferencial", etc. — use "Geral" apenas se realmente não há componente específico
- "tipo": verificacao | troca | lubrificacao | limpeza | ajuste | inspecao | substituicao | outro
- "insumo": se o texto mencionar lubrificante, fluido ou peça, inclua exatamente ("JD Plus-50 II", "Hy-Gard", "Cool-Gard II") — OMITA apenas se não citado
- "quantidade": com unidade ("10,2 L", "500 g") — OMITA se não mencionado
- "pagina": número da página do marcador === PÁGINA N === de onde veio a tarefa — SEMPRE inclua
- "condicional"+"condicao": apenas se há condição explícita no texto ("se equipado", "somente quando") — OMITA se não condicional
- Omita apenas campos com valor false ou null; nunca omita "componente" ou "pagina"
- Se um intervalo não tiver tarefas identificáveis, omita-o`,
      },
    ],
    max_tokens: 16000,
    temperature: 0,
  })

  const choice = res.choices[0]
  if (choice?.finish_reason === 'length') {
    console.warn('[pfd] AVISO: resposta OpenAI truncada (max_tokens atingido)')
  }
  try {
    return JSON.parse(choice?.message?.content || '{}')
  } catch (_) {
    return { intervalos: [] }
  }
}

function mesclarIntervalos(lista) {
  // Valores de horas válidos para manuais John Deere (inclui intervalos não-convencionais 8R/9R)
  const HORAS_VALIDAS = new Set([
    -1,                                          // Conforme Necessário
    0, 10, 50, 100, 125, 200, 250, 400, 500,     // comuns
    600, 750, 1000, 1250, 1500, 1750, 2000,      // médios
    2250, 2500, 3000, 3500, 4000, 4500, 4750,    // altos (8R/9R)
    6000, 8760,                                   // máximos
  ])
  const mapa = {}
  for (const item of lista) {
    for (const iv of (item.intervalos || [])) {
      const h = Number(iv.horas)
      // Descarta intervalos com horas inválidas (ex: 6, 3, 99) — provavelmente erro do modelo
      if (isNaN(h) || !HORAS_VALIDAS.has(h)) continue
      const key = String(h)
      if (!mapa[key]) mapa[key] = { ...iv, horas: h, tarefas: [] }
      for (const t of (iv.tarefas || [])) {
        const exists = mapa[key].tarefas.some(
          ex => ex.tarefa?.toLowerCase() === t.tarefa?.toLowerCase()
        )
        if (!exists) mapa[key].tarefas.push(t)
      }
    }
  }
  return Object.values(mapa).sort((a, b) => Number(a.horas) - Number(b.horas))
}

// Processa páginas filtradas em 3 grupos semânticos paralelos (1 round):
// Grupo A = 1º terço (intervalos baixos: 0h–250h)
// Grupo B = 2º terço (intervalos médios: 400h–750h)
// Grupo C = 3º terço (intervalos altos: 1000h–6000h)
// Reduz de 3 rounds sequenciais (8 lotes) para 1 round de 3 paralelas.
async function extrairPorPaginas(openai, paginasFiltradas, modeloEquip, L) {
  if (paginasFiltradas.length === 0) return { intervalos: [] }

  const n = paginasFiltradas.length
  const c1 = Math.ceil(n / 3)
  const c2 = Math.ceil(2 * n / 3)
  const grupos = [
    paginasFiltradas.slice(0, c1),
    paginasFiltradas.slice(c1, c2),
    paginasFiltradas.slice(c2),
  ].filter(g => g.length > 0)

  const labels = grupos.map(g => `${g[0].pagina}-${g[g.length - 1].pagina}`)
  L(`extração: ${n} págs → ${grupos.length} grupos paralelos [${labels.join(' | ')}]`)

  const resultados = await Promise.all(grupos.map(grupo => {
    const texto = grupo.map(p => `=== PÁGINA ${p.pagina} ===\n${p.texto}`).join('\n\n')
    return extrairComOpenAI(openai, texto, modeloEquip)
  }))

  const totalBruto = resultados.reduce((acc, r) => acc + (r.intervalos?.length || 0), 0)
  L(`merge: ${totalBruto} intervalos brutos de ${resultados.length} grupos`)
  return { intervalos: mesclarIntervalos(resultados) }
}

// Converte resultado OpenAI (formato legado) para novo schema
function legadoParaNovoSchema(extracaoRaw, fabricanteEquip, modeloEquip, edicao, idioma) {
  return {
    equipamento: {
      marca: fabricanteEquip,
      modelo: modeloEquip,
      manual: '',
      regiao: edicao || '',
      idioma: idioma || 'pt',
    },
    intervalos: mesclarIntervalos([extracaoRaw]).map(iv => ({
      intervalo_horas: iv.horas,
      titulo_intervalo: iv.nome || `A cada ${iv.horas} horas`,
      periodicidade: (iv.horas === 0 || iv.horas === 600) ? 'uma_vez' : 'recorrente',
      tarefas: (iv.tarefas || []).map(t => ({
        sistema:             t.sistema     || '',
        componente:          t.componente  || '',
        descricao_tarefa:    t.tarefa      || '',
        atividade:           t.tarefa      || '',
        tipo_atividade:      t.tipo        || 'outro',
        tipo:                t.tipo        || 'outro',
        insumo_ou_peca:      t.insumo      || t.codigo_lubrificante || '',
        lubrificante_fluido: t.insumo      || t.codigo_lubrificante || '',
        quantidade:          t.quantidade  || t.capacidade || '',
        capacidade:          t.quantidade  || t.capacidade || '',
        pagina_fonte:        t.pagina      ?? null,
        texto_original:      '',
        pecas_citadas:       [],
        condicional:         t.condicional || false,
        aplicabilidade:      t.condicao    || '',
        observacao:          '',
        confianca:           'media',
      })),
      status_extracao: (iv.tarefas?.length || 0) > 0 ? 'ok' : 'falha_extracao',
    })),
    alertas: [],
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── VALIDAÇÃO PÓS-EXTRAÇÃO ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Intervalos que, se encontrados no PDF, NÃO podem vir vazios
const INTERVALOS_CRITICOS = [10, 50, 125, 200, 250, 500, 750, 1500, 2000, 6000]

function validarExtracao(resultado) {
  const alertas = resultado.alertas ? [...resultado.alertas] : []
  const intervalos = resultado.intervalos || []

  for (const iv of intervalos) {
    const temTarefas = iv.tarefas && iv.tarefas.length > 0
    if (!temTarefas && iv.status_extracao !== 'intervalo_nao_encontrado') {
      iv.status_extracao = 'falha_extracao'
      alertas.push({
        tipo: 'falha_extracao',
        horas: iv.intervalo_horas,
        intervalo: iv.titulo_intervalo || `${iv.intervalo_horas}h`,
        mensagem: `Intervalo ${iv.intervalo_horas}h encontrado mas sem tarefas extraídas`,
      })
    }
  }

  const temFalhaCritica = intervalos.some(iv =>
    INTERVALOS_CRITICOS.includes(iv.intervalo_horas) && iv.status_extracao === 'falha_extracao'
  )

  const totalIntervalos = intervalos.length
  const totalTarefas = intervalos.reduce((acc, iv) => acc + (iv.tarefas?.length || 0), 0)
  const intervalosOk = intervalos.filter(iv => iv.status_extracao === 'ok').length
  const statusGeral = totalIntervalos === 0
    ? 'falha'
    : intervalosOk === totalIntervalos
      ? 'completo'
      : intervalosOk > 0 ? 'parcial' : 'falha'

  return { alertas, temFalhaCritica, statusGeral, totalIntervalos, totalTarefas, intervalosOk }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── HANDLER PRINCIPAL ─────────────────════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const log = []
  const L = (msg) => { log.push(`[${new Date().toISOString().slice(11, 23)}] ${msg}`); console.log('[pfd]', msg) }

  const {
    modo, url_pdf, pdf_base64, storage_path, workspace_id,
    publicacao_id: pubIdRecebido,
    codigo_pub, titulo, fabricante, modelo,
    familia, classificacao, serie_inicio, serie_fim,
    edicao, idioma,
  } = req.body || {}

  const providerUsado = process.env.AI_PROVIDER || 'gemini'
  L(`request: modo=${modo}, provider=${providerUsado}, workspace=${workspace_id}`)

  if (!modo || !['url', 'upload', 'storage'].includes(modo)) {
    return res.status(400).json({ error: 'Parâmetro modo inválido. Use: url | storage | upload', log })
  }
  if (!workspace_id) return res.status(400).json({ error: 'workspace_id obrigatório', log })

  const sb = getSupabase()

  // ── Cria ou usa publicação ────────────────────────────────────────────────
  let publicacao_id = pubIdRecebido
  if (!publicacao_id) {
    L('criando publicação no banco...')
    const { data: novaPub, error: pubErr } = await sb
      .from('pfd_publicacoes')
      .insert({
        workspace_id,
        codigo_pub: codigo_pub || null,
        titulo: titulo || `Manual ${fabricante || 'John Deere'} ${modelo || ''}`.trim(),
        fabricante: fabricante || 'John Deere',
        modelo: modelo || '',
        familia: familia || null,
        classificacao: classificacao || 'Base Unit',
        serie_inicio: serie_inicio || null,
        serie_fim: serie_fim || null,
        edicao: edicao || null,
        idioma: idioma || 'pt',
        url_pdf: url_pdf || null,
        status: 'processando',
      })
      .select().single()
    if (pubErr) return res.status(500).json({ error: 'Erro ao criar publicação: ' + pubErr.message, log })
    publicacao_id = novaPub.id
    L(`publicação criada: ${publicacao_id}`)
  } else {
    L(`usando publicação existente: ${publicacao_id}`)
    await sb.from('pfd_publicacoes')
      .update({ status: 'processando', updated_at: new Date().toISOString() })
      .eq('id', publicacao_id)
  }

  let pdfBuffer
  let publicacao = null

  try {
    const { data } = await sb.from('pfd_publicacoes').select('*').eq('id', publicacao_id).single()
    publicacao = data

    // ── Obtém o PDF ───────────────────────────────────────────────────────
    if (modo === 'storage') {
      if (!storage_path) throw new Error('storage_path obrigatório para modo storage')
      L(`baixando do storage: ${storage_path}`)
      const { data: fileBlob, error: fileErr } = await sb.storage.from('pfd-manuais').download(storage_path)
      if (fileErr) throw new Error('Erro ao baixar PDF do storage: ' + fileErr.message)
      pdfBuffer = Buffer.from(await fileBlob.arrayBuffer())
    } else if (modo === 'url') {
      const pdfUrl = url_pdf || publicacao?.url_pdf
      if (!pdfUrl) throw new Error('URL do PDF não informada')
      L(`baixando URL: ${pdfUrl}`)
      const pdfRes = await fetch(pdfUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartPro/1.0)', 'Accept': 'application/pdf,*/*' },
      })
      if (!pdfRes.ok) throw new Error(`Erro HTTP ${pdfRes.status} ao baixar PDF`)
      pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
    } else {
      if (!pdf_base64) throw new Error('pdf_base64 obrigatório para modo upload')
      pdfBuffer = Buffer.from(pdf_base64.replace(/^data:[^;]+;base64,/, ''), 'base64')
    }
    L(`PDF obtido: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    let paginasUsadas = null

    const modeloEquip     = publicacao?.modelo     || modelo     || 'John Deere'
    const fabricanteEquip = publicacao?.fabricante || fabricante || 'John Deere'

    // ── Extração IA ───────────────────────────────────────────────────────
    let resultado

    if (providerUsado === 'openai') {
      // ── PATH: OpenAI (explicitamente configurado via AI_PROVIDER=openai) ──
      L('provider=openai → extraindo texto com pdf-parse (único pass 1-200)...')
      const openai = new OpenAI({ apiKey: openaiApiKey })
      // Single pass: 1-200 páginas (evita múltiplos cold-starts de pdfParse)
      const paginas = await pdfParaTexto(pdfBuffer, { maxPagina: 200 })
      L(`pdf-parse: ${paginas.length} págs extraídas (1-200)`)
      if (paginas.length === 0) throw new Error('Nenhum texto extraído do PDF (pdf-parse)')
      const sumario = detectarSumario(paginas)
      if (sumario) L(`sumário detectado: pág ${sumario.paginaToc}, ${sumario.refs.length} refs`)
      else L('sumário não detectado — buscando por texto')
      const candidatas = localizarSecaoManutencao(paginas, sumario)
      L(`seção localizada: ${candidatas.length} páginas candidatas`)
      // Usa candidatas diretamente — já são as págs com refs/texto de manutenção
      // cap 40: batchSize=5 = 8 lotes = 3 rounds ≈ 35s warm / 165s cold (< 300s)
      const paginasFiltradas = candidatas.length > 0
        ? [...candidatas].sort((a, b) => a.pagina - b.pagina).slice(0, 40)
        : paginas.slice(0, 20)
      L(`págs selecionadas: ${paginasFiltradas.length} [${paginasFiltradas.map(p => p.pagina).join(', ')}]`)
      paginasUsadas = paginasFiltradas.map(p => p.pagina)

      const extracaoRaw = await extrairPorPaginas(openai, paginasFiltradas, modeloEquip, L)
      L(`OpenAI retornou: ${extracaoRaw.intervalos?.length || 0} intervalos`)
      resultado = legadoParaNovoSchema(extracaoRaw, fabricanteEquip, modeloEquip, edicao, idioma)

    } else {
      // ── PATH: Gemini (padrão) com fallback automático para OpenAI ─────
      try {
        resultado = await extrairComGemini(pdfBuffer, modeloEquip, fabricanteEquip, L)
        L(`Gemini: ${resultado.intervalos?.length || 0} intervalos extraídos`)
      } catch (geminiErr) {
        L(`⚠️ Gemini falhou: ${geminiErr.message}`)
        if (!openaiApiKey) throw geminiErr
        L('Tentando fallback OpenAI + pdf-parse...')

        const openai = new OpenAI({ apiKey: openaiApiKey })
        // Single pass: 1-200 páginas (evita múltiplos cold-starts de pdfParse)
        const paginas = await pdfParaTexto(pdfBuffer, { maxPagina: 200 })
        L(`pdf-parse: ${paginas.length} págs extraídas (1-200)`)
        const sumario = detectarSumario(paginas)
        if (sumario) L(`sumário detectado: pág ${sumario.paginaToc}, ${sumario.refs.length} refs`)
        else L('sumário não detectado — buscando por texto')
        const candidatas = localizarSecaoManutencao(paginas, sumario)
        L(`seção localizada: ${candidatas.length} páginas candidatas`)
        // Usa candidatas diretamente — já são as págs com refs/texto de manutenção
        // cap 40: batchSize=5 = 8 lotes = 3 rounds ≈ 35s warm / 165s cold (< 300s)
        const paginasFiltradas = candidatas.length > 0
          ? [...candidatas].sort((a, b) => a.pagina - b.pagina).slice(0, 40)
          : paginas.slice(0, 20)
        paginasUsadas = paginasFiltradas.map(p => p.pagina)
        L(`fallback: ${paginasFiltradas.length} págs candidatas → OpenAI [${paginasFiltradas.map(p => p.pagina).join(', ')}]`)

        const extracaoRaw = await extrairPorPaginas(openai, paginasFiltradas, modeloEquip, L)
        L(`fallback OpenAI: ${extracaoRaw.intervalos?.length || 0} intervalos`)
        resultado = legadoParaNovoSchema(extracaoRaw, fabricanteEquip, modeloEquip, edicao, idioma)
      }
    }

    // ── Validação ─────────────────────────────────────────────────────────
    const validacao = validarExtracao(resultado)
    resultado.alertas = validacao.alertas
    L(`validação: status=${validacao.statusGeral}, intervalos=${validacao.totalIntervalos} (${validacao.intervalosOk} ok), tarefas=${validacao.totalTarefas}`)
    if (validacao.temFalhaCritica) {
      L('⚠️ FALHA EM INTERVALO CRÍTICO — salvo com alertas')
    }

    // ── Auto-atualiza modelo detectado pelo Gemini se veio vazio ──────────
    const modeloDetectado  = resultado.equipamento?.modelo  || ''
    const marcaDetectada   = resultado.equipamento?.marca   || ''
    const edicaoDetectada  = resultado.equipamento?.edicao  || ''
    const modeloFinal      = modeloDetectado  || modeloEquip
    const fabricanteFinal  = marcaDetectada   || fabricanteEquip
    if (modeloDetectado && modeloDetectado !== modeloEquip && modeloEquip === '') {
      L(`Gemini detectou modelo: "${modeloDetectado}" — atualizando publicação`)
      await sb.from('pfd_publicacoes')
        .update({ modelo: modeloDetectado, fabricante: fabricanteFinal, edicao: edicaoDetectada || edicao || null })
        .eq('id', publicacao_id)
    }

    // ── Salva no banco ────────────────────────────────────────────────────
    L('salvando plano no banco...')
    const { data: planoSalvo, error: planoErr } = await sb
      .from('pfd_planos')
      .insert({
        publicacao_id,
        workspace_id,
        modelo:           modeloFinal,
        fabricante:       fabricanteFinal,
        intervalos:       resultado.intervalos,
        total_intervalos: validacao.totalIntervalos,
        total_tarefas:    validacao.totalTarefas,
        paginas_usadas:   paginasUsadas,
        extraido_em:      new Date().toISOString(),
      })
      .select().single()

    if (planoErr) throw new Error('Erro ao salvar plano: ' + planoErr.message)

    await sb.from('pfd_publicacoes')
      .update({
        status: 'processado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', publicacao_id)

    L(`✅ concluído: plano_id=${planoSalvo.id} (provider=${providerUsado})`)

    return res.json({
      ok: true,
      plano_id: planoSalvo.id,
      provider: providerUsado,
      status_extracao: validacao.statusGeral,
      total_intervalos: validacao.totalIntervalos,
      total_tarefas: validacao.totalTarefas,
      intervalos_ok: validacao.intervalosOk,
      alertas: validacao.alertas,
      equipamento: resultado.equipamento,
      modelo_detectado: modeloDetectado || null,
      log,
    })

  } catch (err) {
    L(`❌ ERRO: ${err.message}`)
    console.error('[pfd] stack:', err.stack)
    const httpStatus = err?.status || 500
    const errMsg = httpStatus === 429
      ? `Rate limit / quota: ${err?.error?.message || err.message}`
      : err.message

    if (publicacao_id) {
      await sb.from('pfd_publicacoes')
        .update({ status: 'erro', erro_msg: errMsg, updated_at: new Date().toISOString() })
        .eq('id', publicacao_id)
    }
    return res.status(500).json({ error: errMsg, log })
  }
}
