import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { GoogleGenerativeAI } from '@google/generative-ai'

async function imageUrlToInlineData(url) {
  const resp = await fetch(url)
  const buffer = await resp.arrayBuffer()
  const mimeType = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0]
  return { inlineData: { mimeType, data: Buffer.from(buffer).toString('base64') } }
}

// ─────────────────────────────────────────────────────────────────────────────
// ocr-boletim-maquina.js
// Engine de OCR template-based para boletins de campo
//
// Fluxo:
//   1. Carrega o boletim + colaborador + frente + boletim_tipo (campos_json)
//   2. Chama GPT-4 Vision com imagem do template + campos + imagem real
//   3. Para cada campo extraído: verifica aliases → match fuzzy nas tabelas
//      - ≥ 90% → status 'ok'  → cria lançamento se todos ok
//      - 60–89% → 'pendente'  → aguarda revisão admin
//      - < 60%  → 'nao_encontrado'
//   4. Notifica colaborador via WhatsApp
// ─────────────────────────────────────────────────────────────────────────────

const supabaseUrl        = process.env.SUPABASE_URL        || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const geminiApiKey       = process.env.GEMINI_API_KEY
const zapiInstanceId     = process.env.ZAPI_INSTANCE_ID
const zapiToken          = process.env.ZAPI_TOKEN
const APP_URL            = process.env.APP_URL || 'https://smartpro.app.br'

const CONF_AUTO  = 90   // ≥ 90% → ok automático
const CONF_PEND  = 60   // 60–89% → pendente revisão

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

// Normaliza texto para lookup de alias (trim + upper + colapsa espaços)
function normalizeAlias(s) {
  return (s || '').trim().toUpperCase().replace(/\s+/g, ' ')
}

// Distância de Levenshtein simples (para fuzzy matching)
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
  // Checa se um contém o outro
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

  // 1️⃣ Verifica alias aprendido (match exato normalizado)
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

  // 2️⃣ Configuração de qual tabela e campo buscar por campoTipo
  const config = {
    colaborador:  { tabela: 'maquinas_colaboradores', campo: 'nome' },
    equipamento:  { tabela: 'maquinas_equipamentos',  campo: 'codigo' },
    classe:       { tabela: 'maquinas_classes',        campo: 'nome' },
    frente:       { tabela: 'maquinas_frentes',        campo: 'nome' },
  }
  const cfg = config[campoTipo]
  if (!cfg) return { matchId: null, tabela: null, confianca: 0, propostaTxt: null }

  // 3️⃣ Tenta match exato ignorando case (ilike)
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
      propostaTxt: `${exatos[0][cfg.campo]} — 95% (match exato)`,
    }
  }

  // 4️⃣ Carrega todos os registros para fuzzy match
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

