import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isAdmin } from '../lib/admin'
import Header from '../components/Header'
import { TrashIcon, PlusIcon, KeyIcon, LinkIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

export default function Acessos() {
  const [users, setUsers] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [inviteLink, setInviteLink] = useState('')
  const [aiMetrics, setAiMetrics] = useState(null)
  const navigate = useNavigate()

  function generateInviteLink() {
    const token = btoa(`invite-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    const link = `${window.location.origin}/login?invite=${token}`
    setInviteLink(link)
    const invites = JSON.parse(localStorage.getItem('invites') || '[]')
    invites.push({ token, created: new Date().toISOString() })
    localStorage.setItem('invites', JSON.stringify(invites.slice(-20)))
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink)
    toast.success('Link copiado!')
  }

  async function loadAiMetrics() {
    const today = new Date().toISOString().slice(0, 10)
    const monthStart = today.slice(0, 7) + '-01'
    const { data } = await supabase.from('ai_usage').select('user_id, tokens_input, tokens_output, created_at').gte('created_at', monthStart)
    if (!data) return
    setAiMetrics({
      totalReqs: data.length,
      totalTokens: data.reduce((s, r) => s + (r.tokens_input || 0) + (r.tokens_output || 0), 0),
      todayReqs: data.filter(r => r.created_at?.startsWith(today)).length,
      uniqueUsers: new Set(data.map(r => r.user_id)).size,
    })
  }

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (!isAdmin(data?.user)) { navigate('/'); return }
      setAuthUser(data.user)
      loadAiMetrics()
    })
    loadUsers()
  }, [])

  async function loadUsers() {
    const { data } = { data: null } // listUsers requer Admin API — gerenciar via painel do Supabase
    if (data?.users) setUsers(data.users)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!email || !password || !nome) { setError('Preencha nome, e-mail e senha.'); return }
    if (password.length < 6) { setError('A senha deve ter no mínimo 6 caracteres.'); return }
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'create_user', email, password, nome }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok || json.error) { setError(json.error || 'Erro ao criar usuário'); return }
    setSuccess(`Usuário ${email} criado com sucesso!`)
    setEmail('')
    setPassword('')
    setNome('')
    loadUsers()
  }

  async function handleResetPassword(userEmail) {
    setError('')
    setSuccess('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(userEmail)
    if (err) setError(err.message)
    else setSuccess(`Link de redefinição de senha enviado para ${userEmail}`)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header
        title="Controle de Acessos"
        subtitle="Gerencie os usuários que têm acesso ao sistema"
      />

      <div style={{ padding: '24px 28px', maxWidth: 700 }}>
        {/* Formulário de criação */}
        <div className="card" style={{ padding: 24, marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PlusIcon style={{ width: 20, height: 20, color: '#6366f1' }} />
            Criar novo acesso
          </div>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label">Nome</label>
              <input
                className="input"
                type="text"
                placeholder="Nome completo"
                value={nome}
                onChange={e => setNome(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="label">E-mail</label>
                <input
                  className="input"
                  type="email"
                  placeholder="usuario@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Senha</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Criando...' : '+ Criar usuário'}
              </button>
            </div>
          </form>
          {error && <div style={{ color: '#ef4444', marginTop: 12, fontSize: 13 }}>{error}</div>}
          {success && <div style={{ color: '#10b981', marginTop: 12, fontSize: 13 }}>{success}</div>}
        </div>

        {/* Métricas de uso da IA */}
        {aiMetrics && (
          <div className="card" style={{ padding: 20, marginBottom: 28, background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))', border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              🤖 Livia — Métricas do Mês
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Req. hoje', value: aiMetrics.todayReqs, color: '#6366f1' },
                { label: 'Req. no mês', value: aiMetrics.totalReqs, color: '#8b5cf6' },
                { label: 'Tokens usados', value: aiMetrics.totalTokens.toLocaleString('pt-BR'), color: '#06b6d4' },
                { label: 'Usuários ativos', value: aiMetrics.uniqueUsers, color: '#10b981' },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center', padding: 12, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Convite por link */}
        <div className="card" style={{ padding: 24, marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LinkIcon style={{ width: 20, height: 20, color: '#6366f1' }} />
            Convidar por link
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Gere um link de convite para enviar por WhatsApp ou e-mail. A pessoa acessa e cria sua própria conta.
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={generateInviteLink}>
              <LinkIcon style={{ width: 15, height: 15 }} /> Gerar link de convite
            </button>
            {inviteLink && (
              <>
                <input
                  className="input"
                  readOnly
                  value={inviteLink}
                  style={{ flex: 1, minWidth: 200, fontSize: 12 }}
                  onClick={e => e.target.select()}
                />
                <button className="btn-ghost" onClick={copyInviteLink} style={{ padding: '10px 14px' }}>
                  <ClipboardDocumentIcon style={{ width: 16, height: 16 }} />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="card" style={{ padding: 20, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#818cf8', marginBottom: 8 }}>Como funciona o acesso?</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            • Crie um usuário com e-mail e senha para cada pessoa que precisa acessar o sistema.<br />
            • O usuário criado pode fazer login em <strong style={{ color: 'var(--text-primary)' }}>/login</strong> com o e-mail e senha cadastrados.<br />
            • Para redefinir a senha de um usuário, use o botão de redefinição abaixo.<br />
            • Para remoção de usuários, acesse o painel do Supabase em Authentication &gt; Users.
          </div>
        </div>

        {/* Botão para abrir o painel de usuários do Supabase */}
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <a
            href="https://supabase.com/dashboard/project/yfxkgwlxoszbapvgtpee/auth/users"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            style={{ fontSize: 13 }}
          >
            Gerenciar usuários no Supabase →
          </a>
        </div>
      </div>
    </div>
  )
}
