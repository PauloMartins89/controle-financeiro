// ─── Normalization Rules ─────────────────────────────────────────────────────
// Order matters: more specific patterns first
const RULES = [
  // Food delivery
  { p: /IFOOD|IFOODS?\*/i,                    name: 'iFood',              cat: 'Alimentação',  rateio: 'casal' },
  { p: /RAPPI/i,                              name: 'Rappi',              cat: 'Alimentação',  rateio: 'casal' },
  { p: /JAMES\s*DEL|JAMES\s*FOOD/i,          name: 'James Delivery',     cat: 'Alimentação',  rateio: 'casal' },

  // Rideshare
  { p: /UBER/i,                               name: 'Uber',               cat: 'Transporte',   rateio: 'pessoal' },
  { p: /99(APP|POP|TAXI|\.?COM)?\s/i,         name: '99',                 cat: 'Transporte',   rateio: 'pessoal' },
  { p: /CABIFY/i,                             name: 'Cabify',             cat: 'Transporte',   rateio: 'pessoal' },

  // Streaming
  { p: /NETFLIX/i,                            name: 'Netflix',            cat: 'Lazer',        rateio: 'casal' },
  { p: /SPOTIFY/i,                            name: 'Spotify',            cat: 'Lazer',        rateio: 'casal' },
  { p: /AMAZON\s*PRIME|PRIME\s*VIDEO/i,       name: 'Amazon Prime',       cat: 'Lazer',        rateio: 'casal' },
  { p: /DISNEY[\s\+\*]?PLUS?|DISNEY\+/i,     name: 'Disney+',            cat: 'Lazer',        rateio: 'casal' },
  { p: /HBO\s*MAX?|MAX\s*(STREAM|BRAZI)/i,    name: 'Max',                cat: 'Lazer',        rateio: 'casal' },
  { p: /YOUTUBE\s*PREM/i,                     name: 'YouTube Premium',    cat: 'Lazer',        rateio: 'casal' },
  { p: /GLOBOPLAY/i,                          name: 'Globoplay',          cat: 'Lazer',        rateio: 'casal' },
  { p: /APPLE\s*(TV|ONE|MUSIC)/i,             name: 'Apple',              cat: 'Lazer',        rateio: 'casal' },
  { p: /DEEZER/i,                             name: 'Deezer',             cat: 'Lazer',        rateio: 'casal' },

  // Supermarkets
  { p: /PAO\s*DE\s*ACUCAR|P\.?\s*DE\s*ACUCAR|G\.?B\.?A/i, name: 'Pão de Açúcar', cat: 'Supermercado', rateio: 'casal' },
  { p: /CARREFOUR|CARREFUR/i,                 name: 'Carrefour',          cat: 'Supermercado', rateio: 'casal' },
  { p: /ATACADAO/i,                           name: 'Atacadão',           cat: 'Supermercado', rateio: 'casal' },
  { p: /ASSAI|ASSA[IÍ]/i,                     name: 'Assaí',              cat: 'Supermercado', rateio: 'casal' },
  { p: /\bEXTRA\b/i,                          name: 'Extra',              cat: 'Supermercado', rateio: 'casal' },
  { p: /PREZUNIC|GUANABARA|HORTIFRUTI/i,      name: 'Supermercado',       cat: 'Supermercado', rateio: 'casal' },
  { p: /SUPERMERCADO|SUPERMER|HIPER\s*MERC/i, name: 'Supermercado',       cat: 'Supermercado', rateio: 'casal' },

  // Pharmacies
  { p: /DROGASIL|RAIA\s*DRUG|DROGA\s*RAIA/i, name: 'Raia Drogasil',      cat: 'Saúde',        rateio: 'pessoal' },
  { p: /FARMACIA|DROGARIA|ULTRAFARMA|DROGATEL|DROGÃO/i, name: 'Farmácia', cat: 'Saúde',        rateio: 'pessoal' },
  { p: /DROGASIL|DROGÃO\s*SUPER/i,           name: 'Drogão',             cat: 'Saúde',        rateio: 'pessoal' },

  // Health
  { p: /HOSPITAL|CLINICA|MEDICO|UPA\s|PRONTO[\s-]?SOC/i, name: 'Saúde',  cat: 'Saúde',        rateio: 'pessoal' },
  { p: /AMIL|UNIMED|BRADESCO\s*SAUDE|SUL.?AMER.*SAUDE|HAPVIDA/i, name: 'Plano de Saúde', cat: 'Saúde', rateio: 'casal' },
  { p: /ACADEMIA|SMARTFIT|BODYTECH|BLUEFIT|GYM/i, name: 'Academia',      cat: 'Saúde',        rateio: 'pessoal' },

  // Fuel
  { p: /POSTO\s|SHELL|IPIRANGA|BR\s*(DIST|DIST|POSTO)?|PETROBRAS|COMBUSTIV/i, name: 'Combustível', cat: 'Transporte', rateio: 'pessoal' },

  // Fast food
  { p: /MCDONALD|MC\s*DONALD/i,              name: "McDonald's",         cat: 'Alimentação',  rateio: 'casal' },
  { p: /BURGER\s*KING|\bBK\b/i,              name: 'Burger King',        cat: 'Alimentação',  rateio: 'casal' },
  { p: /SUBWAY/i,                             name: 'Subway',             cat: 'Alimentação',  rateio: 'casal' },
  { p: /GIRAFFAS|FRANGO\s*ASSADO|HABIB'?S/i, name: 'Restaurante',        cat: 'Alimentação',  rateio: 'casal' },
  { p: /KFC\s|POPEYES|JERONIMO/i,            name: 'Fast Food',          cat: 'Alimentação',  rateio: 'casal' },

  // E-commerce
  { p: /AMAZON(?!\s*PRIME|\s*VIDEO|\s*AWS)/i, name: 'Amazon',            cat: 'Compras',      rateio: 'pessoal' },
  { p: /MERCADO\s*LIVRE|MELI\s*/i,           name: 'Mercado Livre',      cat: 'Compras',      rateio: 'pessoal' },
  { p: /SHOPEE/i,                             name: 'Shopee',             cat: 'Compras',      rateio: 'pessoal' },
  { p: /AMERICANAS/i,                         name: 'Americanas',         cat: 'Compras',      rateio: 'pessoal' },
  { p: /MAGAZINE\s*LUIZA|MAGALU/i,           name: 'Magazine Luiza',     cat: 'Compras',      rateio: 'pessoal' },
  { p: /CASAS\s*BAHIA/i,                     name: 'Casas Bahia',        cat: 'Compras',      rateio: 'pessoal' },
  { p: /ALIEXPRESS/i,                         name: 'AliExpress',         cat: 'Compras',      rateio: 'pessoal' },
  { p: /SHEIN/i,                              name: 'Shein',              cat: 'Compras',      rateio: 'pessoal' },

  // Utilities
  { p: /ENEL|CEMIG|COPEL|LIGHT\s*(SERV)?|ENERGISA|CPFL/i, name: 'Energia Elétrica', cat: 'Casa', rateio: 'casal' },
  { p: /SABESP|SANEPAR|COPASA|CAESB|COMPESA/i, name: 'Água e Esgoto',   cat: 'Casa',         rateio: 'casal' },
  { p: /COMGAS|GAS\s*NAT|GÁS\s*CANALI/i,     name: 'Gás',               cat: 'Casa',         rateio: 'casal' },
  { p: /ALUGUEL|CONDOMINIO|IMOBILIARIA|LOFT\s/i, name: 'Moradia',        cat: 'Casa',         rateio: 'casal' },
  { p: /CLARO|VIVO\s|TIM\s|NET\s*(VIRGI)?|OI\s*(MOVEL|FIBRA)?/i, name: 'Telecom', cat: 'Casa', rateio: 'casal' },

  // Travel
  { p: /HOTEL|POUSADA|HOSTEL/i,              name: 'Hospedagem',         cat: 'Viagem',       rateio: 'viagem' },
  { p: /BOOKING\.COM|AIRBNB|DECOLAR/i,       name: 'Hospedagem Online',  cat: 'Viagem',       rateio: 'viagem' },
  { p: /LATAM|GOL\s*(LINH)?|AZUL\s*(LINH)?|TAP\s*AIR/i, name: 'Passagem Aérea', cat: 'Viagem', rateio: 'viagem' },
  { p: /AEROPORTO|AIRPORT|GUARULHO|CONGONHA/i, name: 'Aeroporto',        cat: 'Viagem',       rateio: 'viagem' },

  // Education
  { p: /UDEMY|COURSERA|ALURA|ROCKETSEAT|DIO\.ME|HOTMART/i, name: 'Educação Online', cat: 'Educação', rateio: 'pessoal' },
  { p: /ESCOLA|COLEGIO|FACULDADE|MENSALIDADE\s*ESC/i, name: 'Educação',  cat: 'Educação',     rateio: 'pessoal' },

  // Games & entertainment
  { p: /STEAM\s|STEAMPOW|VALVE\s/i,          name: 'Steam',              cat: 'Lazer',        rateio: 'pessoal' },
  { p: /PLAYSTATION|PSN\s|SONY\s*INT/i,      name: 'PlayStation',        cat: 'Lazer',        rateio: 'pessoal' },
  { p: /XBOX|MICROSOFT\s*GAME/i,             name: 'Xbox',               cat: 'Lazer',        rateio: 'pessoal' },
  { p: /NINTENDO/i,                           name: 'Nintendo',           cat: 'Lazer',        rateio: 'pessoal' },

  // Food / restaurants (generic - keep last)
  { p: /RESTAURANTE|LANCHONETE|PIZZARIA|SUSHI/i, name: 'Restaurante',    cat: 'Alimentação',  rateio: 'casal' },
]

// ─── Category keyword fallback ────────────────────────────────────────────────
function guessCategory(raw) {
  const u = raw.toUpperCase()
  if (/MERCADO|SUPERMER|PADARIA|ACOUGUE|HORTIFRUTI|FEIRA|VERDURA/.test(u)) return { cat: 'Supermercado', rateio: 'casal' }
  if (/RESTAUR|LANCHE|PIZZA|SUSHI|COMIDA|BAR\s|BOTECO|CHURRAS|HAMBUR/.test(u)) return { cat: 'Alimentação', rateio: 'casal' }
  if (/FARMACIA|DROGARIA|MEDICAMENT|REMEDIOS/.test(u)) return { cat: 'Saúde', rateio: 'pessoal' }
  if (/POSTO|GASOLINA|ETANOL|ABASTEC|COMBUS/.test(u)) return { cat: 'Transporte', rateio: 'pessoal' }
  if (/SHOPPING|LOJA|ROUPA|CALCADO|VESTUARIO|MODA/.test(u)) return { cat: 'Compras', rateio: 'pessoal' }
  if (/ACADEMIA|FITNESS|GYM|ESPORTE/.test(u)) return { cat: 'Saúde', rateio: 'pessoal' }
  if (/ESCOLA|CURSO|FACULDADE|MENSALIDADE/.test(u)) return { cat: 'Educação', rateio: 'pessoal' }
  if (/ALUGUEL|CONDOMIN|IPTU|ENERGIA|AGUA\s/.test(u)) return { cat: 'Casa', rateio: 'casal' }
  if (/VIAGEM|HOTEL|PASSAGEM|VOO/.test(u)) return { cat: 'Viagem', rateio: 'viagem' }
  return { cat: 'Outros', rateio: 'pessoal' }
}

// ─── Clean raw description ────────────────────────────────────────────────────
function cleanDescription(raw) {
  return raw
    .replace(/\*[A-Z0-9]{3,}/g, '')    // Remove *CODES
    .replace(/\s+\d{2}\/\d{2}$/, '')    // Remove trailing date xx/xx
    .replace(/\s+\d+[xX]\s*$/, '')      // Remove parcel indicator
    .replace(/\b[A-Z0-9]{8,}\b/g, ' ')  // Remove long codes
    .replace(/\s+/g, ' ')
    .trim()
}

function toTitleCase(str) {
  const LOWER = ['de','da','do','das','dos','a','e','o','em','na','no','nas','nos','para','com','por']
  return str.split(' ').map((w, i) =>
    (i > 0 && LOWER.includes(w.toLowerCase()))
      ? w.toLowerCase()
      : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ')
}

// ─── Main normalizer ──────────────────────────────────────────────────────────
export function normalizeTransaction(raw) {
  if (!raw) return { nome: '', cat: 'Outros', rateio: 'pessoal', matched: false }

  for (const rule of RULES) {
    if (rule.p.test(raw)) {
      return { nome: rule.name, cat: rule.cat, rateio: rule.rateio, matched: true }
    }
  }

  const cleaned = cleanDescription(raw)
  const { cat, rateio } = guessCategory(raw)
  const nome = toTitleCase(cleaned) || raw

  return { nome, cat, rateio, matched: false }
}

// ─── Rateio suggestion → split config ────────────────────────────────────────
export function buildSugestaoRateio(rateio, people, currentUser) {
  const others = people.filter(p => p.id !== currentUser?.id)

  if (rateio === 'casal' && others.length >= 1) {
    return {
      label: 'Casal',
      tipo_divisao: 'igual',
      participantes: people.map(p => p.id),
      pago_por: currentUser?.id,
    }
  }

  if (rateio === 'viagem') {
    return {
      label: 'Viagem (todos)',
      tipo_divisao: 'igual',
      participantes: people.map(p => p.id),
      pago_por: currentUser?.id,
    }
  }

  if (rateio === 'amigos') {
    return {
      label: 'Amigos',
      tipo_divisao: 'igual',
      participantes: people.map(p => p.id),
      pago_por: currentUser?.id,
    }
  }

  // pessoal — only me, no split
  return {
    label: 'Pessoal',
    tipo_divisao: 'igual',
    participantes: [currentUser?.id],
    pago_por: currentUser?.id,
  }
}

// All categories for the select
export const IMPORT_CATEGORIAS = [
  'Alimentação', 'Supermercado', 'Transporte', 'Saúde', 'Lazer',
  'Compras', 'Casa', 'Educação', 'Viagem', 'Outros',
]

export const RATEIO_OPCOES = [
  { value: 'pessoal', label: '👤 Pessoal', desc: 'Só eu' },
  { value: 'casal', label: '👫 Casal', desc: 'Dividir com todos' },
  { value: 'viagem', label: '✈️ Viagem', desc: 'Rateio de viagem' },
  { value: 'amigos', label: '👥 Amigos', desc: 'Dividir com grupo' },
]

export const CAT_ICONS = {
  'Alimentação': '🍔', 'Supermercado': '🛒', 'Transporte': '🚗',
  'Saúde': '💊', 'Lazer': '🎮', 'Compras': '🛍️', 'Casa': '🏠',
  'Educação': '📚', 'Viagem': '✈️', 'Outros': '📦',
}
