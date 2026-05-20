import { supabase } from './supabase'

// Legado: mantido para compatibilidade durante a migração
export const ADMIN_EMAIL = 'ph.mar89s@gmail.com'

export function isAdmin(user) {
  return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}

// Novo: verifica via tabela platform_admins no banco de dados
export async function checkPlatformAdmin(userId) {
  if (!supabase || !userId) return false
  const { data } = await supabase
    .from('platform_admins')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}
