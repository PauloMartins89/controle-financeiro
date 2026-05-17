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
  doc.text('Dividi Aí', 14, 12)
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
    doc.text(`Dividi Aí · Gerado em ${now.toLocaleDateString('pt-BR')} · Página ${i}/${pageCount}`, 14, 290)
  }

  doc.save(`balanco-${mesStr}.pdf`)
}
