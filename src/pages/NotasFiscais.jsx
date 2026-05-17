import { useState, useMemo } from 'react'
import useStore from '../store/useStore'
import { formatCurrency } from '../lib/utils'
import { toast } from 'react-hot-toast'

function formatDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const IMG_WIDTH = 56

const COLS = [
  { key: 'data',          label: 'Data',       width: 90 },
  { key: 'hora',          label: 'Hora',       width: 70 },
  { key: 'descricao',     label: 'Descrição',  width: 200 },
  { key: 'valor',         label: 'Valor',      width: 100 },
  { key: 'forma_pagamento', label: 'Pagamento', width: 120 },
  { key: 'cnpj',          label: 'CNPJ',       width: 160 },
  { key: 'produto',       label: 'Produto',    width: 180 },
  { key: 'quantidade',    label: 'Qtd',        width: 100 },
  { key: 'litros',        label: 'Litros',     width: 90 },
  { key: 'valor_litro',   label: 'R$/Litro',   width: 90 },
  { key: 'endereco',      label: 'Endereço',   width: 260 },
  { key: 'telefone_local',label: 'Telefone',   width: 130 },
  { key: 'nfe_url',       label: 'NF-e',       width: 80 },
  { key: 'origem',        label: 'Origem',     width: 90 },
]

const totalWidth = COLS.reduce((s, c) => s + c.width, 0) + IMG_WIDTH

