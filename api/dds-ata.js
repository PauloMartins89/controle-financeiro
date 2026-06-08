/**
 * api/dds-ata.js
 * Gera a ATA DDS em PDF — documento oficial com assinaturas dos colaboradores.
 *
 * GET /api/dds-ata?registroId=<uuid>&workspaceId=<uuid>
 */

import { createClient } from '@supabase/supabase-js'
import PDFDocument from 'pdfkit'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
let LOGO_BUF = null
try { LOGO_BUF = readFileSync(join(__dirname, '_pdf/assets/logo_smartpro.png')) } catch {}
if (!LOGO_BUF) { try { LOGO_BUF = readFileSync(join(__dirname, '_pdf/assets/logo.png')) } catch {} }

const NAVY   = '#1e3a5f'
const ACCENT = '#2563eb'
const INK    = '#0f172a'
const MUTED  = '#6b7280'
const BORDER = '#e5e7eb'
const BGSFT  = '#f9fafb'
const M = 28
const W_PAGE = 595

function fmt(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  )
}

/** Converte SVG string para PNG Buffer via sharp */
async function svgToPng(svgStr, width = 240, height = 80) {
  try {
    return await sharp(Buffer.from(svgStr))
      .resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer()
  } catch {
    return null
  }
}

async function gerarAtaPDF(registro, tema, assinaturas, empresa) {
  return new Promise(async (resolve, reject) => {
    const chunks = []
    const doc = new PDFDocument({ margin: M, size: 'A4', bufferPages: true })
    doc.on('data', c => chunks.push(c))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = W_PAGE - M * 2
    const catColor = {
      'Segurança': '#ef4444', 'Saúde': '#3b82f6', 'Meio Ambiente': '#22c55e',
      'Qualidade': '#f59e0b', 'Outros': '#8b5cf6',
    }[tema?.categoria] || ACCENT

    // ─── CABEÇALHO ───────────────────────────────────────────────
    const HH = 90
    // Bloco navy com logo
    doc.roundedRect(M, M, 170, HH, 6).fillColor(NAVY).fill()
    if (LOGO_BUF) {
      try { doc.image(LOGO_BUF, M + 8, M + 8, { fit: [154, HH - 16], align: 'center', valign: 'center' }) } catch {}
    } else {
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(14)
         .text(String(empresa || 'SmartPro'), M + 10, M + 32, { width: 150, align: 'center' })
    }

    // Bloco info à direita
    const cx = M + 170 + 8
    const cw = W - 178
    doc.roundedRect(cx, M, cw, HH, 6).fillColor(BGSFT).fill()
    doc.roundedRect(cx, M, cw, HH, 6).lineWidth(0.5).strokeColor(BORDER).stroke()

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(15)
       .text('ATA DE DDS', cx + 14, M + 12, { width: cw - 20 })
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9)
       .text('DIÁLOGO DIÁRIO DE SEGURANÇA', cx + 14, M + 30, { width: cw - 20 })

    const TURNO = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
    const linhas = [
      `Data: ${fmt(registro.data)}   ·   Turno: ${TURNO[registro.turno] || registro.turno || '—'}`,
      `Líder: ${registro.lider_nome || '—'}   ·   Equipe: ${registro.equipe_nome || '—'}`,
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    ]
    let ly = M + 48
    for (const l of linhas) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(l, cx + 14, ly, { width: cw - 20 })
      ly += 13
    }

    doc.y = M + HH + 12

    // ─── BLOCO TEMA ──────────────────────────────────────────────
    if (tema) {
      const TY = doc.y
      doc.roundedRect(M, TY, W, 0, 6) // placeholder height
      doc.roundedRect(M, TY, W, 4, 0).fillColor(catColor).fill()
      doc.roundedRect(M, TY, W, 36, 6).fillColor(BGSFT).fill()
      doc.roundedRect(M, TY, W, 36, 6).lineWidth(0.5).strokeColor(BORDER).stroke()

      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
         .text(tema.titulo || '—', M + 14, TY + 8, { width: W - 28, lineBreak: false, ellipsis: true })
      const cc = catColor
      doc.fillColor(cc).font('Helvetica-Bold').fontSize(8.5)
         .text((tema.categoria || '').toUpperCase(), M + 14, TY + 22, { width: 120, lineBreak: false })

      doc.y = TY + 44

      if (tema.conteudo) {
        const CY = doc.y
        doc.roundedRect(M, CY, W, 1, 0) // measure
        doc.fillColor(INK).font('Helvetica').fontSize(9)
           .text(tema.conteudo, M + 14, CY + 8, { width: W - 28, align: 'justify' })
        const textH = doc.y - CY + 8
        // draw border behind text
        doc.save()
        doc.roundedRect(M, CY, W, textH + 8, 6)
           .lineWidth(0.5).strokeColor(BORDER).stroke()
        doc.restore()
        doc.y = CY + textH + 10
      }
    }

    doc.y += 6

    // ─── TABELA DE ASSINATURAS ───────────────────────────────────
    // Título da seção
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10)
       .text('LISTA DE PRESENÇA E ASSINATURAS', M, doc.y, { width: W })
    doc.y += 10

    // Cabeçalho da tabela
    const COL_N   = 28
    const COL_NOM = 200
    const COL_SIG = W - COL_N - COL_NOM - 6
    const TH = 22

    doc.roundedRect(M, doc.y, W, TH, 4).fillColor(NAVY).fill()
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8.5)
    const hy = doc.y + 7
    doc.text('Nº', M + 8,       hy, { width: COL_N - 4,   lineBreak: false })
    doc.text('Nome',  M + COL_N + 4, hy, { width: COL_NOM - 8, lineBreak: false })
    doc.text('Assinatura', M + COL_N + COL_NOM + 4, hy, { width: COL_SIG - 8, lineBreak: false })
    doc.y += TH

    // Linhas de assinatura
    const ROW_H = 50
    for (let i = 0; i < assinaturas.length; i++) {
      const a = assinaturas[i]

      // checar quebra de página
      if (doc.y + ROW_H > 820) {
        doc.addPage()
        doc.y = M
      }

      const ry = doc.y
      const bgFill = i % 2 === 0 ? '#ffffff' : BGSFT
      doc.rect(M, ry, W, ROW_H).fillColor(bgFill).fill()
      doc.rect(M, ry, W, ROW_H).lineWidth(0.4).strokeColor(BORDER).stroke()

      const ty = ry + ROW_H / 2 - 4
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9)
         .text(String(i + 1), M + 8, ty, { width: COL_N - 4, lineBreak: false })
      doc.fillColor(INK).font('Helvetica').fontSize(9)
         .text(a.colaborador_nome || '—', M + COL_N + 4, ty, { width: COL_NOM - 8, lineBreak: false, ellipsis: true })

      // Assinatura SVG → PNG
      if (a.assinatura_svg) {
        try {
          const pngBuf = await svgToPng(a.assinatura_svg, 200, ROW_H - 10)
          if (pngBuf) {
            const sigX = M + COL_N + COL_NOM + 4
            doc.image(pngBuf, sigX, ry + 5, { width: Math.min(COL_SIG - 8, 200), height: ROW_H - 10 })
          }
        } catch {}
      }

      doc.y = ry + ROW_H
    }

    // Linha de fechamento
    const FY = doc.y + 8
    doc.rect(M, FY, W, 28).fillColor(BGSFT).fill()
    doc.rect(M, FY, W, 28).lineWidth(0.5).strokeColor(BORDER).stroke()
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5)
       .text(`Total de assinantes: ${assinaturas.length} colaborador(es)   ·   Status: ${registro.status === 'concluido' ? 'Concluído' : 'Em andamento'}${registro.concluido_em ? '   ·   Concluído em: ' + fmt(registro.concluido_em) : ''}`,
             M + 10, FY + 9, { width: W - 20 })

    doc.y = FY + 36

    // ─── RODAPÉ ──────────────────────────────────────────────────
    const range = doc.bufferedPageRange()
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p)
      doc.fillColor(MUTED).font('Helvetica').fontSize(7.5)
         .text(`SmartLíder — ATA DDS · Gerado em ${new Date().toLocaleString('pt-BR')} · Página ${p - range.start + 1}/${range.count}`,
               M, 820, { width: W, align: 'center' })
    }

    doc.end()
  })
}

export default async function handler(req, res) {
  const { registroId, workspaceId } = req.query
  if (!registroId || !workspaceId) {
    return res.status(400).json({ error: 'registroId e workspaceId obrigatórios' })
  }

  const db = getDb()

  const [{ data: reg }, { data: assin }] = await Promise.all([
    db.from('dds_registros')
      .select('*, dds_temas(*)')
      .eq('id', registroId)
      .eq('workspace_id', workspaceId)
      .single(),
    db.from('dds_assinaturas')
      .select('*')
      .eq('registro_id', registroId)
      .order('assinado_em'),
  ])

  if (!reg) return res.status(404).json({ error: 'Registro não encontrado' })

  const { data: ws } = await db.from('workspaces').select('nome').eq('id', workspaceId).single()

  try {
    const pdf = await gerarAtaPDF(reg, reg.dds_temas, assin || [], ws?.nome || 'SmartPro')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="ata-dds-${registroId.slice(0,8)}.pdf"`)
    res.send(pdf)
  } catch (err) {
    console.error('[dds-ata]', err)
    res.status(500).json({ error: err.message })
  }
}
