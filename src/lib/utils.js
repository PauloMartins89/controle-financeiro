// Utility helpers

export const CATEGORIAS = [
  'Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação',
  'Entretenimento', 'Viagem', 'Vestuário', 'Serviços', 'Lazer',
  'Pets', 'Tecnologia', 'Outros'
]

export const TIPOS_DIVISAO = [
  { value: 'igual', label: 'Divisão igual' },
  { value: 'porcentagem', label: 'Por porcentagem' },
  { value: 'valor_fixo', label: 'Valor fixo por pessoa' },
]

export const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'cancelado', label: 'Cancelado' },
]

export const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard']

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0)
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('pt-BR')
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export function getCategoryIcon(cat) {
  const icons = {
    'Alimentação': '🍔', 'Moradia': '🏠', 'Transporte': '🚗',
    'Saúde': '💊', 'Educação': '📚', 'Entretenimento': '🎬',
    'Viagem': '✈️', 'Vestuário': '👕', 'Serviços': '⚡',
    'Lazer': '🎮', 'Pets': '🐾', 'Tecnologia': '💻', 'Outros': '📦'
  }
  return icons[cat] || '📦'
}

export function getMonthRange(offsetMonths = 0) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1)
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }
}
