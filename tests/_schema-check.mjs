import { readFileSync } from 'node:fs'
for (const ln of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = ln.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)
const ws = 'd0261b4e-450a-47ce-a751-2ba9a12fe7d5'
for (const t of ['refei_solicitacoes', 'solicitacoes_compra', 'efetivo']) {
  const { data, error } = await sb.from(t).select('*').eq('workspace_id', ws).limit(1)
  console.log('\n=== ' + t + ' ===')
  if (error) { console.log('ERR ' + error.message); continue }
  if (!data?.length) { console.log('(vazia) — tentando sem WS'); const r2 = await sb.from(t).select('*').limit(1); console.log(Object.keys(r2.data?.[0] || {}).join(', ')); continue }
  console.log(Object.keys(data[0]).join(', '))
}
