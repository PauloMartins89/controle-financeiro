// Smoke test: gera dashboard + lista de TODOS os módulos (incluindo clientes)
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
if (existsSync('.env')) {
  for (const ln of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = ln.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
import { createClient } from '@supabase/supabase-js'
import { gerarDashboardPDF } from '../api/_pdf/index.js'
import { buildDashboardFinanceiro }   from '../api/_pdf/modulos/financeiro.js'
import { buildDashboardFaturamento }  from '../api/_pdf/modulos/faturamento.js'
import { buildDashboardClientes }     from '../api/_pdf/modulos/clientes.js'
import { buildDashboardRefeicoes }    from '../api/_pdf/modulos/refeicoes.js'
import { buildDashboardCompras }      from '../api/_pdf/modulos/compras.js'
import { buildDashboardEfetivo }      from '../api/_pdf/modulos/efetivo.js'
import { buildDashboardAgendamentos } from '../api/_pdf/modulos/agendamentos.js'

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)
const WS = 'd0261b4e-450a-47ce-a751-2ba9a12fe7d5'
const hoje = new Date().toISOString().slice(0, 10)
const ini  = new Date(Date.now() - 60 * 86400e3).toISOString().slice(0, 10)

const modulos = [
  ['financeiro',  buildDashboardFinanceiro],
  ['faturamento', buildDashboardFaturamento],
  ['clientes',    buildDashboardClientes],
  ['refeicoes',   buildDashboardRefeicoes],
  ['compras',     buildDashboardCompras],
  ['efetivo',       buildDashboardEfetivo],
  ['agendamentos',  buildDashboardAgendamentos],
]

for (const fmt of ['dashboard', 'lista']) {
  console.log(`\n---- ${fmt.toUpperCase()} ----`)
  for (const [nome, fn] of modulos) {
    try {
      const dados = await fn(WS, { data_inicio: ini, data_fim: hoje, formato: fmt }, sb, 'ph.mar89s@gmail.com')
      const buf   = await gerarDashboardPDF(dados)
      writeFileSync(`tests/smoke-${nome}-${fmt}.pdf`, buf)
      const rows = dados.tabela?.linhas?.length || 0
      console.log(`OK  ${nome.padEnd(12)} ${String(buf.length).padStart(7)} bytes  ${rows} linha(s)`)
    } catch (e) {
      console.error(`ERRO ${nome}/${fmt}:`, e.message)
    }
  }
}
