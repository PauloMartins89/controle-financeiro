/**
 * Tokens de design e primitivos de UI compartilhados entre as telas de Refeição.
 * Referência visual: RefeicaoAprovar (Supervisor) — identidade premium SmartPro.
 */

export const T = {
  pageBg:      '#111827',
  cardBg:      '#1f2937',
  border:      'rgba(255,255,255,0.07)',
  divider:     'rgba(255,255,255,0.06)',
  rowBg:       'rgba(255,255,255,0.04)',
  inputBg:     'rgba(255,255,255,0.05)',
  inputBorder: 'rgba(255,255,255,0.1)',
  text:        '#f9fafb',
  textMuted:   '#9ca3af',
  textDim:     '#6b7280',
  green:       '#34d399',
  indigo:      '#818cf8',
  shadow:      '0 32px 64px rgba(0,0,0,0.6)',
}

/** Wrapper de página: fundo escuro, conteúdo centralizado. */
export function PageLayout({ children }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: T.pageBg,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '0 0 48px',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: T.text,
    }}>
      {children}
    </div>
  )
}

/** Card principal: vidro escuro, radius 24, sombra profunda. */
export function MainCard({ children, maxWidth = 480 }) {
  return (
    <div style={{
      width: '100%',
      maxWidth,
      background: T.cardBg,
      borderRadius: 24,
      margin: '24px 12px',
      overflow: 'hidden',
      boxShadow: T.shadow,
    }}>
      {children}
    </div>
  )
}

/** Divisor horizontal sutil entre seções. */
export function Divider() {
  return <div style={{ height: 1, background: T.divider }} />
}

/** Rótulo de seção: uppercase, 11px, espaçado. */
export function SectionLabel({ children, style }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: T.textDim,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 8,
      ...style,
    }}>
      {children}
    </div>
  )
}

/** Chip/badge colorido. */
export function Badge({ bg, color, children }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: bg,
      color,
      borderRadius: 20,
      padding: '4px 10px',
      fontSize: 12,
      fontWeight: 600,
    }}>
      {children}
    </span>
  )
}

/** Card de estatística com ícone, rótulo e valor. */
export function StatCard({ label, value, icon, green }) {
  return (
    <div style={{
      background: T.rowBg,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: '12px 10px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: green ? T.green : T.text }}>{value}</div>
    </div>
  )
}

/** Linha de informação label + valor (para telas de confirmação). */
export function InfoRow({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ color: T.textDim, fontSize: 13 }}>{label}</span>
      <span style={{ color: bold ? T.green : '#e5e7eb', fontWeight: bold ? 700 : 500, fontSize: 13 }}>
        {value}
      </span>
    </div>
  )
}
