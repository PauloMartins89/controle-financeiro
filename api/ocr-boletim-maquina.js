import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Gemini Vision — baixa as imagens por URL e envia inline (base64)
// Retry automático em 503/429 com backoff exponencial (até 3 tentativas)
async function callGeminiVision(apiKey, { system, prompt, imageUrls }) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 4096 },
    systemInstruction: system,
  })
  const imageParts = await Promise.all(imageUrls.map(async url => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Erro ao baixar imagem (${res.status}): ${url}`)
    const buf = await res.arrayBuffer()
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]
    return { inlineData: { mimeType: mime, data: Buffer.from(buf).toString('base64') } }
  }))

  const MAX_ATTEMPTS = 3
  let lastErr
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await model.generateContent([{ text: prompt }, ...imageParts])
      let parsed = JSON.parse(result.response.text())
      // Gemini pode retornar array quando recebe múltiplas imagens — pega o objeto mais rico
      if (Array.isArray(parsed)) {
        const count = obj => (obj && typeof obj === 'object') ? Object.values(obj).filter(v => v != null).length : 0
        parsed = parsed.reduce((best, cur) => count(cur) > count(best) ? cur : best, {})
      }
      return parsed
    } catch (err) {
      lastErr = err
      const isRetryable = /503|529|overloaded|unavailable|429|quota/i.test(err.message)
      if (isRetryable && attempt < MAX_ATTEMPTS) {
        const delay = attempt * 8000  // 8s, 16s
        console.warn(`[ocr-boletim] gemini tentativa ${attempt} falhou (${err.message.slice(0, 80)}). Aguardando ${delay / 1000}s...`)
        await new Promise(r => setTimeout(r, delay))
      } else {
        throw err
      }
    }
  }
  throw lastErr
}

// ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
// ocr-boletim-maquina.js
// Engine de OCR template-based para boletins de campo
//
// Fluxo:
//   1. Carrega o boletim + colaborador + frente + boletim_tipo (campos_json)
//   2. Chama GPT-4 Vision com imagem do template + campos + imagem real
//   3. Para cada campo extra├¡do: verifica aliases ÔåÆ match fuzzy nas tabelas
//      - ÔëÑ 90% ÔåÆ status 'ok'  ÔåÆ cria lan├ºamento se todos ok
//      - 60ÔÇô89% ÔåÆ 'pendente'  ÔåÆ aguarda revis├úo admin
//      - < 60%  ÔåÆ 'nao_encontrado'
//   4. Notifica colaborador via WhatsApp
// ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

const supabaseUrl        = process.env.SUPABASE_URL        || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const geminiApiKey       = process.env.GEMINI_API_KEY
const zapiInstanceId     = process.env.ZAPI_INSTANCE_ID
const zapiToken          = process.env.ZAPI_TOKEN
const APP_URL            = process.env.APP_URL || 'https://smartpro.app.br'

const CONF_AUTO  = 90   // ÔëÑ 90% ÔåÆ ok autom├ítico
const CONF_PEND  = 60   // 60ÔÇô89% ÔåÆ pendente revis├úo

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey, {
    realtime: { params: { log_level: 'disabled' }, transport: ws },
    global: {},
  })
}

async function zapiSendText(phone, message) {
  if (!zapiInstanceId || !zapiToken || !phone) return
  try {
    await fetch(
      `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
        },
        body: JSON.stringify({ phone, message }),
      }
    )
  } catch (e) {
    console.error('[ocr-boletim] zapiSendText error:', e.message)
  }
}

// Normaliza texto para lookup de alias (trim + upper + colapsa espa├ºos)
function normalizeAlias(s) {
  return (s || '').trim().toUpperCase().replace(/\s+/g, ' ')
}

// Dist├óncia de Levenshtein simples (para fuzzy matching)
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// Calcula % de similaridade entre dois strings normalizados
function similaridade(a, b) {
  if (!a || !b) return 0
  const na = normalizeAlias(a)
  const nb = normalizeAlias(b)
  if (na === nb) return 100
  // Checa se um cont├®m o outro
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length)
    const longer  = Math.max(na.length, nb.length)
    return Math.round((shorter / longer) * 95)
  }
  const dist = levenshtein(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  return maxLen === 0 ? 100 : Math.round((1 - dist / maxLen) * 100)
}

