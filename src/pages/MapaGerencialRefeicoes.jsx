import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  CalendarDaysIcon, TableCellsIcon, ChevronLeftIcon, ChevronRightIcon,
  XMarkIcon, ArrowDownTrayIcon, FunnelIcon, ArrowPathIcon,
  UserGroupIcon, BuildingStorefrontIcon, DocumentTextIcon,
  ChartBarIcon, CurrencyDollarIcon, ClockIcon, CheckCircleIcon,
  ExclamationTriangleIcon, NoSymbolIcon, CheckIcon,
} from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtBRL = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtN   = v => (Number(v) || 0).toLocaleString('pt-BR')
const pad    = n => String(n).padStart(2, '0')

function todayISO() { return new Date().toISOString().slice(0, 10) }

function isoToDisplay(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function buildMonthDays(year, month) {
  const days = []
  const d = new Date(year, month - 1, 1)
  while (d.getMonth() === month - 1) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}

function buildCustomDays(start, end) {
  const days = []
  const d = new Date(start)
  const e = new Date(end)
  while (d <= e) {
    days.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return days
}

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function dayLabel(iso) {
  const d = new Date(iso + 'T00:00:00')
  return { dow: WEEKDAYS_PT[d.getDay()], day: pad(d.getDate()), month: pad(d.getMonth() + 1) }
}

// ─── Status ──────────────────────────────────────────────────────────────────
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
  pendente:                'pendente',
  aguardando_aprovacao:    'pendente',
  aprovado:                'aprovado',
  confirmado_restaurante:  'aprovado',
  enviado_restaurante:     'aprovado',
  em_acompanhamento:       'aprovado',
  entregue:                'entregue',
  faturado:                'faturado',
  enviado_faturamento:     'faturado',
  reprovado:               'divergencia',
  aguardando_validacao:    'divergencia',
  finalizado_com_ocorrencia: 'divergencia',
}

function deriveCellStatus(entries) {
  if (!entries || entries.length === 0) return 'nenhum'
  const statuses = entries.map(e => STATUS_SOL[e.status] || 'pendente')
  if (statuses.includes('divergencia'))             return 'divergencia'
  if (statuses.includes('faturado'))                return 'faturado'
  if (statuses.every(s => s === 'aprovado' || s === 'entregue')) return 'aprovado'
  if (statuses.every(s => s === 'entregue'))        return 'entregue'
  if (statuses.includes('pendente'))                return 'pendente'
  return 'parcial'
}

// ─── Theme hook ──────────────────────────────────────────────────────────────
function useIsDark() {
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') !== 'light')
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.getAttribute('data-theme') !== 'light'))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

