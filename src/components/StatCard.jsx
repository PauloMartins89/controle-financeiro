import { formatCurrency } from '../lib/utils'

export default function StatCard({ icon, label, value, sub, color = '#6366f1', isCurrency = true, trend }) {
  return (
    <div className="stat-card" style={{ background: `linear-gradient(135deg, ${color}14 0%, var(--bg-card) 55%)`, border: `1px solid ${color}28`, borderTop: `3px solid ${color}` }}>
      {/* top accent line — substituído pelo borderTop e gradiente */}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            {label}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.01em' }}>
            {isCurrency ? formatCurrency(value) : value}
          </div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{sub}</div>}
          {trend !== undefined && (
            <div style={{ fontSize: 12, color: trend >= 0 ? '#10b981' : '#ef4444', marginTop: 6, fontWeight: 600 }}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs mês anterior
            </div>
          )}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
    </div>
  )
}
