// Presets de bancos brasileiros — cores oficiais + marca estilizada (texto/forma)
// Não usamos o logo oficial registrado de cada banco; usamos uma representação
// minimalista (inicial/wordmark) com a cor da marca para identificação visual.

export const BANCOS = [
  { id: 'nubank',    nome: 'Nubank',          cor: '#820AD1', gradiente: 'linear-gradient(135deg, #8A05BE 0%, #6B04A0 50%, #4A0072 100%)', sigla: 'nu', fonteLogo: 'rounded' },
  { id: 'itau',      nome: 'Itaú',            cor: '#EC7000', gradiente: 'linear-gradient(135deg, #EC7000, #003399)', sigla: 'itaú',  fonteLogo: 'sans' },
  { id: 'bradesco',  nome: 'Bradesco',        cor: '#CC092F', gradiente: 'linear-gradient(135deg, #CC092F, #7A0019)', sigla: 'bradesco', fonteLogo: 'sans' },
  { id: 'santander', nome: 'Santander',       cor: '#EC0000', gradiente: 'linear-gradient(135deg, #EC0000, #B30000)', sigla: 'Santander', fonteLogo: 'sans' },
  { id: 'bb',        nome: 'Banco do Brasil', cor: '#FFEF38', gradiente: 'linear-gradient(135deg, #FFEF38, #003B7E)', sigla: 'BB',    fonteLogo: 'sans', sigleColor: '#003B7E' },
  { id: 'caixa',     nome: 'Caixa',           cor: '#005CA9', gradiente: 'linear-gradient(135deg, #005CA9, #F39200)', sigla: 'CAIXA', fonteLogo: 'sans' },
  { id: 'inter',     nome: 'Inter',           cor: '#FF7A00', gradiente: 'linear-gradient(135deg, #FF7A00, #C25800)', sigla: 'inter', fonteLogo: 'sans' },
  { id: 'c6',        nome: 'C6 Bank',         cor: '#1C1C1C', gradiente: 'linear-gradient(135deg, #1C1C1C, #3A3A3A)', sigla: 'C6',    fonteLogo: 'sans' },
  { id: 'btg',       nome: 'BTG Pactual',     cor: '#0E2240', gradiente: 'linear-gradient(135deg, #0E2240, #1E3A5F)', sigla: 'BTG',   fonteLogo: 'serif' },
  { id: 'xp',        nome: 'XP',              cor: '#FFCB05', gradiente: 'linear-gradient(135deg, #FFCB05, #1E1E1E)', sigla: 'XP',    fonteLogo: 'sans', sigleColor: '#1E1E1E' },
  { id: 'will',      nome: 'Will Bank',       cor: '#48F058', gradiente: 'linear-gradient(135deg, #48F058, #1E1E1E)', sigla: 'will',  fonteLogo: 'sans', sigleColor: '#1E1E1E' },
  { id: 'next',      nome: 'Next',            cor: '#00FF5F', gradiente: 'linear-gradient(135deg, #00FF5F, #1E1E1E)', sigla: 'next',  fonteLogo: 'sans', sigleColor: '#1E1E1E' },
  { id: 'picpay',    nome: 'PicPay',          cor: '#11C76F', gradiente: 'linear-gradient(135deg, #11C76F, #0A8A4D)', sigla: 'PicPay', fonteLogo: 'sans' },
  { id: 'mercadopago', nome: 'Mercado Pago',  cor: '#1A1A1A', gradiente: 'linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)', sigla: 'Mercado Pago', fonteLogo: 'sans', sigleColor: 'rgba(255,255,255,0.85)', watermark: 'MERCADO\nPAGO' },
  { id: 'neon',      nome: 'Neon',            cor: '#00E0A4', gradiente: 'linear-gradient(135deg, #00E0A4, #1E1E1E)', sigla: 'neon',  fonteLogo: 'sans', sigleColor: '#1E1E1E' },
  { id: 'pan',       nome: 'Banco Pan',       cor: '#0078D7', gradiente: 'linear-gradient(135deg, #0078D7, #00509E)', sigla: 'pan',   fonteLogo: 'sans' },
  { id: 'safra',     nome: 'Safra',           cor: '#005CB9', gradiente: 'linear-gradient(135deg, #005CB9, #002F6C)', sigla: 'Safra', fonteLogo: 'serif' },
  { id: 'sicoob',    nome: 'Sicoob',          cor: '#003641', gradiente: 'linear-gradient(135deg, #003641, #00A859)', sigla: 'Sicoob', fonteLogo: 'sans' },
  { id: 'sicredi',   nome: 'Sicredi',         cor: '#00995D', gradiente: 'linear-gradient(135deg, #E8E8E8 0%, #C8CACC 50%, #A8AAAC 100%)', sigla: 'Sicredi', fonteLogo: 'sans', sigleColor: '#00995D', textColor: '#1f2937' },
  { id: 'original',  nome: 'Original',        cor: '#00753F', gradiente: 'linear-gradient(135deg, #00753F, #00A859)', sigla: 'Original', fonteLogo: 'sans' },
  { id: 'havan',     nome: 'Havan',           cor: '#7FD8C5', gradiente: 'linear-gradient(135deg, #A8E5D8 0%, #7FD8C5 50%, #5FC9B2 100%)', sigla: 'HAVAN', fonteLogo: 'serif', logoTipo: 'havan' },
  { id: 'bv',        nome: 'BV',              cor: '#1E5BBF', gradiente: 'linear-gradient(135deg, #2C6FE0 0%, #1E5BBF 50%, #154A9E 100%)', sigla: 'BV', fonteLogo: 'sans', logoTipo: 'bv' },
  { id: 'semparar',  nome: 'Sem Parar',       cor: '#D6175A', gradiente: 'linear-gradient(135deg, #E91E63 0%, #C2185B 50%, #8E0E3C 100%)', sigla: 'SEM\nPARAR', fonteLogo: 'sans', logoTipo: 'semparar' },
  { id: 'custom',    nome: 'Personalizado',   cor: '#6366f1', gradiente: 'linear-gradient(135deg, #6366f1, #6366f199)', sigla: '',      fonteLogo: 'sans' },
]

