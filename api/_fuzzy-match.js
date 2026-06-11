// _fuzzy-match.js
// Motor de identificação cruzada: recebe texto bruto do OCR
// e retorna o nome canônico registrado no cadastro (diario_tarifas ou cadastros_clientes).
//
// Algoritmo em 4 camadas:
//   1. Normaliza (minúsculas, sem acento, sem pontuação)
//   2. Match exato normalizado
//   3. Substring bidirecional (um contém o outro)
//   4. Token overlap + Levenshtein
//   → confiança ≥ 80 → substitui pelo canônico; < 80 → mantém o raw

// ─── Normalização ────────────────────────────────────────────────────────────
export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .replace(/[^a-z0-9 ]/g, ' ')                        // só letras, números e espaço
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Distância de Levenshtein ─────────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

// ─── Similaridade 0–100 entre dois strings já normalizados ───────────────────
function similarity(na, nb) {
  if (!na || !nb) return 0
  if (na === nb) return 100

  // Substring bidirecional: "suzano" ⊂ "suzano papel e celulose" → alta confiança
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length)
    const longer  = Math.max(na.length, nb.length)
    // Quanto menor a diferença de tamanho, maior a confiança
    return Math.round(85 + (shorter / longer) * 10)
  }

  // Token overlap: palavras em comum / total de palavras únicas
  const ta = new Set(na.split(' '))
  const tb = new Set(nb.split(' '))
  const inter = [...ta].filter(t => tb.has(t)).length
  const union = new Set([...ta, ...tb]).size
  const tokenScore = union > 0 ? (inter / union) * 80 : 0

  // Levenshtein: quanto menor a distância, maior o score
  const dist = levenshtein(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  const levScore = maxLen > 0 ? (1 - dist / maxLen) * 80 : 0

  return Math.round(Math.max(tokenScore, levScore))
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Tenta identificar o nome canônico de uma empresa/cliente a partir de um texto bruto.
 *
 * @param {string} raw   - Texto extraído pelo OCR (ex: "suzano", "SUZANOO", "aszano")
 * @param {string[]} candidates - Lista de nomes canônicos registrados (ex: ["SUZANO PAPEL E CELULOSE"])
 * @param {number} threshold - Confiança mínima para substituição (padrão: 80)
 * @returns {{ canonical: string|null, confidence: number, raw: string }}
 *   canonical = nome canônico se confiança ≥ threshold, senão null
 *   confidence = 0–100
 *   raw = texto original inalterado
 */
export function matchEmpresa(raw, candidates, threshold = 80) {
  if (!raw || !candidates?.length) return { canonical: null, confidence: 0, raw }

  const nRaw = normalize(raw)
  if (!nRaw) return { canonical: null, confidence: 0, raw }

  let best = null
  let bestScore = 0

  for (const cand of candidates) {
    const nCand = normalize(cand)
    const score = similarity(nRaw, nCand)
    if (score > bestScore) {
      bestScore = score
      best = cand
    }
  }

  if (bestScore >= threshold) {
    return { canonical: best, confidence: bestScore, raw }
  }
  return { canonical: null, confidence: bestScore, raw }
}
