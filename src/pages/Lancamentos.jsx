import { useState, useRef, useCallback, useEffect, Fragment } from 'react'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import {
  PlusIcon, DocumentArrowUpIcon, MagnifyingGlassIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon, PencilIcon,
  TrashIcon, XMarkIcon, PhotoIcon, ChevronDownIcon, FunnelIcon, ArrowsUpDownIcon,
  DocumentTextIcon, TruckIcon, SparklesIcon, ClipboardDocumentListIcon,
  Cog6ToothIcon, PhoneIcon, UserPlusIcon, QrCodeIcon,
  PaperAirplaneIcon, ArrowUturnLeftIcon, WrenchScrewdriverIcon,
  NoSymbolIcon, BanknotesIcon, ArrowPathIcon, MapPinIcon,
  BellAlertIcon, TableCellsIcon, DocumentChartBarIcon, UserGroupIcon,
  LockClosedIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIAS = [
  'Alimentação','Transporte','Saúde','Serviços','Material',
  'Equipamento','Viagem','Comunicação','Manutenção','Outros',
]

const TIPO_CORES = {
  despesa:       { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', label: 'Despesa' },
  receita:       { bg: 'rgba(16,185,129,0.12)', text: '#10b981', label: 'Receita' },
  transferencia: { bg: 'rgba(99,102,241,0.12)', text: '#818cf8', label: 'Transferência' },
}

const STATUS_CONF = {
  rascunho:             { icon: DocumentTextIcon,      color: '#94a3b8', label: 'Rascunho' },
  aguardando_aprovacao: { icon: ClockIcon,             color: '#f59e0b', label: 'Ag. Aprovação' },
  aprovado:             { icon: CheckCircleIcon,       color: '#10b981', label: 'Aprovado' },
  devolvido:            { icon: ArrowUturnLeftIcon,    color: '#f97316', label: 'Devolvido' },
  corrigido:            { icon: WrenchScrewdriverIcon, color: '#6366f1', label: 'Corrigido' },
  reprovado:            { icon: XCircleIcon,           color: '#ef4444', label: 'Reprovado' },
  cancelado:            { icon: NoSymbolIcon,          color: '#64748b', label: 'Cancelado' },
  faturado:             { icon: BanknotesIcon,         color: '#8b5cf6', label: 'Faturado' },
  // aliases legado (registros antigos no banco)
  pendente:             { icon: ClockIcon,             color: '#f59e0b', label: 'Ag. Aprovação' },
  rejeitado:            { icon: XCircleIcon,           color: '#ef4444', label: 'Reprovado' },
}

const FORM_TYPES = {
  padrao:     { label: 'Padrão',          icon: DocumentTextIcon,           moduleKey: 'lancamentos_form_padrao'     },
  transporte: { label: 'Transporte',      icon: TruckIcon,                  moduleKey: 'lancamentos_form_transporte' },
  diario:     { label: 'Diário de Campo', icon: ClipboardDocumentListIcon,  moduleKey: 'lancamentos_form_diario'     },
}

// Retorna os form types habilitados para o workspace
// enabledModules = null → sem restrição → mostra todos
// enabledModules = array → se NENHUM form_key está na lista, mostra todos (retrocompatível)
//                          se ao menos 1 form_key está, usa whitelist
function getFormTypesParaWorkspace(enabledModules) {
  if (!enabledModules) return FORM_TYPES
  const formKeys = Object.entries(FORM_TYPES).filter(([, v]) => enabledModules.includes(v.moduleKey))
  // Nenhum configurado explicitamente → retrocompatível: mostra padrão e transporte
  if (formKeys.length === 0) {
    const { diario: _d, ...resto } = FORM_TYPES
    return resto
  }
  return Object.fromEntries(formKeys)
}

const DEFAULT_KM_ROWS = [
  { tipo: 'ASFALTO', saida: '', entrada: '', total: '' },
  { tipo: 'TERRA',   saida: '', entrada: '', total: '' },
  { tipo: 'ASFALTO', saida: '', entrada: '', total: '' },
  { tipo: 'TERRA',   saida: '', entrada: '', total: '' },
  { tipo: 'ASFALTO', saida: '', entrada: '', total: '' },
  { tipo: 'TERRA',   saida: '', entrada: '', total: '' },
  { tipo: 'ASFALTO', saida: '', entrada: '', total: '' },
  { tipo: 'TERRA',   saida: '', entrada: '', total: '' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
// ── Diário de Obra: cálculo horas diurnas/noturnas ─────────────────────────
// Diurno: 05:00 – 22:00 | Noturno: 22:00 – 05:00 (configurável via tarifa)
function _parseMin(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null
  const [h, m] = hhmm.split(':').map(Number)
  if (isNaN(h)) return null
  return h * 60 + (m || 0)
}
function _intervaloHoras(startStr, endStr, dStart = 5 * 60, dEnd = 22 * 60) {
  const s = _parseMin(startStr)
  const e = _parseMin(endStr)
  if (s == null || e == null) return { diurno: 0, noturno: 0 }
  const endAdj = e <= s ? e + 1440 : e   // cruzou meia-noite
  const total  = endAdj - s
  if (total <= 0) return { diurno: 0, noturno: 0 }
  const D1 = dStart, D2 = dEnd
  const ov1 = Math.min(endAdj, D2)        - Math.max(s, D1)
  const ov2 = Math.min(endAdj, D2 + 1440) - Math.max(s, D1 + 1440)
  const diurnoMin = Math.max(0, ov1) + Math.max(0, ov2)
  return { diurno: diurnoMin / 60, noturno: Math.max(0, total - diurnoMin) / 60 }
}
function calcHorasDiurnoNoturno(linhas, dStart = 5 * 60, dEnd = 22 * 60) {
  if (!Array.isArray(linhas) || linhas.length === 0) return { diurno: null, noturno: null }
  let d = 0, n = 0, temDados = false
  for (const lj of linhas) {
    if (lj.e1 && lj.s1) { const r = _intervaloHoras(lj.e1, lj.s1, dStart, dEnd); d += r.diurno; n += r.noturno; temDados = true }
    if (lj.e2 && lj.s2) { const r = _intervaloHoras(lj.e2, lj.s2, dStart, dEnd); d += r.diurno; n += r.noturno; temDados = true }
  }
  if (!temDados) return { diurno: null, noturno: null }
  return { diurno: parseFloat(d.toFixed(2)), noturno: parseFloat(n.toFixed(2)) }
}
// ─────────────────────────────────────────────────────────────────────────────
function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function num(v) { return parseFloat(String(v || 0).replace(',', '.')) || 0 }
function calcKmTotais(d = {}) {
  const parseKm = v => { const n = parseFloat(String(v || '').replace(/[^\d.,]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n }
  const rows = (d.km_rows || []).filter(r => r.total && String(r.total).trim() !== '')
  const asfalto = rows.filter(r => r.tipo === 'ASFALTO').reduce((s, r) => s + parseKm(r.total), 0)
  const terra   = rows.filter(r => r.tipo === 'TERRA').reduce((s, r) => s + parseKm(r.total), 0)
  return { asfalto, terra, total: asfalto + terra }
}
function getValorTransporte(d = {}) { return num(d.valor_total) }

function calcPricingTotal(l, tarifasMap) {
  const d   = l.dados_extras || {}
  const ocr = l.tipo_formulario === 'diario' ? (d.ocr || {}) : {}
  const empresa = (ocr.empresa || d.empresa || d.cliente || '').trim().toLowerCase()
  let tarifa = empresa ? (tarifasMap[empresa] ?? null) : null
  if (!tarifa && empresa) {
    const found = Object.entries(tarifasMap).find(([k]) => empresa.includes(k) || k.includes(empresa))
    if (found) tarifa = found[1]
  }
  if (!tarifa) return null
  const tDs = tarifa.hora_inicio_diurno ? (_parseMin(tarifa.hora_inicio_diurno) ?? 300)  : 300
  const tDe = tarifa.hora_fim_diurno    ? (_parseMin(tarifa.hora_fim_diurno)    ?? 1320) : 1320
  let tDiurno = null, tNoturno = null
  const linhasJ = d.linhas_jornada || []
  if (linhasJ.length > 0 && linhasJ.some(lj => lj.e1 || lj.s1)) {
    ;({ diurno: tDiurno, noturno: tNoturno } = calcHorasDiurnoNoturno(linhasJ, tDs, tDe))
  } else {
    const ini = d.jornada_inicio || ocr.jornada_inicio || ocr.entrada || ''
    const fim = d.jornada_fim    || ocr.jornada_fim    || ocr.saida   || ''
    if (ini && fim) { const r = _intervaloHoras(ini, fim, tDs, tDe); tDiurno = parseFloat(r.diurno.toFixed(2)); tNoturno = parseFloat(r.noturno.toFixed(2)) }
  }
  if (tDiurno == null && tNoturno == null) {
    const hTotal = d.total_horas_dia ?? d.jornada_total_horas ?? (ocr.jornada_total_horas ? Number(ocr.jornada_total_horas) : null)
    if (hTotal != null) {
      const iniF = d.jornada_inicio || ocr.jornada_inicio || ocr.entrada || ''
      if (iniF) {
        const iniMin = _parseMin(iniF)
        if (iniMin != null) {
          const fimMin = (iniMin + Math.round(Number(hTotal) * 60)) % 1440
          const fimF   = `${String(Math.floor(fimMin / 60)).padStart(2,'0')}:${String(fimMin % 60).padStart(2,'0')}`
          const rF = _intervaloHoras(iniF, fimF, tDs, tDe)
          tDiurno = parseFloat(rF.diurno.toFixed(2)); tNoturno = parseFloat(rF.noturno.toFixed(2))
        }
      }
      if (tDiurno == null) { tDiurno = Number(hTotal); tNoturno = 0 }
    }
  }
  const rsDiurno  = tDiurno  != null && tarifa.valor_hora_diurno  != null ? tDiurno  * Number(tarifa.valor_hora_diurno)  : null
  const rsNoturno = tNoturno != null && tarifa.valor_hora_noturno != null ? tNoturno * Number(tarifa.valor_hora_noturno) : null
  if (rsDiurno == null && rsNoturno == null) return null
  return (rsDiurno ?? 0) + (rsNoturno ?? 0)
}

function mergeKmRows(ocrRows) {
  const base = DEFAULT_KM_ROWS.map(r => ({ ...r }))
  if (!ocrRows || !ocrRows.length) return base
  ocrRows.forEach((row, i) => { if (i < base.length) base[i] = { ...base[i], ...row } })
  return base
}

async function registrarEvento({ lancamentoId, tipo, statusDe = null, statusPara = null, descricao = null, usuarioId = null, usuarioNome = null, dados = {} }) {
  if (!lancamentoId || !supabase) return
  await supabase.from('lancamento_eventos').insert({
    lancamento_id: lancamentoId,
    tipo,
    status_de:    statusDe,
    status_para:  statusPara,
    descricao,
    usuario_id:   usuarioId,
    usuario_nome: usuarioNome,
    dados,
  })
}

// Configuração visual dos eventos na linha do tempo
const EVENTO_CONF = {
  criado:             { icon: DocumentTextIcon,      color: '#6366f1', label: 'Lançamento criado',          bg: 'rgba(99,102,241,0.12)' },
  recebido_whatsapp:  { icon: PhoneIcon,             color: '#25d366', label: 'Recebido via WhatsApp',      bg: 'rgba(37,211,102,0.12)' },
  processado_ia:      { icon: SparklesIcon,          color: '#818cf8', label: 'Processado pela IA',         bg: 'rgba(129,140,248,0.12)' },
  editado:            { icon: PencilIcon,            color: '#94a3b8', label: 'Editado',                    bg: 'rgba(148,163,184,0.12)' },
  enviado_aprovacao:  { icon: PaperAirplaneIcon,     color: '#f59e0b', label: 'Enviado para aprovação',     bg: 'rgba(245,158,11,0.12)' },
  aprovado:           { icon: CheckCircleIcon,       color: '#10b981', label: 'Aprovado',                   bg: 'rgba(16,185,129,0.12)' },
  devolvido:          { icon: ArrowUturnLeftIcon,    color: '#f97316', label: 'Devolvido para correção',    bg: 'rgba(249,115,22,0.12)' },
  corrigido:          { icon: WrenchScrewdriverIcon, color: '#6366f1', label: 'Corrigido e reenviado',      bg: 'rgba(99,102,241,0.12)' },
  reprovado:          { icon: XCircleIcon,           color: '#ef4444', label: 'Reprovado',                  bg: 'rgba(239,68,68,0.12)' },
  cancelado:          { icon: NoSymbolIcon,          color: '#64748b', label: 'Cancelado',                  bg: 'rgba(100,116,139,0.12)' },
  faturado:           { icon: BanknotesIcon,         color: '#8b5cf6', label: 'Faturado',                   bg: 'rgba(139,92,246,0.12)' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Chips
// ─────────────────────────────────────────────────────────────────────────────
const LOTE_STATUS_CONF = {
  rascunho:          { icon: UserGroupIcon,      color: '#6366f1', label: 'Em Lote' },
  enviado_cliente:   { icon: ClockIcon,          color: '#f59e0b', label: 'Ag. Aprovação Cliente' },
  aprovado_cliente:  { icon: CheckCircleIcon,    color: '#10b981', label: 'Aprovado pelo Cliente' },
  recusado_cliente:  { icon: XCircleIcon,        color: '#ef4444', label: 'Recusado pelo Cliente' },
}

function StatusChip({ status, lote }) {
  const loteConf = lote ? LOTE_STATUS_CONF[lote.status] : null
  const conf = loteConf || STATUS_CONF[status] || STATUS_CONF.rascunho
  const Icon = conf.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${conf.color}20`, color: conf.color }}>
      <Icon style={{ width: 12, height: 12 }} />{conf.label}
    </span>
  )
}
function TipoChip({ tipo }) {
  const conf = TIPO_CORES[tipo] || TIPO_CORES.despesa
  return <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: conf.bg, color: conf.text }}>{conf.label}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulário de Transporte — DIÁRIO DO MOTORISTA (Casagrande)
// ─────────────────────────────────────────────────────────────────────────────
function FormTransporte({ dados, onChange }) {
  const set = (k, v) => onChange({ ...dados, [k]: v })
  const kmRows = (dados.km_rows && dados.km_rows.length === 8) ? dados.km_rows : mergeKmRows(dados.km_rows)

  function setKmRow(i, field, val) {
    const rows = kmRows.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
    if (field === 'saida' || field === 'entrada') {
      const s = num(field === 'saida' ? val : rows[i].saida)
      const e = num(field === 'entrada' ? val : rows[i].entrada)
      if (s > 0 && e > 0) rows[i] = { ...rows[i], total: String(Math.abs(e - s)) }
    }
    onChange({ ...dados, km_rows: rows })
  }

  const cellInp = (val, onChg, opts = {}) => (
    <input
      type={opts.type || 'text'}
      value={val ?? ''}
      onChange={e => onChg(e.target.value)}
      placeholder={opts.placeholder || ''}
      style={{
        width: '100%', padding: '5px 6px', borderRadius: 5,
        background: 'var(--bg-primary)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', fontSize: 12, outline: 'none',
        boxSizing: 'border-box', textAlign: opts.align || 'left',
      }}
    />
  )

  const fieldInp = (label, key, opts = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      <input
        type={opts.type || 'text'}
        placeholder={opts.placeholder || ''}
        value={dados[key] ?? ''}
        onChange={e => set(key, e.target.value)}
        style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
      />
    </div>
  )

  return (
    <div>
      {/* Cabeçalho: DIÁRIO DO MOTORISTA + Nº */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TruckIcon style={{ width: 18, height: 18, color: '#818cf8' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#818cf8', letterSpacing: 0.5 }}>DIÁRIO DO MOTORISTA</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Nº</span>
          <input
            value={dados.numero_diario ?? ''}
            onChange={e => set('numero_diario', e.target.value)}
            placeholder="00000"
            style={{ width: 88, padding: '5px 8px', borderRadius: 6, background: 'var(--bg-primary)', border: '2px solid rgba(99,102,241,0.4)', color: '#818cf8', fontSize: 15, fontWeight: 800, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Empresa / Setor */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Empresa', 'empresa')}
        {fieldInp('Setor', 'setor')}
      </div>
      {/* Cliente / Tipo Atendimento / Módulo */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Cliente', 'cliente')}
        {fieldInp('Tipo Atend.', 'tipo_atendimento', { placeholder: 'PLATAFORMA' })}
        {fieldInp('Módulo', 'modulo')}
      </div>
      {/* Solicitante / CC */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Solicitante', 'solicitante')}
        {fieldInp('CC', 'cc')}
      </div>
      {/* Condutor / Tipo Material / KM Inicial / KM Final */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Condutor', 'condutor')}
        {fieldInp('Tipo Material', 'tipo_material')}
        {fieldInp('KM Inicial', 'km_inicial', { type: 'number' })}
        {fieldInp('KM Final', 'km_final', { type: 'number' })}
      </div>
      {/* Origem / Destino */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Local de Origem', 'local_origem')}
        {fieldInp('Local de Destino', 'local_destino')}
      </div>
      {/* Equipamento / Viagens */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 10, marginBottom: 14 }}>
        {fieldInp('Equipamento', 'equipamento')}
        {fieldInp('Viagens', 'viagens', { type: 'number', placeholder: '1' })}
      </div>

      {/* Tabela KM/HORAS */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
        {/* Cabeçalho da tabela */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', background: 'rgba(0,0,0,0.05)', borderBottom: '1px solid var(--border)' }}>
          {['KM/HORAS', 'SAÍDA', 'ENTRADA', 'TOTAL/KM'].map(h => (
            <div key={h} style={{ padding: '7px 8px', fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'center', letterSpacing: 0.5 }}>{h}</div>
          ))}
        </div>

        {/* Linhas ASFALTO / TERRA */}
        {kmRows.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', borderBottom: '1px solid var(--border)', background: row.tipo === 'ASFALTO' ? 'rgba(99,102,241,0.04)' : 'rgba(245,158,11,0.04)' }}>
            <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: row.tipo === 'ASFALTO' ? '#818cf8' : '#f59e0b', letterSpacing: 0.5 }}>{row.tipo}</span>
            </div>
            <div style={{ padding: '4px 6px' }}>{cellInp(row.saida,   v => setKmRow(i, 'saida',   v), { align: 'center', placeholder: '—' })}</div>
            <div style={{ padding: '4px 6px' }}>{cellInp(row.entrada, v => setKmRow(i, 'entrada', v), { align: 'center', placeholder: '—' })}</div>
            <div style={{ padding: '4px 6px' }}>{cellInp(row.total,   v => setKmRow(i, 'total',   v), { align: 'center', placeholder: '—' })}</div>
          </div>
        ))}

        {/* HORAS 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', borderBottom: '1px solid var(--border)', background: 'rgba(16,185,129,0.04)' }}>
          <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', letterSpacing: 0.5 }}>HORAS</span>
          </div>
          <div style={{ padding: '4px 6px', gridColumn: 'span 2' }}>{cellInp(dados.horas_1_desc, v => set('horas_1_desc', v), { placeholder: 'Descrição' })}</div>
          <div style={{ padding: '4px 6px' }}>{cellInp(dados.horas_1, v => set('horas_1', v), { align: 'center', placeholder: '—' })}</div>
        </div>

        {/* HORAS 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', borderBottom: '1px solid var(--border)', background: 'rgba(16,185,129,0.04)' }}>
          <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', letterSpacing: 0.5 }}>HORAS</span>
          </div>
          <div style={{ padding: '4px 6px', gridColumn: 'span 2' }}>{cellInp(dados.horas_2_desc, v => set('horas_2_desc', v), { placeholder: 'Descrição' })}</div>
          <div style={{ padding: '4px 6px' }}>{cellInp(dados.horas_2, v => set('horas_2', v), { align: 'center', placeholder: '—' })}</div>
        </div>

        {/* DIÁRIAS */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', background: 'rgba(239,68,68,0.04)' }}>
          <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', letterSpacing: 0.5 }}>DIÁRIAS</span>
          </div>
          <div style={{ padding: '4px 6px', gridColumn: 'span 3' }}>{cellInp(dados.diarias, v => set('diarias', v), { placeholder: '—' })}</div>
        </div>
      </div>

      {/* VALOR R$ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16,185,129,0.08)', border: '2px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>VALOR R$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={dados.valor_total ?? ''}
          onChange={e => set('valor_total', e.target.value)}
          placeholder="0,00"
          style={{ width: 140, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '2px solid rgba(16,185,129,0.4)', color: '#10b981', fontSize: 18, fontWeight: 800, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }}
        />
      </div>

      {/* Placa / Veículo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {fieldInp('Placa', 'placa', { placeholder: 'AAA0000' })}
        {fieldInp('Veículo', 'veiculo')}
      </div>

      {/* ── Composição do Valor ── */}
      <div style={{ padding: '6px 10px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Composição do Valor</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Horas em Espera', 'horas_espera', { type: 'number', placeholder: '0' })}
        {fieldInp('R$ Unit. Espera', 'valor_unit_espera', { type: 'number', placeholder: '0,00' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Horas Trabalhadas', 'horas_trabalhadas', { type: 'number', placeholder: '0' })}
        {fieldInp('R$ Unit. H. Trabalhadas', 'valor_unit_horas', { type: 'number', placeholder: '0,00' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('KM Rodado Projeto', 'km_projeto', { type: 'number', placeholder: '0' })}
        {fieldInp('R$ Unit. KM Projeto', 'valor_unit_km_projeto', { type: 'number', placeholder: '0,00' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('KM Deslocamento', 'km_deslocamento', { type: 'number', placeholder: '0' })}
        {fieldInp('R$ Unit. KM Desloc.', 'valor_unit_km_deslocamento', { type: 'number', placeholder: '0,00' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {fieldInp('Pedágio', 'pedagio', { type: 'number', placeholder: '0,00' })}
        {fieldInp('Escolta', 'escolta', { type: 'number', placeholder: '0,00' })}
      </div>

      {/* ── Documentos Fiscais ── */}
      <div style={{ padding: '6px 10px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border)', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Documentos Fiscais</span>
      </div>
      <div style={{ marginBottom: 10 }}>
        {fieldInp('Nota Fiscal', 'nota_fiscal')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('CTE Inicial', 'cte_inicial')}
        {fieldInp('Valor CTE (R$)', 'valor_cte', { type: 'number', placeholder: '0,00' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        {fieldInp('CTE Complementar', 'cte_complementar')}
        {fieldInp('Valor CTE Compl. (R$)', 'valor_cte_complementar', { type: 'number', placeholder: '0,00' })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal principal — cria / edita lançamento
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Renderizador dinâmico de campos de template — usado no modal de edição
// ─────────────────────────────────────────────────────────────────────────────
function TemplateCamposRenderer({ campos, dados, onChange }) {
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const set = (key, val) => onChange(prev => ({ ...prev, [key]: val }))

  // Agrupa campos por seção
  const sections = []
  const sectionMap = {}
  ;(campos || []).forEach(c => {
    const sec = c.section || ''
    if (!sectionMap[sec]) { sectionMap[sec] = []; sections.push(sec) }
    sectionMap[sec].push(c)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sections.map(sec => (
        <div key={sec}>
          {sec && (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(99,102,241,0.18)' }}>
              {sec}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {sectionMap[sec].map(c => {
              const val = dados[c.key] ?? ''
              const options = typeof c.options === 'string'
                ? c.options.split(',').map(o => o.trim()).filter(Boolean)
                : (Array.isArray(c.options) ? c.options : [])
              return (
                <div key={c.key} style={{ gridColumn: c.width === 'half' ? 'span 1' : 'span 2' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                    {c.label.toUpperCase()}{c.required && <span style={{ color: '#f87171' }}> *</span>}
                  </label>
                  {c.type === 'textarea' ? (
                    <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={val} placeholder={c.ocr_hint || ''} onChange={e => set(c.key, e.target.value)} />
                  ) : c.type === 'checkbox' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 4 }}>
                      <input type="checkbox" checked={!!val} onChange={e => set(c.key, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#6366f1' }} />
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{val ? 'Sim' : 'Não'}</span>
                    </label>
                  ) : c.type === 'select' && options.length > 0 ? (
                    <select style={inputStyle} value={val} onChange={e => set(c.key, e.target.value)}>
                      <option value="">Selecione...</option>
                      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      style={inputStyle}
                      type={c.type === 'date' ? 'date' : c.type === 'number' ? 'number' : 'text'}
                      value={val}
                      placeholder={c.ocr_hint || ''}
                      onChange={e => set(c.key, e.target.value)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function LancamentoModal({ item, workspaceId, userId, enabledModules, formTemplates, onClose, onSaved }) {
  const formTypesDisponiveis = getFormTypesParaWorkspace(enabledModules)
  const [tipoForm, setTipoForm] = useState(() => {
    const prev = item?.tipo_formulario || 'padrao'
    return formTypesDisponiveis[prev] ? prev : Object.keys(formTypesDisponiveis)[0]
  })
  const [form, setForm] = useState({
    tipo: 'receita',
    descricao: '',
    valor: '',
    data: new Date().toISOString().slice(0, 10),
    categoria: 'Transporte',
    centro_custo: '',
    status: 'rascunho',
    comprovante_url: '',
    observacoes: '',
    ...item,
    valor: item?.valor != null ? String(item.valor) : '',
  })
  const [dadosExtras, setDadosExtras] = useState(item?.dados_extras || {})
  const [saving, setSaving] = useState(false)
  const formTemplate = (formTemplates || {})[tipoForm] || null
  const [uploadingImg, setUploadingImg] = useState(false)
  const fileRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (tipoForm === 'transporte') {
      const total = getValorTransporte(dadosExtras)
      setForm(f => ({ ...f, valor: String(total.toFixed(2)), tipo: 'receita' }))
    }
  }, [dadosExtras.valor_total, tipoForm])

  async function handleUpload(file) {
    if (!file || !supabase) return
    setUploadingImg(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `lancamentos/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('comprovantes').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: pub } = supabase.storage.from('comprovantes').getPublicUrl(path)
      set('comprovante_url', pub.publicUrl)
      toast.success('Comprovante anexado')
    } catch (e) {
      toast.error('Erro ao enviar imagem: ' + e.message)
    } finally {
      setUploadingImg(false)
    }
  }

  async function handleSave(statusOverride) {
    const valorFinal = tipoForm === 'transporte'
      ? getValorTransporte(dadosExtras)
      : parseFloat(String(form.valor).replace(',', '.'))
    if (isNaN(valorFinal) || valorFinal < 0) { toast.error('Valor inválido'); return }

    const d = dadosExtras
    const descricaoFinal = form.descricao.trim() || (tipoForm === 'transporte'
      ? `Nº ${d.numero_diario || '—'} | ${d.empresa || ''} | ${d.local_origem || ''} → ${d.local_destino || ''}`.trim()
      : '')
    if (!descricaoFinal) { toast.error('Informe a descrição'); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        status: statusOverride || form.status,
        descricao: descricaoFinal,
        valor: valorFinal,
        tipo_formulario: tipoForm,
        dados_extras: dadosExtras,
        workspace_id: workspaceId,
        user_id: userId,
      }
      delete payload.id
      if (item?.id) {
        // Detecta campos alterados para registrar no evento
        const camposAlterados = []
        const camposVisiveis = {
          descricao: 'Descrição',
          categoria: 'Categoria',
          centro_custo: 'Centro de Custo',
          observacoes: 'Observações',
        }
        Object.entries(camposVisiveis).forEach(([k, label]) => {
          const anterior = String(item[k] || '')
          const novo = String(payload[k] || '')
          if (anterior !== novo) camposAlterados.push({ campo: label, de: anterior || '—', para: novo || '—' })
        })
        // dados_extras: verifica origem e destino
        const extrasCampos = { local_origem: 'Origem', local_destino: 'Destino', placa: 'Placa', condutor: 'Condutor' }
        const itExtras = item?.dados_extras || {}
        Object.entries(extrasCampos).forEach(([k, label]) => {
          const anterior = String(itExtras[k] || '')
          const novo = String(dadosExtras[k] || '')
          if (anterior !== novo) camposAlterados.push({ campo: label, de: anterior || '—', para: novo || '—' })
        })

        // Se estava devolvido, ao editar volta automaticamente para aguardando_aprovacao
        const eraDevolvido = item.status === 'devolvido'
        if (eraDevolvido) payload.status = 'aguardando_aprovacao'

        const { error } = await supabase.from('lancamentos').update(payload).eq('id', item.id)
        if (error) throw error

        if (eraDevolvido) {
          // Registra evento de correção com histórico
          await registrarEvento({
            lancamentoId: item.id,
            tipo: 'corrigido',
            statusDe: 'devolvido',
            statusPara: 'aguardando_aprovacao',
            descricao: 'Lançamento corrigido pelo analista e reenviado para Faturamento.',
            usuarioId: userId,
            dados: { campos_alterados: camposAlterados },
          })
          // Alerta WA notify
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lancamentoId: item.id, status: 'corrigido', motivo: 'Lançamento corrigido e reenviado para Faturamento.' }),
          }).catch(() => {})
        } else {
          await registrarEvento({ lancamentoId: item.id, tipo: 'editado', usuarioId: userId, dados: { campos_alterados: camposAlterados } })
        }
      } else {
        const { data: inserted, error } = await supabase.from('lancamentos').insert(payload).select('id').single()
        if (error) throw error
        const tipoEvento = statusOverride === 'aguardando_aprovacao' ? 'enviado_aprovacao' : 'criado'
        await registrarEvento({
          lancamentoId: inserted.id,
          tipo: tipoEvento,
          statusPara: statusOverride || form.status || 'rascunho',
          usuarioId: userId,
        })
      }
      toast.success(item?.id ? (item.status === 'devolvido' ? 'Corrigido e reenviado para Faturamento!' : 'Lançamento atualizado!') : statusOverride === 'aguardando_aprovacao' ? 'Enviado para aprovação!' : 'Rascunho salvo!')
      onSaved()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: tipoForm === 'transporte' ? 680 : 540, maxHeight: '92vh', overflowY: 'auto', padding: 28 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {item?.id ? (item.status === 'devolvido' ? '🔧 Corrigir Lançamento' : 'Editar Lançamento') : 'Novo Lançamento'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <XMarkIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>

        {/* Banner: item devolvido */}
        {item?.status === 'devolvido' && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.35)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <ArrowUturnLeftIcon style={{ width: 18, height: 18, color: '#f97316', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f97316' }}>Item devolvido para correção</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Após corrigir, clique em <strong>"Salvar alterações"</strong> — o item será reenviado automaticamente para o Faturamento.</div>
            </div>
          </div>
        )}

        {/* Seletor de tipo de formulário */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>TIPO DE FORMULÁRIO</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(formTypesDisponiveis).map(([k, v]) => {
              const Icon = v.icon
              return (
                <button key={k} onClick={() => setTipoForm(k)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '9px 12px', borderRadius: 9,
                  border: `2px solid ${tipoForm === k ? '#6366f1' : 'var(--border)'}`,
                  background: tipoForm === k ? 'rgba(99,102,241,0.1)' : 'transparent',
                  color: tipoForm === k ? '#818cf8' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700,
                }}>
                  <Icon style={{ width: 16, height: 16 }} />{v.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── FORMULÁRIO PADRÃO ── */}
        {tipoForm === 'padrao' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>TIPO</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {Object.entries(TIPO_CORES).map(([k, v]) => (
                  <button key={k} onClick={() => set('tipo', k)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${form.tipo === k ? v.text : 'var(--border)'}`, background: form.tipo === k ? v.bg : 'transparent', color: form.tipo === k ? v.text : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>{v.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>DESCRIÇÃO *</label>
              <input style={inputStyle} placeholder="Ex: Compra de material de escritório" value={form.descricao} onChange={e => set('descricao', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>VALOR (R$) *</label>
                <input style={inputStyle} type="number" min="0" step="0.01" placeholder="0,00" value={form.valor} onChange={e => set('valor', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>DATA</label>
                <input style={inputStyle} type="date" value={form.data} onChange={e => set('data', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>CATEGORIA</label>
                <select style={inputStyle} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>CENTRO DE CUSTO</label>
                <input style={inputStyle} placeholder="Ex: Administrativo" value={form.centro_custo} onChange={e => set('centro_custo', e.target.value)} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>STATUS</label>
              <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.entries(STATUS_CONF).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>COMPROVANTE</label>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0])} />
              {form.comprovante_url ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={form.comprovante_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                  <button onClick={() => set('comprovante_url', '')} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remover</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={uploadingImg} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, width: '100%', justifyContent: 'center' }}>
                  <PhotoIcon style={{ width: 16, height: 16 }} />
                  {uploadingImg ? 'Enviando...' : 'Anexar imagem'}
                </button>
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>OBSERVAÇÕES</label>
              <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} placeholder="Informações adicionais..." value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
            </div>
          </div>
        )}

        {/* ── FORMULÁRIO TRANSPORTE ── */}
        {tipoForm === 'transporte' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>DATA</label>
                <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={{ ...inputStyle, padding: '9px 10px' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>STATUS</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} style={{ ...inputStyle, padding: '9px 10px' }}>
                  {Object.entries(STATUS_CONF).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            {formTemplate?.campos?.length > 0
              ? <TemplateCamposRenderer campos={formTemplate.campos} dados={dadosExtras} onChange={setDadosExtras} />
              : <FormTransporte dados={dadosExtras} onChange={setDadosExtras} />
            }
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>OBSERVAÇÕES</label>
              <textarea style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} placeholder="Observações adicionais..." value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cancelar</button>
          <button onClick={() => handleSave()} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {saving ? 'Salvando...' : item?.id ? 'Salvar alterações' : 'Salvar Rascunho'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Rota do Lançamento
// ─────────────────────────────────────────────────────────────────────────────
function RotaModal({ lancamento, onClose }) {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lancamento?.id || !supabase) return
    setLoading(true)
    supabase
      .from('lancamento_eventos')
      .select('*')
      .eq('lancamento_id', lancamento.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setEventos(data || []); setLoading(false) })
  }, [lancamento?.id])

  if (!lancamento) return null

  const d = lancamento.dados_extras || {}
  const isTransporte = lancamento.tipo_formulario === 'transporte'

  function fmtHora(iso) {
    if (!iso) return ''
    const dt = new Date(iso)
    return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  function fmtDataHora(iso) {
    if (!iso) return ''
    const dt = new Date(iso)
    const hoje = new Date()
    const isHoje = dt.toDateString() === hoje.toDateString()
    const data = isHoje ? 'Hoje' : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    return `${data} · ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }

  const infoStyle  = { display: 'flex', flexDirection: 'column', gap: 2 }
  const labelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.8, textTransform: 'uppercase' }
  const valueStyle = { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header fixo ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 2, borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPinIcon style={{ width: 20, height: 20, color: '#818cf8' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Rota do Lançamento</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {isTransporte ? `Nº ${d.numero_diario || '—'}` : (lancamento.descricao || '—')}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, borderRadius: 6, display: 'flex' }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Resumo ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--bg-primary)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
            {isTransporte ? (
              <>
                <div style={infoStyle}><span style={labelStyle}>Origem</span><span style={valueStyle}>{d.local_origem || '—'}</span></div>
                <div style={infoStyle}><span style={labelStyle}>Destino</span><span style={valueStyle}>{d.local_destino || '—'}</span></div>
                <div style={infoStyle}><span style={labelStyle}>Condutor</span><span style={valueStyle}>{d.condutor || '—'}</span></div>
                <div style={infoStyle}><span style={labelStyle}>Placa</span><span style={valueStyle}>{d.placa || '—'}</span></div>
              </>
            ) : (
              <>
                <div style={{ ...infoStyle, gridColumn: '1 / -1' }}><span style={labelStyle}>Descrição</span><span style={valueStyle}>{lancamento.descricao || '—'}</span></div>
                <div style={infoStyle}><span style={labelStyle}>Categoria</span><span style={valueStyle}>{lancamento.categoria || '—'}</span></div>
              </>
            )}
            <div style={infoStyle}><span style={labelStyle}>Status</span><StatusChip status={lancamento.status} /></div>
            <div style={infoStyle}>
              <span style={labelStyle}>Valor</span>
              <span style={{ ...valueStyle, color: lancamento.tipo === 'receita' ? '#10b981' : '#ef4444', fontSize: 15, fontWeight: 700 }}>{fmtCurrency(lancamento.valor)}</span>
            </div>
          </div>

          {/* ── Linha do tempo ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <ClockIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.8, textTransform: 'uppercase' }}>Histórico de eventos</span>
              {!loading && eventos.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-primary)', borderRadius: 20, padding: '2px 8px', border: '1px solid var(--border)' }}>
                  {eventos.length} evento{eventos.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</div>
            ) : eventos.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px', background: 'var(--bg-primary)', borderRadius: 12, border: '1px dashed var(--border)', gap: 8 }}>
                <MapPinIcon style={{ width: 28, height: 28, color: 'var(--border)' }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>Nenhum evento registrado ainda.</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, textAlign: 'center' }}>O histórico de eventos aparecerá aqui.</p>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {/* trilho vertical */}
                <div style={{ position: 'absolute', left: 14, top: 12, bottom: 12, width: 1, background: 'var(--border)' }} />

                {eventos.map((ev, i) => {
                  const conf = EVENTO_CONF[ev.tipo] || EVENTO_CONF.editado
                  const Icon = conf.icon
                  const campos = ev.dados?.campos_alterados || []
                  const isLast = i === eventos.length - 1
                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: 12, marginBottom: isLast ? 0 : 18, position: 'relative' }}>
                      {/* ícone */}
                      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                        <Icon style={{ width: 13, height: 13, color: conf.color }} />
                      </div>

                      {/* conteúdo */}
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                        {/* hora + título + data */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmtHora(ev.created_at)}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{conf.label}</span>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDataHora(ev.created_at)}</span>
                        </div>

                        {/* actor */}
                        {ev.usuario_nome && (
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>
                            {ev.usuario_nome}
                          </p>
                        )}

                        {/* mudança de status */}
                        {ev.status_de && ev.status_para && (
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>
                            {STATUS_CONF[ev.status_de]?.label || ev.status_de} → {STATUS_CONF[ev.status_para]?.label || ev.status_para}
                          </p>
                        )}

                        {/* campos alterados */}
                        {campos.map((c, ci) => (
                          <div key={ci} style={{ marginTop: 4, paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
                            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{c.campo}: {c.de || '—'} → {c.para || '—'}</p>
                          </div>
                        ))}

                        {/* motivo / descrição */}
                        {ev.descricao && (
                          <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
                            {ev.tipo === 'devolvido' && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 4 }}>Motivo:</span>}
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ev.descricao}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <button onClick={onClose} style={{ padding: '10px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de Digitalização
// ─────────────────────────────────────────────────────────────────────────────
function DigitalizacaoModal({ workspaceId, userId, onClose, onSaved }) {
  const [step, setStep]               = useState('upload')
  const [imgFile, setImgFile]         = useState(null)
  const [imgPreview, setImgPreview]   = useState(null)
  const [detectedType, setDetectedType] = useState('padrao')
  const [form, setForm]               = useState(null)
  const [dadosExtras, setDadosExtras] = useState({})
  const [saving, setSaving]           = useState(false)
  const fileRef = useRef()

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return }
    setImgFile(file)
    setImgPreview(URL.createObjectURL(file))
  }

  async function handleScan() {
    if (!imgFile) { toast.error('Selecione uma imagem primeiro'); return }
    setStep('scanning')
    try {
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(imgFile)
      })
      // Passa o template ativo para o OCR usar extração guiada por campos
      const tmpl = formTemplates[filterForm] || null
      const resp = await fetch('/api/ocr-formulario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: b64,
          template: tmpl ? { id: tmpl.id, nome: tmpl.nome, tipo_base: tmpl.tipo_base, campos: tmpl.campos } : null,
        }),
      })
      if (!resp.ok) throw new Error('Erro na API')
      const data = await resp.json()

      const hoje = new Date().toISOString().slice(0, 10)

      if (data.tipo_formulario === 'transporte') {
        setDetectedType('transporte')
        setDadosExtras({
          ...data,
          km_rows: mergeKmRows(data.km_rows),
        })
        setForm({
          tipo: 'receita',
          descricao: '',
          valor: String(data.valor_total || 0),
          data: data.data || hoje,
          categoria: 'Transporte',
          centro_custo: data.cc || '',
          status: 'rascunho',
          observacoes: data.observacao || '',
          comprovante_url: '',
        })
      } else if (data.tipo_formulario && data.tipo_formulario !== 'padrao') {
        // OCR com template — tipo 'diario', 'custom', etc.
        setDetectedType(data.tipo_formulario)
        setDadosExtras(data)
        setForm({
          tipo: 'receita',
          descricao: '',
          valor: String(data.valor_total || data.valor || 0),
          data: data.data || hoje,
          categoria: 'Serviços',
          centro_custo: data.cc || '',
          status: 'rascunho',
          observacoes: data.observacao || data.observacoes || '',
          comprovante_url: '',
        })
      } else {
        setDetectedType('padrao')
        setDadosExtras({})
        setForm({
          tipo: data.tipo || 'despesa',
          descricao: data.descricao || '',
          valor: data.valor != null ? String(data.valor) : '',
          data: data.data || hoje,
          categoria: data.categoria || 'Outros',
          centro_custo: data.centro_custo || '',
          status: 'rascunho',
          observacoes: data.observacoes || '',
          comprovante_url: '',
        })
      }
      setStep('review')
    } catch (e) {
      toast.error('Falha ao digitalizar: ' + e.message)
      setStep('upload')
    }
  }

  async function handleSave() {
    const isTransporteType = detectedType === 'transporte'
    const isTemplateType = detectedType && detectedType !== 'transporte' && detectedType !== 'padrao'
    const valorFinal = isTransporteType
      ? getValorTransporte(dadosExtras)
      : parseFloat(String(form?.valor || '0').replace(',', '.'))
    if (isNaN(valorFinal) || valorFinal < 0) { toast.error('Valor inválido'); return }

    const d = dadosExtras
    const hoje = new Date().toISOString().slice(0, 10)
    const descricao = isTransporteType
      ? `Nº ${d.numero_diario || '—'} | ${d.empresa || ''} | ${d.local_origem || ''} → ${d.local_destino || ''}`.trim()
      : isTemplateType
        ? ([`Nº ${d.numero_diario || d.nro_boletim || ''}`.trim(), d.empresa || d.cliente || '', d.local_origem || d.local_servico || ''].filter(Boolean).join(' | ') || `Digitalizado em ${hoje}`)
        : (form?.descricao?.trim() || '')
    if (!descricao) { toast.error('Informe a descrição'); return }

    setSaving(true)
    try {
      let comprovante_url = ''
      if (imgFile && supabase) {
        const ext = imgFile.name.split('.').pop()
        const path = `lancamentos/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('comprovantes').upload(path, imgFile, { upsert: true })
        if (!upErr) {
          const { data: pub } = supabase.storage.from('comprovantes').getPublicUrl(path)
          comprovante_url = pub.publicUrl
        }
      }
      const { data: inserted, error } = await supabase.from('lancamentos').insert({
        ...form,
        descricao,
        valor: valorFinal,
        comprovante_url,
        tipo_formulario: detectedType,
        dados_extras: dadosExtras,
        workspace_id: workspaceId,
        user_id: userId,
      }).select('id').single()
      if (error) throw error
      // Registra: processado pela IA e criado
      if (inserted?.id) {
        await registrarEvento({ lancamentoId: inserted.id, tipo: 'processado_ia', descricao: 'Imagem lida e dados extraídos automaticamente.', usuarioId: userId })
        await registrarEvento({ lancamentoId: inserted.id, tipo: 'criado', statusPara: form.status || 'rascunho', usuarioId: userId })
      }
      toast.success('Formulário digitalizado e lançamento criado!')
      onSaved()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: detectedType === 'transporte' && step === 'review' ? 680 : 540, maxHeight: '92vh', overflowY: 'auto', padding: 28 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DocumentArrowUpIcon style={{ width: 18, height: 18, color: '#818cf8' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Digitalizar Formulário</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>IA extrai os dados automaticamente</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><XMarkIcon style={{ width: 22, height: 22 }} /></button>
        </div>

        {/* ── UPLOAD ── */}
        {step === 'upload' && (
          <div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
            {imgPreview ? (
              <div style={{ textAlign: 'center' }}>
                <img src={imgPreview} alt="" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 10, border: '1px solid var(--border)', objectFit: 'contain' }} />
                <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button onClick={() => { setImgFile(null); setImgPreview(null) }} style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Trocar</button>
                  <button onClick={handleScan} style={{ padding: '8px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#4f46e5,#6366f1)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <SparklesIcon style={{ width: 15, height: 15 }} /> Analisar com IA
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', cursor: 'pointer' }}>
                <DocumentArrowUpIcon style={{ width: 44, height: 44, color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Arraste ou clique para selecionar</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Foto do Diário do Motorista ou qualquer documento</p>
              </div>
            )}
          </div>
        )}

        {/* ── SCANNING ── */}
        {step === 'scanning' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <SparklesIcon style={{ width: 44, height: 44, color: '#818cf8', margin: '0 auto 16px' }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Analisando formulário...</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Extraindo dados com IA</p>
          </div>
        )}

        {/* ── REVIEW ── */}
        {step === 'review' && form && (
          <div>
            <div style={{ background: detectedType === 'transporte' ? 'rgba(99,102,241,0.08)' : 'rgba(16,185,129,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: detectedType === 'transporte' ? '#a5b4fc' : '#6ee7b7', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              {detectedType === 'transporte'
                ? <><TruckIcon style={{ width: 14, height: 14 }} /> Diário do Motorista detectado — revise e confirme os dados.</>
                : <><SparklesIcon style={{ width: 14, height: 14 }} /> Dados extraídos pela IA — revise antes de salvar.</>
              }
            </div>

            {/* Preview da imagem */}
            {imgPreview && (
              <img src={imgPreview} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }} />
            )}

            {/* Data + Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>DATA</label>
                <input type="date" style={inputStyle} value={form.data} onChange={e => setF('data', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>STATUS</label>
                <select style={inputStyle} value={form.status} onChange={e => setF('status', e.target.value)}>
                  {Object.entries(STATUS_CONF).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            {/* Formulário de transporte */}
            {detectedType === 'transporte' && (
              <FormTransporte dados={dadosExtras} onChange={setDadosExtras} />
            )}

            {/* Formulário padrão */}
            {detectedType === 'padrao' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input style={inputStyle} placeholder="Descrição" value={form.descricao} onChange={e => setF('descricao', e.target.value)} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input style={inputStyle} type="number" placeholder="Valor (R$)" value={form.valor} onChange={e => setF('valor', e.target.value)} />
                  <select style={inputStyle} value={form.categoria} onChange={e => setF('categoria', e.target.value)}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <input style={inputStyle} placeholder="Centro de custo" value={form.centro_custo} onChange={e => setF('centro_custo', e.target.value)} />
                {form.observacoes && <textarea style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} />}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep('upload')} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Voltar</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                {saving ? 'Salvando...' : 'Confirmar e Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalhe expandido de transporte
// ─────────────────────────────────────────────────────────────────────────────
function TransporteDetail({ d = {} }) {
  const kmRows = (d.km_rows || []).filter(r => r.saida || r.entrada || r.total)

  const infoRows = [
    d.numero_diario && ['Nº Diário', d.numero_diario],
    d.empresa       && ['Empresa',    d.empresa],
    d.setor         && ['Setor',      d.setor],
    d.solicitante   && ['Solicitante',d.solicitante],
    d.cc            && ['CC',         d.cc],
    (d.local_origem || d.local_destino) && ['Rota', `${d.local_origem || '—'} → ${d.local_destino || '—'}`],
    d.equipamento   && ['Equipamento',d.equipamento],
    d.placa         && ['Placa',      d.placa],
    d.veiculo       && ['Veículo',    d.veiculo],
    d.diarias       && ['Diárias',    d.diarias],
  ].filter(Boolean)

  return (
    <div>
      {infoRows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8, marginBottom: 12 }}>
          {infoRows.map(([label, value]) => (
            <div key={label}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      )}
      {kmRows.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
            {['', 'SAÍDA', 'ENTRADA', 'TOTAL/KM'].map(h => (
              <div key={h} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>{h}</div>
            ))}
          </div>
          {kmRows.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', borderBottom: i < kmRows.length - 1 ? '1px solid var(--border)' : 'none', background: row.tipo === 'ASFALTO' ? 'rgba(99,102,241,0.04)' : 'rgba(245,158,11,0.04)' }}>
              <div style={{ padding: '5px 8px', fontSize: 10, fontWeight: 800, color: row.tipo === 'ASFALTO' ? '#818cf8' : '#f59e0b', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{row.tipo}</div>
              {[row.saida, row.entrada, row.total].map((v, j) => (
                <div key={j} style={{ padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', textAlign: 'center' }}>{v || '—'}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Painel WhatsApp — cadastro de motoristas
// ─────────────────────────────────────────────────────────────────────────────
function WhatsAppPanel({ workspaceId }) {
  const [motoristas, setMotoristas] = useState([])
  const [loading, setLoading]       = useState(true)
  const [form, setForm]             = useState({ phone_number: '', nome_motorista: '' })
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    setMotoristas(data || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    const phone = form.phone_number.replace(/\D/g, '')
    if (phone.length < 10) { toast.error('Número inválido — use somente dígitos (ex: 5567999990000)'); return }
    if (!form.nome_motorista.trim()) { toast.error('Informe o nome do motorista'); return }
    setSaving(true)
    const { error } = await supabase.from('whatsapp_config').insert({
      workspace_id:   workspaceId,
      phone_number:   phone,
      nome_motorista: form.nome_motorista.trim(),
      ativo:          true,
    })
    if (error) {
      toast.error(error.code === '23505' ? 'Número já cadastrado' : 'Erro: ' + error.message)
    } else {
      toast.success('Motorista cadastrado!')
      setForm({ phone_number: '', nome_motorista: '' })
      load()
    }
    setSaving(false)
  }

  async function handleToggle(id, ativo) {
    await supabase.from('whatsapp_config').update({ ativo }).eq('id', id)
    setMotoristas(prev => prev.map(m => m.id === id ? { ...m, ativo } : m))
  }

  async function handleRemove(id) {
    if (!window.confirm('Remover este motorista?')) return
    await supabase.from('whatsapp_config').delete().eq('id', id)
    setMotoristas(prev => prev.filter(m => m.id !== id))
    toast.success('Removido')
  }

  const webhookUrl = `https://dividiai.app.br/api/webhook-whatsapp`
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      {/* Como configurar */}
      <div style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <QrCodeIcon style={{ width: 20, height: 20, color: '#25d366' }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: '#25d366' }}>Configuração Z-API</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 8px' }}>1. Acesse <a href="https://z-api.io" target="_blank" rel="noreferrer" style={{ color: '#25d366' }}>z-api.io</a> e crie uma instância conectando seu WhatsApp.</p>
          <p style={{ margin: '0 0 8px' }}>2. Em <b>Webhook → Ao receber</b>, configure a URL:</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', borderRadius: 7, padding: '8px 12px', margin: '0 0 8px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)' }}>
            {webhookUrl}
            <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copiado!') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#25d366', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>COPIAR</button>
          </div>
          <p style={{ margin: '0 0 4px' }}>3. Nas variáveis de ambiente do Vercel, adicione:</p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12 }}>
            <li><b>ZAPI_INSTANCE_ID</b> — ID da instância Z-API</li>
            <li><b>ZAPI_TOKEN</b> — Token da instância</li>
            <li><b>SUPABASE_SERVICE_KEY</b> — service_role key do Supabase</li>
            <li><b>WHATSAPP_WEBHOOK_TOKEN</b> — qualquer string secreta (opcional)</li>
          </ul>
        </div>
      </div>

      {/* Adicionar motorista */}
      <div style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px', marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlusIcon style={{ width: 18, height: 18 }} /> Cadastrar Motorista
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>NÚMERO WHATSAPP</label>
            <input style={inputStyle} placeholder="5567999990000 (só dígitos)" value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value.replace(/\D/g, '') }))} />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, display: 'block' }}>DDI + DDD + número (ex: 5567999990000)</span>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>NOME DO MOTORISTA</label>
            <input style={inputStyle} placeholder="Ex: João Silva" value={form.nome_motorista} onChange={e => setForm(f => ({ ...f, nome_motorista: e.target.value }))} />
          </div>
          <button onClick={handleAdd} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#25d366,#128c7e)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, height: 42 }}>
            {saving ? '...' : 'Adicionar'}
          </button>
        </div>
      </div>

      {/* Lista de motoristas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando...</div>
      ) : motoristas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <PhoneIcon style={{ width: 40, height: 40, color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Nenhum motorista cadastrado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {motoristas.map(m => (
            <div key={m.id} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 10, border: `1px solid ${m.ativo ? 'rgba(37,211,102,0.2)' : 'var(--border)'}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: m.ativo ? 'rgba(37,211,102,0.12)' : 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PhoneIcon style={{ width: 17, height: 17, color: m.ativo ? '#25d366' : 'var(--text-secondary)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{m.nome_motorista}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>+{m.phone_number}</div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: m.ativo ? 'rgba(37,211,102,0.1)' : 'rgba(0,0,0,0.05)', color: m.ativo ? '#25d366' : 'var(--text-secondary)' }}>
                {m.ativo ? 'Ativo' : 'Inativo'}
              </span>
              <button onClick={() => handleToggle(m.id, !m.ativo)} style={{ padding: '5px 12px', borderRadius: 7, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>
                {m.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button onClick={() => handleRemove(m.id)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
                <TrashIcon style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Painel de Notificações por Status
// Cada linha = "pessoa X recebe WhatsApp quando o lançamento entrar no status Y"
// ─────────────────────────────────────────────────────────────────────────────
const TODOS_STATUS = [
  { value: 'aguardando_aprovacao', label: '⏳ Aguardando Aprovação' },
  { value: 'aprovado',             label: '✅ Aprovado' },
  { value: 'devolvido',            label: '⚠️ Devolvido' },
  { value: 'corrigido',            label: '🔧 Corrigido / Reenviado' },
  { value: 'reprovado',            label: '❌ Reprovado' },
  { value: 'faturado',             label: '💰 Faturado' },
  { value: 'cancelado',            label: '🚫 Cancelado' },
]

function StatusNotifPanel({ workspaceId }) {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ status: 'aprovado', nome_destinatario: '', phone_number: '' })

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data } = await supabase
      .from('status_notificacoes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('status')
      .order('created_at', { ascending: false })
    setRegistros(data || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    const phone = form.phone_number.replace(/\D/g, '')
    if (phone.length < 10) { toast.error('Número inválido — somente dígitos (ex: 5567999990000)'); return }
    if (!form.nome_destinatario.trim()) { toast.error('Informe o nome do destinatário'); return }
    setSaving(true)
    const { error } = await supabase.from('status_notificacoes').insert({
      workspace_id:     workspaceId,
      status:           form.status,
      nome_destinatario: form.nome_destinatario.trim(),
      phone_number:     phone,
      ativo:            true,
    })
    if (error) {
      toast.error('Erro: ' + error.message)
    } else {
      toast.success('Destinatário adicionado!')
      setForm(f => ({ ...f, nome_destinatario: '', phone_number: '' }))
      load()
    }
    setSaving(false)
  }

  async function handleToggle(id, ativo) {
    await supabase.from('status_notificacoes').update({ ativo }).eq('id', id)
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, ativo } : r))
  }

  async function handleRemove(id) {
    if (!window.confirm('Remover este destinatário?')) return
    await supabase.from('status_notificacoes').delete().eq('id', id)
    setRegistros(prev => prev.filter(r => r.id !== id))
    toast.success('Removido')
  }

  // Agrupa por status para exibição
  const porStatus = TODOS_STATUS.map(s => ({
    ...s,
    items: registros.filter(r => r.status === s.value),
  })).filter(s => s.items.length > 0)

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    background: 'var(--bg-primary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  return (
    <div>
      {/* Explicação */}
      <div style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <BellAlertIcon style={{ width: 18, height: 18, color: '#818cf8' }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: '#818cf8' }}>Como funciona</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Cadastre aqui <b>quem recebe notificação WhatsApp</b> quando um lançamento entrar em cada etapa.
          Uma mesma pessoa pode estar em múltiplos status — receberá mensagem em cada um.
          O sistema dispara automaticamente ao mudar o status no Faturamento.
        </p>
      </div>

      {/* Formulário de adição */}
      <div style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px', marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlusIcon style={{ width: 17, height: 17 }} /> Adicionar Destinatário
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>ETAPA / STATUS</label>
            <select style={selectStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {TODOS_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>NOME DO DESTINATÁRIO</label>
            <input style={inputStyle} placeholder="Ex: Paulo Gestor" value={form.nome_destinatario} onChange={e => setForm(f => ({ ...f, nome_destinatario: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>WHATSAPP (DDI+DDD+NÚMERO)</label>
            <input style={inputStyle} placeholder="5567999990000" value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value.replace(/\D/g, '') }))} />
          </div>
          <button onClick={handleAdd} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#818cf8,#6366f1)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, height: 42, flexShrink: 0 }}>
            {saving ? '...' : 'Adicionar'}
          </button>
        </div>
      </div>

      {/* Lista agrupada por status */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando...</div>
      ) : registros.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <BellAlertIcon style={{ width: 44, height: 44, color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Nenhum destinatário configurado ainda.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {porStatus.map(grupo => (
            <div key={grupo.value}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                {grupo.label}
                <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: 'rgba(129,140,248,0.12)', color: '#818cf8', fontWeight: 700 }}>
                  {grupo.items.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {grupo.items.map(r => (
                  <div key={r.id} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 10, border: `1px solid ${r.ativo ? 'rgba(129,140,248,0.2)' : 'var(--border)'}`, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: r.ativo ? 'rgba(129,140,248,0.1)' : 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <PhoneIcon style={{ width: 16, height: 16, color: r.ativo ? '#818cf8' : 'var(--text-secondary)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{r.nome_destinatario}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>+{r.phone_number}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: r.ativo ? 'rgba(129,140,248,0.1)' : 'rgba(0,0,0,0.05)', color: r.ativo ? '#818cf8' : 'var(--text-secondary)' }}>
                      {r.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    <button onClick={() => handleToggle(r.id, !r.ativo)} style={{ padding: '5px 12px', borderRadius: 7, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>
                      {r.ativo ? 'Pausar' : 'Ativar'}
                    </button>
                    <button onClick={() => handleRemove(r.id)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
                      <TrashIcon style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EditFieldModal — popup de edição de campo inline
// ─────────────────────────────────────────────────────────────────────────────
const FIELD_LABELS = {
  data: 'Data',
  valor: 'Valor',
  numero_diario: 'Nº DM',
  numero_documento: 'Nº Ficha',
  cliente: 'Cliente / Descrição',
  local_origem: 'Origem',
  local_destino: 'Destino',
  placa: 'Placa',
  km_asfalto: 'KM Asfalto',
  km_terra: 'KM Terra',
  unidade_empresa: 'Unidade',
  jornada_inicio: 'Início Jornada',
  jornada_fim: 'Fim Jornada',
  responsavel_birigui_nome: 'Resp. Birigui',
}

function EditFieldModal({ editState, onSave, onCancel, saving }) {
  const { field, value, origValue } = editState
  const [val, setVal] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50) }, [])

  const label = FIELD_LABELS[field] || field
  const unchanged = val === origValue || (field === 'valor' && parseFloat(val) === parseFloat(origValue))

  function handleKey(e) {
    if (e.key === 'Enter' && !unchanged) onSave(val)
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PencilIcon style={{ width: 17, height: 17, color: '#818cf8' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Editar campo</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
          </div>
          <button onClick={onCancel} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, borderRadius: 6 }}>
            <XMarkIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Valor anterior */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Valor atual</div>
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)', fontFamily: field === 'placa' ? 'monospace' : undefined }}>
            {origValue || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>(vazio)</span>}
          </div>
        </div>

        {/* Novo valor */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Novo valor</div>
          <input
            ref={inputRef}
            type={field === 'valor' ? 'number' : field === 'data' ? 'date' : 'text'}
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Digite o novo ${label.toLowerCase()}…`}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-primary)', border: '2px solid #818cf8', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: field === 'placa' ? 'monospace' : undefined }}
          />
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} disabled={saving}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={() => onSave(val)} disabled={saving || unchanged}
            style={{ flex: 2, padding: '10px 0', borderRadius: 10, background: saving || unchanged ? 'rgba(99,102,241,0.3)' : '#6366f1', border: 'none', color: saving || unchanged ? 'rgba(255,255,255,0.4)' : '#fff', cursor: saving || unchanged ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {saving ? <><ArrowPathIcon style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Salvando…</> : 'Confirmar alteração'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Lancamentos() {
  const { workspaceId, enabledModules } = useStore()
  const [tab, setTab]                   = useState('lancamentos')
  const [lancamentos, setLancamentos]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [userId, setUserId]             = useState(null)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('meus')
  const [filterForm, setFilterForm]     = useState('diario')
  const [showModal, setShowModal]       = useState(false)
  const [showDigital, setShowDigital]   = useState(false)
  const [editItem, setEditItem]         = useState(null)
  const [rotaItem, setRotaItem]         = useState(null)
  const [expandedId, setExpandedId]     = useState(null)
  const [selectedIds, setSelectedIds]   = useState(new Set())
  const [lotesMap, setLotesMap]           = useState({})
  const [criarLoteModal, setCriarLoteModal] = useState(false)
  const [criarLoteCliente, setCriarLoteCliente] = useState('')
  const [criarLoteSaving, setCriarLoteSaving] = useState(false)
  const [criarLoteDivModal, setCriarLoteDivModal] = useState(false)
  const [criarLoteDivNomes, setCriarLoteDivNomes] = useState([])
  const [loteConflito, setLoteConflito] = useState(null) // itens com lote já atribuído
  const [sortKey, setSortKey] = useState(null)   // colKey ativo
  const [sortDir, setSortDir] = useState('asc')  // 'asc' | 'desc'
  const [tarifasMap, setTarifasMap] = useState({}) // cliente_nome.lower → diario_tarifas row
  const [inlineEdit, setInlineEdit] = useState({ id: null, field: null, value: '', origValue: '' })
  const [inlineSaving, setInlineSaving] = useState(false)
  const [expandedDiario, setExpandedDiario] = useState(new Set())
  const [reprocessingId, setReprocessingId] = useState(null)
  const [formTemplates, setFormTemplates] = useState({})

  function toggleDiario(id) {
    setExpandedDiario(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function reprocessarLancamento(l) {
    if (reprocessingId) return
    setReprocessingId(l.id)
    const tid = toast.loading('Reprocessando com IA...')
    try {
      const resp = await fetch('/api/reprocessar-diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lancamentoId: l.id, workspaceId: l.workspace_id }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Erro desconhecido')
      if (json.updated === 0) {
        toast.success('Nenhum campo novo identificado', { id: tid })
      } else {
        toast.success(`${json.updated} campo(s) atualizados: ${json.fields.join(', ')}`, { id: tid })
        // Atualiza local
        setLancamentos(prev => prev.map(item =>
          item.id === l.id ? { ...item, dados_extras: json.dados_extras } : item
        ))
      }
    } catch (err) {
      toast.error(`Falha ao reprocessar: ${err.message}`, { id: tid })
    } finally {
      setReprocessingId(null)
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll() {
    if (filtered.every(l => selectedIds.has(l.id))) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map(l => l.id)))
  }

  // ── Inline Editing ──────────────────────────────────────────
  // Campos raiz (direto na linha lancamentos): 'data', 'valor'
  // Campos em dados_extras: 'numero_diario', 'cliente', 'local_origem', 'local_destino', 'placa'
  const ROOT_FIELDS = new Set(['data', 'valor'])

  function startInlineEdit(lancamento, field, currentValue) {
    setInlineEdit({ id: lancamento.id, field, value: String(currentValue ?? ''), origValue: String(currentValue ?? '') })
  }

  function cancelInlineEdit() {
    setInlineEdit({ id: null, field: null, value: '', origValue: '' })
  }

  async function saveInlineEdit(newValue) {
    const { id, field, origValue } = inlineEdit
    if (!id || !field) return
    const value = newValue !== undefined ? String(newValue) : inlineEdit.value
    if (value === origValue) { cancelInlineEdit(); return }
    setInlineSaving(true)
    try {
      const lancamento = lancamentos.find(l => l.id === id)
      if (!lancamento) throw new Error('Lançamento não encontrado')

      let payload
      let valorFinal = value.trim()

      if (ROOT_FIELDS.has(field)) {
        if (field === 'valor') {
          valorFinal = parseFloat(value.replace(',', '.')) || 0
        }
        payload = { [field]: valorFinal, updated_at: new Date().toISOString() }
      } else if (field === 'km_asfalto' || field === 'km_terra') {
        // Ajusta km_rows: coloca todo o valor no primeiro trecho do tipo, zera os demais
        const tipoKm = field === 'km_asfalto' ? 'ASFALTO' : 'TERRA'
        const novoTotal = parseFloat(String(valorFinal).replace(',', '.')) || 0
        const kmRows = mergeKmRows(lancamento.dados_extras?.km_rows)
        let first = true
        const updatedRows = kmRows.map(r => {
          if (r.tipo !== tipoKm) return r
          if (first) { first = false; return { ...r, total: novoTotal > 0 ? String(novoTotal) : '' } }
          return { ...r, saida: '', entrada: '', total: '' }
        })
        const extras = { ...(lancamento.dados_extras || {}), km_rows: updatedRows }
        payload = { dados_extras: extras, updated_at: new Date().toISOString() }
        valorFinal = novoTotal
      } else {
        // Campo dentro de dados_extras
        const extras = { ...(lancamento.dados_extras || {}), [field]: valorFinal }
        payload = { dados_extras: extras, updated_at: new Date().toISOString() }
      }

      const { error } = await supabase.from('lancamentos').update(payload).eq('id', id)
      if (error) throw error

      // Atualiza local
      setLancamentos(prev => prev.map(l => {
        if (l.id !== id) return l
        if (ROOT_FIELDS.has(field)) return { ...l, [field]: valorFinal }
        if (field === 'km_asfalto' || field === 'km_terra') {
          return { ...l, dados_extras: payload.dados_extras }
        }
        return { ...l, dados_extras: { ...(l.dados_extras || {}), [field]: valorFinal } }
      }))

      // Registra no histórico
      const { data: authData } = await supabase.auth.getUser()
      const userEmail = authData?.user?.email || null
      await registrarEvento({
        lancamentoId: id,
        tipo: 'editado',
        usuarioId: userId,
        usuarioNome: userEmail,
        dados: { campo: field, valor_anterior: origValue, valor_novo: String(valorFinal), editado_inline: true },
      })

      toast.success('Campo atualizado')
      cancelInlineEdit()
    } catch (err) {
      toast.error(`Erro ao salvar: ${err.message}`)
    } finally {
      setInlineSaving(false)
    }
  }


  function buildRow(l) {
    const d = l.dados_extras || {}
    const isT = (l.tipo_formulario || 'padrao') === 'transporte'
    const km = isT ? calcKmTotais(d) : null
    const kmRows = (d.km_rows || [])

    // Expande cada linha de KM em colunas individuais (até 8 linhas)
    const kmCols = {}
    for (let i = 0; i < 8; i++) {
      const r = kmRows[i] || {}
      const label = `KM${i + 1}`
      kmCols[`${label} TIPO`]    = r.tipo    || ''
      kmCols[`${label} SAÍDA`]   = r.saida   || ''
      kmCols[`${label} ENTRADA`] = r.entrada || ''
      kmCols[`${label} TOTAL`]   = r.total   || ''
    }

    return {
      'DATA':              l.data || '',
      'Nº DIÁRIO':         d.numero_diario || '',
      'TIPO FORMULÁRIO':   l.tipo_formulario || 'padrao',
      'STATUS':            (STATUS_CONF[l.status]?.label || l.status || ''),
      'CLIENTE':           d.cliente || d.empresa || '',
      'DESCRIÇÃO':         l.descricao || '',
      'CONDUTOR':          d.condutor || '',
      'PLACA':             d.placa || '',
      'ORIGEM':            d.local_origem || '',
      'DESTINO':           d.local_destino || '',
      'SOLICITANTE':       d.solicitante || '',
      'CC/EMPRESA':        l.centro_custo || '',
      'KM ASFALTO TOTAL':  km ? km.asfalto : '',
      'KM TERRA TOTAL':    km ? km.terra : '',
      'KM TOTAL GERAL':    km ? km.total : '',
      ...kmCols,
      'PEDÁGIO':           d.pedagio != null ? d.pedagio : '',
      'PERNOITE':          d.pernoite != null ? d.pernoite : '',
      'REFEIÇÃO':          d.refeicao != null ? d.refeicao : '',
      'OUTROS ADICIONAIS': d.outros_adicionais != null ? d.outros_adicionais : '',
      'DESCONTO':          d.desconto != null ? d.desconto : '',
      'VALOR TOTAL':       l.valor || 0,
      'TIPO':              l.tipo || '',
      'CATEGORIA':         l.categoria || '',
      'OBSERVAÇÕES':       l.observacoes || d.observacao || '',
      'CRIADO EM':         l.created_at ? l.created_at.slice(0, 19).replace('T', ' ') : '',
    }
  }

  function exportCSV() {
    const selecionados = filtered.filter(l => selectedIds.has(l.id))
    if (!selecionados.length) { toast('Selecione ao menos um lançamento.'); return }
    const rows = selecionados.map(buildRow)

    const wb = XLSX.utils.book_new()

    // ── Aba 1: Analítico ──────────────────────────────────────────────────────
    const ws = XLSX.utils.json_to_sheet(rows)

    // Larguras das colunas
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 28 },
      { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 30 },
    ]

    // Estilo do header (verde corporativo)
    const headerKeys = Object.keys(rows[0] || {})
    const G = { // verde escuro corporativo
      patternType: 'solid', fgColor: { rgb: '1A5C38' },
    }
    const headerFont = { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 }
    const borderThin = { style: 'thin', color: { rgb: 'C7D8CC' } }
    const allBorders = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin }

    headerKeys.forEach((key, ci) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c: ci })
      if (!ws[addr]) return
      ws[addr].s = { fill: G, font: headerFont, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: allBorders }
    })

    // Estilo das linhas de dados (alternado)
    const fillLight  = { patternType: 'solid', fgColor: { rgb: 'F0F7F3' } } // verde muito claro
    const fillWhite  = { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }
    const dataFont   = { sz: 9, color: { rgb: '1A2D23' } }
    const totalKeys  = ['KM ASFALTO TOTAL','KM TERRA TOTAL','KM TOTAL GERAL','VALOR TOTAL','KM1 TOTAL','KM2 TOTAL','KM3 TOTAL','KM4 TOTAL','KM5 TOTAL','KM6 TOTAL','KM7 TOTAL','KM8 TOTAL']

    rows.forEach((row, ri) => {
      headerKeys.forEach((key, ci) => {
        const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci })
        if (!ws[addr]) return
        const isNum = totalKeys.includes(key)
        ws[addr].s = {
          fill: ri % 2 === 0 ? fillLight : fillWhite,
          font: isNum ? { ...dataFont, bold: true, color: { rgb: '1A5C38' } } : dataFont,
          alignment: { horizontal: isNum ? 'right' : 'left', vertical: 'center' },
          border: allBorders,
        }
      })
    })

    // Linha de totais no final
    const totalValor  = selecionados.reduce((s, l) => s + (l.valor || 0), 0)
    const totalKmAsf  = selecionados.reduce((s, l) => s + (calcKmTotais(l.dados_extras || {}).asfalto || 0), 0)
    const totalKmTer  = selecionados.reduce((s, l) => s + (calcKmTotais(l.dados_extras || {}).terra || 0), 0)
    const totalKmTot  = selecionados.reduce((s, l) => s + (calcKmTotais(l.dados_extras || {}).total || 0), 0)
    const totalRow = {}
    headerKeys.forEach(k => { totalRow[k] = '' })
    totalRow['DATA']              = 'TOTAL'
    totalRow['KM ASFALTO TOTAL']  = totalKmAsf
    totalRow['KM TERRA TOTAL']    = totalKmTer
    totalRow['KM TOTAL GERAL']    = totalKmTot
    totalRow['VALOR TOTAL']       = totalValor
    XLSX.utils.sheet_add_json(ws, [totalRow], { skipHeader: true, origin: -1 })
    const totalRowIdx = rows.length + 1
    const fillTotal = { patternType: 'solid', fgColor: { rgb: '1A5C38' } }
    headerKeys.forEach((key, ci) => {
      const addr = XLSX.utils.encode_cell({ r: totalRowIdx, c: ci })
      if (!ws[addr]) return
      ws[addr].s = { fill: fillTotal, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 }, alignment: { horizontal: totalKeys.includes(key) ? 'right' : 'left' }, border: allBorders }
    })

    XLSX.utils.book_append_sheet(wb, ws, 'Analítico')

    // ── Aba 2: Resumo por cliente ─────────────────────────────────────────────
    const porCliente = {}
    selecionados.forEach(l => {
      const d = l.dados_extras || {}
      const cliente = d.cliente || d.empresa || l.descricao || 'Sem cliente'
      if (!porCliente[cliente]) porCliente[cliente] = { qtd: 0, valor: 0, kmAsf: 0, kmTer: 0, kmTot: 0 }
      porCliente[cliente].qtd++
      porCliente[cliente].valor += l.valor || 0
      const km = calcKmTotais(d)
      porCliente[cliente].kmAsf += km.asfalto
      porCliente[cliente].kmTer += km.terra
      porCliente[cliente].kmTot += km.total
    })
    const resumoRows = Object.entries(porCliente).map(([cliente, v]) => ({
      'CLIENTE': cliente,
      'QTD LANÇAMENTOS': v.qtd,
      'VALOR TOTAL': v.valor,
      'KM ASFALTO': v.kmAsf,
      'KM TERRA': v.kmTer,
      'KM TOTAL': v.kmTot,
    }))
    const ws2 = XLSX.utils.json_to_sheet(resumoRows)
    ws2['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    Object.keys(resumoRows[0] || {}).forEach((key, ci) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c: ci })
      if (!ws2[addr]) return
      ws2[addr].s = { fill: G, font: headerFont, alignment: { horizontal: 'center' }, border: allBorders }
    })
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumo por Cliente')

    XLSX.writeFile(wb, `lancamentos_${new Date().toISOString().slice(0,10)}.xlsx`, { bookType: 'xlsx', bookSST: false, type: 'binary', cellStyles: true })
    toast.success(`${selecionados.length} lançamento(s) exportado(s) para Excel.`)
  }

  function exportPDF() {
    const selecionados = filtered.filter(l => selectedIds.has(l.id))
    if (!selecionados.length) { toast('Selecione ao menos um lançamento.'); return }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const PW = doc.internal.pageSize.getWidth()
    const PH = doc.internal.pageSize.getHeight()
    const geradoEm = new Date().toLocaleString('pt-BR')
    const dataArq  = new Date().toISOString().slice(0, 10)

    // ── Paleta verde corporativo ──────────────────────────────────────────────
    const VERDE_ESCURO  = [26, 92, 56]
    const VERDE_MEDIO   = [5, 150, 105]
    const BRANCO        = [255, 255, 255]
    const CINZA_TEXTO   = [45, 55, 45]
    const CINZA_LEVE    = [240, 247, 243]

    // ── Header/footer ─────────────────────────────────────────────────────────
    const addHeaderFooter = (pageNum, totalPages) => {
      doc.setFillColor(...VERDE_ESCURO); doc.rect(0, 0, PW, 52, 'F')
      doc.setFillColor(...VERDE_MEDIO);  doc.rect(0, 52, PW, 6, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...BRANCO)
      doc.text('RELATÓRIO DE LANÇAMENTOS', 36, 24)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 220, 195)
      doc.text(`Gerado em: ${geradoEm}   |   Total de registros: ${selecionados.length}`, 36, 38)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BRANCO)
      doc.text('SmartPro', PW - 36, 24, { align: 'right' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(180, 220, 195)
      doc.text('Sistema de Controle Financeiro', PW - 36, 36, { align: 'right' })
      doc.setFillColor(...VERDE_ESCURO); doc.rect(0, PH - 24, PW, 24, 'F')
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...BRANCO)
      doc.text(`Página ${pageNum} de ${totalPages}   |   Confidencial — uso interno`, PW / 2, PH - 8, { align: 'center' })
      doc.text(dataArq, PW - 36, PH - 8, { align: 'right' })
    }

    // ── Define todas as colunas possíveis ─────────────────────────────────────
    // Cada coluna: { key, label, width, halign, getValue(l) }
    const ALL_COLS = [
      { key: 'data',        label: 'DATA',       width: 48,  halign: 'center', getValue: l => l.data ? l.data.split('-').reverse().join('/') : '' },
      { key: 'num_diario',  label: 'Nº DM',      width: 36,  halign: 'center', bold: true, getValue: l => l.dados_extras?.numero_diario || '' },
      { key: 'cliente',     label: 'CLIENTE',    width: 95,  halign: 'left',   bold: true, getValue: l => l.dados_extras?.cliente || l.dados_extras?.empresa || l.descricao || '' },
      { key: 'condutor',    label: 'CONDUTOR',   width: 72,  halign: 'left',   getValue: l => l.dados_extras?.condutor || '' },
      { key: 'placa',       label: 'PLACA',      width: 44,  halign: 'center', getValue: l => l.dados_extras?.placa || '' },
      { key: 'origem',      label: 'ORIGEM',     width: 72,  halign: 'left',   getValue: l => l.dados_extras?.local_origem || '' },
      { key: 'destino',     label: 'DESTINO',    width: 72,  halign: 'left',   getValue: l => l.dados_extras?.local_destino || '' },
      { key: 'solicitante', label: 'SOLICITANTE',width: 72,  halign: 'left',   getValue: l => l.dados_extras?.solicitante || '' },
      { key: 'km_asf',      label: 'KM ASF',     width: 44,  halign: 'right',  getValue: l => { const km = calcKmTotais(l.dados_extras||{}); return km.asfalto > 0 ? km.asfalto.toLocaleString('pt-BR') : '' } },
      { key: 'km_ter',      label: 'KM TER',     width: 44,  halign: 'right',  getValue: l => { const km = calcKmTotais(l.dados_extras||{}); return km.terra > 0 ? km.terra.toLocaleString('pt-BR') : '' } },
      { key: 'km_tot',      label: 'KM TOTAL',   width: 48,  halign: 'right',  bold: true, getValue: l => { const km = calcKmTotais(l.dados_extras||{}); return km.total > 0 ? km.total.toLocaleString('pt-BR') : '' } },
      { key: 'pedagio',     label: 'PEDÁGIO',    width: 52,  halign: 'right',  getValue: l => l.dados_extras?.pedagio != null && l.dados_extras?.pedagio !== '' ? fmtCurrency(l.dados_extras.pedagio) : '' },
      { key: 'pernoite',    label: 'PERNOITE',   width: 52,  halign: 'right',  getValue: l => l.dados_extras?.pernoite != null && l.dados_extras?.pernoite !== '' ? fmtCurrency(l.dados_extras.pernoite) : '' },
      { key: 'refeicao',    label: 'REFEIÇÃO',   width: 52,  halign: 'right',  getValue: l => l.dados_extras?.refeicao != null && l.dados_extras?.refeicao !== '' ? fmtCurrency(l.dados_extras.refeicao) : '' },
      { key: 'outros',      label: 'OUTROS',     width: 52,  halign: 'right',  getValue: l => l.dados_extras?.outros_adicionais != null && l.dados_extras?.outros_adicionais !== '' ? fmtCurrency(l.dados_extras.outros_adicionais) : '' },
      { key: 'desconto',    label: 'DESCONTO',   width: 52,  halign: 'right',  getValue: l => l.dados_extras?.desconto != null && l.dados_extras?.desconto !== '' ? fmtCurrency(l.dados_extras.desconto) : '' },
      { key: 'valor',       label: 'VALOR',      width: 64,  halign: 'right',  bold: true, green: true, getValue: l => fmtCurrency(l.valor) },
      { key: 'status',      label: 'STATUS',     width: 56,  halign: 'center', getValue: l => STATUS_CONF[l.status]?.label || l.status || '' },
      { key: 'obs',         label: 'OBSERVAÇÕES',width: 90,  halign: 'left',   getValue: l => (l.observacoes || l.dados_extras?.observacao || '').slice(0, 80) },
    ]

    // ── Injeta colunas do template (campos marcados show_in_pdf !== false) ────
    const tmplPdfCols = []
    const stdKeys = new Set(['numero_diario','cliente','empresa','condutor','placa','local_origem','local_destino','solicitante','km_asfalto','km_terra','km_total','pedagio','pernoite','refeicao','outros_adicionais','desconto','observacao'])
    Object.values(formTemplates).forEach(tmpl => {
      if (!tmpl?.campos?.length || !tmpl.tipo_base) return
      tmpl.campos
        .filter(c => c.show_in_pdf !== false && !stdKeys.has(c.key))
        .forEach(c => {
          if (tmplPdfCols.find(p => p.key === `tmpl_${c.key}`)) return
          const tipoBase = tmpl.tipo_base
          tmplPdfCols.push({
            key: `tmpl_${c.key}`,
            label: c.label.toUpperCase(),
            width: c.type === 'number' ? 52 : 72,
            halign: c.type === 'number' ? 'right' : 'left',
            getValue: l => {
              if ((l.tipo_formulario || 'padrao') !== tipoBase) return ''
              const v = l.dados_extras?.[c.key]
              return v != null && v !== '' ? String(v) : ''
            },
          })
        })
    })
    if (tmplPdfCols.length) {
      const valorIdx = ALL_COLS.findIndex(c => c.key === 'valor')
      ALL_COLS.splice(valorIdx, 0, ...tmplPdfCols)
    }

    // ── Filtra apenas colunas que têm ao menos 1 valor preenchido ─────────────
    const activeCols = ALL_COLS.filter(col =>
      selecionados.some(l => { const v = col.getValue(l); return v !== '' && v !== '—' && v != null })
    )

    // ── Monta linhas com apenas as colunas ativas ─────────────────────────────
    const rows = selecionados.map(l =>
      activeCols.map(col => {
        const v = col.getValue(l) || '—'
        const s = { halign: col.halign, fontSize: 7.5 }
        if (col.bold) s.fontStyle = 'bold'
        if (col.green) { s.fontStyle = 'bold'; s.textColor = [5, 120, 60] }
        return { content: v, styles: s }
      })
    )

    // ── Linha de totais ───────────────────────────────────────────────────────
    const totalValor = selecionados.reduce((s, l) => s + (l.valor || 0), 0)
    const totalKmAsf = selecionados.reduce((s, l) => s + (calcKmTotais(l.dados_extras||{}).asfalto||0), 0)
    const totalKmTer = selecionados.reduce((s, l) => s + (calcKmTotais(l.dados_extras||{}).terra||0), 0)
    const totalKmTot = selecionados.reduce((s, l) => s + (calcKmTotais(l.dados_extras||{}).total||0), 0)
    const TOTAL_MAP = {
      km_asf: totalKmAsf > 0 ? totalKmAsf.toLocaleString('pt-BR') : '',
      km_ter: totalKmTer > 0 ? totalKmTer.toLocaleString('pt-BR') : '',
      km_tot: totalKmTot > 0 ? totalKmTot.toLocaleString('pt-BR') : '',
      valor:  fmtCurrency(totalValor),
    }
    const totalRowData = activeCols.map((col, ci) => {
      const v = TOTAL_MAP[col.key] || (ci === 0 ? 'TOTAIS' : '')
      return { content: v, styles: { halign: col.halign, fontStyle: 'bold', fillColor: VERDE_ESCURO, textColor: col.key === 'valor' ? [134, 255, 178] : BRANCO } }
    })

    // ── columnStyles dinâmico ─────────────────────────────────────────────────
    const columnStyles = {}
    activeCols.forEach((col, ci) => { columnStyles[ci] = { cellWidth: col.width } })

    // ── Render ────────────────────────────────────────────────────────────────
    autoTable(doc, {
      head: [activeCols.map(c => c.label)],
      body: [...rows, totalRowData],
      startY: 70,
      margin: { left: 28, right: 28, bottom: 36 },
      styles: { fontSize: 7.5, cellPadding: { top: 5, right: 4, bottom: 5, left: 4 }, textColor: CINZA_TEXTO, lineColor: [200, 220, 210], lineWidth: 0.3, overflow: 'ellipsize' },
      headStyles: { fillColor: VERDE_MEDIO, textColor: BRANCO, fontStyle: 'bold', fontSize: 7.5, halign: 'center', minCellHeight: 20 },
      alternateRowStyles: { fillColor: CINZA_LEVE },
      columnStyles,
      didDrawPage: (data) => { addHeaderFooter(data.pageNumber, doc.internal.getNumberOfPages()) },
    })

    // Reaplica header/footer com total real de páginas
    const totalPages = doc.internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) { doc.setPage(i); addHeaderFooter(i, totalPages) }

    // ── Bloco de assinatura ───────────────────────────────────────────────────
    const lastY = doc.lastAutoTable?.finalY || 200
    if (lastY + 80 < PH - 40) {
      doc.setDrawColor(...VERDE_MEDIO); doc.setLineWidth(0.5)
      doc.line(28, lastY + 40, 200, lastY + 40)
      doc.line(PW - 28, lastY + 40, PW - 200, lastY + 40)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA_TEXTO)
      doc.text('Responsável pela emissão', 28, lastY + 52)
      doc.text('De acordo — Cliente', PW - 28, lastY + 52, { align: 'right' })
      doc.setFontSize(6.5); doc.setTextColor(130, 150, 140)
      doc.text('Data: ___/___/______', 28, lastY + 64)
      doc.text('Data: ___/___/______', PW - 28, lastY + 64, { align: 'right' })
    }

    doc.save(`lancamentos_${dataArq}.pdf`)
    toast.success(`PDF gerado com ${selecionados.length} lançamento(s) — ${activeCols.length} colunas com dados.`)
  }

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null))
  }, [])

  const loadData = useCallback(async () => {
    if (!supabase || !workspaceId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('lancamentos')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { toast.error('Erro ao carregar lançamentos'); setLoading(false); return }
    const items = data || []
    setLancamentos(items)
    // Carrega template ativo para este workspace (colunas dinâmicas por cliente)
    supabase.from('form_templates')
      .select('id, nome, tipo_base, campos')
      .eq('workspace_id', workspaceId)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .then(({ data: tmpls }) => {
        const map = {}
        ;(tmpls || []).forEach(t => { if (t.tipo_base && !map[t.tipo_base]) map[t.tipo_base] = t })
        setFormTemplates(map)
      })
    supabase.from('diario_tarifas')
      .select('cliente_nome, valor_hora_diurno, valor_hora_noturno, hora_inicio_diurno, hora_fim_diurno')
      .eq('ativo', true)
      .then(({ data: tData }) => {
        const tMap = {}
        ;(tData || []).forEach(t => { if (t.cliente_nome) tMap[t.cliente_nome.toLowerCase()] = t })
        setTarifasMap(tMap)
      })
    // Carrega info dos lotes vinculados
    const loteIds = [...new Set(items.map(l => l.lote_cliente_id).filter(Boolean))]
    if (loteIds.length > 0) {
      supabase.from('lotes_cliente').select('id, cliente, status').in('id', loteIds)
        .then(({ data: ld }) => {
          const m = {}
          ;(ld || []).forEach(lt => { m[lt.id] = lt })
          setLotesMap(m)
        })
    } else {
      setLotesMap({})
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id) {
    if (!window.confirm('Excluir este lançamento?')) return
    const { error } = await supabase.from('lancamentos').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Lançamento excluído')
    loadData()
  }

  async function handleStatus(id, novoStatus) {
    const lancamento = lancamentos.find(l => l.id === id)
    const statusAnterior = lancamento?.status || null
    const { error } = await supabase.from('lancamentos').update({ status: novoStatus }).eq('id', id)
    if (error) { toast.error('Erro ao atualizar status'); return }
    setLancamentos(prev => prev.map(l => l.id === id ? { ...l, status: novoStatus } : l))
    // Mapeia o status para tipo de evento
    const tipoEvento = novoStatus === 'aguardando_aprovacao' ? 'enviado_aprovacao' : novoStatus
    await registrarEvento({ lancamentoId: id, tipo: tipoEvento, statusDe: statusAnterior, statusPara: novoStatus, usuarioId: userId })
  }

  const filtered = lancamentos.filter(l => {
    const isDiario = l.tipo_formulario === 'diario'
    if (filterStatus === 'meus') {
      if (isDiario) {
        // Boletins diários criados por OCR: mostrar pendentes/aguardando aprovação
        if (l.status !== 'pendente' && l.status !== 'aguardando_aprovacao' && l.status !== 'rascunho' && l.status !== 'devolvido') return false
      } else {
        if (l.status !== 'rascunho' && l.status !== 'devolvido') return false
      }
    } else if (filterStatus === 'em_revisao') {
      if (l.status !== 'aguardando_aprovacao' && l.status !== 'corrigido') return false
    } else if (filterStatus !== 'todos' && l.status !== filterStatus) return false
    if (filterForm !== 'todos' && (l.tipo_formulario || 'padrao') !== filterForm) return false
    if (search) {
      const q = search.toLowerCase()
      const d = l.dados_extras || {}
      const ocr = d.ocr || {}
      if (
        !l.descricao?.toLowerCase().includes(q) &&
        !l.centro_custo?.toLowerCase().includes(q) &&
        !d.numero_diario?.toLowerCase().includes(q) &&
        !d.empresa?.toLowerCase().includes(q) &&
        !d.placa?.toLowerCase().includes(q) &&
        !d.solicitante?.toLowerCase().includes(q) &&
        !ocr.empresa?.toLowerCase().includes(q) &&
        !ocr.equipamento?.toLowerCase().includes(q) &&
        !ocr.veiculo_placa?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // Ordenação
  const sortedFiltered = sortKey ? [...filtered].sort((a, b) => {
    const d = a.dados_extras || {}, e = b.dados_extras || {}
    let va, vb
    if (sortKey === 'data')    { va = a.data || '';          vb = b.data || '' }
    else if (sortKey === 'numDm')   { va = Number(d.numero_diario) || 0; vb = Number(e.numero_diario) || 0 }
    else if (sortKey === 'cliente') { va = (d.cliente || d.empresa || a.descricao || '').toLowerCase(); vb = (e.cliente || e.empresa || b.descricao || '').toLowerCase() }
    else if (sortKey === 'origem')  { va = (d.local_origem || '').toLowerCase();  vb = (e.local_origem || '').toLowerCase() }
    else if (sortKey === 'destino') { va = (d.local_destino || '').toLowerCase(); vb = (e.local_destino || '').toLowerCase() }
    else if (sortKey === 'placa')   { va = (d.placa || '').toLowerCase();         vb = (e.placa || '').toLowerCase() }
    else if (sortKey === 'valor')   { va = a.valor || 0;                          vb = b.valor || 0 }
    else if (sortKey === 'status')  { va = a.status || '';                        vb = b.status || '' }
    else if (sortKey === 'kmAsf')   { va = calcKmTotais(d).asfalto;               vb = calcKmTotais(e).asfalto }
    else if (sortKey === 'kmTer')   { va = calcKmTotais(d).terra;                 vb = calcKmTotais(e).terra }
    else if (sortKey === 'kmTotal') { va = calcKmTotais(d).total;                 vb = calcKmTotais(e).total }
    else { va = ''; vb = '' }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  }) : filtered

  const isDiarioView = filterForm === 'diario'
  // Colunas extras do template ativo — isoladas por workspace (cada cliente tem o seu)
  const activeTemplate = formTemplates[filterForm] || null
  const RESERVED_COLS = new Set(['data', 'valor', 'status'])
  const templateCols = (activeTemplate?.campos || []).filter(c => c.show_in_table !== false && !RESERVED_COLS.has(c.key))
  const showTemplateCols = templateCols.length > 0

  const totalReceitas  = filtered.filter(l => l.tipo === 'receita'  && l.status !== 'rejeitado').reduce((s, l) => s + (l.valor || 0), 0)
  const totalDespesas  = filtered.filter(l => l.tipo === 'despesa'  && l.status !== 'rejeitado').reduce((s, l) => s + (l.valor || 0), 0)
  const pendentes = filtered.filter(l => ['rascunho','aguardando_aprovacao','devolvido','corrigido'].includes(l.status)).length

  // Stats para o contexto Diário de Campo
  const diarioTotalValorizado = isDiarioView
    ? filtered.reduce((s, l) => { const t = calcPricingTotal(l, tarifasMap); return t != null ? s + t : s }, 0)
    : 0
  const diarioTotalHoras = isDiarioView
    ? filtered.reduce((s, l) => {
        const d = l.dados_extras || {}; const ocr = d.ocr || {}
        const h = d.total_horas_dia ?? d.jornada_total_horas ?? (ocr.jornada_total_horas ? Number(ocr.jornada_total_horas) : null)
        return h != null ? s + Number(h) : s
      }, 0)
    : 0
  const diarioSemTarifa = isDiarioView
    ? filtered.filter(l => calcPricingTotal(l, tarifasMap) == null && l.tipo_formulario === 'diario').length
    : 0

  // Light-theme palette (scoped to this component)
  const LC = {
    bg: '#f4f6fa', card: '#fff', secondary: '#f0f2f8', hover: '#f7f8fd',
    border: '#e2e6f0', borderStrong: '#d0d5e8',
    txtPrimary: '#1a1f36', txtSecondary: '#4a5580', txtMuted: '#9aa3bf',
    accent: '#6366f1', accentLight: '#eef0fe',
  }

  // Helper: cabeçalho de coluna com ordenação crescente/decrescente
  function ColHead({ colKey, label, align = 'left' }) {
    const isSorted = sortKey === colKey
    const isAsc = isSorted && sortDir === 'asc'
    const isDesc = isSorted && sortDir === 'desc'
    function handleSort() {
      if (!isSorted) { setSortKey(colKey); setSortDir('asc') }
      else if (isAsc) { setSortDir('desc') }
      else { setSortKey(null) }
    }
    return (
      <th onClick={handleSort}
        style={{ padding: '9px 8px 9px 12px', textAlign: align, fontSize: 10.5, fontWeight: 700,
          color: isSorted ? LC.accent : LC.txtMuted, textTransform: 'uppercase',
          letterSpacing: 0.6, whiteSpace: 'nowrap', userSelect: 'none',
          cursor: 'pointer', background: isSorted ? LC.accentLight : LC.secondary,
          borderBottom: `1px solid ${LC.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
          <span>{label}</span>
          {isAsc  && <span style={{ fontSize: 10, lineHeight: 1 }}>▲</span>}
          {isDesc && <span style={{ fontSize: 10, lineHeight: 1 }}>▼</span>}
          {!isSorted && <ArrowsUpDownIcon style={{ width: 10, height: 10, opacity: 0.3, flexShrink: 0 }} />}
        </div>
      </th>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      <Header title="Lançamentos" subtitle="Diário do Motorista e documentos financeiros" />

      {/* Abas estilo underline */}
      <div style={{ background: '#fff', borderBottom: `2px solid ${LC.border}`, padding: '0 24px' }}>
        {[
          { key: 'lancamentos', label: 'Lançamentos', Icon: DocumentTextIcon },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 16px',
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            color: tab === key ? LC.accent : LC.txtMuted,
            borderBottom: `2px solid ${tab === key ? LC.accent : 'transparent'}`,
            marginBottom: -2,
          }}>
            <Icon style={{ width: 15, height: 15 }} />{label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* ── ABA LANÇAMENTOS ── */}
        {tab === 'lancamentos' && <>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
          {(isDiarioView ? [
            { label: 'TOTAL VALORIZADO', value: fmtCurrency(diarioTotalValorizado), color: '#059669' },
            { label: 'H. TRABALHADAS',   value: diarioTotalHoras.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'h', color: '#6366f1' },
            { label: 'REGISTROS',        value: filtered.length, color: '#0ea5e9' },
            { label: 'PENDENTES',        value: pendentes, color: pendentes > 0 ? '#d97706' : '#9aa3bf' },
          ] : [
            { label: 'RECEITAS',  value: fmtCurrency(totalReceitas),  color: '#059669' },
            { label: 'DESPESAS',  value: fmtCurrency(totalDespesas),  color: '#dc2626' },
            { label: 'SALDO',     value: fmtCurrency(totalReceitas - totalDespesas), color: totalReceitas - totalDespesas >= 0 ? '#059669' : '#dc2626' },
            { label: 'PENDENTES', value: pendentes, color: pendentes > 0 ? '#d97706' : LC.txtSecondary },
          ]).map(c => (
            <div key={c.label} style={{ background: `linear-gradient(135deg, ${c.color}14 0%, var(--bg-card) 55%)`, borderRadius: 12, padding: '16px 20px', border: `1px solid ${c.color}28`, borderTop: `3px solid ${c.color}`, boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 10.5, color: LC.txtMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Barra de ações */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: LC.txtMuted, pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar Nº, placa, empresa, solicitante..." style={{ width: '100%', paddingLeft: 34, padding: '9px 12px 9px 34px', borderRadius: 9, background: 'var(--bg-card)', border: `1px solid ${LC.border}`, color: LC.txtPrimary, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {/* Select formulário */}
          <select value={filterForm} onChange={e => setFilterForm(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 9, fontSize: 13, background: 'var(--bg-card)', border: `1px solid ${LC.border}`, color: LC.txtPrimary, cursor: 'pointer', outline: 'none', minWidth: 160 }}>
            <option value="diario">Diário de Campo</option>
            <option value="transporte">Diário Motorista</option>
            <option value="padrao">Padrão</option>
          </select>
          {/* Select status */}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 9, fontSize: 13, background: 'var(--bg-card)', border: `1px solid ${LC.border}`, color: LC.txtPrimary, cursor: 'pointer', outline: 'none', minWidth: 170 }}>
            <option value="meus">Meus lançamentos</option>
            <option value="em_revisao">Em revisão</option>
            <option value="aprovado">Aprovados</option>
            <option value="faturado">Faturados</option>
            <option value="reprovado">Reprovados</option>
            <option value="todos">Todos</option>
          </select>
          {selectedIds.size > 0 && (
            <>
              <button onClick={() => {
                const sels = filtered.filter(l => selectedIds.has(l.id))
                const comLote = sels.filter(l => l.lote_cliente_id && lotesMap[l.lote_cliente_id])
                if (comLote.length > 0) { setLoteConflito(comLote); return }
                setCriarLoteCliente(''); setCriarLoteModal(true)
              }} title={`Criar lote cliente com ${selectedIds.size} selecionado(s)`} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                <UserGroupIcon style={{ width: 16, height: 16 }} /> Lote ({selectedIds.size})
              </button>
              <button onClick={exportCSV} title={`Exportar ${selectedIds.size} selecionado(s) para Excel/CSV`} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                <TableCellsIcon style={{ width: 16, height: 16 }} /> Excel ({selectedIds.size})
              </button>
              <button onClick={exportPDF} title={`Exportar ${selectedIds.size} selecionado(s) para PDF`} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                <DocumentChartBarIcon style={{ width: 16, height: 16 }} /> PDF ({selectedIds.size})
              </button>
            </>
          )}
          <button onClick={() => setShowDigital(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
            <DocumentArrowUpIcon style={{ width: 16, height: 16 }} /> Digitalizar
          </button>
          <button onClick={() => { setEditItem(null); setShowModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 8, background: '#059669', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 1px 3px #05996955' }}>
            <PlusIcon style={{ width: 15, height: 15 }} /> Novo
          </button>
        </div>
        {/* Resumo de resultados */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 11.5, color: LC.txtMuted }}>
          <span><strong style={{ color: LC.txtSecondary }}>{filtered.length}</strong> registro(s)</span>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: LC.txtMuted }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <TruckIcon style={{ width: 52, height: 52, color: LC.txtMuted, margin: '0 auto 16px' }} />
            <p style={{ color: LC.txtSecondary, fontSize: 15 }}>Nenhum lançamento encontrado.</p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: `1px solid ${LC.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                {/* Linha de cabeçalhos com ordenação */}
                <tr>
                  <th style={{ padding: '9px 12px', width: 36, textAlign: 'center', background: LC.secondary, borderBottom: `1px solid ${LC.border}` }}>
                    <input type="checkbox"
                      checked={filtered.length > 0 && filtered.every(l => selectedIds.has(l.id))}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', width: 13, height: 13, accentColor: LC.accent }}
                    />
                  </th>
                  <ColHead colKey="data" label="DATA" />
                  {templateCols.map(c => (
                    <ColHead key={c.key} colKey={`tmpl_${c.key}`} label={c.label.toUpperCase()} align={c.tipo === 'number' ? 'right' : 'left'} />
                  ))}
                  <ColHead colKey="valor" label="VALOR" align="right" />
                  <ColHead colKey="status" label="STATUS" />
                  <th style={{ padding: '9px 12px', width: 80, background: LC.secondary, borderBottom: `1px solid ${LC.border}` }} />
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map(l => {
                  const isTransporte = (l.tipo_formulario || 'padrao') === 'transporte'
                  const isDiario = l.tipo_formulario === 'diario'
                  const d = l.dados_extras || {}
                  const ocr = isDiario ? (d.ocr || {}) : {}
                  const km = isTransporte ? calcKmTotais(d) : null
                  const fmtKm = v => v > 0 ? v.toLocaleString('pt-BR') : '—'

                  // abre popup de edição ao clicar
                  function openEdit(field, currentValue) {
                    startInlineEdit(l, field, currentValue)
                  }
                  const EDITABLE_TD = (field, currentValue, children, extraStyle = {}) => (
                    <td onClick={() => openEdit(field, currentValue ?? '')}
                      title={`Clique para editar ${FIELD_LABELS[field] || field}`}
                      style={{ cursor: 'pointer', ...extraStyle }}>
                      {children}
                    </td>
                  )
                  return (
                    <Fragment key={l.id}>
                    <tr style={{ borderBottom: `1px solid ${LC.border}`, transition: 'background 0.1s', background: selectedIds.has(l.id) ? LC.accentLight : '' }}
                      onMouseEnter={e => { if (!selectedIds.has(l.id)) e.currentTarget.style.background = LC.hover }}
                      onMouseLeave={e => { if (!selectedIds.has(l.id)) e.currentTarget.style.background = '' }}
                    >
                      {/* CHECKBOX */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', width: 36 }}>
                        <input type="checkbox"
                          checked={selectedIds.has(l.id)}
                          onChange={() => toggleSelect(l.id)}
                          onClick={e => e.stopPropagation()}
                          style={{ cursor: 'pointer', width: 14, height: 14, accentColor: '#818cf8' }}
                        />
                      </td>
                      {/* DATA */}
                      {EDITABLE_TD('data', l.data, (
                        <span style={{ padding: '9px 12px', display: 'block', whiteSpace: 'nowrap', color: LC.txtSecondary, fontSize: 12 }}>{fmtDate(l.data)}</span>
                      ))}
                      {/* COLUNAS DO TEMPLATE */}
                      {templateCols.map(c => {
                        const val = d[c.key]
                        const empty = val == null || val === ''
                        let display = '—'
                        if (!empty) {
                          if (c.tipo === 'date' && /^\d{4}-\d{2}-\d{2}/.test(String(val))) {
                            const [y, mo, dy] = String(val).split('T')[0].split('-')
                            display = `${dy}/${mo}/${y}`
                          } else {
                            display = String(val)
                          }
                        }
                        return (
                          <td key={c.key} style={{ padding: '9px 12px', textAlign: c.tipo === 'number' ? 'right' : 'left', fontSize: 12, whiteSpace: 'nowrap', color: empty ? LC.txtMuted : LC.txtPrimary }}>
                            {display}
                          </td>
                        )
                      })}
                      {/* VALOR */}
                      {EDITABLE_TD('valor', l.valor, (
                          <span style={{ padding: '9px 12px', display: 'block', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 700, color: l.tipo === 'receita' ? '#059669' : l.tipo === 'despesa' ? '#dc2626' : LC.accent }}>
                            {fmtCurrency(l.valor)}
                          </span>
                        ), { textAlign: 'right' })}
                      {/* STATUS */}
                      <td style={{ padding: '10px 12px' }}>
                        <StatusChip status={l.status} lote={l.lote_cliente_id && lotesMap[l.lote_cliente_id] ? lotesMap[l.lote_cliente_id] : null} />
                        {l.lote_cliente_id && lotesMap[l.lote_cliente_id] && (
                          <div style={{ marginTop: 3, fontSize: 10, color: LC.txtMuted }}>
                            {lotesMap[l.lote_cliente_id].cliente.length > 18 ? lotesMap[l.lote_cliente_id].cliente.slice(0, 18) + '…' : lotesMap[l.lote_cliente_id].cliente}
                          </div>
                        )}
                      </td>
                      {/* AÇÕES */}
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          {(() => {
                            const podeEditar = l.status === 'rascunho' || l.status === 'devolvido'
                            return (
                              <>
                                {l.status === 'devolvido' ? (
                                  <button title="Corrigir e reenviar para Faturamento" onClick={() => { setEditItem(l); setShowModal(true) }}
                                    style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)', cursor: 'pointer', color: '#f97316', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.12)'}>
                                    <WrenchScrewdriverIcon style={{ width: 13, height: 13 }} /> Corrigir
                                  </button>
                                ) : podeEditar ? (
                                  <button title="Editar" onClick={() => { setEditItem(l); setShowModal(true) }}
                                    style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: LC.txtMuted, display: 'flex', alignItems: 'center' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <PencilIcon style={{ width: 15, height: 15 }} />
                                  </button>
                                ) : (
                                  <span title="Edição bloqueada — item em andamento" style={{ padding: 5, display: 'flex', alignItems: 'center', color: '#334155', cursor: 'not-allowed' }}>
                                    <LockClosedIcon style={{ width: 14, height: 14 }} />
                                  </span>
                                )}
                              </>
                            )
                          })()}
                          <button title="Ver trajetória do item" onClick={() => setRotaItem(l)}
                            style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <MapPinIcon style={{ width: 15, height: 15 }} />
                          </button>
                          {/* Reprocessar IA — só para diários com comprovante */}
                          {isDiario && l.comprovante_url && (() => {
                            const isLoading = reprocessingId === l.id
                            const hasMissing = !d.jornada_inicio || !d.jornada_fim || !(d.cliente || d.empresa)
                            return (
                              <button
                                title={hasMissing ? 'Reprocessar com IA (campos faltando)' : 'Reprocessar com IA'}
                                onClick={() => reprocessarLancamento(l)}
                                disabled={!!reprocessingId}
                                style={{
                                  padding: 5, borderRadius: 6, border: 'none', cursor: reprocessingId ? 'not-allowed' : 'pointer',
                                  background: hasMissing ? 'rgba(245,158,11,0.12)' : 'transparent',
                                  color: hasMissing ? '#d97706' : '#818cf8',
                                  display: 'flex', alignItems: 'center', opacity: reprocessingId && !isLoading ? 0.4 : 1,
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => { if (!reprocessingId) e.currentTarget.style.background = hasMissing ? 'rgba(245,158,11,0.22)' : 'rgba(99,102,241,0.1)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = hasMissing ? 'rgba(245,158,11,0.12)' : 'transparent' }}>
                                {isLoading
                                  ? <ArrowPathIcon style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} />
                                  : <SparklesIcon style={{ width: 15, height: 15 }} />
                                }
                              </button>
                            )
                          })()}
                          {l.comprovante_url && (
                            <button title="Ver comprovante" onClick={() => window.open(l.comprovante_url, '_blank')}
                              style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <PhotoIcon style={{ width: 15, height: 15 }} />
                            </button>
                          )}
                          {(l.status === 'rascunho') && (
                            <button title="Excluir" onClick={() => handleDelete(l.id)}
                              style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <TrashIcon style={{ width: 15, height: 15 }} />
                            </button>
                          )}
                          {/* Expand detail para boletins diários */}
                          {isDiario && (
                            <button
                              title={expandedDiario.has(l.id) ? 'Fechar detalhes' : 'Ver linhas de jornada'}
                              onClick={() => toggleDiario(l.id)}
                              style={{ padding: 5, borderRadius: 6, background: expandedDiario.has(l.id) ? LC.accentLight : 'transparent', border: 'none', cursor: 'pointer', color: LC.accent, display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = LC.accentLight}
                              onMouseLeave={e => e.currentTarget.style.background = expandedDiario.has(l.id) ? LC.accentLight : 'transparent'}>
                              <ChevronDownIcon style={{ width: 15, height: 15, transform: expandedDiario.has(l.id) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* ── Linha de detalhe expandível (somente boletins diários) ── */}
                    {expandedDiario.has(l.id) && isDiario && (() => {
                      const linhas = d.linhas_jornada || []
                      const sol = d.solicitante || ''
                      const tel = d.telefone || ''
                      const eqDiu = d.equipe_diurna || ''
                      const eqNot = d.equipe_noturna || ''
                      const acess = d.acessorios_utilizados || ''
                      const local = d.local_servico || ''
                      const setor = Array.isArray(d.setores) ? d.setores : []
                      const obs = d.observacoes || ''
                      const assCliente = d.assinatura_cliente || ''
                      const assEmpresa = d.assinatura_empresa || ''
                      return (
                        <tr>
                          <td colSpan={20} style={{ padding: 0, background: '#f8faff', borderBottom: `2px solid ${LC.accent}44` }}>
                            <div style={{ padding: '14px 32px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                              {/* Chips de informações do cabeçalho */}
                              {(sol || eqDiu || local || setor.length > 0 || acess) && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                  {sol && <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '2px 9px', borderRadius: 10, whiteSpace: 'nowrap' }}>Solicitante: <strong>{sol}</strong>{tel ? ` · ${tel}` : ''}</span>}
                                  {eqDiu && <span style={{ fontSize: 11, background: '#dcfce7', color: '#15803d', padding: '2px 9px', borderRadius: 10, whiteSpace: 'nowrap' }}>Equipe Diurna: {eqDiu}</span>}
                                  {eqNot && eqNot !== 'Não se aplica' && <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 9px', borderRadius: 10, whiteSpace: 'nowrap' }}>Equipe Noturna: {eqNot}</span>}
                                  {local && <span style={{ fontSize: 11, background: '#f5f3ff', color: '#6d28d9', padding: '2px 9px', borderRadius: 10 }}>Local: {local}</span>}
                                  {setor.map((s, si) => <span key={si} style={{ fontSize: 11, background: '#fdf4ff', color: '#7e22ce', padding: '2px 9px', borderRadius: 10, whiteSpace: 'nowrap' }}>{s}</span>)}
                                  {acess && <span style={{ fontSize: 11, background: '#fff7ed', color: '#c2410c', padding: '2px 9px', borderRadius: 10 }}>Acess.: {acess}</span>}
                                </div>
                              )}
                              {/* Tabela de linhas de jornada */}
                              {linhas.length > 0 ? (
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, background: '#fff', border: `1px solid ${LC.border}`, borderRadius: 8, overflow: 'hidden' }}>
                                    <thead>
                                      <tr style={{ background: LC.secondary }}>
                                        {['DATA', 'ENTRADA 1', 'SAÍDA 1', 'ENTRADA 2', 'SAÍDA 2', 'TOTAL', 'SERVIÇO EXECUTADO'].map(h => (
                                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: LC.txtMuted, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', borderBottom: `1px solid ${LC.border}` }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {linhas.map((lj, li) => (
                                        <tr key={li} style={{ borderBottom: `1px solid ${LC.border}`, background: li % 2 === 0 ? '#fff' : LC.bg }}>
                                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: LC.txtSecondary }}>{lj.data || '—'}</td>
                                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', fontFamily: 'monospace', color: '#059669' }}>{lj.e1 || '—'}</td>
                                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', fontFamily: 'monospace', color: '#dc2626' }}>{lj.s1 || '—'}</td>
                                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', fontFamily: 'monospace', color: lj.e2 ? '#059669' : LC.txtMuted }}>{lj.e2 || '—'}</td>
                                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', fontFamily: 'monospace', color: lj.s2 ? '#dc2626' : LC.txtMuted }}>{lj.s2 || '—'}</td>
                                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', fontWeight: 700, color: LC.accent }}>{lj.total || '—'}</td>
                                          <td style={{ padding: '6px 10px', color: LC.txtPrimary, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lj.servico || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p style={{ margin: 0, fontSize: 11.5, color: LC.txtMuted, fontStyle: 'italic' }}>Nenhuma linha de jornada registrada — boletim anterior ao novo formato ou OCR sem tabela de jornada.</p>
                              )}
                              {/* Observações e assinaturas */}
                              {(obs || assCliente || assEmpresa) && (
                                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', borderTop: `1px solid ${LC.border}`, paddingTop: 10 }}>
                                  {obs && (
                                    <div style={{ flex: 1, minWidth: 220 }}>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: LC.txtMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Observações</span>
                                      <p style={{ margin: '4px 0 0', fontSize: 11.5, color: LC.txtSecondary, lineHeight: 1.5 }}>{obs}</p>
                                    </div>
                                  )}
                                  {(assCliente || assEmpresa) && (
                                    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexShrink: 0 }}>
                                      {assCliente && (
                                        <div style={{ textAlign: 'center' }}>
                                          <span style={{ fontSize: 10, fontWeight: 700, color: LC.txtMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Assinatura Cliente</span>
                                          <span style={{ fontSize: 12, color: LC.txtPrimary, fontStyle: 'italic' }}>{assCliente}</span>
                                        </div>
                                      )}
                                      {assEmpresa && (
                                        <div style={{ textAlign: 'center' }}>
                                          <span style={{ fontSize: 10, fontWeight: 700, color: LC.txtMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Assinatura Empresa</span>
                                          <span style={{ fontSize: 12, color: LC.txtPrimary, fontStyle: 'italic' }}>{assEmpresa}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })()}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          </div>
        )}
        </>}
      </div>

      {showModal && (
        <LancamentoModal
          item={editItem}
          workspaceId={workspaceId}
          userId={userId}
          enabledModules={enabledModules}
          formTemplates={formTemplates}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSaved={() => { setShowModal(false); setEditItem(null); loadData() }}
        />
      )}

      {/* Popup de edição inline */}
      {inlineEdit.id && (
        <EditFieldModal
          editState={inlineEdit}
          saving={inlineSaving}
          onSave={saveInlineEdit}
          onCancel={cancelInlineEdit}
        />
      )}

      {showDigital && (
        <DigitalizacaoModal
          workspaceId={workspaceId}
          userId={userId}
          onClose={() => setShowDigital(false)}
          onSaved={() => { setShowDigital(false); loadData() }}
        />
      )}
      {rotaItem && (
        <RotaModal
          lancamento={rotaItem}
          onClose={() => setRotaItem(null)}
        />
      )}

      {/* Modal: Conflito de Lote */}
      {loteConflito && (
        <div onClick={() => setLoteConflito(null)} style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 18, width: '100%', maxWidth: 480, border: '1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ExclamationTriangleIcon style={{ width: 20, height: 20 }} /> Itens já atribuídos a um Lote
              </div>
              <button onClick={() => setLoteConflito(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
            </div>
            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Os seguintes itens já pertencem a um lote ativo e não podem ser adicionados novamente:</p>
              {loteConflito.map(l => (
                <div key={l.id} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{l.descricao}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Lote: <strong style={{ color: '#818cf8' }}>{lotesMap[l.lote_cliente_id]?.cliente}</strong> · Status: <strong>{lotesMap[l.lote_cliente_id]?.status?.replace(/_/g, ' ')}</strong></div>
                  </div>
                </div>
              ))}
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Remova esses itens da seleção ou aguarde a conclusão do lote atual.</p>
            </div>
            <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setLoteConflito(null)} style={{ padding: '9px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#818cf8)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Entendi</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Criar Lote Cliente */}
      {criarLoteModal && (() => {
        const selecionados = filtered.filter(l => selectedIds.has(l.id))
        const fmtCurr = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
        const total = selecionados.reduce((s, l) => {
          const computed = calcPricingTotal(l, tarifasMap)
          return s + (computed != null ? computed : (l.valor || 0))
        }, 0)

        async function confirmarLote(forcar = false) {
          if (!criarLoteCliente.trim()) { toast.error('Informe o nome do cliente.'); return }
          if (selecionados.length === 0) { toast.error('Nenhum lançamento selecionado.'); return }
          // Verifica divergência de clientes entre os lançamentos
          if (!forcar) {
            const getNome = l => (l.dados_extras?.cliente || l.dados_extras?.empresa || l.descricao || '').trim().toLowerCase()
            const nomesUnicos = [...new Set(selecionados.map(getNome).filter(Boolean))]
            if (nomesUnicos.length > 1) {
              const nomesDiv = [...new Set(selecionados.map(l => l.dados_extras?.cliente || l.dados_extras?.empresa || l.descricao || '').filter(Boolean))]
              setCriarLoteDivNomes(nomesDiv)
              setCriarLoteDivModal(true)
              return
            }
          }
          setCriarLoteSaving(true)
          try {
            const { data: lote, error: errL } = await supabase
              .from('lotes_cliente')
              .insert({ workspace_id: workspaceId, cliente: criarLoteCliente.trim(), created_by: userId, status: 'rascunho' })
              .select('id').single()
            if (errL) throw errL
            const { error: errUp } = await supabase.from('lancamentos').update({ lote_cliente_id: lote.id }).in('id', selecionados.map(l => l.id))
            if (errUp) throw errUp
            toast.success(`Lote criado com ${selecionados.length} lançamento(s).`)
            setCriarLoteModal(false)
            setSelectedIds(new Set())
            loadData()
          } catch (e) {
            toast.error('Erro: ' + e.message)
          } finally {
            setCriarLoteSaving(false)
          }
        }

        return (
          <div onClick={() => setCriarLoteModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 18, width: '100%', maxWidth: 460, border: '1px solid var(--border)' }}>
              <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Criar Lote para Cliente</div>
                <button onClick={() => setCriarLoteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
              </div>
              <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Aviso inline: clientes distintos nos lançamentos selecionados */}
                {(() => {
                  const getNome = l => l.dados_extras?.cliente || l.dados_extras?.empresa || l.descricao || ''
                  const nomesDistintos = [...new Set(selecionados.map(getNome).filter(Boolean))]
                  if (nomesDistintos.length <= 1) return null
                  return (
                    <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', marginBottom: 4 }}>Clientes diferentes nos lançamentos selecionados</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {nomesDistintos.join(' · ')}
                        </div>
                      </div>
                    </div>
                  )
                })()}
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>CLIENTE *</label>
                  <input value={criarLoteCliente} onChange={e => setCriarLoteCliente(e.target.value)} placeholder="Nome do cliente" autoFocus
                    style={{ width: '100%', marginTop: 4, padding: '9px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text-primary)' }}>{selecionados.length}</strong> lançamento(s) selecionado(s)</span>
                  <span style={{ fontWeight: 700, color: '#10b981' }}>{fmtCurr(total)}</span>
                </div>
              </div>
              <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setCriarLoteModal(false)} style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
                <button onClick={confirmarLote} disabled={criarLoteSaving || !criarLoteCliente.trim()} style={{ padding: '9px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#818cf8)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, opacity: (criarLoteSaving || !criarLoteCliente.trim()) ? 0.6 : 1 }}>
                  {criarLoteSaving ? 'Criando...' : 'Criar Lote'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal: Clientes divergentes (Lançamentos) */}
      {criarLoteDivModal && (() => {
        const selecionados = filtered.filter(l => selectedIds.has(l.id))
        async function executarForcar() {
          setCriarLoteDivModal(false)
          setCriarLoteSaving(true)
          try {
            const { data: lote, error: errL } = await supabase
              .from('lotes_cliente')
              .insert({ workspace_id: workspaceId, cliente: criarLoteCliente.trim(), created_by: userId, status: 'rascunho' })
              .select('id').single()
            if (errL) throw errL
            const { error: errUp } = await supabase.from('lancamentos').update({ lote_cliente_id: lote.id }).in('id', selecionados.map(l => l.id))
            if (errUp) throw errUp
            toast.success(`Lote criado com ${selecionados.length} lançamento(s).`)
            setCriarLoteModal(false)
            setSelectedIds(new Set())
            loadData()
          } catch (e) { toast.error('Erro: ' + e.message) }
          finally { setCriarLoteSaving(false) }
        }
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 18, width: '100%', maxWidth: 500, border: '1px solid rgba(245,158,11,0.4)', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
              <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⚠️</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#f59e0b' }}>Atenção — Clientes Diferentes</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Verificação de consistência do lote</div>
                </div>
              </div>
              <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  Os lançamentos selecionados pertencem a clientes <strong>diferentes</strong>:
                </p>
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {criarLoteDivNomes.map((c, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ opacity: 0.7 }}>•</span> {c}
                    </div>
                  ))}
                </div>
                <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.22)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 5, fontSize: 12 }}>📋 Nota Fiscal e Validade Documental</strong>
                  Em conformidade com a legislação fiscal brasileira (Lei nº 8.846/94 e Decreto nº 3.000/99), documentos de prestação de serviços devem identificar de forma clara o tomador do serviço. A consolidação de lançamentos de diferentes clientes em um único lote pode prejudicar a rastreabilidade fiscal, dificultar auditorias e comprometer a validade jurídica do comprovante emitido. Recomenda-se fortemente criar lotes individuais por cliente.
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                  Deseja prosseguir e criar o lote sob o cliente <strong style={{ color: 'var(--text-primary)' }}>{criarLoteCliente}</strong>?
                </p>
              </div>
              <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setCriarLoteDivModal(false)} style={{ padding: '9px 20px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cancelar</button>
                <button onClick={executarForcar} disabled={criarLoteSaving} style={{ padding: '9px 22px', borderRadius: 8, background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.5)', color: '#f59e0b', cursor: 'pointer', fontSize: 14, fontWeight: 800, opacity: criarLoteSaving ? 0.7 : 1 }}>
                  {criarLoteSaving ? 'Criando...' : 'Sim, criar assim mesmo'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
