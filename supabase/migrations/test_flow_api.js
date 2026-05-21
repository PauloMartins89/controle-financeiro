/**
 * SmartPro Flow Center — Teste de API no Console do Browser
 *
 * Abra smartpro.app.br, faça login, pressione F12 → Console,
 * cole este script e pressione Enter.
 *
 * O script testa:
 *   1. GET  /api/flow-engine?action=instance  → estado da instância
 *   2. GET  /api/flow-engine?action=actions   → ações disponíveis
 *   3. POST /api/flow-engine?action=execute   → executar ação "aprovar"
 */

;(async () => {
  // ─── CONFIG ─────────────────────────────────────────────────────────────
  // Substitua pelos IDs reais (rode o SQL de teste primeiro)
  const INSTANCE_ID = 'COLE-O-INSTANCE-ID-AQUI'   // do Passo 8 do SQL
  const USER_ID     = 'COLE-O-USER-ID-AQUI'        // auth.users.id do admin
  // ────────────────────────────────────────────────────────────────────────

  if (INSTANCE_ID === 'COLE-O-INSTANCE-ID-AQUI') {
    console.warn('⚠️  Substitua INSTANCE_ID e USER_ID antes de rodar')
    return
  }

  const base = '/api/refeicoes?module=flow'
  const h = { 'Content-Type': 'application/json' }

  // ── 1. Estado atual da instância ────────────────────────────────────────
  console.group('1️⃣  Estado da instância')
  const r1 = await fetch(`${base}&action=instance&instance_id=${INSTANCE_ID}`)
  const d1 = await r1.json()
  if (!r1.ok) { console.error('❌ Erro:', d1); console.groupEnd(); return }
  console.log('Instância:', d1.instancia)
  console.log('Etapa atual:', d1.instancia.flow_steps?.nome, '|', d1.instancia.flow_steps?.status_valor)
  console.log('Histórico:', d1.historico)
  console.groupEnd()

  // ── 2. Ações disponíveis ─────────────────────────────────────────────────
  console.group('2️⃣  Ações disponíveis')
  const r2 = await fetch(`${base}&action=actions&instance_id=${INSTANCE_ID}`)
  const d2 = await r2.json()
  if (!r2.ok) { console.error('❌ Erro:', d2); console.groupEnd(); return }
  console.log('Ações:', d2.acoes.map(a => `${a.nome} → ${a.label}`))
  console.groupEnd()

  const acaoAprovar = d2.acoes.find(a => a.nome === 'aprovar')
  if (!acaoAprovar) {
    console.warn('⚠️  Ação "aprovar" não disponível nesta etapa. Verifique se a instância está em "Aguardando Aprovação".')
    console.log('Ações disponíveis:', d2.acoes)
    return
  }

  // ── 3. Executar ação "aprovar" ───────────────────────────────────────────
  console.group('3️⃣  Executar aprovação')
  const r3 = await fetch(`${base}&action=execute`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      instance_id:   INSTANCE_ID,
      acao_id:       acaoAprovar.id,
      executado_por: USER_ID,
      dados:         {},
      origem:        'humano',
    }),
  })
  const d3 = await r3.json()
  if (!r3.ok) { console.error('❌ Erro ao executar:', d3); console.groupEnd(); return }
  console.log('✅ Resultado:', d3)
  console.log('Etapa anterior:', d3.step_anterior)
  console.log('Etapa atual:', d3.step_atual)
  console.groupEnd()

  // ── 4. Verificar novo estado ─────────────────────────────────────────────
  console.group('4️⃣  Estado após aprovação')
  const r4 = await fetch(`${base}&action=instance&instance_id=${INSTANCE_ID}`)
  const d4 = await r4.json()
  console.log('Etapa atual:', d4.instancia.flow_steps?.nome, '|', d4.instancia.flow_steps?.status_valor)
  console.log('Histórico completo:', d4.historico.map(h => `${h.acao_nome}: ${h.step_origem_nome} → ${h.step_destino_nome}`))
  console.groupEnd()

  console.log('\n🎉 Teste concluído! Verifique a solicitação na tela de Refeições para confirmar o status.')
})()
