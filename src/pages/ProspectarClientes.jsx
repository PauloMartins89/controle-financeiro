import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { waLink } from '../lib/utils'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  MagnifyingGlassIcon, MapPinIcon, PhoneIcon, GlobeAltIcon,
  SparklesIcon, XMarkIcon, ArrowTopRightOnSquareIcon,
  ChatBubbleLeftEllipsisIcon, ClipboardDocumentIcon, CheckIcon,
  UserGroupIcon, BriefcaseIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'

// ─── helpers ─────────────────────────────────────────────────────────────────
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
function estrelas(r) {
  if (!r) return null
  const full = Math.round(r)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

const SEGMENTOS = [
  'Construtoras', 'Indústrias', 'Hospitais', 'Clínicas', 'Supermercados',
  'Escolas', 'Transportadoras', 'Hotéis', 'Restaurantes', 'Farmácias',
  'Oficinas mecânicas', 'Escritórios de advocacia', 'Imobiliárias',
  'Academias', 'Salões de beleza', 'Condomínios', 'Postos de combustível',
  'Distribuidoras', 'Frigoríficos', 'Laticínios', 'Metalúrgicas',
  'Gráficas', 'Laboratórios', 'Seguradoras', 'Contabilidades',
]
const SERVICOS = [
  'Manutenção industrial', 'TI e suporte', 'Limpeza e conservação',
  'Segurança patrimonial', 'Consultoria financeira', 'Marketing digital',
  'Contabilidade', 'RH e treinamento', 'Logística e transporte',
  'Alimentação corporativa', 'Uniformes e EPIs', 'Materiais de escritório',
  'Embalagens', 'Combustível', 'Instalações elétricas', 'Hidráulica',
  'Software e sistemas', 'Câmeras e monitoramento', 'Paisagismo',
]
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

// ─── IBGE cities loader ──────────────────────────────────────────────────────
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
    : sugestoes.slice(0, 8)

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      if (open && cursor >= 0 && filtered.length > 0) {
        const sel = filtered[cursor]
        onSelect ? onSelect(sel) : onChange(typeof sel === 'string' ? sel : sel.label)
        setOpen(false)
      } else {
        setOpen(false)
        onEnter?.()
      }
    } else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setCursor(-1); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={inputStyle}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 100, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: 2 }}>
          {filtered.map((s, i) => {
            const label = typeof s === 'string' ? s : s.label
            const sub = typeof s === 'object' ? s.uf : null
            return (
              <div key={i} onMouseDown={() => { onSelect ? onSelect(s) : onChange(label); setOpen(false) }}
                style={{ padding: '8px 12px', cursor: 'pointer', background: i === cursor ? 'var(--bg-secondary)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--text-primary)' }}>{label}</span>
                {sub && <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{sub}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Modal de Proposta ────────────────────────────────────────────────────────
function PropostaModal({ empresa, servico, onClose }) {
  const [msg, setMsg] = useState('')
  const [gerandoIA, setGerandoIA] = useState(false)
  const [copiado, setCopiado] = useState(false)

  // Gera mensagem template ao abrir
  useEffect(() => {
    const cat = empresa.categoria ? `na área de ${empresa.categoria}` : 'no seu segmento'
    const template = `Olá, tudo bem? 😊

Vi que a *${empresa.nome}* atua ${cat} e acredito que posso agregar valor ao seu negócio.

Trabalhamos com *${servico || 'nossa solução'}* e gostaríamos de apresentar como podemos ajudar.

Podemos conversar? 🤝`
    setMsg(template)
  }, [empresa, servico])

  async function gerarComIA() {
    if (!servico?.trim()) { toast.error('Informe o que você oferece para gerar com IA'); return }
    setGerandoIA(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Não autenticado')
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Crie uma mensagem curta de prospecção para WhatsApp, profissional e amigável (máximo 5 linhas), para uma empresa que oferece "${servico}" prospectando a empresa "${empresa.nome}"${empresa.categoria ? ` que atua em "${empresa.categoria}"` : ''}. Use emojis com moderação. Responda APENAS a mensagem, sem explicações.`,
          }],
          context: '',
        }),
      })
      if (!res.ok) throw new Error('Erro na IA')
      const { content } = await res.json()
      setMsg(content || msg)
    } catch {
      toast.error('Não foi possível gerar com IA. Usando modelo padrão.')
    } finally {
      setGerandoIA(false)
    }
  }

  function copiar() {
    navigator.clipboard.writeText(msg).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })
  }

  const waUrl = waLink(empresa.telefone, msg)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Proposta de Contato</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{empresa.nome}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={gerarComIA} disabled={gerandoIA}
              style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {gerandoIA ? <ArrowPathIcon style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <SparklesIcon style={{ width: 13, height: 13 }} />}
              {gerandoIA ? 'Gerando...' : 'Melhorar com IA'}
            </button>
          </div>

          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            rows={8}
            style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '10px 12px', fontSize: 13, resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={copiar}
              style={{ flex: 1, padding: '10px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: copiado ? 'rgba(16,185,129,0.1)' : 'var(--bg-secondary)', border: '1px solid var(--border)', color: copiado ? '#10b981' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {copiado ? <CheckIcon style={{ width: 15, height: 15 }} /> : <ClipboardDocumentIcon style={{ width: 15, height: 15 }} />}
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
            {waUrl ? (
              <a href={waUrl} target="_blank" rel="noreferrer"
                style={{ flex: 2, padding: '10px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)', color: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none' }}>
                <PhoneIcon style={{ width: 15, height: 15 }} />
                Enviar pelo WhatsApp
              </a>
            ) : (
              <div style={{ flex: 2, padding: '10px', borderRadius: 9, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Telefone não disponível
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Card de empresa prospecto ────────────────────────────────────────────────
function ProspectoCard({ e, servico, onProposta }) {
  const navigate = useNavigate()

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Nome + categoria + rating */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#6366f1', flexShrink: 0 }}>
            {(e.nome || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nome}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3, alignItems: 'center' }}>
              {e.categoria && <span style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>{e.categoria}</span>}
              {e.rating && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>{estrelas(e.rating)} {e.rating.toFixed(1)}{e.avaliacoes > 0 && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> ({e.avaliacoes})</span>}</span>}
            </div>
          </div>
        </div>
        {/* Botão Proposta */}
        <button onClick={() => onProposta(e)}
          style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <ChatBubbleLeftEllipsisIcon style={{ width: 13, height: 13 }} />
          Proposta
        </button>
      </div>

      {/* Endereço */}
      {e.endereco && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPinIcon style={{ width: 12, height: 12, flexShrink: 0 }} />
          {e.endereco}
        </div>
      )}

      {/* Contatos */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {e.telefone && (
          <a href={waLink(e.telefone) || '#'} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontWeight: 700 }}>
            <PhoneIcon style={{ width: 12, height: 12 }} />{e.telefone}
          </a>
        )}
        {e.website && (
          <a href={e.website.startsWith('http') ? e.website : `https://${e.website}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
            <GlobeAltIcon style={{ width: 12, height: 12 }} />Site
          </a>
        )}
        {/* Ver CNPJ via Buscar Fornecedor */}
        <button
          onClick={() => navigate(`/compras/cadastros/buscar?hint=${encodeURIComponent(e.nome)}`)}
          style={{ fontSize: 12, color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
          <ArrowTopRightOnSquareIcon style={{ width: 12, height: 12 }} />CNPJ
        </button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ProspectarClientes() {
  const [servico, setServico] = useState('')
  const [segmento, setSegmento] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [cidades, setCidades] = useState([])
  const [loading, setLoading] = useState(false)
  const [resultados, setResultados] = useState(null)
  const [propostaEmpresa, setPropostaEmpresa] = useState(null)

  useEffect(() => { loadCidades().then(setCidades) }, [])

  const cidadesSugestoes = cidade.trim()
    ? cidades.filter(c => norm(c.nome).startsWith(norm(cidade))).slice(0, 10)
      .map(c => ({ label: c.nome, uf: c.uf }))
    : []

  async function buscar() {
    if (!segmento.trim()) { toast.error('Informe o segmento-alvo'); return }
    if (!cidade.trim()) { toast.error('Informe a cidade'); return }
    setLoading(true)
    setResultados(null)
    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { query: segmento.trim(), cidade: cidade.trim(), uf: uf || undefined, prospectMode: true },
      })
      if (error) throw new Error(error.message || 'Erro ao buscar')
      const lista = data?.fornecedores || []
      setResultados(lista)
      if (lista.length === 0) toast('Nenhum resultado encontrado. Tente outro segmento ou cidade.', { icon: '🔍' })
    } catch (err) {
      toast.error(err.message || 'Erro ao buscar prospectos')
    } finally {
      setLoading(false)
    }
  }

  const inpStyle = { padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', width: '100%' }

  return (
    <div>
      <Header title="Prospectar Clientes" subtitle="Encontre empresas para oferecer seu produto ou serviço" />

      <div style={{ padding: '0 24px 32px' }}>

        {/* ── Painel de busca ──────────────────────────────────────────────── */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <UserGroupIcon style={{ width: 18, height: 18, color: '#6366f1' }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Defina sua busca</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {/* O que você oferece */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>O que você oferece *</label>
              <AutocompleteInput
                value={servico}
                onChange={setServico}
                sugestoes={SERVICOS}
                placeholder="Ex: manutenção industrial, TI, EPI..."
                inputStyle={inpStyle}
              />
            </div>

            {/* Segmento alvo */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Segmento-alvo *</label>
              <AutocompleteInput
                value={segmento}
                onChange={setSegmento}
                sugestoes={SEGMENTOS}
                placeholder="Ex: construtoras, hospitais, indústrias..."
                inputStyle={inpStyle}
                onEnter={buscar}
              />
            </div>

            {/* Cidade */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Cidade *</label>
              <AutocompleteInput
                value={cidade}
                onChange={setCidade}
                onSelect={s => { setCidade(s.label); if (s.uf) setUf(s.uf) }}
                sugestoes={cidadesSugestoes}
                placeholder="Ex: São Paulo"
                inputStyle={inpStyle}
                onEnter={buscar}
              />
            </div>

            {/* Estado */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Estado</label>
              <select value={uf} onChange={e => setUf(e.target.value)} style={{ ...inpStyle, cursor: 'pointer' }}>
                <option value="">Todos</option>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={buscar} disabled={loading}
              style={{ padding: '10px 28px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: '#6366f1', color: '#fff', border: 'none', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}>
              {loading
                ? <ArrowPathIcon style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                : <MagnifyingGlassIcon style={{ width: 16, height: 16 }} />}
              {loading ? 'Buscando...' : 'Buscar Prospectos'}
            </button>
          </div>
        </div>

        {/* ── Resultados ───────────────────────────────────────────────────── */}
        {resultados !== null && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <BriefcaseIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {resultados.length} empresa{resultados.length !== 1 ? 's' : ''} encontrada{resultados.length !== 1 ? 's' : ''} em <strong style={{ color: 'var(--text-primary)' }}>{cidade}{uf ? `, ${uf}` : ''}</strong>
              </span>
            </div>

            {resultados.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
                <MagnifyingGlassIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
                <div style={{ fontSize: 14 }}>Nenhum resultado. Tente variar o segmento ou a cidade.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {resultados.map(e => (
                  <ProspectoCard key={e.id || e.nome} e={e} servico={servico} onProposta={setPropostaEmpresa} />
                ))}
              </div>
            )}

            {resultados.length > 0 && (
              <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
                Dados via <strong>Google Maps</strong> (Serper) — resultados aproximados. Clique em "CNPJ" para dados cadastrais completos.
              </p>
            )}
          </div>
        )}

        {/* ── Estado inicial ───────────────────────────────────────────────── */}
        {resultados === null && !loading && (
          <div style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--text-secondary)' }}>
            <SparklesIcon style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.25 }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Encontre seus próximos clientes</div>
            <div style={{ fontSize: 13 }}>Informe o que você oferece, o segmento-alvo e a cidade para descobrir empresas que podem precisar dos seus serviços.</div>
          </div>
        )}
      </div>

      {/* ── Modal de Proposta ─────────────────────────────────────────────── */}
      {propostaEmpresa && (
        <PropostaModal
          empresa={propostaEmpresa}
          servico={servico}
          onClose={() => setPropostaEmpresa(null)}
        />
      )}
    </div>
  )
}
