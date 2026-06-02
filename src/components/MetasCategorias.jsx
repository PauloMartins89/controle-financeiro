import { useState, useEffect } from 'react'
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import useStore from '../store/useStore'
import { formatCurrency, CATEGORIAS } from '../lib/utils'

const DEFAULT_KEY = 'metas-categorias'

function getMetas(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {} } catch { return {} }
}

function saveMetas(key, metas) {
  localStorage.setItem(key, JSON.stringify(metas))
}

export default function MetasCategorias() {
  const { expenses, workspaceId } = useStore()
  const storageKey = workspaceId ? `metas-categorias-${workspaceId}` : DEFAULT_KEY
  const [metas, setMetas] = useState(() => getMetas(storageKey))

  // Reload metas when workspace changes
  useEffect(() => { setMetas(getMetas(storageKey)) }, [storageKey])
  const [editing, setEditing] = useState(null) // categoria sendo editada
  const [inputVal, setInputVal] = useState('')

  const now = new Date()
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // gastos do mês por categoria
  const gastosPorCategoria = {}
  expenses.forEach(e => {
    if (!e.data?.startsWith(mesAtual)) return
    const cat = e.categoria || 'Outros'
    gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + (parseFloat(e.valor) || 0)
  })

  // categorias com meta ou gasto > 0
  const categoriasAtivas = CATEGORIAS.filter(c => metas[c] || gastosPorCategoria[c])

  function startEdit(cat) {
    setEditing(cat)
    setInputVal(metas[cat] ? String(metas[cat]) : '')
  }

  function saveMeta(cat) {
    const val = parseFloat(inputVal.replace(',', '.'))
    const updated = { ...metas }
    if (!isNaN(val) && val > 0) updated[cat] = val
    else delete updated[cat]
    setMetas(updated)
    saveMetas(storageKey, updated)
    setEditing(null)
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>🎯 Metas por Categoria</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Limite de gasto mensal por categoria</div>
        </div>
        <button
          onClick={() => startEdit('')}
          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', cursor: 'pointer' }}
        >
          + Definir meta
        </button>
      </div>

      {editing === '' && (
        <div style={{ marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="input"
            style={{ flex: '1 1 160px', fontSize: 13 }}
            onChange={e => setEditing(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>Escolha a categoria...</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {editing && editing !== '' && (
        <div style={{ marginBottom: 14, padding: 12, background: 'rgba(99,102,241,0.08)', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{editing}</span>
          <input
            className="input"
            type="number"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="Limite em R$"
            style={{ width: 140, fontSize: 13 }}
            onKeyDown={e => e.key === 'Enter' && saveMeta(editing)}
            autoFocus
          />
          <button onClick={() => saveMeta(editing)} style={{ background: '#10b981', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex' }}>
            <CheckIcon style={{ width: 14, height: 14, color: 'white' }} />
          </button>
          <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

      {categoriasAtivas.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: '16px 0' }}>
          Nenhuma meta definida. Clique em "+ Definir meta" para começar.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {categoriasAtivas.map(cat => {
          const gasto = gastosPorCategoria[cat] || 0
          const meta = metas[cat]
          const pct = meta ? Math.min((gasto / meta) * 100, 100) : 0
          const over = meta && gasto > meta
          const color = over ? '#ef4444' : pct > 75 ? '#f59e0b' : '#10b981'

          return (
            <div key={cat}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{cat}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: over ? '#ef4444' : 'var(--text-secondary)' }}>
                    {formatCurrency(gasto)}
                    {meta ? <> / <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(meta)}</span></> : ''}
                  </span>
                  <button
                    onClick={() => startEdit(cat)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 2 }}
                  >
                    <PencilIcon style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </div>
              {meta && (
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
