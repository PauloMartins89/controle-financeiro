import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, XMarkIcon, CurrencyDollarIcon, UsersIcon, UserGroupIcon, CreditCardIcon, TruckIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import useStore from '../store/useStore'
import { formatCurrency, formatDate } from '../lib/utils'

function highlight(text, query) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(99,102,241,0.4)', color: 'inherit', borderRadius: 2 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

const ICONS = {
  despesa: CurrencyDollarIcon,
  pessoa: UsersIcon,
  grupo: UserGroupIcon,
  cartao: CreditCardIcon,
  veiculo: TruckIcon,
  recorrente: ArrowPathIcon,
}

const LABELS = {
  despesa: 'Despesa',
  pessoa: 'Pessoa',
  grupo: 'Grupo',
  cartao: 'Cartão',
  veiculo: 'Veículo',
  recorrente: 'Recorrente',
}

const ROUTES = {
  despesa: '/despesas',
  pessoa: '/pessoas',
  grupo: '/grupos',
  cartao: '/cartoes',
  veiculo: '/veiculos',
  recorrente: '/recorrentes',
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const { expenses, people, groups, cards, vehicles, recurring } = useStore()

  // Ctrl+K / Cmd+K abre a busca
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    function onOpen() { setOpen(true) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('openGlobalSearch', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('openGlobalSearch', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setQuery('')
  }, [open])

  const results = useCallback(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const out = []

    const matchesValor = (valor) => {
      if (!valor) return false
      const num = parseFloat(String(valor).replace(',', '.'))
      if (isNaN(num)) return false
      return formatCurrency(num).toLowerCase().includes(q) || String(num).includes(q)
    }

    const matchesData = (data) => {
      if (!data) return false
      // suporta: "13/05", "13/05/2026", "maio", "05/2026", "2026-05-13"
      const formatted = formatDate(data).toLowerCase()
      const iso = String(data).toLowerCase()
      const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
      const d = new Date(data)
      const nomeMes = isNaN(d) ? '' : meses[d.getMonth()]
      return formatted.includes(q) || iso.includes(q) || nomeMes.includes(q)
    }

    expenses.filter(e =>
      e.descricao?.toLowerCase().includes(q) ||
      e.categoria?.toLowerCase().includes(q) ||
      matchesValor(e.valor) ||
      matchesData(e.data)
    ).slice(0, 5).forEach(e => {
      out.push({ type: 'despesa', id: e.id, title: e.descricao, sub: `${formatCurrency(e.valor)} · ${formatDate(e.data)} · ${e.categoria}`, badge: e.status })
    })
    people.filter(p => p.nome?.toLowerCase().includes(q)).slice(0, 3).forEach(p => {
      out.push({ type: 'pessoa', id: p.id, title: p.nome, sub: p.email || '' })
    })
    groups.filter(g => g.nome?.toLowerCase().includes(q)).slice(0, 3).forEach(g => {
      out.push({ type: 'grupo', id: g.id, title: g.nome, sub: `${g.membros?.length || 0} membros` })
    })
    cards.filter(c => (c.nome || c.apelido)?.toLowerCase().includes(q)).slice(0, 3).forEach(c => {
      out.push({ type: 'cartao', id: c.id, title: c.nome || c.apelido, sub: `Limite: ${formatCurrency(c.limite)}` })
    })
    vehicles.filter(v => (v.placa || v.apelido)?.toLowerCase().includes(q)).slice(0, 3).forEach(v => {
      out.push({ type: 'veiculo', id: v.id, title: v.apelido || v.placa, sub: v.placa })
    })
    recurring.filter(r => r.descricao?.toLowerCase().includes(q) || matchesValor(r.valor)).slice(0, 3).forEach(r => {
      out.push({ type: 'recorrente', id: r.id, title: r.descricao, sub: formatCurrency(r.valor) })
    })

    return out
  }, [query, expenses, people, groups, cards, vehicles, recurring])

  const items = results()

  useEffect(() => { setSelected(0) }, [query])

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, items.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && items[selected]) { go(items[selected]) }
  }

  function go(item) {
    navigate(ROUTES[item.type])
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={e => e.target === e.currentTarget && setOpen(false)}
    >
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: items.length ? '1px solid var(--border)' : 'none' }}>
          <MagnifyingGlassIcon style={{ width: 20, height: 20, color: '#6366f1', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar despesas, pessoas, cartões..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: 'var(--text-primary)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>
          )}
          <kbd onClick={() => setOpen(false)} style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Esc</kbd>
        </div>

        {/* Results */}
        {items.length > 0 && (
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.map((item, i) => {
              const Icon = ICONS[item.type]
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => go(item)}
                  onMouseEnter={() => setSelected(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', cursor: 'pointer',
                    background: i === selected ? 'rgba(99,102,241,0.12)' : 'transparent',
                    borderLeft: i === selected ? '3px solid #6366f1' : '3px solid transparent',
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 16, height: 16, color: '#6366f1' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {highlight(item.title, query)}
                    </div>
                    {item.sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{item.sub}</div>}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
                    {LABELS[item.type]}
                  </span>
                  {item.badge && (
                    <span style={{ fontSize: 11, borderRadius: 4, padding: '2px 6px', flexShrink: 0, background: item.badge === 'pago' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: item.badge === 'pago' ? '#10b981' : '#f59e0b' }}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {query && items.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
            Nada encontrado para "<strong>{query}</strong>"
          </div>
        )}

        {!query && (
          <div style={{ padding: '16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Alimentação', 'Transporte', 'Pendente', 'Pago'].map(s => (
              <button key={s} onClick={() => setQuery(s)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', cursor: 'pointer' }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