export function getBanco(id) {
  return BANCOS.find(b => b.id === id) || BANCOS.find(b => b.id === 'custom')
}

// ─── Logo do banco (texto estilizado) ───────────────────────────────────────
export function BancoLogo({ banco, size = 18, color }) {
  const b = typeof banco === 'string' ? getBanco(banco) : banco
  if (!b || !b.sigla) return null
  // Caso especial Nubank: "nu" arredondado em outline (estilo do cartão oficial)
  if (b.id === 'nubank') {
    const h = size * 1.4
    return (
      <svg width={h * 1.6} height={h} viewBox="0 0 80 56" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M14 14 v28 M14 14 c0 0 4 -4 12 -4 c8 0 12 4 12 12 v20 M44 14 v20 c0 8 4 12 12 12 c8 0 12 -4 12 -12 v-20"
          stroke={color || 'white'} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    )
  }
  // Caso especial Sem Parar: "SEM PARAR" empilhado com setinha pra cima
  if (b.id === 'semparar') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: color || 'white' }}>
        <span style={{
          fontSize: size * 0.78, fontWeight: 900, lineHeight: 0.95,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          letterSpacing: 0.5, whiteSpace: 'pre',
        }}>{'SEM\nPARAR'}</span>
        <svg width={size * 0.55} height={size * 0.85} viewBox="0 0 12 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 17 V3 M2 7 L6 3 L10 7" stroke={color || 'white'} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  // Caso especial BV: símbolo "B+V" estilizado
  if (b.id === 'bv') {
    const c = color || 'white'
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, color: c }}>
        <svg width={size * 1.6} height={size * 1.6} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          {/* B branco com cruz */}
          <path d="M6 8 H15 Q20 8 20 13 Q20 17 16 18 Q20 19 20 23 Q20 28 15 28 H6 Z" fill={c} />
          <rect x="9" y="11" width="6" height="4" fill="rgba(0,0,0,0.001)" />
          <rect x="9" y="20" width="6" height="5" fill="rgba(0,0,0,0.001)" />
          {/* cruz dentro do B */}
          <rect x="9.5" y="13" width="3" height="6" fill="rgba(30,91,191,0.9)" />
          <rect x="8" y="14.5" width="6" height="3" fill="rgba(30,91,191,0.9)" />
          {/* V azul claro */}
          <path d="M22 10 L28 28 L34 10 L30 10 L28 22 L26 10 Z" fill="rgba(255,255,255,0.78)" />
        </svg>
        <span style={{
          fontSize: size * 0.5, fontWeight: 600,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          letterSpacing: 0.3, lineHeight: 1, marginBottom: size * 0.15,
        }}>banco</span>
      </div>
    )
  }
  // Caso especial Havan: H dentro de losango + texto + Cliente Especial
  if (b.id === 'havan') {
    const c = color || '#0A4B8E'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: c }}>
        <svg width={size * 1.4} height={size * 1.4} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2 L22 12 L12 22 L2 12 Z" stroke={c} strokeWidth="1.5" fill="none" />
          <path d="M9 8 V16 M15 8 V16 M9 12 H15" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            fontSize: size * 1.1, fontWeight: 700,
            fontFamily: 'Georgia, "Times New Roman", serif',
            letterSpacing: 1,
          }}>HAVAN</span>
          <span style={{
            fontSize: size * 0.5, fontWeight: 400,
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontStyle: 'italic', marginTop: 2, letterSpacing: 0.3,
          }}>Cliente Especial</span>
        </div>
      </div>
    )
  }
  const family = b.fonteLogo === 'serif'
    ? 'Georgia, "Times New Roman", serif'
    : b.fonteLogo === 'rounded'
      ? '"SF Pro Rounded", "Nunito", system-ui, sans-serif'
      : 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
  return (
    <span style={{
      fontSize: size,
      fontWeight: 800,
      fontFamily: family,
      color: color || b.sigleColor || 'white',
      letterSpacing: b.sigla.length > 3 ? -0.5 : 0,
      lineHeight: 1,
      whiteSpace: 'nowrap',
    }}>{b.sigla}</span>
  )
}

