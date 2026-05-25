/**
 * PageHeader — cabeçalho padrão escuro para páginas do sistema SmartPro.
 *
 * Props:
 *   icon       — componente de ícone heroicons (obrigatório)
 *   iconColor  — cor do ícone e botão primário (default: '#4ade80')
 *   title      — título principal
 *   subtitle   — subtítulo / descrição breve
 *   badges     — [{ label, color?, icon?, primary? }]  → pills de status no canto direito
 *   actions    — [{ label, icon?, onClick, primary? }] → botões de ação
 */
export default function PageHeader({
  icon: Icon,
  iconColor = '#4ade80',
  title,
  subtitle,
  badges  = [],
  actions = [],
}) {
  const dimAlpha = val => {
    // converts hex like #4ade80 to rgba for bg/border
    const r = parseInt(val.slice(1, 3), 16)
    const g = parseInt(val.slice(3, 5), 16)
    const b = parseInt(val.slice(5, 7), 16)
    return { bg: `rgba(${r},${g},${b},0.15)`, border: `rgba(${r},${g},${b},0.35)` }
  }
  const ic = dimAlpha(iconColor)

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #16213e 100%)',
      padding: '18px 28px',
      borderBottom: `1px solid ${ic.border}`,
      position: 'sticky', top: 0, zIndex: 20,
      flexShrink: 0,
    }}>

      {/* ── Linha 1: Ícone + Título/Subtítulo + Badges ─────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>

        {/* Esquerda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40,
            background: ic.bg,
            border: `1px solid ${ic.border}`,
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon style={{ width: 21, height: 21, color: iconColor }} />
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: 17, fontWeight: 800,
              color: '#f1f5f9', letterSpacing: -0.3, lineHeight: 1.2,
            }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Direita: Badges de status */}
        {badges.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {badges.map((b, i) => {
              const BIcon = b.icon
              const color = b.color || '#64748b'
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px',
                  background: b.primary ? `rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},0.12)` : 'rgba(255,255,255,0.04)',
                  border: b.primary ? `1px solid ${color}50` : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                }}>
                  {BIcon && <BIcon style={{ width: 12, height: 12, color }} />}
                  <span style={{
                    fontSize: 11,
                    color: b.primary ? color : '#64748b',
                    fontWeight: b.primary ? 700 : 400,
                    whiteSpace: 'nowrap',
                  }}>
                    {b.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Linha 2: Botões de ação ─────────────────────────────────────── */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {actions.map((a, i) => {
            const AIcon = a.icon
            return (
              <button
                key={i}
                onClick={a.onClick}
                disabled={a.disabled}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: a.primary ? ic.bg : 'rgba(255,255,255,0.05)',
                  color: a.primary ? iconColor : '#94a3b8',
                  border: a.primary ? `1px solid ${ic.border}` : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 7, padding: '6px 14px',
                  fontSize: 12, fontWeight: a.primary ? 700 : 500,
                  cursor: a.disabled ? 'not-allowed' : 'pointer',
                  opacity: a.disabled ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {AIcon && <AIcon style={{ width: 13, height: 13 }} />}
                {a.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
