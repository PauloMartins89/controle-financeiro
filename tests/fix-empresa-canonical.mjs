// fix-empresa-canonical.mjs
// Aplica o motor fuzzy nos lançamentos RDO já processados.
// Atualiza dados_extras.empresa para o nome canônico do cadastro (diario_tarifas)
// e guarda o raw original em dados_extras.empresa_ocr_raw para auditoria.
//
// Uso:
//   node tests/fix-empresa-canonical.mjs           → dry-run (só mostra o que mudaria)
//   node tests/fix-empresa-canonical.mjs --apply   → aplica as mudanças no banco

import { createClient } from '@supabase/supabase-js'
import { matchEmpresa }  from '../api/_fuzzy-match.js'

const WORKSPACE_ID = 'd0261b4e-450a-47ce-a751-2ba9a12fe7d5'
const DRY_RUN      = !process.argv.includes('--apply')

const supabase = createClient(
  process.env.SUPABASE_URL        || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
)

// ── 1. Carrega candidatos canônicos ──────────────────────────────────────────
const { data: tarifas, error: tErr } = await supabase
  .from('diario_tarifas')
  .select('cliente_nome')
  .eq('workspace_id', WORKSPACE_ID)
  .eq('ativo', true)

if (tErr) { console.error('Erro ao carregar tarifas:', tErr.message); process.exit(1) }

const candidatos = (tarifas || []).map(t => t.cliente_nome).filter(Boolean)
console.log('Candidatos canônicos:', candidatos)

// ── 2. Carrega lançamentos RDO do workspace ──────────────────────────────────
const { data: lancs, error: lErr } = await supabase
  .from('lancamentos')
  .select('id, dados_extras')
  .eq('workspace_id', WORKSPACE_ID)
  .eq('tipo_formulario', 'rdo')

if (lErr) { console.error('Erro ao carregar lançamentos:', lErr.message); process.exit(1) }

console.log(`\nTotal de lançamentos RDO encontrados: ${lancs.length}`)
console.log(DRY_RUN ? '[ DRY RUN — use --apply para gravar ]\n' : '[ APLICANDO MUDANÇAS ]\n')

// ── 3. Avalia cada lançamento ────────────────────────────────────────────────
let alterados = 0
let semMatch  = 0
let jaOk      = 0

for (const l of lancs) {
  const d      = l.dados_extras || {}
  const rawEmp = (d.empresa || d.cliente || '').trim()

  if (!rawEmp) { semMatch++; continue }

  const { canonical, confidence } = matchEmpresa(rawEmp, candidatos)

  // Já está canônico (igual ao resultado do match)
  if (canonical && rawEmp === canonical) {
    console.log(`  ✓ ${l.id.slice(0, 8)} — "${rawEmp}" já está correto`)
    jaOk++
    continue
  }

  if (!canonical) {
    console.log(`  ✗ ${l.id.slice(0, 8)} — "${rawEmp}" sem match (confiança insuficiente)`)
    semMatch++
    continue
  }

  console.log(`  → ${l.id.slice(0, 8)} — "${rawEmp}" → "${canonical}" (${confidence}%)`)
  alterados++

  if (!DRY_RUN) {
    const novoExtras = {
      ...d,
      empresa:         canonical,
      cliente:         canonical,
      empresa_ocr_raw: rawEmp,
    }
    const { error: upErr } = await supabase
      .from('lancamentos')
      .update({ dados_extras: novoExtras })
      .eq('id', l.id)

    if (upErr) console.error(`    ERRO ao atualizar ${l.id}:`, upErr.message)
  }
}

// ── 4. Resumo ────────────────────────────────────────────────────────────────
console.log(`\n── Resumo ──────────────────────────────`)
console.log(`  Já corretos:   ${jaOk}`)
console.log(`  Para alterar:  ${alterados}`)
console.log(`  Sem match:     ${semMatch}`)
if (DRY_RUN && alterados > 0) {
  console.log(`\nRodar com --apply para gravar as ${alterados} alterações no banco.`)
}
