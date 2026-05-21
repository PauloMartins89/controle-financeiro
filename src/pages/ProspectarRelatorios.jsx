import { useState, useEffect } from 'react'
import Header from '../components/Header'
import {
  ChartBarIcon, ArrowTrendingUpIcon, UserGroupIcon,
  CheckCircleIcon, FunnelIcon,
} from '@heroicons/react/24/outline'

// ─── Constantes ────────────────────────────────────────────────────────────────
const METODOS = [
  { id: 'b2b',            label: 'B2B Direto',        emoji: '🏢', cor: '#6366f1' },
  { id: 'inside_sales',   label: 'Inside Sales',       emoji: '📞', cor: '#0ea5e9' },
  { id: 'social_selling', label: 'Social Selling',     emoji: '📱', cor: '#ec4899' },
  { id: 'parceria',       label: 'Parceria Comercial', emoji: '🤝', cor: '#10b981' },
]

const STATUS_LEAD = [
  { id: 'nao_contatado', label: 'Não contatado', cor: '#94a3b8' },
  { id: 'contatado',     label: 'Contatado',     cor: '#f59e0b' },
  { id: 'negociando',    label: 'Em negociação', cor: '#0ea5e9' },
  { id: 'fechado',       label: 'Fechado',       cor: '#10b981' },
  { id: 'recusado',      label: 'Recusado',      cor: '#ef4444' },
]

function loadGrupos() { try { return JSON.parse(localStorage.getItem('prospectar_grupos') || '[]') } catch { return [] } }
function loadContratos() { try { return JSON.parse(localStorage.getItem('prospectar_contratos') || '[]') } catch { return [] } }
function fmtBRL(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }

