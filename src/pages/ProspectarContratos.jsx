import { useState, useEffect } from 'react'
import Header from '../components/Header'
import {
  PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon,
  XCircleIcon, ClockIcon, PauseCircleIcon, DocumentTextIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'

// ─── Constantes ────────────────────────────────────────────────────────────────
const METODOS = [
  { id: 'b2b',            label: 'B2B Direto',        emoji: '🏢', cor: '#6366f1' },
  { id: 'inside_sales',   label: 'Inside Sales',       emoji: '📞', cor: '#0ea5e9' },
  { id: 'social_selling', label: 'Social Selling',     emoji: '📱', cor: '#ec4899' },
  { id: 'parceria',       label: 'Parceria Comercial', emoji: '🤝', cor: '#10b981' },
]

const STATUS_CONTRATO = [
  { id: 'em_andamento', label: 'Em andamento', cor: '#0ea5e9', bg: 'rgba(14,165,233,0.1)',  icon: ClockIcon },
  { id: 'concluido',    label: 'Concluído',    cor: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: CheckCircleIcon },
  { id: 'pausado',      label: 'Pausado',      cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: PauseCircleIcon },
  { id: 'cancelado',    label: 'Cancelado',    cor: '#ef4444', bg: 'rgba(239,68,68,0.1)',  icon: XCircleIcon },
]

const LS_KEY = 'prospectar_contratos'

function loadContratos() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] } }
function saveContratos(list) { localStorage.setItem(LS_KEY, JSON.stringify(list)) }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }
function fmtBRL(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }

const BLANK_FORM = { empresa: '', servico: '', valor: '', metodo: 'b2b', status: 'em_andamento', inicio: '', previsao: '', notas: '' }

