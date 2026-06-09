/**
 * api/dds-presenca.js
 * Relatório de Lista de Presença por Sessão DDS com Faltas.
 *
 * GET /api/dds-presenca?workspaceId=<uuid>&inicio=YYYY-MM-DD&fim=YYYY-MM-DD
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

const NAVY    = '#1e3a5f'
const INK     = '#0f172a'
const MUTED   = '#6b7280'
const SUCCESS = '#10b981'
const DANGER  = '#ef4444'
const BORDER  = '#e5e7eb'
const BGSFT   = '#f9fafb'
const M  = 28
const W_PAGE = 595

const CAT_COLOR = {
  'Segurança':     '#ef4444',
  'Saúde':         '#3b82f6',
  'Meio Ambiente': '#22c55e',
  'Qualidade':     '#f59e0b',
  'Outros':        '#8b5cf6',
}

const TURNO_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

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

async function gerarPDF(sessoes, filtros, empresa) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const doc = new PDFDocument({ margin: M, size: 'A4', bufferPages: true })
    doc.on('data', c => chunks.push(c))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = W_PAGE - M * 2

    const periodoLabel = filtros.inicio && filtros.fim
      ? `${fmt(filtros.inicio)} a ${fmt(filtros.fim)}`
      : filtros.inicio ? `A partir de ${fmt(filtros.inicio)}`
      : filtros.fim    ? `Até ${fmt(filtros.fim)}`
      : 'Todos os registros'

    // KPIs globais
    let totalPresentes = 0, totalAusentes = 0
    for (const s of sessoes) {
      totalPresentes += s.presentes.length
      totalAusentes  += s.ausentes.length
    }
    const totalPessoas = totalPresentes + totalAusentes
    const pct = totalPessoas > 0 ? Math.round(totalPresentes / totalPessoas * 100) : 0

    // ─── CABEÇALHO ───────────────────────────────────────────────
    const HH = 90
    doc.roundedRect(M, M, 170, HH, 6).fillColor(NAVY).fill()
    if (LOGO_BUF) {
      try { doc.image(LOGO_BUF, M + 8, M + 8, { fit: [154, HH - 16], align: 'center', valign: 'center' }) } catch {}
    } else {
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(14)
         .text(String(empresa || 'SmartPro'), M + 10, M + 32, { width: 150, align: 'center' })
    }
    const cx = M + 178, cw = W - 178
    doc.roundedRect(cx, M, cw, HH, 6).fillColor(BGSFT).fill()
    doc.roundedRect(cx, M, cw, HH, 6).lineWidth(0.5).strokeColor(BORDER).stroke()
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(14)
       .text('LISTA DE PRESENÇA DDS', cx + 14, M + 11, { width: cw - 20 })
    doc.fillColor('#ef4444').font('Helvetica-Bold').fontSize(9)
       .text('RELATÓRIO DE PRESENÇAS E FALTAS', cx + 14, M + 29, { width: cw - 20 })
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5)
       .text(`Período: ${periodoLabel}`, cx + 14, M + 47, { width: cw - 20 })
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5)
       .text(`Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}   ·   ${empresa || 'SmartPro'}`, cx + 14, M + 60, { width: cw - 20 })

    doc.y = M + HH + 14

    // ─── KPIs ────────────────────────────────────────────────────
    const KW = (W - 9) / 4
    const KH = 52
    const ky = doc.y
    const kpis = [
      { label: 'Sessões DDS',   value: sessoes.length, color: '#6366f1' },
      { label: 'Presenças',     value: totalPresentes, color: SUCCESS   },
      { label: 'Faltas',        value: totalAusentes,  color: DANGER    },
      { label: 'Frequência',    value: pct + '%',      color: '#f59e0b' },
    ]
    kpis.forEach((k, i) => {
      const kx = M + i * (KW + 3)
      doc.roundedRect(kx, ky, KW, KH, 6).fillColor(BGSFT).fill()
      doc.roundedRect(kx, ky, KW, KH, 6).lineWidth(0.5).strokeColor(BORDER).stroke()
      doc.roundedRect(kx, ky, KW, 3, 0).fillColor(k.color).fill()
      doc.fillColor(k.color).font('Helvetica-Bold').fontSize(20)
         .text(String(k.value), kx + 10, ky + 10, { width: KW - 20, lineBreak: false })
      doc.fillColor(MUTED).font('Helvetica').fontSize(8)
         .text(k.label.toUpperCase(), kx + 10, ky + 34, { width: KW - 20, lineBreak: false })
    })
    doc.y = ky + KH + 16

    // ─── SESSÕES ─────────────────────────────────────────────────
    const COL_N   = 30
    const COL_NOM = 200
    const COL_CAR = 110
    const COL_STA = W - COL_N - COL_NOM - COL_CAR
    const TH = 20
    const ROW_H = 22

    for (const sessao of sessoes) {
      const tema     = sessao.dds_temas
      const catColor = CAT_COLOR[tema?.categoria] || '#6366f1'
      const todos    = [...sessao.presentes, ...sessao.ausentes]
        .sort((a, b) => a.nome.localeCompare(b.nome))

      const estimatedH = 60 + TH + todos.length * ROW_H + 40
      if (doc.y + estimatedH > 800) { doc.addPage(); doc.y = M }

      // ── Card cabeçalho da sessão ──
      const SY = doc.y
      // Barra colorida categoria
      doc.roundedRect(M, SY, W, 3, 0).fillColor(catColor).fill()
      doc.roundedRect(M, SY, W, 48, 6).fillColor(catColor + '12').fill()
      doc.roundedRect(M, SY, W, 48, 6).lineWidth(0.5).strokeColor(catColor + '50').stroke()

      // Data + turno + tema
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10)
         .text(
           `${fmt(sessao.data)}  ·  ${TURNO_LABEL[sessao.turno] || sessao.turno || '—'}`,
           M + 12, SY + 7, { lineBreak: false, width: W / 2 }
         )
      // Tema
      doc.fillColor(catColor).font('Helvetica-Bold').fontSize(10)
         .text(tema?.titulo || '—', M + 12 + W / 2, SY + 7, { lineBreak: false, width: W / 2 - 14 })

      // Equipe + líder
      const equipeText = `${sessao.equipe_nome || '—'}   ·   Líder: ${sessao.lider_nome || '—'}`
      doc.fillColor(MUTED).font('Helvetica').fontSize(8.5)
         .text(equipeText, M + 12, SY + 22, { width: W - 24, lineBreak: false })

      // Resumo presença
      const pres = sessao.presentes.length
      const ause = sessao.ausentes.length
      const tot  = pres + ause
      const freqPct = tot > 0 ? Math.round(pres / tot * 100) : 0
      const resumo = `Presentes: ${pres}   Ausentes: ${ause}   Total equipe: ${tot}   Frequência: ${freqPct}%`
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8.5)
         .text(resumo, M + 12, SY + 35, { width: W - 24, lineBreak: false })

      doc.y = SY + 52

      if (todos.length === 0) {
        doc.fillColor(MUTED).font('Helvetica').fontSize(9)
           .text('Nenhum colaborador registrado nesta sessão.', M + 12, doc.y + 6, { width: W - 24 })
        doc.y += 24
        continue
      }

      // ── Cabeçalho da tabela ──
      doc.roundedRect(M, doc.y, W, TH, 3).fillColor(NAVY).fill()
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5)
      const hy = doc.y + 6
      doc.text('Nº',          M + 8,                                hy, { width: COL_N - 6,    lineBreak: false })
      doc.text('Colaborador', M + COL_N + 6,                        hy, { width: COL_NOM - 10, lineBreak: false })
      doc.text('Cargo',       M + COL_N + COL_NOM + 6,              hy, { width: COL_CAR - 6,  lineBreak: false })
      doc.text('Status',      M + COL_N + COL_NOM + COL_CAR + 6,   hy, { width: COL_STA - 6,  lineBreak: false })
      doc.y += TH

      // ── Linhas de colaboradores ──
      todos.forEach((p, i) => {
        if (doc.y + ROW_H > 820) {
          doc.addPage(); doc.y = M
          // repetir cabeçalho
          doc.roundedRect(M, doc.y, W, TH, 3).fillColor(NAVY).fill()
          doc.fillColor('#fff').font('Helvetica-Bold').fontSize(7.5)
          const hy2 = doc.y + 6
          doc.text('Nº',          M + 8,                              hy2, { width: COL_N - 6,    lineBreak: false })
          doc.text('Colaborador', M + COL_N + 6,                      hy2, { width: COL_NOM - 10, lineBreak: false })
          doc.text('Cargo',       M + COL_N + COL_NOM + 6,            hy2, { width: COL_CAR - 6,  lineBreak: false })
          doc.text('Status',      M + COL_N + COL_NOM + COL_CAR + 6, hy2, { width: COL_STA - 6,  lineBreak: false })
          doc.y += TH
        }

        const ry  = doc.y
        const bg  = i % 2 === 0 ? '#ffffff' : BGSFT
        doc.rect(M, ry, W, ROW_H).fillColor(bg).fill()

        // Borda esquerda colorida por status
        const statusColor = p.presente ? SUCCESS : DANGER
        doc.rect(M, ry, 3, ROW_H).fillColor(statusColor).fill()

        // Separador inferior
        doc.moveTo(M, ry + ROW_H).lineTo(M + W, ry + ROW_H)
           .lineWidth(0.3).strokeColor(BORDER).stroke()

        const ty = ry + ROW_H / 2 - 4
        doc.fillColor(MUTED).font('Helvetica').fontSize(7.5)
           .text(String(i + 1), M + 9, ty, { width: COL_N - 6, lineBreak: false })

        doc.fillColor(INK).font('Helvetica-Bold').fontSize(8)
           .text(p.nome || '—', M + COL_N + 6, ty, { width: COL_NOM - 10, lineBreak: false, ellipsis: true })

        doc.fillColor(MUTED).font('Helvetica').fontSize(8)
           .text(p.cargo || '—', M + COL_N + COL_NOM + 6, ty, { width: COL_CAR - 6, lineBreak: false, ellipsis: true })

        // Badge de status
        const badgeColor = p.presente ? SUCCESS : DANGER
        const badgeLabel = p.presente ? '✓  Presente' : '✗  Ausente'
        const bx = M + COL_N + COL_NOM + COL_CAR + 6
        doc.roundedRect(bx, ry + 4, COL_STA - 10, ROW_H - 8, 4)
           .fillColor(badgeColor + '18').fill()
        doc.fillColor(badgeColor).font('Helvetica-Bold').fontSize(8)
           .text(badgeLabel, bx + 4, ty, { width: COL_STA - 18, lineBreak: false })

        doc.y = ry + ROW_H
      })

      // Separador entre sessões
      doc.y += 12
    }

    // ─── RODAPÉ PÁGINAS ──────────────────────────────────────────
    const range = doc.bufferedPageRange()
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p)
      doc.fillColor(MUTED).font('Helvetica').fontSize(7.5)
         .text(
           `SmartLíder — Lista de Presença DDS · ${periodoLabel} · Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · Página ${p - range.start + 1}/${range.count}`,
           M, 820, { width: W, align: 'center' }
         )
    }

    doc.end()
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { workspaceId, inicio, fim } = req.query
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId obrigatório' })

  const db = getDb()

  // 1. Registros concluídos no período
  let q = db.from('dds_registros')
    .select('id, data, turno, turno_id, lider_nome, equipe_nome, total_assinantes, concluido_em, dds_temas(titulo, categoria)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'concluido')
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(300)
  if (inicio) q = q.gte('data', inicio)
  if (fim)    q = q.lte('data', fim)

  const { data: registros, error: errReg } = await q
  if (errReg) return res.status(500).json({ error: errReg.message })
  if (!registros?.length) {
    return res.status(404).json({ error: 'Nenhum registro DDS concluído no período.' })
  }

  // 2. Buscar equipe_id dos turnos (batch)
  const turnoIds = [...new Set(registros.map(r => r.turno_id).filter(Boolean))]
  let turnoMap = {}
  if (turnoIds.length > 0) {
    const { data: turnos } = await db
      .from('lider_turnos')
      .select('id, equipe_id, equipe_nome')
      .in('id', turnoIds)
    if (turnos) turnoMap = Object.fromEntries(turnos.map(t => [t.id, t]))
  }

  // 3. Colaboradores por equipe_id (batch)
  const equipeIds = [...new Set(Object.values(turnoMap).map(t => t.equipe_id).filter(Boolean))]
  let colabsByEquipe = {}
  if (equipeIds.length > 0) {
    const { data: colabs } = await db
      .from('lider_colaboradores')
      .select('id, nome, cargo, equipe_id')
      .in('equipe_id', equipeIds)
      .eq('ativo', true)
      .order('nome')
    if (colabs) {
      for (const c of colabs) {
        if (!colabsByEquipe[c.equipe_id]) colabsByEquipe[c.equipe_id] = []
        colabsByEquipe[c.equipe_id].push(c)
      }
    }
  }

  // 4. Assinaturas de todos os registros (batch)
  const regIds = registros.map(r => r.id)
  const { data: todasAssin } = await db
    .from('dds_assinaturas')
    .select('registro_id, colaborador_id, colaborador_nome')
    .in('registro_id', regIds)
  const assinByReg = {}
  for (const a of (todasAssin || [])) {
    if (!assinByReg[a.registro_id]) assinByReg[a.registro_id] = []
    assinByReg[a.registro_id].push(a)
  }

  // 5. Montar sessões com presentes e ausentes
  const sessoes = registros.map(reg => {
    const turno    = turnoMap[reg.turno_id]
    const equipeId = turno?.equipe_id
    const equipe   = equipeId ? (colabsByEquipe[equipeId] || []) : []
    const assin    = assinByReg[reg.id] || []
    const assinIds = new Set(assin.map(a => a.colaborador_id).filter(Boolean))

    const presentes = equipe
      .filter(c => assinIds.has(c.id))
      .map(c => ({ nome: c.nome, cargo: c.cargo, presente: true }))

    const ausentes = equipe
      .filter(c => !assinIds.has(c.id))
      .map(c => ({ nome: c.nome, cargo: c.cargo, presente: false }))

    // Convidados (assinaram mas não estão na equipe)
    const convidados = assin
      .filter(a => !a.colaborador_id)
      .map(a => ({ nome: a.colaborador_nome, cargo: 'Convidado', presente: true }))

    return {
      ...reg,
      equipe_nome: reg.equipe_nome || turno?.equipe_nome || '—',
      presentes: [...presentes, ...convidados],
      ausentes,
    }
  })

  const { data: ws } = await db.from('workspaces').select('nome').eq('id', workspaceId).single()

  try {
    const hoje = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const pdf  = await gerarPDF(sessoes, { inicio, fim }, ws?.nome || 'SmartPro')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="presenca-dds-${hoje}.pdf"`)
    res.send(pdf)
  } catch (err) {
    console.error('[dds-presenca]', err)
    res.status(500).json({ error: err.message })
  }
}
