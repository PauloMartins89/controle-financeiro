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

// ─── sub-component: Score Fiscal ─────────────────────────────────────────────
function ScoreFiscal({ score }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  const label = score >= 70 ? 'Bom' : score >= 40 ? 'Regular' : 'Risco'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 99, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 28 }}>{score}</span>
      <span style={{ fontSize: 10, color, fontWeight: 600 }}>{label}</span>
    </div>
  )
}

// ─── sub-component: Autocomplete ─────────────────────────────────────────────
function Autocomplete({ value, onChange, suggestions, placeholder, style }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const filtered = value.trim()
    ? suggestions.filter(s => norm(s).includes(norm(value))).slice(0, 8)
    : suggestions.slice(0, 8)

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box', ...style }} />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', marginTop: 2, maxHeight: 200, overflowY: 'auto' }}>
          {filtered.map((s, i) => (
            <div key={i} onMouseDown={() => { onChange(s); setOpen(false) }}
              style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >{s}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── sub-component: Painel Radar de Compras ──────────────────────────────────
function RadarPanel({ workspaceId, onAdicionarFornecedor }) {
  const [aba, setAba] = useState('fornecedor') // 'fornecedor' | 'precos' | 'cnpj'
  // --- busca fornecedor ---
  const [produto, setProduto] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [loadingForn, setLoadingForn] = useState(false)
  const [resultForn, setResultForn] = useState([])
  const [cidades, setCidades] = useState([])
  // --- pesquisa preços ---
  const [queryPreco, setQueryPreco] = useState('')
  const [loadingPreco, setLoadingPreco] = useState(false)
  const [resultPreco, setResultPreco] = useState(null)
  const [filtroPl, setFiltroPl] = useState('todos')
  // --- consulta CNPJ ---
  const [cnpjInput, setCnpjInput] = useState('')
  const [loadingCnpj, setLoadingCnpj] = useState(false)
  const [dadosCnpj, setDadosCnpj] = useState(null)
  const [scoreCnpj, setScoreCnpj] = useState(null)
  const [addedCnpjs, setAddedCnpjs] = useState([])

  // Carrega cidades IBGE (uma vez)
  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome')
      .then(r => r.json())
      .then(data => setCidades(data.map(m => m.nome)))
      .catch(() => {})
  }, [])

  // --- busca fornecedor ---
  async function buscarFornecedores() {
    if (!produto.trim()) { toast.error('Informe o produto'); return }
    setLoadingForn(true)
    setResultForn([])
    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { produto: produto.trim(), cidade: cidade.trim() || undefined, estado: estado || undefined },
      })
      if (error) throw error
      setResultForn(data?.fornecedores || [])
      if (!data?.fornecedores?.length) toast('Nenhum fornecedor encontrado.', { icon: 'ℹ️' })
    } catch {
      // fallback: links externos úteis
      setResultForn([])
      toast('Busca online indisponível — use os links abaixo para pesquisa manual.', { icon: 'ℹ️' })
    } finally {
      setLoadingForn(false)
    }
  }

  // --- pesquisa preços ---
  async function buscarPrecos() {
    if (!queryPreco.trim()) { toast.error('Informe o produto'); return }
    setLoadingPreco(true)
    setResultPreco(null)
    try {
      const { data, error } = await supabase.functions.invoke('busca-precos', {
        body: { query: queryPreco.trim() },
      })
      if (error) throw error
      setResultPreco(data)
    } catch {
      toast.error('Busca de preços indisponível.')
    } finally {
      setLoadingPreco(false)
    }
  }

  // --- consulta CNPJ ---
  function calcScore(d) {
    let s = 0
    const status = (d.descricao_situacao_cadastral || String(d.situacao_cadastral || '')).toUpperCase()
    s += status.includes('ATIVA') ? 40 : status.includes('SUSPENS') ? 10 : 0
    if (d.data_inicio_atividade) {
      const anos = (Date.now() - new Date(d.data_inicio_atividade).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      s += anos >= 10 ? 20 : anos >= 5 ? 15 : anos >= 2 ? 10 : anos >= 1 ? 5 : 2
    }
    if (d.email) s += 8
    if ((d.ddd_telefone_1 || '').replace(/\D/g, '').length > 5) s += 5
    if ((d.capital_social || 0) > 0) s += 5
    return Math.min(s, 100)
  }

  async function consultarCNPJ() {
    const raw = cnpjInput.replace(/\D/g, '')
    if (raw.length !== 14) { toast.error('CNPJ inválido'); return }
    setLoadingCnpj(true)
    setDadosCnpj(null)
    setScoreCnpj(null)
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`)
      if (!r.ok) throw new Error('CNPJ não encontrado')
      const d = await r.json()
      setDadosCnpj(d)
      setScoreCnpj(calcScore(d))
    } catch {
      toast.error('CNPJ não encontrado ou inválido.')
    } finally {
      setLoadingCnpj(false)
    }
  }

  async function adicionarDoCNPJ() {
    if (!dadosCnpj) return
    const cnpj = dadosCnpj.cnpj || cnpjInput.replace(/\D/g, '')
    const { error } = await supabase.from('fornecedores_compra').insert({
      workspace_id: workspaceId,
      nome: dadosCnpj.razao_social || dadosCnpj.nome_fantasia,
      cnpj,
      telefone: (dadosCnpj.ddd_telefone_1 || '') + (dadosCnpj.telefone_1 || ''),
      email: dadosCnpj.email || null,
      ativo: true,
    })
    if (error) { toast.error('Erro ao adicionar'); return }
    setAddedCnpjs(p => [...p, cnpj])
    toast.success('Fornecedor adicionado ao cadastro!')
    onAdicionarFornecedor?.()
  }

  // links de pesquisa externos
  function linksExternos(q) {
    return [
      { label: 'Google', url: `https://www.google.com/search?q=${encodeURIComponent(q + ' fornecedor')}`, color: '#4285f4' },
      { label: 'Mercado Livre', url: `https://lista.mercadolivre.com.br/${encodeURIComponent(q)}`, color: '#ffe600', dark: true },
      { label: 'Alibaba', url: `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(q)}`, color: '#ff6a00' },
      { label: 'Google Maps', url: `https://www.google.com/maps/search/${encodeURIComponent(q + ' ' + cidade + ' ' + estado)}`, color: '#34a853' },
    ]
  }

  const abas = [
    { key: 'fornecedor', label: 'Buscar Fornecedor' },
    { key: 'precos',     label: 'Pesquisa de Preços' },
    { key: 'cnpj',       label: 'Consulta CNPJ' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* cabeçalho radar */}
      <div style={{ padding: '14px 16px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(225,29,72,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MagnifyingGlassIcon style={{ width: 15, color: '#e11d48' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Radar de Compras</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Busca de fornecedores, preços e CNPJ</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {abas.map(a => (
            <button key={a.key} onClick={() => setAba(a.key)} style={{
              flex: 1, padding: '7px 4px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: 'none', borderBottom: aba === a.key ? '2px solid #e11d48' : '2px solid transparent',
              background: 'transparent', color: aba === a.key ? '#e11d48' : 'var(--text-secondary)',
            }}>{a.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* ── aba: Buscar Fornecedor ── */}
        {aba === 'fornecedor' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Autocomplete value={produto} onChange={setProduto} suggestions={SUGESTOES_PRODUTO}
              placeholder="Produto ou serviço (ex: Pneus 295/80)" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
              <Autocomplete value={cidade} onChange={setCidade} suggestions={cidades}
                placeholder="Cidade (opcional)" />
              <select value={estado} onChange={e => setEstado(e.target.value)}
                style={{ padding: '8px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12 }}>
                <option value="">UF</option>
                {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <button onClick={buscarFornecedores} disabled={loadingForn}
              style={{ padding: '9px 0', borderRadius: 8, background: '#e11d48', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {loadingForn ? <ArrowPathIcon style={{ width: 15, animation: 'spin 1s linear infinite' }} /> : <MagnifyingGlassIcon style={{ width: 15 }} />}
              Buscar Fornecedores
            </button>

            {/* links externos sempre visíveis */}
            {produto.trim() && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Pesquisa manual</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {linksExternos(produto).map(l => (
                    <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: l.color, color: l.dark ? '#111' : '#fff', textDecoration: 'none', flexShrink: 0 }}>
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* resultados */}
            {resultForn.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>{resultForn.length} fornecedor(es) encontrado(s)</div>
                {resultForn.map((f, i) => (
                  <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{f.nome}</div>
                        {f.endereco && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{f.endereco}</div>}
                        {f.telefone && <a href={waLink(f.telefone) || '#'} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: '#10b981', textDecoration: 'none', fontWeight: 700 }}>{f.telefone}</a>}
                      </div>
                      <button onClick={() => onAdicionarFornecedor?.(f)}
                        style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.3)', color: '#0ea5e9', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        + Adicionar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── aba: Pesquisa de Preços ── */}
        {aba === 'precos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Autocomplete value={queryPreco} onChange={setQueryPreco} suggestions={SUGESTOES_PRODUTO}
              placeholder="Ex: Óleo 15W40 20L" />
            <button onClick={buscarPrecos} disabled={loadingPreco}
              style={{ padding: '9px 0', borderRadius: 8, background: '#e11d48', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {loadingPreco ? <ArrowPathIcon style={{ width: 15, animation: 'spin 1s linear infinite' }} /> : <MagnifyingGlassIcon style={{ width: 15 }} />}
              Pesquisar Preços
            </button>

            {/* link rápido Mercado Livre */}
            {queryPreco.trim() && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { label: 'Mercado Livre', url: `https://lista.mercadolivre.com.br/${encodeURIComponent(queryPreco)}`, color: '#ffe600', dark: true },
                  { label: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(queryPreco)}`, color: '#4285f4' },
                  { label: 'Amazon BR', url: `https://www.amazon.com.br/s?k=${encodeURIComponent(queryPreco)}`, color: '#ff9900', dark: true },
                ].map(l => (
                  <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: l.color, color: l.dark ? '#111' : '#fff', textDecoration: 'none' }}>
                    {l.label} ↗
                  </a>
                ))}
              </div>
            )}

            {resultPreco && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                {/* KPIs */}
                {resultPreco.resultados?.length > 0 && (() => {
                  const precos = resultPreco.resultados.map(r => r.preco).filter(Boolean)
                  const menor = Math.min(...precos)
                  const maior = Math.max(...precos)
                  const media = precos.reduce((a, b) => a + b, 0) / precos.length
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                      {[
                        { label: 'Menor', value: fmtBRL(menor), color: '#10b981' },
                        { label: 'Média', value: fmtBRL(media), color: '#3b82f6' },
                        { label: 'Maior', value: fmtBRL(maior), color: '#f59e0b' },
                      ].map(k => (
                        <div key={k.label} style={{ background: `${k.color}10`, border: `1px solid ${k.color}25`, borderTop: `2px solid ${k.color}`, borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, color: LC.txtMuted, fontWeight: 700, textTransform: 'uppercase' }}>{k.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: k.color }}>{k.value}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                {/* filtro fonte */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
                  {['todos', 'ml', 'google'].map(f => (
                    <button key={f} onClick={() => setFiltroPl(f)}
                      style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid', background: filtroPl === f ? 'var(--accent)' : 'var(--bg-card)', color: filtroPl === f ? '#fff' : 'var(--text-secondary)', borderColor: filtroPl === f ? 'var(--accent)' : 'var(--border)' }}>
                      {{ todos: 'Todos', ml: 'ML', google: 'Google' }[f]}
                    </button>
                  ))}
                </div>
                {(resultPreco.resultados || [])
                  .filter(r => filtroPl === 'todos' || (filtroPl === 'ml' && r.site === 'Mercado Livre') || (filtroPl === 'google' && r.site !== 'Mercado Livre'))
                  .map((item, i) => {
                    const menorPreco = Math.min(...(resultPreco.resultados || []).map(r => r.preco).filter(Boolean))
                    const isMenor = item.preco === menorPreco
                    const siteBg = SITE_COLORS[item.site] ?? '#6b7280'
                    return (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: isMenor ? 'rgba(34,197,94,0.05)' : 'var(--bg-secondary)', borderRadius: 8, border: `1px solid ${isMenor ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.titulo}</div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                            <span style={{ background: siteBg, color: ['#FFE600'].includes(siteBg) ? '#111' : '#fff', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99 }}>{item.site}</span>
                            {isMenor && <span style={{ fontSize: 9, fontWeight: 800, color: '#22c55e' }}>MENOR PREÇO</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: isMenor ? '#22c55e' : 'var(--text-primary)' }}>{fmtBRL(item.preco)}</div>
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 10, color: 'var(--text-secondary)', textDecoration: 'none' }}>ver ↗</a>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* ── aba: Consulta CNPJ ── */}
        {aba === 'cnpj' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={cnpjInput} onChange={e => setCnpjInput(fmtCNPJ(e.target.value))}
                placeholder="00.000.000/0001-00" maxLength={18}
                onKeyDown={e => e.key === 'Enter' && consultarCNPJ()}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
              <button onClick={consultarCNPJ} disabled={loadingCnpj}
                style={{ padding: '8px 14px', borderRadius: 8, background: '#e11d48', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                {loadingCnpj ? <ArrowPathIcon style={{ width: 14, animation: 'spin 1s linear infinite' }} /> : <IdentificationIcon style={{ width: 14 }} />}
                Consultar
              </button>
            </div>

            {dadosCnpj && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* score */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Score Fiscal</div>
                  <ScoreFiscal score={scoreCnpj || 0} />
                </div>
                {/* dados */}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>{dadosCnpj.razao_social}</div>
                  {dadosCnpj.nome_fantasia && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{dadosCnpj.nome_fantasia}</div>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: dadosCnpj.descricao_situacao_cadastral?.toUpperCase().includes('ATIVA') ? '#10b981' : '#ef4444', background: dadosCnpj.descricao_situacao_cadastral?.toUpperCase().includes('ATIVA') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 99 }}>
                      {dadosCnpj.descricao_situacao_cadastral || 'Situação desconhecida'}
                    </span>
                  </div>
                  {[
                    { label: 'CNPJ', value: fmtCNPJ(dadosCnpj.cnpj || '') },
                    { label: 'Abertura', value: dadosCnpj.data_inicio_atividade ? fmtDate(dadosCnpj.data_inicio_atividade) : '—' },
                    { label: 'Capital', value: dadosCnpj.capital_social ? fmtBRL(dadosCnpj.capital_social) : '—' },
                    { label: 'Telefone', value: dadosCnpj.ddd_telefone_1 ? `(${dadosCnpj.ddd_telefone_1}) ${dadosCnpj.telefone_1}` : '—' },
                    { label: 'E-mail', value: dadosCnpj.email || '—' },
                    { label: 'Município', value: dadosCnpj.municipio || '—' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, gap: 8 }}>
                      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{r.label}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>{r.value}</span>
                    </div>
                  ))}
                </div>
                {/* CNAEs */}
                {dadosCnpj.cnae_fiscal_descricao && (
                  <div style={{ background: 'rgba(99,102,241,0.06)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>CNAE Principal</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{dadosCnpj.cnae_fiscal_descricao}</div>
                  </div>
                )}
                {/* ação */}
                <button onClick={adicionarDoCNPJ} disabled={addedCnpjs.includes(dadosCnpj.cnpj)}
                  style={{ padding: '9px 0', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none', background: addedCnpjs.includes(dadosCnpj.cnpj) ? 'rgba(16,185,129,0.15)' : '#0ea5e9', color: addedCnpjs.includes(dadosCnpj.cnpj) ? '#10b981' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {addedCnpjs.includes(dadosCnpj.cnpj) ? <><CheckCircleIcon style={{ width: 15 }} />Adicionado ao Cadastro</> : <><PlusCircleIcon style={{ width: 15 }} />Adicionar ao Cadastro</>}
                </button>
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