// Busca o melhor match em uma tabela para um valor bruto
async function matchCadastro(supabase, workspaceId, campoTipo, valorRaw) {
  if (!valorRaw) return { matchId: null, tabela: null, confianca: 0, propostaTxt: null }

  const normRaw = normalizeAlias(valorRaw)

  // 1´©ÅÔâú Verifica alias aprendido (match exato normalizado)
  const { data: alias } = await supabase
    .from('maquinas_aliases')
    .select('match_id, match_tabela')
    .eq('workspace_id', workspaceId)
    .eq('campo_tipo', campoTipo)
    .eq('alias', normRaw)
    .maybeSingle()

  if (alias) {
    return { matchId: alias.match_id, tabela: alias.match_tabela, confianca: 100, propostaTxt: null }
  }

  // 2´©ÅÔâú Configura├º├úo de qual tabela e campo buscar por campoTipo
  const config = {
    colaborador:  { tabela: 'maquinas_colaboradores', campo: 'nome' },
    equipamento:  { tabela: 'maquinas_equipamentos',  campo: 'codigo' },
    classe:       { tabela: 'maquinas_classes',        campo: 'nome' },
    frente:       { tabela: 'maquinas_frentes',        campo: 'nome' },
  }
  const cfg = config[campoTipo]
  if (!cfg) return { matchId: null, tabela: null, confianca: 0, propostaTxt: null }

  // 3´©ÅÔâú Tenta match exato ignorando case (ilike)
  const { data: exatos } = await supabase
    .from(cfg.tabela)
    .select(`id, ${cfg.campo}`)
    .eq('workspace_id', workspaceId)
    .eq('ativo', true)
    .ilike(cfg.campo, normRaw)
    .limit(1)

  if (exatos?.length > 0) {
    return {
      matchId:     exatos[0].id,
      tabela:      cfg.tabela,
      confianca:   95,
      propostaTxt: `${exatos[0][cfg.campo]} ÔÇö 95% (match exato)`,
    }
  }

  // 4´©ÅÔâú Carrega todos os registros para fuzzy match
  const { data: todos } = await supabase
    .from(cfg.tabela)
    .select(`id, ${cfg.campo}`)
    .eq('workspace_id', workspaceId)
    .eq('ativo', true)

  if (!todos?.length) return { matchId: null, tabela: null, confianca: 0, propostaTxt: null }

  let melhor = null
  let melhorConf = 0
  for (const row of todos) {
    const conf = similaridade(normRaw, row[cfg.campo])
    if (conf > melhorConf) {
      melhorConf = conf
      melhor     = row
    }
  }

  if (!melhor || melhorConf === 0) {
    return { matchId: null, tabela: null, confianca: 0, propostaTxt: null }
  }

  return {
    matchId:     melhor.id,
    tabela:      cfg.tabela,
    confianca:   melhorConf,
    propostaTxt: `${melhor[cfg.campo]} — ${melhorConf}% de similaridade`,
  }
}

