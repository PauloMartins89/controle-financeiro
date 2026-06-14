import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatDate } from './utils'

export function exportarBalancoPDF({ expenses, people, groups, mes }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const now = new Date()
  const mesLabel = mes
    ? new Date(mes + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const mesStr = mes || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const despesasMes = expenses.filter(e => e.data?.startsWith(mesStr))

  // ── Cabeçalho ────────────────────────────────────────────────────────────
  doc.setFillColor(99, 102, 241)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('SmartPro', 14, 12)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Balanço Mensal — ${mesLabel}`, 14, 21)
  doc.setTextColor(0, 0, 0)

  // ── Resumo ────────────────────────────────────────────────────────────────
  const total = despesasMes.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0)
  const pagas = despesasMes.filter(e => e.status === 'pago').reduce((s, e) => s + (parseFloat(e.valor) || 0), 0)
  const pendentes = despesasMes.filter(e => e.status === 'pendente').reduce((s, e) => s + (parseFloat(e.valor) || 0), 0)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumo', 14, 36)
  doc.setFont('helvetica', 'normal')

  const resumo = [
    ['Total de despesas', String(despesasMes.length)],
    ['Valor total', formatCurrency(total)],
    ['Pagas', formatCurrency(pagas)],
    ['Pendentes', formatCurrency(pendentes)],
  ]
  autoTable(doc, {
    startY: 39,
    head: [],
    body: resumo,
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { cellWidth: 50 } },
    theme: 'plain',
    margin: { left: 14 },
  })

  // ── Por categoria ─────────────────────────────────────────────────────────
  const porCat = {}
  despesasMes.forEach(e => {
    const cat = e.categoria || 'Outros'
    porCat[cat] = (porCat[cat] || 0) + (parseFloat(e.valor) || 0)
  })
  const catRows = Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([cat, val]) => [cat, formatCurrency(val)])

  const afterResumo = doc.lastAutoTable.finalY + 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Por Categoria', 14, afterResumo)

  autoTable(doc, {
    startY: afterResumo + 3,
    head: [['Categoria', 'Total']],
    body: catRows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { left: 14 },
    tableWidth: 90,
  })

  // ── Listagem de despesas ──────────────────────────────────────────────────
  const despesaRows = despesasMes
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
    .map(e => [
      formatDate(e.data),
      e.descricao || '—',
      e.categoria || 'Outros',
      formatCurrency(e.valor),
      e.status === 'pago' ? 'Pago' : 'Pendente',
    ])

  const afterCat = doc.lastAutoTable.finalY + 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Detalhamento', 14, afterCat)

  autoTable(doc, {
    startY: afterCat + 3,
    head: [['Data', 'Descrição', 'Categoria', 'Valor', 'Status']],
    body: despesaRows,
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 70 },
      2: { cellWidth: 35 },
      3: { cellWidth: 28 },
      4: { cellWidth: 22 },
    },
    didDrawCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        const val = data.cell.raw
        data.cell.styles.textColor = val === 'Pago' ? [16, 185, 129] : [245, 158, 11]
      }
    },
    margin: { left: 14 },
  })

  // ── Rodapé ────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`SmartPro · Gerado em ${now.toLocaleDateString('pt-BR')} · Página ${i}/${pageCount}`, 14, 290)
  }

  doc.save(`balanco-${mesStr}.pdf`)
}

// ─── Lote de Aprovação ao Cliente ─────────────────────────────────────────────
// Retorna o doc jsPDF (sem salvar) — use .save() para download ou
// .output('datauristring').split(',')[1] para base64 (WA/email).
// Usa o mesmo motor visual de Lancamentos.jsx: paisagem, verde corporativo,
// colunas dinâmicas (só exibe o que tiver dado) e bloco de assinatura.
export function buildLotePDFDoc({ lancamentos = [], lote, link, assinaturaBase64 = null, aprovadoEm = null, aprovadorNome = null }) {
  const doc      = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const PW       = doc.internal.pageSize.getWidth()
  const PH       = doc.internal.pageSize.getHeight()
  const geradoEm = new Date().toLocaleString('pt-BR')
  const dataArq  = new Date().toISOString().slice(0, 10)

  // ── Paleta verde corporativo (igual Lancamentos) ───────────────────────────
  const VERDE_ESCURO = [26, 92, 56]
  const VERDE_MEDIO  = [5, 150, 105]
  const BRANCO       = [255, 255, 255]
  const CINZA_TEXTO  = [45, 55, 45]
  const CINZA_LEVE   = [240, 247, 243]

  const titulo = `LOTE DE APROVAÇÃO — ${(lote.cliente || '').toUpperCase()}`

  // ── Header/Footer ──────────────────────────────────────────────────────────
  const addHeaderFooter = (pageNum, totalPages) => {
    doc.setFillColor(...VERDE_ESCURO); doc.rect(0, 0, PW, 52, 'F')
    doc.setFillColor(...VERDE_MEDIO);  doc.rect(0, 52, PW, 6, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...BRANCO)
    doc.text(titulo, 36, 24)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 220, 195)
    doc.text(`Gerado em: ${geradoEm}   |   Total de registros: ${lancamentos.length}`, 36, 38)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BRANCO)
    doc.text('SmartPro', PW - 36, 24, { align: 'right' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(180, 220, 195)
    doc.text(lote.nome || 'Controle Financeiro', PW - 36, 36, { align: 'right' })
    doc.setFillColor(...VERDE_ESCURO); doc.rect(0, PH - 24, PW, 24, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...BRANCO)
    const footerMid = link ? `Aprovação: ${link}` : `Página ${pageNum} de ${totalPages}   |   Confidencial — uso interno`
    doc.text(footerMid, PW / 2, PH - 8, { align: 'center' })
    doc.text(dataArq, PW - 36, PH - 8, { align: 'right' })
  }

  // ── Helpers locais ─────────────────────────────────────────────────────────
  const fmtC = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
  const fmtD = d => d ? d.split('-').reverse().join('/') : ''
  const calcKm = (d = {}) => {
    const parse = v => { const n = parseFloat(String(v || '').replace(/[^\d.,]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n }
    const rows = (d.km_rows || []).filter(r => r.total && String(r.total).trim() !== '')
    const asfalto = rows.filter(r => r.tipo === 'ASFALTO').reduce((s, r) => s + parse(r.total), 0)
    const terra   = rows.filter(r => r.tipo === 'TERRA').reduce((s, r) => s + parse(r.total), 0)
    return { asfalto, terra, total: asfalto + terra }
  }

  // ── Colunas possíveis (mesma definição de Lancamentos.jsx) ─────────────────
  const ALL_COLS = [
    { key: 'data',        label: 'DATA',        width: 48,  halign: 'center', getValue: l => fmtD(l.data) },
    { key: 'num_diario',  label: 'Nº DM',       width: 36,  halign: 'center', bold: true, getValue: l => l.dados_extras?.numero_diario || '' },
    { key: 'descricao',   label: 'DESCRIÇÃO',   width: 100, halign: 'left',   bold: true, getValue: l => l.dados_extras?.cliente || l.dados_extras?.empresa || l.descricao || '' },
    { key: 'condutor',    label: 'CONDUTOR',    width: 72,  halign: 'left',   getValue: l => l.dados_extras?.condutor || '' },
    { key: 'placa',       label: 'PLACA',       width: 44,  halign: 'center', getValue: l => l.dados_extras?.placa || '' },
    { key: 'origem',      label: 'ORIGEM',      width: 72,  halign: 'left',   getValue: l => l.dados_extras?.local_origem || '' },
    { key: 'destino',     label: 'DESTINO',     width: 72,  halign: 'left',   getValue: l => l.dados_extras?.local_destino || '' },
    { key: 'solicitante', label: 'SOLICITANTE', width: 72,  halign: 'left',   getValue: l => l.dados_extras?.solicitante || '' },
    { key: 'km_asf',      label: 'KM ASF',      width: 44,  halign: 'right',  getValue: l => { const km = calcKm(l.dados_extras||{}); return km.asfalto > 0 ? km.asfalto.toLocaleString('pt-BR') : '' } },
    { key: 'km_ter',      label: 'KM TER',      width: 44,  halign: 'right',  getValue: l => { const km = calcKm(l.dados_extras||{}); return km.terra > 0 ? km.terra.toLocaleString('pt-BR') : '' } },
    { key: 'km_tot',      label: 'KM TOTAL',    width: 48,  halign: 'right',  bold: true, getValue: l => { const km = calcKm(l.dados_extras||{}); return km.total > 0 ? km.total.toLocaleString('pt-BR') : '' } },
    { key: 'pedagio',     label: 'PEDÁGIO',     width: 52,  halign: 'right',  getValue: l => l.dados_extras?.pedagio != null && l.dados_extras?.pedagio !== '' ? fmtC(l.dados_extras.pedagio) : '' },
    { key: 'pernoite',    label: 'PERNOITE',    width: 52,  halign: 'right',  getValue: l => l.dados_extras?.pernoite != null && l.dados_extras?.pernoite !== '' ? fmtC(l.dados_extras.pernoite) : '' },
    { key: 'refeicao',    label: 'REFEIÇÃO',    width: 52,  halign: 'right',  getValue: l => l.dados_extras?.refeicao != null && l.dados_extras?.refeicao !== '' ? fmtC(l.dados_extras.refeicao) : '' },
    { key: 'outros',      label: 'OUTROS',      width: 52,  halign: 'right',  getValue: l => l.dados_extras?.outros_adicionais != null && l.dados_extras?.outros_adicionais !== '' ? fmtC(l.dados_extras.outros_adicionais) : '' },
    { key: 'desconto',    label: 'DESCONTO',    width: 52,  halign: 'right',  getValue: l => l.dados_extras?.desconto != null && l.dados_extras?.desconto !== '' ? fmtC(l.dados_extras.desconto) : '' },
    { key: 'valor',       label: 'VALOR',       width: 64,  halign: 'right',  bold: true, green: true, getValue: l => fmtC(l.valor) },
    { key: 'status',      label: 'STATUS',      width: 60,  halign: 'center', getValue: l => l.status || '' },
    { key: 'obs',         label: 'OBSERVAÇÕES', width: 90,  halign: 'left',   getValue: l => (l.observacoes || l.dados_extras?.observacao || '').slice(0, 80) },
  ]

  // ── Mantém só colunas com ao menos 1 valor preenchido ─────────────────────
  const activeCols = ALL_COLS.filter(col =>
    lancamentos.some(l => { const v = col.getValue(l); return v !== '' && v !== '—' && v != null })
  )

  // ── Linhas ─────────────────────────────────────────────────────────────────
  const rows = lancamentos.map(l =>
    activeCols.map(col => {
      const v = col.getValue(l) || '—'
      const s = { halign: col.halign, fontSize: 7.5 }
      if (col.bold)  s.fontStyle = 'bold'
      if (col.green) { s.fontStyle = 'bold'; s.textColor = [5, 120, 60] }
      return { content: v, styles: s }
    })
  )

  // ── Linha de totais ────────────────────────────────────────────────────────
  const totalValor = lancamentos.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0)
  const totalKmAsf = lancamentos.reduce((s, l) => s + (calcKm(l.dados_extras||{}).asfalto||0), 0)
  const totalKmTer = lancamentos.reduce((s, l) => s + (calcKm(l.dados_extras||{}).terra||0), 0)
  const totalKmTot = lancamentos.reduce((s, l) => s + (calcKm(l.dados_extras||{}).total||0), 0)
  const TOTAL_MAP  = {
    km_asf: totalKmAsf > 0 ? totalKmAsf.toLocaleString('pt-BR') : '',
    km_ter: totalKmTer > 0 ? totalKmTer.toLocaleString('pt-BR') : '',
    km_tot: totalKmTot > 0 ? totalKmTot.toLocaleString('pt-BR') : '',
    valor:  fmtC(totalValor),
  }
  const totalRowData = activeCols.map((col, ci) => {
    const v = TOTAL_MAP[col.key] || (ci === 0 ? 'TOTAIS' : '')
    return { content: v, styles: { halign: col.halign, fontStyle: 'bold', fillColor: VERDE_ESCURO, textColor: col.key === 'valor' ? [134, 255, 178] : BRANCO } }
  })

  // ── columnStyles dinâmico ──────────────────────────────────────────────────
  const columnStyles = {}
  activeCols.forEach((col, ci) => { columnStyles[ci] = { cellWidth: col.width } })

  // ── Render tabela ──────────────────────────────────────────────────────────
  autoTable(doc, {
    head: [activeCols.map(c => c.label)],
    body: [...rows, totalRowData],
    startY: 70,
    margin: { left: 28, right: 28, bottom: 36 },
    styles: { fontSize: 7.5, cellPadding: { top: 5, right: 4, bottom: 5, left: 4 }, textColor: CINZA_TEXTO, lineColor: [200, 220, 210], lineWidth: 0.3, overflow: 'ellipsize' },
    headStyles: { fillColor: VERDE_MEDIO, textColor: BRANCO, fontStyle: 'bold', fontSize: 7.5, halign: 'center', minCellHeight: 20 },
    alternateRowStyles: { fillColor: CINZA_LEVE },
    columnStyles,
    didDrawPage: (data) => { addHeaderFooter(data.pageNumber, doc.internal.getNumberOfPages()) },
  })

  // Reaplica header/footer com total real de páginas
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) { doc.setPage(i); addHeaderFooter(i, totalPages) }

  // ── Bloco de assinatura "De acordo" ───────────────────────────────────────
  const lastY = doc.lastAutoTable?.finalY || 200
  const sigH  = assinaturaBase64 ? 36 : 0
  if (lastY + 80 + sigH < PH - 40) {
    const baseY = lastY + 20
    doc.setDrawColor(...VERDE_MEDIO); doc.setLineWidth(0.5)

    // Lado esquerdo — emissão (sem alteração)
    doc.line(28, baseY + 40, 210, baseY + 40)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA_TEXTO)
    doc.text('Responsável pela emissão', 28, baseY + 50)
    doc.setFontSize(6.5); doc.setTextColor(130, 150, 140)
    doc.text('Data: ___/___/______', 28, baseY + 60)

    // Lado direito — cliente
    if (assinaturaBase64) {
      // Imagem da assinatura acima da linha
      try {
        const imgData = assinaturaBase64.startsWith('data:') ? assinaturaBase64 : `data:image/png;base64,${assinaturaBase64}`
        doc.addImage(imgData, 'PNG', PW - 202, baseY - 2, 170, 42)
      } catch (_) {}
      doc.line(PW - 28, baseY + 43, PW - 202, baseY + 43)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...CINZA_TEXTO)
      doc.text(aprovadorNome || 'De acordo — Cliente', PW - 28, baseY + 53, { align: 'right' })
      // Carimbo digital
      const fmtAprovado = aprovadoEm
        ? new Date(aprovadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : ''
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(80, 130, 100)
      doc.text(`Assinado digitalmente em ${fmtAprovado}`, PW - 28, baseY + 62, { align: 'right' })
    } else {
      doc.line(PW - 28, baseY + 40, PW - 210, baseY + 40)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA_TEXTO)
      doc.text('De acordo — Cliente', PW - 28, baseY + 50, { align: 'right' })
      doc.setFontSize(6.5); doc.setTextColor(130, 150, 140)
      doc.text('Data: ___/___/______', PW - 28, baseY + 60, { align: 'right' })
    }
  }

  return doc
}

// ─── Recibo ERP — PDF assinado pelo cliente ───────────────────────────────────
// Formato retrato A4, paleta navy/branco (mesma identidade de LancamentosERP).
// Exibe dados da empresa emissora (Birigui) + dados da empresa pagadora (cliente).
// Parâmetros:
//   lancamentos   — array de lançamentos do lote
//   lote          — objeto lotes_cliente
//   assinaturaBase64 — imagem da assinatura digital (base64 ou dataURL), pode ser null
//   aprovadoEm    — ISO timestamp da aprovação
//   aprovadorNome — nome de quem assinou pelo cliente
//   emissora      — dados da empresa emissora (opcional, usa padrão Birigui)
export function buildReciboERP({
  lancamentos = [],
  lote,
  assinaturaBase64 = null,
  aprovadoEm = null,
  aprovadorNome = null,
  emissora = {},
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW  = doc.internal.pageSize.getWidth()   // 210 mm
  const PH  = doc.internal.pageSize.getHeight()  // 297 mm
  const L   = 14  // margem esquerda
  const R   = PW - 14  // margem direita

  // ── Paleta ERP ─────────────────────────────────────────────────────────────
  const NAVY   = [11, 31, 58]
  const BLUE   = [29, 78, 216]
  const GREEN  = [5, 150, 105]
  const WHITE  = [255, 255, 255]
  const GRAY   = [100, 116, 139]
  const LIGHT  = [244, 246, 250]
  const BORDER = [216, 222, 233]

  // ── Empresa emissora (padrão: Birigui) ─────────────────────────────────────
  const emp = {
    nome:     emissora.nome     || 'Birigui Locações e Serviços',
    cnpj:     emissora.cnpj     || '—',
    endereco: emissora.endereco || 'BR 262 – Km 14 – Chácara Imperial',
    cidade:   emissora.cidade   || 'Três Lagoas – MS',
    fone:     emissora.fone     || '(67) 9 9965-4128',
    email:    emissora.email    || 'financeiro@grupocasagrande.net',
  }

  // ── Número do recibo (últimos 8 do UUID do lote) ───────────────────────────
  const numRecibo = (lote.id || '').replace(/-/g, '').slice(-8).toUpperCase()
  const geradoEm  = new Date().toLocaleString('pt-BR')

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmtC  = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
  const fmtD  = d => d ? d.split('-').reverse().join('/') : '—'
  const fmtDT = ts => ts ? new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── CABEÇALHO ──────────────────────────────────────────────────────────────
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Faixa navy superior
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PW, 30, 'F')

  // Nome da empresa emissora (esquerda)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...WHITE)
  doc.text(emp.nome.toUpperCase(), L, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(180, 200, 220)
  doc.text(`${emp.endereco}  ·  ${emp.cidade}  ·  ${emp.fone}`, L, 21)
  if (emp.cnpj !== '—') doc.text(`CNPJ: ${emp.cnpj}`, L, 26)

  // Box "RECIBO" (direita)
  doc.setFillColor(...BLUE)
  doc.roundedRect(R - 50, 4, 52, 22, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...WHITE)
  doc.text('RECIBO', R - 24, 14, { align: 'center' })
  doc.setFontSize(8)
  doc.text(`Nº ${numRecibo}`, R - 24, 22, { align: 'center' })

  // Linha azul fina separadora
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.6)
  doc.line(0, 30, PW, 30)

  // ── Sub-header: dois blocos (emissora × cliente) ───────────────────────────
  let y = 38

  // Bloco esquerdo — Emitido por
  doc.setFillColor(...LIGHT)
  doc.rect(L, y, 86, 28, 'F')
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.rect(L, y, 86, 28, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...BLUE)
  doc.text('EMITIDO POR', L + 3, y + 6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text(emp.nome, L + 3, y + 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text(emp.endereco, L + 3, y + 19)
  doc.text(`${emp.cidade}  ·  ${emp.fone}`, L + 3, y + 24)

  // Bloco direito — Empresa pagadora
  doc.setFillColor(...LIGHT)
  doc.rect(PW / 2 + 4, y, 86, 28, 'F')
  doc.setDrawColor(...BORDER)
  doc.rect(PW / 2 + 4, y, 86, 28, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...BLUE)
  doc.text('EMPRESA PAGADORA', PW / 2 + 7, y + 6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...NAVY)
  doc.text((lote.cliente || '').toUpperCase(), PW / 2 + 7, y + 13, { maxWidth: 80 })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  if (aprovadorNome) doc.text(`Representante: ${aprovadorNome}`, PW / 2 + 7, y + 19)
  doc.text(`Aprovado em: ${fmtDT(aprovadoEm)}`, PW / 2 + 7, y + 24)

  y += 34  // abaixo dos blocos

  // Informações do lote (linha de dados rápidos)
  const totalValor = lancamentos.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0)
  const dataMin    = lancamentos.reduce((mn, l) => (!mn || (l.data && l.data < mn)) ? l.data : mn, null)
  const dataMax    = lancamentos.reduce((mx, l) => (!mx || (l.data && l.data > mx)) ? l.data : mx, null)
  const periodo    = dataMin && dataMax ? (dataMin === dataMax ? fmtD(dataMin) : `${fmtD(dataMin)} a ${fmtD(dataMax)}`) : '—'

  doc.setFillColor(...NAVY)
  doc.rect(L, y, PW - 28, 10, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...WHITE)
  doc.text(`Período: ${periodo}`, L + 4, y + 6.5)
  doc.text(`Qtd. lançamentos: ${lancamentos.length}`, L + 60, y + 6.5)
  doc.text(`Data emissão: ${new Date().toLocaleDateString('pt-BR')}`, L + 110, y + 6.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(134, 255, 180)
  doc.text(`TOTAL: ${fmtC(totalValor)}`, R - 4, y + 6.5, { align: 'right' })

  y += 16

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── TABELA DE ITENS ────────────────────────────────────────────────────────
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ── Helpers de cálculo ────────────────────────────────────────────────────
  const parseNum = v => { const n = parseFloat(String(v || '').replace(',', '.')); return isNaN(n) ? 0 : n }
  const calcHoras = d => ['horas_diurnas','horas_noturnas','h_fds_diurnas','h_fds_noturnas','h_feriado_diurnas','h_feriado_noturnas'].reduce((s, k) => s + parseNum(d?.[k]), 0)
  const fmtHoras = h => { if (!h) return '—'; const hh = Math.floor(h); const mm = Math.round((h - hh) * 60); return `${hh}:${String(mm).padStart(2, '0')}` }
  const calcKmTotal = (d = {}) => {
    const rows = (d.km_rows || []).filter(r => r.total && String(r.total).trim() !== '')
    return rows.reduce((s, r) => s + parseNum(String(r.total).replace(',', '.')), 0)
  }

  // Detecta colunas disponíveis (só exibe as que têm dados)
  const hasCampo = key => lancamentos.some(l => {
    const d = l.dados_extras || {}
    const v = d[key]
    return v !== undefined && v !== null && v !== ''
  })
  const hasHoras  = lancamentos.some(l => calcHoras(l.dados_extras) > 0)
  const hasKm     = lancamentos.some(l => calcKmTotal(l.dados_extras) > 0)

  // Colunas do recibo — orientadas ao cliente (sem dados internos)
  // Ordem: DATA | Nº | EQUIPAMENTO/PLACA | CLIENTE/SERVIÇO | HORAS | KM | VALOR
  const COLS = [
    { label: 'DATA',             width: 20,   align: 'center', get: l => fmtD(l.data) },
    ...(hasCampo('numero_diario') || hasCampo('numero_rdo')
      ? [{ label: 'Nº',         width: 16,   align: 'center', get: l => l.dados_extras?.numero_diario || l.dados_extras?.numero_rdo || '—' }]
      : []),
    ...(hasCampo('placa') || hasCampo('equipamento') || hasCampo('modelo_equipamento')
      ? [{ label: 'EQUIPAMENTO', width: 28,   align: 'center', get: l => l.dados_extras?.placa || l.dados_extras?.equipamento || l.dados_extras?.modelo_equipamento || '—' }]
      : []),
    { label: 'DESCRICAO / SERVICO', width: null, align: 'left', get: l => (l.dados_extras?.cliente || l.dados_extras?.empresa || l.descricao || '—') },
    ...(hasCampo('local_origem') || hasCampo('frente') || hasCampo('local_servico')
      ? [{ label: 'LOCAL',       width: 32,   align: 'left',   get: l => l.dados_extras?.local_origem || l.dados_extras?.frente || l.dados_extras?.local_servico || '—' }]
      : []),
    ...(hasHoras
      ? [{ label: 'HORAS',       width: 20,   align: 'center', get: l => fmtHoras(calcHoras(l.dados_extras)) }]
      : []),
    ...(hasKm
      ? [{ label: 'KM',          width: 20,   align: 'right',  get: l => { const k = calcKmTotal(l.dados_extras); return k > 0 ? k.toLocaleString('pt-BR') : '—' } }]
      : []),
    { label: 'VALOR',            width: 26,   align: 'right',  get: l => fmtC(l.valor) },
  ]
  // Calcula largura da coluna flex
  const fixedW = COLS.reduce((s, c) => s + (c.width || 0), 0)
  const flexW  = Math.max((PW - 28) - fixedW, 30)
  COLS.forEach(c => { if (!c.width) c.width = flexW })

  const colStyles = {}
  COLS.forEach((c, i) => { colStyles[i] = { cellWidth: c.width, halign: c.align } })

  const rows = lancamentos
    .sort((a, b) => (a.data || '') < (b.data || '') ? -1 : 1)
    .map(l => COLS.map(c => c.get(l)))

  // Linha de total
  const totalRow = COLS.map((_, i) => {
    if (i === 0) return { content: 'TOTAL', styles: { fontStyle: 'bold', halign: 'left', fillColor: NAVY, textColor: WHITE } }
    if (i === COLS.length - 1) return { content: fmtC(totalValor), styles: { fontStyle: 'bold', halign: 'right', fillColor: NAVY, textColor: [134, 255, 180] } }
    return { content: '', styles: { fillColor: NAVY, textColor: WHITE } }
  })

  autoTable(doc, {
    head: [COLS.map(c => c.label)],
    body: [...rows, totalRow],
    startY: y,
    margin: { left: L, right: 14 },
    styles: { fontSize: 7.5, cellPadding: { top: 3.5, right: 3, bottom: 3.5, left: 3 }, textColor: [23, 32, 51], lineColor: BORDER, lineWidth: 0.2 },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5, halign: 'center', minCellHeight: 10 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: colStyles,
    didDrawPage: (data) => {
      // Rodapé em cada página
      doc.setFillColor(...NAVY)
      doc.rect(0, PH - 14, PW, 14, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...WHITE)
      doc.text(`${emp.nome}  ·  SmartPro Sistema de Gestão  ·  Gerado em ${geradoEm}`, PW / 2, PH - 5, { align: 'center' })
      doc.text(`Pág. ${data.pageNumber}`, R, PH - 5, { align: 'right' })
    },
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ── BLOCO DE DECLARAÇÃO E ASSINATURA ──────────────────────────────────────
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const sigY = doc.lastAutoTable?.finalY || 160
  const needsNewPage = sigY + 70 > PH - 20

  if (needsNewPage) doc.addPage()
  const blockY = needsNewPage ? 20 : sigY + 10

  // Faixa título declaração
  doc.setFillColor(...LIGHT)
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.rect(L, blockY, PW - 28, 10, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...NAVY)
  doc.text('DECLARAÇÃO DE RECEBIMENTO E CONCORDÂNCIA', PW / 2, blockY + 6.5, { align: 'center' })

  // Texto declaração
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  const decl = `Declaro que os serviços relacionados acima foram prestados conforme acordado e que o valor total de ${fmtC(totalValor)} está correto e aprovado para pagamento.`
  const lines = doc.splitTextToSize(decl, PW - 32)
  doc.text(lines, L + 2, blockY + 17)

  const assY = blockY + 17 + (lines.length * 5) + 8

  // ── Assinatura digital (se houver) ─────────────────────────────────────────
  if (assinaturaBase64) {
    try {
      const imgSrc = assinaturaBase64.startsWith('data:') ? assinaturaBase64 : `data:image/png;base64,${assinaturaBase64}`
      // Imagem no lado direito acima da linha
      doc.addImage(imgSrc, 'PNG', PW / 2 + 4, assY - 2, 80, 24)
    } catch (_) {}
  }

  // Linhas de assinatura
  const lineY = assY + (assinaturaBase64 ? 24 : 18)
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.4)

  // Emissora (esquerda)
  doc.line(L, lineY, L + 86, lineY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...NAVY)
  doc.text(emp.nome, L + 43, lineY + 6, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...GRAY)
  doc.text('Responsável pela emissão', L + 43, lineY + 11, { align: 'center' })
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, L + 43, lineY + 16, { align: 'center' })

  // Cliente / pagador (direita)
  doc.line(PW / 2 + 4, lineY, R, lineY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...NAVY)
  doc.text((aprovadorNome || lote.cliente || 'De acordo — Cliente').toUpperCase(), (PW / 2 + 4 + R) / 2, lineY + 6, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...GRAY)
  doc.text(lote.cliente, (PW / 2 + 4 + R) / 2, lineY + 11, { align: 'center' })
  if (aprovadoEm) {
    doc.setTextColor(5, 100, 70)
    doc.setFont('helvetica', 'bold')
    doc.text(`Assinado digitalmente em ${fmtDT(aprovadoEm)}`, (PW / 2 + 4 + R) / 2, lineY + 16, { align: 'center' })
  } else {
    doc.setTextColor(...GRAY)
    doc.text('Data: ___/___/______', (PW / 2 + 4 + R) / 2, lineY + 16, { align: 'center' })
  }

  // Rodapé da última página (forçado)
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFillColor(...NAVY)
    doc.rect(0, PH - 14, PW, 14, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...WHITE)
    doc.text(`${emp.nome}  ·  SmartPro Sistema de Gestão  ·  Gerado em ${geradoEm}`, PW / 2, PH - 5, { align: 'center' })
    doc.text(`Pág. ${i}/${totalPages}`, R, PH - 5, { align: 'right' })
  }

  return doc
}

// ─── Exportar Requisição de Compra (estilo documento oficial) ─────────────────
export async function exportarRequisicaoPDF({ solicitacao, itens = [] }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const total = itens.reduce((s, it) => s + (parseFloat(it.valor_total) || 0), 0)
    || parseFloat(solicitacao.valor_estimado) || 0

  const numReq = solicitacao.numero_requisicao
    ? String(solicitacao.numero_requisicao)
    : solicitacao.id.slice(-5).toUpperCase()

  // ── Logo da empresa ───────────────────────────────────────────────────────
  try {
    const res = await fetch('/casagrande_trasnportes_e_locaes_logo.jpg')
    const blob = await res.blob()
    const logoBase64 = await new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
    doc.addImage(logoBase64, 'JPEG', 14, 8, 52, 22)
  } catch (_) {}

  // ── Endereço e contatos da empresa ────────────────────────────────────────
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80)
  doc.text('BR 262 – Km 14 – Chácara Imperial', 14, 35)
  doc.text('Três Lagoas – MS (Saída p/ Campo Grande)', 14, 39)

  // Contatos centralizados (ícones simulados)
  doc.setFontSize(8)
  doc.text('(67) 9 9965-4128', 75, 20)
  doc.text('financeiro@grupocasagrande.net', 75, 27)

  // ── Caixa "REQUISIÇÃO DE COMPRA" ─────────────────────────────────────────
  const verde = [2, 80, 40]
  doc.setFillColor(...verde)
  doc.rect(132, 8, 64, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('REQUISIÇÃO DE COMPRA', 164, 16, { align: 'center' })

  // Número
  doc.setDrawColor(200)
  doc.setFillColor(250, 250, 250)
  doc.rect(132, 21, 64, 9, 'FD')
  doc.setTextColor(80)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Nº', 135, 27)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...verde)
  doc.text(numReq, 185, 28, { align: 'right' })

  // Data
  doc.setFillColor(245, 245, 245)
  doc.rect(132, 31, 64, 8, 'FD')
  doc.setTextColor(80)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Data', 135, 36)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.text(new Date(solicitacao.created_at).toLocaleDateString('pt-BR'), 185, 36, { align: 'right' })

  // ── Linha separadora ──────────────────────────────────────────────────────
  doc.setDrawColor(200)
  doc.line(14, 44, 196, 44)

  // ── Seção: DADOS DA SOLICITAÇÃO ───────────────────────────────────────────
  let y = 48
  doc.setFillColor(...verde)
  doc.rect(14, y, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text('DADOS DA SOLICITAÇÃO', 20, y + 3.5)

  y += 9
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(120)
  doc.text('Fornecedor', 14, y)
  doc.text('Contato', 82, y)
  doc.text('Telefone', 133, y)
  doc.text('E-mail', 163, y)

  y += 5
  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  const forn  = (solicitacao.fornecedor || '—').slice(0, 35)
  const cont  = (solicitacao.contato_fornecedor || '—').slice(0, 20)
  const tel   = (solicitacao.telefone_fornecedor || solicitacao.requisitante_telefone || '—')
  const email = (solicitacao.email_fornecedor || '—').slice(0, 25)
  doc.text(forn,  14,  y)
  doc.text(cont,  82,  y)
  doc.text(tel,   133, y)
  doc.text(email, 163, y)

  doc.setDrawColor(200)
  doc.line(14, y + 2, 80, y + 2)
  doc.line(82, y + 2, 131, y + 2)
  doc.line(133, y + 2, 161, y + 2)
  doc.line(163, y + 2, 196, y + 2)

  // ── Aviso de pagamento ────────────────────────────────────────────────────
  y += 7
  doc.setFillColor(232, 248, 239)
  doc.setDrawColor(160, 215, 185)
  doc.roundedRect(14, y, 182, 8, 1.5, 1.5, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...verde)
  doc.text('O PAGAMENTO SÓ SERÁ EFETUADO COM APRESENTAÇÃO DESTE DOCUMENTO.', 105, y + 5, { align: 'center' })

  // ── Seção: ITENS SOLICITADOS ──────────────────────────────────────────────
  y += 13
  doc.setFillColor(...verde)
  doc.rect(14, y, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text('ITENS SOLICITADOS', 20, y + 3.5)

  const itensPDF = itens.length > 0
    ? itens.map(it => {
        const q = parseFloat(it.quantidade) || 0
        const vUnit = parseFloat(it.valor_unitario) || 0
        const vTot  = parseFloat(it.valor_total) || q * vUnit
        return [
          q % 1 === 0 ? String(Math.round(q)) : q.toFixed(3),
          it.descricao || '—',
          vUnit > 0 ? vUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—',
          vTot  > 0 ? vTot.toLocaleString('pt-BR',  { minimumFractionDigits: 2 }) : '—',
        ]
      })
    : [[
        solicitacao.quantidade || '1',
        solicitacao.titulo || '—',
        solicitacao.valor_estimado ? parseFloat(solicitacao.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—',
        solicitacao.valor_estimado ? parseFloat(solicitacao.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—',
      ]]

  autoTable(doc, {
    startY: y + 6,
    head: [['QUANT.', 'DISCRIMINAÇÃO', 'P. UNIT. (R$)', 'TOTAL (R$)']],
    body: itensPDF,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: verde, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 110 },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [245, 252, 248] },
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 6

  // ── Seção: OBSERVAÇÕES + TOTAL ────────────────────────────────────────────
  doc.setFillColor(...verde)
  doc.rect(14, y, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text('OBSERVAÇÕES', 20, y + 3.5)

  doc.setDrawColor(200)
  doc.setFillColor(255, 255, 255)
  doc.rect(14, y + 7, 118, 22, 'D')
  if (solicitacao.descricao) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(60)
    const obsLines = doc.splitTextToSize(solicitacao.descricao, 113)
    doc.text(obsLines.slice(0, 3), 16, y + 13)
  }

  // Total (à direita da caixa de obs)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text('TOTAL', 140, y + 14)
  doc.setFontSize(17)
  doc.setTextColor(...verde)
  doc.text(
    `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    196, y + 23, { align: 'right' }
  )

  // ── Assinaturas ───────────────────────────────────────────────────────────
  y += 34
  const solicitanteNome = solicitacao.requisitante_nome || ''

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('SOLICITADO POR', 14, y)
  doc.text('AUTORIZADO POR', 105, y)

  // Linha de nome
  doc.setDrawColor(160)
  doc.line(14, y + 10, 92, y + 10)
  doc.line(105, y + 10, 183, y + 10)

  // Data e linha
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Nome completo', 14, y + 13)
  doc.line(55, y + 10, 92, y + 10)
  doc.text('Data', 57, y + 13)
  doc.text('Nome completo', 105, y + 13)
  doc.line(146, y + 10, 183, y + 10)
  doc.text('Data', 148, y + 13)

  // Linha de assinatura
  doc.setDrawColor(180)
  doc.line(14, y + 20, 92, y + 20)
  doc.line(105, y + 20, 183, y + 20)
  doc.setFontSize(7)
  doc.setTextColor(140)
  doc.text('Assinatura eletrônica', 14, y + 23)
  doc.text('Assinatura eletrônica', 105, y + 23)

  if (solicitanteNome) {
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(solicitanteNome, 14, y + 8)
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────
  doc.setDrawColor(200)
  doc.line(14, y + 27, 196, y + 27)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150)
  doc.text('Documento eletrônico – validade mediante assinatura digital.', 105, y + 31, { align: 'center' })

  doc.save(`requisicao-${numReq}.pdf`)
}
