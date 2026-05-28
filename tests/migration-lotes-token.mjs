import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yfxkgwlxoszbapvgtpee.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY não definida')

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const sqls = [
  `ALTER TABLE lotes_cliente ADD COLUMN IF NOT EXISTS token_acesso UUID UNIQUE DEFAULT NULL`,

  `ALTER TABLE lotes_cliente ENABLE ROW LEVEL SECURITY`,

  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies WHERE tablename='lotes_cliente' AND policyname='authed_all_lotes'
     ) THEN
       CREATE POLICY authed_all_lotes ON lotes_cliente
         FOR ALL TO authenticated USING (true) WITH CHECK (true);
     END IF;
   END $$`,

  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies WHERE tablename='lotes_cliente' AND policyname='public_read_by_token'
     ) THEN
       CREATE POLICY public_read_by_token ON lotes_cliente
         FOR SELECT TO anon USING (token_acesso IS NOT NULL);
     END IF;
   END $$`,

  `ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY`,

  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies WHERE tablename='lancamentos' AND policyname='authed_all_lancamentos'
     ) THEN
       CREATE POLICY authed_all_lancamentos ON lancamentos
         FOR ALL TO authenticated USING (true) WITH CHECK (true);
     END IF;
   END $$`,

  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_policies WHERE tablename='lancamentos' AND policyname='public_read_lancamentos_por_lote'
     ) THEN
       CREATE POLICY public_read_lancamentos_por_lote ON lancamentos
         FOR SELECT TO anon
         USING (
           lote_cliente_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM lotes_cliente l
             WHERE l.id = lancamentos.lote_cliente_id
             AND l.token_acesso IS NOT NULL
           )
         );
     END IF;
   END $$`,
]

for (const sql of sqls) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    }
  )
  const txt = await res.text()
  const label = sql.slice(0, 60).replace(/\n/g, ' ')
  if (!res.ok) {
    console.log(`❌ ${label}`)
    console.log('   Erro:', txt.slice(0, 200))
  } else {
    console.log(`✅ ${label}`)
  }
}

// Verifica se a coluna foi criada
const check = await sb.from('lotes_cliente').select('id, token_acesso').limit(1)
console.log('\n=== VERIFICAÇÃO FINAL ===')
console.log('Colunas ok?', check.error ? '❌ ' + check.error.message : '✅ token_acesso existe')
