/**
 * tests/test-pfd-gemini.mjs
 * Teste de integração do motor PFD — usa os módulos reais de api/_pfd/
 *
 * Uso: node tests/test-pfd-gemini.mjs
 *        node tests/test-pfd-gemini.mjs --pub <id-uuid>        força uma publicação específica
 *        node tests/test-pfd-gemini.mjs --url <url-pdf>        força URL de PDF avulso
 *        node tests/test-pfd-gemini.mjs --storage <path>       força path no Storage
 *
 * O script:
 *  1. Busca publicações no Supabase (ou usa --pub)
 *  2. Baixa o PDF (URL ou Storage)
 *  3. Roda o motor real (api/_pfd/gemini.js → validation.js)
 *  4. Exibe o resultado no contrato novo completo
 *  5. Salva tests/output-pfd.json e tests/output-pfd-raw.json
 */

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Importa os módulos reais do motor
import { extrairComGemini } from '../api/_pfd/gemini.js'
import { validarExtracao } from '../api/_pfd/validation.js'

// ─── Config ──────────────────────────────────────────────────────────────────
// Lê .env diretamente (sem dotenv)
try {
  const envContent = fs.readFileSync(fileURLToPath(new URL('../.env', import.meta.url)), 'utf8')
  for (const line of envContent.split(/\r?\n/)) {
    const eqIdx = line.indexOf('=')
    if (eqIdx > 0 && !line.startsWith('#')) {
      const key = line.slice(0, eqIdx).trim()
      const val = line.slice(eqIdx + 1).trim()
      if (key && !process.env[key]) process.env[key] = val
    }
  }
} catch (_) {}

const SUPABASE_URL   = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Defina SUPABASE_URL/SUPABASE_SERVICE_KEY no .env'); process.exit(1) }
if (!GEMINI_API_KEY) { console.error('Defina GEMINI_API_KEY no .env'); process.exit(1) }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const bar = (s) => console.log(`\n${'═'.repeat(60)}\n  ${s}\n${'═'.repeat(60)}`)
const ok  = (s) => console.log(`  ✓ ${s}`)
const wrn = (s) => console.log(`  ⚠ ${s}`)
const er  = (s) => console.log(`  ✗ ${s}`)