export default function NotasFiscais() {
  const expenses = useStore(s => s.expenses)
  const cards    = useStore(s => s.cards)
  const [search, setSearch]         = useState('')
  const [onlyNF, setOnlyNF]         = useState(false)
  const [filtroOrigem, setFiltroOrigem] = useState('todos')
  const [selected, setSelected]     = useState(new Set())

  // Determina a origem de cada despesa
  function getOrigem(exp) {
    if (exp.card_id) return 'cartao'
    if ((exp.origem || '').toLowerCase() === 'whatsapp') return 'whatsapp'
    return 'manual'
  }

  function getOrigemLabel(o) {
    if (o === 'cartao')   return '💳 Cartão'
    if (o === 'whatsapp') return '📱 WhatsApp'
    return '✏️ Manual'
  }

  function getCardNome(cardId) {
    return cards.find(c => c.id === cardId)?.nome || cardId
  }

  const rows = useMemo(() => {
    let list = [...expenses].sort((a, b) => (b.data || '').localeCompare(a.data || ''))
    if (onlyNF) {
      list = list.filter(e => e.cnpj || e.produto || e.nfe_url || e.forma_pagamento || e.litros)
    }
    if (filtroOrigem !== 'todos') {
      list = list.filter(e => getOrigem(e) === filtroOrigem)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        (e.descricao || '').toLowerCase().includes(q) ||
        (e.cnpj || '').toLowerCase().includes(q) ||
        (e.produto || '').toLowerCase().includes(q) ||
        (e.endereco || '').toLowerCase().includes(q) ||
        (e.forma_pagamento || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [expenses, search, onlyNF, filtroOrigem])

  // Seleção
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id))
  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(rows.map(r => r.id)))
  }
  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Export CSV
  function exportCSV() {
    const toExport = rows.filter(r => selected.size === 0 || selected.has(r.id))
    if (toExport.length === 0) return

    const HEADERS = ['Data','Hora','Descrição','Valor','Categoria','Pagamento','CNPJ','Produto','Qtd','Litros','R$/Litro','Endereço','Telefone','NFe URL','Origem','Cartão']
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      HEADERS.join(';'),
      ...toExport.map(e => [
        e.data || '',
        e.hora || '',
        e.descricao || '',
        String(e.valor || 0).replace('.', ','),
        e.categoria || '',
        e.forma_pagamento || '',
        e.cnpj || '',
        e.produto || '',
        e.quantidade || '',
        e.litros || '',
        e.valor_litro || '',
        e.endereco || '',
        e.telefone_local || '',
        e.nfe_url || '',
        getOrigemLabel(getOrigem(e)),
        e.card_id ? getCardNome(e.card_id) : '',
      ].map(esc).join(';'))
    ]

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `notas-fiscais-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${toExport.length} registros exportados`)
  }

  // Export PDF — abre nova aba com HTML estilizado e dispara print
  function exportPDF() {
    const toExport = rows.filter(r => selected.size === 0 || selected.has(r.id))
    if (toExport.length === 0) return

    const origemFiltroLabel = ORIGEM_FILTERS.find(f => f.key === filtroOrigem)?.label || 'Todos'
    const dataHoje = new Date().toLocaleDateString('pt-BR')

    // Colunas para a tabela (sem nfe_url — vira link separado)
    const TABLE_COLS = [
      { key: 'data',            label: 'Data' },
      { key: 'hora',            label: 'Hora' },
      { key: 'descricao',       label: 'Descrição' },
      { key: 'valor',           label: 'Valor' },
      { key: 'categoria',       label: 'Categoria' },
      { key: 'forma_pagamento', label: 'Pagamento' },
      { key: 'cnpj',            label: 'CNPJ' },
      { key: 'produto',         label: 'Produto' },
      { key: 'litros',          label: 'Litros' },
      { key: 'valor_litro',     label: 'R$/Litro' },
      { key: 'endereco',        label: 'Endereço' },
      { key: 'origem',          label: 'Origem' },
    ]

    function cellText(exp, key) {
      const v = exp[key]
      if (key === 'data')        return formatDate(v)
      if (key === 'valor')       return `R$ ${Number(exp.valor || 0).toFixed(2).replace('.', ',')}`
      if (key === 'litros')      return v != null ? Number(v).toFixed(3) : '—'
      if (key === 'valor_litro') return v != null ? `R$ ${Number(v).toFixed(3)}` : '—'
      if (key === 'origem') {
        const o = getOrigem(exp)
        if (o === 'cartao')   return 'Cartão'
        if (o === 'whatsapp') return 'WhatsApp'
        return 'Manual'
      }
      return v || '—'
    }

    const tableRows = toExport.map((exp, i) => {
      const cells = TABLE_COLS.map(c => `<td>${cellText(exp, c.key)}</td>`).join('')
      const bg = i % 2 === 0 ? '#ffffff' : '#f8f9fa'
      return `<tr style="background:${bg}">${cells}</tr>`
    }).join('')

    // Imagens 3 por linha, 6 por página (2 linhas de 3)
    const comImagem = toExport.filter(e => e.comprovante_url)
    const imgGroups = [] // grupos de 6
    for (let i = 0; i < comImagem.length; i += 6) {
      imgGroups.push(comImagem.slice(i, i + 6))
    }
    const imgSection = comImagem.length === 0 ? '' : `
      <div class="page-break"></div>
      <h2 style="font-size:15px;margin:0 0 12px;color:#1e293b;">🖼 Comprovantes (${comImagem.length})</h2>
      ${imgGroups.map((group, gi) => `
        ${gi > 0 ? '<div class="page-break"></div>' : ''}
        <div class="img-grid">
          ${group.map(exp => `
            <div class="img-card">
              <div class="img-label">
                <strong>${exp.descricao || '—'}</strong><br>
                <span>${formatDate(exp.data)}${exp.hora ? ' · ' + exp.hora : ''}</span>
                <span style="float:right;font-weight:700;color:#1e293b">R$ ${Number(exp.valor || 0).toFixed(2).replace('.',',')}</span>
              </div>
              <img src="${exp.comprovante_url}" alt="comprovante" onerror="this.style.display='none'" />
            </div>
          `).join('')}
        </div>
      `).join('')}
    `

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Notas Fiscais — ${dataHoje}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #334155; background: #fff; padding: 16px 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
    .header h1 { font-size: 17px; color: #1e293b; }
    .header .meta { font-size: 10px; color: #64748b; margin-top: 3px; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 9px; font-weight: 700; }
    .badge-manual   { background: #fef3c7; color: #92400e; }
    .badge-cartao   { background: #ede9fe; color: #5b21b6; }
    .badge-whatsapp { background: #dcfce7; color: #166534; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9px; }
    thead th { background: #6366f1; color: #fff; padding: 5px 6px; text-align: left; font-weight: 700; font-size: 9px; white-space: nowrap; }
    tbody td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; word-break: break-word; }
    .img-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .img-card { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; }
    .img-label { padding: 5px 8px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 9px; color: #475569; flex-shrink: 0; }
    .img-card img { width: 100%; height: 160px; object-fit: contain; display: block; background: #f8fafc; flex: 1; }
    .page-break { page-break-before: always; padding-top: 12px; }
    .total-row { font-weight: 700; background: #f1f5f9 !important; border-top: 2px solid #6366f1; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
      thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #6366f1 !important; color: #fff !important; }
      .badge-manual   { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fef3c7 !important; }
      .badge-cartao   { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #ede9fe !important; }
      .badge-whatsapp { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #dcfce7 !important; }
      .img-grid { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📄 Notas Fiscais</h1>
      <div class="meta">
        Filtro: <strong>${origemFiltroLabel}</strong> &nbsp;·&nbsp;
        ${toExport.length} registros &nbsp;·&nbsp;
        Gerado em ${dataHoje}
        ${search ? ` &nbsp;·&nbsp; Busca: "${search}"` : ''}
      </div>
    </div>
    <button class="no-print" onclick="window.print()" style="padding:8px 18px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;">🖨 Imprimir / Salvar PDF</button>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        ${TABLE_COLS.map(c => `<th>${c.label}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${toExport.map((exp, i) => {
        const origem = getOrigem(exp)
        const badgeClass = `badge badge-${origem}`
        const cells = TABLE_COLS.map(c => {
          if (c.key === 'origem') {
            const label = origem === 'cartao' ? 'Cartão' : origem === 'whatsapp' ? 'WhatsApp' : 'Manual'
            return `<td><span class="${badgeClass}">${label}</span></td>`
          }
          return `<td>${cellText(exp, c.key)}</td>`
        }).join('')
        const bg = i % 2 === 0 ? '#ffffff' : '#f8f9fa'
        return `<tr style="background:${bg}"><td style="color:#94a3b8;text-align:center">${i+1}</td>${cells}</tr>`
      }).join('')}
      <tr class="total-row">
        <td colspan="${TABLE_COLS.length}" style="text-align:right;padding-right:12px">Total</td>
        <td style="color:#1e293b">R$ ${toExport.reduce((s,e) => s + (parseFloat(e.valor) || 0), 0).toFixed(2).replace('.',',')}</td>
      </tr>
    </tbody>
  </table>

  ${imgSection}

  <script>
    window.onload = function() {
      // Auto-print após carregar imagens
      const imgs = document.querySelectorAll('img')
      if (imgs.length === 0) { setTimeout(() => window.print(), 300); return; }
      let loaded = 0
      imgs.forEach(img => {
        if (img.complete) { loaded++; if (loaded === imgs.length) setTimeout(() => window.print(), 300); }
        else { img.onload = img.onerror = () => { loaded++; if (loaded === imgs.length) setTimeout(() => window.print(), 300) } }
      })
    }
  </script>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
  }

  const ORIGEM_FILTERS = [
    { key: 'todos',    label: 'Todos' },
    { key: 'manual',   label: '✏️ Manual' },
    { key: 'cartao',   label: '💳 Cartão' },
    { key: 'whatsapp', label: '📱 WhatsApp' },
  ]

  // Contagens por origem
  const counts = useMemo(() => {
    const c = { todos: expenses.length, manual: 0, cartao: 0, whatsapp: 0 }
    expenses.forEach(e => { c[getOrigem(e)]++ })
    return c
  }, [expenses])

  const selectedCount = selected.size > 0
    ? rows.filter(r => selected.has(r.id)).length
    : rows.length

  function cellValue(exp, key) {
    const v = exp[key]
    if (key === 'data') return formatDate(v)
    if (key === 'valor') return formatCurrency(exp.valor)
    if (key === 'litros') return v != null ? Number(v).toFixed(3) : null
    if (key === 'valor_litro') return v != null ? `R$ ${Number(v).toFixed(3)}` : null
    if (key === 'nfe_url') {
      return v
        ? <a href={v} target="_blank" rel="noopener noreferrer"
            style={{ color: '#818cf8', textDecoration: 'underline', fontFamily: 'monospace', fontSize: 11 }}>
            Ver NF-e
          </a>
        : null
    }
    return v || null
  }

  return (
    <div style={{ padding: '24px 28px', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📄 Notas Fiscais</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {rows.length} {rows.length === 1 ? 'registro' : 'registros'}
            {selected.size > 0 && <span style={{ color: '#6366f1', fontWeight: 700 }}> · {selected.size} selecionados</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '7px 12px', color: 'var(--text-primary)',
              fontSize: 13, width: 200, outline: 'none'
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={onlyNF} onChange={e => setOnlyNF(e.target.checked)}
              style={{ accentColor: '#818cf8', width: 15, height: 15 }} />
            Apenas com NF
          </label>
          <button
            onClick={exportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              background: selected.size > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
              border: selected.size > 0 ? '1px solid #6366f1' : '1px solid var(--border)',
              color: selected.size > 0 ? '#818cf8' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            ⬇ CSV {selected.size > 0 ? `(${selected.size})` : `(${rows.length})`}
          </button>
          <button
            onClick={exportPDF}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              background: selected.size > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
              border: selected.size > 0 ? '1px solid #ef4444' : '1px solid var(--border)',
              color: selected.size > 0 ? '#f87171' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            🖨 PDF {selected.size > 0 ? `(${selected.size})` : `(${rows.length})`}
          </button>
        </div>
      </div>

      {/* Filtros de origem */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ORIGEM_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setFiltroOrigem(f.key); setSelected(new Set()) }}
            style={{
              padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: filtroOrigem === f.key ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
              border: filtroOrigem === f.key ? '1px solid #6366f1' : '1px solid var(--border)',
              color: filtroOrigem === f.key ? '#818cf8' : 'var(--text-secondary)',
            }}
          >
            {f.label}
            <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table style={{ width: totalWidth + 40, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            {/* Head */}
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0, zIndex: 2 }}>
                {/* Checkbox */}
                <th style={{ width: 40, minWidth: 40, padding: '10px 8px', textAlign: 'center', borderBottom: '1px solid var(--border)', borderRight: '1px solid rgba(255,255,255,0.04)', background: 'var(--bg-secondary)' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: '#6366f1', width: 14, height: 14, cursor: 'pointer' }} />
                </th>
                <th style={{
                  width: IMG_WIDTH, minWidth: IMG_WIDTH,
                  padding: '10px 8px', textAlign: 'center',
                  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--border)',
                  borderRight: '1px solid rgba(255,255,255,0.04)',
                  background: 'var(--bg-secondary)',
                }}>IMG</th>
                {COLS.map(col => (
                  <th key={col.key} style={{
                    width: col.width, minWidth: col.width,
                    padding: '10px 12px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)',
                    borderRight: '1px solid rgba(255,255,255,0.04)',
                    whiteSpace: 'nowrap', background: 'var(--bg-secondary)',
                  }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length + 2} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : rows.map((exp, i) => {
                const isSel = selected.has(exp.id)
                const origem = getOrigem(exp)
                return (
                  <tr key={exp.id} style={{
                    borderBottom: '1px solid var(--border)',
                    background: isSel
                      ? 'rgba(99,102,241,0.08)'
                      : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    outline: isSel ? '1px solid rgba(99,102,241,0.3)' : 'none',
                  }}>
                    {/* Checkbox */}
                    <td style={{ width: 40, padding: '6px 8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'middle' }}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleOne(exp.id)}
                        style={{ accentColor: '#6366f1', width: 14, height: 14, cursor: 'pointer' }} />
                    </td>
                    {/* Imagem comprovante */}
                    <td style={{
                      width: IMG_WIDTH, minWidth: IMG_WIDTH,
                      padding: '6px 8px', textAlign: 'center',
                      borderRight: '1px solid rgba(255,255,255,0.04)',
                      verticalAlign: 'middle',
                    }}>
                      {exp.comprovante_url
                        ? <a href={exp.comprovante_url} target="_blank" rel="noopener noreferrer">
                            <img src={exp.comprovante_url} alt="comprovante"
                              style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 6, display: 'block', margin: '0 auto', border: '1px solid rgba(255,255,255,0.1)' }} />
                          </a>
                        : <span style={{ fontSize: 18, opacity: 0.2 }}>🖼</span>
                      }
                    </td>
                    {COLS.map(col => {
                      let v = cellValue(exp, col.key)
                      // Sobrescrever coluna origem com badge colorido
                      if (col.key === 'origem') {
                        const badge = {
                          cartao:   { bg: 'rgba(99,102,241,0.15)', color: '#818cf8', label: '💳 Cartão' },
                          whatsapp: { bg: 'rgba(34,197,94,0.15)',  color: '#4ade80', label: '📱 WhatsApp' },
                          manual:   { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', label: '✏️ Manual' },
                        }[origem]
                        v = <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{badge.label}</span>
                      }
                      const isEmpty = col.key !== 'origem' && (v === null || v === undefined || v === '')
                      return (
                        <td key={col.key} style={{
                          width: col.width, minWidth: col.width,
                          padding: '10px 12px',
                          fontSize: 12, fontFamily: col.key === 'origem' ? 'inherit' : 'monospace',
                          color: isEmpty ? 'var(--text-secondary)' : 'var(--text-primary)',
                          opacity: isEmpty ? 0.35 : 1,
                          borderRight: '1px solid rgba(255,255,255,0.04)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          verticalAlign: 'middle',
                        }}>
                          {isEmpty ? 'null' : v}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
