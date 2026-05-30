/**
 * theme.js — Tokens do tema claro (SmartPro)
 *
 * Use estes valores para cores em inline styles de componentes React,
 * especialmente em hover handlers (onMouseEnter/Leave) e cálculos de cor
 * que não podem usar var(--*) diretamente.
 *
 * Para propriedades estáticas, prefira as variáveis CSS:
 *   var(--bg-primary)  → fundo da página
 *   var(--bg-card)     → fundo de cards/tabelas
 *   var(--bg-secondary)→ fundo de cabeçalhos de tabela, filtros
 *   var(--border)      → bordas sutis
 *   var(--text-primary)→ texto principal
 *   var(--text-secondary) → texto secundário / labels
 *   var(--accent)      → cor de destaque (índigo #6366f1)
 *   var(--shadow-card) → sombra padrão de card
 */
export const LC = {
  // Backgrounds
  bg:           'var(--bg-primary)',
  card:         'var(--bg-card)',
  secondary:    'var(--bg-secondary)',
  hover:        '#F8FAFC',          // hover de linha de tabela (light)
  hoverDark:    'rgba(0,0,0,0.03)', // hover alternativo

  // Bordas
  border:       'var(--border)',
  borderStrong: '#C7D2E2',

  // Texto
  txtPrimary:   'var(--text-primary)',
  txtSecondary: 'var(--text-secondary)',
  txtMuted:     '#9AA3BF',

  // Accent
  accent:       'var(--accent)',    // #6366f1 em light, #00c896 em dark
  accentLight:  '#EEF0FE',         // fundo sutil indigo para chips/badges ativos

  // Valores literais usados em JS (ex: onMouseEnter/Leave)
  hoverBg:      '#F8FAFC',
  selectedBg:   '#EEF0FE',
  theadBg:      '#EEF2F8',         // cabeçalho de tabela
}

/**
 * Padrão de estrutura para novas páginas com tabela/lista:
 *
 * export default function MinhaPage() {
 *   return (
 *     <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
 *       <Header title="..." subtitle="..." />
 *       <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
 *
 *         // Cards de resumo
 *         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 24 }}>
 *           {cards.map(c => (
 *             <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: `3px solid ${c.color}`, borderRadius: 14, padding: '18px 20px', boxShadow: 'var(--shadow-card)' }}>
 *               ...
 *             </div>
 *           ))}
 *         </div>
 *
 *         // Barra de ações: chips de filtro + busca + botão Novo
 *         <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
 *           {filtros.map(f => (
 *             <button onClick={() => setFiltro(f.key)} style={{
 *               padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
 *               background: filtro === f.key ? 'var(--accent)' : 'var(--bg-card)',
 *               color: filtro === f.key ? '#fff' : 'var(--text-secondary)',
 *               borderColor: filtro === f.key ? 'var(--accent)' : 'var(--border)',
 *             }}>{f.label}</button>
 *           ))}
 *           <input placeholder="Buscar..." style={{ flex: 1, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }} />
 *           <button style={{ padding: '8px 18px', borderRadius: 9, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>+ Novo</button>
 *         </div>
 *
 *         // Tabela
 *         <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
 *           <div style={{ overflowX: 'auto' }}>
 *             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
 *               <thead>
 *                 <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
 *                   {cols.map(col => <th style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{col}</th>)}
 *                 </tr>
 *                 // 2ª linha: filtros por coluna (opcional)
 *                 <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
 *                   {cols.map(col => <td><input placeholder="..." style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 6px', fontSize: 11, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} /></td>)}
 *                 </tr>
 *               </thead>
 *               <tbody>
 *                 {rows.map((row, i) => (
 *                   <tr key={row.id}
 *                     style={{ borderBottom: '1px solid var(--border)' }}
 *                     onMouseEnter={e => e.currentTarget.style.background = LC.hoverBg}
 *                     onMouseLeave={e => e.currentTarget.style.background = ''}
 *                   >
 *                     ...células...
 *                   </tr>
 *                 ))}
 *               </tbody>
 *             </table>
 *           </div>
 *         </div>
 *
 *       </div>
 *     </div>
 *   )
 * }
 */
