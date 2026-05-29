import { useState, useEffect, useCallback } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import {
  PlusIcon, TrashIcon, KeyIcon, ArrowPathIcon,
  UserCircleIcon, BuildingOffice2Icon, DevicePhoneMobileIcon,
  CheckCircleIcon, XCircleIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

// ─── Paleta ────────────────────────────────────────────────────────────────
const S = {
  pageBg:    '#F1F5F9',        // slate-100 — fundo da área
  card:      '#FFFFFF',        // branco — cards elevados
  border:    '#E2E8F0',        // slate-200
  shadow:    '0 1px 3px rgba(0,0,0,0.08)',
  text:      '#0F172A',        // slate-900
  textSub:   '#64748B',        // slate-500
  primary:   '#22C55E',        // verde SmartPro
  primaryDk: '#15803D',
  red:       '#EF4444',
  yellow:    '#F59E0B',
  blue:      '#3B82F6',
  pillGreen: { bg: '#DCFCE7', fg: '#166534' },
  pillGray:  { bg: '#F1F5F9', fg: '#475569' },
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── Badge de matrícula ─────────────────────────────────────────────────────
function Badge({ children, pill = S.pillGreen }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
      borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: pill.bg, color: pill.fg, letterSpacing: 0.3,
    }}>
      {children}
    </span>
  )
}

