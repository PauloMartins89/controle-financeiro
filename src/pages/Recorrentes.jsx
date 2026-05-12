import { useState } from 'react'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { formatCurrency, CATEGORIAS } from '../lib/utils'
import { PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'

function RecurringModal({ item, onClose, onSave }) {
  const { groups } = useStore()
  const [form, setForm] = useState(item || { descricao: '', valor: '', dia_vencimento: 5, categoria: 'Serviços', grupo_id: '', ativo: true })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{item ? 'Editar Recorrente' : 'Nova Conta Recorrente'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><XMarkIcon style={{ width: 22, height: 22 }} /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Descrição *</label>
              <input className="input" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel, Netflix..." />
            </div>
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input" type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Dia de vencimento</label>
              <input className="input" type="number" min="1" max="28" value={form.dia_vencimento} onChange={e => setForm(f => ({ ...f, dia_vencimento: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Grupo</label>
              <select className="input" value={form.grupo_id} onChange={e => setForm(f => ({ ...f, grupo_id: e.target.value }))}>
                <option value="">— Sem grupo —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.icone} {g.nome}</option>)}
              </select>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#6366f1' }} />
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Conta ativa</span>
          </label>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => form.descricao && onSave({ ...form, valor: parseFloat(form.valor) || 0 })}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Recorrentes() {
  const { recurring, groups, addRecurring, updateRecurring, deleteRecurring } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const ativas = recurring.filter(r => r.ativo)
  const inativas = recurring.filter(r => !r.ativo)
  const totalMensal = ativas.reduce((s, r) => s + r.valor, 0)

  function handleSave(data) {
    if (editing) updateRecurring(editing.id, data)
    else addRecurring(data)
    setShowModal(false); setEditing(null)
  }

  const sorted = [...recurring].sort((a, b) => a.dia_vencimento - b.dia_vencimento)

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Contas Recorrentes" subtitle="Despesas fixas e mensais" action={{ label: 'Nova Recorrente', onClick: () => { setEditing(null); setShowModal(true) } }} />

      <div style={{ padding: '24px 28px' }}>
        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="stat-card">
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #8b5cf6, #6366f1)', borderRadius: '16px 16px 0 0' }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Total mensal</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(totalMensal)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{formatCurrency(totalMensal * 12)} / ano</div>
          </div>
          <div className="stat-card">
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '16px 16px 0 0' }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Contas ativas</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981' }}>{ativas.length}</div>
          </div>
          <div className="stat-card">
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #94a3b8, #64748b)', borderRadius: '16px 16px 0 0' }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Inativas</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-secondary)' }}>{inativas.length}</div>
          </div>
        </div>

        {/* Calendar-like view */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Calendário de vencimentos</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Ordenado por dia do mês</div>
          </div>
          <div style={{ padding: 16, display: 'flex', gap: 8, overflowX: 'auto' }}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map(dia => {
              const items = ativas.filter(r => r.dia_vencimento === dia)
              return (
                <div key={dia} style={{ minWidth: 42, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: items.length ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: items.length ? 700 : 400, marginBottom: 4 }}>
                    {dia}
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: items.length ? '#6366f1' : 'rgba(255,255,255,0.06)' }} />
                  {items.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 10, color: '#818cf8', fontWeight: 600 }}>{items.length}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '2.5fr 130px 130px 150px 140px 90px', background: 'rgba(255,255,255,0.02)', alignItems: 'center' }}>
            {['Descrição','Valor','Vencimento','Categoria','Grupo','Ações'].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>

          {sorted.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
              Nenhuma conta recorrente. Clique em "Nova Recorrente" para adicionar.
            </div>
          )}

          {sorted.map((item, i) => {
            const grupo = groups.find(g => g.id === item.grupo_id)
            return (
              <div key={item.id} style={{
                display: 'grid',
                gridTemplateColumns: '2.5fr 130px 130px 150px 140px 90px',
                padding: '13px 20px',
                borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
                opacity: item.ativo ? 1 : 0.45,
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Descrição */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>🔁</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</div>
                    {!item.ativo && <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 4, padding: '1px 6px' }}>Inativa</span>}
                  </div>
                </div>

                {/* Valor */}
                <div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>
                  {formatCurrency(item.valor)}
                </div>

                {/* Vencimento */}
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Todo dia <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.dia_vencimento}</span>
                </div>

                {/* Categoria */}
                <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.categoria}
                </div>

                {/* Grupo */}
                <div>
                  {grupo
                    ? <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', whiteSpace: 'nowrap' }}>{grupo.icone} {grupo.nome}</span>
                    : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>}
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: 5 }}>
                  <button title="Editar" onClick={() => { setEditing(item); setShowModal(true) }}
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 7, padding: '6px', cursor: 'pointer', color: '#818cf8', display: 'flex', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                  >
                    <PencilIcon style={{ width: 14, height: 14 }} />
                  </button>
                  <button title="Excluir" onClick={() => deleteRecurring(item.id)}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '6px', cursor: 'pointer', color: '#ef4444', display: 'flex', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  >
                    <TrashIcon style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Footer */}
          {sorted.length > 0 && (
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)' }}>
              <span>{sorted.length} conta{sorted.length !== 1 ? 's' : ''}</span>
              <span>Total mensal: <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(totalMensal)}</span></span>
            </div>
          )}
        </div>
      </div>

      {showModal && <RecurringModal item={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSave={handleSave} />}
    </div>
  )
}
