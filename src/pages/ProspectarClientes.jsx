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
  UserGroupIcon, ArrowPathIcon, PlusCircleIcon, ChevronDownIcon,
  ChevronUpIcon, TrashIcon, FunnelIcon, BookmarkIcon, BookmarkSlashIcon,
  CheckCircleIcon, ClockIcon, XCircleIcon, BriefcaseIcon,
} from '@heroicons/react/24/outline'

// ─── Métodos de venda ─────────────────────────────────────────────────────────
const METODOS = [
  {
    id: 'b2b',
    label: 'B2B Direto',
    emoji: '🏢',
    cor: '#6366f1',
    bg: 'rgba(99,102,241,0.08)',
    border: 'rgba(99,102,241,0.25)',
    descricao: 'Abordagem direta a empresas. Foco no decisor.',
    passos: [
      'Identifique o decisor: diretor, gerente de compras ou operações',
      'Envie proposta personalizada via WhatsApp citando o segmento deles',
      'Ofereça uma reunião de 15 min ou um case de empresa similar',
      'Faça follow-up em 3 dias úteis se não houver resposta',
      'Se positivo, envie proposta formal com ROI estimado',
    ],
    template: (nome, cat, servico) =>
      `Olá! Sou [seu nome], da [sua empresa].\n\nIdentificamos que a *${nome}* atua ${cat ? `em *${cat}*` : 'no setor'} e acreditamos que podemos agregar valor ao negócio de vocês.\n\nTrabalhamos com *${servico || 'nossa solução'}* e atendemos empresas com perfil similar com resultados comprovados.\n\nPodemos agendar uma conversa rápida de 15 min? 📊`,
  },
  {
    id: 'inside_sales',
    label: 'Inside Sales',
    emoji: '📞',
    cor: '#0ea5e9',
    bg: 'rgba(14,165,233,0.08)',
    border: 'rgba(14,165,233,0.25)',
    descricao: 'Venda por telefone/vídeo. Meta: agendar demo.',
    passos: [
      'Ligue no horário comercial (9–11h ou 14–16h)',
      'Peça pelo responsável de compras ou operações',
      'Abertura: "Atendemos empresas do seu segmento e vi que vocês..."',
      'Objetivo da ligação: agendar 20 min de apresentação',
      'Envie WhatsApp de confirmação logo após a ligação',
    ],
    template: (nome, cat, servico) =>
      `Olá! Acabei de ligar para a *${nome}*.\n\nConforme combinado, seguem mais detalhes sobre como podemos ajudar ${cat ? `empresas de *${cat}*` : 'o seu negócio'} com *${servico || 'nossa solução'}*.\n\nAguardo sua confirmação para a apresentação! 🗓️`,
  },
  {
    id: 'social_selling',
    label: 'Social Selling',
    emoji: '📱',
    cor: '#ec4899',
    bg: 'rgba(236,72,153,0.08)',
    border: 'rgba(236,72,153,0.25)',
    descricao: 'Construa relacionamento antes de vender.',
    passos: [
      'Encontre o decisor no LinkedIn pelo nome da empresa',
      'Conecte-se com mensagem de valor — sem vender na primeira',
      'Interaja com 2–3 posts antes de fazer qualquer proposta',
      'Após ~1 semana, envie mensagem com proposta personalizada',
      'Migre para WhatsApp para acelerar o processo',
    ],
    template: (nome, cat, servico) =>
      `Olá! Vi o trabalho da *${nome}* ${cat ? `em *${cat}*` : ''} e fiquei muito impressionado.\n\nTrabalhamos com *${servico || 'nossa solução'}* e tenho ajudado empresas do seu perfil a crescerem. Posso compartilhar algo que acredito que vai te interessar? 🎯`,
  },
  {
    id: 'parceria',
    label: 'Parceria Comercial',
    emoji: '🤝',
    cor: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
    descricao: 'Proposta de parceria ou indicação mútua.',
    passos: [
      'Identifique empresas complementares (não concorrentes diretos)',
      'Proponha parceria de indicação com comissão ou benefício mútuo',
      'Prepare material de apoio para o parceiro apresentar ao cliente',
      'Defina métricas e comissões com clareza desde o início',
      'Revise a parceria a cada 30 dias com dados reais',
    ],
    template: (nome, cat, servico) =>
      `Olá! Tudo bem?\n\nVi que a *${nome}* atende um público muito parecido com o nosso. Trabalhamos com *${servico || 'nossa solução'}* e acredito que uma parceria entre nós poderia gerar resultados para os dois lados.\n\nA ideia seria uma indicação mútua com benefícios claros. Faz sentido conversar? 🤝`,
  },
]

