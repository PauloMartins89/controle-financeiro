/**
 * Seed: popula lider_epis e lider_epcs com itens comuns
 * Uso: node tests/seed-lider-epis-epcs.mjs [workspace_id]
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// carrega .env
const env = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
for (const line of env.split(/\r?\n/)) {
  const eq = line.indexOf('=')
  if (eq > 0 && !line.startsWith('#')) {
    const k = line.slice(0, eq).trim(), v = line.slice(eq + 1).trim()
    if (k && !process.env[k]) process.env[k] = v
  }
}

const WORKSPACE_ID = process.argv[2] ?? null
if (!WORKSPACE_ID) {
  console.error('❌  Informe o workspace_id como argumento:')
  console.error('    node tests/seed-lider-epis-epcs.mjs <workspace_id>')
  process.exit(1)
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// ─── EPIs (individual / por colaborador) ─────────────────────────────────────
const EPIS = [
  { nome: 'Capacete de segurança classe B',       ca: '31469' },
  { nome: 'Óculos de proteção ampla visão',        ca: '10346' },
  { nome: 'Luva de raspa de couro cano longo',     ca: '15748' },
  { nome: 'Luva de nitrila descartável',            ca: '43228' },
  { nome: 'Protetor auricular tipo plug espuma',   ca: '5674'  },
  { nome: 'Protetor facial com viseira incolor',   ca: '25261' },
  { nome: 'Bota de segurança com biqueira de aço', ca: '28207' },
  { nome: 'Botina de couro c/ biqueira composite', ca: '39296' },
  { nome: 'Colete refletivo classe 2',             ca: '43895' },
  { nome: 'Respirador PFF2 (N95)',                  ca: '20957' },
  { nome: 'Cinto de segurança tipo paraquedista',  ca: '37873' },
  { nome: 'Talabarte duplo com absorvedor',         ca: '37874' },
  { nome: 'Avental de raspa de couro',              ca: '14812' },
  { nome: 'Joelheira de proteção',                  ca: '39241' },
  { nome: 'Manga de raspa de couro',                ca: '24716' },
]

// ─── EPCs (coletivo / por módulo ou frente) ───────────────────────────────────
const EPCS = [
  { nome: 'Sinalização de área de risco (cone)',          ca: null,    frente_nome: null },
  { nome: 'Fita zebrada de isolamento',                   ca: null,    frente_nome: null },
  { nome: 'Placa de proibição "Entrada proibida"',        ca: null,    frente_nome: null },
  { nome: 'Placa de obrigação "Use capacete"',            ca: null,    frente_nome: null },
  { nome: 'Extintor de incêndio CO₂ 4kg',                ca: null,    frente_nome: null },
  { nome: 'Extintor de incêndio pó ABC 6kg',              ca: null,    frente_nome: null },
  { nome: 'Manta de solda antichama 1,80×1,80m',          ca: null,    frente_nome: null },
  { nome: 'Tela de proteção contra queda de objetos',     ca: '23541', frente_nome: null },
  { nome: 'Guarda-corpo provisório (barra e rodapé)',     ca: null,    frente_nome: null },
  { nome: 'Barreira de contenção para escavação',         ca: null,    frente_nome: null },
  { nome: 'Kit de primeiros socorros',                    ca: null,    frente_nome: null },
  { nome: 'Sinaleira giratória de alerta',                ca: null,    frente_nome: null },
  { nome: 'Chuveiro lava-olhos de emergência',            ca: null,    frente_nome: null },
]

async function seed() {
  console.log(`\n🌱  Iniciando seed para workspace: ${WORKSPACE_ID}\n`)

  // EPIs
  console.log('── Inserindo EPIs ──────────────────────────────')
  const { data: existEpis } = await sb.from('lider_epis').select('nome').eq('workspace_id', WORKSPACE_ID)
  const existEpisNomes = new Set((existEpis ?? []).map(e => e.nome))
  const episNovos = EPIS.filter(e => !existEpisNomes.has(e.nome)).map(e => ({ ...e, workspace_id: WORKSPACE_ID, ativo: true }))
  if (episNovos.length === 0) {
    console.log('⏭️  Todos os EPIs já existem, nada a inserir')
  } else {
    const { data: episData, error: episErr } = await sb.from('lider_epis').insert(episNovos).select('id, nome')
    if (episErr) { console.error('❌  Erro EPIs:', episErr.message) }
    else { console.log(`✅  ${episData?.length ?? 0} EPIs inseridos`); episData?.forEach(e => console.log('   •', e.nome)) }
  }

  // EPCs
  console.log('\n── Inserindo EPCs ──────────────────────────────')
  const { data: existEpcs } = await sb.from('lider_epcs').select('nome').eq('workspace_id', WORKSPACE_ID)
  const existEpcsNomes = new Set((existEpcs ?? []).map(e => e.nome))
  const epcsNovos = EPCS.filter(e => !existEpcsNomes.has(e.nome)).map(e => ({ ...e, workspace_id: WORKSPACE_ID, ativo: true }))
  if (epcsNovos.length === 0) {
    console.log('⏭️  Todos os EPCs já existem, nada a inserir')
  } else {
    const { data: epcsData, error: epcsErr } = await sb.from('lider_epcs').insert(epcsNovos).select('id, nome')
    if (epcsErr) { console.error('❌  Erro EPCs:', epcsErr.message) }
    else { console.log(`✅  ${epcsData?.length ?? 0} EPCs inseridos`); epcsData?.forEach(e => console.log('   •', e.nome)) }
  }

  console.log('\n🎉  Seed concluído!\n')
}

seed()