// ─── Chip e contactless (ícones clássicos de cartão) ────────────────
export function ChipIcon({ size = 28, color = '#D4AF37' }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 36 28" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="34" height="26" rx="4" fill={color} stroke="rgba(0,0,0,0.2)" />
      <line x1="12" y1="1" x2="12" y2="27" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
      <line x1="24" y1="1" x2="24" y2="27" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
      <line x1="1" y1="9" x2="35" y2="9" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
      <line x1="1" y1="19" x2="35" y2="19" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
      <rect x="12" y="9" width="12" height="10" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" />
    </svg>
  )
}

export function ContactlessIcon({ size = 18, color = 'rgba(255,255,255,0.85)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5a14 14 0 010 14" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M9 8a9 9 0 010 8" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M13 11a4 4 0 010 2" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// ─── Bandeira (SVG estilizado) ──────────────────────────────────────────────
// Representações minimalistas das bandeiras — não são os logos oficiais.

export function BandeiraIcon({ bandeira, size = 36 }) {
  const w = size
  const h = Math.round(size * 0.62)
  switch ((bandeira || '').toLowerCase()) {
    case 'visa':
      return (
        <svg width={w} height={h} viewBox="0 0 60 20" xmlns="http://www.w3.org/2000/svg">
          <text x="30" y="16" textAnchor="middle"
            fontFamily="Arial Black, sans-serif" fontSize="16" fontStyle="italic"
            fontWeight="900" fill="#1A1F71" letterSpacing="-1">VISA</text>
        </svg>
      )
    case 'mastercard':
    case 'master':
      return (
        <svg width={w} height={h} viewBox="0 0 40 25" xmlns="http://www.w3.org/2000/svg">
          <circle cx="15" cy="12.5" r="9" fill="#EB001B" />
          <circle cx="25" cy="12.5" r="9" fill="#F79E1B" />
          <path d="M20 5.5a9 9 0 010 14 9 9 0 010-14z" fill="#FF5F00" />
        </svg>
      )
    case 'elo':
      return (
        <svg width={w} height={h} viewBox="0 0 60 25" xmlns="http://www.w3.org/2000/svg">
          <rect width="60" height="25" rx="4" fill="#000" />
          <circle cx="18" cy="12.5" r="5" fill="#FFCB05" />
          <circle cx="30" cy="12.5" r="5" fill="#EE3124" />
          <circle cx="42" cy="12.5" r="5" fill="#00A4E0" />
        </svg>
      )
    case 'amex':
    case 'american express':
      return (
        <svg width={w} height={h} viewBox="0 0 60 25" xmlns="http://www.w3.org/2000/svg">
          <rect width="60" height="25" rx="3" fill="#2E77BC" />
          <text x="30" y="17" textAnchor="middle"
            fontFamily="Arial Black, sans-serif" fontSize="9" fontWeight="900"
            fill="white" letterSpacing="0.5">AMEX</text>
        </svg>
      )
    case 'hipercard':
    case 'hiper':
      return (
        <svg width={w} height={h} viewBox="0 0 60 25" xmlns="http://www.w3.org/2000/svg">
          <rect width="60" height="25" rx="3" fill="#B3131B" />
          <text x="30" y="17" textAnchor="middle"
            fontFamily="Arial Black, sans-serif" fontSize="9" fontWeight="900"
            fill="white" letterSpacing="0.3">HIPER</text>
        </svg>
      )
    default:
      return null
  }
}
