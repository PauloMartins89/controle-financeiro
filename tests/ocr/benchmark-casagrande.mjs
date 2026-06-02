/**
 * BENCHMARK OCR — Formulários Casagrande "Diário do Motorista"
 * 
 * Testa cada imagem da pasta TESTE contra um gabarito fixo,
 * mede precisão campo a campo e gera relatório de erros.
 *
 * Uso:
 *   node tests/ocr/benchmark-casagrande.mjs
 *   node tests/ocr/benchmark-casagrande.mjs --rodada 2   (exibe comparativo)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')

// ── Carrega .env e .env.local ──────────────────────────────────────────────
for (const envFile of ['.env', '.env.local']) {
  const p = path.join(ROOT, envFile)
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf8').split('\n')
    for (const line of lines) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
}

// O OCR roda via Vercel (usa a chave de produção do servidor)
const VERCEL_URL = process.env.APP_URL || 'https://smartpro.app.br'
const TEST_TOKEN = process.env.SUPABASE_SERVICE_KEY
if (!TEST_TOKEN) {
  console.error('❌ SUPABASE_SERVICE_KEY não encontrada no .env — necessária para autenticar no endpoint de teste')
  process.exit(1)
}

// ── Pasta com imagens ──────────────────────────────────────────────────────
const PASTA_TESTE = 'C:\\Users\\senti\\Downloads\\TESTE'

// ── GABARITO (ground truth extraído manualmente das imagens) ──────────────
const GABARITO = [
  {
    arquivo: 'WhatsApp Image 2026-06-02 at 03.20.29.jpeg',
    numero_documento: '6234',
    data: '05/06/2026',
    empresa: 'Agrovale Logística LTDA',
    solicitante: 'Rogério Almeida',
    cdc: '5502',
    frente: 'Expedição',
    local_origem: 'Pátio Industrial - Três Lagoas/MS',
    local_destino: 'Usina Santa Luzia - Água Clara/MS',
    equipamento: 'Cavalo Mecânico VM 330 - Reboque R-24',
    placa: 'QAY2B18',
    valor_total: 4250,
    km_rows: [
      { tipo: 'ASFALTO', saida: 215780, entrada: 216235, total: 455 },
      { tipo: 'TERRA',   saida: 216235, entrada: 216298, total: 63  },
    ],
    assinatura_empresa: 'João Henrique',
    assinatura_cliente: 'Lucas Pereira',
  },
  {
    arquivo: 'WhatsApp Image 2026-06-02 at 03.20.30 (1).jpeg',
    numero_documento: '62077',
    data: '03/08/2026',
    empresa: 'Silvamax Operações',
    solicitante: 'Diego Nunes',
    cdc: '4410',
    frente: 'Transporte',
    local_origem: 'Pátio Florestal Leste',
    local_destino: 'Brasilândia/MS',
    equipamento: 'Truck Munck TM-03',
    placa: 'FQK5J39',
    valor_total: 3950,
    km_rows: [
      { tipo: 'ASFALTO', saida: 176430, entrada: 176618, total: 188 },
      { tipo: 'TERRA',   saida: 176618, entrada: 176690, total: 72  },
    ],
    assinatura_empresa: 'Tiago Ramos',
    assinatura_cliente: 'Sérgio Batista',
  },
  {
    arquivo: 'WhatsApp Image 2026-06-02 at 03.20.30.jpeg',
    numero_documento: '61942',
    data: '14/06/2026',
    empresa: 'Florestal Vale Verde',
    solicitante: 'Ricardo Almeida',
    cdc: '5178',
    frente: 'Colheita',
    local_origem: 'Fazenda Buriti',
    local_destino: 'Unidade Industrial - Água Clara/MS',
    equipamento: 'Caminhão Comboio CB-12',
    placa: 'RTA6H21',
    valor_total: 4120,
    km_rows: [
      { tipo: 'ASFALTO', saida: 245810, entrada: 246035, total: 225 },
      { tipo: 'TERRA',   saida: 246035, entrada: 246081, total: 46  },
    ],
    assinatura_empresa: 'Marcelo Lima',
    assinatura_cliente: 'Felipe Costa',
  },
  {
    arquivo: 'WhatsApp Image 2026-06-02 at 03.20.31.jpeg',
    numero_documento: '61885',
    data: '30/05/2026',
    empresa: 'Agrovale Logística LTDA',
    solicitante: 'Marcos Antônio',
    cdc: '4201',
    frente: 'Silvicultura',
    local_origem: 'Fazenda Santa Helena',
    local_destino: 'Pátio Central - Três Lagoas/MS',
    equipamento: 'Caminhão Prancha CP-07',
    placa: 'QAB7D42',
    valor_total: 3480,
    km_rows: [
      { tipo: 'ASFALTO', saida: 128450, entrada: 128672, total: 222 },
      { tipo: 'TERRA',   saida: 128672, entrada: 128711, total: 39  },
    ],
    assinatura_empresa: 'João Carlos',
    assinatura_cliente: 'Renato Silva',
  },
  {
    arquivo: 'WhatsApp Image 2026-06-02 at 03.20.32.jpeg',
    numero_documento: '62018',
    data: '22/07/2026',
    empresa: 'AgroTrans Brasil',
    solicitante: 'Juliano Pires',
    cdc: '3884',
    frente: 'Manutenção',
    local_origem: 'Oficina Central',
    local_destino: 'Fazenda Santa Luzia',
    equipamento: 'Prancha PR-09',
    placa: 'OYZ4C88',
    valor_total: 2860,
    km_rows: [
      { tipo: 'ASFALTO', saida: 98054, entrada: 98291, total: 237 },
      { tipo: 'TERRA',   saida: 98291, entrada: 98322, total: 31  },
    ],
    assinatura_empresa: 'Carlos Menezes',
    assinatura_cliente: 'Bruno Teles',
  },
  {
    arquivo: 'WhatsApp Image 2026-06-02 at 03.21.56.jpeg',
    numero_documento: '6185',
    data: '12/05/2026',
    empresa: 'Agrovale Logística LTDA',
    solicitante: 'Marcos Antônio',
    cdc: '4201',
    frente: 'Silvicultura',
    local_origem: 'Fazenda Santa Helena',
    local_destino: 'Pátio Central - Três Lagoas/MS',
    equipamento: 'Caminhão Prancha CP-07',
    placa: 'QAB7D42',
    valor_total: 3480,
    km_rows: [
      { tipo: 'ASFALTO', saida: 128450, entrada: 128672, total: 222 },
      { tipo: 'TERRA',   saida: 128672, entrada: 128711, total: 39  },
    ],
    assinatura_empresa: 'João Carlos',
    assinatura_cliente: 'Renato Silva',
  },
  // Duplicatas (re-fotos da mesma folha) — testamos consistência do OCR
  {
    arquivo: 'WhatsApp Image 2026-06-02 at 03.21.26.jpeg',
    _duplicata_de: 'WhatsApp Image 2026-06-02 at 03.20.30.jpeg',
    numero_documento: '61942',
    data: '14/06/2026',
    empresa: 'Florestal Vale Verde',
    solicitante: 'Ricardo Almeida',
    cdc: '5178',
    frente: 'Colheita',
    local_origem: 'Fazenda Buriti',
    local_destino: 'Unidade Industrial - Água Clara/MS',
    equipamento: 'Caminhão Comboio CB-12',
    placa: 'RTA6H21',
    valor_total: 4120,
    km_rows: [
      { tipo: 'ASFALTO', saida: 245810, entrada: 246035, total: 225 },
      { tipo: 'TERRA',   saida: 246035, entrada: 246081, total: 46  },
    ],
    assinatura_empresa: 'Marcelo Lima',
    assinatura_cliente: 'Felipe Costa',
  },
  {
    arquivo: 'WhatsApp Image 2026-06-02 at 03.23.48.jpeg',
    _duplicata_de: 'WhatsApp Image 2026-06-02 at 03.21.56.jpeg',
    numero_documento: '6185',
    data: '12/05/2026',
    empresa: 'Agrovale Logística LTDA',
    solicitante: 'Marcos Antônio',
    cdc: '4201',
    frente: 'Silvicultura',
    local_origem: 'Fazenda Santa Helena',
    local_destino: 'Pátio Central - Três Lagoas/MS',
    equipamento: 'Caminhão Prancha CP-07',
    placa: 'QAB7D42',
    valor_total: 3480,
    km_rows: [
      { tipo: 'ASFALTO', saida: 128450, entrada: 128672, total: 222 },
      { tipo: 'TERRA',   saida: 128672, entrada: 128711, total: 39  },
    ],
    assinatura_empresa: 'João Carlos',
    assinatura_cliente: 'Renato Silva',
  },
  // Sem gabarito pré-definido — extraímos e reportamos apenas
  {
    arquivo: 'WhatsApp Image 2026-06-02 at 03.20.29 (1).jpeg',
    _sem_gabarito: true,
  },
]

// ── Chamada ao endpoint de teste na Vercel ────────────────────────────────
async function callGemini(imageFilePath) {
  const imageBytes = fs.readFileSync(imageFilePath)
  const imageBase64 = imageBytes.toString('base64')

  const response = await fetch(`${VERCEL_URL}/api/ocr-test-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-token': TEST_TOKEN,
    },
    body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg' }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HTTP ${response.status}: ${body}`)
  }

  const json = await response.json()
  if (json.error) throw new Error(json.error)
  return json.ocr
}

// ── Comparação de campos ───────────────────────────────────────────────────
const CAMPOS_SIMPLES = [
  'numero_documento', 'data', 'empresa', 'solicitante',
  'cdc', 'frente', 'local_origem', 'local_destino',
  'equipamento', 'placa', 'valor_total',
  'assinatura_empresa', 'assinatura_cliente',
]

function normalizar(v) {
  if (v === null || v === undefined) return ''
  return String(v).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-z0-9]/g, ' ')                        // remove pontuação
    .replace(/\s+/g, ' ').trim()
}

function comparaSimples(esperado, obtido) {
  const e = normalizar(esperado)
  const o = normalizar(obtido)
  if (e === o) return 'OK'
  // tolerância: uma contém a outra
  if (e && o && (o.includes(e) || e.includes(o))) return 'PARCIAL'
  return 'ERRO'
}

function comparaKmRows(esperados, obtidos) {
  if (!Array.isArray(obtidos) || obtidos.length === 0) return 'ERRO (vazio)'
  const issues = []
  for (const esp of esperados) {
    const obt = obtidos.find(r => normalizar(r.tipo) === normalizar(esp.tipo))
    if (!obt) { issues.push(`${esp.tipo}: não encontrado`); continue }
    if (String(obt.saida)   !== String(esp.saida))   issues.push(`${esp.tipo}.saida: ${esp.saida}→${obt.saida}`)
    if (String(obt.entrada) !== String(esp.entrada)) issues.push(`${esp.tipo}.entrada: ${esp.entrada}→${obt.entrada}`)
    if (String(obt.total)   !== String(esp.total))   issues.push(`${esp.tipo}.total: ${esp.total}→${obt.total}`)
  }
  return issues.length === 0 ? 'OK' : `ERRO: ${issues.join(', ')}`
}

// ── Formatação do relatório ────────────────────────────────────────────────
const VERDE  = '\x1b[32m'
const AMARELO = '\x1b[33m'
const VERMELHO = '\x1b[31m'
const RESET  = '\x1b[0m'
const CINZA  = '\x1b[90m'
const NEGRITO = '\x1b[1m'

function cor(status) {
  if (status === 'OK')      return VERDE + status + RESET
  if (status.startsWith('PARCIAL')) return AMARELO + status + RESET
  return VERMELHO + status + RESET
}

// ── Main ───────────────────────────────────────────────────────────────────
const RESULTADOS_ARQUIVO = path.join(__dirname, 'benchmark-resultados.json')

async function main() {
  const args = process.argv.slice(2)
  const rodadaFlag = args.indexOf('--rodada')
  const numRodada = rodadaFlag >= 0 ? parseInt(args[rodadaFlag + 1] || '1') : null

  // Carrega histórico de rodadas anteriores
  let historico = []
  if (fs.existsSync(RESULTADOS_ARQUIVO)) {
    historico = JSON.parse(fs.readFileSync(RESULTADOS_ARQUIVO, 'utf8'))
  }

  console.log('\n' + NEGRITO + '═══════════════════════════════════════════════════════════════' + RESET)
  console.log(NEGRITO + '  BENCHMARK OCR — CASAGRANDE DIÁRIO DO MOTORISTA' + RESET)
  console.log(NEGRITO + '═══════════════════════════════════════════════════════════════' + RESET)
  console.log(`  Modelo: gemini-2.5-flash | Imagens: ${GABARITO.length} | ${new Date().toLocaleString('pt-BR')}`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  const resultadosRodada = []
  let totalCampos = 0
  let totalOK = 0
  let totalParcial = 0
  let totalErro = 0

  for (const gabarito of GABARITO) {
    const arquivo = gabarito.arquivo
    const caminhoImg = path.join(PASTA_TESTE, arquivo)
    const isDup = !!gabarito._duplicata_de
    const semGabarito = !!gabarito._sem_gabarito

    if (!fs.existsSync(caminhoImg)) {
      console.log(CINZA + `[SKIP] ${arquivo} — arquivo não encontrado` + RESET + '\n')
      continue
    }

    const label = isDup ? ` (re-foto de ${gabarito._duplicata_de})` : ''
    console.log(NEGRITO + `📄 ${arquivo}${label}` + RESET)
    if (semGabarito) console.log(CINZA + '   ⚠ Sem gabarito — apenas extração' + RESET)

    const inicio = Date.now()
    let ocr
    try {
      ocr = await callGemini(caminhoImg)
    } catch (e) {
      console.log(VERMELHO + `   ❌ Erro Gemini: ${e.message}` + RESET + '\n')
      continue
    }
    const tempo = ((Date.now() - inicio) / 1000).toFixed(1)

    const resultado = { arquivo, tempo_s: parseFloat(tempo), campos: {} }

    if (semGabarito) {
      console.log(CINZA + `   ⏱ ${tempo}s` + RESET)
      console.log('   Dados extraídos:')
      for (const [k, v] of Object.entries(ocr)) {
        if (v !== null && v !== undefined && v !== '') {
          console.log(`   ${CINZA}${k}:${RESET} ${JSON.stringify(v)}`)
        }
      }
      resultadosRodada.push(resultado)
      console.log()
      continue
    }

    // Compara campos simples
    let okLocal = 0, errLocal = 0
    const linhasComparacao = []

    for (const campo of CAMPOS_SIMPLES) {
      if (!(campo in gabarito)) continue
      const status = comparaSimples(gabarito[campo], ocr[campo])
      resultado.campos[campo] = { esperado: gabarito[campo], obtido: ocr[campo], status }
      linhasComparacao.push({ campo, esperado: gabarito[campo], obtido: ocr[campo], status })
      totalCampos++
      if (status === 'OK')      { totalOK++;      okLocal++ }
      else if (status.startsWith('PARCIAL')) { totalParcial++; okLocal++ }
      else                      { totalErro++;    errLocal++ }
    }

    // Compara km_rows
    if (gabarito.km_rows) {
      const statusKm = comparaKmRows(gabarito.km_rows, ocr.km_rows)
      resultado.campos['km_rows'] = { esperado: gabarito.km_rows, obtido: ocr.km_rows, status: statusKm }
      linhasComparacao.push({ campo: 'km_rows', esperado: 'tabela', obtido: JSON.stringify(ocr.km_rows), status: statusKm })
      totalCampos++
      if (statusKm === 'OK') { totalOK++; okLocal++ }
      else                   { totalErro++; errLocal++ }
    }

    // Exibe resultado
    const pct = Math.round(okLocal / (okLocal + errLocal) * 100)
    const statusGeral = errLocal === 0 ? VERDE + '✅ PASSOU' + RESET : VERMELHO + `❌ FALHOU (${pct}%)` + RESET
    console.log(`   ⏱ ${tempo}s | ${statusGeral}`)

    for (const l of linhasComparacao) {
      const pad = l.campo.padEnd(22)
      if (l.status === 'OK') {
        console.log(`   ${VERDE}✓${RESET} ${pad} = ${CINZA}${l.esperado}${RESET}`)
      } else if (l.status.startsWith('PARCIAL')) {
        console.log(`   ${AMARELO}~${RESET} ${pad} esperado=${AMARELO}${l.esperado}${RESET} obtido=${l.obtido}`)
      } else {
        console.log(`   ${VERMELHO}✗${RESET} ${pad} esperado=${VERMELHO}${l.esperado}${RESET} obtido=${l.obtido}`)
      }
    }

    resultadosRodada.push(resultado)
    console.log()
  }

  // ── Resumo final ──────────────────────────────────────────────────────
  console.log(NEGRITO + '═══════════════════════════════════════════════════════════════' + RESET)
  const pctGeral = totalCampos > 0 ? Math.round((totalOK + totalParcial) / totalCampos * 100) : 0
  console.log(NEGRITO + `  RESUMO GERAL: ${totalOK} OK | ${totalParcial} PARCIAL | ${totalErro} ERRO | ${pctGeral}% acerto` + RESET)

  // Campos com mais erros
  const errosPorCampo = {}
  for (const r of resultadosRodada) {
    for (const [campo, info] of Object.entries(r.campos || {})) {
      if (!errosPorCampo[campo]) errosPorCampo[campo] = { ok: 0, parcial: 0, erro: 0 }
      if (info.status === 'OK') errosPorCampo[campo].ok++
      else if (info.status.startsWith('PARCIAL')) errosPorCampo[campo].parcial++
      else errosPorCampo[campo].erro++
    }
  }
  console.log('\n  Por campo:')
  for (const [campo, c] of Object.entries(errosPorCampo).sort((a, b) => b[1].erro - a[1].erro)) {
    const total = c.ok + c.parcial + c.erro
    const pct = Math.round((c.ok + c.parcial) / total * 100)
    const barra = cor(c.erro === 0 ? 'OK' : c.parcial > 0 ? 'PARCIAL' : 'ERRO')
    console.log(`   ${campo.padEnd(22)} OK:${c.ok} PARCIAL:${c.parcial} ERRO:${c.erro} → ${pct}% ${barra}`)
  }

  // ── Comparativo com rodada anterior ──────────────────────────────────
  if (historico.length > 0) {
    const rodadaAnterior = historico[historico.length - 1]
    console.log('\n  Comparativo com rodada anterior:')
    for (const [campo, c] of Object.entries(errosPorCampo)) {
      const ant = rodadaAnterior.errosPorCampo?.[campo]
      if (!ant) continue
      const melhorou = c.erro < ant.erro
      const piorou   = c.erro > ant.erro
      if (melhorou) console.log(`   ${VERDE}↑ ${campo}: ${ant.erro} erros → ${c.erro} erros (MELHOROU)${RESET}`)
      if (piorou)   console.log(`   ${VERMELHO}↓ ${campo}: ${ant.erro} erros → ${c.erro} erros (PIOROU)${RESET}`)
    }
  }

  console.log(NEGRITO + '═══════════════════════════════════════════════════════════════\n' + RESET)

  // Salva histórico
  historico.push({
    timestamp: new Date().toISOString(),
    totalCampos, totalOK, totalParcial, totalErro,
    pctGeral,
    errosPorCampo,
    resultados: resultadosRodada,
  })
  fs.writeFileSync(RESULTADOS_ARQUIVO, JSON.stringify(historico, null, 2))
  console.log(`  Resultados salvos em: tests/ocr/benchmark-resultados.json\n`)
}

main().catch(console.error)
