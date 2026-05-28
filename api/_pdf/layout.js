/**
 * api/_pdf/layout.js
 * Primitivas de layout reutilizáveis para PDFs SmartPro.
 */

export const COR = {
  primary:   '#6366f1',
  primaryDk: '#4f46e5',
  ink:       '#0f172a',
  text:      '#1e293b',
  muted:     '#64748b',
  success:   '#10b981',
  danger:    '#ef4444',
  warning:   '#f59e0b',
  info:      '#06b6d4',
  bgSoft:    '#f8fafc',
  border:    '#e2e8f0',
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
 * Cabeçalho principal (banner colorido + título + subtítulo).
 * Retorna doc.y após o cabeçalho.
 */
export function renderHeader(doc, { titulo, subtitulo, empresa }) {
  const W = doc.page.width
  // Banner em gradiente simulado (2 retângulos)
  doc.rect(0, 0, W, 72).fill(COR.primaryDk)
  doc.rect(0, 60, W, 12).fill(COR.primary)

  doc.fillColor('white').font('Helvetica-Bold').fontSize(20).text('SmartPro', 40, 18)
  doc.fontSize(11).font('Helvetica').text(titulo || '', 40, 42)
  if (subtitulo) {
    doc.fontSize(9).fillColor('rgba(255,255,255,0.85)').text(subtitulo, 40, 56)
  }

  // bloco empresa (canto direito)
  if (empresa) {
    doc.fontSize(9).fillColor('white').text(empresa, W - 220, 22, { width: 180, align: 'right' })
    doc.fontSize(8).fillColor('rgba(255,255,255,0.75)').text(
      'Relatório emitido em ' + new Date().toLocaleString('pt-BR'),
      W - 220, 38, { width: 180, align: 'right' }
    )
  }

  doc.fillColor(COR.text).font('Helvetica')
  doc.y = 90
  return doc.y
}

/**
 * KPI cards em grid (até 4 por linha).
 * kpis: [{ label, value, sub?, color? }]
 * Retorna doc.y após os cards.
 */
export function renderKPIs(doc, kpis = []) {
  if (!kpis.length) return doc.y
  const margem = 40
  const gap = 10
  const cols = Math.min(4, kpis.length)
  const W = doc.page.width - margem * 2
  const cardW = (W - gap * (cols - 1)) / cols
  const cardH = 64
  const y0 = doc.y + 4

  kpis.forEach((k, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = margem + col * (cardW + gap)
    const y = y0 + row * (cardH + gap)
    const color = k.color || COR.primary

    // card
    doc.roundedRect(x, y, cardW, cardH, 8).fill('white').strokeColor(COR.border).lineWidth(1).stroke()
    // faixa lateral colorida
    doc.rect(x, y, 4, cardH).fill(color)

    // label
    doc.fillColor(COR.muted).font('Helvetica').fontSize(8).text(
      String(k.label || '').toUpperCase(), x + 12, y + 10, { width: cardW - 20 }
    )
    // value
    doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(14).text(
      String(k.value ?? '—'), x + 12, y + 24, { width: cardW - 20, ellipsis: true }
    )
    // sub
    if (k.sub) {
      doc.fillColor(COR.muted).font('Helvetica').fontSize(8).text(
        String(k.sub), x + 12, y + 46, { width: cardW - 20, ellipsis: true }
      )
    }
  })

  const linhas = Math.ceil(kpis.length / cols)
  doc.y = y0 + linhas * (cardH + gap)
  return doc.y
}

/**
 * Título de seção.
 */
export function renderSecao(doc, texto) {
  doc.moveDown(0.6)
  doc.fillColor(COR.ink).font('Helvetica-Bold').fontSize(12).text(texto, 40)
  doc.moveDown(0.2)
  return doc.y
}

/**
 * Insere uma imagem PNG (Buffer) com legenda opcional, centralizando largura.
 * Se buf for null/undefined, mostra placeholder de erro.
 */
export function renderChartImage(doc, buf, { width = 480, caption } = {}) {
  const x = (doc.page.width - width) / 2
  if (buf) {
    doc.image(buf, x, doc.y, { width })
    doc.y += width * 0.62 + 6 // proporção típica do nosso config
  } else {
    doc.roundedRect(x, doc.y, width, 80, 6).fill(COR.bgSoft).strokeColor(COR.border).stroke()
    doc.fillColor(COR.muted).font('Helvetica').fontSize(9).text(
      'Gráfico indisponível no momento.', x, doc.y - 50, { width, align: 'center' }
    )
    doc.y += 90
  }
  if (caption) {
    doc.fillColor(COR.muted).font('Helvetica').fontSize(8).text(caption, 40, doc.y, {
      width: doc.page.width - 80, align: 'center'
    })
    doc.moveDown(0.4)
  }
}

/**
 * Tabela simples (opcional, p/ módulos que ainda querem listagem).
 * colunas: [{ key, label, width, align?, format? }]
 */
export function renderTabela(doc, { colunas, linhas }) {
  const margem = 40
  const rowH = 16
  const startX = margem
  const totalW = doc.page.width - margem * 2

  // header
  doc.rect(startX, doc.y, totalW, rowH).fill('#e0e7ff')
  doc.fillColor('#1e1b4b').font('Helvetica-Bold').fontSize(8.5)
  let x = startX
  const headerY = doc.y + 4
  for (const c of colunas) {
    doc.text(c.label, x + 4, headerY, { width: c.width - 8, align: c.align || 'left' })
    x += c.width
  }
  doc.moveDown(1.2)

  doc.font('Helvetica').fontSize(8).fillColor(COR.text)
  linhas.forEach((linha, i) => {
    if (doc.y > doc.page.height - 60) {
      doc.addPage()
      renderFooter(doc)
      doc.fontSize(8).fillColor(COR.text)
    }
    const y = doc.y
    if (i % 2 === 0) doc.rect(startX, y - 2, totalW, rowH).fill(COR.bgSoft).fillColor(COR.text)
    let cx = startX
    for (const c of colunas) {
      const v = c.format ? c.format(linha[c.key], linha) : (linha[c.key] ?? '—')
      doc.fillColor(linha._color?.[c.key] || COR.text).text(
        String(v),
        cx + 4, y,
        { width: c.width - 8, align: c.align || 'left', ellipsis: true }
      )
      cx += c.width
    }
    doc.moveDown(0.85)
  })
}

/**
 * Rodapé fixo na base da página atual.
 */
export function renderFooter(doc) {
  const y = doc.page.height - 28
  doc.fontSize(7).fillColor(COR.muted).text(
    `SmartPro — ${new Date().toLocaleString('pt-BR')}`,
    40, y, { width: doc.page.width - 80, align: 'center' }
  )
}
