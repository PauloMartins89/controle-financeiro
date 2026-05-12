import { useState } from 'react'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { PencilIcon, TrashIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6','#84cc16','#f97316']
const AVATARS = ['😀','😎','🤩','🦁','🐸','🦊','🐼','🦄','🚀','⭐','🔥','💎']

function PersonModal({ person, onClose, onSave }) {
  const [form, setForm] = useState(person || { nome: '', apelido: '', cor: COLORS[0], avatar: '' })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{person ? 'Editar Pessoa' : 'Nova Pessoa'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <XMarkIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Preview */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: form.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: form.avatar?.length > 1 ? 28 : 22, fontWeight: 700, color: 'white', border: '3px solid rgba(255,255,255,0.15)' }}>
              {form.avatar || form.nome?.[0]?.toUpperCase() || '?'}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Nome *</label>
              <input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div>
              <label className="label">Apelido</label>
              <input className="input" value={form.apelido} onChange={e => setForm(f => ({ ...f, apelido: e.target.value }))} placeholder="Como chamar" />
            </div>
          </div>
          <div>
            <label className="label">Cor</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setForm(f => ({ ...f, cor: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: form.cor === c ? '3px solid white' : '3px solid transparent', transition: 'transform 0.15s', transform: form.cor === c ? 'scale(1.2)' : 'scale(1)' }} />
              ))}
            </div>
          </div>
          <div>
            <label className="label">Avatar (emoji)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {AVATARS.map(a => (
                <button key={a} type="button" onClick={() => setForm(f => ({ ...f, avatar: a }))} style={{ width: 36, height: 36, borderRadius: 8, fontSize: 18, cursor: 'pointer', background: form.avatar === a ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', border: form.avatar === a ? '1px solid #6366f1' : '1px solid var(--border)' }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => form.nome && onSave(form)}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Pessoas() {
  const { people, addPerson, updatePerson, deletePerson, expenses } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  function handleSave(data) {
    if (editing) updatePerson(editing.id, data)
    else addPerson(data)
    setShowModal(false); setEditing(null)
  }

  function getPersonStats(personId) {
    const paid = expenses.filter(e => e.pago_por === personId && e.status !== 'pago').reduce((s, e) => s + e.valor, 0)
    const participates = expenses.filter(e => e.participantes?.includes(personId)).length
    return { paid, participates }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Pessoas" subtitle="Gerencie os participantes" action={{ label: 'Nova Pessoa', onClick: () => { setEditing(null); setShowModal(true) } }} />

      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {people.map(person => {
            const stats = getPersonStats(person.id)
            return (
              <div key={person.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: person.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: person.avatar?.length > 1 ? 22 : 18, fontWeight: 700, color: 'white', border: '3px solid rgba(255,255,255,0.1)' }}>
                    {person.avatar || person.nome[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{person.nome}</div>
                    {person.apelido && person.apelido !== person.nome && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>"{person.apelido}"</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setEditing(person); setShowModal(true) }} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 7, padding: 6, cursor: 'pointer', color: '#818cf8', display: 'flex' }}>
                      <PencilIcon style={{ width: 14, height: 14 }} />
                    </button>
                    <button onClick={() => deletePerson(person.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: 6, cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                      <TrashIcon style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Pagou</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginTop: 2 }}>
                      {expenses.filter(e => e.pago_por === person.id).length} despesas
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Participa</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#6366f1', marginTop: 2 }}>
                      {stats.participates} despesas
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showModal && <PersonModal person={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSave={handleSave} />}
    </div>
  )
}
