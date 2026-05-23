import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { toast } from 'react-hot-toast'

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtD = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const fmtH = v => v != null ? `${Number(v).toFixed(1)}h` : '—'
const fmtN = (v, dec = 2) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—'
const fmtPct = v => v != null ? `${Number(v).toFixed(1)}%` : '—'

function isoToday() { return new Date().toISOString().slice(0, 10) }
function isoMinus(n) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const UTIL_COLOR = pct => {
  if (pct == null) return '#6b7280'
  if (pct >= 90) return '#22c55e'
  if (pct >= 50) return '#eab308'
  if (pct > 0)   return '#f97316'
  return '#ef4444'
}

// ─── CSS Bar simples ─────────────────────────────────────────────────────────
function CssBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color || '#6366f1', borderRadius: 4, transition: 'width 0.4s' }} />
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = '#6366f1', border }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: `1px solid var(--border)`, borderLeft: `4px solid ${color}`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.7 }}>{sub}</div>}
    </div>
  )
}

// ─── Pill Tab ────────────────────────────────────────────────────────────────
function TabPill({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, flexWrap: 'wrap' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{ padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
            background: active === t.id ? 'var(--accent)' : 'transparent',
            color: active === t.id ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s' }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Botão Export ────────────────────────────────────────────────────────────
function ExportBar({ onCSV, onPDF }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={onCSV} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
        ⬇️ CSV
      </button>
      <button onClick={onPDF} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
        📄 PDF
      </button>
    </div>
  )
}

// ─── Tabela genérica ─────────────────────────────────────────────────────────
function DataTable({ cols, rows, emptyMsg = 'Nenhum dado' }) {
  if (!rows.length) return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: 28 }}>📋</div>
      <div style={{ marginTop: 8, fontSize: 13 }}>{emptyMsg}</div>
    </div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
            {cols.map(c => (
              <th key={c.key} style={{ padding: '10px 12px', textAlign: c.align || 'left', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 10, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {cols.map(c => (
                <td key={c.key} style={{ padding: '9px 12px', color: c.color ? c.color(row) : 'var(--text-primary)', textAlign: c.align || 'left', whiteSpace: c.wrap ? 'normal' : 'nowrap' }}>
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

// ─── Export helpers ──────────────────────────────────────────────────────────
function exportCSV(filename, cols, rows) {
  const header = cols.map(c => c.label)
  const data   = rows.map(r => cols.map(c => c.csv ? c.csv(r) : (r[c.key] ?? '')))
  const ws = XLSX.utils.aoa_to_sheet([header, ...data])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
  XLSX.writeFile(wb, `${filename}.xlsx`)
  toast.success('Arquivo exportado!')
}

function exportPDF(title, subtitle, cols, rows, landscape = false) {
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const w = landscape ? 297 : 210

  // Header
  doc.setFillColor(30, 41, 59)
  doc.rect(0, 0, w, 26, 'F')
  doc.setFillColor(99, 102, 241)
  doc.rect(0, 0, 5, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('SmartPro — Máquinas', 12, 11)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 12, 19)
  doc.setFontSize(8)
  doc.text(subtitle, w - 14, 19, { align: 'right' })
  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: 32,
    head: [cols.map(c => c.label)],
    body: rows.map(r => cols.map(c => c.csv ? c.csv(r) : (r[c.key] ?? '—'))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 10, right: 10 },
  })

  doc.setFontSize(7)
  doc.setTextColor(150)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 10, doc.internal.pageSize.height - 6)
  doc.save(`${title.replace(/\s+/g, '_')}.pdf`)
  toast.success('PDF exportado!')
}

// ════════════════════════════════════════════════════════════════════════════
// Componente principal
// ════════════════════════════════════════════════════════════════════════════
export default function MaquinasDashboard() {
  const workspaceId = useStore(s => s.workspaceId)

  // ── Filtros ──────────────────────────────────────────────────────────────
  const [dtIni, setDtIni] = useState(isoMinus(90))
  const [dtFim, setDtFim] = useState(isoToday())
  const [tab, setTab]     = useState('dashboard')
  const [loading, setLoading] = useState(true)

  // ── Dados brutos ─────────────────────────────────────────────────────────
  const [lancamentos, setLancamentos] = useState([])
  const [boletins,    setBoletins]    = useState([])
  const [totalFetched, setTotalFetched] = useState(null)

  // ── Filtros adicionais ───────────────────────────────────────────────────
  const [fEquip,  setFEquip]  = useState('')
  const [fFrente, setFFrente] = useState('')
  const [fTurno,  setFTurno]  = useState('')
  const [fClasse, setFClasse] = useState('')

  // ── Carregar dados ───────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const [lancRes, bolRes] = await Promise.all([
        supabase
          .from('lancamentos')
          .select('id, data, descricao, dados_extras, status')
          .eq('workspace_id', workspaceId)
          .eq('tipo_formulario', 'maquina')
          .gte('data', dtIni)
          .lte('data', dtFim)
          .order('data'),
        supabase
          .from('maquinas_boletins')
          .select('id, numero, status, data_boletim, recebido_em, ocr_raw')
          .eq('workspace_id', workspaceId)
          .gte('data_boletim', dtIni)
          .lte('data_boletim', dtFim)
          .order('data_boletim', { ascending: false })
          .limit(500),
      ])

      if (lancRes.error) toast.error(`Erro ao buscar lançamentos: ${lancRes.error.message}`)
      if (bolRes.error)  toast.error(`Erro ao buscar boletins: ${bolRes.error.message}`)

      const boletinsAll = bolRes.data || []
      setBoletins(boletinsAll)

      // IDs de boletins que já viraram lancamento (para evitar duplicata)
      const lancIds = new Set((lancRes.data || []).map(l => l.dados_extras?.boletim_id).filter(Boolean))

      // Boletins pendentes (sem lancamento correspondente) → pseudo-registros
      const pendentes = boletinsAll.filter(b => b.status !== 'processado' && !lancIds.has(b.id))
      const bolAsLanc = pendentes.map(bol => {
        const ocr   = bol.ocr_raw || {}
        const hTrab = parseFloat(ocr.horas_trabalhadas || ocr.horas_produtivas || 0) || null
        const hIni  = parseFloat(ocr.horimetro_inicial || 0) || null
        const hFin  = parseFloat(ocr.horimetro_final   || 0) || null
        const hDisp = parseFloat(ocr.horas_disponiveis || ocr.horas_totais || 0) ||
                      (hIni != null && hFin != null ? parseFloat((hFin - hIni).toFixed(2)) : null)
        const pct   = hDisp && hTrab ? parseFloat((hTrab / hDisp * 100).toFixed(2)) : null
        return {
          id:   `bol_${bol.id}`,
          data: bol.data_boletim || bol.recebido_em?.slice(0, 10),
          descricao: '',
          status: bol.status,
          dados_extras: {
            boletim_id:          bol.id,
            boletim_numero:      bol.numero,
            boletim_status:      bol.status,
            equipamento:         (ocr.equipamento || '').toUpperCase(),
            modelo:              ocr.modelo || '',
            classe_operacional:  ocr.classe || ocr.classe_operacional || '',
            frente:              ocr.frente || ocr.frente_de_trabalho || '',
            cdc:                 ocr.cdc || ocr.centro_de_custo || '',
            turno:               ocr.turno || '',
            colaborador:         ocr.colaborador || ocr.operador || '',
            horimetro_inicial:   hIni,
            horimetro_final:     hFin,
            horas_disponiveis:   hDisp,
            horas_trabalhadas:   hTrab,
            horas_espera:        parseFloat(ocr.horas_espera || ocr.horas_ociosas || 0) || null,
            porcentagem:         pct,
            atividade_realizada: ocr.atividade_realizada || ocr.atividade || '',
            descritivo_trabalho: ocr.descritivo_trabalho || ocr.descritivo || '',
            observacoes:         ocr.observacoes || '',
            produtividade_qtd:   parseFloat(ocr.produtividade_quantidade || ocr.produtividade || 0) || null,
            produtividade_un:    ocr.produtividade_unidade || ocr.unidade_medida || '',
            produtividade_hora:  parseFloat(ocr.produtividade_por_hora || 0) || null,
          },
        }
      })

      const merged = [...(lancRes.data || []), ...bolAsLanc]
      setLancamentos(merged)
      setTotalFetched(merged.length)
    } catch (err) {
      toast.error(`Erro inesperado: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, dtIni, dtFim])

  useEffect(() => { load() }, [load])

  // ── Normalizar registros ─────────────────────────────────────────────────
  const registros = useMemo(() => {
    return lancamentos.map(l => {
      const ex  = l.dados_extras || {}
      const ocr = ex.ocr || {}
      const hIni  = ex.horimetro_inicial ?? ocr.horimetro_inicial ?? null
      const hFin  = ex.horimetro_final   ?? ocr.horimetro_final   ?? null
      const hDisp = ex.horas_disponiveis ?? ocr.horas_disponiveis ??
        (hIni != null && hFin != null ? parseFloat((hFin - hIni).toFixed(2)) : null)
      const hTrab = ex.horas_trabalhadas ?? ocr.horas_trabalhadas ?? null
      const hEsp  = ex.horas_espera      ?? ocr.horas_espera      ?? null
      const pct   = ex.porcentagem ?? (hDisp && hTrab ? parseFloat((hTrab / hDisp * 100).toFixed(2)) : null)
      return {
        id:                  l.id,
        data:                l.data,
        equipamento:         (ex.equipamento || ocr.equipamento || '').toUpperCase().trim(),
        modelo:              ex.modelo || ocr.modelo || '',
        classe_operacional:  ex.classe_operacional || ocr.classe || ocr.classe_operacional || '',
        frente:              ex.frente || ocr.frente || '',
        cdc:                 ex.cdc || ocr.cdc || '',
        turno:               (ex.turno || ocr.turno || '').toLowerCase(),
        colaborador:         ex.colaborador || ocr.operador || ocr.colaborador || '',
        horimetro_inicial:   hIni,
        horimetro_final:     hFin,
        horas_disponiveis:   hDisp,
        horas_trabalhadas:   hTrab,
        horas_espera:        hEsp,
        porcentagem:         pct,
        atividade_realizada: ex.atividade_realizada || ocr.atividade_realizada || '',
        descritivo_trabalho: ex.descritivo_trabalho || '',
        observacoes:         ex.observacoes || '',
        produtividade_qtd:   ex.produtividade_qtd ?? null,
        produtividade_un:    ex.produtividade_un || '',
        produtividade_hora:  ex.produtividade_hora ?? null,
        boletim_id:          ex.boletim_id || null,
        boletim_numero:      ex.boletim_numero || '',
      }
    })
  }, [lancamentos])

  // ── Opções para filtros ──────────────────────────────────────────────────
  const opcoesEquip  = useMemo(() => [...new Set(registros.map(r => r.equipamento).filter(Boolean))].sort(), [registros])
  const opcoesFrente = useMemo(() => [...new Set(registros.map(r => r.frente).filter(Boolean))].sort(), [registros])
  const opcoesClasse = useMemo(() => [...new Set(registros.map(r => r.classe_operacional).filter(Boolean))].sort(), [registros])

  // ── Registros filtrados ──────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    return registros.filter(r => {
      if (fEquip  && r.equipamento         !== fEquip)  return false
      if (fFrente && r.frente              !== fFrente) return false
      if (fTurno  && r.turno               !== fTurno)  return false
      if (fClasse && r.classe_operacional  !== fClasse) return false
      return true
    })
  }, [registros, fEquip, fFrente, fTurno, fClasse])

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const equips    = new Set(filtrados.map(r => r.equipamento).filter(Boolean))
    const totalDisp = filtrados.reduce((s, r) => s + (r.horas_disponiveis || 0), 0)
    const totalTrab = filtrados.reduce((s, r) => s + (r.horas_trabalhadas || 0), 0)
    const totalEsp  = filtrados.reduce((s, r) => s + (r.horas_espera      || 0), 0)
    const pcts      = filtrados.filter(r => r.porcentagem != null).map(r => r.porcentagem)
    const utilMedia = pcts.length ? pcts.reduce((s, v) => s + v, 0) / pcts.length : null
    const totalProd = filtrados.reduce((s, r) => s + (r.produtividade_qtd || 0), 0)
    const unProd    = filtrados.find(r => r.produtividade_un)?.produtividade_un || ''
    return { equips: equips.size, totalDisp, totalTrab, totalEsp, utilMedia, totalProd, unProd, total: filtrados.length }
  }, [filtrados])

  // ── Por Equipamento ──────────────────────────────────────────────────────
  const porEquipamento = useMemo(() => {
    const map = {}
    for (const r of filtrados) {
      const k = r.equipamento || '—'
      if (!map[k]) map[k] = { equipamento: k, modelo: r.modelo, classe: r.classe_operacional, frente: r.frente, count: 0, hDisp: 0, hTrab: 0, hEsp: 0, pcts: [], prod: 0, unProd: r.produtividade_un }
      map[k].count++
      map[k].hDisp += r.horas_disponiveis || 0
      map[k].hTrab += r.horas_trabalhadas || 0
      map[k].hEsp  += r.horas_espera      || 0
      if (r.porcentagem != null) map[k].pcts.push(r.porcentagem)
      map[k].prod  += r.produtividade_qtd || 0
    }
    return Object.values(map).map(e => ({
      ...e,
      utilMedia: e.pcts.length ? e.pcts.reduce((s, v) => s + v, 0) / e.pcts.length : null,
    })).sort((a, b) => (b.utilMedia || 0) - (a.utilMedia || 0))
  }, [filtrados])

  // ── Por Frente ───────────────────────────────────────────────────────────
  const porFrente = useMemo(() => {
    const map = {}
    for (const r of filtrados) {
      const k = r.frente || 'Sem frente'
      if (!map[k]) map[k] = { frente: k, equips: new Set(), count: 0, hTrab: 0, pcts: [], prod: 0 }
      map[k].equips.add(r.equipamento)
      map[k].count++
      map[k].hTrab += r.horas_trabalhadas || 0
      if (r.porcentagem != null) map[k].pcts.push(r.porcentagem)
      map[k].prod  += r.produtividade_qtd || 0
    }
    return Object.values(map).map(f => ({
      ...f,
      equips:   f.equips.size,
      utilMedia: f.pcts.length ? f.pcts.reduce((s, v) => s + v, 0) / f.pcts.length : null,
    })).sort((a, b) => b.hTrab - a.hTrab)
  }, [filtrados])

  // ── Por Turno ────────────────────────────────────────────────────────────
  const porTurno = useMemo(() => {
    const map = {}
    for (const r of filtrados) {
      const k = r.turno || 'não informado'
      if (!map[k]) map[k] = { turno: k, count: 0, hTrab: 0, pcts: [] }
      map[k].count++
      map[k].hTrab += r.horas_trabalhadas || 0
      if (r.porcentagem != null) map[k].pcts.push(r.porcentagem)
    }
    return Object.values(map).map(t => ({
      ...t,
      utilMedia: t.pcts.length ? t.pcts.reduce((s, v) => s + v, 0) / t.pcts.length : null,
    }))
  }, [filtrados])

  // ── Produtividade ─────────────────────────────────────────────────────────
  const produtividadeRows = useMemo(() =>
    filtrados.filter(r => r.produtividade_qtd || r.produtividade_hora)
             .sort((a, b) => (b.produtividade_qtd || 0) - (a.produtividade_qtd || 0))
  , [filtrados])

  // ── Horímetros ───────────────────────────────────────────────────────────
  const horimetroRows = useMemo(() =>
    filtrados.filter(r => r.horimetro_inicial != null || r.horimetro_final != null)
             .sort((a, b) => a.data?.localeCompare(b.data) || 0)
  , [filtrados])

  // ── Boletins combinados ───────────────────────────────────────────────────
  const boletinsRows = useMemo(() => boletins.map(b => ({
    numero:       b.numero,
    data:         b.data_boletim,
    equipamento:  (b.ocr_raw?.equipamento || '').toUpperCase(),
    colaborador:  b.ocr_raw?.colaborador || b.ocr_raw?.operador || '—',
    status:       b.status,
    hTrab:        parseFloat(b.ocr_raw?.horas_trabalhadas || 0) || null,
    pct:          (() => {
      const hT = parseFloat(b.ocr_raw?.horas_trabalhadas || 0) || null
      const hI = parseFloat(b.ocr_raw?.horimetro_inicial || 0) || null
      const hF = parseFloat(b.ocr_raw?.horimetro_final   || 0) || null
      const hD = parseFloat(b.ocr_raw?.horas_disponiveis || 0) ||
                 (hI != null && hF != null ? parseFloat((hF - hI).toFixed(2)) : null)
      return hD && hT ? parseFloat((hT / hD * 100).toFixed(1)) : null
    })(),
  })), [boletins])

  // ── Colunas das tabelas ───────────────────────────────────────────────────
  const colsEquip = [
    { key: 'equipamento',  label: 'Equipamento' },
    { key: 'modelo',       label: 'Modelo' },
    { key: 'classe',       label: 'Classe Operacional' },
    { key: 'frente',       label: 'Frente' },
    { key: 'count',        label: 'Boletins', align: 'center' },
    { key: 'hDisp',  label: 'H. Disponíveis', align: 'right', render: r => fmtH(r.hDisp), csv: r => fmtH(r.hDisp) },
    { key: 'hTrab',  label: 'H. Trabalhadas', align: 'right', render: r => fmtH(r.hTrab), csv: r => fmtH(r.hTrab), color: r => '#10b981' },
    { key: 'hEsp',   label: 'H. Espera',      align: 'right', render: r => fmtH(r.hEsp),  csv: r => fmtH(r.hEsp) },
    { key: 'utilMedia', label: 'Utilização', align: 'right',
      render: r => <span style={{ fontWeight: 800, color: UTIL_COLOR(r.utilMedia) }}>{fmtPct(r.utilMedia)}</span>,
      csv: r => fmtPct(r.utilMedia) },
    { key: 'prod',   label: 'Produção', align: 'right', render: r => r.prod > 0 ? `${fmtN(r.prod, 0)} ${r.unProd}` : '—', csv: r => r.prod > 0 ? fmtN(r.prod, 0) : '' },
  ]

  const colsFrente = [
    { key: 'frente',   label: 'Frente de Trabalho' },
    { key: 'equips',   label: 'Equip.', align: 'center' },
    { key: 'count',    label: 'Boletins', align: 'center' },
    { key: 'hTrab',    label: 'H. Trabalhadas', align: 'right', render: r => fmtH(r.hTrab), csv: r => fmtH(r.hTrab) },
    { key: 'utilMedia', label: 'Utilização Média', align: 'right',
      render: r => <span style={{ fontWeight: 800, color: UTIL_COLOR(r.utilMedia) }}>{fmtPct(r.utilMedia)}</span>,
      csv: r => fmtPct(r.utilMedia) },
    { key: 'prod', label: 'Produção', align: 'right', render: r => r.prod > 0 ? fmtN(r.prod, 0) : '—', csv: r => r.prod > 0 ? fmtN(r.prod, 0) : '' },
  ]

  const colsProd = [
    { key: 'data',               label: 'Data',       render: r => fmtD(r.data), csv: r => fmtD(r.data) },
    { key: 'equipamento',        label: 'Equipamento' },
    { key: 'turno',              label: 'Turno', render: r => r.turno ? r.turno.toUpperCase() : '—' },
    { key: 'atividade_realizada', label: 'Atividade', wrap: true },
    { key: 'produtividade_qtd',  label: 'Quantidade', align: 'right', render: r => r.produtividade_qtd != null ? fmtN(r.produtividade_qtd, 2) : '—', csv: r => r.produtividade_qtd ?? '' },
    { key: 'produtividade_un',   label: 'Unidade' },
    { key: 'produtividade_hora', label: 'Por Hora', align: 'right', render: r => r.produtividade_hora != null ? `${fmtN(r.produtividade_hora, 2)} ${r.produtividade_un}/h` : '—', csv: r => r.produtividade_hora ?? '' },
    { key: 'horas_trabalhadas',  label: 'H. Trab.', align: 'right', render: r => fmtH(r.horas_trabalhadas), csv: r => fmtH(r.horas_trabalhadas) },
  ]

  const colsHori = [
    { key: 'data',                label: 'Data',            render: r => fmtD(r.data), csv: r => fmtD(r.data) },
    { key: 'equipamento',         label: 'Equipamento' },
    { key: 'turno',               label: 'Turno', render: r => r.turno ? r.turno.toUpperCase() : '—' },
    { key: 'horimetro_inicial',   label: 'H. Inicial', align: 'right', render: r => fmtH(r.horimetro_inicial), csv: r => r.horimetro_inicial ?? '' },
    { key: 'horimetro_final',     label: 'H. Final',   align: 'right', render: r => fmtH(r.horimetro_final),   csv: r => r.horimetro_final ?? '' },
    { key: '_diff',               label: 'Diferença',  align: 'right',
      render: r => r.horimetro_inicial != null && r.horimetro_final != null ? fmtH(r.horimetro_final - r.horimetro_inicial) : '—',
      csv:    r => r.horimetro_inicial != null && r.horimetro_final != null ? (r.horimetro_final - r.horimetro_inicial).toFixed(1) : '' },
    { key: 'horas_trabalhadas',   label: 'H. Trabalhadas', align: 'right', render: r => fmtH(r.horas_trabalhadas), csv: r => r.horas_trabalhadas ?? '' },
    { key: 'porcentagem',         label: 'Utilização', align: 'right',
      render: r => <span style={{ fontWeight: 800, color: UTIL_COLOR(r.porcentagem) }}>{fmtPct(r.porcentagem)}</span>,
      csv:    r => fmtPct(r.porcentagem) },
  ]

  const colsBol = [
    { key: 'numero',       label: 'Nº Boletim' },
    { key: 'data',         label: 'Data',        render: r => fmtD(r.data), csv: r => fmtD(r.data) },
    { key: 'equipamento',  label: 'Equipamento' },
    { key: 'colaborador',  label: 'Colaborador' },
    { key: 'status',       label: 'Status',
      render: r => {
        const cfg = { processado: ['#22c55e','Processado'], pendente_revisao: ['#fbbf24','Pendente Revisão'], recebido: ['#a78bfa','Recebido'], erro: ['#f87171','Erro'], processando: ['#60a5fa','Processando'] }
        const [color, label] = cfg[r.status] || ['#6b7280', r.status]
        return <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}20`, border: `1px solid ${color}50`, borderRadius: 20, padding: '2px 8px' }}>{label}</span>
      }, csv: r => r.status },
    { key: 'hTrab', label: 'H. Trabalhadas', align: 'right', render: r => fmtH(r.hTrab), csv: r => fmtH(r.hTrab) },
    { key: 'pct',   label: 'Utilização',     align: 'right',
      render: r => <span style={{ fontWeight: 800, color: UTIL_COLOR(r.pct) }}>{fmtPct(r.pct)}</span>,
      csv:    r => fmtPct(r.pct) },
  ]

  const TABS = [
    { id: 'dashboard',  label: '📊 Dashboard' },
    { id: 'equip',      label: '🚧 Por Equipamento' },
    { id: 'frente',     label: '📍 Por Frente' },
    { id: 'produtividade', label: '📦 Produtividade' },
    { id: 'horimetros', label: '⏱️ Horímetros' },
    { id: 'boletins',   label: '📋 Boletins' },
  ]

  const periodLabel = `${fmtD(dtIni)} a ${fmtD(dtFim)}`

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header title="Dashboard & Relatórios — Máquinas" />

      <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Filtros ── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Data Início</label>
              <input type="date" className="input" style={{ fontSize: 13 }} value={dtIni} onChange={e => setDtIni(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Data Fim</label>
              <input type="date" className="input" style={{ fontSize: 13 }} value={dtFim} onChange={e => setDtFim(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Equipamento</label>
              <select className="input" style={{ fontSize: 13 }} value={fEquip} onChange={e => setFEquip(e.target.value)}>
                <option value="">Todos</option>
                {opcoesEquip.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Frente</label>
              <select className="input" style={{ fontSize: 13 }} value={fFrente} onChange={e => setFFrente(e.target.value)}>
                <option value="">Todas</option>
                {opcoesFrente.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Turno</label>
              <select className="input" style={{ fontSize: 13 }} value={fTurno} onChange={e => setFTurno(e.target.value)}>
                <option value="">Todos</option>
                <option value="dia">Dia</option>
                <option value="noite">Noite</option>
                <option value="integral">Integral</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Classe Operacional</label>
              <select className="input" style={{ fontSize: 13 }} value={fClasse} onChange={e => setFClasse(e.target.value)}>
                <option value="">Todas</option>
                {opcoesClasse.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={load} style={{ width: '100%', padding: '9px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                🔍 Filtrar
              </button>
            </div>
          </div>
        </div>

        {/* ── Info bar ── */}
        {totalFetched !== null && (
          <div style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 12px' }}>
              📊 <strong style={{ color: 'var(--text-primary)' }}>{lancamentos.length}</strong> registros carregados · <strong style={{ color: 'var(--text-primary)' }}>{filtrados.length}</strong> após filtros · <strong style={{ color: 'var(--text-primary)' }}>{boletins.length}</strong> boletins no período
            </span>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ marginBottom: 16 }}>
          <TabPill tabs={TABS} active={tab} onChange={setTab} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
            <div style={{ fontWeight: 600 }}>Carregando dados...</div>
          </div>
        ) : (

          // ══════════════════════════════════════════════════════════════════
          // DASHBOARD
          // ══════════════════════════════════════════════════════════════════
          tab === 'dashboard' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                <KpiCard icon="⚙️"  label="Equipamentos"      value={kpis.equips}                          color="#6366f1" />
                <KpiCard icon="📋"  label="Total Boletins"    value={kpis.total}                           color="#0ea5e9" />
                <KpiCard icon="🕐"  label="H. Disponíveis"    value={fmtH(kpis.totalDisp)}                 color="#8b5cf6" />
                <KpiCard icon="⚙️"  label="H. Trabalhadas"    value={fmtH(kpis.totalTrab)}                 color="#10b981" />
                <KpiCard icon="⏸️"  label="H. Espera/Parada" value={fmtH(kpis.totalEsp)}                  color="#f59e0b" />
                <KpiCard icon="📈"  label="Utilização Média"  value={fmtPct(kpis.utilMedia)}               color={UTIL_COLOR(kpis.utilMedia)} sub={periodLabel} />
                {kpis.totalProd > 0 && <KpiCard icon="📦" label="Produção Total" value={`${fmtN(kpis.totalProd, 0)} ${kpis.unProd}`} color="#f97316" />}
              </div>

              {/* Ranking Equipamentos */}
              {porEquipamento.length > 0 && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>🏆 Ranking — Utilização por Equipamento</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {porEquipamento.slice(0, 10).map((e, i) => (
                      <div key={e.equipamento} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 70px', gap: 12, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? '#fbbf24' : 'var(--text-secondary)', textAlign: 'center' }}>#{i+1}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{e.equipamento}</div>
                          {e.frente && <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{e.frente}</div>}
                        </div>
                        <CssBar value={e.utilMedia || 0} max={100} color={UTIL_COLOR(e.utilMedia)} />
                        <span style={{ fontSize: 13, fontWeight: 800, color: UTIL_COLOR(e.utilMedia), textAlign: 'right' }}>{fmtPct(e.utilMedia)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Por Turno */}
              {porTurno.length > 0 && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>🌞 Resumo por Turno</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {porTurno.map(t => (
                      <div key={t.turno} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'capitalize', marginBottom: 6 }}>
                          {t.turno === 'dia' ? '☀️' : t.turno === 'noite' ? '🌙' : '🔄'} {t.turno}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.count} boletins · {fmtH(t.hTrab)} trabalhadas</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: UTIL_COLOR(t.utilMedia), marginTop: 4 }}>{fmtPct(t.utilMedia)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Por Frente resumo */}
              {porFrente.length > 0 && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>🚧 Resumo por Frente</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {porFrente.map(f => (
                      <div key={f.frente} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>{f.frente}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{f.equips} equip. · {f.count} boletins</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                          <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>{fmtH(f.hTrab)}</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: UTIL_COLOR(f.utilMedia) }}>{fmtPct(f.utilMedia)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          // ══════════════════════════════════════════════════════════════════
          // POR EQUIPAMENTO
          // ══════════════════════════════════════════════════════════════════
          ) : tab === 'equip' ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>🚧 Relatório por Equipamento</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{periodLabel} · {porEquipamento.length} equipamentos</div>
                </div>
                <ExportBar
                  onCSV={() => exportCSV('rel_equipamentos', colsEquip, porEquipamento)}
                  onPDF={() => exportPDF('Relatório por Equipamento', periodLabel, colsEquip, porEquipamento, true)}
                />
              </div>
              <DataTable cols={colsEquip} rows={porEquipamento} emptyMsg="Nenhum equipamento no período" />
            </div>

          // ══════════════════════════════════════════════════════════════════
          // POR FRENTE
          // ══════════════════════════════════════════════════════════════════
          ) : tab === 'frente' ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>📍 Relatório por Frente de Trabalho</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{periodLabel} · {porFrente.length} frentes</div>
                </div>
                <ExportBar
                  onCSV={() => exportCSV('rel_frentes', colsFrente, porFrente)}
                  onPDF={() => exportPDF('Relatório por Frente', periodLabel, colsFrente, porFrente)}
                />
              </div>
              <DataTable cols={colsFrente} rows={porFrente} emptyMsg="Nenhuma frente no período" />

              {/* Detalhes por frente */}
              {porFrente.map(f => {
                const itens = filtrados.filter(r => (r.frente || 'Sem frente') === f.frente)
                return (
                  <div key={f.frente} style={{ margin: '0 16px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                      📍 {f.frente}
                    </div>
                    <DataTable
                      cols={[
                        { key: 'data',        label: 'Data',       render: r => fmtD(r.data) },
                        { key: 'equipamento', label: 'Equipamento' },
                        { key: 'turno',       label: 'Turno',      render: r => r.turno ? r.turno.toUpperCase() : '—' },
                        { key: 'horas_trabalhadas', label: 'H. Trab.', align: 'right', render: r => fmtH(r.horas_trabalhadas) },
                        { key: 'porcentagem', label: 'Utilização', align: 'right',
                          render: r => <span style={{ fontWeight: 800, color: UTIL_COLOR(r.porcentagem) }}>{fmtPct(r.porcentagem)}</span> },
                        { key: 'atividade_realizada', label: 'Atividade', wrap: true },
                      ]}
                      rows={itens}
                    />
                  </div>
                )
              })}
            </div>

          // ══════════════════════════════════════════════════════════════════
          // PRODUTIVIDADE
          // ══════════════════════════════════════════════════════════════════
          ) : tab === 'produtividade' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* KPIs produtividade */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                <KpiCard icon="📦" label="Total Produzido"     value={`${fmtN(kpis.totalProd, 0)} ${kpis.unProd}`}   color="#f97316" />
                <KpiCard icon="📋" label="Registros c/ Prod."  value={produtividadeRows.length}                       color="#0ea5e9" />
                {produtividadeRows.length > 0 && (
                  <KpiCard icon="⚡" label="Média por Boletim"
                    value={`${fmtN(kpis.totalProd / produtividadeRows.length, 1)} ${kpis.unProd}`}
                    color="#8b5cf6" />
                )}
              </div>

              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>📦 Relatório de Produtividade</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{periodLabel} · {produtividadeRows.length} registros</div>
                  </div>
                  <ExportBar
                    onCSV={() => exportCSV('rel_produtividade', colsProd, produtividadeRows)}
                    onPDF={() => exportPDF('Relatório de Produtividade', periodLabel, colsProd, produtividadeRows, true)}
                  />
                </div>
                <DataTable cols={colsProd} rows={produtividadeRows} emptyMsg="Nenhum registro de produtividade no período" />
              </div>
            </div>

          // ══════════════════════════════════════════════════════════════════
          // HORÍMETROS
          // ══════════════════════════════════════════════════════════════════
          ) : tab === 'horimetros' ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>⏱️ Histórico de Horímetros</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{periodLabel} · {horimetroRows.length} registros</div>
                </div>
                <ExportBar
                  onCSV={() => exportCSV('rel_horimetros', colsHori, horimetroRows)}
                  onPDF={() => exportPDF('Histórico de Horímetros', periodLabel, colsHori, horimetroRows, true)}
                />
              </div>
              <DataTable cols={colsHori} rows={horimetroRows} emptyMsg="Nenhum horímetro registrado no período" />
            </div>

          // ══════════════════════════════════════════════════════════════════
          // BOLETINS
          // ══════════════════════════════════════════════════════════════════
          ) : tab === 'boletins' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Status summary */}
              {(() => {
                const byStatus = {}
                boletinsRows.forEach(b => { byStatus[b.status] = (byStatus[b.status] || 0) + 1 })
                const cfg = { processado: ['#22c55e','✅ Processado'], pendente_revisao: ['#fbbf24','⚠️ Pendente Revisão'], recebido: ['#a78bfa','📥 Recebido'], erro: ['#f87171','❌ Erro'], processando: ['#60a5fa','⚙️ Processando'] }
                return (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {Object.entries(byStatus).map(([st, n]) => {
                      const [color, label] = cfg[st] || ['#6b7280', st]
                      return (
                        <div key={st} style={{ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color }}>{n}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>📋 Relatório de Boletins</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{periodLabel} · {boletinsRows.length} boletins</div>
                  </div>
                  <ExportBar
                    onCSV={() => exportCSV('rel_boletins', colsBol, boletinsRows)}
                    onPDF={() => exportPDF('Relatório de Boletins', periodLabel, colsBol, boletinsRows)}
                  />
                </div>
                <DataTable cols={colsBol} rows={boletinsRows} emptyMsg="Nenhum boletim no período" />
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}
