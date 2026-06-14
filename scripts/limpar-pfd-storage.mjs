/* global process */
// scripts/limpar-pfd-storage.mjs
// Remove PDFs já processados do bucket pfd-manuais (o texto extraído fica no banco)
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
)

async function listarTodosArquivos() {
  const all = []
  const { data: top, error } = await sb.storage.from('pfd-manuais').list('', { limit: 1000 })
  if (error) throw new Error('Erro ao listar bucket: ' + error.message)

  for (const item of top || []) {
    if (!item.id) {
      // pasta (workspace_id)
      const { data: sub, error: subErr } = await sb.storage.from('pfd-manuais').list(item.name, { limit: 1000 })
      if (subErr) { console.warn(`⚠️ Erro ao listar ${item.name}:`, subErr.message); continue }
      for (const f of sub || []) {
        all.push({ path: `${item.name}/${f.name}`, size: f.metadata?.size || 0 })
      }
    } else {
      all.push({ path: item.name, size: item.metadata?.size || 0 })
    }
  }
  return all
}

const arquivos = await listarTodosArquivos()
const totalMB = arquivos.reduce((s, f) => s + f.size, 0) / 1024 / 1024
console.log(`\nBucket pfd-manuais: ${arquivos.length} arquivos / ${totalMB.toFixed(1)} MB`)

// pdf_storage_path pode estar null para publicações antigas (path vinha só no payload)
// Fallback: todos os arquivos no bucket são orphans já que a coluna nunca foi populada antes
const { data: pubs, error: pubsErr } = await sb
  .from('pfd_publicacoes')
  .select('pdf_storage_path, status')

if (pubsErr) throw new Error('Erro ao consultar pfd_publicacoes: ' + pubsErr.message)

const comPath   = (pubs || []).filter(p => p.pdf_storage_path).map(p => p.pdf_storage_path)
const processados = (pubs || []).filter(p => p.status === 'processado' && p.pdf_storage_path).map(p => p.pdf_storage_path)
const pendentes   = (pubs || []).filter(p => p.status !== 'processado' && p.pdf_storage_path).map(p => p.pdf_storage_path)

// Arquivos no bucket que não constam como pendentes no banco são seguros para remover
const arquivosParaRemover = comPath.length === 0
  // Coluna nunca foi populada: todos os arquivos são de publicações já processadas
  ? arquivos.map(a => a.path)
  // Coluna existe: remove apenas os processados
  : processados

console.log(`\nPublicações com pdf_storage_path: ${comPath.length}`)
console.log(`  processado: ${processados.length}`)
console.log(`  pendente/erro: ${pendentes.length}`)
console.log(`Arquivos a remover: ${arquivosParaRemover.length}`)

if (arquivosParaRemover.length === 0) {
  console.log('\nNenhum PDF para remover.')
  process.exit(0)
}

const totalRemover = arquivosParaRemover.reduce((s, path) => {
  const f = arquivos.find(a => a.path === path)
  return s + (f?.size || 0)
}, 0) / 1024 / 1024

console.log(`\nRemovendo ${arquivosParaRemover.length} PDFs (${totalRemover.toFixed(1)} MB)...`)

// Remove em lotes de 50 (limite da API)
for (let i = 0; i < arquivosParaRemover.length; i += 50) {
  const lote = arquivosParaRemover.slice(i, i + 50)
  const { error: delErr } = await sb.storage.from('pfd-manuais').remove(lote)
  if (delErr) {
    console.error(`  ✗ Lote ${i}–${i + lote.length}: ${delErr.message}`)
  } else {
    console.log(`  ✓ Lote ${i}–${i + lote.length} removido`)
  }
}

// Zera pdf_storage_path no banco (apenas para registros que tinham)
if (processados.length > 0) {
  const { error: updateErr } = await sb
    .from('pfd_publicacoes')
    .update({ pdf_storage_path: null })
    .in('pdf_storage_path', processados)
  if (updateErr) console.error('⚠️ Erro ao zerar pdf_storage_path no banco:', updateErr.message)
  else console.log(`\n✅ pdf_storage_path zerado em ${processados.length} publicações`)
}

console.log(`\nConcluído. Storage liberado: ~${totalRemover.toFixed(1)} MB`)
