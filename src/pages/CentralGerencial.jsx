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
        background: `linear-gradient(135deg, ${color}14 0%, var(--bg-card) 55%)`,
        boxShadow: 'var(--shadow-card)', borderRadius: 14, padding: '18px 20px',
        border: `1px solid ${color}28`, borderTop: `3px solid ${color}`,
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
        flex: 1, background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 12, padding: '14px 16px',
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
          <div style={{ height: 6, borderRadius: 4, background: 'rgba(0,0,0,0.05)', overflow: 'hidden' }}>
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

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
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
      ] = await Promise.all([
        supabase.from('lancamentos').select('id,tipo,status,valor,data,categoria,descricao,created_at,dados_extras').order('created_at', { ascending: false }).limit(500),
        supabase.from('lotes_cliente').select('id,status,cliente,created_at,updated_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('pagamentos').select('id,descricao,valor_total,data_pagamento,numero_nf,created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('contas_pagar').select('id,status,valor,vencimento,data_pagamento,categoria,descricao,fornecedor,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('solicitacoes_compra').select('id,status,titulo,valor_estimado,valor_aprovado,economia,urgencia,created_at,data_aprovacao').order('created_at', { ascending: false }).limit(200),
      ])

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
      })
      setLastUpdate(new Date())
    } catch (e) {
      console.error('[CentralGerencial]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const cardStyle = {
    background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 14,
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
      <Header
        title="Central Gerencial"
        subtitle="Visão executiva de todos os módulos"
        action={{
          label: 'Atualizar',
          onClick: load,
        }}
      />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px' }}>

        {/* Última atualização */}
        {lastUpdate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, color: 'var(--text-secondary)', fontSize: 11 }}>
            <ArrowPathIcon style={{ width: 12, height: 12 }} />
            Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            &nbsp;·&nbsp;
            {loading ? 'Carregando...' : `${(data?.kpis?.lancamentos || 0)} lançamentos · ${(data?.kpis?.lotes || 0)} lotes`}
          </div>
        )}

        {loading && !data ? (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <ArrowPathIcon style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14 }}>Carregando dados de todos os módulos...</div>
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
