import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import {
  ArrowPathIcon, BanknotesIcon, ClockIcon, ExclamationCircleIcon,
  CheckCircleIcon, DocumentTextIcon, TruckIcon, UserGroupIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, ArrowRightIcon,
  BellAlertIcon, ChartBarIcon, CalendarDaysIcon, BuildingOffice2Icon,
  CurrencyDollarIcon, InformationCircleIcon, ShoppingCartIcon,
  FunnelIcon, ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  const [y, m, dia] = String(d).split('T')[0].split('-')
  return `${dia}/${m}/${y}`
}
function todayISO() {
  return new Date().toISOString().split('T')[0]
}
function mesAtualISO() {
  return new Date().toISOString().slice(0, 7)
}
function diasAtras(iso) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso)) / 86400000)
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color, bg, icon: Icon, onClick, trend }) {
  return (
    <div onClick={onClick}
      style={{
        background: 'var(--bg-secondary)', borderRadius: 14, padding: '18px 20px',
        border: '1px solid var(--border)', borderTop: `3px solid ${color}`,
        cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 16, height: 16, color }} />
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
          {trend >= 0
            ? <ArrowTrendingUpIcon style={{ width: 12, height: 12, color: '#10b981' }} />
            : <ArrowTrendingDownIcon style={{ width: 12, height: 12, color: '#ef4444' }} />}
          <span style={{ color: trend >= 0 ? '#10b981' : '#ef4444' }}>
            {trend >= 0 ? '+' : ''}{fmtCurrency(trend)} vs mês anterior
          </span>
        </div>
      )}
    </div>
  )
}

function PipelineStep({ label, count, value, color, bg, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
      <div style={{
        flex: 1, background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px',
        border: `1px solid var(--border)`, borderLeft: `3px solid ${color}`,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color }}>{count}</div>
        {value != null && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{fmtCurrency(value)}</div>}
      </div>
      {!isLast && (
        <ArrowRightIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)', flexShrink: 0, margin: '0 4px', opacity: 0.4 }} />
      )}
    </div>
  )
}

function AlertItem({ icon: Icon, color, bg, title, desc, badge, onClick }) {
  return (
    <div onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
        borderRadius: 10, background: bg, border: `1px solid ${color}22`,
        cursor: onClick ? 'pointer' : 'default', marginBottom: 8,
      }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 16, height: 16, color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{desc}</div>
      </div>
      {badge && (
        <span style={{ padding: '2px 9px', borderRadius: 20, background: `${color}22`, color, fontSize: 11, fontWeight: 800, flexShrink: 0, alignSelf: 'center' }}>
          {badge}
        </span>
      )}
    </div>
  )
}

