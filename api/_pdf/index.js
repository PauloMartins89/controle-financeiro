/**
 * api/_pdf/index.js
 * Orquestra o novo padrão CORPORATIVO de relatório.
 *
 * Shape esperado (com fallbacks para o shape antigo):
 * {
 *   titulo,                  // ex: 'Relatório do Módulo' OU 'RELATÓRIO FINANCEIRO'
 *   modulo,                  // ex: 'NOME DO MÓDULO' (opcional)
 *   subtitulo,               // descrição curta sob o título
 *   empresa,                 // string OU { nome, tagline }
 *   meta: { periodo, geradoEm, geradoPor },
 *   visaoGeral,              // string descritiva (Seção 1)
 *   kpis: [{ label, value, sub?, delta?, deltaLabel?, icon?, tone? }, ...],  // 4..6
 *   linha:  { titulo?, labels, data, label? } | null,
 *   pizza:  { titulo?, labels, data, colors? } | null,
 *   barras: { titulo?, labels, data } | null,   // fallback → vira `linha`
 *   tabela: { titulo?, colunas, linhas, totais? } | null,
 *   analise: string[],       // bullets (Seção 6)
 *   observacoes: string[] | string,  // bullets (Seção 7)
 *   sumario: string[],       // fallback antigo → vira `analise`
 * }
 */

import PDFDocument from 'pdfkit'
import {
  renderHeader, renderVisaoGeral, renderKPIs, renderGraficosDuplo,
  renderTabela, renderCardsTexto, renderFooter, renderPlaceholder,
} from './layout.js'

export async function gerarDashboardPDF(dados) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const doc = new PDFDocument({ margin: 24, size: 'A4', bufferPages: true })
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ---------- normalização (compat com shape antigo) ----------
    const empresa = (typeof dados.empresa === 'object' && dados.empresa)
      ? dados.empresa
      : { nome: dados.empresa || 'SmartPro', tagline: 'Sistema de Gestão' }

    const meta = dados.meta || {
      periodo: dados.subtitulo,
      geradoEm: new Date().toLocaleString('pt-BR'),
      geradoPor: typeof dados.empresa === 'string' ? dados.empresa : (empresa.nome),
    }

    const linha = dados.linha
      || (dados.barras?.labels?.length ? {
            titulo: dados.barras.titulo,
            labels: dados.barras.labels,
            data:   dados.barras.data,
            label:  dados.barras.label,
          } : null)

    const analise = dados.analise?.length
      ? dados.analise
      : (dados.sumario?.length ? dados.sumario : null)

    let observacoes = dados.observacoes
    if (typeof observacoes === 'string') observacoes = [observacoes]

    // ---------- HEADER ----------
    renderHeader(doc, {
      titulo:    dados.titulo,
      modulo:    dados.modulo,
      subtitulo: dados.subtitulo,
      empresa,
      meta,
    })

    // ---------- 1. VISÃO GERAL ----------
    if (dados.visaoGeral) {
      renderVisaoGeral(doc, { texto: dados.visaoGeral })
    }

    // ---------- 2. INDICADORES ----------
    if (dados.kpis?.length) renderKPIs(doc, dados.kpis)

    // ---------- 3 + 4. GRÁFICOS ----------
    if (linha || dados.pizza) {
      renderGraficosDuplo(doc, {
        linha, pizza: dados.pizza,
        titulos: { linha: linha?.titulo, pizza: dados.pizza?.titulo },
      })
    }

    // ---------- 5. TABELA ----------
    if (dados.tabela?.linhas?.length) {
      renderTabela(doc, dados.tabela)
    } else if (dados.tabela) {
      renderPlaceholder(doc, 'Nenhum registro encontrado no período.')
    }

    // ---------- 6 + 7. ANÁLISE / OBSERVAÇÕES ----------
    if (analise || observacoes) {
      renderCardsTexto(doc, { analise, observacoes })
    }

    // ---------- FOOTER ----------
    const range = doc.bufferedPageRange()
    const tituloFooter = `${dados.titulo || 'Relatório'}${dados.modulo ? ' - ' + dados.modulo : ''}`
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      renderFooter(doc, i - range.start + 1, range.count, { titulo: tituloFooter })
    }
    doc.end()
  })
}
