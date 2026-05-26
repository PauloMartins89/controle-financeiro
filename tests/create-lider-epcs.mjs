import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
for (const l of env.split(/\r?\n/)) {
  const eq = l.indexOf('=')
  if (eq > 0 && !l.startsWith('#')) { const k = l.slice(0,eq).trim(), v = l.slice(eq+1).trim(); if (k) process.env[k] = v }
}

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const projectRef = process.env.VITE_SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

const sql = `
CREATE TABLE IF NOT EXISTS lider_epcs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  nome         text NOT NULL,
  ca           text,
  frente_nome  text,
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lider_epcs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lider_epcs' AND policyname = 'lider_auth_all'
  ) THEN
    CREATE POLICY lider_auth_all ON lider_epcs FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
`

const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})
const d = await r.json()
console.log(r.status, JSON.stringify(d))

// Verifica se criou
const { data, error } = await sb.from('lider_epcs').select('id').limit(1)
console.log(error ? 'ERRO: ' + error.message : 'Tabela lider_epcs: OK')
