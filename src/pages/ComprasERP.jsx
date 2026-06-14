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

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
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

// ─── sub-component: Badge de status ──────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || { label: status, color: '#6b7280' }
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}30`,
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
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: selecionado ? '1.5px solid #0ea5e9' : '1px solid var(--border)', padding: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={selecionado} onChange={onToggle}
          style={{ marginTop: 4, accentColor: '#0ea5e9', cursor: 'pointer', width: 14, height: 14, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nome}</div>
          {e.rating && (
            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: 0.3 }}>
              {'★'.repeat(Math.round(e.rating))}{'☆'.repeat(5 - Math.round(e.rating))} {e.rating.toFixed(1)}
              {e.avaliacoes > 0 && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> ({e.avaliacoes})</span>}
            </div>
          )}
          {e.endereco && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.endereco}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {waHref && <a href={waHref} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#10b981', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}><PhoneIcon style={{ width: 11 }} />{e.telefone}</a>}
            {e.website && <a href={e.website.startsWith('http') ? e.website : `https://${e.website}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#8b5cf6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}><GlobeAltIcon style={{ width: 11 }} />Site</a>}
            {e.horario && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{e.horario}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
          <button onClick={() => onCnpj(e)} title="Consultar CNPJ"
            style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', color: '#6366f1', display: 'flex', alignItems: 'center', gap: 3 }}>
            <IdentificationIcon style={{ width: 11 }} />CNPJ
          </button>
          <button onClick={() => onAdd(e)} disabled={added}
            style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: added ? 'rgba(16,185,129,0.1)' : 'rgba(14,165,233,0.1)', border: added ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(14,165,233,0.3)', cursor: added ? 'default' : 'pointer', color: added ? '#10b981' : '#0ea5e9', display: 'flex', alignItems: 'center', gap: 3 }}>
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
  const [bResultado, setBResultado] = useState(null)
  const [bSelecionados, setBSelecionados] = useState(new Set())
  const [bAdicionados, setBAdicionados] = useState(new Set())
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

  const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }

  // ── buscar fornecedores (Google Maps via Serper) ──
  async function buscarFornecedores(produtoOverride) {
    const p = String(produtoOverride || bProduto || '').trim()
    if (!p) { toast.error('Informe o produto'); return }
    if (!bCidade.trim()) { toast.error('Informe a cidade'); return }
    setBLoading(true); setBResultado(null); setBSelecionados(new Set())
    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { query: p, cidade: bCidade.trim(), uf: bUf || undefined },
      })
      if (error) throw new Error(error.message || 'Erro na busca')
      if (data?.error) throw new Error(data.error)
      setBResultado({ ...data, produto: p, cidade: bCidade.trim(), uf: bUf })
      if (!(data?.fornecedores || []).length) toast('Nenhum fornecedor encontrado.', { icon: '🔍', duration: 4000 })
    } catch (err) {
      toast.error(err.message || 'Falha na busca — verifique os critérios')
    } finally { setBLoading(false) }
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
      {/* header */}
      <div style={{ padding: '12px 14px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(225,29,72,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MagnifyingGlassIcon style={{ width: 14, color: '#e11d48' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Radar de Compras</div>
        </div>
        <div style={{ display: 'flex' }}>
          {abas.map(a => (
            <button key={a.key} onClick={() => setAba(a.key)} style={{ flex: 1, padding: '7px 4px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', borderBottom: aba === a.key ? '2px solid #e11d48' : '2px solid transparent', background: 'transparent', color: aba === a.key ? '#e11d48' : 'var(--text-secondary)' }}>{a.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>

        {/* ── aba Fornecedor ── */}
        {aba === 'fornecedor' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* formulário */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>O que você precisa cotar?</div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}>Produto *</label>
                <AutocompleteInput value={bProduto} onChange={setBProduto}
                  onSelect={s => setBProduto(typeof s === 'string' ? s : s.label)}
                  sugestoes={SUGESTOES_BUSCA} placeholder="Ex: Pneus, EPI, Ferramentas..."
                  inputStyle={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}>Cidade *</label>
                  <AutocompleteInput value={bCidade} onChange={setBCidade}
                    onSelect={s => { setBCidade(s.label); if (s.uf) setBUf(s.uf) }}
                    sugestoes={cidades} placeholder="Ex: Campo Grande"
                    inputStyle={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}>UF</label>
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
                    style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: bProduto === s ? '#0ea5e9' : 'rgba(14,165,233,0.08)', border: `1px solid ${bProduto === s ? '#0ea5e9' : 'rgba(14,165,233,0.2)'}`, cursor: 'pointer', color: bProduto === s ? '#fff' : '#0ea5e9' }}>{s}</button>
                ))}
              </div>
              <button onClick={() => buscarFornecedores()} disabled={bLoading}
                style={{ width: '100%', padding: '9px 0', borderRadius: 8, background: '#0ea5e9', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: bLoading ? 0.7 : 1 }}>
                {bLoading ? <ArrowPathIcon style={{ width: 15, animation: 'spin 1s linear infinite' }} /> : <MagnifyingGlassIcon style={{ width: 15 }} />}
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
              <div style={{ background: 'rgba(14,165,233,0.07)', border: '1.5px solid rgba(14,165,233,0.3)', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#0ea5e9' }}>{bSelecionados.size} selecionado(s)</span>
                <button onClick={adicionarLote} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: '#0ea5e9', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <PlusCircleIcon style={{ width: 12 }} />Cadastrar
                </button>
                <button onClick={waLote} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', cursor: 'pointer', color: '#25d366', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ChatBubbleLeftEllipsisIcon style={{ width: 12 }} />WA Lote
                </button>
                <button onClick={() => setBSelecionados(new Set())} style={{ marginLeft: 'auto', padding: '4px 8px', borderRadius: 6, fontSize: 10, background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }}>Limpar</button>
              </div>
            )}

            {/* resultados */}
            {bResultado && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{bResultado.total || bResultado.fornecedores?.length}</strong> resultado(s) — <strong style={{ color: '#0ea5e9' }}>{bResultado.produto}</strong> em <strong style={{ color: '#0ea5e9' }}>{bResultado.cidade}</strong>
                  </div>
                  {bResultado.fornecedores?.length > 0 && (
                    <button onClick={toggleTodos} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      {(bResultado.fornecedores || []).every(e => bSelecionados.has(e.id)) ? 'Desmarcar' : 'Sel. Todos'}
                    </button>
                  )}
                </div>
                {(bResultado.fornecedores || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px dashed var(--border)', fontSize: 12 }}>Nenhum fornecedor encontrado</div>
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
                  </div>
                )}
              </div>
            )}

            {!bResultado && !bLoading && (
              <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px dashed var(--border)' }}>
                <MagnifyingGlassIcon style={{ width: 32, margin: '0 auto 10px', opacity: 0.2 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>Busque fornecedores por produto e cidade</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Resultados via Google Maps (Serper.dev)</div>
              </div>
            )}
          </div>
        )}

        {/* ── aba Preços ── */}
        {aba === 'precos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', padding: 12 }}>
              <AutocompleteInput value={qPreco} onChange={setQPreco}
                onSelect={s => setQPreco(typeof s === 'string' ? s : s.label)}
                sugestoes={SUGESTOES_BUSCA} placeholder="Ex: Óleo 15W40 20L, Pneu 295/80..."
                inputStyle={{ ...inp, marginBottom: 8 }} />
              <button onClick={buscarPrecos} disabled={pLoading}
                style={{ width: '100%', padding: '9px 0', borderRadius: 8, background: '#e11d48', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: pLoading ? 0.7 : 1, marginTop: 8 }}>
                {pLoading ? <ArrowPathIcon style={{ width: 14, animation: 'spin 1s linear infinite' }} /> : <MagnifyingGlassIcon style={{ width: 14 }} />}
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
                    {[{ label: 'Menor', value: fmtBRL(menor), color: '#10b981' }, { label: 'Média', value: fmtBRL(media), color: '#3b82f6' }, { label: 'Maior', value: fmtBRL(maior), color: '#f59e0b' }].map(k => (
                      <div key={k.label} style={{ background: `${k.color}10`, border: `1px solid ${k.color}25`, borderTop: `2px solid ${k.color}`, borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 9, color: LC.txtMuted, fontWeight: 700, textTransform: 'uppercase' }}>{k.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: k.color }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {['todos', 'ml', 'google'].map(f => (
                      <button key={f} onClick={() => setPFiltro(f)}
                        style={{ padding: '3px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid', background: pFiltro === f ? 'var(--accent)' : 'var(--bg-card)', color: pFiltro === f ? '#fff' : 'var(--text-secondary)', borderColor: pFiltro === f ? 'var(--accent)' : 'var(--border)' }}>
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
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '9px 10px', background: isMenor ? 'rgba(34,197,94,0.05)' : 'var(--bg-secondary)', borderRadius: 8, border: `1px solid ${isMenor ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`, alignItems: 'center' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.titulo}</div>
                            <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 3 }}>
                              <span style={{ background: siteBg, color: siteBg === '#FFE600' ? '#111' : '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99 }}>{item.site}</span>
                              {isMenor && <span style={{ fontSize: 9, fontWeight: 800, color: '#22c55e' }}>MENOR PREÇO</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: isMenor ? '#22c55e' : 'var(--text-primary)' }}>{fmtBRL(item.preco)}</div>
                            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--text-secondary)', textDecoration: 'none' }}>ver ↗</a>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )
            })()}
            {!pResultado && !pLoading && (
              <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px dashed var(--border)', color: 'var(--text-secondary)', fontSize: 12 }}>Digite o produto para pesquisar preços no Mercado Livre e Google Shopping</div>
            )}
          </div>
        )}

        {/* ── aba CNPJ ── */}
        {aba === 'cnpj' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* buscar por nome */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Buscar CNPJ pelo nome</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>Pesquisa automática via Serper + Receita Federal</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <input value={cnpjNome} onChange={e => setCnpjNome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscarCnpjPorNome()}
                  placeholder="Nome da empresa" style={inp} />
                <input value={cnpjCidade} onChange={e => setCnpjCidade(e.target.value)}
                  placeholder="Cidade (opcional)" style={inp} />
              </div>
              <button onClick={buscarCnpjPorNome} disabled={cnpjNomeLoading}
                style={{ width: '100%', padding: '8px 0', borderRadius: 7, background: '#0ea5e9', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: cnpjNomeLoading ? 0.7 : 1 }}>
                {cnpjNomeLoading ? <ArrowPathIcon style={{ width: 13, animation: 'spin 1s linear infinite' }} /> : <MagnifyingGlassIcon style={{ width: 13 }} />}
                {cnpjNomeLoading ? 'Buscando...' : 'Buscar CNPJ'}
              </button>
            </div>
            {/* consulta direta */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Consultar CNPJ diretamente</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={cnpjInput} onChange={e => setCnpjInput(fmtCNPJ(e.target.value))}
                  placeholder="00.000.000/0001-00" maxLength={18}
                  onKeyDown={e => e.key === 'Enter' && consultarCNPJDigits(cnpjInput.replace(/\D/g, ''))}
                  style={{ flex: 1, ...inp, fontFamily: 'monospace', letterSpacing: 1 }} />
                <button onClick={() => consultarCNPJDigits(cnpjInput.replace(/\D/g, ''))} disabled={cnpjLoading}
                  style={{ padding: '8px 12px', borderRadius: 7, background: '#0ea5e9', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, flexShrink: 0, opacity: cnpjLoading ? 0.7 : 1 }}>
                  {cnpjLoading ? <ArrowPathIcon style={{ width: 13, animation: 'spin 1s linear infinite' }} /> : <IdentificationIcon style={{ width: 13 }} />}
                  Consultar
                </button>
              </div>
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-secondary)' }}>Dados via BrasilAPI (Receita Federal) · gratuito</div>
            </div>
            {cnpjDados && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <CnpjCardInline d={cnpjDados} onAdd={adicionarDoCNPJ} added={cnpjAdicionados.has(cnpjDados.cnpj)} />
              </div>
            )}
            {!cnpjDados && !cnpjLoading && !cnpjNomeLoading && (
              <div style={{ textAlign: 'center', padding: '24px 12px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px dashed var(--border)', color: 'var(--text-secondary)', fontSize: 12 }}>
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
    titulo: '', categoria: '', valor_orcado: '', urgencia: 'media',
    fornecedor_sugerido: '', data_necessidade: '', observacoes: '',
  })
  const [saving, setSaving] = useState(false)

  async function salvar() {
    if (!form.titulo.trim()) { toast.error('Informe o título'); return }
    setSaving(true)
    const { error } = await supabase.from('solicitacoes_compra').insert({
      workspace_id: workspaceId,
      titulo: form.titulo.trim(),
      categoria: form.categoria || null,
      valor_orcado: form.valor_orcado ? parseFloat(form.valor_orcado) : null,
      urgencia: form.urgencia,
      fornecedor_sugerido: form.fornecedor_sugerido || null,
      data_necessidade: form.data_necessidade || null,
      observacoes: form.observacoes || null,
      status: 'pendente',
    })
    setSaving(false)
    if (error) { toast.error('Erro ao criar requisição'); return }
    toast.success('Requisição criada!')
    onSalvo()
    onClose()
  }

  const F = (field, value) => setForm(p => ({ ...p, [field]: value }))
  const inputSt = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>Nova Requisição de Compra</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <XMarkIcon style={{ width: 20 }} />
          </button>
        </div>
        <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Título / Produto *</label>
            <input value={form.titulo} onChange={e => F('titulo', e.target.value)} placeholder="Ex: Pneus 295/80 R22.5" style={inputSt} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Categoria</label>
              <input value={form.categoria} onChange={e => F('categoria', e.target.value)} placeholder="Ex: Pneus" style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Urgência</label>
              <select value={form.urgencia} onChange={e => F('urgencia', e.target.value)}
                style={{ ...inputSt, appearance: 'none' }}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Valor Orçado (R$)</label>
              <input type="number" value={form.valor_orcado} onChange={e => F('valor_orcado', e.target.value)} placeholder="0,00" style={inputSt} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Necessidade até</label>
              <input type="date" value={form.data_necessidade} onChange={e => F('data_necessidade', e.target.value)} style={inputSt} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Fornecedor Sugerido</label>
            <input value={form.fornecedor_sugerido} onChange={e => F('fornecedor_sugerido', e.target.value)} placeholder="(opcional)" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Observações</label>
            <textarea value={form.observacoes} onChange={e => F('observacoes', e.target.value)} rows={2} placeholder="Especificações, marca, etc." style={{ ...inputSt, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ padding: '9px 24px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {saving ? 'Salvando...' : 'Criar Requisição'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Painel Detalhe da requisição selecionada ─────────────────────────────────
function PainelDetalhe({ item, workspaceId, onAcao, onClose }) {
  const [cotacoes, setCotacoes] = useState([])
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRadar, setShowRadar] = useState(false)

  useEffect(() => {
    if (!item) return
    setLoading(true)
    Promise.all([
      supabase.from('cotacoes_compra').select('*').eq('solicitacao_id', item.id),
      supabase.from('solicitacao_compra_eventos').select('*').eq('solicitacao_id', item.id).order('created_at', { ascending: false }).limit(10),
    ]).then(([{ data: cot }, { data: ev }]) => {
      setCotacoes(cot || [])
      setEventos(ev || [])
      setLoading(false)
    })
  }, [item?.id])

  if (!item) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-secondary)' }}>
        <ClipboardDocumentListIcon style={{ width: 36, opacity: 0.3 }} />
        <div style={{ fontSize: 13 }}>Selecione uma requisição</div>
      </div>
    )
  }

  const st = STATUS_LABELS[item.status] || { label: item.status, color: '#6b7280' }
  const urgColor = URGENCIA_COLORS[item.urgencia] || '#6b7280'

  const acoes = []
  if (item.status === 'aguardando_aprovacao') {
    acoes.push({ label: 'Aprovar', color: '#10b981', action: 'aprovar' })
    acoes.push({ label: 'Abrir Leilão', color: '#0ea5e9', action: 'leilao' })
    acoes.push({ label: 'Recusar', color: '#ef4444', action: 'recusar' })
  }
  if (item.status === 'aprovado') {
    acoes.push({ label: 'Emitir Pedido', color: '#6366f1', action: 'emitir_pedido' })
  }
  if (item.status === 'pedido_emitido') {
    acoes.push({ label: 'Confirmar Recebimento', color: '#10b981', action: 'receber' })
  }
  if (item.status === 'recebido') {
    acoes.push({ label: 'Marcar Pago', color: '#14b8a6', action: 'pagar' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>{item.titulo}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge status={item.status} />
            <span style={{ fontSize: 10, fontWeight: 700, color: urgColor, background: `${urgColor}15`, padding: '2px 7px', borderRadius: 99 }}>
              {item.urgencia?.toUpperCase()}
            </span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0, padding: 4 }}>
          <XMarkIcon style={{ width: 16 }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* infos */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'Requisitante', value: item.requisitante_nome || '—' },
            { label: 'Fornecedor sugerido', value: item.fornecedor_sugerido || '—' },
            { label: 'Valor Orçado', value: item.valor_orcado ? fmtBRL(item.valor_orcado) : '—' },
            { label: 'Valor Aprovado', value: item.valor_aprovado ? fmtBRL(item.valor_aprovado) : '—' },
            { label: 'Necessidade', value: fmtDate(item.data_necessidade) },
            { label: 'Categoria', value: item.categoria || '—' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, gap: 8 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{r.value}</span>
            </div>
          ))}
          {item.observacoes && (
            <div style={{ marginTop: 4, padding: 8, background: 'var(--bg-secondary)', borderRadius: 7, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              {item.observacoes}
            </div>
          )}
        </div>

        {/* ações inline */}
        {acoes.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {acoes.map(a => (
              <button key={a.action} onClick={() => onAcao(item, a.action)}
                style={{ flex: 1, minWidth: 80, padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', background: `${a.color}18`, color: a.color, cursor: 'pointer', border: `1px solid ${a.color}30` }}>
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* cotações */}
        {cotacoes.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Cotações ({cotacoes.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cotacoes.map(c => {
                const statusCot = c.proposta_valor ? 'Proposta Recebida' : c.visualizado_em ? 'Visualizou' : 'Convidado'
                const colorCot = c.proposta_valor ? '#10b981' : c.visualizado_em ? '#3b82f6' : '#6b7280'
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{c.fornecedor_nome}</div>
                      <div style={{ fontSize: 10, color: colorCot, fontWeight: 600 }}>{statusCot}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {c.proposta_valor && <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>{fmtBRL(c.proposta_valor)}</div>}
                      {c.vencedor && <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>🏆 Vencedor</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* radar rápido */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setShowRadar(p => !p)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px dashed #e11d48', background: 'rgba(225,29,72,0.06)', color: '#e11d48', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <MagnifyingGlassIcon style={{ width: 14 }} />
            {showRadar ? 'Ocultar Radar' : 'Pesquisar Preços / Fornecedor'}
          </button>
        </div>

        {/* timeline */}
        {eventos.length > 0 && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Timeline</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eventos.map(e => (
                <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{e.descricao || e.acao}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmtDate(e.created_at)} — {e.usuario_nome || 'Sistema'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ComprasERP() {
  const workspaceId = useStore(s => s.workspaceId)

  const [stage, setStage] = useState('todos')
  const [busca, setBusca] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selecionado, setSelecionado] = useState(null)
  const [showNovaReq, setShowNovaReq] = useState(false)
  const [modoRadar, setModoRadar] = useState(false) // painel direito = radar
  const [refresh, setRefresh] = useState(0)

  // contagens por stage
  const [counts, setCounts] = useState({})

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase
      .from('solicitacoes_compra')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    const list = data || []
    setItems(list)
    // contagens
    const c = {}
    STAGES.forEach(s => {
      if (s.key === 'todos') c[s.key] = list.length
      else if (s.key !== 'radar') c[s.key] = list.filter(i => i.status === s.key).length
    })
    setCounts(c)
    setLoading(false)
  }, [workspaceId, refresh])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(i => {
    if (stage !== 'todos' && stage !== 'radar') {
      if (i.status !== stage) return false
    }
    if (busca.trim()) {
      const q = norm(busca)
      return norm(i.titulo).includes(q) || norm(i.categoria).includes(q) || norm(i.fornecedor_sugerido).includes(q)
    }
    return true
  })

  async function handleAcao(item, action) {
    const map = {
      aprovar: { status: 'aprovado' },
      recusar: { status: 'recusado' },
      leilao: { status: 'leilao_aberto' },
      emitir_pedido: { status: 'pedido_emitido' },
      receber: { status: 'recebido' },
      pagar: { status: 'pago' },
    }
    const upd = map[action]
    if (!upd) return
    const { error } = await supabase.from('solicitacoes_compra').update({ ...upd, updated_at: new Date().toISOString() }).eq('id', item.id)
    if (error) { toast.error('Erro ao atualizar'); return }
    const labels = { aprovar: 'Aprovado', recusar: 'Recusado', leilao: 'Leilão aberto', emitir_pedido: 'Pedido emitido', receber: 'Recebimento confirmado', pagar: 'Marcado como pago' }
    toast.success(labels[action] || 'Atualizado!')
    setRefresh(p => p + 1)
    setSelecionado(p => p ? { ...p, ...upd } : null)
  }

  // KPIs topo
  const kpis = [
    { label: 'Requisições', value: counts['pendente'] || 0, color: '#3b82f6' },
    { label: 'Ag. Aprovação', value: counts['aguardando_aprovacao'] || 0, color: '#f59e0b' },
    { label: 'Leilões Abertos', value: counts['em_cotacao'] || 0 + (counts['leilao_aberto'] || 0), color: '#0ea5e9' },
    { label: 'A Receber', value: counts['pedido_emitido'] || 0, color: '#10b981' },
    {
      label: 'Gasto Mês',
      value: fmtBRL(items.filter(i => i.status !== 'recusado' && i.status !== 'pendente' && i.valor_aprovado && new Date(i.updated_at || i.created_at).getMonth() === new Date().getMonth()).reduce((s, i) => s + (i.valor_aprovado || 0), 0)),
      color: '#6366f1',
    },
    {
      label: 'Economia',
      value: fmtBRL(items.filter(i => i.valor_orcado && i.valor_aprovado && i.valor_aprovado < i.valor_orcado).reduce((s, i) => s + (i.valor_orcado - i.valor_aprovado), 0)),
      color: '#059669',
    },
  ]

  const painelDireitoIsRadar = stage === 'radar' || modoRadar

  return (
    <div style={{ flex: 1, overflowY: 'hidden', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header title="Compras ERP" subtitle="Central de operações de compras" />

      {/* KPIs topo */}
      <div style={{ padding: '0 24px', maxWidth: 1600, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, paddingBottom: 16 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: `linear-gradient(135deg, ${k.color}14 0%, var(--bg-card) 55%)`, border: `1px solid ${k.color}28`, borderTop: `3px solid ${k.color}`, borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow-card)' }}>
              <div style={{ fontSize: 10, color: LC.txtMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Layout 3 colunas */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '200px 1fr 340px', gap: 0, borderTop: '1px solid var(--border)', maxWidth: 1600, width: '100%', margin: '0 auto', boxSizing: 'border-box', paddingLeft: 24, paddingRight: 24 }}>

        {/* ── Coluna 1: Pipeline ── */}
        <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', paddingTop: 12, paddingBottom: 12 }}>
          <div style={{ padding: '0 12px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pipeline</div>
          {STAGES.map(s => {
            const isActive = stage === s.key
            const Icon = s.icon
            const count = s.key === 'radar' ? null : (counts[s.key] ?? 0)
            return (
              <button key={s.key} onClick={() => { setStage(s.key); if (s.key !== 'radar') setModoRadar(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', background: isActive ? `${s.color}15` : 'transparent', color: isActive ? s.color : 'var(--text-secondary)', fontWeight: isActive ? 700 : 500, fontSize: 13, textAlign: 'left', marginBottom: 2, transition: 'background .15s' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-secondary)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                <Icon style={{ width: 15, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{s.label}</span>
                {count !== null && count > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: s.color, borderRadius: 99, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>{count}</span>
                )}
              </button>
            )
          })}

          <div style={{ borderTop: '1px solid var(--border)', margin: '12px 12px 8px', paddingTop: 12 }}>
            <button onClick={() => setShowNovaReq(true)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <PlusIcon style={{ width: 14 }} /> Nova Requisição
            </button>
          </div>
        </div>

        {/* ── Coluna 2: Lista Central ── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* barra de busca */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <MagnifyingGlassIcon style={{ width: 15, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar requisições..."
                style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={() => setRefresh(p => p + 1)} title="Atualizar"
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
              <ArrowPathIcon style={{ width: 15 }} />
            </button>
          </div>

          {/* lista */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--text-secondary)', fontSize: 13 }}>
                Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: 8, color: 'var(--text-secondary)' }}>
                <ClipboardDocumentListIcon style={{ width: 28, opacity: 0.3 }} />
                <div style={{ fontSize: 13 }}>Nenhuma requisição</div>
              </div>
            ) : (
              filtered.map(item => {
                const st = STATUS_LABELS[item.status] || { color: '#6b7280' }
                const urgColor = URGENCIA_COLORS[item.urgencia] || '#6b7280'
                const isSelected = selecionado?.id === item.id
                const isAtrasado = item.data_necessidade && new Date(item.data_necessidade) < new Date() && !['pago', 'recusado', 'recebido'].includes(item.status)
                return (
                  <div key={item.id}
                    onClick={() => { setSelecionado(item); setModoRadar(false) }}
                    style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'var(--bg-secondary)' : 'transparent', borderLeft: `3px solid ${isSelected ? st.color : 'transparent'}`, transition: 'background .1s' }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = LC.hoverBg }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isAtrasado && <span title="Atrasado" style={{ marginRight: 5 }}>🔴</span>}
                          {item.titulo}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                          {item.categoria && <span style={{ marginRight: 8 }}>{item.categoria}</span>}
                          {item.data_necessidade && <span>{fmtDate(item.data_necessidade)}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <StatusBadge status={item.status} />
                        {item.valor_orcado && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtBRL(item.valor_orcado)}</span>}
                        <span style={{ fontSize: 9, fontWeight: 700, color: urgColor }}>{item.urgencia?.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)' }}>
            {filtered.length} requisição(ões)
          </div>
        </div>

        {/* ── Coluna 3: Detalhe / Radar ── */}
        <div style={{ borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-card)' }}>
          {/* toggle detalhe/radar */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <button onClick={() => setModoRadar(false)}
              style={{ flex: 1, padding: '9px 0', fontSize: 11, fontWeight: 700, border: 'none', borderBottom: !painelDireitoIsRadar ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', cursor: 'pointer', color: !painelDireitoIsRadar ? 'var(--accent)' : 'var(--text-secondary)' }}>
              Detalhe
            </button>
            <button onClick={() => setModoRadar(true)}
              style={{ flex: 1, padding: '9px 0', fontSize: 11, fontWeight: 700, border: 'none', borderBottom: painelDireitoIsRadar ? '2px solid #e11d48' : '2px solid transparent', background: 'transparent', cursor: 'pointer', color: painelDireitoIsRadar ? '#e11d48' : 'var(--text-secondary)' }}>
              🔍 Radar
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {painelDireitoIsRadar ? (
              <RadarPanel workspaceId={workspaceId} onAdicionarFornecedor={() => toast.success('Fornecedor adicionado!')} />
            ) : (
              <PainelDetalhe item={selecionado} workspaceId={workspaceId} onAcao={handleAcao} onClose={() => setSelecionado(null)} />
            )}
          </div>
        </div>
      </div>

      {/* Modal Nova Requisição */}
      {showNovaReq && (
        <ModalNovaReq workspaceId={workspaceId} onClose={() => setShowNovaReq(false)} onSalvo={() => setRefresh(p => p + 1)} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
