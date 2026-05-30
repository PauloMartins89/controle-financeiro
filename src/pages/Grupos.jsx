import { useState } from 'react'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { formatCurrency, getCategoryIcon } from '../lib/utils'
import { PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'

const ICONS = ['🏠','🏖️','🚗','💳','🥩','🎉','🏥','🎓','✈️','🛍️','🏋️','🎮','🍔','☕','🎸','🌴','🏕️','💼','🐾','📱','🔧','👶','⚡','🎬','🌿','🏦','🍕','🧴']
const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6','#84cc16','#f97316']

const PREDEFINIDOS = [
  { nome: 'Moradia',       icone: '🏠', cor: '#6366f1', descricao: 'Aluguel, condomínio, contas da casa' },
  { nome: 'Mercado',       icone: '🛒', cor: '#10b981', descricao: 'Supermercado e compras do mês' },
  { nome: 'Alimentação',   icone: '🍔', cor: '#f59e0b', descricao: 'Restaurantes, delivery, lanchonetes' },
  { nome: 'Transporte',    icone: '🚗', cor: '#3b82f6', descricao: 'Combustível, Uber, estacionamento' },
  { nome: 'Saúde',         icone: '🏥', cor: '#ec4899', descricao: 'Plano, consultas, farmácia' },
  { nome: 'Educação',      icone: '🎓', cor: '#8b5cf6', descricao: 'Cursos, mensalidades, livros' },
  { nome: 'Viagem',        icone: '✈️', cor: '#06b6d4', descricao: 'Passagens, hotéis, passeios' },
  { nome: 'Lazer',         icone: '🎮', cor: '#f97316', descricao: 'Entretenimento, games, cinema' },
  { nome: 'Churrasco',     icone: '🥩', cor: '#ef4444', descricao: 'Churrascos e eventos culinários' },
  { nome: 'Pets',          icone: '🐾', cor: '#84cc16', descricao: 'Vet, ração, banho e tosa' },
  { nome: 'Assinaturas',   icone: '📱', cor: '#6366f1', descricao: 'Streaming, apps, serviços digitais' },
  { nome: 'Reformas',      icone: '🔧', cor: '#f59e0b', descricao: 'Obras, materiais, mão de obra' },
  { nome: 'Filhos',        icone: '👶', cor: '#ec4899', descricao: 'Escola, fraldas, atividades' },
  { nome: 'Academia',      icone: '🏋️', cor: '#10b981', descricao: 'Mensalidade e suplementos' },
  { nome: 'Festas',        icone: '🎉', cor: '#8b5cf6', descricao: 'Aniversários e comemorações' },
  { nome: 'Trabalho',      icone: '💼', cor: '#3b82f6', descricao: 'Despesas profissionais' },
  { nome: 'Praia / Verão', icone: '🏖️', cor: '#06b6d4', descricao: 'Temporada de verão' },
  { nome: 'Camping',       icone: '🏕️', cor: '#84cc16', descricao: 'Acampamentos e trilhas' },
]

function GroupModal({ group, onClose, onSave }) {
  const [form, setForm] = useState(group || { nome: '', cor: COLORS[0], icone: ICONS[0], descricao: '' })
  const [showPredefinidos, setShowPredefinidos] = useState(!group)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{group ? 'Editar Grupo' : 'Novo Grupo'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><XMarkIcon style={{ width: 22, height: 22 }} /></button>
        </div>

        {/* ── Templates predefinidos ── */}
        {!group && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
            <button
              type="button"
              onClick={() => setShowPredefinidos(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: showPredefinidos ? 12 : 0 }}
            >
              <span>{showPredefinidos ? '▾' : '▸'}</span> Usar template predefinido
            </button>
            {showPredefinidos && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {PREDEFINIDOS.map(t => (
                  <button
                    key={t.nome}
                    type="button"
                    onClick={() => { setForm({ nome: t.nome, cor: t.cor, icone: t.icone, descricao: t.descricao }); setShowPredefinidos(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
                      borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      background: form.nome === t.nome ? `${t.cor}18` : 'var(--bg-secondary)',
                      border: `1px solid ${form.nome === t.nome ? t.cor + '50' : 'var(--border)'}`,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${t.cor}14`}
                    onMouseLeave={e => e.currentTarget.style.background = form.nome === t.nome ? `${t.cor}18` : 'var(--bg-secondary)'}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${t.cor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{t.icone}</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{t.nome}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Preview */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 70, height: 70, borderRadius: 18, background: form.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
              {form.icone}
            </div>
          </div>
          <div>
            <label className="label">Nome do grupo *</label>
            <input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Casa, Viagem Praia..." />
          </div>
          <div>
            <label className="label">Ícone</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setForm(f => ({ ...f, icone: ic }))} style={{ width: 38, height: 38, borderRadius: 8, fontSize: 20, cursor: 'pointer', background: form.icone === ic ? 'rgba(99,102,241,0.2)' : 'var(--bg-secondary)', border: form.icone === ic ? '1px solid #6366f1' : '1px solid var(--border)' }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Cor</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setForm(f => ({ ...f, cor: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: form.cor === c ? '3px solid white' : '3px solid transparent', transform: form.cor === c ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.15s' }} />
              ))}
            </div>
          </div>
          <div>
            <label className="label">Descrição</label>
            <input className="input" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Opcional..." />
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

export default function Grupos() {
  const { groups, expenses, addGroup, updateGroup, deleteGroup } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  function handleSave(data) {
    if (editing) updateGroup(editing.id, data)
    else addGroup(data)
    setShowModal(false); setEditing(null)
  }

  function getGroupStats(groupId) {
    const gExp = expenses.filter(e => e.grupo_id === groupId)
    const total = gExp.reduce((s, e) => s + e.valor, 0)
    const pendente = gExp.filter(e => e.status !== 'pago').reduce((s, e) => s + e.valor, 0)
    return { count: gExp.length, total, pendente }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Grupos" subtitle="Organize despesas por grupo" action={{ label: 'Novo Grupo', onClick: () => { setEditing(null); setShowModal(true) } }} />

      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {groups.map(group => {
            const stats = getGroupStats(group.id)
            return (
              <div key={group.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Top bar */}
                <div style={{ height: 6, background: group.cor }} />
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: `${group.cor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                      {group.icone}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{group.nome}</div>
                      {group.descricao && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{group.descricao}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setEditing(group); setShowModal(true) }} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 7, padding: 6, cursor: 'pointer', color: '#818cf8', display: 'flex' }}>
                        <PencilIcon style={{ width: 14, height: 14 }} />
                      </button>
                      <button onClick={() => deleteGroup(group.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: 6, cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                        <TrashIcon style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Despesas</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{stats.count}</div>
                    </div>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#6366f1', marginTop: 2 }}>{formatCurrency(stats.total)}</div>
                    </div>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Pendente</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', marginTop: 2 }}>{formatCurrency(stats.pendente)}</div>
                    </div>
                  </div>
                  {/* Last expenses */}
                  <div style={{ marginTop: 12 }}>
                    {expenses.filter(e => e.grupo_id === group.id).slice(0, 2).map(exp => (
                      <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 14 }}>{getCategoryIcon(exp.categoria)}</span>
                        <span style={{ fontSize: 12, flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.descricao}</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(exp.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showModal && <GroupModal group={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSave={handleSave} />}
    </div>
  )
}
