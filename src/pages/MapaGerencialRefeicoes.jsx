import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  TableCellsIcon, ChevronLeftIcon, ChevronRightIcon,
  XMarkIcon, ArrowPathIcon, FunnelIcon,
  UserGroupIcon, BuildingStorefrontIcon, DocumentTextIcon, ChartBarIcon,
} from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtN   = v => (Number(v) || 0).toLocaleString('pt-BR')
const pad    = n => String(n).padStart(2, '0')
const DAY_PT = ['DOM','SEG','TER','QUA','QUI','SEX','SAB']

function todayISO() { return new Date().toISOString().slice(0, 10) }

function isoToDisplay(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function buildDays(refDate, periodo) {
  const n = { '-7': 7, '-15': 15, '-30': 30 }[periodo] ?? 15
  const ref = new Date(refDate + 'T12:00:00')
  const days = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    days.push({ iso, dow: DAY_PT[d.getDay()], num: iso.slice(8), full: `${DAY_PT[d.getDay()]} (${isoToDisplay(iso)})` })
  }
  return days
}

function dayLabel(iso) {
  const d = new Date(iso + 'T00:00:00')
  return { dow: DAY_PT[d.getDay()], day: pad(d.getDate()), month: pad(d.getMonth() + 1) }
}

// ─── Status ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  aprovado:    { label: 'Aprovado',       bg: '#DCFCE7', border: '#86EFAC', text: '#15803D', dot: '#22C55E' },
  entregue:    { label: 'Entregue',       bg: '#DCFCE7', border: '#86EFAC', text: '#15803D', dot: '#22C55E' },
  faturado:    { label: 'Faturado',       bg: '#DBEAFE', border: '#93C5FD', text: '#1D4ED8', dot: '#3B82F6' },
  pendente:    { label: 'Pendente',       bg: '#FEF9C3', border: '#FDE047', text: '#A16207', dot: '#EAB308' },
  divergencia: { label: 'Divergência',    bg: '#FEE2E2', border: '#FCA5A5', text: '#B91C1C', dot: '#EF4444' },
  parcial:     { label: 'Incompleto',     bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', dot: '#F59E0B' },
  nenhum:      { label: 'Sem lançamento', bg: '#F3F4F6', border: '#E5E7EB', text: '#9CA3AF', dot: '#D1D5DB' },
}

const STATUS_SOL = {
  pendente:                  'pendente',
  aguardando_aprovacao:      'pendente',
  aprovado:                  'aprovado',
  confirmado_restaurante:    'aprovado',
  consolidado:               'aprovado',
  enviado_restaurante:       'aprovado',
  em_acompanhamento:         'aprovado',
  entregue:                  'entregue',
  aguardando_validacao:      'entregue',
  finalizado:                'entregue',
  faturado:                  'faturado',
  enviado_faturamento:       'faturado',
  reprovado:                 'divergencia',
  finalizado_com_ocorrencia: 'divergencia',
}

function deriveCellStatus(entries) {
  if (!entries || entries.length === 0) return 'nenhum'
  const statuses = entries.map(e => STATUS_SOL[e.status] || 'pendente')
  if (statuses.includes('divergencia'))                           return 'divergencia'
  if (statuses.includes('faturado'))                             return 'faturado'
  if (statuses.every(s => s === 'aprovado' || s === 'entregue')) return 'aprovado'
  if (statuses.every(s => s === 'entregue'))                     return 'entregue'
  if (statuses.includes('pendente'))                             return 'pendente'
  return 'parcial'
}

// ─── Theme hook ───────────────────────────────────────────────────────────────
function useIsDark() {
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') !== 'light')
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.getAttribute('data-theme') !== 'light'))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

