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

export default function Header({ title, subtitle, action, accentColor = '#3b82f6' }) {
  const { currentUser } = useStore()
  const [theme, setTheme] = useTheme()
  const ActionIcon = action?.icon || PlusIcon

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 24px', borderBottom: '1px solid var(--sb-border)',
      background: theme === 'light' ? 'rgba(240,242,248,0.95)' : 'rgba(8,14,28,0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: -0.3 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, opacity: 0.8 }}>{subtitle}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('openGlobalSearch'))}
          title="Busca global (Ctrl+K)"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 13, minWidth: 180,
          }}
        >
          <MagnifyingGlassIcon style={{ width: 14, height: 14 }} />
          <span style={{ flex: 1, textAlign: 'left' }}>Buscar...</span>
          <kbd style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '1px 5px', letterSpacing: 0.5 }}>⌘K</kbd>
        </button>
        {action && (
          <button className="btn-primary" onClick={action.onClick}>
            <ActionIcon style={{ width: 15, height: 15 }} />
            {action.label}
          </button>
        )}
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px', cursor: 'pointer', display: 'flex', color: 'var(--text-secondary)' }}
        >
          {theme === 'dark' ? <SunIcon style={{ width: 15, height: 15 }} /> : <MoonIcon style={{ width: 15, height: 15 }} />}
        </button>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: currentUser?.cor || 'linear-gradient(135deg, #10b981, #0ea5e9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 12, cursor: 'pointer',
          border: '1.5px solid rgba(255,255,255,0.12)',
          color: '#fff',
        }}>
          {currentUser?.avatar}
        </div>
      </div>
    </header>
  )
}
