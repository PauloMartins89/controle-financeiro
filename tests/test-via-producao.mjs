/**
 * tests/test-via-producao.mjs
 * Valida extração PFD chamando o endpoint de produção (Vercel)
 * que usa a GEMINI_API_KEY válida + File API para PDFs grandes.
 *
 * Uso: node tests/test-via-producao.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import fs from 'fs'

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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const API_URL      = process.env.VERCEL_URL || 'https://controle-financeiro.vercel.app/api/pfd-processar'

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Defina SUPABASE_URL/SUPABASE_SERVICE_KEY no .env'); process.exit(1) }

const bar = (s) => console.log(`\n${'═'.repeat(60)}\n  ${s}\n${'═'.repeat(60)}`)
const ok  = (s) => console.log(`  ✓ ${s}`)
const wrn = (s) => console.log(`  ⚠ ${s}`)
const er  = (s) => console.log(`  ✗ ${s}`)

async function main() {
  bar('TESTE VIA API PRODUÇÃO — controle-financeiro.vercel.app')

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

  // ── PASSO 1: Encontrar publicação com PDF no storage ──────────────────────
  bar('PASSO 1 — Buscando publicação John Deere 5078')

  const { data: pubs, error: pubErr } = await sb
    .from('pfd_publicacoes')
    .select('id, workspace_id, fabricante, modelo, status')
    .order('created_at', { ascending: false })
    .limit(10)

  if (pubErr) { er(pubErr.message); process.exit(1) }
  console.log(`  Publicações (${pubs.length}):`)
  pubs.forEach((p, i) => {
    console.log(`  ${i + 1}. [${p.id.slice(0, 8)}] ${p.fabricante} ${p.modelo} | ${p.status}`)
  })

  // Usa a publicação John Deere 5078 conhecida
  const pub = pubs.find(p => p.modelo === '5078' && p.workspace_id) || pubs[0]
  ok(`Usando: ${pub.fabricante} ${pub.modelo} (id: ${pub.id})`)
  ok(`workspace_id: ${pub.workspace_id}`)

  // ── PASSO 2: Encontrar o PDF no storage ───────────────────────────────────
  bar('PASSO 2 — Localizando PDF no Supabase Storage')

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

  const pdfPath = allFiles.find(f => f.includes('OMTR')) || allFiles[0]
  if (!pdfPath) { er('Nenhum PDF encontrado'); process.exit(1) }
  ok(`Storage path: ${pdfPath}`)

  // ── PASSO 3: Chamada à API de produção ────────────────────────────────────
  bar('PASSO 3 — Chamada ao endpoint /api/pfd-processar')
  console.log(`  URL: ${API_URL}`)

  const body = {
    modo: 'storage',
    storage_path: pdfPath,
    workspace_id: pub.workspace_id,
    publicacao_id: pub.id,
    fabricante: pub.fabricante,
    modelo: pub.modelo,
  }
  console.log(`  Body: ${JSON.stringify(body)}`)

  const t0 = Date.now()
  let apiResp
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(290_000), // 290s timeout (Vercel limit é 300s)
    })
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    ok(`Resposta HTTP: ${res.status} (${elapsed}s)`)
    apiResp = await res.json()
  } catch (e) {
    er(`Falha na chamada: ${e.message}`)
    process.exit(1)
  }

  // ── PASSO 4: Verificar resposta ───────────────────────────────────────────
  bar('PASSO 4 — Verificando Resposta da API')

  if (!apiResp.ok) {
    er(`API retornou erro: ${apiResp.error || JSON.stringify(apiResp)}`)
    if (apiResp.log) {
      console.log('\n  Log da API:')
      apiResp.log.forEach(l => console.log(`  ${l}`))
    }
    process.exit(1)
  }

  ok(`Status extração: ${apiResp.status_extracao}`)
  ok(`Provider usado: ${apiResp.provider}`)
  ok(`Total intervalos: ${apiResp.total_intervalos}`)
  ok(`Total tarefas: ${apiResp.total_tarefas}`)
  ok(`Intervalos ok: ${apiResp.intervalos_ok}`)
  ok(`Plano ID: ${apiResp.plano_id}`)

  if (apiResp.log) {
    console.log('\n  Log da API:')
    apiResp.log.forEach(l => console.log(`  ${l}`))
  }

  if (apiResp.alertas?.length > 0) {
    wrn(`${apiResp.alertas.length} alertas:`)
    apiResp.alertas.forEach(a => wrn(`  ${a.mensagem}`))
  }

  // ── PASSO 5: Buscar plano no DB para análise detalhada ────────────────────
  bar('PASSO 5 — Análise do Plano Salvo no DB')

  if (!apiResp.plano_id) { er('plano_id não retornado'); process.exit(1) }

  const { data: plano, error: planoErr } = await sb
    .from('pfd_planos')
    .select('id, intervalos, total_intervalos, total_tarefas')
    .eq('id', apiResp.plano_id)
    .single()

  if (planoErr) { er('Erro ao buscar plano: ' + planoErr.message); process.exit(1) }

  const intervalos = plano.intervalos || []
  ok(`Intervalos no DB: ${intervalos.length}`)

  const totalTarefas = intervalos.reduce((acc, iv) => acc + (iv.tarefas?.length || 0), 0)
  ok(`Total tarefas no DB: ${totalTarefas}`)

  console.log('\n  Horas │ Tarefas │ Status    │ Título')
  console.log('  ' + '─'.repeat(70))
  for (const iv of intervalos.sort((a, b) => (a.intervalo_horas || 0) - (b.intervalo_horas || 0))) {
    const h = String(iv.intervalo_horas ?? '?').padStart(5)
    const n = String(iv.tarefas?.length ?? 0).padStart(7)
    const st = (iv.status_extracao || 'ok').padEnd(10)
    const titulo = (iv.titulo_intervalo || '').slice(0, 40)
    console.log(`  ${h}h │ ${n} │ ${st} │ ${titulo}`)
  }

  // ── PASSO 6: Verificar campos novos ──────────────────────────────────────
  bar('PASSO 6 — Verificando Campos do Novo Schema')

  const todasTarefas = intervalos.flatMap(iv => iv.tarefas || [])
  const CAMPOS = ['sistema', 'componente', 'atividade', 'tipo_atividade', 'insumo_ou_peca', 'quantidade', 'pagina_fonte', 'texto_original']
  const MAPA_ALIAS = { atividade: ['atividade', 'descricao_tarefa'], tipo_atividade: ['tipo_atividade', 'tipo'], insumo_ou_peca: ['insumo_ou_peca', 'lubrificante_fluido'], quantidade: ['quantidade', 'capacidade'] }

  console.log('\n  Campo             | Preenchido | %')
  console.log('  ' + '─'.repeat(45))
  for (const campo of CAMPOS) {
    const aliases = MAPA_ALIAS[campo] || [campo]
    const preenchidos = todasTarefas.filter(t => aliases.some(a => t[a] != null && t[a] !== '')).length
    const pct = todasTarefas.length > 0 ? Math.round(100 * preenchidos / todasTarefas.length) : 0
    const bar_ = '█'.repeat(Math.round(pct / 5)).padEnd(20)
    console.log(`  ${campo.padEnd(17)} │ ${String(preenchidos).padStart(4)}/${todasTarefas.length} │ ${String(pct).padStart(3)}% ${bar_}`)
  }

  // ── PASSO 7: Exemplo tarefa ───────────────────────────────────────────────
  bar('PASSO 7 — Exemplo de Tarefa Extraída')
  if (todasTarefas.length > 0) {
    const sample = todasTarefas[Math.min(5, todasTarefas.length - 1)]
    console.log(JSON.stringify(sample, null, 2))
  }

  // ── PASSO 8: Salvar output ────────────────────────────────────────────────
  bar('PASSO 8 — Salvando Resultado')

  const output = {
    meta: {
      publicacao_id: pub.id,
      plano_id: apiResp.plano_id,
      fabricante: pub.fabricante,
      modelo: pub.modelo,
      provider: apiResp.provider,
      status_extracao: apiResp.status_extracao,
    },
    total_intervalos: intervalos.length,
    total_tarefas: totalTarefas,
    por_intervalo: Object.fromEntries(
      intervalos.map(iv => [`${iv.intervalo_horas}h`, {
        titulo: iv.titulo_intervalo,
        n: iv.tarefas?.length || 0,
        status: iv.status_extracao,
      }])
    ),
    sample_tarefa: todasTarefas[5] || todasTarefas[0],
    intervalos: intervalos,
  }

  fs.mkdirSync('tests', { recursive: true })
  fs.writeFileSync('tests/output-producao.json', JSON.stringify(output, null, 2), 'utf8')
  ok('Salvo em tests/output-producao.json')

  // ── SUMÁRIO ───────────────────────────────────────────────────────────────
  bar('SUMÁRIO FINAL')
  console.log(`  Equipamento:        ${pub.fabricante} ${pub.modelo}`)
  console.log(`  Provider IA:        ${apiResp.provider}`)
  console.log(`  Status extração:    ${apiResp.status_extracao}`)
  console.log(`  Intervalos:         ${intervalos.length}`)
  console.log(`  Tarefas totais:     ${totalTarefas}`)
  console.log(`  Intervalos com ok:  ${intervalos.filter(iv => iv.status_extracao === 'ok').length}`)
  console.log(`  Intervalos c/ falha:${intervalos.filter(iv => iv.status_extracao === 'falha_extracao').length}`)
  console.log()

  const ok_count = intervalos.filter(iv => (iv.tarefas?.length || 0) > 0).length
  if (ok_count === intervalos.length && intervalos.length > 0) {
    ok(`PASSOU: Todos os ${intervalos.length} intervalos têm tarefas`)
  } else if (ok_count > 0) {
    wrn(`PARCIAL: ${ok_count}/${intervalos.length} intervalos com tarefas`)
  } else {
    er('FALHOU: Nenhum intervalo com tarefas')
    process.exit(1)
  }
}

main().catch(e => {
  console.error('\n  ERRO CRÍTICO:', e.message)
  console.error(e.stack)
  process.exit(1)
})
