import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import {
  UserGroupIcon, MagnifyingGlassIcon, CheckCircleIcon,
  ChartBarIcon, ArrowTrendingUpIcon, DocumentTextIcon,
  ClockIcon, BriefcaseIcon, XCircleIcon, ChatBubbleLeftEllipsisIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

// ─── Constantes locais (espelha ProspectarClientes) ───────────────────────────
const METODOS = [
  { id: 'b2b',           label: 'B2B Direto',         emoji: '🏢', cor: '#6366f1', bg: 'rgba(99,102,241,0.08)',   border: 'rgba(99,102,241,0.25)'  },
  { id: 'inside_sales',  label: 'Inside Sales',        emoji: '📞', cor: '#0ea5e9', bg: 'rgba(14,165,233,0.08)',   border: 'rgba(14,165,233,0.25)'  },
  { id: 'social_selling',label: 'Social Selling',      emoji: '📱', cor: '#ec4899', bg: 'rgba(236,72,153,0.08)',   border: 'rgba(236,72,153,0.25)'  },
  { id: 'parceria',      label: 'Parceria Comercial',  emoji: '🤝', cor: '#10b981', bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.25)'  },
]

const STATUS_LEAD = [
  { id: 'nao_contatado', label: 'Não contatado', cor: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: ClockIcon },
  { id: 'contatado',     label: 'Contatado',     cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: ChatBubbleLeftEllipsisIcon },
  { id: 'negociando',    label: 'Em negociação', cor: '#0ea5e9', bg: 'rgba(14,165,233,0.1)',  icon: BriefcaseIcon },
  { id: 'fechado',       label: 'Fechado ✓',     cor: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: CheckCircleIcon },
  { id: 'recusado',      label: 'Recusado',      cor: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: XCircleIcon },
]

const STATUS_CONTRATO = [
  { id: 'em_andamento', label: 'Em andamento', cor: '#0ea5e9', bg: 'rgba(14,165,233,0.1)'  },
  { id: 'concluido',    label: 'Concluído',    cor: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  { id: 'pausado',      label: 'Pausado',      cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  { id: 'cancelado',    label: 'Cancelado',    cor: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
]

function loadGrupos() { try { return JSON.parse(localStorage.getItem('prospectar_grupos') || '[]') } catch { return [] } }
function loadContratos() { try { return JSON.parse(localStorage.getItem('prospectar_contratos') || '[]') } catch { return [] } }

function fmtBRL(v) {
  if (!v || isNaN(v)) return '—'
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

export default function ProspectarDashboard() {
  const navigate = useNavigate()
  const [grupos, setGrupos] = useState([])
  const [contratos, setContratos] = useState([])

  useEffect(() => {
    setGrupos(loadGrupos())
    setContratos(loadContratos())
  }, [])

  // ─── Métricas ──────────────────────────────────────────────────────────────
  const todosLeads = grupos.flatMap(g => g.leads)
  const totalLeads = todosLeads.length
  const fechados = todosLeads.filter(l => l.status === 'fechado').length
  const emNegociacao = todosLeads.filter(l => l.status === 'negociando').length
  const contatados = todosLeads.filter(l => l.status === 'contatado').length
  const taxaConversao = totalLeads > 0 ? ((fechados / totalLeads) * 100).toFixed(1) : '0.0'

  const totalContratos = contratos.length
  const contratosAtivos = contratos.filter(c => c.status === 'em_andamento').length
  const valorTotalContratos = contratos.reduce((sum, c) => sum + (Number(c.valor) || 0), 0)

  // ─── Pipeline por status ────────────────────────────────────────────────────
  const pipeline = STATUS_LEAD.map(s => ({
    ...s,
    count: todosLeads.filter(l => l.status === s.id).length,
  }))

  // ─── Leads por método ────────────────────────────────────────────────────────
  const porMetodo = METODOS.map(m => {
    const gruposDoMetodo = grupos.filter(g => g.metodo === m.id)
    const leadsDoMetodo = gruposDoMetodo.flatMap(g => g.leads)
    return { ...m, count: leadsDoMetodo.length, fechados: leadsDoMetodo.filter(l => l.status === 'fechado').length }
  })

  // ─── Top grupos ────────────────────────────────────────────────────────────
  const topGrupos = [...grupos]
    .sort((a, b) => b.leads.length - a.leads.length)
    .slice(0, 5)

  const cardStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }

  return (
    <div>
      <Header title="Dashboard — Prospectar" subtitle="Visão geral da sua prospecção de clientes" />

      <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── KPIs ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: 'Grupos', value: grupos.length, icon: UserGroupIcon, cor: '#6366f1', sub: 'campanhas ativas' },
            { label: 'Leads',  value: totalLeads,     icon: MagnifyingGlassIcon, cor: '#0ea5e9', sub: 'prospectos salvos' },
            { label: 'Em negociação', value: emNegociacao, icon: BriefcaseIcon, cor: '#f59e0b', sub: 'aguardando decisão' },
            { label: 'Fechados', value: fechados,     icon: CheckCircleIcon, cor: '#10b981', sub: `${taxaConversao}% de conversão` },
            { label: 'Contratos', value: totalContratos, icon: DocumentTextIcon, cor: '#8b5cf6', sub: `${contratosAtivos} em andamento` },
            { label: 'Valor contratos', value: fmtBRL(valorTotalContratos), icon: ArrowTrendingUpIcon, cor: '#10b981', sub: 'receita prospectada', isText: true },
          ].map((k, i) => (
            <div key={i} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{k.label}</span>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${k.cor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <k.icon style={{ width: 16, height: 16, color: k.cor }} />
                </div>
              </div>
              <div style={{ fontSize: k.isText ? 18 : 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* ── Pipeline ────────────────────────────────────────────────────── */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <ChartBarIcon style={{ width: 15, height: 15, color: '#6366f1' }} />
              Pipeline de Leads
            </div>
            {totalLeads === 0
              ? <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum lead salvo ainda.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pipeline.map(s => (
                    <div key={s.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: s.cor, fontWeight: 600 }}>{s.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{s.count}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-primary)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${totalLeads > 0 ? (s.count / totalLeads) * 100 : 0}%`, background: s.cor, borderRadius: 4, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* ── Por Método ──────────────────────────────────────────────────── */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <ArrowTrendingUpIcon style={{ width: 15, height: 15, color: '#10b981' }} />
              Leads por Método
            </div>
            {totalLeads === 0
              ? <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum lead salvo ainda.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {porMetodo.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{m.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: m.cor, fontWeight: 600 }}>{m.label}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {m.count} lead{m.count !== 1 ? 's' : ''}
                            {m.fechados > 0 && <span style={{ color: '#10b981', marginLeft: 5 }}>({m.fechados} ✓)</span>}
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-primary)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${totalLeads > 0 ? (m.count / totalLeads) * 100 : 0}%`, background: m.cor, borderRadius: 3 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>

        {/* ── Top Grupos + Contratos recentes ────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Top Grupos */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <UserGroupIcon style={{ width: 15, height: 15, color: '#0ea5e9' }} />
                Grupos Ativos
              </div>
              <button onClick={() => navigate('/prospectar/buscar')}
                style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                Buscar <ArrowRightIcon style={{ width: 11, height: 11 }} />
              </button>
            </div>
            {topGrupos.length === 0
              ? <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                  <div style={{ marginBottom: 10 }}>Nenhum grupo criado ainda.</div>
                  <button onClick={() => navigate('/prospectar/buscar')}
                    style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#6366f1', cursor: 'pointer' }}>
                    + Começar a prospectar
                  </button>
                </div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topGrupos.map(g => {
                    const m = METODOS.find(x => x.id === g.metodo) || METODOS[0]
                    const fechadosG = g.leads.filter(l => l.status === 'fechado').length
                    return (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 9, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 16 }}>{m.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nome}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{g.leads.length} leads · {g.cidade || m.label}</div>
                        </div>
                        {fechadosG > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.1)' }}>{fechadosG} ✓</span>}
                        <span style={{ fontSize: 11, fontWeight: 700, color: m.cor }}>{g.leads.length}</span>
                      </div>
                    )
                  })}
                </div>
            }
          </div>

          {/* Contratos recentes */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <DocumentTextIcon style={{ width: 15, height: 15, color: '#8b5cf6' }} />
                Contratos Recentes
              </div>
              <button onClick={() => navigate('/prospectar/contratos')}
                style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                Ver todos <ArrowRightIcon style={{ width: 11, height: 11 }} />
              </button>
            </div>
            {contratos.length === 0
              ? <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                  <div style={{ marginBottom: 10 }}>Nenhum contrato registrado.</div>
                  <button onClick={() => navigate('/prospectar/contratos')}
                    style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#8b5cf6', cursor: 'pointer' }}>
                    + Registrar contrato
                  </button>
                </div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contratos.slice(0, 5).map(c => {
                    const m = METODOS.find(x => x.id === c.metodo) || METODOS[0]
                    const st = STATUS_CONTRATO.find(x => x.id === c.status) || STATUS_CONTRATO[0]
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 9, border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 16 }}>{m.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.empresa}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.inicio}</div>
                        </div>
                        {c.valor > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>{fmtBRL(c.valor)}</span>}
                        <span style={{ fontSize: 11, fontWeight: 700, color: st.cor, padding: '2px 8px', borderRadius: 20, background: st.bg }}>{st.label}</span>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        </div>

        {/* ── Ações rápidas ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: '🔍 Buscar Prospectos', to: '/prospectar/buscar', cor: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)' },
            { label: '📄 Registrar Contrato', to: '/prospectar/contratos', cor: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)' },
            { label: '📊 Ver Relatórios', to: '/prospectar/relatorios', cor: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.25)' },
          ].map(a => (
            <button key={a.to} onClick={() => navigate(a.to)}
              style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: a.bg, border: `1px solid ${a.border}`, color: a.cor, cursor: 'pointer' }}>
              {a.label}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