function BarChart({ data, colorFn }) {
  if (!data.length) return <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', padding: 20 }}>Sem dados no mês</div>
  const max = Math.max(...data.map(d => d.valor))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.slice(0, 8).map(({ categoria, valor }) => (
        <div key={categoria}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{categoria}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>{fmtCurrency(valor)}</span>
          </div>
          <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${max > 0 ? (valor / max) * 100 : 0}%`,
              background: colorFn ? colorFn(categoria) : '#6366f1',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function AtividadeItem({ icon: Icon, color, title, value, date, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 14, height: 14, color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>{date}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color }}>{value}</div>
        {badge && <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{badge}</div>}
      </div>
    </div>
  )
}

// ─── LineChartSVG ─────────────────────────────────────────────────────────────
function LineChartSVG({ data }) {
  if (!data || data.length < 2) return (
    <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>Sem dados suficientes</div>
  )
  const maxVal = Math.max(...data.map(d => Math.max(d.aprovado || 0, d.reprovado || 0)), 1)
  const H = 72, W = 500
  const px = (i) => (i / Math.max(data.length - 1, 1)) * W
  const py = (v) => H - ((v || 0) / maxVal) * (H - 6)
  const linePts = (key) => data.map((d, i) => `${px(i)},${py(d[key])}`).join(' ')
  const fillPts = `0,${H} ${data.map((d, i) => `${px(i)},${py(d.aprovado)}`).join(' ')} ${W},${H}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="gradAprov" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill="url(#gradAprov)" />
      <polyline points={linePts('aprovado')} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={linePts('reprovado')} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />
    </svg>
  )
}

// ─── MonitorOperacional ───────────────────────────────────────────────────────
function MonitorOperacional({ data, alertas, onClose }) {
  const navigate = useNavigate()
  const [agora, setAgora] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const diasSemana = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
  const { kpis, pipeline, porSetor, ultimosAprovados } = data
  const hoje = new Date().toISOString().split('T')[0]
  const aprovadosHoje = (ultimosAprovados || []).filter(a => (a.data || '').startsWith(hoje)).length
  const kpiBlocks = [
    { label: 'Lançamentos\nRecebidos',  value: kpis.lancamentos,          sub: 'Total',                          color: '#e5e7eb' },
    { label: 'Pendentes de\nAprovação', value: kpis.aguardando,           sub: fmtCurrency(pipeline.aguardando.reduce((s,l) => s+(l.valor||0),0)), color: '#f59e0b' },
    { label: 'Aprovados\nHoje',         value: aprovadosHoje,             sub: null,                             color: '#10b981' },
    { label: 'Reprovados\nHoje',        value: 0,                         sub: null,                             color: '#ef4444' },
    { label: 'Em\nFaturamento',         value: kpis.pagtosPendentesCount, sub: fmtCurrency(kpis.totalAReceber),  color: '#6366f1' },
    { label: 'Contas\na Pagar',         value: (porSetor || []).find(s => s.setor === 'Contas a Pagar')?.pendentes || kpis.contasVencidas, sub: fmtCurrency(kpis.totalPendMes), color: '#f97316' },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0d1117', zIndex: 9000, display: 'flex', flexDirection: 'column', padding: '22px 28px', fontFamily: 'inherit', overflowY: 'auto' }}>
      {/* Barra superior */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 1 }}>Monitor</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#f9fafb', letterSpacing: -1 }}>OPERACIONAL</div>
          </div>
          <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ fontSize: 11, color: '#4b5563' }}>
            Atualizado às {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 42, fontWeight: 900, color: '#f9fafb', lineHeight: 1, letterSpacing: -2, fontVariantNumeric: 'tabular-nums' }}>
              {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: 12, color: '#4b5563', marginTop: 3 }}>
              {agora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} &nbsp;—&nbsp; {diasSemana[agora.getDay()]}
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            ✕ Fechar
          </button>
        </div>
      </div>
      {/* KPIs grandes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 18, flexShrink: 0 }}>
        {kpiBlocks.map((k, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)', borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, whiteSpace: 'pre-line', lineHeight: 1.4 }}>{k.label}</div>
            <div style={{ fontSize: 42, fontWeight: 900, color: k.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: '#4b5563', marginTop: 5 }}>{k.sub}</div>}
          </div>
        ))}
      </div>
      {/* Painel inferior — 3 colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 12, flex: 1 }}>
        {/* Maiores Pendências por Setor */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 14, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Maiores Pendências por Setor</div>
          {(porSetor || []).length === 0 ? (
            <div style={{ color: '#374151', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhuma pendência</div>
          ) : (porSetor || []).map(({ setor, pendentes, color }) => {
            const maxP = Math.max(...(porSetor || []).map(s => s.pendentes), 1)
            return (
              <div key={setor} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color: '#d1d5db', fontWeight: 600 }}>{setor}</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#f9fafb' }}>{pendentes}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ height: '100%', borderRadius: 4, width: `${(pendentes/maxP)*100}%`, background: color, transition: 'width 1s ease' }} />
                </div>
              </div>
            )
          })}
        </div>
        {/* Atenções */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 14, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Atenções</div>
          {alertas.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <span style={{ fontSize: 14, color: '#10b981', fontWeight: 700 }}>Tudo em dia!</span>
            </div>
          ) : alertas.map((a, i) => {
            const cfg = {
              vencido:           { emoji: '🔴', title: `${a.count} conta${a.count>1?'s':''} vencida${a.count>1?'s':''}`,       desc: fmtCurrency(a.valor || 0), nav: '/contas-pagar' },
              parado:            { emoji: '🟡', title: `${a.count} lançamento${a.count>1?'s':''} parado${a.count>1?'s':''}`,    desc: 'Ag. aprovação há +3 dias', nav: '/lancamentos' },
              lote_sem_resposta: { emoji: '🟠', title: `${a.count} lote${a.count>1?'s':''} sem resposta`,                       desc: 'Cliente não respondeu em 5 dias', nav: '/lotes-cliente' },
              sem_nf:            { emoji: '🔵', title: `${a.count} pagamento${a.count>1?'s':''} sem NF`,                        desc: 'Nota fiscal pendente', nav: '/pagamentos' },
              compra_parada:     { emoji: '🟡', title: `${a.count} compra${a.count>1?'s':''} parada${a.count>1?'s':''}`,        desc: 'Aguardando aprovação há +3 dias', nav: '/compras/aprovar' },
            }[a.tipo] || { emoji: '⚪', title: a.tipo, desc: '', nav: '/' }
            return (
              <div key={i} onClick={() => { onClose(); navigate(cfg.nav) }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', marginBottom: 8, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              >
                <span style={{ fontSize: 20 }}>{cfg.emoji}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f3f4f6' }}>{cfg.title}</div>
                  <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{cfg.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
        {/* Últimos Aprovados */}
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 14, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Últimos Aprovados</div>
          {(ultimosAprovados || []).length === 0 ? (
            <div style={{ color: '#374151', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum item aprovado</div>
          ) : (ultimosAprovados || []).map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#f9fafb' }}>{a.numero}</div>
                <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>{a.setor} &nbsp;·&nbsp; {a.data ? new Date(a.data).toLocaleDateString('pt-BR') : '—'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{a.valor}</span>
                <span style={{ color: '#10b981', fontSize: 16 }}>✓</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Paleta de categorias ─────────────────────────────────────────────────────
const CAT_COLORS = {
  'Transporte':    '#6366f1', 'Alimentação':  '#f59e0b', 'Combustível':   '#f97316',
  'Manutenção':   '#ef4444', 'Saúde':        '#10b981', 'Serviços':      '#06b6d4',
  'Material':     '#8b5cf6', 'Equipamento':  '#84cc16', 'Comunicação':   '#ec4899',
  'Viagem':       '#3b82f6', 'Folha':        '#14b8a6', 'Impostos':      '#eab308',
  'Outros':       '#94a3b8',
}
function catColor(c) { return CAT_COLORS[c] || '#94a3b8' }

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function CentralGerencial() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data,    setData]    = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [modoMonitor, setModoMonitor] = useState(false)
  const [erro, setErro] = useState(null)

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); setErro('Supabase não configurado. Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env'); return }
    setLoading(true)
    setErro(null)
    const withTimeout = (promise, ms = 15000) =>
      Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: servidor demorou mais de ${ms/1000}s para responder. Verifique se o projeto Supabase está ativo em app.supabase.com`)), ms))])
    try {
      const hoje    = todayISO()
      const mesAtual = mesAtualISO()
      const mesAnterior = (() => {
        const [y, m] = mesAtual.split('-').map(Number)
        const d = new Date(y, m - 2, 1)
        return d.toISOString().slice(0, 7)
      })()

      const [
        resLanc,
        resLotes,
        resPagamentos,
        resContasPagar,
        resCompras,
      ] = await withTimeout(Promise.all([
        supabase.from('lancamentos').select('id,tipo,status,valor,data,categoria,descricao,created_at,dados_extras').order('created_at', { ascending: false }).limit(500),
        supabase.from('lotes_cliente').select('id,status,cliente,created_at,updated_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('pagamentos').select('id,descricao,valor_total,data_pagamento,numero_nf,created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('contas_pagar').select('id,status,valor,vencimento,data_pagamento,categoria,descricao,fornecedor,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('solicitacoes_compra').select('id,status,titulo,valor_estimado,valor_aprovado,economia,urgencia,created_at,data_aprovacao').order('created_at', { ascending: false }).limit(200),
      ]))

      const lancs     = resLanc.data     || []
      const lotes     = resLotes.data    || []
      const pagtos    = resPagamentos.data || []
      const cpagar    = resContasPagar.data || []
      const compras   = resCompras.data  || []

      // ── Compras KPIs ───────────────────────────────────────────────────────
      const comprasAguardando = compras.filter(c => ['aguardando_aprovacao','em_cotacao','requisicao_nova'].includes(c.status))
      const comprasLeiloes    = compras.filter(c => ['leilao_aberto','leilao_encerrado'].includes(c.status))
      const comprasAprovadas  = compras.filter(c => ['aprovado','pedido_emitido'].includes(c.status))
      const comprasPagoMes    = compras.filter(c => c.status === 'pago' && (c.data_aprovacao || '').startsWith(mesAtual))
      const comprasGastoMes   = comprasPagoMes.reduce((s, c) => s + (c.valor_aprovado || 0), 0)
      const comprasEconomia   = compras.filter(c => c.economia > 0).reduce((s, c) => s + (c.economia || 0), 0)
      const comprasPipeline   = {
        aguardando: comprasAguardando,
        leilao:     comprasLeiloes,
        aprovado:   comprasAprovadas,
        pago:       compras.filter(c => c.status === 'pago'),
      }

      // ── Pipeline de lançamentos ─────────────────────────────────────────────
      const byStatus = (st) => lancs.filter(l => l.status === st || (st === 'aguardando_aprovacao' && l.status === 'pendente'))
      const pipeline = {
        rascunho:    byStatus('rascunho'),
        aguardando:  lancs.filter(l => ['aguardando_aprovacao','pendente'].includes(l.status)),
        aprovado:    byStatus('aprovado'),
        faturado:    byStatus('faturado'),
      }

      // ── KPIs ────────────────────────────────────────────────────────────────
      const contasVencidas  = cpagar.filter(c => c.status !== 'pago' && c.vencimento && c.vencimento < hoje)
      const contasPendMes   = cpagar.filter(c => c.status !== 'pago' && (c.vencimento || '').startsWith(mesAtual))
      const contasPagoMes   = cpagar.filter(c => c.status === 'pago'  && (c.data_pagamento || '').startsWith(mesAtual))
      const receitasMes     = lancs.filter(l => l.tipo === 'receita'  && l.status === 'aprovado' && (l.data || '').startsWith(mesAtual))
      const despesasMes     = lancs.filter(l => l.tipo === 'despesa'  && ['aprovado','faturado'].includes(l.status) && (l.data || '').startsWith(mesAtual))
      const lotesAReceber   = lotes.filter(l => l.status === 'aprovado_cliente')
      const contasPagoMesAnterior = cpagar.filter(c => c.status === 'pago' && (c.data_pagamento || '').startsWith(mesAnterior))

      // ── Contas a Receber (pagamentos reais) ─────────────────────────────────────────────
      const totalAReceber    = pagtos.reduce((s, p) => s + (p.valor_total || 0), 0)
      const totalRecebidoMes = pagtos.filter(p => (p.data_pagamento || '').startsWith(mesAtual)).reduce((s, p) => s + (p.valor_total || 0), 0)
      const totalFaturadoMes = pagtos.filter(p => (p.created_at || '').startsWith(mesAtual)).reduce((s, p) => s + (p.valor_total || 0), 0)

      // ── Pipeline de Lotes Cliente ─────────────────────────────────────────────────────────────────────
      const lotePipeline = {
        rascunho: lotes.filter(l => l.status === 'rascunho'),
        enviado:  lotes.filter(l => l.status === 'enviado_cliente'),
        aprovado: lotes.filter(l => l.status === 'aprovado_cliente'),
        recusado: lotes.filter(l => l.status === 'recusado_cliente'),
      }

      const totalVencido    = contasVencidas.reduce((s, c) => s + (c.valor || 0), 0)
      const totalPendMes    = contasPendMes.reduce((s, c) => s + (c.valor || 0), 0)
      const totalPagoMes    = contasPagoMes.reduce((s, c) => s + (c.valor || 0), 0)
      const totalPagoMesAnt = contasPagoMesAnterior.reduce((s, c) => s + (c.valor || 0), 0)
      const totalReceitas   = receitasMes.reduce((s, l) => s + (l.valor || 0), 0)
      const totalDespesas   = despesasMes.reduce((s, l) => s + (l.valor || 0), 0)
      const saldoProjetado  = totalAReceber - totalPendMes

      // ── Alertas ─────────────────────────────────────────────────────────────
      const alertas = []
      if (contasVencidas.length > 0)
        alertas.push({ tipo: 'vencido', count: contasVencidas.length, valor: totalVencido })
      const lancParados = lancs.filter(l => l.status === 'aguardando_aprovacao' && diasAtras(l.created_at) > 3)
      if (lancParados.length > 0)
        alertas.push({ tipo: 'parado', count: lancParados.length })
      const lotesEsperando = lotes.filter(l => l.status === 'enviado_cliente' && diasAtras(l.updated_at) > 5)
      if (lotesEsperando.length > 0)
        alertas.push({ tipo: 'lote_sem_resposta', count: lotesEsperando.length })
      const semNF = pagtos.filter(p => !p.numero_nf)
      if (semNF.length > 0)
        alertas.push({ tipo: 'sem_nf', count: semNF.length })
      const comprasParadas = comprasAguardando.filter(c => diasAtras(c.created_at) > 3)
      if (comprasParadas.length > 0)
        alertas.push({ tipo: 'compra_parada', count: comprasParadas.length })

      // ── Fila de aprovações cross-módulo ────────────────────────────────────
      const filaAprovacoes = [
        ...comprasAguardando.map(c => ({
          id: c.id,
          numero: c.numero_requisicao ? `REQ-${String(c.numero_requisicao).padStart(6, '0')}` : `REQ-${c.id.slice(0,6).toUpperCase()}`,
          solicitante: c.requisitante_nome || 'Sistema',
          setor: 'Compras',
          valor: c.valor_estimado || 0,
          data: (c.created_at || '').split('T')[0],
          urgencia: c.urgencia,
          status: c.urgencia === 'alta' ? 'Urgente' : 'Pendente',
        })),
        ...pipeline.aguardando.slice(0, 5).map(l => ({
          id: l.id,
          numero: `LANC-${l.id.slice(0,6).toUpperCase()}`,
          solicitante: (l.dados_extras && l.dados_extras.requisitante) || '—',
          setor: 'Lançamentos',
          valor: l.valor || 0,
          data: (l.created_at || '').split('T')[0],
          urgencia: null,
          status: 'Pendente',
        })),
      ].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 8)

      // ── Por setor (pendentes) ──────────────────────────────────────────────
      const porSetor = [
        { setor: 'Compras',        pendentes: comprasAguardando.length,                              color: '#8b5cf6' },
        { setor: 'Faturamento',    pendentes: pipeline.aguardando.length,                            color: '#f59e0b' },
        { setor: 'Contas a Pagar', pendentes: contasPendMes.length,                                  color: '#ef4444' },
        { setor: 'Outros',         pendentes: lotes.filter(l => l.status === 'enviado_cliente').length, color: '#94a3b8' },
      ].filter(s => s.pendentes > 0)

      // ── Resumo do mês com chart data ───────────────────────────────────────
      const hoje2 = new Date()
      const diasDoMes = Array.from({ length: hoje2.getDate() }, (_, idx) => {
        const d = idx + 1
        const dStr = `${mesAtual}-${String(d).padStart(2, '0')}`
        return {
          dia: d,
          aprovado: compras.filter(c => ['aprovado','pedido_emitido','pago'].includes(c.status) && (c.data_aprovacao || '').startsWith(dStr)).reduce((s, c) => s + (c.valor_aprovado || c.valor_estimado || 0), 0) + lancs.filter(l => l.status === 'aprovado' && (l.data || '').startsWith(dStr)).reduce((s, l) => s + (l.valor || 0), 0),
          reprovado: compras.filter(c => c.status === 'recusado' && (c.data_aprovacao || '').startsWith(dStr)).reduce((s, c) => s + (c.valor_estimado || 0), 0),
        }
      })
      const resumoMes = {
        totalAprovado: comprasAprovadas.reduce((s, c) => s + (c.valor_aprovado || c.valor_estimado || 0), 0),
        totalReprovado: compras.filter(c => c.status === 'recusado' && (c.data_aprovacao || '').startsWith(mesAtual)).reduce((s, c) => s + (c.valor_estimado || 0), 0),
        chartData: diasDoMes,
      }

      // ── Últimos aprovados cross-módulo ─────────────────────────────────────
      const ultimosAprovados = [
        ...compras.filter(c => ['aprovado','pedido_emitido','pago'].includes(c.status)).slice(0, 5).map(c => ({
          numero: c.numero_requisicao ? `REQ-${String(c.numero_requisicao).padStart(6, '0')}` : c.id.slice(0, 8).toUpperCase(),
          valor: fmtCurrency(c.valor_aprovado || c.valor_estimado || 0),
          data: c.data_aprovacao || c.created_at,
          setor: 'Compras',
        })),
        ...lancs.filter(l => l.status === 'aprovado').slice(0, 5).map(l => ({
          numero: l.id.slice(0, 8).toUpperCase(),
          valor: fmtCurrency(l.valor || 0),
          data: l.data || l.created_at,
          setor: 'Lançamentos',
        })),
      ].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5)

      // ── Despesas por categoria (mês atual) ─────────────────────────────────
      const catMap = {}
      ;[
        ...despesasMes,
        ...cpagar.filter(c => (c.data_pagamento || c.vencimento || '').startsWith(mesAtual)),
      ].forEach(item => {
        const cat = item.categoria || 'Outros'
        catMap[cat] = (catMap[cat] || 0) + (item.valor || 0)
      })
      const porCategoria = Object.entries(catMap)
        .map(([categoria, valor]) => ({ categoria, valor }))
        .sort((a, b) => b.valor - a.valor)

      // ── Atividade recente (cross-módulo, últimos 15) ─────────────────────────
      const atividade = [
        ...lancs.slice(0, 4).map(l => ({
          _ts: l.created_at, modulo: 'lancamento',
          title: l.descricao || '—', value: l.valor, status: l.status, tipo: l.tipo,
        })),
        ...lotes.slice(0, 3).map(l => ({
          _ts: l.created_at, modulo: 'lote',
          title: `Lote ${l.cliente || '—'}`, value: null, status: l.status,
        })),
        ...pagtos.slice(0, 4).map(p => ({
          _ts: p.created_at, modulo: 'receber',
          title: p.descricao || `Faturamento — ${p.cliente || '—'}`, value: p.valor_total, pago: !!p.data_pagamento,
        })),
        ...cpagar.slice(0, 4).map(c => ({
          _ts: c.created_at, modulo: 'conta_pagar',
          title: c.descricao || c.fornecedor || '—', value: c.valor, status: c.status,
        })),
      ]
        .sort((a, b) => new Date(b._ts) - new Date(a._ts))
        .slice(0, 12)

      setData({
        pipeline,
        lotePipeline,
        comprasPipeline,
        kpis: {
          aguardando:    pipeline.aguardando.length,
          contasVencidas: contasVencidas.length,
          totalVencido,
          totalPendMes,
          totalPagoMes,
          totalPagoMesAnt,
          totalReceitas,
          totalDespesas,
          totalAReceber,
          totalRecebidoMes,
          totalFaturadoMes,
          pagtosPendentesCount: pagtos.length,
          saldoProjetado,
          lancamentos:   lancs.length,
          lotes:         lotes.length,
          comprasAguardando: comprasAguardando.length,
          comprasLeiloes:    comprasLeiloes.length,
          comprasGastoMes,
          comprasEconomia,
        },
        alertas,
        porCategoria,
        atividade,
        filaAprovacoes,
        porSetor,
        resumoMes,
        ultimosAprovados,
      })
      setLastUpdate(new Date())
    } catch (e) {
      console.error('[CentralGerencial]', e)
      setErro(e.message || 'Erro ao carregar dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const cardStyle = {
    background: 'var(--bg-secondary)', borderRadius: 14,
    border: '1px solid var(--border)', padding: '20px 20px',
  }
  const sectionTitle = (label, icon) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      {icon}
      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
      {modoMonitor && data && (
        <MonitorOperacional data={data} alertas={data.alertas} onClose={() => setModoMonitor(false)} />
      )}
      <Header
        title="Central Gerencial"
        subtitle="Visão geral das requisições e aprovações"
        action={{
          label: 'Atualizar',
          onClick: load,
        }}
      />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px' }}>

        {/* Barra de status + botão Monitor */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 11 }}>
            {lastUpdate && (
              <>
                <ArrowPathIcon style={{ width: 12, height: 12 }} />
                Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                &nbsp;·&nbsp;
                {loading ? 'Carregando...' : `${(data?.kpis?.lancamentos || 0)} lançamentos · ${(data?.kpis?.lotes || 0)} lotes`}
              </>
            )}
          </div>
          {data && (
            <button onClick={() => setModoMonitor(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', color: '#818cf8', fontSize: 12, fontWeight: 700 }}>
              <span style={{ fontSize: 14 }}>📺</span> Monitor Operacional
            </button>
          )}
        </div>

        {loading && !data ? (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <ArrowPathIcon style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14 }}>Carregando dados de todos os módulos...</div>
            <div style={{ fontSize: 11, marginTop: 8, opacity: 0.6 }}>Aguardando resposta do servidor (máx. 15s)...</div>
          </div>
        ) : !data && erro ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <ExclamationCircleIcon style={{ width: 40, height: 40, color: '#ef4444', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Falha ao carregar dados</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 20px', lineHeight: 1.6 }}>{erro}</div>
            <button onClick={load} style={{ padding: '10px 24px', borderRadius: 10, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              Tentar novamente
            </button>
          </div>
        ) : data ? (
          <>
            {/* ── KPIs ─────────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 24 }}>
              <KPICard
                label="Ag. Aprovação"
                value={data.kpis.aguardando}
                sub={`aguardando aprovação para faturamento`}
                color="#f59e0b" bg="rgba(245,158,11,0.12)"
                icon={ClockIcon}
                onClick={() => navigate('/lancamentos')}
              />
              <KPICard
                label="Contas Vencidas"
                value={fmtCurrency(data.kpis.totalVencido)}
                sub={`${data.kpis.contasVencidas} conta${data.kpis.contasVencidas !== 1 ? 's' : ''} em atraso`}
                color="#ef4444" bg="rgba(239,68,68,0.12)"
                icon={ExclamationCircleIcon}
                onClick={() => navigate('/contas-pagar')}
              />
              <KPICard
                label="A Pagar este Mês"
                value={fmtCurrency(data.kpis.totalPendMes)}
                sub="contas a pagar pendentes"
                color="#f97316" bg="rgba(249,115,22,0.12)"
                icon={BanknotesIcon}
                onClick={() => navigate('/contas-pagar')}
              />
              <KPICard
                label="A Receber"
                value={fmtCurrency(data.kpis.totalAReceber)}
                sub={`${data.kpis.pagtosPendentesCount} faturamento${data.kpis.pagtosPendentesCount !== 1 ? 's' : ''} emitido${data.kpis.pagtosPendentesCount !== 1 ? 's' : ''}`}
                color="#6366f1" bg="rgba(99,102,241,0.12)"
                icon={ArrowTrendingUpIcon}
                onClick={() => navigate('/pagamentos')}
              />
              <KPICard
                label="Pago no Mês"
                value={fmtCurrency(data.kpis.totalPagoMes)}
                sub="contas pagas no mês atual"
                color="#10b981" bg="rgba(16,185,129,0.12)"
                icon={CheckCircleIcon}
                trend={data.kpis.totalPagoMes - data.kpis.totalPagoMesAnt}
              />
              <KPICard
                label="Saldo Projetado"
                value={fmtCurrency(data.kpis.saldoProjetado)}
                sub="A Receber − A Pagar"
                color={data.kpis.saldoProjetado >= 0 ? '#10b981' : '#ef4444'}
                bg={data.kpis.saldoProjetado >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}
                icon={ChartBarIcon}
              />
            </div>

            {/* ── Fila de Aprovações + Resumo do Mês + Por Setor ──────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16, marginBottom: 20 }}>

              {/* Fila de Aprovações */}
              <div style={cardStyle}>
                {sectionTitle('Fila de Aprovações',
                  <ClipboardDocumentIcon style={{ width: 16, height: 16, color: '#f59e0b' }} />
                )}
                {(data.filaAprovacoes || []).length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <CheckCircleIcon style={{ width: 18, height: 18, color: '#10b981' }} />
                    <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>Nenhum item aguardando aprovação.</span>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                          {['Requisição','Solicitante','Setor','Valor','Data','Status'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(data.filaAprovacoes || []).map((item, i) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            onClick={() => navigate(item.setor === 'Compras' ? '/compras/aprovar' : '/lancamentos')}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '10px 10px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{item.numero}</td>
                            <td style={{ padding: '10px 10px', color: 'var(--text-secondary)' }}>{item.solicitante}</td>
                            <td style={{ padding: '10px 10px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: item.setor === 'Compras' ? 'rgba(139,92,246,0.12)' : 'rgba(99,102,241,0.12)', color: item.setor === 'Compras' ? '#8b5cf6' : '#6366f1' }}>{item.setor}</span>
                            </td>
                            <td style={{ padding: '10px 10px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{fmtCurrency(item.valor)}</td>
                            <td style={{ padding: '10px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.data}</td>
                            <td style={{ padding: '10px 10px' }}>
                              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: item.urgencia === 'alta' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', color: item.urgencia === 'alta' ? '#ef4444' : '#f59e0b', whiteSpace: 'nowrap' }}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => navigate('/compras/aprovar')} style={{ padding: '6px 14px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>
                        Ver todas →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Resumo do Mês + Por Setor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Resumo do Mês */}
                <div style={cardStyle}>
                  {sectionTitle('Resumo do Mês',
                    <ChartBarIcon style={{ width: 16, height: 16, color: '#10b981' }} />
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Aprovado</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>{fmtCurrency(data.resumoMes?.totalAprovado || 0)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {data.resumoMes?.totalAprovado > 0 ? '▲ acima do período' : 'sem aprovações ainda'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Total Reprovado</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444' }}>{fmtCurrency(data.resumoMes?.totalReprovado || 0)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {data.resumoMes?.totalReprovado > 0 ? '▼ abaixo do período' : 'nenhuma reprovação'}
                      </div>
                    </div>
                  </div>
                  <LineChartSVG data={data.resumoMes?.chartData || []} />
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 18, height: 2, background: '#10b981', borderRadius: 2 }} /> Aprovado</span>
                    <span style={{ fontSize: 10, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 18, height: 2, background: '#ef4444', borderRadius: 2, borderBottom: '2px dashed #ef4444' }} /> Reprovado</span>
                  </div>
                </div>

                {/* Por Setor (Pendentes) */}
                <div style={cardStyle}>
                  {sectionTitle('Por Setor (Pendentes)',
                    <FunnelIcon style={{ width: 16, height: 16, color: '#8b5cf6' }} />
                  )}
                  {(data.porSetor || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0' }}>Nenhuma pendência por setor</div>
                  ) : (data.porSetor || []).map(({ setor, pendentes, color }) => {
                    const totalPend = (data.porSetor || []).reduce((s, x) => s + x.pendentes, 0)
                    const pct = totalPend > 0 ? Math.round((pendentes / totalPend) * 100) : 0
                    return (
                      <div key={setor} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{setor}</span>
                        <div style={{ width: 80, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: color }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', minWidth: 20, textAlign: 'right' }}>{pendentes}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    )
                  })}
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>
                      {(data.porSetor || []).reduce((s, x) => s + x.pendentes, 0)}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* ── Módulo de Compras ─────────────────────────────────────────── */}
            {(data.kpis.comprasAguardando > 0 || data.kpis.comprasLeiloes > 0 || data.kpis.comprasGastoMes > 0 || data.kpis.comprasEconomia > 0) && (
              <div style={{ ...cardStyle, marginBottom: 20 }}>
                {sectionTitle('Módulo de Compras',
                  <ShoppingCartIcon style={{ width: 16, height: 16, color: '#8b5cf6' }} />
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
                  <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)', borderTop: '2px solid #f59e0b', cursor: 'pointer' }} onClick={() => navigate('/compras/aprovar')}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Ag. Aprovação</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b' }}>{data.kpis.comprasAguardando}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>pedidos pendentes</div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)', borderTop: '2px solid #8b5cf6', cursor: 'pointer' }} onClick={() => navigate('/compras/aprovar')}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Leilões Ativos</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#8b5cf6' }}>{data.kpis.comprasLeiloes}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>cotando fornecedores</div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)', borderTop: '2px solid #ef4444' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Gasto no Mês</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#ef4444' }}>{fmtCurrency(data.kpis.comprasGastoMes)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>compras pagas</div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border)', borderTop: '2px solid #10b981' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Economia via Leilão</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>{fmtCurrency(data.kpis.comprasEconomia)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>abaixo do orçamento</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                  <PipelineStep label="Aguardando" count={data.comprasPipeline.aguardando.length} color="#f59e0b" />
                  <PipelineStep label="Leilão"      count={data.comprasPipeline.leilao.length}     color="#8b5cf6" />
                  <PipelineStep label="Aprovado"   count={data.comprasPipeline.aprovado.length}   color="#10b981" />
                  <PipelineStep label="Pago"        count={data.comprasPipeline.pago.length}        color="#6366f1" isLast />
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => navigate('/compras')} style={{ padding: '7px 14px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>Ver Compras</button>
                  <button onClick={() => navigate('/compras/aprovar')} style={{ padding: '7px 14px', borderRadius: 8, background: '#8b5cf6', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 700 }}>Aprovar Pedidos →</button>
                </div>
              </div>
            )}

            {/* ── Pipeline de Lançamentos ──────────────────────────────────── */}
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              {sectionTitle('Pipeline Operacional de Lançamentos',
                <DocumentTextIcon style={{ width: 16, height: 16, color: '#6366f1' }} />
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <PipelineStep
                  label="Rascunho"
                  count={data.pipeline.rascunho.length}
                  value={data.pipeline.rascunho.reduce((s, l) => s + (l.valor || 0), 0)}
                  color="#94a3b8"
                />
                <PipelineStep
                  label="Ag. Aprovação"
                  count={data.pipeline.aguardando.length}
                  value={data.pipeline.aguardando.reduce((s, l) => s + (l.valor || 0), 0)}
                  color="#f59e0b"
                />
                <PipelineStep
                  label="Aprovado"
                  count={data.pipeline.aprovado.length}
                  value={data.pipeline.aprovado.reduce((s, l) => s + (l.valor || 0), 0)}
                  color="#10b981"
                />
                <PipelineStep
                  label="Faturado"
                  count={data.pipeline.faturado.length}
                  value={data.pipeline.faturado.reduce((s, l) => s + (l.valor || 0), 0)}
                  color="#8b5cf6"
                  isLast
                />
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <InformationCircleIcon style={{ width: 13, height: 13, color: 'var(--text-secondary)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Clique em <strong style={{ color: 'var(--text-primary)' }}>Lançamentos</strong> para aprovar, devolver ou reprovar itens individualmente.
                </span>
              </div>
            </div>

            {/* ── Pipeline de Faturamento (Lotes Cliente) ────────────────── */}
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              {sectionTitle('Pipeline de Faturamento — Lotes Cliente',
                <UserGroupIcon style={{ width: 16, height: 16, color: '#f59e0b' }} />
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <PipelineStep label="Rascunho"              count={data.lotePipeline.rascunho.length} color="#94a3b8" />
                <PipelineStep label="Aguardando Cliente"    count={data.lotePipeline.enviado.length}  color="#f59e0b" />
                <PipelineStep label="Aprovado pelo Cliente" count={data.lotePipeline.aprovado.length} color="#10b981" />
                <PipelineStep label="Recusado"              count={data.lotePipeline.recusado.length} color="#ef4444" isLast />
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <InformationCircleIcon style={{ width: 13, height: 13, color: 'var(--text-secondary)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Lotes <strong style={{ color: '#10b981' }}>aprovados</strong> geram entrada em{' '}
                  <strong style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => navigate('/pagamentos')}>Contas a Receber</strong>.
                  {' '}Lotes <strong style={{ color: '#ef4444' }}>recusados</strong> voltam para revisão em
                  {' '}<strong style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => navigate('/lotes-cliente')}>Lotes Cliente</strong>.
                </span>
              </div>
            </div>

            {/* ── Alertas + Atividade Recente ────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

              {/* Alertas */}
              <div style={cardStyle}>
                {sectionTitle('Alertas — Ação Necessária',
                  <BellAlertIcon style={{ width: 16, height: 16, color: '#ef4444' }} />
                )}
                {data.alertas.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <CheckCircleIcon style={{ width: 18, height: 18, color: '#10b981', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>Tudo em dia! Nenhuma pendência crítica.</span>
                  </div>
                ) : data.alertas.map((a, i) => {
                  if (a.tipo === 'vencido')
                    return <AlertItem key={i}
                      icon={ExclamationCircleIcon} color="#ef4444" bg="rgba(239,68,68,0.06)"
                      title={`${a.count} conta${a.count > 1 ? 's' : ''} vencida${a.count > 1 ? 's'  : ''}`}
                      desc={`Total em atraso: ${fmtCurrency(a.valor)}`}
                      badge="URGENTE"
                      onClick={() => navigate('/contas-pagar')}
                    />
                  if (a.tipo === 'parado')
                    return <AlertItem key={i}
                      icon={ClockIcon} color="#f59e0b" bg="rgba(245,158,11,0.06)"
                      title={`${a.count} lançamento${a.count > 1 ? 's' : ''} parado${a.count > 1 ? 's' : ''} há +3 dias`}
                      desc="Aguardando aprovação sem movimentação"
                      badge="ATENÇÃO"
                      onClick={() => navigate('/lancamentos')}
                    />
                  if (a.tipo === 'lote_sem_resposta')
                    return <AlertItem key={i}
                      icon={UserGroupIcon} color="#f97316" bg="rgba(249,115,22,0.06)"
                      title={`${a.count} lote${a.count > 1 ? 's' : ''} sem resposta do cliente`}
                      desc="Enviado há mais de 5 dias sem retorno"
                      badge="FOLLOW-UP"
                      onClick={() => navigate('/lotes-cliente')}
                    />
                  if (a.tipo === 'sem_nf')
                    return <AlertItem key={i}
                      icon={DocumentTextIcon} color="#6366f1" bg="rgba(99,102,241,0.06)"
                      title={`${a.count} pagamento${a.count > 1 ? 's' : ''} sem Nota Fiscal`}
                      desc="Pagamentos registrados aguardando NF"
                      badge="NF"
                      onClick={() => navigate('/pagamentos')}
                    />
                  if (a.tipo === 'compra_parada')
                    return <AlertItem key={i}
                      icon={ShoppingCartIcon} color="#f97316" bg="rgba(249,115,22,0.06)"
                      title={`${a.count} compra${a.count > 1 ? 's' : ''} aguardando aprovação há +3 dias`}
                      desc="Pedidos de compra parados sem decisão"
                      badge="COMPRAS"
                      onClick={() => navigate('/compras/aprovar')}
                    />
                  return null
                })}
              </div>

              {/* Atividade Recente */}
              <div style={cardStyle}>
                {sectionTitle('Atividade Recente',
                  <CalendarDaysIcon style={{ width: 16, height: 16, color: '#6366f1' }} />
                )}
                {data.atividade.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center', padding: 20 }}>Nenhuma atividade registrada</div>
                ) : data.atividade.map((a, i) => {
                  const cfgModulo = {
                    lancamento:  { icon: DocumentTextIcon, color: a.tipo === 'receita' ? '#10b981' : '#ef4444' },
                    lote:        { icon: UserGroupIcon,    color: '#6366f1' },
                    conta_pagar: { icon: BanknotesIcon,    color: '#f59e0b' },
                    receber:     { icon: BanknotesIcon,    color: a.pago ? '#10b981' : '#8b5cf6' },
                  }[a.modulo] || { icon: DocumentTextIcon, color: '#94a3b8' }
                  const modLabel = { lancamento: 'Lançamento', lote: 'Lote', conta_pagar: 'C. Pagar', receber: 'C. Receber' }[a.modulo] || ''
                  return (
                    <AtividadeItem key={i}
                      icon={cfgModulo.icon}
                      color={cfgModulo.color}
                      title={a.title}
                      value={fmtCurrency(a.value)}
                      date={fmtDate(a._ts)}
                      badge={modLabel}
                    />
                  )
                })}
              </div>
            </div>

            {/* ── Despesas por Categoria ───────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={cardStyle}>
                {sectionTitle(`Despesas por Categoria — ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
                  <ChartBarIcon style={{ width: 16, height: 16, color: '#f97316' }} />
                )}
                <BarChart data={data.porCategoria} colorFn={catColor} />
              </div>

              {/* Resumo Financeiro do Mês */}
              <div style={cardStyle}>
                {sectionTitle('Resumo Financeiro do Mês',
                  <CurrencyDollarIcon style={{ width: 16, height: 16, color: '#10b981' }} />
                )}
                {[
                  { label: 'Receitas aprovadas',  value: data.kpis.totalReceitas,  color: '#10b981', icon: ArrowTrendingUpIcon },
                  { label: 'Despesas lançadas',   value: data.kpis.totalDespesas,  color: '#ef4444', icon: ArrowTrendingDownIcon },
                  { label: 'Contas pagas',         value: data.kpis.totalPagoMes,  color: '#6366f1', icon: CheckCircleIcon },
                  { label: 'Contas a pagar',       value: data.kpis.totalPendMes,  color: '#f59e0b', icon: ClockIcon },
                  { label: 'A receber (faturado)', value: data.kpis.totalAReceber,    color: '#8b5cf6', icon: BuildingOffice2Icon },
                  { label: 'Recebido no mês',      value: data.kpis.totalRecebidoMes, color: '#10b981', icon: CheckCircleIcon },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon style={{ width: 14, height: 14, color }} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color }}>{fmtCurrency(value)}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: data.kpis.saldoProjetado >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${data.kpis.saldoProjetado >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>SALDO PROJETADO</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: data.kpis.saldoProjetado >= 0 ? '#10b981' : '#ef4444' }}>
                      {fmtCurrency(data.kpis.saldoProjetado)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
