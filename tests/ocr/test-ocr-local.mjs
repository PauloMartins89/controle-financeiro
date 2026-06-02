/**
 * test-ocr-local.mjs
 * Testa o OCR do Gemini localmente sem passar pelo WhatsApp.
 *
 * Uso:
 *   node tests/ocr/test-ocr-local.mjs [boletim_id]
 *   node tests/ocr/test-ocr-local.mjs --imagem https://url-da-imagem.jpg
 *
 * Carrega as env vars de .env (local) ou .env.local.
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// ── Carrega .env/.env.local manualmente ────────────────────────────────────
function loadEnv() {
  // Carrega todos os arquivos env em ordem de prioridade (último sobrescreve)
  for (const f of ['.env', '.env.local']) {
    const p = resolve(process.cwd(), f)
    if (!existsSync(p)) continue
    const lines = readFileSync(p, 'utf-8').split('\n')
    let count = 0
    for (const line of lines) {
      const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/)
      if (m) { process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); count++ }
    }
    if (count > 0) console.log(`[env] Carregado: ${f} (${count} vars)`)
  }
}
loadEnv()

const SUPABASE_URL        = process.env.SUPABASE_URL        || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY= process.env.SUPABASE_SERVICE_KEY
const GEMINI_API_KEY      = process.env.GEMINI_API_KEY
const GEMINI_MODEL        = process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash'

// ── Validações ──────────────────────────────────────────────────────────────
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY não configurada no .env')
  process.exit(1)
}

// ── Prompt (mesmo do ocr-boletim-maquina.js) ───────────────────────────────
const systemPrompt = [
  'Você é um sistema de OCR especializado em formulários de apontamento de máquinas e Relatório Diário de Obra.',
  'Extraia os campos do formulário da imagem e retorne um JSON com as chaves exatamente como listadas.',
  'ATENÇÃO ESPECIAL: o campo numero_documento é o número isolado impresso em destaque no CANTO SUPERIOR DIREITO do formulário, dentro de uma caixa/quadro. Ele SEMPRE existe e deve ser extraído.',
  'Para campos não preenchidos ou ilegíveis, use null.',
  'Retorne APENAS o JSON, sem explicações.',
].join(' ')

const userPrompt = `Extraia TODOS os dados deste formulário de apontamento/diário. Retorne um JSON com as seguintes chaves (use null se o campo não existir ou estiver ilegível):
- numero_documento: OBRIGATÓRIO — número de 4 a 6 dígitos PRÉ-IMPRESSO (não manuscrito) no CANTO SUPERIOR DIREITO do formulário, dentro de uma caixa/quadro retangular com borda. Exemplo de posição: ao lado ou abaixo do título "DIÁRIO DO MOTORISTA" ou "Nº". Leia com MÁXIMA ATENÇÃO cada dígito — dígitos comumente confundidos: 7 com 9, 0 com 6, 1 com 7. O número costuma ter 5 dígitos (ex: 81772, 01234). Extraia SOMENTE os dígitos como string. NÃO retorne null.
- data: data do boletim (DD/MM/YYYY)
- turno: "dia", "noite" ou "integral" conforme marcado
- empresa: nome da empresa/cliente no cabeçalho do formulário (campo "EMPRESA:" ou similar)
- colaborador: nome do operador, colaborador ou motorista principal
- solicitante: nome do solicitante ou responsável pela emissão
- equipamento: código ou nome do equipamento
- modelo: modelo do equipamento
- classe_operacional: classe/tipo do equipamento
- frente: local ou frente de trabalho (campo "SETOR" ou "FRENTE")
- cdc: centro de custo (campo "CC" ou "CDC")
- local_origem: local, cidade ou endereço de origem/saída
- local_destino: local, cidade ou endereço de destino/chegada
- condutor: nome do motorista/condutor (se houver campo específico)
- placa: placa do veículo
- km_rows: IMPORTANTE — array com TODAS as linhas da tabela KM/HORAS. Cada objeto: { "tipo": "ASFALTO"|"TERRA"|"HORAS"|"DIÁRIAS", "saida": número|null, "entrada": número|null, "total": número|null }. Retorne [] se não houver tabela.
- valor_total: valor total em reais do formulário (campo "VALOR RS", "VALOR R$" ou similar, geralmente próximo ao final do formulário antes das assinaturas). ATENÇÃO ao formato brasileiro: ponto como separador de milhar e vírgula como decimal (ex: "5.950,00" = 5950.0, "12.500,00" = 12500.0). Retorne somente o número decimal sem símbolo de moeda.
- km_ast: hodômetro na saída (número, se houver campo direto separado da tabela)
- km_ter: hodômetro na chegada (número, se houver campo direto)
- km_total: total km percorridos (número, se houver campo direto)
- jornada_inicio: HORA INICIAL (HH:MM)
- jornada_fim: HORA FINAL (HH:MM)
- jornada_total_horas: HORAS ENVOLVIDAS (número decimal)
- horimetro_inicial: leitura inicial do horímetro (número)
- horimetro_final: leitura final do horímetro (número)
- horas_trabalhadas: total de horas trabalhadas (número)
- horas_disponiveis: horas disponíveis ou totais do turno (número)
- horas_espera: horas em espera ou ociosas (número)
- atividade_realizada: atividade ou serviço realizado (resumo)
- descritivo_trabalho: descrição detalhada do serviço
- observacoes: observações, ocorrências ou anomalias
- produtividade_quantidade: quantidade produzida (número)
- produtividade_unidade: unidade de medida
- responsavel_birigui_nome: responsável da empresa executora
- responsavel_birigui_matricula: matrícula do responsável
- responsavel_cliente_nome: responsável do cliente
- responsavel_cliente_matricula: matrícula do responsável do cliente
- cliente: razão social do cliente (se diferente de empresa)
- unidade_empresa: unidade/filial/localidade
- cidade_estado: cidade e estado
- telefone: telefone de contato
- equipe_diurna: membros da equipe diurna separados por ponto-e-vírgula
- equipe_noturna: membros da equipe noturna
- acessorios_utilizados: acessórios e materiais utilizados
- local_servico: campo "LOCAL DE REALIZAÇÃO DOS SERVIÇOS"
- setores: array com nomes dos setores/áreas com checkbox marcado. Retorne [].
- linhas_jornada: array de linhas da tabela Jornada de Trabalho. Cada objeto: { "data": "DD/MM/AA", "e1": "HH:MM", "s1": "HH:MM", "e2": "HH:MM|null", "s2": "HH:MM|null", "total": "HH:MM", "servico": "descrição" }. Retorne [].
- assinatura_cliente: nome por extenso na linha de assinatura do cliente/recebedor
- assinatura_empresa: nome por extenso na linha de assinatura da empresa/entregador
Retorne APENAS o JSON, sem comentários.`

// ── callGeminiVision (cópia fiel do ocr-boletim-maquina.js) ───────────────
async function callGeminiVision(apiKey, { system, prompt, imageUrls }) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 4096 },
    systemInstruction: system,
  })
  const imageParts = await Promise.all(imageUrls.map(async url => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Erro ao baixar imagem (${res.status}): ${url}`)
    const buf = await res.arrayBuffer()
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]
    return { inlineData: { mimeType: mime, data: Buffer.from(buf).toString('base64') } }
  }))

  const MAX_ATTEMPTS = 3
  let lastErr
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent([{ text: prompt }, ...imageParts])
      let parsed = JSON.parse(result.response.text())
      if (Array.isArray(parsed)) {
        const count = obj => (obj && typeof obj === 'object') ? Object.values(obj).filter(v => v != null).length : 0
        parsed = parsed.reduce((best, cur) => count(cur) > count(best) ? cur : best, {})
      }
      return parsed
    } catch (err) {
      lastErr = err
      const isRetryable = /503|529|overloaded|unavailable|429|quota/i.test(err.message)
      if (isRetryable && attempt < MAX_ATTEMPTS) {
        const delay = attempt * 8000
        console.warn(`  ⚠️  tentativa ${attempt} falhou (${err.message.slice(0, 80)}). Aguardando ${delay / 1000}s...`)
        await new Promise(r => setTimeout(r, delay))
      } else throw err
    }
  }
  throw lastErr
}

// ── Modo: via boletim_id no Supabase ──────────────────────────────────────
async function testarPorBoletimId(boletimId) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios para buscar por boletim_id')
    process.exit(1)
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log(`\n🔍 Buscando boletim: ${boletimId}`)
  const { data: bol, error } = await supabase
    .from('maquinas_boletins')
    .select(`*, maquinas_boletim_tipos (id, nome, campos_json, imagem_url, modulo_destino)`)
    .eq('id', boletimId)
    .single()

  if (error || !bol) {
    console.error('❌ Boletim não encontrado:', error?.message)
    process.exit(1)
  }

  const boletimTipo = bol.maquinas_boletim_tipos
  console.log(`📋 Tipo: ${boletimTipo?.nome || '(sem tipo)'}`)
  console.log(`🖼  Imagem boletim: ${bol.imagem_url}`)
  if (boletimTipo?.imagem_url) console.log(`🖼  Imagem template: ${boletimTipo.imagem_url}`)

  const imageUrls = [
    ...(boletimTipo?.imagem_url ? [boletimTipo.imagem_url] : []),
    bol.imagem_url,
  ].filter(Boolean)

  return { imageUrls, boletimTipo }
}

// ── Modo: via URL direto ───────────────────────────────────────────────────
function testarPorUrl(url) {
  console.log(`\n🖼  Imagem: ${url}`)
  return { imageUrls: [url], boletimTipo: null }
}

// ── Exibe resultado formatado ──────────────────────────────────────────────
function exibirResultado(ocrRaw) {
  console.log('\n' + '─'.repeat(60))
  console.log('📊 RESULTADO DO OCR')
  console.log('─'.repeat(60))

  // Campos principais
  const destaque = [
    'numero_documento','data','empresa','colaborador','condutor','solicitante',
    'placa','equipamento','frente','cdc',
    'local_origem','local_destino',
    'jornada_inicio','jornada_fim','jornada_total_horas',
    'km_ast','km_ter','km_total','valor_total',
  ]
  for (const k of destaque) {
    const v = ocrRaw[k]
    if (v != null && v !== '' && !(Array.isArray(v) && v.length === 0)) {
      console.log(`  ${k.padEnd(25)} ${JSON.stringify(v)}`)
    }
  }

  // km_rows
  if (Array.isArray(ocrRaw.km_rows) && ocrRaw.km_rows.length > 0) {
    console.log('\n  📏 km_rows:')
    for (const row of ocrRaw.km_rows) {
      console.log(`     ${(row.tipo || '?').toUpperCase().padEnd(10)} saída: ${row.saida ?? '—'} | chegada: ${row.entrada ?? '—'} | total: ${row.total ?? '—'}`)
    }
  }

  // linhas_jornada
  if (Array.isArray(ocrRaw.linhas_jornada) && ocrRaw.linhas_jornada.length > 0) {
    console.log('\n  ⏱  linhas_jornada:')
    for (const lj of ocrRaw.linhas_jornada) {
      console.log(`     ${lj.data || ''}  ${lj.e1 || ''}→${lj.s1 || ''}  ${lj.e2 ? lj.e2 + '→' + lj.s2 : ''}  total: ${lj.total || ''}  serviço: ${lj.servico || ''}`)
    }
  }

  // Outros campos não-nulos
  const outros = Object.entries(ocrRaw)
    .filter(([k, v]) => !destaque.includes(k) && k !== 'km_rows' && k !== 'linhas_jornada' && k !== 'setores'
      && v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
  if (outros.length > 0) {
    console.log('\n  📎 Outros campos:')
    for (const [k, v] of outros) {
      console.log(`     ${k.padEnd(25)} ${JSON.stringify(v)}`)
    }
  }

  // Campos nulos
  const nulos = Object.entries(ocrRaw).filter(([, v]) => v == null || v === '').map(([k]) => k)
  if (nulos.length > 0) {
    console.log(`\n  ⬜ Nulos/vazios (${nulos.length}): ${nulos.join(', ')}`)
  }

  console.log('\n  📦 JSON completo:')
  console.log(JSON.stringify(ocrRaw, null, 2))
  console.log('─'.repeat(60))
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)

  // Modo --vercel <boletim_id>: chama o endpoint de produção
  if (args[0] === '--vercel' && args[1]) {
    const boletimId = args[1]
    const baseUrl = process.env.APP_URL || 'https://smartpro.app.br'
    console.log(`\n🚀 Chamando endpoint de produção: ${baseUrl}/api/ocr-boletim-maquina`)
    console.log(`📋 Boletim ID: ${boletimId}`)
    const t0 = Date.now()
    const res = await fetch(`${baseUrl}/api/ocr-boletim-maquina`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boletimId }),
    })
    const ms = Date.now() - t0
    const body = await res.json()
    console.log(`\n✅ Resposta (${res.status}) em ${(ms / 1000).toFixed(1)}s:`, JSON.stringify(body, null, 2))
    console.log(`\n💡 Verifique o OCR bruto no Supabase → maquinas_boletins → ocr_raw`)
    console.log(`   e o lançamento criado em lancamentos → dados_extras`)
    return
  }

  let imageUrls = []
  let boletimTipo = null

  if (args[0] === '--imagem' && args[1]) {
    ;({ imageUrls, boletimTipo } = testarPorUrl(args[1]))
  } else if (args[0]) {
    ;({ imageUrls, boletimTipo } = await testarPorBoletimId(args[0]))
  } else {
    // Lista os 5 boletins mais recentes e pergunta qual testar
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.log('\nUso:')
      console.log('  node tests/ocr/test-ocr-local.mjs <boletim_id>          (OCR local, requer GEMINI_API_KEY)')
      console.log('  node tests/ocr/test-ocr-local.mjs --vercel <boletim_id> (usa endpoint de produção Vercel)')
      console.log('  node tests/ocr/test-ocr-local.mjs --imagem <url>        (OCR local por URL, requer GEMINI_API_KEY)')
      process.exit(0)
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: recentes } = await supabase
      .from('maquinas_boletins')
      .select('id, numero, status, imagem_url, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (!recentes?.length) { console.log('Nenhum boletim encontrado.'); process.exit(0) }

    console.log('\n📋 Últimos 5 boletins:')
    for (const b of recentes) {
      console.log(`  ${b.id}  #${b.numero}  [${b.status}]  ${b.created_at?.slice(0, 19)}`)
    }
    console.log('\nUso:')
    console.log('  node tests/ocr/test-ocr-local.mjs <id>             (OCR local, requer GEMINI_API_KEY válida)')
    console.log('  node tests/ocr/test-ocr-local.mjs --vercel <id>    (usa endpoint produção — recomendado)')
    process.exit(0)
  }

  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY não configurada. Use --vercel <id> para testar via produção.')
    process.exit(1)
  }

  if (imageUrls.length === 0) { console.error('❌ Nenhuma imagem disponível'); process.exit(1) }

  // Acrescenta campos_json no prompt se o tipo tiver
  let promptFinal = userPrompt
  const camposJson = boletimTipo?.campos_json || {}
  if (Object.keys(camposJson).length > 0) {
    const desc = Object.entries(camposJson).map(([k, v]) => `- ${k}: "${v.label}" (tipo: ${v.tipo})`).join('\n')
    promptFinal += `\n\nCampos específicos mapeados para este tipo de formulário (extraia também se presentes):\n${desc}`
  }

  console.log(`\n🤖 Modelo: ${GEMINI_MODEL}`)
  console.log(`🖼  Enviando ${imageUrls.length} imagem(ns) para o Gemini...`)
  const t0 = Date.now()

  try {
    const ocrRaw = await callGeminiVision(GEMINI_API_KEY, {
      system: systemPrompt,
      prompt: promptFinal,
      imageUrls,
    })
    const ms = Date.now() - t0
    console.log(`✅ OCR concluído em ${(ms / 1000).toFixed(1)}s`)
    exibirResultado(ocrRaw)
  } catch (e) {
    console.error(`❌ Erro OCR: ${e.message}`)
    process.exit(1)
  }
}

main()
