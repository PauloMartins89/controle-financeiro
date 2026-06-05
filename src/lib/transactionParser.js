import * as XLSX from 'xlsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// Parses a Brazilian date string: dd/mm/yyyy, yyyy-mm-dd, dd-mm-yyyy, yyyymmdd
function parseDate(str) {
  if (!str) return null
  str = String(str).trim().toLowerCase()
  // yyyymmdd (OFX)
  if (/^\d{8}/.test(str)) {
    const s = str.slice(0, 8)
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  // DD/mmm — Portuguese abbreviated month (Sicredi, Nubank, C6): 08/mar, 27/fev
  // Also handles "08/ mar" (PDF.js adds space after /)
  str = str.replace(/\/\s+/g, '/')  // normalize "08/ mar" → "08/mar"
  const ptMonths = { jan:'01', fev:'02', mar:'03', abr:'04', mai:'05', jun:'06', jul:'07', ago:'08', set:'09', out:'10', nov:'11', dez:'12' }
  const mPt = str.match(/^(\d{1,2})\/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:\/(\d{2,4}))?/)
  if (mPt) {
    const [, d, mon, y] = mPt
    const year = y ? (y.length === 2 ? `20${y}` : y) : new Date().getFullYear()
    return `${year}-${ptMonths[mon]}-${d.padStart(2, '0')}`
  }
  // dd/mm/yyyy or dd/mm/yy
  const m1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (m1) {
    const [, d, mo, y] = m1
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // yyyy-mm-dd (already ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10)
  return null
}

// Parses a Brazilian currency string: "1.234,56" or "1234.56" or "-125,50"
function parseAmount(str) {
  return Math.abs(parseSignedAmount(str))
}

// Returns the SIGNED numeric value (preserves negative sign for credits/payments)
// Suporta dois formatos:
//   - pt-BR: "1.234,56"  → ponto = milhar, vírgula = decimal
//   - en-US: "1234.56"   → ponto = decimal (sem vírgula)
function parseSignedAmount(str) {
  if (str === null || str === undefined) return 0
  if (typeof str === 'number') return str
  let s = String(str).trim().replace(/[R$\s]/g, '')
  if (!s) return 0
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma) {
    // pt-BR: remove pontos (milhar) e troca vírgula por ponto
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasDot) {
    // en-US: ponto pode ser decimal OU milhar.
    // Heurística: se houver mais de um ponto OU o último grupo após o
    // ponto tiver exatamente 3 dígitos, é separador de milhar.
    const parts = s.split('.')
    const last = parts[parts.length - 1]
    if (parts.length > 2 || (parts.length === 2 && last.length === 3 && /^\d+$/.test(last))) {
      s = parts.join('') // remove todos os pontos (milhar)
    }
    // caso contrário deixa como está (ponto = decimal)
  }
  const val = parseFloat(s)
  return isNaN(val) ? 0 : val
}

// Descrições que NUNCA são despesas reais (pagamentos, estornos, ajustes
// de fatura/rotativo). Aplicado em todos os parsers (CSV/OFX/PDF).
const NON_EXPENSE_PATTERNS = [
  /pagamento\s+recebido/i,
  /pagamento\s+de\s+fatura/i,
  /valor\s+pendente\s+do\s+m[eê]s/i,
  /estorno/i,
  /reembolso/i,
  /cr[eé]dito\s+de\s+atraso/i,
  /^iof\s+de\s+pagamento/i,
  /^juros\s+de\s+pagamento/i,
  /ajuste\s+de\s+(saldo|fatura)/i,
  /devolu[cç][aã]o/i,
  /saldo\s+anterior/i,
]

function isNonExpense(desc) {
  if (!desc) return false
  return NON_EXPENSE_PATTERNS.some(re => re.test(desc))
}

// Detect separator for CSV
function detectSeparator(line) {
  const counts = { ',': 0, ';': 0, '\t': 0 }
  for (const ch of line) if (counts[ch] !== undefined) counts[ch]++
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) throw new Error('CSV parece vazio ou inválido')

  const sep = detectSeparator(lines[0])
  const rows = lines.map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '').trim()))

  const header = rows[0].map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))

  // Column detection by common header names
  function findCol(...names) {
    for (const n of names) {
      const i = header.findIndex(h => h.includes(n))
      if (i >= 0) return i
    }
    return -1
  }

  const colData = findCol('data', 'date', 'dt ', 'dt_')
  const colDesc = findCol('descricao', 'descri', 'titulo', 'title', 'memo', 'historico', 'lancamento', 'detalhe', 'nome')
  const colValor = findCol('valor', 'value', 'amount', 'montante', 'debito', 'credito', 'vlr')
  const colParcela = findCol('parcela', 'installment', 'parc')
  const colConta = findCol('conta', 'cartao', 'account', 'card')

  if (colDesc < 0 || colValor < 0) {
    // Fallback: guess from first 3 numeric-ish columns
    // Try positional: date, description, amount
  }

  return rows.slice(1)
    .filter(r => r.length > 1)
    .map((r, i) => {
      const rawValor = r[colValor] || ''
      const signed = parseSignedAmount(rawValor)
      // Pula créditos/pagamentos (valores negativos = entrada de dinheiro/quitação)
      if (signed <= 0) return null
      const desc = colDesc >= 0 ? r[colDesc] : r.join(' ')
      // Pula linhas que sabidamente não são despesas (pagamento recebido,
      // valor pendente, IOF/juros de rotativo, estorno, etc.)
      if (isNonExpense(desc)) return null
      const valor = signed
      if (valor === 0) return null
      return {
        id: `imp_${Date.now()}_${i}`,
        data: parseDate(colData >= 0 ? r[colData] : null) || new Date().toISOString().slice(0, 10),
        descricao: desc,
        valor,
        conta: colConta >= 0 ? r[colConta] : '',
        parcela: colParcela >= 0 ? r[colParcela] : '',
        tipo: 'debito',
      }
    })
    .filter(Boolean)
}