// ─── Status de lead ───────────────────────────────────────────────────────────
const STATUS_LEAD = [
  { id: 'nao_contatado', label: 'Não contatado', cor: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  { id: 'contatado',     label: 'Contatado',     cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  { id: 'negociando',    label: 'Em negociação', cor: '#0ea5e9', bg: 'rgba(14,165,233,0.1)'  },
  { id: 'fechado',       label: 'Fechado ✓',     cor: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  { id: 'recusado',      label: 'Recusado',      cor: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
]

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
const LS_KEY = 'prospectar_grupos'
function loadGrupos() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] } }
function saveGrupos(g) { localStorage.setItem(LS_KEY, JSON.stringify(g)) }

// ─── helpers ─────────────────────────────────────────────────────────────────
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
function estrelas(r) {
  if (!r) return null
  const full = Math.round(r)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

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
function AutocompleteInput({ value, onChange, onSelect, sugestoes, placeholder, style, onEnter }) {
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
        style={style}
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

// ─── Seletor de Método ────────────────────────────────────────────────────────
function MetodoSelector({ metodoAtivo, onChange }) {
  const [guiaAberto, setGuiaAberto] = useState(false)
  const m = METODOS.find(x => x.id === metodoAtivo) || METODOS[0]

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {METODOS.map(met => (
          <button key={met.id} onClick={() => { onChange(met.id); setGuiaAberto(false) }}
            style={{ padding: '8px 14px', borderRadius: 24, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: metodoAtivo === met.id ? met.bg : 'var(--bg-secondary)',
              border: `1.5px solid ${metodoAtivo === met.id ? met.border : 'var(--border)'}`,
              color: metodoAtivo === met.id ? met.cor : 'var(--text-secondary)',
              boxShadow: metodoAtivo === met.id ? `0 0 0 3px ${met.bg}` : 'none',
            }}>
            {met.emoji} {met.label}
          </button>
        ))}
      </div>

      <div style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setGuiaAberto(o => !o)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{m.emoji}</span>
            <div>
              <span style={{ fontWeight: 700, fontSize: 13, color: m.cor }}>{m.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{m.descricao}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontSize: 11 }}>
            <span>Guia de abordagem</span>
            {guiaAberto ? <ChevronUpIcon style={{ width: 14, height: 14 }} /> : <ChevronDownIcon style={{ width: 14, height: 14 }} />}
          </div>
        </div>

        {guiaAberto && (
          <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${m.border}` }}>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {m.passos.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: m.cor, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{p}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Modal de Proposta ────────────────────────────────────────────────────────
function PropostaModal({ empresa, servico, metodoId, onClose }) {
  const metodo = METODOS.find(m => m.id === metodoId) || METODOS[0]
  const [msg, setMsg] = useState(() => metodo.template(empresa.nome, empresa.categoria, servico))
  const [gerandoIA, setGerandoIA] = useState(false)
  const [copiado, setCopiado] = useState(false)

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
            content: `Crie uma mensagem curta de prospecção para WhatsApp usando a estratégia de *${metodo.label}*, profissional e amigável (máximo 5 linhas), para uma empresa que oferece "${servico}" prospectando a empresa "${empresa.nome}"${empresa.categoria ? ` que atua em "${empresa.categoria}"` : ''}. Estilo da mensagem: ${metodo.descricao}. Use emojis com moderação. Responda APENAS a mensagem, sem explicações.`,
          }],
          context: '',
        }),
      })
      if (!res.ok) throw new Error('Erro na IA')
      const { content } = await res.json()
      if (content) setMsg(content)
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 15 }}>{metodo.emoji}</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: metodo.cor }}>{metodo.label}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>Proposta para {empresa.nome}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={gerarComIA} disabled={gerandoIA}
              style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {gerandoIA ? <ArrowPathIcon style={{ width: 13, height: 13 }} /> : <SparklesIcon style={{ width: 13, height: 13 }} />}
              {gerandoIA ? 'Gerando...' : 'Refinar com IA'}
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

// ─── Modal salvar em grupo ────────────────────────────────────────────────────
function SalvarGrupoModal({ empresa, metodoId, servico, segmento, cidade, onClose, onSalvo }) {
  const metodo = METODOS.find(m => m.id === metodoId) || METODOS[0]
  const [grupos, setGrupos] = useState(loadGrupos)
  const [novoNome, setNovoNome] = useState('')
  const [grupoSelecionado, setGrupoSelecionado] = useState('')

  function criarGrupo() {
    if (!novoNome.trim()) { toast.error('Informe um nome para o grupo'); return }
    const novo = { id: uid(), nome: novoNome.trim(), metodo: metodoId, segmento, cidade, servico, criado_em: new Date().toLocaleDateString('pt-BR'), leads: [] }
    const atualizados = [...grupos, novo]
    saveGrupos(atualizados); setGrupos(atualizados); setGrupoSelecionado(novo.id); setNovoNome('')
    toast.success('Grupo criado!')
  }

  function salvarLead() {
    if (!grupoSelecionado) { toast.error('Selecione ou crie um grupo'); return }
    const atualizados = grupos.map(g => {
      if (g.id !== grupoSelecionado) return g
      if (g.leads.some(l => l.nome === empresa.nome)) { toast('Lead já está neste grupo'); return g }
      return { ...g, leads: [...g.leads, { id: uid(), nome: empresa.nome, telefone: empresa.telefone, website: empresa.website, endereco: empresa.endereco, categoria: empresa.categoria, status: 'nao_contatado' }] }
    })
    saveGrupos(atualizados); onSalvo(); onClose(); toast.success('Lead salvo no grupo!')
  }

  const gruposDoMetodo = grupos.filter(g => g.metodo === metodoId)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Salvar em Grupo — {metodo.emoji} {metodo.label}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><XMarkIcon style={{ width: 18, height: 18 }} /></button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Criar novo grupo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && criarGrupo()}
                placeholder={`Ex: ${segmento || 'Segmento'} ${cidade || 'Cidade'} Mai/2026`}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
              <button onClick={criarGrupo} style={{ padding: '8px 12px', borderRadius: 8, background: metodo.bg, border: `1px solid ${metodo.border}`, color: metodo.cor, cursor: 'pointer' }}>
                <PlusCircleIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>

          {gruposDoMetodo.length > 0 && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Ou adicionar a grupo existente</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {gruposDoMetodo.map(g => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${grupoSelecionado === g.id ? metodo.border : 'var(--border)'}`, background: grupoSelecionado === g.id ? metodo.bg : 'var(--bg-secondary)', cursor: 'pointer' }}>
                    <input type="radio" name="grupo" value={g.id} checked={grupoSelecionado === g.id} onChange={() => setGrupoSelecionado(g.id)} style={{ accentColor: metodo.cor }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{g.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{g.leads.length} lead{g.leads.length !== 1 ? 's' : ''} · {g.criado_em}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button onClick={salvarLead} disabled={!grupoSelecionado}
            style={{ padding: '10px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: grupoSelecionado ? metodo.cor : 'var(--bg-secondary)', color: grupoSelecionado ? '#fff' : 'var(--text-secondary)', border: 'none', cursor: grupoSelecionado ? 'pointer' : 'default' }}>
            <BookmarkIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6 }} />
            Salvar Lead
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de empresa prospecto ────────────────────────────────────────────────
function ProspectoCard({ e, servico, metodoId, onProposta, onSalvar, jaNoGrupo }) {
  const navigate = useNavigate()
  const metodo = METODOS.find(m => m.id === metodoId) || METODOS[0]

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, border: `1px solid ${jaNoGrupo ? metodo.border : 'var(--border)'}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
      {jaNoGrupo && <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: metodo.cor }} title="Já salvo em grupo" />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: metodo.bg, border: `1px solid ${metodo.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: metodo.cor, flexShrink: 0 }}>
            {(e.nome || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nome}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
              {e.categoria && <span style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: metodo.bg, color: metodo.cor }}>{e.categoria}</span>}
              {e.rating && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>{estrelas(e.rating)} {e.rating.toFixed(1)}{e.avaliacoes > 0 && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> ({e.avaliacoes})</span>}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onSalvar(e)} title={jaNoGrupo ? 'Já salvo' : 'Salvar em grupo'}
            style={{ padding: '6px 9px', borderRadius: 7, fontSize: 11, background: jaNoGrupo ? metodo.bg : 'var(--bg-primary)', border: `1px solid ${jaNoGrupo ? metodo.border : 'var(--border)'}`, color: jaNoGrupo ? metodo.cor : 'var(--text-secondary)', cursor: 'pointer' }}>
            {jaNoGrupo ? <BookmarkSlashIcon style={{ width: 13, height: 13 }} /> : <BookmarkIcon style={{ width: 13, height: 13 }} />}
          </button>
          <button onClick={() => onProposta(e)}
            style={{ padding: '6px 11px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: metodo.bg, border: `1px solid ${metodo.border}`, color: metodo.cor, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChatBubbleLeftEllipsisIcon style={{ width: 12, height: 12 }} />Proposta
          </button>
        </div>
      </div>

      {e.endereco && <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><MapPinIcon style={{ width: 11, height: 11, flexShrink: 0 }} />{e.endereco}</div>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {e.telefone && <a href={waLink(e.telefone) || '#'} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontWeight: 700 }}><PhoneIcon style={{ width: 11, height: 11 }} />{e.telefone}</a>}
        {e.website && <a href={e.website.startsWith('http') ? e.website : `https://${e.website}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}><GlobeAltIcon style={{ width: 11, height: 11 }} />Site</a>}
        <button onClick={() => navigate(`/compras/cadastros/buscar?hint=${encodeURIComponent(e.nome)}`)}
          style={{ fontSize: 12, color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
          <ArrowTopRightOnSquareIcon style={{ width: 11, height: 11 }} />CNPJ
        </button>
      </div>
    </div>
  )
}

// ─── Aba Grupos ────────────────────────────────────────────────────────────────
function AbaGrupos() {
  const [grupos, setGrupos] = useState(loadGrupos)
  const [grupoAberto, setGrupoAberto] = useState(null)
  const [filtroMetodo, setFiltroMetodo] = useState('todos')

  function deletarGrupo(id) {
    if (!confirm('Deletar este grupo e todos os leads?')) return
    const atualizado = grupos.filter(g => g.id !== id)
    saveGrupos(atualizado); setGrupos(atualizado)
    if (grupoAberto === id) setGrupoAberto(null)
  }

  function atualizarStatus(grupoId, leadId, novoStatus) {
    const atualizado = grupos.map(g => g.id !== grupoId ? g : { ...g, leads: g.leads.map(l => l.id !== leadId ? l : { ...l, status: novoStatus }) })
    saveGrupos(atualizado); setGrupos(atualizado)
  }

  function removerLead(grupoId, leadId) {
    const atualizado = grupos.map(g => g.id !== grupoId ? g : { ...g, leads: g.leads.filter(l => l.id !== leadId) })
    saveGrupos(atualizado); setGrupos(atualizado)
  }

  const gruposFiltrados = filtroMetodo === 'todos' ? grupos : grupos.filter(g => g.metodo === filtroMetodo)

  if (grupos.length === 0) return (
    <div style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--text-secondary)' }}>
      <UserGroupIcon style={{ width: 48, height: 48, margin: '0 auto 14px', opacity: 0.2 }} />
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nenhum grupo ainda</div>
      <div style={{ fontSize: 13 }}>Faça uma busca e salve prospectos em grupos por método de venda.</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setFiltroMetodo('todos')}
          style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: `1.5px solid ${filtroMetodo === 'todos' ? 'var(--text-primary)' : 'var(--border)'}`, background: filtroMetodo === 'todos' ? 'var(--text-primary)' : 'transparent', color: filtroMetodo === 'todos' ? 'var(--bg-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
          Todos ({grupos.length})
        </button>
        {METODOS.filter(m => grupos.some(g => g.metodo === m.id)).map(m => (
          <button key={m.id} onClick={() => setFiltroMetodo(m.id)}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: `1.5px solid ${filtroMetodo === m.id ? m.border : 'var(--border)'}`, background: filtroMetodo === m.id ? m.bg : 'transparent', color: filtroMetodo === m.id ? m.cor : 'var(--text-secondary)', cursor: 'pointer' }}>
            {m.emoji} {m.label} ({grupos.filter(g => g.metodo === m.id).length})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {gruposFiltrados.map(grupo => {
          const m = METODOS.find(x => x.id === grupo.metodo) || METODOS[0]
          const aberto = grupoAberto === grupo.id
          const contagemStatus = STATUS_LEAD.map(s => ({ ...s, count: grupo.leads.filter(l => l.status === s.id).length }))
          const totalLeads = grupo.leads.length

          return (
            <div key={grupo.id} style={{ background: 'var(--bg-secondary)', border: `1px solid ${aberto ? m.border : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: aberto ? m.bg : 'transparent' }}
                onClick={() => setGrupoAberto(aberto ? null : grupo.id)}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 18 }}>{m.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grupo.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      <span style={{ color: m.cor, fontWeight: 600 }}>{m.label}</span>
                      {' · '}{totalLeads} lead{totalLeads !== 1 ? 's' : ''}
                      {' · '}{grupo.criado_em}
                      {grupo.cidade && ` · ${grupo.cidade}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginRight: 10 }}>
                  {contagemStatus.filter(s => s.count > 0).map(s => (
                    <span key={s.id} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.cor }}>{s.count}</span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={ev => { ev.stopPropagation(); deletarGrupo(grupo.id) }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
                    <TrashIcon style={{ width: 14, height: 14 }} />
                  </button>
                  {aberto ? <ChevronUpIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} /> : <ChevronDownIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />}
                </div>
              </div>

              {aberto && (
                <div style={{ borderTop: `1px solid ${m.border}` }}>
                  {grupo.leads.length === 0
                    ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum lead neste grupo ainda.</div>
                    : <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {grupo.leads.map(lead => {
                          const st = STATUS_LEAD.find(s => s.id === lead.status) || STATUS_LEAD[0]
                          return (
                            <div key={lead.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: 9, border: '1px solid var(--border)' }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: m.bg, color: m.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                                {(lead.nome || '?').charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.nome}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{lead.categoria && <span>{lead.categoria} · </span>}{lead.telefone}</div>
                              </div>
                              <select value={lead.status} onChange={e => atualizarStatus(grupo.id, lead.id, e.target.value)}
                                style={{ padding: '4px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: `1.5px solid ${st.cor}`, background: st.bg, color: st.cor, cursor: 'pointer', outline: 'none' }}>
                                {STATUS_LEAD.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                              </select>
                              {lead.telefone && (
                                <a href={waLink(lead.telefone) || '#'} target="_blank" rel="noreferrer"
                                  style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#22c55e', textDecoration: 'none', flexShrink: 0 }}>
                                  <PhoneIcon style={{ width: 12, height: 12 }} />
                                </a>
                              )}
                              <button onClick={() => removerLead(grupo.id, lead.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                                <XMarkIcon style={{ width: 14, height: 14 }} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ProspectarClientes() {
  const [aba, setAba] = useState('buscar')
  const [servico, setServico] = useState('')
  const [segmento, setSegmento] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [cidades, setCidades] = useState([])
  const [metodoAtivo, setMetodoAtivo] = useState('b2b')
  const [loading, setLoading] = useState(false)
  const [resultados, setResultados] = useState(null)
  const [propostaEmpresa, setPropostaEmpresa] = useState(null)
  const [salvarEmpresa, setSalvarEmpresa] = useState(null)
  const [leadsNomes, setLeadsNomes] = useState(() => new Set(loadGrupos().flatMap(g => g.leads.map(l => l.nome))))

  useEffect(() => { loadCidades().then(setCidades) }, [])

  function refreshLeadsNomes() {
    setLeadsNomes(new Set(loadGrupos().flatMap(g => g.leads.map(l => l.nome))))
  }

  const cidadesSugestoes = cidade.trim()
    ? cidades.filter(c => norm(c.nome).startsWith(norm(cidade))).slice(0, 10)
      .map(c => ({ label: c.nome, uf: c.uf }))
    : []

  async function buscar() {
    if (!segmento.trim()) { toast.error('Informe o segmento-alvo'); return }
    if (!cidade.trim()) { toast.error('Informe a cidade'); return }
    setLoading(true); setResultados(null)
    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { query: segmento.trim(), cidade: cidade.trim(), uf: uf || undefined, prospectMode: true },
      })
      if (error) throw new Error(error.message || 'Erro ao buscar')
      const lista = data?.fornecedores || []
      setResultados(lista)
      if (lista.length === 0) toast('Nenhum resultado. Tente outro segmento ou cidade.', { icon: '🔍' })
    } catch (err) { toast.error(err.message || 'Erro ao buscar') }
    finally { setLoading(false) }
  }

  const inpStyle = { padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', width: '100%' }
  const totalGrupos = loadGrupos().length
  const metodoAtual = METODOS.find(m => m.id === metodoAtivo) || METODOS[0]

  return (
    <div>
      <Header title="Prospectar Clientes" subtitle="Encontre empresas e aplique sua estratégia de venda" />

      <div style={{ padding: '0 24px 32px' }}>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
          {[
            { id: 'buscar', label: '🔍 Buscar Prospectos' },
            { id: 'grupos', label: `📁 Grupos${totalGrupos > 0 ? ` (${totalGrupos})` : ''}` },
          ].map(t => (
            <button key={t.id} onClick={() => setAba(t.id)}
              style={{ padding: '10px 18px', fontSize: 13, fontWeight: aba === t.id ? 700 : 500, color: aba === t.id ? 'var(--text-primary)' : 'var(--text-secondary)', background: 'none', border: 'none', borderBottom: `2px solid ${aba === t.id ? '#6366f1' : 'transparent'}`, cursor: 'pointer', marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Aba Buscar */}
        {aba === 'buscar' && (
          <>
            <MetodoSelector metodoAtivo={metodoAtivo} onChange={setMetodoAtivo} />

            <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>O que você oferece *</label>
                  <AutocompleteInput value={servico} onChange={setServico} sugestoes={SERVICOS} placeholder="Ex: manutenção industrial, TI, EPI..." style={inpStyle} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Segmento-alvo *</label>
                  <AutocompleteInput value={segmento} onChange={setSegmento} sugestoes={SEGMENTOS} placeholder="Ex: construtoras, hospitais..." style={inpStyle} onEnter={buscar} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Cidade *</label>
                  <AutocompleteInput value={cidade} onChange={setCidade} onSelect={s => { setCidade(s.label); if (s.uf) setUf(s.uf) }} sugestoes={cidadesSugestoes} placeholder="Ex: São Paulo" style={inpStyle} onEnter={buscar} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>Estado</label>
                  <select value={uf} onChange={e => setUf(e.target.value)} style={{ ...inpStyle, cursor: 'pointer' }}>
                    <option value="">Todos</option>
                    {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={buscar} disabled={loading}
                  style={{ padding: '10px 28px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: metodoAtual.cor, color: '#fff', border: 'none', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}>
                  {loading ? <ArrowPathIcon style={{ width: 16, height: 16 }} /> : <MagnifyingGlassIcon style={{ width: 16, height: 16 }} />}
                  {loading ? 'Buscando...' : 'Buscar Prospectos'}
                </button>
              </div>
            </div>

            {resultados !== null && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <FunnelIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{resultados.length}</strong> empresa{resultados.length !== 1 ? 's' : ''} em{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{cidade}{uf ? `, ${uf}` : ''}</strong>
                    <span style={{ marginLeft: 8, color: metodoAtual.cor, fontWeight: 600 }}>· {metodoAtual.emoji} {metodoAtual.label}</span>
                  </span>
                </div>
                {resultados.length === 0
                  ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum resultado. Tente outro segmento ou cidade.</div>
                  : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
                      {resultados.map(e => (
                        <ProspectoCard key={e.id || e.nome} e={e} servico={servico} metodoId={metodoAtivo}
                          onProposta={setPropostaEmpresa}
                          onSalvar={setSalvarEmpresa}
                          jaNoGrupo={leadsNomes.has(e.nome)} />
                      ))}
                    </div>
                }
                {resultados.length > 0 && (
                  <p style={{ marginTop: 14, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
                    Dados via <strong>Google Maps</strong> (Serper). Use "CNPJ" para dados cadastrais completos.
                  </p>
                )}
              </div>
            )}

            {resultados === null && !loading && (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
                <SparklesIcon style={{ width: 44, height: 44, margin: '0 auto 14px', opacity: 0.2 }} />
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Encontre seus próximos clientes</div>
                <div style={{ fontSize: 13 }}>Escolha o método de venda, defina o segmento-alvo e a cidade.</div>
              </div>
            )}
          </>
        )}

        {/* Aba Grupos */}
        {aba === 'grupos' && <AbaGrupos />}
      </div>

      {propostaEmpresa && (
        <PropostaModal empresa={propostaEmpresa} servico={servico} metodoId={metodoAtivo} onClose={() => setPropostaEmpresa(null)} />
      )}
      {salvarEmpresa && (
        <SalvarGrupoModal empresa={salvarEmpresa} metodoId={metodoAtivo} servico={servico} segmento={segmento} cidade={cidade}
          onClose={() => setSalvarEmpresa(null)} onSalvo={refreshLeadsNomes} />
      )}
    </div>
  )
}
