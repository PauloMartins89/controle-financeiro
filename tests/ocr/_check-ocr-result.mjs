import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Load env
for (const f of ['.env', '.env.local']) {
  const p = resolve(process.cwd(), f)
  if (!existsSync(p)) continue
  const lines = readFileSync(p, 'utf-8').split('\n')
  for (const line of lines) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const boletimId = process.argv[2] || '3647e174-f478-49c5-aaa3-23eaa994c3d5'
const { data, error } = await supabase
  .from('maquinas_boletins')
  .select('numero, status, ocr_raw')
  .eq('id', boletimId)
  .single()

if (error) { console.error(error.message); process.exit(1) }
console.log('Boletim:', data.numero, '| Status:', data.status)
console.log(JSON.stringify(data.ocr_raw, null, 2))
