/**
 * api/_pdf/layout.js
 * Primitivas de layout — padrão SmartPro PREMIUM (light theme).
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
let LOGO_BUF = null
try { LOGO_BUF = readFileSync(join(__dirname, 'assets', 'logo.png')) } catch {}

export const COR = {
  primary:    '#4f46e5',   // indigo-600
  primaryDk:  '#3730a3',   // indigo-800
  primarySoft:'#eef2ff',   // indigo-50
  accent:     '#6366f1',   // indigo-500
  ink:        '#0f172a',   // slate-900
  text:       '#334155',   // slate-700
  muted:      '#64748b',   // slate-500
  faint:      '#94a3b8',   // slate-400
  success:    '#059669',
  successSoft:'#d1fae5',
  danger:     '#dc2626',
  dangerSoft: '#fee2e2',
  warning:    '#d97706',
  warningSoft:'#fef3c7',
  info:       '#0891b2',
  infoSoft:   '#cffafe',
  bg:         '#ffffff',
  bgSoft:     '#f8fafc',   // slate-50
  bgRow:      '#f1f5f9',   // slate-100 (zebra)
  border:     '#e2e8f0',   // slate-200
  borderSoft: '#f1f5f9',
}

export function fmtBRL(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function fmtNumero(n) {
  return Number(n || 0).toLocaleString('pt-BR')
}

export function fmtData(d) {
  if (!d) return '—'
  const [y, m, day] = String(d).split('-')
  return `${day}/${m}/${y}`
}

/**
 * Cabeçalho PREMIUM:
 *  - fundo branco com brand chip + wordmark
 *  - título grande, subtítulo cinza
 *  - empresa + timestamp à direita
 *  - linha divisória fina abaixo
 */
export function renderHeader(doc, { titulo, subtitulo, empresa }) {
  const W = doc.page.width
  const M = 40

  doc.rect(0, 0, W, 120).fill('white')

  // Logo SmartPro (ou fallback chip+wordmark)
  const logoH = 64
  if (LOGO_BUF) {
    doc.image(LOGO_BUF, M, 18, { height: logoH })
  } else {
    const chipX = M, chipY = 26, chipS = 34
    doc.roundedRect(chipX, chipY, chipS, chipS, 8).fill(COR.primary)
    doc.fillColor('white').font('Helvetica-Bold').fontSize(15)
       .text('SP', chipX, chipY + 9, { width: chipS, align: 'center' })
    doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(15)
       .text('SmartPro', chipX + chipS + 10, chipY + 4)
    doc.fillColor(COR.muted).font('Helvetica').fontSize(8)
       .text('Gestão Inteligente', chipX + chipS + 10, chipY + 22)
  }

  // titulo + subtitulo
  doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(18)
     .text(titulo || '', M, 90, { width: W - M * 2 - 240 })
  if (subtitulo) {
    doc.fillColor(COR.muted).font('Helvetica').fontSize(9)
       .text(subtitulo, M, 112, { width: W - M * 2 - 240 })
  }

  // bloco empresa
  if (empresa) {
    doc.fillColor(COR.text).font('Helvetica-Bold').fontSize(9)
       .text(empresa, W - 240, 32, { width: 200, align: 'right' })
    doc.fillColor(COR.muted).font('Helvetica').fontSize(7.5)
       .text('Emitido em ' + new Date().toLocaleString('pt-BR'),
             W - 240, 46, { width: 200, align: 'right' })
  }

  // linha divisória
  doc.moveTo(M, 138).lineTo(W - M, 138).lineWidth(0.8).strokeColor(COR.border).stroke()

  doc.fillColor(COR.text).font('Helvetica')
  doc.y = 152
  return doc.y
}

/**
 * KPI cards premium:
 *  - até 4 por linha, brancos com borda fina e sombra simulada
 *  - faixa lateral colorida 3px, label tiny, valor grande, sub muted
 */