// Calcula valor faturável de um lançamento diário a partir de diario_tarifas
// Replica a lógica de calcPricingTotal do front-end
async function calcValorTarifa(supabase, workspaceId, extrasObj) {
  try {
    const { data: tarifas } = await supabase
      .from('diario_tarifas')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('ativo', true)
    if (!tarifas?.length) return null

    const empresa = (extrasObj.cliente || extrasObj.empresa || '').trim().toLowerCase()
    if (!empresa) return null

    let tarifa = tarifas.find(t => (t.nome || '').trim().toLowerCase() === empresa)
    if (!tarifa) tarifa = tarifas.find(t => empresa.includes((t.nome || '').trim().toLowerCase()) || (t.nome || '').trim().toLowerCase().includes(empresa))
    if (!tarifa) return null

    const parseMin = s => { if (!s) return null; const m = String(s).match(/^(\d{1,2}):(\d{2})/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null }
    const tDs = tarifa.hora_inicio_diurno ? (parseMin(String(tarifa.hora_inicio_diurno)) ?? 300)  : 300
    const tDe = tarifa.hora_fim_diurno    ? (parseMin(String(tarifa.hora_fim_diurno))    ?? 1320) : 1320

    const intervalo = (ini, fim) => {
      const iM = parseMin(ini); const fM = parseMin(fim)
      if (iM == null || fM == null) return null
      const total = ((fM - iM + 1440) % 1440) || 0
      let d = 0, n = 0
      for (let t = 0; t < total; t++) {
        const cur = (iM + t) % 1440
        if (cur >= tDs && cur < tDe) d++; else n++
      }
      return { diurno: d / 60, noturno: n / 60 }
    }

    let tDiurno = null, tNoturno = null
    const linhas = Array.isArray(extrasObj.linhas_jornada) ? extrasObj.linhas_jornada : []
    if (linhas.length > 0 && linhas.some(lj => lj.e1 || lj.s1)) {
      let d = 0, n = 0
      for (const lj of linhas) {
        const r1 = lj.e1 && lj.s1 ? intervalo(lj.e1, lj.s1) : null
        const r2 = lj.e2 && lj.s2 ? intervalo(lj.e2, lj.s2) : null
        if (r1) { d += r1.diurno; n += r1.noturno }
        if (r2) { d += r2.diurno; n += r2.noturno }
      }
      tDiurno = parseFloat(d.toFixed(2)); tNoturno = parseFloat(n.toFixed(2))
    } else {
      const ini = extrasObj.jornada_inicio || ''
      const fim = extrasObj.jornada_fim    || ''
      if (ini && fim) {
        const r = intervalo(ini, fim)
        if (r) { tDiurno = parseFloat(r.diurno.toFixed(2)); tNoturno = parseFloat(r.noturno.toFixed(2)) }
      }
    }
    if (tDiurno == null && tNoturno == null) {
      const hTotal = extrasObj.total_horas_dia ?? extrasObj.jornada_total_horas ?? null
      if (hTotal != null) { tDiurno = Number(hTotal); tNoturno = 0 }
    }
    if (tDiurno == null && tNoturno == null) {
      // fallback: usa valor_total do formulário se preenchido
      const vt = parseFloat(extrasObj.valor_total || 0)
      if (!isNaN(vt) && vt > 0) return vt
      return null
    }

    const rsDiurno  = tDiurno  != null && tarifa.valor_hora_diurno  != null ? tDiurno  * Number(tarifa.valor_hora_diurno)  : null
    const rsNoturno = tNoturno != null && tarifa.valor_hora_noturno != null ? tNoturno * Number(tarifa.valor_hora_noturno) : null
    if (rsDiurno == null && rsNoturno == null) {
      const vt = parseFloat(extrasObj.valor_total || 0)
      return (!isNaN(vt) && vt > 0) ? vt : null
    }
    return parseFloat(((rsDiurno ?? 0) + (rsNoturno ?? 0)).toFixed(2))
  } catch (e) {
    console.error('[ocr-boletim] calcValorTarifa error:', e.message)
    // fallback final: valor_total do formulário
    const vt = parseFloat(extrasObj.valor_total || 0)
    return (!isNaN(vt) && vt > 0) ? vt : null
  }
}

// Monta mensagem WA com o resumo de tudo que foi lido pelo OCR
function buildResumoOCR(extras, valorCalculado, temPendente, boletimNumero, dataBoletim) {
  const r   = extras.ocr || {}
  const ex  = extras

  const linha = (emoji, label, valor) => {
    if (valor == null || valor === '' || valor === '0' || valor === 0) return null
    return `${emoji} *${label}:* ${valor}`
  }

  // Data formatada
  const dataFmt = dataBoletim
    ? dataBoletim.split('-').reverse().join('/')
    : new Date().toLocaleDateString('pt-BR')

  // Motorista / condutor
  const motorista = ex.condutor || r.colaborador || r.motorista || r.condutor || null

  // Jornada — tenta linhas_jornada primeiro, depois jornada_inicio/fim
  let jornadaStr = null
  const linhas = Array.isArray(ex.linhas_jornada) ? ex.linhas_jornada : []
  if (linhas.length > 0 && linhas.some(lj => lj.e1 || lj.s1)) {
    const partes = linhas
      .filter(lj => lj.e1 || lj.s1)
      .map(lj => {
        const blocos = []
        if (lj.e1 && lj.s1) blocos.push(`${lj.e1}→${lj.s1}`)
        if (lj.e2 && lj.s2) blocos.push(`${lj.e2}→${lj.s2}`)
        return blocos.join(' / ') + (lj.total ? ` (${lj.total})` : '')
      })
    jornadaStr = partes.join(' | ')
  } else {
    const ini = ex.jornada_inicio || r.jornada_inicio || r.entrada || null
    const fim = ex.jornada_fim    || r.jornada_fim    || r.saida   || null
    const tot = ex.total_horas_dia ?? ex.jornada_total_horas ?? null
    if (ini || fim) jornadaStr = [ini, fim].filter(Boolean).join(' → ') + (tot != null ? ` (${tot}h)` : '')
  }

  // KMs
  const kmAst   = parseFloat(ex.km_ast   || r.km_ast   || r.km_aferido  || r.km_inicial || 0) || null
  const kmTer   = parseFloat(ex.km_ter   || r.km_ter   || r.km_terminal || r.km_final   || 0) || null
  const kmTotal = parseFloat(ex.km_total || r.km_total || r.km_percorrido || 0) ||
                  (kmAst && kmTer && kmTer > kmAst ? kmTer - kmAst : null)

  // KM table rows (ASFALTO / TERRA / HORAS / DIÁRIAS)
  const kmRows = Array.isArray(ex.km_rows) ? ex.km_rows : (Array.isArray(r.km_rows) ? r.km_rows : [])
  const kmRowsLinhas = kmRows
    .filter(row => row.total != null && row.total !== 0 && row.total !== '')
    .map(row => {
      const partes = []
      if (row.saida   != null) partes.push(`saída: ${Number(row.saida).toLocaleString('pt-BR')}`)
      if (row.entrada != null) partes.push(`chegada: ${Number(row.entrada).toLocaleString('pt-BR')}`)
      if (row.total   != null) partes.push(`total: ${Number(row.total).toLocaleString('pt-BR')} km`)
      return `   • ${(row.tipo || '?').toUpperCase()}: ${partes.join(' | ')}`
    })

  // Valor: tarifa calculada > valor_total do formulário
  const vt = parseFloat(ex.valor_total || r.valor_total || 0) || null
  const valorFinal = valorCalculado != null && valorCalculado > 0 ? valorCalculado : vt
  const valorStr = valorFinal != null && valorFinal > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorFinal)
    : null

  // Horímetros (boletins de máquina)
  const hIni  = ex.horimetro_inicial != null ? ex.horimetro_inicial : null
  const hFin  = ex.horimetro_final   != null ? ex.horimetro_final   : null
  const hTrab = ex.horas_trabalhadas != null ? ex.horas_trabalhadas : null

  const campos = [
    linha('📅', 'Data',          dataFmt),
    linha('🏢', 'Empresa',       ex.empresa || r.empresa || null),
    linha('👤', 'Motorista/Colaborador', motorista),
    linha('📋', 'Solicitante',   ex.solicitante || r.solicitante || null),
    linha('🚗', 'Placa',         ex.placa || r.placa || null),
    linha('🔧', 'Equipamento',   ex.equipamento || r.equipamento || null),
    linha('📂', 'Classe',        ex.classe_operacional || r.classe || null),
    linha('📌', 'Frente/CDC',    [ex.frente || r.frente, ex.cdc || r.cdc].filter(Boolean).join(' / ') || null),
    linha('📍', 'Origem',        ex.local_origem  || ex.origem        || r.local_origem  || r.origem       || null),
    linha('🏁', 'Destino',       ex.local_destino || ex.destino       || r.local_destino || r.destino      || null),
    linha('⏱', 'Jornada',       jornadaStr),
    linha('📏', 'Horímetro',     hIni != null && hFin != null ? `${hIni} → ${hFin}` : null),
    linha('⚙️', 'Hs trabalhadas', hTrab != null ? `${hTrab}h` : null),
    // KM direto (se não houver tabela)
    ...(kmRowsLinhas.length === 0 ? [
      linha('🛣', 'KM saída',  kmAst  != null ? kmAst.toLocaleString('pt-BR')  : null),
      linha('🛣', 'KM chegada', kmTer != null ? kmTer.toLocaleString('pt-BR')  : null),
      linha('🛣', 'KM total',  kmTotal != null ? kmTotal.toLocaleString('pt-BR') : null),
    ] : []),
    // KM tabela (ASFALTO / TERRA / etc.)
    ...(kmRowsLinhas.length > 0 ? [`🛣 *KM:*\n${kmRowsLinhas.join('\n')}`] : []),
    linha('✍️', 'Ass. recebedor',  ex.assinatura_cliente || r.assinatura_cliente || null),
    linha('✍️', 'Ass. entregador', ex.assinatura_empresa || r.assinatura_empresa || null),
    linha('�', 'Nº DM',         ex.numero_documento || r.numero_documento || null),
    linha('�💰', 'Valor', valorStr),
  ].filter(Boolean)

  const statusIcon = temPendente ? '⚠️' : '✅'
  const statusMsg  = temPendente
    ? '_Alguns campos precisam de revisão. Acesse o sistema para validar._'
    : '_Lançamento gerado automaticamente no sistema._'

  const numDM = ex.numero_documento || r.numero_documento || null
  const headerNumDM = numDM ? ` (DM ${numDM})` : ''

  return [
    `${statusIcon} *Boletim ${boletimNumero}*${headerNumDM} — ${dataFmt}`,
    '',
    '📋 *Campos lidos pelo OCR:*',
    ...campos,
    '',
    statusMsg,
  ].join('\n')
}

// ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
// Processa um boletim completo
// ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
// Mapeia campos OCR brutos para estrutura padr├úo do MapaApontamentoMaquina
function mapOcrToExtras(ocr, data) {
  const r     = ocr || {}
  const hTrab = parseFloat(r.horas_trabalhadas || r.horas_produtivas || 0) || null
  // horas_disponiveis: usa campo expl├¡cito, ou calcula de hor├¡metro, ou horas_totais
  const hIni  = parseFloat(r.horimetro_inicial || 0) || null
  const hFin  = parseFloat(r.horimetro_final   || 0) || null
  const hDisp = parseFloat(r.horas_disponiveis || r.horas_totais || 0) ||
                (hIni != null && hFin != null ? parseFloat((hFin - hIni).toFixed(2)) : null)
  const pct   = hDisp && hTrab ? parseFloat((hTrab / hDisp * 100).toFixed(2)) : null
  return {
    // Identifica├º├úo
    equipamento:           (r.equipamento || '').toUpperCase(),
    modelo:                r.modelo || '',
    classe_operacional:    r.classe || r.classe_operacional || '',
    frente:                r.frente || r.frente_de_trabalho || '',
    cdc:                   r.cdc || r.centro_de_custo || '',
    turno:                 r.turno || '',
    data:                  data || new Date().toISOString().slice(0, 10),
    // Horas
    horimetro_inicial:     hIni,
    horimetro_final:       hFin,
    horas_disponiveis:     hDisp,
    horas_trabalhadas:     hTrab,
    horas_espera:          parseFloat(r.horas_espera || r.horas_ociosas || 0) || null,
    porcentagem:           pct,
    // Descritivo
    atividade_realizada:   r.atividade_realizada || r.atividade || '',
    descritivo_trabalho:   r.descritivo_trabalho || r.descritivo || '',
    observacoes:           r.observacoes || r.observacao || r.observacoes_ocorrencias || '',
    // Produtividade
    produtividade_qtd:     parseFloat(r.produtividade_quantidade || r.produtividade || 0) || null,
    produtividade_un:      r.produtividade_unidade || r.unidade_medida || '',
    produtividade_hora:    parseFloat(r.produtividade_por_hora || 0) || null,
    // Respons├íveis
    responsavel_birigui_nome:       r.responsavel_birigui_nome || '',
    responsavel_birigui_matricula:  r.responsavel_birigui_matricula || '',
    responsavel_cliente_nome:       r.responsavel_cliente_nome || '',
    responsavel_cliente_matricula:  r.responsavel_cliente_matricula || '',
    // Unidade da empresa
    unidade_empresa:       r.unidade_empresa || r.unidade || r.filial || r.cidade_estado || '',
    // Jornada (aceita aliases: entrada/saida usados em boletins HJ e similares)
    jornada_inicio: (() => {
      const linhas = Array.isArray(r.linhas_jornada) ? r.linhas_jornada : []
      const v = r.jornada_inicio || r.entrada || (linhas.length > 0 ? linhas[0].e1 : null) || null
      return v || ''
    })(),
    jornada_fim: (() => {
      const linhas = Array.isArray(r.linhas_jornada) ? r.linhas_jornada : []
      const ultima = linhas.length > 0 ? linhas[linhas.length - 1] : null
      const v = r.jornada_fim || r.saida || (ultima ? (ultima.s2 || ultima.s1) : null) || null
      return v || ''
    })(),
    jornada_total_horas: (() => {
      const parseHHMM = s => { if (!s) return null; const m = String(s).match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1]) + parseInt(m[2]) / 60 : null }
      const jIni = r.jornada_inicio || r.entrada || null
      const jFim = r.jornada_fim    || r.saida   || null
      const jCalc = parseHHMM(jIni) != null && parseHHMM(jFim) != null
        ? parseFloat(((parseHHMM(jFim) - parseHHMM(jIni) + 24) % 24).toFixed(2))
        : null
      const hTrabVal = parseFloat(r.horas_trabalhadas || r.horas_produtivas || 0) || null
      // r.total pode ser número ou string HH:MM (boletins HJ)
      const totalRaw = r.jornada_total_horas || r.total || 0
      const linhas = Array.isArray(r.linhas_jornada) ? r.linhas_jornada : []
      const linhasSum = linhas.length > 0
        ? (linhas.reduce((acc, lj) => acc + (parseHHMM(lj.total) || 0), 0) || null)
        : null
      return parseFloat(totalRaw) || parseHHMM(String(totalRaw)) || jCalc || linhasSum || hTrabVal || null
    })(),
    // Número do documento (ficha pré-impressa)
    numero_documento: String(r.numero_documento || r.num_documento || r.numero_ficha || r.num_ficha || r.ficha || r.numero || r.n_doc || r.ndoc || r.n_ficha || '').trim() || null,
    // ── Campos Relatório Diário de Obra ──────────────────────────────────────
    cliente:            r.cliente || r.empresa || '',
    solicitante:        r.solicitante || '',
    telefone:           r.telefone || r.fone || '',
    placa:              r.placa || r.veiculo_placa || '',
    equipe_diurna:      r.equipe_diurna || '',
    equipe_noturna:     r.equipe_noturna || '',
    acessorios_utilizados: r.acessorios_utilizados || r.acessorios || '',
    local_servico:      r.local_servico || r.local_de_realizacao_dos_servicos || '',
    setores:            Array.isArray(r.setores) ? r.setores : [],
    linhas_jornada:     Array.isArray(r.linhas_jornada) ? r.linhas_jornada : [],
    assinatura_cliente: r.assinatura_cliente || r.responsavel_cliente_nome || '',
    assinatura_empresa: r.assinatura_empresa || r.responsavel_birigui_nome || '',
    total_horas_dia:    (() => {
      const parseHHMM2 = s => { if (!s) return null; const m = String(s).match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1]) + parseInt(m[2]) / 60 : null }
      const linhas = Array.isArray(r.linhas_jornada) ? r.linhas_jornada : []
      const soma = linhas.reduce((acc, lj) => acc + (parseHHMM2(lj.total) || 0), 0)
      return soma > 0 ? parseFloat(soma.toFixed(2)) : null
    })(),
    // ── Campos Diário do Motorista ─────────────────────────────────────────
    empresa:       r.empresa       || r.cliente       || '',
    condutor:      r.condutor      || r.motorista     || r.colaborador      || '',
    local_origem:  r.local_origem  || r.origem        || '',
    origem:        r.origem        || r.local_origem  || '',
    local_destino: r.local_destino || r.destino       || '',
    destino:       r.destino       || r.local_destino || '',
    km_rows:       Array.isArray(r.km_rows) ? r.km_rows : [],
    km_ast:        (() => {
      const v = parseFloat(r.km_ast || r.km_aferido || r.km_inicial || r.km_saida || 0)
      if (!isNaN(v) && v > 0) return v
      // fallback: km_rows ASFALTO saida
      const rows = Array.isArray(r.km_rows) ? r.km_rows : []
      const asfRow = rows.find(row => String(row.tipo || '').toUpperCase() === 'ASFALTO')
      return asfRow?.saida ? (parseFloat(asfRow.saida) || null) : null
    })(),
    km_ter:        (() => {
      const v = parseFloat(r.km_ter || r.km_terminal || r.km_final || r.km_chegada || 0)
      if (!isNaN(v) && v > 0) return v
      const rows = Array.isArray(r.km_rows) ? r.km_rows : []
      const asfRow = rows.find(row => String(row.tipo || '').toUpperCase() === 'ASFALTO')
      return asfRow?.entrada ? (parseFloat(asfRow.entrada) || null) : null
    })(),
    km_total:      (() => {
      const v = parseFloat(r.km_total || r.km_percorrido || 0)
      if (!isNaN(v) && v > 0) return v
      // fallback: soma total das linhas km_rows
      const rows = Array.isArray(r.km_rows) ? r.km_rows : []
      const soma = rows.reduce((s, row) => s + (parseFloat(row.total) || 0), 0)
      return soma > 0 ? soma : null
    })(),
    valor_total:   parseFloat(String(r.valor_total || r.valor || 0).replace(/[^\d.,]/g, '').replace(',', '.')) || null,
  }
}

