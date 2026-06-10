/**
 * Edge Function: telemetria-purge
 * Deleta pontos GPS com mais de 7 dias.
 * Chamada via cron agendado no Supabase Dashboard:
 *   Supabase → Edge Functions → telemetria-purge → Schedule: 0 3 * * *
 *
 * Também pode ser chamada manualmente via POST (sem body).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Permite chamada manual com autenticação básica via CRON_SECRET
  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error, count } = await supabase
    .from('lider_telemetria_pontos')
    .delete({ count: 'exact' })
    .lt('ts', cutoff)

  if (error) {
    console.error('[purge] erro:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  console.log(`[purge] ${count} pontos deletados (cutoff: ${cutoff})`)
  return new Response(JSON.stringify({ deleted: count, cutoff }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
