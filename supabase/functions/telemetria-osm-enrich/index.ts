/**
 * Edge Function: telemetria-osm-enrich
 * Enriquece pontos GPS com dados de tipo de via do OpenStreetMap (Overpass API).
 * Processa pontos em lotes onde via_osm IS NULL e speed_ms > 2 m/s.
 *
 * Agendar: Supabase → Edge Functions → telemetria-osm-enrich → Schedule: 0 * * * *
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const RAIO_M       = 30    // raio de busca ao redor do ponto
const LOTE_MAX     = 50    // pontos por execução

serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Busca lote de pontos sem OSM ainda, em movimento (> 2 m/s ≈ 7 km/h)
  const { data: pontos, error: fetchErr } = await supabase
    .from('lider_telemetria_pontos')
    .select('id, lat, lng')
    .is('via_osm', null)
    .gt('speed_ms', 2)
    .order('ts', { ascending: false })
    .limit(LOTE_MAX)

  if (fetchErr || !pontos?.length) {
    return new Response(JSON.stringify({ enriched: 0, message: fetchErr?.message ?? 'nada a processar' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let enriched = 0

  for (const ponto of pontos) {
    try {
      // Query Overpass para via mais próxima
      const query = `
        [out:json][timeout:5];
        way(around:${RAIO_M},${ponto.lat},${ponto.lng})[highway];
        out tags 1;
      `
      const resp = await fetch(OVERPASS_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    'data=' + encodeURIComponent(query),
        signal:  AbortSignal.timeout(6000),
      })

      if (!resp.ok) continue

      const json = await resp.json()
      const way  = json.elements?.[0]

      const via_osm     = way?.tags?.highway    ?? 'desconhecido'
      const surface_osm = way?.tags?.surface    ?? null

      await supabase
        .from('lider_telemetria_pontos')
        .update({ via_osm, surface_osm })
        .eq('id', ponto.id)

      enriched++
    } catch { /* timeout ou erro de rede — tenta no próximo ciclo */ }
  }

  console.log(`[osm-enrich] ${enriched}/${pontos.length} pontos enriquecidos`)
  return new Response(JSON.stringify({ enriched, total: pontos.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
