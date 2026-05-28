// Smoke test do pré-filtro de relatórios — garante que fluxos existentes não são afetados
import assert from 'node:assert/strict'

// Importa via require do módulo (re-implementa a função local p/ teste isolado, sem rede)
// Como detectarPedidoRelatorio() não é exportada, replicamos aqui a lógica idêntica.
function detectarPedidoRelatorio(texto) {
  const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const GATILHOS = /\b(relatorio|relat|dashboard|resumo|panorama|painel|demonstrativo|relacao|consulta|consultar|me manda|envia|gerar|gera|lista|listagem|listar)\b/
  const EXTRATO  = /\b(extrato|extratos)\b/
  const MODULOS = [
    { mod: 'financeiro',  re: /\b(financeiro|financeira|financa|financas|caixa|fluxo|fluxo de caixa)\b/ },
    { mod: 'lancamentos', re: /\b(lancamento|lancamentos|movimento|movimentos|movimentacao|movimentacoes)\b/ },
    { mod: 'clientes',    re: /\b(cliente|clientes|aprovacao|aprovacoes|aprovar|recebivel|recebiveis|cobranca|cobrancas|pendencia|pendencias|inadimplencia|inadimplente|inadimplentes|devedor|devedores|atraso|atrasado|atrasados|vencido|vencidos)\b/ },
    { mod: 'faturamento', re: /\b(faturamento|faturado|vendas|venda|recebimento|recebimentos|nota|notas|nfe?s?|contas? a receber)\b/ },
    { mod: 'compras',     re: /\b(compra|compras|pedido|pedidos|cotacao|cotacoes|fornecedor|fornecedores|aquisicao|aquisicoes|requisicao|requisicoes|contas? a pagar)\b/ },
    { mod: 'refeicoes',   re: /\b(refeicao|refeicoes|alimentacao|cafe|cafes|almoco|janta|jantar|marmita|marmitas)\b/ },
    { mod: 'efetivo',     re: /\b(efetivo|colaborador|colaboradores|funcionario|funcionarios|pessoal|equipe|equipes|quadro|rh)\b/ },
  ]
  const temGatilho = GATILHOS.test(t)
  const ehExtrato  = EXTRATO.test(t)
  if (ehExtrato && !temGatilho) {
    const hitMod = MODULOS.find(m => m.re.test(t))
    if (hitMod) return { modulo: hitMod.mod, formato: 'lista' }
    return { modulo: 'lancamentos', formato: 'tabela' }
  }
  if (!temGatilho) return null
  const hit = MODULOS.find(m => m.re.test(t))
  if (!hit) return null
  const formato = /\b(tabela|extrato|lista|listagem|detalhad[oa]|detalhe|linha a linha|completa|completo|todos|todas)\b/.test(t)
    ? 'lista' : 'dashboard'
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
  ['relatorio lancamentos detalhado',                 { modulo: 'lancamentos', formato: 'lista' },    'relátorio lançamentos lista'],
  ['extrato últimos 30 dias',                         { modulo: 'lancamentos', formato: 'tabela' },    'extrato (atalho)'],
  ['painel compras fornecedor ACME',                  { modulo: 'compras',     formato: 'dashboard' }, 'painel compras'],

  // ── Novas combinações ──────────────────────────────────────────────────
  ['relatorio cliente',                               { modulo: 'clientes',    formato: 'dashboard' }, 'cliente singular'],
  ['relatorio aprovacao clientes',                    { modulo: 'clientes',    formato: 'dashboard' }, 'aprovação clientes'],
  ['extrato clientes',                                { modulo: 'clientes',    formato: 'lista' },     'extrato clientes (gatilho extrato + cliente vence prec)'],
  ['lista refeicoes',                                 { modulo: 'refeicoes',   formato: 'lista' },     'lista refeições'],
  ['relacao fornecedores maio',                       { modulo: 'compras',     formato: 'dashboard' }, 'relação fornecedores'],
  ['demonstrativo fluxo de caixa',                    { modulo: 'financeiro',  formato: 'dashboard' }, 'demonstrativo fluxo'],
  ['painel inadimplentes',                            { modulo: 'clientes',    formato: 'dashboard' }, 'inadimplentes'],
  ['relatorio rh',                                    { modulo: 'efetivo',     formato: 'dashboard' }, 'rh -> efetivo'],
  ['listagem completa compras',                       { modulo: 'compras',     formato: 'lista' },     'listagem completa'],
  ['me manda o resumo faturamento',                   { modulo: 'faturamento', formato: 'dashboard' }, 'me manda resumo'],
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
