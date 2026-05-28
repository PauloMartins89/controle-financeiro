/**
 * api/_pdf/index.js
 * Consolidador: recebe estrutura normalizada por módulo e produz PDF buffer.
 *
 * Shape esperado (dadosNormalizados):
 * {
 *   titulo: 'Relatório Financeiro',
 *   subtitulo: '01/05/2026 a 28/05/2026',
 *   empresa: 'Nome do Workspace',
 *   kpis: [{ label, value, sub?, color? }, ...],          // 0..8
 *   pizza: { titulo, labels, data, colors? } | null,
 *   barras: { titulo, labels, data, color?, label? } | null,
 *   tabela: { colunas, linhas } | null,                    // opcional
 *   observacoes?: string                                    // texto livre rodapé
 * }
 */

import PDFDocument from 'pdfkit'
import { renderHeader, renderKPIs, renderSecao, renderChartImage, renderTabela, renderFooter, COR } from './layout.js'
import { renderChartPNG, pizzaConfig, barrasConfig } from './charts.js'

export async function gerarDashboardPDF(dados) {
  // 1) gera as imagens dos gráficos em paralelo (antes de iniciar o doc)
  const [pizzaBuf, barrasBuf] = await Promise.all([
    dados.pizza?.labels?.length
      ? renderChartPNG(pizzaConfig(dados.pizza),  { width: 600, height: 360 })
      : Promise.resolve(null),
    dados.barras?.labels?.length
      ? renderChartPNG(barrasConfig(dados.barras), { width: 600, height: 320 })
      : Promise.resolve(null),
  ])

  // 2) monta o PDF
  return new Promise((resolve, reject) => {
    const chunks = []
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true })
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Cabeçalho
    renderHeader(doc, {
      titulo:    dados.titulo,
      subtitulo: dados.subtitulo,
      empresa:   dados.empresa,
    })

    // KPIs
    if (dados.kpis?.length) {
      renderKPIs(doc, dados.kpis)
    }

    // Gráficos
    if (dados.pizza) {
      renderSecao(doc, dados.pizza.titulo || 'Distribuição')
      renderChartImage(doc, pizzaBuf, { width: 460 })
    }
    if (dados.barras) {
      renderSecao(doc, dados.barras.titulo || 'Evolução')
      renderChartImage(doc, barrasBuf, { width: 480 })
    }

    // Tabela opcional
    if (dados.tabela?.linhas?.length) {
      if (doc.y > doc.page.height - 160) doc.addPage()
      renderSecao(doc, dados.tabela.titulo || 'Detalhamento')
      renderTabela(doc, dados.tabela)
    } else if (dados.tabela && !dados.tabela.linhas?.length) {
      renderSecao(doc, dados.tabela.titulo || 'Detalhamento')
      doc.fontSize(9).fillColor(COR.muted).text(
        'Nenhum registro encontrado para o período informado.', 40, doc.y, { width: doc.page.width - 80 }
      )
    }

    // Observações
    if (dados.observacoes) {
      doc.moveDown(0.6)
      doc.fontSize(8).fillColor(COR.muted).text(dados.observacoes, 40, doc.y, { width: doc.page.width - 80 })
    }

    // Rodapé em TODAS as páginas
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      renderFooter(doc)
    }

    doc.end()
  })
}
