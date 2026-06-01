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
    propostaTxt: `${melhor[cfg.campo]} ÔÇö ${melhorConf}% de similaridade`,
  }
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

  const userPrompt = boletimTipo?.imagem_url
    ? `Analise este boletim de apontamento. O formul├írio tem os seguintes campos:\n${camposDescricao}\n\nExtrai o valor de cada campo. Retorne um objeto JSON com as chaves: ${Object.keys(camposJson).join(', ')}, responsavel_birigui_nome, responsavel_birigui_matricula, responsavel_cliente_nome, responsavel_cliente_matricula, numero_documento.`
    : `Extraia TODOS os dados deste formulário de apontamento. Retorne um JSON com as seguintes chaves (use null se o campo não existir ou estiver ilegível):
- numero_documento: OBRIGATÓRIO — olhe no CANTO SUPERIOR DIREITO do formulário: há um número de 3 a 5 dígitos impresso dentro de uma caixa/quadro retangular isolado, sem rótulo próximo. Esse é o número do documento. Exemplos: 2351, 1872, 3040. Extraia SOMENTE os dígitos como string. NÃO retorne null para este campo.
- data: data do boletim (DD/MM/YYYY)
- turno: "dia", "noite" ou "integral" conforme marcado
- colaborador: nome do operador/colaborador principal
- equipamento: código ou nome do equipamento (ex: EH-22, CAD 320, Hidrojato 10.000 PSI)
- modelo: modelo do equipamento (se informado separadamente)
- classe_operacional: classe/tipo do equipamento
- frente: local ou frente de trabalho
- cdc: centro de custo
- atividade_realizada: atividade ou serviço realizado (resumo curto)
- descritivo_trabalho: descrição detalhada do trabalho executado
- observacoes: observações, ocorrências ou anomalias registradas
- horimetro_inicial: leitura inicial do horímetro (número)
- horimetro_final: leitura final do horímetro (número)
- horas_trabalhadas: total de horas trabalhadas (número)
- horas_disponiveis: horas disponíveis ou horas totais do turno (número)
- horas_espera: horas em espera, ociosas ou de manutenção (número)
- produtividade_quantidade: quantidade produzida (número)
- produtividade_unidade: unidade de medida da produção (ex: m3, ton)
- produtividade_por_hora: produtividade por hora (número)
- responsavel_birigui_nome: nome do responsável Birigui pela execução do serviço
- responsavel_birigui_matricula: matrícula do responsável Birigui
- responsavel_cliente_nome: nome do responsável Cliente pela liberação/validação
- responsavel_cliente_matricula: matrícula do responsável Cliente
- unidade_empresa: unidade/filial/localidade da empresa cliente onde o serviço foi executado (ex: Três Lagoas, Birigui)
- jornada_inicio: horário de início do serviço/jornada (formato HH:MM, ex: 07:00)
- jornada_fim: horário de encerramento do serviço/jornada (formato HH:MM, ex: 17:00)
- jornada_total_horas: total de horas corridas da jornada (número decimal, ex: 10.0)
- cliente: razão social ou nome da empresa cliente
- cidade_estado: cidade e estado onde o serviço foi executado (ex: "Três Lagoas/MS")
- solicitante: nome do solicitante ou responsável pela abertura do serviço
- telefone: telefone de contato do solicitante
- placa: placa do veículo (ex: "QAZ-4D21")
- equipe_diurna: nomes dos membros da equipe diurna separados por ponto-e-vírgula
- equipe_noturna: nomes da equipe noturna, ou "Não se aplica"
- acessorios_utilizados: lista de acessórios e materiais utilizados no serviço
- local_servico: local de realização dos serviços (campo "LOCAL DE REALIZAÇÃO DOS SERVIÇOS" ou similar)
- setores: array com os nomes exatos dos setores/áreas com caixa marcada (checkbox com X), ex: ["Rotinas-1", "Linha de Fibras-1"]; retorne [] se não houver
- linhas_jornada: array de objetos, uma entrada por linha preenchida na tabela de Jornada de Trabalho. Cada objeto deve ter exatamente estas chaves: { "data": "DD/MM/AA", "e1": "HH:MM", "s1": "HH:MM", "e2": "HH:MM ou null", "s2": "HH:MM ou null", "total": "HH:MM", "servico": "descrição do serviço executado nesta linha" }. Retorne [] se não houver tabela de jornada.
- assinatura_cliente: nome por extenso na linha de assinatura do cliente
- assinatura_empresa: nome por extenso na linha de assinatura da empresa/Birigui
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
    // ÔöÇÔöÇ Fluxo Gerencial ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    // Cria o lan├ºamento SEMPRE, independente de campos pendentes.
    // O lan├ºamento com status 'pendente' ├® o pr├│prio documento de revis├úo:
    // o usu├írio abre no Gerencial, corrige o que o OCR errou e salva.
    const { data: lancamento, error: lancErr } = await supabase
      .from('lancamentos')
      .insert({
        workspace_id:    workspaceId,
        user_id:         null,
        tipo:            'despesa',
        descricao:       `Boletim ${bol.numero} ÔÇö ${colaborador?.nome || 'Colaborador'} ÔÇö ${dataBoletim || new Date().toISOString().slice(0, 10)}`,
        valor:           0,
        data:            dataBoletim || new Date().toISOString().slice(0, 10),
        categoria:       'Campo',
        centro_custo:    '',
        status:          'pendente',
        observacoes:     ocrRaw.observacao || ocrRaw.observacoes || '',
        tipo_formulario: 'diario',
        dados_extras:    { boletim_id: boletimId, ocr: ocrRaw, campos_pendentes: temPendente, ...mapOcrToExtras(ocrRaw, dataBoletim) },
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
      const dataFmt = dataBoletim
        ? dataBoletim.split('-').reverse().join('/')
        : new Date().toLocaleDateString('pt-BR')
      const msg = temPendente
        ? `­ƒôï *Boletim ${bol.numero}* do dia ${dataFmt} recebido!\n\n_Alguns campos precisam de revis├úo. Acesse o sistema para validar._`
        : `Ô£à *Boletim ${bol.numero}* do dia ${dataFmt} processado com sucesso!`
      await zapiSendText(waPhone, msg)
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
      const dataFmt = dataBoletim
        ? dataBoletim.split('-').reverse().join('/')
        : new Date().toLocaleDateString('pt-BR')
      await zapiSendText(
        waPhone,
        `Ô£à *Boletim ${bol.numero}* do dia ${dataFmt} processado com sucesso!\n\n_Todos os campos foram identificados automaticamente._`
      )
    }
  } else {
    // ÔöÇÔöÇ Fluxo M├íquinas ÔÇö campos pendentes ÔåÆ revis├úo do admin ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
    await supabase.from('maquinas_boletins').update({
      status:  'pendente_revisao',
      ...updateData,
    }).eq('id', boletimId)

    if (waPhone) {
      await zapiSendText(
        waPhone,
        `ÔÜá´©Å *Boletim ${bol.numero}* recebido!\n\nAlguns campos precisam ser confirmados pelo supervisor. Voc├¬ ser├í avisado assim que for revisado.`
      )
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