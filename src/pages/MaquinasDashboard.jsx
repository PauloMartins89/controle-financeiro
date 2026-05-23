import { useState, useEffect, useCallback, useMemo } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { toast } from 'react-hot-toast'
import {
  WrenchScrewdriverIcon, ClockIcon, ChartBarIcon, ArrowTrendingUpIcon,
  ArrowPathIcon, DocumentTextIcon, CalendarDaysIcon, MapPinIcon,
  ExclamationCircleIcon, TableCellsIcon, CheckCircleIcon, ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'

const fmtD   = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const fmtH   = v => v != null ? `${Number(v).toFixed(1)}h` : '—'
const fmtN   = (v, d = 2) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—'
const fmtPct = v => v != null ? `${Number(v).toFixed(1)}%` : '—'
const today  = () => new Date().toISOString().slice(0, 10)
const minus  = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
const utilColor = p => p == null ? '#6b7280' : p >= 85 ? '#10b981' : p >= 55 ? '#eab308' : p > 20 ? '#f97316' : '#ef4444'

function KPICard({ label, value, sub, color, bg, icon: Icon }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 14, padding: '14px 16px',
      border: '1px solid var(--border)', borderTop: `3px solid ${color}`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 14, height: 14, color }} />
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  )
}

function BarRow({ label, value, max, color, right }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0, marginLeft: 8 }}>{right}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: color, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

function TrendChart({ data }) {
  if (!data || data.length < 2) return (
    <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>Dados insuficientes</div>
  )
  const H = 64, W = 500
  const maxVal = Math.max(...data.map(d => d.util || 0), 1)
  const px = i => (i / Math.max(data.length - 1, 1)) * W
  const py = v => H - ((v || 0) / maxVal) * (H - 6)
  const pts = data.map((d, i) => `${px(i)},${py(d.util)}`).join(' ')
  const fill = `0,${H} ${data.map((d, i) => `${px(i)},${py(d.util)}`).join(' ')} ${W},${H}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="gradUtil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fill} fill="url(#gradUtil)" />
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const STATUS_CFG = {
  processado:       { color: '#10b981', label: 'Processado' },
  pendente_revisao: { color: '#fbbf24', label: 'Pend. Revisão' },
  recebido:         { color: '#a78bfa', label: 'Recebido' },
  processando:      { color: '#60a5fa', label: 'Processando' },
  erro:             { color: '#f87171', label: 'Erro' },
}
function StatusPill({ status }) {
  const { color, label } = STATUS_CFG[status] || { color: '#6b7280', label: status || '—' }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}1a`, border: `1px solid ${color}44`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>{label}</span>
  )
}

