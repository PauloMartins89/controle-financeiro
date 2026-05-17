// E-mail do administrador — único que pode acessar /acessos e criar novos usuários
export const ADMIN_EMAIL = 'ph.mar89s@gmail.com'

export function isAdmin(user) {
  return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}
