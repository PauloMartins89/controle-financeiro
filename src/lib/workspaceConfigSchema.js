// ─────────────────────────────────────────────────────────────────────────────
// workspaceConfigSchema — REGISTRO CENTRAL de todas as chaves de config por cliente
// ─────────────────────────────────────────────────────────────────────────────
// REGRA DE OURO: toda vez que você criar um comportamento específico de um cliente
// (visual OU regra de negócio), REGISTRE a chave aqui ANTES de usar no código.
// Assim existe um único lugar que responde "o que dá pra customizar por cliente?".
//
// Convenção de namespaces (use sempre um destes prefixos):
//   ui.*       → aparência (cores, colunas, labels, ordem)
//   features.* → liga/desliga uma feature inteira (flag booleana)
//   rules.*    → regra de negócio (validação, cálculo, fluxo, limites)
//
// Cada leitura no código DEVE ter fallback legado: ausente = comportamento de hoje.
// Logo, mexer no Birigui nunca afeta os outros clientes.
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG_SCHEMA = {
  // ── UI ──────────────────────────────────────────────────────────────────────
  'ui.lancamentos.valorColBg': {
    tipo: 'string|null',
    legado: null, // null = cinza padrão (LC.secondary)
    desc: 'Cor de fundo da coluna VALOR na tabela de lançamentos.',
    lidoEm: 'src/pages/Lancamentos.jsx',
    exemplo: '#fef9c3', // amarelo claro
  },

  // ── REGRAS DE NEGÓCIO (exemplos prontos para você ativar/adaptar) ────────────
  // Descomente/registre conforme for implementando. Mantenha SEMPRE o fallback no código.
  //
  // 'rules.lancamentos.cdcObrigatorio': {
  //   tipo: 'boolean',
  //   legado: false, // hoje o CDC é opcional
  //   desc: 'Exige o campo CDC preenchido para salvar um lançamento.',
  //   lidoEm: 'src/pages/Lancamentos.jsx (validação do submit)',
  // },
  //
  // 'rules.lancamentos.aprovacaoAutomaticaAteValor': {
  //   tipo: 'number|null',
  //   legado: null, // hoje nada é aprovado automaticamente por valor
  //   desc: 'Lançamentos com valor <= X entram já aprovados (pula fila).',
  //   lidoEm: 'src/pages/Lancamentos.jsx / api notify-compras',
  // },
}

/** Lista as chaves conhecidas (útil para telas de admin/config no futuro). */
export function listConfigKeys() {
  return Object.keys(CONFIG_SCHEMA)
}

/** Default legado de uma chave registrada (fonte única da verdade). */
export function legacyDefault(path) {
  return CONFIG_SCHEMA[path]?.legado ?? null
}