// ─── Modal ─────────────────────────────────────────────────────────────────────
function ContratoModal({ inicial, onSave, onClose }) {
  const [form, setForm] = useState(inicial || BLANK_FORM)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 13,
    background: 'var(--bg-primary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{inicial ? 'Editar Contrato' : 'Novo Contrato'}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Empresa / Cliente *</label>
            <input value={form.empresa} onChange={e => set('empresa', e.target.value)} style={inputStyle} placeholder="Nome da empresa ou cliente" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Serviço / Produto</label>
            <input value={form.servico} onChange={e => set('servico', e.target.value)} style={inputStyle} placeholder="Descreva o serviço contratado" />
          </div>
          <div>
            <label style={labelStyle}>Valor (R$)</label>
            <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} style={inputStyle} placeholder="0" min="0" />
          </div>
          <div>
            <label style={labelStyle}>Método de captação</label>
            <select value={form.metodo} onChange={e => set('metodo', e.target.value)} style={inputStyle}>
              {METODOS.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
              {STATUS_CONTRATO.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Início</label>
            <input type="date" value={form.inicio} onChange={e => set('inicio', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Previsão de conclusão</label>
            <input type="date" value={form.previsao} onChange={e => set('previsao', e.target.value)} style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Observações</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Detalhes adicionais sobre o contrato..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => { if (!form.empresa.trim()) return; onSave(form) }}
            disabled={!form.empresa.trim()}
            style={{ padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', opacity: form.empresa.trim() ? 1 : 0.5 }}>
            {inicial ? 'Salvar alterações' : 'Adicionar contrato'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function ProspectarContratos() {
  const [contratos, setContratos] = useState([])
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroMetodo, setFiltroMetodo] = useState('todos')
  const [modal, setModal] = useState(null)   // null | 'novo' | { ...contrato }
  const [busca, setBusca] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)

  useEffect(() => { setContratos(loadContratos()) }, [])

  const atualizar = (lista) => { setContratos(lista); saveContratos(lista) }

  const adicionar = (form) => {
    const novo = { ...form, id: uid(), valor: Number(form.valor) || 0, criadoEm: new Date().toISOString() }
    atualizar([novo, ...contratos])
    setModal(null)
  }

  const editar = (form) => {
    atualizar(contratos.map(c => c.id === modal.id ? { ...c, ...form, valor: Number(form.valor) || 0 } : c))
    setModal(null)
  }

  const excluir = (id) => {
    atualizar(contratos.filter(c => c.id !== id))
    setConfirmDel(null)
  }

  const filtrados = contratos
    .filter(c => filtroStatus === 'todos' || c.status === filtroStatus)
    .filter(c => filtroMetodo === 'todos' || c.metodo === filtroMetodo)
    .filter(c => !busca || c.empresa.toLowerCase().includes(busca.toLowerCase()) || (c.servico || '').toLowerCase().includes(busca.toLowerCase()))

  const totalValor = filtrados.reduce((s, c) => s + (Number(c.valor) || 0), 0)

  const cardStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }

  return (
    <div>
      <Header title="Contratos" subtitle="Registro de contratos fechados e em andamento" />

      <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── KPIs rápidos ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {STATUS_CONTRATO.map(s => {
            const count = contratos.filter(c => c.status === s.id).length
            const valor = contratos.filter(c => c.status === s.id).reduce((sum, c) => sum + (Number(c.valor) || 0), 0)
            return (
              <div key={s.id} style={{ ...cardStyle, cursor: 'pointer', borderColor: filtroStatus === s.id ? s.cor : 'var(--border)' }}
                onClick={() => setFiltroStatus(filtroStatus === s.id ? 'todos' : s.id)}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <s.icon style={{ width: 16, height: 16, color: s.cor }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: s.cor }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{count}</div>
                {valor > 0 && <div style={{ fontSize: 11, color: '#10b981', marginTop: 3 }}>{fmtBRL(valor)}</div>}
              </div>
            )
          })}
        </div>

        {/* ── Filtros + Ação ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar empresa ou serviço..."
            style={{ flex: 1, minWidth: 200, padding: '9px 14px', borderRadius: 9, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
          <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 9, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <option value="todos">Todos os métodos</option>
            {METODOS.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>)}
          </select>
          <button onClick={() => setModal('novo')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <PlusIcon style={{ width: 15, height: 15 }} /> Novo contrato
          </button>
        </div>

        {/* ── Lista ─────────────────────────────────────────────────────────── */}
        {filtrados.length === 0
          ? <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
              <DocumentTextIcon style={{ width: 40, height: 40, opacity: 0.25, margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14 }}>Nenhum contrato encontrado.</div>
              <button onClick={() => setModal('novo')} style={{ marginTop: 14, padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#6366f1', cursor: 'pointer' }}>
                + Registrar contrato
              </button>
            </div>
          : <>
              {filtrados.length > 0 && totalValor > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#10b981', fontWeight: 700 }}>
                  <CurrencyDollarIcon style={{ width: 14, height: 14 }} />
                  Total filtrado: {fmtBRL(totalValor)}
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({filtrados.length} contrato{filtrados.length !== 1 ? 's' : ''})</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtrados.map(c => {
                  const m = METODOS.find(x => x.id === c.metodo) || METODOS[0]
                  const st = STATUS_CONTRATO.find(x => x.id === c.status) || STATUS_CONTRATO[0]
                  return (
                    <div key={c.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <span style={{ fontSize: 22, flexShrink: 0, paddingTop: 2 }}>{m.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 800 }}>{c.empresa}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: st.cor, padding: '2px 9px', borderRadius: 20, background: st.bg }}>{st.label}</span>
                          <span style={{ fontSize: 11, color: m.cor, padding: '2px 9px', borderRadius: 20, background: `${m.cor}15` }}>{m.emoji} {m.label}</span>
                        </div>
                        {c.servico && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>{c.servico}</div>}
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {c.valor > 0 && <span style={{ color: '#10b981', fontWeight: 700 }}>💰 {fmtBRL(c.valor)}</span>}
                          {c.inicio && <span>📅 Início: {c.inicio}</span>}
                          {c.previsao && <span>🏁 Previsão: {c.previsao}</span>}
                        </div>
                        {c.notas && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, fontStyle: 'italic' }}>{c.notas}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => setModal(c)}
                          style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                          <PencilIcon style={{ width: 13, height: 13 }} />
                        </button>
                        <button onClick={() => setConfirmDel(c.id)}
                          style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                          <TrashIcon style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
        }
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {modal === 'novo' && <ContratoModal onSave={adicionar} onClose={() => setModal(null)} />}
      {modal && modal !== 'novo' && <ContratoModal inicial={modal} onSave={editar} onClose={() => setModal(null)} />}

      {confirmDel && (
        <div onClick={() => setConfirmDel(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Excluir contrato?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)' }}>Esta ação não pode ser desfeita.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDel(null)} style={{ padding: '9px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => excluir(confirmDel)} style={{ padding: '9px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13, background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