async function processarBoletim(boletimId) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('supabase n├úo configurado')
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY não configurada no servidor')

  // Carrega boletim + relacionamentos
  const { data: bol, error: bolErr } = await supabase
    .from('maquinas_boletins')
    .select(`
      *,
      maquinas_colaboradores (id, nome, telefone_wa, workspace_id),
      maquinas_boletim_tipos (id, nome, campos_json, imagem_url, modulo_destino)
    `)
    .eq('id', boletimId)
    .single()

  if (bolErr || !bol) throw new Error(`boletim n├úo encontrado: ${bolErr?.message}`)

  const colaborador   = bol.maquinas_colaboradores
  let   boletimTipo   = bol.maquinas_boletim_tipos
  const workspaceId   = bol.workspace_id
  const waPhone       = bol.wa_from

  // Fallback: se o join PostgREST n├úo trouxe o tipo, busca separadamente
  if (!boletimTipo && bol.boletim_tipo_id) {
    const { data: tipoFallback } = await supabase
      .from('maquinas_boletim_tipos')
      .select('id, nome, campos_json, imagem_url, modulo_destino')
      .eq('id', bol.boletim_tipo_id)
      .single()
    boletimTipo = tipoFallback || null
    console.log('[ocr-boletim] boletimTipo via fallback:', boletimTipo?.nome, '| modulo_destino:', boletimTipo?.modulo_destino)
  } else {
    console.log('[ocr-boletim] boletimTipo via join:', boletimTipo?.nome, '| modulo_destino:', boletimTipo?.modulo_destino)
  }

  // Atualiza status para 'processando'
  await supabase.from('maquinas_boletins').update({ status: 'processando' }).eq('id', boletimId)

  // ÔöÇÔöÇ OCR via GPT-4 Vision ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const camposJson = boletimTipo?.campos_json || {}
  const camposDescricao = Object.entries(camposJson)
    .map(([k, v]) => `- ${k}: "${v.label}" (tipo: ${v.tipo})`)
    .join('\n')

  const systemPrompt = [
    'Você é um sistema de OCR especializado em formulários de apontamento de máquinas e Relatório Diário de Obra.',
    'Extraia os campos do formulário da imagem e retorne um JSON com as chaves exatamente como listadas.',
    'ATENÇÃO ESPECIAL: o campo numero_documento é o número isolado impresso em destaque no CANTO SUPERIOR DIREITO do formulário, dentro de uma caixa/quadro. Ele SEMPRE existe e deve ser extraído.',
    'Para campos n├úo preenchidos ou ileg├¡veis, use null.',
    'Retorne APENAS o JSON, sem explica├º├Áes.',
  ].join(' ')

  // Contexto adicional de campos_json (quando o tipo tem template configurado)
  const extraCamposCtx = Object.keys(camposJson).length > 0
    ? `\n\nCampos específicos mapeados para este tipo de formulário (extraia também se presentes):\n${camposDescricao}`
    : ''

  const userPrompt = `Extraia TODOS os dados deste formulário de apontamento/diário. Retorne um JSON com as seguintes chaves (use null se o campo não existir ou estiver ilegível):
- numero_documento: OBRIGATÓRIO — número de 4 a 6 dígitos PRÉ-IMPRESSO (não manuscrito) no CANTO SUPERIOR DIREITO do formulário, dentro de uma caixa/quadro retangular com borda. Exemplo de posição: ao lado ou abaixo do título "DIÁRIO DO MOTORISTA" ou "Nº". Leia com MÁXIMA ATENÇÃO cada dígito — dígitos comumente confundidos: 7 com 9, 0 com 6, 1 com 7. O número costuma ter 5 dígitos (ex: 81772, 01234). Extraia SOMENTE os dígitos como string. NÃO retorne null.
- data: data do boletim (DD/MM/YYYY)
- turno: "dia", "noite" ou "integral" conforme marcado
- empresa: nome da empresa/cliente no cabeçalho do formulário (campo "EMPRESA:" ou similar)
- colaborador: nome do operador, colaborador ou motorista principal
- solicitante: nome do solicitante ou responsável pela emissão
- equipamento: código ou nome do equipamento (ex: EH-22, J Po-01, Hidrojato 10.000 PSI)
- modelo: modelo do equipamento (se informado separadamente)
- classe_operacional: classe/tipo do equipamento
- frente: local ou frente de trabalho (campo "SETOR" ou "FRENTE")
- cdc: centro de custo (campo "CC" ou "CDC")
- local_origem: local, cidade ou endereço de origem/saída do veículo ou serviço
- local_destino: local, cidade ou endereço de destino/chegada do veículo ou serviço
- condutor: nome do motorista/condutor (se houver campo específico separado de colaborador)
- placa: placa do veículo (ex: "RUG-61B5", "BLG 9122")
- km_rows: IMPORTANTE — array com TODAS as linhas preenchidas da tabela de KM/HORAS do formulário. Cada objeto: { "tipo": "ASFALTO" | "TERRA" | "HORAS" | "DIÁRIAS", "saida": número ou null, "entrada": número ou null, "total": número ou null }. Extraia os números sem pontos/vírgulas de milhar. Retorne [] se não houver tabela.
- valor_total: valor total em reais do formulário (campo "VALOR RS", "VALOR R$" ou similar, geralmente próximo ao final do formulário antes das assinaturas). ATENÇÃO ao formato brasileiro: ponto como separador de milhar e vírgula como decimal (ex: "5.950,00" = 5950.0, "12.500,00" = 12500.0). Retorne somente o número decimal sem símbolo de moeda.
- km_ast: hodômetro na saída / km aferido (número, se houver campo direto separado da tabela)
- km_ter: hodômetro na chegada / km terminal (número, se houver campo direto)
- km_total: total de km percorridos (número, se houver campo direto)
- jornada_inicio: horário de início/HORA INICIAL (HH:MM)
- jornada_fim: horário de encerramento/HORA FINAL (HH:MM)
- jornada_total_horas: total de horas corridas ou HORAS ENVOLVIDAS (número decimal, ex: 1.0)
- horimetro_inicial: leitura inicial do horímetro (número)
- horimetro_final: leitura final do horímetro (número)
- horas_trabalhadas: total de horas trabalhadas (número)
- horas_disponiveis: horas disponíveis ou totais do turno (número)
- horas_espera: horas em espera ou ociosas (número)
- atividade_realizada: atividade ou serviço realizado (resumo)
- descritivo_trabalho: descrição detalhada do serviço (campo "DESCRIÇÃO DO SERVIÇO" ou similar)
- observacoes: observações, ocorrências ou anomalias
- produtividade_quantidade: quantidade produzida (número)
- produtividade_unidade: unidade de medida (ex: m3, ton)
- responsavel_birigui_nome: responsável da empresa executora
- responsavel_birigui_matricula: matrícula do responsável
- responsavel_cliente_nome: responsável do cliente
- responsavel_cliente_matricula: matrícula do responsável do cliente
- cliente: razão social do cliente (se diferente de empresa)
- unidade_empresa: unidade/filial/localidade
- cidade_estado: cidade e estado (ex: "Três Lagoas/MS")
- telefone: telefone de contato
- equipe_diurna: membros da equipe diurna separados por ponto-e-vírgula
- equipe_noturna: membros da equipe noturna
- acessorios_utilizados: acessórios e materiais utilizados
- local_servico: campo "LOCAL DE REALIZAÇÃO DOS SERVIÇOS" ou similar
- setores: array com os nomes dos setores/áreas com checkbox marcado. Ex: ["Rotinas-1"]. Retorne [].
- linhas_jornada: array de linhas da tabela Jornada de Trabalho. Cada objeto: { "data": "DD/MM/AA", "e1": "HH:MM", "s1": "HH:MM", "e2": "HH:MM ou null", "s2": "HH:MM ou null", "total": "HH:MM", "servico": "descrição" }. Retorne [].
- assinatura_cliente: nome por extenso na linha de assinatura do cliente/recebedor
- assinatura_empresa: nome por extenso na linha de assinatura da empresa/entregador${extraCamposCtx}
Retorne APENAS o JSON, sem comentários.`

  let ocrRaw = {}
  try {
    const imageUrls = [
      ...(boletimTipo?.imagem_url ? [boletimTipo.imagem_url] : []),
      bol.imagem_url,
    ].filter(Boolean)
    ocrRaw = await callGeminiVision(geminiApiKey, { system: systemPrompt, prompt: userPrompt, imageUrls })
  } catch (e) {
    console.error('[ocr-boletim] gemini error:', e.message)
    await supabase.from('maquinas_boletins').update({ status: 'erro', ocr_raw: { erro: e.message } }).eq('id', boletimId)
    if (waPhone) await zapiSendText(waPhone, `⚠️ Erro ao processar o boletim *${bol.numero}*. Contate o supervisor.`)
    return
  }

  // Salva o OCR bruto
  await supabase.from('maquinas_boletins').update({ ocr_raw: ocrRaw }).eq('id', boletimId)

  // ÔöÇÔöÇ Matching de campos ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  // Mapeamento de chave OCR ÔåÆ tipo de campo para matching
  const tipoMatchMap = {
    operador:         'colaborador',
    colaborador:      'colaborador',
    equipamento:      'equipamento',
    classe:           'classe',
    frente:           'frente',
    // campos num├®ricos e texto n├úo precisam de matching cadastral
  }

  const camposTiposAtivos = Object.keys(camposJson).length > 0
    ? Object.keys(camposJson)
    : Object.keys(ocrRaw)

  const registrosCampos = []
  let   temPendente     = false
  let   dataBoletim     = null

  // Valida├º├úo: responsavel_cliente sem matr├¡cula ÔåÆ pendente
  if (
    ocrRaw.responsavel_cliente_nome &&
    (!ocrRaw.responsavel_cliente_matricula ||
      String(ocrRaw.responsavel_cliente_matricula).trim() === '' ||
      ocrRaw.responsavel_cliente_matricula === '\u2014')
  ) {
    temPendente = true
  }

  for (const campoKey of camposTiposAtivos) {
    const valorRaw   = ocrRaw[campoKey] != null ? String(ocrRaw[campoKey]) : null
    const campoTipo  = camposJson[campoKey]?.tipo || campoKey
    const tipoMatch  = tipoMatchMap[campoKey] || tipoMatchMap[campoTipo]

    // Extrai data para salvar em data_boletim
    if ((campoKey === 'data' || campoTipo === 'data') && valorRaw) {
      // Tenta v├írios formatos: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
      const m1 = valorRaw.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/)
      const m2 = valorRaw.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
      if (m1) dataBoletim = `${m1[3]}-${m1[2]}-${m1[1]}`
      else if (m2) dataBoletim = `${m2[1]}-${m2[2]}-${m2[3]}`
    }

    if (tipoMatch && valorRaw) {
      // Campo que precisa de matching cadastral
      const match = await matchCadastro(supabase, workspaceId, tipoMatch, valorRaw)

      let statusMatch = 'nao_encontrado'
      if (match.confianca >= CONF_AUTO) statusMatch = 'ok'
      else if (match.confianca >= CONF_PEND) statusMatch = 'pendente'

      if (statusMatch !== 'ok') temPendente = true

      registrosCampos.push({
        boletim_id:      boletimId,
        campo_tipo:      campoTipo !== campoKey ? campoTipo : campoKey,
        valor_raw:       valorRaw,
        valor_match_id:  match.matchId,
        match_tabela:    match.tabela,
        match_confianca: match.confianca,
        status_match:    statusMatch,
        proposta_texto:  match.propostaTxt,
      })
    } else {
      // Campo num├®rico, texto ou sem valor ÔÇö salva direto sem matching
      const statusCampo = valorRaw ? 'ok' : 'ignorado'
      registrosCampos.push({
        boletim_id:      boletimId,
        campo_tipo:      campoTipo !== campoKey ? campoTipo : campoKey,
        valor_raw:       valorRaw,
        valor_match_id:  null,
        match_tabela:    null,
        match_confianca: valorRaw ? 100 : 0,
        status_match:    statusCampo,
        proposta_texto:  null,
      })
    }
  }

  // Insere todos os campos
  if (registrosCampos.length > 0) {
    const { error: camposErr } = await supabase.from('maquinas_boletins_campos').insert(registrosCampos)
    if (camposErr) console.error('[ocr-boletim] campos insert error:', camposErr.message)
  }

  // Atualiza data_boletim se extra├¡da
  const updateData = dataBoletim ? { data_boletim: dataBoletim } : {}

  // ÔöÇÔöÇ Resultado final ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const isGerencial = boletimTipo?.modulo_destino === 'gerencial'
  console.log(`[ocr-boletim] isGerencial=${isGerencial} | boletim_tipo_id=${bol.boletim_tipo_id} | modulo_destino=${boletimTipo?.modulo_destino} | temPendente=${temPendente}`)

  if (isGerencial) {
    // ── Fluxo Gerencial ─────────────────────────────────────────────────────
    // Cria o lançamento SEMPRE, independente de campos pendentes.
    // O lançamento com status 'pendente' é o próprio documento de revisão:
    // o usuário abre no Gerencial, corrige o que o OCR errou e salva.
    const extrasGerencial = { boletim_id: boletimId, ocr: ocrRaw, campos_pendentes: temPendente, ...mapOcrToExtras(ocrRaw, dataBoletim) }
    const valorCalculado  = await calcValorTarifa(supabase, workspaceId, extrasGerencial)
    const { data: lancamento, error: lancErr } = await supabase
      .from('lancamentos')
      .insert({
        workspace_id:    workspaceId,
        user_id:         null,
        tipo:            'despesa',
        descricao:       `Boletim ${bol.numero} — ${colaborador?.nome || 'Colaborador'} — ${dataBoletim || new Date().toISOString().slice(0, 10)}`,
        valor:           valorCalculado ?? 0,
        data:            dataBoletim || new Date().toISOString().slice(0, 10),
        categoria:       'Campo',
        centro_custo:    '',
        status:          'pendente',
        observacoes:     ocrRaw.observacao || ocrRaw.observacoes || '',
        tipo_formulario: 'diario',
        dados_extras:    extrasGerencial,
        comprovante_url: bol.imagem_url || '',
      })
      .select('id')
      .single()

    if (lancErr) {
      console.error('[ocr-boletim] lancamento gerencial insert error:', lancErr.message)
    }

    await supabase.from('maquinas_boletins').update({
      status:        'processado',
      processado_em: new Date().toISOString(),
      lancamento_id: lancamento?.id || null,
      ...updateData,
    }).eq('id', boletimId)

    if (waPhone) {
      const resumo = buildResumoOCR(extrasGerencial, valorCalculado, temPendente, bol.numero, dataBoletim)
      await zapiSendText(waPhone, resumo)
    }

  } else if (!temPendente) {
    // ÔöÇÔöÇ Fluxo M├íquinas ÔÇö todos os campos ok ÔåÆ cria lan├ºamento ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    const { data: lancamento, error: lancErr } = await supabase
      .from('lancamentos')
      .insert({
        workspace_id:    workspaceId,
        user_id:         null,
        tipo:            'despesa',
        descricao:       `Boletim ${bol.numero} ÔÇö ${colaborador?.nome || 'Colaborador'} ÔÇö ${dataBoletim || new Date().toISOString().slice(0, 10)}`,
        valor:           0,
        data:            dataBoletim || new Date().toISOString().slice(0, 10),
        categoria:       'M├íquinas',
        centro_custo:    '',
        status:          'pendente',
        observacoes:     ocrRaw.observacao || ocrRaw.observacoes || '',
        tipo_formulario: 'maquina',
        dados_extras:    { boletim_id: boletimId, ocr: ocrRaw, ...mapOcrToExtras(ocrRaw, dataBoletim) },
        comprovante_url: bol.imagem_url || '',
      })
      .select('id')
      .single()

    if (lancErr) {
      console.error('[ocr-boletim] lancamento insert error:', lancErr.message)
    }

    await supabase.from('maquinas_boletins').update({
      status:         'processado',
      processado_em:  new Date().toISOString(),
      lancamento_id:  lancamento?.id || null,
      ...updateData,
    }).eq('id', boletimId)

    if (waPhone) {
      const extrasMaq = { boletim_id: boletimId, ocr: ocrRaw, ...mapOcrToExtras(ocrRaw, dataBoletim) }
      const resumo = buildResumoOCR(extrasMaq, null, false, bol.numero, dataBoletim)
      await zapiSendText(waPhone, resumo)
    }
  } else {
    // ÔöÇÔöÇ Fluxo M├íquinas ÔÇö campos pendentes ÔåÆ revis├úo do admin ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    await supabase.from('maquinas_boletins').update({
      status:  'pendente_revisao',
      ...updateData,
    }).eq('id', boletimId)

    if (waPhone) {
      const extrasPend = { boletim_id: boletimId, ocr: ocrRaw, ...mapOcrToExtras(ocrRaw, dataBoletim) }
      const resumo = buildResumoOCR(extrasPend, null, true, bol.numero, dataBoletim)
      await zapiSendText(waPhone, resumo)
    }

    console.log(`[ocr-boletim] boletim ${bol.numero} (${boletimId}) aguarda revis├úo admin ÔÇö ${registrosCampos.filter(c => c.status_match !== 'ok' && c.status_match !== 'ignorado').length} campo(s) pendente(s)`)
  }
}

// ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
// Handler Vercel
// ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { boletimId } = req.body || {}
  if (!boletimId) return res.status(400).json({ error: 'boletimId obrigat├│rio' })

  // Processa primeiro (maxDuration: 60s) e s├│ depois responde
  await processarBoletim(boletimId).catch(e =>
    console.error('[ocr-boletim-maquina] processarBoletim error:', e.message)
  )
  res.status(200).json({ ok: true, boletimId })
}