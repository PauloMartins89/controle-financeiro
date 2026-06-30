import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import {
  PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, XMarkIcon,
  ArrowPathIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon, UserGroupIcon, UserIcon, ChartBarIcon,
  BellAlertIcon, CpuChipIcon, SignalIcon, ArrowPathRoundedSquareIcon,
  EyeIcon, PaperAirplaneIcon,
} from '@heroicons/react/24/outline'

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDT = d => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const API   = url => fetch(url).then(r => r.json())

// ── Config de status ─────────────────────────────────────────────────────────
const STATUS_CFG = {
  aberta:               { label: 'Aberta',              color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  triagem:              { label: 'Triagem',             color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  enviada_tecnico:      { label: 'Enviada ao Técnico',  color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)'  },
  em_atendimento:       { label: 'Em Atendimento',      color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
  aguardando_informacao:{ label: 'Aguard. Info',        color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  concluida:            { label: 'Concluída',           color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  descartada:           { label: 'Descartada',          color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  erro_classificacao:   { label: 'Erro IA',             color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
}

// ── Config de prioridade ──────────────────────────────────────────────────────
const PRIOR_CFG = {
  critica: { label: 'Crítica', color: '#ef4444', emoji: '🔴' },
  alta:    { label: 'Alta',    color: '#f97316', emoji: '🟠' },
  media:   { label: 'Média',   color: '#f59e0b', emoji: '🟡' },
  baixa:   { label: 'Baixa',   color: '#10b981', emoji: '🟢' },
}

// ── Config de categoria ───────────────────────────────────────────────────────
const CATEGORIAS = ['telemetria','rastreador','aplicativo','sistema','instalacao','manutencao','sensor','equipamento','comunicacao','outros']
const CAT_EMOJI  = { telemetria:'📡', rastreador:'🛰️', aplicativo:'📱', sistema:'🖥️', instalacao:'🔧', manutencao:'🔩', sensor:'🎯', equipamento:'⚙️', comunicacao:'📶', outros:'📋' }

// ── Componentes base ──────────────────────────────────────────────────────────
function Badge({ s }) {
  const c = STATUS_CFG[s] || { label: s, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{c.label}</span>
}

function PriorBadge({ p }) {
  const c = PRIOR_CFG[p] || { label: p || '—', color: '#94a3b8', emoji: '⚪' }
  return <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.emoji} {c.label}</span>
}

function ConfBadge({ v }) {
  const pct = Math.round((v || 0) * 100)
  const color = pct >= 85 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#94a3b8'
  return <span style={{ fontWeight: 700, fontSize: 12, color }}>{pct}%</span>
}

function KPICard({ label, value, sub, color, Icon, onClick }) {
  return (
    <div onClick={onClick} style={{ background: `linear-gradient(135deg,${color}14 0%,var(--bg-card) 60%)`, borderRadius: 14, padding: '14px 16px', border: `1px solid ${color}28`, borderTop: `3px solid ${color}`, boxShadow: 'var(--shadow-card)', cursor: onClick ? 'pointer' : 'default', transition: 'transform .15s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'translateY(0)')}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .5 }}>{label}</span>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 14, height: 14, color }} />
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Modal({ title, onClose, children, maxWidth = 560 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.4)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }
const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO: Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function SecaoDashboard({ workspaceId, navigate }) {
  const [kpis, setKpis]     = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await API(`/api/chamados?action=dashboard&workspace_id=${workspaceId}`)
    setKpis(d)
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Carregando...</div>

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
        <KPICard label="Grupos Monit." value={kpis?.totalGrupos ?? '—'} color="#6366f1" Icon={UserGroupIcon} onClick={() => navigate('/chamados-wa/grupos')} />
        <KPICard label="Abertos Hoje"  value={kpis?.abertasHoje  ?? 0}  color="#f59e0b" Icon={BellAlertIcon} sub="novas solicitações" onClick={() => navigate('/chamados-wa/solicitacoes')} />
        <KPICard label="Em Triagem"    value={kpis?.emTriagem    ?? 0}  color="#f97316" Icon={ClockIcon}     sub="aguardando revisão" onClick={() => navigate('/chamados-wa/triagem')} />
        <KPICard label="Env. Técnico"  value={kpis?.enviadasTecnico ?? 0} color="#0ea5e9" Icon={PaperAirplaneIcon} sub="notificados hoje" />
        <KPICard label="Descartados"   value={kpis?.descartadas  ?? 0}  color="#94a3b8" Icon={XMarkIcon}     sub="pela IA" />
        <KPICard label="Confiança IA"  value={`${kpis?.mediaConfianca ?? 0}%`} color="#10b981" Icon={CpuChipIcon} sub="média hoje" />
      </div>

      {/* Últimos chamados */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Últimos Chamados Identificados</span>
          <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><ArrowPathIcon style={{ width: 16, height: 16 }} /></button>
        </div>
        {!kpis?.ultimos?.length
          ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum chamado registrado ainda.</div>
          : <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Código','Grupo','Solicitante','Categoria','Prioridade','Status','Data'].map((h, i) => (
                      <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kpis.ultimos.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => navigate('/chamados-wa/solicitacoes')}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#6366f1' }}>{row.codigo}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{row.grupo?.nome_grupo || '—'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{row.solicitante_nome || '—'}</td>
                      <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 12 }}>{CAT_EMOJI[row.categoria] || '📋'} {row.categoria || '—'}</span></td>
                      <td style={{ padding: '8px 12px' }}><PriorBadge p={row.prioridade} /></td>
                      <td style={{ padding: '8px 12px' }}><Badge s={row.status} /></td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDT(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO: Técnicos
// ─────────────────────────────────────────────────────────────────────────────
function SecaoTecnicos({ workspaceId, ownerId }) {
  const [rows, setRows]       = useState([])
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState({})
  const [saving, setSaving]   = useState(false)
  const [busca, setBusca]     = useState('')

  async function load() {
    const { data } = await supabase.from('tecnicos').select('*, _grupos:whatsapp_grupos(id,nome_grupo,ativo)').eq('workspace_id', workspaceId).order('nome')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  function openNew() { setForm({ ativo: true }); setModal({ mode: 'new' }) }
  function openEdit(r) { setForm({ ...r }); setModal({ mode: 'edit', id: r.id }) }

  async function save() {
    if (!form.nome?.trim()) { toast.error('Nome obrigatório'); return }
    if (!form.whatsapp?.trim()) { toast.error('WhatsApp obrigatório'); return }
    setSaving(true)
    const payload = { nome: form.nome, whatsapp: form.whatsapp, email: form.email || null, regiao: form.regiao || null, equipe: form.equipe || null, ativo: form.ativo !== false, observacoes: form.observacoes || null, workspace_id: workspaceId, owner_id: ownerId }
    let error
    if (modal.mode === 'new') {
      ;({ error } = await supabase.from('tecnicos').insert(payload))
    } else {
      ;({ error } = await supabase.from('tecnicos').update(payload).eq('id', modal.id))
    }
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(modal.mode === 'new' ? 'Técnico criado!' : 'Técnico salvo!')
    setModal(null); load()
  }

  async function toggleAtivo(r) {
    await supabase.from('tecnicos').update({ ativo: !r.ativo }).eq('id', r.id)
    toast.success(r.ativo ? 'Técnico inativado.' : 'Técnico ativado.')
    load()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const filtrados = rows.filter(r => !busca || r.nome?.toLowerCase().includes(busca.toLowerCase()) || r.whatsapp?.includes(busca) || r.regiao?.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <MagnifyingGlassIcon style={{ width: 14, height: 14, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input style={{ ...inp, paddingLeft: 32 }} placeholder="Buscar técnico..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <button onClick={openNew} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 14px' }}>
          <PlusIcon style={{ width: 15, height: 15 }} /> Novo Técnico
        </button>
      </div>

      {filtrados.length === 0
        ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum técnico cadastrado.</div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
            {filtrados.map(r => (
              <div key={r.id} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px 16px', boxShadow: 'var(--shadow-card)', opacity: r.ativo ? 1 : .55 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserIcon style={{ width: 18, height: 18, color: '#6366f1' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>{r.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📱 {r.whatsapp || '—'}</div>
                    {r.regiao && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>📍 {r.regiao}{r.equipe ? ` · ${r.equipe}` : ''}</div>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: r.ativo ? 'rgba(16,185,129,.12)' : 'rgba(148,163,184,.12)', color: r.ativo ? '#10b981' : '#94a3b8' }}>{r.ativo ? 'Ativo' : 'Inativo'}</span>
                </div>
                {r._grupos?.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    Grupos: {r._grupos.map(g => g.nome_grupo).join(', ')}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEdit(r)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <PencilIcon style={{ width: 12, height: 12 }} /> Editar
                  </button>
                  <button onClick={() => toggleAtivo(r)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 0', borderRadius: 8, border: `1px solid ${r.ativo ? 'rgba(239,68,68,.25)' : 'rgba(16,185,129,.25)'}`, background: r.ativo ? 'rgba(239,68,68,.08)' : 'rgba(16,185,129,.08)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: r.ativo ? '#ef4444' : '#10b981' }}>
                    {r.ativo ? '⊗ Inativar' : '✓ Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
      }

      {modal && (
        <Modal title={modal.mode === 'new' ? 'Novo Técnico' : 'Editar Técnico'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Nome *</label>
              <input style={inp} value={form.nome || ''} onChange={e => f('nome', e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <label style={lbl}>WhatsApp *</label>
              <input style={inp} value={form.whatsapp || ''} onChange={e => f('whatsapp', e.target.value)} placeholder="5567999998888" />
            </div>
            <div>
              <label style={lbl}>E-mail</label>
              <input style={inp} value={form.email || ''} onChange={e => f('email', e.target.value)} placeholder="tecnico@empresa.com" />
            </div>
            <div>
              <label style={lbl}>Região</label>
              <input style={inp} value={form.regiao || ''} onChange={e => f('regiao', e.target.value)} placeholder="MS / MT / GO..." />
            </div>
            <div>
              <label style={lbl}>Equipe</label>
              <input style={inp} value={form.equipe || ''} onChange={e => f('equipe', e.target.value)} placeholder="Equipe Campo Sul" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Observações</label>
              <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.observacoes || ''} onChange={e => f('observacoes', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="tec-ativo" checked={form.ativo !== false} onChange={e => f('ativo', e.target.checked)} />
              <label htmlFor="tec-ativo" style={{ fontSize: 13, color: 'var(--text-primary)' }}>Técnico ativo</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button onClick={() => setModal(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO: Grupos Monitorados
// ─────────────────────────────────────────────────────────────────────────────
function SecaoGrupos({ workspaceId, ownerId }) {
  const [rows, setRows]       = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState({})
  const [saving, setSaving]   = useState(false)

  async function load() {
    const [{ data: g }, { data: t }] = await Promise.all([
      supabase.from('whatsapp_grupos').select('*, tecnico:tecnicos(id,nome)').eq('workspace_id', workspaceId).order('nome_grupo'),
      supabase.from('tecnicos').select('id,nome').eq('workspace_id', workspaceId).eq('ativo', true).order('nome'),
    ])
    setRows(g || [])
    setTecnicos(t || [])
  }
  useEffect(() => { load() }, [])

  function openNew() { setForm({ ativo: true, nivel_monitoramento: 'medio' }); setModal({ mode: 'new' }) }
  function openEdit(r) { setForm({ ...r, tecnico_id: r.tecnico_id || '' }); setModal({ mode: 'edit', id: r.id }) }

  async function save() {
    if (!form.zapi_group_id?.trim()) { toast.error('ID do grupo Z-API obrigatório'); return }
    if (!form.nome_grupo?.trim())    { toast.error('Nome do grupo obrigatório'); return }
    setSaving(true)
    const payload = { zapi_group_id: form.zapi_group_id.trim(), nome_grupo: form.nome_grupo.trim(), cliente: form.cliente || null, operacao: form.operacao || null, regiao: form.regiao || null, tecnico_id: form.tecnico_id || null, nivel_monitoramento: form.nivel_monitoramento || 'medio', ativo: form.ativo !== false, observacoes: form.observacoes || null, workspace_id: workspaceId, owner_id: ownerId }
    let error
    if (modal.mode === 'new') {
      ;({ error } = await supabase.from('whatsapp_grupos').insert(payload))
    } else {
      ;({ error } = await supabase.from('whatsapp_grupos').update(payload).eq('id', modal.id))
    }
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(modal.mode === 'new' ? 'Grupo cadastrado!' : 'Grupo salvo!')
    setModal(null); load()
  }

  async function toggleAtivo(r) {
    await supabase.from('whatsapp_grupos').update({ ativo: !r.ativo }).eq('id', r.id)
    toast.success(r.ativo ? 'Monitoramento suspenso.' : 'Monitoramento ativado.')
    load()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const NIVEL_COR = { baixo: '#10b981', medio: '#f59e0b', alto: '#ef4444' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={openNew} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 14px' }}>
          <PlusIcon style={{ width: 15, height: 15 }} /> Novo Grupo
        </button>
      </div>

      {rows.length === 0
        ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum grupo cadastrado. Adicione o ID do grupo Z-API para começar o monitoramento.</div>
        : <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Grupo','ID Z-API','Cliente','Técnico','Nível','Status','Ações'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', opacity: r.ativo ? 1 : .5 }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.nome_grupo}</td>
                    <td style={{ padding: '10px 12px' }}><code style={{ fontSize: 11, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-secondary)' }}>{r.zapi_group_id}</code></td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{r.cliente || r.operacao || '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{r.tecnico?.nome || <span style={{ color: '#ef4444', fontSize: 11 }}>⚠ Sem técnico</span>}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: NIVEL_COR[r.nivel_monitoramento] }}>● {(r.nivel_monitoramento || 'medio').charAt(0).toUpperCase() + (r.nivel_monitoramento || 'medio').slice(1)}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: r.ativo ? 'rgba(16,185,129,.12)' : 'rgba(148,163,184,.12)', color: r.ativo ? '#10b981' : '#94a3b8' }}>{r.ativo ? '● Ativo' : '○ Inativo'}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: 4 }} title="Editar"><PencilIcon style={{ width: 14, height: 14 }} /></button>
                        <button onClick={() => toggleAtivo(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: r.ativo ? '#ef4444' : '#10b981', padding: 4 }} title={r.ativo ? 'Desativar' : 'Ativar'}><SignalIcon style={{ width: 14, height: 14 }} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }

      {modal && (
        <Modal title={modal.mode === 'new' ? 'Novo Grupo Monitorado' : 'Editar Grupo'} onClose={() => setModal(null)} maxWidth={600}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Nome do Grupo *</label>
              <input style={inp} value={form.nome_grupo || ''} onChange={e => f('nome_grupo', e.target.value)} placeholder="Suporte Suzano MS" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>ID do Grupo Z-API *</label>
              <input style={inp} value={form.zapi_group_id || ''} onChange={e => f('zapi_group_id', e.target.value)} placeholder="5567999990000-1234567890@g.us" />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Encontrado no payload do webhook: campo "phone" em mensagens de grupo</span>
            </div>
            <div>
              <label style={lbl}>Cliente / Operação</label>
              <input style={inp} value={form.cliente || ''} onChange={e => f('cliente', e.target.value)} placeholder="Fazenda Boa Vista" />
            </div>
            <div>
              <label style={lbl}>Região</label>
              <input style={inp} value={form.regiao || ''} onChange={e => f('regiao', e.target.value)} placeholder="MS / MT..." />
            </div>
            <div>
              <label style={lbl}>Técnico Responsável</label>
              <select style={inp} value={form.tecnico_id || ''} onChange={e => f('tecnico_id', e.target.value)}>
                <option value="">— Sem técnico —</option>
                {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Nível de Monitoramento</label>
              <select style={inp} value={form.nivel_monitoramento || 'medio'} onChange={e => f('nivel_monitoramento', e.target.value)}>
                <option value="baixo">Baixo</option>
                <option value="medio">Médio</option>
                <option value="alto">Alto</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Observações</label>
              <textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={form.observacoes || ''} onChange={e => f('observacoes', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="grp-ativo" checked={form.ativo !== false} onChange={e => f('ativo', e.target.checked)} />
              <label htmlFor="grp-ativo" style={{ fontSize: 13, color: 'var(--text-primary)' }}>Monitoramento ativo</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button onClick={() => setModal(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO: Solicitações de Atendimento
// ─────────────────────────────────────────────────────────────────────────────
function SecaoSolicitacoes({ workspaceId }) {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [busca, setBusca]       = useState('')
  const [detalhe, setDetalhe]   = useState(null)
  const [atualizando, setAtualizando] = useState(false)

  async function load() {
    setLoading(true)
    let q = supabase.from('solicitacoes_atendimento')
      .select('*, grupo:whatsapp_grupos(id,nome_grupo,cliente), tecnico:tecnicos(id,nome,whatsapp)')
      .eq('workspace_id', workspaceId)
      .not('status', 'eq', 'triagem')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filtroStatus) q = q.eq('status', filtroStatus)
    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filtroStatus])

  async function mudarStatus(id, status) {
    setAtualizando(true)
    const { error } = await supabase.from('solicitacoes_atendimento').update({ status }).eq('id', id)
    setAtualizando(false)
    if (error) { toast.error(error.message); return }
    toast.success('Status atualizado!')
    if (detalhe?.id === id) setDetalhe(d => ({ ...d, status }))
    load()
  }

  async function notificarTecnico(id) {
    const r = await fetch(`/api/chamados?id=${id}&action=notificar`, { method: 'POST' })
    const d = await r.json()
    if (d.ok) toast.success('Técnico notificado via WhatsApp!'); else toast.error(d.motivo || 'Erro ao notificar')
  }

  const filtrados = rows.filter(r => {
    if (!busca) return true
    const b = busca.toLowerCase()
    return r.codigo?.toLowerCase().includes(b) || r.solicitante_nome?.toLowerCase().includes(b) || r.grupo?.nome_grupo?.toLowerCase().includes(b) || r.resumo_ia?.toLowerCase().includes(b)
  })

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <MagnifyingGlassIcon style={{ width: 14, height: 14, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input style={{ ...inp, paddingLeft: 32 }} placeholder="Buscar código, solicitante, grupo..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select style={{ ...inp, width: 180 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CFG).filter(([k]) => k !== 'triagem').map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <ArrowPathIcon style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando...</div>
        : filtrados.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>Nenhuma solicitação encontrada.</div>
          : <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Código','Grupo','Solicitante','Resumo','Categoria','Prioridade','Status','IA','Data','Ações'].map((h, i) => (
                      <th key={i} style={{ padding: '9px 11px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 11px', fontWeight: 700, color: '#6366f1', whiteSpace: 'nowrap' }}>{r.codigo}</td>
                      <td style={{ padding: '9px 11px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{r.grupo?.nome_grupo || '—'}</td>
                      <td style={{ padding: '9px 11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.solicitante_nome || '—'}</td>
                      <td style={{ padding: '9px 11px', maxWidth: 280, color: 'var(--text-primary)' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260, fontSize: 12 }} title={r.resumo_ia}>{r.resumo_ia || r.mensagem_original || '—'}</div>
                      </td>
                      <td style={{ padding: '9px 11px', whiteSpace: 'nowrap', fontSize: 12 }}>{CAT_EMOJI[r.categoria] || '📋'} {r.categoria || '—'}</td>
                      <td style={{ padding: '9px 11px', whiteSpace: 'nowrap' }}><PriorBadge p={r.prioridade} /></td>
                      <td style={{ padding: '9px 11px', whiteSpace: 'nowrap' }}><Badge s={r.status} /></td>
                      <td style={{ padding: '9px 11px', whiteSpace: 'nowrap' }}><ConfBadge v={r.confianca_ia} /></td>
                      <td style={{ padding: '9px 11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDT(r.created_at)}</td>
                      <td style={{ padding: '9px 11px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => setDetalhe(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: 3 }} title="Ver detalhes"><EyeIcon style={{ width: 15, height: 15 }} /></button>
                          {r.tecnico && r.status !== 'enviada_tecnico' && (
                            <button onClick={() => notificarTecnico(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0ea5e9', padding: 3 }} title="Notificar técnico"><PaperAirplaneIcon style={{ width: 15, height: 15 }} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }

      {/* Detalhe da solicitação */}
      {detalhe && (
        <Modal title={`${detalhe.codigo} — Detalhes`} onClose={() => setDetalhe(null)} maxWidth={640}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={lbl}>Grupo</span><span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{detalhe.grupo?.nome_grupo || '—'}</span></div>
              <div><span style={lbl}>Solicitante</span><span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{detalhe.solicitante_nome || '—'} {detalhe.solicitante_whatsapp ? `(${detalhe.solicitante_whatsapp})` : ''}</span></div>
              <div><span style={lbl}>Técnico</span><span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{detalhe.tecnico?.nome || <span style={{ color: '#ef4444' }}>⚠ Não vinculado</span>}</span></div>
              <div><span style={lbl}>Data/Hora</span><span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{fmtDT(detalhe.created_at)}</span></div>
              <div><span style={lbl}>Categoria</span><span style={{ fontSize: 13 }}>{CAT_EMOJI[detalhe.categoria]} {detalhe.categoria}</span></div>
              <div><span style={lbl}>Confiança IA</span><ConfBadge v={detalhe.confianca_ia} /></div>
            </div>

            <div>
              <span style={lbl}>Resumo gerado pela IA</span>
              <div style={{ background: 'rgba(99,102,241,.07)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)' }}>{detalhe.resumo_ia || '—'}</div>
            </div>

            <div>
              <span style={lbl}>Mensagem Original</span>
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{detalhe.mensagem_original || '—'}</div>
            </div>

            {detalhe.motivo_classificacao && (
              <div>
                <span style={lbl}>Motivo da Classificação (IA)</span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{detalhe.motivo_classificacao}</div>
              </div>
            )}

            <div>
              <span style={lbl}>Status</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['aberta','em_atendimento','aguardando_informacao','concluida','descartada'].map(s => (
                  <button key={s} onClick={() => mudarStatus(detalhe.id, s)} disabled={atualizando || detalhe.status === s}
                    style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid', background: detalhe.status === s ? STATUS_CFG[s]?.bg : 'transparent', color: STATUS_CFG[s]?.color || '#94a3b8', borderColor: STATUS_CFG[s]?.color || '#94a3b8' }}>
                    {STATUS_CFG[s]?.label}
                  </button>
                ))}
              </div>
            </div>

            {detalhe.tecnico && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => { notificarTecnico(detalhe.id) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <PaperAirplaneIcon style={{ width: 14, height: 14 }} /> Renotificar Técnico
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO: Triagem
// ─────────────────────────────────────────────────────────────────────────────
function SecaoTriagem({ workspaceId }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [form, setForm]       = useState({})
  const [tecnicos, setTecnicos] = useState([])
  const [salvando, setSalvando] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: sats }, { data: tecs }] = await Promise.all([
      supabase.from('solicitacoes_atendimento').select('*, grupo:whatsapp_grupos(id,nome_grupo,cliente), tecnico:tecnicos(id,nome)').eq('workspace_id', workspaceId).eq('status', 'triagem').order('created_at', { ascending: false }),
      supabase.from('tecnicos').select('id,nome').eq('workspace_id', workspaceId).eq('ativo', true),
    ])
    setRows(sats || [])
    setTecnicos(tecs || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openTriagem(r) {
    setForm({ tecnico_id: r.tecnico_id || '', prioridade: r.prioridade || 'media', resumo_ia: r.resumo_ia || '' })
    setSelected(r)
  }

  async function aprovar() {
    setSalvando(true)
    const r = await fetch(`/api/chamados?id=${selected.id}&action=aprovar-triagem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await r.json()
    setSalvando(false)
    if (d.error) { toast.error(d.error); return }
    toast.success('Chamado aprovado e técnico notificado!')
    setSelected(null); load()
  }

  async function descartar(id) {
    if (!confirm('Descartar esta pré-solicitação?')) return
    await supabase.from('solicitacoes_atendimento').update({ status: 'descartada' }).eq('id', id)
    toast.success('Descartado.')
    load()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div>
      <div style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--text-primary)' }}>
        ⚠️ <strong>Triagem manual</strong> — A IA identificou estas solicitações com confiança média (65–84%). Revise e aprove, edite ou descarte cada uma.
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando...</div>
        : rows.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>Nenhuma pré-solicitação em triagem. ✓</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map(r => (
                <div key={r.id} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px 16px', boxShadow: 'var(--shadow-card)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: '#6366f1', fontSize: 13 }}>{r.codigo}</span>
                        <ConfBadge v={r.confianca_ia} />
                        <PriorBadge p={r.prioridade} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        📍 {r.grupo?.nome_grupo || '—'} · 👤 {r.solicitante_nome || '—'} · 🕐 {fmtDT(r.created_at)}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>{r.resumo_ia || r.mensagem_original}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        Motivo IA: {r.motivo_classificacao || '—'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openTriagem(r)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', color: '#10b981', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      <CheckCircleIcon style={{ width: 13, height: 13 }} /> Aprovar
                    </button>
                    <button onClick={() => descartar(r.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      <XMarkIcon style={{ width: 13, height: 13 }} /> Descartar
                    </button>
                  </div>
                </div>
              ))}
            </div>
      }

      {selected && (
        <Modal title={`Aprovar Triagem — ${selected.codigo}`} onClose={() => setSelected(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={lbl}>Resumo (editável)</label>
              <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={form.resumo_ia} onChange={e => f('resumo_ia', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Técnico Responsável</label>
              <select style={inp} value={form.tecnico_id} onChange={e => f('tecnico_id', e.target.value)}>
                <option value="">— Selecione —</option>
                {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Prioridade</label>
              <select style={inp} value={form.prioridade} onChange={e => f('prioridade', e.target.value)}>
                {Object.entries(PRIOR_CFG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            </div>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
              <strong>Mensagem original:</strong><br />{selected.mensagem_original}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSelected(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
              <button onClick={aprovar} disabled={!form.tecnico_id || salvando} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
                {salvando ? 'Aprovando...' : '✓ Aprovar e Notificar Técnico'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO: Logs IA
// ─────────────────────────────────────────────────────────────────────────────
function SecaoLogs({ workspaceId }) {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [detalhe, setDetalhe] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('logs_classificacao_ia')
      .select('*, grupo:whatsapp_grupos(nome_grupo), mensagem:mensagens_whatsapp_grupos(remetente_nome,mensagem)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(200)
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <ArrowPathIcon style={{ width: 14, height: 14 }} /> Atualizar
        </button>
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando...</div>
        : rows.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum log encontrado.</div>
          : <div style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Grupo','Remetente','Mensagem','Confiança','Resultado','Data',''].map((h, i) => (
                      <th key={i} style={{ padding: '9px 11px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const res    = r.resultado || {}
                    const pct    = Math.round((r.confianca || 0) * 100)
                    const cor    = pct >= 85 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#94a3b8'
                    const rotulo = r.virou_chamado ? '🟢 Chamado' : r.eh_triagem ? '🟡 Triagem' : '⚫ Ignorado'
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '9px 11px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{r.grupo?.nome_grupo || '—'}</td>
                        <td style={{ padding: '9px 11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.mensagem?.remetente_nome || '—'}</td>
                        <td style={{ padding: '9px 11px', maxWidth: 260 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240, fontSize: 12, color: 'var(--text-secondary)' }} title={r.mensagem?.mensagem}>{r.mensagem?.mensagem || '—'}</div>
                        </td>
                        <td style={{ padding: '9px 11px' }}><span style={{ fontWeight: 700, fontSize: 12, color: cor }}>{pct}%</span></td>
                        <td style={{ padding: '9px 11px', fontSize: 12, whiteSpace: 'nowrap' }}>{rotulo}</td>
                        <td style={{ padding: '9px 11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDT(r.created_at)}</td>
                        <td style={{ padding: '9px 11px' }}>
                          <button onClick={() => setDetalhe(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: 2 }}><EyeIcon style={{ width: 14, height: 14 }} /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
      }

      {detalhe && (
        <Modal title="Detalhe do Log — IA" onClose={() => setDetalhe(null)} maxWidth={620}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={lbl}>Grupo</span><span style={{ fontSize: 13 }}>{detalhe.grupo?.nome_grupo || '—'}</span></div>
              <div><span style={lbl}>Data</span><span style={{ fontSize: 13 }}>{fmtDT(detalhe.created_at)}</span></div>
              <div><span style={lbl}>Confiança</span><ConfBadge v={detalhe.confianca} /></div>
              <div><span style={lbl}>Resultado</span><span style={{ fontSize: 13 }}>{detalhe.virou_chamado ? '🟢 Chamado' : detalhe.eh_triagem ? '🟡 Triagem' : '⚫ Ignorado'}</span></div>
            </div>
            {detalhe.motivo && (
              <div><span style={lbl}>Motivo da IA</span><div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-secondary)' }}>{detalhe.motivo}</div></div>
            )}
            {detalhe.mensagem?.mensagem && (
              <div><span style={lbl}>Mensagem Analisada</span>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{detalhe.mensagem.mensagem}</div>
              </div>
            )}
            {detalhe.resultado && (
              <div><span style={lbl}>Resposta Completa da IA</span>
                <pre style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: 'var(--text-secondary)', overflowX: 'auto', margin: 0 }}>
                  {JSON.stringify(detalhe.resultado, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Navegação interna do módulo
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'dashboard',    label: 'Dashboard',   path: '/chamados-wa',                Icon: ChartBarIcon },
  { key: 'solicitacoes', label: 'Solicitações', path: '/chamados-wa/solicitacoes',   Icon: ClipboardIconWA },
  { key: 'triagem',      label: 'Triagem',      path: '/chamados-wa/triagem',        Icon: ExclamationTriangleIcon },
  { key: 'tecnicos',     label: 'Técnicos',     path: '/chamados-wa/tecnicos',       Icon: UserIcon },
  { key: 'grupos',       label: 'Grupos WA',    path: '/chamados-wa/grupos',         Icon: UserGroupIcon },
  { key: 'logs',         label: 'Logs IA',      path: '/chamados-wa/logs',           Icon: CpuChipIcon },
]

// Pequeno ícone inline para solicitações (heroicons não tem um clipboard genérico ótimo)
function ClipboardIconWA(props) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal exportado
// ─────────────────────────────────────────────────────────────────────────────
export default function ChamadosWA() {
  const navigate    = useNavigate()
  const location    = useLocation()
  const { workspaceId, ownerId } = useStore()

  // Determina seção ativa pelo pathname
  const path   = location.pathname
  let secao    = 'dashboard'
  if (path.includes('/tecnicos'))     secao = 'tecnicos'
  else if (path.includes('/grupos'))  secao = 'grupos'
  else if (path.includes('/triagem')) secao = 'triagem'
  else if (path.includes('/logs'))    secao = 'logs'
  else if (path.includes('/solicitacoes')) secao = 'solicitacoes'

  const secaoLabel = TABS.find(t => t.key === secao)?.label || 'Dashboard'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header title="Chamados por WhatsApp" subtitle={secaoLabel} />

      {/* Tabs de navegação */}
      <div style={{ padding: '0 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', gap: 2, overflowX: 'auto' }}>
        {TABS.map(tab => {
          const ativo = secao === tab.key
          return (
            <button key={tab.key} onClick={() => navigate(tab.path)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 14px', background: 'none', border: 'none', borderBottom: ativo ? '2px solid #6366f1' : '2px solid transparent', color: ativo ? '#6366f1' : 'var(--text-secondary)', fontWeight: ativo ? 700 : 500, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1, transition: 'color .15s' }}>
              <tab.Icon style={{ width: 14, height: 14 }} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo da seção */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {!workspaceId
          ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
              <CpuChipIcon style={{ width: 40, height: 40, margin: '0 auto 12px', color: '#6366f1', opacity: .4 }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Workspace não configurado</div>
              <div style={{ fontSize: 13 }}>Faça login com um usuário vinculado a um workspace.</div>
            </div>
          )
          : secao === 'dashboard'
            ? <SecaoDashboard workspaceId={workspaceId} navigate={navigate} />
            : secao === 'tecnicos'
              ? <SecaoTecnicos workspaceId={workspaceId} ownerId={ownerId} />
              : secao === 'grupos'
                ? <SecaoGrupos workspaceId={workspaceId} ownerId={ownerId} />
                : secao === 'solicitacoes'
                  ? <SecaoSolicitacoes workspaceId={workspaceId} />
                  : secao === 'triagem'
                    ? <SecaoTriagem workspaceId={workspaceId} />
                    : <SecaoLogs workspaceId={workspaceId} />
        }
      </div>
    </div>
  )
}