// ─────────────────────────────────────────────────────────────────────────────
// Processa um boletim completo
// ─────────────────────────────────────────────────────────────────────────────
async function processarBoletim(boletimId) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('supabase não configurado')
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY não configurada no servidor')

  // Carrega boletim + relacionamentos
  const { data: bol, error: bolErr } = await supabase
    .from('maquinas_boletins')
    .select(`
      *,
      maquinas_colaboradores (id, nome, telefone_wa, workspace_id),
      maquinas_boletim_tipos (id, nome, campos_json, imagem_url)
    `)
    .eq('id', boletimId)
    .single()

  if (bolErr || !bol) throw new Error(`boletim não encontrado: ${bolErr?.message}`)

  const colaborador   = bol.maquinas_colaboradores
  const boletimTipo   = bol.maquinas_boletim_tipos
  const workspaceId   = bol.workspace_id
  const waPhone       = bol.wa_from

  // Atualiza status para 'processando'
  await supabase.from('maquinas_boletins').update({ status: 'processando' }).eq('id', boletimId)

  // ── OCR via GPT-4 Vision ─────────────────────────────────────────────────
  const camposJson = boletimTipo?.campos_json || {}
  const camposDescricao = Object.entries(camposJson)
    .map(([k, v]) => `- ${k}: "${v.label}" (tipo: ${v.tipo})`)
    .join('\n')

  const systemPrompt = [
    'Você é um sistema de OCR especializado em boletins de apontamento de máquinas.',
    'Extraia os campos do formulário da imagem e retorne um JSON com as chaves exatamente como listadas.',
    'Para campos não preenchidos ou ilegíveis, use null.',
    'Retorne APENAS o JSON, sem explicações.',
  ].join(' ')

  const userPrompt = boletimTipo?.imagem_url
    ? `Analise este boletim de apontamento. O formulário tem os seguintes campos:\n${camposDescricao}\n\nExtrai o valor de cada campo. Retorne um objeto JSON com as chaves: ${Object.keys(camposJson).join(', ')}.`
    : `Extraia os dados deste formulário de apontamento de máquinas. Tente identificar: data, operador/colaborador, equipamento, frente de trabalho, horas produtivas, horas de manutenção, horas ociosas, observações. Retorne um JSON com essas chaves.`

  let ocrRaw = {}
  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const parts = [systemPrompt, userPrompt]
    if (boletimTipo?.imagem_url) parts.push(await imageUrlToInlineData(boletimTipo.imagem_url))
    parts.push(await imageUrlToInlineData(bol.imagem_url))
    const result = await model.generateContent(parts)
    const rawText = result.response.text()
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    ocrRaw = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  } catch (e) {
    console.error('[ocr-boletim] gemini error:', e.message)
    await supabase.from('maquinas_boletins').update({ status: 'erro', ocr_raw: { erro: e.message } }).eq('id', boletimId)
    if (waPhone) await zapiSendText(waPhone, `❌ Erro ao processar o boletim *${bol.numero}*. Contate o supervisor.`)
    return
  }

  // Salva o OCR bruto
  await supabase.from('maquinas_boletins').update({ ocr_raw: ocrRaw }).eq('id', boletimId)

  // ── Matching de campos ───────────────────────────────────────────────────
  // Mapeamento de chave OCR → tipo de campo para matching
  const tipoMatchMap = {
    operador:         'colaborador',
    colaborador:      'colaborador',
    equipamento:      'equipamento',
    classe:           'classe',
    frente:           'frente',
    // campos numéricos e texto não precisam de matching cadastral
  }

  const camposTiposAtivos = Object.keys(camposJson).length > 0
    ? Object.keys(camposJson)
    : Object.keys(ocrRaw)

  const registrosCampos = []
  let   temPendente     = false
  let   dataBoletim     = null

  for (const campoKey of camposTiposAtivos) {
    const valorRaw   = ocrRaw[campoKey] != null ? String(ocrRaw[campoKey]) : null
    const campoTipo  = camposJson[campoKey]?.tipo || campoKey
    const tipoMatch  = tipoMatchMap[campoKey] || tipoMatchMap[campoTipo]

    // Extrai data para salvar em data_boletim
    if ((campoKey === 'data' || campoTipo === 'data') && valorRaw) {
      // Tenta vários formatos: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
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
      // Campo numérico, texto ou sem valor — salva direto sem matching
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

  // Atualiza data_boletim se extraída
  const updateData = dataBoletim ? { data_boletim: dataBoletim } : {}

  // ── Resultado final ──────────────────────────────────────────────────────
  if (!temPendente) {
    // ✅ Todos os campos ok → cria lançamento
    const { data: lancamento, error: lancErr } = await supabase
      .from('lancamentos')
      .insert({
        workspace_id:    workspaceId,
        user_id:         null,    // system-generated
        tipo:            'despesa',
        descricao:       `Boletim ${bol.numero} — ${colaborador?.nome || 'Colaborador'} — ${dataBoletim || new Date().toISOString().slice(0, 10)}`,
        valor:           0,       // horas; custo calculado em relatório separado
        data:            dataBoletim || new Date().toISOString().slice(0, 10),
        categoria:       'Máquinas',
        centro_custo:    '',
        status:          'pendente',
        observacoes:     ocrRaw.observacao || ocrRaw.observacoes || '',
        tipo_formulario: 'maquina',
        dados_extras:    { boletim_id: boletimId, ocr: ocrRaw },
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
        `✅ *Boletim ${bol.numero}* do dia ${dataFmt} processado com sucesso!\n\n_Todos os campos foram identificados automaticamente._`
      )
    }
  } else {
    // ⚠️ Há campos pendentes → enfileira para revisão do admin
    await supabase.from('maquinas_boletins').update({
      status:  'pendente_revisao',
      ...updateData,
    }).eq('id', boletimId)

    if (waPhone) {
      await zapiSendText(
        waPhone,
        `⚠️ *Boletim ${bol.numero}* recebido!\n\nAlguns campos precisam ser confirmados pelo supervisor. Você será avisado assim que for revisado.`
      )
    }

    // Notifica admin/supervisor do workspace (via workspace notification se disponível)
    console.log(`[ocr-boletim] boletim ${bol.numero} (${boletimId}) aguarda revisão admin — ${registrosCampos.filter(c => c.status_match !== 'ok' && c.status_match !== 'ignorado').length} campo(s) pendente(s)`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler Vercel
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { boletimId } = req.body || {}
  if (!boletimId) return res.status(400).json({ error: 'boletimId obrigatório' })

  // Responde 200 imediatamente (chamada fire-and-forget do webhook)
  res.status(200).json({ ok: true, boletimId })

  // Processa em background (não bloqueia a resposta)
  processarBoletim(boletimId).catch(e =>
    console.error('[ocr-boletim-maquina] processarBoletim error:', e.message)
  )
}
