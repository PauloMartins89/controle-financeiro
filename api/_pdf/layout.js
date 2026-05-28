/**
 * api/_pdf/layout.js
 * Padrão SmartPro PREMIUM CORPORATIVO (header navy + cards + ícones vetoriais).
 * 100% vetorial — única imagem é o logo opcional.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
let LOGO_BUF = null
try { LOGO_BUF = readFileSync(join(__dirname, 'assets', 'logo_smartpro.png')) } catch {}
if (!LOGO_BUF) { try { LOGO_BUF = readFileSync(join(__dirname, 'assets', 'logo.png')) } catch {} }

export const COR = {
  navy:        '#1e3a5f',
  navyDk:      '#15293e',
  accent:      '#2563eb',
  ink:         '#0f172a',
  text:        '#1f2937',
  textMd:      '#4b5563',
  muted:       '#6b7280',
  faint:       '#9ca3af',
  bg:          '#ffffff',
  bgSoft:      '#f9fafb',
  bgCard:      '#f3f4f6',
  bgRow:       '#f9fafb',
  border:      '#e5e7eb',
  borderSoft:  '#f3f4f6',
  success:     '#10b981',
  successSoft: '#d1fae5',
  danger:      '#ef4444',
  dangerSoft:  '#fee2e2',
  warning:     '#f59e0b',
  warningSoft: '#fef3c7',
  info:        '#3b82f6',
  infoSoft:    '#dbeafe',
  purple:      '#8b5cf6',
  purpleSoft:  '#ede9fe',
  donutGreen:  '#84cc16',
  donutYellow: '#fbbf24',
  donutOrange: '#fb923c',
  donutRed:    '#ef4444',
  donutBlue:   '#3b82f6',
  donutPurple: '#8b5cf6',
  lineBlue:    '#2563eb',
  // legacy compat
  primary:     '#2563eb',
  primaryDk:   '#1d4ed8',
  primarySoft: '#dbeafe',
}

const M = 24
const GAP = 8
const W_PAGE = 595

export function fmtBRL(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
export function fmtNumero(n) {
  return Number(n || 0).toLocaleString('pt-BR')
}
export function fmtData(d) {
  if (!d) return '—'
  const s = String(d)
  if (s.includes('/')) return s
  const [y, m, day] = s.split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

// CARD container
export function card(doc, x, y, w, h, { radius = 6, fill = COR.bgSoft, stroke = COR.border } = {}) {
  doc.save()
  if (fill) { doc.roundedRect(x, y, w, h, radius).fillColor(fill).fill() }
  if (stroke) { doc.roundedRect(x, y, w, h, radius).lineWidth(0.6).strokeColor(stroke).stroke() }
  doc.restore()
}

// HEADER navy + meta box
export function renderHeader(doc, { titulo, modulo, subtitulo, meta } = {}) {
  const x = M, y = M
  const W = W_PAGE - M * 2
  const H = 92
  const brandW = 180

  // bloco navy com logo centralizada
  doc.save()
  doc.roundedRect(x, y, brandW, H, 6).fillColor(COR.navy).fill()
  if (LOGO_BUF) {
    try {
      const padX = 8, padY = 8
      doc.image(LOGO_BUF, x + padX, y + padY, {
        fit: [brandW - padX * 2, H - padY * 2],
        align: 'center',
        valign: 'center',
      })
    } catch {}
  }
  doc.restore()

  const cx = x + brandW + GAP
  const cw = W - brandW - GAP
  card(doc, cx, y, cw, H, { fill: COR.bg })

  const tx = cx + 18
  doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(16)
     .text(String(titulo || 'RELATÓRIO').toUpperCase(), tx, y + 14, { width: cw - 200, lineBreak: false, ellipsis: true })
  if (modulo) {
    doc.fillColor(COR.accent).font('Helvetica-Bold').fontSize(12)
       .text(String(modulo).toUpperCase(), tx, y + 34, { width: cw - 200, lineBreak: false, ellipsis: true })
  }
  if (subtitulo) {
    doc.fillColor(COR.muted).font('Helvetica').fontSize(8.5)
       .text(String(subtitulo), tx, y + 54, { width: cw - 200, height: 30, ellipsis: true })
  }

  const mx = cx + cw - 170
  const items = []
  if (meta?.periodo)   items.push({ ico: 'cal',   label: 'Período',    value: meta.periodo })
  if (meta?.geradoEm)  items.push({ ico: 'print', label: 'Gerado em',  value: meta.geradoEm })
  if (meta?.geradoPor) items.push({ ico: 'user',  label: 'Gerado por', value: meta.geradoPor })

  let my = y + 14
  for (const it of items) {
    drawIcon(doc, it.ico, mx, my + 1, 11, COR.muted)
    doc.fillColor(COR.text).font('Helvetica-Bold').fontSize(8)
       .text(it.label, mx + 18, my, { width: 150, lineBreak: false })
    doc.fillColor(COR.muted).font('Helvetica').fontSize(8)
       .text(String(it.value), mx + 18, my + 10, { width: 150, lineBreak: false, ellipsis: true })
    my += 24
  }

  doc.y = y + H + GAP
}

// VISÃO GERAL
export function renderVisaoGeral(doc, { titulo = '1. VISÃO GERAL DO MÓDULO', texto } = {}) {
  if (!texto) return
  const x = M, y = doc.y
  const W = W_PAGE - M * 2
  const H = 76
  card(doc, x, y, W, H)

  const cx = x + 40, cy = y + H / 2
  doc.circle(cx, cy, 18).fillColor(COR.navy).fill()
  drawIcon(doc, 'doc', cx - 8, cy - 8, 16, '#ffffff')

  const tx = x + 80
  doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(10)
     .text(titulo, tx, y + 14, { width: W - 100, lineBreak: false })
  doc.fillColor(COR.textMd).font('Helvetica').fontSize(8.5)
     .text(texto, tx, y + 30, { width: W - 100, height: H - 36, ellipsis: true })

  doc.y = y + H + GAP
}

// KPIs
export function renderKPIs(doc, kpis = [], { titulo = '2. INDICADORES PRINCIPAIS' } = {}) {
  if (!kpis.length) return
  const x = M, y = doc.y
  const W = W_PAGE - M * 2
  const H = 108
  card(doc, x, y, W, H, { fill: COR.bgSoft })
  doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(9.5)
     .text(titulo, x + 14, y + 10, { lineBreak: false })

  const n = Math.min(kpis.length, 6)
  const innerX = x + 14
  const innerY = y + 28
  const innerW = W - 28
  const cardH = H - 38
  const cardW = (innerW - GAP * (n - 1)) / n
  const TONES = ['info','success','warning','danger','purple','info']
  const ICONS = ['doc','check','clock','x','chart','chat']

  for (let i = 0; i < n; i++) {
    const k = kpis[i]
    const kx = innerX + i * (cardW + GAP)
    card(doc, kx, innerY, cardW, cardH, { fill: COR.bg })
    const iconKey = k.icon || ICONS[i] || 'dot'
    const tone    = k.tone || TONES[i] || 'info'
    const toneBg  = COR[tone + 'Soft'] || COR.infoSoft
    const toneFg  = COR[tone] || COR.info

    const ix = kx + cardW / 2, iy = innerY + 16
    doc.circle(ix, iy, 12).fillColor(toneBg).fill()
    drawIcon(doc, iconKey, ix - 7, iy - 7, 14, toneFg)

    doc.fillColor(COR.muted).font('Helvetica').fontSize(7.5)
       .text(String(k.label || ''), kx, iy + 16, { width: cardW, align: 'center', lineBreak: false, ellipsis: true })
    doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(13)
       .text(String(k.value ?? '—'), kx, iy + 28, { width: cardW, align: 'center', lineBreak: false, ellipsis: true })

    if (k.delta != null) {
      const positivo = Number(k.delta) >= 0
      const cor = positivo ? COR.success : COR.danger
      const arrow = positivo ? '▲' : '▼'
      const abs = Math.abs(Number(k.delta)).toFixed(1).replace('.', ',')
      doc.fillColor(cor).font('Helvetica-Bold').fontSize(7.5)
         .text(`${arrow} ${abs}%`, kx, iy + 46, { width: cardW, align: 'center', lineBreak: false })
      if (k.deltaLabel) {
        doc.fillColor(COR.faint).font('Helvetica').fontSize(6.5)
           .text(k.deltaLabel, kx, iy + 56, { width: cardW, align: 'center', lineBreak: false })
      }
    } else if (k.sub) {
      doc.fillColor(COR.faint).font('Helvetica').fontSize(6.5)
         .text(String(k.sub), kx, iy + 48, { width: cardW, align: 'center', lineBreak: false, ellipsis: true })
    }
  }
  doc.y = y + H + GAP
}

// LINHA + DONUT lado a lado
export function renderGraficosDuplo(doc, { linha, pizza, titulos } = {}) {
  if (!linha?.labels?.length && !pizza?.labels?.length) return
  const x = M, y = doc.y
  const W = W_PAGE - M * 2
  const H = 170
  const dual = linha?.labels?.length && pizza?.labels?.length
  const half = (W - GAP) / 2

  if (linha?.labels?.length) {
    const w = dual ? half : W
    card(doc, x, y, w, H, { fill: COR.bgSoft })
    doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(9.5)
       .text(titulos?.linha || '3. EVOLUÇÃO NO PERÍODO', x + 12, y + 10, { lineBreak: false })
    drawLineChart(doc, x + 12, y + 28, w - 24, H - 36, linha)
  }
  if (pizza?.labels?.length) {
    const dx = dual ? x + half + GAP : x
    const dw = dual ? half : W
    card(doc, dx, y, dw, H, { fill: COR.bgSoft })
    doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(9.5)
       .text(titulos?.pizza || '4. DISTRIBUIÇÃO', dx + 12, y + 10, { lineBreak: false })
    drawDonut(doc, dx + 12, y + 28, dw - 24, H - 36, pizza)
  }
  doc.y = y + H + GAP
}

function drawLineChart(doc, x, y, w, h, { labels, data, label }) {
  const padL = 30, padR = 8, padT = 8, padB = 18
  const ix = x + padL, iy = y + padT
  const iw = w - padL - padR, ih = h - padT - padB
  const vals = data.map(v => Number(v || 0))
  const maxV = Math.max(1, ...vals)
  const minV = Math.min(0, ...vals)
  const range = (maxV - minV) || 1

  doc.save().lineWidth(0.4).strokeColor(COR.border)
  for (let i = 0; i <= 5; i++) {
    const gy = iy + (ih / 5) * i
    doc.moveTo(ix, gy).lineTo(ix + iw, gy).stroke()
  }
  doc.restore()
  doc.fillColor(COR.muted).font('Helvetica').fontSize(6.5)
  for (let i = 0; i <= 5; i++) {
    const gy = iy + (ih / 5) * i
    const v = maxV - (range / 5) * i
    doc.text(fmtCompact(v), x, gy - 3, { width: padL - 4, align: 'right', lineBreak: false })
  }

  if (label) {
    doc.save()
    doc.circle(ix + 4, iy - 2, 2.5).fillColor(COR.lineBlue).fill()
    doc.fillColor(COR.text).font('Helvetica').fontSize(7)
       .text(label, ix + 10, iy - 6, { lineBreak: false })
    doc.restore()
  }

  const n = data.length
  const step = n > 1 ? iw / (n - 1) : 0
  const points = vals.map((v, i) => ({
    x: ix + step * i,
    y: iy + ih - ((v - minV) / range) * ih,
  }))
  doc.save().strokeColor(COR.lineBlue).lineWidth(1.4)
  if (points.length) doc.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) doc.lineTo(points[i].x, points[i].y)
  doc.stroke()
  for (const p of points) doc.circle(p.x, p.y, 2).fillColor(COR.lineBlue).fill()
  doc.restore()

  const baseY = iy + ih + 3
  const skip = Math.max(1, Math.ceil(n / 8))
  doc.fillColor(COR.muted).font('Helvetica').fontSize(6.5)
  for (let i = 0; i < n; i++) {
    if (i % skip !== 0 && i !== n - 1) continue
    doc.text(String(labels[i] || ''), points[i].x - 16, baseY, { width: 32, align: 'center', lineBreak: false })
  }
}

function drawDonut(doc, x, y, w, h, { labels, data, colors }) {
  const total = data.reduce((a, v) => a + Number(v || 0), 0)
  if (!total) return
  const cx = x + 60
  const cy = y + h / 2
  const R = Math.min(h / 2 - 6, 52)
  const r = R - 18
  const PALETA = [COR.donutGreen, COR.donutYellow, COR.donutOrange, COR.donutRed, COR.donutBlue, COR.donutPurple]

  let ang = -Math.PI / 2
  let biggest = { pct: 0 }
  for (let i = 0; i < data.length; i++) {
    const v = Number(data[i] || 0)
    if (v <= 0) continue
    const slice = (v / total) * Math.PI * 2
    const a2 = ang + slice
    const cor = (colors && colors[i]) || PALETA[i % PALETA.length]
    doc.save()
    doc.path(
      `M ${cx + R * Math.cos(ang)} ${cy + R * Math.sin(ang)}` +
      arcSvg(cx, cy, R, ang, a2) +
      ` L ${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)}` +
      arcSvg(cx, cy, r, a2, ang, true) + ' Z'
    ).fillColor(cor).fill()
    doc.restore()
    const pct = (v / total) * 100
    if (pct > biggest.pct) biggest = { pct, mid: (ang + a2) / 2 }
    if (pct >= 6) {
      const lr = (R + r) / 2
      const lx = cx + lr * Math.cos((ang + a2) / 2) - 12
      const ly = cy + lr * Math.sin((ang + a2) / 2) - 3
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6.5)
         .text(`${pct.toFixed(1)}%`, lx, ly, { width: 24, align: 'center', lineBreak: false })
    }
    ang = a2
  }
  if (biggest.pct) {
    doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(11)
       .text(`${biggest.pct.toFixed(1)}%`, cx - 22, cy - 5, { width: 44, align: 'center', lineBreak: false })
  }

  const lx = x + 130
  let ly = y + 12
  for (let i = 0; i < labels.length; i++) {
    if (ly > y + h - 30) break
    const cor = (colors && colors[i]) || PALETA[i % PALETA.length]
    doc.rect(lx, ly + 2, 8, 8).fillColor(cor).fill()
    doc.fillColor(COR.text).font('Helvetica').fontSize(7.5)
       .text(`${labels[i]} (${fmtCompact(data[i])})`, lx + 12, ly, { width: w - 138, lineBreak: false, ellipsis: true })
    ly += 13
  }
  doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(8)
     .text(`Total: ${fmtCompact(total)}`, lx, y + h - 14, { width: w - 138, lineBreak: false })
}

function arcSvg(cx, cy, r, a1, a2) {
  const SEG = Math.PI / 3
  const ang = a2 - a1
  const n = Math.max(1, Math.ceil(Math.abs(ang) / SEG))
  const step = ang / n
  let s = ''
  let t = a1
  for (let i = 0; i < n; i++) {
    const t1 = t, t2 = t + step
    const k = (4 / 3) * Math.tan((t2 - t1) / 4)
    const x1 = cx + r * (Math.cos(t1) - k * Math.sin(t1))
    const y1 = cy + r * (Math.sin(t1) + k * Math.cos(t1))
    const x2 = cx + r * (Math.cos(t2) + k * Math.sin(t2))
    const y2 = cy + r * (Math.sin(t2) - k * Math.cos(t2))
    const x3 = cx + r * Math.cos(t2)
    const y3 = cy + r * Math.sin(t2)
    s += ` C ${x1} ${y1} ${x2} ${y2} ${x3} ${y3}`
    t = t2
  }
  return s
}

function fmtCompact(n) {
  const v = Number(n || 0)
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.', ',') + 'M'
  if (Math.abs(v) >= 1_000)     return (v / 1_000).toFixed(1).replace('.', ',') + 'k'
  return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// TABELA
export function renderTabela(doc, { titulo = '5. DETALHAMENTO', colunas, linhas, totais } = {}) {
  if (!colunas?.length) return
  const x = M
  const y0 = doc.y
  const W = W_PAGE - M * 2
  const rowH = 18
  const headH = 22

  // bg do bloco título
  card(doc, x, y0, W, 28, { fill: COR.bgSoft })
  doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(9.5)
     .text(titulo, x + 14, y0 + 9, { lineBreak: false })

  let cy = y0 + 32
  drawTableHeader(doc, x, cy, W, headH, colunas)
  cy += headH + 2

  doc.font('Helvetica').fontSize(7.5).fillColor(COR.text)
  ;(linhas || []).forEach((linha, i) => {
    if (cy + rowH > doc.page.height - 45) {
      doc.addPage()
      cy = M
      drawTableHeader(doc, x, cy, W, headH, colunas)
      cy += headH + 2
    }
    if (i % 2 === 1) {
      doc.rect(x, cy, W, rowH).fillColor(COR.bgRow).fill()
    }
    let cx = x
    const totalW = W
    const sumWidth = colunas.reduce((a, c) => a + (c.width || 0), 0) || totalW
    for (const c of colunas) {
      const colW = (c.width || 0) * (totalW / sumWidth) || (totalW / colunas.length)
      const raw = c.format ? c.format(linha[c.key], linha) : (linha[c.key] ?? '—')
      doc.fillColor(linha._color?.[c.key] || COR.text).font('Helvetica').fontSize(7.5)
      const v = fitText(doc, String(raw), colW - 16)
      doc.text(v, cx + 8, cy + 6, { width: colW - 16, align: c.align || 'left', lineBreak: false })
      cx += colW
    }
    doc.save().strokeColor(COR.borderSoft).lineWidth(0.4)
       .moveTo(x, cy + rowH).lineTo(x + W, cy + rowH).stroke().restore()
    cy += rowH
  })

  if (totais) {
    if (cy + 22 > doc.page.height - 45) { doc.addPage(); cy = M }
    doc.rect(x, cy, W, 22).fillColor(COR.bgCard).fill()
    let cx = x
    const sumWidth = colunas.reduce((a, c) => a + (c.width || 0), 0) || W
    for (const c of colunas) {
      const colW = (c.width || 0) * (W / sumWidth) || (W / colunas.length)
      const v = totais[c.key]
      if (v != null) {
        doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(8)
        const txt = fitText(doc, String(v), colW - 16)
        doc.text(txt, cx + 8, cy + 7, { width: colW - 16, align: c.align || 'left', lineBreak: false })
      }
      cx += colW
    }
    cy += 22
  }
  doc.y = cy + GAP
}

function drawTableHeader(doc, x, y, w, h, colunas) {
  doc.roundedRect(x, y, w, h, 4).fillColor(COR.navy).fill()
  const sumWidth = colunas.reduce((a, c) => a + (c.width || 0), 0) || w
  let cx = x
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8)
  for (const c of colunas) {
    const colW = (c.width || 0) * (w / sumWidth) || (w / colunas.length)
    const label = fitText(doc, c.label, colW - 16)
    doc.text(label, cx + 8, y + 7, { width: colW - 16, align: c.align || 'left', lineBreak: false })
    cx += colW
  }
}

function fitText(doc, s, maxW) {
  if (!s) return ''
  if (doc.widthOfString(s) <= maxW) return s
  let lo = 0, hi = s.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (doc.widthOfString(s.slice(0, mid) + '…') <= maxW) lo = mid
    else hi = mid - 1
  }
  return s.slice(0, lo) + '…'
}

// CARDS análise + observações
export function renderCardsTexto(doc, { analise, observacoes } = {}) {
  if (!analise?.length && !observacoes?.length) return
  const x = M, y = doc.y
  const W = W_PAGE - M * 2
  const H = 100
  const dual = analise?.length && observacoes?.length
  const half = (W - GAP) / 2

  if (analise?.length) {
    desenhaCardTexto(doc, x, y, dual ? half : W, H, {
      titulo: '6. ANÁLISE', itens: analise, ico: 'chart', tone: 'info',
    })
  }
  if (observacoes?.length) {
    const ox = dual ? x + half + GAP : x
    const ow = dual ? half : W
    desenhaCardTexto(doc, ox, y, ow, H, {
      titulo: '7. OBSERVAÇÕES', itens: observacoes, ico: 'chat', tone: 'purple',
    })
  }
  doc.y = y + H + GAP
}

function desenhaCardTexto(doc, x, y, w, h, { titulo, itens, ico, tone }) {
  card(doc, x, y, w, h, { fill: COR.bgSoft })
  const cx = x + 22, cy = y + 22
  doc.circle(cx, cy, 12).fillColor(COR[tone + 'Soft'] || COR.infoSoft).fill()
  drawIcon(doc, ico, cx - 7, cy - 7, 14, COR[tone] || COR.info)
  doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(9.5)
     .text(titulo, x + 42, y + 16, { lineBreak: false })

  let by = y + 38
  for (const it of itens.slice(0, 4)) {
    if (by > y + h - 12) break
    doc.fillColor(COR.muted).font('Helvetica-Bold').fontSize(8).text('•', x + 14, by, { lineBreak: false })
    doc.fillColor(COR.textMd).font('Helvetica').fontSize(8)
       .text(String(it), x + 22, by, { width: w - 32, height: 20, ellipsis: true })
    by = Math.max(by + 14, doc.y + 2)
    doc.y = by
  }
}

// FOOTER
export function renderFooter(doc, pageNum, totalPages, { titulo } = {}) {
  // PDFKit cria nova página se texto cruzar a margem inferior. Zeramos temporariamente.
  const prevBottom = doc.page.margins.bottom
  doc.page.margins.bottom = 0
  doc.y = 40
  const W = doc.page.width
  const y = doc.page.height - 26
  doc.save().lineWidth(0.5).strokeColor(COR.border)
     .moveTo(M, y).lineTo(W - M, y).stroke().restore()
  doc.fillColor(COR.muted).font('Helvetica').fontSize(7.5)
     .text(String(titulo || 'SmartPro'), M, y + 6, { width: W - M * 2 - 80, align: 'left', lineBreak: false })
  doc.y = 40
  if (typeof pageNum === 'number' && typeof totalPages === 'number') {
    doc.fillColor(COR.muted).font('Helvetica').fontSize(7.5)
       .text(`Página ${pageNum} de ${totalPages}`, W - M - 80, y + 6, { width: 80, align: 'right', lineBreak: false })
    doc.y = 40
  }
  doc.page.margins.bottom = prevBottom
}

// PLACEHOLDER
export function renderPlaceholder(doc, msg = 'Sem dados.') {
  const x = M, y = doc.y
  const W = W_PAGE - M * 2
  card(doc, x, y, W, 60)
  doc.fillColor(COR.muted).font('Helvetica-Oblique').fontSize(9)
     .text(msg, x, y + 24, { width: W, align: 'center', lineBreak: false })
  doc.y = y + 60 + GAP
}

// COMPAT (módulos legados)
export function renderSecao(doc, titulo) {
  doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(10)
     .text(titulo, M, doc.y, { lineBreak: false })
  doc.moveDown(0.3)
}
export function renderSumario(doc, bullets) {
  if (!bullets?.length) return
  renderCardsTexto(doc, { analise: bullets })
}
export function renderChartImage(doc, buf, opts) {
  if (!buf) return
  const w = opts?.width || 460
  doc.image(buf, (doc.page.width - w) / 2, doc.y, { width: w })
  doc.y += w * 0.6 + 8
}
export function renderPizzaNativa(doc, pizza) {
  renderGraficosDuplo(doc, { pizza, titulos: { pizza: pizza?.titulo } })
}
export function renderBarrasNativa(doc, barras) {
  renderGraficosDuplo(doc, { linha: barras, titulos: { linha: barras?.titulo } })
}

// ÍCONES
function drawIcon(doc, key, x, y, s = 12, color = '#000') {
  doc.save().lineWidth(1.1).strokeColor(color).fillColor(color)
  switch (key) {
    case 'doc':
      doc.roundedRect(x + s * 0.18, y + s * 0.08, s * 0.6, s * 0.78, 1).stroke()
      for (let i = 0; i < 3; i++) {
        doc.moveTo(x + s * 0.28, y + s * (0.3 + i * 0.18))
           .lineTo(x + s * 0.66, y + s * (0.3 + i * 0.18)).stroke()
      }
      break
    case 'check':
      doc.lineWidth(1.6)
         .moveTo(x + s * 0.20, y + s * 0.55)
         .lineTo(x + s * 0.45, y + s * 0.78)
         .lineTo(x + s * 0.82, y + s * 0.28).stroke()
      break
    case 'clock':
      doc.circle(x + s / 2, y + s / 2, s * 0.36).stroke()
      doc.moveTo(x + s / 2, y + s / 2).lineTo(x + s / 2, y + s * 0.25).stroke()
      doc.moveTo(x + s / 2, y + s / 2).lineTo(x + s * 0.7, y + s / 2).stroke()
      break
    case 'x':
      doc.lineWidth(1.6)
         .moveTo(x + s * 0.25, y + s * 0.25).lineTo(x + s * 0.75, y + s * 0.75).stroke()
      doc.moveTo(x + s * 0.75, y + s * 0.25).lineTo(x + s * 0.25, y + s * 0.75).stroke()
      break
    case 'chart':
      doc.rect(x + s * 0.20, y + s * 0.55, s * 0.12, s * 0.30).fill()
      doc.rect(x + s * 0.42, y + s * 0.40, s * 0.12, s * 0.45).fill()
      doc.rect(x + s * 0.64, y + s * 0.20, s * 0.12, s * 0.65).fill()
      break
    case 'chat':
      doc.roundedRect(x + s * 0.15, y + s * 0.20, s * 0.70, s * 0.55, 2).stroke()
      doc.moveTo(x + s * 0.35, y + s * 0.75)
         .lineTo(x + s * 0.30, y + s * 0.92)
         .lineTo(x + s * 0.55, y + s * 0.75).stroke()
      break
    case 'cal':
      doc.roundedRect(x + s * 0.10, y + s * 0.20, s * 0.80, s * 0.65, 1).stroke()
      doc.moveTo(x + s * 0.10, y + s * 0.38).lineTo(x + s * 0.90, y + s * 0.38).stroke()
      doc.moveTo(x + s * 0.30, y + s * 0.12).lineTo(x + s * 0.30, y + s * 0.28).stroke()
      doc.moveTo(x + s * 0.70, y + s * 0.12).lineTo(x + s * 0.70, y + s * 0.28).stroke()
      break
    case 'print':
      doc.rect(x + s * 0.20, y + s * 0.32, s * 0.60, s * 0.32).stroke()
      doc.rect(x + s * 0.28, y + s * 0.55, s * 0.44, s * 0.30).stroke()
      doc.rect(x + s * 0.28, y + s * 0.15, s * 0.44, s * 0.20).stroke()
      break
    case 'user':
      doc.circle(x + s / 2, y + s * 0.35, s * 0.18).stroke()
      doc.moveTo(x + s * 0.20, y + s * 0.85)
         .lineTo(x + s * 0.30, y + s * 0.62)
         .lineTo(x + s * 0.70, y + s * 0.62)
         .lineTo(x + s * 0.80, y + s * 0.85).stroke()
      break
    default:
      doc.circle(x + s / 2, y + s / 2, s * 0.18).fill()
  }
  doc.restore()
}
