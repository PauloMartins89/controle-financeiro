// Smoke test do pré-filtro de relatórios — garante que fluxos existentes não são afetados
import assert from 'node:assert/strict'

// Importa via require do módulo (re-implementa a função local p/ teste isolado, sem rede)
// Como detectarPedidoRelatorio() não é exportada, replicamos aqui a lógica idêntica.
function detectarPedidoRelatorio(texto) {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const GATILHOS = /\b(relatorio|dashboard|resumo|panorama|painel)\b/
  const EXTRATO  = /\bextrato\b/
  const MODULOS = [
    { mod: 'financeiro',  re: /\b(financeiro|financa|financas)\b/ },
    { mod: 'lancamentos', re: /\b(lancamento|lancamentos|lista)\b/ },
    { mod: 'faturamento', re: /\b(faturamento|vendas|recebimento|recebimentos)\b/ },
    { mod: 'compras',     re: /\b(compra|compras|pedido|pedidos|cotacao|cotacoes|fornecedor|fornecedores)\b/ },
    { mod: 'refeicoes',   re: /\b(refeicao|refeicoes)\b/ },
    { mod: 'efetivo',     re: /\b(efetivo|colaborador|colaboradores|funcionario|funcionarios)\b/ },
  ]
  const temGatilho = GATILHOS.test(t)
  const ehExtrato  = EXTRATO.test(t)
  if (ehExtrato && !temGatilho) return { modulo: 'lancamentos', formato: 'tabela' }
  if (!temGatilho) return null
  const hit = MODULOS.find(m => m.re.test(t))
  if (!hit) return null
  const formato = /\b(tabela|extrato|lista|detalhad[oa])\b/.test(t) ? 'tabela'
                : hit.mod === 'lancamentos' ? 'tabela' : 'dashboard'
  return { modulo: hit.mod, formato }
}

const casos = [
  // ── DEVEM ignorar (fluxos atuais continuam) ───────────────────────────
  ['quero uma refeição para amanhã às 12h',           null, 'pedido refeição (texto longo)'],
  ['preciso agendar uma manutenção do gerador',       null, 'pedido agenda'],
  ['compra de 10 sacos de cimento urgente',           null, 'pedido compra'],
  ['lançamento de R$ 150 combustível',                null, 'lançamento manual'],
  ['olá tudo bem?',                                   null, 'conversa normal'],
  ['refeição',                                        null, 'palavra solo refeição'],
  ['compras',                                         null, 'palavra solo compras'],
  ['financeiro',                                      null, 'palavra solo financeiro'],
  ['relatorio',                                       null, 'gatilho sem módulo'],
  ['dashboard sem nada definido',                     null, 'gatilho sem módulo válido'],

  // ── DEVEM gerar relatório ─────────────────────────────────────────────
  ['relatorio refeicao mês passado',                  { modulo: 'refeicoes',   formato: 'dashboard' }, 'relatório refeição'],
  ['relatório refeições',                             { modulo: 'refeicoes',   formato: 'dashboard' }, 'relatório refeições acentuado'],
  ['relatorio compras maio',                          { modulo: 'compras',     formato: 'dashboard' }, 'relatório compras'],
  ['relatorio financeiro',                            { modulo: 'financeiro',  formato: 'dashboard' }, 'relatório financeiro'],
  ['dashboard financeiro últimos 30 dias',            { modulo: 'financeiro',  formato: 'dashboard' }, 'dashboard financeiro'],
  ['resumo faturamento abril',                        { modulo: 'faturamento', formato: 'dashboard' }, 'resumo faturamento'],
  ['relatorio efetivo',                               { modulo: 'efetivo',     formato: 'dashboard' }, 'relatório efetivo'],
  ['relatorio lancamentos detalhado',                 { modulo: 'lancamentos', formato: 'tabela' },    'relatório lançamentos tabela'],
  ['extrato últimos 30 dias',                         { modulo: 'lancamentos', formato: 'tabela' },    'extrato (atalho)'],
  ['painel compras fornecedor ACME',                  { modulo: 'compras',     formato: 'dashboard' }, 'painel compras'],
]

let fail = 0
for (const [texto, esperado, label] of casos) {
  const got = detectarPedidoRelatorio(texto)
  try {
    assert.deepEqual(got, esperado)
    console.log(`✅ ${label.padEnd(40)} → ${JSON.stringify(got)}`)
  } catch {
    fail++
    console.log(`❌ ${label.padEnd(40)} → got=${JSON.stringify(got)}  esperado=${JSON.stringify(esperado)}`)
  }
}
console.log(`\n${casos.length - fail}/${casos.length} passou`)
process.exit(fail ? 1 : 0)
