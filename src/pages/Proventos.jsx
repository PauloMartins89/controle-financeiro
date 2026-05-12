import { useState } from 'react'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { formatCurrency, formatDate } from '../lib/utils'
import { PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'

const CATEGORIAS = ['Receita de Vendas','Lucro','Dividendos','Pró-labore','Comissão','Assinaturas','Outros']
const TIPOS = [
  { value: 'receita', label: 'Receita', color: '#10b981' },
  { value: 'distribuicao', label: 'Distribuição', color: '#6366f1' },
  { value: 'pro_labore', label: 'Pró-labore', color: '#8b5cf6' },
]
const STATUS = [
  { value: 'pendente', label: 'Pendente', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { value: 'distribuido', label: 'Distribuído', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  { value: 'pago', label: 'Pago', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
]

function ProventoModal({ provento, onClose, onSave, negocios }) {
  const [form, setForm] = useState(provento ? { ...provento } : {
    negocio_id: negocios[0]?.id || '',
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    categoria: 'Receita de Vendas',
    tipo: 'receita',
    status: 'pendente',
    observacoes: '',
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{provento ? 'Editar Provento' : 'Novo Provento'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><XMarkIcon style={{ width: 22, height: 22 }} /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Negócio *</label>
            <select className="input" value={form.negocio_id} onChange={e => setForm(f => ({ ...f, negocio_id: e.target.value }))}>
              {negocios.map(n => <option key={n.id} value={n.id}>{n.icone} {n.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Descrição *</label>
            <input className="input" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Lucro mensal, Dividendo Q2, Pró-labore..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input" type="number" min="0" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: parseFloat(e.target.value) || '' }))} placeholder="0,00" />
            </div>
            <div>
              <label className="label">Data</label>
              <input className="input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Observações</label>
            <input className="input" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Notas adicionais..." />
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => form.negocio_id && form.descricao && form.valor && onSave(form)}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function DistribuicaoPanel({ proventoId }) {
  const { calcularDistribuicao, people } = useStore()
  const shares = calcularDistribuicao(proventoId)
  if (!shares.length) return null

  return (
    <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.05)', borderTop: '1px solid rgba(99,102,241,0.15)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', alignSelf: 'center' }}>Distribuição:</span>
      {shares.map(s => {
        const pessoa = people.find(p => p.id === s.pessoa_id)
        if (!pessoa) return null
        return (
          <div key={s.pessoa_id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${pessoa.cor}18`, border: `1px solid ${pessoa.cor}44`, borderRadius: 8, padding: '4px 10px' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: pessoa.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white' }}>{pessoa.avatar}</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{pessoa.nome.split(' ')[0]}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.percentual}%</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>{formatCurrency(s.valor)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function Proventos() {
  const { proventos, negocios, addProvento, updateProvento, deleteProvento, distribuirProvento, calcularDistribuicao, people } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filterNeg, setFilterNeg] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  function handleSave(data) {
    if (editing) updateProvento(editing.id, data)
    else addProvento(data)
    setShowModal(false); setEditing(null)
  }

  const filtered = proventos.filter(p => {
    if (filterNeg && p.negocio_id !== filterNeg) return false
    if (filterTipo && p.tipo !== filterTipo) return false
    if (filterStatus && p.status !== filterStatus) return false
    if (search && !p.descricao.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }).sort((a, b) => new Date(b.data) - new Date(a.data))

  const totalReceita = proventos.reduce((s, p) => s + p.valor, 0)
  const totalDistribuido = proventos.filter(p => p.status === 'distribuido' || p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const totalPendente = proventos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)

  // My share from pending proventos
  const { currentUser } = useStore()
  const minhaParticipacaoPendente = proventos
    .filter(p => p.status === 'pendente')
    .reduce((total, p) => {
      const neg = negocios.find(n => n.id === p.negocio_id)
      const socio = neg?.socios?.find(s => s.pessoa_id === currentUser?.id)
      return total + (socio ? (p.valor * socio.percentual) / 100 : 0)
    }, 0)

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Proventos" subtitle="Receitas e distribuições dos negócios" action={{ label: 'Novo Provento', onClick: () => { setEditing(null); setShowModal(true) } }} />

      <div style={{ padding: '24px 28px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Receita total', value: totalReceita, color: '#10b981', icon: '💰' },
            { label: 'Já distribuído', value: totalDistribuido, color: '#6366f1', icon: '✅' },
            { label: 'A distribuir', value: totalPendente, color: '#f59e0b', icon: '⏳' },
            { label: 'Minha part. pendente', value: minhaParticipacaoPendente, color: '#8b5cf6', icon: '👤' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color, borderRadius: '16px 16px 0 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{formatCurrency(s.value)}</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar provento..." style={{ flex: 1, minWidth: 200 }} />
          <select className="input" value={filterNeg} onChange={e => setFilterNeg(e.target.value)} style={{ width: 180 }}>
            <option value="">Todos os negócios</option>
            {negocios.map(n => <option key={n.id} value={n.id}>{n.icone} {n.nome}</option>)}
          </select>
          <select className="input" value={filterTipo} onChange={e => setFilterTipo(e.target.value)} style={{ width: 160 }}>
            <option value="">Todos os tipos</option>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 160 }}>
            <option value="">Todos os status</option>
            {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(prov => {
            const neg = negocios.find(n => n.id === prov.negocio_id)
            const tipo = TIPOS.find(t => t.value === prov.tipo)
            const stat = STATUS.find(s => s.value === prov.status)

            return (
              <div key={prov.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
                  {/* Negocio icon */}
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg, ${neg?.cor || '#6366f1'}, ${neg?.cor || '#6366f1'}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {neg?.icone || '💼'}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{prov.descricao}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${tipo?.color}18`, color: tipo?.color, border: `1px solid ${tipo?.color}30` }}>{tipo?.label || prov.tipo}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{neg?.nome}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>•</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{prov.categoria}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>•</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(prov.data)}</span>
                    </div>
                  </div>

                  {/* Right side */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#10b981' }}>{formatCurrency(prov.valor)}</div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: stat?.bg, color: stat?.color, border: `1px solid ${stat?.color}30`, marginTop: 2 }}>{stat?.label}</div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {prov.status === 'pendente' && (
                        <button onClick={() => distribuirProvento(prov.id)} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#10b981', fontSize: 12, fontWeight: 600 }}>
                          Distribuir ✓
                        </button>
                      )}
                      <button onClick={() => { setEditing(prov); setShowModal(true) }} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#818cf8', display: 'flex' }}>
                        <PencilIcon style={{ width: 14, height: 14 }} />
                      </button>
                      <button onClick={() => deleteProvento(prov.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                        <TrashIcon style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Distribution breakdown */}
                <DistribuicaoPanel proventoId={prov.id} />
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum provento encontrado</div>
              <div style={{ fontSize: 13 }}>Registre receitas e distribuições dos seus negócios.</div>
            </div>
          )}
        </div>
      </div>

      {showModal && <ProventoModal provento={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSave={handleSave} negocios={negocios} />}
    </div>
  )
}
