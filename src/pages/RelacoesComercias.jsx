// src/pages/RelacoesComercias.jsx
// CRM de Relacionamento Comercial — decisores identificados via LinkedIn
// Fluxo: Nome da Empresa → Serper LinkedIn Search → cargos estratégicos → enriquecimento Proxycurl

import { useState, useCallback } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { waLink } from '../lib/utils'
import {
  UserGroupIcon, PlusIcon, MagnifyingGlassIcon, ArrowPathIcon,
  EnvelopeIcon, PhoneIcon, BuildingOffice2Icon, SparklesIcon,
  TrashIcon, ArrowTopRightOnSquareIcon, XMarkIcon, BoltIcon,
  FunnelIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { FireIcon as FireSolid } from '@heroicons/react/24/solid'

// ─── Constants ────────────────────────────────────────────────────────────────
const LS_KEY = 'relacoes_comerciais_v1'

const PIPELINE = [
  { id: 'novo',           label: 'Novo',          cor: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  { id: 'contato_feito',  label: 'Contato feito', cor: '#0ea5e9', bg: 'rgba(14,165,233,0.12)'  },
  { id: 'wa_enviado',     label: 'WhatsApp',      cor: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  { id: 'reuniao',        label: 'Reunião',        cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  { id: 'negociacao',     label: 'Negociação',     cor: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  { id: 'convertido',     label: 'Convertido ✓',  cor: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  { id: 'sem_interesse',  label: 'Descartado',    cor: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
]

const CARGOS_ALTA  = ['sócio','socio','diretor','proprietário','proprietario','ceo','coo','cfo','cto','presidente','vice-presidente','administrador','sócio-administrador','socio-administrador']
const CARGOS_MEDIA = ['comprador','analista de compras','supervisor','gestor','gerente','coordenador','responsável','responsavel','encarregado','chefe','analista']

// ─── Utilities ────────────────────────────────────────────────────────────────
function uid()  { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function norm(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim() }

function scoreCargo(cargo) {
  const c = norm(cargo)
  if (CARGOS_ALTA.some(k  => c.includes(k))) return { nivel: 'Alta',  cor: '#ef4444', bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.2)'    }
  if (CARGOS_MEDIA.some(k => c.includes(k))) return { nivel: 'Média', cor: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.2)'   }
  return                                             { nivel: 'Baixa', cor: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)'  }
}

function loadData() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') || { empresas: [], contatos: [] } }
  catch { return { empresas: [], contatos: [] } }
}
function saveData(d) { localStorage.setItem(LS_KEY, JSON.stringify(d)) }

function initials(nome) {
  const p = (nome || '').split(' ')
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?'
}

// ─── StatusSelect ─────────────────────────────────────────────────────────────
function StatusSelect({ status, onChange }) {
  const s = PIPELINE.find(x => x.id === status) || PIPELINE[0]
  return (
    <select value={status} onChange={e => onChange(e.target.value)}
      style={{ padding: '3px 22px 3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
        border: `1.5px solid ${s.cor}`, background: s.bg, color: s.cor, cursor: 'pointer',
        outline: 'none', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24'%3E%3Cpath fill='${encodeURIComponent(s.cor)}' d='m7 10 5 5 5-5z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 5px center' }}>
      {PIPELINE.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  )
}

// ─── Contact Card Row ─────────────────────────────────────────────────────────
function ContatoRow({ c, onEnriquecer, enrichendo, onStatus, onDeletar }) {
  const sc = scoreCargo(c.cargo)
  const isEnrichendo = enrichendo.has(c.id)

  return (
    <tr style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.03)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

      {/* Avatar + Nome + Cargo */}
      <td style={{ padding: '10px 12px', minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {c.foto
            ? <img src={c.foto} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#6366f1', flexShrink: 0 }}>{initials(c.nome)}</div>
          }
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.2 }}>{c.nome}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{c.cargo}</div>
          </div>
        </div>
      </td>

      {/* Empresa */}
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <BuildingOffice2Icon style={{ width: 13, height: 13, color: 'var(--text-secondary)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{c.empresa_nome}</span>
        </div>
      </td>

      {/* Relevância */}
      <td style={{ padding: '10px 12px' }}>
        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: sc.bg, color: sc.cor, border: `1px solid ${sc.border}`, whiteSpace: 'nowrap' }}>
          {sc.nivel === 'Alta' ? '🔥' : sc.nivel === 'Média' ? '⚡' : '·'} {sc.nivel}
        </span>
      </td>

      {/* Telefone */}
      <td style={{ padding: '10px 12px' }}>
        {c.telefone
          ? <a href={`tel:${c.telefone}`} style={{ color: '#22c55e', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>{c.telefone}</a>
          : <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: 11, fontStyle: 'italic' }}>—</span>}
      </td>

      {/* E-mail */}
      <td style={{ padding: '10px 12px' }}>
        {c.email
          ? <a href={`mailto:${c.email}`} style={{ color: '#6366f1', fontSize: 11, textDecoration: 'none' }}>{c.email}</a>
          : <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: 11, fontStyle: 'italic' }}>—</span>}
      </td>

      {/* Status */}
      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
        <StatusSelect status={c.status || 'novo'} onChange={v => onStatus(c.id, v)} />
      </td>

      {/* Ações */}
      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>

          {/* Enriquecer Proxycurl */}
          {c.linkedin && (
            <button onClick={() => onEnriquecer(c)} disabled={isEnrichendo}
              title={c.email || c.telefone ? 'Reenriquecer via Proxycurl' : 'Buscar telefone + e-mail (Proxycurl)'}
              style={{ padding: '4px 7px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: c.email || c.telefone ? 'rgba(16,185,129,0.08)' : 'rgba(99,102,241,0.1)',
                border: `1px solid ${c.email || c.telefone ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.25)'}`,
                color: c.email || c.telefone ? '#10b981' : '#6366f1',
                cursor: isEnrichendo ? 'default' : 'pointer', opacity: isEnrichendo ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 4 }}>
              {isEnrichendo
                ? <ArrowPathIcon style={{ width: 11, height: 11, animation: 'spin 1s linear infinite' }} />
                : <BoltIcon style={{ width: 11, height: 11 }} />}
              {isEnrichendo ? '' : c.email || c.telefone ? '✓' : 'Enriquecer'}
            </button>
          )}

          {/* LinkedIn */}
          {c.linkedin && (
            <a href={c.linkedin.startsWith('http') ? c.linkedin : `https://${c.linkedin}`}
              target="_blank" rel="noreferrer"
              title="Abrir LinkedIn"
              style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(14,118,168,0.1)', border: '1px solid rgba(14,118,168,0.2)', color: '#0e76a8', display: 'flex', alignItems: 'center' }}>
              <ArrowTopRightOnSquareIcon style={{ width: 11, height: 11 }} />
            </a>
          )}

          {/* WhatsApp */}
          {c.telefone && (
            <a href={waLink(c.telefone, `Olá ${c.nome?.split(' ')[0]}, tudo bem?`)}
              target="_blank" rel="noreferrer"
              title="WhatsApp"
              style={{ padding: '4px 6px', borderRadius: 6, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', color: '#22c55e', display: 'flex', alignItems: 'center' }}>
              <PhoneIcon style={{ width: 11, height: 11 }} />
            </a>
          )}

          {/* Deletar */}
          <button onClick={() => onDeletar(c.id)} title="Remover"
            style={{ padding: '4px 6px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <TrashIcon style={{ width: 11, height: 11 }} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RelacoesComercias() {
  const [dados, setDados]               = useState(loadData)
  const [novaEmpresa, setNovaEmpresa]   = useState('')
  const [buscandoId, setBuscandoId]     = useState(null) // empresa.id em busca
  const [filtroEmpresa, setFiltroEmpresa] = useState('todas')
  const [filtroNivel, setFiltroNivel]   = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca]               = useState('')
  const [enrichendo, setEnrichendo]     = useState(new Set())

  function persistir(d) { setDados(d); saveData(d) }

  // ── Adicionar empresa e buscar decisores no LinkedIn ─────────────────────
  async function adicionarEmpresa() {
    const nome = novaEmpresa.trim()
    if (!nome) return
    if (dados.empresas.some(e => norm(e.nome) === norm(nome))) {
      toast('Empresa já adicionada', { icon: 'ℹ️' }); return
    }

    const empresa = { id: uid(), nome, adicionada_em: new Date().toISOString() }
    const novaLista = { ...dados, empresas: [...dados.empresas, empresa] }
    persistir(novaLista)
    setNovaEmpresa('')
    setBuscandoId(empresa.id)

    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { mode: 'linkedin_search', empresa: nome },
      })
      if (error) throw new Error(error.message)

      const encontrados = (data?.contatos || [])
      // Filtra apenas Alta e Média relevância
      const estrategicos = encontrados.filter(c => scoreCargo(c.cargo).nivel !== 'Baixa')

      if (!estrategicos.length) {
        toast.error(`Nenhum decisor estratégico encontrado para "${nome}"`)
        setBuscandoId(null)
        return
      }

      // Evitar duplicatas pelo nome+empresa
      const existentes = new Set(dados.contatos.map(c => `${norm(c.nome)}|${norm(c.empresa_nome)}`))
      const novos = estrategicos
        .filter(c => !existentes.has(`${norm(c.nome)}|${norm(nome)}`))
        .map(c => ({
          id: uid(),
          nome: c.nome,
          cargo: c.cargo,
          empresa_id: empresa.id,
          empresa_nome: nome,
          linkedin: c.linkedin || '',
          foto: c.foto || '',
          cidade: c.cidade || '',
          email: c.email || '',
          telefone: c.telefone || '',
          fonte: 'LinkedIn',
          status: 'novo',
          adicionado_em: new Date().toISOString(),
        }))

      persistir({
        empresas: [...novaLista.empresas],
        contatos: [...novaLista.contatos, ...novos],
      })

      toast.success(`${novos.length} decisor${novos.length !== 1 ? 'es' : ''} encontrado${novos.length !== 1 ? 's' : ''} para "${nome}"`)
    } catch (err) {
      toast.error(err.message || 'Erro ao buscar decisores')
    } finally {
      setBuscandoId(null)
    }
  }

  // ── Re-buscar empresa existente ──────────────────────────────────────────
  async function rebuscarEmpresa(empresa) {
    setBuscandoId(empresa.id)
    try {
      const { data, error } = await supabase.functions.invoke('busca-fornecedores', {
        body: { mode: 'linkedin_search', empresa: empresa.nome },
      })
      if (error) throw new Error(error.message)

      const encontrados = (data?.contatos || []).filter(c => scoreCargo(c.cargo).nivel !== 'Baixa')
      const existentes = new Set(dados.contatos.map(c => `${norm(c.nome)}|${norm(c.empresa_nome)}`))
      const novos = encontrados
        .filter(c => !existentes.has(`${norm(c.nome)}|${norm(empresa.nome)}`))
        .map(c => ({
          id: uid(), nome: c.nome, cargo: c.cargo,
          empresa_id: empresa.id, empresa_nome: empresa.nome,
          linkedin: c.linkedin || '', foto: c.foto || '',
          cidade: c.cidade || '', email: '', telefone: '',
          fonte: 'LinkedIn', status: 'novo',
          adicionado_em: new Date().toISOString(),
        }))

      if (!novos.length) { toast('Nenhum novo decisor encontrado', { icon: 'ℹ️' }); return }
      persistir({ ...dados, contatos: [...dados.contatos, ...novos] })
      toast.success(`+${novos.length} novo${novos.length !== 1 ? 's' : ''} decisor${novos.length !== 1 ? 'es' : ''}`)
    } catch (err) {
      toast.error(err.message || 'Erro ao buscar')
    } finally {
      setBuscandoId(null)
    }
  }

  // ── Remover empresa e seus contatos ─────────────────────────────────────
  function removerEmpresa(id) {
    if (!window.confirm('Remover empresa e todos os contatos?')) return
    persistir({
      empresas: dados.empresas.filter(e => e.id !== id),
      contatos: dados.contatos.filter(c => c.empresa_id !== id),
    })
    if (filtroEmpresa === id) setFiltroEmpresa('todas')
  }

  // ── Enriquecimento Proxycurl ─────────────────────────────────────────────
  const enrichirContato = useCallback(async (contato) => {
    if (!contato.linkedin) { toast.error('Contato sem URL do LinkedIn'); return }
    if (enrichendo.has(contato.id)) return
    setEnrichendo(prev => new Set([...prev, contato.id]))
    try {
      const r = await fetch('/api/proxycurl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinUrl: contato.linkedin }),
      })
      const data = await r.json()
      if (!r.ok) { toast.error(data.error || 'Sem resultado'); return }

      setDados(prev => {
        const updated = {
          ...prev,
          contatos: prev.contatos.map(c => c.id === contato.id
            ? { ...c, email: data.email || c.email, telefone: data.telefone || c.telefone, foto: data.foto || c.foto }
            : c
          ),
        }
        saveData(updated)
        return updated
      })
      toast.success(`Enriquecido! ${data.email ? '📧' : ''}${data.telefone ? '📞' : ''}`)
    } catch (err) {
      toast.error(err.message || 'Erro ao enriquecer')
    } finally {
      setEnrichendo(prev => { const s = new Set(prev); s.delete(contato.id); return s })
    }
  }, [enrichendo])

  // ── Status update ────────────────────────────────────────────────────────
  function atualizarStatus(cid, status) {
    setDados(prev => {
      const updated = { ...prev, contatos: prev.contatos.map(c => c.id === cid ? { ...c, status } : c) }
      saveData(updated)
      return updated
    })
  }

  function deletarContato(cid) {
    setDados(prev => {
      const updated = { ...prev, contatos: prev.contatos.filter(c => c.id !== cid) }
      saveData(updated)
      return updated
    })
  }

  // ── Filtered contacts ────────────────────────────────────────────────────
  const contatosFiltrados = dados.contatos.filter(c => {
    if (filtroEmpresa !== 'todas' && c.empresa_id !== filtroEmpresa) return false
    if (filtroNivel   !== 'todos' && scoreCargo(c.cargo).nivel !== filtroNivel)  return false
    if (filtroStatus  !== 'todos' && c.status !== filtroStatus)  return false
    if (busca && !norm(c.nome).includes(norm(busca)) && !norm(c.empresa_nome).includes(norm(busca))) return false
    return true
  })

  // Sort: Alta relevância primeiro, depois por empresa
  const contatosOrdenados = [...contatosFiltrados].sort((a, b) => {
    const nivelOrder = { Alta: 0, Média: 1, Baixa: 2 }
    const diff = (nivelOrder[scoreCargo(a.cargo).nivel] || 2) - (nivelOrder[scoreCargo(b.cargo).nivel] || 2)
    if (diff !== 0) return diff
    return a.empresa_nome.localeCompare(b.empresa_nome)
  })

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis = {
    empresas:    dados.empresas.length,
    contatos:    dados.contatos.length,
    decisores:   dados.contatos.filter(c => scoreCargo(c.cargo).nivel === 'Alta').length,
    comTelefone: dados.contatos.filter(c => c.telefone).length,
    comEmail:    dados.contatos.filter(c => c.email).length,
    convertidos: dados.contatos.filter(c => c.status === 'convertido').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Header titulo="Relações Comerciais" />

      {/* ── KPI Bar ── */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 20, overflowX: 'auto', flexShrink: 0 }}>
        {[
          { label: 'Empresas',    val: kpis.empresas,    cor: '#6366f1' },
          { label: 'Decisores',   val: kpis.contatos,    cor: '#a78bfa' },
          { label: 'Alta Rel.',   val: kpis.decisores,   cor: '#ef4444', icon: <FireSolid style={{ width: 13, height: 13 }} /> },
          { label: 'Telefones',   val: kpis.comTelefone, cor: '#22c55e' },
          { label: 'E-mails',     val: kpis.comEmail,    cor: '#0ea5e9' },
          { label: 'Convertidos', val: kpis.convertidos, cor: '#10b981' },
        ].map(k => (
          <div key={k.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 70 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: k.cor }}>
              {k.icon}
              <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{k.val}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{k.label}</span>
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Painel Esquerdo: Empresas ── */}
        <div style={{ width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>

          {/* Input nova empresa */}
          <div style={{ padding: '14px 14px 10px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Adicionar Empresa
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={novaEmpresa}
                onChange={e => setNovaEmpresa(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarEmpresa()}
                placeholder="Nome da empresa..."
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', minWidth: 0 }}
              />
              <button onClick={adicionarEmpresa} disabled={!novaEmpresa.trim() || buscandoId !== null}
                style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#6366f1', cursor: 'pointer', flexShrink: 0 }}>
                {buscandoId !== null && dados.empresas.every(e => e.id !== buscandoId)
                  ? <ArrowPathIcon style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                  : <PlusIcon style={{ width: 14, height: 14 }} />}
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.4 }}>
              Busca decisores no LinkedIn (Camada 2). Enriqueça com Proxycurl para telefone.
            </div>
          </div>

          {/* Filtro: Todas */}
          <button onClick={() => setFiltroEmpresa('todas')}
            style={{ margin: '0 10px 4px', padding: '7px 10px', borderRadius: 8, textAlign: 'left', border: 'none', cursor: 'pointer',
              background: filtroEmpresa === 'todas' ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: filtroEmpresa === 'todas' ? '#6366f1' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Todas as empresas</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>{dados.contatos.length}</span>
            </div>
          </button>

          {/* Lista de empresas */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 14px' }}>
            {dados.empresas.length === 0
              ? <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                  <BuildingOffice2Icon style={{ width: 28, height: 28, margin: '0 auto 8px', opacity: 0.2 }} />
                  <div>Adicione uma empresa acima para começar</div>
                </div>
              : dados.empresas.map(emp => {
                  const total = dados.contatos.filter(c => c.empresa_id === emp.id).length
                  const ativo = filtroEmpresa === emp.id
                  const buscando = buscandoId === emp.id
                  return (
                    <div key={emp.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 8, marginBottom: 2, cursor: 'pointer',
                        background: ativo ? 'rgba(99,102,241,0.12)' : 'transparent', border: ativo ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent' }}
                      onClick={() => setFiltroEmpresa(ativo ? 'todas' : emp.id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: ativo ? '#6366f1' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.nome}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>{total} decisor{total !== 1 ? 'es' : ''}</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); rebuscarEmpresa(emp) }} disabled={buscando} title="Rebuscar decisores"
                        style={{ padding: 3, borderRadius: 5, background: 'none', border: 'none', cursor: buscando ? 'default' : 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}>
                        <ArrowPathIcon style={{ width: 12, height: 12, animation: buscando ? 'spin 1s linear infinite' : 'none' }} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); removerEmpresa(emp.id) }} title="Remover"
                        style={{ padding: 3, borderRadius: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}>
                        <XMarkIcon style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  )
                })
            }
          </div>
        </div>

        {/* ── Painel Direito: Contatos ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Filtros */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <FunnelIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)', flexShrink: 0 }} />

            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou empresa..."
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', width: 220 }} />

            {[
              { label: 'Todos', val: 'todos', state: filtroNivel, set: setFiltroNivel, options: ['todos', 'Alta', 'Média', 'Baixa'], color: '#6366f1' },
            ].map(f => (
              <select key={f.label} value={f.state} onChange={e => f.set(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                <option value="todos">Toda relevância</option>
                <option value="Alta">🔥 Alta</option>
                <option value="Média">⚡ Média</option>
                <option value="Baixa">· Baixa</option>
              </select>
            ))}

            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
              <option value="todos">Todo status</option>
              {PIPELINE.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>

            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
              {contatosOrdenados.length} contato{contatosOrdenados.length !== 1 ? 's' : ''}
            </span>

            {!dados.contatos.some(c => c.linkedin && !c.email && !c.telefone) ? null : (
              <div style={{ padding: '4px 10px', borderRadius: 7, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
                💡 Configure PROXYCURL_API_KEY para enriquecer com telefone + e-mail
              </div>
            )}
          </div>

          {/* Tabela */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {contatosOrdenados.length === 0
              ? <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                  <UserGroupIcon style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.15 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                    {dados.contatos.length === 0 ? 'Nenhum decisor ainda' : 'Nenhum resultado para os filtros'}
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {dados.contatos.length === 0
                      ? 'Adicione uma empresa no painel esquerdo para começar a identificar decisores via LinkedIn.'
                      : 'Ajuste os filtros para ver mais contatos.'}
                  </div>
                </div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                      {['Decisor', 'Empresa', 'Relevância', 'Telefone', 'E-mail', 'Status', 'Ações'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contatosOrdenados.map(c => (
                      <ContatoRow
                        key={c.id}
                        c={c}
                        onEnriquecer={enrichirContato}
                        enrichendo={enrichendo}
                        onStatus={atualizarStatus}
                        onDeletar={deletarContato}
                      />
                    ))}
                  </tbody>
                </table>
            }
          </div>

          {/* Footer */}
          {dados.contatos.length > 0 && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <CheckCircleIcon style={{ width: 13, height: 13 }} />
              Dados armazenados localmente · LinkedIn via Serper · Enriquecimento via Proxycurl
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
