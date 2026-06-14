/**
 * Script único — limpa todos os arquivos órfãos de comprovantes/whatsapp/
 * Uso: node scripts/limpar-storage-whatsapp.mjs
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL         || 'https://yfxkgwlxoszbapvgtpee.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY não encontrado. Exporte a variável antes de rodar.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const BUCKET = 'comprovantes'
const PASTA  = 'whatsapp'
const LOTE   = 50  // máximo da API do Supabase por chamada

async function listarTodos() {
  const todos = []
  let offset  = 0
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(PASTA, {
      limit:  200,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) { console.error('Erro ao listar:', error.message); break }
    if (!data?.length) break
    todos.push(...data)
    if (data.length < 200) break
    offset += 200
  }
  return todos
}

async function main() {
  console.log(`\n🔍 Listando arquivos em ${BUCKET}/${PASTA}/...`)
  const arquivos = await listarTodos()
  console.log(`📦 Total encontrado: ${arquivos.length} arquivos`)
  if (!arquivos.length) { console.log('✅ Nada a remover.'); return }

  // Monta paths completos
  const paths = arquivos.map(f => `${PASTA}/${f.name}`)
  const urlBase = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`
  const urls    = paths.map(p => `${urlBase}${p}`)

  // Verifica se algum ainda está referenciado em lancamentos
  console.log('🔎 Verificando referências em lancamentos...')
  const { data: usados } = await supabase
    .from('lancamentos')
    .select('comprovante_url')
    .in('comprovante_url', urls)
  const urlsUsadas = new Set((usados || []).map(l => l.comprovante_url))
  const orphans    = paths.filter(p => !urlsUsadas.has(`${urlBase}${p}`))

  console.log(`🗑️  Órfãos confirmados: ${orphans.length} (referenciados e preservados: ${paths.length - orphans.length})`)
  if (!orphans.length) { console.log('✅ Nenhum órfão encontrado.'); return }

  // Remove em lotes
  let removidos = 0
  for (let i = 0; i < orphans.length; i += LOTE) {
    const lote = orphans.slice(i, i + LOTE)
    const { error } = await supabase.storage.from(BUCKET).remove(lote)
    if (error) {
      console.error(`❌ Erro no lote ${i}–${i + lote.length}:`, error.message)
    } else {
      removidos += lote.length
      process.stdout.write(`\r✅ Removidos: ${removidos}/${orphans.length}`)
    }
  }
  console.log(`\n\n🎉 Concluído! ${removidos} arquivo(s) removido(s) — ${((removidos * 91) / 405 / 1).toFixed(0)} MB liberados (estimativa)`)
}

main().catch(e => { console.error('Erro fatal:', e.message); process.exit(1) })
