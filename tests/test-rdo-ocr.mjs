/**
 * tests/test-rdo-ocr.mjs
 * Testa o fluxo OCR do RDO Birigui com a imagem mais recente do Supabase Storage
 *
 * Uso:
 *   node tests/test-rdo-ocr.mjs                   ← usa o boletim mais recente de Birigui
 *   node tests/test-rdo-ocr.mjs --url <url>        ← força URL de imagem específica
 *   node tests/test-rdo-ocr.mjs --reprocessar      ← re-processa o boletim mais recente via API
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// ── .env manual ──────────────────────────────────────────────────────────────
try {
  const envPath = new URL('../.env', import.meta.url).pathname
    .replace(/^\/([A-Z]:)/, '$1')
    .replace(/%20/g, ' ')
  const env = fs.readFileSync(envPath, 'utf8')
  for (const line of env.split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0 && !line.startsWith('#')) {
      const k = line.slice(0, i).trim(), v = line.slice(i + 1).trim()
      if (k && !process.env[k]) process.env[k] = v
    }
  }
} catch (_) {}

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
const GROQ_API_KEY  = process.env.GROQ_API_KEY || ''
const APP_URL       = process.env.APP_URL || process.env.VITE_APP_URL || 'https://smartpro.app.br'
const WORKSPACE_ID  = 'd0261b4e-450a-47ce-a751-2ba9a12fe7d5'   // Birigui (workspace real dos boletins)
const TEMPLATE_ID   = '0878e821-8544-4c9a-a81e-7fd80a24a80f'   // RDO Birigui

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env'); process.exit(1) }
if (!GROQ_API_KEY)                  { console.error('❌ Defina GROQ_API_KEY no .env');  process.exit(1) }

const sb   = createClient(SUPABASE_URL, SUPABASE_KEY)
const args = process.argv.slice(2)
const forceUrl         = args.includes('--url')         ? args[args.indexOf('--url') + 1]         : null
const reprocessar      = args.includes('--reprocessar')
const forceBoletimId   = args.includes('--id')          ? args[args.indexOf('--id') + 1]          : null

const bar = s => console.log(`\n${'═'.repeat(64)}\n  ${s}\n${'═'.repeat(64)}`)
const ok  = s => console.log(`  ✅  ${s}`)
const wrn = s => console.log(`  ⚠️   ${s}`)
const err = s => console.log(`  ❌  ${s}`)
const fld = (k, v) => console.log(`  ${(k + ':').padEnd(30)} ${v == null ? '\x1b[90m(null)\x1b[0m' : `\x1b[36m${String(v)}\x1b[0m`}`)

// ─── 1. Carrega template RDO ─────────────────────────────────────────────────
bar('1 — Template RDO Birigui')
// Busca template RDO no workspace correto (d0261b4e) — cai para 71eee268 se não encontrar
const { data: tmpl, error: tmplErr } = await sb
  .from('form_templates')
  .select('id, nome, tipo_base, campos')
  .eq('tipo_base', 'rdo')
  .in('workspace_id', ['d0261b4e-450a-47ce-a751-2ba9a12fe7d5', '71eee268-082e-49d9-a613-9387595ea6d5'])
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

if (tmplErr || !tmpl) { err('Template não encontrado: ' + (tmplErr?.message || 'null')); process.exit(1) }
ok(`Template: "${tmpl.nome}"  tipo=${tmpl.tipo_base}  campos=${tmpl.campos?.length}`)

const camposComTabela = (tmpl.campos || []).filter(c => c.show_in_table !== false)
console.log(`\n  Colunas visíveis na tabela Lançamentos (show_in_table=true):`)
camposComTabela.forEach(c => console.log(`    ▸ ${c.key.padEnd(28)} ${c.label}`))

// ─── 2. Pega boletim mais recente de Birigui ─────────────────────────────────
bar('2 — Boletim mais recente (Birigui)')
const query = sb
  .from('maquinas_boletins')
  .select('id, numero, status, imagem_url, ocr_raw, created_at, lancamento_id, workspace_id, boletim_tipo_id')
  .order('created_at', { ascending: false })
  .limit(5)

if (forceBoletimId) query.eq('id', forceBoletimId)

const { data: bols } = await query
// Prefere Birigui, mas usa o mais recente se não encontrar
const bol = bols?.find(b => b.workspace_id === WORKSPACE_ID) || bols?.[0]

if (!bol) { wrn('Nenhum boletim encontrado para workspace Birigui.'); process.exit(0) }
ok(`Boletim: ${bol.numero}  status=${bol.status}  id=${bol.id}`)
console.log(`  imagem_url: ${bol.imagem_url || '(vazio)'}`)
console.log(`  lancamento_id: ${bol.lancamento_id || '(vazio)'}`)

// ─── 3. Se --reprocessar, chama API e encerra ────────────────────────────────
if (reprocessar) {
  bar('3 — Reprocessar via API /api/ocr-boletim-maquina')
  const apiUrl = `${APP_URL}/api/ocr-boletim-maquina`
  console.log(`  POST ${apiUrl}  boletimId=${bol.id}`)
  try {
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boletimId: bol.id }),
    })
    const body = await r.text()
    ok(`HTTP ${r.status}: ${body.slice(0, 200)}`)
  } catch (e) {
    err(`Erro: ${e.message}`)
  }
  process.exit(0)
}

// ─── 4. Baixa imagem e chama OCR diretamente ─────────────────────────────────
bar('4 — OCR direto (simulação da rota api/ocr-boletim-maquina)')

const imagemUrl = forceUrl || bol.imagem_url
if (!imagemUrl || imagemUrl === 'pending') { wrn('Sem imagem para processar.'); process.exit(0) }

console.log(`  Baixando imagem: ${imagemUrl.slice(0, 80)}...`)
let imageBase64 = ''
try {
  const resp = await fetch(imagemUrl)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const buf = await resp.arrayBuffer()
  imageBase64 = Buffer.from(buf).toString('base64')
  ok(`Imagem baixada: ${Math.round(buf.byteLength / 1024)} KB`)
} catch (e) {
  err(`Erro ao baixar imagem: ${e.message}`)
  process.exit(1)
}

// Importa runOCR diretamente
process.env.GROQ_API_KEY = GROQ_API_KEY
const { runOCR } = await import('../api/_ocr.js')

console.log(`\n  Chamando runOCR com template "${tmpl.nome}"...`)
let ocrResult
try {
  ocrResult = await runOCR(imageBase64, { template: tmpl })
  ok(`OCR concluído. Campos extraídos: ${Object.keys(ocrResult).length}`)
} catch (e) {
  err(`Erro no OCR: ${e.message}`)
  process.exit(1)
}

// ─── 5. Exibe campos esperados vs extraídos ──────────────────────────────────
bar('5 — Resultado OCR — campos do formulário')

// Campos esperados da imagem RDO 2618 (valores de referência)
const ESPERADOS = {
  numero_rdo:          '2618',
  data:                '2026-05-28',
  empresa:             'SUZANO',
  cidade_estado:       'Imperatriz / MA',
  solicitante:         'Bruno Freitas',
  fone:                '(99) 99115-3248',
  veiculo_placa:       'QAY9H47',
  equipamento:         'HJ-22',
  equipe_diurna:       'Carlos Eduardo (Líder), João Paulo, Matheus Silva, Davi Santos, Wesley Ferreira',
  equipe_noturna:      'Rafael Nascimento (Líder), Edson Lima, Guilherme Rocha, Diego Monteiro, Lucas Gabriel',
  acessorios:          'Mangueira 1" – 50m, Bico Rotativo, Bico Turbo 15°, Lança 1,5m, EPI completo',
  locais_servico:      'Linha de Fibras-1',
  jornada_inicio:      '03:00',
  jornada_fim:         '18:00',
  jornada_total_horas: '15',
  // Calculados pelo sistema — 28/05/2026 = QUARTA-FEIRA → dia útil
  horas_diurnas:       '15',   // 03:00–18:00 = 15h mas diurno só 07–22 → 07:00–18:00 = 11h diurno
  horas_noturnas:      '4',    // 03:00–07:00 = 4h noturno
  h_fds_diurnas:       '0',
  h_fds_noturnas:      '0',
  h_feriado_diurnas:   '0',
  h_feriado_noturnas:  '0',
}

// NOTA: 28/05/2026 às 03:00–18:00 em dia útil:
//   - Noturno (22h anterior → 07h): 03:00–07:00 = 4h noturnas
//   - Diurno (07h–22h): 07:00–18:00 = 11h diurnas
//   - Total = 15h ✓

let acertos = 0, erros = 0, nulls = 0
console.log(`\n  ${'Campo'.padEnd(30)} ${'Extraído'.padEnd(40)} Esperado`)
console.log(`  ${'-'.repeat(100)}`)

for (const [k, esperado] of Object.entries(ESPERADOS)) {
  const extraido = ocrResult[k]
  const eNull = extraido == null || extraido === ''
  if (eNull) {
    nulls++
    console.log(`  ${k.padEnd(30)} \x1b[90m(null/vazio)\x1b[0m${' '.repeat(Math.max(0, 40 - 12))} \x1b[33m${esperado}\x1b[0m`)
  } else {
    const match = String(extraido).toLowerCase().includes(String(esperado).toLowerCase())
      || String(esperado).toLowerCase().includes(String(extraido).toLowerCase())
    if (match) {
      acertos++
      console.log(`  ${k.padEnd(30)} \x1b[32m${String(extraido).slice(0,38).padEnd(40)}\x1b[0m ✓`)
    } else {
      erros++
      console.log(`  ${k.padEnd(30)} \x1b[31m${String(extraido).slice(0,38).padEnd(40)}\x1b[0m ≠ \x1b[33m${esperado}\x1b[0m`)
    }
  }
}

console.log(`\n  ─── Score: ✅ ${acertos} ok  ⚠️ ${nulls} null  ❌ ${erros} erros ───`)

// ─── 6. Diagnóstico de colunas visíveis na tabela ────────────────────────────
bar('6 — Diagnóstico: colunas visíveis na tabela Lançamentos')
console.log(`  O campo em dados_extras é lido como: dados_extras[chave]`)
console.log(`  BUG se salvo como: dados_extras.ocr[chave] ← campos ficam null na tabela\n`)

const dadosExtrasBug  = { boletim_id: bol.id, ocr: ocrResult }
const dadosExtrasFix  = { boletim_id: bol.id, ocr: ocrResult, ...ocrResult }

for (const c of camposComTabela.slice(0, 10)) {
  const vBug = dadosExtrasBug[c.key]
  const vFix = dadosExtrasFix[c.key]
  const bugStr = vBug == null ? '\x1b[31m(null — BUG)\x1b[0m' : `\x1b[32m${String(vBug).slice(0,25)}\x1b[0m`
  const fixStr = vFix == null ? '\x1b[90m(null)\x1b[0m'       : `\x1b[32m${String(vFix).slice(0,25)}\x1b[0m`
  console.log(`  ${c.key.padEnd(28)}  bug: ${bugStr.padEnd(40)}  fix: ${fixStr}`)
}

// ─── 7. Dump completo do resultado OCR ───────────────────────────────────────
bar('7 — JSON completo retornado pelo OCR')
console.log(JSON.stringify(ocrResult, null, 2))

console.log('\n')