// ─── Mini bar chart ────────────────────────────────────────────────────────────
function BarChart({ items, total }) {
  if (!total) return <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 13 }}>Sem dados.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: item.cor }}>{item.emoji ? `${item.emoji} ` : ''}{item.label}</span>
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 700 }}>{item.value}<span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 5 }}>({total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)</span></span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-primary)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${total > 0 ? (item.value / total) * 100 : 0}%`, background: item.cor, borderRadius: 5, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Funil visual ─────────────────────────────────────────────────────────────
function FunilVisual({ pipeline, total }) {
  if (!total) return <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 13 }}>Sem dados.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
      {pipeline.map((s, i) => {
        const pct = total > 0 ? (s.count / total) * 100 : 0
        const maxW = 100 - i * 8
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 100, fontSize: 11, color: s.cor, fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{s.label}</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <div style={{ width: `${maxW}%`, height: 30, background: 'var(--bg-primary)', borderRadius: 5, overflow: 'hidden', margin: '0 auto' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: s.cor, borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                  {s.count > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{s.count}</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function ProspectarRelatorios() {
  const [grupos, setGrupos] = useState([])
  const [contratos, setContratos] = useState([])

  useEffect(() => {
    setGrupos(loadGrupos())
    setContratos(loadContratos())
  }, [])

  const todosLeads = grupos.flatMap(g => g.leads)
  const total = todosLeads.length

  // ─── Leads por método ──────────────────────────────────────────────────────
  const porMetodo = METODOS.map(m => {
    const leadsM = grupos.filter(g => g.metodo === m.id).flatMap(g => g.leads)
    return { ...m, value: leadsM.length, fechados: leadsM.filter(l => l.status === 'fechado').length }
  })

  // ─── Pipeline ─────────────────────────────────────────────────────────────
  const pipeline = STATUS_LEAD.map(s => ({ ...s, count: todosLeads.filter(l => l.status === s.id).length }))

  // ─── Taxa de conversão por método ─────────────────────────────────────────
  const conversaoPorMetodo = METODOS.map(m => {
    const leadsM = grupos.filter(g => g.metodo === m.id).flatMap(g => g.leads)
    const t = leadsM.length
    const f = leadsM.filter(l => l.status === 'fechado').length
    return { ...m, value: t > 0 ? parseFloat(((f / t) * 100).toFixed(1)) : 0, total: t, fechados: f }
  })

  // ─── Contratos por método ─────────────────────────────────────────────────
  const contratosPorMetodo = METODOS.map(m => ({
    ...m,
    value: contratos.filter(c => c.metodo === m.id).length,
    valor: contratos.filter(c => c.metodo === m.id).reduce((s, c) => s + (Number(c.valor) || 0), 0),
  }))
  const totalContratos = contratos.length
  const valorTotal = contratos.reduce((s, c) => s + (Number(c.valor) || 0), 0)

  // ─── Grupos por cidade (top 5) ─────────────────────────────────────────────
  const cidades = {}
  grupos.forEach(g => { if (g.cidade) { cidades[g.cidade] = (cidades[g.cidade] || 0) + g.leads.length } })
  const topCidades = Object.entries(cidades).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value, cor: '#6366f1' }))
  const totalCidades = topCidades.reduce((s, x) => s + x.value, 0)

  const cardStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px' }

  return (
    <div>
      <Header title="Relatórios" subtitle="Análise de desempenho da sua prospecção" />

      <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Resumo global ─────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { label: 'Grupos', value: grupos.length, cor: '#6366f1', icon: UserGroupIcon },
            { label: 'Total Leads', value: total, cor: '#0ea5e9', icon: ChartBarIcon },
            { label: 'Fechados', value: todosLeads.filter(l => l.status === 'fechado').length, cor: '#10b981', icon: CheckCircleIcon },
            { label: 'Taxa global', value: total > 0 ? `${((todosLeads.filter(l => l.status === 'fechado').length / total) * 100).toFixed(1)}%` : '—', cor: '#f59e0b', icon: ArrowTrendingUpIcon, isText: true },
            { label: 'Contratos', value: totalContratos, cor: '#8b5cf6', icon: FunnelIcon },
            { label: 'Valor contratos', value: valorTotal > 0 ? fmtBRL(valorTotal) : '—', cor: '#10b981', icon: ArrowTrendingUpIcon, isText: true },
          ].map((k, i) => (
            <div key={i} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{k.label}</span>
                <k.icon style={{ width: 14, height: 14, color: k.cor }} />
              </div>
              <div style={{ fontSize: k.isText ? 17 : 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Leads por método */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
              <ChartBarIcon style={{ width: 14, height: 14, color: '#6366f1' }} />
              Leads por Método
            </div>
            <BarChart items={porMetodo.map(m => ({ ...m, value: m.value }))} total={total} />
          </div>

          {/* Funil de conversão */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
              <FunnelIcon style={{ width: 14, height: 14, color: '#f59e0b' }} />
              Funil de Conversão
            </div>
            <FunilVisual pipeline={pipeline} total={total} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Taxa de conversão por método */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
              <ArrowTrendingUpIcon style={{ width: 14, height: 14, color: '#10b981' }} />
              Conversão por Método
            </div>
            {total === 0
              ? <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 13 }}>Sem dados.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {conversaoPorMetodo.map(m => (
                    <div key={m.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: m.cor }}>{m.emoji} {m.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {m.value}%
                          <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 5 }}>
                            ({m.fechados}/{m.total})
                          </span>
                        </span>
                      </div>
                      <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-primary)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${m.value}%`, background: m.cor, borderRadius: 5 }} />
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Top cidades / Contratos por método */}
          <div style={cardStyle}>
            {topCidades.length > 0
              ? <>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
                    📍 Leads por Cidade (top 6)
                  </div>
                  <BarChart items={topCidades} total={totalCidades} />
                </>
              : <>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <UserGroupIcon style={{ width: 14, height: 14, color: '#8b5cf6' }} />
                    Contratos por Método
                  </div>
                  <BarChart items={contratosPorMetodo.map(m => ({ ...m, value: m.value }))} total={totalContratos} />
                </>
            }
          </div>
        </div>

        {/* ── Tabela de grupos ───────────────────────────────────────────────── */}
        {grupos.length > 0 && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
              <UserGroupIcon style={{ width: 14, height: 14, color: '#0ea5e9' }} />
              Detalhamento por Grupo
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11 }}>
                    {['Grupo', 'Método', 'Total', 'Fechados', 'Em negoc.', 'Conversão'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...grupos].sort((a, b) => b.leads.length - a.leads.length).map(g => {
                    const m = METODOS.find(x => x.id === g.metodo) || METODOS[0]
                    const t = g.leads.length
                    const f = g.leads.filter(l => l.status === 'fechado').length
                    const n = g.leads.filter(l => l.status === 'negociando').length
                    const taxa = t > 0 ? `${((f / t) * 100).toFixed(0)}%` : '—'
                    return (
                      <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 10px', fontWeight: 600 }}>{g.nome}</td>
                        <td style={{ padding: '10px 10px', color: m.cor }}>{m.emoji} {m.label}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'center' }}>{t}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{f}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'center', color: '#0ea5e9' }}>{n}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, color: f > 0 ? '#10b981' : 'var(--text-secondary)' }}>{taxa}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