// ─── Args CLI ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const argPubId      = args[args.indexOf('--pub') + 1]      || null
const argUrl        = args[args.indexOf('--url') + 1]      || null
const argStoragePath = args[args.indexOf('--storage') + 1] || null

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  bar(`TESTE INTEGRAÇÃO PFD — ${GEMINI_MODEL}`)
  console.log('  (usa os módulos reais de api/_pfd/)')

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

  // ── PASSO 1: Encontrar publicação ─────────────────────────────────────────
  bar('PASSO 1 — Publicação de teste')

  let pub
  if (argPubId) {
    const { data, error } = await sb
      .from('pfd_publicacoes')
      .select('id, titulo, modelo, fabricante, url_pdf, status, workspace_id')
      .eq('id', argPubId)
      .single()
    if (error) { er('Publicação não encontrada: ' + error.message); process.exit(1) }
    pub = data
  } else {
    const { data: pubs, error: pubErr } = await sb
      .from('pfd_publicacoes')
      .select('id, titulo, modelo, fabricante, url_pdf, status, workspace_id')
      .order('created_at', { ascending: false })
      .limit(10)
    if (pubErr) { er('Erro Supabase: ' + pubErr.message); process.exit(1) }
    if (!pubs.length) { er('Nenhuma publicação encontrada'); process.exit(1) }
    console.log(`  Publicações disponíveis (${pubs.length}):`)
    pubs.forEach((p, i) => {
      const hasUrl = p.url_pdf ? '✓ url' : '— sem url'
      console.log(`  ${i + 1}. [${p.id.slice(0, 8)}] ${p.fabricante} ${p.modelo} | ${hasUrl} | ${p.status}`)
    })
    pub = pubs.find(p => p.url_pdf) || pubs[0]
  }
  ok(`Usando: ${pub.fabricante} ${pub.modelo} (id: ${pub.id.slice(0, 8)})`)
  ok(`Workspace: ${pub.workspace_id || '(sem workspace_id)'}`)

  // ── PASSO 2: Baixar PDF ───────────────────────────────────────────────────
  bar('PASSO 2 — Download do PDF')

  let pdfBuffer
  if (argUrl) {
    ok(`Usando --url: ${argUrl.slice(0, 80)}`)
    const res = await fetch(argUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) { er(`HTTP ${res.status}`); process.exit(1) }
    pdfBuffer = Buffer.from(await res.arrayBuffer())
  } else if (argStoragePath) {
    ok(`Usando --storage: ${argStoragePath}`)
    const { data: blob, error: dlErr } = await sb.storage.from('pfd-manuais').download(argStoragePath)
    if (dlErr) { er('Download falhou: ' + dlErr.message); process.exit(1) }
    pdfBuffer = Buffer.from(await blob.arrayBuffer())
  } else if (pub.url_pdf) {
    ok(`URL: ${pub.url_pdf.slice(0, 80)}`)
    const res = await fetch(pub.url_pdf, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) { er(`HTTP ${res.status} ao baixar PDF`); process.exit(1) }
    pdfBuffer = Buffer.from(await res.arrayBuffer())
  } else {
    ok('Sem URL — buscando no Supabase Storage...')
    const allFiles = []
    const { data: root } = await sb.storage.from('pfd-manuais').list('', { limit: 100 })
    if (root) {
      for (const item of root) {
        if (!item.id) {
          const { data: sub } = await sb.storage.from('pfd-manuais').list(item.name, { limit: 100 })
          if (sub) sub.forEach(f => f.name.endsWith('.pdf') && allFiles.push(`${item.name}/${f.name}`))
        } else if (item.name.endsWith('.pdf')) {
          allFiles.push(item.name)
        }
      }
    }
    console.log(`  PDFs no storage: ${allFiles.join(', ') || '(nenhum)'}`)
    const pdfPath = allFiles[0]
    if (!pdfPath) { er('Nenhum PDF no storage'); process.exit(1) }
    ok(`Storage path: ${pdfPath}`)
    const { data: blob, error: dlErr } = await sb.storage.from('pfd-manuais').download(pdfPath)
    if (dlErr) { er('Download falhou: ' + dlErr.message); process.exit(1) }
    pdfBuffer = Buffer.from(await blob.arrayBuffer())
  }

  const mbSize = (pdfBuffer.length / 1024 / 1024).toFixed(2)
  ok(`PDF: ${mbSize} MB (${pdfBuffer.length.toLocaleString()} bytes)`)

  // ── PASSO 3: Motor Gemini real (api/_pfd/gemini.js) ───────────────────────
  bar(`PASSO 3 — Extração via motor real (${GEMINI_MODEL})`)

  const logs = []
  const L = (msg) => { logs.push(msg); console.log(`  [LOG] ${msg}`) }

  const t0 = Date.now()
  let resultado, meta
  try {
    const r = await extrairComGemini({
      pdfBuffer,
      modelo:      pub.modelo    || '',
      fabricante:  pub.fabricante || '',
      geminiApiKey: GEMINI_API_KEY,
      geminiModel:  GEMINI_MODEL,
      L,
    })
    resultado = r.resultado
    meta      = r.meta
  } catch (e) {
    er(`Motor lançou exceção: ${e.message}`)
    er(e.stack)
    process.exit(1)
  }
  const tempoMs = Date.now() - t0
  ok(`Tempo total: ${(tempoMs / 1000).toFixed(1)}s`)
  ok(`Provider: ${meta.provider}  |  Modelo AI: ${meta.modelo_ai}  |  Modo PDF: ${meta.modo_pdf}`)

  // ── PASSO 4: Validação (api/_pfd/validation.js) ───────────────────────────
  bar('PASSO 4 — Validação')

  const validacao = validarExtracao(resultado)
  ok(`Status geral: ${validacao.statusGeral}`)
  ok(`Intervalos: ${validacao.totalIntervalos} total | ${validacao.intervalosOk} ok | ${validacao.intervalosFalha} falha | ${validacao.intervalosNaoEncontrados} não encontrados | ${validacao.intervalosCondicionais} condicionais`)
  ok(`Tarefas: ${validacao.totalTarefas}`)
  ok(`Falha crítica: ${validacao.temFalhaCritica ? '⚠️ SIM' : 'não'}`)
  if (validacao.intervalosCriticosFalhando.length > 0) {
    wrn(`Intervalos críticos falhando: ${validacao.intervalosCriticosFalhando.join(', ')}h`)
  }
  if (validacao.alertas.length > 0) {
    console.log(`\n  Alertas (${validacao.alertas.length}):`)
    validacao.alertas.forEach(a => wrn(`  [${a.tipo}] ${a.mensagem}`))
  }

  // ── PASSO 5: Equipamento ─────────────────────────────────────────────────
  bar('PASSO 5 — Equipamento Extraído')
  const eq = resultado.equipamento || {}
  console.log(`  marca:          ${eq.marca || '(vazio)'}`)
  console.log(`  modelo:         ${eq.modelo || '(vazio)'}`)
  console.log(`  modelos_cobertos: ${(eq.modelos_cobertos || []).join(', ') || '(vazio)'}`)
  console.log(`  codigo_manual:  ${eq.codigo_manual || '(vazio)'}`)
  console.log(`  edicao:         ${eq.edicao || '(vazio)'}`)
  console.log(`  regiao:         ${eq.regiao || '(vazio)'}`)
  console.log(`  serie:          ${eq.serie || '(vazio)'}`)

  // ── PASSO 6: Tabela de intervalos ────────────────────────────────────────
  bar('PASSO 6 — Tabela de Intervalos')
  const intervalos = resultado.intervalos || []
  console.log(`\n  Horas │ Tarefas │ Status          │ Pág    │ Título`)
  console.log('  ' + '─'.repeat(75))
  for (const iv of intervalos) {
    const h  = String(iv.intervalo_horas ?? '?').padStart(5)
    const n  = String(iv.tarefas?.length ?? 0).padStart(7)
    const st = (iv.status_extracao || '').padEnd(16)
    const pg = iv.pagina_inicio != null
      ? `${iv.pagina_inicio}${iv.pagina_fim && iv.pagina_fim !== iv.pagina_inicio ? '-' + iv.pagina_fim : ''}`.padEnd(6)
      : '—     '
    const titulo = (iv.titulo_intervalo || '').slice(0, 38)
    console.log(`  ${h}h │ ${n} │ ${st} │ ${pg} │ ${titulo}`)
  }

  // ── PASSO 7: Campos por tarefa ───────────────────────────────────────────
  bar('PASSO 7 — Preenchimento de Campos das Tarefas')
  const todasTarefas = intervalos.flatMap(iv => iv.tarefas || [])
  const CAMPOS = ['sistema', 'componente', 'atividade', 'tipo_atividade', 'insumo_ou_peca', 'quantidade', 'pagina_fonte', 'texto_original', 'anotacao_preventiva', 'condicional']
  console.log()
  for (const campo of CAMPOS) {
    const n = todasTarefas.filter(t => {
      const v = t[campo]
      return v != null && v !== '' && v !== false
    }).length
    const pct = todasTarefas.length > 0 ? Math.round(100 * n / todasTarefas.length) : 0
    const barra = '█'.repeat(Math.round(pct / 5)).padEnd(20)
    console.log(`  ${campo.padEnd(22)} ${String(n).padStart(4)}/${todasTarefas.length} ${String(pct).padStart(3)}% ${barra}`)
  }

  // Tarefas sem atividade (campo crítico)
  const semAtividade = todasTarefas.filter(t => !t.atividade)
  if (semAtividade.length > 0) {
    wrn(`\n  ${semAtividade.length} tarefas sem campo 'atividade':`)
    semAtividade.slice(0, 3).forEach(t => wrn(`    ${JSON.stringify(t).slice(0, 120)}`))
  }

  // ── PASSO 8: Exemplos de tarefa ──────────────────────────────────────────
  bar('PASSO 8 — Exemplo de Tarefa')
  if (todasTarefas.length > 0) {
    const sample = todasTarefas[Math.min(5, todasTarefas.length - 1)]
    console.log(JSON.stringify(sample, null, 2))
  }

  // ── PASSO 9: Salvar resultado ─────────────────────────────────────────────
  bar('PASSO 9 — Salvando Resultado')

  const output = {
    meta: {
      publicacao_id:  pub.id,
      fabricante:     pub.fabricante,
      modelo:         pub.modelo,
      pdf_mb:         parseFloat(mbSize),
      gemini_model:   meta.modelo_ai,
      modo_pdf:       meta.modo_pdf,
      tempo_ms:       tempoMs,
    },
    validacao: {
      status_geral:                  validacao.statusGeral,
      total_intervalos:              validacao.totalIntervalos,
      total_tarefas:                 validacao.totalTarefas,
      intervalos_ok:                 validacao.intervalosOk,
      intervalos_falha:              validacao.intervalosFalha,
      intervalos_nao_encontrados:    validacao.intervalosNaoEncontrados,
      intervalos_condicionais:       validacao.intervalosCondicionais,
      tem_falha_critica:             validacao.temFalhaCritica,
      intervalos_criticos_falhando:  validacao.intervalosCriticosFalhando,
      alertas:                       validacao.alertas,
    },
    equipamento: resultado.equipamento,
    intervalos:  resultado.intervalos,
    logs,
  }

  fs.mkdirSync('tests', { recursive: true })
  fs.writeFileSync('tests/output-pfd.json', JSON.stringify(output, null, 2), 'utf8')
  ok('Resultado salvo em tests/output-pfd.json')

  // ── SUMÁRIO FINAL ─────────────────────────────────────────────────────────
  bar('SUMÁRIO FINAL')
  console.log(`  PDF:                      ${pub.fabricante} ${pub.modelo} — ${mbSize} MB`)
  console.log(`  Modelo AI:                ${meta.modelo_ai} (${meta.modo_pdf})`)
  console.log(`  Tempo:                    ${(tempoMs / 1000).toFixed(1)}s`)
  console.log(`  Status extração:          ${validacao.statusGeral}`)
  console.log(`  Intervalos:               ${validacao.intervalosOk} ok / ${validacao.intervalosFalha} falha / ${validacao.intervalosNaoEncontrados} não enc.`)
  console.log(`  Tarefas:                  ${validacao.totalTarefas}`)
  console.log(`  Falha crítica:            ${validacao.temFalhaCritica ? '⚠️ SIM' : 'não'}`)
  console.log()

  if (validacao.totalTarefas === 0) {
    er('NENHUMA TAREFA EXTRAÍDA — verificar logs acima')
    process.exitCode = 1
  } else if (validacao.temFalhaCritica) {
    er(`FALHA CRÍTICA — intervalos: ${validacao.intervalosCriticosFalhando.join(', ')}h`)
    process.exitCode = 1
  } else if (validacao.statusGeral === 'completo') {
    ok('Extração COMPLETA — todos os intervalos extraídos com sucesso')
  } else {
    wrn(`Extração PARCIAL — ${validacao.intervalosFalha} intervalos falharam`)
  }
}

main().catch(e => {
  console.error('\n  ERRO CRÍTICO:', e.message)
  console.error(e.stack)
  process.exit(1)
})
