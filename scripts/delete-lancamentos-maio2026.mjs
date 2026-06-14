/**
 * Script para deletar os lançamentos de Maio/2026
 * Workspace: d0261b4e-450a-47ce-a751-2ba9a12fe7d5 (Birigui / SUZANO)
 *
 * PASSO 1: rode sem --confirmar  → só lista o que será deletado
 * PASSO 2: rode com --confirmar  → deleta de verdade
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yfxkgwlxoszbapvgtpee.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const WORKSPACE_ID = 'd0261b4e-450a-47ce-a751-2ba9a12fe7d5'
const COMPETENCIA_DE = '2026-05-01'
const COMPETENCIA_ATE = '2026-05-31'

const confirmar = process.argv.includes('--confirmar')
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// IDs confirmados pelo usuário (RDOs SUZANO — linhas 13 a 22 da listagem)
const IDS_ALVO = [
  '563c23ce-7a0a-478d-9c52-3df213227b26',
  '115db5e6-83f0-4538-90f8-6883daad74e2',
  '45fda61c-7b31-45b8-9ccb-8dee8184fa3e',
  '5593a9e7-7aca-4e8d-9c65-692ef3796db6',
  '2214c206-fbfb-4c7f-9777-b39bec53c664',
  '0e5e7fee-be64-44b1-9d03-7e7f0b3b84d4',
  '33295e2d-2a5f-42f3-b5dc-f814a8b97170',
  'b477e9c0-c837-402c-96be-79f7c0207f1c',
  'ea07e0c9-e96c-4097-be78-150c7aef2d01',
  '8757b4d8-9b39-456d-996c-12890832cee4',
]

const { data, error } = await supabase
  .from('lancamentos')
  .select('id, descricao, valor, status, data')
  .in('id', IDS_ALVO)

if (error) { console.error('Erro ao buscar:', error.message); process.exit(1) }

console.log(`\n📋 Registros encontrados: ${data.length}\n`)
data.forEach((r, i) => {
  console.log(`  ${i + 1}. [${r.id}] ${r.data} | ${r.status} | R$ ${r.valor ?? 0} | ${r.descricao || '—'}`)
})

if (!confirmar) {
  console.log('\n⚠️  SIMULAÇÃO — nada foi deletado.')
  console.log('   Para deletar de verdade, rode:\n')
  console.log('   node scripts/delete-lancamentos-maio2026.mjs --confirmar\n')
  process.exit(0)
}

const ids = IDS_ALVO
const { error: delErr } = await supabase
  .from('lancamentos')
  .delete()
  .in('id', ids)

if (delErr) { console.error('Erro ao deletar:', delErr.message); process.exit(1) }

console.log(`\n✅ ${ids.length} registros deletados com sucesso.\n`)
