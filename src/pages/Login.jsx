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
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden', background: '#040c1e' }}>

      {/* â”€â”€ Fundo: imagem desfocada â”€â”€ */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/tela%20de%20login/01_fundo_limpo_4k.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(3px) brightness(0.35)',
        transform: 'scale(1.08)',
        zIndex: 0,
      }} />

      {/* â”€â”€ Overlay principal: escurece e adiciona profundidade â”€â”€ */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(125deg, rgba(4,12,30,0.82) 0%, rgba(4,10,24,0.65) 50%, rgba(4,12,30,0.90) 100%)',
        zIndex: 1,
      }} />

      {/* â”€â”€ Gradiente radial central: iluminaÃ§Ã£o cinematogrÃ¡fica â”€â”€ */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(14,165,233,0.07) 0%, rgba(16,185,129,0.04) 40%, transparent 70%)',
        zIndex: 2,
      }} />

      {/* â”€â”€ Coluna esquerda: branding â”€â”€ */}
      <div className="login-left" style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 3,
        padding: '60px 48px',
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'absolute',
            width: 520,
            height: 260,
            background: 'radial-gradient(ellipse, rgba(16,185,129,0.20) 0%, rgba(14,165,233,0.12) 50%, transparent 75%)',
            filter: 'blur(40px)',
            borderRadius: '50%',
          }} />
          <img
            src="/tela%20de%20login/02_logo_smartpro_4k.png"
            alt="SmartPro"
            style={{
              maxWidth: 720,
              width: '92%',
              objectFit: 'contain',
              position: 'relative',
              filter: 'drop-shadow(0 4px 28px rgba(16,185,129,0.28)) drop-shadow(0 2px 10px rgba(14,165,233,0.18))',
            }}
          />
        </div>
      </div>

      {/* â”€â”€ Coluna direita: Card de login â”€â”€ */}
      <div className="login-right" style={{
        width: 500,
        minWidth: 340,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 3,
        padding: '40px 32px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: 'rgba(6,14,33,0.72)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderRadius: 22,
          border: '1px solid rgba(255,255,255,0.07)',
          padding: '44px 40px',
          boxShadow: '0 0 0 1px rgba(14,165,233,0.06), 0 32px 80px rgba(0,0,0,0.65), 0 8px 32px rgba(0,0,0,0.4)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Reflexo sutil no topo do card */}
          <div style={{
            position: 'absolute',
            top: 0, left: '10%', right: '10%',
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
          }} />

          {/* TÃ­tulo */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', marginBottom: 8, letterSpacing: -0.6, lineHeight: 1.2 }}>
              Bem-vindo de volta
            </h1>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6 }}>
              Acesse sua conta no{' '}
              <span style={{ color: '#10b981', fontWeight: 600 }}>SmartPro</span>.
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* E-mail */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
                E-mail
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#334155', display: 'flex', pointerEvents: 'none' }}>
                  <MailIcon />
                </span>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%', paddingLeft: 42, paddingRight: 16, paddingTop: 13, paddingBottom: 13,
                    background: 'rgba(4,10,24,0.7)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, color: '#cbd5e1', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(16,185,129,0.45)'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.08)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
                Senha
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#334155', display: 'flex', pointerEvents: 'none' }}>
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="**********"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%', paddingLeft: 42, paddingRight: 44, paddingTop: 13, paddingBottom: 13,
                    background: 'rgba(4,10,24,0.7)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, color: '#cbd5e1', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(16,185,129,0.45)'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.08)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#334155', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Lembrar + Esqueceu */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: '#64748b' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#10b981', width: 14, height: 14, cursor: 'pointer' }}
                />
                Lembrar de mim
              </label>
              <button type="button" style={{ background: 'none', border: 'none', color: '#10b981', fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 500, opacity: 0.85 }}>
                Esqueceu sua senha?
              </button>
            </div>

            {/* BotÃ£o Entrar */}
            <button
              type="submit"
              disabled={loading}
              className="login-btn-enter"
              style={{
                width: '100%', padding: '14px 0',
                fontSize: 14, fontWeight: 700, color: '#fff',
                background: loading ? 'rgba(30,41,59,0.8)' : 'linear-gradient(90deg, #10b981 0%, #0ea5e9 100%)',
                border: 'none', borderRadius: 10,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: 0.4, marginTop: 4,
                transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.15s',
                boxShadow: loading ? 'none' : '0 4px 24px rgba(16,185,129,0.30), 0 1px 4px rgba(0,0,0,0.3)',
              }}
            >
              {loading ? 'Entrando...' : 'Entrar na plataforma'}
            </button>
          </form>

          {/* Divisor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 12, color: '#334155' }}>ou</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Acesso mediante convite */}
          <button
            type="button"
            className="login-btn-invite"
            style={{
              width: '100%', padding: '13px 0',
              fontSize: 13, fontWeight: 500, color: '#64748b',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              transition: 'border-color 0.2s, color 0.2s',
            }}
          >
            <MailIcon />
            Acesso mediante convite
          </button>

          {/* RodapÃ© */}
          <p style={{ marginTop: 22, fontSize: 12, color: '#334155', textAlign: 'center', lineHeight: 1.75 }}>
            Precisa de ajuda?{' '}
            <a href="mailto:suporte@smartpro.app.br" style={{ color: '#10b981', textDecoration: 'none', fontWeight: 500 }}>Fale com o suporte</a>
            {' '}ou{' '}
            <a href="mailto:suporte@smartpro.app.br" style={{ color: '#10b981', textDecoration: 'none', fontWeight: 500 }}>solicite acesso</a>.
          </p>

          {error && (
            <div style={{
              marginTop: 16, padding: '10px 14px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, color: '#f87171', fontSize: 13,
            }}>{error}</div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .login-left { display: none !important; }
          .login-right { width: 100% !important; min-width: unset !important; }
        }
        .login-btn-enter:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(16,185,129,0.40), 0 2px 8px rgba(0,0,0,0.4) !important;
          opacity: 0.95;
        }
        .login-btn-enter:not(:disabled):active {
          transform: translateY(0px);
        }
        .login-btn-invite:hover {
          border-color: rgba(255,255,255,0.14) !important;
          color: #94a3b8 !important;
        }
      `}</style>
    </div>
  )
}
