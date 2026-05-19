import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [showSignUp, setShowSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
    else navigate(from, { replace: true })
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setError('')
    if (!nome.trim()) { setError('Informe seu nome.'); return }
    setLoading(true)
    const tel = telefone.replace(/\D/g, '')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: nome.trim(), whatsapp: tel || null } },
    })
    setLoading(false)
    if (error) setError(error.message)
    else alert('Cadastro realizado! Verifique seu e-mail para confirmar.')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        width: 380,
        padding: '36px 32px',
        background: 'var(--bg-card)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo_smartpro.png" alt="SmartPro" style={{ height: 336, objectFit: 'contain', marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Entre com seu e-mail e senha</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>E-mail</label>
            <input
              className="input"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ marginTop: 4, width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Senha</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ marginTop: 4, width: '100%' }}
            />
          </div>
          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', marginTop: 4, padding: '12px 0', fontSize: 15, fontWeight: 700, textAlign: 'center', justifyContent: 'center' }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div style={{ margin: '20px 0', borderTop: '1px solid var(--border)' }} />

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)', opacity: 0.5 }}>
          Acesso mediante convite. Entre em contato para solicitar acesso.
        </div>

        {error && (
          <div style={{
            marginTop: 16,
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            color: '#ef4444',
            fontSize: 13,
          }}>{error}</div>
        )}
      </div>
    </div>
  )
}
