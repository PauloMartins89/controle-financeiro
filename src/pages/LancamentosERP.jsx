/**
 * LancamentosERP.jsx
 * Tela de Lançamentos no estilo ERP Operacional Robusto
 * Rota: /lancamentos-erp
 *
 * ► Dados: mesmas queries do Lancamentos.jsx (nenhuma lógica de negócio alterada)
 * ► Visual: nova camada — paleta corporativa, tabela com grupos de colunas,
 *           KPI cards, painéis inferiores (resumo, donut, atividades, atalhos)
 * ► Ações de escrita: redirecionam para /lancamentos (tela original)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { loadWorkspaceConfig, getConfig } from '../lib/workspaceConfig'
import {
  CurrencyDollarIcon, ClockIcon, CheckCircleIcon, ExclamationTriangleIcon,
  PlusIcon, MagnifyingGlassIcon, XMarkIcon, ChevronDownIcon,
  ArrowTopRightOnSquareIcon, ArrowPathIcon, DocumentTextIcon,
  SparklesIcon, Cog6ToothIcon, DocumentChartBarIcon,
  ClipboardDocumentListIcon, BoltIcon, BanknotesIcon,
  ChevronLeftIcon, ChevronRightIcon, FunnelIcon, EyeIcon,
  DocumentArrowDownIcon, ArrowDownTrayIcon, TableCellsIcon,
  PhotoIcon, UserGroupIcon, MapPinIcon, BellAlertIcon,
} from '@heroicons/react/24/outline'

// ─── PALETA ERP ───────────────────────────────────────────────────────────────
const C = {
  navy:      '#0B1F3A',
  blue:      '#1D4ED8',
  green:     '#059669',
  amber:     '#F59E0B',
  red:       '#DC2626',
  bgPage:    '#F4F6FA',
  border:    '#D8DEE9',
  text:      '#172033',
  textSec:   '#64748B',
  white:     '#FFFFFF',
  groupId:   '#1E3A5F',   // cabeçalho grupo IDENTIFICAÇÃO
  groupJorn: '#1D4ED8',   // cabeçalho grupo JORNADA
  groupVal:  '#065F46',   // cabeçalho grupo VALIDAÇÃO
  groupFin:  '#4C1D95',   // cabeçalho grupo FINANCEIRO
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function fmtDateHora(iso) {
  if (!iso) return '—'
  const dt = new Date(iso)
  return `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}
function fmtHorasDecimal(h) {
  if (!h && h !== 0) return '—'
  const total = parseFloat(h) || 0
  const hh = Math.floor(total)
  const mm = Math.round((total - hh) * 60)
  return `${hh}:${String(mm).padStart(2, '0')}`
}
function fmtHorasTotal(lancs) {
  const total = lancs.reduce((s, l) => {
    const v = parseFloat(l.dados_extras?.jornada_total_horas || l.dados_extras?.total_horas_dia || 0)
    return s + (isNaN(v) ? 0 : v)
  }, 0)
  const hh = Math.floor(total)
  const mm = Math.round((total - hh) * 60)
  return `${hh}:${String(mm).padStart(2, '0')}`
}
function fmtHorasSum(lancs, key) {
  const total = lancs.reduce((s, l) => {
    const v = parseFloat(String(l.dados_extras?.[key] || '0').replace(',', '.')) || 0
    return s + v
  }, 0)
  return fmtHorasDecimal(total)
}
function getLanNum(l) {
  const d = l.dados_extras || {}
  const num = d.numero_rdo || d.nro_boletim || d.numero_documento || d.numero_diario
  return num ? `LAN-${num}` : `LAN-${l.id.slice(0, 5).toUpperCase()}`
}
function getDocName(l) {
  if (!l.comprovante_url) return '—'
  const parts = l.comprovante_url.split('/')
  return parts[parts.length - 1]?.split('?')[0] || '—'
}
function getEmpresa(l) {
  const d = l.dados_extras || {}
  return d.empresa || d.cliente || l.descricao || '—'
}
function getSolicitante(l) {
  const d = l.dados_extras || {}
  return d.solicitante || d.condutor || '—'
}
function getEquipamento(l) {
  const d = l.dados_extras || {}
  return d.equipamento || d.placa || d.modelo_equipamento || '—'
}
function getClienteAss(l) {
  const d = l.dados_extras || {}
  const v = String(d.assinatura_cliente || '').trim()
  return v.length > 0 && v !== '—'
}
function getEmpresaAss(l) {
  const d = l.dados_extras || {}
  const v = String(d.assinatura_empresa || '').trim()
  return v.length > 0 && v !== '—'
}
function getOcrStatus(l) {
  const d = l.dados_extras || {}
  if (!d.processado_em && !d.ocr) return null
  if (l.status === 'revisar') return 'divergencia'
  return 'validado'
}

// ─── STATUS BADGE ERP ─────────────────────────────────────────────────────────
const ERP_STATUS_MAP = {
  aguardando_aprovacao: { label: 'Aguardando Aprovação',    bg: '#FFFBEB', color: '#B45309', border: '#FCD34D' },
  aprovado:             { label: 'Aprovado',                 bg: '#F0FDF4', color: '#065F46', border: '#86EFAC' },
  rascunho:             { label: 'Em Elaboração',            bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' },
  devolvido:            { label: 'Em Revisão',               bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA' },
  corrigido:            { label: 'Corrigido',                bg: '#EEF2FF', color: '#3730A3', border: '#A5B4FC' },
  faturado:             { label: 'Faturado',                 bg: '#F5F3FF', color: '#5B21B6', border: '#C4B5FD' },
  reprovado:            { label: 'Reprovado',                bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  cancelado:            { label: 'Cancelado',                bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' },
  pendente:             { label: 'Pendente de Assinatura',   bg: '#F8FAFC', color: '#64748B', border: '#CBD5E1' },
  revisar:              { label: 'Divergência OCR',          bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  pago:                 { label: 'Pago',                     bg: '#F0FDF4', color: '#065F46', border: '#86EFAC' },
}
const ERP_LOTE_MAP = {
  aprovado_cliente: { label: 'Aprovado pelo Cliente', bg: '#F0FDF4', color: '#065F46', border: '#86EFAC' },
  enviado_cliente:  { label: 'Ag. Aprovação Cliente', bg: '#FFFBEB', color: '#B45309', border: '#FCD34D' },
  recusado_cliente: { label: 'Recusado pelo Cliente', bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  rascunho:         { label: 'Em Lote',               bg: '#EEF2FF', color: '#3730A3', border: '#A5B4FC' },
}

function ErpStatusBadge({ status, loteStatus }) {
  const conf = (loteStatus && ERP_LOTE_MAP[loteStatus])
    || ERP_STATUS_MAP[status]
    || { label: status || 'Rascunho', bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
      background: conf.bg, color: conf.color,
      border: `1px solid ${conf.border}`, whiteSpace: 'nowrap',
    }}>
      {conf.label}
    </span>
  )
}

// ─── DONUT CHART (SVG) ────────────────────────────────────────────────────────
function DonutChart({ data, size = 120 }) {
  const r = size * 0.33
  const cx = size / 2, cy = size / 2
  const C = 2 * Math.PI * r
  const sw = size * 0.16
  const total = data.reduce((s, d) => s + d.value, 0)
  let cumAngle = -90
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E8F0" strokeWidth={sw} />
      {data.map((seg, i) => {
        if (!seg.value || total === 0) return null
        const frac = seg.value / total
        const segAngle = frac * 360
        const dashLen = frac * C
        const startAngle = cumAngle
        cumAngle += segAngle
        return (
          <circle key={i}
            cx={cx} cy={cy} r={r}
            fill="none" stroke={seg.color} strokeWidth={sw - 2}
            strokeDasharray={`${dashLen} ${C - dashLen}`}
            strokeDashoffset={0}
            transform={`rotate(${startAngle}, ${cx}, ${cy})`}
            strokeLinecap="butt"
          />
        )
      })}
    </svg>
  )
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color, iconBg }) {
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '10px 12px',
      borderLeft: `3px solid ${color}`,
      display: 'flex', alignItems: 'flex-start', gap: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flex: 1, minWidth: 0,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6, background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon style={{ width: 14, height: 14, color }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, lineHeight: 1, marginBottom: 2 }}>
          {value}
        </div>
        <div style={{ fontSize: 10, color: C.textSec }}>{sub}</div>
      </div>
    </div>
  )
}

// ─── DETAILS DRAWER ───────────────────────────────────────────────────────────
function DetailsDrawer({ record, lotesMap, navigate, onClose }) {
  if (!record) return null
  const d = record.dados_extras || {}
  const status = record.status
  const lote = record.lote_cliente_id ? lotesMap[record.lote_cliente_id] : null
  const loteStatus = lote?.status || null

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase',
        letterSpacing: 1, marginBottom: 10, paddingBottom: 6,
        borderBottom: `1px solid ${C.border}`,
      }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {children}
      </div>
    </div>
  )
  const Field = ({ label, value, full }) => (
    <div style={full ? { gridColumn: '1 / -1' } : {}}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: C.text, fontWeight: 600, wordBreak: 'break-word' }}>{value || '—'}</div>
    </div>
  )
  const ocrSt = getOcrStatus(record)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex' }}>
      {/* backdrop */}
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(11,31,58,0.45)' }} />
      {/* drawer */}
      <div style={{
        width: 420, background: C.white, height: '100%', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px 14px', borderBottom: `1px solid ${C.border}`,
          background: C.navy, position: 'sticky', top: 0, zIndex: 2,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>
                DETALHES DO LANÇAMENTO
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>{getLanNum(record)}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>
                {fmtDate(record.data)} · {getEmpresa(record)}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6,
              cursor: 'pointer', color: C.white, padding: 6, display: 'flex',
            }}>
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <ErpStatusBadge status={status} loteStatus={loteStatus} />
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', flex: 1 }}>

          {/* Comprovante */}
          {record.comprovante_url && (
            <div style={{ marginBottom: 20 }}>
              <a href={record.comprovante_url} target="_blank" rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                  border: `1px solid ${C.border}`, borderRadius: 8,
                  color: C.blue, fontSize: 13, fontWeight: 600, textDecoration: 'none',
                  background: '#EFF6FF',
                }}>
                <DocumentTextIcon style={{ width: 16, height: 16 }} />
                {getDocName(record)}
                <ArrowTopRightOnSquareIcon style={{ width: 13, height: 13, marginLeft: 'auto' }} />
              </a>
            </div>
          )}

          <Section title="Identificação">
            <Field label="Nº Relatório" value={d.numero_rdo || d.nro_boletim || d.numero_documento || '—'} />
            <Field label="Data" value={fmtDate(record.data)} />
            <Field label="Empresa / Cliente" value={getEmpresa(record)} full />
            <Field label="Solicitante" value={d.solicitante || '—'} />
            <Field label="Equipamento" value={d.equipamento || d.modelo_equipamento || '—'} />
            <Field label="Placa" value={d.placa || '—'} />
            <Field label="Local dos Serviços" value={d.locais_servico || d.local_servico || '—'} full />
          </Section>

          <Section title="Jornada de Trabalho">
            <Field label="Início" value={d.jornada_inicio || '—'} />
            <Field label="Fim" value={d.jornada_fim || '—'} />
            <Field label="Total de Horas" value={d.jornada_total_horas ? `${d.jornada_total_horas}h` : fmtHorasDecimal(d.total_horas_dia)} />
            <Field label="H Diurnas" value={d.horas_diurnas ? `${d.horas_diurnas}h` : '—'} />
            <Field label="H Noturnas" value={d.horas_noturnas ? `${d.horas_noturnas}h` : '—'} />
            <Field label="H FDS" value={(d.h_fds_diurnas || d.h_fds_noturnas) ? `${parseFloat(d.h_fds_diurnas||0)+parseFloat(d.h_fds_noturnas||0)}h` : '—'} />
            <Field label="H Feriado" value={(d.h_feriado_diurnas || d.h_feriado_noturnas) ? `${parseFloat(d.h_feriado_diurnas||0)+parseFloat(d.h_feriado_noturnas||0)}h` : '—'} />
          </Section>

          <Section title="Validação e Assinaturas">
            <Field label="Assinatura Cliente" value={d.assinatura_cliente || (getClienteAss(record) ? 'Confirmada' : 'Pendente')} />
            <Field label="Assinatura Empresa" value={d.assinatura_empresa || (getEmpresaAss(record) ? 'Confirmada' : 'Pendente')} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>OCR</div>
              {ocrSt === 'validado' && <span style={{ fontSize: 12, color: C.green, fontWeight: 700, background: '#F0FDF4', padding: '3px 9px', borderRadius: 4, border: '1px solid #86EFAC' }}>✓ Validado</span>}
              {ocrSt === 'divergencia' && <span style={{ fontSize: 12, color: C.red, fontWeight: 700, background: '#FEF2F2', padding: '3px 9px', borderRadius: 4, border: '1px solid #FECACA' }}>⚠ Divergência</span>}
              {!ocrSt && <span style={{ fontSize: 12, color: C.textSec }}>N/A</span>}
            </div>
            {d.processado_em && <Field label="Processado em" value={fmtDateHora(d.processado_em)} />}
          </Section>

          <Section title="Financeiro">
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>VALOR APURADO</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{fmtCurrency(record.valor)}</div>
            </div>
            <Field label="Lote" value={lote ? `${lote.cliente || ''} · ${(lote.status || '').replace(/_/g, ' ')}` : '—'} />
          </Section>

          {record.observacoes && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>OBSERVAÇÕES</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, background: '#F8FAFC', padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.border}` }}>
                {record.observacoes}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: 8,
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.textSec, cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>Fechar</button>
          <button onClick={() => { navigate('/lancamentos'); onClose() }} style={{
            flex: 2, padding: '10px', borderRadius: 8,
            background: C.navy, border: 'none',
            color: C.white, cursor: 'pointer', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <ArrowTopRightOnSquareIcon style={{ width: 15, height: 15 }} />
            Abrir em Lançamentos
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TABLE CELL HELPERS ───────────────────────────────────────────────────────
const Th = ({ children, align = 'left', width, group }) => (
  <th style={{
    padding: group ? '5px 8px' : '6px 8px',
    fontSize: group ? 9 : 10, fontWeight: 700,
    letterSpacing: group ? 0.8 : 0.4,
    color: C.white,
    textAlign: align,
    whiteSpace: 'nowrap',
    minWidth: width || 'auto',
    borderRight: `1px solid rgba(255,255,255,0.12)`,
  }}>
    {children}
  </th>
)

const Td = ({ children, align = 'left', muted, bold, green }) => (
  <td style={{
    padding: '5px 8px',
    fontSize: 11,
    color: green ? C.green : bold ? C.text : muted ? C.textSec : C.text,
    fontWeight: bold || green ? 700 : 400,
    textAlign: align,
    borderBottom: `1px solid ${C.border}`,
    borderRight: `1px solid #EEF2F7`,
    whiteSpace: 'nowrap',
  }}>
    {children}
  </td>
)

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function LancamentosERP() {
  const { workspaceId, isPlatformAdmin } = useStore()
  const navigate = useNavigate()

  // ── State ──────────────────────────────────────────────────────────────────
  const [lancamentos, setLancamentos]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [wsName, setWsName]             = useState('Workspace')
  const [tarifasMap, setTarifasMap]     = useState({})
  const [lotesMap, setLotesMap]         = useState({})
  const [eventos, setEventos]           = useState([])
  const [lastUpdate, setLastUpdate]     = useState(null)
  const competenciaAjustada             = useRef(false)

  // Filtros
  const now = new Date()
  const [competencia, setCompetencia]   = useState({ month: now.getMonth() + 1, year: now.getFullYear() })
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterForm, setFilterForm]     = useState('rdo')
  const [filterCliente, setFilterCliente] = useState('')
  const [search, setSearch]             = useState('')

  // UI
  const [page, setPage]                 = useState(1)
  const [pageSize]                      = useState(25)
  const [drawerRecord, setDrawerRecord] = useState(null)
  const [actionMenuId, setActionMenuId] = useState(null)
  const actionMenuRef                   = useRef(null)

  // ── Auth ───────────────────────────────────────────────────────────────────
  // (auth handled by router guard)

  // ── Workspace config ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) return
    loadWorkspaceConfig(workspaceId).then(cfg => {
      const df = getConfig(cfg, 'ui.lancamentos.default_filter', null)
      if (df) setFilterForm(df)
    })
    supabase?.from('workspaces').select('name').eq('id', workspaceId).maybeSingle()
      .then(({ data }) => { if (data?.name) setWsName(data.name) })
  }, [workspaceId])

  // ── Data load ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!workspaceId || !supabase) return
    setLoading(true)

    // Dispara as 3 queries em paralelo
    const mesIni = `${competenciaAjustada.current ? competencia.year : new Date().getFullYear()}-${String(competenciaAjustada.current ? competencia.month : new Date().getMonth() + 1).padStart(2, '0')}-01`
    const [{ data, error }, { data: td }, ] = await Promise.all([
      supabase
        .from('lancamentos')
        .select('id, data, created_at, status, tipo, valor, tipo_formulario, lote_cliente_id, comprovante_url, observacoes, dados_extras')
        .eq('workspace_id', workspaceId)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('diario_tarifas')
        .select('cliente_nome')
        .eq('workspace_id', workspaceId)
        .eq('ativo', true),
    ])
    if (error) { toast.error('Erro ao carregar lançamentos'); setLoading(false); return }
    const items = data || []
    setLancamentos(items)
    setLastUpdate(new Date())

    // Processa tarifas (já veio em paralelo)
    const tarifasM = {}
    ;(td || []).forEach(t => { if (t.cliente_nome) tarifasM[t.cliente_nome.toLowerCase()] = t })
    setTarifasMap(tarifasM)

    // Auto-ajusta competência para o mês mais recente com dados (só na primeira carga)
    if (items.length > 0 && !competenciaAjustada.current) {
      competenciaAjustada.current = true
      const now2 = new Date()
      const curY = now2.getFullYear(), curM = now2.getMonth() + 1
      const hasCurrentMonth = items.some(l => {
        if (!l.data) return false
        const [y, m] = l.data.split('-').map(Number)
        return y === curY && m === curM
      })
      if (!hasCurrentMonth) {
        const datesWithData = items
          .filter(l => l.data)
          .map(l => { const [y, m] = l.data.split('-').map(Number); return { year: y, month: m } })
        if (datesWithData.length > 0) {
          datesWithData.sort((a, b) => b.year - a.year || b.month - a.month)
          setCompetencia(datesWithData[0])
        }
      }
    }

    // Lotes (paralelo ao processamento dos itens)
    const loteIds = [...new Set(items.map(l => l.lote_cliente_id).filter(Boolean))]
    if (loteIds.length > 0) {
      supabase.from('lotes_cliente').select('id, cliente, status').in('id', loteIds)
        .then(({ data: ld }) => {
          const m = {}
          ;(ld || []).forEach(lt => { m[lt.id] = lt })
          setLotesMap(m)
        })
    } else setLotesMap({})

    // Eventos recentes filtrados pelo mês atual (competência)
    // (gerenciado por useEffect separado abaixo)

    setLoading(false)
  }, [workspaceId])

  // Recarrega eventos sempre que o mês ou os lançamentos mudam
  useEffect(() => {
    if (!supabase || lancamentos.length === 0) { setEventos([]); return }
    const idsDoMes = lancamentos
      .filter(l => {
        if (!l.data) return false
        const [y, m] = l.data.split('-').map(Number)
        return y === competencia.year && m === competencia.month
      })
      .map(l => l.id)
    if (idsDoMes.length === 0) { setEventos([]); return }
    supabase.from('lancamento_eventos')
      .select('*, lancamento_id')
      .in('lancamento_id', idsDoMes)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data: ev }) => setEventos(ev || []))
  }, [lancamentos, competencia]) // eslint-disable-line

  useEffect(() => { loadData() }, [loadData])

  // Fecha action menu ao clicar fora
  useEffect(() => {
    if (!actionMenuId) return
    const h = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) setActionMenuId(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [actionMenuId])

  // Auto-ajusta competência quando o tipo de formulário muda (evita mês vazio)
  useEffect(() => {
    if (lancamentos.length === 0) return
    const matchFn = (l) => {
      if (!filterForm || filterForm === 'todos') return true
      if (filterForm === 'dm') return ['diario', 'transporte'].includes(l.tipo_formulario || 'padrao')
      return (l.tipo_formulario || 'padrao') === filterForm
    }
    const hasInCurrent = lancamentos.some(l => {
      if (!matchFn(l) || !l.data) return false
      const [y, m] = l.data.split('-').map(Number)
      return y === competencia.year && m === competencia.month
    })
    if (!hasInCurrent) {
      const dates = lancamentos
        .filter(l => matchFn(l) && l.data)
        .map(l => { const [y, m] = l.data.split('-').map(Number); return { year: y, month: m } })
      if (dates.length > 0) {
        dates.sort((a, b) => b.year - a.year || b.month - a.month)
        setCompetencia(dates[0])
      }
    }
  }, [filterForm, lancamentos]) // eslint-disable-line

  // ── Filtro ─────────────────────────────────────────────────────────────────
  const filtered = lancamentos.filter(l => {
    // Período (competência)
    if (l.data) {
      const [y, m] = l.data.split('-').map(Number)
      if (y !== competencia.year || m !== competencia.month) return false
    }
    // Tipo formulário
    if (filterForm && filterForm !== 'todos') {
      if (filterForm === 'dm') {
        if (!['diario', 'transporte'].includes(l.tipo_formulario || 'padrao')) return false
      } else if ((l.tipo_formulario || 'padrao') !== filterForm) return false
    }
    // Status
    if (filterStatus && filterStatus !== 'todos' && l.status !== filterStatus) return false
    // Cliente
    if (filterCliente) {
      const empresa = getEmpresa(l).toLowerCase()
      if (!empresa.includes(filterCliente.toLowerCase())) return false
    }
    // Busca
    if (search) {
      const q = search.toLowerCase()
      const d = l.dados_extras || {}
      if (
        !getLanNum(l).toLowerCase().includes(q) &&
        !getEmpresa(l).toLowerCase().includes(q) &&
        !getSolicitante(l).toLowerCase().includes(q) &&
        !(d.placa || '').toLowerCase().includes(q) &&
        !(d.equipamento || '').toLowerCase().includes(q) &&
        !(d.numero_rdo || d.nro_boletim || '').toString().toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // ── Paginação ──────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize)
  useEffect(() => { setPage(1) }, [filterForm, filterStatus, filterCliente, search, competencia])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalReceitas     = filtered.filter(l => l.tipo === 'receita').reduce((s, l) => s + (l.valor || 0), 0)
  const totalDespesas     = filtered.filter(l => l.tipo === 'despesa').reduce((s, l) => s + (l.valor || 0), 0)
  const saldoOp           = totalReceitas - totalDespesas
  const pendentes         = filtered.filter(l => l.status === 'pendente').length
  const agAprovacao       = filtered.filter(l => l.status === 'aguardando_aprovacao' || l.status === 'corrigido').length
  const aprovados         = filtered.filter(l => {
    const lote = l.lote_cliente_id ? lotesMap[l.lote_cliente_id] : null
    return l.status === 'aprovado' || lote?.status === 'aprovado_cliente'
  }).length

  // ── Donut: distribuição de status ─────────────────────────────────────────
  const statusDist = [
    { label: 'Aprovado pelo Cliente', value: filtered.filter(l => { const lt = l.lote_cliente_id ? lotesMap[l.lote_cliente_id] : null; return lt?.status === 'aprovado_cliente' || l.status === 'aprovado' }).length, color: C.green },
    { label: 'Aguardando Aprovação',  value: agAprovacao, color: C.amber },
    { label: 'Divergência OCR',       value: filtered.filter(l => l.status === 'revisar').length, color: C.red },
    { label: 'Pendente de Assinatura',value: filtered.filter(l => l.status === 'pendente').length, color: '#94A3B8' },
    { label: 'Em Elaboração',         value: filtered.filter(l => l.status === 'rascunho').length, color: '#6366F1' },
  ]

  // ── Competência helpers ────────────────────────────────────────────────────
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  function prevCompetencia() {
    setCompetencia(c => {
      if (c.month === 1) return { month: 12, year: c.year - 1 }
      return { ...c, month: c.month - 1 }
    })
  }
  function nextCompetencia() {
    setCompetencia(c => {
      if (c.month === 12) return { month: 1, year: c.year + 1 }
      return { ...c, month: c.month + 1 }
    })
  }

  // ── Clientes únicos para filtro ───────────────────────────────────────────
  const clientesUnicos = [...new Set(lancamentos.map(l => getEmpresa(l)).filter(e => e && e !== '—'))].sort()

  // ── Render ─────────────────────────────────────────────────────────────────
  const inputSel = {
    padding: '5px 8px', borderRadius: 5, border: `1px solid ${C.border}`,
    background: C.white, color: C.text, fontSize: 12, outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div style={{ background: C.bgPage, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div style={{
        background: C.white, borderBottom: `1px solid ${C.border}`,
        padding: '0 16px', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
          {/* Título */}
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, lineHeight: 1.2 }}>
              Lançamentos Operacionais
            </div>
            <div style={{ fontSize: 11, color: C.textSec }}>
              Controle de jornadas, validação de boletins, assinaturas e valores apurados
            </div>
          </div>
          {/* Busca rápida + ações */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <MagnifyingGlassIcon style={{ width: 14, height: 14, color: C.textSec, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar nº, empresa, placa..."
                style={{ ...inputSel, paddingLeft: 28, width: 200 }}
              />
            </div>
            <button
              onClick={() => navigate('/lancamentos')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: 6, background: C.navy, border: 'none',
                color: C.white, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <ArrowTopRightOnSquareIcon style={{ width: 14, height: 14 }} />
              Versão Clássica
            </button>
          </div>
        </div>

        {/* Barra de contexto */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          height: 34, borderTop: `1px solid ${C.border}`,
          fontSize: 12, color: C.textSec,
        }}>
          {[
            ['Cliente', wsName],
            ['Workspace', wsName],
            ['Competência', `${MONTHS[competencia.month - 1]}/${competencia.year}`],
            ['Status', filterStatus === 'todos' ? 'Todos' : (ERP_STATUS_MAP[filterStatus]?.label || filterStatus)],
          ].map(([label, value], i) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              paddingRight: 16, marginRight: 16,
              borderRight: i < 3 ? `1px solid ${C.border}` : 'none',
            }}>
              <span style={{ color: C.textSec }}>{label}:</span>
              <span style={{ color: C.navy, fontWeight: 700 }}>{value}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: C.textSec, fontSize: 11 }}>
              Última atualização: {lastUpdate ? `${lastUpdate.toLocaleDateString('pt-BR')} ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '—'}
            </span>
            <button onClick={loadData} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: 2, display: 'flex' }}>
              <ArrowPathIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </div>

      {/* ══ MAIN CONTENT ════════════════════════════════════════════════════ */}
      <div style={{ padding: '12px 16px' }}>

        {/* ── KPI CARDS ────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
          <KpiCard icon={BanknotesIcon}          label="Receitas Apuradas"     value={fmtCurrency(totalReceitas)} sub="Total do período"        color={C.green}  iconBg="#F0FDF4" />
          <KpiCard icon={ArrowDownTrayIcon}      label="Despesas Lançadas"     value={fmtCurrency(totalDespesas)} sub="Total do período"        color={C.red}    iconBg="#FEF2F2" />
          <KpiCard icon={CurrencyDollarIcon}     label="Saldo Operacional"     value={fmtCurrency(saldoOp)}       sub="Receitas – Despesas"    color={C.blue}   iconBg="#EFF6FF" />
          <KpiCard icon={ExclamationTriangleIcon} label="Pendências"           value={pendentes}                  sub="Lançamentos pendentes"  color={C.amber}  iconBg="#FFFBEB" />
          <KpiCard icon={ClockIcon}              label="Aguardando Aprovação"  value={agAprovacao}                sub="Aguardando cliente"     color="#D97706"  iconBg="#FEF3C7" />
          <KpiCard icon={CheckCircleIcon}        label="Aprovados"             value={aprovados}                  sub="Aprovados pelo cliente" color={C.green}  iconBg="#F0FDF4" />
        </div>

        {/* ── FILTROS + AÇÕES ───────────────────────────────────────────── */}
        <div style={{
          background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '10px 12px', marginBottom: 10,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {/* Linha 1: filtros */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>TIPO DE DOCUMENTO</div>
              <select value={filterForm} onChange={e => setFilterForm(e.target.value)} style={inputSel}>
                <option value="rdo">Relatório Diário de Obra</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>STATUS</div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputSel}>
                <option value="todos">Todos</option>
                <option value="aguardando_aprovacao">Ag. Aprovação</option>
                <option value="aprovado">Aprovado</option>
                <option value="pendente">Pendente</option>
                <option value="rascunho">Rascunho</option>
                <option value="devolvido">Devolvido</option>
                <option value="faturado">Faturado</option>
                <option value="revisar">Divergência OCR</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>CLIENTE</div>
              <select value={filterCliente} onChange={e => setFilterCliente(e.target.value)} style={inputSel}>
                <option value="">Todos</option>
                {clientesUnicos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {/* Período */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>COMPETÊNCIA</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={prevCompetencia} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', padding: '5px 6px', color: C.textSec, display: 'flex' }}>
                  <ChevronLeftIcon style={{ width: 14, height: 14 }} />
                </button>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.navy, minWidth: 110, textAlign: 'center' }}>
                  {MONTHS[competencia.month - 1]}/{competencia.year}
                </span>
                <button onClick={nextCompetencia} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', padding: '5px 6px', color: C.textSec, display: 'flex' }}>
                  <ChevronRightIcon style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
            {/* Botões filtro */}
            <div style={{ display: 'flex', gap: 6, marginLeft: 4, alignSelf: 'flex-end' }}>
              <button
                onClick={() => { setFilterStatus('todos'); setFilterCliente(''); setSearch(''); setFilterForm('rdo') }}
                style={{ padding: '7px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
              >Limpar</button>
              <button
                onClick={loadData}
                style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: C.blue, color: C.white, fontSize: 12, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <FunnelIcon style={{ width: 13, height: 13 }} /> Filtrar
              </button>
            </div>
          </div>

          {/* Linha 2: ações operacionais */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => navigate('/lancamentos')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              <SparklesIcon style={{ width: 12, height: 12, color: '#6366F1' }} /> Digitalizar OCR
            </button>
            <button onClick={() => navigate('/lancamentos')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: 'none', background: C.blue, color: C.white, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
              <PlusIcon style={{ width: 12, height: 12 }} /> Novo Lançamento
            </button>
            <button onClick={() => navigate('/lancamentos')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.green, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              <TableCellsIcon style={{ width: 12, height: 12 }} /> Exportar Excel
            </button>
            <button onClick={() => navigate('/lancamentos')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.red, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              <DocumentArrowDownIcon style={{ width: 12, height: 12 }} /> Gerar PDF
            </button>
            <button onClick={() => navigate('/lancamentos')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              <UserGroupIcon style={{ width: 12, height: 12, color: '#6366F1' }} /> Gerar Lote
            </button>
          </div>
        </div>

        {/* ── TABELA ───────────────────────────────────────────────────── */}
        <div style={{
          background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
          overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          marginBottom: 12,
        }}>
          {/* Cabeçalho da seção */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClipboardDocumentListIcon style={{ width: 14, height: 14, color: C.navy }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>Lançamentos</span>
              <span style={{ fontSize: 11, color: C.textSec, fontWeight: 400 }}>
                ({filtered.length} registro{filtered.length !== 1 ? 's' : ''})
              </span>
            </div>
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textSec }}>
                <ArrowPathIcon style={{ width: 12, height: 12 }} /> Carregando...
              </div>
            )}
          </div>

          {/* Tabela com cabeçalhos agrupados */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'auto' }}>
              <thead>
                {/* Linha 1: grupos */}
                <tr>
                  <th colSpan={6} style={{ background: C.groupId, padding: '7px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.white, textAlign: 'center', borderRight: `1px solid rgba(255,255,255,0.2)` }}>
                    IDENTIFICAÇÃO
                  </th>
                  <th colSpan={9} style={{ background: C.groupJorn, padding: '7px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.white, textAlign: 'center', borderRight: `1px solid rgba(255,255,255,0.2)` }}>
                    JORNADA
                  </th>
                  <th colSpan={2} style={{ background: C.groupVal, padding: '7px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.white, textAlign: 'center', borderRight: `1px solid rgba(255,255,255,0.2)` }}>
                    VALIDAÇÃO
                  </th>
                  <th colSpan={3} style={{ background: C.groupFin, padding: '7px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.white, textAlign: 'center' }}>
                    FINANCEIRO
                  </th>
                </tr>
                {/* Linha 2: colunas individuais */}
                <tr style={{ background: '#1A2E4A' }}>
                  <Th width={70}>Nº</Th>
                  <Th width={90}>Data</Th>
                  <Th width={140}>Processado Em</Th>
                  <Th width={200}>Empresa</Th>
                  <Th width={140}>Solicitante</Th>
                  <Th width={120}>Equipamento</Th>
                  <Th width={70} align="center">Início da Jornada</Th>
                  <Th width={70} align="center">Fim da Jornada</Th>
                  <Th width={80} align="center">Total de Horas</Th>
                  <Th width={90} align="center">H Diurnas</Th>
                  <Th width={90} align="center">H Noturnas</Th>
                  <Th width={90} align="center">H FDS Diurnas</Th>
                  <Th width={90} align="center">H FDS Noturnas</Th>
                  <Th width={100} align="center">H Feriado Diurnas</Th>
                  <Th width={100} align="center">H Feriado Noturnas</Th>
                  <Th width={110} align="center">Cliente - Assinado</Th>
                  <Th width={110} align="center">Birigui - Assinado</Th>
                  <Th width={110} align="right">Valor (R$)</Th>
                  <Th width={160}>Status</Th>
                  <Th width={130} align="center">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={20} style={{ textAlign: 'center', padding: 48, color: C.textSec, fontSize: 13 }}>
                      Carregando lançamentos...
                    </td>
                  </tr>
                )}
                {!loading && paginated.length === 0 && (
                  <tr>
                    <td colSpan={20} style={{ textAlign: 'center', padding: 48, color: C.textSec, fontSize: 13 }}>
                      Nenhum lançamento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
                {paginated.map((l, idx) => {
                  const d = l.dados_extras || {}
                  const lote = l.lote_cliente_id ? lotesMap[l.lote_cliente_id] : null
                  const loteStatus = lote?.status || null
                  const clienteOk = getClienteAss(l)
                  const empresaOk = getEmpresaAss(l)
                  const rowBg = idx % 2 === 0 ? C.white : '#F8FAFC'
                  const isOpen = actionMenuId === l.id

                  return (
                    <tr key={l.id} style={{ background: rowBg }} onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'} onMouseLeave={e => e.currentTarget.style.background = rowBg}>
                      {/* IDENTIFICAÇÃO */}
                      <Td bold>
                        <span style={{ color: C.blue, fontSize: 11, fontWeight: 700 }}>{getLanNum(l)}</span>
                      </Td>
                      <Td muted>{fmtDate(l.data)}</Td>
                      <Td muted>{d.processado_em ? fmtDateHora(d.processado_em) : '—'}</Td>
                      <Td bold>{getEmpresa(l)}</Td>
                      <Td>{getSolicitante(l)}</Td>
                      <Td muted>{getEquipamento(l)}</Td>
                      {/* JORNADA */}}
                      <Td align="center" muted>{d.jornada_inicio || '—'}</Td>
                      <Td align="center" muted>{d.jornada_fim || '—'}</Td>
                      <Td align="center" bold>{d.jornada_total_horas ? `${d.jornada_total_horas}h` : (d.total_horas_dia ? `${d.total_horas_dia}h` : '—')}</Td>
                      <Td align="center" muted>{d.horas_diurnas ? `${d.horas_diurnas}h` : '—'}</Td>
                      <Td align="center" muted>{d.horas_noturnas ? `${d.horas_noturnas}h` : '—'}</Td>
                      <Td align="center" muted>{parseFloat(d.h_fds_diurnas || 0) > 0 ? `${d.h_fds_diurnas}h` : '—'}</Td>
                      <Td align="center" muted>{parseFloat(d.h_fds_noturnas || 0) > 0 ? `${d.h_fds_noturnas}h` : '—'}</Td>
                      <Td align="center" muted>{parseFloat(d.h_feriado_diurnas || 0) > 0 ? `${d.h_feriado_diurnas}h` : '—'}</Td>
                      <Td align="center" muted>{parseFloat(d.h_feriado_noturnas || 0) > 0 ? `${d.h_feriado_noturnas}h` : '—'}</Td>
                      {/* VALIDAÇÃO */}
                      <Td align="center">
                        {clienteOk
                          ? <span style={{ color: C.green, fontWeight: 800, fontSize: 14 }}>✓</span>
                          : <span style={{ color: '#CBD5E1', fontSize: 14 }}>—</span>}
                      </Td>
                      <Td align="center">
                        {empresaOk
                          ? <span style={{ color: C.green, fontWeight: 800, fontSize: 14 }}>✓</span>
                          : <span style={{ color: '#CBD5E1', fontSize: 14 }}>—</span>}
                      </Td>
                      {/* FINANCEIRO */}
                      <Td align="right" green bold>{fmtCurrency(l.valor)}</Td>
                      <Td>
                        <ErpStatusBadge status={l.status} loteStatus={loteStatus} />
                      </Td>
                      {/* AÇÕES */}
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, textAlign: 'center', position: 'relative' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            onClick={() => setDrawerRecord(l)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: C.white, color: C.navy, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >
                            <EyeIcon style={{ width: 13, height: 13 }} /> Ver detalhes
                          </button>
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={() => setActionMenuId(isOpen ? null : l.id)}
                              style={{ display: 'flex', alignItems: 'center', padding: '3px 4px', borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, color: C.navy, cursor: 'pointer' }}
                            >
                              <ChevronDownIcon style={{ width: 13, height: 13 }} />
                            </button>
                            {isOpen && (
                              <div ref={actionMenuRef} style={{
                                position: 'absolute', right: 0, top: '110%', zIndex: 500,
                                background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 200, overflow: 'hidden',
                              }}>
                                {[
                                  { label: 'Visualizar documento', icon: DocumentTextIcon, action: () => l.comprovante_url && window.open(l.comprovante_url, '_blank') },
                                  { label: 'Editar lançamento', icon: DocumentTextIcon, action: () => navigate('/lancamentos') },
                                  { label: 'Gerar PDF', icon: DocumentArrowDownIcon, action: () => navigate('/lancamentos') },
                                  { label: 'Adicionar ao lote', icon: UserGroupIcon, action: () => navigate('/lancamentos') },
                                  { label: 'Ver auditoria', icon: MapPinIcon, action: () => navigate('/lancamentos') },
                                ].map(item => (
                                  <button key={item.label} onClick={() => { item.action(); setActionMenuId(null) }} style={{
                                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                    padding: '10px 14px', background: 'none', border: 'none',
                                    color: C.text, fontSize: 12, cursor: 'pointer', textAlign: 'left',
                                    borderBottom: `1px solid ${C.border}`,
                                  }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                  >
                                    <item.icon style={{ width: 14, height: 14, color: C.textSec }} />
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {filtered.length > pageSize && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderTop: `1px solid ${C.border}`,
              background: '#F8FAFC', fontSize: 12, color: C.textSec,
            }}>
              <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: C.white, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
                  <ChevronLeftIcon style={{ width: 13, height: 13 }} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      style={{
                        padding: '4px 10px', borderRadius: 5, fontSize: 12,
                        border: `1px solid ${p === page ? C.blue : C.border}`,
                        background: p === page ? C.blue : C.white,
                        color: p === page ? C.white : C.text,
                        cursor: 'pointer', fontWeight: p === page ? 700 : 400,
                      }}>{p}</button>
                  )
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: C.white, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
                  <ChevronRightIcon style={{ width: 13, height: 13 }} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── PAINÉIS INFERIORES ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>

          {/* RESUMO DO PERÍODO */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ background: C.navy, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Resumo do Período</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{MONTHS[competencia.month - 1]}/{competencia.year}</div>
            </div>
            <div style={{ padding: '14px 16px' }}>
              {[
                ['Total de Lançamentos', filtered.length, null],
                ['Total de Horas Apuradas', fmtHorasTotal(filtered), null],
                ['Horas Diurnas', fmtHorasSum(filtered, 'horas_diurnas'), C.blue],
                ['Horas Noturnas', fmtHorasSum(filtered, 'horas_noturnas'), C.navy],
                ['Valor Total Apurado', fmtCurrency(filtered.reduce((s, l) => s + (l.valor || 0), 0)), C.green],
              ].map(([label, value, color]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 12, color: C.textSec }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: color || C.text }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* STATUS DOS LANÇAMENTOS */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ background: C.groupJorn, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Status dos Lançamentos</div>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flexShrink: 0 }}>
                <DonutChart data={statusDist} size={100} />
              </div>
              <div style={{ flex: 1 }}>
                {statusDist.filter(s => s.value > 0).map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: C.textSec, flex: 1 }}>{s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{s.value}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: C.textSec }}>Total</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{filtered.length} (100%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* ÚLTIMAS ATIVIDADES */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ background: C.groupVal, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Últimas Atividades</div>
            </div>
            <div style={{ padding: '10px 16px' }}>
              {eventos.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: C.textSec, fontSize: 12 }}>Nenhum evento recente</div>
              )}
              {eventos.map(ev => {
                const lanc = lancamentos.find(l => l.id === ev.lancamento_id)
                const num = lanc ? getLanNum(lanc) : ev.lancamento_id?.slice(0, 6)
                const dt = new Date(ev.created_at)
                const dtStr = `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                const label = {
                  aprovado: 'aprovado pelo cliente',
                  enviado_aprovacao: 'enviado para aprovação',
                  processado_ia: 'OCR validado automaticamente',
                  criado: 'lançamento criado',
                  editado: 'editado',
                }[ev.tipo] || ev.tipo
                return (
                  <div key={ev.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.blue }}>{num}</span>
                      <span style={{ fontSize: 12, color: C.text }}> {label}</span>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 10, color: C.textSec }}>{dtStr}</div>
                      <div style={{ fontSize: 10, color: C.textSec, opacity: 0.7 }}>{ev.usuario_nome || 'Sistema'}</div>
                    </div>
                  </div>
                )
              })}
              <button onClick={() => navigate('/lancamentos')} style={{ width: '100%', marginTop: 10, padding: '7px', border: 'none', background: 'none', color: C.blue, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                Ver todas as atividades →
              </button>
            </div>
          </div>

          {/* ATALHOS RÁPIDOS */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ background: C.groupFin, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Atalhos Rápidos</div>
            </div>
            <div style={{ padding: '8px 0' }}>
              {[
                { label: 'Modelos de Formulário',     icon: ClipboardDocumentListIcon, path: '/form-templates' },
                { label: 'Digitalizações',             icon: SparklesIcon,              path: '/boletins-diarios' },
                { label: 'Relatórios Gerenciais',      icon: DocumentChartBarIcon,      path: '/central' },
                { label: 'Auditoria de Lançamentos',   icon: BellAlertIcon,             path: '/lancamentos' },
                { label: 'Configurações do Módulo',    icon: Cog6ToothIcon,             path: '/lancamentos' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '11px 16px', background: 'none', border: 'none',
                    borderBottom: `1px solid ${C.border}`, cursor: 'pointer', gap: 10,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <item.icon style={{ width: 15, height: 15, color: C.textSec }} />
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{item.label}</span>
                  </div>
                  <ChevronRightIcon style={{ width: 14, height: 14, color: C.textSec }} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── RODAPÉ ───────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 0', borderTop: `1px solid ${C.border}`,
          fontSize: 11, color: C.textSec,
        }}>
          <span>SmartPro © 2026 — Todos os direitos reservados</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>Versão 2.5.0</span>
            <span style={{ background: '#F0FDF4', color: C.green, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Produção</span>
          </div>
        </div>
      </div>

      {/* ── DRAWER ───────────────────────────────────────────────────────── */}
      {drawerRecord && (
        <DetailsDrawer
          record={drawerRecord}
          lotesMap={lotesMap}
          navigate={navigate}
          onClose={() => setDrawerRecord(null)}
        />
      )}
    </div>
  )
}
