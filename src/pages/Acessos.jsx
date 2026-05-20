import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import {
  TrashIcon, PlusIcon, KeyIcon, LinkIcon, ClipboardDocumentIcon,
  UserGroupIcon, PuzzlePieceIcon, UsersIcon, PencilSquareIcon,
  CheckCircleIcon, XCircleIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

// ─── Permissões disponíveis por módulo ───────────────────────────────────────
const MODULOS_PERMISSOES = [
  { modulo: 'compras',   acoes: ['ver', 'criar', 'aprovar', 'cotar', 'receber', 'parametros'] },
  { modulo: 'refeicoes', acoes: ['ver', 'criar', 'aprovar', 'fechar'] },
  { modulo: 'efetivo',   acoes: ['ver', 'criar', 'editar'] },
  { modulo: 'financeiro',acoes: ['ver', 'criar', 'editar', 'deletar'] },
  { modulo: 'relatorios',acoes: ['ver', 'exportar'] },
]

// ─── Aba Perfis ──────────────────────────────────────────────────────────────
function AbaPerfis({ workspaceId }) {
  const [perfis, setPerfis] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [permissoes, setPermissoes] = useState([]) // ['modulo.acao', ...]
  const [nomePerfil, setNomePerfil] = useState('')
  const [descPerfil, setDescPerfil] = useState('')
  const [criando, setCriando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const carregarPerfis = useCallback(async () => {
    if (!workspaceId) return
    const { data } = await supabase.from('perfis').select('id, nome, descricao, is_padrao').eq('workspace_id', workspaceId).order('nome')
    setPerfis(data || [])
  }, [workspaceId])

  useEffect(() => { carregarPerfis() }, [carregarPerfis])

  async function abrirPerfil(perfil) {
    setSelecionado(perfil)
    const { data } = await supabase.from('perfil_permissoes').select('modulo, acao').eq('perfil_id', perfil.id)
    setPermissoes((data || []).map(p => `${p.modulo}.${p.acao}`))
  }

  function togglePermissao(key) {
    setPermissoes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  async function salvarPermissoes() {
    if (!selecionado) return
    setSalvando(true)
    // Remove tudo e reinseré (mais simples que diff)
    await supabase.from('perfil_permissoes').delete().eq('perfil_id', selecionado.id)
    if (permissoes.length > 0) {
      const rows = permissoes.map(p => {
        const [modulo, acao] = p.split('.')
        return { perfil_id: selecionado.id, modulo, acao }
      })
      await supabase.from('perfil_permissoes').insert(rows)
    }
    setSalvando(false)
    toast.success('Permissões salvas!')
  }

  async function criarPerfil(e) {
    e.preventDefault()
    if (!nomePerfil.trim()) return
    const { data, error } = await supabase.from('perfis').insert({ workspace_id: workspaceId, nome: nomePerfil.trim(), descricao: descPerfil.trim() }).select().single()
    if (error) { toast.error(error.message); return }
    toast.success('Perfil criado!')
    setNomePerfil(''); setDescPerfil(''); setCriando(false)
    carregarPerfis()
    abrirPerfil(data)
  }

  async function excluirPerfil(id) {
    if (!window.confirm('Excluir este perfil? Os membros vinculados perderão o perfil (voltarão a ter acesso total).')) return
    await supabase.from('perfis').delete().eq('id', id)
    toast.success('Perfil excluído.')
    if (selecionado?.id === id) setSelecionado(null)
    carregarPerfis()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista de perfis */}
      <div className="lg:col-span-1 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Perfis criados</p>
          <button onClick={() => setCriando(v => !v)} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            <PlusIcon className="w-4 h-4" />{criando ? 'Cancelar' : 'Novo perfil'}
          </button>
        </div>

        {criando && (
          <form onSubmit={criarPerfil} className="bg-indigo-50 rounded-xl p-4 space-y-2 border border-indigo-200">
            <input
              className="input w-full text-sm"
              placeholder="Nome do perfil (ex: Comprador)"
              value={nomePerfil}
              onChange={e => setNomePerfil(e.target.value)}
              required autoFocus
            />
            <input
              className="input w-full text-sm"
              placeholder="Descrição (opcional)"
              value={descPerfil}
              onChange={e => setDescPerfil(e.target.value)}
            />
            <button className="btn-primary w-full text-sm py-2" type="submit">Criar</button>
          </form>
        )}

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {perfis.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Nenhum perfil criado ainda.</div>
          ) : perfis.map(p => (
            <div key={p.id} className={`flex items-center justify-between px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${selecionado?.id === p.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''}`} onClick={() => abrirPerfil(p)}>
              <div>
                <p className={`text-sm font-medium ${selecionado?.id === p.id ? 'text-indigo-700' : 'text-gray-900'}`}>{p.nome}</p>
                {p.descricao && <p className="text-xs text-gray-400">{p.descricao}</p>}
              </div>
              <button onClick={e => { e.stopPropagation(); excluirPerfil(p.id) }} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors">
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Matriz de permissões */}
      <div className="lg:col-span-2">
        {!selecionado ? (
          <div className="bg-white rounded-xl border border-gray-100 flex items-center justify-center py-16 text-sm text-gray-400">
            Selecione um perfil para configurar as permissões
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-indigo-500" />
                <p className="text-sm font-semibold text-gray-700">{selecionado.nome}</p>
              </div>
              <button onClick={salvarPermissoes} disabled={salvando} className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {salvando ? 'Salvando…' : 'Salvar permissões'}
              </button>
            </div>
            <div className="p-4 space-y-4">
              {MODULOS_PERMISSOES.map(({ modulo, acoes }) => (
                <div key={modulo}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{modulo}</p>
                  <div className="flex flex-wrap gap-2">
                    {acoes.map(acao => {
                      const key = `${modulo}.${acao}`
                      const ativo = permissoes.includes(key)
                      return (
                        <label key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-colors ${ativo ? 'bg-indigo-100 border-indigo-300 text-indigo-800 font-medium' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          <input type="checkbox" checked={ativo} onChange={() => togglePermissao(key)} className="w-3 h-3 accent-indigo-600" />
                          {acao}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Aba Membros ─────────────────────────────────────────────────────────────
// Recebe apiWs para buscar membros com e-mails via admin API
function AbaMembros({ workspaceId, apiWs }) {
  const [membros, setMembros] = useState([])
  const [perfis, setPerfis] = useState([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(null)

  const carregarMembros = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    // Busca membros com e-mails via API e perfis via Supabase em paralelo
    const [apiRes, { data: p }] = await Promise.all([
      apiWs({ action: 'workspace-members-list' }),
      supabase.from('perfis').select('id, nome').eq('workspace_id', workspaceId).order('nome'),
    ])
    setMembros(apiRes?.members || [])
    setPerfis(p || [])
    setLoading(false)
  }, [workspaceId, apiWs])

  useEffect(() => { carregarMembros() }, [carregarMembros])

  async function alterarPerfil(membroId, perfilId) {
    setSalvando(membroId)
    await supabase.from('workspace_members').update({ perfil_id: perfilId || null }).eq('id', membroId)
    setMembros(prev => prev.map(m => m.id === membroId ? { ...m, perfil_id: perfilId || null } : m))
    setSalvando(null)
    toast.success('Grupo atualizado!')
  }

  async function alterarAtivo(membroId, ativo) {
    setSalvando(membroId)
    await supabase.from('workspace_members').update({ ativo }).eq('id', membroId)
    setMembros(prev => prev.map(m => m.id === membroId ? { ...m, ativo } : m))
    setSalvando(null)
    toast.success(ativo ? 'Usuário reativado.' : 'Usuário desativado.')
  }

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm">Carregando membros…</div>

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left">Usuário</th>
            <th className="px-4 py-3 text-left">Grupo de acesso</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Desde</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {membros.map(m => (
            <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${!m.ativo ? 'opacity-50' : ''}`}>
              <td className="px-4 py-3">
                <p className="text-sm font-medium text-gray-800">{m.nome || m.email}</p>
                <p className="text-xs text-gray-400">{m.email}</p>
              </td>
              <td className="px-4 py-3">
                <select
                  value={m.perfil_id || ''}
                  onChange={e => alterarPerfil(m.id, e.target.value)}
                  disabled={salvando === m.id}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="">Admin total</option>
                  {perfis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => alterarAtivo(m.id, !m.ativo)}
                  disabled={salvando === m.id}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors ${m.ativo ? 'bg-green-50 border-green-200 text-green-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700' : 'bg-red-50 border-red-200 text-red-700 hover:bg-green-50 hover:border-green-200 hover:text-green-700'}`}
                >
                  {m.ativo ? <><CheckCircleIcon className="w-3 h-3" />Ativo</> : <><XCircleIcon className="w-3 h-3" />Inativo</>}
                </button>
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">{new Date(m.created_at).toLocaleDateString('pt-BR')}</td>
            </tr>
          ))}
          {membros.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Nenhum membro encontrado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Helper: chama /api/admin com o JWT do usuário logado ───────────────────
async function apiWs(body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function Acessos() {
  const [aba, setAba] = useState('usuarios')
  const workspaceId   = useStore(s => s.workspaceId)
  const isPlatformAdmin = useStore(s => s.isPlatformAdmin)
  const permissoes    = useStore(s => s.permissoes)
  const isWorkspaceAdmin = isPlatformAdmin || permissoes.includes('*')

  // ── Estado: criar usuário (empresa admin) ─────────────────────────────────
  const [wsEmail,   setWsEmail]   = useState('')
  const [wsNome,    setWsNome]    = useState('')
  const [wsSenha,   setWsSenha]   = useState('')
  const [wsLoading, setWsLoading] = useState(false)
  const [wsError,   setWsError]   = useState('')
  const [wsSuccess, setWsSuccess] = useState('')

  // ── Estado: criar usuário (plataforma admin) ──────────────────────────────
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [aiMetrics, setAiMetrics]   = useState(null)

  // Adiciona usuário ao workspace (ação de empresa admin)
  async function handleWsAddUser(e) {
    e.preventDefault()
    setWsError(''); setWsSuccess('')
    if (!wsEmail || !wsNome) { setWsError('Preencha nome e e-mail.'); return }
    setWsLoading(true)
    const json = await apiWs({ action: 'workspace-add-user', email: wsEmail, nome: wsNome, password: wsSenha || undefined })
    setWsLoading(false)
    if (json.error) { setWsError(json.error); return }
    setWsSuccess(`${wsEmail} adicionado com sucesso!`)
    setWsEmail(''); setWsNome(''); setWsSenha('')
  }

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
    if (isPlatformAdmin) loadAiMetrics()
  }, [isPlatformAdmin])

  async function handleCreate(e) {
    e.preventDefault()
    setError(''); setSuccess('')
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
    setEmail(''); setPassword(''); setNome('')
  }

  const abas = [
    { key: 'usuarios', label: 'Usuários', icon: UsersIcon },
    { key: 'perfis',   label: 'Grupos de Acesso', icon: ShieldCheckIcon },
    { key: 'membros',  label: 'Membros & Grupos', icon: UserGroupIcon },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Controle de Acessos" subtitle="Gerencie usuários, perfis e permissões do seu workspace" />

      <div className="p-6 space-y-6" style={{ maxWidth: 960 }}>
        {/* Abas */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {abas.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* Aba: Usuários */}
        {aba === 'usuarios' && (
          <div className="space-y-6" style={{ maxWidth: 680 }}>

            {/* Adicionar usuário ao workspace (admin da empresa) */}
            {isWorkspaceAdmin && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PlusIcon style={{ width: 20, height: 20, color: '#6366f1' }} />
                  Adicionar usuário ao workspace
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Crie um novo usuário ou adicione alguém que já existe na plataforma.
                  Após adicionar, vá em <strong>Membros &amp; Grupos</strong> para atribuir o grupo de acesso.
                </p>
                <form onSubmit={handleWsAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label">Nome completo</label>
                      <input className="input" type="text" placeholder="Ex: João da Silva" value={wsNome} onChange={e => setWsNome(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">E-mail</label>
                      <input className="input" type="email" placeholder="usuario@empresa.com" value={wsEmail} onChange={e => setWsEmail(e.target.value)} required />
                    </div>
                  </div>
                  <div>
                    <label className="label">Senha (opcional — gerada automaticamente se vazia)</label>
                    <input className="input" type="password" placeholder="Deixe em branco para gerar automaticamente" value={wsSenha} onChange={e => setWsSenha(e.target.value)} />
                  </div>
                  <button className="btn-primary" type="submit" disabled={wsLoading} style={{ marginTop: 4 }}>
                    {wsLoading ? 'Adicionando...' : '+ Adicionar usuário'}
                  </button>
                </form>
                {wsError   && <div style={{ color: '#ef4444', marginTop: 12, fontSize: 13 }}>{wsError}</div>}
                {wsSuccess && <div style={{ color: '#10b981', marginTop: 12, fontSize: 13 }}>{wsSuccess}</div>}
              </div>
            )}

            {/* Métricas IA (só platform admin) */}
            {isPlatformAdmin && aiMetrics && (
              <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🤖 Livia — Métricas do Mês</div>
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

            {/* Ferramentas de plataforma admin */}
            {isPlatformAdmin && (
              <>
                {/* Criar usuário global (plataforma admin) */}
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <KeyIcon style={{ width: 18, height: 18, color: '#8b5cf6' }} />
                    Criar usuário global (plataforma)
                  </div>
                  <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label className="label">Nome</label>
                      <input className="input" type="text" placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} required />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label className="label">E-mail</label>
                        <input className="input" type="email" placeholder="usuario@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                      </div>
                      <div>
                        <label className="label">Senha</label>
                        <input className="input" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} required />
                      </div>
                    </div>
                    <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
                      {loading ? 'Criando...' : '+ Criar usuário'}
                    </button>
                  </form>
                  {error   && <div style={{ color: '#ef4444', marginTop: 12, fontSize: 13 }}>{error}</div>}
                  {success && <div style={{ color: '#10b981', marginTop: 12, fontSize: 13 }}>{success}</div>}
                </div>

                {/* Convite por link */}
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LinkIcon style={{ width: 20, height: 20, color: '#6366f1' }} />
                    Convidar por link
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                    Gere um link de convite para enviar por WhatsApp ou e-mail.
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn-primary" onClick={generateInviteLink}>
                      <LinkIcon style={{ width: 15, height: 15 }} /> Gerar link de convite
                    </button>
                    {inviteLink && (
                      <>
                        <input className="input" readOnly value={inviteLink} style={{ flex: 1, minWidth: 200, fontSize: 12 }} onClick={e => e.target.select()} />
                        <button className="btn-ghost" onClick={copyInviteLink} style={{ padding: '10px 14px' }}>
                          <ClipboardDocumentIcon style={{ width: 16, height: 16 }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <a href="https://supabase.com/dashboard/project/yfxkgwlxoszbapvgtpee/auth/users" target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: 13 }}>
                    Gerenciar usuários no Supabase →
                  </a>
                </div>
              </>
            )}

            {!isWorkspaceAdmin && !isPlatformAdmin && (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
                <ShieldCheckIcon style={{ width: 40, height: 40, margin: '0 auto 12px', color: '#d1d5db' }} />
                <p style={{ fontWeight: 600 }}>Acesso restrito</p>
                <p style={{ fontSize: 13 }}>Apenas o administrador do workspace pode gerenciar usuários.</p>
              </div>
            )}
          </div>
        )}

        {/* Aba: Perfis & Permissões */}
        {aba === 'perfis' && <AbaPerfis workspaceId={workspaceId} />}

        {/* Aba: Membros */}
        {aba === 'membros' && <AbaMembros workspaceId={workspaceId} apiWs={apiWs} />}
      </div>
    </div>
  )
}
