import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const EyeIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const EyeOffIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
)

const MailIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
)

const LockIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', overflow: 'hidden', background: '#fff', position: 'relative' }}>


      {/* Logo topo-esquerdo */}
      <div className="login-left" style={{
        flex: '0 0 58%',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '44px 52px',
        backgroundImage: 'url(/tela%20de%20login/sala%20ampla%20escritorio.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'right center',
        zIndex: 2,
      }}>
        {/* Overlay escuro */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(105deg, rgba(5,14,40,0.88) 0%, rgba(5,14,40,0.70) 60%, rgba(5,14,40,0.50) 100%)',
          zIndex: 0, pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <img src="/tela%20de%20login/logo_smartpro.png" alt="SmartPro" style={{ height: 48, width: 'auto' }} />
        </div>

        {/* Headline + features */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 42, fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: -1, marginBottom: 16 }}>
            Do apontamento<br/>ao faturamento,<br/>
            <span style={{ color: '#2dd4bf' }}>tudo conectado.</span>
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.62)', lineHeight: 1.65, maxWidth: 420, marginBottom: 36 }}>
            Centralize lançamentos, compras, refeições,<br/>
            manutenção, frota, aprovações e faturamento<br/>
            em uma única plataforma.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Operação',    icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
              { label: 'Aprovação',   icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              { label: 'Manutenção', icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg> },
              { label: 'Faturamento', icon: <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.85)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg> },
            ].map(f => (
              <div key={f.label} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, padding: '16px 20px', minWidth: 92, backdropFilter: 'blur(6px)',
              }}>
                {f.icon}
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.80)', fontWeight: 500 }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', margin: 0, position: 'relative', zIndex: 1 }}>
          © 2026 SmartPro. Plataforma para operações inteligentes.
        </p>
      </div>

      {/* Coluna direita: formulário limpo */}
      <div className="login-right" style={{
        flex: '0 0 42%',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 52px',
        position: 'relative',
        zIndex: 2,
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#111827', marginBottom: 6, letterSpacing: -0.5 }}>
              Bem-vindo ao SmartPro
            </h1>
            <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.5 }}>
              Acesse sua central de gestão operacional
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div>
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#374151', marginBottom: 7 }}>
                Email
              </label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  width: '100%', padding: '12px 14px',
                  background: '#f9fafb', border: '1.5px solid #e5e7eb',
                  borderRadius: 10, color: '#111827', fontSize: 14.5, outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit',
                }}
                onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)' }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <label style={{ fontSize: 13.5, fontWeight: 600, color: '#374151' }}>Senha</label>
                <button type="button" style={{ background: 'none', border: 'none', color: '#10b981', fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 500 }}>
                  Esqueci minha senha
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '12px 44px 12px 14px',
                    background: '#f9fafb', border: '1.5px solid #e5e7eb',
                    borderRadius: 10, color: '#111827', fontSize: 14.5, outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.12)' }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="login-btn-enter"
              style={{
                width: '100%', padding: '14px 0',
                fontSize: 15, fontWeight: 700, color: '#fff',
                background: loading ? '#9ca3af' : '#10b981',
                border: 'none', borderRadius: 10,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: 0.3, marginTop: 4,
                transition: 'background 0.15s, transform 0.1s, box-shadow 0.15s',
                boxShadow: loading ? 'none' : '0 4px 18px rgba(16,185,129,0.30)',
                fontFamily: 'inherit',
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {error && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, color: '#dc2626', fontSize: 13,
            }}>{error}</div>
          )}

          <p style={{ marginTop: 20, fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
            Acesso restrito a usuários autorizados
          </p>
        </div>

        {/* Banner: Instale o app */}
        <div style={{
          position: 'absolute', bottom: 28, left: 52, right: 52,
          display: 'flex', alignItems: 'center', gap: 12,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 12, padding: '12px 16px',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Instale o app</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Acesso rápido direto da tela inicial</div>
          </div>
          <button
            type="button"
            className="login-btn-install"
            style={{
              padding: '7px 16px', background: '#fff',
              border: '1.5px solid #10b981', borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: '#10b981',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
            }}
          >
            Instalar
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-left { display: none !important; }
          .login-right { flex: 1 !important; padding: 40px 28px !important; }
        }
        .login-btn-enter:not(:disabled):hover {
          background: #059669 !important;
          box-shadow: 0 6px 24px rgba(16,185,129,0.35) !important;
        }
        .login-btn-enter:not(:disabled):active { transform: translateY(1px); }
        .login-btn-install:hover { background: #f0fdf4 !important; }
      `}</style>
    </div>
  )
}
