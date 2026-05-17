import { useState, useEffect } from 'react'
import { PlusIcon, MagnifyingGlassIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import useStore from '../store/useStore'

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])
  return [theme, setTheme]
}

export default function Header({ title, subtitle, action }) {
  const { currentUser } = useStore()
  const [theme, setTheme] = useTheme()

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 28px', borderBottom: '1px solid var(--border)',
      background: theme === 'light' ? 'rgba(240,242,248,0.9)' : 'rgba(10,15,30,0.8)',
      backdropFilter: 'blur(10px)',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('openGlobalSearch'))}
          title="Busca global (Ctrl+K)"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 13,
          }}
        >
          <MagnifyingGlassIcon style={{ width: 15, height: 15 }} />
          <span>Buscar...</span>
          <kbd style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 5px' }}>Ctrl K</kbd>
        </button>
        {action && (
          <button className="btn-primary" onClick={action.onClick}>
            <PlusIcon style={{ width: 16, height: 16 }} />
            {action.label}
          </button>
        )}
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px', cursor: 'pointer', display: 'flex', color: 'var(--text-secondary)' }}
        >
          {theme === 'dark' ? <SunIcon style={{ width: 16, height: 16 }} /> : <MoonIcon style={{ width: 16, height: 16 }} />}
        </button>
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
