import { useState } from 'react'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6','#84cc16','#f97316']
const AVATARS = ['😀','😎','🤩','🦁','🐸','🦊','🐼','🦄','🚀','⭐','🔥','💎']

function PersonModal({ person, onClose, onSave }) {
  const [form, setForm] = useState(person || { nome: '', apelido: '', cor: COLORS[0], avatar: '', telefone: '' })

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
            <label className="label">WhatsApp <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>— para usar pelo WhatsApp</span></label>
            <input className="input" value={form.telefone || ''} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="5511999999999 (com DDI e DDD)" />
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
  const { people, addPerson, updatePerson, deletePerson, setOwnerId, expenses } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmOwner, setConfirmOwner] = useState(null)

  const owner = people.find(p => p.is_owner)
  const amigos = people.filter(p => !p.is_owner)

  function handleSave(data) {
    if (editing) updatePerson(editing.id, data)
    else addPerson(data)
    setShowModal(false); setEditing(null)
  }

  function getPersonStats(personId) {
    const participates = expenses.filter(e => e.participantes?.includes(personId)).length
    return { participates }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Pessoas" subtitle="Amigos e contatos para divisão de despesas" action={{ label: 'Novo Amigo', onClick: () => { setEditing(null); setShowModal(true) } }} />

      <div style={{ padding: '24px 28px' }}>

        {/* Dono da conta */}
        {owner && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              👑 Dono da conta
            </div>
            <div className="card" style={{ padding: 20, border: `1.5px solid ${owner.cor}55`, background: `linear-gradient(135deg, ${owner.cor}12, ${owner.cor}04)`, maxWidth: 340 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: owner.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: owner.avatar?.length > 1 ? 22 : 18, fontWeight: 700, color: 'white', border: `3px solid ${owner.cor}` }}>
                    {owner.avatar || owner.nome[0]}
                  </div>
                  <div style={{ position: 'absolute', top: -6, right: -6, fontSize: 16 }}>👑</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{owner.nome}</div>
                  {owner.apelido && owner.apelido !== owner.nome && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>"{owner.apelido}"</div>
                  )}
                  <div style={{ fontSize: 11, color: owner.cor, fontWeight: 600, marginTop: 3 }}>Dono da conta · todos os cálculos são na sua perspectiva</div>
                </div>
                <button
                  onClick={() => { setEditing(owner); setShowModal(true) }}
                  style={{ background: `${owner.cor}20`, border: `1px solid ${owner.cor}40`, borderRadius: 7, padding: 7, cursor: 'pointer', color: owner.cor, display: 'flex' }}
                >
                  <PencilIcon style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Amigos */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Amigos e contatos
        </div>
        {amigos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nenhum amigo cadastrado</div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>Adicione as pessoas com quem você divide despesas</div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {amigos.map(person => {
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
                    <button
                      onClick={() => setConfirmOwner(person)}
                      title="Definir como dono da conta"
                      style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 7, padding: 6, cursor: 'pointer', color: '#f59e0b', display: 'flex', fontSize: 13 }}
                    >
                      👑
                    </button>
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

      {confirmOwner && (
        <div className="modal-overlay" onClick={() => setConfirmOwner(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 28px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👑</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Definir {confirmOwner.nome} como dono?</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
                Todos os cálculos — "você recebe", "sua parte", perspectiva das despesas — passarão a ser na visão de <strong>{confirmOwner.nome}</strong>.
                <br />
                {owner && <span>O papel de <strong>{owner.nome}</strong> como dono será removido.</span>}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn-ghost" onClick={() => setConfirmOwner(null)}>Cancelar</button>
                <button className="btn-primary" onClick={() => { setOwnerId(confirmOwner.id); setConfirmOwner(null) }}>
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
