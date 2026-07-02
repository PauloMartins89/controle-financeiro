import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import {
  PlusIcon, MagnifyingGlassIcon, PencilIcon, XMarkIcon,
  ArrowPathIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon, UserGroupIcon, UserIcon, ChartBarIcon,
  BellAlertIcon, CpuChipIcon, SignalIcon, PaperAirplaneIcon,
  ChevronRightIcon, EyeIcon, ArrowLeftIcon, TableCellsIcon,
  ArrowDownTrayIcon, FunnelIcon,
} from '@heroicons/react/24/outline'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDT  = d => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const fmtDT2 = d => d ? new Date(d).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

// ── Config ────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  aberta:                { label: 'Aberta',             color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  triagem:               { label: 'Triagem',            color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  enviada_tecnico:       { label: 'Enviada ao Técnico', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)'  },
  em_atendimento:        { label: 'Em Atendimento',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
  aguardando_informacao: { label: 'Aguard. Info',       color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  concluida:             { label: 'Concluída',          color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  descartada:            { label: 'Descartada',         color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  erro_classificacao:    { label: 'Erro IA',            color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
}
const PRIOR_CFG = {
  critica: { label: 'Crítica', color: '#ef4444', emoji: '🔴' },
  alta:    { label: 'Alta',    color: '#f97316', emoji: '🟠' },
  media:   { label: 'Média',   color: '#f59e0b', emoji: '🟡' },
  baixa:   { label: 'Baixa',   color: '#10b981', emoji: '🟢' },
}
const CAT_EMOJI = { telemetria:'📡', rastreador:'🛰️', aplicativo:'📱', sistema:'🖥️', instalacao:'🔧', manutencao:'🔩', sensor:'🎯', equipamento:'⚙️', comunicacao:'📶', outros:'📋' }

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Badge({ s }) {
  const c = STATUS_CFG[s] || { label: s, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  return <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{c.label}</span>
}
function PriorDot({ p }) {
  const c = PRIOR_CFG[p] || { emoji: '⚪', label: p || '—', color: '#94a3b8' }
  return <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>{c.emoji} {c.label}</span>
}
function ConfBar({ v }) {
  const pct   = Math.round((v || 0) * 100)
  const color = pct >= 85 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#94a3b8'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 48, height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
    </div>
  )
}

function ClipboardWAIcon(p) {
  return (
    <svg {...p} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

// ── ERP Header ────────────────────────────────────────────────────────────────
function ERPHeader({ kpis, loading, onRefresh, navigate }) {
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 600)
    return () => clearTimeout(t)
  }, [kpis])

  const chips = [
    { label: 'Abertos hoje',  value: kpis?.abertasHoje     ?? '—', color: '#6366f1', path: '/chamados-wa/solicitacoes' },
    { label: 'Triagem',       value: kpis?.emTriagem        ?? '—', color: '#f59e0b', path: '/chamados-wa/triagem' },
    { label: 'Env. técnico',  value: kpis?.enviadasTecnico  ?? '—', color: '#0ea5e9' },
    { label: 'Conf. média IA',value: `${kpis?.mediaConfianca ?? 0}%`, color: '#10b981' },
    { label: 'Grupos ativos', value: kpis?.totalGrupos      ?? '—', color: '#8b5cf6', path: '/chamados-wa/grupos' },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', height: 52, flexShrink: 0, paddingRight: 12 }}>
      {/* Brand block */}
      <div style={{ width: 200, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderRight: '1px solid var(--border)', height: '100%', flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ChatBubbleLeftRightIcon style={{ width: 16, height: 16, color: '#fff' }} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>Chamados WA</div>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>Bot silencioso · IA</div>
        </div>
      </div>

      {/* KPI chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', flex: 1, overflowX: 'auto' }}>
        {chips.map(c => (
          <button key={c.label} onClick={() => c.path && navigate(c.path)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: `${c.color}11`, border: `1px solid ${c.color}28`, borderRadius: 8, padding: '4px 12px', cursor: c.path ? 'pointer' : 'default', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: c.color, lineHeight: 1 }}>{loading ? '…' : c.value}</span>
            <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .3 }}>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Status + Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#10b981', fontWeight: 600 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: pulse ? 'wa-pulse .6s' : 'none' }} />
          Monitorando
        </div>
        <button onClick={onRefresh} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>
          <ArrowPathIcon style={{ width: 13, height: 13 }} /> Atualizar
        </button>
      </div>
      <style>{`@keyframes wa-pulse{0%{transform:scale(1)}50%{transform:scale(2.2);opacity:.4}100%{transform:scale(1)}}`}</style>
    </div>
  )
}

// ── ERP Sidebar ───────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'dashboard',    icon: ChartBarIcon,            label: 'Dashboard',    path: '/chamados-wa' },
  { key: 'solicitacoes', icon: ClipboardWAIcon,         label: 'Solicitações', path: '/chamados-wa/solicitacoes' },
  { key: 'triagem',      icon: ExclamationTriangleIcon, label: 'Triagem',      path: '/chamados-wa/triagem', badgeKey: 'emTriagem' },
  { key: 'relatorio',    icon: TableCellsIcon,          label: 'Relatório',    path: '/chamados-wa/relatorio' },
  { key: 'tecnicos',     icon: UserIcon,                label: 'Técnicos',     path: '/chamados-wa/tecnicos' },
  { key: 'grupos',       icon: UserGroupIcon,           label: 'Grupos WA',    path: '/chamados-wa/grupos' },
  { key: 'logs',         icon: CpuChipIcon,             label: 'Logs IA',      path: '/chamados-wa/logs' },
]

function ERPSidebar({ secao, kpis, onNavigate }) {
  return (
    <div style={{ width: 200, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '10px 8px', flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .8, padding: '4px 8px 10px' }}>Módulo</div>
        {NAV_ITEMS.map(item => {
          const ativo = secao === item.key
          const badge = item.badgeKey && (kpis?.[item.badgeKey] ?? 0) > 0 ? kpis[item.badgeKey] : null
          return (
            <button key={item.key} onClick={() => onNavigate(item.path)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: ativo ? 'rgba(99,102,241,0.1)' : 'transparent', color: ativo ? '#6366f1' : 'var(--text-secondary)', fontWeight: ativo ? 700 : 500, fontSize: 13, marginBottom: 2, textAlign: 'left', borderLeft: ativo ? '3px solid #6366f1' : '3px solid transparent', transition: 'all .12s' }}
              onMouseEnter={e => { if (!ativo) e.currentTarget.style.background = 'var(--bg-secondary)' }}
              onMouseLeave={e => { if (!ativo) e.currentTarget.style.background = 'transparent' }}>
              <item.icon style={{ width: 15, height: 15, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {badge && <span style={{ background: item.key === 'triagem' ? '#f59e0b' : '#6366f1', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>{badge}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, maxWidth = 560 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.4)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><XMarkIcon style={{ width: 18, height: 18 }} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

const lbl = { fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }
const inp = { width: '100%', padding: '8px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÕES
// ─────────────────────────────────────────────────────────────────────────────

function SecaoDashboard({ workspaceId, kpis, navigate }) {
  const cards = [
    { label: 'Total Chamados',   value: kpis?.total          ?? '—', color: '#6366f1', Icon: ClipboardWAIcon },
    { label: 'Abertos Hoje',     value: kpis?.abertasHoje    ?? 0,   color: '#f59e0b', Icon: BellAlertIcon },
    { label: 'Em Triagem',       value: kpis?.emTriagem      ?? 0,   color: '#f97316', Icon: ClockIcon },
    { label: 'Env. ao Técnico',  value: kpis?.enviadasTecnico ?? 0,  color: '#0ea5e9', Icon: PaperAirplaneIcon },
    { label: 'Descartados',      value: kpis?.descartadas    ?? 0,   color: '#94a3b8', Icon: XMarkIcon },
    { label: 'Confiança Média',  value: `${kpis?.mediaConfianca ?? 0}%`, color: '#10b981', Icon: CpuChipIcon },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '12px 14px', border: `1px solid ${c.color}22`, borderTop: `3px solid ${c.color}`, boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .4 }}>{c.label}</span>
              <c.Icon style={{ width: 13, height: 13, color: c.color }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Últimos chamados identificados</span>
          <button onClick={() => navigate('/chamados-wa/solicitacoes')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontSize: 12, fontWeight: 600 }}>
            Ver todos <ChevronRightIcon style={{ width: 13, height: 13 }} />
          </button>
        </div>
        {!kpis?.ultimos?.length
          ? <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum chamado ainda.</div>
          : kpis.ultimos.map((row, i) => (
              <div key={row.id} onClick={() => navigate('/chamados-wa/solicitacoes')}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < kpis.ultimos.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${STATUS_CFG[row.status]?.color || '#94a3b8'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13 }}>{CAT_EMOJI[row.categoria] || '📋'}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>{row.codigo}</span>
                    <Badge s={row.status} />
                    <PriorDot p={row.prioridade} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {row.grupo?.nome_grupo || '—'} · {row.solicitante_nome || '—'} · {row.resumo_ia || row.mensagem_original || '—'}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDT(row.created_at)}</div>
              </div>
            ))
        }
      </div>
    </div>
  )
}

// ── Solicitações — Master-Detail ──────────────────────────────────────────────
function SecaoSolicitacoes({ workspaceId }) {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [busca, setBusca]       = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [updating, setUpdating] = useState(false)

  async function load() {
    setLoading(true)
    let q = supabase.from('solicitacoes_atendimento')
      .select('*, grupo:whatsapp_grupos(id,nome_grupo,cliente), tecnico:tecnicos(id,nome,whatsapp)')
      .eq('workspace_id', workspaceId).not('status', 'eq', 'triagem')
      .order('created_at', { ascending: false }).limit(300)
    if (filtroStatus) q = q.eq('status', filtroStatus)
    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [filtroStatus])

  async function mudarStatus(id, status) {
    setUpdating(true)
    await supabase.from('solicitacoes_atendimento').update({ status }).eq('id', id)
    setUpdating(false)
    toast.success('Status atualizado')
    if (selected?.id === id) setSelected(s => ({ ...s, status }))
    load()
  }

  async function notificarTecnico(id) {
    const r = await fetch(`/api/chamados?id=${id}&action=notificar`, { method: 'POST' })
    const d = await r.json()
    d.ok ? toast.success('Técnico notificado!') : toast.error(d.motivo || 'Erro')
  }

  const filtrados = rows.filter(r => {
    if (filtroStatus && r.status !== filtroStatus) return false
    if (!busca) return true
    const b = busca.toLowerCase()
    return r.codigo?.toLowerCase().includes(b) || r.solicitante_nome?.toLowerCase().includes(b) || r.grupo?.nome_grupo?.toLowerCase().includes(b) || r.resumo_ia?.toLowerCase().includes(b)
  })

  const detailOpen = !!selected

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Master list */}
      <div style={{ display: 'flex', flexDirection: 'column', width: detailOpen ? 320 : '100%', minWidth: detailOpen ? 260 : undefined, flexShrink: 0, borderRight: detailOpen ? '1px solid var(--border)' : 'none', transition: 'width .2s', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '10px 10px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexShrink: 0, background: 'var(--bg-card)' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <MagnifyingGlassIcon style={{ width: 12, height: 12, position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input style={{ ...inp, paddingLeft: 26, fontSize: 12 }} placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <select style={{ ...inp, width: 120, fontSize: 12 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(STATUS_CFG).filter(([k]) => k !== 'triagem').map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={load} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <ArrowPathIcon style={{ width: 12, height: 12 }} />
          </button>
        </div>
        <div style={{ padding: '5px 10px', fontSize: 10, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
          {loading ? 'Carregando…' : `${filtrados.length} registro(s)`}
        </div>
        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtrados.map(row => {
            const ativo = selected?.id === row.id
            const sc    = STATUS_CFG[row.status] || { color: '#94a3b8', bg: 'rgba(148,163,184,.12)', label: row.status }
            return (
              <div key={row.id} onClick={() => setSelected(row)}
                style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: ativo ? 'rgba(99,102,241,0.07)' : 'var(--bg-card)', borderLeft: ativo ? '3px solid #6366f1' : '3px solid transparent', transition: 'background .1s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#6366f1' }}>{row.codigo}</span>
                  <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, fontWeight: 700, background: sc.bg, color: sc.color }}>{sc.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDT(row.created_at)}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                  {CAT_EMOJI[row.categoria] || '📋'} {row.grupo?.nome_grupo || '—'} · {row.solicitante_nome || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                  {row.equipamento ? <span style={{ color: '#8b5cf6', fontWeight: 700, marginRight: 6 }}>⚙ {row.equipamento}</span> : null}
                {row.local ? <span style={{ color: '#0ea5e9', fontWeight: 600, marginRight: 6 }}>📍 {row.local}</span> : null}
                {row.resumo_ia || row.mensagem_original || '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PriorDot p={row.prioridade} />
                  <ConfBar v={row.confianca_ia} />
                </div>
              </div>
            )
          })}
          {!loading && filtrados.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Nenhuma solicitação.</div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)', minWidth: 0 }}>
          {/* Detail header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex' }}>
              <ArrowLeftIcon style={{ width: 15, height: 15 }} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#6366f1' }}>{selected.codigo}</span>
            <Badge s={selected.status} />
            <PriorDot p={selected.prioridade} />
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDT2(selected.created_at)}</span>
          </div>
          {/* Detail body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Meta grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
              {[
                { label: 'Grupo',       value: selected.grupo?.nome_grupo || '—' },
                { label: 'Solicitante', value: `${selected.solicitante_nome || '—'}${selected.solicitante_whatsapp ? ` · ${selected.solicitante_whatsapp}` : ''}` },
                { label: 'Técnico',     value: selected.tecnico?.nome || '⚠ Não vinculado', vColor: !selected.tecnico ? '#ef4444' : undefined },
                { label: 'Categoria',   value: `${CAT_EMOJI[selected.categoria] || ''} ${selected.categoria || '—'}` },
                ...(selected.cliente  ? [{ label: 'Cliente',     value: selected.cliente }] : []),
                ...(selected.operacao ? [{ label: 'Operação',    value: selected.operacao }] : []),
                ...(selected.equipamento ? [{ label: 'Equipamento', value: `⚙ ${selected.equipamento}`, vColor: '#8b5cf6' }] : []),
                ...(selected.local    ? [{ label: 'Local',       value: `📍 ${selected.local}`, vColor: '#0ea5e9' }] : []),
                ...(selected.data_finalizacao ? [{ label: 'Finalizado em', value: fmtDT(selected.data_finalizacao) }] : []),
                ...(selected.quantidade_interacoes > 0 ? [{
                  label: 'Interações técnico',
                  value: `${selected.quantidade_interacoes}x${selected.data_primeira_interacao_tecnico ? ` · 1ª ${fmtDT(selected.data_primeira_interacao_tecnico)}` : ''}`,
                  vColor: '#10b981',
                }] : []),
              ].map(f => (
                <div key={f.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '9px 11px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: f.vColor || 'var(--text-primary)' }}>{f.value}</div>
                </div>
              ))}
              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '9px 11px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 5 }}>Confiança IA</div>
                <ConfBar v={selected.confianca_ia} />
              </div>
            </div>

            {/* Resumo IA */}
            <div style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.18)', borderRadius: 10, padding: '11px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>🤖 Resumo gerado pela IA</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{selected.resumo_ia || '—'}</div>
            </div>

            {/* Mensagem original */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>💬 Mensagem original</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: 1.6 }}>{selected.mensagem_original || '—'}</div>
            </div>

            {selected.motivo_classificacao && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', paddingLeft: 10, borderLeft: '3px solid var(--border)' }}>
                Motivo IA: {selected.motivo_classificacao}
              </div>
            )}

            {/* Resolução (SATs concluídos) */}
            {selected.status === 'concluida' && selected.resolucao_descricao && (
              <div style={{ background: 'rgba(16,185,129,.07)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 10, padding: '11px 14px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>✅ Resolução registrada</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{selected.resolucao_descricao}</div>
                {selected.data_finalizacao && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>Finalizado em {fmtDT2(selected.data_finalizacao)}</div>}
              </div>
            )}

            {/* Mudar status */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', padding: '11px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Alterar status</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['aberta','em_atendimento','aguardando_informacao','enviada_tecnico','concluida','descartada'].map(s => {
                  const sc   = STATUS_CFG[s]
                  const cur  = selected.status === s
                  return (
                    <button key={s} onClick={() => mudarStatus(selected.id, s)} disabled={updating || cur}
                      style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: cur ? 'default' : 'pointer', border: `1px solid ${sc.color}`, background: cur ? sc.bg : 'transparent', color: sc.color }}>
                      {sc.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {selected.tecnico && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => notificarTecnico(selected.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <PaperAirplaneIcon style={{ width: 14, height: 14 }} /> Renotificar {selected.tecnico.nome}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Triagem ───────────────────────────────────────────────────────────────────
function SecaoTriagem({ workspaceId, onKpisInvalidate }) {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [form, setForm]         = useState({})
  const [tecnicos, setTecnicos] = useState([])
  const [salvando, setSalvando] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: sats }, { data: tecs }] = await Promise.all([
      supabase.from('solicitacoes_atendimento').select('*, grupo:whatsapp_grupos(id,nome_grupo), tecnico:tecnicos(id,nome)').eq('workspace_id', workspaceId).eq('status', 'triagem').order('created_at', { ascending: false }),
      supabase.from('tecnicos').select('id,nome').eq('workspace_id', workspaceId).eq('ativo', true),
    ])
    setRows(sats || []); setTecnicos(tecs || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function aprovar() {
    setSalvando(true)
    const r = await fetch(`/api/chamados?id=${selected.id}&action=aprovar-triagem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json()
    setSalvando(false)
    if (d.error) { toast.error(d.error); return }
    toast.success('Aprovado e técnico notificado!')
    setSelected(null); load(); onKpisInvalidate?.()
  }

  async function descartar(id) {
    if (!confirm('Descartar?')) return
    await supabase.from('solicitacoes_atendimento').update({ status: 'descartada' }).eq('id', id)
    toast.success('Descartado'); load(); onKpisInvalidate?.()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, flexShrink: 0 }}>
        ⚠️ <strong>Triagem manual</strong> — IA com confiança 65–84%. Revise e decida.
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading
          ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando…</div>
          : rows.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: '#10b981', fontSize: 14, fontWeight: 700 }}>✓ Sem itens em triagem</div>
            : rows.map(r => (
                <div key={r.id} style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#6366f1' }}>{r.codigo}</span>
                    <ConfBar v={r.confianca_ia} />
                    <PriorDot p={r.prioridade} />
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-secondary)' }}>{fmtDT(r.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>📍 {r.grupo?.nome_grupo || '—'} · 👤 {r.solicitante_nome || '—'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>{r.resumo_ia || r.mensagem_original}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setForm({ tecnico_id: r.tecnico_id || '', prioridade: r.prioridade || 'media', resumo_ia: r.resumo_ia || '' }); setSelected(r) }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 8, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', color: '#10b981', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      <CheckCircleIcon style={{ width: 13, height: 13 }} /> Aprovar
                    </button>
                    <button onClick={() => descartar(r.id)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      <XMarkIcon style={{ width: 13, height: 13 }} /> Descartar
                    </button>
                  </div>
                </div>
              ))
        }
      </div>

      {selected && (
        <Modal title={`Aprovar — ${selected.codigo}`} onClose={() => setSelected(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={lbl}>Resumo (editável)</label><textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={form.resumo_ia} onChange={e => f('resumo_ia', e.target.value)} /></div>
            <div><label style={lbl}>Técnico responsável *</label>
              <select style={inp} value={form.tecnico_id} onChange={e => f('tecnico_id', e.target.value)}>
                <option value="">— Selecione —</option>
                {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Prioridade</label>
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
                {salvando ? 'Aprovando…' : '✓ Aprovar e Notificar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Técnicos ──────────────────────────────────────────────────────────────────
function SecaoTecnicos({ workspaceId, ownerId }) {
  const [rows, setRows]     = useState([])
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)
  const [busca, setBusca]   = useState('')

  async function load() {
    const { data } = await supabase.from('tecnicos').select('*, _grupos:whatsapp_grupos(id,nome_grupo)').eq('workspace_id', workspaceId).order('nome')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!form.nome?.trim() || !form.whatsapp?.trim()) { toast.error('Nome e WhatsApp obrigatórios'); return }
    setSaving(true)
    const pl = { nome: form.nome, whatsapp: form.whatsapp, email: form.email || null, regiao: form.regiao || null, equipe: form.equipe || null, ativo: form.ativo !== false, observacoes: form.observacoes || null, workspace_id: workspaceId, owner_id: ownerId }
    let error
    if (modal.mode === 'new') { ;({ error } = await supabase.from('tecnicos').insert(pl)) }
    else { ;({ error } = await supabase.from('tecnicos').update(pl).eq('id', modal.id)) }
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Salvo!'); setModal(null); load()
  }

  async function toggleAtivo(r) {
    await supabase.from('tecnicos').update({ ativo: !r.ativo }).eq('id', r.id)
    toast.success(r.ativo ? 'Inativado' : 'Ativado'); load()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const filtrados = rows.filter(r => !busca || r.nome?.toLowerCase().includes(busca.toLowerCase()) || r.whatsapp?.includes(busca))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <MagnifyingGlassIcon style={{ width: 12, height: 12, position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input style={{ ...inp, paddingLeft: 26, fontSize: 12 }} placeholder="Buscar…" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <button onClick={() => { setForm({ ativo: true }); setModal({ mode: 'new' }) }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, padding: '7px 13px', flexShrink: 0 }}>
          <PlusIcon style={{ width: 14, height: 14 }} /> Novo
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 10, alignContent: 'start' }}>
        {filtrados.map(r => (
          <div key={r.id} style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px', opacity: r.ativo ? 1 : .55 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(99,102,241,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UserIcon style={{ width: 15, height: 15, color: '#6366f1' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{r.nome}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>📱 {r.whatsapp || '—'}</div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: r.ativo ? 'rgba(16,185,129,.12)' : 'rgba(148,163,184,.12)', color: r.ativo ? '#10b981' : '#94a3b8' }}>{r.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
            {r.regiao && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>📍 {r.regiao}{r.equipe ? ` · ${r.equipe}` : ''}</div>}
            {r._grupos?.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>Grupos: {r._grupos.map(g => g.nome_grupo).join(', ')}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { setForm({ ...r }); setModal({ mode: 'edit', id: r.id }) }} style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>✏ Editar</button>
              <button onClick={() => toggleAtivo(r)} style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: `1px solid ${r.ativo ? 'rgba(239,68,68,.25)' : 'rgba(16,185,129,.25)'}`, background: r.ativo ? 'rgba(239,68,68,.07)' : 'rgba(16,185,129,.07)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: r.ativo ? '#ef4444' : '#10b981' }}>{r.ativo ? '⊗ Inativar' : '✓ Ativar'}</button>
            </div>
          </div>
        ))}
        {filtrados.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum técnico.</div>}
      </div>
      {modal && (
        <Modal title={modal.mode === 'new' ? 'Novo Técnico' : 'Editar Técnico'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Nome *</label><input style={inp} value={form.nome || ''} onChange={e => f('nome', e.target.value)} /></div>
            <div><label style={lbl}>WhatsApp *</label><input style={inp} value={form.whatsapp || ''} onChange={e => f('whatsapp', e.target.value)} placeholder="5567999998888" /></div>
            <div><label style={lbl}>E-mail</label><input style={inp} value={form.email || ''} onChange={e => f('email', e.target.value)} /></div>
            <div><label style={lbl}>Região</label><input style={inp} value={form.regiao || ''} onChange={e => f('regiao', e.target.value)} /></div>
            <div><label style={lbl}>Equipe</label><input style={inp} value={form.equipe || ''} onChange={e => f('equipe', e.target.value)} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Observações</label><textarea style={{ ...inp, minHeight: 52, resize: 'vertical' }} value={form.observacoes || ''} onChange={e => f('observacoes', e.target.value)} /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" id="tec-ativo" checked={form.ativo !== false} onChange={e => f('ativo', e.target.checked)} /><label htmlFor="tec-ativo" style={{ fontSize: 13 }}>Ativo</label></div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setModal(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>{saving ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Capturador de JIDs descobertos ───────────────────────────────────────────
function JidsDescobertos({ onSelect }) {
  const [jids, setJids]       = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState(null)

  async function buscar() {
    setLoading(true); setErro(null)
    try {
      const r = await fetch('/api/chamados-setup?action=jids-descobertos')
      const d = await r.json()
      setJids(d.jids || [])
      if (!d.jids?.length) setErro('Nenhum JID capturado ainda. Envie uma mensagem no grupo e clique novamente.')
    } catch { setErro('Erro ao buscar JIDs') }
    setLoading(false)
  }

  return (
    <div style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', flex: 1 }}>📡 Capturar JID automaticamente</span>
        <button onClick={buscar} disabled={loading}
          style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}>
          {loading ? '…' : '🔍 Buscar'}
        </button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: jids.length ? 8 : 0 }}>
        Envie qualquer mensagem no grupo WA → clique Buscar → selecione o JID capturado
      </div>
      {erro && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>{erro}</div>}
      {jids.map(j => (
        <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, background: 'var(--bg-card)', borderRadius: 7, padding: '6px 10px', border: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.jid}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{j.remetente} · {j.msg?.slice(0, 50)}</div>
          </div>
          <button onClick={() => onSelect(j.jid)}
            style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: 'rgba(16,185,129,.12)', color: '#10b981', border: '1px solid rgba(16,185,129,.25)', cursor: 'pointer', flexShrink: 0 }}>
            Usar
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Grupos ────────────────────────────────────────────────────────────────────
function SecaoGrupos({ workspaceId, ownerId }) {
  const [rows, setRows]       = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState({})
  const [saving, setSaving]   = useState(false)

  async function load() {
    const [{ data: g }, { data: t }] = await Promise.all([
      supabase.from('whatsapp_grupos').select('*, tecnico:tecnicos(id,nome)').eq('workspace_id', workspaceId).order('nome_grupo'),
      supabase.from('tecnicos').select('id,nome').eq('workspace_id', workspaceId).eq('ativo', true),
    ])
    setRows(g || []); setTecnicos(t || [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!form.zapi_group_id?.trim() || !form.nome_grupo?.trim()) { toast.error('ID e nome obrigatórios'); return }
    setSaving(true)
    const pl = { zapi_group_id: form.zapi_group_id.trim(), nome_grupo: form.nome_grupo.trim(), cliente: form.cliente || null, operacao: form.operacao || null, regiao: form.regiao || null, tecnico_id: form.tecnico_id || null, nivel_monitoramento: form.nivel_monitoramento || 'medio', ativo: form.ativo !== false, observacoes: form.observacoes || null, workspace_id: workspaceId, owner_id: ownerId }
    let error
    if (modal.mode === 'new') { ;({ error } = await supabase.from('whatsapp_grupos').insert(pl)) }
    else { ;({ error } = await supabase.from('whatsapp_grupos').update(pl).eq('id', modal.id)) }
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Salvo!'); setModal(null); load()
  }

  async function toggleAtivo(r) {
    await supabase.from('whatsapp_grupos').update({ ativo: !r.ativo }).eq('id', r.id)
    toast.success(r.ativo ? 'Suspenso' : 'Ativado'); load()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const NC = { baixo: '#10b981', medio: '#f59e0b', alto: '#ef4444' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, flexShrink: 0 }}>
        <button onClick={() => { setForm({ ativo: true, nivel_monitoramento: 'medio' }); setModal({ mode: 'new' }) }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, padding: '7px 13px' }}>
          <PlusIcon style={{ width: 14, height: 14 }} /> Novo Grupo
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              {['Grupo','ID Z-API','Cliente','Técnico','Nível','Status',''].map((h, i) => (
                <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .5, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', opacity: r.ativo ? 1 : .5 }}>
                <td style={{ padding: '9px 12px', fontWeight: 700 }}>{r.nome_grupo}</td>
                <td style={{ padding: '9px 12px' }}><code style={{ fontSize: 10, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-secondary)' }}>{r.zapi_group_id}</code></td>
                <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>{r.cliente || '—'}</td>
                <td style={{ padding: '9px 12px' }}>{r.tecnico?.nome || <span style={{ color: '#ef4444', fontSize: 11 }}>⚠ Sem técnico</span>}</td>
                <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, color: NC[r.nivel_monitoramento] }}>● {r.nivel_monitoramento}</span></td>
                <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, color: r.ativo ? '#10b981' : '#94a3b8' }}>{r.ativo ? '● Ativo' : '○ Pausado'}</span></td>
                <td style={{ padding: '9px 12px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { setForm({ ...r, tecnico_id: r.tecnico_id || '' }); setModal({ mode: 'edit', id: r.id }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: 3 }}><PencilIcon style={{ width: 13, height: 13 }} /></button>
                    <button onClick={() => toggleAtivo(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: r.ativo ? '#ef4444' : '#10b981', padding: 3 }}><SignalIcon style={{ width: 13, height: 13 }} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum grupo. Adicione o ID do grupo Z-API.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={modal.mode === 'new' ? 'Novo Grupo Monitorado' : 'Editar Grupo'} onClose={() => setModal(null)} maxWidth={580}>
          {/* Banner de JIDs descobertos */}
          <JidsDescobertos onSelect={jid => f('zapi_group_id', jid)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Nome do Grupo *</label><input style={inp} value={form.nome_grupo || ''} onChange={e => f('nome_grupo', e.target.value)} placeholder="Suporte Suzano MS" /></div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>ID do Grupo Z-API *</label>
              <input style={inp} value={form.zapi_group_id || ''} onChange={e => f('zapi_group_id', e.target.value)} placeholder="5567999990000-1234567890@g.us" />
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>Campo "phone" no payload do webhook. Mande uma msg no grupo e clique em "Capturar JID" acima.</div>
            </div>
            <div><label style={lbl}>Cliente</label><input style={inp} value={form.cliente || ''} onChange={e => f('cliente', e.target.value)} /></div>
            <div><label style={lbl}>Região</label><input style={inp} value={form.regiao || ''} onChange={e => f('regiao', e.target.value)} /></div>
            <div><label style={lbl}>Técnico Responsável</label>
              <select style={inp} value={form.tecnico_id || ''} onChange={e => f('tecnico_id', e.target.value)}>
                <option value="">— Sem técnico —</option>
                {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Nível de Monitoramento</label>
              <select style={inp} value={form.nivel_monitoramento || 'medio'} onChange={e => f('nivel_monitoramento', e.target.value)}>
                <option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Observações</label><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={form.observacoes || ''} onChange={e => f('observacoes', e.target.value)} /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" id="grp-ativo" checked={form.ativo !== false} onChange={e => f('ativo', e.target.checked)} /><label htmlFor="grp-ativo" style={{ fontSize: 13 }}>Monitoramento ativo</label></div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setModal(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>{saving ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Logs ──────────────────────────────────────────────────────────────────────
function SecaoLogs({ workspaceId }) {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [detalhe, setDetalhe] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('logs_classificacao_ia')
      .select('*, grupo:whatsapp_grupos(nome_grupo)')
      .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(300)
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10, flexShrink: 0 }}>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <ArrowPathIcon style={{ width: 12, height: 12 }} /> Atualizar
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              {['Grupo','Motivo IA','Confiança','Resultado','Data',''].map((h, i) => (
                <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .5, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum log.</td></tr>}
            {rows.map(r => {
              const pct   = Math.round((r.confianca || 0) * 100)
              const cor   = pct >= 85 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#94a3b8'
              const label = r.virou_chamado ? '🟢 Chamado' : r.eh_triagem ? '🟡 Triagem' : '⚫ Ignorado'
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{r.grupo?.nome_grupo || '—'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.motivo?.slice(0, 60) || '—'}</td>
                  <td style={{ padding: '8px 12px' }}><ConfBar v={r.confianca} /></td>
                  <td style={{ padding: '8px 12px', fontSize: 11, whiteSpace: 'nowrap' }}>{label}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDT(r.created_at)}</td>
                  <td style={{ padding: '8px 12px' }}><button onClick={() => setDetalhe(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: 2 }}><EyeIcon style={{ width: 13, height: 13 }} /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {detalhe && (
        <Modal title="Detalhe do Log IA" onClose={() => setDetalhe(null)} maxWidth={560}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={lbl}>Grupo</span><span style={{ fontSize: 13 }}>{detalhe.grupo?.nome_grupo || '—'}</span></div>
              <div><span style={lbl}>Data</span><span style={{ fontSize: 13 }}>{fmtDT(detalhe.created_at)}</span></div>
              <div><span style={lbl}>Confiança</span><ConfBar v={detalhe.confianca} /></div>
              <div><span style={lbl}>Resultado</span><span style={{ fontSize: 13 }}>{detalhe.virou_chamado ? '🟢 Virou chamado' : detalhe.eh_triagem ? '🟡 Triagem' : '⚫ Ignorado'}</span></div>
            </div>
            {detalhe.motivo && <div><span style={lbl}>Motivo IA</span><div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-secondary)' }}>{detalhe.motivo}</div></div>}
            {detalhe.resultado && <div><span style={lbl}>JSON da IA</span><pre style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: 'var(--text-secondary)', overflowX: 'auto', margin: 0 }}>{JSON.stringify(detalhe.resultado, null, 2)}</pre></div>}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── SLA helpers ──────────────────────────────────────────────────────────────
function calcSLA(abertura, fechamento) {
  const fim   = fechamento ? new Date(fechamento) : new Date()
  const ms    = fim - new Date(abertura)
  const mins  = Math.floor(ms / 60000)
  const horas = Math.floor(mins / 60)
  const dias  = Math.floor(horas / 24)
  if (dias > 0)       return { texto: `${dias}d ${horas % 24}h`, horas, aberto: !fechamento }
  if (horas > 0)      return { texto: `${horas}h ${mins % 60}m`, horas, aberto: !fechamento }
  return { texto: `${mins}m`, horas: mins / 60, aberto: !fechamento }
}
function slaCor(horas, aberto) {
  if (aberto) return horas > 24 ? '#ef4444' : horas > 4 ? '#f59e0b' : '#6366f1'
  return horas <= 4 ? '#10b981' : horas <= 24 ? '#f59e0b' : '#ef4444'
}
function slaBadge(horas, aberto, texto) {
  const cor = slaCor(horas, aberto)
  const bg  = cor + '18'
  const label = aberto ? `⏳ ${texto}` : `✓ ${texto}`
  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, color: cor, background: bg, whiteSpace: 'nowrap' }}>{label}</span>
}

// ── Exportação CSV ────────────────────────────────────────────────────────────
function exportCSV(rows) {
  const cols = [
    ['Código',       r => r.codigo],
    ['Status',       r => STATUS_CFG[r.status]?.label || r.status],
    ['Prioridade',   r => r.prioridade],
    ['Categoria',    r => r.categoria || ''],
    ['Grupo',        r => r.grupo?.nome_grupo || ''],
    ['Equipamento',  r => r.equipamento || ''],
    ['Local',        r => r.local || ''],
    ['Cliente',      r => r.cliente || ''],
    ['Operação',     r => r.operacao || ''],
    ['Solicitante',  r => r.solicitante_nome || ''],
    ['Interações',   r => r.quantidade_interacoes || 0],
    ['1ª Interação', r => r.data_primeira_interacao_tecnico ? new Date(r.data_primeira_interacao_tecnico).toLocaleString('pt-BR') : ''],
    ['Técnico',      r => r.tecnico?.nome || ''],
    ['Resumo',       r => (r.resumo_ia || r.mensagem_original || '').replace(/["\n]/g, ' ')],
    ['Abertura',     r => r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : ''],
    ['Fechamento',   r => r.data_finalizacao ? new Date(r.data_finalizacao).toLocaleString('pt-BR') : ''],
    ['Tempo (h)',    r => r.data_finalizacao ? calcSLA(r.created_at, r.data_finalizacao).horas.toFixed(1) : ''],
    ['Resolução',    r => (r.resolucao_descricao || '').replace(/["\n]/g, ' ')],
  ]
  const header = cols.map(([h]) => `"${h}"`).join(';')
  const body   = rows.map(r => cols.map(([, fn]) => `"${fn(r)}"`).join(';')).join('\n')
  const blob   = new Blob([`\uFEFF${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href = url; a.download = `chamados-${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── Seção Relatório ───────────────────────────────────────────────────────────
function SecaoRelatorio({ workspaceId }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [tecnicos, setTecnicos] = useState([])
  const [grupos, setGrupos]   = useState([])
  const [sort, setSort]       = useState({ col: 'created_at', dir: 'desc' })
  const [filtros, setFiltros] = useState({
    busca: '', status: '', tecnico_id: '', grupo_id: '', prioridade: '',
    de: '', ate: '',
  })

  async function load() {
    setLoading(true)
    const [{ data: sats }, { data: tecs }, { data: grps }] = await Promise.all([
      supabase
        .from('solicitacoes_atendimento')
        .select('*, grupo:whatsapp_grupos(id,nome_grupo), tecnico:tecnicos(id,nome)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase.from('tecnicos').select('id,nome').eq('workspace_id', workspaceId).eq('ativo', true),
      supabase.from('whatsapp_grupos').select('id,nome_grupo').eq('workspace_id', workspaceId).eq('ativo', true),
    ])
    setRows(sats || []); setTecnicos(tecs || []); setGrupos(grps || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const setF = (k, v) => setFiltros(p => ({ ...p, [k]: v }))

  // Aplicar filtros
  const filtrados = rows.filter(r => {
    if (filtros.status     && r.status      !== filtros.status)     return false
    if (filtros.tecnico_id && r.tecnico_id  !== filtros.tecnico_id) return false
    if (filtros.grupo_id   && r.grupo_id    !== filtros.grupo_id)   return false
    if (filtros.prioridade && r.prioridade  !== filtros.prioridade) return false
    if (filtros.de  && new Date(r.created_at) < new Date(filtros.de))  return false
    if (filtros.ate && new Date(r.created_at) > new Date(filtros.ate + 'T23:59:59')) return false
    if (filtros.busca) {
      const b = filtros.busca.toLowerCase()
      return r.codigo?.toLowerCase().includes(b)
          || r.solicitante_nome?.toLowerCase().includes(b)
          || r.resumo_ia?.toLowerCase().includes(b)
          || r.equipamento?.toLowerCase().includes(b)
          || r.grupo?.nome_grupo?.toLowerCase().includes(b)
    }
    return true
  })

  // Ordenar
  const ordenados = [...filtrados].sort((a, b) => {
    const mult = sort.dir === 'asc' ? 1 : -1
    const va   = a[sort.col] ?? ''
    const vb   = b[sort.col] ?? ''
    return va < vb ? -mult : va > vb ? mult : 0
  })

  // KPIs derivados
  const concluidas  = filtrados.filter(r => r.status === 'concluida')
  const comTempo    = concluidas.filter(r => r.data_finalizacao)
  const tempos      = comTempo.map(r => calcSLA(r.created_at, r.data_finalizacao).horas)
  const mediaHoras  = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0
  const dentroPrazo = comTempo.filter(r => calcSLA(r.created_at, r.data_finalizacao).horas <= 4).length
  const emAberto    = filtrados.filter(r => !['concluida','descartada'].includes(r.status))
  const vencidos    = emAberto.filter(r => calcSLA(r.created_at, null).horas > 24)

  const pctResolvidos = filtrados.length ? Math.round(concluidas.length / filtrados.length * 100) : 0
  const pctSLA        = comTempo.length  ? Math.round(dentroPrazo / comTempo.length * 100) : 0

  function thSort(col) {
    return () => setSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }))
  }
  function thArrow(col) {
    if (sort.col !== col) return ''
    return sort.dir === 'asc' ? ' ▲' : ' ▼'
  }

  const thStyle = (col) => ({
    padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700,
    color: sort.col === col ? '#6366f1' : 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: .4, borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
    background: 'var(--bg-secondary)',
  })
  const tdStyle = { padding: '8px 10px', fontSize: 12, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: 0 }}>

      {/* KPI summary bar */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 0 12px', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          { label: 'Total no período', value: filtrados.length,            color: '#6366f1' },
          { label: '% Resolvidos',     value: `${pctResolvidos}%`,         color: '#10b981' },
          { label: 'Tempo médio',      value: mediaHoras > 0 ? (mediaHoras < 1 ? `${Math.round(mediaHoras*60)}m` : `${mediaHoras.toFixed(1)}h`) : '—', color: '#8b5cf6' },
          { label: 'Dentro do SLA',   value: comTempo.length ? `${pctSLA}%` : '—', color: '#0ea5e9', sub: '< 4h' },
          { label: 'Em aberto',        value: emAberto.length,             color: '#f59e0b' },
          { label: '> 24h em aberto',  value: vencidos.length,             color: vencidos.length > 0 ? '#ef4444' : '#94a3b8' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '9px 14px', border: `1px solid ${k.color}22`, borderTop: `3px solid ${k.color}`, flexShrink: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 2 }}>{k.label}{k.sub ? <span style={{ color: k.color, marginLeft: 4 }}>{k.sub}</span> : null}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color, lineHeight: 1 }}>{loading ? '…' : k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, flexShrink: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', alignItems: 'center' }}>
        <FunnelIcon style={{ width: 13, height: 13, color: 'var(--text-secondary)', flexShrink: 0 }} />
        <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 120 }}>
          <MagnifyingGlassIcon style={{ width: 11, height: 11, position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input style={{ ...inp, paddingLeft: 24, fontSize: 12, width: '100%' }} placeholder="Buscar…" value={filtros.busca} onChange={e => setF('busca', e.target.value)} />
        </div>
        <select style={{ ...inp, fontSize: 12, flex: '1 1 110px', minWidth: 90 }} value={filtros.status} onChange={e => setF('status', e.target.value)}>
          <option value="">Todos status</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={{ ...inp, fontSize: 12, flex: '1 1 110px', minWidth: 90 }} value={filtros.tecnico_id} onChange={e => setF('tecnico_id', e.target.value)}>
          <option value="">Todos técnicos</option>
          {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select style={{ ...inp, fontSize: 12, flex: '1 1 110px', minWidth: 90 }} value={filtros.grupo_id} onChange={e => setF('grupo_id', e.target.value)}>
          <option value="">Todos grupos</option>
          {grupos.map(g => <option key={g.id} value={g.id}>{g.nome_grupo}</option>)}
        </select>
        <select style={{ ...inp, fontSize: 12, flex: '0 0 100px' }} value={filtros.prioridade} onChange={e => setF('prioridade', e.target.value)}>
          <option value="">Prioridade</option>
          {Object.entries(PRIOR_CFG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
        </select>
        <input type="date" style={{ ...inp, fontSize: 12, flex: '0 0 126px' }} value={filtros.de}  onChange={e => setF('de',  e.target.value)} title="De" />
        <input type="date" style={{ ...inp, fontSize: 12, flex: '0 0 126px' }} value={filtros.ate} onChange={e => setF('ate', e.target.value)} title="Até" />
        <button onClick={() => setFiltros({ busca:'', status:'', tecnico_id:'', grupo_id:'', prioridade:'', de:'', ate:'' })}
          style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>Limpar</button>
        <button onClick={() => exportCSV(ordenados)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          <ArrowDownTrayIcon style={{ width: 13, height: 13 }} /> CSV
        </button>
        <button onClick={load} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
          <ArrowPathIcon style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* Contador */}
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 6, flexShrink: 0 }}>
        {loading ? 'Carregando…' : `${ordenados.length} registro(s)`}
      </div>

      {/* Tabela */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr>
              <th style={thStyle('codigo')}      onClick={thSort('codigo')}      >Código{thArrow('codigo')}</th>
              <th style={thStyle('status')}      onClick={thSort('status')}      >Status{thArrow('status')}</th>
              <th style={thStyle('prioridade')}  onClick={thSort('prioridade')}  >Prior.{thArrow('prioridade')}</th>
              <th style={thStyle('grupo_id')}    onClick={thSort('grupo_id')}    >Grupo{thArrow('grupo_id')}</th>
              <th style={thStyle('equipamento')} onClick={thSort('equipamento')} >Equip.{thArrow('equipamento')}</th>
              <th style={thStyle('local')}       onClick={thSort('local')}       >Local{thArrow('local')}</th>
              <th style={thStyle('cliente')}     onClick={thSort('cliente')}     >Cliente{thArrow('cliente')}</th>
              <th style={thStyle('solicitante_nome')} onClick={thSort('solicitante_nome')}>Solicitante{thArrow('solicitante_nome')}</th>
              <th style={thStyle('tecnico_id')}  onClick={thSort('tecnico_id')}  >Técnico{thArrow('tecnico_id')}</th>
              <th style={thStyle('resumo_ia')}                                   >Resumo</th>
              <th style={thStyle('created_at')}  onClick={thSort('created_at')}  >Abertura{thArrow('created_at')}</th>
              <th style={thStyle('data_finalizacao')} onClick={thSort('data_finalizacao')}>Fechamento{thArrow('data_finalizacao')}</th>
              <th style={{ ...thStyle('_sla'), textAlign: 'center' }}            >SLA</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando…</td></tr>
            )}
            {!loading && ordenados.length === 0 && (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum chamado no período.</td></tr>
            )}
            {ordenados.map((r, i) => {
              const sla  = calcSLA(r.created_at, r.data_finalizacao)
              const cor  = slaCor(sla.horas, sla.aberto)
              const sc   = STATUS_CFG[r.status] || { label: r.status, color: '#94a3b8', bg: 'rgba(148,163,184,.12)' }
              const pc   = PRIOR_CFG[r.prioridade]
              return (
                <tr key={r.id} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)', transition: 'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)'}>
                  <td style={tdStyle}><span style={{ fontWeight: 800, color: '#6366f1', fontSize: 11 }}>{r.codigo}</span></td>
                  <td style={tdStyle}><span style={{ padding: '2px 7px', borderRadius: 12, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>{sc.label}</span></td>
                  <td style={tdStyle}>{pc ? <span style={{ fontSize: 11, fontWeight: 700, color: pc.color }}>{pc.emoji}</span> : '—'}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.grupo?.nome_grupo || '—'}</td>
                  <td style={{ ...tdStyle, color: '#8b5cf6', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.equipamento || <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>—</span>}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#0ea5e9', fontSize: 11 }}>{r.local || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 11 }}>{r.cliente || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.solicitante_nome || '—'}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{r.tecnico?.nome || <span style={{ color: '#ef4444', fontSize: 11 }}>⚠ N/A</span>}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.resumo_ia || r.mensagem_original}>
                    {r.resumo_ia || r.mensagem_original || '—'}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{fmtDT(r.created_at)}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{r.data_finalizacao ? fmtDT(r.data_finalizacao) : <span style={{ color: '#f59e0b' }}>Em aberto</span>}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{slaBadge(sla.horas, sla.aberto, sla.texto)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ERP Shell — componente raiz
// ─────────────────────────────────────────────────────────────────────────────
export default function ChamadosWA() {
  const navigate                 = useNavigate()
  const location                 = useLocation()
  const { workspaceId, ownerId } = useStore()
  const [kpis, setKpis]          = useState({})
  const [kpisLoading, setKpisLoading] = useState(true)
  const timer                    = useRef(null)

  const path  = location.pathname
  let secao   = 'dashboard'
  if      (path.includes('/tecnicos'))     secao = 'tecnicos'
  else if (path.includes('/grupos'))       secao = 'grupos'
  else if (path.includes('/triagem'))      secao = 'triagem'
  else if (path.includes('/logs'))         secao = 'logs'
  else if (path.includes('/relatorio'))    secao = 'relatorio'
  else if (path.includes('/solicitacoes')) secao = 'solicitacoes'

  const loadKpis = useCallback(async () => {
    if (!workspaceId) return
    try {
      setKpisLoading(true)
      const d = await fetch(`/api/chamados?action=dashboard&workspace_id=${workspaceId}`).then(r => r.json())
      setKpis(d || {})
    } catch { /* silencioso */ }
    setKpisLoading(false)
  }, [workspaceId])

  useEffect(() => {
    loadKpis()
    timer.current = setInterval(loadKpis, 30_000)
    return () => clearInterval(timer.current)
  }, [loadKpis])

  if (!workspaceId) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', flexDirection: 'column', gap: 12 }}>
      <CpuChipIcon style={{ width: 36, height: 36, opacity: .3 }} />
      <span style={{ fontSize: 14 }}>Workspace não configurado</span>
    </div>
  )

  const secaoLabel = NAV_ITEMS.find(n => n.key === secao)?.label || 'Dashboard'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ERP Header */}
      <ERPHeader kpis={kpis} loading={kpisLoading} onRefresh={loadKpis} navigate={navigate} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ERP Sidebar */}
        <ERPSidebar secao={secao} kpis={kpis} onNavigate={navigate} />

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
            <ChatBubbleLeftRightIcon style={{ width: 11, height: 11 }} />
            <span>Chamados WA</span>
            <ChevronRightIcon style={{ width: 10, height: 10 }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{secaoLabel}</span>
          </div>

          {/* Section */}
          <div style={{ flex: 1, overflow: ['solicitacoes','triagem','tecnicos','grupos','logs','relatorio'].includes(secao) ? 'hidden' : 'auto', padding: ['solicitacoes','relatorio'].includes(secao) ? 0 : '14px 18px' }}>
            {secao === 'dashboard'    && <SecaoDashboard workspaceId={workspaceId} kpis={kpis} navigate={navigate} />}
            {secao === 'solicitacoes' && <SecaoSolicitacoes workspaceId={workspaceId} />}
            {secao === 'triagem'      && <SecaoTriagem workspaceId={workspaceId} onKpisInvalidate={loadKpis} />}
            {secao === 'relatorio'    && <div style={{ padding: '12px 18px 0', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}><SecaoRelatorio workspaceId={workspaceId} /></div>}
            {secao === 'tecnicos'     && <SecaoTecnicos workspaceId={workspaceId} ownerId={ownerId} />}
            {secao === 'grupos'       && <SecaoGrupos workspaceId={workspaceId} ownerId={ownerId} />}
            {secao === 'logs'         && <SecaoLogs workspaceId={workspaceId} />}
          </div>
        </div>
      </div>
    </div>
  )
}
