import { PlusIcon, BellIcon } from '@heroicons/react/24/outline'
import useStore from '../store/useStore'

export default function Header({ title, subtitle, action }) {
  const { currentUser } = useStore()

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 28px', borderBottom: '1px solid var(--border)',
      background: 'rgba(10,15,30,0.8)', backdropFilter: 'blur(10px)',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {action && (
          <button className="btn-primary" onClick={action.onClick}>
            <PlusIcon style={{ width: 16, height: 16 }} />
            {action.label}
          </button>
        )}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: currentUser?.cor || '#6366f1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
          border: '2px solid rgba(255,255,255,0.1)'
        }}>
          {currentUser?.avatar}
        </div>
      </div>
    </header>
  )
}
