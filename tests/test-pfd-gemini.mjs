/**
 * tests/test-pfd-gemini.mjs
 * Teste completo do motor de extração PFD — roda localmente com Node.js
 *
 * Uso: node tests/test-pfd-gemini.mjs
 *
 * O script:
 *  1. Busca publicações no Supabase
 *  2. Baixa o PDF (URL ou Storage)
 *  3. Conta páginas via pdf-parse
 *  4. Envia ao Gemini 1.5 Flash com schema FLAT + compacto
 *  5. Valida campos de cada tarefa
 *  6. Salva resultado em tests/output-pfd.json
 *  7. Imprime sumário completo
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager } from '@google/generative-ai/server'
import { createRequire } from 'module'
import fs from 'fs'
import os from 'os'
import path from 'path'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

// ─── Config ──────────────────────────────────────────────────────────────────
// Lê .env manualmente (sem dependência de dotenv)
function loadEnv() {
  try {
    const envPath = new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"](.*)['"]$/, '$1')
    }
  } catch (_) {}
}
loadEnv()

const SUPABASE_URL   = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const INLINE_LIMIT   = 18 * 1024 * 1024

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Defina SUPABASE_URL/SUPABASE_SERVICE_KEY no .env'); process.exit(1) }
if (!GEMINI_API_KEY) { console.error('Defina GEMINI_API_KEY no .env'); process.exit(1) }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const bar = (s) => console.log(`\n${'═'.repeat(60)}\n  ${s}\n${'═'.repeat(60)}`)
const ok  = (s) => console.log(`  ✓ ${s}`)
const wrn = (s) => console.log(`  ⚠ ${s}`)
const er  = (s) => console.log(`  ✗ ${s}`)

// ─── Prompt Gemini — schema FLAT, chaves curtas ────────────────────────────
function buildPrompt(fabricante, modelo) {
  return `Analise o Manual do Operador: ${fabricante} ${modelo}

TAREFA: Extraia TODAS as tarefas de manutenção periódica de TODOS os intervalos.
Procure: "Serviço Periódico", "Manutenção Periódica", "Intervalos de Manutenção", "Lubrificação e Manutenção" (inglês ou português).

SCHEMA — array PLANO de tarefas (omita campos com valor vazio, null, false):
{
  "eq": {"marca": "${fabricante}", "modelo": "${modelo}"},
  "tv": [
    {
      "h": 500,
      "it": "A cada 500 horas de operação",
      "s": "Motor",
      "cmp": "Filtro de óleo",
      "a": "Substituir o filtro de óleo do motor",
      "tp": "substituicao",
      "ins": "JD Plus-50 II",
      "qty": "10,2 L",
      "pg": 42,
      "raw": "Trocar filtro de óleo (pág 42)",
      "cf": "media"
    }
  ]
}

CAMPOS (omita se vazio ou nulo):
• h    = intervalo_horas: número. Amaciamento=0, Primeiras600h=600, Anual=8760
• it   = título do intervalo exatamente como no manual
• s    = sistema: Motor | Transmissão | Hidráulico | Eixo Dianteiro | Freios | Cabine | Combustível | Geral
• cmp  = componente específico (ex: "Filtro de óleo", "Fluido de transmissão")
• a    = atividade: descrição completa e exata da tarefa
• tp   = tipo: verificacao | troca | lubrificacao | limpeza | ajuste | inspecao | substituicao | outro
• ins  = insumo ou peça (lubrificante, fluido ou referência de peça)
• qty  = quantidade ou capacidade (ex: "10,2 L", "500 g")
• pg   = número da página PDF onde a tarefa aparece
• raw  = texto original exato da célula da tabela (omitir se igual a "a")
• cf   = "media" ou "baixa" — OMITA se confiança é alta (padrão é alta)

REGRAS ABSOLUTAS:
1. Crie UMA ENTRADA por tarefa por intervalo — não agrupe, não resuma
2. NUNCA omita linhas — se a tabela tem 15 tarefas em 500h, retorne 15 entradas com h=500
3. Tarefas condicionais ("se equipado"): inclua como entrada separada, coloque a condição em "raw"
4. Preserve nomes exatos dos lubrificantes (JD Plus-50 II, Hy-Gard, Cool-Gard II, BioHy-Gard)
5. Inclua TODOS os intervalos encontrados no manual (10h, 50h, 100h, 125h, 200h, 250h, 500h, 750h, 1000h, 1500h, 2000h, etc.)
6. Omita campos com valor vazio ou null para manter o JSON COMPACTO`
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  bar('TESTE EXTRAÇÃO PFD — Gemini 1.5 Flash')

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

  // ── PASSO 1: Encontrar PDF ─────────────────────────────────────────────────
  bar('PASSO 1 — Buscando PDF de teste no Supabase')

  const { data: pubs, error: pubErr } = await sb
    .from('pfd_publicacoes')
    .select('id, titulo, modelo, fabricante, url_pdf, status')
    .order('created_at', { ascending: false })
    .limit(10)

  if (pubErr) { er('Erro Supabase: ' + pubErr.message); process.exit(1) }
  if (!pubs.length) { er('Nenhuma publicação encontrada'); process.exit(1) }

  console.log(`  Publicações (${pubs.length}):`)
  pubs.forEach((p, i) => {
    const hasUrl = p.url_pdf ? '✓ url' : '— sem url'
    console.log(`  ${i + 1}. [${p.id.slice(0, 8)}] ${p.fabricante} ${p.modelo} | ${hasUrl} | ${p.status}`)
  })

  const pub = pubs.find(p => p.url_pdf) || pubs[0]
  ok(`Usando: ${pub.fabricante} ${pub.modelo} (id: ${pub.id.slice(0, 8)})`)

  // ── PASSO 2: Baixar PDF ───────────────────────────────────────────────────
  bar('PASSO 2 — Download do PDF')

  let pdfBuffer
  if (pub.url_pdf) {
    ok(`URL: ${pub.url_pdf.slice(0, 80)}`)
    const res = await fetch(pub.url_pdf, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) { er(`HTTP ${res.status} ao baixar PDF`); process.exit(1) }
    pdfBuffer = Buffer.from(await res.arrayBuffer())
  } else {
    ok('Sem URL — buscando no Supabase Storage...')
    // Listar arquivos recursivamente
    const allFiles = []
    const { data: root } = await sb.storage.from('pfd-manuais').list('', { limit: 100 })
    if (root) {
      for (const item of root) {
        if (!item.id) { // pasta
          const { data: sub } = await sb.storage.from('pfd-manuais').list(item.name, { limit: 100 })
          if (sub) sub.forEach(f => allFiles.push(`${item.name}/${f.name}`))
        } else {
          allFiles.push(item.name)
        }
      }
    }
    const pdfPath = allFiles.find(f => /\.pdf$/i.test(f))
    if (!pdfPath) { er(`Nenhum PDF no storage. Arquivos: ${allFiles.slice(0, 10).join(', ')}`); process.exit(1) }
    ok(`Storage path: ${pdfPath}`)
    const { data: blob, error: dlErr } = await sb.storage.from('pfd-manuais').download(pdfPath)
    if (dlErr) { er('Download falhou: ' + dlErr.message); process.exit(1) }
    pdfBuffer = Buffer.from(await blob.arrayBuffer())
  }

  const mbSize = (pdfBuffer.length / 1024 / 1024).toFixed(2)
  ok(`PDF: ${mbSize} MB (${pdfBuffer.length.toLocaleString()} bytes)`)

  // PDFs grandes: usaremos File API (tratado no passo 4)

  // ── PASSO 3: Metadados + páginas via pdf-parse ────────────────────────────
  bar('PASSO 3 — Metadados via pdf-parse')

  let totalPaginas = 0
  let paginasComTexto = 0
  let paginasManutencao = []

  const PALAVRAS_CHAVE = ['serviço periódico', 'manutenção periódica', 'intervalos de manutenção',
    'lubrificação', 'periodic service', 'maintenance schedule',
    '10h', '50h', '100h', '250h', '500h', '750h', '1000h', '1500h', '2000h',
    '10 h', '50 h', '100 h', '250 h', '500 h', '750 h', '1000 h',
    'amaciamento', 'troca de óleo', 'filtro de óleo', 'fluido hidráulico']

  try {
    let pg = 0
    await pdfParse(pdfBuffer, {
      pagerender: async (pageData) => {
        pg++
        const tc = await pageData.getTextContent()
        const txt = tc.items.map(i => i.str || '').join(' ').replace(/\s+/g, ' ').trim()
        if (txt.length > 20) paginasComTexto++
        const lower = txt.toLowerCase()
        const hits = PALAVRAS_CHAVE.filter(kw => lower.includes(kw)).length
        if (hits >= 2) paginasManutencao.push({ pg, hits, chars: txt.length, preview: txt.slice(0, 80) })
        return txt
      }
    })
    totalPaginas = pg

    ok(`Total de páginas: ${totalPaginas}`)
    ok(`Páginas com texto: ${paginasComTexto}`)
    ok(`Páginas candidatas (manutenção): ${paginasManutencao.length}`)
    if (paginasManutencao.length > 0) {
      paginasManutencao.sort((a, b) => b.hits - a.hits)
      console.log('\n  Top páginas candidatas:')
      paginasManutencao.slice(0, 8).forEach(p => {
        console.log(`    Pág ${String(p.pg).padStart(3)} | score=${p.hits} | ${p.preview}`)
      })
    }
  } catch (e) {
    wrn(`pdf-parse falhou: ${e.message} (continuando sem metadados)`)
  }

  // ── PASSO 4: Gemini ───────────────────────────────────────────────────────
  bar('PASSO 4 — Extração Gemini 1.5 Flash')

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 8192,
      temperature: 0,
    },
  })

  const prompt = buildPrompt(pub.fabricante || 'John Deere', pub.modelo || '')

  // Seleciona modo de envio do PDF
  let pdfPart
  if (pdfBuffer.length <= INLINE_LIMIT) {
    ok('Modo: inline data')
    pdfPart = { inlineData: { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') } }
  } else {
    wrn(`PDF ${mbSize} MB > 18 MB — usando Gemini File API`)
    const fileManager = new GoogleAIFileManager(GEMINI_API_KEY)
    const tmpPath = path.join(os.tmpdir(), `pfd_test_${Date.now()}.pdf`)
    fs.writeFileSync(tmpPath, pdfBuffer)
    ok(`Arquivo temporário: ${tmpPath}`)
    ok('Enviando ao Gemini File API...')
    const upload = await fileManager.uploadFile(tmpPath, { mimeType: 'application/pdf', displayName: `${pub.fabricante}_${pub.modelo}.pdf` })
    fs.unlinkSync(tmpPath)
    ok(`File URI: ${upload.file.uri}`)
    ok(`State: ${upload.file.state}`)
    // Aguarda processamento se necessário
    let file = upload.file
    let retries = 0
    while (file.state === 'PROCESSING' && retries < 10) {
      await new Promise(r => setTimeout(r, 3000))
      file = await fileManager.getFile(file.name)
      retries++
      ok(`Aguardando File API... state=${file.state} (${retries}/10)`)
    }
    if (file.state !== 'ACTIVE') {
      er(`File API state inesperado: ${file.state}`); process.exit(1)
    }
    pdfPart = { fileData: { mimeType: 'application/pdf', fileUri: file.uri } }
  }

  ok('Enviando PDF + prompt ao Gemini...')
  const t0 = Date.now()
  let geminiResult
  try {
    geminiResult = await model.generateContent([pdfPart, { text: prompt }])
  } catch (e) {
    er(`Gemini lançou exceção: ${e.message}`)
    if (e.message?.includes('RESOURCE_EXHAUSTED')) wrn('Quota Gemini atingida')
    process.exit(1)
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  const usage = geminiResult.response.usageMetadata
  const rawText = geminiResult.response.text()

  ok(`Tempo de resposta: ${elapsed}s`)
  ok(`Tokens — entrada: ${usage?.promptTokenCount ?? '?'}, saída: ${usage?.candidatesTokenCount ?? '?'}`)
  ok(`Resposta: ${rawText.length} chars`)

  if ((usage?.candidatesTokenCount ?? 0) >= 8000) {
    wrn(`⚠️ RESPOSTA PRÓXIMA DO LIMITE (${usage.candidatesTokenCount}/8192) — possível truncamento!`)
  }

  // ── PASSO 5: Parse JSON ───────────────────────────────────────────────────
  bar('PASSO 5 — Parse e Validação do JSON')

  let parsed
  try {
    parsed = JSON.parse(rawText)
    ok('JSON válido')
  } catch (e) {
    er(`JSON INVÁLIDO: ${e.message}`)
    er(`Primeiros 500 chars: ${rawText.slice(0, 500)}`)
    er(`Últimos  200 chars:  ${rawText.slice(-200)}`)
    fs.writeFileSync('tests/output-raw.txt', rawText, 'utf8')
    er('Raw salvo em tests/output-raw.txt')
    process.exit(1)
  }

  // ── PASSO 6: Análise ──────────────────────────────────────────────────────
  bar('PASSO 6 — Análise dos Dados Extraídos')

  const tarefas = parsed.tv || []
  ok(`Equipamento: ${parsed.eq?.marca} ${parsed.eq?.modelo}`)
  ok(`Total de tarefas: ${tarefas.length}`)

  // Agrupar por intervalo
  const porH = {}
  for (const t of tarefas) {
    const k = t.h != null ? String(t.h) : '?'
    if (!porH[k]) porH[k] = { titulo: t.it || `${t.h}h`, tarefas: [] }
    porH[k].tarefas.push(t)
  }

  const hOrdenados = Object.keys(porH).sort((a, b) => Number(a) - Number(b))
  ok(`Intervalos distintos: ${hOrdenados.length}`)
  console.log()
  console.log('  Horas │ Tarefas │ Título')
  console.log('  ' + '─'.repeat(55))
  for (const h of hOrdenados) {
    const iv = porH[h]
    console.log(`  ${String(h).padStart(5)}h │ ${String(iv.tarefas.length).padStart(7)} │ ${iv.titulo.slice(0, 45)}`)
  }

  // ── PASSO 7: Verificar campos obrigatórios ────────────────────────────────
  bar('PASSO 7 — Verificação de Campos por Tarefa')

  const CAMPOS_OBR = ['h', 'it', 's', 'a', 'tp']
  let comProblema = 0
  const exemplosProblema = []
  for (const t of tarefas) {
    const faltando = CAMPOS_OBR.filter(c => t[c] == null || t[c] === '')
    if (faltando.length > 0) {
      comProblema++
      if (exemplosProblema.length < 3) exemplosProblema.push({ faltando, tarefa: t })
    }
  }
  if (comProblema === 0) ok('Todos os campos obrigatórios (h, it, s, a, tp) presentes em 100% das tarefas')
  else {
    er(`${comProblema} tarefas com campos faltando:`)
    exemplosProblema.forEach(x => er(`  faltando [${x.faltando.join(', ')}]: ${JSON.stringify(x.tarefa).slice(0, 120)}`))
  }

  // Campos preenchidos (estatística)
  const TODOS_CAMPOS = ['h', 'it', 's', 'cmp', 'a', 'tp', 'ins', 'qty', 'pg', 'raw', 'cf']
  const stats = {}
  for (const c of TODOS_CAMPOS) {
    stats[c] = tarefas.filter(t => t[c] != null && t[c] !== '').length
  }
  console.log('\n  Preenchimento por campo:')
  for (const [c, n] of Object.entries(stats)) {
    const pct = tarefas.length > 0 ? Math.round(100 * n / tarefas.length) : 0
    const bar_ = '█'.repeat(Math.round(pct / 5)).padEnd(20)
    const mapa = { h:'intervalo_horas', it:'intervalo_texto', s:'sistema', cmp:'componente', a:'atividade', tp:'tipo_atividade', ins:'insumo_ou_peca', qty:'quantidade', pg:'pagina_fonte', raw:'texto_original', cf:'confianca' }
    console.log(`  ${c.padEnd(4)} (${mapa[c] || c}): ${String(n).padStart(3)}/${tarefas.length} ${pct.toString().padStart(3)}% ${bar_}`)
  }

  // ── PASSO 8: Exemplo ─────────────────────────────────────────────────────
  bar('PASSO 8 — Exemplo de Tarefa')
  if (tarefas.length > 0) {
    const sample = tarefas[Math.min(5, tarefas.length - 1)]
    console.log(JSON.stringify(sample, null, 2))
  }

  // ── PASSO 9: Salvar resultado ─────────────────────────────────────────────
  bar('PASSO 9 — Salvando Resultado')

  // Converter para schema completo (para uso na API)
  const intervalosFormatados = hOrdenados.map(h => ({
    intervalo_horas: Number(h),
    titulo_intervalo: porH[h].titulo,
    periodicidade: (Number(h) === 0 || Number(h) === 600) ? 'uma_vez' : 'recorrente',
    tarefas: porH[h].tarefas.map(t => ({
      sistema:             t.s   || '',
      componente:          t.cmp || '',
      atividade:           t.a   || '',
      descricao_tarefa:    t.a   || '',
      tipo_atividade:      t.tp  || 'outro',
      tipo:                t.tp  || 'outro',
      insumo_ou_peca:      t.ins || '',
      lubrificante_fluido: t.ins || '',
      quantidade:          t.qty || '',
      capacidade:          t.qty || '',
      pagina_fonte:        t.pg  ?? null,
      texto_original:      t.raw || '',
      confianca:           t.cf  || 'alta',
    })),
    status_extracao: porH[h].tarefas.length > 0 ? 'ok' : 'falha_extracao',
  }))

  const output = {
    meta: {
      publicacao_id: pub.id,
      fabricante: pub.fabricante,
      modelo: pub.modelo,
      pdf_mb: parseFloat(mbSize),
      total_paginas: totalPaginas,
      paginas_com_texto: paginasComTexto,
      paginas_candidatas: paginasManutencao.length,
      gemini_tokens_in: usage?.promptTokenCount,
      gemini_tokens_out: usage?.candidatesTokenCount,
      tempo_s: parseFloat(elapsed),
    },
    equipamento: parsed.eq,
    total_intervalos: hOrdenados.length,
    total_tarefas: tarefas.length,
    por_intervalo: Object.fromEntries(hOrdenados.map(h => [
      `${h}h`, { titulo: porH[h].titulo, n: porH[h].tarefas.length }
    ])),
    sample_tarefas_flat: tarefas.slice(0, 5),
    intervalos_schema_completo: intervalosFormatados,
  }

  fs.mkdirSync('tests', { recursive: true })
  fs.writeFileSync('tests/output-pfd.json', JSON.stringify(output, null, 2), 'utf8')
  ok('Resultado salvo em tests/output-pfd.json')

  // ── SUMÁRIO FINAL ─────────────────────────────────────────────────────────
  bar('SUMÁRIO FINAL')
  console.log(`  Arquivo PDF usado:        ${pub.fabricante} ${pub.modelo}`)
  console.log(`  Tamanho do PDF:           ${mbSize} MB`)
  console.log(`  Total de páginas:         ${totalPaginas}`)
  console.log(`  Páginas com texto:        ${paginasComTexto}`)
  console.log(`  Páginas candidatas:       ${paginasManutencao.length}`)
  console.log(`  Intervalos extraídos:     ${hOrdenados.length}`)
  console.log(`  Tarefas extraídas:        ${tarefas.length}`)
  console.log(`  Tokens Gemini (saída):    ${usage?.candidatesTokenCount ?? '?'} / 8192`)
  console.log(`  Tarefas com problema:     ${comProblema}`)
  console.log()

  if (tarefas.length === 0) {
    er('NENHUMA TAREFA EXTRAÍDA — verificar logs acima')
  } else if (comProblema > 0) {
    wrn(`${comProblema} tarefas com campos obrigatórios faltando`)
  } else {
    ok('Extração concluída sem erros')
  }

  // Aviso de truncamento
  if ((usage?.candidatesTokenCount ?? 0) >= 7800) {
    wrn('ATENÇÃO: Tokens de saída próximos do limite!')
    wrn('Considere implementar extração em 2 chamadas (dividir intervalos).')
  }
}

main().catch(e => {
  console.error('\n  ERRO CRÍTICO:', e.message)
  console.error(e.stack)
  process.exit(1)
})
