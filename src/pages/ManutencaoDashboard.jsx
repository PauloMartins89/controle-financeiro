import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import {
  WrenchScrewdriverIcon, ClipboardDocumentListIcon, CalendarDaysIcon,
  ExclamationTriangleIcon, CheckCircleIcon, ClockIcon, ArrowPathIcon,
  BoltIcon, ArrowRightIcon, PlusIcon,
} from '@heroicons/react/24/outline'

const fmtD = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const today = () => new Date().toISOString().slice(0, 10)
const minus = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

const STATUS_CFG = {
  aberta:           { label: 'Aberta',           color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  em_andamento:     { label: 'Em Andamento',      color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  aguardando_peca:  { label: 'Aguard. Peça',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  concluida:        { label: 'Concluída',         color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  cancelada:        { label: 'Cancelada',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

const PRIOR_CFG = {
  critica: { label: 'Crítica', color: '#ef4444' },
  alta:    { label: 'Alta',    color: '#f97316' },
  media:   { label: 'Média',   color: '#f59e0b' },
  baixa:   { label: 'Baixa',   color: '#10b981' },
}

const TIPO_CFG = {
  corretiva:   { label: 'Corretiva',  color: '#ef4444', icon: '🔧' },
  preventiva:  { label: 'Preventiva', color: '#6366f1', icon: '📅' },
  preditiva:   { label: 'Preditiva',  color: '#8b5cf6', icon: '📊' },
  melhoria:    { label: 'Melhoria',   color: '#10b981', icon: '⬆️' },
}

function KPICard({ label, value, sub, color, bg, icon: Icon, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: `linear-gradient(135deg, ${color}14 0%, var(--bg-card) 55%)`,
        borderRadius: 14, padding: '14px 16px',
        border: `1px solid ${color}28`, borderTop: `3px solid ${color}`,
        boxShadow: 'var(--shadow-card)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 15, height: 15, color }} />
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{c.label}</span>
}

function PriorBadge({ p }) {
  const c = PRIOR_CFG[p] || { label: p, color: '#94a3b8' }
  return <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>● {c.label}</span>
}

export default function ManutencaoDashboard() {
  const navigate = useNavigate()
  const { workspaceId } = useStore()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState({ kpis: {}, abertas: [], preventivas: [] })

  useEffect(() => { if (workspaceId) load(workspaceId) }, [workspaceId]) // eslint-disable-line

  async function load(wid) {
    setRefreshing(true)
    const hoje = today()
    const em7d  = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const ini30 = minus(30)

    const [rAbertas, rAndamento, rConcluidas, rVencidas, rProximas] = await Promise.all([
      supabase.from('manut_os').select('id,numero,titulo,status,prioridade,tipo,equipamento_nome,data_abertura,data_prevista')
        .eq('workspace_id', wid).eq('status', 'aberta')
        .order('data_abertura', { ascending: false }).limit(20),

      supabase.from('manut_os').select('id', { count: 'exact', head: true })
        .eq('workspace_id', wid).eq('status', 'em_andamento'),

      supabase.from('manut_os').select('id', { count: 'exact', head: true })
        .eq('workspace_id', wid).eq('status', 'concluida').gte('data_conclusao', ini30),

      supabase.from('manut_planos').select('id,titulo,equipamento_nome,proxima_data,periodicidade')
        .eq('workspace_id', wid).eq('ativo', true).lt('proxima_data', hoje)
        .order('proxima_data', { ascending: true }).limit(10),

      supabase.from('manut_planos').select('id,titulo,equipamento_nome,proxima_data,periodicidade')
        .eq('workspace_id', wid).eq('ativo', true).gte('proxima_data', hoje).lte('proxima_data', em7d)
        .order('proxima_data', { ascending: true }).limit(10),
    ])

    setData({
      kpis: {
        abertas:    rAbertas.data?.length ?? 0,
        andamento:  rAndamento.count ?? 0,
        concluidas: rConcluidas.count ?? 0,
        vencidas:   rVencidas.data?.length ?? 0,
      },
      abertas: rAbertas.data || [],
      preventivas: [
        ...(rVencidas.data || []).map(p => ({ ...p, _vencida: true })),
        ...(rProximas.data || []).map(p => ({ ...p, _vencida: false })),
      ],
    })
    setLoading(false)
    setRefreshing(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        title="Dashboard — Manutenção"
        subtitle="Visão geral das ordens de serviço e planos preventivos"
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-secondary)' }}>Carregando...</div>
    </div>
  )

  const { kpis, abertas, preventivas } = data

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        title="Dashboard — Manutenção"
        subtitle="Visão geral das ordens de serviço e planos preventivos"
        action={{ label: 'Nova OS', icon: PlusIcon, onClick: () => navigate('/manutencao/operacoes/os?nova=1') }}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          <KPICard label="OS Abertas" value={kpis.abertas} sub="aguardando atendimento" color="#6366f1" bg="rgba(99,102,241,0.12)" icon={ClipboardDocumentListIcon} onClick={() => navigate('/manutencao/operacoes/os?status=aberta')} />
          <KPICard label="Em Andamento" value={kpis.andamento} sub="em execução agora" color="#0ea5e9" bg="rgba(14,165,233,0.12)" icon={BoltIcon} onClick={() => navigate('/manutencao/operacoes/os?status=em_andamento')} />
          <KPICard label="Concluídas (30d)" value={kpis.concluidas} sub="últimos 30 dias" color="#10b981" bg="rgba(16,185,129,0.12)" icon={CheckCircleIcon} onClick={() => navigate('/manutencao/operacoes/os?status=concluida')} />
          <KPICard label="Preventivas Vencidas" value={kpis.vencidas} sub="gerar OS imediatamente" color="#ef4444" bg="rgba(239,68,68,0.12)" icon={ExclamationTriangleIcon} onClick={() => navigate('/manutencao/operacoes/preventiva')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* OS Abertas */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>🔴 OS Abertas</span>
              <button onClick={() => navigate('/manutencao/operacoes/os?status=aberta')} style={linkStyle}>Ver todas <ArrowRightIcon style={{ width: 12, height: 12 }} /></button>
            </div>
            {abertas.length === 0
              ? <div style={emptyStyle}>Nenhuma OS aberta</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={thStyle}>Nº / Título</th>
                      <th style={thStyle}>Equip.</th>
                      <th style={thStyle}>Tipo</th>
                      <th style={thStyle}>Prior.</th>
                      <th style={thStyle}>Abertura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abertas.map(os => {
                      const tc = TIPO_CFG[os.tipo] || {}
                      const dias = os.data_prevista ? Math.ceil((new Date(os.data_prevista + 'T12:00:00') - new Date()) / 86400000) : null
                      return (
                        <tr key={os.id} onClick={() => navigate('/manutencao/operacoes/os')} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 11 }}>{os.numero || '—'}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{os.titulo}</div>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                              {os.equipamento_nome || '—'}
                            </span>
                          </td>
                          <td style={tdStyle}><span style={{ fontSize: 11, color: tc.color }}>{tc.icon} {tc.label}</span></td>
                          <td style={tdStyle}><PriorBadge p={os.prioridade} /></td>
                          <td style={tdStyle}>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{fmtD(os.data_abertura)}</div>
                            {dias !== null && <div style={{ fontSize: 10, color: dias < 0 ? '#ef4444' : dias <= 2 ? '#f59e0b' : 'var(--text-secondary)' }}>
                              {dias < 0 ? `${Math.abs(dias)}d atrasada` : dias === 0 ? 'Vence hoje' : `${dias}d restantes`}
                            </div>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
            }
          </div>

          {/* Preventivas */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>📅 Preventivas</span>
              <button onClick={() => navigate('/manutencao/operacoes/preventiva')} style={linkStyle}>Ver todas <ArrowRightIcon style={{ width: 12, height: 12 }} /></button>
            </div>
            {preventivas.length === 0
              ? <div style={emptyStyle}>Nenhuma preventiva próxima</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={thStyle}>Plano</th>
                      <th style={thStyle}>Equipamento</th>
                      <th style={thStyle}>Periodicidade</th>
                      <th style={thStyle}>Próxima Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preventivas.map(p => (
                      <tr key={p.id} onClick={() => navigate('/manutencao/operacoes/preventiva')} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{p.titulo}</span></td>
                        <td style={tdStyle}><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.equipamento_nome || '—'}</span></td>
                        <td style={tdStyle}><span style={{ fontSize: 11, color: '#8b5cf6', textTransform: 'capitalize' }}>{p.periodicidade}</span></td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: p._vencida ? '#ef4444' : '#f59e0b' }}>
                            {p._vencida ? '⚠️ ' : '⏰ '}{fmtD(p.proxima_data)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>

        </div>

        {/* Atalhos rápidos */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>⚡ Acesso Rápido</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '4px 0' }}>
            {[
              { label: 'Nova OS Corretiva',    to: '/manutencao/operacoes/os?nova=corretiva',   icon: WrenchScrewdriverIcon,       color: '#ef4444' },
              { label: 'Nova OS Preventiva',   to: '/manutencao/operacoes/os?nova=preventiva',  icon: CalendarDaysIcon,            color: '#6366f1' },
              { label: 'Planos Preventivos',   to: '/manutencao/operacoes/preventiva',          icon: ClipboardDocumentListIcon,   color: '#8b5cf6' },
              { label: 'Equipamentos',         to: '/manutencao/cadastros/equipamentos',        icon: WrenchScrewdriverIcon,       color: '#0ea5e9' },
              { label: 'Técnicos',             to: '/manutencao/cadastros/tecnicos',            icon: ClockIcon,                   color: '#10b981' },
            ].map(({ label, to, icon: Icon, color }) => (
              <button key={to} onClick={() => navigate(to)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10,
                border: `1px solid rgba(${color === '#ef4444' ? '239,68,68' : color === '#6366f1' ? '99,102,241' : color === '#8b5cf6' ? '139,92,246' : color === '#0ea5e9' ? '14,165,233' : '16,185,129'},0.3)`,
                background: `rgba(${color === '#ef4444' ? '239,68,68' : color === '#6366f1' ? '99,102,241' : color === '#8b5cf6' ? '139,92,246' : color === '#0ea5e9' ? '14,165,233' : '16,185,129'},0.08)`,
                color, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>
                <Icon style={{ width: 16, height: 16 }} />{label}
              </button>
            ))}
          </div>
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const cardStyle = {
  background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)', overflow: 'hidden',
}
const cardHeaderStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px', borderBottom: '1px solid var(--border)',
}
const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }
const tdStyle = { padding: '9px 12px', verticalAlign: 'middle' }
const emptyStyle = { padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }
const linkStyle = { background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }
const btnSecStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }
const btnPrimStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }
