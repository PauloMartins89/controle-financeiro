/**
 * ComprasERP.jsx — Tela unificada de Compras
 * Layout 3 painéis: Pipeline lateral | Lista central | Detalhe/Radar direito
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { waLink } from '../lib/utils'
import useStore from '../store/useStore'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  ClipboardDocumentListIcon, MagnifyingGlassIcon, PlusIcon,
  FunnelIcon, ChevronRightIcon, ChevronDownIcon, XMarkIcon,
  CheckCircleIcon, XCircleIcon, BoltIcon, BanknotesIcon,
  TruckIcon, ArrowPathIcon, CalendarDaysIcon, UserIcon,
  PhoneIcon, GlobeAltIcon, IdentificationIcon, TagIcon,
  PlusCircleIcon, ShoppingCartIcon, ArrowTopRightOnSquareIcon,
  ExclamationTriangleIcon, ChartBarIcon, MapPinIcon,
  Squares2X2Icon, ListBulletIcon, SignalIcon, StarIcon,
  EnvelopeIcon, ExclamationCircleIcon, ShieldCheckIcon,
  ChatBubbleLeftEllipsisIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { LC } from '../lib/theme'
import { useNavigate } from 'react-router-dom'

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}
function normalizeCompraItem(row) {
  if (!row) return row
  return {
    ...row,
    valor_orcado: row.valor_orcado ?? row.valor_estimado ?? null,
  }
}
function normalizeEvento(row) {
  if (!row) return row
  return {
    ...row,
    created_at: row.created_at ?? row.criado_em ?? null,
    usuario_nome: row.usuario_nome ?? row.ator ?? null,
    descricao: row.descricao ?? row.observacao ?? row.acao ?? '',
  }
}
function fmtCNPJ(v = '') {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

// ─── Status pipeline ──────────────────────────────────────────────────────────
const STAGES = [
  { key: 'todos',               label: 'Todos',             color: '#6366f1', icon: Squares2X2Icon },
  { key: 'pendente',            label: 'Requisições',       color: '#3b82f6', icon: ClipboardDocumentListIcon },
  { key: 'aguardando_aprovacao',label: 'Ag. Aprovação',     color: '#f59e0b', icon: ExclamationTriangleIcon },
  { key: 'em_cotacao',          label: 'Em Cotação',        color: '#8b5cf6', icon: SignalIcon },
  { key: 'leilao_aberto',       label: 'Leilão Aberto',     color: '#0ea5e9', icon: BoltIcon },
  { key: 'aprovado',            label: 'Pedidos',           color: '#10b981', icon: CheckCircleIcon },
  { key: 'pedido_emitido',      label: 'Recebimento',       color: '#059669', icon: TruckIcon },
  { key: 'recebido',            label: 'A Pagar',           color: '#14b8a6', icon: BanknotesIcon },
  { key: 'pago',                label: 'Pagos',             color: '#6b7280', icon: CheckCircleIcon },
  { key: 'radar',               label: '🔍 Radar',          color: '#e11d48', icon: MagnifyingGlassIcon },
]

const STATUS_LABELS = {
  pendente:             { label: 'Pendente',       color: '#3b82f6' },
  aguardando_aprovacao: { label: 'Ag. Aprovação',  color: '#f59e0b' },
  em_cotacao:           { label: 'Em Cotação',     color: '#8b5cf6' },
  leilao_aberto:        { label: 'Leilão',         color: '#0ea5e9' },
  leilao_encerrado:     { label: 'Leilão Enc.',    color: '#7c3aed' },
  aprovado:             { label: 'Aprovado',       color: '#10b981' },
  pedido_emitido:       { label: 'Pedido Emitido', color: '#059669' },
  recebido:             { label: 'Recebido',       color: '#14b8a6' },
  pago:                 { label: 'Pago',           color: '#6b7280' },
  recusado:             { label: 'Recusado',       color: '#ef4444' },
}

const URGENCIA_COLORS = { alta: '#ef4444', media: '#f59e0b', baixa: '#10b981' }

// ─── Radar: sugestões de produto + estados ───────────────────────────────────
const SUGESTOES_PRODUTO = [
  'Pneus', 'Lubrificantes', 'Peças auto', 'Baterias', 'EPI', 'Ferramentas',
  'Elétrica', 'Hidráulica', 'Informática', 'Escritório', 'Limpeza',
  'Manutenção', 'Segurança', 'Construção', 'Uniformes', 'Combustível',
]
const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const SITE_COLORS = {
  'Mercado Livre': '#FFE600',
  'Americanas': '#E60014',
  'Magazine Luiza': '#0086FF',
  'Shopee': '#EE4D2D',
  'Amazon': '#FF9900',
}

// ─── PALETA ERP (alinhada com LancamentosERP) ─────────────────────────────────
const C = {
  navy:    '#0B1F3A',
  blue:    '#1D4ED8',
  green:   '#059669',
  amber:   '#F59E0B',
  red:     '#DC2626',
  sky:     '#0EA5E9',
  violet:  '#6366F1',
  bgPage:  '#F4F6FA',
  bgCard:  '#FFFFFF',
  border:  '#D8DEE9',
  text:    '#172033',
  textSec: '#64748B',
  white:   '#FFFFFF',
}

// ─── sub-component: Badge de status ──────────────────────────────────────────
const STATUS_BADGE_MAP = {
  pendente:             { label: 'Pendente',       bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  aguardando_aprovacao: { label: 'Ag. Aprovação',  bg: '#FFFBEB', color: '#B45309', border: '#FCD34D' },
  em_cotacao:           { label: 'Em Cotação',     bg: '#F5F3FF', color: '#5B21B6', border: '#C4B5FD' },
  leilao_aberto:        { label: 'Leilão',         bg: '#F0F9FF', color: '#0369A1', border: '#BAE6FD' },
  leilao_encerrado:     { label: 'Leilão Enc.',    bg: '#EEF2FF', color: '#3730A3', border: '#A5B4FC' },
  aprovado:             { label: 'Aprovado',       bg: '#F0FDF4', color: '#065F46', border: '#86EFAC' },
  pedido_emitido:       { label: 'Pedido Emitido', bg: '#ECFDF5', color: '#047857', border: '#6EE7B7' },
  recebido:             { label: 'Recebido',       bg: '#F0FDFA', color: '#0F766E', border: '#99F6E4' },
  pago:                 { label: 'Pago',           bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' },
  recusado:             { label: 'Recusado',       bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
}
function StatusBadge({ status }) {
  const s = STATUS_BADGE_MAP[status] || { label: status || '—', bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

// ─── IBGE cities cache ───────────────────────────────────────────────────────
let _cidadesCache = null
function loadCidadesIBGE() {
  if (!_cidadesCache) {
    _cidadesCache = fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome')
      .then(r => r.json())
      .then(data => data.map(m => ({ label: m.nome, sub: m?.microrregiao?.mesorregiao?.UF?.sigla || '', uf: m?.microrregiao?.mesorregiao?.UF?.sigla || '' })))
      .catch(() => [])
  }
  return _cidadesCache
}

// ─── AutocompleteInput (city/product suggestions) ────────────────────────────
function AutocompleteInput({ value, onChange, onSelect, sugestoes, placeholder, inputStyle }) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const wRef = useRef(null)
  const normStr = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  useEffect(() => {
    const fn = e => { if (wRef.current && !wRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])
  const filtered = value.trim()
    ? sugestoes.filter(s => normStr(typeof s === 'string' ? s : s.label).includes(normStr(value))).slice(0, 10)
    : []
  function handleKey(e) {
    if (e.key === 'Enter') { if (open && cursor >= 0 && filtered.length > 0) { e.preventDefault(); onSelect(filtered[cursor]); setOpen(false); setCursor(-1) } else setOpen(false); return }
    if (!open || !filtered.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)) }
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }
  return (
    <div ref={wRef} style={{ position: 'relative' }}>
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true); setCursor(-1) }}
        onFocus={() => value.trim() && setOpen(true)} onKeyDown={handleKey}
        placeholder={placeholder} style={inputStyle} autoComplete="off" />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.18)', marginTop: 2, maxHeight: 200, overflowY: 'auto' }}>
          {filtered.map((s, i) => {
            const label = typeof s === 'string' ? s : s.label
            const sub = typeof s === 'string' ? null : s.sub
            return (
              <div key={i} onMouseDown={() => { onSelect(s); setOpen(false); setCursor(-1) }}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, background: cursor === i ? 'rgba(14,165,233,0.10)' : 'transparent', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>{label}</span>
                {sub && <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)', flexShrink: 0 }}>{sub}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Score Fiscal completo ───────────────────────────────────────────────────
function calcFiscalScore(d) {
  let score = 0
  const breakdown = []
  const status = (d.descricao_situacao_cadastral || String(d.situacao_cadastral || '')).toUpperCase()
  const sitPts = status.includes('ATIVA') ? 40 : status.includes('SUSPENS') ? 10 : status.includes('INAPT') ? 5 : 0
  score += sitPts
  breakdown.push({ label: 'Sit. Cadastral', pts: sitPts, max: 40, detail: d.descricao_situacao_cadastral || '?' })
  let tempoPts = 0, tempoDetail = 'N/A'
  if (d.data_inicio_atividade) {
    const anos = (Date.now() - new Date(d.data_inicio_atividade).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    tempoPts = anos >= 10 ? 20 : anos >= 5 ? 15 : anos >= 2 ? 10 : anos >= 1 ? 5 : 2
    tempoDetail = anos >= 1 ? `${Math.floor(anos)} anos` : `${Math.floor(anos * 12)} meses`
  }
  score += tempoPts
  breakdown.push({ label: 'Tempo Atividade', pts: tempoPts, max: 20, detail: tempoDetail })
  let regimePts = 0
  if ((Array.isArray(d.regime_tributario) ? d.regime_tributario : []).length > 0) regimePts += 7
  if (d.opcao_pelo_simples === true) regimePts += 5
  if (d.opcao_pelo_mei === true) regimePts += 3
  if ((d.capital_social || 0) > 0) regimePts += 2
  regimePts = Math.min(regimePts, 15)
  score += regimePts
  breakdown.push({ label: 'Regime Fiscal', pts: regimePts, max: 15, detail: d.opcao_pelo_simples ? 'Simples Nacional' : d.opcao_pelo_mei ? 'MEI' : 'Lucro Presumido/Real' })
  let complPts = 0
  if (d.email) complPts += 3
  if ((d.ddd_telefone_2 || '').replace(/\D/g, '').length > 5) complPts += 2
  if ((d.qsa || []).length > 0) complPts += 3
  if ((d.cnaes_secundarios || []).length > 0) complPts += 2
  score += complPts
  breakdown.push({ label: 'Completude', pts: complPts, max: 10, detail: `${[d.email ? 'Email' : '', (d.qsa || []).length ? 'QSA' : ''].filter(Boolean).join(', ') || 'Mínimo'}` })
  const penalties = []
  if (String(d.situacao_especial || '').trim()) { score -= 15; penalties.push('Situação Especial') }
  const motivo = String(d.descricao_motivo_situacao_cadastral || '').trim().toUpperCase()
  if (motivo && motivo !== 'SEM MOTIVO' && motivo !== '0') { score -= 10; penalties.push(d.descricao_motivo_situacao_cadastral) }
  score = Math.max(0, Math.min(100, score))
  const tier = score >= 80 ? { label: 'Excelente', color: '#10b981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.2)' } :
               score >= 65 ? { label: 'Bom',       color: '#34d399', bg: 'rgba(52,211,153,0.07)', border: 'rgba(52,211,153,0.2)' } :
               score >= 50 ? { label: 'Regular',   color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)' } :
               score >= 30 ? { label: 'Atenção',   color: '#f97316', bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.2)' } :
                             { label: 'Crítico',   color: '#ef4444', bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.2)'  }
  return { score, ...tier, breakdown, penalties }
}

// ─── FornecedorCard inline ────────────────────────────────────────────────────
function FornecedorCardInline({ e, onAdd, added, selecionado, onToggle, onCnpj }) {
  const waHref = waLink(e.telefone)
  return (
    <div style={{ background: selecionado ? '#EFF6FF' : C.bgCard, borderRadius: 8, border: selecionado ? `1.5px solid ${C.blue}` : `1px solid ${C.border}`, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={selecionado} onChange={onToggle}
          style={{ marginTop: 4, accentColor: C.blue, cursor: 'pointer', width: 13, height: 13, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nome}</div>
          {e.rating && (
            <div style={{ fontSize: 11, color: C.amber, fontWeight: 700, letterSpacing: 0.3 }}>
              {'★'.repeat(Math.round(e.rating))}{'☆'.repeat(5 - Math.round(e.rating))} {e.rating.toFixed(1)}
              {e.avaliacoes > 0 && <span style={{ color: C.textSec, fontWeight: 400 }}> ({e.avaliacoes})</span>}
            </div>
          )}
          {e.endereco && <div style={{ fontSize: 11, color: C.textSec, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.endereco}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {waHref && <a href={waHref} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.green, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}><PhoneIcon style={{ width: 11 }} />{e.telefone}</a>}
            {e.website && <a href={e.website.startsWith('http') ? e.website : `https://${e.website}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.violet, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}><GlobeAltIcon style={{ width: 11 }} />Site</a>}
            {e.horario && <span style={{ fontSize: 10, color: C.textSec }}>{e.horario}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
          <button onClick={() => onCnpj(e)} title="Consultar CNPJ"
            style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#EEF2FF', border: `1px solid #C7D2FE`, cursor: 'pointer', color: C.violet, display: 'flex', alignItems: 'center', gap: 3 }}>
            <IdentificationIcon style={{ width: 11 }} />CNPJ
          </button>
          <button onClick={() => onAdd(e)} disabled={added}
            style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: added ? '#F0FDF4' : '#EFF6FF', border: added ? '1px solid #86EFAC' : `1px solid #BFDBFE`, cursor: added ? 'default' : 'pointer', color: added ? C.green : C.blue, display: 'flex', alignItems: 'center', gap: 3 }}>
            {added ? <CheckCircleIcon style={{ width: 11 }} /> : <PlusCircleIcon style={{ width: 11 }} />}
            {added ? 'OK' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CnpjCardInline ──────────────────────────────────────────────────────────
function CnpjCardInline({ d, onAdd, added }) {
  const fiscal = calcFiscalScore(d)
  const ativa = (d.descricao_situacao_cadastral || '').toUpperCase().includes('ATIVA')
  const tel1 = (d.ddd_telefone_1 || '').replace(/\D/g, '').length > 5
    ? `(${d.ddd_telefone_1}) ${d.ddd_telefone_1}` : null
  const end = [d.logradouro, d.numero, d.bairro, d.municipio, d.uf].filter(Boolean).join(', ')
  const empresa = { id: d.cnpj, nome: d.nome_fantasia || d.razao_social, cnpj: d.cnpj, telefone: d.ddd_telefone_1 ? `${d.ddd_telefone_1}` : null, email: d.email || null, logradouro: end }
  return (
    <div style={{ background: fiscal.bg, borderRadius: 12, border: `1px solid ${fiscal.border}`, overflow: 'hidden' }}>
      {/* header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>{d.nome_fantasia || d.razao_social}</div>
          {d.nome_fantasia && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.razao_social}</div>}
          <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: ativa ? '#10b981' : '#ef4444', background: ativa ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', padding: '2px 7px', borderRadius: 99 }}>
              {ativa ? '✓ Ativa' : '✗ ' + (d.descricao_situacao_cadastral || 'Inativa')}
            </span>
            {d.porte && <span style={{ fontSize: 10, color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '2px 7px', borderRadius: 99 }}>{d.porte}</span>}
            {d.opcao_pelo_simples && <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 7px', borderRadius: 99 }}>Simples</span>}
            {d.opcao_pelo_mei && <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 7px', borderRadius: 99 }}>MEI</span>}
          </div>
        </div>
        <button onClick={() => onAdd(empresa)} disabled={added}
          style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: added ? 'rgba(16,185,129,0.12)' : '#0ea5e9', border: added ? '1px solid rgba(16,185,129,0.3)' : 'none', cursor: added ? 'default' : 'pointer', color: added ? '#10b981' : '#fff', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {added ? <><CheckCircleIcon style={{ width: 13 }} />Adicionado</> : <><PlusCircleIcon style={{ width: 13 }} />Adicionar</>}
        </button>
      </div>
      {/* score */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: `2.5px solid ${fiscal.color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: fiscal.color, lineHeight: 1 }}>{fiscal.score}</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: fiscal.color }}>pts</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: fiscal.color, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheckIcon style={{ width: 12 }} /> Score Fiscal: {fiscal.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {fiscal.breakdown.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</div>
                  <div style={{ width: 48, height: 4, borderRadius: 2, background: 'var(--border)', flexShrink: 0, overflow: 'hidden' }}>
                    <div style={{ width: `${(b.pts / b.max) * 100}%`, height: '100%', background: b.pts >= b.max * 0.75 ? '#10b981' : b.pts >= b.max * 0.4 ? '#f59e0b' : '#ef4444', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', minWidth: 28 }}>{b.pts}/{b.max}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{b.detail}</div>
                </div>
              ))}
              {fiscal.penalties.map((p, i) => (
                <div key={i} style={{ fontSize: 10, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ExclamationCircleIcon style={{ width: 10, flexShrink: 0 }} /> {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* dados */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[fmtCNPJ(d.cnpj || ''), end, d.email, d.data_inicio_atividade ? `Abertura: ${fmtDate(d.data_inicio_atividade)}` : null, d.capital_social ? `Capital: ${fmtBRL(d.capital_social)}` : null, d.cnae_fiscal_descricao ? `CNAE: ${d.cnae_fiscal_descricao}` : null].filter(Boolean).map((v, i) => (
          <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
        ))}
        {(d.qsa || []).length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Quadro Societário</div>
            {d.qsa.slice(0, 3).map((s, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--text-primary)' }}>{s.nome_socio} — <span style={{ color: 'var(--text-secondary)' }}>{s.qualificacao_socio}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── sub-component: Painel Radar de Compras ──────────────────────────────────
const SUGESTOES_BUSCA = [
  'Pneus', 'Lubrificantes', 'Pecas auto', 'Baterias', 'EPI', 'Ferramentas',
  'Eletrica', 'Hidraulica', 'Informatica', 'Escritorio', 'Limpeza', 'Alimentos',
  'Manutencao', 'Seguranca', 'Construcao', 'Tintas', 'Uniformes', 'Combustivel',
]
function RadarPanel({ workspaceId, onAdicionarFornecedor }) {
  const [aba, setAba] = useState('fornecedor') // 'fornecedor' | 'precos' | 'cnpj'
  // ── estado busca fornecedor ──
  const [bProduto, setBProduto] = useState('')
  const [bCidade, setBCidade] = useState('')
  const [bUf, setBUf] = useState('')
  const [bLoading, setBLoading] = useState(false)
  const [bLoadingMore, setBLoadingMore] = useState(false)
  const [bResultado, setBResultado] = useState(null)
  const [bSelecionados, setBSelecionados] = useState(new Set())
  const [bAdicionados, setBAdicionados] = useState(new Set())
  const [bHasMore, setBHasMore] = useState(false)
  const [bNextStart, setBNextStart] = useState(0)
  const [cidades, setCidades] = useState([])
  // ── estado pesquisa preços ──
  const [qPreco, setQPreco] = useState('')
  const [pLoading, setPLoading] = useState(false)
  const [pResultado, setPResultado] = useState(null)
  const [pFiltro, setPFiltro] = useState('todos')
  // ── estado CNPJ ──
  const [cnpjInput, setCnpjInput] = useState('')
  const [cnpjNome, setCnpjNome] = useState('')
  const [cnpjCidade, setCnpjCidade] = useState('')
  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjNomeLoading, setCnpjNomeLoading] = useState(false)
  const [cnpjDados, setCnpjDados] = useState(null)
  const [cnpjAdicionados, setCnpjAdicionados] = useState(new Set())

  useEffect(() => { loadCidadesIBGE().then(setCidades) }, [])

  const inp = { width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bgCard, color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' }

  // ── buscar fornecedores (Google Maps via Serper) ──
  async function buscarFornecedores(produtoOverride) {
    const p = String(produtoOverride || bProduto || '').trim()
    if (!p) { toast.error('Informe o produto'); return }
    if (!bCidade.trim()) { toast.error('Informe a cidade'); return }
    setBLoading(true); setBResultado(null); setBSelecionados(new Set()); setBHasMore(false); setBNextStart(0)
    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { query: p, cidade: bCidade.trim(), uf: bUf || undefined, num: 20, start: 0 },
      })
      if (error) throw new Error(error.message || 'Erro na busca')
      if (data?.error) throw new Error(data.error)
      setBResultado({ ...data, produto: p, cidade: bCidade.trim(), uf: bUf })
      setBHasMore(data?.hasMore ?? false)
      setBNextStart(data?.nextStart ?? 20)
      if (!(data?.fornecedores || []).length) toast('Nenhum fornecedor encontrado.', { icon: '🔍', duration: 4000 })
    } catch (err) {
      toast.error(err.message || 'Falha na busca — verifique os critérios')
    } finally { setBLoading(false) }
  }

  async function carregarMais() {
    if (!bResultado || bLoadingMore) return
    setBLoadingMore(true)
    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { query: bResultado.produto, cidade: bResultado.cidade, uf: bResultado.uf || undefined, num: 20, start: bNextStart },
      })
      if (error) throw new Error(error.message || 'Erro')
      if (data?.error) throw new Error(data.error)
      const novos = (data?.fornecedores || []).filter(f =>
        !(bResultado.fornecedores || []).some(e => e.id === f.id)
      )
      setBResultado(prev => ({
        ...prev,
        fornecedores: [...(prev?.fornecedores || []), ...novos],
        total: (prev?.fornecedores?.length || 0) + novos.length,
      }))
      setBHasMore(data?.hasMore ?? false)
      setBNextStart(data?.nextStart ?? (bNextStart + 20))
      if (!novos.length) { toast('Sem novos resultados.', { icon: 'ℹ️' }); setBHasMore(false) }
      else toast.success(`+${novos.length} fornecedor(es) carregado(s)`)
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar mais')
    } finally { setBLoadingMore(false) }
  }

  async function adicionarFornecedor(empresa) {
    const chave = empresa.id || empresa.cnpj || empresa.nome
    if (bAdicionados.has(chave)) return
    const { error } = await supabase.from('fornecedores_compra').insert({
      workspace_id: workspaceId,
      nome: empresa.nome,
      cnpj: empresa.cnpj || null,
      telefone: empresa.telefone || null,
      email: empresa.email || null,
      observacoes: empresa.logradouro ? `Endereço: ${empresa.logradouro}` : null,
      ativo: true,
    })
    if (error && !error.message?.includes('duplicate')) { toast.error('Erro: ' + error.message); return }
    setBAdicionados(s => new Set([...s, chave]))
    toast.success(`${empresa.nome} adicionado!`)
    onAdicionarFornecedor?.()
  }

  function toggleSel(id) { setBSelecionados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleTodos() {
    const ids = (bResultado?.fornecedores || []).map(e => e.id)
    const all = ids.length > 0 && ids.every(id => bSelecionados.has(id))
    setBSelecionados(all ? new Set() : new Set(ids))
  }
  async function adicionarLote() {
    const items = (bResultado?.fornecedores || []).filter(e => bSelecionados.has(e.id) && !bAdicionados.has(e.id || e.cnpj || e.nome))
    if (!items.length) { toast('Todos já adicionados'); return }
    for (const emp of items) await adicionarFornecedor(emp)
    setBSelecionados(new Set())
  }
  function waLote() {
    const com = (bResultado?.fornecedores || []).filter(e => bSelecionados.has(e.id) && waLink(e.telefone))
    if (!com.length) { toast.error('Nenhum selecionado tem celular WA'); return }
    toast(`Abrindo ${com.length} conversa(s) no WhatsApp...`, { icon: '📱', duration: 3000 })
    com.forEach((e, i) => setTimeout(() => window.open(waLink(e.telefone, 'Olá! Gostaria de solicitar uma cotação de preços.'), '_blank'), i * 700))
  }
  function irParaCnpj(empresa) {
    setCnpjNome(empresa.nome || '')
    setCnpjCidade(bCidade || '')
    setAba('cnpj')
  }

  // ── pesquisa preços ──
  async function buscarPrecos() {
    if (!qPreco.trim()) { toast.error('Informe o produto'); return }
    setPLoading(true); setPResultado(null)
    try {
      const { data, error } = await supabase.functions.invoke('busca-precos', { body: { query: qPreco.trim() } })
      if (error) throw error
      setPResultado(data)
      if (!data?.resultados?.length) toast('Nenhum resultado.', { icon: 'ℹ️' })
    } catch { toast.error('Busca de preços indisponível.') }
    finally { setPLoading(false) }
  }

  // ── CNPJ ──
  async function consultarCNPJDigits(digits) {
    if (digits.length !== 14) { toast.error('CNPJ deve ter 14 dígitos'); return }
    setCnpjLoading(true); setCnpjDados(null)
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.message || 'CNPJ não encontrado')
      setCnpjDados(d)
    } catch (err) { toast.error(err.message || 'Erro ao consultar CNPJ') }
    finally { setCnpjLoading(false) }
  }
  async function buscarCnpjPorNome() {
    if (!cnpjNome.trim()) { toast.error('Informe o nome da empresa'); return }
    setCnpjNomeLoading(true); setCnpjDados(null); setCnpjInput('')
    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { mode: 'cnpj_search', nome: cnpjNome.trim(), cidade: cnpjCidade.trim() },
      })
      if (error || !data?.cnpjs?.length) { toast.error('CNPJ não encontrado. Tente o nome completo.'); return }
      const digits = data.cnpjs[0].replace(/\D/g, '')
      setCnpjInput(fmtCNPJ(digits))
      await consultarCNPJDigits(digits)
    } catch { toast.error('Erro ao buscar CNPJ') }
    finally { setCnpjNomeLoading(false) }
  }
  async function adicionarDoCNPJ() {
    if (!cnpjDados) return
    const chave = cnpjDados.cnpj
    const tel = cnpjDados.ddd_telefone_1 ? `${cnpjDados.ddd_telefone_1}` : null
    const end = [cnpjDados.logradouro, cnpjDados.numero, cnpjDados.bairro, cnpjDados.municipio, cnpjDados.uf].filter(Boolean).join(', ')
    const { error } = await supabase.from('fornecedores_compra').insert({
      workspace_id: workspaceId,
      nome: cnpjDados.nome_fantasia || cnpjDados.razao_social,
      cnpj: chave,
      telefone: tel,
      email: cnpjDados.email || null,
      observacoes: end ? `Endereço: ${end}` : null,
      ativo: true,
    })
    if (error && !error.message?.includes('duplicate')) { toast.error('Erro: ' + error.message); return }
    setCnpjAdicionados(s => new Set([...s, chave]))
    toast.success('Fornecedor adicionado ao cadastro!')
    onAdicionarFornecedor?.()
  }

  const abas = [
    { key: 'fornecedor', label: 'Fornecedor' },
    { key: 'precos',     label: 'Preços' },
    { key: 'cnpj',       label: 'CNPJ' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header navy ERP */}
      <div style={{ background: C.navy, padding: '12px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MagnifyingGlassIcon style={{ width: 13, color: C.white }} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.white, letterSpacing: 0.2 }}>Radar de Compras</div>
        </div>
        <div style={{ display: 'flex' }}>
          {abas.map(a => (
            <button key={a.key} onClick={() => setAba(a.key)} style={{ flex: 1, padding: '7px 4px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', borderBottom: aba === a.key ? `2px solid ${C.white}` : '2px solid transparent', background: 'transparent', color: aba === a.key ? C.white : 'rgba(255,255,255,0.5)' }}>{a.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', background: C.bgPage }}>

        {/* ── aba Fornecedor ── */}
        {aba === 'fornecedor' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* formulário */}
            <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>O que você precisa cotar?</div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Produto *</label>
                <AutocompleteInput value={bProduto} onChange={setBProduto}
                  onSelect={s => setBProduto(typeof s === 'string' ? s : s.label)}
                  sugestoes={SUGESTOES_BUSCA} placeholder="Ex: Pneus, EPI, Ferramentas..."
                  inputStyle={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Cidade *</label>
                  <AutocompleteInput value={bCidade} onChange={setBCidade}
                    onSelect={s => { setBCidade(s.label); if (s.uf) setBUf(s.uf) }}
                    sugestoes={cidades} placeholder="Ex: Campo Grande"
                    inputStyle={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>UF</label>
                  <select value={bUf} onChange={e => setBUf(e.target.value)}
                    style={{ ...inp, appearance: 'none', paddingRight: 4 }}>
                    <option value="">-</option>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => <option key={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
              {/* chips sugestão */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {SUGESTOES_BUSCA.slice(0, 8).map(s => (
                  <button key={s} onClick={() => { setBProduto(s); if (bCidade.trim()) buscarFornecedores(s) }}
                    style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: bProduto === s ? C.blue : '#EFF6FF', border: `1px solid ${bProduto === s ? C.blue : '#BFDBFE'}`, cursor: 'pointer', color: bProduto === s ? C.white : C.blue }}>{s}</button>
                ))}
              </div>
              <button onClick={() => buscarFornecedores()} disabled={bLoading}
                style={{ width: '100%', padding: '8px 0', borderRadius: 6, background: C.navy, color: C.white, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: bLoading ? 0.7 : 1 }}>
                {bLoading ? <ArrowPathIcon style={{ width: 14, animation: 'spin 1s linear infinite' }} /> : <MagnifyingGlassIcon style={{ width: 14 }} />}
                {bLoading ? 'Buscando...' : 'Buscar Fornecedores'}
              </button>
            </div>

            {/* links externos */}
            {bProduto.trim() && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { label: 'Google Maps', url: `https://www.google.com/maps/search/${encodeURIComponent(`${bProduto} ${bCidade}`.trim())}`, color: '#ea4335' },
                  { label: 'Google', url: `https://www.google.com/search?q=${encodeURIComponent(`fornecedor ${bProduto} ${bCidade}`.trim())}`, color: '#4285f4' },
                  { label: 'Mercado Livre', url: `https://lista.mercadolivre.com.br/${encodeURIComponent(bProduto)}`, color: '#f5a623' },
                  { label: 'Alibaba', url: `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(bProduto)}`, color: '#ff6a00' },
                ].map(l => (
                  <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: `${l.color}18`, border: `1px solid ${l.color}40`, color: l.color, textDecoration: 'none' }}>
                    {l.label} ↗
                  </a>
                ))}
              </div>
            )}

            {/* toolbar lote */}
            {bSelecionados.size > 0 && bResultado && (
              <div style={{ background: '#EFF6FF', border: `1.5px solid ${C.border}`, borderLeft: `3px solid ${C.blue}`, borderRadius: 6, padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.blue }}>{bSelecionados.size} selecionado(s)</span>
                <button onClick={adicionarLote} style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: C.blue, border: 'none', cursor: 'pointer', color: C.white, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <PlusCircleIcon style={{ width: 12 }} />Cadastrar
                </button>
                <button onClick={waLote} style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: '#F0FDF4', border: '1px solid #86EFAC', cursor: 'pointer', color: C.green, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ChatBubbleLeftEllipsisIcon style={{ width: 12 }} />WA Lote
                </button>
                <button onClick={() => setBSelecionados(new Set())} style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: 5, fontSize: 10, background: 'transparent', border: `1px solid ${C.border}`, cursor: 'pointer', color: C.textSec }}>Limpar</button>
              </div>
            )}

            {/* resultados */}
            {bResultado && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: C.textSec }}>
                    <strong style={{ color: C.text }}>{bResultado.total || bResultado.fornecedores?.length}</strong> resultado(s) — <strong style={{ color: C.blue }}>{bResultado.produto}</strong> em <strong style={{ color: C.blue }}>{bResultado.cidade}</strong>
                  </div>
                  {bResultado.fornecedores?.length > 0 && (
                    <button onClick={toggleTodos} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'transparent', border: `1px solid ${C.border}`, cursor: 'pointer', color: C.textSec }}>
                      {(bResultado.fornecedores || []).every(e => bSelecionados.has(e.id)) ? 'Desmarcar' : 'Sel. Todos'}
                    </button>
                  )}
                </div>
                {(bResultado.fornecedores || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: C.textSec, background: '#F8FAFC', borderRadius: 6, border: `1px dashed ${C.border}`, fontSize: 12 }}>Nenhum fornecedor encontrado</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(bResultado.fornecedores || []).map(e => (
                      <FornecedorCardInline key={e.id} e={e}
                        onAdd={adicionarFornecedor}
                        added={bAdicionados.has(e.id || e.cnpj || e.nome)}
                        selecionado={bSelecionados.has(e.id)}
                        onToggle={() => toggleSel(e.id)}
                        onCnpj={irParaCnpj} />
                    ))}
                    {/* Carregar Mais */}
                    {bHasMore && (
                      <button onClick={carregarMais} disabled={bLoadingMore}
                        style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: '1.5px dashed #0ea5e9', background: 'rgba(14,165,233,0.05)', color: '#0ea5e9', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: bLoadingMore ? 0.7 : 1 }}>
                        {bLoadingMore
                          ? <><ArrowPathIcon style={{ width: 14, animation: 'spin 1s linear infinite' }} />Carregando...</>
                          : <>+ Carregar mais resultados (próximos 20)</>}
                      </button>
                    )}
                    {!bHasMore && (bResultado.fornecedores || []).length > 0 && (
                      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                        {(bResultado.fornecedores || []).length} resultado(s) — fim da lista
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!bResultado && !bLoading && (
              <div style={{ textAlign: 'center', padding: '28px 16px', background: C.bgCard, borderRadius: 8, border: `1px dashed ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <MagnifyingGlassIcon style={{ width: 30, margin: '0 auto 10px', opacity: 0.2, color: C.navy }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>Busque fornecedores por produto e cidade</div>
                <div style={{ fontSize: 11, color: C.textSec }}>Resultados via Google Maps (Serper.dev)</div>
              </div>
            )}
          </div>
        )}

        {/* ── aba Preços ── */}
        {aba === 'precos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <AutocompleteInput value={qPreco} onChange={setQPreco}
                onSelect={s => setQPreco(typeof s === 'string' ? s : s.label)}
                sugestoes={SUGESTOES_BUSCA} placeholder="Ex: Óleo 15W40 20L, Pneu 295/80..."
                inputStyle={{ ...inp, marginBottom: 8 }} />
              <button onClick={buscarPrecos} disabled={pLoading}
                style={{ width: '100%', padding: '8px 0', borderRadius: 6, background: C.navy, color: C.white, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: pLoading ? 0.7 : 1, marginTop: 8 }}>
                {pLoading ? <ArrowPathIcon style={{ width: 13, animation: 'spin 1s linear infinite' }} /> : <MagnifyingGlassIcon style={{ width: 13 }} />}
                {pLoading ? 'Pesquisando...' : 'Pesquisar Preços'}
              </button>
            </div>
            {qPreco.trim() && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {[
                  { label: 'Mercado Livre', url: `https://lista.mercadolivre.com.br/${encodeURIComponent(qPreco)}`, color: '#f5a623' },
                  { label: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(qPreco)}`, color: '#4285f4' },
                  { label: 'Amazon', url: `https://www.amazon.com.br/s?k=${encodeURIComponent(qPreco)}`, color: '#ff9900' },
                ].map(l => (
                  <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: '4px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: `${l.color}18`, border: `1px solid ${l.color}40`, color: l.color, textDecoration: 'none' }}>{l.label} ↗</a>
                ))}
              </div>
            )}
            {pResultado?.resultados?.length > 0 && (() => {
              const precos = pResultado.resultados.map(r => r.preco).filter(Boolean)
              const menor = Math.min(...precos), maior = Math.max(...precos)
              const media = precos.reduce((a, b) => a + b, 0) / precos.length
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[{ label: 'Menor', value: fmtBRL(menor), color: C.green }, { label: 'Média', value: fmtBRL(media), color: C.blue }, { label: 'Maior', value: fmtBRL(maior), color: C.amber }].map(k => (
                      <div key={k.label} style={{ background: `${k.color}10`, border: `1px solid ${k.color}25`, borderTop: `2px solid ${k.color}`, borderRadius: 6, padding: '7px 10px' }}>
                        <div style={{ fontSize: 9, color: C.textSec, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: k.color }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {['todos', 'ml', 'google'].map(f => (
                      <button key={f} onClick={() => setPFiltro(f)}
                        style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid', background: pFiltro === f ? C.blue : C.bgCard, color: pFiltro === f ? C.white : C.textSec, borderColor: pFiltro === f ? C.blue : C.border }}>
                        {{ todos: 'Todos', ml: 'ML', google: 'Google' }[f]}
                      </button>
                    ))}
                  </div>
                  {pResultado.resultados
                    .filter(r => pFiltro === 'todos' || (pFiltro === 'ml' && r.site === 'Mercado Livre') || (pFiltro === 'google' && r.site !== 'Mercado Livre'))
                    .map((item, i) => {
                      const isMenor = item.preco === menor
                      const siteBg = SITE_COLORS[item.site] ?? '#6b7280'
                      return (
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 10px', background: isMenor ? '#F0FDF4' : C.bgCard, borderRadius: 6, border: `1px solid ${isMenor ? '#86EFAC' : C.border}`, alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.titulo}</div>
                            <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 3 }}>
                              <span style={{ background: siteBg, color: siteBg === '#FFE600' ? '#111' : '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>{item.site}</span>
                              {isMenor && <span style={{ fontSize: 9, fontWeight: 800, color: C.green, letterSpacing: 0.3 }}>MENOR PREÇO</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: isMenor ? C.green : C.text }}>{fmtBRL(item.preco)}</div>
                            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: C.textSec, textDecoration: 'none' }}>ver ↗</a>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )
            })()}
            {!pResultado && !pLoading && (
              <div style={{ textAlign: 'center', padding: '28px 16px', background: C.bgCard, borderRadius: 8, border: `1px dashed ${C.border}`, color: C.textSec, fontSize: 12 }}>Digite o produto para pesquisar preços no Mercado Livre e Google Shopping</div>
            )}
          </div>
        )}

        {/* ── aba CNPJ ── */}
        {aba === 'cnpj' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* buscar por nome */}
            <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>Buscar CNPJ pelo nome</div>
              <div style={{ fontSize: 11, color: C.textSec, marginBottom: 8, marginTop: 6 }}>Pesquisa automática via Serper + Receita Federal</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <input value={cnpjNome} onChange={e => setCnpjNome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscarCnpjPorNome()}
                  placeholder="Nome da empresa" style={inp} />
                <input value={cnpjCidade} onChange={e => setCnpjCidade(e.target.value)}
                  placeholder="Cidade (opcional)" style={inp} />
              </div>
              <button onClick={buscarCnpjPorNome} disabled={cnpjNomeLoading}
                style={{ width: '100%', padding: '8px 0', borderRadius: 6, background: C.blue, border: 'none', color: C.white, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: cnpjNomeLoading ? 0.7 : 1 }}>
                {cnpjNomeLoading ? <ArrowPathIcon style={{ width: 13, animation: 'spin 1s linear infinite' }} /> : <MagnifyingGlassIcon style={{ width: 13 }} />}
                {cnpjNomeLoading ? 'Buscando...' : 'Buscar CNPJ'}
              </button>
            </div>
            {/* consulta direta */}
            <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>Consultar CNPJ diretamente</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={cnpjInput} onChange={e => setCnpjInput(fmtCNPJ(e.target.value))}
                  placeholder="00.000.000/0001-00" maxLength={18}
                  onKeyDown={e => e.key === 'Enter' && consultarCNPJDigits(cnpjInput.replace(/\D/g, ''))}
                  style={{ flex: 1, ...inp, fontFamily: 'monospace', letterSpacing: 1 }} />
                <button onClick={() => consultarCNPJDigits(cnpjInput.replace(/\D/g, ''))} disabled={cnpjLoading}
                  style={{ padding: '7px 12px', borderRadius: 6, background: C.blue, border: 'none', color: C.white, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, flexShrink: 0, opacity: cnpjLoading ? 0.7 : 1 }}>
                  {cnpjLoading ? <ArrowPathIcon style={{ width: 13, animation: 'spin 1s linear infinite' }} /> : <IdentificationIcon style={{ width: 13 }} />}
                  Consultar
                </button>
              </div>
              <div style={{ marginTop: 6, fontSize: 10, color: C.textSec }}>Dados via BrasilAPI (Receita Federal) · gratuito</div>
            </div>
            {cnpjDados && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <CnpjCardInline d={cnpjDados} onAdd={adicionarDoCNPJ} added={cnpjAdicionados.has(cnpjDados.cnpj)} />
              </div>
            )}
            {!cnpjDados && !cnpjLoading && !cnpjNomeLoading && (
              <div style={{ textAlign: 'center', padding: '24px 12px', background: C.bgCard, borderRadius: 8, border: `1px dashed ${C.border}`, color: C.textSec, fontSize: 12 }}>
                <IdentificationIcon style={{ width: 28, margin: '0 auto 8px', opacity: 0.2 }} />
                Consulte o CNPJ de um fornecedor para ver situação fiscal, sócios, capital social e mais
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── sub-component: Modal Nova Requisição ────────────────────────────────────
function ModalNovaReq({ workspaceId, onClose, onSalvo }) {
  const [form, setForm] = useState({
    titulo: '', urgencia: 'media',
    fornecedor_sugerido: '', data_necessidade: '', observacoes: '',
  })
  const [itens, setItens] = useState([{ descricao: '', quantidade: '1', unidade: 'un', valor_unitario: '' }])
  const [saving, setSaving] = useState(false)

  const F = (field, value) => setForm(p => ({ ...p, [field]: value }))
  const addItem    = () => setItens(p => [...p, { descricao: '', quantidade: '1', unidade: 'un', valor_unitario: '' }])
  const removeItem = i  => setItens(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : p)
  const setItem    = (i, k, v) => setItens(p => p.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  const totalItens = itens.reduce((acc, it) => {
    const v = parseFloat(it.valor_unitario || 0) * parseFloat(it.quantidade || 1)
    return acc + (isNaN(v) ? 0 : v)
  }, 0)

  async function salvar() {
    if (!form.titulo.trim()) { toast.error('Informe o título'); return }
    const listaValida = itens.filter(it => it.descricao.trim())
    if (listaValida.length === 0) { toast.error('Adicione pelo menos 1 item'); return }
    setSaving(true)
    const { data: inserted, error } = await supabase.from('solicitacoes_compra').insert({
      workspace_id:    workspaceId,
      titulo:          form.titulo.trim(),
      descricao:       form.observacoes?.trim() || null,
      valor_estimado:  totalItens > 0 ? totalItens : null,
      urgencia:        form.urgencia,
      fornecedor:      form.fornecedor_sugerido?.trim() || null,
      data_necessidade: form.data_necessidade || null,
      quantidade:      `${listaValida.length} item(s)`,
      status:          'pendente',
    }).select('id').single()
    if (error) { toast.error('Erro ao criar requisição'); setSaving(false); return }
    if (inserted?.id) {
      await supabase.from('itens_solicitacao_compra').insert(
        listaValida.map((it, i) => ({
          solicitacao_id: inserted.id,
          descricao:      it.descricao.trim(),
          quantidade:     parseFloat(it.quantidade) || 1,
          unidade:        it.unidade || 'un',
          valor_unitario: it.valor_unitario ? parseFloat(it.valor_unitario) : null,
          valor_total:    it.valor_unitario ? parseFloat(it.valor_unitario) * (parseFloat(it.quantidade) || 1) : null,
          ordem:          i,
        }))
      )
    }
    setSaving(false)
    toast.success('Requisição criada!')
    onSalvo()
    onClose()
  }

  const inputSt = { width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bgCard, color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }
  const labelSt = { fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,31,58,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: C.bgCard, borderRadius: 12, width: '100%', maxWidth: 560, boxShadow: '0 16px 48px rgba(11,31,58,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        {/* header navy */}
        <div style={{ background: C.navy, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase' }}>Nova Requisição de Compra</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginTop: 2 }}>Criar Solicitação</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, cursor: 'pointer', color: C.white, padding: 6, display: 'flex' }}>
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelSt}>Título da solicitação *</label>
            <input value={form.titulo} onChange={e => F('titulo', e.target.value)} placeholder="Ex: Compras Almoxarifado — Junho" style={inputSt} autoFocus />
          </div>

          {/* Lista de itens */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ ...labelSt, marginBottom: 0 }}>Itens a comprar *</label>
              <button type="button" onClick={addItem} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, background: 'rgba(59,130,246,0.1)', border: `1px solid ${C.blue}40`, cursor: 'pointer', color: C.blue, display: 'flex', alignItems: 'center', gap: 4 }}>
                + Item
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px 46px 88px 22px', gap: 4, marginBottom: 4 }}>
              {['Descrição','Qtd','Un.','Vlr unit.',''].map((h, i) => (
                <span key={i} style={{ fontSize: 9, color: C.textSec, textTransform: 'uppercase', fontWeight: 700 }}>{h}</span>
              ))}
            </div>
            {itens.map((it, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 56px 46px 88px 22px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <input style={inputSt} value={it.descricao} onChange={e => setItem(i, 'descricao', e.target.value)} placeholder={`Item ${i + 1}`} />
                <input style={inputSt} value={it.quantidade} onChange={e => setItem(i, 'quantidade', e.target.value)} type="number" min="0.001" step="any" />
                <select style={{ ...inputSt, padding: '8px 4px' }} value={it.unidade} onChange={e => setItem(i, 'unidade', e.target.value)}>
                  {['un','cx','kg','L','m','m²','sc','pc','par','rl'].map(u => <option key={u}>{u}</option>)}
                </select>
                <input style={inputSt} value={it.valor_unitario} onChange={e => setItem(i, 'valor_unitario', e.target.value)} type="number" step="0.01" placeholder="0,00" />
                <button type="button" onClick={() => removeItem(i)} style={{ padding: '2px 5px', borderRadius: 4, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', color: '#ef4444', fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            ))}
            {totalItens > 0 && (
              <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#10b981', marginTop: 2 }}>
                Total estimado: {totalItens.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelSt}>Urgência</label>
              <select value={form.urgencia} onChange={e => F('urgencia', e.target.value)} style={{ ...inputSt, appearance: 'none' }}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>Necessidade até</label>
              <input type="date" value={form.data_necessidade} onChange={e => F('data_necessidade', e.target.value)} style={inputSt} />
            </div>
          </div>
          <div>
            <label style={labelSt}>Fornecedor Sugerido</label>
            <input value={form.fornecedor_sugerido} onChange={e => F('fornecedor_sugerido', e.target.value)} placeholder="(opcional)" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Observações</label>
            <textarea value={form.observacoes} onChange={e => F('observacoes', e.target.value)} rows={2} placeholder="Especificações, marca, etc." style={{ ...inputSt, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ padding: '9px 24px', borderRadius: 6, background: C.blue, color: C.white, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : 'Criar Requisição'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── sub-component: Modal Configuração de Aprovador ─────────────────────────
function ModalConfigAprovador({ onClose }) {
  const [telefone, setTelefone] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('configuracoes').select('valor').eq('chave', 'aprovador_compras_telefone').limit(1)
      .then(({ data }) => {
        if (data?.[0]?.valor) {
          const val = String(data[0].valor).replace(/"/g, '')
          setTelefone(val)
          setSaved(true)
        }
      })
  }, [])

  async function handleSave() {
    if (!telefone.trim()) { toast.error('Informe o telefone do aprovador'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Usuario nao autenticado'); setSaving(false); return }

    const { error } = await supabase.from('configuracoes').upsert(
      { chave: 'aprovador_compras_telefone', valor: telefone.trim(), user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,chave' }
    )
    setSaving(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    setSaved(true)
    toast.success('Aprovador configurado!')
    onClose()
  }

  async function handleTestar() {
    if (!saved && !telefone.trim()) { toast.error('Salve o telefone primeiro'); return }
    setTesting(true)
    try {
      const res = await fetch('/api/notify-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento: '_teste', telefone: telefone.replace(/\D/g, '') }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.ok) toast.success('Mensagem de teste enviada!')
      else toast.error('Falha no teste: ' + (json.error || res.status))
    } catch (e) {
      toast.error('Erro de rede: ' + e.message)
    } finally {
      setTesting(false)
    }
  }

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: C.bgPage, border: `1px solid ${C.border}`, color: C.text, outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,31,58,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.bgCard, border: `1px solid ${C.border}`, boxShadow: '0 16px 48px rgba(11,31,58,0.2)', borderRadius: 14, width: '100%', maxWidth: 430, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Aprovador de Compras</div>
            <div style={{ fontSize: 12, color: C.textSec, marginTop: 3 }}>Recebe aviso no WhatsApp a cada nova solicitacao</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, fontSize: 20 }}>x</button>
        </div>

        {saved && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', marginBottom: 12, fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
            Aprovador configurado - notificacoes ativas
          </div>
        )}

        <div style={{ padding: '14px', borderRadius: 10, background: '#F5F3FF', border: '1px solid #DDD6FE', marginBottom: 16, fontSize: 12, color: C.textSec, lineHeight: 1.6 }}>
          Configure uma vez e toda requisicao enviada para aprovacao interna dispara notificacao automatica para este numero.
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, display: 'block' }}>
          WhatsApp do aprovador
        </label>
        <input
          style={inputStyle}
          value={telefone}
          onChange={e => { setTelefone(e.target.value); setSaved(false) }}
          placeholder="5511999990000"
          autoFocus
        />
        <div style={{ fontSize: 11, color: C.textSec, marginTop: 5 }}>
          Inclua DDD e codigo do pais. Ex: 5511999990000
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 18 }}>
          <button onClick={handleTestar} disabled={testing || !telefone.trim()} style={{ padding: '9px 14px', borderRadius: 8, background: 'none', border: `1px solid ${C.border}`, cursor: (testing || !telefone.trim()) ? 'not-allowed' : 'pointer', color: C.textSec, fontSize: 12, opacity: (testing || !telefone.trim()) ? 0.5 : 1 }}>
            {testing ? 'Enviando...' : 'Testar'}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer', color: C.textSec, fontSize: 13 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: C.violet, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Painel Detalhe da requisição selecionada ─────────────────────────────────
function PainelDetalhe({ item, workspaceId, onAcao, onClose, onNovaReq }) {
  const [tabD, setTabD] = useState('detalhe') // detalhe | cotacoes | historico | radar
  const [cotacoes, setCotacoes] = useState([])
  const [eventos, setEventos] = useState([])
  const [itensReq, setItensReq] = useState([])
  const [fornecedoresCadastro, setFornecedoresCadastro] = useState([])
  const [novoFornecedorId, setNovoFornecedorId] = useState('')
  const [novoFornecedorBusca, setNovoFornecedorBusca] = useState('')
  const [trocaFornecedorPorCotacao, setTrocaFornecedorPorCotacao] = useState({})
  const [trocaFornecedorBuscaPorCotacao, setTrocaFornecedorBuscaPorCotacao] = useState({})
  const [updatingCotacaoId, setUpdatingCotacaoId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sendingCotacaoId, setSendingCotacaoId] = useState(null)
  const detailWorkspaceId = workspaceId || item?.workspace_id || null

  useEffect(() => {
    if (!item) return
    setLoading(true)
    setTabD('detalhe')
    Promise.all([
      supabase.from('cotacoes_compra').select('*').eq('solicitacao_id', item.id),
      supabase.from('solicitacao_compra_eventos').select('*').eq('solicitacao_id', item.id).order('criado_em', { ascending: false }).limit(15),
      detailWorkspaceId
        ? supabase.from('fornecedores_compra').select('id, nome, telefone, ativo').eq('workspace_id', detailWorkspaceId).eq('ativo', true).order('nome', { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase.from('itens_solicitacao_compra').select('*').eq('solicitacao_id', item.id).order('ordem', { ascending: true }),
    ]).then(async ([{ data: cot }, { data: ev }, { data: forn }, { data: itens }]) => {
      const cotacoesBase = cot || []
      const fornecedoresBase = forn || []

      // Reconcilia telefone ausente em todas as cotações usando a tabela de fornecedores.
      const updatesTelefone = []
      const cotacoesRecon = cotacoesBase.map(c => {
        if (c.fornecedor_telefone) return c
        const nomeCot = norm(c.fornecedor_nome)
        const match = fornecedoresBase.find(f => norm(f.nome) === nomeCot)
          || fornecedoresBase.find(f => norm(f.nome).includes(nomeCot) || nomeCot.includes(norm(f.nome)))

        if (match?.telefone) {
          updatesTelefone.push({ id: c.id, fornecedor_telefone: match.telefone })
          return { ...c, fornecedor_telefone: match.telefone }
        }
        return c
      })

      if (updatesTelefone.length > 0) {
        await Promise.all(
          updatesTelefone.map(u =>
            supabase.from('cotacoes_compra').update({ fornecedor_telefone: u.fornecedor_telefone }).eq('id', u.id)
          )
        )
      }

      setCotacoes(cotacoesRecon)
      setEventos((ev || []).map(normalizeEvento))
      setFornecedoresCadastro(fornecedoresBase)
      setItensReq(itens || [])
      setNovoFornecedorId('')
      setNovoFornecedorBusca('')
      setTrocaFornecedorPorCotacao({})
      setTrocaFornecedorBuscaPorCotacao({})
      setLoading(false)
    })
  }, [item?.id, detailWorkspaceId])

  if (!item) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: C.textSec }}>
        <ClipboardDocumentListIcon style={{ width: 36, opacity: 0.2 }} />
        <div style={{ fontSize: 12, fontWeight: 600 }}>Selecione uma requisição</div>
        <div style={{ fontSize: 11, color: C.textSec }}>Clique em um item da lista</div>
      </div>
    )
  }

  const badge = STATUS_BADGE_MAP[item.status] || { label: item.status, bg: '#F8FAFC', color: C.textSec, border: C.border }
  const urgColor = URGENCIA_COLORS[item.urgencia] || '#6b7280'
  const economia = (item.valor_orcado && item.valor_aprovado && item.valor_aprovado < item.valor_orcado)
    ? item.valor_orcado - item.valor_aprovado : null

  const acoes = []
  if (item.status === 'pendente') {
    acoes.push({ label: 'Enviar p/ Aprovação', color: C.blue, border: '#BFDBFE', bg: '#EFF6FF', action: 'enviar_aprovacao' })
  }
  if (item.status === 'aguardando_aprovacao') {
    acoes.push({ label: 'Aprovar', color: C.green, border: '#86EFAC', bg: '#F0FDF4', action: 'aprovar' })
    acoes.push({ label: 'Abrir Leilão', color: C.sky, border: '#BAE6FD', bg: '#F0F9FF', action: 'leilao' })
    acoes.push({ label: 'Recusar', color: C.red, border: '#FECACA', bg: '#FEF2F2', action: 'recusar' })
  }
  if (item.status === 'aprovado') acoes.push({ label: 'Emitir Pedido', color: C.violet, border: '#C4B5FD', bg: '#F5F3FF', action: 'emitir_pedido' })
  if (item.status === 'pedido_emitido') acoes.push({ label: 'Confirmar Recebimento', color: C.green, border: '#86EFAC', bg: '#F0FDF4', action: 'receber' })
  if (item.status === 'recebido') acoes.push({ label: 'Marcar Pago', color: '#0F766E', border: '#99F6E4', bg: '#F0FDFA', action: 'pagar' })

  const TABS_D = [
    { key: 'detalhe',   label: 'Detalhe' },
    { key: 'cotacoes',  label: `Cotações${cotacoes.length ? ` (${cotacoes.length})` : ''}` },
    { key: 'historico', label: 'Histórico' },
    { key: 'radar',     label: 'Radar' },
  ]

  function resolverFornecedorIdCotacao(cotacao) {
    const selecionado = trocaFornecedorPorCotacao[cotacao.id]
    if (selecionado) return selecionado
    const nomeCot = norm(cotacao.fornecedor_nome)
    const match = fornecedoresCadastro.find(f => norm(f.nome) === nomeCot)
      || fornecedoresCadastro.find(f => norm(f.nome).includes(nomeCot) || nomeCot.includes(norm(f.nome)))
    return match?.id || null
  }

  async function enviarCotacaoAutomatico(cotacao) {
    if (!cotacao?.id) return
    setSendingCotacaoId(cotacao.id)
    try {
      const fornecedorId = resolverFornecedorIdCotacao(cotacao)
      const res = await fetch('/api/cotacao-enviar-wa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotacaoId: cotacao.id, fornecedorId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        toast.error(json?.error || 'Falha ao enviar mensagem automatica')
        return
      }
      toast.success('Link enviado automaticamente no WhatsApp')
    } catch (e) {
      toast.error('Erro de rede: ' + e.message)
    } finally {
      setSendingCotacaoId(null)
    }
  }

  async function trocarFornecedorCotacao(cotacao) {
    let fornecedorId = trocaFornecedorPorCotacao[cotacao.id]
    if (!fornecedorId && (trocaFornecedorBuscaPorCotacao[cotacao.id] || '').trim()) {
      const q = norm(trocaFornecedorBuscaPorCotacao[cotacao.id])
      const byName = fornecedoresCadastro.find(f => norm(f.nome) === q)
        || fornecedoresCadastro.find(f => norm(f.nome).includes(q))
      if (byName) fornecedorId = byName.id
    }
    if (!fornecedorId) {
      toast.error('Selecione um fornecedor cadastrado')
      return
    }
    const fornecedor = fornecedoresCadastro.find(f => String(f.id) === String(fornecedorId))
    if (!fornecedor) {
      toast.error('Fornecedor nao encontrado')
      return
    }

    setUpdatingCotacaoId(cotacao.id)
    const { error } = await supabase
      .from('cotacoes_compra')
      .update({
        fornecedor_nome: fornecedor.nome,
        fornecedor_telefone: fornecedor.telefone || null,
        status: 'convidado',
      })
      .eq('id', cotacao.id)

    if (error) {
      setUpdatingCotacaoId(null)
      toast.error('Erro ao alterar fornecedor: ' + error.message)
      return
    }

    const { data: cotAtualizadas } = await supabase.from('cotacoes_compra').select('*').eq('solicitacao_id', item.id)
    setCotacoes(cotAtualizadas || [])
    setTrocaFornecedorPorCotacao(prev => ({ ...prev, [cotacao.id]: '' }))
    setTrocaFornecedorBuscaPorCotacao(prev => ({ ...prev, [cotacao.id]: '' }))
    setUpdatingCotacaoId(null)
    toast.success('Fornecedor da cotacao atualizado')
  }

  async function adicionarFornecedorCadastrado() {
    let fornecedorId = novoFornecedorId
    if (!fornecedorId && novoFornecedorBusca.trim()) {
      const q = norm(novoFornecedorBusca)
      const byName = fornecedoresCadastro.find(f => norm(f.nome) === q)
        || fornecedoresCadastro.find(f => norm(f.nome).includes(q))
      if (byName) fornecedorId = byName.id
    }
    if (!fornecedorId) {
      toast.error('Selecione um fornecedor cadastrado')
      return
    }

    const fornecedor = fornecedoresCadastro.find(f => String(f.id) === String(fornecedorId))
    if (!fornecedor) {
      toast.error('Fornecedor nao encontrado')
      return
    }

    const jaExiste = cotacoes.some(c => {
      const nomeA = String(c.fornecedor_nome || '').trim().toLowerCase()
      const nomeB = String(fornecedor.nome || '').trim().toLowerCase()
      const telA = String(c.fornecedor_telefone || '').replace(/\D/g, '')
      const telB = String(fornecedor.telefone || '').replace(/\D/g, '')
      return nomeA === nomeB && telA === telB
    })
    if (jaExiste) {
      toast.error('Este fornecedor ja foi indicado neste leilao')
      return
    }

    setUpdatingCotacaoId('new')
    const { error } = await supabase.from('cotacoes_compra').insert({
      solicitacao_id: item.id,
      fornecedor_nome: fornecedor.nome,
      fornecedor_telefone: fornecedor.telefone || null,
      token_expira_em: item.prazo_cotacao || null,
      status: 'convidado',
    })

    if (error) {
      setUpdatingCotacaoId(null)
      toast.error('Erro ao adicionar fornecedor: ' + error.message)
      return
    }

    const { data: cotAtualizadas } = await supabase.from('cotacoes_compra').select('*').eq('solicitacao_id', item.id)
    setCotacoes(cotAtualizadas || [])
    setNovoFornecedorId('')
    setNovoFornecedorBusca('')
    setUpdatingCotacaoId(null)
    toast.success('Fornecedor cadastrado adicionado ao leilao')
  }

  const sugestoesFornecedores = fornecedoresCadastro.map(f => ({
    id: f.id,
    label: f.nome,
    sub: f.telefone || '',
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* header navy */}
      <div style={{ padding: '12px 14px 0', background: C.navy }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 }}>
              INFORMAÇÕES DA REQUISIÇÃO
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.white, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.titulo}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>{badge.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: urgColor, background: `${urgColor}33`, padding: '2px 7px', borderRadius: 4 }}>{(item.urgencia || '').toUpperCase()}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, cursor: 'pointer', color: C.white, padding: 6, display: 'flex', flexShrink: 0 }}>
            <XMarkIcon style={{ width: 14 }} />
          </button>
        </div>
        {/* tabs */}
        <div style={{ display: 'flex' }}>
          {TABS_D.map(t => (
            <button key={t.key} onClick={() => setTabD(t.key)} style={{ flex: 1, padding: '7px 3px', fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', borderBottom: tabD === t.key ? '2px solid #fff' : '2px solid transparent', background: 'transparent', color: tabD === t.key ? '#fff' : 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Tab Detalhe ── */}
        {tabD === 'detalhe' && (
          <>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                {[
                  { label: 'Item', value: item.categoria || '—' },
                  { label: 'Origem', value: item.origem || 'Manual' },
                  { label: 'Equipamento', value: item.equipamento || '—' },
                  { label: 'Solicitante', value: item.requisitante_nome || '—' },
                  { label: 'Prioridade', value: <span style={{ color: urgColor, fontWeight: 700 }}>{item.urgencia ? item.urgencia.charAt(0).toUpperCase() + item.urgencia.slice(1) : '—'}</span> },
                  { label: 'Prazo necessário', value: item.data_necessidade ? <span style={{ color: new Date(item.data_necessidade) <= new Date() ? C.red : C.text, fontWeight: 700 }}>{fmtDate(item.data_necessidade)}</span> : '—' },
                ].map(r => (
                  <div key={r.label}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 }}>{r.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.value}</div>
                  </div>
                ))}
              </div>
              {item.observacoes && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: '#F8FAFC', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 11, color: C.textSec, fontStyle: 'italic', lineHeight: 1.5 }}>{item.observacoes}</div>
              )}
            </div>

            {/* Lista de Itens */}
            {itensReq.length > 0 && (
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Itens ({itensReq.length})</div>
                {itensReq.map((it, idx) => (
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12,
                    padding: '5px 0', borderBottom: idx < itensReq.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <span style={{ color: C.text }}>{it.descricao}</span>
                    <span style={{ color: C.textSec, flexShrink: 0, marginLeft: 8 }}>
                      {it.quantidade} {it.unidade || 'un'}{it.valor_total ? ` · ${fmtBRL(it.valor_total)}` : ''}
                    </span>
                  </div>
                ))}
                {item.valor_estimado > 0 && (
                  <div style={{ marginTop: 6, textAlign: 'right', fontSize: 12, fontWeight: 800, color: C.green }}>
                    Total: {fmtBRL(item.valor_estimado)}
                  </div>
                )}
              </div>
            )}
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Resumo Financeiro</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Valor estimado', value: item.valor_orcado ? fmtBRL(item.valor_orcado) : '—', color: C.text },
                  { label: 'Valor aprovado', value: item.valor_aprovado ? fmtBRL(item.valor_aprovado) : '—', color: C.green },
                  { label: 'Fornecedor', value: item.fornecedor_vencedor || item.fornecedor_sugerido || '—', color: C.textSec },
                  { label: 'Última compra', value: item.ultima_compra ? fmtDate(item.ultima_compra) : '—', color: C.textSec },
                ].map(r => (
                  <div key={r.label} style={{ padding: '7px 10px', background: '#F8FAFC', borderRadius: 6, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 9, color: C.textSec, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>{r.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: r.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</div>
                  </div>
                ))}
              </div>
              {economia && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: '#F0FDF4', borderRadius: 6, border: '1px solid #86EFAC', fontSize: 11, color: C.green, fontWeight: 700 }}>
                  Economia estimada: {fmtBRL(economia)} ({Math.round((economia / item.valor_orcado) * 100)}%)
                </div>
              )}
            </div>

            {/* Próximas Ações */}
            {acoes.length > 0 && (
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Próximas Ações</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {acoes.map(a => (
                    <button key={a.action} onClick={() => onAcao(item, a.action)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: a.bg, color: a.color, cursor: 'pointer', border: `1px solid ${a.border}`, textAlign: 'left' }}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Atalhos Rápidos */}
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Atalhos Rápidos</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { label: '+ Nova Requisição', color: C.blue, icon: PlusCircleIcon, action: () => { onNovaReq?.() } },
                  { label: 'Solicitar Cotação', color: C.sky, icon: DocumentTextIcon, action: () => {
                    if (!item) { toast('Selecione uma requisição', { icon: 'ℹ️' }); return }
                    onClose(); toast('Acesse a aba Radar para solicitar cotações', { icon: '💡' })
                  }},
                  { label: 'Aprovar Itens', color: C.green, icon: CheckCircleIcon, action: () => {
                    if (!item) { toast('Selecione uma requisição', { icon: 'ℹ️' }); return }
                    if (item.status !== 'aguardando_aprovacao') { toast.error('Item não está aguardando aprovação'); return }
                    onAcao(item, 'aprovar')
                  }},
                  { label: 'Pedidos Emitidos', color: C.violet, icon: ShoppingCartIcon, action: () => {
                    if (!item) { toast('Selecione uma requisição', { icon: 'ℹ️' }); return }
                    if (!['aprovado','leilao_encerrado'].includes(item.status)) { toast.error('Item precisa estar Aprovado para emitir pedido'); return }
                    onAcao(item, 'emitir_pedido')
                  }},
                ].map(a => (
                  <button key={a.label} onClick={a.action} style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: `${a.color}0F`, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: a.color, display: 'flex', alignItems: 'center', gap: 5, textAlign: 'left' }}>
                    <a.icon style={{ width: 12, flexShrink: 0 }} /> {a.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Tab Cotações ── */}
        {tabD === 'cotacoes' && (
          <div style={{ padding: '12px 14px' }}>
            <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#F8FAFC' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 }}>Indicar novo fornecedor cadastrado</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1 }}>
                  <AutocompleteInput
                    value={novoFornecedorBusca}
                    onChange={v => { setNovoFornecedorBusca(v); setNovoFornecedorId('') }}
                    onSelect={s => {
                      setNovoFornecedorId(s.id)
                      setNovoFornecedorBusca(s.label)
                    }}
                    sugestoes={sugestoesFornecedores}
                    placeholder="Digite para buscar fornecedor"
                    inputStyle={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: C.text, fontSize: 11, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  onClick={adicionarFornecedorCadastrado}
                  disabled={updatingCotacaoId === 'new'}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #BFDBFE', background: '#EFF6FF', color: C.blue, fontSize: 11, fontWeight: 700, cursor: updatingCotacaoId === 'new' ? 'not-allowed' : 'pointer', opacity: updatingCotacaoId === 'new' ? 0.6 : 1 }}>
                  {updatingCotacaoId === 'new' ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </div>
            {cotacoes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: C.textSec, fontSize: 12 }}>
                <DocumentTextIcon style={{ width: 28, margin: '0 auto 8px', display: 'block', opacity: 0.2 }} />
                Nenhum fornecedor indicado para leilão ainda
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: C.violet }}>
                  LEILAO - {cotacoes.filter(c => c.status === 'enviado').length}/{cotacoes.length} propostas recebidas
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cotacoes.map(c => {
                  const statusCot = c.status === 'enviado'
                    ? 'Proposta Recebida'
                    : c.status === 'visualizado'
                      ? 'Visualizou'
                      : c.status === 'ganhou'
                        ? 'Vencedor'
                        : c.status === 'perdeu'
                          ? 'Nao selecionado'
                          : 'Convidado'
                  const colorCot = c.status === 'enviado' || c.status === 'ganhou' ? C.green : c.status === 'visualizado' ? C.blue : C.textSec
                  const link = c.token_acesso ? `${window.location.origin}/cotacao/${c.token_acesso}` : null
                  const msgWA = `Ola ${c.fornecedor_nome || 'fornecedor'}! Por favor envie sua cotacao para *${item?.titulo || 'esta solicitacao'}* pelo link abaixo:\n${link || ''}`
                  return (
                    <div key={c.id} style={{ padding: '10px 12px', background: c.vencedor ? '#F0FDF4' : '#F8FAFC', borderRadius: 8, border: `1px solid ${c.vencedor ? '#86EFAC' : C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{c.fornecedor_nome}</div>
                          <div style={{ fontSize: 10, color: colorCot, fontWeight: 600, marginTop: 2 }}>{statusCot}</div>
                          {c.fornecedor_telefone && <div style={{ fontSize: 10, color: C.textSec, marginTop: 2 }}>Tel: {c.fornecedor_telefone}</div>}
                          {c.prazo_entrega_dias && <div style={{ fontSize: 10, color: C.textSec, marginTop: 2 }}>Prazo: {c.prazo_entrega_dias} dias</div>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {c.valor_total && <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>{fmtBRL(c.valor_total)}</div>}
                          {c.status === 'ganhou' && <div style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>🏆 Vencedor</div>}
                        </div>
                      </div>

                      {link && ['convidado', 'visualizado'].includes(c.status) && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(link)
                              toast.success('Link de cotacao copiado!')
                            }}
                            style={{ padding: '4px 8px', borderRadius: 5, background: '#EEF2FF', border: '1px solid #C7D2FE', cursor: 'pointer', color: '#4F46E5', fontSize: 10, fontWeight: 700 }}>
                            Copiar link
                          </button>
                          <button
                            onClick={() => enviarCotacaoAutomatico(c)}
                            disabled={sendingCotacaoId === c.id}
                            style={{ padding: '4px 8px', borderRadius: 5, background: '#E0F2FE', border: '1px solid #7DD3FC', cursor: sendingCotacaoId === c.id ? 'not-allowed' : 'pointer', color: '#0369A1', fontSize: 10, fontWeight: 700, opacity: sendingCotacaoId === c.id ? 0.6 : 1 }}>
                            {sendingCotacaoId === c.id ? 'Enviando...' : 'Enviar automatico'}
                          </button>
                          {c.fornecedor_telefone && (
                            <a
                              href={`https://wa.me/${String(c.fornecedor_telefone).replace(/\D/g, '')}?text=${encodeURIComponent(msgWA)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ padding: '4px 8px', borderRadius: 5, background: '#ECFDF3', border: '1px solid #86EFAC', textDecoration: 'none', color: '#16A34A', fontSize: 10, fontWeight: 700 }}>
                              Enviar no WhatsApp
                            </a>
                          )}
                          <div style={{ minWidth: 210, flex: '1 1 210px' }}>
                            <AutocompleteInput
                              value={trocaFornecedorBuscaPorCotacao[c.id] || ''}
                              onChange={v => {
                                setTrocaFornecedorBuscaPorCotacao(prev => ({ ...prev, [c.id]: v }))
                                setTrocaFornecedorPorCotacao(prev => ({ ...prev, [c.id]: '' }))
                              }}
                              onSelect={s => {
                                setTrocaFornecedorPorCotacao(prev => ({ ...prev, [c.id]: s.id }))
                                setTrocaFornecedorBuscaPorCotacao(prev => ({ ...prev, [c.id]: s.label }))
                              }}
                              sugestoes={sugestoesFornecedores}
                              placeholder="Trocar por fornecedor cadastrado"
                              inputStyle={{ width: '100%', padding: '4px 8px', borderRadius: 5, border: `1px solid ${C.border}`, background: '#fff', color: C.text, fontSize: 10, outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                            <button
                              onClick={() => trocarFornecedorCotacao(c)}
                              disabled={updatingCotacaoId === c.id}
                              style={{ padding: '4px 8px', borderRadius: 5, background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', fontSize: 10, fontWeight: 700, cursor: updatingCotacaoId === c.id ? 'not-allowed' : 'pointer', opacity: updatingCotacaoId === c.id ? 0.6 : 1 }}>
                              {updatingCotacaoId === c.id ? 'Salvando...' : 'Trocar'}
                            </button>
                        </div>
                      )}
                    </div>
                  )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tab Histórico ── */}
        {tabD === 'historico' && (
          <div style={{ padding: '12px 14px' }}>
            {eventos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: C.textSec, fontSize: 12 }}>Sem eventos registrados</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {eventos.map((e, i) => (
                  <div key={e.id} style={{ display: 'flex', gap: 10, paddingBottom: 14, position: 'relative' }}>
                    {i < eventos.length - 1 && <div style={{ position: 'absolute', left: 7, top: 14, bottom: 0, width: 1, background: C.border }} />}
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: C.violet, border: '2px solid #fff', flexShrink: 0, marginTop: 1, zIndex: 1 }} />
                    <div>
                      <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{e.descricao || e.acao}</div>
                      <div style={{ fontSize: 10, color: C.textSec, marginTop: 2 }}>{fmtDate(e.created_at)} · {e.usuario_nome || 'Sistema'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab Radar ── */}
        {tabD === 'radar' && (
          <div style={{ minHeight: 400 }}>
            <RadarPanel workspaceId={workspaceId} onAdicionarFornecedor={() => toast.success('Fornecedor adicionado!')} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Fluxo Horizontal ────────────────────────────────────────────────────────
function FluxoHorizontal({ counts }) {
  const FLOW = [
    { key: 'pendente',             label: 'Requisição',      icon: ClipboardDocumentListIcon, color: '#3b82f6' },
    { key: 'aguardando_aprovacao', label: 'Aprovação',       icon: ExclamationTriangleIcon,   color: '#f59e0b' },
    { key: 'em_cotacao',           label: 'Cotação',         icon: SignalIcon,                color: '#8b5cf6' },
    { key: 'leilao_encerrado',     label: 'Comparativo',     icon: ChartBarIcon,              color: '#0ea5e9' },
    { key: 'aprovado',             label: 'Pedido',          icon: ShoppingCartIcon,          color: '#10b981' },
    { key: 'pedido_emitido',       label: 'Recebimento',     icon: TruckIcon,                 color: '#059669' },
    { key: 'recebido',             label: 'NF / Financeiro', icon: BanknotesIcon,             color: '#14b8a6' },
    { key: 'pago',                 label: 'Pago',            icon: CheckCircleIcon,           color: '#6b7280' },
  ]
  return (
    <div style={{ padding: '8px 20px', background: C.bgCard, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', overflowX: 'auto', gap: 0, flexShrink: 0 }}>
      {FLOW.map((f, i) => {
        const count = counts[f.key] || 0
        const Icon = f.icon
        return (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '5px 12px', borderRadius: 7, background: count > 0 ? `${f.color}0F` : 'transparent', border: count > 0 ? `1px solid ${f.color}30` : '1px solid transparent' }}>
              <div style={{ position: 'relative' }}>
                <Icon style={{ width: 18, height: 18, color: count > 0 ? f.color : '#cbd5e1' }} />
                {count > 0 && (
                  <span style={{ position: 'absolute', top: -5, right: -7, fontSize: 9, fontWeight: 900, color: '#fff', background: f.color, borderRadius: 99, padding: '0 4px', minWidth: 13, textAlign: 'center', lineHeight: '13px' }}>{count}</span>
                )}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: count > 0 ? f.color : '#94a3b8', whiteSpace: 'nowrap' }}>{f.label}</div>
            </div>
            {i < FLOW.length - 1 && <div style={{ color: '#cbd5e1', fontSize: 14, margin: '0 1px', paddingBottom: 14 }}>›</div>}
          </div>
        )
      })}
    </div>
  )
}

// ─── Donut Categorias ────────────────────────────────────────────────────────
function DonutCategoria({ items }) {
  const catMap = {}
  items.forEach(i => { const k = i.categoria || 'Outros'; catMap[k] = (catMap[k] || 0) + (i.valor_orcado || 1) })
  const total = Object.values(catMap).reduce((a, b) => a + b, 0)
  const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']
  const R = 36, cx = 50, cy = 50, sw = 14
  let cum = 0
  const arcs = entries.map(([label, val], i) => {
    const pct = val / total; const start = cum; cum += pct
    return { label, val, pct, start, color: COLORS[i] }
  })
  function describeArc(pct, start) {
    if (pct >= 1) pct = 0.9999
    const s = start * 2 * Math.PI - Math.PI / 2, e = (start + pct) * 2 * Math.PI - Math.PI / 2
    return `M ${cx + R * Math.cos(s)} ${cy + R * Math.sin(s)} A ${R} ${R} 0 ${pct > 0.5 ? 1 : 0} 1 ${cx + R * Math.cos(e)} ${cy + R * Math.sin(e)}`
  }
  if (entries.length === 0) return (
    <div style={{ background: C.bgCard, borderRadius: 10, border: `1px solid ${C.border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSec, fontSize: 11 }}>
      Sem dados de categoria
    </div>
  )
  return (
    <div style={{ background: C.bgCard, borderRadius: 10, border: `1px solid ${C.border}`, padding: '12px 14px', overflow: 'hidden' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.text, marginBottom: 10 }}>Compras por Categoria</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <svg width={90} height={90} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
          {arcs.map(a => (
            <path key={a.label} d={describeArc(a.pct, a.start)} fill="none" stroke={a.color} strokeWidth={sw} strokeLinecap="butt" />
          ))}
          <circle cx={cx} cy={cy} r={R - sw / 2 - 1} fill={C.bgCard} />
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={14} fontWeight={900} fill={C.text}>{items.length}</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize={7} fill={C.textSec}>itens</text>
        </svg>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {arcs.map(a => (
            <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
              <div style={{ fontSize: 10, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec }}>{Math.round(a.pct * 100)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Mapa Comparativo ────────────────────────────────────────────────────────
function MapaComparativo({ item }) {
  const [cotacoes, setCotacoes] = useState([])
  useEffect(() => {
    if (!item?.id) { setCotacoes([]); return }
    supabase.from('cotacoes_compra').select('*').eq('solicitacao_id', item.id)
      .then(({ data }) => setCotacoes((data || []).filter(c => c.proposta_valor)))
  }, [item?.id])

  const menorPreco = cotacoes.length ? Math.min(...cotacoes.map(c => c.proposta_valor)) : null
  return (
    <div style={{ background: C.bgCard, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.text }}>Mapa Comparativo</div>
          <div style={{ fontSize: 10, color: C.textSec, marginTop: 1 }}>{item ? item.titulo : 'Selecione uma requisição'}</div>
        </div>
        {cotacoes.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.blue }}>{cotacoes.length} proposta(s)</span>}
      </div>
      {!item || cotacoes.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: C.textSec, fontSize: 11 }}>
          {!item ? 'Selecione uma requisição' : 'Nenhuma proposta recebida'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Fornecedor', 'Preço', 'Prazo', 'Cond.', 'Aval.', ''].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: C.textSec, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cotacoes.map(c => {
                const isMelhor = c.proposta_valor === menorPreco
                return (
                  <tr key={c.id} style={{ background: isMelhor ? '#F0FDF4' : 'transparent', borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: C.text }}>{c.fornecedor_nome}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 800, color: isMelhor ? C.green : C.text }}>{fmtBRL(c.proposta_valor)}</td>
                    <td style={{ padding: '7px 10px', color: C.textSec }}>{c.prazo_entrega || '—'}</td>
                    <td style={{ padding: '7px 10px', color: C.textSec }}>{c.condicao_pagamento || '—'}</td>
                    <td style={{ padding: '7px 10px', color: C.amber }}>{c.avaliacao ? '★'.repeat(Math.round(c.avaliacao)) : '—'}</td>
                    <td style={{ padding: '7px 10px' }}>
                      {isMelhor && <span style={{ fontSize: 9, fontWeight: 800, color: C.green, background: '#DCFCE7', border: '1px solid #86EFAC', padding: '1px 6px', borderRadius: 99 }}>Melhor custo</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Auditoria Recente ────────────────────────────────────────────────────────
function AuditoriaRecente({ workspaceId }) {
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  useEffect(() => {
    if (!workspaceId) return
    supabase.from('solicitacao_compra_eventos')
      .select('id, observacao, acao, ator, criado_em')
      .order('criado_em', { ascending: false })
      .limit(8)
      .then(({ data }) => setLogs((data || []).map(normalizeEvento)))
  }, [workspaceId])

  return (
    <div style={{ background: C.bgCard, borderRadius: 10, border: `1px solid ${C.border}`, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.text }}>Auditoria Recente</div>
        <button onClick={() => navigate('/compras')} style={{ fontSize: 10, color: C.blue, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver todas</button>
      </div>
      {logs.length === 0 ? (
        <div style={{ fontSize: 11, color: C.textSec, textAlign: 'center', padding: '12px 0' }}>Sem registros</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {logs.map(l => {
            const dtStr = new Date(l.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            const inicial = (l.usuario_nome || 'S')[0].toUpperCase()
            return (
              <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.navy, color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{inicial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: C.text, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descricao || l.acao}</div>
                  <div style={{ fontSize: 9, color: C.textSec, marginTop: 1 }}>{dtStr} · {l.usuario_nome || 'Sistema'}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Modal: Encerrar leilão + selecionar vencedor (inline no ERP) ────────────
function ModalVencedorERP({ item, workspaceId, onClose, onSaved }) {
  const [cotacoes,   setCotacoes]   = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    supabase.from('cotacoes_compra').select('*').eq('solicitacao_id', item.id)
      .then(({ data }) => setCotacoes(data || []))
  }, [item.id])

  const enviadas = cotacoes.filter(c => c.status === 'enviado').sort((a, b) => (a.valor_total || 999999) - (b.valor_total || 999999))

  async function handleSelecionar() {
    if (!selecionado) { toast.error('Selecione um fornecedor'); return }
    setSaving(true)
    try {
      const cot = cotacoes.find(c => c.id === selecionado)
      const { error } = await supabase.from('solicitacoes_compra').update({
        status: 'aprovado',
        fornecedor_vencedor: cot.fornecedor_nome,
        valor_aprovado: cot.valor_total,
        economia: Math.max(0, (item.valor_estimado || 0) - (cot.valor_total || 0)),
        data_aprovacao: new Date().toISOString(),
      }).eq('id', item.id)
      if (error) throw error
      await supabase.from('cotacoes_compra').update({ status: 'ganhou' }).eq('id', selecionado)
      const perdedores = cotacoes.filter(c => c.id !== selecionado && c.status === 'enviado').map(c => c.id)
      if (perdedores.length) await supabase.from('cotacoes_compra').update({ status: 'perdeu' }).in('id', perdedores)
      try {
        await supabase.from('solicitacao_compra_eventos').insert({
          solicitacao_id: item.id,
          workspace_id: workspaceId || item.workspace_id || null,
          acao: 'vencedor_leilao',
          status_de: 'leilao_encerrado',
          status_para: 'aprovado',
          observacao: `Vencedor selecionado: ${cot.fornecedor_nome} | melhor preço ${fmtBRL(cot.valor_total)}`,
          ator: 'compras_erp',
          criado_em: new Date().toISOString(),
        })
      } catch {}
      fetch('/api/notify-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento: 'leilao_encerrado', solicitacaoId: item.id }),
      }).catch(() => {})
      toast.success(`Vencedor: ${cot.fornecedor_nome}`)
      onSaved(); onClose()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>🏆 Selecionar Vencedor do Leilão</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{item.titulo} · {enviadas.length} proposta(s) recebida(s)</div>

        {enviadas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum fornecedor enviou proposta ainda.<br/>O leilão foi encerrado mas você pode selecionar o vencedor depois na aba Cotações.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {enviadas.map((c, i) => (
              <div key={c.id} onClick={() => setSelecionado(c.id)}
                style={{ padding: '14px 16px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${selecionado === c.id ? '#10b981' : 'var(--border)'}`, background: selecionado === c.id ? 'rgba(16,185,129,0.06)' : 'var(--bg-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{i === 0 ? '🥇 ' : '🥈 '}{c.fornecedor_nome}</div>
                    {c.condicao_pagamento && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{c.condicao_pagamento}{c.prazo_entrega_dias ? ` · ${c.prazo_entrega_dias}d` : ''}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: i === 0 ? '#10b981' : 'var(--text-primary)' }}>{fmtBRL(c.valor_total)}</div>
                    {item.valor_estimado && c.valor_total < item.valor_estimado && (
                      <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>-{Math.round(((item.valor_estimado - c.valor_total) / item.valor_estimado) * 100)}%</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13 }}>Fechar</button>
          {enviadas.length > 0 && !selecionado && (
            <button onClick={() => setSelecionado(enviadas[0].id)} style={{ padding: '9px 18px', borderRadius: 8, background: '#f59e0b', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700 }}>⚡ Melhor Preço</button>
          )}
          {selecionado && (
            <button onClick={handleSelecionar} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#10b981', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : '🏆 Confirmar Vencedor'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ComprasERP() {
  const workspaceId = useStore(s => s.workspaceId)
  const now = new Date()

  const [items, setItems]           = useState([])
  const [itemsMesAnt, setItemsMesAnt] = useState([])
  const [loading, setLoading]       = useState(true)
  const [selecionado, setSelecionado] = useState(null)
  const [showNovaReq, setShowNovaReq] = useState(false)
  const [showConfigAprovador, setShowConfigAprovador] = useState(false)
  const [vencedorErpItem, setVencedorErpItem] = useState(null)
  const [refresh, setRefresh]       = useState(0)
  const [lastUpdate, setLastUpdate] = useState(now)
  const [wsNome, setWsNome]         = useState('')

  // filtros
  const [busca, setBusca]                   = useState('')
  const [competencia, setCompetencia]       = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [filtroStatus, setFiltroStatus]     = useState('todos')
  const [filtroOrigem, setFiltroOrigem]     = useState('todos')
  const [filtroPrioridade, setFiltroPrioridade] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todos')
  const [tabAtiva, setTabAtiva]             = useState('todos')
  const [sortBy, setSortBy]                 = useState('recente')

  useEffect(() => {
    if (workspaceId) supabase.from('workspaces').select('nome').eq('id', workspaceId).single().then(({ data }) => setWsNome(data?.nome || ''))
  }, [workspaceId])

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const [anoComp, mesComp] = competencia.split('-').map(Number)
    const inicioMes    = new Date(anoComp, mesComp - 1, 1).toISOString()
    const fimMes       = new Date(anoComp, mesComp, 0, 23, 59, 59).toISOString()
    const inicioMesAnt = new Date(anoComp, mesComp - 2, 1).toISOString()
    const fimMesAnt    = new Date(anoComp, mesComp - 1, 0, 23, 59, 59).toISOString()
    const [{ data: curr }, { data: ant }] = await Promise.all([
      supabase.from('solicitacoes_compra').select('*').eq('workspace_id', workspaceId)
        .gte('created_at', inicioMes).lte('created_at', fimMes).order('created_at', { ascending: false }),
      supabase.from('solicitacoes_compra').select('id,status,valor_aprovado,valor_estimado,urgencia,created_at')
        .eq('workspace_id', workspaceId).gte('created_at', inicioMesAnt).lte('created_at', fimMesAnt),
    ])
    setItems((curr || []).map(normalizeCompraItem))
    setItemsMesAnt((ant || []).map(normalizeCompraItem))
    setLastUpdate(new Date())
    setLoading(false)
  }, [workspaceId, competencia, refresh])

  useEffect(() => { load() }, [load])

  // contagens
  const counts = {}
  STAGES.forEach(s => {
    if (s.key === 'todos') counts[s.key] = items.length
    else if (s.key !== 'radar') counts[s.key] = items.filter(i => i.status === s.key).length
  })
  counts['leilao_encerrado'] = items.filter(i => i.status === 'leilao_encerrado').length

  function pctVsAnt(curr, ant) {
    if (!ant) return null
    const d = ((curr - ant) / ant) * 100
    return { v: Math.abs(Math.round(d)), up: d >= 0 }
  }

  const gastoMes    = items.filter(i => i.valor_aprovado && !['recusado','pendente'].includes(i.status)).reduce((s, i) => s + (i.valor_aprovado || 0), 0)
  const gastoAnt    = itemsMesAnt.filter(i => i.valor_aprovado && !['recusado','pendente'].includes(i.status)).reduce((s, i) => s + (i.valor_aprovado || 0), 0)
  const economiaMes = items.filter(i => i.valor_orcado && i.valor_aprovado && i.valor_aprovado < i.valor_orcado).reduce((s, i) => s + (i.valor_orcado - i.valor_aprovado), 0)
  const economiaAnt = itemsMesAnt.filter(i => i.valor_orcado && i.valor_aprovado && i.valor_aprovado < i.valor_orcado).reduce((s, i) => s + (i.valor_orcado - i.valor_aprovado), 0)
  const pendCrit    = items.filter(i => i.urgencia === 'alta' && !['pago','recusado','recebido'].includes(i.status)).length
  const pendCritAnt = itemsMesAnt.filter(i => i.urgencia === 'alta' && !['pago','recusado','recebido'].includes(i.status)).length

  const kpis = [
    { label: 'Requisições Abertas', value: items.filter(i => !['pago','recusado'].includes(i.status)).length, pct: pctVsAnt(items.length, itemsMesAnt.length), color: C.blue, icon: ClipboardDocumentListIcon, alert: false },
    { label: 'Ag. Aprovação',       value: counts['aguardando_aprovacao'] || 0, pct: pctVsAnt(counts['aguardando_aprovacao'] || 0, itemsMesAnt.filter(i => i.status === 'aguardando_aprovacao').length), color: C.amber, icon: ExclamationTriangleIcon, alert: (counts['aguardando_aprovacao'] || 0) > 0 },
    { label: 'Em Cotação',          value: (counts['em_cotacao'] || 0) + (counts['leilao_aberto'] || 0), pct: null, color: '#8b5cf6', icon: SignalIcon, alert: false },
    { label: 'Pedidos Emitidos',    value: counts['pedido_emitido'] || 0, pct: pctVsAnt(counts['pedido_emitido'] || 0, itemsMesAnt.filter(i => i.status === 'pedido_emitido').length), color: '#059669', icon: ShoppingCartIcon, alert: false },
    { label: 'A Receber',           value: counts['recebido'] || 0, pct: null, color: '#14b8a6', icon: TruckIcon, alert: false },
    { label: 'Gasto no Mês',        value: fmtBRL(gastoMes), pct: pctVsAnt(gastoMes, gastoAnt), color: C.sky, icon: BanknotesIcon, alert: false, isText: true },
    { label: 'Economia Gerada',     value: fmtBRL(economiaMes), pct: pctVsAnt(economiaMes, economiaAnt), color: C.green, icon: ChartBarIcon, alert: false, isText: true },
    { label: 'Pendências Críticas', value: pendCrit, pct: pctVsAnt(pendCrit, pendCritAnt), color: C.red, icon: ExclamationCircleIcon, alert: pendCrit > 0 },
  ]

  const categorias = [...new Set(items.map(i => i.categoria).filter(Boolean))]
  const origens    = [...new Set(items.map(i => i.origem).filter(Boolean))]

  const filtered = items.filter(i => {
    if (filtroStatus !== 'todos' && i.status !== filtroStatus) return false
    if (filtroOrigem !== 'todos' && (i.origem || 'Manual') !== filtroOrigem) return false
    if (filtroPrioridade !== 'todos' && i.urgencia !== filtroPrioridade) return false
    if (filtroCategoria !== 'todos' && i.categoria !== filtroCategoria) return false
    if (busca.trim()) {
      const q = norm(busca)
      if (!norm(i.titulo).includes(q) && !norm(i.categoria).includes(q) && !norm(i.requisitante_nome).includes(q)) return false
    }
    return true
  }).filter(i => {
    if (tabAtiva === 'urgentes')  return i.urgencia === 'alta'
    if (tabAtiva === 'atrasados') return i.data_necessidade && new Date(i.data_necessidade) < now && !['pago','recusado','recebido'].includes(i.status)
    return true
  }).sort((a, b) => {
    if (sortBy === 'urgencia') { const o = { alta: 0, media: 1, baixa: 2 }; return (o[a.urgencia] ?? 2) - (o[b.urgencia] ?? 2) }
    if (sortBy === 'valor')    return (b.valor_orcado || 0) - (a.valor_orcado || 0)
    if (sortBy === 'prazo')    return new Date(a.data_necessidade || '9999') - new Date(b.data_necessidade || '9999')
    return new Date(b.created_at) - new Date(a.created_at)
  })

  const tabCounts = {
    todos:     items.length,
    urgentes:  items.filter(i => i.urgencia === 'alta').length,
    atrasados: items.filter(i => i.data_necessidade && new Date(i.data_necessidade) < now && !['pago','recusado','recebido'].includes(i.status)).length,
  }

  async function handleAcao(item, action) {
    const map = { enviar_aprovacao: 'aguardando_aprovacao', aprovar: 'aprovado', recusar: 'recusado', leilao: 'leilao_aberto', encerrar_leilao: 'leilao_encerrado', emitir_pedido: 'pedido_emitido', receber: 'recebido', pagar: 'pago' }
    const novoStatus = map[action]
    if (!novoStatus) return
    if (action === 'emitir_pedido' && item.status === 'leilao_encerrado' && !item.fornecedor_vencedor) {
      toast.error('Selecione um vencedor antes de emitir o pedido')
      return
    }
    const { error } = await supabase.from('solicitacoes_compra').update({ status: novoStatus, updated_at: new Date().toISOString() }).eq('id', item.id)
    if (error) { toast.error('Erro ao atualizar'); return }

    const { error: eventoError } = await supabase.from('solicitacao_compra_eventos').insert({
      solicitacao_id: item.id,
      workspace_id: item.workspace_id || workspaceId || null,
      acao: action,
      status_de: item.status || null,
      status_para: novoStatus,
      observacao: action === 'emitir_pedido' && item.status === 'leilao_encerrado' ? 'Pedido emitido após encerramento de leilão' : null,
      ator: 'compras_erp',
      criado_em: new Date().toISOString(),
    })
    if (eventoError) console.warn('[ComprasERP] falha ao registrar evento:', eventoError.message)

    if (action === 'enviar_aprovacao') {
      try {
        const res = await fetch('/api/notify-compras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ solicitacaoId: item.id, evento: 'nova_solicitacao' }),
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok && json?.sent > 0) toast.success('Aprovador notificado no WhatsApp')
      } catch {
        // silencioso: o status foi atualizado com sucesso
      }
    }

    const labels = { enviar_aprovacao: 'Enviado para aprovação interna', aprovar: 'Aprovado!', recusar: 'Recusado', leilao: 'Leilão aberto', encerrar_leilao: 'Leilão encerrado', emitir_pedido: 'Pedido emitido', receber: 'Recebimento confirmado', pagar: 'Marcado como pago' }
    toast.success(labels[action] || 'Atualizado!')
    setRefresh(p => p + 1)
    setSelecionado(p => p ? { ...p, status: novoStatus } : null)
    if (action === 'encerrar_leilao') {
      setVencedorErpItem({ ...item, status: 'leilao_encerrado' })
    }
  }

  function proximaAcaoInfo(status) {
    const map = {
      pendente:             { label: 'Enviar p/ aprovação', key: 'enviar_aprovacao' },
      aguardando_aprovacao: { label: 'Aprovar',             key: 'aprovar' },
      em_cotacao:           { label: 'Comparar cotações',   key: null },
      leilao_aberto:        { label: 'Encerrar leilão',     key: 'encerrar_leilao' },
      leilao_encerrado:     { label: 'Gerar pedido',        key: null },
      aprovado:             { label: 'Emitir Pedido',       key: 'emitir_pedido' },
      pedido_emitido:       { label: 'Acompanhar entrega',  key: 'receber' },
      recebido:             { label: 'Emitir NF',           key: 'pagar' },
      pago:                 { label: '—',                   key: null },
      recusado:             { label: '—',                   key: null },
    }
    return map[status] || { label: '—', key: null }
  }

  const ORIGEM_COLORS = { Manutenção: '#3b82f6', SmartLider: '#6366f1', Refeições: '#f97316', Manual: '#6b7280' }
  function origemBadge(item) {
    const orig = item.origem || 'Manual'
    const color = ORIGEM_COLORS[orig] || '#6b7280'
    return <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}15`, padding: '2px 7px', borderRadius: 4, border: `1px solid ${color}30`, whiteSpace: 'nowrap' }}>{orig}</span>
  }

  const lastUpdateStr = lastUpdate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  const mesesDisponiveis = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, s => s.toUpperCase())
    return { val, label }
  })

  return (
    <div style={{ flex: 1, background: C.bgPage, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="Compras ERP" subtitle="Central de operações de compras" />

      {/* ── TopBar ── */}
      <div style={{ background: C.bgCard, borderBottom: `1px solid ${C.border}`, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        {/* Cliente */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F1F5F9', borderRadius: 6, padding: '5px 10px', border: `1px solid ${C.border}`, fontSize: 12, flexShrink: 0 }}>
          <span style={{ color: C.textSec, fontWeight: 600 }}>Cliente:</span>
          <span style={{ fontWeight: 700, color: C.text }}>{wsNome || '—'}</span>
          <ChevronDownIcon style={{ width: 11, color: C.textSec }} />
        </div>
        {/* Competência */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F1F5F9', borderRadius: 6, padding: '4px 8px', border: `1px solid ${C.border}`, flexShrink: 0 }}>
          <CalendarDaysIcon style={{ width: 12, color: C.textSec }} />
          <select value={competencia} onChange={e => setCompetencia(e.target.value)}
            style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 700, color: C.text, cursor: 'pointer', outline: 'none' }}>
            {mesesDisponiveis.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
        </div>
        {/* Status filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F1F5F9', borderRadius: 6, padding: '4px 8px', border: `1px solid ${C.border}`, flexShrink: 0 }}>
          <FunnelIcon style={{ width: 12, color: C.textSec }} />
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 700, color: C.text, cursor: 'pointer', outline: 'none' }}>
            <option value="todos">Status: Todos</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }} />
        {/* Ações */}
        <button onClick={() => setShowNovaReq(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: C.blue, color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
          <PlusIcon style={{ width: 13 }} /> Nova Requisição
        </button>
        <button
          onClick={() => setShowConfigAprovador(true)}
          title="Configurar aprovador por WhatsApp"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'transparent', color: C.violet, border: `1px solid ${C.violet}50`, borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
          <ShieldCheckIcon style={{ width: 13 }} /> Aprovador
        </button>
        <button
          onClick={() => {
            if (!selecionado) { toast('Selecione uma requisição primeiro', { icon: 'ℹ️' }); return }
            if (selecionado.status !== 'pendente') { toast.error('A requisição precisa estar pendente para enviar à aprovação'); return }
            handleAcao(selecionado, 'enviar_aprovacao')
          }}
          title="Enviar a requisição selecionada para aprovação"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'transparent', color: C.amber, border: `1px solid ${C.amber}50`, borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
          <ExclamationTriangleIcon style={{ width: 13 }} /> Enviar p/ Aprovação
        </button>
        <button
          onClick={() => {
            if (!selecionado) { toast('Selecione uma requisição primeiro', { icon: 'ℹ️' }); return }
            toast('Use o painel direito → Radar para buscar fornecedores e solicitar cotações', { icon: '💡', duration: 3000 })
          }}
          title="Solicitar cotação para a requisição selecionada"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'transparent', color: C.sky, border: `1px solid ${C.sky}50`, borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
          <DocumentTextIcon style={{ width: 13 }} /> Solicitar Cotação
        </button>
        <button
          onClick={() => {
            if (!selecionado) { toast('Selecione uma requisição primeiro', { icon: 'ℹ️' }); return }
            if (!['aprovado','leilao_encerrado'].includes(selecionado.status)) {
              toast.error(`Status "${STATUS_LABELS[selecionado.status]?.label}" não permite emitir pedido`); return
            }
            handleAcao(selecionado, 'emitir_pedido')
          }}
          title="Emitir pedido para a requisição selecionada"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'transparent', color: C.green, border: `1px solid ${C.green}50`, borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
          <ShoppingCartIcon style={{ width: 13 }} /> Gerar Pedido
        </button>
        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <MagnifyingGlassIcon style={{ width: 12, position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.textSec }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar requisições, pedidos..."
            style={{ padding: '6px 10px 6px 26px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#F8FAFC', color: C.text, fontSize: 12, outline: 'none', width: 200 }} />
        </div>
        <span style={{ fontSize: 10, color: C.textSec, whiteSpace: 'nowrap', flexShrink: 0 }}>Última atualização: {lastUpdateStr}</span>
        <button onClick={() => setRefresh(p => p + 1)} style={{ padding: 6, borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', color: C.textSec, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <ArrowPathIcon style={{ width: 12 }} />
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ padding: '10px 20px 8px', background: C.bgPage, flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
          {kpis.map(({ label, value, pct, color, icon: Icon, alert, isText }) => (
            <div key={label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderTop: `3px solid ${alert ? color : C.border}`, borderRadius: 8, padding: '10px 12px', boxShadow: alert ? `0 2px 8px ${color}20` : '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.3 }}>{label}</div>
                <Icon style={{ width: 13, color, flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: isText ? 13 : 20, fontWeight: 900, color, lineHeight: 1, marginBottom: 3 }}>{value}</div>
              {pct !== null && pct !== undefined ? (
                <div style={{ fontSize: 9, color: pct.up ? C.green : C.red, fontWeight: 700 }}>
                  {pct.up ? '↑' : '↓'} {pct.v}% vs mês ant.
                </div>
              ) : (
                <div style={{ fontSize: 9, color: C.textSec }}>Sem pendências</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Fluxo Horizontal ── */}
      <FluxoHorizontal counts={counts} />

      {/* ── Layout: filtros | tabela | detalhe ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '175px 1fr 340px', overflow: 'hidden', borderTop: `1px solid ${C.border}` }}>

        {/* ── Filtros laterais ── */}
        <div style={{ borderRight: `1px solid ${C.border}`, overflowY: 'auto', background: C.bgCard, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Status */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Status</div>
            {['todos', ...Object.keys(STATUS_LABELS)].map(k => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', cursor: 'pointer', fontSize: 11, color: filtroStatus === k ? C.blue : C.text, fontWeight: filtroStatus === k ? 700 : 400 }}>
                <input type="radio" name="fstatus" value={k} checked={filtroStatus === k} onChange={() => setFiltroStatus(k)} style={{ accentColor: C.blue, cursor: 'pointer' }} />
                {k === 'todos' ? 'Todos' : STATUS_LABELS[k]?.label}
              </label>
            ))}
          </div>
          {/* Prioridade */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Prioridade</div>
            {[['todos','Todas'], ['alta','Alta'], ['media','Média'], ['baixa','Baixa']].map(([v, l]) => (
              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', cursor: 'pointer', fontSize: 11, color: filtroPrioridade === v ? C.blue : C.text, fontWeight: filtroPrioridade === v ? 700 : 400 }}>
                <input type="radio" name="fprio" value={v} checked={filtroPrioridade === v} onChange={() => setFiltroPrioridade(v)} style={{ accentColor: C.blue, cursor: 'pointer' }} />
                {l}
              </label>
            ))}
          </div>
          {/* Origem */}
          {origens.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Origem</div>
              {['todos', ...origens].map(o => (
                <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', cursor: 'pointer', fontSize: 11, color: filtroOrigem === o ? C.blue : C.text, fontWeight: filtroOrigem === o ? 700 : 400 }}>
                  <input type="radio" name="forigem" value={o} checked={filtroOrigem === o} onChange={() => setFiltroOrigem(o)} style={{ accentColor: C.blue, cursor: 'pointer' }} />
                  {o === 'todos' ? 'Todos' : o}
                </label>
              ))}
            </div>
          )}
          {/* Categorias */}
          {categorias.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Categoria</div>
              {['todos', ...categorias.slice(0, 8)].map(c => (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', cursor: 'pointer', fontSize: 11, color: filtroCategoria === c ? C.blue : C.text, fontWeight: filtroCategoria === c ? 700 : 400 }}>
                  <input type="radio" name="fcat" value={c} checked={filtroCategoria === c} onChange={() => setFiltroCategoria(c)} style={{ accentColor: C.blue, cursor: 'pointer' }} />
                  {c === 'todos' ? 'Todas' : c}
                </label>
              ))}
            </div>
          )}
          <button onClick={() => { setFiltroStatus('todos'); setFiltroOrigem('todos'); setFiltroPrioridade('todos'); setFiltroCategoria('todos'); setBusca('') }}
            style={{ marginTop: 'auto', padding: '7px 0', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            + Filtros avançados
          </button>
        </div>

        {/* ── Caixa de Trabalho ── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid ${C.border}` }}>
          {/* header */}
          <div style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border}`, background: C.bgCard, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>Caixa de Trabalho</div>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: C.blue, borderRadius: 99, padding: '1px 7px' }}>{items.length}</span>
            <div style={{ flex: 1 }} />
            {[
              { key: 'todos',     label: 'Todos',    count: tabCounts.todos },
              { key: 'urgentes',  label: 'Urgentes', count: tabCounts.urgentes },
              { key: 'atrasados', label: 'Atrasados',count: tabCounts.atrasados },
            ].map(t => (
              <button key={t.key} onClick={() => setTabAtiva(t.key)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${tabAtiva === t.key ? C.blue : C.border}`, background: tabAtiva === t.key ? '#EFF6FF' : 'transparent', color: tabAtiva === t.key ? C.blue : C.textSec, fontWeight: tabAtiva === t.key ? 700 : 500, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                {t.label} {t.count > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: tabAtiva === t.key ? '#fff' : C.textSec, background: tabAtiva === t.key ? C.blue : '#E2E8F0', borderRadius: 99, padding: '0 4px', minWidth: 13, textAlign: 'center' }}>{t.count}</span>}
              </button>
            ))}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bgCard, color: C.textSec, fontSize: 11, cursor: 'pointer', outline: 'none' }}>
              <option value="recente">Mais recente</option>
              <option value="urgencia">Urgência</option>
              <option value="valor">Maior valor</option>
              <option value="prazo">Prazo</option>
            </select>
          </div>

          {/* tabela */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: C.textSec, fontSize: 12 }}>Carregando...</div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, gap: 8, color: C.textSec }}>
                <ClipboardDocumentListIcon style={{ width: 28, opacity: 0.2 }} />
                <div style={{ fontSize: 12 }}>Nenhuma requisição</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 2 }}>
                    {['Item / Descrição', 'Origem', 'Solicitante', 'Prioridade', 'Status', 'Prazo Necessário', 'Valor Estimado', 'Próxima Ação'].map(h => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 700, color: C.textSec, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => {
                    const isSel = selecionado?.id === item.id
                    const isAtrasado = item.data_necessidade && new Date(item.data_necessidade) < now && !['pago','recusado','recebido'].includes(item.status)
                    const isHoje = item.data_necessidade && new Date(item.data_necessidade).toDateString() === now.toDateString()
                    const { label: proxLabel, key: proxKey } = proximaAcaoInfo(item.status)
                    return (
                      <tr key={item.id} onClick={() => setSelecionado(item)}
                        style={{ background: isSel ? '#EFF6FF' : 'transparent', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F8FAFC' }}
                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                        <td style={{ padding: '9px 12px', minWidth: 140 }}>
                          <div style={{ fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{item.titulo}</div>
                          {item.categoria && <div style={{ fontSize: 10, color: C.textSec, marginTop: 1 }}>{item.categoria}</div>}
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{origemBadge(item)}</td>
                        <td style={{ padding: '9px 12px', color: C.text, whiteSpace: 'nowrap', fontSize: 11 }}>{item.requisitante_nome || '—'}</td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: URGENCIA_COLORS[item.urgencia] || C.textSec }}>
                            {item.urgencia ? item.urgencia.charAt(0).toUpperCase() + item.urgencia.slice(1) : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}><StatusBadge status={item.status} /></td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          {item.data_necessidade ? (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: isAtrasado ? C.red : C.text }}>{fmtDate(item.data_necessidade)}</div>
                              {isHoje && <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: C.red, borderRadius: 3, padding: '1px 5px' }}>Hoje</span>}
                              {isAtrasado && !isHoje && <span style={{ fontSize: 9, color: C.red, fontWeight: 700 }}>Atrasado</span>}
                            </div>
                          ) : <span style={{ color: C.textSec }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 700, color: C.green, whiteSpace: 'nowrap' }}>
                          {item.valor_orcado ? fmtBRL(item.valor_orcado) : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          {proxKey ? (
                            <button onClick={e => { e.stopPropagation(); handleAcao(item, proxKey) }}
                              style={{ padding: '4px 9px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: '#EFF6FF', color: C.blue, border: `1px solid #BFDBFE`, cursor: 'pointer' }}>
                              {proxLabel}
                            </button>
                          ) : <span style={{ fontSize: 11, color: C.textSec }}>{proxLabel}</span>}
                        </td>
                        <td style={{ padding: '6px' }}>
                          <ChevronRightIcon style={{ width: 13, color: C.textSec }} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* rodapé */}
          <div style={{ padding: '5px 14px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textSec, background: '#F8FAFC', flexShrink: 0 }}>
            Mostrando {filtered.length} de {items.length} itens
          </div>

          {/* ── Analytics Bottom ── */}
          <div style={{ borderTop: `2px solid ${C.border}`, padding: '12px 14px', background: C.bgPage, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, flexShrink: 0, maxHeight: 210, overflowY: 'auto' }}>
            <MapaComparativo item={selecionado} />
            <DonutCategoria items={items} />
            <AuditoriaRecente workspaceId={workspaceId} />
          </div>
        </div>

        {/* ── Painel Detalhe ── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bgCard }}>
          <PainelDetalhe item={selecionado} workspaceId={workspaceId} onAcao={handleAcao} onClose={() => setSelecionado(null)} onNovaReq={() => setShowNovaReq(true)} />
        </div>
      </div>

      {showNovaReq && (
        <ModalNovaReq workspaceId={workspaceId} onClose={() => setShowNovaReq(false)} onSalvo={() => setRefresh(p => p + 1)} />
      )}
      {showConfigAprovador && (
        <ModalConfigAprovador onClose={() => setShowConfigAprovador(false)} />
      )}
      {vencedorErpItem && (
        <ModalVencedorERP
          item={vencedorErpItem}
          workspaceId={workspaceId}
          onClose={() => setVencedorErpItem(null)}
          onSaved={() => { setVencedorErpItem(null); setRefresh(p => p + 1) }}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
