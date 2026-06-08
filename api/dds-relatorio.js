/**
 * api/dds-relatorio.js
 * Relatório de Presença DDS — lista consolidada por período.
 *
 * GET /api/dds-relatorio?workspaceId=<uuid>&inicio=YYYY-MM-DD&fim=YYYY-MM-DD&status=todos|concluido|em_andamento
 */

import { createClient } from '@supabase/supabase-js'
import PDFDocument from 'pdfkit'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
let LOGO_BUF = null
try { LOGO_BUF = readFileSync(join(__dirname, '_pdf/assets/logo_smartpro.png')) } catch {}
if (!LOGO_BUF) { try { LOGO_BUF = readFileSync(join(__dirname, '_pdf/assets/logo.png')) } catch {} }

const NAVY   = '#1e3a5f'
const ACCENT = '#2563eb'
const INK    = '#0f172a'
const MUTED  = '#6b7280'
const SUCCESS = '#10b981'
const WARN   = '#f59e0b'
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

async function gerarRelPDF(registros, filtros, empresa) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const doc = new PDFDocument({ margin: M, size: 'A4', bufferPages: true })
    doc.on('data', c => chunks.push(c))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = W_PAGE - M * 2
    const TURNO = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

    // KPIs calculados
    const totalSessoes = registros.length
    const concluidos   = registros.filter(r => r.status === 'concluido').length
    const totalAssin   = registros.reduce((a, r) => a + (r.total_assinantes || 0), 0)
    const temasUnicos  = new Set(registros.map(r => r.dds_temas?.id).filter(Boolean)).size

    // Período label
    const periodoLabel = filtros.inicio && filtros.fim
      ? `${fmt(filtros.inicio)} a ${fmt(filtros.fim)}`
      : filtros.inicio ? `A partir de ${fmt(filtros.inicio)}`
      : filtros.fim    ? `Até ${fmt(filtros.fim)}`
      : 'Todos os registros'

    // ─── CABEÇALHO ───────────────────────────────────────────────
    const HH = 90
    doc.roundedRect(M, M, 170, HH, 6).fillColor(NAVY).fill()
    if (LOGO_BUF) {
      try { doc.image(LOGO_BUF, M + 8, M + 8, { fit: [154, HH - 16], align: 'center', valign: 'center' }) } catch {}
    } else {
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(14)
         .text(String(empresa || 'SmartPro'), M + 10, M + 32, { width: 150, align: 'center' })
    }

    const cx = M + 178
    const cw = W - 178
    doc.roundedRect(cx, M, cw, HH, 6).fillColor(BGSFT).fill()
    doc.roundedRect(cx, M, cw, HH, 6).lineWidth(0.5).strokeColor(BORDER).stroke()

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(15)
       .text('RELATÓRIO DE PRESENÇA', cx + 14, M + 12, { width: cw - 20 })
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9)
       .text('DDS — DIÁLOGO DIÁRIO DE SEGURANÇA', cx + 14, M + 30, { width: cw - 20 })

    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5)
       .text(`Período: ${periodoLabel}`, cx + 14, M + 48, { width: cw - 20 })
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5)
       .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}   ·   ${empresa || 'SmartPro'}`, cx + 14, M + 61, { width: cw - 20 })

    doc.y = M + HH + 14

    // ─── KPIs ────────────────────────────────────────────────────
    const KW = (W - 9) / 4
    const KH = 52
    const ky = doc.y
    const kpis = [
      { label: 'Sessões',        value: totalSessoes, color: '#6366f1' },
      { label: 'Concluídas',     value: concluidos,   color: SUCCESS  },
      { label: 'Assinaturas',    value: totalAssin,   color: '#3b82f6' },
      { label: 'Temas distintos',value: temasUnicos,  color: '#f59e0b' },
    ]
    kpis.forEach((k, i) => {
      const kx = M + i * (KW + 3)
      doc.roundedRect(kx, ky, KW, KH, 6).fillColor(BGSFT).fill()
      doc.roundedRect(kx, ky, KW, KH, 6).lineWidth(0.5).strokeColor(BORDER).stroke()
      doc.roundedRect(kx, ky, KW, 3, 0).fillColor(k.color).fill()
      doc.fillColor(k.color).font('Helvetica-Bold').fontSize(22)
         .text(String(k.value), kx + 10, ky + 10, { width: KW - 20, align: 'left', lineBreak: false })
      doc.fillColor(MUTED).font('Helvetica').fontSize(8)
         .text(k.label.toUpperCase(), kx + 10, ky + 35, { width: KW - 20, lineBreak: false })
    })
    doc.y = ky + KH + 14

    // ─── TABELA ──────────────────────────────────────────────────
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9.5)
       .text('DETALHE POR SESSÃO', M, doc.y, { width: W })
    doc.y += 10

    // Colunas: Data | Turno | Líder | Equipe | Tema | Assin. | Status
    const C = {
      data:    46,
      turno:   42,
      lider:   90,
      equipe:  80,
      tema:    120,
      assin:   36,
      status:  W - 46 - 42 - 90 - 80 - 120 - 36 - 6 * 4,
    }
    const TH = 20
    doc.roundedRect(M, doc.y, W, TH, 4).fillColor(NAVY).fill()
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5)
    const hy0 = doc.y + 6
    let hx = M + 6
    for (const [key, w] of Object.entries(C)) {
      const labels = { data: 'Data', turno: 'Turno', lider: 'Líder', equipe: 'Equipe', tema: 'Tema', assin: 'Assin.', status: 'Status' }
      doc.text(labels[key], hx, hy0, { width: w - 4, lineBreak: false })
      hx += w + 4
    }
    doc.y += TH

    const ROW_H = 22
    registros.forEach((r, i) => {
      if (doc.y + ROW_H > 820) {
        doc.addPage()
        doc.y = M
        // repetir cabeçalho da tabela
        doc.roundedRect(M, doc.y, W, TH, 4).fillColor(NAVY).fill()
        doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5)
        const hy2 = doc.y + 6
        let hx2 = M + 6
        for (const [key, w] of Object.entries(C)) {
          const labels = { data: 'Data', turno: 'Turno', lider: 'Líder', equipe: 'Equipe', tema: 'Tema', assin: 'Assin.', status: 'Status' }
          doc.text(labels[key], hx2, hy2, { width: w - 4, lineBreak: false })
          hx2 += w + 4
        }
        doc.y += TH
      }

      const ry  = doc.y
      const bg  = i % 2 === 0 ? '#ffffff' : BGSFT
      doc.rect(M, ry, W, ROW_H).fillColor(bg).fill()
      doc.rect(M, ry, W, ROW_H).lineWidth(0.3).strokeColor(BORDER).stroke()

      const ty   = ry + 7
      const tema = r.dds_temas
      let cx2 = M + 6
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(8)
         .text(fmt(r.data), cx2, ty, { width: C.data - 4, lineBreak: false }); cx2 += C.data + 4
      doc.fillColor(INK).font('Helvetica').fontSize(8)
         .text(TURNO[r.turno] || r.turno || '—', cx2, ty, { width: C.turno - 4, lineBreak: false }); cx2 += C.turno + 4
      doc.text(r.lider_nome || '—', cx2, ty, { width: C.lider - 4, lineBreak: false, ellipsis: true }); cx2 += C.lider + 4
      doc.text(r.equipe_nome || '—', cx2, ty, { width: C.equipe - 4, lineBreak: false, ellipsis: true }); cx2 += C.equipe + 4
      doc.text(tema?.titulo || '—', cx2, ty, { width: C.tema - 4, lineBreak: false, ellipsis: true }); cx2 += C.tema + 4
      doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9)
         .text(String(r.total_assinantes || 0), cx2, ty - 1, { width: C.assin - 4, align: 'center', lineBreak: false }); cx2 += C.assin + 4
      const stColor = r.status === 'concluido' ? SUCCESS : WARN
      const stLabel = r.status === 'concluido' ? 'Concluído' : 'Andamento'
      doc.fillColor(stColor).font('Helvetica-Bold').fontSize(7.5)
         .text(stLabel, cx2, ty, { width: C.status - 4, lineBreak: false })

      doc.y = ry + ROW_H
    })

    // Rodapé totais
    const FY = doc.y + 4
    doc.rect(M, FY, W, 26).fillColor('#1e3a5f0d').fill()
    doc.rect(M, FY, W, 26).lineWidth(0.5).strokeColor(NAVY).stroke()
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8.5)
       .text(`Total: ${totalSessoes} sessão(ões)  ·  ${concluidos} concluída(s)  ·  ${totalAssin} assinatura(s) coletada(s)`,
             M + 12, FY + 8, { width: W - 24 })

    doc.y = FY + 34

    // ─── RODAPÉ PÁGINAS ──────────────────────────────────────────
    const range = doc.bufferedPageRange()
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p)
      doc.fillColor(MUTED).font('Helvetica').fontSize(7.5)
         .text(`SmartLíder — Relatório DDS · ${periodoLabel} · Página ${p - range.start + 1}/${range.count}`,
               M, 820, { width: W, align: 'center' })
    }

    doc.end()
  })
}

export default async function handler(req, res) {
  const { workspaceId, inicio, fim, status } = req.query
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId obrigatório' })

  const db = getDb()
  let q = db.from('dds_registros')
    .select('id, data, turno, status, total_assinantes, lider_nome, equipe_nome, concluido_em, dds_temas(id, titulo, categoria)')
    .eq('workspace_id', workspaceId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (status && status !== 'todos') q = q.eq('status', status)
  if (inicio) q = q.gte('data', inicio)
  if (fim)    q = q.lte('data', fim)

  const { data: registros, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  const { data: ws } = await db.from('workspaces').select('nome').eq('id', workspaceId).single()

  try {
    const pdf = await gerarRelPDF(registros || [], { inicio, fim, status }, ws?.nome || 'SmartPro')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-dds.pdf"`)
    res.send(pdf)
  } catch (err) {
    console.error('[dds-relatorio]', err)
    res.status(500).json({ error: err.message })
  }
}
