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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { loadWorkspaceConfig, getConfig } from '../lib/workspaceConfig'
import { LancamentoModal, calcRdoPricingTotal, registrarEvento } from './Lancamentos'
import { buildReciboERP } from '../lib/exportPDF'
import {
  ClockIcon, CheckCircleIcon, ExclamationTriangleIcon,
  PlusIcon, MagnifyingGlassIcon, XMarkIcon, ChevronDownIcon,
  ArrowTopRightOnSquareIcon, ArrowPathIcon, DocumentTextIcon,
  SparklesIcon, Cog6ToothIcon, DocumentChartBarIcon,
  ClipboardDocumentListIcon, BanknotesIcon,
  ChevronLeftIcon, ChevronRightIcon, FunnelIcon,
  DocumentArrowDownIcon, ArrowDownTrayIcon, TableCellsIcon,
  UserGroupIcon, BellAlertIcon,
  PencilSquareIcon, PaperAirplaneIcon,
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
// Calcula total de horas a partir de inicio/fim (sistema — ignora campo OCR)
function calcTotalHorasJornada(d) {
  const ini = d?.jornada_inicio || d?.hora_inicio || ''
  const fim = d?.jornada_fim   || d?.hora_fim   || ''
  if (!ini || !fim) {
    // fallback: soma dos campos de horas individuais
    const soma = ['horas_diurnas','horas_noturnas','h_fds_diurnas','h_fds_noturnas','h_feriado_diurnas','h_feriado_noturnas']
      .reduce((s, k) => s + (parseFloat(String(d?.[k] || '0').replace(',', '.')) || 0), 0)
    return soma > 0 ? soma : null
  }
  const [ih, im] = ini.split(':').map(Number)
  const [fh, fm] = fim.split(':').map(Number)
  let total = (fh * 60 + fm) - (ih * 60 + im)
  if (total <= 0) total += 24 * 60  // jornada noturna que passa da meia-noite
  return parseFloat((total / 60).toFixed(2))
}
function fmtTotalHorasJornada(d) {
  const t = calcTotalHorasJornada(d)
  return t != null ? `${t}h` : '—'
}
function fmtHorasTotal(lancs) {
  const total = lancs.reduce((s, l) => {
    const v = calcTotalHorasJornada(l.dados_extras) ?? 0
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
function getCidadeUF(l) {
  const d = l.dados_extras || {}
  return d.cidade_uf || d.cidade_estado || d.cidade || d.municipio || '—'
}
function getSolicitante(l) {
  const d = l.dados_extras || {}
  return d.solicitante || d.condutor || '—'
}
function getEquipamento(l) {
  const d = l.dados_extras || {}
  return d.equipamento || d.modelo_equipamento || '—'
}
function getClienteAss(l) {
  const d = l.dados_extras || {}
  return d.assinatura_cliente_assinado === true || d.assinatura_cliente_assinado === 'true'
}
function getEmpresaAss(l) {
  const d = l.dados_extras || {}
  return d.assinatura_birigui_assinado === true || d.assinatura_birigui_assinado === 'true'
}
// Retorna lista de motivos de divergência detectados automaticamente
function getDivergencias(l, tarifasMap) {
  const motivos = []
  const d = l.dados_extras || {}
  // 1. Status manual de divergência
  if (l.status === 'revisar' || l.status === 'reprovado') motivos.push('Marcado com divergência')
  // 2. Valor zero
  if (!l.valor || l.valor === 0) motivos.push('Valor R$ 0,00')
  // 3. Tarifa não cadastrada (só para RDO com valor zero)
  if ((!l.valor || l.valor === 0) && l.tipo_formulario === 'rdo' && tarifasMap) {
    const empresa = ((d.empresa || d.cliente || '')).trim().toLowerCase()
    const temTarifa = empresa && (tarifasMap[empresa] || Object.keys(tarifasMap).some(k => empresa.includes(k) || k.includes(empresa)))
    if (!temTarifa) motivos.push('Tarifa não cadastrada')
  }
  // 4. Sem assinatura do cliente
  if (!getClienteAss(l)) motivos.push('Sem assinatura do cliente')
  // 5. Horas totais zeradas
  const totalH = calcTotalHorasJornada(d)
  if (totalH != null && totalH === 0) motivos.push('Total de horas = 0')
  return motivos
}
function getOcrStatus(l) {
  // mantido para compatibilidade mas não exibido na UI
  return null
}

// ─── STATUS BADGE ERP ─────────────────────────────────────────────────────────
const ERP_STATUS_MAP = {
  aguardando_aprovacao: { label: 'Revisão Pendente',         bg: '#FFFBEB', color: '#B45309', border: '#FCD34D' },
  aprovado:             { label: 'Aguardando Lote',          bg: '#F0FDF4', color: '#065F46', border: '#86EFAC' },
  rascunho:             { label: 'Boletim Recebido',         bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  devolvido:            { label: 'Em Revisão',               bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA' },
  corrigido:            { label: 'Corrigido',                bg: '#EEF2FF', color: '#3730A3', border: '#A5B4FC' },
  faturado:             { label: 'Faturado',                 bg: '#F5F3FF', color: '#5B21B6', border: '#C4B5FD' },
  reprovado:            { label: 'Com Divergência',          bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  cancelado:            { label: 'Cancelado',                bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' },
  pendente:             { label: 'OCR Processado',           bg: '#F0FDF4', color: '#065F46', border: '#86EFAC' },
  revisar:              { label: 'Com Divergência',          bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  pago:                 { label: 'Faturado',                 bg: '#F5F3FF', color: '#5B21B6', border: '#C4B5FD' },
}
const ERP_LOTE_MAP = {
  aprovado_cliente: { label: 'Pronto para Lote',    bg: '#F0FDF4', color: '#065F46', border: '#86EFAC' },
  enviado_cliente:  { label: 'Lote Enviado',        bg: '#EEF2FF', color: '#3730A3', border: '#A5B4FC' },
  recusado_cliente: { label: 'Lote Recusado',       bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  rascunho:         { label: 'Em Lote',             bg: '#FFFBEB', color: '#B45309', border: '#FCD34D' },
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

// ─── SPARKLINE SVG ───────────────────────────────────────────────────────────
function Sparkline({ values = [], width = 200, height = 36, color = '#1D4ED8' }) {
  if (values.length < 2) return <svg width={width} height={height} />
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - 4 - ((v / max) * (height - 8)),
  ])
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const fill = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    + ` L${width},${height} L0,${height} Z`
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={fill} fill={color} fillOpacity={0.08} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => i === pts.length - 1
        ? <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={color} />
        : null
      )}
    </svg>
  )
}

// ─── BAR CHART HORIZONTAL ────────────────────────────────────────────────────
function HBarChart({ data, valueFormat = v => v, labelWidth = 130, valueWidth = 40 }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {data.map(({ label, value, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: labelWidth, fontSize: 11, color: C.textSec, textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
          <div style={{ flex: 1, height: 10, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color, borderRadius: 6, transition: 'width 0.4s ease', minWidth: value > 0 ? 4 : 0 }} />
          </div>
          <div style={{ width: valueWidth, fontSize: 11, fontWeight: 700, color: C.text, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap' }}>{valueFormat(value)}</div>
        </div>
      ))}
    </div>
  )
}

// ─── BAR CHART VERTICAL (colunas) ────────────────────────────────────────────
function VBarChart({ data, height = 80, valueFormat = v => v }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: height + 18, paddingBottom: 18, position: 'relative' }}>
      {data.map(({ label, value, color, showLabel }) => (
        <div
          key={label}
          title={value > 0 ? `${label}: ${valueFormat(value)}` : label}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}
        >
          <div style={{
            width: '100%',
            height: value > 0 ? Math.max((value / max) * height, 3) : 0,
            background: value > 0 ? color : 'transparent',
            borderRadius: '3px 3px 0 0',
            transition: 'height 0.5s ease',
          }} />
          {showLabel && (
            <div style={{
              position: 'absolute', bottom: -16, fontSize: 7, color: C.textSec,
              textAlign: 'center', width: '100%', overflow: 'hidden',
            }}>{label}</div>
          )}
        </div>
      ))}
    </div>
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
function DetailsDrawer({ record, lotesMap, navigate, onClose, onEdit }) {
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
            <Field label="Total de Horas" value={fmtTotalHorasJornada(d)} />
            <Field label="H Diurnas" value={d.horas_diurnas ? `${d.horas_diurnas}h` : '—'} />
            <Field label="H Noturnas" value={d.horas_noturnas ? `${d.horas_noturnas}h` : '—'} />
            <Field label="H FDS" value={(d.h_fds_diurnas || d.h_fds_noturnas) ? `${parseFloat(d.h_fds_diurnas||0)+parseFloat(d.h_fds_noturnas||0)}h` : '—'} />
            <Field label="H Feriado" value={(d.h_feriado_diurnas || d.h_feriado_noturnas) ? `${parseFloat(d.h_feriado_diurnas||0)+parseFloat(d.h_feriado_noturnas||0)}h` : '—'} />
          </Section>

          <Section title="Validação e Assinaturas">
            <Field label="Assinatura Cliente" value={getClienteAss(record) ? `✓ Confirmada${d.assinatura_cliente_nome ? ` — ${d.assinatura_cliente_nome}` : ''}` : 'Pendente'} />
            <Field label="Assinatura Birigui" value={getEmpresaAss(record) ? `✓ Confirmada${d.assinatura_birigui_nome ? ` — ${d.assinatura_birigui_nome}` : ''}` : 'Pendente'} />
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
          <button onClick={() => { onEdit(record); onClose() }} style={
            {flex: 2, padding: '10px', borderRadius: 8,
            background: C.navy, border: 'none',
            color: C.white, cursor: 'pointer', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <ArrowTopRightOnSquareIcon style={{ width: 15, height: 15 }} />
            Editar Lançamento
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TABLE CELL HELPERS ───────────────────────────────────────────────────────
const Th = ({ children, align = 'left', width, group }) => (
  <th style={{
    padding: group ? '6px 8px' : '7px 8px',
    fontSize: group ? 9 : 10, fontWeight: 700,
    letterSpacing: group ? 0.8 : 0.4,
    color: C.white,
    textAlign: align,
    whiteSpace: 'nowrap',
    minWidth: width || 'auto',
    borderRight: `1px solid rgba(255,255,255,0.15)`,
    background: 'rgba(0,0,0,0.18)',
  }}>
    {children}
  </th>
)

const Td = ({ children, align = 'left', muted, bold, green }) => (
  <td style={{
    padding: '8px 8px',
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

// ─── EXPORT / PRINT HELPERS ─────────────────────────────────────────────────
function exportCSV(rows, lotesMap) {
  const cols = [
    ['Nº',                 r => getLanNum(r)],
    ['Data',               r => fmtDate(r.data)],
    ['Processado Em',      r => fmtDateHora((r.dados_extras||{}).processado_em)],
    ['Empresa',            r => getEmpresa(r)],
    ['Cidade/UF',          r => getCidadeUF(r)],
    ['Solicitante',        r => getSolicitante(r)],
    ['Equipamento',        r => getEquipamento(r)],
    ['Placa',               r => (r.dados_extras || {}).placa || (r.dados_extras || {}).veiculo_placa || ''],
    ['Início Jornada',     r => (r.dados_extras||{}).jornada_inicio || ''],
    ['Fim Jornada',        r => (r.dados_extras||{}).jornada_fim || ''],
    ['Total Horas',        r => { const t = calcTotalHorasJornada(r.dados_extras); return t != null ? String(t) : '' }],
    ['H Diurnas',          r => (r.dados_extras||{}).horas_diurnas || ''],
    ['H Noturnas',         r => (r.dados_extras||{}).horas_noturnas || ''],
    ['H FDS Diurnas',      r => (r.dados_extras||{}).h_fds_diurnas || ''],
    ['H FDS Noturnas',     r => (r.dados_extras||{}).h_fds_noturnas || ''],
    ['H Feriado Diurnas',  r => (r.dados_extras||{}).h_feriado_diurnas || ''],
    ['H Feriado Noturnas', r => (r.dados_extras||{}).h_feriado_noturnas || ''],
    ['Cliente Assinado',   r => getClienteAss(r) ? 'Sim' : 'Não'],
    ['Birigui Assinado',   r => getEmpresaAss(r) ? 'Sim' : 'Não'],
    ['Valor (R$)',          r => (r.valor||0).toFixed(2).replace('.',',')],
    ['Status',             r => { const l = r.lote_cliente_id ? lotesMap[r.lote_cliente_id] : null; const conf = (l?.status && ERP_LOTE_MAP[l.status]) || ERP_STATUS_MAP[r.status]; return conf?.label || r.status || '' }],
  ]
  const header = cols.map(([h]) => h).join(';')
  const lines  = rows.map(r => cols.map(([,fn]) => { const v = String(fn(r)??''); return /[;"\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v }).join(';'))
  const csv    = '\uFEFF' + [header, ...lines].join('\r\n')
  const blob   = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href = url; a.download = `lancamentos-erp-${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

function printTable(rows, lotesMap, competencia, wsName) {
  // Colunas condicionais: só incluir se ao menos 1 registro tiver valor
  const temFdsDiurnas    = rows.some(r => { const v = parseFloat((r.dados_extras||{}).h_fds_diurnas||0); return v > 0 })
  const temFdsNoturnas   = rows.some(r => { const v = parseFloat((r.dados_extras||{}).h_fds_noturnas||0); return v > 0 })
  const temFeriadoD      = rows.some(r => { const v = parseFloat((r.dados_extras||{}).h_feriado_diurnas||0); return v > 0 })
  const temFeriadoN      = rows.some(r => { const v = parseFloat((r.dados_extras||{}).h_feriado_noturnas||0); return v > 0 })

  const cols = [
    ['Nº',               r => getLanNum(r)],
    ['Data',             r => fmtDate(r.data)],
    ['Empresa',          r => getEmpresa(r)],
    ['Cidade/UF',        r => getCidadeUF(r)],
    ['Solicitante',      r => getSolicitante(r)],
    ['Equipamento',      r => getEquipamento(r)],
    ['Placa',             r => (r.dados_extras || {}).placa || (r.dados_extras || {}).veiculo_placa || ''],
    ['Total Horas',      r => fmtTotalHorasJornada(r.dados_extras)],
    ['H Diurnas',        r => (r.dados_extras||{}).horas_diurnas||'—'],
    ['H Noturnas',       r => (r.dados_extras||{}).horas_noturnas||'—'],
    ...(temFdsDiurnas  ? [['H FDS Diurnas',    r => (r.dados_extras||{}).h_fds_diurnas||'—']] : []),
    ...(temFdsNoturnas ? [['H FDS Noturnas',   r => (r.dados_extras||{}).h_fds_noturnas||'—']] : []),
    ...(temFeriadoD    ? [['H Feriado Diur.',  r => (r.dados_extras||{}).h_feriado_diurnas||'—']] : []),
    ...(temFeriadoN    ? [['H Feriado Not.',   r => (r.dados_extras||{}).h_feriado_noturnas||'—']] : []),
    ['Cli. ✓',           r => getClienteAss(r) ? 'Sim' : 'Não'],
    ['Biri. ✓',          r => getEmpresaAss(r) ? 'Sim' : 'Não'],
    ['Valor (R$)',        r => fmtCurrency(r.valor)],
    ['Status',           r => { const l = r.lote_cliente_id ? lotesMap[r.lote_cliente_id] : null; const conf = (l?.status && ERP_LOTE_MAP[l.status]) || ERP_STATUS_MAP[r.status]; return conf?.label||r.status||'' }],
  ]
  const mo    = `${String(competencia.month).padStart(2,'0')}/${competencia.year}`
  const thead = cols.map(([h]) => `<th>${h}</th>`).join('')
  const tbody = rows.map(r => `<tr>${cols.map(([,fn]) => `<td>${fn(r)}</td>`).join('')}</tr>`).join('')
  const html  = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lançamentos ${mo}</title><style>
    body{font-family:Arial,sans-serif;font-size:11px;margin:24px;color:#172033}
    h2{color:#0B1F3A;margin:0 0 4px}p{color:#64748B;margin:0 0 14px;font-size:12px}
    table{width:100%;border-collapse:collapse}th{background:#0B1F3A;color:#fff;padding:6px 8px;text-align:left;font-size:10px;letter-spacing:.5px}
    td{padding:5px 8px;border-bottom:1px solid #eee;font-size:11px}tr:nth-child(even){background:#f8fafc}
    @media print{@page{size:A4 landscape;margin:12mm}}
  </style></head><body>
    <h2>Lançamentos Operacionais — ${mo}</h2>
    <p>${wsName} · ${rows.length} registro${rows.length!==1?'s':''} · Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script>
  </body></html>`
  const w = window.open('', '_blank'); w.document.write(html); w.document.close()
}

// ─── AUDIT MODAL ──────────────────────────────────────────────────────────────
function AuditModal({ record, onClose }) {
  const [evs, setEvs] = useState(null)
  useEffect(() => {
    if (!record) return
    supabase.from('lancamento_eventos')
      .select('*')
      .eq('lancamento_id', record.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEvs(data || []))
  }, [record?.id])
  if (!record) return null
  const TIPO_LABEL = { criado:'Boletim Recebido', editado:'Lançamento Editado', aprovado:'Aguardando Lote', reprovado:'Divergência Registrada', devolvido:'Em Revisão', faturado:'Faturado', enviado_lote:'Lote Enviado', aprovado_cliente:'Pronto para Lote', revisado:'Revisado', corrigido:'Divergência Corrigida', processado_ia:'OCR Processado' }
  return (
    <div style={{ position:'fixed', inset:0, zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(11,31,58,0.5)' }} />
      <div style={{ position:'relative', width:440, maxHeight:'80vh', background:C.white, borderRadius:12, boxShadow:'0 16px 48px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ background:C.navy, padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', fontWeight:700, letterSpacing:.8, textTransform:'uppercase' }}>Histórico de Auditoria</div>
            <div style={{ fontSize:15, fontWeight:800, color:C.white, marginTop:2 }}>{getLanNum(record)}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:6, cursor:'pointer', color:C.white, padding:6, display:'flex' }}>
            <XMarkIcon style={{ width:16, height:16 }} />
          </button>
        </div>
        <div style={{ overflowY:'auto', padding:'16px 20px', flex:1 }}>
          {evs === null && <div style={{ textAlign:'center', padding:24, color:C.textSec, fontSize:13 }}>Carregando...</div>}
          {evs !== null && evs.length === 0 && (
            <div style={{ textAlign:'center', padding:24, color:C.textSec, fontSize:13 }}>Nenhum evento registrado</div>
          )}
          {evs !== null && evs.map(ev => {
            const dt = new Date(ev.created_at)
            const dtStr = `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`
            return (
              <div key={ev.id} style={{ display:'flex', gap:12, paddingBottom:14, marginBottom:14, borderBottom:`1px solid ${C.border}` }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:C.blue, marginTop:5, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{TIPO_LABEL[ev.tipo] || ev.tipo}</div>
                  {ev.descricao && <div style={{ fontSize:11, color:C.textSec, marginTop:2 }}>{ev.descricao}</div>}
                  <div style={{ fontSize:10, color:C.textSec, marginTop:4, display:'flex', gap:8 }}>
                    <span>{dtStr}</span>
                    {ev.usuario_nome && <span>· {ev.usuario_nome}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── CRIAR LOTE MODAL ─────────────────────────────────────────────────────────
function CriarLoteModal({ itens, workspaceId, userId, onClose, onSaved }) {
  const [cliente, setCliente] = useState(() => {
    const nomes = [...new Set(itens.map(l => l.dados_extras?.empresa || l.dados_extras?.cliente || '').filter(Boolean))]
    return nomes.length === 1 ? nomes[0] : ''
  })
  const [saving, setSaving] = useState(false)
  const totalVal = itens.reduce((s, l) => s + (l.valor || 0), 0)
  const nomesDist = [...new Set(itens.map(l => l.dados_extras?.empresa || l.dados_extras?.cliente || '').filter(Boolean))]

  async function confirmar() {
    if (!cliente.trim()) { toast.error('Informe o nome do cliente.'); return }
    setSaving(true)
    try {
      const { data: lote, error: errL } = await supabase
        .from('lotes_cliente')
        .insert({ workspace_id: workspaceId, cliente: cliente.trim(), created_by: userId, status: 'rascunho' })
        .select('id').single()
      if (errL) throw errL
      const { error: errUp } = await supabase.from('lancamentos')
        .update({ lote_cliente_id: lote.id })
        .in('id', itens.map(l => l.id))
      if (errUp) throw errUp
      toast.success(`Lote criado com ${itens.length} lançamento(s).`)
      onSaved()
    } catch (e) { toast.error('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(11,31,58,0.55)' }} />
      <div style={{ position: 'relative', width: 460, background: C.white, borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ background: C.navy, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase' }}>Criar Lote para Cliente</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginTop: 2 }}>{itens.length} lançamento(s) selecionado(s)</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, cursor: 'pointer', color: C.white, padding: 6, display: 'flex' }}>
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          {nomesDist.length > 1 && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400E' }}>
              ⚠️ <strong>Empresas diferentes:</strong> {nomesDist.join(' · ')}
            </div>
          )}
          <label style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5 }}>Cliente *</label>
          <input
            value={cliente} onChange={e => setCliente(e.target.value)} autoFocus
            placeholder="Nome do cliente para o lote"
            style={{ width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: C.text }}
          />
          <div style={{ marginTop: 14, padding: '12px 14px', background: '#F8FAFC', borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: C.textSec }}><strong style={{ color: C.text }}>{itens.length}</strong> lançamento(s)</span>
            <span style={{ fontWeight: 700, color: C.green }}>{fmtCurrency(totalVal)}</span>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={confirmar} disabled={saving || !cliente.trim()} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#6366F1', color: C.white, cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: (saving || !cliente.trim()) ? 0.6 : 1 }}>
            {saving ? 'Criando...' : 'Criar Lote'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ADICIONAR A LOTE EXISTENTE MODAL ─────────────────────────────────────────
function AdicionarLoteModal({ record, workspaceId, onClose, onSaved }) {
  const [lotes, setLotes]     = useState(null)
  const [chosen, setChosen]   = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    supabase.from('lotes_cliente')
      .select('id, cliente, status, created_at')
      .eq('workspace_id', workspaceId)
      .in('status', ['rascunho', 'enviado_cliente'])
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setLotes(data || []))
  }, [workspaceId])

  async function confirmar() {
    if (!chosen) { toast.error('Selecione um lote.'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('lancamentos')
        .update({ lote_cliente_id: chosen })
        .eq('id', record.id)
      if (error) throw error
      toast.success('Lançamento adicionado ao lote.')
      onSaved()
    } catch (e) { toast.error('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  const STATUS_LABEL = { rascunho: 'Em lote (rascunho)', enviado_cliente: 'Lote gerado' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(11,31,58,0.55)' }} />
      <div style={{ position: 'relative', width: 460, background: C.white, borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ background: C.navy, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase' }}>Adicionar ao Lote</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginTop: 2 }}>{getLanNum(record)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, cursor: 'pointer', color: C.white, padding: 6, display: 'flex' }}>
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div style={{ padding: '20px', maxHeight: 360, overflowY: 'auto' }}>
          {lotes === null && <div style={{ textAlign: 'center', padding: 24, color: C.textSec, fontSize: 13 }}>Carregando lotes...</div>}
          {lotes !== null && lotes.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: C.textSec, fontSize: 13 }}>
              Nenhum lote aberto encontrado.<br />
              <span style={{ fontSize: 11 }}>Crie um lote primeiro selecionando registros.</span>
            </div>
          )}
          {lotes !== null && lotes.map(lt => (
            <label key={lt.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, border: `2px solid ${chosen === lt.id ? C.blue : C.border}`, marginBottom: 8, cursor: 'pointer', background: chosen === lt.id ? '#EFF6FF' : C.white, transition: 'all .15s' }}>
              <input type="radio" name="lote" value={lt.id} checked={chosen === lt.id} onChange={() => setChosen(lt.id)} style={{ accentColor: C.blue }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{lt.cliente}</div>
                <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{STATUS_LABEL[lt.status] || lt.status} · {new Date(lt.created_at).toLocaleDateString('pt-BR')}</div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={confirmar} disabled={saving || !chosen} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#6366F1', color: C.white, cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: (saving || !chosen) ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : 'Adicionar ao Lote'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ENVIAR WA MODAL ─────────────────────────────────────────────────────────
function EnviarWAModal({ itens, wsName, onClose }) {
  const [telefone, setTelefone] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [sending, setSending]   = useState(false)

  const total = itens.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0)

  async function handleEnviar() {
    const digits = telefone.replace(/\D/g, '')
    if (digits.length < 10) { toast.error('Informe DDD + número'); return }
    setSending(true)
    try {
      const loteMock = { id: `WA${Date.now()}`, cliente: wsName || 'Relatório' }
      const doc = buildReciboERP({ lancamentos: itens, lote: loteMock })
      const pdfBase64 = doc.output('datauristring').split(',')[1]
      const dataStr   = new Date().toISOString().slice(0, 10)
      const res = await fetch('/api/wa-boletins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone,
          pdfBase64,
          pdfNome: `boletins-${dataStr}.pdf`,
          mensagem: mensagem.trim() || `Relatório com ${itens.length} lançamento(s) — Total: ${fmtCurrency(total)}`,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar')
      toast.success('PDF enviado via WhatsApp!')
      onClose()
    } catch (e) { toast.error(e.message) }
    finally { setSending(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(11,31,58,0.55)' }} />
      <div style={{ position: 'relative', width: 460, background: C.white, borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#128C7E', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase' }}>Enviar via WhatsApp</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 2 }}>{itens.length} registro{itens.length !== 1 ? 's' : ''} · {fmtCurrency(total)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#fff', padding: 6, display: 'flex' }}>
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: 20 }}>
          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <DocumentArrowDownIcon style={{ width: 22, height: 22, color: '#059669', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>PDF — Lançamentos Operacionais</div>
              <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>{itens.length} registro{itens.length !== 1 ? 's' : ''} · Total {fmtCurrency(total)}</div>
            </div>
          </div>
          <label style={{ display: 'block', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5 }}>Telefone com DDD *</span>
            <input
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
              placeholder="(67) 9 9999-9999"
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => { e.target.style.borderColor = '#128C7E' }}
              onBlur={e => { e.target.style.borderColor = C.border }}
            />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5 }}>Mensagem (opcional)</span>
            <textarea
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              rows={3}
              placeholder={`Relatório com ${itens.length} lançamento(s) — Total: ${fmtCurrency(total)}`}
              style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              onFocus={e => { e.target.style.borderColor = '#128C7E' }}
              onBlur={e => { e.target.style.borderColor = C.border }}
            />
          </label>
        </div>
        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button
            onClick={handleEnviar}
            disabled={sending || !telefone.replace(/\D/g, '').length}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: sending ? '#6B7280' : '#128C7E', color: '#fff', cursor: (sending || !telefone.replace(/\D/g, '').length) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, opacity: (sending || !telefone.replace(/\D/g, '').length) ? 0.7 : 1 }}
          >
            <PaperAirplaneIcon style={{ width: 14, height: 14 }} />
            {sending ? 'Enviando...' : 'Enviar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function LancamentosERP() {
  const { workspaceId, isPlatformAdmin, enabledModules } = useStore()
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

  // Filtros (persistidos em localStorage)
  const [competencia, setCompetencia]   = useState(() => { try { const s = JSON.parse(localStorage.getItem('erp_filters') || '{}'); return s.competencia || { month: new Date().getMonth() + 1, year: new Date().getFullYear() } } catch { return { month: new Date().getMonth() + 1, year: new Date().getFullYear() } } })
  const [filterStatus, setFilterStatus] = useState(() => { try { return JSON.parse(localStorage.getItem('erp_filters') || '{}').filterStatus || 'todos' } catch { return 'todos' } })
  const [filterForm, setFilterForm]     = useState('rdo')
  const [filterCliente, setFilterCliente] = useState(() => { try { return JSON.parse(localStorage.getItem('erp_filters') || '{}').filterCliente || '' } catch { return '' } })
  const [dateFrom, setDateFrom]         = useState(() => { try { return JSON.parse(localStorage.getItem('erp_filters') || '{}').dateFrom || '' } catch { return '' } })
  const [dateTo, setDateTo]             = useState(() => { try { return JSON.parse(localStorage.getItem('erp_filters') || '{}').dateTo || '' } catch { return '' } })
  const [search, setSearch]             = useState('')

  // Persiste filtros ao alterar
  useEffect(() => {
    localStorage.setItem('erp_filters', JSON.stringify({ competencia, filterStatus, filterCliente, dateFrom, dateTo }))
  }, [competencia, filterStatus, filterCliente, dateFrom, dateTo])

  // UI
  const [page, setPage]                 = useState(1)
  const pageSize                        = 25
  const [drawerRecord, setDrawerRecord] = useState(null)
  const [actionMenuId, setActionMenuId] = useState(null)
  const [actionMenuPos, setActionMenuPos] = useState({ top: 0, right: 0 })
  const [selecionados, setSelecionados] = useState(new Set())
  const [auditModal, setAuditModal]     = useState(null)
  const [editModal, setEditModal]       = useState(null)   // record a editar
  const [formTemplates, setFormTemplates] = useState({})
  const [loteModal, setLoteModal]       = useState(false)   // criar lote com selecionados
  const [waModal, setWaModal]           = useState(false)   // enviar selecionados via WA
  const [exportMenu, setExportMenu]     = useState(false)
  const exportMenuRef                   = useRef(null)

  // Fecha export menu ao clicar fora
  useEffect(() => {
    if (!exportMenu) return
    const h = (e) => { if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setExportMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [exportMenu])
  const [addLoteModal, setAddLoteModal] = useState(null)    // adicionar 1 registro a lote existente
  const [userId, setUserId]             = useState(null)
  const [visiblePanels, setVisiblePanels] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('erp_panels') || 'null')
      return saved ? new Set(saved) : new Set(['resumo', 'fila', 'auditoria', 'acoes'])
    } catch { return new Set(['resumo', 'fila', 'auditoria', 'acoes']) }
  })
  const actionMenuRef                   = useRef(null)

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null))
  }, [])

  // ── Validação rápida (toggle) ───────────────────────────────────────────
  async function toggleValidado(l) {
    const novoStatus = l.status === 'aprovado' ? 'rascunho' : 'aprovado'
    try {
      const { error } = await supabase.from('lancamentos').update({ status: novoStatus }).eq('id', l.id)
      if (error) throw error
      await registrarEvento({
        lancamentoId: l.id,
        tipo: novoStatus === 'aprovado' ? 'aprovado' : 'editado',
        statusDe: l.status,
        statusPara: novoStatus,
        descricao: novoStatus === 'aprovado' ? 'Validado internamente pelo conferente' : 'Validação revertida',
        usuarioId: userId,
      })
      toast.success(novoStatus === 'aprovado' ? 'Validado — Pronto para Lote!' : 'Validação revertida')
      loadData()
    } catch (e) { toast.error('Erro: ' + e.message) }
  }

  async function validarSelecionados() {
    const ids = [...selecionados].filter(id => {
      const l = lancamentos.find(x => x.id === id)
      return l && l.status !== 'aprovado'
    })
    if (!ids.length) { toast('Todos já estão validados', { icon: 'ℹ️' }); return }
    try {
      const { error } = await supabase.from('lancamentos').update({ status: 'aprovado' }).in('id', ids)
      if (error) throw error
      await Promise.all(ids.map(id => registrarEvento({ lancamentoId: id, tipo: 'aprovado', statusPara: 'aprovado', descricao: 'Validação em lote pelo conferente', usuarioId: userId })))
      toast.success(`${ids.length} boletim(ns) validado(s)`)
      setSelecionados(new Set())
      loadData()
    } catch (e) { toast.error('Erro: ' + e.message) }
  }

  async function excluirLancamento(l) {
    if (!confirm(`Excluir lançamento ${l.dados_extras?.numero_rdo || l.id.slice(0, 8)}? Esta ação não pode ser desfeita.`)) return
    try {
      const { error } = await supabase.from('lancamentos').delete().eq('id', l.id)
      if (error) throw error
      toast.success('Lançamento excluído')
      loadData()
    } catch (e) { toast.error('Erro ao excluir: ' + e.message) }
  }

  // ── Form templates (para modal de edição) ─────────────────────────────────
  useEffect(() => {
    if (!workspaceId) return
    supabase?.from('form_templates')
      .select('id, nome, tipo_base, campos')
      .eq('workspace_id', workspaceId)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .then(({ data: tmpls }) => {
        const map = {}
        ;(tmpls || []).forEach(t => { if (t.tipo_base && !map[t.tipo_base]) map[t.tipo_base] = t })
        setFormTemplates(map)
      })
  }, [workspaceId])

  // ── Workspace config ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) return
    loadWorkspaceConfig(workspaceId).then(cfg => {
      const df = getConfig(cfg, 'ui.lancamentos.default_filter', null)
      if (df) setFilterForm(df)
    })
    supabase?.from('workspaces').select('nome').eq('id', workspaceId).maybeSingle()
      .then(({ data }) => { if (data?.nome) setWsName(data.nome) })
  }, [workspaceId])

  // ── Data load ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!workspaceId || !supabase) return
    setLoading(true)

    // Se datas livres preenchidas, usa elas; senão usa o mês da competência
    let queryIni, queryFim
    if (dateFrom && dateTo) {
      queryIni = dateFrom
      queryFim = dateTo
    } else {
      const now = new Date()
      const y = competenciaAjustada.current ? competencia.year  : now.getFullYear()
      const m = competenciaAjustada.current ? competencia.month : now.getMonth() + 1
      queryIni = `${y}-${String(m).padStart(2, '0')}-01`
      queryFim = new Date(y, m, 0).toISOString().slice(0, 10) // último dia do mês
    }

    const [{ data, error }, { data: td }] = await Promise.all([
      supabase
        .from('lancamentos')
        .select('id, data, created_at, status, tipo, valor, tipo_formulario, lote_cliente_id, comprovante_url, observacoes, dados_extras, duplicata, duplicata_de_id')
        .eq('workspace_id', workspaceId)
        .gte('data', queryIni)
        .lte('data', queryFim)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('diario_tarifas')
        .select('*')
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

    // ── Auto-calcula valor nos registros com valor = 0 (só mês atual) ────────
    const semValor = items.filter(l => (!l.valor || l.valor === 0) && l.tipo_formulario === 'rdo')
    if (semValor.length > 0) {
      const atualizacoes = semValor
        .map(l => ({ l, calc: calcRdoPricingTotal(l, tarifasM) }))
        .filter(({ calc }) => calc != null && calc > 0)
      if (atualizacoes.length > 0) {
        await Promise.all(atualizacoes.map(({ l, calc }) =>
          supabase.from('lancamentos').update({ valor: calc }).eq('id', l.id)
        ))
        // Atualiza localmente sem recarregar tudo
        const updMap = Object.fromEntries(atualizacoes.map(({ l, calc }) => [l.id, calc]))
        setLancamentos(items.map(l => updMap[l.id] ? { ...l, valor: updMap[l.id] } : l))
        setLastUpdate(new Date())
      }
    }

    // Auto-ajusta competência para o mês mais recente com dados (só na primeira carga)
    // Agora que a query é filtrada: se não veio nada no mês atual, não há ajuste automático
    // O usuário navega manualmente pelas setas de competência
    competenciaAjustada.current = true

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

    setLoading(false)
  }, [workspaceId, competencia, dateFrom, dateTo])

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

  // ── Filtro (memoizado — evita recriar array em cada render não relacionado) ───
  const filtered = useMemo(() => lancamentos.filter(l => {
    // Período — query já filtra por competência; intervalo livre sobrepõe localmente
    if (l.data && (dateFrom || dateTo)) {
      if (dateFrom && l.data < dateFrom) return false
      if (dateTo   && l.data > dateTo)   return false
    }
    // Tipo formulário — null/undefined é tratado como 'rdo' neste workspace
    if (filterForm && filterForm !== 'todos') {
      if (filterForm === 'dm') {
        if (!['diario', 'transporte'].includes(l.tipo_formulario || 'padrao')) return false
      } else {
        const tf = l.tipo_formulario || 'rdo'
        if (tf !== filterForm) return false
      }
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
  }), [lancamentos, filterForm, filterStatus, filterCliente, search, dateFrom, dateTo]) // eslint-disable-line

  // ── Paginação ──────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize)
  useEffect(() => { setPage(1) }, [filterForm, filterStatus, filterCliente, search, competencia, dateFrom, dateTo])
  // Limpa seleção ao mudar filtro
  useEffect(() => { setSelecionados(new Set()) }, [filterForm, filterStatus, filterCliente, search, competencia])

  // ── Divergências memoizadas (evita recalcular por linha no render) ─────────
  const divergenciasMap = useMemo(
    () => Object.fromEntries(filtered.map(l => [l.id, getDivergencias(l, tarifasMap)])),
    [filtered, tarifasMap] // eslint-disable-line
  )

  // ── KPIs (passagem única) ─────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let totalReceitas = 0, totalDespesas = 0, boletinsRecebidos = 0, totalDuplicatas = 0
    let pendenteRevisao = 0, comDivergencia = 0, aguardandoLote = 0, prontosLote = 0
    let boletinsRecebidosDist = 0, emRevisaoDist = 0
    for (const l of filtered) {
      const lote = l.lote_cliente_id ? lotesMap[l.lote_cliente_id] : null
      const divs = divergenciasMap[l.id] || []
      if (!l.duplicata) {
        boletinsRecebidos++
        if (l.tipo === 'receita') totalReceitas += l.valor || 0
        if (l.tipo === 'despesa') totalDespesas += l.valor || 0
      } else {
        totalDuplicatas++
      }
      if (l.status === 'rascunho' || l.status === 'aguardando_aprovacao' || l.status === 'pendente') pendenteRevisao++
      if (divs.length > 0) comDivergencia++
      if ((l.status === 'aprovado' || l.status === 'corrigido') && !lote) aguardandoLote++
      if (lote && lote.status === 'aprovado_cliente') prontosLote++
      if (l.status === 'rascunho' || l.status === 'pendente') boletinsRecebidosDist++
      if (l.status === 'devolvido') emRevisaoDist++
    }
    return { totalReceitas, totalDespesas, boletinsRecebidos, totalDuplicatas, pendenteRevisao, comDivergencia, aguardandoLote, prontosLote, boletinsRecebidosDist, emRevisaoDist }
  }, [filtered, lotesMap, divergenciasMap]) // eslint-disable-line

  const { totalReceitas, totalDespesas, boletinsRecebidos, totalDuplicatas, pendenteRevisao, comDivergencia, aguardandoLote, prontosLote } = kpis
  const saldoOp = totalReceitas - totalDespesas

  // ── Donut: distribuição de status ─────────────────────────────────────────
  const statusDist = [
    { label: 'Aguardando Lote',   value: aguardandoLote,              color: C.green  },
    { label: 'Revisão Pendente',  value: pendenteRevisao,             color: C.amber  },
    { label: 'Com Divergência',   value: comDivergencia,              color: C.red    },
    { label: 'Boletins Recebidos',value: kpis.boletinsRecebidosDist,  color: '#6366F1' },
    { label: 'Em Revisão',        value: kpis.emRevisaoDist,          color: '#F97316' },
    { label: 'Prontos para Lote', value: prontosLote,                 color: '#0EA5E9' },
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

  // ── Clientes únicos para filtro (memoizado) ──────────────────────────────
  const clientesUnicos = useMemo(
    () => [...new Set(filtered.map(l => getEmpresa(l)).filter(e => e && e !== '—'))].sort(),
    [filtered] // eslint-disable-line
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  const inputSel = {
    padding: '5px 8px', borderRadius: 5, border: `1px solid ${C.border}`,
    background: C.white, color: C.text, fontSize: 12, outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div style={{ background: C.bgPage, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ══ PAINEL FLUTUANTE DE SELEÇÃO ═══════════════════════════════════ */}
      {selecionados.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: C.navy, borderRadius: 10,
          boxShadow: '0 8px 32px rgba(11,31,58,0.35)',
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.white, marginRight: 4 }}>
            {selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}
          </span>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <button onClick={validarSelecionados} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: 'none', background: C.green, color: C.white, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <CheckCircleIcon style={{ width: 14, height: 14 }} /> Validar ({selecionados.size})
          </button>
          <button onClick={() => { const itens = filtered.filter(l => selecionados.has(l.id)); if (itens.length === 0) return; setLoteModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: 'none', background: '#6366F1', color: C.white, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <UserGroupIcon style={{ width: 14, height: 14 }} /> Gerar Lote
          </button>
          <button onClick={() => exportCSV(filtered.filter(l => selecionados.has(l.id)), lotesMap)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: C.white, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <TableCellsIcon style={{ width: 14, height: 14 }} /> Excel
          </button>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <button onClick={() => setSelecionados(new Set())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: 4, display: 'flex' }} title="Limpar seleção">
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

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

        </div>

        {/* Barra de contexto */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          height: 34, borderTop: `1px solid ${C.border}`,
          fontSize: 12, color: C.textSec,
        }}>
          {[
            ['Cliente', wsName],
            ['Competência', `${MONTHS[competencia.month - 1]}/${competencia.year}`],
            ['Status', filterStatus === 'todos' ? 'Todos' : (ERP_STATUS_MAP[filterStatus]?.label || filterStatus)],
          ].map(([label, value], i) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              paddingRight: 16, marginRight: 16,
              borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
            }}>
              <span style={{ color: C.textSec }}>{label}:</span>
              <span style={{ color: C.navy, fontWeight: 700 }}>{value}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Atualização */}
            <span style={{ color: C.textSec, fontSize: 10, opacity: 0.7 }}>
              {lastUpdate ? `${lastUpdate.toLocaleDateString('pt-BR')} ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '—'}
            </span>
            <button onClick={loadData} title="Atualizar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: 2, display: 'flex' }}>
              <ArrowPathIcon style={{ width: 13, height: 13 }} />
            </button>

            {/* Separador */}
            <div style={{ width: 1, height: 18, background: C.border, margin: '0 6px' }} />

            {/* Grupo 1 — Ação primária */}
            <button onClick={() => setEditModal('novo')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: C.blue, color: C.white, fontSize: 12, cursor: 'pointer', fontWeight: 700, boxShadow: '0 1px 3px rgba(29,78,216,0.3)' }}>
              <PlusIcon style={{ width: 13, height: 13 }} /> Novo Lançamento
            </button>
            <button onClick={() => navigate('/boletins-diarios')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: `1px solid #A5B4FC`, background: '#EEF2FF', color: '#4338CA', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <SparklesIcon style={{ width: 12, height: 12 }} /> Digitalizar OCR
            </button>

            {/* Separador */}
            <div style={{ width: 1, height: 18, background: C.border, margin: '0 6px' }} />

            {/* Grupo 2 — Ações operacionais */}
            <button onClick={validarSelecionados} title="Validar selecionados internamente" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.green}`, background: selecionados.size > 0 ? '#F0FDF4' : 'transparent', color: C.green, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <CheckCircleIcon style={{ width: 12, height: 12 }} /> Validar{selecionados.size > 0 && ` (${selecionados.size})`}
            </button>
            <button onClick={() => { const itens = filtered.filter(l => selecionados.has(l.id)); if (itens.length === 0) { toast.error('Selecione ao menos 1 lançamento.'); return }; setLoteModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1px solid #A5B4FC`, background: 'transparent', color: '#6366F1', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <UserGroupIcon style={{ width: 12, height: 12 }} /> Gerar Lote{selecionados.size > 0 && ` (${selecionados.size})`}
            </button>
            <button onClick={() => { if (selecionados.size === 0) { toast.error('Selecione ao menos 1 lançamento.'); return }; setWaModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1px solid #86EFAC`, background: selecionados.size > 0 ? '#F0FDF4' : 'transparent', color: '#128C7E', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <PaperAirplaneIcon style={{ width: 12, height: 12 }} /> WA{selecionados.size > 0 && ` (${selecionados.size})`}
            </button>

            {/* Separador */}
            <div style={{ width: 1, height: 18, background: C.border, margin: '0 6px' }} />

            {/* Grupo 3 — Exportação */}
            <button onClick={() => exportCSV(filtered, lotesMap)} title="Exportar Excel" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <TableCellsIcon style={{ width: 12, height: 12, color: C.green }} /> Excel
            </button>
            <button onClick={() => printTable(filtered, lotesMap, competencia, wsName)} title="Gerar PDF" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <DocumentArrowDownIcon style={{ width: 12, height: 12, color: C.red }} /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* ══ MAIN CONTENT ════════════════════════════════════════════════════ */}
      <div style={{ padding: '12px 16px' }}>

        {/* ── KPI STRIP ──────────────────────────────────────────────────── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', alignItems: 'stretch', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {[
            { label: 'Receitas Apuradas',  value: fmtCurrency(totalReceitas), color: C.green,   accent: '#F0FDF4', Icon: BanknotesIcon,             alert: false },
            { label: 'Boletins Recebidos', value: boletinsRecebidos,          color: C.blue,    accent: '#EFF6FF', Icon: ClipboardDocumentListIcon,  alert: false },
            { label: 'Revisão Pendente',   value: pendenteRevisao,            color: C.amber,   accent: pendenteRevisao > 0 ? '#FFFBEB' : '#F8FAFC', Icon: ClockIcon,      alert: pendenteRevisao > 0 },
            { label: 'Com Divergência',    value: comDivergencia,             color: C.red,     accent: comDivergencia > 0 ? '#FEF2F2' : '#F8FAFC',  Icon: ExclamationTriangleIcon, alert: comDivergencia > 0 },
            { label: 'Aguardando Lote',    value: aguardandoLote,             color: '#0EA5E9', accent: '#F0F9FF', Icon: DocumentTextIcon,            alert: false },
            { label: 'Prontos para Lote',  value: prontosLote,                color: '#7C3AED', accent: '#F5F3FF', Icon: CheckCircleIcon,             alert: false },
            ...(totalDuplicatas > 0 ? [{ label: 'Duplicatas', value: totalDuplicatas, color: C.amber, accent: '#FFFBEB', Icon: BellAlertIcon, alert: true }] : []),
          ].map(({ label, value, color, accent, Icon, alert }, i, arr) => (
            <div key={label} style={{
              flex: 1, padding: '10px 14px',
              borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
              borderLeft: `3px solid ${alert ? color : 'transparent'}`,
              borderTop: alert ? `1px solid ${color}22` : undefined,
              background: accent,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: alert ? `${color}22` : `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 15, height: 15, color }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: alert ? color : C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── FILTROS + AÇÕES ───────────────────────────────────────────── */}
        <div style={{
          background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: '10px 12px', marginBottom: 10,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {/* Título do bloco */}
          <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FunnelIcon style={{ width: 11, height: 11 }} />
            Filtros de Consulta
          </div>
          {/* Linha única: todos os filtros + botões */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>BUSCAR</div>
              <div style={{ position: 'relative' }}>
                <MagnifyingGlassIcon style={{ width: 13, height: 13, color: C.textSec, position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nº, empresa, placa..." style={{ ...inputSel, paddingLeft: 24, width: 160 }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>TIPO DE DOCUMENTO</div>
              <div style={{ ...inputSel, cursor: 'default', color: C.textSec, background: '#F8FAFC' }}>Relatório Diário de Obra</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>STATUS</div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputSel}>
                <option value="todos">Todos</option>
                <option value="rascunho">Boletim Recebido</option>
                <option value="pendente">OCR Processado</option>
                <option value="aguardando_aprovacao">Revisão Pendente</option>
                <option value="devolvido">Em Revisão</option>
                <option value="revisar">Com Divergência</option>
                <option value="corrigido">Corrigido</option>
                <option value="aprovado">Validado Internamente</option>
                <option value="faturado">Faturado</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>CLIENTE</div>
              <select value={filterCliente} onChange={e => setFilterCliente(e.target.value)} style={inputSel}>
                <option value="">Todos</option>
                {clientesUnicos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Separador visual */}
            <div style={{ width: 1, height: 30, background: C.border, alignSelf: 'flex-end', margin: '0 2px' }} />

            {/* Competência */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>COMPETÊNCIA</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={prevCompetencia} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', padding: '5px 6px', color: C.textSec, display: 'flex' }}>
                  <ChevronLeftIcon style={{ width: 14, height: 14 }} />
                </button>
                <span style={{ fontSize: 12, fontWeight: 700, color: dateFrom || dateTo ? C.textSec : C.navy, minWidth: 90, textAlign: 'center', opacity: dateFrom || dateTo ? 0.4 : 1 }}>
                  {MONTHS[competencia.month - 1]}/{competencia.year}
                </span>
                <button onClick={nextCompetencia} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', padding: '5px 6px', color: C.textSec, display: 'flex' }}>
                  <ChevronRightIcon style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
            <div style={{ alignSelf: 'flex-end', paddingBottom: 6, color: C.textSec, fontSize: 10, fontWeight: 500 }}>ou</div>
            {/* Data inicial */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>DATA INICIAL</div>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: 5, border: `1px solid ${dateFrom ? C.blue : C.border}`, background: C.white, color: C.text, fontSize: 12, outline: 'none', cursor: 'pointer', height: 30 }} />
            </div>
            {/* Data final */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>DATA FINAL</div>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: 5, border: `1px solid ${dateTo ? C.blue : C.border}`, background: C.white, color: C.text, fontSize: 12, outline: 'none', cursor: 'pointer', height: 30 }} />
            </div>
            {/* Atalhos de período */}
            <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 4 }}>
              {[10, 15, 30, 60].map(dias => {
                const hoje = new Date()
                const ini  = new Date(hoje); ini.setDate(hoje.getDate() - dias + 1)
                const iniStr = ini.toISOString().slice(0, 10)
                const fimStr = hoje.toISOString().slice(0, 10)
                const ativo  = dateFrom === iniStr && dateTo === fimStr
                return (
                  <button key={dias}
                    onClick={() => { setDateFrom(iniStr); setDateTo(fimStr) }}
                    style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${ativo ? C.blue : C.border}`, background: ativo ? '#EFF6FF' : 'transparent', color: ativo ? C.blue : C.textSec, fontSize: 11, cursor: 'pointer', fontWeight: ativo ? 700 : 500, height: 30 }}>
                    {dias}d
                  </button>
                )
              })}
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo('') }}
                  style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, fontSize: 11, cursor: 'pointer', fontWeight: 600, height: 30 }}>
                  ✕
                </button>
              )}
            </div>

            {/* Separador visual */}
            <div style={{ width: 1, height: 30, background: C.border, alignSelf: 'flex-end', margin: '0 2px' }} />

            {/* Botões filtro — ordem: Filtrar, Limpar, Exportar */}
            <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
              <button
                onClick={loadData}
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: C.blue, color: C.white, fontSize: 12, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, height: 30 }}
              >
                <FunnelIcon style={{ width: 13, height: 13 }} /> Filtrar
              </button>
              <button
                onClick={() => { setFilterStatus('todos'); setFilterCliente(''); setSearch(''); setFilterForm('rdo'); setDateFrom(''); setDateTo('') }}
                style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, fontSize: 12, cursor: 'pointer', fontWeight: 600, height: 30 }}
              >Limpar</button>
              {/* Exportar dropdown */}
              <div ref={exportMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setExportMenu(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 12, cursor: 'pointer', fontWeight: 600, height: 30 }}
                >
                  <ArrowDownTrayIcon style={{ width: 13, height: 13, color: C.green }} /> Exportar <ChevronDownIcon style={{ width: 11, height: 11, color: C.textSec }} />
                </button>
                {exportMenu && (
                  <div
                    style={{ position: 'absolute', top: '100%', left: 0, zIndex: 500, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: 220, marginTop: 4, overflow: 'hidden' }}
                    onMouseLeave={() => setExportMenu(false)}
                  >
                    <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5 }}>Por Período</div>
                    <button onClick={() => { exportCSV(filtered, lotesMap); setExportMenu(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.text, fontWeight: 600, textAlign: 'left' }}>
                      <TableCellsIcon style={{ width: 13, height: 13, color: C.green }} />
                      Excel — {MONTHS[competencia.month - 1]}/{competencia.year}
                    </button>
                    <button onClick={() => { printTable(filtered, lotesMap, competencia, wsName); setExportMenu(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.text, fontWeight: 600, textAlign: 'left' }}>
                      <DocumentArrowDownIcon style={{ width: 13, height: 13, color: C.red }} />
                      PDF — {MONTHS[competencia.month - 1]}/{competencia.year}
                    </button>
                    {clientesUnicos.length > 0 && (
                      <>
                        <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
                        <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5 }}>Por Cliente</div>
                        {clientesUnicos.map(cli => {
                          const rows = filtered.filter(l => getEmpresa(l) === cli)
                          return (
                            <button key={cli} onClick={() => { exportCSV(rows, lotesMap); setExportMenu(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.text, fontWeight: 500, textAlign: 'left' }}>
                              <TableCellsIcon style={{ width: 12, height: 12, color: C.green }} />
                              {cli} <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textSec, fontWeight: 400 }}>{rows.length} reg</span>
                            </button>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardDocumentListIcon style={{ width: 14, height: 14, color: C.navy }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>Lançamentos</span>
              <span style={{ fontSize: 11, color: C.textSec, fontWeight: 400 }}>
                ({filtered.length} registro{filtered.length !== 1 ? 's' : ''})
              </span>
              {selecionados.size > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, background: '#EFF6FF', padding: '2px 8px', borderRadius: 4, border: '1px solid #BFDBFE' }}>
                  {selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''}
                </span>
              )}
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
                  <th style={{ background: C.groupId, padding: '7px 8px', width: 36, borderRight: `1px solid rgba(255,255,255,0.2)` }}>
                    <input type="checkbox" style={{ cursor: 'pointer', width: 14, height: 14, accentColor: '#6366F1' }}
                      checked={paginated.length > 0 && paginated.every(l => selecionados.has(l.id))}
                      onChange={e => {
                        setSelecionados(prev => {
                          const next = new Set(prev)
                          paginated.forEach(l => e.target.checked ? next.add(l.id) : next.delete(l.id))
                          return next
                        })
                      }}
                    />
                  </th>
                  <th colSpan={6} style={{ background: C.groupId, padding: '7px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.white, textAlign: 'center', borderRight: `1px solid rgba(255,255,255,0.2)` }}>
                    IDENTIFICAÇÃO
                  </th>
                  <th colSpan={9} style={{ background: C.groupJorn, padding: '7px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.white, textAlign: 'center', borderRight: `1px solid rgba(255,255,255,0.2)` }}>
                    JORNADA
                  </th>
                  <th colSpan={2} style={{ background: C.groupVal, padding: '7px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.white, textAlign: 'center', borderRight: `1px solid rgba(255,255,255,0.2)` }}>
                    REVISÃO INTERNA
                  </th>
                  <th colSpan={3} style={{ background: C.groupFin, padding: '7px 10px', fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.white, textAlign: 'center' }}>
                    FINANCEIRO / LOTE
                  </th>
                </tr>
                {/* Linha 2: colunas individuais */}
                <tr style={{ background: '#1A2E4A', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ width: 36, background: '#1A2E4A', padding: '6px 8px' }} />
                  <Th width={70}>Nº</Th>
                  <Th width={90}>Data</Th>
                  <Th width={140}>Processado Em</Th>
                  <Th width={200}>Empresa</Th>
                  <Th width={110}>Cidade/UF</Th>
                  <Th width={140}>Solicitante</Th>
                  <Th width={120}>Equipamento</Th>
                  <Th width={90}>Placa</Th>
                  <Th width={70} align="center">Início da Jornada</Th>
                  <Th width={70} align="center">Fim da Jornada</Th>
                  <Th width={80} align="center">Total de Horas</Th>
                  <Th width={90} align="center">H Diurnas</Th>
                  <Th width={90} align="center">H Noturnas</Th>
                  <Th width={90} align="center">H FDS Diurnas</Th>
                  <Th width={90} align="center">H FDS Noturnas</Th>
                  <Th width={100} align="center">H Feriado Diurnas</Th>
                  <Th width={100} align="center">H Feriado Noturnas</Th>
                  <Th width={110} align="center">Conf. Interna</Th>
                  <Th width={110} align="center">Validado</Th>
                  <Th width={110} align="right">Valor (R$)</Th>
                  <Th width={160}>Status</Th>
                  <Th width={130} align="center">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={23} style={{ textAlign: 'center', padding: 48, color: C.textSec, fontSize: 13 }}>
                      Carregando lançamentos...
                    </td>
                  </tr>
                )}
                {!loading && paginated.length === 0 && (
                  <tr>
                    <td colSpan={23} style={{ textAlign: 'center', padding: 48, color: C.textSec, fontSize: 13 }}>
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
                  const divergencias = divergenciasMap[l.id] || []
                  const temDivergencia = divergencias.length > 0
                  const rowBg = l.duplicata ? '#FFFBEB' : (temDivergencia ? '#FFF5F5' : (idx % 2 === 0 ? C.white : '#F8FAFC'))
                  const isOpen = actionMenuId === l.id

                  return (
                    <tr key={l.id}
                      style={{ background: selecionados.has(l.id) ? '#EFF6FF' : rowBg, cursor: 'pointer', borderLeft: l.duplicata ? '3px solid #F59E0B' : (temDivergencia ? '3px solid #DC2626' : '3px solid transparent') }}
                      onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                      onMouseLeave={e => e.currentTarget.style.background = selecionados.has(l.id) ? '#EFF6FF' : rowBg}
                      onClick={e => { if (e.target.type !== 'checkbox') setDrawerRecord(l) }}
                      title={l.duplicata ? '⚠ Registro duplicado — excluído dos cálculos' : (temDivergencia ? `⚠ ${divergencias.join(' · ')}` : undefined)}
                    >
                      <td style={{ padding: '5px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'center', width: 36 }}>
                        <input type="checkbox" style={{ cursor: 'pointer', width: 14, height: 14, accentColor: '#6366F1' }}
                          checked={selecionados.has(l.id)}
                          onChange={e => {
                            setSelecionados(prev => {
                              const next = new Set(prev)
                              e.target.checked ? next.add(l.id) : next.delete(l.id)
                              return next
                            })
                          }}
                        />
                      </td>
                      {/* IDENTIFICAÇÃO */}
                      <Td bold>
                        <span style={{ color: C.blue, fontSize: 11, fontWeight: 700 }}>{getLanNum(l)}</span>
                        {l.duplicata && (
                          <span style={{ display: 'inline-block', marginLeft: 4, padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 800, background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}>DUPLICATA</span>
                        )}
                      </Td>
                      <Td muted>{fmtDate(l.data)}</Td>
                      <Td muted>{d.processado_em ? fmtDateHora(d.processado_em) : '—'}</Td>
                      <Td bold>{getEmpresa(l)}</Td>
                      <Td muted>{getCidadeUF(l)}</Td>
                      <Td>{getSolicitante(l)}</Td>
                      <Td muted>{getEquipamento(l)}</Td>
                      <Td muted>{(l.dados_extras || {}).placa || (l.dados_extras || {}).veiculo_placa || '—'}</Td>
                      {/* JORNADA */}
                      <Td align="center" muted>{d.jornada_inicio || '—'}</Td>
                      <Td align="center" muted>{d.jornada_fim || '—'}</Td>
                      <Td align="center" bold>{fmtTotalHorasJornada(d)}</Td>
                      <Td align="center" muted>{d.horas_diurnas ? `${d.horas_diurnas}h` : '—'}</Td>
                      <Td align="center" muted>{d.horas_noturnas ? `${d.horas_noturnas}h` : '—'}</Td>
                      <Td align="center" muted>{parseFloat(d.h_fds_diurnas || 0) > 0 ? `${d.h_fds_diurnas}h` : '—'}</Td>
                      <Td align="center" muted>{parseFloat(d.h_fds_noturnas || 0) > 0 ? `${d.h_fds_noturnas}h` : '—'}</Td>
                      <Td align="center" muted>{parseFloat(d.h_feriado_diurnas || 0) > 0 ? `${d.h_feriado_diurnas}h` : '—'}</Td>
                      <Td align="center" muted>{parseFloat(d.h_feriado_noturnas || 0) > 0 ? `${d.h_feriado_noturnas}h` : '—'}</Td>
                      {/* REVISÃO INTERNA */}
                      <Td align="center">
                        {temDivergencia
                          ? <span title={divergencias.join('\n')} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#DC2626', fontSize: 12, fontWeight: 800, cursor: 'help' }}>
                              ⚠ <span style={{ fontSize: 10, fontWeight: 700 }}>{divergencias.length}</span>
                            </span>
                          : clienteOk
                            ? <span style={{ color: C.green, fontWeight: 800, fontSize: 14 }}>✓</span>
                            : <span style={{ color: '#CBD5E1', fontSize: 14 }}>—</span>}
                      </Td>
                      <td
                        onClick={e => { e.stopPropagation(); if (!lote) toggleValidado(l) }}
                        style={{ padding: '5px 8px', borderBottom: `1px solid ${C.border}`, textAlign: 'center', cursor: lote ? 'default' : 'pointer' }}
                        title={lote ? 'Registro em lote — não pode ser alterado aqui' : (l.status === 'aprovado' ? 'Clique para reverter validação' : 'Clique para validar internamente')}
                      >
                        {lote
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 12, background: '#F0FDF4', border: '1.5px solid #059669', color: '#059669', fontSize: 11, fontWeight: 800 }}>✓ Validado</span>
                          : l.status === 'aprovado'
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 12, background: '#F0FDF4', border: '1.5px solid #059669', color: '#059669', fontSize: 11, fontWeight: 800 }}>✓ Validado</span>
                            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 12, background: '#F8FAFC', border: '1.5px dashed #CBD5E1', color: '#94A3B8', fontSize: 11, fontWeight: 600 }}>Validar</span>
                        }
                      </td>
                      {/* FINANCEIRO */}
                      <Td align="right" green bold>{fmtCurrency(l.valor)}</Td>
                      <Td>
                        <ErpStatusBadge status={l.status} loteStatus={loteStatus} />
                      </Td>
                      {/* AÇÕES */}
                      <td onClick={e => e.stopPropagation()} style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, textAlign: 'center', position: 'relative' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={(e) => {
                                if (isOpen) { setActionMenuId(null); return }
                                const rect = e.currentTarget.getBoundingClientRect()
                                setActionMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                                setActionMenuId(l.id)
                              }}
                              style={{ display: 'flex', alignItems: 'center', padding: '3px 4px', borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, color: C.navy, cursor: 'pointer' }}
                            >
                              <ChevronDownIcon style={{ width: 13, height: 13 }} />
                            </button>
                            {isOpen && (
                              <div ref={actionMenuRef} style={{
                                position: 'fixed', right: actionMenuPos.right, top: actionMenuPos.top, zIndex: 9999,
                                background: C.white, border: `1px solid ${C.border}`, borderRadius: 8,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 200, overflow: 'hidden',
                              }}>
                                {[
                                  { label: 'Visualizar documento', icon: DocumentTextIcon, disabled: !l.comprovante_url, action: () => window.open(l.comprovante_url, '_blank') },
                                  { label: 'Editar lançamento',    icon: PencilSquareIcon,      disabled: false, action: () => { setEditModal(l); setActionMenuId(null) } },
                                  { label: 'Gerar PDF',            icon: DocumentArrowDownIcon, disabled: false, action: () => printTable([l], lotesMap, competencia, wsName) },
                                  // { label: 'Adicionar ao lote', suspenso temporariamente },
                                  { label: 'Ver auditoria',        icon: ClipboardDocumentListIcon, disabled: false, action: () => setAuditModal(l) },
                                  { label: 'Excluir lançamento',    icon: XMarkIcon,              disabled: false, danger: true, action: () => excluirLancamento(l) },
                                ].map(item => (
                                  <button key={item.label} disabled={item.disabled} onClick={() => { item.action(); setActionMenuId(null) }} style={{
                                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                    padding: '10px 14px', background: 'none', border: 'none',
                                    color: item.disabled ? '#CBD5E1' : item.danger ? '#DC2626' : C.text, fontSize: 12,
                                    cursor: item.disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
                                    borderBottom: `1px solid ${C.border}`,
                                    opacity: item.disabled ? 0.55 : 1,
                                  }}
                                    onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = '#F8FAFC' }}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                  >
                                    <item.icon style={{ width: 14, height: 14, color: item.disabled ? '#CBD5E1' : item.danger ? '#DC2626' : C.textSec }} />
                                    {item.label}
                                    {item.disabled && item.disabledLabel && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#CBD5E1', fontWeight: 600 }}>{item.disabledLabel}</span>}
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

        {/* ── CONTROLE DE PAINÉIS ───────────────────────────────────────── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 2 }}>Painéis:</span>
          {[
            { key: 'resumo',      label: 'Resumo do Período' },
            { key: 'fila',        label: 'Fila de Revisão' },
            { key: 'auditoria',   label: 'Auditoria Recente' },
            { key: 'acoes',       label: 'Ações do Módulo' },
            { key: 'valorpordia', label: 'Valor por Dia' },
            { key: 'topempresas', label: 'Top Empresas' },
            { key: 'horasdist',   label: 'Distribuição de Horas' },
          ].map(({ key, label }) => {
            const on = visiblePanels.has(key)
            return (
              <button key={key}
                onClick={() => setVisiblePanels(prev => { const n = new Set(prev); on ? n.delete(key) : n.add(key); localStorage.setItem('erp_panels', JSON.stringify([...n])); return n })}
                style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${on ? C.blue : C.border}`, background: on ? '#EFF6FF' : C.white, color: on ? C.blue : C.textSec }}
              >{on ? '✓ ' : ''}{label}</button>
            )
          })}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textSec }}>{visiblePanels.size} de 7 visível{visiblePanels.size !== 1 ? 'is' : ''}</span>
        </div>

        {/* ── PAINÉIS INFERIORES ──────────────────────────────────────────── */}
        {visiblePanels.size > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visiblePanels.size}, 1fr)`, gap: 10, marginBottom: 16 }}>

          {/* RESUMO */}
          {visiblePanels.has('resumo') && (() => {
            const daysInMonth = new Date(competencia.year, competencia.month, 0).getDate()
            const byDay = Array(daysInMonth).fill(0)
            filtered.forEach(l => {
              if (!l.data) return
              const d = new Date(l.data + 'T12:00:00')
              if (d.getMonth() + 1 === competencia.month && d.getFullYear() === competencia.year) byDay[d.getDate() - 1] += l.valor || 0
            })
            let acc = 0
            const sparkVals = byDay.map(v => { acc += v; return acc })
            return (
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ background: C.navy, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Resumo do Período</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{MONTHS[competencia.month - 1]}/{competencia.year}</div>
                  </div>
                  <Sparkline values={sparkVals} width={80} height={28} color="#86EFAC" />
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {[
                    ['Total de Boletins', filtered.length, null],
                    ['Horas Apuradas',    fmtHorasTotal(filtered), null],
                    ['Horas Diurnas',     fmtHorasSum(filtered, 'horas_diurnas'), C.blue],
                    ['Horas Noturnas',    fmtHorasSum(filtered, 'horas_noturnas'), C.navy],
                    ['Valor Total',       fmtCurrency(filtered.reduce((s, l) => s + (l.valor || 0), 0)), C.green],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 11, color: C.textSec }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: color || C.text }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* FILA DE REVISÃO */}
          {visiblePanels.has('fila') && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ background: C.groupJorn, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Fila de Revisão</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{filtered.length} boletins</div>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <HBarChart data={statusDist} />
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: C.textSec }}>Total no período</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{filtered.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* AUDITORIA RECENTE */}
          {visiblePanels.has('auditoria') && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ background: C.groupVal, padding: '10px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Auditoria Recente</div>
              </div>
              <div style={{ padding: '10px 16px' }}>
                {eventos.length === 0 && <div style={{ textAlign: 'center', padding: '20px 0', color: C.textSec, fontSize: 12 }}>Nenhum evento recente</div>}
                {eventos.map(ev => {
                  const lanc = lancamentos.find(l => l.id === ev.lancamento_id)
                  const num = lanc ? getLanNum(lanc) : ev.lancamento_id?.slice(0, 6)
                  const dt = new Date(ev.created_at)
                  const dtStr = `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  const evLabel = { aprovado:'validado internamente', enviado_aprovacao:'enviado para revisão', processado_ia:'OCR processado', criado:'boletim recebido', editado:'lançamento editado', devolvido:'em revisão', corrigido:'divergência corrigida', reprovado:'divergência registrada', enviado_lote:'lote gerado', faturado:'faturado' }[ev.tipo] || ev.tipo
                  return (
                    <div key={ev.id} style={{ padding: '7px 0', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div><span style={{ fontSize: 11, fontWeight: 700, color: C.blue }}>{num}</span><span style={{ fontSize: 11, color: C.text }}> {evLabel}</span></div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 10, color: C.textSec }}>{dtStr}</div>
                        <div style={{ fontSize: 10, color: C.textSec, opacity: 0.7 }}>{ev.usuario_nome || 'Sistema'}</div>
                      </div>
                    </div>
                  )
                })}
                <button onClick={() => navigate('/lancamentos')} style={{ width: '100%', marginTop: 8, padding: '6px', border: 'none', background: 'none', color: C.blue, fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>Ver todas →</button>
              </div>
            </div>
          )}

          {/* AÇÕES DO MÓDULO */}
          {visiblePanels.has('acoes') && (
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ background: C.groupFin, padding: '10px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Ações do Módulo</div>
              </div>
              <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Receber Boletim',   icon: DocumentArrowDownIcon,   color: C.blue,    bg: '#EFF6FF', action: () => setEditModal('novo') },
                  { label: 'Digitalizar OCR',   icon: SparklesIcon,            color: '#7C3AED', bg: '#F5F3FF', path: '/boletins-diarios' },
                  { label: 'Revisar Pendências', icon: ClockIcon,              color: C.amber,   bg: '#FFFBEB', action: () => setFilterStatus('aguardando_aprovacao') },
                  { label: 'Ver Divergências',  icon: ExclamationTriangleIcon, color: C.red,     bg: '#FEF2F2', action: () => setFilterStatus('revisar') },
                  { label: 'Enviar WA',         icon: PaperAirplaneIcon,       color: '#128C7E', bg: '#F0FDF4', action: () => selecionados.size > 0 ? setWaModal(true) : toast('Selecione os boletins primeiro', { icon: '⚠️' }) },
                  { label: 'Relatórios',        icon: DocumentChartBarIcon,    color: C.green,   bg: '#F0FDF4', path: '/central' },
                ].map(item => (
                  <button key={item.label}
                    onClick={() => item.action ? item.action() : navigate(item.path)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '12px 8px', borderRadius: 8, border: `1px solid ${item.color}22`, background: item.bg, cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.96)' }}
                    onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                  >
                    <item.icon style={{ width: 18, height: 18, color: item.color }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: item.color, textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
                  </button>
                ))}
              </div>
              <div style={{ padding: '0 12px 12px' }}>
                <button onClick={() => navigate('/configuracoes')} style={{ width: '100%', padding: '7px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'none', color: C.textSec, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Cog6ToothIcon style={{ width: 13, height: 13 }} /> Configurações
                </button>
              </div>
            </div>
          )}

          {/* VALOR POR DIA */}
          {visiblePanels.has('valorpordia') && (() => {
            const daysInMonth = new Date(competencia.year, competencia.month, 0).getDate()
            const byDay = Array.from({ length: daysInMonth }, (_, i) => ({
              label: String(i + 1),
              value: 0,
              color: C.blue,
              showLabel: (i + 1) % 5 === 1 || i + 1 === daysInMonth,
            }))
            filtered.forEach(l => {
              if (!l.data) return
              const d = new Date(l.data + 'T12:00:00')
              if (d.getMonth() + 1 === competencia.month && d.getFullYear() === competencia.year) {
                byDay[d.getDate() - 1].value += l.valor || 0
              }
            })
            const totalValor = byDay.reduce((s, d) => s + d.value, 0)
            const diasComMovimento = byDay.filter(d => d.value > 0).length
            const pico = byDay.reduce((best, d) => d.value > best.value ? d : best, byDay[0])
            return (
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ background: C.blue, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Valor por Dia</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{MONTHS[competencia.month - 1]}/{competencia.year}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>{fmtCurrency(totalValor)}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)' }}>{diasComMovimento}d com movimento</div>
                  </div>
                </div>
                <div style={{ padding: '12px 16px 6px' }}>
                  <VBarChart data={byDay} height={80} valueFormat={fmtCurrency} />
                </div>
                <div style={{ padding: '0 16px 12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: C.textSec }}>Pico: dia {pico.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.blue }}>{fmtCurrency(pico.value)}</span>
                </div>
              </div>
            )
          })()}

          {/* TOP EMPRESAS */}
          {visiblePanels.has('topempresas') && (() => {
            const empresaMap = {}
            filtered.forEach(l => {
              const emp = getEmpresa(l)
              if (!emp || emp === '—') return
              if (!empresaMap[emp]) empresaMap[emp] = { valor: 0, count: 0 }
              empresaMap[emp].valor += l.valor || 0
              empresaMap[emp].count += 1
            })
            const COLORS = [C.blue, C.green, C.purple, C.amber, '#0EA5E9', '#F97316', '#6366F1', '#EC4899']
            const top = Object.entries(empresaMap)
              .sort((a, b) => b[1].valor - a[1].valor)
              .slice(0, 8)
              .map(([label, { valor, count }], i) => ({ label, value: valor, count, color: COLORS[i % COLORS.length] }))
            const totalTop = top.reduce((s, d) => s + d.value, 0)
            return (
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ background: C.green, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Top Empresas</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>por valor faturado</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>{top.length} empresas</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)' }}>{fmtCurrency(totalTop)}</div>
                  </div>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {top.length === 0
                    ? <div style={{ textAlign: 'center', padding: '20px 0', color: C.textSec, fontSize: 12 }}>Nenhum dado no período</div>
                    : <HBarChart data={top} valueFormat={fmtCurrency} labelWidth={100} valueWidth={80} />
                  }
                </div>
                {top.length > 0 && (
                  <div style={{ padding: '0 16px 10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: C.textSec }}>Maior participação</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.green }}>
                      {totalTop > 0 ? `${((top[0]?.value / totalTop) * 100).toFixed(0)}%` : '—'} {top[0]?.label?.split(' ')[0]}
                    </span>
                  </div>
                )}
              </div>
            )
          })()}

          {/* DISTRIBUIÇÃO DE HORAS */}
          {visiblePanels.has('horasdist') && (() => {
            const tipos = [
              { label: 'Diurnas',      key: 'horas_diurnas',        color: C.amber   },
              { label: 'Noturnas',     key: 'horas_noturnas',        color: C.navy    },
              { label: 'FDS Diurno',   key: 'h_fds_diurnas',         color: '#F97316' },
              { label: 'FDS Noturno',  key: 'h_fds_noturnas',        color: '#6366F1' },
              { label: 'Fer. Diurno',  key: 'h_feriado_diurnas',     color: C.red     },
              { label: 'Fer. Noturno', key: 'h_feriado_noturnas',    color: '#EC4899' },
            ]
            const data = tipos.map(t => ({
              label: t.label,
              value: filtered.reduce((s, l) => {
                const v = parseFloat(String(l.dados_extras?.[t.key] || '0').replace(',', '.')) || 0
                return s + v
              }, 0),
              color: t.color,
            })).filter(d => d.value > 0)
            const totalH = data.reduce((s, d) => s + d.value, 0)
            const dominant = data.reduce((best, d) => d.value > (best?.value ?? 0) ? d : best, null)
            return (
              <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ background: C.navy, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Distribuição de Horas</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>por tipo de jornada</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.white }}>{fmtHorasDecimal(totalH)}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)' }}>total de horas</div>
                  </div>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {data.length === 0
                    ? <div style={{ textAlign: 'center', padding: '20px 0', color: C.textSec, fontSize: 12 }}>Nenhuma hora registrada</div>
                    : <HBarChart data={data} valueFormat={fmtHorasDecimal} labelWidth={90} valueWidth={50} />
                  }
                </div>
                {data.length > 0 && dominant && (
                  <div style={{ padding: '0 16px 10px', display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 0 }}>
                    <span style={{ fontSize: 10, color: C.textSec }}>Predominante</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: dominant.color }}>
                      {dominant.label} · {totalH > 0 ? `${((dominant.value / totalH) * 100).toFixed(0)}%` : '—'}
                    </span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
        )}

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
          onEdit={r => setEditModal(r)}
          onClose={() => setDrawerRecord(null)}
        />
      )}
      {auditModal && (
        <AuditModal record={auditModal} onClose={() => setAuditModal(null)} />
      )}
      {editModal && (
        <div style={{
          '--bg-card':       '#FFFFFF',
          '--bg-primary':    '#F4F6FA',
          '--bg-secondary':  '#F8FAFC',
          '--border':        '#D8DEE9',
          '--text-primary':  '#172033',
          '--text-secondary':'#64748B',
          '--shadow-card':   '0 8px 32px rgba(11,31,58,0.14)',
          '--accent':        '#1D4ED8',
        }}>
          <LancamentoModal
            item={editModal === 'novo' ? null : editModal}
            workspaceId={workspaceId}
            userId={userId}
            enabledModules={enabledModules}
            formTemplates={formTemplates}
            tarifasMap={tarifasMap}
            hideTipoForm
            erpMode
            onClose={() => setEditModal(null)}
            onSaved={() => { setEditModal(null); loadData() }}
          />
        </div>
      )}
      {loteModal && (
        <CriarLoteModal
          itens={filtered.filter(l => selecionados.has(l.id))}
          workspaceId={workspaceId}
          userId={userId}
          onClose={() => setLoteModal(false)}
          onSaved={() => { setLoteModal(false); setSelecionados(new Set()); loadData() }}
        />
      )}
      {addLoteModal && (
        <AdicionarLoteModal
          record={addLoteModal}
          workspaceId={workspaceId}
          onClose={() => setAddLoteModal(null)}
          onSaved={() => { setAddLoteModal(null); loadData() }}
        />
      )}
      {waModal && (
        <EnviarWAModal
          itens={filtered.filter(l => selecionados.has(l.id))}
          wsName={wsName}
          onClose={() => setWaModal(false)}
        />
      )}
    </div>
  )
}
