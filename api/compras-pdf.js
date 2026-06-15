/**
 * POST /api/compras-pdf
 *
 * Gera um PDF com a lista de materiais de uma solicitação de compra
 * e envia via WhatsApp para o telefone informado.
 *
 * Body: {
 *   solicitacaoId : string
 *   telefone      : string   -- destinatário (só dígitos)
 *   linkAprovacao : string   -- URL pública de aprovação
 * }
 */

import { createClient } from '@supabase/supabase-js'
import PDFDocument from 'pdfkit'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  )
}

function zapiBase() {
  return `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`
}
function zapiHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
  }
}

function fmtBRL(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

// ─── Gera PDF como Buffer ────────────────────────────────────────────────────
function gerarPDFBuffer(sol, itens, linkAprovacao) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const doc = new PDFDocument({ margin: 45, size: 'A4' })
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const blue  = '#1e40af'
    const gray  = '#64748b'
    const light = '#f8fafc'
    const green = '#15803d'
    const W     = 505  // largura útil

    // ── Cabeçalho ─────────────────────────────────────────────────────────
    doc.rect(0, 0, 595, 80).fill(blue)
    doc.fillColor('#fff').fontSize(18).font('Helvetica-Bold')
      .text('Lista de Materiais', 45, 22)
    doc.fontSize(10).font('Helvetica')
      .text('Solicitação de Compra — Aguardando Aprovação', 45, 46)
    if (sol.numero_requisicao) {
      doc.text(`REQ #${sol.numero_requisicao}`, 45, 62)
    }

    // ── Número gerado em ──
    doc.fillColor(gray).fontSize(9)
      .text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, 300, 62, { align: 'right', width: 250 })

    doc.moveDown(3.5)

    // ── Dados da solicitação ──────────────────────────────────────────────
    const yInfo = doc.y
    doc.rect(45, yInfo, W, 68).fill(light).stroke('#e2e8f0')
    doc.fillColor('#1e293b').fontSize(13).font('Helvetica-Bold')
      .text(sol.titulo, 55, yInfo + 8, { width: W - 20 })

    doc.fontSize(9).font('Helvetica').fillColor(gray)
    let colY = yInfo + 28
    const cols = [
      ['Urgência', { baixa: 'Baixa', media: 'Média', alta: '🔴 ALTA' }[sol.urgencia] || sol.urgencia],
      ['Prazo necessário', sol.data_necessidade ? fmtDate(sol.data_necessidade) : '—'],
      ['Solicitante', sol.requisitante_nome || '—'],
      ['Fornecedor sugerido', sol.fornecedor || '—'],
    ]
    cols.forEach(([label, value], i) => {
      const x = 55 + (i % 2) * 250
      const y = colY + Math.floor(i / 2) * 16
      doc.fillColor(gray).text(`${label}:`, x, y)
      doc.fillColor('#1e293b').text(value, x + 90, y)
    })

    doc.moveDown(0.5)

    // ── Tabela de itens ───────────────────────────────────────────────────
    const tableTop = doc.y + 16
    // header row
    doc.rect(45, tableTop, W, 20).fill(blue)
    doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold')
    doc.text('Descrição',       55,  tableTop + 6, { width: 240 })
    doc.text('Qtd',             297, tableTop + 6, { width: 50, align: 'right' })
    doc.text('Un.',             352, tableTop + 6, { width: 35 })
    doc.text('Vlr Unit.',       390, tableTop + 6, { width: 72, align: 'right' })
    doc.text('Total',           462, tableTop + 6, { width: 80, align: 'right' })

    let rowY = tableTop + 20
    let totalGeral = 0
    itens.forEach((it, idx) => {
      const rowH = 18
      if (idx % 2 === 0) {
        doc.rect(45, rowY, W, rowH).fill(light)
      }
      doc.fillColor('#1e293b').font('Helvetica').fontSize(9)
      doc.text(it.descricao,    55,  rowY + 5, { width: 238, ellipsis: true })
      doc.text(String(it.quantidade || 1), 297, rowY + 5, { width: 50, align: 'right' })
      doc.text(it.unidade || 'un', 352, rowY + 5, { width: 35 })
      if (it.valor_unitario) {
        doc.text(fmtBRL(it.valor_unitario), 390, rowY + 5, { width: 72, align: 'right' })
      } else {
        doc.fillColor(gray).text('—', 390, rowY + 5, { width: 72, align: 'right' })
      }
      const tot = it.valor_total || (it.valor_unitario ? it.valor_unitario * (it.quantidade || 1) : null)
      if (tot) {
        totalGeral += Number(tot)
        doc.fillColor('#1e293b').text(fmtBRL(tot), 462, rowY + 5, { width: 80, align: 'right' })
      } else {
        doc.fillColor(gray).text('—', 462, rowY + 5, { width: 80, align: 'right' })
      }
      rowY += rowH
    })

    // linha separadora
    doc.rect(45, rowY, W, 1).fill('#cbd5e1')
    rowY += 6

    // total geral
    if (totalGeral > 0) {
      doc.rect(300, rowY, 250, 22).fill(`${blue}15`)
      doc.fillColor(blue).font('Helvetica-Bold').fontSize(11)
        .text('TOTAL ESTIMADO:', 305, rowY + 5, { width: 140 })
        .text(fmtBRL(totalGeral), 440, rowY + 5, { width: 100, align: 'right' })
      rowY += 28
    }

    // ── Link de aprovação ─────────────────────────────────────────────────
    rowY += 14
    doc.rect(45, rowY, W, 48).fill(`${green}10`).stroke(`${green}40`)
    doc.fillColor(green).font('Helvetica-Bold').fontSize(10)
      .text('Link de Aprovação:', 55, rowY + 8)
    doc.fillColor(blue).font('Helvetica').fontSize(9)
      .text(linkAprovacao, 55, rowY + 22, { width: W - 20, link: linkAprovacao, underline: true })

    // ── Rodapé ────────────────────────────────────────────────────────────
    doc.rect(0, 800, 595, 42).fill('#f1f5f9')
    doc.fillColor(gray).fontSize(8).font('Helvetica')
      .text('SmartPro — Gestão Financeira e Operacional', 45, 812, { align: 'center', width: W })
    doc.text('Acesse o link acima para aprovar, recusar ou abrir leilão de preços.', 45, 824, { align: 'center', width: W })

    doc.end()
  })
}

