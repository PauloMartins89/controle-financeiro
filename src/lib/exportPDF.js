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
export function buildLotePDFDoc({ lancamentos = [], lote, link }) {
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
  if (lastY + 80 < PH - 40) {
    doc.setDrawColor(...VERDE_MEDIO); doc.setLineWidth(0.5)
    doc.line(28, lastY + 40, 200, lastY + 40)
    doc.line(PW - 28, lastY + 40, PW - 200, lastY + 40)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...CINZA_TEXTO)
    doc.text('Responsável pela emissão', 28, lastY + 52)
    doc.text('De acordo — Cliente', PW - 28, lastY + 52, { align: 'right' })
    doc.setFontSize(6.5); doc.setTextColor(130, 150, 140)
    doc.text('Data: ___/___/______', 28, lastY + 64)
    doc.text('Data: ___/___/______', PW - 28, lastY + 64, { align: 'right' })
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