// ─── MultiSelect ──────────────────────────────────────────────────────────────
function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const toggle = opt => value.includes(opt) ? onChange(value.filter(v => v !== opt)) : onChange([...value, opt])
  const displayText = value.length === 0
    ? 'nenhum item selecionado'
    : value.length === options.length && options.length > 0
    ? 'todos selecionados'
    : `${value.length} selecionado(s)`

  return (
    <div style={{ position: 'relative' }}>
      {label && (
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: value.length ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText} ▼</span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
            {options.length === 0 && (
              <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 13 }}>Sem opções</div>
            )}
            {options.map(opt => (
              <div
                key={opt}
                onClick={() => toggle(opt)}
                style={{ padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', background: value.includes(opt) ? 'rgba(99,102,241,0.12)' : 'transparent' }}
              >
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${value.includes(opt) ? '#6366f1' : 'var(--border)'}`, background: value.includes(opt) ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {value.includes(opt) && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
                </div>
                {opt}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Matrix Cell ──────────────────────────────────────────────────────────────
function MatrixCell({ entries, onClick, isSelected, isDark }) {
  const status = deriveCellStatus(entries)
  const cfg    = STATUS_CFG[status]
  const qty    = entries.reduce((a, e) => a + (e.total_refeicoes || 0) + (e.total_cafes || 0), 0)
  const val    = entries.reduce((a, e) => a + (Number(e.valor_total) || 0), 0)
  const empty  = status === 'nenhum'

  const darkCellBg = {
    aprovado: '#0f2a1a', entregue: '#0f2a1a',
    faturado:    '#0f1e35',
    pendente:    '#2a2000',
    divergencia: '#2a0a0a',
    parcial:     '#251c00',
    nenhum:      isDark ? '#1a1d22' : '#F9FAFB',
  }

  return (
    <td
      onClick={empty ? undefined : onClick}
      style={{ padding: 0, minWidth: 82, maxWidth: 100, height: 56, cursor: empty ? 'default' : 'pointer', verticalAlign: 'middle' }}
    >
      <div style={{
        margin: '3px', height: 50, borderRadius: 8,
        background: isDark ? darkCellBg[status] : cfg.bg,
        border: `1px solid ${isSelected ? '#6366F1' : cfg.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        boxShadow: isSelected ? '0 0 0 2px rgba(99,102,241,0.35)' : 'none',
        transition: 'all 0.12s', position: 'relative', overflow: 'hidden',
      }}>
        {!empty && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: cfg.dot, borderRadius: '8px 8px 0 0' }} />
        )}
        {empty ? (
          <span style={{ fontSize: 14, opacity: 0.25 }}>—</span>
        ) : (
          <>
            <span style={{ fontSize: 15, fontWeight: 800, color: isDark ? cfg.dot : cfg.text, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {fmtN(qty)}
            </span>
            <span style={{ fontSize: 9, color: isDark ? cfg.dot + 'bb' : cfg.text, marginTop: 2, fontWeight: 600, opacity: 0.85 }}>
              {fmtBRL(val).replace('R$\u00a0', 'R$ ')}
            </span>
          </>
        )}
      </div>
    </td>
  )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────
function SummaryCards({ matrix, days }) {
  let totalDiasComLanc = 0, totalPendentes = 0, totalSemLanc = 0
  let totalQty = 0, totalVal = 0, diasComDados = 0

  days.forEach(day => {
    const entries = matrix.flatMap(row => row.cells[day.iso] || [])
    if (entries.length > 0) {
      totalDiasComLanc++
      diasComDados++
      totalQty += entries.reduce((a, e) => a + (e.total_refeicoes || 0) + (e.total_cafes || 0), 0)
      totalVal += entries.reduce((a, e) => a + (Number(e.valor_total) || 0), 0)
      if (entries.some(e => ['pendente', 'aguardando_aprovacao'].includes(e.status))) totalPendentes++
    } else {
      totalSemLanc++
    }
  })

  const media = diasComDados > 0 ? totalQty / diasComDados : 0

  const cards = [
    { icon: '✅', label: 'Dias c/ Refeições', val: totalDiasComLanc,  sub: `${((totalDiasComLanc / Math.max(days.length, 1)) * 100).toFixed(0)}% do período`, color: '#22C55E' },
    { icon: '⏳', label: 'Dias c/ Pendentes', val: totalPendentes,    sub: `${((totalPendentes / Math.max(days.length, 1)) * 100).toFixed(0)}% do período`, color: '#EAB308' },
    { icon: '⬜', label: 'Sem Lançamento',    val: totalSemLanc,      sub: 'dias sem registro', color: '#9CA3AF' },
    { icon: '🍽️', label: 'Total de Itens',   val: fmtN(totalQty),    sub: 'refeições + cafés', color: '#4F6EF7', isStr: true },
    { icon: '💰', label: 'Valor Total',        val: fmtBRL(totalVal).replace('R$\u00a0', 'R$ '), sub: 'total no período', color: '#14B8A6', isStr: true },
    { icon: '📊', label: 'Média / Dia',        val: fmtN(Math.round(media)), sub: 'itens/dia (ativo)', color: '#8B5CF6' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))', gap: 10, marginBottom: 16 }}>
      {cards.map((c, i) => (
        <div key={i} className="card" style={{ padding: '12px 14px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.color, borderRadius: '14px 14px 0 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{c.label}</span>
            <span style={{ fontSize: 14 }}>{c.icon}</span>
          </div>
          <div style={{ fontSize: c.isStr ? 15 : 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{c.val}</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Side Panel ───────────────────────────────────────────────────────────────
function SidePanel({ cell, onClose, isDark }) {
  if (!cell) return null
  const { groupLabel, day, entries } = cell
  const { dow, day: d, month: m } = dayLabel(day)
  const status   = deriveCellStatus(entries)
  const cfg      = STATUS_CFG[status]
  const totalRef = entries.reduce((a, e) => a + (e.total_refeicoes || 0), 0)
  const totalCaf = entries.reduce((a, e) => a + (e.total_cafes || 0), 0)
  const totalQty = totalRef + totalCaf
  const totalVal = entries.reduce((a, e) => a + (Number(e.valor_total) || 0), 0)
  const media    = totalQty > 0 ? totalVal / totalQty : 0

  const BG   = isDark ? '#13161a' : '#FFFFFF'
  const BG2  = isDark ? '#1a1d22' : '#F8FAFC'
  const BORD = isDark ? 'rgba(255,255,255,0.08)' : '#E8EAF2'
  const T    = isDark ? '#e8eaed' : '#1A2332'
  const T2   = isDark ? '#8a9099' : '#6B7A99'
  const T3   = isDark ? '#555d6e' : '#A0AEC0'

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 360,
      background: BG, borderLeft: `1px solid ${BORD}`,
      boxShadow: '-4px 0 32px rgba(0,0,0,0.18)',
      zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: 'inherit',
      animation: 'slideInRight 0.2s ease',
    }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${BORD}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Detalhes do Dia</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T, letterSpacing: '-0.02em', lineHeight: 1 }}>{dow}, {d}/{m}</div>
            <div style={{ fontSize: 12, color: T2, marginTop: 3 }}>{groupLabel}</div>
          </div>
          <button onClick={onClose} style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#F1F5F9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T2 }}>
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: isDark ? cfg.dot + '22' : cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 999, padding: '4px 12px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? cfg.dot : cfg.text }}>{cfg.label}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Refeições', val: fmtN(totalRef), color: '#4F6EF7' },
            { label: 'Cafés',     val: fmtN(totalCaf), color: '#F59E0B' },
            { label: 'Valor',     val: fmtBRL(totalVal).replace('R$\u00a0', 'R$ '), color: '#14B8A6' },
          ].map((item, i) => (
            <div key={i} style={{ background: BG2, border: `1px solid ${BORD}`, borderRadius: 10, padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.val}</div>
              <div style={{ fontSize: 9, color: T3, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: BG2, borderRadius: 10, border: `1px solid ${BORD}`, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: T2 }}>Média unitária</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T }}>{fmtBRL(media)}</span>
        </div>

        {entries.length === 1 ? (
          <SingleSolDetail sol={entries[0]} BG2={BG2} BORD={BORD} T={T} T2={T2} T3={T3} />
        ) : (
          <MultiSolList entries={entries} isDark={isDark} BG2={BG2} BORD={BORD} T={T} T2={T2} T3={T3} />
        )}
      </div>
    </div>
  )
}

function SingleSolDetail({ sol, BG2, BORD, T, T2 }) {
  const rows = [
    { label: 'Equipe',       val: sol.refei_equipes?.nome || '—' },
    { label: 'Responsável',  val: sol.lider_nome || '—' },
    { label: 'Restaurante',  val: sol.refei_restaurantes?.nome || '—' },
    { label: 'CDC',          val: sol.refei_equipes?.cdc || '—' },
    { label: 'Tipo',         val: sol.permite_cafe ? 'Refeição + Café' : 'Refeição' },
    { label: 'Lançado em',   val: sol.criado_em ? new Date(sol.criado_em).toLocaleString('pt-BR') : '—' },
    { label: 'Código',       val: sol.numero_pedido || sol.id?.slice(0, 8)?.toUpperCase() || '—' },
  ]
  return (
    <div style={{ background: BG2, border: `1px solid ${BORD}`, borderRadius: 12, overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < rows.length - 1 ? `1px solid ${BORD}` : 'none' }}>
          <span style={{ fontSize: 11, color: T2 }}>{r.label}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: T, maxWidth: '58%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.val}</span>
        </div>
      ))}
    </div>
  )
}

function MultiSolList({ entries, isDark, BG2, BORD, T, T2, T3 }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
        {entries.length} solicitações neste dia
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map((sol, i) => {
          const sc = STATUS_CFG[STATUS_SOL[sol.status] || 'pendente']
          return (
            <div key={i} style={{ background: BG2, border: `1px solid ${BORD}`, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T, maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sol.refei_equipes?.nome || sol.refei_restaurantes?.nome || 'Sem nome'}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: isDark ? sc.dot : sc.text, background: isDark ? sc.dot + '22' : sc.bg, border: `1px solid ${sc.border}`, borderRadius: 999, padding: '2px 7px' }}>
                  {sc.label}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 11, color: '#4F6EF7', fontWeight: 700 }}>🍽️ {sol.total_refeicoes || 0}</span>
                <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>☕ {sol.total_cafes || 0}</span>
                <span style={{ fontSize: 11, color: '#14B8A6', fontWeight: 700, marginLeft: 'auto' }}>{fmtBRL(sol.valor_total)}</span>
              </div>
              {sol.lider_nome && <div style={{ fontSize: 10, color: T3, marginTop: 4 }}>👤 {sol.lider_nome}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { key: 'aprovado',    label: 'Aprovado / Entregue' },
    { key: 'faturado',    label: 'Faturado' },
    { key: 'pendente',    label: 'Pendente' },
    { key: 'divergencia', label: 'Divergência' },
    { key: 'nenhum',      label: 'Sem lançamento' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 14 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Legenda:</span>
      {items.map(item => {
        const cfg = STATUS_CFG[item.key]
        return (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: cfg.dot }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Matrix Table ─────────────────────────────────────────────────────────────
function MatrixTable({ matrix, days, viewBy, onCellClick, selectedCell, isDark }) {
  const COLS = {
    equipe:      ['Equipe',      'Responsável'],
    restaurante: ['Restaurante', 'Unidade'],
    cdc:         ['CDC',         'Equipes'],
    supervisor:  ['Supervisor',  'Equipes'],
  }
  const [col1, col2] = COLS[viewBy] || ['Grupo', '—']

  const dayTotals = useMemo(() => {
    return days.map(day => {
      const entries = matrix.flatMap(row => row.cells[day.iso] || [])
      const qty = entries.reduce((a, e) => a + (e.total_refeicoes || 0) + (e.total_cafes || 0), 0)
      const val = entries.reduce((a, e) => a + (Number(e.valor_total) || 0), 0)
      return { qty, val }
    })
  }, [matrix, days])

  const sticky = { position: 'sticky', zIndex: 2 }

  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
              <th style={{ ...sticky, background: 'var(--bg-secondary)', left: 0, width: 160, minWidth: 160, padding: '10px 14px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', borderRight: '1px solid var(--border)', zIndex: 3 }}>
                {col1}
              </th>
              <th style={{ ...sticky, background: 'var(--bg-secondary)', left: 160, width: 120, minWidth: 120, padding: '10px 14px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', borderRight: '2px solid var(--border)', zIndex: 3 }}>
                {col2}
              </th>
              {days.map(day => {
                const isToday = day.iso === todayISO()
                return (
                  <th key={day.iso} style={{ width: 90, minWidth: 82, padding: '6px 4px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: isToday ? '#6366F1' : 'var(--text-secondary)' }}>
                    <div style={{ textTransform: 'uppercase' }}>{day.dow}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: isToday ? '#6366F1' : 'var(--text-primary)', marginTop: 1 }}>{day.num}</div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {matrix.map(row => (
              <tr key={row.key} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...sticky, background: 'var(--bg-primary)', left: 0, width: 160, minWidth: 160, padding: '0 14px', height: 56, borderRight: '1px solid var(--border)', zIndex: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</div>
                </td>
                <td style={{ ...sticky, background: 'var(--bg-primary)', left: 160, width: 120, minWidth: 120, padding: '0 14px', height: 56, borderRight: '2px solid var(--border)', zIndex: 2 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.subLabel || '—'}</div>
                </td>
                {days.map(day => {
                  const entries    = row.cells[day.iso] || []
                  const isSelected = selectedCell?.groupKey === row.key && selectedCell?.day === day.iso
                  return (
                    <MatrixCell
                      key={day.iso}
                      entries={entries}
                      isDark={isDark}
                      isSelected={isSelected}
                      onClick={() => onCellClick({ groupKey: row.key, groupLabel: row.label, day: day.iso, entries })}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
              <td
                colSpan={2}
                style={{ ...sticky, background: 'var(--bg-secondary)', left: 0, padding: '8px 14px', fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', borderRight: '2px solid var(--border)', zIndex: 3 }}
              >
                TOTAL DIA
              </td>
              {dayTotals.map((tot, i) => (
                <td key={i} style={{ padding: '8px 4px', textAlign: 'center' }}>
                  {tot.qty > 0 ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{fmtN(tot.qty)}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{fmtBRL(tot.val).replace('R$\u00a0', 'R$ ')}</div>
                    </>
                  ) : (
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', opacity: 0.4 }}>—</span>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── View Tabs ────────────────────────────────────────────────────────────────
const VIEW_TABS = [
  { key: 'equipe',      label: 'por Equipe',     icon: UserGroupIcon },
  { key: 'restaurante', label: 'por Restaurante', icon: BuildingStorefrontIcon },
  { key: 'cdc',         label: 'por CDC',         icon: ChartBarIcon },
  { key: 'supervisor',  label: 'por Supervisor',  icon: DocumentTextIcon },
]

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MapaGerencialRefeicoes({ sols: solsProp, workspaceId: wsProp }) {
  const wsStore     = useStore(s => s.workspaceId)
  const workspaceId = wsProp || wsStore
  const isDark      = useIsDark()

  // ── State ──────────────────────────────────────────────────────────────────
  const [refDate,  setRefDate]  = useState(todayISO)
  const [periodo,  setPeriodo]  = useState('-15')
  const [viewBy,   setViewBy]   = useState('equipe')
  const [sols,     setSols]     = useState(solsProp || [])
  const [loading,  setLoading]  = useState(!solsProp)
  const [selectedCell, setSelectedCell] = useState(null)

  // Filters (array-based MultiSelect)
  const [fEquipe,  setFEquipe]  = useState([])
  const [fRest,    setFRest]    = useState([])
  const [fCdc,     setFCdc]     = useState([])
  const [fSuper,   setFSuper]   = useState([])
  const [fStatus,  setFStatus]  = useState([])

  // ── Days ───────────────────────────────────────────────────────────────────
  const days = useMemo(() => buildDays(refDate, periodo), [refDate, periodo])

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const startDate = days[0].iso
    const endDate   = days[days.length - 1].iso
    const { data } = await supabase
      .from('refei_solicitacoes')
      .select('*, refei_equipes(id,nome,cdc,lider_nome,supervisor_nome), refei_restaurantes(id,nome)')
      .eq('workspace_id', workspaceId)
      .neq('status', 'rascunho')
      .gte('data_refeicao', startDate)
      .lte('data_refeicao', endDate)
    setSols(data || [])
    setLoading(false)
  }, [workspaceId, days])

  useEffect(() => { load() }, [load])

  // ── Period navigation ──────────────────────────────────────────────────────
  function shiftPeriod(dir) {
    const n = { '-7': 7, '-15': 15, '-30': 30 }[periodo] ?? 15
    const d = new Date(refDate + 'T12:00:00')
    d.setDate(d.getDate() + dir * n)
    setRefDate(d.toISOString().slice(0, 10))
  }

  // ── Filter options ─────────────────────────────────────────────────────────
  const filterOpts = useMemo(() => ({
    equipes:      [...new Set(sols.map(s => s.refei_equipes?.nome).filter(Boolean))].sort(),
    rests:        [...new Set(sols.map(s => s.refei_restaurantes?.nome).filter(Boolean))].sort(),
    cdcs:         [...new Set(sols.map(s => s.refei_equipes?.cdc).filter(Boolean))].sort(),
    supervisores: [...new Set(sols.map(s => s.refei_equipes?.supervisor_nome || s.lider_nome).filter(Boolean))].sort(),
    statuses:     ['aprovado', 'pendente', 'faturado', 'divergencia'],
  }), [sols])

  // ── Apply filters ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return sols.filter(s => {
      if (fEquipe.length && !fEquipe.includes(s.refei_equipes?.nome))                           return false
      if (fRest.length   && !fRest.includes(s.refei_restaurantes?.nome))                        return false
      if (fCdc.length    && !fCdc.includes(s.refei_equipes?.cdc))                               return false
      if (fSuper.length  && !fSuper.includes(s.refei_equipes?.supervisor_nome || s.lider_nome)) return false
      if (fStatus.length && !fStatus.includes(STATUS_SOL[s.status] || 'pendente'))              return false
      if (!days.find(d => d.iso === s.data_refeicao))                                           return false
      return true
    })
  }, [sols, fEquipe, fRest, fCdc, fSuper, fStatus, days])

  // ── Build matrix ──────────────────────────────────────────────────────────
  const matrix = useMemo(() => {
    const rowMap = {}
    filtered.forEach(sol => {
      let key, label, subLabel
      switch (viewBy) {
        case 'restaurante':
          key      = sol.refei_restaurantes?.id || 'sem_rest'
          label    = sol.refei_restaurantes?.nome || 'Sem restaurante'
          subLabel = '—'
          break
        case 'cdc':
          key      = sol.refei_equipes?.cdc || 'sem_cdc'
          label    = sol.refei_equipes?.cdc || 'Sem CDC'
          subLabel = sol.refei_equipes?.nome || '—'
          break
        case 'supervisor':
          key      = sol.refei_equipes?.supervisor_nome || sol.lider_nome || 'sem_sup'
          label    = sol.refei_equipes?.supervisor_nome || sol.lider_nome || 'Sem supervisor'
          subLabel = '—'
          break
        default: // equipe
          key      = sol.equipe_id || sol.refei_equipes?.id || 'sem_equipe'
          label    = sol.refei_equipes?.nome || 'Sem equipe'
          subLabel = sol.lider_nome || sol.refei_equipes?.lider_nome || '—'
      }
      if (!rowMap[key]) rowMap[key] = { key, label, subLabel, cells: {} }
      if (!rowMap[key].cells[sol.data_refeicao]) rowMap[key].cells[sol.data_refeicao] = []
      rowMap[key].cells[sol.data_refeicao].push(sol)
    })
    return Object.values(rowMap).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [filtered, viewBy])

  const hasFilters = fEquipe.length + fRest.length + fCdc.length + fSuper.length + fStatus.length > 0
  function clearFilters() { setFEquipe([]); setFRest([]); setFCdc([]); setFSuper([]); setFStatus([]) }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="🍽️ Mapa Gerencial de Refeições" subtitle="Visão por equipe, restaurante, CDC e supervisor" />

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* ── Filter card ──────────────────────────────────────────── */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>

          {/* Linha 1: Data + Período + navegação */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Data:</label>
              <input type="date" className="input" style={{ fontSize: 13 }} value={refDate} onChange={e => setRefDate(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Período:</label>
              <select className="input" style={{ fontSize: 13 }} value={periodo} onChange={e => setPeriodo(e.target.value)}>
                <option value="-7">-7 dias</option>
                <option value="-15">-15 dias</option>
                <option value="-30">-30 dias</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 4, paddingBottom: 1 }}>
              <button
                onClick={() => shiftPeriod(-1)}
                title="Período anterior"
                style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeftIcon style={{ width: 16, height: 16 }} />
              </button>
              <button
                onClick={() => shiftPeriod(1)}
                title="Próximo período"
                style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronRightIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>

          {/* Linha 2: MultiSelects */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 14 }}>
            <MultiSelect label="Equipe"      options={filterOpts.equipes}      value={fEquipe}  onChange={setFEquipe} />
            <MultiSelect label="Restaurante" options={filterOpts.rests}        value={fRest}    onChange={setFRest} />
            <MultiSelect label="CDC"         options={filterOpts.cdcs}         value={fCdc}     onChange={setFCdc} />
            <MultiSelect label="Supervisor"  options={filterOpts.supervisores} value={fSuper}   onChange={setFSuper} />
            <MultiSelect label="Status"      options={filterOpts.statuses}     value={fStatus}  onChange={setFStatus} />
          </div>

          {/* Linha 3: Botões + contador */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className="btn-primary"
              style={{ padding: '8px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={load}
            >
              <FunnelIcon style={{ width: 15, height: 15 }} /> Filtrar
            </button>
            {hasFilters && (
              <button
                onClick={clearFilters}
                style={{ padding: '8px 14px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <XMarkIcon style={{ width: 12, height: 12 }} /> Limpar filtros
              </button>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Foram encontrado(s) <strong>{filtered.length}</strong> registro(s)
            </span>
          </div>
        </div>

        {/* ── Summary Cards ─────────────────────────────────────────── */}
        <SummaryCards matrix={matrix} days={days} />

        {/* ── View Tabs ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, width: 'fit-content' }}>
          {VIEW_TABS.map(tab => {
            const Icon   = tab.icon
            const active = viewBy === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setViewBy(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 16px', borderRadius: 8, border: 'none',
                  background: active ? '#4F6EF7' : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: active ? 700 : 600,
                  cursor: 'pointer', transition: 'all 0.12s',
                  boxShadow: active ? '0 1px 4px rgba(79,110,247,0.35)' : 'none',
                }}
              >
                <Icon style={{ width: 13, height: 13 }} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Matrix ────────────────────────────────────────────────── */}
        {loading ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            <ArrowPathIcon style={{ width: 20, height: 20, margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
            Carregando dados...
          </div>
        ) : matrix.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <TableCellsIcon style={{ width: 36, height: 36, margin: '0 auto 14px', display: 'block', color: 'var(--text-secondary)' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Nenhum lançamento encontrado</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ajuste os filtros ou selecione outro período</div>
          </div>
        ) : (
          <MatrixTable
            matrix={matrix}
            days={days}
            viewBy={viewBy}
            onCellClick={setSelectedCell}
            selectedCell={selectedCell}
            isDark={isDark}
          />
        )}

        {/* ── Legend ────────────────────────────────────────────────── */}
        <Legend />

      </div>

      {/* ── Side Panel ────────────────────────────────────────────────── */}
      {selectedCell && (
        <>
          <div onClick={() => setSelectedCell(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999 }} />
          <SidePanel cell={selectedCell} onClose={() => setSelectedCell(null)} isDark={isDark} />
        </>
      )}
    </div>
  )
}