// ─── Upload para Supabase Storage ────────────────────────────────────────────
async function uploadPDF(db, buffer, solId) {
  const key = `compras/${solId}_${Date.now()}.pdf`
  const { data, error } = await db.storage.from('comprovantes')
    .upload(key, buffer, { contentType: 'application/pdf', upsert: false })
  if (error) throw new Error(`Upload PDF falhou: ${error.message}`)
  const { data: urlData } = db.storage.from('comprovantes').getPublicUrl(data.path)
  return urlData?.publicUrl
}

// ─── Enviar via Z-API ─────────────────────────────────────────────────────────
async function sendPDFviaWA(phone, pdfUrl, caption, fileName) {
  const res = await fetch(`${zapiBase()}/send-document/pdf`, {
    method: 'POST',
    headers: zapiHeaders(),
    body: JSON.stringify({ phone, document: pdfUrl, fileName, caption }),
  })
  return res.ok
}

// ─── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { solicitacaoId, telefone, linkAprovacao } = req.body || {}
  if (!solicitacaoId || !telefone) {
    return res.status(400).json({ error: 'solicitacaoId e telefone são obrigatórios' })
  }

  const db = getDb()

  // Busca solicitação e itens em paralelo
  const [{ data: sol, error: solErr }, { data: itens }] = await Promise.all([
    db.from('solicitacoes_compra').select('*').eq('id', solicitacaoId).single(),
    db.from('itens_solicitacao_compra').select('*').eq('solicitacao_id', solicitacaoId).order('ordem'),
  ])

  if (solErr || !sol) return res.status(404).json({ error: 'Solicitação não encontrada' })
  if (!itens || itens.length === 0) {
    return res.status(200).json({ ok: false, reason: 'Sem itens — sem PDF' })
  }

  try {
    const link = linkAprovacao || `https://smartpro.app.br/aprovar/${sol.token_aprovador}`
    const caption = `📋 *Lista de Materiais — ${sol.titulo}*\n\n${itens.length} item(s) para aprovar.\n\n👉 Link de aprovação:\n${link}`
    const fileName = `lista-compras-${(sol.titulo || 'req').replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 30)}`

    const buffer = await gerarPDFBuffer(sol, itens, link)
    const pdfUrl = await uploadPDF(db, buffer, solicitacaoId)
    const phone  = telefone.replace(/\D/g, '')
    const sent   = await sendPDFviaWA(phone, pdfUrl, caption, fileName)

    return res.status(200).json({ ok: sent, pdfUrl })
  } catch (e) {
    console.error('[compras-pdf] erro:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