function DataTable({ cols, rows, emptyMsg = 'Nenhum dado no período' }) {
  if (!rows.length) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
      <DocumentTextIcon style={{ width: 28, height: 28, margin: '0 auto 8px', opacity: 0.4 }} />
      <div style={{ fontSize: 12 }}>{emptyMsg}</div>
    </div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {cols.map(c => (
              <th key={c.key} style={{ padding: '8px 10px', textAlign: c.align || 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {cols.map(c => (
                <td key={c.key} style={{ padding: '9px 10px', color: 'var(--text-primary)', textAlign: c.align || 'left', whiteSpace: c.wrap ? 'normal' : 'nowrap' }}>
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function exportCSV(filename, cols, rows) {
  const header = cols.map(c => c.label)
  const data   = rows.map(r => cols.map(c => c.csv ? c.csv(r) : (r[c.key] ?? '')))
  const ws = XLSX.utils.aoa_to_sheet([header, ...data])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
  XLSX.writeFile(wb, `${filename}.xlsx`)
  toast.success('Excel exportado!')
}
function exportPDF(title, subtitle, cols, rows, landscape = true) {
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const W = landscape ? 297 : 210
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, W, 24, 'F')
  doc.setFillColor(99, 102, 241); doc.rect(0, 0, 4, 24, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text('SmartPro — Máquinas', 11, 10)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(title, 11, 18)
  doc.setFontSize(8); doc.text(subtitle, W - 12, 18, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  autoTable(doc, {
    startY: 30,
    head: [cols.map(c => c.label)],
    body: rows.map(r => cols.map(c => c.csv ? c.csv(r) : (r[c.key] ?? '—'))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 8, right: 8 },
  })
  doc.setFontSize(7); doc.setTextColor(150)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 8, doc.internal.pageSize.height - 5)
  doc.save(`${title.replace(/\s+/g, '_')}.pdf`)
  toast.success('PDF exportado!')
}

function ExportBtns({ onCSV, onPDF }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={onCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.08)', color: '#10b981', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
        <ArrowDownTrayIcon style={{ width: 12, height: 12 }} /> Excel
      </button>
      <button onClick={onPDF} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
        <DocumentTextIcon style={{ width: 12, height: 12 }} /> PDF
      </button>
    </div>
  )
}

function SectionTitle({ label, icon: Icon, color = '#6366f1' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Icon style={{ width: 15, height: 15, color }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
  )
}

export default function MaquinasDashboard() {
  const workspaceId = useStore(s => s.workspaceId)

  const [dtIni,      setDtIni]      = useState(minus(90))
  const [dtFim,      setDtFim]      = useState(today())
  const [tab,        setTab]        = useState('dashboard')
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [lancamentos, setLancamentos] = useState([])
  const [boletins,    setBoletins]    = useState([])
  const [fEquip,  setFEquip]  = useState('')
  const [fFrente, setFFrente] = useState('')
  const [fTurno,  setFTurno]  = useState('')

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const [lancRes, bolRes] = await Promise.all([
        supabase.from('lancamentos').select('id, data, dados_extras, status')
          .eq('workspace_id', workspaceId).eq('tipo_formulario', 'maquina')
          .gte('data', dtIni).lte('data', dtFim).order('data'),
        supabase.from('maquinas_boletins').select('id, numero, status, data_boletim, recebido_em, ocr_raw')
          .eq('workspace_id', workspaceId)
          .gte('data_boletim', dtIni).lte('data_boletim', dtFim)
          .order('data_boletim', { ascending: false }).limit(600),
      ])
      if (lancRes.error) toast.error(`Erro lancamentos: ${lancRes.error.message}`)
      if (bolRes.error)  toast.error(`Erro boletins: ${bolRes.error.message}`)
      const allBols = bolRes.data || []
      setBoletins(allBols)
      const lancIds = new Set((lancRes.data || []).map(l => l.dados_extras?.boletim_id).filter(Boolean))
      const bolAsLanc = allBols.filter(b => b.status !== 'processado' && !lancIds.has(b.id)).map(bol => {
        const o   = bol.ocr_raw || {}
        const hT  = parseFloat(o.horas_trabalhadas || o.horas_produtivas || 0) || null
        const hI  = parseFloat(o.horimetro_inicial || 0) || null
        const hF  = parseFloat(o.horimetro_final   || 0) || null
        const hD  = parseFloat(o.horas_disponiveis || o.horas_totais || 0) ||
                    (hI != null && hF != null ? parseFloat((hF - hI).toFixed(2)) : null)
        const pct = hD && hT ? parseFloat((hT / hD * 100).toFixed(2)) : null
        return {
          id: `bol_${bol.id}`, data: bol.data_boletim || bol.recebido_em?.slice(0, 10),
          dados_extras: {
            boletim_id: bol.id, boletim_numero: bol.numero, boletim_status: bol.status,
            equipamento: (o.equipamento || '').toUpperCase(), modelo: o.modelo || '',
            classe_operacional: o.classe || o.classe_operacional || '',
            frente: o.frente || o.frente_de_trabalho || '',
            cdc: o.cdc || '', turno: o.turno || '',
            colaborador: o.colaborador || o.operador || '',
            horimetro_inicial: hI, horimetro_final: hF,
            horas_disponiveis: hD, horas_trabalhadas: hT,
            horas_espera: parseFloat(o.horas_espera || o.horas_ociosas || 0) || null,
            porcentagem: pct,
            atividade_realizada: o.atividade_realizada || o.atividade || '',
            descritivo_trabalho: o.descritivo_trabalho || o.descritivo || '',
            observacoes: o.observacoes || '',
            produtividade_qtd:  parseFloat(o.produtividade_quantidade || o.produtividade || 0) || null,
            produtividade_un:   o.produtividade_unidade || o.unidade_medida || '',
            produtividade_hora: parseFloat(o.produtividade_por_hora || 0) || null,
          },
        }
      })
      setLancamentos([...(lancRes.data || []), ...bolAsLanc])
      setLastUpdate(new Date())
    } catch (err) {
      toast.error(`Erro: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, dtIni, dtFim])

  useEffect(() => { load() }, [load])

  const registros = useMemo(() => lancamentos.map(l => {
    const ex  = l.dados_extras || {}
    const ocr = ex.ocr || {}
    const hI  = ex.horimetro_inicial ?? ocr.horimetro_inicial ?? null
    const hF  = ex.horimetro_final   ?? ocr.horimetro_final   ?? null
    const hD  = ex.horas_disponiveis ?? ocr.horas_disponiveis ??
                (hI != null && hF != null ? parseFloat((hF - hI).toFixed(2)) : null)
    const hT  = ex.horas_trabalhadas ?? ocr.horas_trabalhadas ?? null
    const hE  = ex.horas_espera      ?? ocr.horas_espera      ?? null
    const pct = ex.porcentagem ?? (hD && hT ? parseFloat((hT / hD * 100).toFixed(2)) : null)
    return {
      id: l.id, data: l.data,
      equipamento: (ex.equipamento || ocr.equipamento || '').toUpperCase().trim(),
      modelo: ex.modelo || ocr.modelo || '',
      classe_operacional: ex.classe_operacional || ocr.classe || ocr.classe_operacional || '',
      frente: ex.frente || ocr.frente || '',
      cdc: ex.cdc || ocr.cdc || '',
      turno: (ex.turno || ocr.turno || '').toLowerCase(),
      colaborador: ex.colaborador || ocr.operador || ocr.colaborador || '',
      horimetro_inicial: hI, horimetro_final: hF,
      horas_disponiveis: hD, horas_trabalhadas: hT, horas_espera: hE, porcentagem: pct,
      atividade_realizada: ex.atividade_realizada || ocr.atividade_realizada || '',
      descritivo_trabalho: ex.descritivo_trabalho || '',
      observacoes: ex.observacoes || '',
      produtividade_qtd:  ex.produtividade_qtd  ?? null,
      produtividade_un:   ex.produtividade_un   || '',
      produtividade_hora: ex.produtividade_hora ?? null,
      boletim_id: ex.boletim_id || null, boletim_numero: ex.boletim_numero || '',
    }
  }), [lancamentos])

  const opEquip  = useMemo(() => [...new Set(registros.map(r => r.equipamento).filter(Boolean))].sort(), [registros])
  const opFrente = useMemo(() => [...new Set(registros.map(r => r.frente).filter(Boolean))].sort(), [registros])

  const filtrados = useMemo(() => registros.filter(r => {
    if (fEquip  && r.equipamento !== fEquip)  return false
    if (fFrente && r.frente      !== fFrente) return false
    if (fTurno  && r.turno       !== fTurno)  return false
    return true
  }), [registros, fEquip, fFrente, fTurno])

  const kpis = useMemo(() => {
    const equips = new Set(filtrados.map(r => r.equipamento).filter(Boolean))
    const tDisp  = filtrados.reduce((s, r) => s + (r.horas_disponiveis || 0), 0)
    const tTrab  = filtrados.reduce((s, r) => s + (r.horas_trabalhadas || 0), 0)
    const tEsp   = filtrados.reduce((s, r) => s + (r.horas_espera      || 0), 0)
    const pcts   = filtrados.filter(r => r.porcentagem != null).map(r => r.porcentagem)
    const utilMed = pcts.length ? pcts.reduce((s, v) => s + v, 0) / pcts.length : null
    const tProd  = filtrados.reduce((s, r) => s + (r.produtividade_qtd || 0), 0)
    const unProd = filtrados.find(r => r.produtividade_un)?.produtividade_un || ''
    return { equips: equips.size, total: filtrados.length, tDisp, tTrab, tEsp, utilMed, tProd, unProd }
  }, [filtrados])

  const porEquip = useMemo(() => {
    const m = {}
    for (const r of filtrados) {
      const k = r.equipamento || '—'
      if (!m[k]) m[k] = { equipamento: k, modelo: r.modelo, classe: r.classe_operacional, frente: r.frente, count: 0, hD: 0, hT: 0, hE: 0, pcts: [], prod: 0, un: r.produtividade_un }
      m[k].count++; m[k].hD += r.horas_disponiveis || 0; m[k].hT += r.horas_trabalhadas || 0; m[k].hE += r.horas_espera || 0
      if (r.porcentagem != null) m[k].pcts.push(r.porcentagem)
      m[k].prod += r.produtividade_qtd || 0
    }
    return Object.values(m).map(e => ({ ...e, util: e.pcts.length ? e.pcts.reduce((s, v) => s + v, 0) / e.pcts.length : null }))
      .sort((a, b) => (b.util || 0) - (a.util || 0))
  }, [filtrados])

  const porFrente = useMemo(() => {
    const m = {}
    for (const r of filtrados) {
      const k = r.frente || 'Sem frente'
      if (!m[k]) m[k] = { frente: k, equips: new Set(), count: 0, hT: 0, pcts: [], prod: 0 }
      m[k].equips.add(r.equipamento); m[k].count++; m[k].hT += r.horas_trabalhadas || 0
      if (r.porcentagem != null) m[k].pcts.push(r.porcentagem)
      m[k].prod += r.produtividade_qtd || 0
    }
    return Object.values(m).map(f => ({ ...f, equips: f.equips.size, util: f.pcts.length ? f.pcts.reduce((s, v) => s + v, 0) / f.pcts.length : null }))
      .sort((a, b) => b.hT - a.hT)
  }, [filtrados])

  const porTurno = useMemo(() => {
    const m = {}
    for (const r of filtrados) {
      const k = r.turno || 'n/i'
      if (!m[k]) m[k] = { turno: k, count: 0, hT: 0, pcts: [] }
      m[k].count++; m[k].hT += r.horas_trabalhadas || 0
      if (r.porcentagem != null) m[k].pcts.push(r.porcentagem)
    }
    return Object.values(m).map(t => ({ ...t, util: t.pcts.length ? t.pcts.reduce((s, v) => s + v, 0) / t.pcts.length : null }))
  }, [filtrados])

  const trendData = useMemo(() => {
    const m = {}
    for (const r of filtrados) {
      if (!r.data) continue
      if (!m[r.data]) m[r.data] = { data: r.data, pcts: [], hT: 0 }
      if (r.porcentagem != null) m[r.data].pcts.push(r.porcentagem)
      m[r.data].hT += r.horas_trabalhadas || 0
    }
    return Object.values(m).sort((a, b) => a.data.localeCompare(b.data))
      .map(d => ({ ...d, util: d.pcts.length ? d.pcts.reduce((s, v) => s + v, 0) / d.pcts.length : null }))
      .slice(-30)
  }, [filtrados])

  const prodRows = useMemo(() => filtrados.filter(r => r.produtividade_qtd || r.produtividade_hora)
    .sort((a, b) => (b.produtividade_qtd || 0) - (a.produtividade_qtd || 0)), [filtrados])
  const horiRows = useMemo(() => filtrados.filter(r => r.horimetro_inicial != null || r.horimetro_final != null)
    .sort((a, b) => (a.data || '').localeCompare(b.data || '')), [filtrados])
  const bolRows = useMemo(() => boletins.map(b => {
    const o  = b.ocr_raw || {}
    const hT = parseFloat(o.horas_trabalhadas || 0) || null
    const hI = parseFloat(o.horimetro_inicial || 0) || null
    const hF = parseFloat(o.horimetro_final   || 0) || null
    const hD = parseFloat(o.horas_disponiveis || 0) || (hI != null && hF != null ? parseFloat((hF - hI).toFixed(2)) : null)
    return { numero: b.numero, data: b.data_boletim, equipamento: (o.equipamento || '').toUpperCase(), colaborador: o.colaborador || o.operador || '—', status: b.status, hT, pct: hD && hT ? parseFloat((hT / hD * 100).toFixed(1)) : null }
  }), [boletins])

  const periodLabel = `${fmtD(dtIni)} a ${fmtD(dtFim)}`
  const cardStyle = { background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }

  const TABS = [
    { id: 'dashboard',     label: 'Dashboard',      icon: ChartBarIcon },
    { id: 'equip',         label: 'Por Equipamento', icon: WrenchScrewdriverIcon },
    { id: 'frente',        label: 'Por Frente',      icon: MapPinIcon },
    { id: 'produtividade', label: 'Produtividade',   icon: ArrowTrendingUpIcon },
    { id: 'horimetros',    label: 'Horímetros',      icon: ClockIcon },
    { id: 'boletins',      label: 'Boletins',        icon: DocumentTextIcon },
  ]

  const colsEquip = [
    { key: 'equipamento', label: 'Equipamento' },
    { key: 'modelo',      label: 'Modelo' },
    { key: 'classe',      label: 'Classe Op.' },
    { key: 'frente',      label: 'Frente' },
    { key: 'count',       label: 'Dias', align: 'center' },
    { key: 'hD', label: 'H. Disp.',  align: 'right', render: r => fmtH(r.hD), csv: r => fmtH(r.hD) },
    { key: 'hT', label: 'H. Trab.',  align: 'right', render: r => <span style={{ color: '#10b981', fontWeight: 800 }}>{fmtH(r.hT)}</span>, csv: r => fmtH(r.hT) },
    { key: 'hE', label: 'H. Espera', align: 'right', render: r => fmtH(r.hE), csv: r => fmtH(r.hE) },
    { key: 'util', label: 'Utiliz.', align: 'right', render: r => <span style={{ fontWeight: 900, color: utilColor(r.util) }}>{fmtPct(r.util)}</span>, csv: r => fmtPct(r.util) },
    { key: 'prod', label: 'Produção', align: 'right', render: r => r.prod > 0 ? `${fmtN(r.prod, 0)} ${r.un}` : '—', csv: r => r.prod > 0 ? fmtN(r.prod, 0) : '' },
  ]
  const colsFrente = [
    { key: 'frente',  label: 'Frente' },
    { key: 'equips',  label: 'Equip.', align: 'center' },
    { key: 'count',   label: 'Dias',   align: 'center' },
    { key: 'hT',      label: 'H. Trabalhadas', align: 'right', render: r => fmtH(r.hT), csv: r => fmtH(r.hT) },
    { key: 'util',    label: 'Utilização Média', align: 'right', render: r => <span style={{ fontWeight: 900, color: utilColor(r.util) }}>{fmtPct(r.util)}</span>, csv: r => fmtPct(r.util) },
    { key: 'prod',    label: 'Produção', align: 'right', render: r => r.prod > 0 ? fmtN(r.prod, 0) : '—', csv: r => r.prod > 0 ? fmtN(r.prod, 0) : '' },
  ]
  const colsProd = [
    { key: 'data',               label: 'Data',    render: r => fmtD(r.data), csv: r => fmtD(r.data) },
    { key: 'equipamento',        label: 'Equipamento' },
    { key: 'turno',              label: 'Turno',   render: r => r.turno ? r.turno.toUpperCase() : '—' },
    { key: 'atividade_realizada', label: 'Atividade', wrap: true },
    { key: 'produtividade_qtd',  label: 'Qtd.', align: 'right', render: r => r.produtividade_qtd != null ? fmtN(r.produtividade_qtd) : '—', csv: r => r.produtividade_qtd ?? '' },
    { key: 'produtividade_un',   label: 'Un.' },
    { key: 'produtividade_hora', label: 'Por Hora', align: 'right', render: r => r.produtividade_hora != null ? `${fmtN(r.produtividade_hora)} ${r.produtividade_un}/h` : '—', csv: r => r.produtividade_hora ?? '' },
    { key: 'horas_trabalhadas',  label: 'H. Trab.', align: 'right', render: r => fmtH(r.horas_trabalhadas), csv: r => r.horas_trabalhadas ?? '' },
  ]
  const colsHori = [
    { key: 'data',              label: 'Data',      render: r => fmtD(r.data), csv: r => fmtD(r.data) },
    { key: 'equipamento',       label: 'Equipamento' },
    { key: 'turno',             label: 'Turno',     render: r => r.turno ? r.turno.toUpperCase() : '—' },
    { key: 'horimetro_inicial', label: 'H. Inicial', align: 'right', render: r => fmtH(r.horimetro_inicial), csv: r => r.horimetro_inicial ?? '' },
    { key: 'horimetro_final',   label: 'H. Final',   align: 'right', render: r => fmtH(r.horimetro_final),   csv: r => r.horimetro_final ?? '' },
    { key: '_diff', label: 'Diferença', align: 'right',
      render: r => r.horimetro_inicial != null && r.horimetro_final != null ? fmtH(r.horimetro_final - r.horimetro_inicial) : '—',
      csv:    r => r.horimetro_inicial != null && r.horimetro_final != null ? (r.horimetro_final - r.horimetro_inicial).toFixed(1) : '' },
    { key: 'horas_trabalhadas', label: 'H. Trab.', align: 'right', render: r => fmtH(r.horas_trabalhadas), csv: r => r.horas_trabalhadas ?? '' },
    { key: 'porcentagem', label: 'Utiliz.', align: 'right', render: r => <span style={{ fontWeight: 900, color: utilColor(r.porcentagem) }}>{fmtPct(r.porcentagem)}</span>, csv: r => fmtPct(r.porcentagem) },
  ]
  const colsBol = [
    { key: 'numero',      label: 'Nº Boletim' },
    { key: 'data',        label: 'Data',      render: r => fmtD(r.data), csv: r => fmtD(r.data) },
    { key: 'equipamento', label: 'Equipamento' },
    { key: 'colaborador', label: 'Colaborador' },
    { key: 'status',      label: 'Status',    render: r => <StatusPill status={r.status} />, csv: r => r.status },
    { key: 'hT', label: 'H. Trab.', align: 'right', render: r => fmtH(r.hT), csv: r => fmtH(r.hT) },
    { key: 'pct', label: 'Utiliz.', align: 'right', render: r => <span style={{ fontWeight: 900, color: utilColor(r.pct) }}>{fmtPct(r.pct)}</span>, csv: r => fmtPct(r.pct) },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <Header
        title="Máquinas — Dashboard & Relatórios"
        subtitle="Análise de utilização, horímetros e produtividade"
        action={{ label: 'Atualizar', onClick: load }}
      />

      <div style={{ padding: '20px 24px' }}>

        {/* ── Filtros ── */}
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Data Início</label>
              <input type="date" className="input" style={{ fontSize: 12 }} value={dtIni} onChange={e => setDtIni(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Data Fim</label>
              <input type="date" className="input" style={{ fontSize: 12 }} value={dtFim} onChange={e => setDtFim(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Equipamento</label>
              <select className="input" style={{ fontSize: 12 }} value={fEquip} onChange={e => setFEquip(e.target.value)}>
                <option value="">Todos</option>
                {opEquip.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Frente</label>
              <select className="input" style={{ fontSize: 12 }} value={fFrente} onChange={e => setFFrente(e.target.value)}>
                <option value="">Todas</option>
                {opFrente.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Turno</label>
              <select className="input" style={{ fontSize: 12 }} value={fTurno} onChange={e => setFTurno(e.target.value)}>
                <option value="">Todos</option>
                <option value="dia">Dia</option>
                <option value="noite">Noite</option>
                <option value="integral">Integral</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={load} style={{ width: '100%', padding: '9px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <ArrowPathIcon style={{ width: 13, height: 13 }} /> Aplicar
              </button>
            </div>
          </div>
        </div>

        {/* ── Status bar + Tabs — igual CentralGerencial ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 11 }}>
            {lastUpdate && (
              <>
                <ArrowPathIcon style={{ width: 12, height: 12 }} />
                Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                &nbsp;·&nbsp;
                {loading ? 'Carregando...' : `${lancamentos.length} registros · ${boletins.length} boletins · ${kpis.equips} equipamentos`}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 11, padding: 3 }}>
            {TABS.map(t => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 8, border: 'none',
                  cursor: 'pointer', fontWeight: 700, fontSize: 11,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}>
                  <Icon style={{ width: 12, height: 12 }} />{t.label}
                </button>
              )
            })}
          </div>
        </div>

        {loading && lancamentos.length === 0 ? (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <ArrowPathIcon style={{ width: 28, height: 28, margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 14 }}>Carregando dados...</div>
          </div>
        ) : tab === 'dashboard' ? (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
              <KPICard label="Equipamentos"     value={kpis.equips}           color="#6366f1" bg="rgba(99,102,241,0.12)"   icon={WrenchScrewdriverIcon} sub={`${kpis.total} registros no período`} />
              <KPICard label="H. Disponíveis"   value={fmtH(kpis.tDisp)}      color="#8b5cf6" bg="rgba(139,92,246,0.12)"  icon={ClockIcon}             sub="total acumulado" />
              <KPICard label="H. Trabalhadas"   value={fmtH(kpis.tTrab)}      color="#10b981" bg="rgba(16,185,129,0.12)"  icon={CheckCircleIcon}       sub="produtivo efetivo" />
              <KPICard label="H. Espera/Parada" value={fmtH(kpis.tEsp)}       color="#f59e0b" bg="rgba(245,158,11,0.12)"  icon={ExclamationCircleIcon} sub="aguardando/manutenção" />
              <KPICard label="Utilização Média" value={fmtPct(kpis.utilMed)}  color={utilColor(kpis.utilMed)} bg={`${utilColor(kpis.utilMed)}1a`} icon={ChartBarIcon} sub={periodLabel} />
              {kpis.tProd > 0 && <KPICard label="Produção Total" value={`${fmtN(kpis.tProd, 0)} ${kpis.unProd}`} color="#f97316" bg="rgba(249,115,22,0.12)" icon={ArrowTrendingUpIcon} sub="acumulado período" />}
            </div>

            {/* Grid 1.55fr 1fr — igual CentralGerencial */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 12, marginBottom: 14 }}>

              {/* Ranking equipamentos */}
              <div style={cardStyle}>
                <SectionTitle label="Ranking de Utilização por Equipamento" icon={WrenchScrewdriverIcon} color="#6366f1" />
                {porEquip.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <TableCellsIcon style={{ width: 18, height: 18, color: '#6366f1' }} />
                    <span style={{ fontSize: 13, color: '#818cf8', fontWeight: 600 }}>Nenhum equipamento no período selecionado.</span>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        {['#', 'Equipamento', 'Frente', 'Dias', 'H. Trab.', 'Utilização'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: h === '#' || h === 'Dias' ? 'center' : h === 'H. Trab.' || h === 'Utilização' ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {porEquip.slice(0, 10).map((e, i) => (
                        <tr key={e.equipamento} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                          onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                          onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 900, color: i < 3 ? '#fbbf24' : 'var(--text-secondary)', fontSize: 11 }}>#{i + 1}</td>
                          <td style={{ padding: '9px 10px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {e.equipamento}
                            {e.modelo && <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 400 }}>{e.modelo}</div>}
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            {e.frente ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}>{e.frente}</span> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>{e.count}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>{fmtH(e.hT)}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                              <div style={{ width: 56, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, e.util || 0)}%`, background: utilColor(e.util), transition: 'width 0.5s' }} />
                              </div>
                              <span style={{ fontWeight: 900, color: utilColor(e.util), minWidth: 44, textAlign: 'right' }}>{fmtPct(e.util)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Coluna direita */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={cardStyle}>
                  <SectionTitle label="Por Frente de Trabalho" icon={MapPinIcon} color="#f97316" />
                  {porFrente.length === 0
                    ? <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0' }}>Sem dados de frente</div>
                    : porFrente.slice(0, 6).map(f => (
                        <BarRow key={f.frente} label={f.frente} value={f.util || 0} max={100} color={utilColor(f.util)}
                          right={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{fmtH(f.hT)}</span><span style={{ color: utilColor(f.util), fontWeight: 900, fontSize: 12 }}>{fmtPct(f.util)}</span></span>}
                        />
                      ))
                  }
                </div>
                <div style={cardStyle}>
                  <SectionTitle label="Por Turno" icon={CalendarDaysIcon} color="#8b5cf6" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                    {porTurno.map(t => (
                      <div key={t.turno} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, marginBottom: 4 }}>
                          {t.turno === 'dia' ? '☀️' : t.turno === 'noite' ? '🌙' : t.turno === 'integral' ? '🔄' : '⏱️'}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{t.turno}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{t.count} reg.</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: utilColor(t.util), marginTop: 4 }}>{fmtPct(t.util)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Tendência SVG */}
            {trendData.length >= 2 && (
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <SectionTitle label="Tendência de Utilização — últimos 30 dias" icon={ChartBarIcon} color="#6366f1" />
                  <span style={{ fontSize: 10, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-block', width: 18, height: 2, background: '#6366f1', borderRadius: 2 }} /> Utilização %
                  </span>
                </div>
                <TrendChart data={trendData} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmtD(trendData[0]?.data)}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmtD(trendData[trendData.length - 1]?.data)}</span>
                </div>
              </div>
            )}
          </>

        ) : tab === 'equip' ? (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <SectionTitle label="Relatório por Equipamento" icon={WrenchScrewdriverIcon} color="#6366f1" />
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -8 }}>{periodLabel} · {porEquip.length} equipamentos</div>
              </div>
              <ExportBtns onCSV={() => exportCSV('rel_equipamentos', colsEquip, porEquip)} onPDF={() => exportPDF('Relatório por Equipamento', periodLabel, colsEquip, porEquip)} />
            </div>
            <DataTable cols={colsEquip} rows={porEquip} emptyMsg="Nenhum equipamento no período" />
          </div>

        ) : tab === 'frente' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <SectionTitle label="Relatório por Frente de Trabalho" icon={MapPinIcon} color="#f97316" />
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -8 }}>{periodLabel} · {porFrente.length} frentes</div>
                </div>
                <ExportBtns onCSV={() => exportCSV('rel_frentes', colsFrente, porFrente)} onPDF={() => exportPDF('Relatório por Frente', periodLabel, colsFrente, porFrente, false)} />
              </div>
              <DataTable cols={colsFrente} rows={porFrente} emptyMsg="Nenhuma frente no período" />
            </div>
            {porFrente.map(f => {
              const itens = filtrados.filter(r => (r.frente || 'Sem frente') === f.frente)
              return (
                <div key={f.frente} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 18px', background: 'rgba(249,115,22,0.07)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPinIcon style={{ width: 13, height: 13, color: '#f97316' }} />
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fb923c' }}>{f.frente}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>{itens.length} registros</span>
                  </div>
                  <div style={{ padding: '0 4px' }}>
                    <DataTable cols={[
                      { key: 'data',        label: 'Data',      render: r => fmtD(r.data) },
                      { key: 'equipamento', label: 'Equipamento' },
                      { key: 'turno',       label: 'Turno',     render: r => r.turno ? r.turno.toUpperCase() : '—' },
                      { key: 'horas_trabalhadas', label: 'H. Trab.', align: 'right', render: r => <span style={{ color: '#10b981', fontWeight: 700 }}>{fmtH(r.horas_trabalhadas)}</span> },
                      { key: 'porcentagem', label: 'Utiliz.', align: 'right', render: r => <span style={{ fontWeight: 900, color: utilColor(r.porcentagem) }}>{fmtPct(r.porcentagem)}</span> },
                      { key: 'atividade_realizada', label: 'Atividade', wrap: true },
                    ]} rows={itens} />
                  </div>
                </div>
              )
            })}
          </div>

        ) : tab === 'produtividade' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 14 }}>
              <KPICard label="Produção Total"    value={`${fmtN(kpis.tProd, 0)} ${kpis.unProd}`} color="#f97316" bg="rgba(249,115,22,0.12)" icon={ArrowTrendingUpIcon} sub="acumulado no período" />
              <KPICard label="Registros c/ Dados" value={prodRows.length} color="#0ea5e9" bg="rgba(14,165,233,0.12)" icon={DocumentTextIcon} sub="com produtividade informada" />
              {prodRows.length > 0 && kpis.tProd > 0 && <KPICard label="Média por Registro" value={`${fmtN(kpis.tProd / prodRows.length, 1)} ${kpis.unProd}`} color="#8b5cf6" bg="rgba(139,92,246,0.12)" icon={ChartBarIcon} sub="média por boletim" />}
            </div>
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <SectionTitle label="Relatório de Produtividade" icon={ArrowTrendingUpIcon} color="#f97316" />
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -8 }}>{periodLabel} · {prodRows.length} registros</div>
                </div>
                <ExportBtns onCSV={() => exportCSV('rel_produtividade', colsProd, prodRows)} onPDF={() => exportPDF('Relatório de Produtividade', periodLabel, colsProd, prodRows)} />
              </div>
              <DataTable cols={colsProd} rows={prodRows} emptyMsg="Nenhum registro de produtividade no período" />
            </div>
          </>

        ) : tab === 'horimetros' ? (
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <SectionTitle label="Histórico de Horímetros" icon={ClockIcon} color="#8b5cf6" />
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -8 }}>{periodLabel} · {horiRows.length} registros</div>
              </div>
              <ExportBtns onCSV={() => exportCSV('rel_horimetros', colsHori, horiRows)} onPDF={() => exportPDF('Histórico de Horímetros', periodLabel, colsHori, horiRows)} />
            </div>
            <DataTable cols={colsHori} rows={horiRows} emptyMsg="Nenhum horímetro registrado no período" />
          </div>

        ) : tab === 'boletins' ? (
          <>
            {(() => {
              const byS = {}
              bolRows.forEach(b => { byS[b.status] = (byS[b.status] || 0) + 1 })
              return (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                  {Object.entries(byS).map(([st, n]) => {
                    const { color, label } = STATUS_CFG[st] || { color: '#6b7280', label: st }
                    return (
                      <div key={st} style={{ background: `${color}12`, border: `1px solid ${color}35`, borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color }}>{n}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <SectionTitle label="Relatório de Boletins" icon={DocumentTextIcon} color="#0ea5e9" />
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: -8 }}>{periodLabel} · {bolRows.length} boletins</div>
                </div>
                <ExportBtns onCSV={() => exportCSV('rel_boletins', colsBol, bolRows)} onPDF={() => exportPDF('Relatório de Boletins', periodLabel, colsBol, bolRows, false)} />
              </div>
              <DataTable cols={colsBol} rows={bolRows} emptyMsg="Nenhum boletim no período" />
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}