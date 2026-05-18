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
