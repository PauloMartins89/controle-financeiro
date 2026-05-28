import { useState, useEffect } from 'react'

/**
 * Hook que retorna os tokens de design padronizados do SmartPro.
 * Padrão visual baseado na tela de Refeições (referência).
 *
 * Uso:
 *   const { BG, CARD, BORDER, SHADOW, TEXT, TEXT2, TEXT3, cardStyle, isDark } = useThemeTokens()
 */
export function useThemeTokens() {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') !== 'light'
  )

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.getAttribute('data-theme') !== 'light')
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const BG     = isDark ? '#0d0f12'                : '#EEF2F8'
  const CARD   = isDark ? '#1a1d22'                : '#FFFFFF'
  const BORDER = isDark ? 'rgba(255,255,255,0.08)' : '#E5EAF2'
  const SHADOW = isDark
    ? '0 1px 4px rgba(0,0,0,0.3), 0 4px 20px rgba(0,0,0,0.25)'
    : '0 1px 4px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.05)'
  const TEXT   = isDark ? '#e8eaed'                : '#1A2332'
  const TEXT2  = isDark ? '#8a9099'                : '#6B7A99'
  const TEXT3  = isDark ? '#555d6e'                : '#A0AEC0'

  const cardStyle = {
    background: CARD,
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    boxShadow: SHADOW,
  }

  /** Input / search field background */
  const INPUT_BG = isDark ? '#1f2329' : '#F8FAFC'

  /** Hover shadow para cards clicáveis */
  const SHADOW_HOVER = isDark
    ? '0 4px 20px rgba(0,0,0,0.5)'
    : '0 4px 20px rgba(0,0,0,0.12)'

  return {
    isDark,
    BG, CARD, BORDER, SHADOW, SHADOW_HOVER,
    TEXT, TEXT2, TEXT3,
    cardStyle,
    INPUT_BG,
  }
}