// ─── Modal genérico ─────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: S.card, borderRadius: 12, padding: 28, width: 420, maxWidth: '96vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: S.text }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.textSub, fontSize: 20 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Campo de formulário ─────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: S.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, color: S.text,
  border: `1px solid ${S.border}`, background: S.pageBg, outline: 'none', boxSizing: 'border-box',
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function SmartLiderAdmin() {
  const [workspaces,   setWorkspaces]   = useState([])
  const [wsId,         setWsId]         = useState('')
  const [wsSearch,     setWsSearch]     = useState('')
  const [usuarios,     setUsuarios]     = useState([])
  const [loadingWs,    setLoadingWs]    = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [modalCriar,   setModalCriar]   = useState(false)
  const [modalSenha,   setModalSenha]   = useState(null)  // user obj
  const [modalCelular, setModalCelular] = useState(null)  // user obj
  const [form,         setForm]         = useState({ matricula: '', nome: '' })
  const [novaSenha,    setNovaSenha]    = useState('')
  const [novoCelular,  setNovoCelular]  = useState('')
  const [saving,       setSaving]       = useState(false)

  // Carrega workspaces
  useEffect(() => {
    supabase.from('workspaces')
      .select('id, nome, cnpj, ativo')
      .eq('tipo', 'empresa')
      .order('nome')
      .then(({ data }) => { setWorkspaces(data || []); setLoadingWs(false) })
  }, [])

  // Carrega usuários do workspace selecionado
  const loadUsers = useCallback(async (wid) => {
    if (!wid) return
    setLoadingUsers(true)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch('/api/lider-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'listar-usuarios', workspace_id: wid }),
    })
    const json = await resp.json()
    setUsuarios(json.usuarios || [])
    setLoadingUsers(false)
  }, [])

  useEffect(() => { if (wsId) loadUsers(wsId) }, [wsId, loadUsers])

  // ── Criar usuário ──────────────────────────────────────────────────────
  async function handleCriar() {
    if (!form.matricula.trim()) { toast.error('Informe a matrícula'); return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch('/api/lider-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'criar-usuario', workspace_id: wsId, matricula: form.matricula.trim(), nome: form.nome.trim() }),
    })
    const json = await resp.json()
    setSaving(false)
    if (json.ok) {
      toast.success(json.ja_existia ? 'Usuário já existia' : `Usuário ${json.email} criado`)
      setModalCriar(false)
      setForm({ matricula: '', nome: '' })
      loadUsers(wsId)
    } else {
      toast.error(json.error || 'Erro ao criar usuário')
    }
  }

  // ── Resetar senha ──────────────────────────────────────────────────────
  async function handleResetSenha() {
    if (!novaSenha.trim()) { toast.error('Informe a nova senha'); return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch('/api/lider-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'resetar-senha', user_id: modalSenha.id, nova_senha: novaSenha.trim() }),
    })
    const json = await resp.json()
    setSaving(false)
    if (json.ok) {
      toast.success('Senha redefinida')
      setModalSenha(null)
      setNovaSenha('')
    } else {
      toast.error(json.error || 'Erro ao redefinir senha')
    }
  }

  // ── Excluir usuário ────────────────────────────────────────────────────
  async function handleExcluir(user) {
    if (!window.confirm(`Excluir usuário ${user.email}?`)) return
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch('/api/lider-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'excluir-usuario', user_id: user.id }),
    })
    const json = await resp.json()
    if (json.ok) {
      toast.success('Usuário excluído')
      loadUsers(wsId)
    } else {
      toast.error(json.error || 'Erro ao excluir')
    }
  }

  // ── Atualizar celular ──────────────────────────────────────────────────────
  async function handleAtualizarCelular() {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch('/api/lider-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'atualizar-celular', perfil_id: modalCelular.perfil_id, celular: novoCelular.trim() }),
    })
    const json = await resp.json()
    setSaving(false)
    if (json.ok) {
      toast.success('Celular atualizado')
      setModalCelular(null)
      setNovoCelular('')
      loadUsers(wsId)
    } else {
      toast.error(json.error || 'Erro ao atualizar celular')
    }
  }

  const wsFiltrados = workspaces.filter(w =>
    !wsSearch || w.nome.toLowerCase().includes(wsSearch.toLowerCase()) || w.cnpj?.includes(wsSearch)
  )
  const wsAtual = workspaces.find(w => w.id === wsId)

  return (
    <div style={{ minHeight: '100vh', background: S.pageBg }}>
      <Header title="SmartLíder — Admin" />

      <div style={{ padding: '12px 20px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>

          {/* ── Coluna esquerda: seletor de workspace ── */}
          <div style={{ background: S.card, borderRadius: 12, border: `1px solid ${S.border}`, boxShadow: S.shadow, overflow: 'hidden', position: 'sticky', top: 64, maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${S.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <BuildingOffice2Icon style={{ width: 14, height: 14, color: S.primary }} />
                <span style={{ fontWeight: 700, fontSize: 11, color: S.text, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Workspaces ({workspaces.length})
                </span>
              </div>
              <div style={{ position: 'relative', marginTop: 8 }}>
                <MagnifyingGlassIcon style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: S.textSub }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 28, background: S.pageBg }}
                  placeholder="Filtrar..."
                  value={wsSearch}
                  onChange={e => setWsSearch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
            {loadingWs
              ? <div style={{ padding: 24, textAlign: 'center', color: S.textSub, fontSize: 13 }}>Carregando…</div>
              : wsFiltrados.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => setWsId(ws.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '12px 16px', border: 'none', cursor: 'pointer',
                    background: wsId === ws.id ? '#F0FDF4' : 'transparent',
                    borderLeft: wsId === ws.id ? `3px solid ${S.primary}` : '3px solid transparent',
                    borderBottom: `1px solid ${S.border}`,
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 12, color: wsId === ws.id ? S.primaryDk : S.text }}>
                      {ws.nome}
                    </span>
                    {!ws.ativo && <Badge pill={S.pillGray}>inativo</Badge>}
                  </div>
                  {ws.cnpj && <span style={{ fontSize: 11, color: S.textSub }}>{ws.cnpj}</span>}
                </button>
              ))
            }
            </div>
          </div>

          {/* ── Coluna direita: usuários ── */}
          <div>
            {!wsId
              ? (
                <div style={{
                  background: S.card, borderRadius: 12, border: `1px solid ${S.border}`,
                  boxShadow: S.shadow, padding: 48, textAlign: 'center',
                }}>
                  <BuildingOffice2Icon style={{ width: 36, height: 36, color: S.border, margin: '0 auto 12px' }} />
                  <p style={{ color: S.textSub, margin: 0, fontSize: 14 }}>Selecione um workspace para gerenciar seus usuários</p>
                </div>
              )
              : (
                <>
                  {/* Header do workspace selecionado */}
                  <div style={{
                    background: S.card, borderRadius: 12, border: `1px solid ${S.border}`,
                    boxShadow: S.shadow, padding: '14px 18px', marginBottom: 14,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: S.text }}>{wsAtual?.nome}</div>
                      <div style={{ fontSize: 12, color: S.textSub, marginTop: 2 }}>
                        <span style={{ marginRight: 12 }}>ID: <code style={{ fontSize: 11 }}>{wsId.slice(0, 8)}…</code></span>
                        {wsAtual?.cnpj && <span>CNPJ: {wsAtual.cnpj}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => loadUsers(wsId)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.border}`,
                          background: S.pageBg, color: S.textSub, fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        <ArrowPathIcon style={{ width: 14, height: 14 }} /> Atualizar
                      </button>
                      <button
                        onClick={() => setModalCriar(true)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '7px 14px', borderRadius: 8, border: 'none',
                          background: S.primary, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        <PlusIcon style={{ width: 14, height: 14 }} /> Novo Usuário
                      </button>
                    </div>
                  </div>

                  {/* Lista de usuários */}
                  <div style={{ background: S.card, borderRadius: 12, border: `1px solid ${S.border}`, boxShadow: S.shadow, overflow: 'hidden' }}>
                    {/* Cabeçalho tabela */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1.5fr 110px 90px',
                      padding: '10px 16px', background: S.pageBg,
                      borderBottom: `1px solid ${S.border}`,
                    }}>
                      {['Matrícula / Email', 'Nome', 'Celular / WA', 'Criado em', 'Ações'].map(h => (
                        <span key={h} style={{ fontSize: 11, fontWeight: 700, color: S.textSub, textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</span>
                      ))}
                    </div>

                    {loadingUsers
                      ? <div style={{ padding: 32, textAlign: 'center', color: S.textSub, fontSize: 13 }}>Carregando…</div>
                      : usuarios.length === 0
                        ? (
                          <div style={{ padding: 40, textAlign: 'center' }}>
                            <UserCircleIcon style={{ width: 32, height: 32, color: S.border, margin: '0 auto 10px' }} />
                            <p style={{ color: S.textSub, fontSize: 13, margin: 0 }}>
                              Nenhum usuário cadastrado neste workspace
                            </p>
                            <button
                              onClick={() => setModalCriar(true)}
                              style={{
                                marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '8px 16px', borderRadius: 8, border: 'none',
                                background: S.primary, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              <PlusIcon style={{ width: 14, height: 14 }} /> Criar primeiro usuário
                            </button>
                          </div>
                        )
                        : usuarios.map(u => (
                          <div
                            key={u.id}
                            style={{
                              display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1.5fr 110px 90px',
                              padding: '12px 16px', borderBottom: `1px solid ${S.border}`,
                              alignItems: 'center',
                            }}
                          >
                            {/* Matrícula / email */}
                            <div style={{ minWidth: 0 }}>
                              <Badge>{u.matricula}</Badge>
                              <div style={{ fontSize: 11, color: S.textSub, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                            </div>
                            {/* Nome */}
                            <div style={{ fontSize: 13, color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{u.nome || '—'}</div>
                            {/* Celular */}
                            <div style={{ fontSize: 12, color: u.celular ? S.text : S.textSub, minWidth: 0 }}>
                              {u.celular
                                ? <span>📱 {u.celular}</span>
                                : <span style={{ fontStyle: 'italic' }}>Sem celular</span>
                              }
                            </div>
                            {/* Data */}
                            <div style={{ fontSize: 12, color: S.textSub }}>{fmtDate(u.created_at)}</div>
                            {/* Ações */}
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                title="Editar celular/WhatsApp"
                                onClick={() => { setModalCelular(u); setNovoCelular(u.celular || '') }}
                                style={{
                                  padding: '5px 7px', borderRadius: 7, border: `1px solid ${S.border}`,
                                  background: S.pageBg, cursor: 'pointer', color: S.primary,
                                }}
                              >
                                <DevicePhoneMobileIcon style={{ width: 13, height: 13 }} />
                              </button>
                              <button
                                title="Redefinir senha"
                                onClick={() => { setModalSenha(u); setNovaSenha(u.matricula) }}
                                style={{
                                  padding: '5px 7px', borderRadius: 7, border: `1px solid ${S.border}`,
                                  background: S.pageBg, cursor: 'pointer', color: S.blue,
                                }}
                              >
                                <KeyIcon style={{ width: 13, height: 13 }} />
                              </button>
                              <button
                                title="Excluir usuário"
                                onClick={() => handleExcluir(u)}
                                style={{
                                  padding: '5px 7px', borderRadius: 7, border: `1px solid #FEE2E2`,
                                  background: '#FFF5F5', cursor: 'pointer', color: S.red,
                                }}
                              >
                                <TrashIcon style={{ width: 13, height: 13 }} />
                              </button>
                            </div>
                          </div>
                        ))
                    }

                    {/* Rodapé com contagem */}
                    {usuarios.length > 0 && (
                      <div style={{ padding: '10px 16px', background: S.pageBg, borderTop: `1px solid ${S.border}` }}>
                        <span style={{ fontSize: 12, color: S.textSub }}>
                          {usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''} · Login: <code style={{ fontSize: 11 }}>matrícula@lider.smartpro</code> · Senha padrão: matrícula
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )
            }
          </div>
        </div>
      </div>

      {/* ── Modal: Criar usuário ── */}
      {modalCriar && (
        <Modal title="Criar Usuário SmartLíder" onClose={() => setModalCriar(false)}>
          <Field label="Matrícula *">
            <input
              style={inputStyle}
              placeholder="ex: L001, JOAO01..."
              value={form.matricula}
              onChange={e => setForm(p => ({ ...p, matricula: e.target.value }))}
              autoFocus
            />
          </Field>
          <Field label="Nome completo">
            <input
              style={inputStyle}
              placeholder="ex: João da Silva"
              value={form.nome}
              onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
            />
          </Field>
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#166534' }}>
            <strong>Login:</strong> {form.matricula || 'matrícula'}@lider.smartpro<br />
            <strong>Senha padrão:</strong> {form.matricula || 'matrícula'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setModalCriar(false)}
              style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.pageBg, color: S.textSub, fontSize: 13, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleCriar}
              disabled={saving}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: S.primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Criando…' : 'Criar Usuário'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Editar celular ── */}
      {modalCelular && (
        <Modal title={`Celular/WhatsApp — ${modalCelular.matricula}`} onClose={() => setModalCelular(null)}>
          <Field label="Celular / WhatsApp">
            <input
              style={inputStyle}
              placeholder="5567999990000 (com DDI+DDD)"
              value={novoCelular}
              onChange={e => setNovoCelular(e.target.value)}
              autoFocus
            />
          </Field>
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '8px 12px', marginBottom: 18, fontSize: 12, color: '#1E40AF' }}>
            Formato: <strong>DDI + DDD + número</strong> — ex: <code>5567999990000</code>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setModalCelular(null)}
              style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.pageBg, color: S.textSub, fontSize: 13, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleAtualizarCelular}
              disabled={saving}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: S.primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Redefinir senha ── */}
      {modalSenha && (
        <Modal title={`Redefinir senha — ${modalSenha.matricula}`} onClose={() => setModalSenha(null)}>
          <Field label="Nova senha">
            <input
              style={inputStyle}
              placeholder="Mínimo 6 caracteres"
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              autoFocus
            />
          </Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={() => setModalSenha(null)}
              style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.pageBg, color: S.textSub, fontSize: 13, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleResetSenha}
              disabled={saving}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: S.blue, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Salvando…' : 'Redefinir Senha'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