// ─── Matrix Cell ─────────────────────────────────────────────────────────────
function MatrixCell({ entries, onClick, isSelected, isDark }) {
  const status = deriveCellStatus(entries)
  const cfg    = STATUS_CFG[status]
  const qty    = entries.reduce((a, e) => a + (e.total_refeicoes || 0) + (e.total_cafes || 0), 0)
  const val    = entries.reduce((a, e) => a + (Number(e.valor_total) || 0), 0)
  const empty  = status === 'nenhum'

  const baseBg     = isDark ? (empty ? '#1e222a' : cfg.bg.replace('#', '') !== cfg.bg ? cfg.bg : '#1e222a') : cfg.bg
  const darkCellBg = {
    aprovado:    '#0f2a1a', entregue: '#0f2a1a',
    faturado:    '#0f1e35',
    pendente:    '#2a2000',
    divergencia: '#2a0a0a',
    parcial:     '#251c00',
    nenhum:      isDark ? '#1a1d22' : '#F9FAFB',
  }

  return (
    <td
      onClick={empty ? undefined : onClick}
      style={{
        padding: 0,
        minWidth: 82,
        maxWidth: 100,
        height: 56,
        cursor: empty ? 'default' : 'pointer',
        verticalAlign: 'middle',
      }}
    >
      <div style={{
        margin: '3px',
        height: 50,
        borderRadius: 8,
        background: isDark ? darkCellBg[status] : cfg.bg,
        border: `1px solid ${isSelected ? '#6366F1' : cfg.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isSelected ? '0 0 0 2px rgba(99,102,241,0.35)' : 'none',
        transition: 'all 0.12s',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {!empty && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: cfg.dot, borderRadius: '8px 8px 0 0',
          }} />
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
function SummaryCards({ matrix, days, isDark }) {
  const BG   = isDark ? '#1a1d22' : '#FFFFFF'
  const BORD = isDark ? 'rgba(255,255,255,0.08)' : '#E8EAF2'
  const SHA  = isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06),0 4px 20px rgba(0,0,0,0.04)'
  const T    = isDark ? '#e8eaed' : '#1A2332'
  const T2   = isDark ? '#8a9099' : '#6B7A99'

  let totalDiasComLanc = 0, totalPendentes = 0, totalSemLanc = 0
  let totalQty = 0, totalVal = 0, diasComDados = 0

  days.forEach(day => {
    const entries = matrix.flatMap(row => row.cells[day] || [])
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
    { icon: '✅', label: 'Dias com Refeições', val: totalDiasComLanc, sub: `${((totalDiasComLanc / Math.max(days.length, 1)) * 100).toFixed(0)}% do período`, color: '#22C55E', accent: '#DCFCE7', accentDark: '#0f2a1a' },
    { icon: '⏳', label: 'Dias com Pendentes', val: totalPendentes,   sub: `${((totalPendentes / Math.max(days.length, 1)) * 100).toFixed(0)}% do período`,    color: '#EAB308', accent: '#FEF9C3', accentDark: '#2a2000' },
    { icon: '⬜', label: 'Sem Lançamento',      val: totalSemLanc,    sub: 'dias sem registro',           color: '#9CA3AF', accent: '#F3F4F6', accentDark: '#1e222a' },
    { icon: '🍽️', label: 'Total de Itens',      val: fmtN(totalQty),  sub: 'refeições + cafés no período', color: '#4F6EF7', accent: '#EEF2FF', accentDark: '#0f1535' },
    { icon: '💰', label: 'Valor Total',          val: fmtBRL(totalVal).replace('R$\u00a0', 'R$ '), sub: 'total no período', color: '#14B8A6', accent: '#F0FDFA', accentDark: '#021f1b', isStr: true },
    { icon: '📊', label: 'Média por Dia',        val: fmtN(Math.round(media)), sub: 'itens/dia (dias ativos)', color: '#8B5CF6', accent: '#F5F3FF', accentDark: '#150d2e' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 12, marginBottom: 20 }}>
      {cards.map((c, i) => (
        <div key={i} style={{ background: BG, border: `1px solid ${BORD}`, borderRadius: 14, padding: '14px 16px', boxShadow: SHA, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.color, borderRadius: '14px 14px 0 0' }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${c.color}09 0%, transparent 60%)`, pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{c.label}</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: isDark ? c.accentDark : c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{c.icon}</div>
          </div>
          <div style={{ fontSize: c.isStr ? 18 : 28, fontWeight: 800, color: T, lineHeight: 1, letterSpacing: '-0.025em' }}>{c.val}</div>
          <div style={{ fontSize: 10, color: T2, marginTop: 5 }}>{c.sub}</div>
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
  const status = deriveCellStatus(entries)
  const cfg    = STATUS_CFG[status]
  const totalQty = entries.reduce((a, e) => a + (e.total_refeicoes || 0) + (e.total_cafes || 0), 0)
  const totalRef = entries.reduce((a, e) => a + (e.total_refeicoes || 0), 0)
  const totalCaf = entries.reduce((a, e) => a + (e.total_cafes || 0), 0)
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
      zIndex: 1000, display: 'flex', flexDirection: 'column',
      fontFamily: 'inherit',
    }}>
      {/* Header */}
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
        {/* Status chip */}
        <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: isDark ? cfg.dot + '22' : cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 999, padding: '4px 12px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? cfg.dot : cfg.text }}>{cfg.label}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* Totals bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Refeições', val: fmtN(totalRef), color: '#4F6EF7' },
            { label: 'Cafés',     val: fmtN(totalCaf), color: '#F59E0B' },
            { label: 'Valor',     val: fmtBRL(totalVal).replace('R$\u00a0','R$ '), color: '#14B8A6' },
          ].map((item, i) => (
            <div key={i} style={{ background: BG2, border: `1px solid ${BORD}`, borderRadius: 10, padding: '10px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: item.color, letterSpacing: '-0.02em' }}>{item.val}</div>
              <div style={{ fontSize: 9, color: T3, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Média unitária */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: BG2, borderRadius: 10, border: `1px solid ${BORD}`, marginBottom: 14 }}>
          <span style={{ fontSize: 12, color: T2 }}>Média unitária</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T }}>{fmtBRL(media)}</span>
        </div>

        {/* Pedidos */}
        {entries.length === 1 ? (
          <SingleSolDetail sol={entries[0]} isDark={isDark} BG={BG} BG2={BG2} BORD={BORD} T={T} T2={T2} T3={T3} />
        ) : (
          <MultiSolList entries={entries} isDark={isDark} BG={BG} BG2={BG2} BORD={BORD} T={T} T2={T2} T3={T3} />
        )}
      </div>

      {/* Actions footer */}
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${BORD}`, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <button style={{ padding: '10px', borderRadius: 10, border: `1px solid ${BORD}`, background: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF', color: '#6366F1', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          📄 Visualizar Boletim
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button style={{ padding: '8px', borderRadius: 10, border: `1px solid ${BORD}`, background: 'transparent', color: T2, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
            ✏️ Editar
          </button>
          <button style={{ padding: '8px', borderRadius: 10, border: `1px solid ${BORD}`, background: 'transparent', color: T2, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
            📥 Baixar PDF
          </button>
          <button style={{ padding: '8px', borderRadius: 10, border: `1px solid ${BORD}`, background: 'transparent', color: T2, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
            🕐 Histórico
          </button>
          <button style={{ padding: '8px', borderRadius: 10, border: `1px solid ${BORD}`, background: isDark ? 'rgba(20,184,166,0.12)' : '#F0FDFA', color: '#14B8A6', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>
            💳 Faturamento
          </button>
        </div>
      </div>
    </div>
  )
}

function SingleSolDetail({ sol, isDark, BG, BG2, BORD, T, T2, T3 }) {
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

function MultiSolList({ entries, isDark, BG, BG2, BORD, T, T2, T3 }) {
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
function Legend({ isDark }) {
  const T2 = isDark ? '#8a9099' : '#6B7A99'
  const BORD = isDark ? 'rgba(255,255,255,0.08)' : '#E8EAF2'
  const BG   = isDark ? '#1a1d22' : '#FFFFFF'
  const items = [
    { key: 'aprovado',    label: 'Completo / Aprovado' },
    { key: 'faturado',    label: 'Faturado / Enviado' },
    { key: 'pendente',    label: 'Pendente / Aguardando' },
    { key: 'divergencia', label: 'Divergência' },
    { key: 'nenhum',      label: 'Sem lançamento' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', padding: '12px 16px', background: BG, border: `1px solid ${BORD}`, borderRadius: 10, marginTop: 14 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Legenda:</span>
      {items.map(item => {
        const cfg = STATUS_CFG[item.key]
        return (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: cfg.dot }} />
            <span style={{ fontSize: 11, color: T2 }}>{item.label}</span>
          </div>
        )
      })}
      <span style={{ fontSize: 10, color: T2, marginLeft: 'auto', fontStyle: 'italic' }}>Clique em uma célula para ver o boletim</span>
    </div>
  )
}

// ─── Matrix Table ─────────────────────────────────────────────────────────────
function MatrixTable({ matrix, days, viewBy, onCellClick, selectedCell, isDark }) {
  const BG   = isDark ? '#1a1d22' : '#FFFFFF'
  const BG2  = isDark ? '#13161a' : '#F4F6FB'
  const BORD = isDark ? 'rgba(255,255,255,0.07)' : '#E8EAF2'
  const T    = isDark ? '#e8eaed' : '#1A2332'
  const T2   = isDark ? '#8a9099' : '#6B7A99'
  const T3   = isDark ? '#555d6e' : '#A0AEC0'

  const COLS = {
    equipe:      ['Equipe', 'Responsável'],
    restaurante: ['Restaurante', 'Unidade'],
    cdc:         ['CDC', 'Equipes'],
    supervisor:  ['Supervisor', 'Equipes'],
  }
  const [col1, col2] = COLS[viewBy] || ['Grupo', '—']

  // totals per day (footer)
  const dayTotals = useMemo(() => {
    return days.map(day => {
      const entries = matrix.flatMap(row => row.cells[day] || [])
      const qty = entries.reduce((a, e) => a + (e.total_refeicoes || 0) + (e.total_cafes || 0), 0)
      const val = entries.reduce((a, e) => a + (Number(e.valor_total) || 0), 0)
      return { qty, val }
    })
  }, [matrix, days])

  const stickyBase = { position: 'sticky', background: BG, zIndex: 2 }

  return (
    <div style={{ background: BG, border: `1px solid ${BORD}`, borderRadius: 14, overflow: 'hidden', boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06),0 4px 20px rgba(0,0,0,0.04)' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600, tableLayout: 'fixed' }}>
          {/* HEADER */}
          <thead>
            <tr style={{ background: BG2, borderBottom: `2px solid ${BORD}` }}>
              {/* sticky col 1 */}
              <th style={{ ...stickyBase, background: BG2, left: 0, width: 160, minWidth: 160, padding: '10px 14px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', borderRight: `1px solid ${BORD}`, zIndex: 3 }}>
                {col1}
              </th>
              {/* sticky col 2 */}
              <th style={{ ...stickyBase, background: BG2, left: 160, width: 120, minWidth: 120, padding: '10px 14px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', borderRight: `2px solid ${BORD}`, zIndex: 3 }}>
                {col2}
              </th>
              {/* day columns */}
              {days.map(day => {
                const { dow, day: d, month: m } = dayLabel(day)
                const isToday = day === todayISO()
                return (
                  <th key={day} style={{ width: 90, minWidth: 82, padding: '6px 4px', textAlign: 'center', fontSize: 9, fontWeight: 700, color: isToday ? '#6366F1' : T2, letterSpacing: '0.03em' }}>
                    <div style={{ textTransform: 'uppercase' }}>{dow}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: isToday ? '#6366F1' : T, marginTop: 1 }}>{d}/{m}</div>
                  </th>
                )
              })}
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {matrix.map((row, ri) => (
              <tr key={row.key} style={{ borderBottom: `1px solid ${BORD}` }}>
                {/* Col 1 — main label */}
                <td style={{ ...stickyBase, left: 0, width: 160, minWidth: 160, padding: '0 14px', height: 56, borderRight: `1px solid ${BORD}`, zIndex: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</div>
                </td>
                {/* Col 2 — sub label */}
                <td style={{ ...stickyBase, left: 160, width: 120, minWidth: 120, padding: '0 14px', height: 56, borderRight: `2px solid ${BORD}`, zIndex: 2 }}>
                  <div style={{ fontSize: 10, color: T3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.subLabel || '—'}</div>
                </td>
                {/* Day cells */}
                {days.map(day => {
                  const entries = row.cells[day] || []
                  const isSelected = selectedCell?.groupKey === row.key && selectedCell?.day === day
                  return (
                    <MatrixCell
                      key={day}
                      entries={entries}
                      isDark={isDark}
                      isSelected={isSelected}
                      onClick={() => onCellClick({ groupKey: row.key, groupLabel: row.label, day, entries })}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>

          {/* FOOTER totals */}
          <tfoot>
            <tr style={{ background: BG2, borderTop: `2px solid ${BORD}` }}>
              <td style={{ ...stickyBase, background: BG2, left: 0, padding: '8px 14px', fontSize: 10, fontWeight: 800, color: T2, textTransform: 'uppercase', letterSpacing: '0.06em', borderRight: `1px solid ${BORD}`, zIndex: 3 }} colSpan={2}>
                TOTAL DIA
              </td>
              {/* td colSpan trick doesn't work with sticky, so render explicitly */}
              <td style={{ ...stickyBase, background: BG2, left: 160, padding: '8px 14px', fontSize: 10, fontWeight: 800, color: T2, borderRight: `2px solid ${BORD}`, zIndex: 3, display: 'none' }} />
              {dayTotals.map((tot, i) => (
                <td key={i} style={{ padding: '8px 4px', textAlign: 'center' }}>
                  {tot.qty > 0 ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 800, color: T }}>{fmtN(tot.qty)}</div>
                      <div style={{ fontSize: 9, color: T3 }}>{fmtBRL(tot.val).replace('R$\u00a0','R$ ')}</div>
                    </>
                  ) : (
                    <span style={{ fontSize: 13, color: T3, opacity: 0.4 }}>—</span>
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

// ─── View tabs ────────────────────────────────────────────────────────────────
const VIEW_TABS = [
  { key: 'equipe',      label: 'por Equipe',      icon: UserGroupIcon },
  { key: 'restaurante', label: 'por Restaurante',  icon: BuildingStorefrontIcon },
  { key: 'cdc',         label: 'por CDC',          icon: ChartBarIcon },
  { key: 'supervisor',  label: 'por Supervisor',   icon: DocumentTextIcon },
]

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MapaGerencialRefeicoes({ sols: solsProp, workspaceId: wsProp }) {
  const wsStore = useStore(s => s.workspaceId)
  const workspaceId = wsProp || wsStore

  const isDark = useIsDark()

  // ── State ──────────────────────────────────────────────────────────────────
  const now      = new Date()
  const [year,   setYear]   = useState(now.getFullYear())
  const [month,  setMonth]  = useState(now.getMonth() + 1)
  const [rangeMode, setRangeMode] = useState('month')  // 'month' | 'custom'
  const [customStart, setCustomStart] = useState('')
  const [customEnd,   setCustomEnd]   = useState('')
  const [viewBy, setViewBy]   = useState('equipe')
  const [sols,   setSols]     = useState(solsProp || [])
  const [loading, setLoading] = useState(!solsProp)
  const [selectedCell, setSelectedCell] = useState(null)

  // Filter state
  const [fEquipe,  setFEquipe]  = useState('')
  const [fRest,    setFRest]    = useState('')
  const [fCdc,     setFCdc]     = useState('')
  const [fSuper,   setFSuper]   = useState('')
  const [fStatus,  setFStatus]  = useState('')

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) return
    setLoading(true)
    supabase
      .from('refei_solicitacoes')
      .select('*, refei_equipes(id,nome,cdc,lider_nome,supervisor_nome), refei_restaurantes(id,nome)')
      .eq('workspace_id', workspaceId)
      .neq('status', 'rascunho')
      .then(({ data }) => {
        setSols(data || [])
        setLoading(false)
      })
  }, [workspaceId])

  // ── Days in period ─────────────────────────────────────────────────────────
  const days = useMemo(() => {
    if (rangeMode === 'custom' && customStart && customEnd && customStart <= customEnd) {
      return buildCustomDays(customStart, customEnd)
    }
    return buildMonthDays(year, month)
  }, [rangeMode, year, month, customStart, customEnd])

  // ── Filter lists (for dropdowns) ───────────────────────────────────────────
  const filterOpts = useMemo(() => {
    const equipes     = [...new Set(sols.map(s => s.refei_equipes?.nome).filter(Boolean))].sort()
    const rests       = [...new Set(sols.map(s => s.refei_restaurantes?.nome).filter(Boolean))].sort()
    const cdcs        = [...new Set(sols.map(s => s.refei_equipes?.cdc).filter(Boolean))].sort()
    const supervisores = [...new Set(sols.map(s => s.refei_equipes?.supervisor_nome || s.lider_nome).filter(Boolean))].sort()
    return { equipes, rests, cdcs, supervisores }
  }, [sols])

  // ── Apply filters ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return sols.filter(s => {
      if (fEquipe && s.refei_equipes?.nome !== fEquipe) return false
      if (fRest   && s.refei_restaurantes?.nome !== fRest) return false
      if (fCdc    && s.refei_equipes?.cdc !== fCdc) return false
      if (fSuper  && (s.refei_equipes?.supervisor_nome || s.lider_nome) !== fSuper) return false
      if (fStatus && (STATUS_SOL[s.status] || 'pendente') !== fStatus) return false
      // only show entries within the selected period
      if (!days.includes(s.data_refeicao)) return false
      return true
    })
  }, [sols, fEquipe, fRest, fCdc, fSuper, fStatus, days])

  // ── Build matrix rows ──────────────────────────────────────────────────────
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

  // ── Colors & styles ────────────────────────────────────────────────────────
  const BG      = isDark ? '#0d0f12' : '#F4F6FB'
  const CARD    = isDark ? '#1a1d22' : '#FFFFFF'
  const BORD    = isDark ? 'rgba(255,255,255,0.08)' : '#E8EAF2'
  const SHA     = isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06),0 4px 20px rgba(0,0,0,0.04)'
  const TEXT    = isDark ? '#e8eaed' : '#1A2332'
  const TEXT2   = isDark ? '#8a9099' : '#6B7A99'
  const TEXT3   = isDark ? '#555d6e' : '#A0AEC0'

  const inputStyle = {
    background: isDark ? '#1f2329' : '#FFFFFF',
    border: `1px solid ${BORD}`,
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 12,
    color: TEXT,
    outline: 'none',
    fontFamily: 'inherit',
  }
  const selectStyle = { ...inputStyle, cursor: 'pointer', paddingRight: 24 }

  const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ margin: '-20px -24px', background: BG, minHeight: 'calc(100% + 40px)', fontFamily: 'inherit' }}>

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORD}`, padding: '18px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #4F6EF7, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <TableCellsIcon style={{ width: 18, height: 18, color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em', lineHeight: 1 }}>Mapa Gerencial de Refeições</div>
                <div style={{ fontSize: 11, color: TEXT2, marginTop: 3 }}>Visão por equipe, restaurante, CDC e supervisor — acompanhe cada dia do período</div>
              </div>
            </div>
          </div>

          {/* Period navigator */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 0, background: isDark ? '#1f2329' : '#F1F5F9', borderRadius: 8, border: `1px solid ${BORD}`, overflow: 'hidden' }}>
              {['month', 'custom'].map(mode => (
                <button key={mode} onClick={() => setRangeMode(mode)} style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: rangeMode === mode ? '#4F6EF7' : 'transparent', color: rangeMode === mode ? '#fff' : TEXT2, transition: 'all 0.12s' }}>
                  {mode === 'month' ? '📅 Mês' : '📆 Período'}
                </button>
              ))}
            </div>

            {rangeMode === 'month' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: CARD, border: `1px solid ${BORD}`, borderRadius: 8, padding: '5px 10px' }}>
                <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT2, padding: 2, display: 'flex' }}>
                  <ChevronLeftIcon style={{ width: 14, height: 14 }} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, color: TEXT, minWidth: 120, textAlign: 'center' }}>{MONTHS_PT[month - 1]} {year}</span>
                <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT2, padding: 2, display: 'flex' }}>
                  <ChevronRightIcon style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ ...inputStyle, fontSize: 11 }} />
                <span style={{ color: TEXT3, fontSize: 12 }}>até</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ ...inputStyle, fontSize: 11 }} />
              </div>
            )}

            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${BORD}`, background: 'transparent', color: TEXT2, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              <ArrowDownTrayIcon style={{ width: 13, height: 13 }} />
              Exportar
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 28px' }}>

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <div style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 12, padding: '14px 18px', marginBottom: 18, boxShadow: SHA }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <FunnelIcon style={{ width: 13, height: 13, color: TEXT3, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: TEXT3, textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 4 }}>Filtros</span>

            <select value={fEquipe} onChange={e => setFEquipe(e.target.value)} style={selectStyle}>
              <option value="">Todas equipes</option>
              {filterOpts.equipes.map(e => <option key={e} value={e}>{e}</option>)}
            </select>

            <select value={fRest} onChange={e => setFRest(e.target.value)} style={selectStyle}>
              <option value="">Todos restaurantes</option>
              {filterOpts.rests.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <select value={fCdc} onChange={e => setFCdc(e.target.value)} style={selectStyle}>
              <option value="">Todos CDCs</option>
              {filterOpts.cdcs.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={fSuper} onChange={e => setFSuper(e.target.value)} style={selectStyle}>
              <option value="">Todos supervisores</option>
              {filterOpts.supervisores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={selectStyle}>
              <option value="">Todos status</option>
              <option value="aprovado">Aprovado</option>
              <option value="pendente">Pendente</option>
              <option value="faturado">Faturado</option>
              <option value="divergencia">Divergência</option>
            </select>

            {(fEquipe || fRest || fCdc || fSuper || fStatus) && (
              <button onClick={() => { setFEquipe(''); setFRest(''); setFCdc(''); setFSuper(''); setFStatus('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: `1px solid ${BORD}`, background: 'transparent', color: '#EF4444', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                <XMarkIcon style={{ width: 12, height: 12 }} />
                Limpar
              </button>
            )}

            <span style={{ marginLeft: 'auto', fontSize: 11, color: TEXT3 }}>
              {filtered.length} solicitação{filtered.length !== 1 ? 'ões' : ''} · {days.length} dias
            </span>
          </div>
        </div>

        {/* ── Summary Cards ─────────────────────────────────────────────────── */}
        <SummaryCards matrix={matrix} days={days} isDark={isDark} />

        {/* ── View Tabs ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 4, background: CARD, border: `1px solid ${BORD}`, borderRadius: 12, padding: '6px', marginBottom: 14, boxShadow: SHA, width: 'fit-content' }}>
          {VIEW_TABS.map(tab => {
            const Icon = tab.icon
            const active = viewBy === tab.key
            return (
              <button key={tab.key} onClick={() => setViewBy(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 8,
                border: 'none',
                background: active ? '#4F6EF7' : 'transparent',
                color: active ? '#fff' : TEXT2,
                fontSize: 12, fontWeight: active ? 700 : 600,
                cursor: 'pointer', transition: 'all 0.12s',
                boxShadow: active ? '0 1px 4px rgba(79,110,247,0.35)' : 'none',
              }}>
                <Icon style={{ width: 13, height: 13 }} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Matrix ────────────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 14, padding: '60px', textAlign: 'center', color: TEXT3, fontSize: 13 }}>
            <ArrowPathIcon style={{ width: 20, height: 20, margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
            Carregando dados...
          </div>
        ) : matrix.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 14, padding: '60px', textAlign: 'center' }}>
            <TableCellsIcon style={{ width: 36, height: 36, margin: '0 auto 14px', display: 'block', color: TEXT3 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 6 }}>Nenhum lançamento encontrado</div>
            <div style={{ fontSize: 12, color: TEXT2 }}>Ajuste os filtros ou selecione outro período</div>
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

        {/* ── Legend ────────────────────────────────────────────────────────── */}
        <Legend isDark={isDark} />

      </div>

      {/* ── Side Panel ────────────────────────────────────────────────────────── */}
      {selectedCell && (
        <>
          <div onClick={() => setSelectedCell(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999 }} />
          <SidePanel cell={selectedCell} onClose={() => setSelectedCell(null)} isDark={isDark} />
        </>
      )}
    </div>
  )
}
