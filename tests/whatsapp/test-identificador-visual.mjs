/**
 * tests/whatsapp/test-identificador-visual.mjs
 *
 * Testa o fluxo de identificação de boletim pelo identificador_visual:
 *  1. Busca tipos com identificador_visual cadastrado
 *  2. Pega uma imagem real de maquinas_boletins do workspace (ou usa URL fornecida)
 *  3. Extrai texto do cabeçalho via Groq
 *  4. Verifica se o matching funciona
 *
 * Uso:
 *   node tests/whatsapp/test-identificador-visual.mjs
 *   node tests/whatsapp/test-identificador-visual.mjs <imagem_url>
 */

import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import fs from 'fs'
import { fileURLToPath } from 'url'

// ── Carrega .env ──────────────────────────────────────────────────────────────
try {
  const envPath = fileURLToPath(new URL('../../.env', import.meta.url))
  const envContent = fs.readFileSync(envPath, 'utf8')
  for (const line of envContent.split(/\r?\n/)) {
    const eqIdx = line.indexOf('=')
    if (eqIdx > 0 && !line.startsWith('#')) {
      const key = line.slice(0, eqIdx).trim()
      const val = line.slice(eqIdx + 1).trim()
      if (key && !process.env[key]) process.env[key] = val
    }
  }
} catch (_) {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const GROQ_KEY     = process.env.GROQ_API_KEY || ''

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY não configurados'); process.exit(1) }
if (!GROQ_KEY)                       { console.error('GROQ_API_KEY não configurada'); process.exit(1) }

const sb   = createClient(SUPABASE_URL, SUPABASE_KEY)
const groq = new Groq({ apiKey: GROQ_KEY })

const bar = (s) => console.log(`\n${'═'.repeat(64)}\n  ${s}\n${'═'.repeat(64)}`)
const ok  = (s) => console.log(`  ✓ ${s}`)
const wrn = (s) => console.log(`  ⚠ ${s}`)
const er  = (s) => console.log(`  ✗ ${s}`)
const inf = (s) => console.log(`  · ${s}`)

// ── Lógica de matching (espelho de whatsapp.js) ───────────────────────────────
function casaIdentificador(headerText, tipos) {
  if (!tipos?.length || !headerText) return null
  const texto = headerText.toLowerCase()
  for (const tipo of tipos) {
    const id = (tipo.identificador_visual || '').toLowerCase().trim()
    if (id && texto.includes(id)) return tipo
  }
  return null
}

// ── Converte URL → base64 ─────────────────────────────────────────────────────
async function urlParaBase64(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha ao baixar imagem: ${res.status}`)
  const buf = await res.arrayBuffer()
  return Buffer.from(buf).toString('base64')
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  bar('TESTE — identificador_visual WhatsApp routing')

  // PASSO 1 — Tipos com identificador_visual
  bar('PASSO 1 — Tipos de boletim com identificador_visual cadastrado')
  const { data: tipos, error: tiposErr } = await sb
    .from('maquinas_boletim_tipos')
    .select('id, nome, workspace_id, modulo_destino, identificador_visual')
    .not('identificador_visual', 'is', null)
    .neq('identificador_visual', '')

  if (tiposErr) { er(tiposErr.message); process.exit(1) }
  if (!tipos?.length) {
    wrn('Nenhum tipo com identificador_visual cadastrado.')
    wrn('Configure via Cadastros → Máquinas → Tipos de Boletim antes de rodar este teste.')
    process.exit(0)
  }

  tipos.forEach(t => {
    ok(`[${t.id.slice(0, 8)}] ${t.nome}`)
    inf(`  identificador_visual: "${t.identificador_visual}"`)
    inf(`  modulo_destino: ${t.modulo_destino || '(padrão maquinas)'}`)
    inf(`  workspace_id: ${t.workspace_id}`)
  })

  // PASSO 2 — Imagem para testar
  bar('PASSO 2 — Obtendo imagem de boletim para teste')

  let imagemUrl = process.argv[2] || null

  if (!imagemUrl) {
    // Pega o boletim mais recente dos workspaces dos tipos cadastrados
    const wsIds = [...new Set(tipos.map(t => t.workspace_id))]
    const { data: boletins, error: bolErr } = await sb
      .from('maquinas_boletins')
      .select('id, imagem_url, wa_from, status, created_at')
      .in('workspace_id', wsIds)
      .not('imagem_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5)

    if (bolErr) { er(bolErr.message); process.exit(1) }

    if (!boletins?.length) {
      wrn('Nenhum maquinas_boletins encontrado. Passe a URL da imagem como argumento:')
      wrn('  node tests/whatsapp/test-identificador-visual.mjs <url_imagem>')
      process.exit(0)
    }

    console.log(`\n  Boletins recentes (${boletins.length}):`)
    boletins.forEach((b, i) =>
      console.log(`  ${i + 1}. [${b.id.slice(0, 8)}] ${b.status} | ${b.created_at?.slice(0, 19)} | ${b.wa_from}`)
    )

    // Usa o mais recente
    imagemUrl = boletins[0].imagem_url
    inf(`Usando: ${imagemUrl}`)
  } else {
    inf(`Usando URL fornecida: ${imagemUrl}`)
  }

  // PASSO 3 — Download + base64
  bar('PASSO 3 — Download e conversão para base64')
  let base64
  try {
    base64 = await urlParaBase64(imagemUrl)
    ok(`Imagem baixada (${Math.round(base64.length / 1024)} KB base64)`)
  } catch (e) {
    er(`Falha: ${e.message}`)
    process.exit(1)
  }

  // PASSO 4 — Extração de texto via Groq
  bar('PASSO 4 — Extração de texto do cabeçalho via Groq')
  let headerText = ''
  const t0 = Date.now()
  try {
    const groqRes = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          { type: 'text', text: 'Leia todo o texto visível no cabeçalho e título principal deste formulário. Retorne APENAS o texto encontrado, sem explicação, sem markdown.' },
        ],
      }],
      max_tokens: 200,
    })
    headerText = (groqRes.choices[0]?.message?.content || '').trim()
    ok(`Groq respondeu em ${Date.now() - t0}ms`)
    console.log(`\n  Texto extraído:\n  ─────────────────────────────────────────`)
    headerText.split('\n').forEach(l => console.log(`  ${l}`))
    console.log(`  ─────────────────────────────────────────`)
  } catch (e) {
    er(`Groq falhou: ${e.message}`)
    process.exit(1)
  }

  // PASSO 5 — Matching
  bar('PASSO 5 — Matching contra identificadores cadastrados')

  const match = casaIdentificador(headerText, tipos)

  if (match) {
    ok(`MATCH! Tipo encontrado: "${match.nome}"`)
    ok(`  identificador_visual: "${match.identificador_visual}"`)
    ok(`  workspace_id: ${match.workspace_id}`)
    ok(`  modulo_destino: ${match.modulo_destino || 'maquinas (padrão)'}`)
    console.log('\n  ✅ O roteamento funcionaria corretamente.')
  } else {
    er('NENHUM MATCH encontrado.')
    wrn('Texto extraído não contém nenhum dos identificadores cadastrados.')
    console.log('\n  Identificadores registrados:')
    tipos.forEach(t => console.log(`    - "${t.identificador_visual}" (${t.nome})`))
    console.log('\n  Dicas:')
    console.log('    · O identificador deve ser um substring do texto do cabeçalho')
    console.log('    · Verifique se a imagem contém o cabeçalho legível')
    console.log('    · Tente um identificador mais curto (ex: "BIRIGUI" em vez de "BIRIGUI SOLUÇÕES SUSTENTAVEIS LTDA")')
    process.exit(1)
  }

  bar('CONCLUÍDO')
}

main().catch(e => { er(e.message); process.exit(1) })
