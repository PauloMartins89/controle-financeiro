// ─────────────────────────────────────────────────────────────────────────────
// workspaceConfig — leitura de flags de comportamento por cliente (workspace)
// ─────────────────────────────────────────────────────────────────────────────
// Contrato de isolamento:
//   1. O específico de cada cliente mora em DADOS (tabela workspace_config),
//      escopado por workspace_id — nunca em `if (nome === 'CLIENTE')` no código.
//   2. Toda leitura tem FALLBACK legado: config ausente = comportamento de hoje.
//      Logo, mexer no Cliente A nunca afeta B e C.
//   3. Feature nova de um cliente nasce em arquivo próprio, plugada por flag.
//
// Uso típico:
//   const cfg = await loadWorkspaceConfig(workspaceId)
//   if (getFlag(cfg, 'features.nova_feature_a')) { ... } else { /* legado */ }
//   const label = getConfig(cfg, 'labels.motorista', 'Motorista')
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'

const _cache = new Map() // workspaceId -> config object

/**
 * Carrega a config do workspace (com cache em memória).
 * Retorna SEMPRE um objeto — {} quando não há linha (fallback legado).
 */
export async function loadWorkspaceConfig(workspaceId, { force = false } = {}) {
  if (!workspaceId || !supabase) return {}
  if (!force && _cache.has(workspaceId)) return _cache.get(workspaceId)
  try {
    const { data, error } = await supabase
      .from('workspace_config')
      .select('config')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (error) throw error
    const cfg = data?.config || {}
    _cache.set(workspaceId, cfg)
    return cfg
  } catch {
    // Falha de rede / tabela ausente → cai no comportamento legado, nunca quebra
    return {}
  }
}

/** Limpa o cache (chame após salvar config). */
export function clearWorkspaceConfigCache(workspaceId) {
  if (workspaceId) _cache.delete(workspaceId)
  else _cache.clear()
}

/**
 * Lê um valor por caminho ("a.b.c") com default legado.
 * getConfig(cfg, 'labels.motorista', 'Motorista')
 */
export function getConfig(cfg, path, fallback = undefined) {
  if (!cfg || !path) return fallback
  const val = String(path).split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), cfg)
  return val === undefined || val === null ? fallback : val
}

/**
 * Lê uma feature-flag booleana. Ausente = false (comportamento legado).
 * getFlag(cfg, 'features.nova_feature_a')
 */
export function getFlag(cfg, path) {
  return getConfig(cfg, path, false) === true
}
