// src/pages/RadarComercial.jsx
// Radar Inteligente de Decisores — Motor de Prospecção Comercial SmartPro

import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { waLink } from '../lib/utils'
import {
  MagnifyingGlassIcon, MapPinIcon, PhoneIcon, GlobeAltIcon,
  SparklesIcon, XMarkIcon, ArrowTopRightOnSquareIcon,
  ChatBubbleLeftEllipsisIcon, ClipboardDocumentIcon, CheckIcon,
  UserGroupIcon, ArrowPathIcon, PlusIcon, ChevronDownIcon,
  ChevronUpIcon, BuildingOffice2Icon, EnvelopeIcon, BriefcaseIcon,
  ClockIcon, CheckCircleIcon, FireIcon, BoltIcon,
  ChevronRightIcon, TrashIcon, PencilIcon, DocumentTextIcon,
  TagIcon, PhoneArrowUpRightIcon, StarIcon, SignalIcon,
  ExclamationCircleIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { FireIcon as FireSolid } from '@heroicons/react/24/solid'

// ─── Constantes ───────────────────────────────────────────────────────────────
const PIPELINE_STATUS = [
  { id: 'novo',               label: 'Novo',                cor: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  { id: 'nao_analisado',      label: 'Não analisado',       cor: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
  { id: 'enriquecido',        label: 'Enriquecido',         cor: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  { id: 'contato_encontrado', label: 'Contato encontrado',  cor: '#0ea5e9', bg: 'rgba(14,165,233,0.12)'  },
  { id: 'wa_enviado',         label: 'WhatsApp enviado',    cor: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  { id: 'email_enviado',      label: 'E-mail enviado',      cor: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   },
  { id: 'ligacao',            label: 'Ligação realizada',   cor: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { id: 'reuniao_agendada',   label: 'Reunião agendada',    cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  { id: 'em_negociacao',      label: 'Em negociação',       cor: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  { id: 'cliente_potencial',  label: 'Cliente potencial',   cor: '#14b8a6', bg: 'rgba(20,184,166,0.12)'  },
  { id: 'convertido',         label: 'Convertido ✓',        cor: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  { id: 'sem_interesse',      label: 'Sem interesse',       cor: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
]

const CARGO_ALTA = [
  'sócio', 'socio', 'diretor', 'proprietário', 'proprietario',
  'ceo', 'coo', 'cfo', 'cto', 'presidente', 'vice-presidente',
  'gerente operacional', 'gerente de frota', 'gerente de operações',
  'coordenador operacional', 'gerente de manutenção', 'coordenador de campo',
  'administrador', 'sócio-administrador', 'socio-administrador',
]
const CARGO_MEDIA = [
  'comprador', 'analista de compras', 'supervisor', 'administrativo',
  'pcp', 'almoxarifado', 'gestor', 'gerente', 'coordenador',
  'responsável', 'responsavel', 'encarregado', 'chefe',
  'analista', 'assistente de compras',
]

const CNAE_PRODUTOS = [
  { keywords: ['floresta', 'madeira', 'celulose', 'papel', 'reflorestamento', 'lenha'],           produtos: ['Apontamento de Máquinas', 'Controle de Refeições', 'Gestão de Frente', 'Compras'], icone: '🌲' },
  { keywords: ['construção', 'civil', 'obra', 'edificação', 'engenharia', 'pavimento'],            produtos: ['Controle de Refeições', 'Apontamento de Máquinas', 'Compras', 'Financeiro'], icone: '🏗️' },
  { keywords: ['mineração', 'mineracao', 'minério', 'extração', 'pedreira'],                       produtos: ['Apontamento de Máquinas', 'Controle de Refeições', 'Gestão Operacional', 'Compras'], icone: '⛏️' },
  { keywords: ['agropecuária', 'agropecuaria', 'agricultura', 'lavoura', 'pecuária', 'grão', 'soja', 'milho', 'cana', 'fazenda', 'rural'], produtos: ['Apontamento de Máquinas', 'Controle de Refeições', 'Financeiro', 'Compras'], icone: '🌾' },
  { keywords: ['transporte', 'logística', 'logistica', 'frete', 'carga', 'caminhão', 'distribui'], produtos: ['Controle de Frota', 'Refeições Corporativas', 'Financeiro', 'Compras'], icone: '🚛' },
  { keywords: ['indústria', 'industria', 'industrial', 'fabricação', 'metalurgia', 'manufatura', 'usinagem'], produtos: ['Controle de Refeições', 'Compras', 'Gestão de Manutenção', 'Financeiro'], icone: '🏭' },
  { keywords: ['hospital', 'clínica', 'clinica', 'saúde', 'saude', 'médic', 'farmácia', 'laborat'], produtos: ['Controle de Refeições', 'Compras', 'Financeiro', 'Gestão de Equipes'], icone: '🏥' },
  { keywords: ['hotel', 'pousada', 'resort', 'hospedagem', 'turismo'],                             produtos: ['Controle de Refeições', 'Financeiro', 'Compras', 'Gestão de Equipes'], icone: '🏨' },
  { keywords: ['supermercado', 'varejo', 'mercado', 'loja', 'comércio', 'comercio'],               produtos: ['Financeiro', 'Compras', 'Controle de Estoque', 'Gestão de Equipes'], icone: '🛒' },
  { keywords: ['escola', 'colégio', 'colegio', 'universidade', 'educação', 'educacao', 'ensino'],  produtos: ['Controle de Refeições', 'Financeiro', 'Compras'], icone: '🏫' },
]

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const LS_RADAR = 'radar_comercial_v1'

// ─── Utilitários ───────────────────────────────────────────────────────────────
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

function loadRadar() {
  try { return JSON.parse(localStorage.getItem(LS_RADAR) || '{}') } catch { return {} }
}
function saveRadar(data) { localStorage.setItem(LS_RADAR, JSON.stringify(data)) }
function getEmpresaData(cnpj) { const r = loadRadar(); return r[cnpj] || { contatos: [], timeline: [], pipeline: 'novo' } }
function saveEmpresaData(cnpj, data) { const r = loadRadar(); r[cnpj] = data; saveRadar(r) }

function scoreCargo(cargo) {
  const c = norm(cargo)
  if (CARGO_ALTA.some(k => c.includes(k))) return { score: 92, nivel: 'Alta', cor: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' }
  if (CARGO_MEDIA.some(k => c.includes(k))) return { score: 60, nivel: 'Média', cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' }
  return { score: 28, nivel: 'Baixa', cor: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' }
}

function detectProdutos(cnae) {
  const c = norm(cnae)
  for (const entry of CNAE_PRODUTOS) {
    if (entry.keywords.some(k => c.includes(k))) return entry.produtos
  }
  return ['Financeiro', 'Compras', 'Gestão de Equipes']
}

function formatCnpj(s) {
  const d = (s || '').replace(/\D/g, '')
  if (d.length !== 14) return s
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function formatTel(t) {
  const d = (t || '').replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return t
}

function gerarTemplateWa(empresa, contato, produtos) {
  const nome = contato?.nome ? `, ${contato.nome.split(' ')[0]}` : ''
  const prod = produtos?.[0] || 'nossas soluções'
  return `Olá${nome}! 👋\n\nTudo bem? Meu nome é [SEU NOME] e atuo na área comercial da SmartPro.\n\nIdentifiquei a *${empresa.razao_social || empresa.nome_fantasia}* como uma empresa com perfil para se beneficiar da nossa solução de *${prod}* — desenvolvida especialmente para o segmento de ${empresa.cnae_fiscal_descricao || 'sua área de atuação'}.\n\nPoderia reservar 15 minutinhos para uma conversa rápida? 🤝\n\n_SmartPro — Tecnologia que transforma operação em resultado._`
}

function gerarEmailTemplete(empresa, produtos) {
  const prod = produtos?.[0] || 'Gestão Operacional'
  return {
    assunto: `SmartPro + ${empresa.razao_social || empresa.nome_fantasia} — Solução de ${prod}`,
    corpo: `Prezado(a) gestor(a),\n\nO meu nome é [SEU NOME] e represento a SmartPro, especializada em soluções de ${produtos.slice(0,2).join(' e ')} para empresas do segmento de ${empresa.cnae_fiscal_descricao || 'sua área'}.\n\nIdentificamos que a ${empresa.razao_social || empresa.nome_fantasia} possui perfil compatível com nossa solução e gostaríamos de apresentar como podemos contribuir para sua operação.\n\nPosso agendar uma demonstração rápida de 20 minutos esta semana?\n\nAtt,\n[SEU NOME]\nSmartPro Comercial`,
  }
}

function gerarScript(empresa, contato, produtos) {
  const cargo = contato?.cargo || 'gestor(a)'
  const prod = produtos?.[0] || 'nossa solução'
  return `📞 SCRIPT DE LIGAÇÃO\n\n• Cumprimento:\n"Bom dia! Posso falar com o(a) ${cargo}? Meu nome é [NOME], sou da SmartPro."\n\n• Apresentação (30 seg):\n"Somos uma plataforma de gestão operacional usada por empresas de ${empresa.cnae_fiscal_descricao || 'seu segmento'} como a ${empresa.razao_social || empresa.nome_fantasia}. Trabalhamos com ${prod}."\n\n• Gancho:\n"Tenho visto empresas similares reduzirem custos em até 15% com nosso módulo. Você tem 10 minutinhos para eu explicar como?"\n\n• Objeção — Sem tempo:\n"Entendo! Posso enviar um resumo rápido por WhatsApp e você olha quando tiver um momento?"\n\n• Fechamento:\n"Ótimo! Posso agendar uma demonstração rápida para [DIA/HORA]? Será só 20 minutos."`
}

// ─── Componente: Badge de relevância ─────────────────────────────────────────
function RelevanceBadge({ nivel }) {
  const s = scoreCargo(nivel === 'Alta' ? 'sócio' : nivel === 'Média' ? 'comprador' : 'outro')
  return (
    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.cor, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {nivel === 'Alta' ? '🔥' : nivel === 'Média' ? '⚡' : '·'} {nivel}
    </span>
  )
}

// ─── Componente: StatusChip ────────────────────────────────────────────────────
function StatusChip({ status, onChange, size = 'sm' }) {
  const s = PIPELINE_STATUS.find(x => x.id === status) || PIPELINE_STATUS[0]
  const pad = size === 'sm' ? '3px 10px' : '5px 14px'
  const fs = size === 'sm' ? 11 : 12
  return (
    <select value={status} onChange={e => onChange?.(e.target.value)}
      style={{ padding: pad, borderRadius: 20, fontSize: fs, fontWeight: 700, border: `1.5px solid ${s.cor}`, background: s.bg, color: s.cor, cursor: 'pointer', outline: 'none', appearance: 'none', paddingRight: 20, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24'%3E%3Cpath fill='${encodeURIComponent(s.cor)}' d='m7 10 5 5 5-5z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 5px center' }}>
      {PIPELINE_STATUS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  )
}

// ─── Componente: Modal Adicionar Contato ──────────────────────────────────────
function AdicionarContatoModal({ onClose, onSalvar }) {
  const [form, setForm] = useState({ nome: '', cargo: '', area: '', telefone: '', email: '', linkedin: '', obs: '' })
  const s = form.cargo ? scoreCargo(form.cargo) : null

  function salvar() {
    if (!form.nome.trim()) { toast.error('Informe o nome do contato'); return }
    onSalvar({ ...form, id: uid(), fonte: 'manual', status: 'novo', criado_em: new Date().toISOString() })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Adicionar Contato</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><XMarkIcon style={{ width: 18, height: 18 }} /></button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { k: 'nome', label: 'Nome *', placeholder: 'Nome completo' },
            { k: 'cargo', label: 'Cargo', placeholder: 'Ex: Diretor de Operações' },
            { k: 'area', label: 'Área', placeholder: 'Ex: Operações, Compras, TI' },
            { k: 'telefone', label: 'Telefone', placeholder: '(00) 00000-0000' },
            { k: 'email', label: 'E-mail', placeholder: 'email@empresa.com.br' },
            { k: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/nome' },
          ].map(({ k, label, placeholder }) => (
            <div key={k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
                {k === 'cargo' && s && <RelevanceBadge nivel={s.nivel} />}
              </div>
              <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Observações</label>
            <textarea value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))} rows={2}
              placeholder="Notas sobre este contato..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <button onClick={salvar} className="btn-primary" style={{ marginTop: 4 }}>
            Salvar Contato
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente: Painel IA ─────────────────────────────────────────────────────
function PainelIA({ empresa, contato, produtos, onUseTemplate }) {
  const [aba, setAba] = useState('wa')
  const [gerandoIA, setGerandoIA] = useState(false)
  const [textoWa, setTextoWa] = useState(() => gerarTemplateWa(empresa, contato, produtos))
  const [textoEmail, setTextoEmail] = useState(() => gerarEmailTemplete(empresa, produtos))
  const [textoScript, setTextoScript] = useState(() => gerarScript(empresa, contato, produtos))
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    setTextoWa(gerarTemplateWa(empresa, contato, produtos))
    setTextoEmail(gerarEmailTemplete(empresa, produtos))
    setTextoScript(gerarScript(empresa, contato, produtos))
  }, [empresa?.cnpj, contato?.id])

  async function refinarComIA() {
    setGerandoIA(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Não autenticado')
      const nomeEmp = empresa.razao_social || empresa.nome_fantasia || ''
      const cnae = empresa.cnae_fiscal_descricao || ''
      const contatoInfo = contato ? `Contato: ${contato.nome}, cargo: ${contato.cargo}` : ''
      const prompt = aba === 'wa'
        ? `Crie uma mensagem de prospecção para WhatsApp, profissional e amigável (máximo 6 linhas), para a empresa "${nomeEmp}" que atua em "${cnae}". ${contatoInfo}. Produto a oferecer: ${produtos?.[0] || 'solução SmartPro'}. Use emojis com moderação. Responda APENAS a mensagem.`
        : aba === 'email'
        ? `Crie um e-mail de prospecção profissional e direto para a empresa "${nomeEmp}" que atua em "${cnae}". ${contatoInfo}. Produto: ${produtos?.[0]}. Formato: Assunto: [assunto]\n\n[corpo]. Responda APENAS o e-mail.`
        : `Crie um script de ligação de prospecção para a empresa "${nomeEmp}" (${cnae}). ${contatoInfo}. Produto: ${produtos?.[0]}. Inclua cumprimento, apresentação, gancho, resposta a objeções e fechamento.`

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], context: '' }),
      })
      if (!res.ok) throw new Error('Erro na IA')
      const { content } = await res.json()
      if (!content) throw new Error('Resposta vazia')
      if (aba === 'wa') setTextoWa(content)
      else if (aba === 'email') {
        const [subj, ...rest] = content.split('\n')
        const assunto = subj.replace(/^assunto:\s*/i, '').trim()
        setTextoEmail({ assunto, corpo: rest.join('\n').trim() })
      } else setTextoScript(content)
      toast.success('Refinado com IA!')
    } catch {
      toast.error('IA indisponível. Usando template padrão.')
    } finally {
      setGerandoIA(false)
    }
  }

  function copiar() {
    const txt = aba === 'wa' ? textoWa : aba === 'email' ? `Assunto: ${textoEmail.assunto}\n\n${textoEmail.corpo}` : textoScript
    navigator.clipboard.writeText(txt).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })
  }

  const abas = [
    { id: 'wa', label: 'WhatsApp', icon: <PhoneArrowUpRightIcon style={{ width: 13, height: 13 }} /> },
    { id: 'email', label: 'E-mail', icon: <EnvelopeIcon style={{ width: 13, height: 13 }} /> },
    { id: 'script', label: 'Script Ligação', icon: <DocumentTextIcon style={{ width: 13, height: 13 }} /> },
    { id: 'produto', label: 'Produtos', icon: <TagIcon style={{ width: 13, height: 13 }} /> },
  ]

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <SparklesIcon style={{ width: 16, height: 16, color: '#a78bfa' }} />
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>Sugestões de Abordagem — IA</span>
          {contato && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>para {contato.nome?.split(' ')[0]}</span>}
        </div>
        <button onClick={refinarComIA} disabled={gerandoIA}
          style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          {gerandoIA ? <ArrowPathIcon style={{ width: 12, height: 12 }} /> : <SparklesIcon style={{ width: 12, height: 12 }} />}
          {gerandoIA ? 'Gerando...' : 'Refinar com IA'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            style={{ padding: '9px 14px', fontSize: 12, fontWeight: aba === a.id ? 700 : 500, color: aba === a.id ? '#a78bfa' : 'var(--text-secondary)', background: aba === a.id ? 'rgba(167,139,250,0.08)' : 'transparent', border: 'none', borderBottom: `2px solid ${aba === a.id ? '#a78bfa' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
            {a.icon}{a.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '14px 16px' }}>
        {aba === 'produto' ? (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Produtos recomendados para <strong style={{ color: 'var(--text-primary)' }}>{empresa.cnae_fiscal_descricao || 'este segmento'}</strong>:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {produtos.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p}</span>
                  {i === 0 && <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>Principal</span>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)' }}>
              <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 4 }}>💡 Dica de posicionamento</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Inicie sempre pelo produto de maior ROI percebido no segmento. Para {empresa.cnae_fiscal_descricao || 'este setor'}, o <strong>{produtos[0]}</strong> costuma gerar engajamento mais rápido.
              </div>
            </div>
          </div>
        ) : aba === 'email' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>ASSUNTO</label>
              <input value={textoEmail.assunto} onChange={e => setTextoEmail(t => ({ ...t, assunto: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>CORPO</label>
              <textarea value={textoEmail.corpo} onChange={e => setTextoEmail(t => ({ ...t, corpo: e.target.value }))} rows={8}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }} />
            </div>
          </div>
        ) : (
          <textarea
            value={aba === 'wa' ? textoWa : textoScript}
            onChange={e => aba === 'wa' ? setTextoWa(e.target.value) : setTextoScript(e.target.value)}
            rows={aba === 'script' ? 14 : 8}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }}
          />
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={copiar}
            style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: copiado ? 'rgba(16,185,129,0.1)' : 'var(--bg-primary)', border: '1px solid var(--border)', color: copiado ? '#10b981' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            {copiado ? <CheckIcon style={{ width: 13, height: 13 }} /> : <ClipboardDocumentIcon style={{ width: 13, height: 13 }} />}
            {copiado ? 'Copiado!' : 'Copiar'}
          </button>
          {aba === 'wa' && contato?.telefone && (
            <a href={waLink(contato.telefone, textoWa)} target="_blank" rel="noreferrer"
              style={{ flex: 2, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#22c55e', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <PhoneIcon style={{ width: 13, height: 13 }} /> Enviar WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Componente: Tabela de Contatos ────────────────────────────────────────────
function TabelaContatos({ contatos, onStatusChange, onEditar, onDeletar, onSelecionar, contatoSelecionado, onEnriquecer, enrichendo }) {
  if (contatos.length === 0) return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
      <UserGroupIcon style={{ width: 40, height: 40, margin: '0 auto 10px', opacity: 0.2 }} />
      <div style={{ fontSize: 13, fontWeight: 600 }}>Nenhum contato encontrado</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>Adicione contatos manualmente ou aguarde a extração do QSA.</div>
    </div>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Nome / Cargo', 'Relevância', 'Telefone', 'E-mail', 'Fonte', 'Status', 'Ações'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap', background: 'var(--bg-secondary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contatos.map(c => {
            const sc = scoreCargo(c.cargo || c.nivel || '')
            const selecionado = contatoSelecionado?.id === c.id
            const st = PIPELINE_STATUS.find(p => p.id === c.status) || PIPELINE_STATUS[0]
            return (
              <tr key={c.id}
                onClick={() => onSelecionar(selecionado ? null : c)}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selecionado ? 'rgba(99,102,241,0.06)' : 'transparent', transition: 'background 0.15s' }}>
                <td style={{ padding: '10px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: sc.bg, border: `1px solid ${sc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: sc.cor, flexShrink: 0 }}>
                      {(c.nome || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{c.nome}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{c.cargo || '—'}{c.area ? ` · ${c.area}` : ''}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 10px' }}>
                  <RelevanceBadge nivel={sc.nivel} />
                </td>
                <td style={{ padding: '10px 10px' }}>
                  {c.telefone
                    ? <a href={waLink(c.telefone) || '#'} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        style={{ color: '#22c55e', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <PhoneIcon style={{ width: 11, height: 11 }} />{formatTel(c.telefone)}
                      </a>
                    : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                </td>
                <td style={{ padding: '10px 10px' }}>
                  {c.email
                    ? <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 11 }}>{c.email}</a>
                    : <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, fontStyle: 'italic' }}>—</span>}
                </td>
                <td style={{ padding: '10px 10px' }}>
                  <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: c.fonte === 'QSA' ? 'rgba(14,165,233,0.1)' : c.fonte === 'manual' ? 'rgba(245,158,11,0.1)' : c.fonte === 'LinkedIn' ? 'rgba(14,165,233,0.1)' : 'rgba(139,92,246,0.1)',
                    color: c.fonte === 'QSA' ? '#0ea5e9' : c.fonte === 'manual' ? '#f59e0b' : c.fonte === 'LinkedIn' ? '#0ea5e9' : '#8b5cf6' }}>
                    {c.fonte === 'QSA' ? '🔎 CNPJ' : c.fonte === 'manual' ? '✏️ Manual' : c.fonte === 'LinkedIn' ? '🔗 LinkedIn' : '✨ IA'}
                  </span>
                </td>
                <td style={{ padding: '10px 10px' }} onClick={e => e.stopPropagation()}>
                  <StatusChip status={c.status || 'novo'} onChange={v => onStatusChange(c.id, v)} />
                </td>
                <td style={{ padding: '10px 10px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {onEnriquecer && (
                      <button
                        onClick={() => onEnriquecer(c)}
                        disabled={enrichendo?.has(c.id)}
                        title={c.email && c.telefone ? 'Reenriquecer contato' : 'Buscar e-mail/telefone (Hunter.io + Lusha)'}
                        style={{ padding: '4px 6px', borderRadius: 6, background: c.email ? 'rgba(16,185,129,0.07)' : 'rgba(99,102,241,0.1)', border: `1px solid ${c.email ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.25)'}`, color: c.email ? '#10b981' : '#6366f1', cursor: enrichendo?.has(c.id) ? 'default' : 'pointer', opacity: enrichendo?.has(c.id) ? 0.6 : 1 }}>
                        {enrichendo?.has(c.id)
                          ? <ArrowPathIcon style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
                          : <EnvelopeIcon style={{ width: 12, height: 12 }} />}
                      </button>
                    )}
                    <button onClick={() => onSelecionar(selecionado ? null : c)} title="Abordagem IA"
                      style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa', cursor: 'pointer' }}>
                      <SparklesIcon style={{ width: 12, height: 12 }} />
                    </button>
                    <button onClick={() => onDeletar(c.id)} title="Remover"
                      style={{ padding: '4px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <TrashIcon style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Componente: Timeline ──────────────────────────────────────────────────────
function TimelinePanel({ eventos, onAdd, onRemove }) {
  const [novaAcao, setNovaAcao] = useState('')

  function adicionarAcao() {
    if (!novaAcao.trim()) return
    onAdd({ id: uid(), texto: novaAcao.trim(), ts: new Date().toISOString() })
    setNovaAcao('')
  }

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7 }}>
        <ClockIcon style={{ width: 15, height: 15, color: 'var(--text-secondary)' }} />
        <span style={{ fontWeight: 700, fontSize: 13 }}>Histórico de Ações</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>{eventos.length} registro{eventos.length !== 1 ? 's' : ''}</span>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
        <input value={novaAcao} onChange={e => setNovaAcao(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionarAcao()}
          placeholder="Registrar ação (ex: Ligação realizada, e-mail enviado...)"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
        <button onClick={adicionarAcao}
          style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <PlusIcon style={{ width: 13, height: 13 }} /> Registrar
        </button>
      </div>
      {eventos.length === 0
        ? <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>Nenhuma ação registrada ainda.</div>
        : <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[...eventos].reverse().map((ev, i) => {
              const dt = new Date(ev.ts)
              const dtStr = dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
              return (
                <div key={ev.id} style={{ display: 'flex', gap: 12, paddingTop: 10, paddingBottom: 10, borderBottom: i < eventos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 32, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1', marginTop: 3 }} />
                    {i < eventos.length - 1 && <div style={{ flex: 1, width: 1, background: 'var(--border)' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{ev.texto}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{dtStr}</div>
                  </div>
                  <button onClick={() => onRemove(ev.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 2, flexShrink: 0, opacity: 0.5 }}>
                    <XMarkIcon style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}

// ─── Componente: Radar Panel (empresa selecionada) ────────────────────────────
function RadarPanel({ empresa, onFechar }) {
  const [cnpjOverride, setCnpjOverride] = useState('')
  const [cnpjInput, setCnpjInput] = useState('')
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const cnpj = ((empresa.cnpj || cnpjOverride || '').replace(/\D/g, ''))
  const [dados, setDados] = useState(() => getEmpresaData(cnpj))
  const [cnpjData, setCnpjData] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [mostrarAddContato, setMostrarAddContato] = useState(false)
  const [contatoSelecionado, setContatoSelecionado] = useState(null)
  const [expandirIA, setExpandirIA] = useState(true)
  const [expandirTimeline, setExpandirTimeline] = useState(false)
  const [expandirApollo, setExpandirApollo] = useState(false)
  const [apolloContatos, setApolloContatos] = useState([])
  const [apolloTotal, setApolloTotal] = useState(0)
  const [buscandoApollo, setBuscandoApollo] = useState(false)
  const [apolloErro, setApolloErro] = useState('')

  // Re-carregar dados locais quando CNPJ fica disponível após o mount
  const cnpjAnterior = useRef('')
  useEffect(() => {
    if (cnpj && cnpj !== cnpjAnterior.current) {
      cnpjAnterior.current = cnpj
      setDados(getEmpresaData(cnpj))
    }
  }, [cnpj])

  // Auto-buscar CNPJ via Serper quando empresa vem do Google Maps (sem CNPJ)
  useEffect(() => {
    if (empresa.cnpj || cnpjOverride) return
    if (!empresa.nome) return
    setBuscandoCnpj(true)
    supabase.functions.invoke('busca-fornecedores', {
      body: { mode: 'cnpj_search', nome: empresa.nome, cidade: empresa.cidade || '' },
    }).then(({ data }) => {
      const cnpjs = data?.cnpjs || []
      if (cnpjs.length > 0) {
        setCnpjOverride(cnpjs[0].replace(/\D/g, ''))
        toast.success('CNPJ identificado automaticamente')
      }
    }).catch(() => {}).finally(() => setBuscandoCnpj(false))
  }, [empresa])

  const produtos = cnpjData ? detectProdutos(cnpjData.cnae_fiscal_descricao || '') : detectProdutos(empresa.cnae || '')

  // Buscar dados completos do CNPJ
  useEffect(() => {
    if (!cnpj || cnpj.length !== 14) return
    setCarregando(true)
    fetch(`/api/cnpj?cnpj=${cnpj}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        setCnpjData(data)
        // Importar QSA como contatos (Camada 1)
        if (data.qsa?.length) {
          setDados(prev => {
            const cnpjsJaSalvos = new Set(prev.contatos.filter(c => c.fonte === 'QSA').map(c => c.nome))
            const novosQsa = data.qsa
              .filter(s => !cnpjsJaSalvos.has(s.nome_socio))
              .map(s => ({
                id: uid(),
                nome: s.nome_socio || '',
                cargo: s.qualificacao_socio || 'Sócio',
                area: 'Societário',
                telefone: '',
                email: '',
                linkedin: '',
                fonte: 'QSA',
                status: 'novo',
                criado_em: new Date().toISOString(),
              }))
            if (!novosQsa.length) return prev
            const novo = { ...prev, contatos: [...prev.contatos, ...novosQsa] }
            saveEmpresaData(cnpj, novo)
            return novo
          })
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [cnpj])

  // Persistir dados
  function persistir(novosDados) { setDados(novosDados); saveEmpresaData(cnpj, novosDados) }

  function atualizarPipeline(novoStatus) { persistir({ ...dados, pipeline: novoStatus }) }
  function atualizarStatusContato(cid, novoStatus) {
    persistir({ ...dados, contatos: dados.contatos.map(c => c.id === cid ? { ...c, status: novoStatus } : c) })
  }
  function deletarContato(cid) {
    if (!confirm('Remover este contato?')) return
    persistir({ ...dados, contatos: dados.contatos.filter(c => c.id !== cid) })
    if (contatoSelecionado?.id === cid) setContatoSelecionado(null)
  }
  function adicionarContato(contato) { persistir({ ...dados, contatos: [...dados.contatos, contato] }); toast.success('Contato adicionado!') }
  function adicionarAcao(acao) { persistir({ ...dados, timeline: [...dados.timeline, acao] }); toast.success('Ação registrada!') }
  function removerAcao(aid) { persistir({ ...dados, timeline: dados.timeline.filter(e => e.id !== aid) }) }

  async function buscarApollo() {
    const nomeEmpresa = cnpjData?.nome_fantasia || cnpjData?.razao_social || empresa.nome || ''
    if (!nomeEmpresa) { toast.error('Empresa sem nome definido'); return }
    setBuscandoApollo(true)
    setApolloErro('')
    setApolloContatos([])
    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { mode: 'linkedin_search', empresa: nomeEmpresa },
      })
      if (error) throw new Error(error.message || 'Erro ao buscar')
      const lista = data?.contatos || []
      setApolloContatos(lista)
      setApolloTotal(lista.length)
      if (!lista.length) setApolloErro('Nenhum perfil LinkedIn encontrado para esta empresa. Tente com o nome completo ou razão social.')
    } catch (err) {
      setApolloErro(err.message || 'Erro ao buscar contatos')
    } finally {
      setBuscandoApollo(false)
    }
  }

  function adicionarDoApollo(ac) {
    const jaExiste = dados.contatos.some(c => c.nome === ac.nome && c.cargo === ac.cargo)
    if (jaExiste) { toast('Contato já adicionado', { icon: 'ℹ️' }); return }
    adicionarContato({
      id: uid(),
      nome: ac.nome,
      cargo: ac.cargo,
      area: 'LinkedIn',
      telefone: ac.telefone,
      email: ac.email,
      linkedin: ac.linkedin,
      fonte: 'LinkedIn',
      status: 'novo',
      criado_em: new Date().toISOString(),
    })
  }

  // ── Enriquecimento Hunter.io / Lusha ──────────────────────────────────────
  const [enrichendo, setEnrichendo] = useState(new Set())
  const dominioEnriquecimento = (() => {
    const site = empresa.website || ''
    if (site) return site.replace(/^https?:\/\//, '').split('/')[0]
    const emailEmpresa = cnpjData?.email || ''
    if (emailEmpresa.includes('@')) return emailEmpresa.split('@')[1]
    return ''
  })()

  async function enrichirContato(contato) {
    if (enrichendo.has(contato.id)) return
    setEnrichendo(prev => new Set([...prev, contato.id]))
    try {
      const r = await fetch('/api/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: contato.nome,
          dominio: dominioEnriquecimento,
          linkedin: contato.linkedin || '',
        }),
      })
      const data = await r.json()
      if (!r.ok) { toast.error(data.error || 'Sem resultado'); return }
      const atualizado = {
        ...contato,
        email: data.email || contato.email,
        telefone: data.telefone || contato.telefone,
      }
      persistir({ ...dados, contatos: dados.contatos.map(c => c.id === contato.id ? atualizado : c) })
      toast.success(`Enriquecido via ${data.fonte}!`)
    } catch (err) {
      toast.error(err.message || 'Erro ao enriquecer')
    } finally {
      setEnrichendo(prev => { const s = new Set(prev); s.delete(contato.id); return s })
    }
  }

  const kpis = {
    decisores: dados.contatos.filter(c => scoreCargo(c.cargo || '').nivel === 'Alta').length,
    tels: dados.contatos.filter(c => c.telefone).length,
    emails: dados.contatos.filter(c => c.email).length,
    total: dados.contatos.length,
    quentes: dados.contatos.filter(c => ['em_negociacao','reuniao_agendada','wa_enviado'].includes(c.status)).length,
    convertidos: dados.contatos.filter(c => c.status === 'convertido').length,
  }

  const nomeExibicao = cnpjData?.nome_fantasia || cnpjData?.razao_social || empresa.nome || empresa.razao_social || '—'
  const razaoSocial = cnpjData?.razao_social || empresa.razao_social || ''
  const cidade = cnpjData?.municipio || empresa.cidade || ''
  const uf = cnpjData?.uf || empresa.uf || ''
  const telefone = cnpjData?.ddd_telefone_1 || empresa.telefone || ''
  const cnaeDesc = cnpjData?.cnae_fiscal_descricao || empresa.cnae || empresa.categoria || ''
  const capSocial = cnpjData?.capital_social || 0
  const porte = cnpjData?.porte || ''
  const situacao = cnpjData?.descricao_situacao_cadastral || ''
  const website = cnpjData?.email ? '' : ''

  const scoreComercial = Math.min(100, Math.round(
    (kpis.decisores * 20) + (kpis.tels * 15) + (kpis.emails * 10) +
    (capSocial > 1000000 ? 25 : capSocial > 100000 ? 15 : 5) +
    (porte === 'GRANDE' ? 20 : porte === 'MEDIO' ? 12 : 5)
  ))

  const scoreColor = scoreComercial >= 70 ? '#10b981' : scoreComercial >= 40 ? '#f59e0b' : '#94a3b8'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header empresa */}
      <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.08) 100%)', borderBottom: '1px solid var(--border)', padding: '16px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
              {nomeExibicao.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{nomeExibicao}</div>
                {carregando && <ArrowPathIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)', animation: 'spin 1s linear infinite' }} />}
              </div>
              {razaoSocial && razaoSocial !== nomeExibicao && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{razaoSocial}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {cnaeDesc && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>{cnaeDesc.length > 45 ? cnaeDesc.slice(0, 45) + '…' : cnaeDesc}</span>}
                {(cidade || uf) && <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}><MapPinIcon style={{ width: 11, height: 11 }} />{cidade}{uf ? `, ${uf}` : ''}</span>}
                {situacao && <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: situacao === 'ATIVA' || cnpjData?.situacao_cadastral === 2 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: situacao === 'ATIVA' || cnpjData?.situacao_cadastral === 2 ? '#10b981' : '#ef4444' }}>{situacao || 'ATIVA'}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
            <div style={{ textAlign: 'center', background: 'var(--bg-primary)', border: `2px solid ${scoreColor}`, borderRadius: 12, padding: '8px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{scoreComercial}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: scoreColor, marginTop: 2 }}>SCORE</div>
            </div>
            <button onClick={onFechar} style={{ padding: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <XMarkIcon style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Info row */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {cnpj ? (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>CNPJ: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{formatCnpj(cnpj)}</strong></div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              {buscandoCnpj ? <><ArrowPathIcon style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} /> <span>Buscando CNPJ...</span></> : <span style={{ color: '#f59e0b' }}>CNPJ não encontrado</span>}
            </div>
          )}
          {telefone && <a href={waLink(telefone) || '#'} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><PhoneIcon style={{ width: 12, height: 12 }} />{formatTel(telefone)}</a>}
          {capSocial > 0 && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Capital: <strong style={{ color: 'var(--text-primary)' }}>R$ {capSocial.toLocaleString('pt-BR')}</strong></div>}
          {porte && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Porte: <strong style={{ color: 'var(--text-primary)' }}>{porte}</strong></div>}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Pipeline:</span>
            <StatusChip status={dados.pipeline} onChange={atualizarPipeline} size="md" />
          </div>
        </div>
      </div>

      {/* CNPJ manual input banner — shown when CNPJ not yet found */}
      {!cnpj && !buscandoCnpj && (
        <div style={{ padding: '10px 20px', background: 'rgba(245,158,11,0.07)', borderBottom: '1px solid rgba(245,158,11,0.2)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <ExclamationCircleIcon style={{ width: 14, height: 14, color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, minWidth: 160 }}>Informe o CNPJ para ativar o Radar de Decisores:</span>
          <input
            value={cnpjInput}
            onChange={e => setCnpjInput(e.target.value.replace(/\D/g, '').slice(0, 14))}
            onKeyDown={e => e.key === 'Enter' && cnpjInput.length === 14 && setCnpjOverride(cnpjInput)}
            placeholder="CNPJ (só números)"
            style={{ padding: '5px 9px', borderRadius: 7, border: '1px solid rgba(245,158,11,0.4)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, width: 150, fontFamily: 'monospace', outline: 'none' }}
          />
          <button
            onClick={() => cnpjInput.length === 14 && setCnpjOverride(cnpjInput)}
            disabled={cnpjInput.length !== 14}
            style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: cnpjInput.length === 14 ? 'rgba(245,158,11,0.18)' : 'transparent', border: '1px solid rgba(245,158,11,0.35)', color: cnpjInput.length === 14 ? '#f59e0b' : 'var(--text-secondary)', cursor: cnpjInput.length === 14 ? 'pointer' : 'default' }}>
            Ativar
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 10, padding: '14px 20px', flexShrink: 0, overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        {[
          { label: 'Decisores', valor: kpis.decisores, cor: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: <FireSolid style={{ width: 16, height: 16 }} />, desc: 'Alta relevância' },
          { label: 'Telefones', valor: kpis.tels, cor: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: <PhoneIcon style={{ width: 14, height: 14 }} />, desc: 'Válidos' },
          { label: 'E-mails', valor: kpis.emails, cor: '#6366f1', bg: 'rgba(99,102,241,0.1)', icon: <EnvelopeIcon style={{ width: 14, height: 14 }} />, desc: 'Disponíveis' },
          { label: 'Total Contatos', valor: kpis.total, cor: '#0ea5e9', bg: 'rgba(14,165,233,0.1)', icon: <UserGroupIcon style={{ width: 14, height: 14 }} />, desc: 'Mapeados' },
          { label: 'Em andamento', valor: kpis.quentes, cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: <BoltIcon style={{ width: 14, height: 14 }} />, desc: 'Contatos ativos' },
          { label: 'Convertidos', valor: kpis.convertidos, cor: '#a78bfa', bg: 'rgba(167,139,250,0.1)', icon: <CheckCircleIcon style={{ width: 14, height: 14 }} />, desc: 'Fechados' },
        ].map((k, i) => (
          <div key={i} style={{ flexShrink: 0, minWidth: 110, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: k.cor, marginBottom: 4 }}>
              {k.icon}
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>{k.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: k.cor, lineHeight: 1 }}>{k.valor}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{k.desc}</div>
          </div>
        ))}
      </div>

      {/* Corpo principal (scrollável) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Camadas de dados */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircleIcon style={{ width: 11, height: 11 }} /> Camada 1: CNPJ/QSA
          </div>
          <div style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircleIcon style={{ width: 11, height: 11 }} /> Camada 2: LinkedIn
          </div>
          <div style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(167,139,250,0.1)', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 4 }}>
            <SparklesIcon style={{ width: 11, height: 11 }} /> Camada 3: Classificação IA
          </div>
        </div>

        {/* Tabela de Contatos */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <UserGroupIcon style={{ width: 15, height: 15, color: 'var(--text-secondary)' }} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>Contatos Estratégicos</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{dados.contatos.length} encontrado{dados.contatos.length !== 1 ? 's' : ''}</span>
            </div>
            <button onClick={() => setMostrarAddContato(true)}
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <PlusIcon style={{ width: 13, height: 13 }} /> Adicionar
            </button>
          </div>
          <TabelaContatos
            contatos={dados.contatos}
            onStatusChange={atualizarStatusContato}
            onEditar={() => {}}
            onDeletar={deletarContato}
            onSelecionar={setContatoSelecionado}
            contatoSelecionado={contatoSelecionado}
            onEnriquecer={enrichirContato}
            enrichendo={enrichendo}
          />
        </div>

        {/* ── Camada 2: Apollo.io ── */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <button onClick={() => setExpandirApollo(v => !v)}
            style={{ width: '100%', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', borderBottom: expandirApollo ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#fff' }}>A</div>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Camada 2 — LinkedIn</span>
              <span style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>via Google Search</span>
              {apolloContatos.length > 0 && <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700 }}>{apolloContatos.length} encontrados</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!buscandoApollo && !apolloContatos.length && (
                <button onClick={e => { e.stopPropagation(); setExpandirApollo(true); buscarApollo() }}
                  style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MagnifyingGlassIcon style={{ width: 12, height: 12 }} /> Buscar Contatos
                </button>
              )}
              {buscandoApollo && <ArrowPathIcon style={{ width: 14, height: 14, color: '#6366f1', animation: 'spin 1s linear infinite' }} />}
              {apolloContatos.length > 0 && (
                <button onClick={e => { e.stopPropagation(); buscarApollo() }}
                  style={{ padding: '5px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <ArrowPathIcon style={{ width: 11, height: 11 }} />
                </button>
              )}
              {expandirApollo ? <ChevronUpIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} /> : <ChevronDownIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />}
            </div>
          </button>

          {expandirApollo && (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Status / error */}
              {apolloErro && (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#ef4444', fontSize: 12 }}>
                  {apolloErro}
                </div>
              )}

              {/* Buscar button (quando ainda não buscou) */}
              {!buscandoApollo && !apolloContatos.length && !apolloErro && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Busca perfis LinkedIn de decisores desta empresa via Google — 100% grátis.</div>
                  <button onClick={buscarApollo}
                    style={{ padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.3)', color: '#6366f1', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <MagnifyingGlassIcon style={{ width: 14, height: 14 }} /> Buscar Decisores
                  </button>
                </div>
              )}

              {/* Loading */}
              {buscandoApollo && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <ArrowPathIcon style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Consultando Apollo.io...
                </div>
              )}

              {/* Results */}
              {apolloContatos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {apolloTotal > apolloContatos.length && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
                      Exibindo {apolloContatos.length} de {apolloTotal} contatos encontrados
                    </div>
                  )}
                  {apolloContatos.map((ac, i) => {
                    const score = scoreCargo(ac.cargo || '')
                    const jaAdicionado = dados.contatos.some(c => c.nome === ac.nome && c.cargo === ac.cargo)
                    return (
                      <div key={i} style={{ padding: '10px 12px', borderRadius: 9, border: `1px solid ${jaAdicionado ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, background: jaAdicionado ? 'rgba(16,185,129,0.04)' : 'var(--bg-primary)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        {ac.foto ? (
                          <img src={ac.foto} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} onError={e => { e.target.style.display = 'none' }} />
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--text-secondary)', flexShrink: 0 }}>
                            {(ac.nome || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{ac.nome || '—'}</span>
                            {score.nivel !== 'Baixa' && (
                              <span style={{ padding: '1px 6px', borderRadius: 20, fontSize: 9, fontWeight: 700, background: score.nivel === 'Alta' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: score.nivel === 'Alta' ? '#10b981' : '#f59e0b' }}>
                                {score.nivel === 'Alta' ? '🔥' : '⚡'} {score.nivel}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, marginTop: 2 }}>{ac.cargo}</div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                            {ac.email && <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}><EnvelopeIcon style={{ width: 10, height: 10 }} />{ac.email.includes('*') ? <em style={{ fontStyle: 'italic', opacity: 0.7 }}>{ac.email}</em> : ac.email}</span>}
                            {ac.telefone && <span style={{ fontSize: 11, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 3 }}><PhoneIcon style={{ width: 10, height: 10 }} />{ac.telefone}</span>}
                            {ac.linkedin && <a href={ac.linkedin} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none', fontWeight: 700 }}><ArrowTopRightOnSquareIcon style={{ width: 10, height: 10 }} />LinkedIn</a>}
                            {ac.cidade && <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{ac.cidade}</span>}
                          </div>
                        </div>
                        <button onClick={() => adicionarDoApollo(ac)}
                          disabled={jaAdicionado}
                          title={jaAdicionado ? 'Já adicionado' : 'Adicionar à Camada 1'}
                          style={{ padding: '5px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: jaAdicionado ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.1)', border: `1px solid ${jaAdicionado ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.25)'}`, color: jaAdicionado ? '#10b981' : '#6366f1', cursor: jaAdicionado ? 'default' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {jaAdicionado ? <CheckIcon style={{ width: 12, height: 12 }} /> : <PlusIcon style={{ width: 12, height: 12 }} />}
                          {jaAdicionado ? 'Salvo' : 'Adicionar'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Legal note */}
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', gap: 5, alignItems: 'flex-start', marginTop: 2 }}>
                <InformationCircleIcon style={{ width: 11, height: 11, flexShrink: 0, marginTop: 1 }} />
                Perfis encontrados via Google Search (site:linkedin.com). Dados públicos — uso em conformidade com a LGPD.
              </div>
            </div>
          )}
        </div>

        {/* Painel IA */}
        <div>
          <button onClick={() => setExpandirIA(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0, background: 'none', border: 'none', cursor: 'pointer', marginBottom: expandirIA ? 8 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SparklesIcon style={{ width: 14, height: 14, color: '#a78bfa' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Abordagem Inteligente</span>
            </div>
            {expandirIA ? <ChevronUpIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} /> : <ChevronDownIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />}
          </button>
          {expandirIA && (
            <PainelIA
              empresa={cnpjData || empresa}
              contato={contatoSelecionado}
              produtos={produtos}
            />
          )}
        </div>

        {/* Timeline */}
        <div>
          <button onClick={() => setExpandirTimeline(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0, background: 'none', border: 'none', cursor: 'pointer', marginBottom: expandirTimeline ? 8 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClockIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Histórico de Ações</span>
              {dados.timeline.length > 0 && <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 700 }}>{dados.timeline.length}</span>}
            </div>
            {expandirTimeline ? <ChevronUpIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} /> : <ChevronDownIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />}
          </button>
          {expandirTimeline && <TimelinePanel eventos={dados.timeline} onAdd={adicionarAcao} onRemove={removerAcao} />}
        </div>

        {/* Aviso LGPD */}
        <div style={{ padding: '10px 14px', background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <InformationCircleIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)', marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Dados obtidos de fontes públicas (Receita Federal / BrasilAPI / Apollo.io). Uso em conformidade com a LGPD.
          </div>
        </div>
      </div>

      {mostrarAddContato && <AdicionarContatoModal onClose={() => setMostrarAddContato(false)} onSalvar={adicionarContato} />}
    </div>
  )
}

// ─── Componente: Painel de Busca (esquerdo) ───────────────────────────────────
function PainelBusca({ onSelecionar, empresaSelecionada }) {
  const [termo, setTermo] = useState('')
  const [uf, setUf] = useState('')
  const [cidade, setCidade] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [erroBusca, setErroBusca] = useState('')

  async function buscar() {
    if (!termo.trim()) { toast.error('Informe o segmento ou nome da empresa'); return }
    if (!cidade.trim() && !uf) { toast.error('Informe cidade ou estado'); return }
    setBuscando(true)
    setErroBusca('')
    setResultados([])
    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { query: termo.trim(), cidade: cidade.trim() || undefined, uf: uf || undefined, prospectMode: true },
      })
      if (error) throw new Error(error.message || 'Erro ao buscar')
      const lista = data?.fornecedores || []
      if (!lista.length) { setErroBusca('Nenhuma empresa encontrada. Tente outro segmento ou cidade.'); return }
      setResultados(lista)
    } catch (err) {
      setErroBusca(err.message || 'Erro ao buscar empresas.')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
      {/* Cabeçalho do painel */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <SignalIcon style={{ width: 16, height: 16, color: '#6366f1' }} />
          Busca de Empresas
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={termo} onChange={e => setTermo(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar(1)}
            placeholder="Segmento ou nome da empresa..."
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />

          <div style={{ display: 'flex', gap: 7 }}>
            <select value={uf} onChange={e => setUf(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: uf ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
              <option value="">Estado</option>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <input value={cidade} onChange={e => setCidade(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar(1)}
              placeholder="Cidade"
              style={{ flex: 2, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
          </div>

          <button onClick={() => buscar(1)} disabled={buscando}
            style={{ padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: buscando ? 'var(--bg-primary)' : 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: buscando ? 'var(--text-secondary)' : '#6366f1', cursor: buscando ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {buscando ? <ArrowPathIcon style={{ width: 14, height: 14 }} /> : <MagnifyingGlassIcon style={{ width: 14, height: 14 }} />}
            {buscando ? 'Buscando...' : 'Buscar Empresas'}
          </button>
        </div>
      </div>

      {/* Resultados */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
        {erroBusca && (
          <div style={{ padding: '12px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 12, margin: '4px 0 8px' }}>
            {erroBusca}
          </div>
        )}

        {resultados.length === 0 && !buscando && !erroBusca && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary)' }}>
            <BuildingOffice2Icon style={{ width: 40, height: 40, margin: '0 auto 10px', opacity: 0.2 }} />
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Busque empresas</div>
            <div style={{ fontSize: 12 }}>Informe segmento e/ou estado para localizar prospects.</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {resultados.map(emp => {
            if (!emp) return null
            const selecionada = empresaSelecionada?.nome === emp.nome
            return (
              <div key={emp.id || emp.nome}
                onClick={() => onSelecionar(selecionada ? null : emp)}
                style={{ padding: '11px 12px', borderRadius: 10, border: `1.5px solid ${selecionada ? '#6366f1' : 'var(--border)'}`, background: selecionada ? 'rgba(99,102,241,0.06)' : 'var(--bg-primary)', cursor: 'pointer', position: 'relative', transition: 'border-color 0.15s, background 0.15s' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: selecionada ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)', border: `1px solid ${selecionada ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: selecionada ? '#6366f1' : 'var(--text-secondary)', flexShrink: 0 }}>
                    {(emp.nome || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {emp.nome}
                    </div>
                    {emp.categoria && (
                      <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                        {emp.categoria.length > 40 ? emp.categoria.slice(0, 40) + '…' : emp.categoria}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {emp.endereco && <span style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 2 }}><MapPinIcon style={{ width: 9, height: 9 }} />{emp.endereco.split(',').slice(-3, -1).join(',').trim() || emp.endereco}</span>}
                      {emp.rating && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>★ {emp.rating.toFixed(1)}</span>}
                      {emp.telefone && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>{emp.telefone}</span>}
                    </div>
                  </div>
                  <ChevronRightIcon style={{ width: 14, height: 14, color: selecionada ? '#6366f1' : 'var(--text-secondary)', flexShrink: 0, marginTop: 2 }} />
                </div>
              </div>
            )
          })}
        </div>

        {resultados.length > 0 && resultados.length >= 15 && (
          <button onClick={() => buscar()} disabled={buscando}
            style={{ width: '100%', marginTop: 10, padding: '9px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Refinar busca para mais resultados
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Componente Principal ──────────────────────────────────────────────────────
export default function RadarComercial() {
  const [empresaSelecionada, setEmpresaSelecionada] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header title="Radar Comercial" subtitle="Motor inteligente de prospecção e mapeamento de decisores" />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Painel esquerdo: busca */}
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PainelBusca onSelecionar={setEmpresaSelecionada} empresaSelecionada={empresaSelecionada} />
        </div>

        {/* Painel direito: radar */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {empresaSelecionada ? (
            <RadarPanel empresa={empresaSelecionada} onFechar={() => setEmpresaSelecionada(null)} />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(99,102,241,0.08)', border: '2px solid rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <SignalIcon style={{ width: 40, height: 40, color: '#6366f1', opacity: 0.5 }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>Radar de Decisores</div>
              <div style={{ fontSize: 14, maxWidth: 340, lineHeight: 1.6, marginBottom: 20 }}>
                Busque empresas ao lado e selecione uma para ativar o Radar Inteligente de Decisores.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
                {[
                  { cor: '#0ea5e9', label: 'Camada 1 — Dados públicos do CNPJ e QSA', desc: 'Sócios, endereço, telefone, capital social' },
                  { cor: '#a78bfa', label: 'Camada 2 — LinkedIn', desc: 'Decisores via Google Search (gratuito)' },
                  { cor: '#10b981', label: 'Camada 3 — Classificação por IA', desc: 'Scoring por cargo, sugestão de abordagem e produto' },
                ].map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '10px 14px', background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 9, border: '1px solid var(--border)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.cor, flexShrink: 0, marginTop: 5 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{l.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{l.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
