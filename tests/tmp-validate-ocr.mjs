import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Últimos 3 boletins com status e campos chave do ocr_raw
const { data: bols } = await sb
  .from('maquinas_boletins')
  .select('id,numero,status,ocr_raw,created_at')
  .order('created_at', { ascending: false })
  .limit(3)

for (const b of bols) {
  const raw = b.ocr_raw
  const isArray = Array.isArray(raw)
  console.log(`\n── ${b.numero} [${b.status}] ${b.created_at.slice(0,19)}`)
  if (b.status === 'erro') { console.log('  ERRO:', raw?.erro?.slice(0,80)); continue }
  if (isArray) {
    console.log(`  ocr_raw: ARRAY (${raw.length} elementos) ← problema!`)
    raw.forEach((el,i) => {
      const nNonNull = Object.values(el||{}).filter(v=>v!=null).length
      console.log(`    [${i}] ${nNonNull} campos não-nulos → empresa:${el.empresa} equipamento:${el.equipamento} numero_documento:${el.numero_documento}`)
    })
  } else {
    const fields = ['empresa','equipamento','servico_executado','entrada','saida','numero_documento','data']
    console.log(`  ocr_raw: objeto único ✓`)
    for (const f of fields) console.log(`    ${f}: ${JSON.stringify(raw?.[f])}`)
  }
}

// Lançamentos diario mais recentes
const { data: lancs } = await sb
  .from('lancamentos')
  .select('id,dados_extras,created_at')
  .eq('dados_extras->>tipo_formulario', 'diario')
  .order('created_at', { ascending: false })
  .limit(3)

console.log('\n\n══ LANÇAMENTOS (dados_extras) ══')
for (const l of lancs) {
  const d = l.dados_extras || {}
  console.log(`\n  ${l.id.slice(0,8)} ${l.created_at.slice(0,19)}`)
  const keys = ['empresa','equipamento','servico_executado','jornada_inicio','jornada_fim','jornada_total_horas','numero_documento']
  for (const k of keys) console.log(`    ${k}: ${JSON.stringify(d[k])}`)
}
