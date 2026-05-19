import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { waLink } from '../lib/utils'
import useStore from '../store/useStore'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  MagnifyingGlassIcon, MapPinIcon,
  PhoneIcon, EnvelopeIcon, PlusCircleIcon, ArrowPathIcon,
  CheckCircleIcon, GlobeAltIcon, IdentificationIcon,
  CalendarDaysIcon, BanknotesIcon, TagIcon,
  ExclamationCircleIcon, XCircleIcon, DocumentTextIcon,
  ChatBubbleLeftEllipsisIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline'

// ─── helpers ─────────────────────────────────────────────────────────────────
function estrelas(r) {
  if (!r) return null
  const full = Math.round(r)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

// Remove acentos, lowercase, colapsa espaços — para comparação
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// ─── CNPJ helpers ─────────────────────────────────────────────────────────────
function fmtCNPJ(v='') {
  const d=v.replace(/\D/g,'').slice(0,14)
  if(d.length<=2)return d
  if(d.length<=5)return `${d.slice(0,2)}.${d.slice(2)}`
  if(d.length<=8)return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if(d.length<=12)return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}
function fmtBRL(v) {
  return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}

const SUGESTOES = [
  'Pneus', 'Lubrificantes', 'Pecas auto', 'Baterias', 'EPI', 'Ferramentas',
  'Eletrica', 'Hidraulica', 'Informatica', 'Escritorio', 'Limpeza', 'Alimentos',
  'Bebidas', 'Manutencao', 'Seguranca', 'Construcao', 'Tintas', 'Uniformes',
  'Embalagens', 'Combustivel', 'Climatizacao', 'Transporte',
]
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

// ─── IBGE cities loader (module-level cache, loads once) ─────────────────────
let _cidadesPromise = null
function loadCidades() {
  if (!_cidadesPromise) {
    _cidadesPromise = fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome')
      .then(r => r.json())
      .then(data => data.map(m => ({ nome: m.nome, uf: m?.microrregiao?.mesorregiao?.UF?.sigla || '' })))
      .catch(() => [])
  }
  return _cidadesPromise
}

// ─── AutocompleteInput ────────────────────────────────────────────────────────
// sugestoes: string[] | { label, sub?, uf? }[]
function AutocompleteInput({ value, onChange, onSelect, sugestoes, placeholder, inputStyle, onEnter }) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const wrapRef = useRef(null)

  useEffect(() => {
    function handler(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = value.trim()
    ? sugestoes.filter(s => norm(typeof s === 'string' ? s : s.label).includes(norm(value))).slice(0, 10)
    : []

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      if (open && cursor >= 0 && filtered.length > 0) {
        e.preventDefault(); onSelect(filtered[cursor]); setOpen(false); setCursor(-1)
      } else { setOpen(false); onEnter?.() }
      return
    }
    if (!open || filtered.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)) }
    if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setCursor(-1) }}
        onFocus={() => value.trim() && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={inputStyle}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.35)', marginTop: 3, maxHeight: 220, overflowY: 'auto' }}>
          {filtered.map((s, i) => {
            const label = typeof s === 'string' ? s : s.label
            const sub   = typeof s === 'string' ? null : s.sub
            return (
              <div key={i} onMouseDown={() => { onSelect(s); setOpen(false); setCursor(-1) }}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, background: cursor === i ? 'rgba(14,165,233,0.12)' : 'transparent', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, userSelect: 'none' }}>
                <span>{label}</span>
                {sub && <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, background: 'var(--bg-primary)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)', flexShrink: 0 }}>{sub}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
function FornecedorCard({ e, onAdd, added, onConsultarCnpj, selecionado, onToggle }) {
  return (
    <div style={{background:'var(--bg-secondary)',borderRadius:12,border:selecionado?'1.5px solid #0ea5e9':'1px solid var(--border)',padding:16,display:'flex',flexDirection:'column',gap:10,transition:'border-color .15s'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
        <div style={{display:'flex',gap:10,alignItems:'flex-start',flex:1,minWidth:0}}>
          <input type="checkbox" checked={selecionado} onChange={onToggle}
            title="Selecionar para ação em lote"
            style={{marginTop:11,accentColor:'#0ea5e9',cursor:'pointer',width:16,height:16,flexShrink:0}}/>
          <div style={{width:42,height:42,borderRadius:10,background:'rgba(14,165,233,0.12)',border:'1px solid rgba(14,165,233,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:17,fontWeight:900,color:'#0ea5e9'}}>
            {(e.nome||'?').charAt(0).toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:800,fontSize:15,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.nome}</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4,alignItems:'center'}}>
              {e.categoria&&<span style={{padding:'1px 7px',borderRadius:20,fontSize:10,fontWeight:700,background:'rgba(99,102,241,0.1)',color:'#6366f1'}}>{e.categoria}</span>}
              {e.rating&&<span style={{fontSize:11,color:'#f59e0b',fontWeight:700,letterSpacing:.5}}>{estrelas(e.rating)} {e.rating.toFixed(1)}{e.avaliacoes>0&&<span style={{color:'var(--text-secondary)',fontWeight:400}}> ({e.avaliacoes})</span>}</span>}
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          <button onClick={()=>onConsultarCnpj(e)} title="Consultar CNPJ deste fornecedor"
            style={{padding:'7px 10px',borderRadius:8,fontSize:11,fontWeight:700,background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.25)',cursor:'pointer',color:'#6366f1',display:'flex',alignItems:'center',gap:4}}>
            <IdentificationIcon style={{width:13,height:13}}/>CNPJ
          </button>
          <button onClick={()=>onAdd(e)} disabled={added}
            style={{padding:'7px 12px',borderRadius:8,fontSize:12,fontWeight:700,background:added?'rgba(16,185,129,0.12)':'rgba(14,165,233,0.12)',border:added?'1px solid rgba(16,185,129,0.3)':'1px solid rgba(14,165,233,0.3)',cursor:added?'default':'pointer',color:added?'#10b981':'#0ea5e9',display:'flex',alignItems:'center',gap:5}}>
            {added?<CheckCircleIcon style={{width:14,height:14}}/>:<PlusCircleIcon style={{width:14,height:14}}/>}
            {added?'Adicionado':'Adicionar'}
          </button>
        </div>
      </div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
        {e.endereco&&<span style={{fontSize:12,color:'var(--text-secondary)',display:'flex',alignItems:'center',gap:4}}><MapPinIcon style={{width:12,height:12}}/>{e.endereco}</span>}
      </div>
      <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'center'}}>
        {waLink(e.telefone)&&<a href={waLink(e.telefone)} target="_blank" rel="noreferrer" style={{fontSize:12,color:'#10b981',display:'flex',alignItems:'center',gap:4,textDecoration:'none',fontWeight:700}}><PhoneIcon style={{width:12,height:12}}/>{e.telefone}</a>}
        {e.website&&<a href={e.website.startsWith('http')?e.website:`https://${e.website}`} target="_blank" rel="noreferrer" style={{fontSize:12,color:'#8b5cf6',display:'flex',alignItems:'center',gap:4,textDecoration:'none'}}><GlobeAltIcon style={{width:12,height:12}}/>Site</a>}
        {e.horario&&typeof e.horario==='string'&&<span style={{fontSize:11,color:'var(--text-secondary)'}}>{e.horario}</span>}
      </div>
    </div>
  )
}

// ─── Motor de Score Fiscal ──────────────────────────────────────────────────
function calcFiscalScore(d) {
  const breakdown = []
  let score = 0

  // 1. Situação Cadastral (40 pts)
  const status = (d.descricao_situacao_cadastral || String(d.situacao_cadastral || '')).toUpperCase()
  const sitPts = status.includes('ATIVA') ? 40 : status.includes('SUSPENS') ? 10 : status.includes('INAPT') ? 5 : 0
  score += sitPts
  breakdown.push({ label: 'Situação Cadastral', pts: sitPts, max: 40, detail: d.descricao_situacao_cadastral || String(d.situacao_cadastral || 'Desconhecida') })

  // 2. Tempo de Atividade (20 pts)
  let tempoPts = 0, tempoDetail = 'Não informado'
  if (d.data_inicio_atividade) {
    const anos = (Date.now() - new Date(d.data_inicio_atividade).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    tempoPts = anos >= 10 ? 20 : anos >= 5 ? 15 : anos >= 2 ? 10 : anos >= 1 ? 5 : 2
    tempoDetail = anos >= 1 ? `${Math.floor(anos)} ano${Math.floor(anos) !== 1 ? 's' : ''}` : `${Math.floor(anos * 12)} meses`
  }
  score += tempoPts
  breakdown.push({ label: 'Tempo de Atividade', pts: tempoPts, max: 20, detail: tempoDetail })

  // 3. Regime & Formalização (15 pts)
  let regimePts = 0
  const regDetails = []
  const regimes = Array.isArray(d.regime_tributario) ? d.regime_tributario : []
  if (regimes.length > 0) { regimePts += 7; regDetails.push('Regime declarado') }
  if (d.opcao_pelo_simples === true) { regimePts += 5; regDetails.push('Simples Nacional') }
  if (d.opcao_pelo_mei === true) { regimePts += 3; regDetails.push('MEI') }
  if ((d.capital_social || 0) > 0) { regimePts += 2; regDetails.push('Capital declarado') }
  regimePts = Math.min(regimePts, 15)
  score += regimePts
  breakdown.push({ label: 'Regime & Formalização', pts: regimePts, max: 15, detail: regDetails.join(', ') || 'Não informado' })

  // 4. Completude dos Dados (10 pts)
  let complPts = 0
  const complDetails = []
  if (d.email) { complPts += 3; complDetails.push('E-mail') }
  if ((d.ddd_telefone_2 || '').replace(/\D/g, '').length > 5) { complPts += 2; complDetails.push('Tel.2') }
  if ((d.qsa || []).length > 0) { complPts += 3; complDetails.push('QSA') }
  if ((d.cnaes_secundarios || []).length > 0) { complPts += 2; complDetails.push('CNAEs sec.') }
  score += complPts
  breakdown.push({ label: 'Completude dos Dados', pts: complPts, max: 10, detail: complDetails.join(', ') || 'Mínimo' })

  // Penalidades
  const penalties = []
  if (String(d.situacao_especial || '').trim()) {
    score -= 15
    penalties.push({ label: 'Situação Especial', detail: d.situacao_especial })
  }
  const motivo = String(d.descricao_motivo_situacao_cadastral || '').trim().toUpperCase()
  if (motivo && motivo !== 'SEM MOTIVO' && motivo !== '0') {
    score -= 10
    penalties.push({ label: 'Motivo do Status', detail: d.descricao_motivo_situacao_cadastral })
  }

  score = Math.max(0, Math.min(100, score))
  const tier =
    score >= 80 ? { label: 'Excelente', color: '#10b981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.25)' } :
    score >= 65 ? { label: 'Bom',       color: '#34d399', bg: 'rgba(52,211,153,0.07)', border: 'rgba(52,211,153,0.25)' } :
    score >= 50 ? { label: 'Regular',   color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.25)' } :
    score >= 30 ? { label: 'Atenção',   color: '#f97316', bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.25)' } :
                  { label: 'Crítico',   color: '#ef4444', bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.25)'  }
  return { score, ...tier, breakdown, penalties }
}

// ─── Card CNPJ detalhado ──────────────────────────────────────────────────────
function CnpjDetalhadoCard({ d, onAdd, added }) {
  const status = d.descricao_situacao_cadastral || String(d.situacao_cadastral || '')
  const ativa = status.toUpperCase().includes('ATIVA')
  const tel1 = (d.ddd_telefone_1 || '').replace(/\D/g,'').length > 5 ? `(${d.ddd_telefone_1.slice(0,2)}) ${d.ddd_telefone_1.slice(2)}` : null
  const tel2 = (d.ddd_telefone_2 || '').replace(/\D/g,'').length > 5 ? `(${d.ddd_telefone_2.slice(0,2)}) ${d.ddd_telefone_2.slice(2)}` : null
  const fax  = (d.ddd_fax       || '').replace(/\D/g,'').length > 5 ? `(${d.ddd_fax.slice(0,2)}) ${d.ddd_fax.slice(2)}` : null
  const end = [d.descricao_tipo_de_logradouro, d.logradouro, d.numero, d.complemento, d.bairro, d.municipio, d.uf, d.cep ? `CEP ${d.cep}` : null].filter(Boolean).join(', ')
  const matFilial = d.descricao_identificador_matriz_filial
  const fiscal = calcFiscalScore(d)
  const empresa = { id: d.cnpj, nome: d.nome_fantasia || d.razao_social, cnpj: d.cnpj, telefone: tel1, email: d.email || null, logradouro: end, municipio: d.municipio, uf: d.uf }

  return (
    <div style={{background:'var(--bg-secondary)',borderRadius:14,border:'2px solid var(--border)',overflow:'hidden'}}>

      {/* ── Header ── */}
      <div style={{padding:'18px 22px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,background:'var(--bg-primary)'}}>
        <div style={{display:'flex',gap:14,alignItems:'flex-start',flex:1,minWidth:0}}>
          <div style={{width:50,height:50,borderRadius:12,background:'rgba(14,165,233,0.12)',border:'1px solid rgba(14,165,233,0.25)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:20,fontWeight:900,color:'#0ea5e9'}}>
            {(d.nome_fantasia||d.razao_social||'?').charAt(0).toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:800,fontSize:17,color:'var(--text-primary)',lineHeight:1.2}}>{d.nome_fantasia||d.razao_social}</div>
            {d.nome_fantasia&&<div style={{fontSize:12,color:'var(--text-secondary)',marginTop:2}}>{d.razao_social}</div>}
            <div style={{display:'flex',gap:6,alignItems:'center',marginTop:7,flexWrap:'wrap'}}>
              <span style={{fontSize:12,fontFamily:'monospace',color:'var(--text-secondary)',background:'var(--bg-secondary)',padding:'2px 8px',borderRadius:6,border:'1px solid var(--border)'}}>{fmtCNPJ(d.cnpj)}</span>
              <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:800,background:ativa?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)',color:ativa?'#10b981':'#ef4444',display:'flex',alignItems:'center',gap:4}}>
                {ativa?<CheckCircleIcon style={{width:12,height:12}}/>:<XCircleIcon style={{width:12,height:12}}/>}
                {status||'Desconhecida'}
              </span>
              {matFilial&&<span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,background:'rgba(14,165,233,0.1)',color:'#0ea5e9'}}>{matFilial}</span>}
              {d.porte&&<span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600,background:'rgba(99,102,241,0.1)',color:'#6366f1'}}>{d.porte}</span>}
              {d.natureza_juridica&&<span style={{padding:'2px 8px',borderRadius:20,fontSize:11,color:'var(--text-secondary)',background:'var(--bg-secondary)',border:'1px solid var(--border)'}}>{d.natureza_juridica}</span>}
            </div>
          </div>
        </div>
        <button onClick={()=>onAdd(empresa)} disabled={added}
          style={{flexShrink:0,padding:'9px 16px',borderRadius:9,fontSize:13,fontWeight:800,background:added?'rgba(16,185,129,0.12)':'#0ea5e9',border:added?'1px solid rgba(16,185,129,0.3)':'none',cursor:added?'default':'pointer',color:added?'#10b981':'#fff',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>
          {added?<CheckCircleIcon style={{width:15,height:15}}/>:<PlusCircleIcon style={{width:15,height:15}}/>}
          {added?'Adicionado':'Adicionar'}
        </button>
      </div>

      {/* ── Score Fiscal ── */}
      <div style={{padding:'14px 22px',borderBottom:'1px solid var(--border)',background:fiscal.bg,border:`1px solid ${fiscal.border}`}}>
        <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
          <div style={{flexShrink:0,width:68,height:68,borderRadius:'50%',border:`3px solid ${fiscal.color}`,background:'var(--bg-primary)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',boxShadow:`0 0 14px ${fiscal.color}30`}}>
            <div style={{fontSize:22,fontWeight:900,color:fiscal.color,lineHeight:1}}>{fiscal.score}</div>
            <div style={{fontSize:9,fontWeight:700,color:fiscal.color,textTransform:'uppercase',letterSpacing:.5}}>pts</div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:800,color:fiscal.color,marginBottom:9,display:'flex',alignItems:'center',gap:6}}>
              <ShieldCheckIcon style={{width:14,height:14}}/> Score Fiscal: {fiscal.label}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'4px 24px'}}>
              {fiscal.breakdown.map((b,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:7}}>
                  <div style={{fontSize:11,color:'var(--text-secondary)',width:148,flexShrink:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{b.label}</div>
                  <div style={{width:64,height:5,borderRadius:3,background:'var(--border)',flexShrink:0,overflow:'hidden'}}>
                    <div style={{width:`${Math.max(0,(b.pts/b.max)*100)}%`,height:'100%',borderRadius:3,background:b.pts>=b.max*.75?'#10b981':b.pts>=b.max*.4?'#f59e0b':'#ef4444'}}/>
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text-primary)',width:36,textAlign:'right',flexShrink:0}}>{b.pts}/{b.max}</div>
                  <div style={{fontSize:10,color:'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{b.detail}</div>
                </div>
              ))}
            </div>
            {fiscal.penalties.length>0&&(
              <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:3}}>
                {fiscal.penalties.map((p,i)=>(
                  <div key={i} style={{fontSize:11,color:'#ef4444',display:'flex',alignItems:'center',gap:5}}>
                    <ExclamationCircleIcon style={{width:12,height:12,flexShrink:0}}/> {p.label}: {p.detail}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Corpo ── */}
      <div style={{padding:'18px 22px',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:20}}>

        {/* Contato & Endereço */}
        <div>
          <SecLabel>Contato & Endereço</SecLabel>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {end&&<InfoRow icon={MapPinIcon} label="Endereço" value={end}/>}
            {tel1&&<InfoRow icon={PhoneIcon} label="Telefone" value={<a href={waLink(tel1)||'#'} target="_blank" rel="noreferrer" style={{color:'#10b981',fontWeight:700,textDecoration:'none'}}>{tel1} (WA)</a>}/>}
            {tel2&&<InfoRow icon={PhoneIcon} label="Telefone 2" value={<a href={waLink(tel2)||'#'} target="_blank" rel="noreferrer" style={{color:'#10b981',fontWeight:700,textDecoration:'none'}}>{tel2}</a>}/>}
            {fax&&<InfoRow icon={PhoneIcon} label="Fax" value={fax}/>}
            {d.email&&<InfoRow icon={EnvelopeIcon} label="E-mail" value={<a href={`mailto:${d.email}`} style={{color:'#0ea5e9',textDecoration:'none'}}>{d.email}</a>}/>}
          </div>
        </div>

        {/* Dados Cadastrais */}
        <div>
          <SecLabel>Dados Cadastrais</SecLabel>
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {d.data_inicio_atividade&&<InfoRow icon={CalendarDaysIcon} label="Abertura" value={new Date(d.data_inicio_atividade).toLocaleDateString('pt-BR')}/>}
            {d.data_situacao_cadastral&&<InfoRow icon={CalendarDaysIcon} label="Status desde" value={new Date(d.data_situacao_cadastral).toLocaleDateString('pt-BR')}/>}
            {(d.capital_social||0)>0&&<InfoRow icon={BanknotesIcon} label="Capital Social" value={fmtBRL(d.capital_social)}/>}
            {d.cnae_fiscal_descricao&&<InfoRow icon={TagIcon} label="Atividade Principal" value={`${d.cnae_fiscal} — ${d.cnae_fiscal_descricao}`}/>}
            {(d.cnaes_secundarios||[]).length>0&&(
              <InfoRow icon={DocumentTextIcon} label="CNAEs Secundários" value={
                <div style={{display:'flex',flexDirection:'column',gap:2,marginTop:2}}>
                  {d.cnaes_secundarios.slice(0,4).map(c=>(
                    <span key={c.codigo} style={{fontSize:11,color:'var(--text-secondary)'}}>{c.codigo} — {c.descricao}</span>
                  ))}
                  {d.cnaes_secundarios.length>4&&<span style={{fontSize:11,color:'var(--text-secondary)',fontStyle:'italic'}}>+{d.cnaes_secundarios.length-4} outros</span>}
                </div>
              }/>
            )}
          </div>
        </div>

        {/* Regime Fiscal */}
        <div>
          <SecLabel>Regime Fiscal</SecLabel>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {d.opcao_pelo_simples===true&&(
                <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:'rgba(16,185,129,0.12)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',display:'flex',alignItems:'center',gap:4}}>
                  <CheckCircleIcon style={{width:11,height:11}}/> Simples Nacional
                </span>
              )}
              {d.opcao_pelo_simples===false&&(
                <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:'rgba(107,114,128,0.08)',color:'var(--text-secondary)',border:'1px solid var(--border)'}}>
                  Fora do Simples
                </span>
              )}
              {d.opcao_pelo_mei===true&&(
                <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:'rgba(245,158,11,0.12)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)',display:'flex',alignItems:'center',gap:4}}>
                  <CheckCircleIcon style={{width:11,height:11}}/> MEI
                </span>
              )}
            </div>
            {d.data_opcao_pelo_simples&&<InfoRow icon={CalendarDaysIcon} label="Simples desde" value={new Date(d.data_opcao_pelo_simples).toLocaleDateString('pt-BR')}/>}
            {d.data_exclusao_do_simples&&<InfoRow icon={ExclamationCircleIcon} label="Excluído do Simples" value={<span style={{color:'#f97316'}}>{new Date(d.data_exclusao_do_simples).toLocaleDateString('pt-BR')}</span>}/>}
            {d.descricao_motivo_situacao_cadastral&&d.descricao_motivo_situacao_cadastral.toUpperCase()!=='SEM MOTIVO'&&(
              <InfoRow icon={ExclamationCircleIcon} label="Motivo Status" value={<span style={{color:'#f97316'}}>{d.descricao_motivo_situacao_cadastral}</span>}/>
            )}
            {d.situacao_especial&&String(d.situacao_especial).trim()&&(
              <InfoRow icon={ExclamationCircleIcon} label="Situação Especial" value={<span style={{color:'#ef4444',fontWeight:700}}>{d.situacao_especial}</span>}/>
            )}
            {Array.isArray(d.regime_tributario)&&d.regime_tributario.length>0&&(
              <InfoRow icon={DocumentTextIcon} label="Histórico de Regime" value={
                <div style={{display:'flex',flexDirection:'column',gap:2,marginTop:2}}>
                  {[...d.regime_tributario].reverse().slice(0,4).map((r,i)=>(
                    <span key={i} style={{fontSize:11,color:'var(--text-secondary)'}}>
                      {r.descricao||r.codigo||JSON.stringify(r)}{r.data?` (${new Date(r.data).toLocaleDateString('pt-BR')})`:''}
                    </span>
                  ))}
                </div>
              }/>
            )}
          </div>
        </div>

        {/* Quadro Societário */}
        {(d.qsa||[]).length>0&&(
          <div style={{gridColumn:'1 / -1'}}>
            <SecLabel>Quadro Societário (QSA)</SecLabel>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {d.qsa.map((s,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'var(--bg-primary)',borderRadius:9,border:'1px solid var(--border)'}}>
                  <div style={{width:30,height:30,borderRadius:8,background:'rgba(99,102,241,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'#6366f1',flexShrink:0}}>
                    {(s.nome_socio||'?').charAt(0)}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>{s.nome_socio}</div>
                    <div style={{fontSize:11,color:'var(--text-secondary)'}}>{s.qualificacao_socio}</div>
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

function SecLabel({ children }) {
  return <div style={{fontSize:11,fontWeight:800,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>{children}</div>
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
      <Icon style={{width:14,height:14,color:'var(--text-secondary)',flexShrink:0,marginTop:1}}/>
      <div style={{flex:1,minWidth:0}}>
        <span style={{fontSize:11,color:'var(--text-secondary)',fontWeight:600}}>{label}: </span>
        <span style={{fontSize:12,color:'var(--text-primary)'}}>{value}</span>
      </div>
    </div>
  )
}

// ─── Links externos ───────────────────────────────────────────────────────────
function LinksExternos({ produto, cidade, uf }) {
  const q = encodeURIComponent(`${produto} ${cidade} ${uf||''}`.trim())
  const qF = encodeURIComponent(`fornecedor ${produto} ${cidade}`.trim())
  const links = [
    { label:'Google Maps', sub:'Estabelecimentos próximos', color:'#ea4335', href:`https://www.google.com/maps/search/${q}` },
    { label:'Google Negócios', sub:'Busca com avaliações', color:'#4285f4', href:`https://www.google.com/search?q=${qF}` },
    { label:'Mercado Livre', sub:'Fornecedores B2B', color:'#f5a623', href:`https://lista.mercadolivre.com.br/${encodeURIComponent(produto)}` },
    { label:'Alibaba', sub:'Fornecedores globais', color:'#ff6a00', href:`https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(produto)}` },
  ]
  return (
    <div style={{marginTop:16}}>
      <div style={{fontSize:12,fontWeight:700,color:'var(--text-secondary)',marginBottom:8,textTransform:'uppercase',letterSpacing:.4}}>Buscar também em</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {links.map(l=>(
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
            style={{padding:'7px 14px',borderRadius:8,fontSize:12,fontWeight:700,background:l.color+'18',border:`1px solid ${l.color}40`,color:l.color,textDecoration:'none',whiteSpace:'nowrap'}}>
            {l.label} ↗
          </a>
        ))}
      </div>
    </div>
  )
}

// ─── Aba: Consultar CNPJ ──────────────────────────────────────────────────────
function AbaCnpj({ onAdicionar, adicionados, hint, hintCidade }) {
  const [cnpj, setCnpj] = useState('')
  const [loading, setLoading] = useState(false)
  const [empresa, setEmpresa] = useState(null)
  const [autoSearching, setAutoSearching] = useState(false)
  const [autoMsg, setAutoMsg] = useState(null) // null | 'found' | 'notfound'

  // Busca por nome
  const [nomeBusca, setNomeBusca]       = useState('')
  const [cidadeBusca, setCidadeBusca]   = useState('')
  const [buscandoNome, setBuscandoNome] = useState(false)

  function handleInput(v) { setCnpj(fmtCNPJ(v)) }

  async function consultarDigits(digits) {
    if (digits.length !== 14) { toast.error('CNPJ deve ter 14 dígitos'); return }
    setLoading(true); setEmpresa(null)
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
      if (!r.ok) {
        const err = await r.json().catch(()=>({}))
        throw new Error(err.message || 'CNPJ não encontrado ou inativo')
      }
      setEmpresa(await r.json())
    } catch (err) {
      toast.error(err.message)
    }
    setLoading(false)
  }

  async function consultar() {
    await consultarDigits(cnpj.replace(/\D/g,''))
  }

  async function buscarCnpjPorNome() {
    if (!nomeBusca.trim()) { toast.error('Informe o nome da empresa'); return }
    setBuscandoNome(true)
    setEmpresa(null)
    setCnpj('')
    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { mode: 'cnpj_search', nome: nomeBusca.trim(), cidade: cidadeBusca.trim() },
      })
      if (error || !data?.cnpjs?.length) {
        toast.error('CNPJ não encontrado. Tente o nome completo ou inclua a cidade.')
        return
      }
      const first = data.cnpjs[0].replace(/\D/g, '')
      setCnpj(fmtCNPJ(first))
      await consultarDigits(first)
    } catch {
      toast.error('Erro ao buscar CNPJ')
    } finally {
      setBuscandoNome(false)
    }
  }

  // Auto-busca CNPJ pelo nome da empresa via Serper quando hint muda
  useEffect(() => {
    if (!hint) { setAutoMsg(null); return }
    setAutoMsg(null)
    setEmpresa(null)
    setCnpj('')
    setAutoSearching(true)
    supabase.functions.invoke('busca-fornecedores', {
      body: { mode: 'cnpj_search', nome: hint, cidade: hintCidade || '' },
    }).then(({ data, error }) => {
      setAutoSearching(false)
      if (error || !data?.cnpjs?.length) {
        setAutoMsg('notfound')
        return
      }
      const first = data.cnpjs[0].replace(/\D/g, '')
      setCnpj(fmtCNPJ(first))
      setAutoMsg('found')
      consultarDigits(first)
    }).catch(() => { setAutoSearching(false); setAutoMsg('notfound') })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint])

  const inpStyle = {padding:'9px 12px',borderRadius:8,fontSize:13,background:'var(--bg-primary)',border:'1px solid var(--border)',color:'var(--text-primary)',outline:'none',boxSizing:'border-box',width:'100%'}

  return (
    <div>
      {/* ── Buscar CNPJ por nome ─────────────────────────────────────── */}
      <div style={{background:'var(--bg-secondary)',borderRadius:12,border:'1px solid var(--border)',padding:'18px 22px',marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:800,color:'var(--text-primary)',marginBottom:4}}>Buscar CNPJ pelo nome da empresa</div>
        <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:12}}>
          Pesquise na internet pelo nome e encontre o CNPJ automaticamente — via Serper + Receita Federal.
        </div>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr auto',gap:10,alignItems:'flex-end'}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:.4,marginBottom:5,display:'block'}}>Nome da empresa</label>
            <input value={nomeBusca} onChange={e=>setNomeBusca(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&buscarCnpjPorNome()}
              placeholder="Ex: Acme Distribuidora, Auto Peças Norte..."
              style={inpStyle}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:.4,marginBottom:5,display:'block'}}>Cidade (opcional)</label>
            <input value={cidadeBusca} onChange={e=>setCidadeBusca(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&buscarCnpjPorNome()}
              placeholder="Ex: São Paulo"
              style={inpStyle}/>
          </div>
          <button onClick={buscarCnpjPorNome} disabled={buscandoNome}
            style={{padding:'9px 20px',borderRadius:9,background:buscandoNome?'#6b7280':'#0ea5e9',border:'none',cursor:buscandoNome?'not-allowed':'pointer',color:'#fff',fontSize:13,fontWeight:800,display:'flex',alignItems:'center',gap:7,height:40,whiteSpace:'nowrap',flexShrink:0}}>
            {buscandoNome?<ArrowPathIcon style={{width:16,height:16,animation:'spin 1s linear infinite'}}/>:<MagnifyingGlassIcon style={{width:16,height:16}}/>}
            {buscandoNome?'Buscando...':'Buscar'}
          </button>
        </div>
      </div>

      {hint && (
        <div style={{background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:9,padding:'10px 16px',marginBottom:14,fontSize:12,color:'#a5b4fc',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <IdentificationIcon style={{width:15,height:15,flexShrink:0}}/>
          {autoSearching && <><ArrowPathIcon style={{width:13,height:13,animation:'spin 1s linear infinite'}}/> Buscando CNPJ de <strong style={{color:'#c4b5fd'}}>{hint}</strong> automaticamente...</>}
          {!autoSearching && autoMsg === 'found' && <><CheckCircleIcon style={{width:13,height:13,color:'#4ade80'}}/> CNPJ encontrado para <strong style={{color:'#c4b5fd'}}>{hint}</strong> — consultando dados...</>}
          {!autoSearching && autoMsg === 'notfound' && <><ExclamationCircleIcon style={{width:13,height:13,color:'#f59e0b'}}/> CNPJ não encontrado automaticamente para <strong style={{color:'#c4b5fd'}}>{hint}</strong> — digite manualmente.</>}
          {!autoSearching && !autoMsg && <>Pesquisando CNPJ de: <strong style={{color:'#c4b5fd'}}>{hint}</strong></>}
        </div>
      )}
      <div style={{background:'var(--bg-secondary)',borderRadius:12,border:'1px solid var(--border)',padding:'20px 22px',marginBottom:20}}>
        <div style={{fontSize:13,fontWeight:800,color:'var(--text-primary)',marginBottom:4}}>Consultar dados completos de um CNPJ</div>
        <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:14}}>
          Digite o CNPJ para obter razão social, endereço, atividade, sócios, capital social e situação cadastral (Receita Federal).
        </div>
        <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:220}}>
            <label style={{fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:.4,marginBottom:5,display:'block'}}>CNPJ</label>
            <input value={cnpj} onChange={e=>handleInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&consultar()}
              placeholder="00.000.000/0001-00" maxLength={18}
              style={{width:'100%',padding:'10px 14px',borderRadius:9,fontSize:15,fontFamily:'monospace',letterSpacing:1,background:'var(--bg-primary)',border:'1px solid var(--border)',color:'var(--text-primary)',outline:'none',boxSizing:'border-box'}}/>
          </div>
          <button onClick={consultar} disabled={loading}
            style={{padding:'10px 24px',borderRadius:9,background:'#0ea5e9',border:'none',cursor:loading?'not-allowed':'pointer',color:'#fff',fontSize:13,fontWeight:800,display:'flex',alignItems:'center',gap:7,opacity:loading?.7:1,height:42}}>
            {loading?<ArrowPathIcon style={{width:16,height:16,animation:'spin 1s linear infinite'}}/>:<IdentificationIcon style={{width:16,height:16}}/>}
            {loading?'Consultando...':'Consultar'}
          </button>
        </div>
        <div style={{marginTop:12,fontSize:11,color:'var(--text-secondary)'}}>
          Dados via <strong>BrasilAPI</strong> (Receita Federal) — gratuito, sem chave de API.
        </div>
      </div>

      {empresa && (
        <CnpjDetalhadoCard d={empresa} onAdd={onAdicionar} added={adicionados.has(empresa.cnpj)} />
      )}

      {!empresa && !loading && (
        <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text-secondary)',background:'var(--bg-secondary)',borderRadius:12,border:'1px dashed var(--border)'}}>
          <IdentificationIcon style={{width:40,height:40,margin:'0 auto 12px',opacity:.25}}/>
          <div style={{fontSize:14,fontWeight:600}}>Digite um CNPJ para consultar</div>
          <div style={{fontSize:12,marginTop:6,maxWidth:360,margin:'8px auto 0'}}>
            Verifique se o fornecedor está ativo, veja o endereço registrado, atividade principal e quadro societário.
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── Aba: Busca por Região ────────────────────────────────────────────────────
// Todo o estado é recebido como props (lifted) para sobreviver à troca de abas
function AbaBusca({
  produto, setProduto, cidade, setCidade, uf, setUf,
  resultado, setResultado, selecionados, setSelecionados,
  onAdicionar, adicionados, onIrParaCnpj, cidades,
}) {
  const [loading, setLoading] = useState(false)
  const inp = { width:'100%', padding:'9px 12px', borderRadius:8, fontSize:13, background:'var(--bg-primary)', border:'1px solid var(--border)', color:'var(--text-primary)', outline:'none', boxSizing:'border-box' }
  const cidadeSugestoes = cidades.map(c => ({ label: c.nome, sub: c.uf, uf: c.uf }))

  async function buscar(produtoOverride) {
    const p = String(produtoOverride || produto || '').trim()
    if (!p) { toast.error('Informe o produto'); return }
    if (!String(cidade || '').trim())  { toast.error('Informe a cidade'); return }
    setLoading(true); setResultado(null); setSelecionados(new Set())
    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { query: p, cidade: String(cidade || '').trim(), uf: uf || undefined },
      })
      if (error) throw new Error(error.message || 'Erro na busca')
      if (data?.error) throw new Error(data.error)
      setResultado({ ...data, produto: String(produto || '').trim(), cidade: String(cidade || '').trim(), uf })
      if ((data?.fornecedores || []).length === 0)
        toast('Nenhum fornecedor encontrado. Tente termos mais genéricos.', { icon: '🔍', duration: 4000 })
    } catch(err) {
      toast.error(err.message || 'Falha na busca')
    } finally { setLoading(false) }
  }

  function toggleSel(id) {
    setSelecionados(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleTodos() {
    const ids = (resultado?.fornecedores || []).map(e => e.id)
    const allSel = ids.length > 0 && ids.every(id => selecionados.has(id))
    setSelecionados(allSel ? new Set() : new Set(ids))
  }
  async function adicionarLote() {
    const items = (resultado?.fornecedores || []).filter(e => selecionados.has(e.id) && !adicionados.has(e.id))
    if (items.length === 0) { toast('Todos já estão na lista'); return }
    for (const emp of items) await onAdicionar(emp)
    setSelecionados(new Set())
  }
  function waLote() {
    const comWa = (resultado?.fornecedores || []).filter(e => selecionados.has(e.id) && waLink(e.telefone))
    if (comWa.length === 0) { toast.error('Nenhum selecionado tem celular para WA'); return }
    toast(`Abrindo ${comWa.length} conversa(s) no WhatsApp...`, { icon: '📱', duration: 3000 })
    comWa.forEach((e, i) => setTimeout(() => window.open(waLink(e.telefone, 'Olá! Gostaria de solicitar uma cotação de preços.'), '_blank'), i * 700))
  }

  const todosIds = (resultado?.fornecedores || []).map(e => e.id)
  const todosSel = todosIds.length > 0 && todosIds.every(id => selecionados.has(id))

  return (
    <div>
      {/* Formulário */}
      <div style={{background:'var(--bg-secondary)',borderRadius:12,border:'1px solid var(--border)',padding:'18px 22px',marginBottom:20}}>
        <div style={{fontSize:13,fontWeight:800,color:'var(--text-primary)',marginBottom:12}}>O que você precisa cotar?</div>
        <div style={{display:'grid',gridTemplateColumns:'2fr 2fr 1fr',gap:10,marginBottom:10}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:.4,marginBottom:5,display:'block'}}>Produto *</label>
            <AutocompleteInput value={produto} onChange={setProduto}
              onSelect={s => setProduto(typeof s === 'string' ? s : s.label)}
              sugestoes={SUGESTOES} placeholder="Ex: Pneus, EPI, Ferramentas..." inputStyle={inp} onEnter={buscar}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:.4,marginBottom:5,display:'block'}}>
              Cidade * {cidades.length === 0 && <span style={{fontSize:10,color:'var(--text-secondary)',fontWeight:400}}>(carregando...)</span>}
            </label>
            <AutocompleteInput value={cidade} onChange={setCidade}
              onSelect={s => { setCidade(s.label); if (s.uf) setUf(s.uf) }}
              sugestoes={cidadeSugestoes} placeholder="Ex: Campo Grande" inputStyle={inp} onEnter={buscar}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:.4,marginBottom:5,display:'block'}}>UF</label>
            <select value={uf} onChange={e=>setUf(e.target.value)}
              style={{width:'100%',padding:'9px 12px',borderRadius:8,fontSize:13,background:'var(--bg-primary)',border:'1px solid var(--border)',color:'var(--text-primary)',outline:'none',boxSizing:'border-box'}}>
              <option value="">Todos</option>
              {ESTADOS.map(e=><option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
          {SUGESTOES.map(s=>(
            <button key={s} onClick={()=>{ setProduto(s); if (cidade.trim()) buscar(s) }}
              style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:produto===s?'#0ea5e9':'rgba(14,165,233,0.08)',border:`1px solid ${produto===s?'#0ea5e9':'rgba(14,165,233,0.2)'}`,cursor:'pointer',color:produto===s?'#fff':'#0ea5e9'}}>
              {s}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <button onClick={() => buscar()} disabled={loading}
            style={{padding:'10px 24px',borderRadius:9,background:'#0ea5e9',border:'none',cursor:loading?'not-allowed':'pointer',color:'#fff',fontSize:13,fontWeight:800,display:'flex',alignItems:'center',gap:7,opacity:loading?.7:1}}>
            {loading?<ArrowPathIcon style={{width:16,height:16,animation:'spin 1s linear infinite'}}/>:<MagnifyingGlassIcon style={{width:16,height:16}}/>}
            {loading?'Buscando...':'Buscar Fornecedores'}
          </button>
          <span style={{fontSize:11,color:'var(--text-secondary)'}}>Google Maps · Serper.dev</span>
        </div>
      </div>

      {/* Toolbar de lote */}
      {selecionados.size > 0 && resultado && (
        <div style={{background:'rgba(14,165,233,0.07)',border:'1.5px solid rgba(14,165,233,0.3)',borderRadius:10,padding:'10px 16px',marginBottom:12,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:13,fontWeight:800,color:'#0ea5e9',marginRight:4}}>{selecionados.size} selecionado(s)</span>
          <button onClick={adicionarLote}
            style={{padding:'6px 14px',borderRadius:7,fontSize:12,fontWeight:700,background:'#0ea5e9',border:'none',cursor:'pointer',color:'#fff',display:'flex',alignItems:'center',gap:5}}>
            <PlusCircleIcon style={{width:14,height:14}}/>Cadastrar Selecionados
          </button>
          <button onClick={waLote}
            style={{padding:'6px 14px',borderRadius:7,fontSize:12,fontWeight:700,background:'rgba(37,211,102,0.1)',border:'1px solid rgba(37,211,102,0.3)',cursor:'pointer',color:'#25d366',display:'flex',alignItems:'center',gap:5}}>
            <ChatBubbleLeftEllipsisIcon style={{width:14,height:14}}/>WA em Lote
          </button>
          <button onClick={()=>setSelecionados(new Set())}
            style={{padding:'6px 10px',borderRadius:7,fontSize:12,background:'transparent',border:'1px solid var(--border)',cursor:'pointer',color:'var(--text-secondary)',marginLeft:'auto'}}>
            Limpar seleção
          </button>
        </div>
      )}

      {/* Resultados */}
      {resultado && resultado.fornecedores.length > 0 && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
            <div style={{fontSize:13,color:'var(--text-secondary)'}}>
              <strong style={{color:'var(--text-primary)'}}>{resultado.total}</strong> fornecedor(es) — <strong style={{color:'#0ea5e9'}}>{resultado.produto}</strong> em <strong style={{color:'#0ea5e9'}}>{resultado.local}</strong>
            </div>
            <button onClick={toggleTodos}
              style={{padding:'5px 12px',borderRadius:7,fontSize:11,fontWeight:700,background:todosSel?'rgba(14,165,233,0.12)':'transparent',border:'1px solid var(--border)',cursor:'pointer',color:todosSel?'#0ea5e9':'var(--text-secondary)',display:'flex',alignItems:'center',gap:5}}>
              <CheckCircleIcon style={{width:13,height:13}}/>{todosSel?'Desmarcar Todos':'Selecionar Todos'}
            </button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {resultado.fornecedores.map(e=>(
              <FornecedorCard key={e.id} e={e} onAdd={onAdicionar} added={adicionados.has(e.id)}
                onConsultarCnpj={onIrParaCnpj}
                selecionado={selecionados.has(e.id)} onToggle={()=>toggleSel(e.id)}/>
            ))}
          </div>
          <LinksExternos produto={resultado.produto} cidade={resultado.cidade} uf={resultado.uf}/>
        </div>
      )}

      {resultado && resultado.fornecedores.length === 0 && (
        <div style={{background:'var(--bg-secondary)',borderRadius:12,border:'1px solid var(--border)',padding:'22px 24px'}}>
          <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:16}}>
            <ExclamationCircleIcon style={{width:22,height:22,color:'#f59e0b',flexShrink:0,marginTop:1}}/>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>Nenhum fornecedor encontrado</div>
              <div style={{fontSize:12,color:'var(--text-secondary)',marginTop:3}}>
                Tente termos mais genéricos (ex: "distribuidora", "atacado"). Use os links abaixo ou consulte o CNPJ diretamente.
              </div>
            </div>
          </div>
          <LinksExternos produto={resultado.produto} cidade={resultado.cidade} uf={resultado.uf}/>
        </div>
      )}

      {!resultado && !loading && (
        <div style={{textAlign:'center',padding:'48px 24px',background:'var(--bg-secondary)',borderRadius:14,border:'1px dashed var(--border)'}}>
          <MagnifyingGlassIcon style={{width:48,height:48,margin:'0 auto 14px',opacity:.25}}/>
          <div style={{fontSize:15,fontWeight:700,color:'var(--text-primary)',marginBottom:8}}>Busque fornecedores por produto e cidade</div>
          <div style={{fontSize:13,color:'var(--text-secondary)',maxWidth:420,margin:'0 auto',lineHeight:1.6}}>
            Resultados via <strong>Google Maps</strong>. Para dados completos (CNPJ, sócios, endereço oficial), use a aba <strong>Consultar CNPJ</strong>.
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
// Estado da aba Busca fica aqui (lifted) para sobreviver quando o usuário troca de aba
export default function ComprasBuscaFornecedor() {
  const { workspaceId } = useStore()
  const [aba, setAba]             = useState('busca')
  const [adicionados, setAdicionados] = useState(new Set())
  const [wsId, setWsId]           = useState(null)
  const [cnpjHint, setCnpjHint]   = useState('')

  // Estado da aba Busca (lifted para preservar ao trocar abas)
  const [bProduto, setBProduto]       = useState('')
  const [bCidade, setBCidade]         = useState('')
  const [bUf, setBUf]                 = useState('')
  const [bResultado, setBResultado]   = useState(null)
  const [bSelecionados, setBSelecionados] = useState(new Set())

  // Cidades IBGE — cached no módulo, carrega uma vez
  const [cidades, setCidades] = useState([])
  useEffect(() => { loadCidades().then(setCidades) }, [])

  async function getWsId() {
    if (wsId) return wsId
    if (workspaceId) { setWsId(workspaceId); return workspaceId }
    return null
  }

  async function handleAdicionar(empresa) {
    const id = await getWsId()
    if (!id) { toast.error('Workspace não identificado'); return }
    const { error } = await supabase.from('fornecedores_compra').insert({
      workspace_id: id,
      nome: empresa.nome,
      cnpj: empresa.cnpj || null,
      telefone: empresa.telefone || null,
      email: empresa.email || null,
      observacoes: empresa.logradouro ? `Endereço: ${empresa.logradouro}` : null,
      ativo: true,
    })
    if (error && !error.message?.includes('duplicate')) { toast.error('Erro: ' + error.message); return }
    setAdicionados(s => new Set([...s, empresa.id || empresa.cnpj]))
    toast.success(`${empresa.nome} adicionado!`)
  }

  function handleCnpjBtn(e) {
    setCnpjHint(e?.nome || '')
    setAba('cnpj')
  }

  const abas = [
    { key: 'busca', label: 'Busca por Região', icon: MapPinIcon },
    { key: 'cnpj',  label: 'Consultar CNPJ',   icon: IdentificationIcon },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="Buscar Fornecedores" subtitle="Descubra fornecedores por região ou consulte CNPJ completo" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {abas.map(a => {
            const I = a.icon
            return (
              <button key={a.key} onClick={() => setAba(a.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'none', border: 'none', borderBottom: aba === a.key ? '2px solid #0ea5e9' : '2px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: aba === a.key ? 800 : 500, color: aba === a.key ? '#0ea5e9' : 'var(--text-secondary)', marginBottom: -1, transition: 'all .15s' }}>
                <I style={{ width: 15, height: 15 }} />
                {a.label}
              </button>
            )
          })}
        </div>
        {aba === 'busca' && (
          <AbaBusca
            produto={bProduto} setProduto={setBProduto}
            cidade={bCidade} setCidade={setBCidade}
            uf={bUf} setUf={setBUf}
            resultado={bResultado} setResultado={setBResultado}
            selecionados={bSelecionados} setSelecionados={setBSelecionados}
            onAdicionar={handleAdicionar} adicionados={adicionados}
            onIrParaCnpj={handleCnpjBtn}
            cidades={cidades}
          />
        )}
        {aba === 'cnpj' && (
          <AbaCnpj onAdicionar={handleAdicionar} adicionados={adicionados} hint={cnpjHint} hintCidade={bCidade} />
        )}
      </div>
    </div>
  )
}
