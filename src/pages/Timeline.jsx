import { useMemo } from 'react'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { formatCurrency, formatDate, getCategoryIcon } from '../lib/utils'

export default function Timeline() {
  const { expenses, people, groups } = useStore()

  const events = useMemo(() => {
    const all = []

    expenses.forEach(exp => {
      const pagador = people.find(p => p.id === exp.pago_por)
      const grupo = groups.find(g => g.id === exp.grupo_id)
      all.push({
        id: exp.id,
        date: exp.data,
        type: exp.status === 'pago' ? 'pago' : exp.parcelas > 1 ? 'parcelado' : exp.recorrente ? 'recorrente' : 'despesa',
        title: exp.descricao,
        sub: `${pagador?.nome || '?'} pagou${grupo ? ` · ${grupo.icone} ${grupo.nome}` : ''}`,
        value: exp.valor,
        color: exp.status === 'pago' ? '#10b981' : exp.recorrente ? '#8b5cf6' : exp.parcelas > 1 ? '#f59e0b' : '#6366f1',
        icon: getCategoryIcon(exp.categoria),
        badge: exp.status === 'pago' ? 'Pago' : exp.parcelas > 1 ? `${exp.parcela_atual}/${exp.parcelas}x` : exp.recorrente ? 'Recorrente' : 'Pendente',
        badgeClass: exp.status === 'pago' ? 'badge-success' : exp.parcelas > 1 ? 'badge-warning' : exp.recorrente ? 'badge-accent' : 'badge-neutral',
        participants: exp.participantes?.length || 1,
        grupo: grupo?.nome,
      })
    })

    return all.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [expenses, people, groups])

  // Group by month
  const byMonth = useMemo(() => {
    const months = {}
    events.forEach(ev => {
      const m = ev.date?.slice(0, 7) || '?'
      if (!months[m]) months[m] = []
      months[m].push(ev)
    })
    return Object.entries(months).sort((a, b) => b[0].localeCompare(a[0]))
  }, [events])

  function monthLabel(m) {
    if (!m || m === '?') return 'Sem data'
    const [y, mo] = m.split('-')
    return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Timeline Financeira" subtitle="Histórico completo de movimentações" />

      <div style={{ padding: '24px 28px' }}>
        {/* Summary row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
          {[
            { label: 'Total de eventos', value: events.length, isCur: false, color: '#6366f1' },
            { label: 'Total movimentado', value: events.reduce((s, e) => s + e.value, 0), isCur: true, color: '#10b981' },
            { label: 'Pagos', value: events.filter(e => e.badge === 'Pago').length, isCur: false, color: '#10b981' },
            { label: 'Pendentes', value: events.filter(e => e.badge === 'Pendente').length, isCur: false, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ flex: '1 1 160px' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color, borderRadius: '16px 16px 0 0' }} />
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                {s.isCur ? formatCurrency(s.value) : s.value}
              </div>
            </div>
          ))}
        </div>

        {byMonth.map(([month, monthEvents]) => (
          <div key={month} style={{ marginBottom: 32 }}>
            {/* Month header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{monthLabel(month)}</div>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className="badge badge-neutral">{formatCurrency(monthEvents.reduce((s, e) => s + e.value, 0))}</span>
            </div>

            {/* Events */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
              {/* Vertical line */}
              <div style={{ position: 'absolute', left: 22, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />

              {monthEvents.map((ev, i) => (
                <div key={ev.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', paddingBottom: 16 }}>
                  {/* Dot */}
                  <div style={{ width: 46, display: 'flex', justifyContent: 'center', flexShrink: 0, paddingTop: 4 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: ev.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, zIndex: 1, border: '2px solid var(--bg-primary)', flexShrink: 0 }}>
                      {ev.icon}
                    </div>
                  </div>

                  {/* Card */}
                  <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{ev.title}</div>
                        <span className={`badge ${ev.badgeClass}`} style={{ fontSize: 10 }}>{ev.badge}</span>
                        {ev.participants > 1 && <span className="badge badge-neutral" style={{ fontSize: 10 }}>👥 {ev.participants} pessoas</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{ev.sub}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: ev.badge === 'Pago' ? '#10b981' : 'var(--text-primary)' }}>
                        {formatCurrency(ev.value)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{formatDate(ev.date)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Sem movimentações</div>
            <div style={{ fontSize: 13 }}>Adicione despesas para ver o histórico.</div>
          </div>
        )}
      </div>
    </div>
  )
}