export function renderKPIs(doc, kpis = []) {
  if (!kpis.length) return doc.y
  const M = 40
  const gap = 12
  const cols = Math.min(4, kpis.length)
  const W = doc.page.width - M * 2
  const cardW = (W - gap * (cols - 1)) / cols
  const cardH = 72
  const y0 = doc.y + 4

  kpis.forEach((k, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = M + col * (cardW + gap)
    const y = y0 + row * (cardH + gap)
    const color = k.color || COR.primary

    // sombra simulada
    doc.roundedRect(x + 1.5, y + 2, cardW, cardH, 10).fill(COR.bgSoft)
    // card
    doc.roundedRect(x, y, cardW, cardH, 10).fill('white')
       .strokeColor(COR.border).lineWidth(0.8).stroke()
    // faixa lateral
    doc.rect(x, y, 3, cardH).fill(color)

    // label
    doc.fillColor(COR.muted).font('Helvetica-Bold').fontSize(7).text(
      String(k.label || '').toUpperCase(), x + 14, y + 12, {
        width: cardW - 22, characterSpacing: 0.6
      }
    )
    // value
    doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(16).text(
      String(k.value ?? '—'), x + 14, y + 26, { width: cardW - 22, ellipsis: true }
    )
    // sub
    if (k.sub) {
      doc.fillColor(COR.muted).font('Helvetica').fontSize(7.5).text(
        String(k.sub), x + 14, y + 52, { width: cardW - 22, ellipsis: true }
      )
    }
  })

  const linhas = Math.ceil(kpis.length / cols)
  doc.y = y0 + linhas * (cardH + gap) + 4
  return doc.y
}

/**
 * Título de seção com micro-underline accent.
 */
export function renderSecao(doc, texto) {
  doc.moveDown(0.5)
  const x = 40
  const y = doc.y
  doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(11).text(texto, x, y)
  const w = doc.widthOfString(texto)
  doc.moveTo(x, y + 14).lineTo(x + Math.min(w, 80), y + 14)
     .lineWidth(2).strokeColor(COR.primary).stroke()
  doc.moveDown(0.6)
  return doc.y
}

/**
 * Imagem PNG (Buffer) centralizada com moldura suave.
 */
export function renderChartImage(doc, buf, { width = 480, caption } = {}) {
  const x = (doc.page.width - width) / 2
  if (buf) {
    doc.roundedRect(x - 6, doc.y - 4, width + 12, width * 0.62 + 8, 8)
       .fill(COR.bgSoft)
    doc.image(buf, x, doc.y, { width })
    doc.y += width * 0.62 + 8
  } else {
    doc.roundedRect(x, doc.y, width, 80, 8).fill(COR.bgSoft)
       .strokeColor(COR.border).stroke()
    doc.fillColor(COR.muted).font('Helvetica').fontSize(9).text(
      'Gráfico indisponível no momento.', x, doc.y - 50, { width, align: 'center' }
    )
    doc.y += 90
  }
  if (caption) {
    doc.fillColor(COR.muted).font('Helvetica-Oblique').fontSize(8)
       .text(caption, 40, doc.y, { width: doc.page.width - 80, align: 'center' })
    doc.moveDown(0.4)
  }
}

/**
 * Tabela premium (zebra slate-100 + header indigo soft).
 * colunas: [{ key, label, width, align?, format? }]
 */
export function renderTabela(doc, { colunas, linhas }) {
  const M = 40
  const rowH = 18
  const startX = M
  const totalW = doc.page.width - M * 2

  // header
  doc.roundedRect(startX, doc.y, totalW, rowH, 4).fill(COR.primarySoft)
  doc.fillColor(COR.primaryDk).font('Helvetica-Bold').fontSize(8.5)
  let x = startX
  const headerY = doc.y + 5
  for (const c of colunas) {
    doc.text(c.label, x + 6, headerY, { width: c.width - 12, align: c.align || 'left' })
    x += c.width
  }
  doc.y += rowH + 2

  doc.font('Helvetica').fontSize(8).fillColor(COR.text)
  linhas.forEach((linha, i) => {
    if (doc.y > doc.page.height - 60) {
      doc.addPage()
      doc.fontSize(8).fillColor(COR.text)
    }
    const y = doc.y
    if (i % 2 === 0) {
      doc.rect(startX, y - 2, totalW, rowH).fill(COR.bgRow)
    }
    let cx = startX
    for (const c of colunas) {
      const v = c.format ? c.format(linha[c.key], linha) : (linha[c.key] ?? '—')
      doc.fillColor(linha._color?.[c.key] || COR.text).font('Helvetica').fontSize(8).text(
        String(v),
        cx + 6, y + 3,
        { width: c.width - 12, align: c.align || 'left', ellipsis: true }
      )
      cx += c.width
    }
    doc.y = y + rowH
  })
}

/**
 * Rodapé com linha divisória, marca e URL.
 */
export function renderFooter(doc) {
  const M = 40
  const W = doc.page.width
  const y = doc.page.height - 36
  doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.5).strokeColor(COR.border).stroke()
  doc.fontSize(7).fillColor(COR.muted).font('Helvetica').text(
    `SmartPro · Gestão Inteligente  ·  ${new Date().toLocaleString('pt-BR')}`,
    M, y + 8, { width: W - M * 2, align: 'center' }
  )
  doc.fontSize(6.5).fillColor(COR.faint).text(
    'smartpro.app.br', M, y + 19, { width: W - M * 2, align: 'center' }
  )
}
