import { useState } from 'react'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { formatCurrency } from '../lib/utils'
import { PencilIcon, TrashIcon, XMarkIcon, PlusIcon, MinusCircleIcon } from '@heroicons/react/24/outline'

const TIPOS = [
  { value: 'empresa', label: '🏢 Empresa' },
  { value: 'freelance', label: '💼 Freelance / Parceria' },
  { value: 'investimento', label: '📈 Investimento' },
  { value: 'imobiliario', label: '🏠 Imobiliário' },
  { value: 'outro', label: '📦 Outro' },
]
const ICONS_NEG = ['🛒','🍽️','💻','🏪','🏗️','📱','🎬','🏋️','🚗','✈️','🏠','📊','🎵','🌱','⚡','🔧']
const COLORS_NEG = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6','#f97316','#84cc16']

function NegocioModal({ negocio, onClose, onSave }) {
  const { people } = useStore()
  const [form, setForm] = useState(negocio ? { ...negocio } : {
    nome: '', descricao: '', cor: COLORS_NEG[0], icone: ICONS_NEG[0],
    tipo: 'empresa', ativo: true,
    socios: [{ pessoa_id: people[0]?.id || '', percentual: 100 }],
  })

  function addSocio() {
    setForm(f => ({ ...f, socios: [...f.socios, { pessoa_id: '', percentual: 0 }] }))
  }
  function removeSocio(i) {
    setForm(f => ({ ...f, socios: f.socios.filter((_, idx) => idx !== i) }))
  }
  function updateSocio(i, field, value) {
    setForm(f => ({
      ...f,
      socios: f.socios.map((s, idx) => idx === i ? { ...s, [field]: value } : s)
    }))
  }

  const totalPercent = form.socios.reduce((s, x) => s + (parseFloat(x.percentual) || 0), 0)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{negocio ? 'Editar Negócio' : 'Novo Negócio'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><XMarkIcon style={{ width: 22, height: 22 }} /></button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Preview */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 70, height: 70, borderRadius: 20, background: `linear-gradient(135deg, ${form.cor}, ${form.cor}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, boxShadow: `0 8px 24px ${form.cor}44` }}>
              {form.icone}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Nome do negócio *</label>
              <input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Loja Online, Restaurante..." />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Descrição</label>
            <input className="input" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva brevemente o negócio..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="label">Ícone</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ICONS_NEG.map(ic => (
                  <button key={ic} type="button" onClick={() => setForm(f => ({ ...f, icone: ic }))} style={{ width: 36, height: 36, borderRadius: 8, fontSize: 18, cursor: 'pointer', background: form.icone === ic ? 'rgba(99,102,241,0.2)' : 'var(--bg-secondary)', border: form.icone === ic ? '1px solid #6366f1' : '1px solid var(--border)' }}>{ic}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Cor</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORS_NEG.map(c => (
                  <div key={c} onClick={() => setForm(f => ({ ...f, cor: c }))} style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer', border: form.cor === c ? '3px solid white' : '3px solid transparent', transform: form.cor === c ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.15s' }} />
                ))}
              </div>
            </div>
          </div>

          {/* Sócios */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label className="label" style={{ margin: 0 }}>Sócios e participação</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: totalPercent === 100 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                  {totalPercent}% {totalPercent !== 100 && '⚠ deve somar 100%'}
                </span>
                <button type="button" onClick={addSocio} className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>
                  <PlusIcon style={{ width: 14, height: 14 }} /> Sócio
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.socios.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="input"
                    value={s.pessoa_id}
                    onChange={e => updateSocio(i, 'pessoa_id', e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Selecionar pessoa...</option>
                    {people.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px', width: 90 }}>
                    <input
                      type="number" min="0" max="100"
                      value={s.percentual}
                      onChange={e => updateSocio(i, 'percentual', parseFloat(e.target.value) || 0)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-primary)', width: 48, fontSize: 14, outline: 'none', textAlign: 'right' }}
                    />
                    <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>%</span>
                  </div>
                  {form.socios.length > 1 && (
                    <button type="button" onClick={() => removeSocio(i)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#ef4444', display: 'flex', flexShrink: 0 }}>
                      <MinusCircleIcon style={{ width: 16, height: 16 }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#6366f1' }} />
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Negócio ativo</span>
          </label>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => form.nome && onSave(form)} disabled={totalPercent !== 100}>
            Salvar negócio
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Negocios() {
  const { negocios, proventos, people, addNegocio, updateNegocio, deleteNegocio, getProventosPorNegocio } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  function handleSave(data) {
    if (editing) updateNegocio(editing.id, data)
    else addNegocio(data)
    setShowModal(false); setEditing(null)
  }

  const totalReceita = proventos.reduce((s, p) => s + p.valor, 0)
  const totalDistribuido = proventos.filter(p => p.status === 'distribuido' || p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const totalPendente = proventos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Negócios" subtitle="Empresas e parcerias compartilhadas" action={{ label: 'Novo Negócio', onClick: () => { setEditing(null); setShowModal(true) } }} />

      <div style={{ padding: '24px 28px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Receita total', value: totalReceita, color: '#10b981', icon: '💰' },
            { label: 'Distribuído', value: totalDistribuido, color: '#6366f1', icon: '✅' },
            { label: 'Pendente distribuir', value: totalPendente, color: '#f59e0b', icon: '⏳' },
            { label: 'Negócios ativos', value: negocios.filter(n => n.ativo).length, color: '#8b5cf6', icon: '🏢', isCur: false },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color, borderRadius: '16px 16px 0 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{s.isCur === false ? s.value : formatCurrency(s.value)}</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Cards de negócios */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {negocios.map(neg => {
            const negProventos = getProventosPorNegocio(neg.id)
            const receitaTotal = negProventos.reduce((s, p) => s + p.valor, 0)
            const pendente = negProventos.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)
            const tipoLabel = TIPOS.find(t => t.value === neg.tipo)?.label || neg.tipo

            return (
              <div key={neg.id} className="card" style={{ padding: 0, overflow: 'hidden', opacity: neg.ativo ? 1 : 0.65 }}>
                {/* Header */}
                <div style={{ padding: '20px 22px', background: `linear-gradient(135deg, ${neg.cor}22, ${neg.cor}08)`, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 54, height: 54, borderRadius: 16, background: `linear-gradient(135deg, ${neg.cor}, ${neg.cor}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0, boxShadow: `0 4px 16px ${neg.cor}44` }}>
                      {neg.icone}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>{neg.nome}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{tipoLabel}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditing(neg); setShowModal(true) }} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 7, padding: 6, cursor: 'pointer', color: '#818cf8', display: 'flex' }}>
                            <PencilIcon style={{ width: 14, height: 14 }} />
                          </button>
                          <button onClick={() => deleteNegocio(neg.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: 6, cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                            <TrashIcon style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </div>
                      {neg.descricao && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>{neg.descricao}</div>}
                    </div>
                  </div>
                </div>

                {/* Sócios */}
                <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Sócios</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(neg.socios || []).map(s => {
                      const pessoa = people.find(p => p.id === s.pessoa_id)
                      if (!pessoa) return null
                      return (
                        <div key={s.pessoa_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: pessoa.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: 'white', flexShrink: 0 }}>
                            {pessoa.avatar}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{pessoa.nome}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ height: 6, width: 80, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${s.percentual}%`, background: neg.cor, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: neg.cor, width: 36, textAlign: 'right' }}>{s.percentual}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Receita summary */}
                <div style={{ padding: '14px 22px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Proventos</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{negProventos.length}</div>
                  </div>
                  <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Receita</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginTop: 2 }}>{formatCurrency(receitaTotal)}</div>
                  </div>
                  <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Pendente</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginTop: 2 }}>{formatCurrency(pendente)}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {negocios.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum negócio cadastrado</div>
            <div style={{ fontSize: 13 }}>Cadastre suas empresas, parcerias e investimentos.</div>
          </div>
        )}
      </div>

      {showModal && <NegocioModal negocio={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSave={handleSave} />}
    </div>
  )
}
