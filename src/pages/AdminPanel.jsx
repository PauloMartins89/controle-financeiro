import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isAdmin } from '../lib/admin'
import Header from '../components/Header'
import {
  ArrowPathIcon, CheckCircleIcon, XCircleIcon,
  PencilIcon, TrashIcon, LinkIcon, PhoneIcon,
  ChatBubbleLeftRightIcon, UsersIcon, SignalIcon, CreditCardIcon,
  BuildingOffice2Icon, PlusIcon, ChevronDownIcon, ChevronUpIcon, TruckIcon,
  BellAlertIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import SaudeTab from './SaudeTab'

const ALL_MODULES = [
  { key: 'inicio',       label: 'Início' },
  { key: 'despesas',     label: 'Meus Gastos' },
  { key: 'acertos',      label: 'Acertos' },
  { key: 'recorrentes',  label: 'Fixos do Mês' },
  { key: 'cartoes',      label: 'Cartões' },
  { key: 'grupos',       label: 'Grupos' },
  { key: 'pessoas',      label: 'Pessoas' },
  { key: 'veiculos',     label: 'Veículos' },
  { key: 'historico',    label: 'Histórico' },
  { key: 'balanco',      label: 'Balanço' },
  { key: 'caixa',        label: 'Caixa' },
  { key: 'central',      label: 'Central Gerencial' },
  { key: 'lancamentos',  label: 'Lançamentos' },
  { key: 'cadastros',    label: 'Cadastros' },
  { key: 'proventos',    label: 'Proventos' },
  { key: 'faturamento',  label: 'Faturamento' },
  { key: 'importar',     label: 'Importar' },
  { key: 'escanear',     label: 'Escanear Doc.' },
  { key: 'notas-fiscais',label: 'Notas Fiscais' },
  { key: 'negocios',     label: 'Negócios' },
  { key: 'compras',      label: 'Compras' },
  { key: 'refeicoes',    label: 'Refeições' },
]



function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtTel(t) {
  if (!t) return '—'
  const n = t.replace(/\D/g, '')
  if (n.length === 13) return `+${n.slice(0,2)} (${n.slice(2,4)}) ${n.slice(4,9)}-${n.slice(9)}`
  if (n.length === 12) return `+${n.slice(0,2)} (${n.slice(2,4)}) ${n.slice(4,8)}-${n.slice(8)}`
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`
  return t
}

const TODOS_STATUS_NOTIF = [
  { value: 'aguardando_aprovacao', label: '⏳ Aguardando Aprovação' },
  { value: 'aprovado',             label: '✅ Aprovado' },
  { value: 'devolvido',            label: '⚠️ Devolvido' },
  { value: 'corrigido',            label: '🔧 Corrigido / Reenviado' },
  { value: 'reprovado',            label: '❌ Reprovado' },
  { value: 'faturado',             label: '💰 Faturado' },
  { value: 'cancelado',            label: '🚫 Cancelado' },
]

function WorkspaceNotifSection({ workspaceId }) {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ status: 'aprovado', nome_destinatario: '', phone_number: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('status_notificacoes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('status').order('created_at', { ascending: false })
    setRegistros(data || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    const phone = form.phone_number.replace(/\D/g, '')
    if (phone.length < 10) { toast.error('Número inválido — somente dígitos (ex: 5567999990000)'); return }
    if (!form.nome_destinatario.trim()) { toast.error('Informe o nome do destinatário'); return }
    setSaving(true)
    const { error } = await supabase.from('status_notificacoes').insert({
      workspace_id: workspaceId, status: form.status,
      nome_destinatario: form.nome_destinatario.trim(),
      phone_number: phone, ativo: true,
    })
    if (error) { toast.error('Erro: ' + error.message) }
    else { toast.success('Destinatário adicionado!'); setForm(f => ({ ...f, nome_destinatario: '', phone_number: '' })); load() }
    setSaving(false)
  }

  async function handleToggle(id, ativo) {
    await supabase.from('status_notificacoes').update({ ativo }).eq('id', id)
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, ativo } : r))
  }

  async function handleRemove(id) {
    if (!confirm('Remover este destinatário?')) return
    await supabase.from('status_notificacoes').delete().eq('id', id)
    setRegistros(prev => prev.filter(r => r.id !== id))
    toast.success('Removido')
  }

  const porStatus = TODOS_STATUS_NOTIF.map(s => ({
    ...s, items: registros.filter(r => r.status === s.value),
  })).filter(s => s.items.length > 0)

  const inp = { padding: '7px 10px', borderRadius: 7, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <BellAlertIcon style={{ width: 14, height: 14 }} /> Notificações por Status (WhatsApp)
      </div>

      {/* Form adicionar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <select style={{ ...inp, cursor: 'pointer', width: 200 }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          {TODOS_STATUS_NOTIF.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input style={{ ...inp, width: 180 }} placeholder="Nome (ex: Paulo Gestor)" value={form.nome_destinatario} onChange={e => setForm(f => ({ ...f, nome_destinatario: e.target.value }))} />
        <input style={{ ...inp, width: 160 }} placeholder="5567999990000" value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value.replace(/\D/g, '') }))} />
        <button onClick={handleAdd} disabled={saving} style={{ padding: '7px 16px', background: '#6366f1', border: 'none', borderRadius: 7, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {saving ? '...' : '+ Adicionar'}
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0' }}>Carregando...</div>
      ) : registros.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px dashed var(--border)' }}>
          Nenhum destinatário configurado. Adicione acima para enviar WhatsApp automaticamente ao mudar status.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {porStatus.map(grupo => (
            <div key={grupo.value}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 5 }}>{grupo.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {grupo.items.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: `1px solid ${r.ativo ? 'rgba(99,102,241,0.2)' : 'var(--border)'}` }}>
                    <PhoneIcon style={{ width: 14, height: 14, color: r.ativo ? '#818cf8' : 'var(--text-secondary)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.nome_destinatario}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>+{r.phone_number}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: r.ativo ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.05)', color: r.ativo ? '#818cf8' : 'var(--text-secondary)', fontWeight: 700 }}>
                      {r.ativo ? 'Ativo' : 'Pausado'}
                    </span>
                    <button onClick={() => handleToggle(r.id, !r.ativo)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11 }}>
                      {r.ativo ? 'Pausar' : 'Ativar'}
                    </button>
                    <button onClick={() => handleRemove(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                      <TrashIcon style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminPanel() {
  const navigate = useNavigate()
  const { section = 'saude' } = useParams()
  const tab = section
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ pessoas: [], canais: [], msgs: [], authUsers: [], assinaturas: [] })
  // Workspaces state
  const [workspaces, setWorkspaces] = useState([])
  const [wsMembers, setWsMembers] = useState([]) // todos os membros de todos os workspaces
  const [wsModules, setWsModules] = useState([]) // todos os módulos de todos os workspaces
  const [wsLoading, setWsLoading] = useState(false)
  const [expandedWs, setExpandedWs] = useState(null) // workspace_id expandido
  const [newWsNome, setNewWsNome] = useState('')
  const [newWsDesc, setNewWsDesc] = useState('')
  const [creatingWs, setCreatingWs] = useState(false)
  const [addMemberWsId, setAddMemberWsId] = useState(null)
  const [addMemberEmail, setAddMemberEmail] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editTel, setEditTel] = useState('')
  const [saving, setSaving] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserNome, setNewUserNome] = useState('')
  const [newUserTel, setNewUserTel] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)
  // Motoristas WhatsApp
  const [motoristas, setMotoristas] = useState([])
  const [motoristasLoading, setMotoristasLoading] = useState(false)
  const [newMotNome, setNewMotNome] = useState('')
  const [newMotTel, setNewMotTel] = useState('')
  const [newMotWsId, setNewMotWsId] = useState('')
  const [addingMot, setAddingMot] = useState(false)
  // Z-API status
  const [zapiStatus, setZapiStatus]     = useState(null)
  const [zapiChecking, setZapiChecking] = useState(false)

  const apiCall = useCallback(async (method, body) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch('/api/admin', {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
  }, [])

  const checkZapi = async () => {
    setZapiChecking(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin?action=test_zapi', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      const json = await res.json()
      setZapiStatus(json)
    } catch (e) {
      setZapiStatus({ erro: e?.message })
    } finally {
      setZapiChecking(false)
    }
  }

  const loadMotoristas = useCallback(async () => {
    setMotoristasLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin?action=list_motoristas', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      const json = await res.json()
      setMotoristas(json.motoristas || [])
    } catch { /* silencioso */ } finally {
      setMotoristasLoading(false)
    }
  }, [])

  const loadWorkspaces = useCallback(async () => {
    setWsLoading(true)
    try {
      const [{ data: ws }, { data: members }, { data: modules }] = await Promise.all([
        supabase.from('workspaces').select('*').order('created_at', { ascending: false }),
        supabase.from('workspace_members').select('*'),
        supabase.from('workspace_modules').select('*'),
      ])
      setWorkspaces(ws || [])
      setWsMembers(members || [])
      setWsModules(modules || [])
    } catch (e) {
      toast.error('Erro ao carregar workspaces')
    } finally {
      setWsLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/admin?action=dashboard', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setData(json)
    } catch (e) {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (!isAdmin(data?.user)) { navigate('/'); return }
      load()
      loadWorkspaces()
      loadMotoristas()
    })
  }, [])

  async function handleSaveTel(pessoaId) {
    setSaving(true)
    const result = await apiCall('POST', { action: 'update_telefone', pessoa_id: pessoaId, telefone: editTel })
    setSaving(false)
    if (result.error) { toast.error(result.error); return }
    toast.success('Número atualizado e canal vinculado!')
    setEditingId(null)
    setEditTel('')
    load()
  }

  async function handleToggle(canal) {
    const result = await apiCall('POST', { action: 'toggle_ativo', canal_id: canal.id, ativo: !canal.ativo })
    if (result.error) { toast.error(result.error); return }
    toast.success(canal.ativo ? 'Canal desativado' : 'Canal ativado')
    load()
  }

  async function handleUnlink(canalId) {
    if (!confirm('Remover vínculo de canal?')) return
    const result = await apiCall('POST', { action: 'unlink_canal', canal_id: canalId })
    if (result.error) { toast.error(result.error); return }
    toast.success('Canal removido')
    load()
  }

  // Mapeia canal por pessoa_id para acesso rápido
  const canalPorPessoa = {}
  data.canais.forEach(c => { canalPorPessoa[c.pessoa_id] = c })

  // Mapeia authUser por id para exibir e-mail
  const authById = {}
  data.authUsers.forEach(u => { authById[u.id] = u })

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Painel Administrativo" subtitle="Gerenciar sistema e configurações" />

      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button
            onClick={() => { load(); loadWorkspaces(); loadMotoristas() }}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}
          >
            <ArrowPathIcon style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : (
          <>
            {/* ── TAB: SAÚDE DO SISTEMA ─────────────────────────────────── */}
            {tab === 'saude' && <SaudeTab />}

            {/* ── TAB: WORKSPACES ─────────────────────────────────────────── */}
            {tab === 'workspaces' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Criar workspace */}
                <div className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Novo Workspace (empresa)</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome da empresa *</label>
                      <input className="input" placeholder="Ex: Clínica XYZ" value={newWsNome} onChange={e => setNewWsNome(e.target.value)}
                        style={{ width: 220, padding: '7px 10px', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descrição</label>
                      <input className="input" placeholder="Observação opcional" value={newWsDesc} onChange={e => setNewWsDesc(e.target.value)}
                        style={{ width: 260, padding: '7px 10px', fontSize: 13 }} />
                    </div>
                    <button
                      disabled={creatingWs || !newWsNome.trim()}
                      onClick={async () => {
                        if (!newWsNome.trim()) return
                        setCreatingWs(true)
                        try {
                          // Cria workspace
                          const { data: ws, error: wsErr } = await supabase
                            .from('workspaces')
                            .insert({ nome: newWsNome.trim(), descricao: newWsDesc.trim() || null })
                            .select().single()
                          if (wsErr) throw wsErr
                          // Habilita todos os módulos por padrão
                          const moduleRows = ALL_MODULES.map(m => ({
                            workspace_id: ws.id, module_key: m.key, enabled: true
                          }))
                          await supabase.from('workspace_modules').insert(moduleRows)
                          toast.success(`Workspace "${ws.nome}" criado!`)
                          setNewWsNome(''); setNewWsDesc('')
                          loadWorkspaces()
                        } catch (e) {
                          toast.error(e.message || 'Erro ao criar workspace')
                        } finally {
                          setCreatingWs(false)
                        }
                      }}
                      style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: !newWsNome.trim() ? 0.5 : 1 }}>
                      <PlusIcon style={{ width: 15, height: 15 }} />
                      {creatingWs ? 'Criando...' : 'Criar'}
                    </button>
                  </div>
                </div>

                {/* Lista de workspaces */}
                {wsLoading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando workspaces...</div>
                ) : workspaces.length === 0 ? (
                  <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Nenhum workspace criado ainda.
                  </div>
                ) : workspaces.map(ws => {
                  const members = wsMembers.filter(m => m.workspace_id === ws.id)
                  const modules = wsModules.filter(m => m.workspace_id === ws.id)
                  const enabledCount = modules.filter(m => m.enabled).length
                  const isExpanded = expandedWs === ws.id
                  // Monta mapa de módulo habilitado
                  const moduleMap = {}
                  modules.forEach(m => { moduleMap[m.module_key] = m.enabled })

                  return (
                    <div key={ws.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      {/* Header do workspace */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}
                        onClick={() => setExpandedWs(isExpanded ? null : ws.id)}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                          {ws.nome[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{ws.nome}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {ws.descricao || 'Sem descrição'} &nbsp;·&nbsp;
                            <span style={{ color: '#6366f1' }}>{members.length} membro{members.length !== 1 ? 's' : ''}</span>
                            &nbsp;·&nbsp;
                            <span style={{ color: enabledCount > 0 ? '#10b981' : '#ef4444' }}>{enabledCount} módulo{enabledCount !== 1 ? 's' : ''} ativo{enabledCount !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                            background: ws.ativo ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                            color: ws.ativo ? '#10b981' : '#ef4444'
                          }}>{ws.ativo ? 'Ativo' : 'Inativo'}</span>
                          {isExpanded
                            ? <ChevronUpIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
                            : <ChevronDownIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />}
                        </div>
                      </div>

                      {/* Detalhes expandidos */}
                      {isExpanded && (
                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                          {/* Membros */}
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Membros</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {members.map(m => {
                                const u = data.authUsers.find(u => u.id === m.user_id)
                                return (
                                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                                      {(u?.email || '?')[0].toUpperCase()}
                                    </div>
                                    <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{u?.email || m.user_id}</span>
                                    <button
                                      onClick={async () => {
                                        if (!confirm(`Remover este usuário do workspace "${ws.nome}"?`)) return
                                        const { error } = await supabase.from('workspace_members').delete().eq('id', m.id)
                                        if (error) { toast.error(error.message); return }
                                        toast.success('Membro removido')
                                        loadWorkspaces()
                                      }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, opacity: 0.7 }}>
                                      <TrashIcon style={{ width: 14, height: 14 }} />
                                    </button>
                                  </div>
                                )
                              })}
                              {members.length === 0 && (
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 12px' }}>Nenhum membro</div>
                              )}
                            </div>
                            {/* Adicionar membro */}
                            {addMemberWsId === ws.id ? (
                              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                                <input
                                  className="input"
                                  placeholder="E-mail do usuário"
                                  value={addMemberEmail}
                                  onChange={e => setAddMemberEmail(e.target.value)}
                                  autoFocus
                                  style={{ flex: 1, maxWidth: 280, padding: '7px 10px', fontSize: 13 }}
                                  onKeyDown={e => { if (e.key === 'Escape') { setAddMemberWsId(null); setAddMemberEmail('') } }}
                                />
                                <button
                                  disabled={addingMember || !addMemberEmail.trim()}
                                  onClick={async () => {
                                    if (!addMemberEmail.trim()) return
                                    setAddingMember(true)
                                    try {
                                      // Encontra user_id pelo email
                                      const u = data.authUsers.find(u => u.email.toLowerCase() === addMemberEmail.trim().toLowerCase())
                                      if (!u) { toast.error('Usuário não encontrado. Crie o usuário primeiro na aba Usuários.'); return }
                                      const { error } = await supabase.from('workspace_members')
                                        .insert({ workspace_id: ws.id, user_id: u.id })
                                      if (error) { toast.error(error.message); return }
                                      toast.success('Membro adicionado!')
                                      setAddMemberWsId(null); setAddMemberEmail('')
                                      loadWorkspaces()
                                    } finally {
                                      setAddingMember(false)
                                    }
                                  }}
                                  style={{ padding: '7px 14px', background: 'var(--accent)', border: 'none', borderRadius: 7, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                                  {addingMember ? '...' : 'Adicionar'}
                                </button>
                                <button onClick={() => { setAddMemberWsId(null); setAddMemberEmail('') }}
                                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>✕</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setAddMemberWsId(ws.id); setAddMemberEmail('') }}
                                style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px dashed var(--border)', borderRadius: 7, padding: '7px 12px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
                                <PlusIcon style={{ width: 13, height: 13 }} /> Adicionar membro
                              </button>
                            )}
                          </div>

                          {/* Módulos */}
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                              Módulos habilitados
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 8 }}>
                              {ALL_MODULES.map(mod => {
                                const enabled = moduleMap[mod.key] !== false // default true se não existir
                                return (
                                  <label key={mod.key} style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                    background: enabled ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)',
                                    borderRadius: 8, border: `1px solid ${enabled ? 'rgba(99,102,241,0.25)' : 'var(--border)'}`,
                                    cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
                                  }}>
                                    <input
                                      type="checkbox"
                                      checked={enabled}
                                      style={{ accentColor: '#6366f1', width: 15, height: 15 }}
                                      onChange={async (e) => {
                                        const newEnabled = e.target.checked
                                        // Upsert módulo
                                        const existing = modules.find(m => m.module_key === mod.key)
                                        if (existing) {
                                          await supabase.from('workspace_modules').update({ enabled: newEnabled }).eq('id', existing.id)
                                        } else {
                                          await supabase.from('workspace_modules').insert({ workspace_id: ws.id, module_key: mod.key, enabled: newEnabled })
                                        }
                                        // Atualiza estado local imediatamente
                                        setWsModules(prev => {
                                          if (existing) return prev.map(m => m.id === existing.id ? { ...m, enabled: newEnabled } : m)
                                          return [...prev, { id: Date.now(), workspace_id: ws.id, module_key: mod.key, enabled: newEnabled }]
                                        })
                                      }}
                                    />
                                    <span style={{ fontSize: 12, fontWeight: enabled ? 600 : 400, color: enabled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                      {mod.label}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>

                          {/* Ações do workspace */}
                          <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                            <button
                              onClick={async () => {
                                const newAtivo = !ws.ativo
                                await supabase.from('workspaces').update({ ativo: newAtivo }).eq('id', ws.id)
                                setWorkspaces(prev => prev.map(w => w.id === ws.id ? { ...w, ativo: newAtivo } : w))
                                toast.success(newAtivo ? 'Workspace ativado' : 'Workspace inativado')
                              }}
                              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>
                              {ws.ativo ? 'Inativar' : 'Ativar'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {/* ── TAB: NOTIFICAÇÕES ──────────────────────────────────── */}
            {tab === 'notificacoes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <BellAlertIcon style={{ width: 20, height: 20, color: '#818cf8' }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Notificações por Status (WhatsApp)</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Configure quem recebe mensagem automática quando um lançamento mudar de status</div>
                  </div>
                </div>
                {wsLoading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando workspaces...</div>
                ) : workspaces.length === 0 ? (
                  <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum workspace encontrado.</div>
                ) : workspaces.map(ws => (
                  <div key={ws.id} className="card" style={{ padding: '20px 24px' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <BuildingOffice2Icon style={{ width: 15, height: 15, color: 'var(--text-secondary)' }} />
                      {ws.nome}
                    </div>
                    <WorkspaceNotifSection workspaceId={ws.id} />
                  </div>
                ))}
              </div>
            )}

            {/* ── TAB: MOTORISTAS WA ─────────────────────────────────── */}
            {tab === 'motoristas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Formulário adicionar */}
                <div className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Cadastrar motorista</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Workspace *</label>
                      <select
                        value={newMotWsId}
                        onChange={e => setNewMotWsId(e.target.value)}
                        style={{ padding: '7px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: 200 }}
                      >
                        <option value="">Selecione...</option>
                        {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.nome}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome do motorista</label>
                      <input className="input" placeholder="Ex: João Silva" value={newMotNome} onChange={e => setNewMotNome(e.target.value)}
                        style={{ width: 180, padding: '7px 10px', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telefone WhatsApp *</label>
                      <input className="input" placeholder="5567999990000" value={newMotTel} onChange={e => setNewMotTel(e.target.value)}
                        style={{ width: 170, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace' }} />
                    </div>
                    <button
                      disabled={addingMot || !newMotWsId || !newMotTel.replace(/\D/g, '')}
                      onClick={async () => {
                        setAddingMot(true)
                        const r = await apiCall('POST', {
                          action: 'add_motorista',
                          workspace_id: newMotWsId,
                          phone_number: newMotTel.replace(/\D/g, ''),
                          nome_motorista: newMotNome.trim() || null,
                        })
                        setAddingMot(false)
                        if (r.error) { toast.error(r.error); return }
                        toast.success('Motorista cadastrado!')
                        setNewMotNome(''); setNewMotTel(''); setNewMotWsId('')
                        loadMotoristas()
                      }}
                      style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (!newMotWsId || !newMotTel) ? 0.5 : 1 }}>
                      <PlusIcon style={{ width: 15, height: 15 }} />
                      {addingMot ? 'Salvando...' : 'Cadastrar'}
                    </button>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
                    ⚠️ Telefone: somente dígitos com código do país (ex: <code>5567996898404</code>)
                  </div>
                </div>

                {/* Lista */}
                {motoristasLoading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando...</div>
                ) : (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                          {['Nome', 'Telefone', 'Workspace', 'Status', 'Ações'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {motoristas.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {m.nome_motorista || <span style={{ opacity: 0.4 }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: 12 }}>
                              {fmtTel(m.phone_number)}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>
                              {m.workspaces?.nome || m.workspace_id?.slice(0, 8)}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                                background: m.ativo ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                color: m.ativo ? '#10b981' : '#ef4444' }}>
                                {m.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  onClick={async () => {
                                    const r = await apiCall('POST', { action: 'toggle_motorista', id: m.id, ativo: !m.ativo })
                                    if (r.error) { toast.error(r.error); return }
                                    toast.success(m.ativo ? 'Inativado' : 'Ativado')
                                    loadMotoristas()
                                  }}
                                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11 }}>
                                  {m.ativo ? 'Inativar' : 'Ativar'}
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Remover ${m.nome_motorista || m.phone_number}?`)) return
                                    const r = await apiCall('POST', { action: 'delete_motorista', id: m.id })
                                    if (r.error) { toast.error(r.error); return }
                                    toast.success('Removido')
                                    loadMotoristas()
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, lineHeight: 0, opacity: 0.7 }}>
                                  <TrashIcon style={{ width: 14, height: 14 }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {motoristas.length === 0 && (
                          <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                            Nenhum motorista cadastrado. Adicione acima para habilitar recebimento de formulários via WhatsApp.
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {/* ── TAB: CONEXÕES ─────────────────────────────────────────── */}
            {tab === 'conexoes' && (
              <div>
                {/* Card status Z-API */}
                <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: zapiStatus ? 14 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <SignalIcon style={{ width: 18, height: 18, color: 'var(--accent)' }} />
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Status Z-API (WhatsApp)</span>
                    </div>
                    <button
                      onClick={checkZapi}
                      disabled={zapiChecking}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: zapiChecking ? 'var(--bg-secondary)' : 'var(--accent)', color: zapiChecking ? 'var(--text-secondary)' : '#0d0f12', fontWeight: 600, fontSize: 12, cursor: zapiChecking ? 'default' : 'pointer' }}>
                      <ArrowPathIcon style={{ width: 14, height: 14, animation: zapiChecking ? 'spin 1s linear infinite' : 'none' }} />
                      {zapiChecking ? 'Verificando...' : 'Verificar agora'}
                    </button>
                  </div>
                  {zapiStatus && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {/* Env vars */}
                      {zapiStatus.env && Object.entries(zapiStatus.env).map(([k, v]) => (
                        <div key={k} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                          <span style={{ fontFamily: 'monospace', color: String(v).startsWith('✅') ? '#10b981' : String(v).startsWith('❌') ? '#ef4444' : '#f97316', marginRight: 4 }}>{String(v).split(' ')[0]}</span>
                          <span>{k}</span>
                        </div>
                      ))}
                      {/* Conexão instância */}
                      {zapiStatus.zapi && (
                        <div style={{ width: '100%', marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 20, fontWeight: 700, fontSize: 13,
                            background: zapiStatus.zapi.conectado?.includes('CONECTADO') ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                            color: zapiStatus.zapi.conectado?.includes('CONECTADO') ? '#10b981' : '#ef4444',
                          }}>
                            {zapiStatus.zapi.conectado?.includes('CONECTADO')
                              ? <CheckCircleIcon style={{ width: 15, height: 15 }} />
                              : <XCircleIcon style={{ width: 15, height: 15 }} />}
                            {zapiStatus.zapi.conectado || zapiStatus.zapi.status || 'Sem resposta'}
                          </span>
                          {zapiStatus.zapi.smartphoneConnected != null && (
                            <span style={{ fontSize: 12, color: zapiStatus.zapi.smartphoneConnected ? '#10b981' : '#f97316' }}>
                              📱 Celular: {zapiStatus.zapi.smartphoneConnected ? 'online' : 'offline'}
                            </span>
                          )}
                          {zapiStatus.zapi.http_status && zapiStatus.zapi.http_status !== 200 && (
                            <span style={{ fontSize: 12, color: '#ef4444' }}>HTTP {zapiStatus.zapi.http_status}</span>
                          )}
                          {zapiStatus.zapi.mensagem && (
                            <span style={{ fontSize: 12, color: '#ef4444' }}>{zapiStatus.zapi.mensagem}</span>
                          )}
                        </div>
                      )}
                      {zapiStatus.erro && (
                        <div style={{ width: '100%', marginTop: 6, fontSize: 12, color: '#ef4444' }}>Erro: {zapiStatus.erro}</div>
                      )}
                    </div>
                  )}
                  {!zapiStatus && !zapiChecking && (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Clique em "Verificar agora" para checar a conexão com a Z-API.</p>
                  )}
                </div>
                <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
                  <StatBox label="Pessoas" value={data.pessoas.length} color="var(--accent)" />
                  <StatBox label="Canais ativos" value={data.canais.filter(c => c.ativo).length} color="#10b981" />
                  <StatBox label="Canais inativos" value={data.canais.filter(c => !c.ativo).length} color="#f97316" />
                  <StatBox label="Sem canal" value={data.pessoas.filter(p => !canalPorPessoa[p.id]).length} color="#ef4444" />
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        {['Pessoa', 'Conta (e-mail)', 'Telefone cadastrado', 'Canal WhatsApp', 'Status / Conta canal', 'Ações'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.pessoas.map(p => {
                        const canal = canalPorPessoa[p.id]
                        const authUser = authById[p.owner_id]
                        const isEditing = editingId === p.id
                        // Verifica se o owner_id do canal bate com o da pessoa
                        const canalOwnerOk = !canal || canal.owner_id === p.owner_id
                        const canalOwnerEmail = canal ? authById[canal.owner_id]?.email : null
                        // Detecta duplicata de dono: mesmo owner_id com is_owner=true em mais de uma pessoa
                        const donosDoMesmoUser = data.pessoas.filter(x => x.is_owner && x.owner_id === p.owner_id)
                        const isDonoDuplicado = p.is_owner && donosDoMesmoUser.length > 1 && !canal
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                            <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {p.nome}
                              {p.is_owner && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(0,200,150,0.15)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>dono</span>}
                            </td>

                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>
                              {authUser?.email || <span style={{ color: 'var(--text-secondary)', opacity: 0.4 }}>—</span>}
                            </td>

                            <td style={{ padding: '10px 14px' }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input
                                    value={editTel}
                                    onChange={e => setEditTel(e.target.value)}
                                    placeholder="55 + DDD + número"
                                    autoFocus
                                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, width: 160 }}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTel(p.id); if (e.key === 'Escape') { setEditingId(null); setEditTel('') } }}
                                  />
                                  <button onClick={() => handleSaveTel(p.id)} disabled={saving}
                                    style={{ background: 'var(--accent)', border: 'none', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: '#0d0f12', fontSize: 11, fontWeight: 700 }}>
                                    {saving ? '...' : 'Salvar'}
                                  </button>
                                  <button onClick={() => { setEditingId(null); setEditTel('') }}
                                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11 }}>
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ color: p.telefone ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>
                                    {p.telefone ? fmtTel(p.telefone) : '—'}
                                  </span>
                                  <button onClick={() => { setEditingId(p.id); setEditTel(p.telefone || '') }}
                                    title="Editar número"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2, lineHeight: 0, opacity: 0.6 }}>
                                    <PencilIcon style={{ width: 13, height: 13 }} />
                                  </button>
                                </div>
                              )}
                            </td>

                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: canal ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              {canal ? fmtTel(canal.telefone) : <span style={{ opacity: 0.4 }}>sem canal</span>}
                            </td>

                            <td style={{ padding: '10px 14px' }}>
                              {canal ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: canal.ativo ? 'rgba(0,200,150,0.12)' : 'rgba(239,68,68,0.12)', color: canal.ativo ? 'var(--accent)' : '#ef4444' }}>
                                    {canal.ativo ? <CheckCircleIcon style={{ width: 12, height: 12 }} /> : <XCircleIcon style={{ width: 12, height: 12 }} />}
                                    {canal.ativo ? 'Ativo' : 'Inativo'}
                                  </span>
                                  {!canalOwnerOk ? (
                                    <span style={{ fontSize: 10, color: '#f97316', display: 'flex', alignItems: 'center', gap: 3 }}>
                                      ⚠ conta: {canalOwnerEmail || canal.owner_id?.slice(0,8)}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6 }}>
                                      conta ok
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, color: '#f97316' }}>⚠ desvinculado</span>
                              )}
                            </td>

                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {canal && (
                                  <>
                                    {!canalOwnerOk && (
                                      <button onClick={async () => {
                                        const r = await apiCall('POST', { action: 'fix_owner', canal_id: canal.id })
                                        if (r.error) { toast.error(r.error); return }
                                        toast.success('Conta do canal corrigida!'); load()
                                      }}
                                        title="Corrigir conta do canal"
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: '#f97316', fontSize: 11 }}>
                                        ⚠ Corrigir conta
                                      </button>
                                    )}
                                    <button onClick={() => handleToggle(canal)} title={canal.ativo ? 'Desativar' : 'Ativar'}
                                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11 }}>
                                      {canal.ativo ? 'Desativar' : 'Ativar'}
                                    </button>
                                    <button onClick={() => handleUnlink(canal.id)} title="Remover canal"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, lineHeight: 0, opacity: 0.7 }}>
                                      <TrashIcon style={{ width: 14, height: 14 }} />
                                    </button>
                                  </>
                                )}
                                {!canal && p.telefone && (
                                  <button onClick={async () => {
                                    const r = await apiCall('POST', { action: 'link_canal', pessoa_id: p.id, telefone: p.telefone })
                                    if (r.error) { toast.error(r.error); return }
                                    toast.success('Canal vinculado!'); load()
                                  }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.3)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: 'var(--accent)', fontSize: 11 }}>
                                    <LinkIcon style={{ width: 12, height: 12 }} /> Vincular
                                  </button>
                                )}
                                {/* Botão deletar: fantasma (sem canal, sem telefone, sem is_owner) OU dono duplicado */}
                                {(!canal && !p.telefone && !p.is_owner) || isDonoDuplicado ? (
                                  <button onClick={async () => {
                                    if (!confirm(`Deletar "${p.nome}" permanentemente?`)) return
                                    const r = await apiCall('POST', { action: 'delete_pessoa', pessoa_id: p.id })
                                    if (r.error) { toast.error(r.error); return }
                                    toast.success(`"${p.nome}" deletado`); load()
                                  }}
                                    title={isDonoDuplicado ? 'Dono duplicado — deletar' : 'Deletar pessoa fantasma'}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: '#ef4444', fontSize: 11 }}>
                                    <TrashIcon style={{ width: 12, height: 12 }} /> {isDonoDuplicado ? 'Dono dup.' : 'Deletar'}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {data.pessoas.length === 0 && (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma pessoa cadastrada</div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB: MENSAGENS ────────────────────────────────────────── */}
            {tab === 'mensagens' && (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Últimas {data.msgs.length} mensagens do bot</span>
                  <button onClick={async () => {
                    if (!confirm('Limpar mensagens com mais de 30 dias?')) return
                    const r = await apiCall('POST', { action: 'limpar_logs', dias: 30 })
                    if (r.error) { toast.error(r.error); return }
                    toast.success('Logs limpos'); load()
                  }} style={{ fontSize: 12, padding: '6px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    Limpar logs &gt;30 dias
                  </button>
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        {['Quando', 'Telefone', 'Direção', 'Conteúdo'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.msgs.map(m => (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(m.created_at)}</td>
                          <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{fmtTel(m.telefone)}</td>
                          <td style={{ padding: '8px 14px' }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                              background: m.direcao === 'entrada' ? 'rgba(59,130,246,0.15)' : m.direcao?.includes('erro') ? 'rgba(239,68,68,0.15)' : 'rgba(0,200,150,0.12)',
                              color: m.direcao === 'entrada' ? '#60a5fa' : m.direcao?.includes('erro') ? '#ef4444' : 'var(--accent)',
                            }}>
                              {m.direcao === 'entrada' ? '← recebida' : m.direcao?.includes('erro') ? '⚠ erro' : '→ enviada'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 14px', color: 'var(--text-primary)', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.conteudo === '__dedup__' ? <span style={{ opacity: 0.3 }}>[dedup]</span> : m.conteudo}
                          </td>
                        </tr>
                      ))}
                      {data.msgs.length === 0 && (
                        <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma mensagem registrada</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB: USUÁRIOS ─────────────────────────────────────────── */}
            {tab === 'usuarios' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Formulário criar usuário */}
                <div className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Criar novo usuário</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome</label>
                      <input className="input" placeholder="Nome completo" value={newUserNome} onChange={e => setNewUserNome(e.target.value)}
                        style={{ width: 160, padding: '7px 10px', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-mail</label>
                      <input className="input" type="email" placeholder="email@exemplo.com" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)}
                        style={{ width: 200, padding: '7px 10px', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Senha</label>
                      <input className="input" type="text" placeholder="Senha inicial" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)}
                        style={{ width: 150, padding: '7px 10px', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>WhatsApp <span style={{ fontWeight: 400 }}>(opcional)</span></label>
                      <input className="input" type="tel" placeholder="5567999999999" value={newUserTel} onChange={e => setNewUserTel(e.target.value)}
                        style={{ width: 160, padding: '7px 10px', fontSize: 13 }} />
                    </div>
                    <button
                      disabled={creatingUser || !newUserEmail || !newUserPassword || !newUserNome}
                      onClick={async () => {
                        if (!newUserEmail || !newUserPassword || !newUserNome) return
                        setCreatingUser(true)
                        const r = await apiCall('POST', {
                          action: 'create_user',
                          email: newUserEmail.trim(),
                          password: newUserPassword,
                          nome: newUserNome.trim(),
                          telefone: newUserTel.replace(/\D/g, '') || null,
                        })
                        setCreatingUser(false)
                        if (r.error) { toast.error(r.error); return }
                        toast.success(`Usuário "${newUserNome}" criado!`)
                        setNewUserEmail(''); setNewUserPassword(''); setNewUserNome(''); setNewUserTel('')
                        load()
                      }}
                      style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (!newUserEmail || !newUserPassword || !newUserNome) ? 0.5 : 1 }}>
                      {creatingUser ? 'Criando...' : '+ Criar'}
                    </button>
                  </div>
                </div>

                {/* Lista de usuários */}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        {['E-mail', 'Criado em', 'Último acesso', 'Pessoas vinculadas', 'Canais ativos'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.authUsers.map(u => {
                        const pessoasDoUser = data.pessoas.filter(p => p.owner_id === u.id)
                        const canaisAtivos = data.canais.filter(c => c.owner_id === u.id && c.ativo).length
                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {u.email}
                              {u.email === 'ph.mar89s@gmail.com' && (
                                <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(249,115,22,0.15)', color: '#f97316', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>admin</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{fmtDate(u.created_at)}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{fmtDate(u.last_sign_in_at)}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                              {pessoasDoUser.length > 0
                                ? pessoasDoUser.map(p => p.nome).join(', ')
                                : <span style={{ opacity: 0.4 }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ color: canaisAtivos > 0 ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: canaisAtivos > 0 ? 700 : 400 }}>
                                {canaisAtivos}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                      {data.authUsers.length === 0 && (
                        <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum usuário</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* ── TAB: ASSINATURAS ──────────────────────────────────────── */}
            {tab === 'assinaturas' && (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
                  <StatBox label="Total"    value={data.assinaturas?.length || 0}                                                          color="var(--accent)" />
                  <StatBox label="Ativos"   value={data.assinaturas?.filter(s => s.status === 'ativo').length || 0}                        color="#10b981" />
                  <StatBox label="Trial"    value={data.assinaturas?.filter(s => s.status === 'trial').length || 0}                        color="#f59e0b" />
                  <StatBox label="Isentos"  value={data.assinaturas?.filter(s => s.status === 'isento').length || 0}                       color="#6366f1" />
                  <StatBox label="Cancelados" value={data.assinaturas?.filter(s => ['cancelado','vencido'].includes(s.status)).length || 0} color="#ef4444" />
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        {['E-mail', 'Status', 'Plano', 'Expira em', 'Ações'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(data.assinaturas || []).map(s => {
                        const statusColor = {
                          ativo:     '#10b981',
                          trial:     '#f59e0b',
                          isento:    '#6366f1',
                          cancelado: '#ef4444',
                          vencido:   '#ef4444',
                        }[s.status] || 'var(--text-secondary)'
                        const expDate = s.status === 'trial' ? s.trial_expires_at : s.expires_at
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.email}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: statusColor + '22', padding: '2px 8px', borderRadius: 99 }}>
                                {s.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{s.plan || '—'}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{s.status === 'isento' ? '∞' : fmtDate(expDate)}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {s.status !== 'isento' && (
                                  <button onClick={async () => {
                                    const r = await apiCall('POST', { action: 'set_assinatura', user_id: s.user_id, email: s.email, status: 'isento' })
                                    if (r.error) { toast.error(r.error); return }
                                    toast.success('Marcado como isento'); load()
                                  }} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: '#6366f1', fontSize: 11 }}>
                                    Isentar
                                  </button>
                                )}
                                {s.status !== 'ativo' && (
                                  <button onClick={async () => {
                                    const expires = new Date(Date.now() + 31 * 86400 * 1000).toISOString()
                                    const r = await apiCall('POST', { action: 'set_assinatura', user_id: s.user_id, email: s.email, status: 'ativo', expires_at: expires, plan: 'mensal' })
                                    if (r.error) { toast.error(r.error); return }
                                    toast.success('Ativado por 30 dias'); load()
                                  }} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: '#10b981', fontSize: 11 }}>
                                    +30 dias
                                  </button>
                                )}
                                {!['cancelado','vencido'].includes(s.status) ? null : (
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.5 }}>cancelado</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {(!data.assinaturas || data.assinaturas.length === 0) && (
                        <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma assinatura</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div className="card" style={{ padding: '14px 20px', minWidth: 100, textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
