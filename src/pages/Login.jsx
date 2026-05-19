import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const EyeIcon = () => (
  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const EyeOffIcon = () => (
  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
)

const MailIcon = () => (
  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
)

const LockIcon = () => (
  <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
)

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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

  const inputStyle = {
    width: '100%',
    paddingLeft: 44,
    paddingRight: 16,
    paddingTop: 14,
    paddingBottom: 14,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 8,
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden', background: '#060d1f' }}>

      {/* Fundo com imagem desfocada */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/tela%20de%20login/01_fundo_limpo_4k.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(2px) brightness(0.45)',
        transform: 'scale(1.06)',
        zIndex: 0,
      }} />

      {/* Overlay gradiente */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(110deg, rgba(6,13,31,0.55) 40%, rgba(6,13,31,0.2) 100%)',
        zIndex: 1,
      }} />

      {/* Coluna esquerda — Logo */}
      <div className="login-left" style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 2,
        padding: '60px 40px',
      }}>
        <img
          src="/logo_smartpro.png"
          alt="SmartPro"
          style={{ maxWidth: 504, width: '96%', objectFit: 'contain', filter: 'drop-shadow(0 8px 32px rgba(16,185,129,0.25))' }}
        />
      </div>

      {/* Coluna direita — Card de login */}
      <div className="login-right" style={{
        width: 500,
        minWidth: 340,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 2,
        padding: '40px 32px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: 'rgba(8, 16, 38, 0.78)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 20,
          border: '1px solid rgba(96,165,250,0.18)',
          padding: '44px 40px',
          boxShadow: '0 30px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>

          {/* Título */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#f1f5f9', marginBottom: 10, letterSpacing: -0.5 }}>
              Bem-vindo
            </h1>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6 }}>
              Acesse sua conta para continuar<br />
              no <span style={{ color: '#10b981', fontWeight: 600 }}>SmartPro</span>.
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* E-mail */}
            <div>
              <label style={labelStyle}>E-mail</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', pointerEvents: 'none' }}>
                  <MailIcon />
                </span>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label style={labelStyle}>Senha</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', pointerEvents: 'none' }}>
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Lembrar + Esqueceu */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#94a3b8' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#10b981', width: 15, height: 15, cursor: 'pointer' }}
                />
                Lembrar de mim
              </label>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#10b981', fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 500 }}
              >
                Esqueceu sua senha?
              </button>
            </div>

            {/* Botão entrar */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px 0',
                fontSize: 15,
                fontWeight: 700,
                color: '#fff',
                background: loading ? '#1e293b' : 'linear-gradient(90deg, #10b981 0%, #0ea5e9 100%)',
                border: 'none',
                borderRadius: 10,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: 0.3,
                transition: 'opacity 0.2s',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(16,185,129,0.35)',
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Divisor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: 13, color: '#475569' }}>ou</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Acesso mediante convite */}
          <button
            type="button"
            style={{
              width: '100%',
              padding: '14px 0',
              fontSize: 14,
              fontWeight: 600,
              color: '#cbd5e1',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.13)',
              borderRadius: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'border-color 0.2s',
            }}
          >
            <MailIcon />
            Acesso mediante convite
          </button>

          {/* Rodapé */}
          <p style={{ marginTop: 24, fontSize: 12, color: '#475569', textAlign: 'center', lineHeight: 1.7 }}>
            Precisa de ajuda ou ainda não tem acesso?<br />
            Entre em contato com o{' '}
            <a href="mailto:suporte@smartpro.app.br" style={{ color: '#10b981', textDecoration: 'none' }}>suporte</a>
            {' '}ou{' '}
            <a href="mailto:suporte@smartpro.app.br" style={{ color: '#10b981', textDecoration: 'none' }}>solicite seu acesso</a>.
          </p>

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

      <style>{`
        @media (max-width: 768px) {
          .login-left { display: none !important; }
          .login-right { width: 100% !important; min-width: unset !important; }
        }
      `}</style>
    </div>
  )
}
