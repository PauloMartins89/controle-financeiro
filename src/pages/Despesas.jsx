import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import Avatar from '../components/Avatar'
import useStore from '../store/useStore'
import { formatCurrency, formatDate, getCategoryIcon, CATEGORIAS, TIPOS_DIVISAO, STATUS_OPTIONS } from '../lib/utils'

// Valor "efetivo" mensal de uma despesa.
// - Lançamentos antigos parcelados (1 linha com valor total + parcelas>1, sem
//   lote_parcelamento) → divide o valor pelo nº de parcelas.
// - Lançamentos novos (1 despesa por mês com lote_parcelamento) → usa valor
//   como está (já é o valor da parcela).
// - Lançamentos à vista → valor total.
function valorEfetivo(e) {
  if (e.parcelas && e.parcelas > 1 && !e.lote_parcelamento) {
    return e.valor / e.parcelas
  }
  return e.valor
}
import {
  PencilIcon, TrashIcon, MagnifyingGlassIcon,
  CheckCircleIcon, XMarkIcon, Squares2X2Icon, ListBulletIcon,
  FunnelIcon, ChevronDownIcon, CreditCardIcon, BanknotesIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'

const EMPTY_FORM = {
  descricao: '', valor: '', data: new Date().toISOString().slice(0, 10),
  categoria: 'Outros', grupo_id: '', pago_por: '',
  participantes: [], tipo_divisao: 'igual',
  parcelas: 1, recorrente: false, status: 'pendente', observacoes: '',
  porcentagens: {}, valores_fixos: {},
}

// ─── Expense Modal ────────────────────────────────────────────────────────────
function ExpenseModal({ expense, onClose, onSave }) {
  const { people, groups } = useStore()
  const [form, setForm] = useState(expense ? { ...expense, valor: String(expense.valor) } : { ...EMPTY_FORM, pago_por: people[0]?.id || '', participantes: people.slice(0, 2).map(p => p.id) })

  function toggle(arr, val) {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

  function handleSave() {
    if (!form.descricao || !form.valor) return
    onSave({ ...form, valor: parseFloat(form.valor) || 0 })
  }

  const valorNum = parseFloat(form.valor) || 0
  const shareIgual = form.participantes.length ? valorNum / form.participantes.length : 0

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{expense ? 'Editar Despesa' : 'Nova Despesa'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <XMarkIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'grid', gap: 16 }}>
          {/* Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Descrição *</label>
              <input className="input" placeholder="Ex: Aluguel, Supermercado..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input" type="number" step="0.01" placeholder="0,00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
          </div>

          {/* Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Data</label>
              <input className="input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
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

          {/* Row 3 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Pago por</label>
              <select className="input" value={form.pago_por} onChange={e => setForm(f => ({ ...f, pago_por: e.target.value }))}>
                <option value="">Selecionar...</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo de divisão</label>
              <select className="input" value={form.tipo_divisao} onChange={e => setForm(f => ({ ...f, tipo_divisao: e.target.value }))}>
                {TIPOS_DIVISAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Participantes */}
          <div>
            <label className="label">Participantes</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {people.map(p => {
                const sel = form.participantes.includes(p.id)
                return (
                  <button
                    key={p.id} type="button"
                    onClick={() => setForm(f => ({ ...f, participantes: toggle(f.participantes, p.id) }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
                      background: sel ? `${p.cor}33` : 'rgba(255,255,255,0.04)',
                      border: sel ? `1px solid ${p.cor}` : '1px solid var(--border)',
                      color: sel ? p.cor : 'var(--text-secondary)',
                    }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: p.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>{p.avatar}</div>
                    {p.nome}
                    {sel && form.tipo_divisao === 'igual' && valorNum > 0 && (
                      <span style={{ fontSize: 11, opacity: 0.8 }}>({formatCurrency(shareIgual)})</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Parcelas + Recorrente + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Parcelas</label>
              <input className="input" type="number" min="1" max="72" value={form.parcelas} onChange={e => setForm(f => ({ ...f, parcelas: parseInt(e.target.value) || 1 }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingBottom: 4 }}>
                <input type="checkbox" checked={form.recorrente} onChange={e => setForm(f => ({ ...f, recorrente: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: '#6366f1' }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Recorrente</span>
              </label>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} placeholder="Notas opcionais..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave}>
            {expense ? 'Salvar alterações' : 'Adicionar despesa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    pendente: { label: 'Pendente', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
    pago:     { label: 'Pago',     bg: 'rgba(16,185,129,0.12)',  color: '#10b981', border: 'rgba(16,185,129,0.25)' },
    cancelado:{ label: 'Cancelado',bg: 'rgba(148,163,184,0.1)',  color: '#94a3b8', border: 'rgba(148,163,184,0.2)' },
  }
  const s = map[status] || map.pendente
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

// ─── Expense Card (grid view) ─────────────────────────────────────────────────
function ExpenseCard({ exp, grupo, pagador, onEdit, onDelete, onPay, onUnpay }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      {/* Color accent top */}
      <div style={{ height: 3, background: exp.status === 'pago' ? '#10b981' : exp.status === 'cancelado' ? '#94a3b8' : '#f59e0b' }} />

      <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {getCategoryIcon(exp.categoria)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }} title={exp.descricao}>{exp.descricao}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{exp.categoria}</div>
            </div>
          </div>
          <StatusBadge status={exp.status} />
        </div>

        {/* Amount */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: exp.status === 'pago' ? '#10b981' : 'var(--text-primary)' }}>
            {formatCurrency(valorEfetivo(exp))}
          </span>
          {exp.parcelas > 1 && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              • {exp.lote_parcelamento
                ? `${exp.parcela_atual}/${exp.parcelas} · total ${formatCurrency(exp.valor_total || exp.valor * exp.parcelas)}`
                : `${exp.parcelas}x · total ${formatCurrency(exp.valor)}`}
            </span>
          )}
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(exp.data)}</span>
          {pagador && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>por</span>
              <span style={{ fontWeight: 600, color: pagador.cor }}>{pagador.nome.split(' ')[0]}</span>
            </span>
          )}
          {grupo && (
            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
              {grupo.icone} {grupo.nome}
            </span>
          )}
          {exp.recorrente && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>🔁</span>}
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflow: 'hidden' }}>
        {exp.status !== 'pago' ? (
          <button onClick={onPay} style={{ flex: 1, padding: '9px 0', background: 'rgba(16,185,129,0.06)', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', color: '#10b981', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.06)'}
          >
            <CheckCircleIcon style={{ width: 14, height: 14 }} /> Pago
          </button>
        ) : (
          <button onClick={onUnpay} title="Desfazer pagamento" style={{ flex: 1, padding: '9px 0', background: 'rgba(245,158,11,0.06)', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', color: '#f59e0b', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.06)'}
          >
            <ArrowUturnLeftIcon style={{ width: 14, height: 14 }} /> Desfazer
          </button>
        )}
        <button onClick={onEdit} style={{ flex: 1, padding: '9px 0', background: 'rgba(99,102,241,0.06)', border: 'none', borderRight: '1px solid var(--border)', cursor: 'pointer', color: '#818cf8', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}
        >
          <PencilIcon style={{ width: 14, height: 14 }} /> Editar
        </button>
        <button onClick={onDelete} style={{ flex: 1, padding: '9px 0', background: 'rgba(239,68,68,0.06)', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'}
        >
          <TrashIcon style={{ width: 14, height: 14 }} /> Excluir
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Despesas() {
  const [searchParams] = useSearchParams()
  const { expenses, groups, people, cards, addExpense, updateExpense, deleteExpense, markAsPaid, markAsPending, limparParticipantesZerados } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterCard, setFilterCard] = useState('')
  const [viewMode, setViewMode] = useState('byCard') // 'byCard' | 'list' | 'grid'
  const [collapsedCards, setCollapsedCards] = useState({})

  useEffect(() => {
    if (searchParams.get('new')) setShowModal(true)
  }, [])

  const filtered = useMemo(() => expenses.filter(e => {
    if (search && !e.descricao.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus && e.status !== filterStatus) return false
    if (filterGroup && e.grupo_id !== filterGroup) return false
    if (filterCat && e.categoria !== filterCat) return false
    if (filterCard) {
      if (filterCard === '__none__' && e.card_id) return false
      if (filterCard !== '__none__' && e.card_id !== filterCard) return false
    }
    return true
  }).sort((a, b) => new Date(b.data) - new Date(a.data)), [expenses, search, filterStatus, filterGroup, filterCat, filterCard])

  // ── Agrupamento por cartão (sem misturar despesas) ────────────────────
  const groupedByCard = useMemo(() => {
    const buckets = new Map() // key = card_id || '__none__'
    for (const e of filtered) {
      const key = e.card_id || '__none__'
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(e)
    }
    // Monta lista de cartões na ordem: cartões cadastrados primeiro, depois "Sem cartão"
    const result = []
    for (const card of cards) {
      if (buckets.has(card.id)) {
        result.push({ card, items: buckets.get(card.id) })
      }
    }
    if (buckets.has('__none__')) {
      result.push({ card: null, items: buckets.get('__none__') })
    }
    // Cartões sem cadastro (caso card_id aponte para cartão removido)
    for (const [key, items] of buckets.entries()) {
      if (key === '__none__') continue
      if (!cards.some(c => c.id === key)) {
        result.push({ card: { id: key, nome: 'Cartão removido', cor: '#94a3b8', bandeira: '—' }, items, orphan: true })
      }
    }
    return result
  }, [filtered, cards])

  const totalPendente = filtered.filter(e => e.status === 'pendente').reduce((s, e) => s + valorEfetivo(e), 0)
  const totalPago = filtered.filter(e => e.status === 'pago').reduce((s, e) => s + valorEfetivo(e), 0)
  const countPendente = filtered.filter(e => e.status === 'pendente').length
  const activeFilters = [filterStatus, filterGroup, filterCat, filterCard].filter(Boolean).length

  function handleSave(data) {
    if (editing) updateExpense(editing.id, data)
    else addExpense(data)
    setShowModal(false); setEditing(null)
  }

  function clearFilters() {
    setSearch(''); setFilterStatus(''); setFilterGroup(''); setFilterCat(''); setFilterCard('')
  }

  function toggleCardCollapse(key) {
    setCollapsedCards(c => ({ ...c, [key]: !c[key] }))
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Despesas" subtitle="Gerencie todos os lançamentos" action={{ label: 'Nova Despesa', onClick: () => { setEditing(null); setShowModal(true) } }} />

      <div style={{ padding: '20px 28px' }}>

        {/* ── Banner de migração: participantes com 0 (legado) ── */}
        {(() => {
          const legados = expenses.filter(e =>
            e.tipo_divisao === 'valor_fixo' && e.valores_fixos &&
            Object.values(e.valores_fixos).some(v => (parseFloat(v) || 0) <= 0.005)
          ).length
          if (legados === 0) return null
          return (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{legados} despesa(s) com participantes "fantasma"</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Imports antigos incluíam o titular mesmo com R$ 0,00 atribuído. Limpe para corrigir a exibição dos chips.</div>
              </div>
              <button
                onClick={() => {
                  const n = limparParticipantesZerados()
                  toast.success(`${n} despesa(s) corrigida(s)`)
                }}
                style={{ background: '#f59e0b', color: '#1c1917', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Limpar participantes zerados
              </button>
            </div>
          )
        })()}

        {/* ── Summary Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
          {[
            { label: 'Total filtrado', value: filtered.reduce((s, e) => s + valorEfetivo(e), 0), color: '#6366f1', icon: '🧾', count: `${filtered.length} lançamentos` },
            { label: 'Pendente', value: totalPendente, color: '#f59e0b', icon: '⏳', count: `${countPendente} a pagar` },
            { label: 'Pago', value: totalPago, color: '#10b981', icon: '✅', count: `${filtered.length - countPendente} quitadas` },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color, borderRadius: '14px 14px 0 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{formatCurrency(s.value)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{s.count}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter Bar ── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
            <MagnifyingGlassIcon style={{ width: 15, height: 15, position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input className="input" placeholder="Buscar despesa..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 33, paddingTop: 7, paddingBottom: 7 }} />
          </div>

          {/* Filters */}
          <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 145, paddingTop: 7, paddingBottom: 7 }}>
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="input" value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={{ width: 150, paddingTop: 7, paddingBottom: 7 }}>
            <option value="">Todos os grupos</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.icone} {g.nome}</option>)}
          </select>
          <select className="input" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 150, paddingTop: 7, paddingBottom: 7 }}>
            <option value="">Categorias</option>
            {CATEGORIAS.map(c => <option key={c}>{getCategoryIcon(c)} {c}</option>)}
          </select>
          <select className="input" value={filterCard} onChange={e => setFilterCard(e.target.value)} style={{ width: 165, paddingTop: 7, paddingBottom: 7 }}>
            <option value="">Todos os cartões</option>
            <option value="__none__">💵 Sem cartão</option>
            {cards.map(c => <option key={c.id} value={c.id}>💳 {c.nome}</option>)}
          </select>

          {/* Active filters badge + clear */}
          {activeFilters > 0 && (
            <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#818cf8', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              <FunnelIcon style={{ width: 13, height: 13 }} /> {activeFilters} filtro{activeFilters > 1 ? 's' : ''} · limpar
            </button>
          )}

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: 3, border: '1px solid var(--border)', marginLeft: 'auto' }}>
            <button onClick={() => setViewMode('byCard')} title="Agrupado por cartão" style={{ width: 30, height: 30, borderRadius: 7, background: viewMode === 'byCard' ? 'rgba(99,102,241,0.2)' : 'transparent', border: viewMode === 'byCard' ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent', cursor: 'pointer', color: viewMode === 'byCard' ? '#818cf8' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCardIcon style={{ width: 16, height: 16 }} />
            </button>
            <button onClick={() => setViewMode('list')} title="Visualização em lista" style={{ width: 30, height: 30, borderRadius: 7, background: viewMode === 'list' ? 'rgba(99,102,241,0.2)' : 'transparent', border: viewMode === 'list' ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent', cursor: 'pointer', color: viewMode === 'list' ? '#818cf8' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ListBulletIcon style={{ width: 16, height: 16 }} />
            </button>
            <button onClick={() => setViewMode('grid')} title="Visualização em grade" style={{ width: 30, height: 30, borderRadius: 7, background: viewMode === 'grid' ? 'rgba(99,102,241,0.2)' : 'transparent', border: viewMode === 'grid' ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent', cursor: 'pointer', color: viewMode === 'grid' ? '#818cf8' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Squares2X2Icon style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* ── Empty State ── */}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 32px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Nenhuma despesa encontrada</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {activeFilters > 0 || search ? 'Tente ajustar os filtros.' : 'Adicione sua primeira despesa.'}
            </div>
            {(activeFilters > 0 || search) && (
              <button className="btn-ghost" onClick={clearFilters}>Limpar filtros</button>
            )}
          </div>
        )}

        {/* ── By-Card View (despesas agrupadas por cartão, sem mistura) ── */}
        {viewMode === 'byCard' && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {groupedByCard.map(({ card, items, orphan }) => {
              const key = card?.id || '__none__'
              const collapsed = collapsedCards[key]
              const subtotal = items.reduce((s, e) => s + valorEfetivo(e), 0)
              const subtotalPago = items.filter(e => e.status === 'pago').reduce((s, e) => s + valorEfetivo(e), 0)
              const subtotalPend = subtotal - subtotalPago
              const cor = card?.cor || '#94a3b8'
              const isCard = !!card && !orphan
              return (
                <div key={key} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${cor}` }}>
                  {/* Header do cartão */}
                  <div onClick={() => toggleCardCollapse(key)} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', background: 'rgba(255,255,255,0.02)', borderBottom: collapsed ? 'none' : '1px solid var(--border)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${cor}22`, border: `1px solid ${cor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isCard
                        ? <CreditCardIcon style={{ width: 20, height: 20, color: cor }} />
                        : <BanknotesIcon style={{ width: 20, height: 20, color: cor }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 800 }}>{card ? card.nome : 'Sem cartão / Dinheiro'}</span>
                        {card && card.bandeira && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${cor}22`, color: cor, border: `1px solid ${cor}44`, textTransform: 'uppercase' }}>{card.bandeira}</span>}
                        {orphan && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>REMOVIDO</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {items.length} despesa{items.length !== 1 ? 's' : ''}
                        {subtotalPend > 0 && <> · <span style={{ color: '#f59e0b', fontWeight: 600 }}>{formatCurrency(subtotalPend)} pendente</span></>}
                        {subtotalPago > 0 && <> · <span style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(subtotalPago)} pago</span></>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Subtotal</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: cor }}>{formatCurrency(subtotal)}</div>
                    </div>
                    <ChevronDownIcon style={{ width: 18, height: 18, color: 'var(--text-secondary)', transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)' }} />
                  </div>

                  {/* Despesas do cartão */}
                  {!collapsed && (
                    <>
                      {items.map((exp, i) => {
                        const grupo = groups.find(g => g.id === exp.grupo_id)
                        const pagador = people.find(p => p.id === exp.pago_por)
                        return (
                          <div key={exp.id} style={{
                            display: 'grid', gridTemplateColumns: '2.5fr 130px 100px 130px 110px 120px',
                            padding: '12px 18px',
                            borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                            alignItems: 'center',
                            background: exp.status === 'pago' ? 'rgba(16,185,129,0.02)' : 'transparent',
                            transition: 'background 0.15s',
                          }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                            onMouseLeave={e => e.currentTarget.style.background = exp.status === 'pago' ? 'rgba(16,185,129,0.02)' : 'transparent'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                                {getCategoryIcon(exp.categoria)}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.descricao}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                  <span>{exp.categoria}</span>
                                  {pagador && <><span>· por</span><span style={{ fontWeight: 600, color: pagador.cor }}>{pagador.nome.split(' ')[0]}</span></>}
                                  {exp.parcelas > 1 && <span style={{ color: '#818cf8' }}>· {exp.parcela_atual ?? 1}/{exp.parcelas}x</span>}
                                  {exp._veiculo && <span style={{ color: '#06b6d4' }}>🚗 {exp._veiculo}</span>}
                                </div>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: exp.status === 'pago' ? '#10b981' : 'var(--text-primary)' }}>{formatCurrency(valorEfetivo(exp))}</div>
                              {exp.parcelas > 1 && (
                                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                                  {exp.lote_parcelamento
                                    ? `${exp.parcela_atual}/${exp.parcelas} de ${formatCurrency(exp.valor_total || exp.valor * exp.parcelas)}`
                                    : `parc · total ${formatCurrency(exp.valor)}`}
                                </div>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(exp.data)}</div>
                            <div>
                              {grupo
                                ? <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>{grupo.icone} {grupo.nome}</span>
                                : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>}
                            </div>
                            <div><StatusBadge status={exp.status} /></div>
                            <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                              {exp.status !== 'pago' ? (
                                <button title="Marcar como pago" onClick={() => markAsPaid(exp.id)} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 7, padding: '5px', cursor: 'pointer', color: '#10b981', display: 'flex' }}>
                                  <CheckCircleIcon style={{ width: 14, height: 14 }} />
                                </button>
                              ) : (
                                <button title="Desfazer pagamento" onClick={() => markAsPending(exp.id)} style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 7, padding: '5px', cursor: 'pointer', color: '#f59e0b', display: 'flex' }}>
                                  <ArrowUturnLeftIcon style={{ width: 14, height: 14 }} />
                                </button>
                              )}
                              <button title="Editar" onClick={() => { setEditing(exp); setShowModal(true) }} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 7, padding: '5px', cursor: 'pointer', color: '#818cf8', display: 'flex' }}>
                                <PencilIcon style={{ width: 14, height: 14 }} />
                              </button>
                              <button title="Excluir" onClick={() => deleteExpense(exp.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '5px', cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                                <TrashIcon style={{ width: 14, height: 14 }} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      {/* Subtotal do cartão (rodapé) */}
                      <div style={{ padding: '11px 18px', background: `${cor}10`, borderTop: `1px solid ${cor}33`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 18, fontSize: 12 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{items.length} lançamento{items.length !== 1 ? 's' : ''}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>Pago: <strong style={{ color: '#10b981' }}>{formatCurrency(subtotalPago)}</strong></span>
                        <span style={{ color: 'var(--text-secondary)' }}>Pendente: <strong style={{ color: '#f59e0b' }}>{formatCurrency(subtotalPend)}</strong></span>
                        <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, fontSize: 11 }}>Total {card ? card.nome : 'sem cartão'}:</span>
                        <strong style={{ fontSize: 16, color: cor }}>{formatCurrency(subtotal)}</strong>
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            {/* ── Consolidação final por cartão ── */}
            <div className="card" style={{ padding: 18, border: '1px solid rgba(99,102,241,0.3)', background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.04))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <CreditCardIcon style={{ width: 20, height: 20, color: '#a855f7' }} />
                <h3 style={{ fontSize: 15, fontWeight: 800 }}>Consolidação por Cartão</h3>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1fr 1fr 1fr', padding: '8px 12px', fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>
                  <span>Cartão</span>
                  <span style={{ textAlign: 'center' }}>Qtd</span>
                  <span style={{ textAlign: 'right' }}>Pago</span>
                  <span style={{ textAlign: 'right' }}>Pendente</span>
                  <span style={{ textAlign: 'right' }}>Total</span>
                </div>
                {groupedByCard.map(({ card, items }) => {
                  const sub = items.reduce((s, e) => s + valorEfetivo(e), 0)
                  const subP = items.filter(e => e.status === 'pago').reduce((s, e) => s + valorEfetivo(e), 0)
                  const subPe = sub - subP
                  const cor = card?.cor || '#94a3b8'
                  const totalGeral = filtered.reduce((s, e) => s + valorEfetivo(e), 0)
                  const pct = totalGeral ? (sub / totalGeral) * 100 : 0
                  return (
                    <div key={card?.id || 'none'} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1fr 1fr 1fr', padding: '10px 12px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 8, borderLeft: `3px solid ${cor}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${cor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {card ? <CreditCardIcon style={{ width: 14, height: 14, color: cor }} /> : <BanknotesIcon style={{ width: 14, height: 14, color: cor }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{card ? card.nome : 'Sem cartão / Dinheiro'}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{pct.toFixed(1)}% do total</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{items.length}</div>
                      <div style={{ textAlign: 'right', fontSize: 13, color: '#10b981', fontWeight: 600 }}>{formatCurrency(subP)}</div>
                      <div style={{ textAlign: 'right', fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>{formatCurrency(subPe)}</div>
                      <div style={{ textAlign: 'right', fontSize: 14, color: cor, fontWeight: 800 }}>{formatCurrency(sub)}</div>
                    </div>
                  )
                })}
                {/* Total geral */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1fr 1fr 1fr', padding: '12px', alignItems: 'center', background: 'rgba(168,85,247,0.1)', borderRadius: 8, marginTop: 6, borderTop: '2px solid rgba(168,85,247,0.4)' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Geral</div>
                  <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{filtered.length}</div>
                  <div style={{ textAlign: 'right', fontSize: 13, color: '#10b981', fontWeight: 700 }}>{formatCurrency(totalPago)}</div>
                  <div style={{ textAlign: 'right', fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>{formatCurrency(totalPendente)}</div>
                  <div style={{ textAlign: 'right', fontSize: 16, color: '#a855f7', fontWeight: 800 }}>{formatCurrency(filtered.reduce((s, e) => s + valorEfetivo(e), 0))}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Grid View ── */}
        {viewMode === 'grid' && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filtered.map(exp => {
              const grupo = groups.find(g => g.id === exp.grupo_id)
              const pagador = people.find(p => p.id === exp.pago_por)
              return (
                <ExpenseCard
                  key={exp.id} exp={exp} grupo={grupo} pagador={pagador}
                  onEdit={() => { setEditing(exp); setShowModal(true) }}
                  onDelete={() => deleteExpense(exp.id)}
                  onPay={() => markAsPaid(exp.id)}
                  onUnpay={() => markAsPending(exp.id)}
                />
              )
            })}
          </div>
        )}

        {/* ── List View ── */}
        {viewMode === 'list' && filtered.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 130px 100px 130px 120px 110px 120px', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              {['Descrição','Valor','Data','Categoria','Grupo','Status','Ações'].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>

            {filtered.map((exp, i) => {
              const grupo = groups.find(g => g.id === exp.grupo_id)
              const pagador = people.find(p => p.id === exp.pago_por)
              return (
                <div key={exp.id} style={{
                  display: 'grid', gridTemplateColumns: '2.5fr 130px 100px 130px 120px 110px 120px',
                  padding: '13px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  alignItems: 'center',
                  background: exp.status === 'pago' ? 'rgba(16,185,129,0.02)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = exp.status === 'pago' ? 'rgba(16,185,129,0.02)' : 'transparent'}
                >
                  {/* Description */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {getCategoryIcon(exp.categoria)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.descricao}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                        {pagador && <><span>por</span><span style={{ fontWeight: 600, color: pagador.cor }}>{pagador.nome.split(' ')[0]}</span></>}
                        {exp.parcelas > 1 && <span style={{ color: '#818cf8' }}>• {exp.parcela_atual ?? 1}/{exp.parcelas}x</span>}
                        {exp.recorrente && <span>🔁</span>}
                      </div>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: exp.status === 'pago' ? '#10b981' : 'var(--text-primary)' }}>
                      {formatCurrency(valorEfetivo(exp))}
                    </div>
                    {exp.parcelas > 1 && (
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                        {exp.lote_parcelamento
                          ? `${exp.parcela_atual}/${exp.parcelas} de ${formatCurrency(exp.valor_total || exp.valor * exp.parcelas)}`
                          : `parc · total ${formatCurrency(exp.valor)}`}
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{formatDate(exp.data)}</div>

                  {/* Category */}
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>{getCategoryIcon(exp.categoria)}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.categoria}</span>
                  </div>

                  {/* Group */}
                  <div>
                    {grupo
                      ? <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>{grupo.icone} {grupo.nome}</span>
                      : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>}
                  </div>

                  {/* Status */}
                  <div><StatusBadge status={exp.status} /></div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 5 }}>
                    {exp.status !== 'pago' ? (
                      <button title="Marcar como pago" onClick={() => markAsPaid(exp.id)} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 7, padding: '6px', cursor: 'pointer', color: '#10b981', display: 'flex', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                      >
                        <CheckCircleIcon style={{ width: 15, height: 15 }} />
                      </button>
                    ) : (
                      <button title="Desfazer pagamento" onClick={() => markAsPending(exp.id)} style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 7, padding: '6px', cursor: 'pointer', color: '#f59e0b', display: 'flex', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                      >
                        <ArrowUturnLeftIcon style={{ width: 15, height: 15 }} />
                      </button>
                    )}
                    <button title="Editar" onClick={() => { setEditing(exp); setShowModal(true) }} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 7, padding: '6px', cursor: 'pointer', color: '#818cf8', display: 'flex', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                    >
                      <PencilIcon style={{ width: 15, height: 15 }} />
                    </button>
                    <button title="Excluir" onClick={() => deleteExpense(exp.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '6px', cursor: 'pointer', color: '#ef4444', display: 'flex', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                    >
                      <TrashIcon style={{ width: 15, height: 15 }} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Footer count ── */}
        {filtered.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
            <span>{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
            <span>Total: <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(filtered.reduce((s, e) => s + valorEfetivo(e), 0))}</span></span>
          </div>
        )}
      </div>

      {showModal && (
        <ExpenseModal expense={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSave={handleSave} />
      )}
    </div>
  )
}
