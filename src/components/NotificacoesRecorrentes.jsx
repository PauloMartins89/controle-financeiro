import { useState, useEffect } from 'react'
import { BellIcon, XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { formatCurrency } from '../lib/utils'

export default function NotificacoesRecorrentes() {
  const { recurring } = useStore()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  const today = new Date()
  const dismissKey = `notif-recorrentes-${today.toDateString()}`

  useEffect(() => {
    if (localStorage.getItem(dismissKey)) setDismissed(true)
  }, [])

  const vencendo = recurring.filter(r => {
    if (!r.ativo || !r.dia_vencimento) return false
    const day = parseInt(r.dia_vencimento)
    const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), day)
    const due = dueThisMonth >= today ? dueThisMonth : new Date(today.getFullYear(), today.getMonth() + 1, day)
    const diff = (due - today) / 86400000
    return diff >= 0 && diff <= 7
  }).sort((a, b) => parseInt(a.dia_vencimento) - parseInt(b.dia_vencimento))

  if (dismissed || vencendo.length === 0) return null

  const total = vencendo.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0)

  function dismiss() {
    localStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }

  return (
    <div style={{
      margin: '0 28px 0',
      padding: '12px 16px',
      background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(239,68,68,0.08))',
      border: '1px solid rgba(245,158,11,0.3)',
      borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 12,
      flexWrap: 'wrap',
    }}>
      <BellIcon style={{ width: 18, height: 18, color: '#f59e0b', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>
          {vencendo.length} conta{vencendo.length > 1 ? 's' : ''} vence{vencendo.length === 1 ? '' : 'm'} em até 7 dias
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
          {vencendo.slice(0, 3).map(r => r.descricao).join(', ')}
          {vencendo.length > 3 ? ` +${vencendo.length - 3}` : ''}
          {' · '}
          <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(total)}</strong>
        </span>
      </div>
      <button
        onClick={() => { navigate('/recorrentes'); dismiss() }}
        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#f59e0b', fontWeight: 600, flexShrink: 0 }}
      >
        Ver <ArrowRightIcon style={{ width: 12, height: 12 }} />
      </button>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}>
        <XMarkIcon style={{ width: 16, height: 16 }} />
      </button>
    </div>
  )
}