// ─── OFX / QFX Parser ────────────────────────────────────────────────────────
function parseOfx(text) {
  const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>|<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>)/gi
  const getTag = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}>([^<\n\r]+)`, 'i'))
    return m ? m[1].trim() : ''
  }

  // Try new-style XML first
  let matches = [...text.matchAll(txRegex)]

  // Also try SGML flat style (no closing tags)
  if (matches.length === 0) {
    const flatRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi
    matches = [...text.matchAll(flatRegex)]
  }

  return matches.map((m, i) => {
    const block = m[1] || m[2] || ''
    const dtPosted = getTag(block, 'DTPOSTED')
    const trnAmt = getTag(block, 'TRNAMT')
    const memo = getTag(block, 'MEMO') || getTag(block, 'NAME')
    const fitid = getTag(block, 'FITID')
    const signed = parseSignedAmount(trnAmt)
    if (signed <= 0 || !memo) return null  // pula créditos/pagamentos
    if (isNonExpense(memo)) return null    // pula linhas não-despesa
    return {
      id: `imp_ofx_${fitid || i}`,
      data: parseDate(dtPosted) || new Date().toISOString().slice(0, 10),
      descricao: memo,
      valor: signed,
      conta: '',
      parcela: '',
      tipo: 'debito',
    }
  }).filter(Boolean)
}

// ─── XLSX / XLS Parser ────────────────────────────────────────────────────────
function parseXlsx(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const wsName = wb.SheetNames[0]
  const ws = wb.Sheets[wsName]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })

  if (rows.length < 2) throw new Error('Planilha parece vazia')

  const header = rows[0].map(h => String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))

  function findCol(...names) {
    for (const n of names) {
      const i = header.findIndex(h => h.includes(n))
      if (i >= 0) return i
    }
    return -1
  }

  const colData = findCol('data', 'date', 'dt')
  const colDesc = findCol('descricao', 'descri', 'titulo', 'title', 'memo', 'historico', 'lancamento')
  const colValor = findCol('valor', 'value', 'amount', 'montante', 'debito', 'vlr')
  const colParcela = findCol('parcela', 'installment', 'parc')
  const colConta = findCol('conta', 'cartao', 'account')

  return rows.slice(1)
    .filter(r => r.length > 1)
    .map((r, i) => {
      const signed = parseSignedAmount(colValor >= 0 ? r[colValor] : null)
      if (signed <= 0) return null  // pula créditos/pagamentos
      const desc = String(colDesc >= 0 ? r[colDesc] : '').trim()
      if (isNonExpense(desc)) return null
      return {
        id: `imp_xl_${Date.now()}_${i}`,
        data: parseDate(colData >= 0 ? r[colData] : null) || new Date().toISOString().slice(0, 10),
        descricao: desc,
        valor: signed,
        conta: colConta >= 0 ? String(r[colConta] || '') : '',
        parcela: colParcela >= 0 ? String(r[colParcela] || '') : '',
        tipo: 'debito',
      }
    })
    .filter(Boolean)
}

// ─── PDF Parser ──────────────────────────────────────────────────────────────
// Loads PDF.js via <script> tag (UMD build) — avoids ESM import issues
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib)

  return new Promise((resolve, reject) => {
    const VERSION = '3.11.174'
    const base = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${VERSION}`
    const script = document.createElement('script')
    script.src = `${base}/pdf.min.js`
    script.onload = () => {
      if (!window.pdfjsLib) return reject(new Error('PDF.js carregou mas pdfjsLib não foi encontrado.'))
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.js`
      resolve(window.pdfjsLib)
    }
    script.onerror = () => reject(new Error(
      'Não foi possível carregar o leitor de PDF. Verifique sua conexão com a internet ou exporte o extrato como CSV/OFX.'
    ))
    document.head.appendChild(script)
  })
}

// Extract lines from a PDF, grouping text items by Y position per page
async function extractPdfLines(pdfJs, buffer) {
  const pdf = await pdfJs.getDocument({
    data: buffer,
    verbosity: 0,             // suppress PDF.js console warnings
  }).promise
  const allLines = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)

    // Wrap in a 6-second timeout — image-heavy pages can hang the worker
    let content
    try {
      content = await Promise.race([
        page.getTextContent({ includeMarkedContent: false }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('page_timeout')), 6000)
        ),
      ])
    } catch {
      // Page timed out (likely image-only) — skip it and free resources
      page.cleanup()
      continue
    }

    page.cleanup() // release image/canvas memory after text extraction

    // Group items into lines by Y coordinate (3pt tolerance)
    const lineMap = new Map()
    for (const item of content.items) {
      if (!item.str) continue // skip non-text items (images, marks)
      const y = Math.round(item.transform[5] / 3) * 3
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y).push({ x: item.transform[4], str: item.str })
    }

    // Sort lines top→bottom, items left→right
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      const items = lineMap.get(y).sort((a, b) => a.x - b.x)
      const line = items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim()
      if (line) allLines.push(line)
    }
  }

  // DEBUG: log extracted lines so we can inspect what the PDF actually contains
  if (allLines.length > 0 && allLines.length < 2000) {
    console.groupCollapsed(`[PDF Debug] ${allLines.length} linhas extraídas`)
    allLines.forEach((l, i) => console.log(`${String(i).padStart(3,'0')}: ${JSON.stringify(l)}`))
    console.groupEnd()
  }

  return allLines
}

// ── Sem Parar — consolidação por veículo ────────────────────────────────────
// Detecta fatura Sem Parar e gera UMA transação por placa (Plano + Usos somados),
// ao invés de uma transação por passagem. Retorna null se não for Sem Parar.
function parseSemPararPorVeiculo(lines) {
  // Detectar fatura Sem Parar: scan inteiro por marcadores fortes
  const blob = lines.join(' ').toLowerCase()
  const isSemParar = /sem\s*parar/.test(blob) && /(plano contratado|usos no per.odo|n.{0,2} da fatura)/i.test(blob)
  if (!isSemParar) return null

  const rePlate = /^([A-Z]{3}\d[A-Z0-9]\d{2})\b/
  const reAmount = /R\$\s*((?:\d{1,3}\.)*\d{1,3},\d{2})\s*$/
  const reDateMatch = /(\d{2}\/\d{2}\/\d{2,4})/
  const reLineStartDate = /^\d{2}\/\d{2}\/\d{2,4}\s/
  const reTimeDetail = /^.{0,3}s\s+\d{2}:\d{2}:\d{2}/i
  const reDateRange = /^\d{2}\/\d{2}\/\d{2,4}\s+a\s+\d{2}\/\d{2}/i
  // Sinal de fim do detalhamento (resumo da NF / encerramento)
  const reEndDetail = /^(valores\s+tribut|total\s+da\s+nota|autoriza..o de regime especial|canais de contato)/i

  // Por placa: { total, count, plano, ultimaData }
  const veiculos = new Map()
  let currentPlate = null
  let lastDate = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (reTimeDetail.test(line)) continue
    if (reDateRange.test(line)) continue
    // Para de processar quando chegar no resumo da NF / disclaimers
    if (reEndDetail.test(line)) break

    // Linha começa com placa? Atualiza placa corrente
    const mPlate = line.match(rePlate)
    const startsWithDate = reLineStartDate.test(line)
    if (mPlate) {
      currentPlate = mPlate[1]
      if (!veiculos.has(currentPlate)) {
        veiculos.set(currentPlate, { plate: currentPlate, total: 0, passagens: 0, plano: 0, ultimaData: null })
      }
    } else if (!startsWithDate) {
      // Linha não começa com placa nem data → não é detalhe; ignorar
      continue
    }

    // Tem valor R$ ao final?
    const mAmt = line.match(reAmount)
    if (!mAmt || !currentPlate) continue
    const valor = parseAmount(mAmt[1])
    if (!(valor > 0 && valor < 500000)) continue

    const v = veiculos.get(currentPlate)
    const isPlano = /plano contratado/i.test(line)
    if (isPlano) {
      v.plano += valor
    } else {
      v.passagens += 1
    }
    v.total += valor

    const mDate = line.match(reDateMatch)
    if (mDate) {
      const d = parseDate(mDate[1])
      if (d) v.ultimaData = d
      lastDate = v.ultimaData || lastDate
    }
  }

  if (veiculos.size === 0) return null

  const today = new Date().toISOString().slice(0, 10)
  const out = []
  let idx = 0
  for (const v of veiculos.values()) {
    if (v.total <= 0) continue
    const partes = []
    if (v.plano > 0) partes.push('Plano')
    if (v.passagens > 0) partes.push(`${v.passagens} passage${v.passagens > 1 ? 'ns' : 'm'}`)
    const desc = `Sem Parar — ${v.plate}${partes.length ? ' (' + partes.join(' + ') + ')' : ''}`
    out.push({
      id: `imp_sp_${Date.now()}_${idx++}`,
      data: v.ultimaData || lastDate || today,
      descricao: desc,
      valor: Math.round(v.total * 100) / 100,
      conta: 'Sem Parar',
      parcela: '',
      tipo: 'debito',
      _veiculo: v.plate,
    })
  }
  return out.length ? out : null
}

// ── Nubank Fatura — state-machine parser ─────────────────────────────────────
function parseNubankFatura(lines) {
  const blob = lines.join(' ')
  // Detectar fatura Nubank: "FATURA DD MON YYYY" + pelo menos um numero de cartao mascarado
  const hasFatura = /fatura\s+\d{2}\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+\d{4}/i.test(blob)
  const hasCard   = /[^\w\s]{2,}\s*\d{4}/.test(blob)
  console.log('[NuFatura] hasFatura:', hasFatura, '| hasCard:', hasCard, '| linhas:', lines.length)
  if (!hasFatura) return null
  if (!hasCard) {
    // Mostrar trecho do blob para diagnóstico
    console.log('[NuFatura] blob (primeiros 500 chars):', blob.slice(0, 500))
    return null
  }

  const ptM = { jan:'01',fev:'02',mar:'03',abr:'04',mai:'05',jun:'06',jul:'07',ago:'08',set:'09',out:'10',nov:'11',dez:'12' }
  const pa = s => parseFloat(s.replace(/\./g,'').replace(',','.'))

  let year = new Date().getFullYear()
  const myr = blob.match(/fatura\s+\d{2}\s+\w+\s+(\d{4})/i)
  if (myr) year = parseInt(myr[1])

  const reDate    = /^(\d{2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/i
  // Cartão mascarado: qualquer não-alfanumérico repetido seguido de 4 dígitos
  const reCard    = /[^\w\s]{2,}\s*(\d{4})/
  const reAmtEnd  = /R\$\s*((?:\d{1,3}\.)*\d{1,3},\d{2})\s*$/i
  const reAmtOnly = /^R\$\s*((?:\d{1,3}\.)*\d{1,3},\d{2})\s*$/i
  const reSkip    = /^(DE\s+\d|CAMILA|FATURA\s|EMISS|RESUMO|PROX|LIMITE|IOF\s+de|IOF\s*"|Recarga\s+de|Convers|USD\s|Encargo|Saldo|Nu\s+Pagamento|CNPJ|SAC\s|Ouvidoria|Juros|Pagamento\s+m|Parcelamento|Composi|Nunca|Lembre|Valor\s+m)/i

  const txns = []
  let pDia=null, pMes=null, pCard=null, pDesc=null, pValor=null

  function flush() {
    if (pDia && pMes && pValor > 0 && pValor < 500000 && (pDesc || pCard)) {
      txns.push({
        id: `imp_nuf_${Date.now()}_${txns.length}`,
        data: `${year}-${ptM[pMes.toLowerCase()]}-${pDia.padStart(2,'0')}`,
        descricao: pDesc || (pCard ? `Nubank •••• ${pCard}` : 'Nubank'),
        valor: pValor,
        conta: pCard ? `Nubank •••• ${pCard}` : 'Nubank',
        cartao_digitos: pCard || '',
        parcela: '',
        tipo: 'debito',
      })
    }
    pDia=null; pMes=null; pCard=null; pDesc=null; pValor=null
  }

  function processText(text) {
    if (!text) return
    const mCard = text.match(reCard)
    if (mCard && !pCard) {
      pCard = mCard[1]
      const idx = text.indexOf(mCard[0])
      text = (text.slice(0, idx) + text.slice(idx + mCard[0].length)).replace(/\s+/g,' ').trim()
    }
    const mAmt = text.match(reAmtEnd)
    if (mAmt) {
      if (!pValor) pValor = pa(mAmt[1])
      text = text.slice(0, text.lastIndexOf(mAmt[0])).trim()
    }
    // Aceitar descrição mesmo sem cartão detectado (alguns lançamentos não têm nº visível)
    if (text && !pDesc && pDia) pDesc = text
  }

  // Processa todas as linhas sem exigir seção específica
  // (a detecção de fatura Nubank já garante que é o documento certo)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (reSkip.test(line)) continue

    if (reAmtOnly.test(line)) {
      const mA = line.match(reAmtOnly)
      if (!pValor && pDia) pValor = pa(mA[1])
      continue
    }

    const mDate = line.match(reDate)
    if (mDate) {
      // Só emite se a linha de data NÃO contiver ano (para não capturar "10 JUN 2026" dos cabeçalhos)
      const rest = line.slice(mDate[0].length).trim()
      if (/^\d{4}\b/.test(rest)) continue  // linha com ano = cabeçalho, ignorar
      flush()
      pDia = mDate[1]; pMes = mDate[2]
      processText(rest)
      continue
    }

    if (!pDia) continue
    processText(line)
  }
  flush()

  console.log('[NuFatura] transações extraídas:', txns.length, txns.slice(0,3))
  return txns.length > 0 ? txns : null
}

// Parse transaction lines from extracted PDF text
function parsePdfLines(lines) {
  // Exceção: fatura Sem Parar → consolidar por veículo
  const semParar = parseSemPararPorVeiculo(lines)
  if (semParar) return semParar

  // Exceção: fatura Nubank cartão de crédito → state-machine por colunas
  const nuFatura = parseNubankFatura(lines)
  if (nuFatura) return nuFatura

  const transactions = []

  // Portuguese month map (lowercase)
  const ptMonths = 'jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez'

  // ── Pattern A (Sicredi / Nubank / C6 / Inter) ──────────────────────────────
  // DD/mmm HH:MM [City] [Presencial|Online|Débito] Description [X/Y] [US$ x R$ x] R$ AMOUNT
  // also: DD/mmm HH:MM Description -R$ AMOUNT  (payment — skip if negative)
  const patternA = new RegExp(
    `^(\\d{2}\\/ ?(?:${ptMonths}))\\s+\\d{2}:\\d{2}\\s+` +  // date + time (08/mar or 08/ mar)
    `(.+?)\\s+` +                                             // description
    `(?:US\\$[\\s\\d.,]+R\\$[\\s\\d.,]+)?` +                // optional USD block
    `(-\\s*)?R\\$\\s*([\\d.]+,[\\d]{2})\\s*$`,               // final BRL amount (handles "- R$")
    'i'
  )

  // ── Pattern B (Bradesco / Santander / BB / Itaú) ───────────────────────────
  // DD/MM[/YYYY] DESCRIPTION AMOUNT [D|C]
  const patternB = /^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.{2,80?}?)\s+((?:\d{1,3}\.)*\d{1,3},\d{2})\s*([DC]?)$/

  // ── Pattern C1 (Sem Parar / Tag pedágio — usos) ────────────────────────────
  // [PLATE] DD/MM/YY DESCRIPTION R$ AMOUNT
  // Brazilian plate: AAA0000 or AAA0A00 (Mercosul)
  const rePlate = /^[A-Z]{3}\d[A-Z0-9]\d{2}\s+/
  const patternC1 = /^(?:[A-Z]{3}\d[A-Z0-9]\d{2}\s+)?(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+R\$\s*([\d.]+,\d{2})\s*$/i

  // ── Pattern C2 (Sem Parar — Plano Contratado / assinatura) ─────────────────
  // PLATE DESCRIPTION DATE R$ AMOUNT  (date comes after description)
  const patternC2 = /^[A-Z]{3}\d[A-Z0-9]\d{2}\s+(.+?)\s+(\d{2}\/\d{2}\/\d{2,4})\s+R\$\s*([\d.]+,\d{2})\s*$/i

  // Time-detail lines from Sem Parar: "Às HH:MM:SS road info"
  // PDF.js may encode "Às" as "Às" or variants depending on the font
  const reTimeDetail = /^.{0,3}s\s+\d{2}:\d{2}:\d{2}/i
  // Date-range lines: "01/05/26 a 31/05/26"
  const reDateRange = /^\d{2}\/\d{2}\/\d{2,4}\s+a\s+\d{2}\/\d{2}/i

  // ── Pattern D (Nubank conta corrente extrato) ───────────────────────────────
  // Date group header: "DD MON YYYY Total de ..."
  const reDateGroupNu = /^(\d{2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})\b/i
  const ptMonthsNu = { jan:'01', fev:'02', mar:'03', abr:'04', mai:'05', jun:'06', jul:'07', ago:'08', set:'09', out:'10', nov:'11', dez:'12' }
  // Expense lines: start with debit type keyword, end with amount
  const reExpenseNu = /^(compra.{0,15}d.bito|transfer.{0,10}ncia\s+enviada|saque(?:\s+no\s+caixa)?|pagamento\s+de\s+boleto|pagamento\s+de\s+conta|pagamento\s+de\s+fatura|pagamento\s+boleto)\s+(.+?)\s+((?:\d{1,3}\.)*\d{1,3},\d{2})\s*$/i
  // Lines to skip in Nubank format (income, summaries)
  const reSkipNu = /^(transfer.{0,10}ncia\s+recebida|rendimento|cr.dito\s+em\s+conta|estorno|revers.o|total\s+de\s+(entrada|sa.|movimenta)|saldo\s+(inicial|final)|movimenta..es|tem\s+alguma|extrato\s+gerado|caso\s+a\s+solu)/i
  let nuDate = null

  const skipWords = /^(pagamento|credito|estorno|devolucao|transferencia recebida|saldo|limite|total|subtotal|vencimento|resumo|transacoes|legenda|cartao|encargo|iof )/i

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Skip Sem Parar time-detail lines ("Às HH:MM:SS road info") and date ranges
    if (reTimeDetail.test(line)) continue
    if (reDateRange.test(line)) continue

    // Pattern D — track Nubank conta corrente date group headers
    const mNuDate = line.match(reDateGroupNu)
    if (mNuDate) {
      nuDate = `${mNuDate[3]}-${ptMonthsNu[mNuDate[2].toLowerCase()]}-${mNuDate[1].padStart(2, '0')}`
    }
    // Skip Nubank income/summary lines
    if (nuDate && reSkipNu.test(line)) continue

    // Pattern A — Sicredi style
    let m = line.match(patternA)
    if (m) {
      const [, dateStr, rawDesc, negSign, valorStr] = m
      if (negSign && negSign.trim() === '-') continue       // skip payments/credits
      if (skipWords.test(rawDesc.trim())) continue

      const valor = parseAmount(valorStr)
      if (valor <= 0 || valor > 500000) continue

      // Extract installment like "03/03" or "01/12" at end of description
      let desc = rawDesc.trim()
      let parcela = ''
      const parcMatch = desc.match(/\s+(\d{1,2}\/\d{1,2})\s*$/)
      if (parcMatch) {
        parcela = parcMatch[1]
        desc = desc.slice(0, desc.length - parcMatch[0].length).trim()
      }

      // Remove "Presencial", "Online", city-like words, trailing numbers
      desc = desc
        .replace(/\bPresencial\b/gi, '')
        .replace(/\bOnline\b/gi, '')
        .replace(/\bD[ée]bito\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()

      transactions.push({
        id: `imp_pdf_${Date.now()}_${i}`,
        data: parseDate(dateStr) || new Date().toISOString().slice(0, 10),
        descricao: desc,
        valor,
        conta: 'PDF',
        parcela,
        tipo: 'debito',
      })
      continue
    }

    // Pattern B — classic DD/MM style
    m = line.match(patternB)
    if (m) {
      const [, dateStr, rawDesc, valorStr, typeChar] = m
      if (typeChar === 'C') continue                       // credit/payment
      if (skipWords.test(rawDesc.trim())) continue

      const valor = parseAmount(valorStr)
      if (valor <= 0 || valor > 500000) continue

      let desc = rawDesc.trim()
      // Check next line for continuation
      if (i + 1 < lines.length) {
        const next = lines[i + 1].trim()
        if (next && !next.match(/^\d{2}\//) && !next.match(/((?:\d{1,3}\.)*\d{1,3},\d{2})/)) {
          desc += ' ' + next; i++
        }
      }

      transactions.push({
        id: `imp_pdf2_${Date.now()}_${i}`,
        data: parseDate(dateStr) || new Date().toISOString().slice(0, 10),
        descricao: desc.replace(/\s+/g, ' ').trim(),
        valor,
        conta: 'PDF',
        parcela: '',
        tipo: 'debito',
      })
      continue
    }

    // Pattern C2 — Sem Parar Plano Contratado: PLATE DESCRIPTION DATE R$ AMOUNT
    m = line.match(patternC2)
    if (m) {
      const [, rawDesc, dateStr, valorStr] = m
      const valor = parseAmount(valorStr)
      if (valor <= 0 || valor > 500000) continue
      // Strip leading plate if accidentally captured in desc
      const desc = rawDesc.replace(rePlate, '').replace(/\s+/g, ' ').trim()
      transactions.push({
        id: `imp_pdfc2_${Date.now()}_${i}`,
        data: parseDate(dateStr) || new Date().toISOString().slice(0, 10),
        descricao: desc,
        valor,
        conta: 'Sem Parar',
        parcela: '',
        tipo: 'debito',
      })
      continue
    }

    // Pattern C1 — Sem Parar uso / pedágio: [PLATE] DD/MM/YY DESCRIPTION R$ AMOUNT
    m = line.match(patternC1)
    if (m) {
      const [, dateStr, rawDesc, valorStr] = m
      if (skipWords.test(rawDesc.trim())) continue
      const valor = parseAmount(valorStr)
      if (valor <= 0 || valor > 500000) continue
      // Peek next line for road detail (Às HH:MM:SS ROAD, KM, CITY)
      let desc = rawDesc.replace(/\s+/g, ' ').trim()
      if (i + 1 < lines.length) {
        const next = lines[i + 1].trim()
        // If next is a time-detail line, extract city/road from it
        if (reTimeDetail.test(next)) {
          const roadMatch = next.match(/\d{2}:\d{2}:\d{2}\s+(.+)/)
          if (roadMatch) {
            // Extract last meaningful segment (city name after last comma)
            const parts = roadMatch[1].split(',').map(s => s.trim())
            const city = parts.find(p => /^[A-ZÁÀÂÃ][A-ZÁÀÂÃa-záàâã\s]+$/.test(p))
            if (city) desc += ' – ' + city
          }
        }
      }
      transactions.push({
        id: `imp_pdfc1_${Date.now()}_${i}`,
        data: parseDate(dateStr) || new Date().toISOString().slice(0, 10),
        descricao: desc,
        valor,
        conta: 'Sem Parar',
        parcela: '',
        tipo: 'debito',
      })
      continue
    }

    // Pattern D — Nubank conta corrente expense line
    if (nuDate) {
      const mNu = line.match(reExpenseNu)
      if (mNu) {
        const valor = parseAmount(mNu[3])
        if (valor > 0 && valor < 500000) {
          let desc = mNu[2].trim()
          // Clean: remove CPF/CNPJ masks (bullets + numbers), bank agency/account details
          desc = desc
            .replace(/\s*[-–]\s*.{0,6}[.\d]{5,}[-–.].{0,6}\s*/g, ' ')  // CPF/CNPJ masked
            .replace(/\s*[-–]\s*\d{2}[.\d]{10,}\/\d{4}[-\d]*/g, '')      // full CNPJ
            .replace(/\s*(ag.ncia|ag\.|conta):?.*$/gi, '')                 // bank details
            .replace(/^pelo\s+pix\s+/i, '')                               // strip "pelo Pix" prefix
            .replace(/\s+[A-Z]{2,4}\s*$/g, '')                            // strip trailing bank codes (NU, OOP etc)
            .replace(/\s+/g, ' ').trim()
          if (!desc) desc = mNu[1].replace(/\s+/g, ' ').trim()
          transactions.push({
            id: `imp_pdfnu_${Date.now()}_${i}`,
            data: nuDate,
            descricao: desc,
            valor,
            conta: 'Nubank',
            parcela: '',
            tipo: 'debito',
          })
        }
      }
    }
  }

  if (transactions.length === 0) {
    throw new Error(
      'Nenhuma transação encontrada no PDF. ' +
      'PDFs escaneados (foto/imagem) não são suportados. ' +
      'Se possível, exporte o extrato como CSV ou OFX no app do seu banco.'
    )
  }
  // Filtro final: descarta linhas que não são despesas reais (pagamentos,
  // valor pendente do mês anterior, IOF/juros do rotativo, estornos…).
  return transactions.filter(t => !isNonExpense(t.descricao))
}

export async function parsePdf(buffer) {
  const pdfJs = await loadPdfJs()
  const lines = await extractPdfLines(pdfJs, buffer)
  return parsePdfLines(lines)
}

// ─── Demo data ────────────────────────────────────────────────────────────────
export function getDemoTransactions() {
  return [
    { id: 'demo_1', data: '2026-05-02', descricao: 'IFOOD*RESTAURANTE XPTO', valor: 89.90, conta: 'Nubank', parcela: '', tipo: 'debito' },
    { id: 'demo_2', data: '2026-05-03', descricao: 'UBER TRIP JG84K', valor: 24.50, conta: 'Nubank', parcela: '', tipo: 'debito' },
    { id: 'demo_3', data: '2026-05-04', descricao: 'NETFLIX.COM', valor: 55.90, conta: 'Bradesco', parcela: '', tipo: 'debito' },
    { id: 'demo_4', data: '2026-05-05', descricao: 'PAO DE ACUCAR 042', valor: 312.40, conta: 'Bradesco', parcela: '', tipo: 'debito' },
    { id: 'demo_5', data: '2026-05-06', descricao: 'POSTO SHELL SÃO PAULO', valor: 185.00, conta: 'Nubank', parcela: '', tipo: 'debito' },
    { id: 'demo_6', data: '2026-05-07', descricao: 'DROGASIL SP ZONA SUL', valor: 67.30, conta: 'Nubank', parcela: '', tipo: 'debito' },
    { id: 'demo_7', data: '2026-05-08', descricao: 'MERCADO LIVRE *ELETRONICOS 02/03', valor: 299.99, conta: 'Bradesco', parcela: '2/3', tipo: 'debito' },
    { id: 'demo_8', data: '2026-05-09', descricao: 'SPOTIFY BRASIL', valor: 21.90, conta: 'Nubank', parcela: '', tipo: 'debito' },
    { id: 'demo_9', data: '2026-05-10', descricao: 'CARREFOUR SUPER 015', valor: 234.60, conta: 'Bradesco', parcela: '', tipo: 'debito' },
    { id: 'demo_10', data: '2026-05-10', descricao: 'AMAZON PRIME VIDEO', valor: 14.90, conta: 'Nubank', parcela: '', tipo: 'debito' },
    { id: 'demo_11', data: '2026-05-11', descricao: 'BURGER KING PAULISTA', valor: 48.70, conta: 'Nubank', parcela: '', tipo: 'debito' },
    { id: 'demo_12', data: '2026-05-11', descricao: 'LATAM AIRLINES 01/04', valor: 1240.00, conta: 'Bradesco', parcela: '1/4', tipo: 'debito' },
  ]
}

// ─── Main Entry ───────────────────────────────────────────────────────────────
export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'csv') {
    const text = await readAsText(file)
    return parseCsv(text)
  }

  if (ext === 'ofx' || ext === 'qfx') {
    const text = await readAsText(file)
    const result = parseOfx(text)
    if (result.length === 0) throw new Error('Nenhuma transação encontrada no arquivo OFX')
    return result
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await readAsArrayBuffer(file)
    return parseXlsx(buffer)
  }

  if (ext === 'pdf') {
    const buffer = await readAsArrayBuffer(file)
    return parsePdf(buffer)
  }

  throw new Error(`Formato .${ext} não suportado. Use CSV, OFX ou XLSX.`)
}
