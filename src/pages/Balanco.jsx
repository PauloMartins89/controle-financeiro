import { useState, useMemo } from 'react'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { formatCurrency, getCategoryIcon, CATEGORIAS } from '../lib/utils'
import {
  LockClosedIcon, LockOpenIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
  ExclamationTriangleIcon, LightBulbIcon, CheckCircleIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

// ─── Classificação 50/30/20 (Elizabeth Warren) ──────────────────────────────
// Necessidades = obrigatórias (não-discricionárias)
// Desejos      = discricionárias (lazer, etc)
// Poupança/Dívida = pagamentos de dívidas e investimentos
const REGRA_50_30_20 = {
  Moradia:        'necessidades',
  Alimentação:    'necessidades',
  Transporte:     'necessidades',
  Saúde:          'necessidades',
  Educação:       'necessidades',
  Serviços:       'necessidades',
  Vestuário:      'desejos',
  Entretenimento: 'desejos',
  Viagem:         'desejos',
  Lazer:          'desejos',
  Pets:           'desejos',
  Tecnologia:     'desejos',
  Outros:         'desejos',
}

const COLOR_PALETTE = ['#a855f7','#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#84cc16','#3b82f6','#f97316','#14b8a6','#eab308','#8b5cf6']

function fmtMes(yyyymm) {
  if (!yyyymm) return '—'
  const [y, m] = yyyymm.split('-')
  const d = new Date(parseInt(y), parseInt(m) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function nowYM() {
  return new Date().toISOString().slice(0, 7)
}

function offsetMes(yyyymm, off) {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1 + off, 1)
  return d.toISOString().slice(0, 7)
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KPI({ label, value, sub, color = '#6366f1', trend, icon }) {
  return (
    <div className="card" style={{ padding: 16, borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        {icon && <div style={{ color, opacity: 0.6 }}>{icon}</div>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>}
      {typeof trend === 'number' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 11, fontWeight: 700, color: trend >= 0 ? '#ef4444' : '#10b981' }}>
          {trend >= 0 ? <ArrowTrendingUpIcon style={{ width: 12, height: 12 }} /> : <ArrowTrendingDownIcon style={{ width: 12, height: 12 }} />}
          {Math.abs(trend).toFixed(1)}% vs mês anterior
        </div>
      )}
    </div>
  )
}

// ─── Donut Chart (SVG) ──────────────────────────────────────────────────────
function DonutChart({ data, size = 200 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sem dados</div>

  const radius = size / 2 - 10
  const inner = radius * 0.6
  const cx = size / 2, cy = size / 2
  let cum = 0

  const arcs = data.map((d, i) => {
    const startAngle = (cum / total) * 2 * Math.PI - Math.PI / 2
    cum += d.value
    const endAngle = (cum / total) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle)
    const y2 = cy + radius * Math.sin(endAngle)
    const x3 = cx + inner * Math.cos(endAngle)
    const y3 = cy + inner * Math.sin(endAngle)
    const x4 = cx + inner * Math.cos(startAngle)
    const y4 = cy + inner * Math.sin(startAngle)
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4} Z`
    return <path key={i} d={path} fill={d.color} stroke="var(--bg-secondary)" strokeWidth="1.5" />
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10" fill="var(--text-secondary)" fontWeight="700">TOTAL</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="14" fill="var(--text-primary)" fontWeight="800">
        {formatCurrency(total).replace('R$', '').trim()}
      </text>
    </svg>
  )
}

// ─── Bar Chart Horizontal ───────────────────────────────────────────────────
function BarH({ data, max, format = formatCurrency }) {
  const maxV = max || Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {d.icon && <span>{d.icon}</span>}{d.label}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: d.color || '#a855f7' }}>{format(d.value)}</div>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / maxV) * 100}%`, height: '100%', background: d.color || '#a855f7', borderRadius: 4, transition: 'width 0.4s' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Bar Chart Vertical (timeline mensal) ───────────────────────────────────
function BarV({ data, height = 180 }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const w = 100 / data.length
  return (
    <div style={{ height, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 4px', position: 'relative' }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 30)
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 700, opacity: d.value > 0 ? 1 : 0.3 }}>
              {d.value > 0 ? formatCurrency(d.value).replace('R$', '').replace(/\,\d{2}$/, '').trim() : ''}
            </div>
            <div title={`${d.label}: ${formatCurrency(d.value)}`} style={{ width: '100%', height: h, background: d.highlight ? '#a855f7' : 'rgba(168,85,247,0.4)', borderRadius: '4px 4px 0 0', minHeight: 2, transition: 'height 0.4s', cursor: 'pointer' }} />
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Página Principal ───────────────────────────────────────────────────────
export default function Balanco() {
  const { expenses, people, groups, vehicles, cards, closures, fecharMes, reabrirMes, getOwner } = useStore()
  const owner = getOwner()
  const [mes, setMes] = useState(nowYM())

  // Despesas do mês selecionado
  const mesExp = useMemo(() => expenses.filter(e => (e.data || '').startsWith(mes)), [expenses, mes])
  const mesAnterior = offsetMes(mes, -1)
  const expAnterior = useMemo(() => expenses.filter(e => (e.data || '').startsWith(mesAnterior)), [expenses, mesAnterior])

  // Closure (snapshot) deste mês, se existe
  const closureAtual = closures.find(c => c.mes === mes) || null
  const fechado = !!closureAtual

  // ─── Agregações principais ─────────────────────────────────────────────
  const total = mesExp.reduce((s, e) => s + e.valor, 0)
  const totalAnt = expAnterior.reduce((s, e) => s + e.valor, 0)
  const trendTotal = totalAnt > 0 ? ((total - totalAnt) / totalAnt) * 100 : null
  const totalPago = mesExp.filter(e => e.status === 'pago').reduce((s, e) => s + e.valor, 0)
  const totalPendente = total - totalPago
  const ticketMedio = mesExp.length ? total / mesExp.length : 0

  const porCategoria = useMemo(() => {
    const m = {}
    for (const e of mesExp) {
      const c = e.categoria || 'Outros'
      m[c] = (m[c] || 0) + e.valor
    }
    return Object.entries(m).map(([cat, value], i) => ({
      label: cat, value, icon: getCategoryIcon(cat), color: COLOR_PALETTE[i % COLOR_PALETTE.length]
    })).sort((a, b) => b.value - a.value)
  }, [mesExp])

  const porPessoa = useMemo(() => {
    const m = {}
    for (const e of mesExp) {
      if (!e.pago_por) continue
      m[e.pago_por] = (m[e.pago_por] || 0) + e.valor
    }
    return Object.entries(m).map(([pid, value]) => {
      const p = people.find(x => x.id === pid)
      return { label: p?.apelido || p?.nome || 'Desconhecido', value, color: p?.cor || '#6366f1' }
    }).sort((a, b) => b.value - a.value)
  }, [mesExp, people])

  const porGrupo = useMemo(() => {
    const m = {}
    for (const e of mesExp) {
      if (!e.grupo_id) continue
      m[e.grupo_id] = (m[e.grupo_id] || 0) + e.valor
    }
    return Object.entries(m).map(([gid, value]) => {
      const g = groups.find(x => x.id === gid)
      return { label: g?.nome || 'Sem grupo', value, color: g?.cor || '#6366f1', icon: g?.icone }
    }).sort((a, b) => b.value - a.value)
  }, [mesExp, groups])

  const porVeiculo = useMemo(() => {
    const m = {}
    for (const e of mesExp) {
      if (!e._veiculo) continue
      m[e._veiculo] = (m[e._veiculo] || 0) + e.valor
    }
    return Object.entries(m).map(([placa, value], i) => {
      const v = vehicles.find(x => x.placa === placa)
      return { label: `${placa}${v?.apelido ? ' · ' + v.apelido : ''}`, value, color: v?.cor || COLOR_PALETTE[i % COLOR_PALETTE.length], icon: '🚗' }
    }).sort((a, b) => b.value - a.value)
  }, [mesExp, vehicles])

  const top5Despesas = useMemo(() =>
    [...mesExp].sort((a, b) => b.valor - a.valor).slice(0, 5)
      .map(e => ({ label: e.descricao, value: e.valor, color: '#ef4444', icon: getCategoryIcon(e.categoria) }))
  , [mesExp])

  // ─── Análise 50/30/20 ──────────────────────────────────────────────────
  const regra502030 = useMemo(() => {
    const buckets = { necessidades: 0, desejos: 0, poupanca: 0 }
    for (const e of mesExp) {
      const tipo = REGRA_50_30_20[e.categoria || 'Outros'] || 'desejos'
      buckets[tipo] = (buckets[tipo] || 0) + e.valor
    }
    const t = buckets.necessidades + buckets.desejos + buckets.poupanca
    return {
      necessidades: { v: buckets.necessidades, pct: t ? (buckets.necessidades / t) * 100 : 0, ideal: 50 },
      desejos:      { v: buckets.desejos,      pct: t ? (buckets.desejos / t) * 100 : 0,      ideal: 30 },
      poupanca:     { v: buckets.poupanca,     pct: t ? (buckets.poupanca / t) * 100 : 0,     ideal: 20 },
    }
  }, [mesExp])

  // ─── Análise de Pareto (80/20) ─────────────────────────────────────────
  const pareto = useMemo(() => {
    if (porCategoria.length === 0) return null
    const ord = [...porCategoria].sort((a, b) => b.value - a.value)
    let acc = 0
    let n80 = 0
    for (const c of ord) {
      acc += c.value
      n80++
      if (acc / total >= 0.8) break
    }
    return { n80, totalCats: ord.length, top80: ord.slice(0, n80), pctCategorias: (n80 / ord.length) * 100 }
  }, [porCategoria, total])

  // ─── Evolução últimos 6 meses ──────────────────────────────────────────
  const evolucao = useMemo(() => {
    const arr = []
    for (let off = -5; off <= 0; off++) {
      const ym = offsetMes(mes, off)
      const cl = closures.find(c => c.mes === ym)
      let v
      if (cl) v = cl.total
      else v = expenses.filter(e => (e.data || '').startsWith(ym)).reduce((s, e) => s + e.valor, 0)
      const [, mm] = ym.split('-')
      const mesNomes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
      arr.push({ label: mesNomes[parseInt(mm) - 1], value: v, highlight: ym === mes, ym })
    }
    return arr
  }, [mes, expenses, closures])

  // ─── Crescimento por categoria (vs mês anterior) ───────────────────────
  const alertasCategoria = useMemo(() => {
    const cur = {}; const prev = {}
    for (const e of mesExp) cur[e.categoria || 'Outros'] = (cur[e.categoria || 'Outros'] || 0) + e.valor
    for (const e of expAnterior) prev[e.categoria || 'Outros'] = (prev[e.categoria || 'Outros'] || 0) + e.valor
    const arr = []
    for (const c of new Set([...Object.keys(cur), ...Object.keys(prev)])) {
      const a = cur[c] || 0, b = prev[c] || 0
      if (b === 0 && a > 0) arr.push({ cat: c, growth: 100, abs: a - b, atual: a, ant: b, novo: true })
      else if (b > 0) {
        const g = ((a - b) / b) * 100
        if (Math.abs(g) >= 20 || Math.abs(a - b) >= 200) arr.push({ cat: c, growth: g, abs: a - b, atual: a, ant: b, novo: false })
      }
    }
    return arr.sort((x, y) => Math.abs(y.abs) - Math.abs(x.abs)).slice(0, 6)
  }, [mesExp, expAnterior])

  // ─── Insights / Recomendações ──────────────────────────────────────────
  const insights = useMemo(() => {
    const out = []
    if (porCategoria[0]) {
      const top = porCategoria[0]
      const pct = (top.value / total) * 100
      if (pct >= 40) out.push({ tipo: 'alerta', txt: `Concentração alta: ${top.label} representa ${pct.toFixed(0)}% do total — risco de dependência.` })
      else out.push({ tipo: 'info', txt: `Maior categoria: ${top.label} (${pct.toFixed(0)}% — ${formatCurrency(top.value)}).` })
    }
    if (regra502030.necessidades.pct > 60) out.push({ tipo: 'alerta', txt: `Necessidades em ${regra502030.necessidades.pct.toFixed(0)}% — acima dos 50% ideais. Revise contas fixas.` })
    if (regra502030.desejos.pct > 40) out.push({ tipo: 'alerta', txt: `Desejos em ${regra502030.desejos.pct.toFixed(0)}% — acima dos 30% ideais. Considere cortar supérfluos.` })
    if (regra502030.poupanca.pct < 10 && total > 0) out.push({ tipo: 'alerta', txt: 'Poupança/dívidas abaixo de 10% — meta saudável é 20%.' })
    if (trendTotal !== null && trendTotal > 15) out.push({ tipo: 'alerta', txt: `Gastos cresceram ${trendTotal.toFixed(0)}% vs mês anterior — investigue as causas.` })
    if (trendTotal !== null && trendTotal < -10) out.push({ tipo: 'sucesso', txt: `Parabéns — você reduziu ${Math.abs(trendTotal).toFixed(0)}% de gastos vs mês anterior.` })
    if (totalPendente / Math.max(total, 1) > 0.5) out.push({ tipo: 'alerta', txt: `${((totalPendente/total)*100).toFixed(0)}% das despesas estão pendentes — atenção a vencimentos.` })
    if (pareto && pareto.n80 / pareto.totalCats <= 0.3) out.push({ tipo: 'info', txt: `Pareto: ${pareto.n80} categorias (${pareto.pctCategorias.toFixed(0)}%) concentram 80% dos gastos.` })
    return out
  }, [porCategoria, total, regra502030, trendTotal, totalPendente, pareto])

  function handleFechar() {
    if (mesExp.length === 0) { toast.error('Nada a fechar — não há despesas neste mês.'); return }
    const cardsAfetados = new Set(mesExp.filter(e => e.card_id).map(e => e.card_id))
    const pendentesNoMes = mesExp.filter(e => e.status !== 'pago').length
    let msg = `Fechar ${fmtMes(mes)}?\n\nIsso arquiva ${mesExp.length} despesas (${formatCurrency(total)}).`
    if (cardsAfetados.size > 0) {
      msg += `\n\n${cardsAfetados.size} cartão(ões) serão LIBERADOS para novos fechamentos.`
    }
    if (pendentesNoMes > 0) {
      msg += `\n${pendentesNoMes} despesa(s) pendente(s) serão marcadas como PAGAS.`
    }
    if (!confirm(msg)) return
    const snap = fecharMes(mes)
    if (snap?.cartoes_liberados?.length) {
      toast.success(`${fmtMes(mes)} fechado · ${snap.cartoes_liberados.length} cartão(ões) liberado(s)`)
    } else {
      toast.success(`${fmtMes(mes)} fechado!`)
    }
  }

  function handleReabrir() {
    const closure = closures.find(c => c.mes === mes)
    const qtdRevert = closure?.expenses_alteradas?.length || 0
    let msg = `Reabrir ${fmtMes(mes)}?`
    if (qtdRevert > 0) msg += `\n\n${qtdRevert} despesa(s) voltarão ao status pendente.`
    if (!confirm(msg)) return
    reabrirMes(mes)
    toast.success('Mês reaberto.')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Balanço & Análise" subtitle="Diagnóstico financeiro e fechamento mensal" />

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Toolbar: período + fechamento */}
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setMes(offsetMes(mes, -1))}>‹</button>
            <input
              type="month"
              className="input"
              value={mes}
              onChange={e => setMes(e.target.value)}
              style={{ width: 160 }}
            />
            <button className="btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setMes(offsetMes(mes, 1))}>›</button>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setMes(nowYM())}>Mês atual</button>
          </div>
          <div style={{ flex: 1, fontSize: 14, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: 16, textTransform: 'capitalize' }}>{fmtMes(mes)}</strong>
            {fechado && (
              <span style={{ marginLeft: 10, padding: '3px 8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                FECHADO em {new Date(closureAtual.data_fechamento).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
          {fechado ? (
            <button className="btn-ghost" onClick={handleReabrir} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <LockOpenIcon style={{ width: 16, height: 16 }} /> Reabrir mês
            </button>
          ) : (
            <button className="btn-primary" onClick={handleFechar} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <LockClosedIcon style={{ width: 16, height: 16 }} /> Fechar mês
            </button>
          )}
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <KPI label="Total Gasto" value={formatCurrency(total)} sub={`${mesExp.length} despesas`} color="#a855f7" trend={trendTotal} />
          <KPI label="Pago" value={formatCurrency(totalPago)} sub={`${total > 0 ? ((totalPago/total)*100).toFixed(0) : 0}% quitado`} color="#10b981" />
          <KPI label="Pendente" value={formatCurrency(totalPendente)} sub={`${total > 0 ? ((totalPendente/total)*100).toFixed(0) : 0}% a pagar`} color="#f59e0b" />
          <KPI label="Ticket Médio" value={formatCurrency(ticketMedio)} sub="por despesa" color="#06b6d4" />
          {porCategoria[0] && (
            <KPI label="Maior categoria" value={porCategoria[0].label} sub={formatCurrency(porCategoria[0].value)} color={porCategoria[0].color} icon={<span style={{ fontSize: 16 }}>{porCategoria[0].icon}</span>} />
          )}
          {porPessoa[0] && (
            <KPI label="Quem mais pagou" value={porPessoa[0].label} sub={formatCurrency(porPessoa[0].value)} color={porPessoa[0].color} />
          )}
        </div>

        {/* Insights / Recomendações */}
        {insights.length > 0 && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <LightBulbIcon style={{ width: 20, height: 20, color: '#f59e0b' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800 }}>Insights & Recomendações</h3>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  background: ins.tipo === 'alerta' ? 'rgba(239,68,68,0.08)' : ins.tipo === 'sucesso' ? 'rgba(16,185,129,0.08)' : 'rgba(99,102,241,0.08)',
                  border: `1px solid ${ins.tipo === 'alerta' ? 'rgba(239,68,68,0.25)' : ins.tipo === 'sucesso' ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.25)'}`,
                  borderRadius: 8
                }}>
                  {ins.tipo === 'alerta' && <ExclamationTriangleIcon style={{ width: 18, height: 18, color: '#ef4444', flexShrink: 0 }} />}
                  {ins.tipo === 'sucesso' && <CheckCircleIcon style={{ width: 18, height: 18, color: '#10b981', flexShrink: 0 }} />}
                  {ins.tipo === 'info' && <LightBulbIcon style={{ width: 18, height: 18, color: '#818cf8', flexShrink: 0 }} />}
                  <div style={{ fontSize: 13, lineHeight: 1.4 }}>{ins.txt}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linha 1: Donut categorias + Regra 50/30/20 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Distribuição por Categoria</h3>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
              <DonutChart data={porCategoria} size={180} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                {porCategoria.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: c.color }} />
                    <span>{c.icon}</span>
                    <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{c.label}</span>
                    <strong>{((c.value / total) * 100).toFixed(0)}%</strong>
                    <span style={{ color: 'var(--text-secondary)', minWidth: 80, textAlign: 'right' }}>{formatCurrency(c.value)}</span>
                  </div>
                ))}
                {porCategoria.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sem despesas neste mês</div>}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Regra 50/30/20</h3>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Necessidades · Desejos · Poupança/Dívidas (referência: Elizabeth Warren)
            </div>
            {[
              { key: 'necessidades', label: 'Necessidades', color: '#10b981', d: regra502030.necessidades },
              { key: 'desejos',      label: 'Desejos',      color: '#f59e0b', d: regra502030.desejos },
              { key: 'poupanca',     label: 'Poupança/Dívidas', color: '#a855f7', d: regra502030.poupanca },
            ].map(row => {
              const ok = Math.abs(row.d.pct - row.d.ideal) <= 8
              return (
                <div key={row.key} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{row.label} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>· ideal {row.d.ideal}%</span></div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ok ? '#10b981' : '#ef4444' }}>
                      {row.d.pct.toFixed(1)}% {ok ? '✓' : '⚠'}
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, row.d.pct)}%`, height: '100%', background: row.color, transition: 'width 0.4s' }} />
                    {/* Marca do ideal */}
                    <div style={{ position: 'absolute', left: `${row.d.ideal}%`, top: -2, bottom: -2, width: 2, background: 'rgba(255,255,255,0.5)' }} title={`Ideal: ${row.d.ideal}%`} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{formatCurrency(row.d.v)}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Linha 2: Evolução mensal + Pareto */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Evolução Mensal</h3>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 14 }}>Últimos 6 meses (mês selecionado em destaque)</div>
            <BarV data={evolucao} height={200} />
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Análise de Pareto (80/20)</h3>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 14 }}>Onde está concentrado 80% do seu gasto</div>
            {pareto ? (
              <>
                <div style={{ padding: 12, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 13 }}>
                    <strong style={{ color: '#a855f7', fontSize: 18 }}>{pareto.n80}</strong> de {pareto.totalCats} categorias
                    {' '}({pareto.pctCategorias.toFixed(0)}%) concentram <strong>80%</strong> dos gastos
                  </div>
                </div>
                <BarH data={pareto.top80.map(c => ({ ...c, color: '#a855f7' }))} max={pareto.top80[0]?.value} />
              </>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sem dados</div>
            )}
          </div>
        </div>

        {/* Linha 3: Por pessoa + Por grupo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Quem pagou (por pessoa)</h3>
            {porPessoa.length > 0 ? <BarH data={porPessoa} /> : <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sem dados</div>}
          </div>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Por grupo</h3>
            {porGrupo.length > 0 ? <BarH data={porGrupo} /> : <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhuma despesa em grupo</div>}
          </div>
        </div>

        {/* Linha 4: Veículos + Top 5 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Custos por veículo (Sem Parar)</h3>
            {porVeiculo.length > 0 ? <BarH data={porVeiculo} /> : <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum gasto associado a veículo neste mês</div>}
          </div>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Top 5 maiores despesas</h3>
            {top5Despesas.length > 0 ? <BarH data={top5Despesas} /> : <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Sem dados</div>}
          </div>
        </div>

        {/* Crescimento por categoria */}
        {alertasCategoria.length > 0 && (
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Variação por categoria vs {fmtMes(mesAnterior)}</h3>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 14 }}>Categorias com mudança ≥20% ou ≥R$ 200</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {alertasCategoria.map((a, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 80px', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                    <span style={{ fontSize: 16 }}>{getCategoryIcon(a.cat)}</span>
                    {a.cat}
                    {a.novo && <span style={{ fontSize: 9, padding: '2px 6px', background: '#a855f7', color: 'white', borderRadius: 4, fontWeight: 700 }}>NOVO</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                    {formatCurrency(a.ant)} → <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(a.atual)}</strong>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: a.abs >= 0 ? '#ef4444' : '#10b981', textAlign: 'right' }}>
                    {a.abs >= 0 ? '+' : ''}{formatCurrency(a.abs)}
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, justifySelf: 'end',
                    background: a.growth >= 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                    color: a.growth >= 0 ? '#ef4444' : '#10b981'
                  }}>
                    {a.growth >= 0 ? '↑' : '↓'} {Math.abs(a.growth).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico de fechamentos */}
        {closures.length > 0 && (
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Histórico de Fechamentos</h3>
            <div style={{ display: 'grid', gap: 6 }}>
              {[...closures].sort((a, b) => b.mes.localeCompare(a.mes)).map(c => (
                <div key={c.id} onClick={() => setMes(c.mes)} style={{ cursor: 'pointer', padding: '10px 12px', background: c.mes === mes ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.02)', border: '1px solid ' + (c.mes === mes ? 'rgba(168,85,247,0.3)' : 'transparent'), borderRadius: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px 120px', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{fmtMes(c.mes)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.qtd_despesas} despesas · fechado em {new Date(c.data_fechamento).toLocaleDateString('pt-BR')}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#a855f7', textAlign: 'right' }}>{formatCurrency(c.total)}</div>
                    <div style={{ fontSize: 10, textAlign: 'right' }}>
                      <span style={{ color: '#10b981' }}>✓ {formatCurrency(c.total_pago)}</span>
                      {c.total_pendente > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>⏳ {formatCurrency(c.total_pendente)}</span>}
                    </div>
                  </div>
                  {c.cartoes_liberados?.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Cartões liberados:</span>
                      {c.cartoes_liberados.map(cid => {
                        const card = cards.find(x => x.id === cid)
                        const fat = c.por_cartao?.[cid] || 0
                        const cor = card?.cor || '#94a3b8'
                        return (
                          <span key={cid} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: `${cor}20`, color: cor, border: `1px solid ${cor}44`, fontWeight: 600 }}>
                            💳 {card?.nome || 'Cartão'} · {formatCurrency(fat)}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
