// Smoke test integrado: gera os 5 dashboards contra Supabase real do workspace de testes
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
if (existsSync('.env')) {
  for (const ln of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = ln.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
import { createClient } from '@supabase/supabase-js'
import { gerarDashboardPDF } from '../api/_pdf/index.js'
import { buildDashboardFinanceiro }  from '../api/_pdf/modulos/financeiro.js'
import { buildDashboardFaturamento } from '../api/_pdf/modulos/faturamento.js'
import { buildDashboardRefeicoes }   from '../api/_pdf/modulos/refeicoes.js'
import { buildDashboardCompras }     from '../api/_pdf/modulos/compras.js'
import { buildDashboardEfetivo }     from '../api/_pdf/modulos/efetivo.js'

const SB_URL  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const WS      = 'd0261b4e-450a-47ce-a751-2ba9a12fe7d5'
const empresa = 'ph.mar89s@gmail.com'

if (!SB_URL || !SB_KEY) { console.error('Faltando SUPABASE_URL / SERVICE_KEY no env'); process.exit(1) }
const supabase = createClient(SB_URL, SB_KEY)

const hoje = new Date().toISOString().slice(0, 10)
const ini  = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)
const filtros = { data_inicio: ini, data_fim: hoje }

const modulos = [
  ['financeiro',  buildDashboardFinanceiro],
  ['faturamento', buildDashboardFaturamento],
  ['refeicoes',   buildDashboardRefeicoes],
  ['compras',     buildDashboardCompras],
  ['efetivo',     buildDashboardEfetivo],
]

for (const [nome, fn] of modulos) {
  try {
    const dados = await fn(WS, filtros, supabase, empresa)
    const buf   = await gerarDashboardPDF(dados)
    writeFileSync(`tests/smoke-${nome}.pdf`, buf)
    console.log(`OK  ${nome.padEnd(12)} → ${buf.length} bytes`)
    // dump dos KPIs para conferência
    console.log('    KPIs:', dados.kpis.map(k => `${k.label}=${k.value}`).join(' | '))
  } catch (e) {
    console.error(`ERRO ${nome}:`, e.message)
  }
}
