import Groq from 'groq-sdk'

// Módulo compartilhado de OCR — usado por ocr-formulario.js e webhook-whatsapp.js
// Arquivos prefixados com _ não são expostos como rotas no Vercel

// Wrapper com retry/backoff exponencial para chamadas Groq.
// Trata 429 (rate limit) e 5xx (erros transitórios) — outros erros não fazem retry.
async function groqWithRetry(groq, params, maxAttempts = 3) {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await groq.chat.completions.create(params)
    } catch (err) {
      lastErr = err
      const status = err?.status || err?.response?.status
      const retriable = status === 429 || (status >= 500 && status < 600)
      if (!retriable || attempt === maxAttempts) throw err
      // Backoff: 1s, 2s, 4s (+ jitter 0-500ms)
      const delay = Math.pow(2, attempt - 1) * 1000 + Math.floor(Math.random() * 500)
      console.warn(`[runOCR] tentativa ${attempt} falhou (status ${status}), aguardando ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para extração com template
// ─────────────────────────────────────────────────────────────────────────────

// Constrói bloco de hints baseado nos campos do template
function buildTemplateHints(campos) {
  if (!campos || campos.length === 0) return ''
  const lines = campos
    .filter(c => c.ocr_hint || c.label)
    .map(c => `  - "${c.key}": ${c.ocr_hint || c.label}${c.required ? ' (OBRIGATÓRIO)' : ''}`)
  return lines.join('\n')
}

// Constrói o JSON skeleton para o prompt de extração com template
function buildTemplateJsonSkeleton(campos, hoje) {
  const entries = campos.map(c => {
    let valor = '""'
    if (c.type === 'number') valor = 'null'
    else if (c.type === 'checkbox') valor = 'false'
    else if (c.type === 'date') valor = `"<YYYY-MM-DD ou ${hoje}>"`
    else valor = `"<${c.label || c.key}>"`
    return `  "${c.key}": ${valor}`
  })
  return `{\n${entries.join(',\n')}\n}`
}

// Determina tipo base do formulário a partir do template
function tipoBaseToFormType(tipo_base) {
  if (!tipo_base) return null
  if (tipo_base === 'transporte') return 'transporte'
  if (tipo_base === 'diario')     return 'diario'
  if (tipo_base === 'despesa')    return 'padrao'
  return null  // 'custom' → classificação automática
}

// ─────────────────────────────────────────────────────────────────────────────
// runOCR — ponto de entrada principal
// template: objeto form_template { tipo_base, campos, nome } ou null
// ─────────────────────────────────────────────────────────────────────────────
export async function runOCR(imageBase64, { forceTransporte = false, template = null } = {}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const imgUrl = `data:image/jpeg;base64,${imageBase64}`

  // ── Se template com campos definidos → extração dinâmica ────────────────────
  if (template && Array.isArray(template.campos) && template.campos.length > 0) {
    return await runOCRComTemplate(groq, imgUrl, template, hoje)
  }

  // ── PASSO 1: Classificação rápida — pulada se forceTransporte=true ───────────
  let isTransporte = forceTransporte
  if (!forceTransporte) {
    const classifyRes = await groqWithRetry(groq, {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imgUrl } },
          {
            type: 'text',
            text: `Analise esta imagem. Ela é um formulário "DIÁRIO DO MOTORISTA"?\nIndícios: tabela com colunas KM/ASFALTO/TERRA, campo PLACA, campo CONDUTOR, logotipo Casagrande, título "DIÁRIO DO MOTORISTA".\nResponda SOMENTE uma palavra: transporte (se for diário do motorista) ou padrao (qualquer outra coisa).`,
          },
        ],
      }],
      max_tokens: 20,
      temperature: 0,
    })
    const tipoRaw = classifyRes.choices[0]?.message?.content?.trim().toLowerCase() || ''
    // Aceita qualquer resposta que contenha "transporte" — protege contra verbosidade do modelo
    isTransporte = tipoRaw.includes('transporte')
  }

  // ── PASSO 2A: Extração completa do diário ────────────────────────────────────
  if (isTransporte) {
    const extractRes = await groqWithRetry(groq, {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imgUrl } },
          {
            type: 'text',
            text: `Este é um formulário DIÁRIO DO MOTORISTA (Casagrande Transportes). Extraia todos os dados e retorne APENAS este JSON (sem texto adicional):\n{\n  "tipo_formulario": "transporte",\n  "numero_diario": "<número do formulário — campo Nº no canto superior direito>",\n  "data": "<YYYY-MM-DD — campo DATA no topo, use ${hoje} se ilegível>",\n  "empresa": "<nome da empresa — campo EMPRESA>",\n  "setor": "<setor — campo SETOR ou ''>",\n  "solicitante": "<nome do solicitante — campo SOLICITANTE ou ''>",\n  "cc": "<centro de custo — campo CC ou ''>",\n  "local_origem": "<local de origem — campo LOCAL ORIGEM>",\n  "local_destino": "<local de destino — campo LOCAL DESTINO>",\n  "equipamento": "<equipamento — campo EQUIPAMENTO ou ''>",\n  "cliente": "<cliente ou ''>",\n  "tipo_atendimento": "<PLATAFORMA|PRANCHA|BASCULANTE|outro ou ''>",\n  "modulo": "<módulo ou ''>",\n  "condutor": "<nome do motorista — campo abaixo de Assinatura Motorista ou ''>",\n  "tipo_material": "<tipo de material ou ''>",\n  "km_inicial": "<hodômetro inicial ou ''>",\n  "km_final": "<hodômetro final ou ''>",\n  "viagens": 1,\n  "placa": "<placa — campo PLACA>",\n  "veiculo": "<modelo/tipo — campo VEÍCULO ou ''>",\n  "km_rows": [\n    { "tipo": "ASFALTO", "saida": "<KM saída linha 1 ou ''>", "entrada": "<KM entrada linha 1 ou ''>", "total": "<TOTAL/KM linha 1 ou ''>" },\n    { "tipo": "TERRA",   "saida": "<KM saída linha 2 ou ''>", "entrada": "<KM entrada linha 2 ou ''>", "total": "<TOTAL/KM linha 2 ou ''>" },\n    { "tipo": "ASFALTO", "saida": "", "entrada": "", "total": "" },\n    { "tipo": "TERRA",   "saida": "", "entrada": "", "total": "" },\n    { "tipo": "ASFALTO", "saida": "", "entrada": "", "total": "" },\n    { "tipo": "TERRA",   "saida": "", "entrada": "", "total": "" },\n    { "tipo": "ASFALTO", "saida": "", "entrada": "", "total": "" },\n    { "tipo": "TERRA",   "saida": "", "entrada": "", "total": "" }\n  ],\n  "horas_1": "<horas linha HORAS 1 ou ''>",\n  "horas_1_desc": "",\n  "horas_2": "<horas linha HORAS 2 ou ''>",\n  "horas_2_desc": "",\n  "diarias": "<valor diárias ou ''>",\n  "horas_espera": 0,\n  "valor_unit_espera": 0,\n  "horas_trabalhadas": 0,\n  "valor_unit_horas": 0,\n  "km_projeto": 0,\n  "valor_unit_km_projeto": 0,\n  "km_deslocamento": 0,\n  "valor_unit_km_deslocamento": 0,\n  "pedagio": 0,\n  "escolta": 0,\n  "nota_fiscal": "",\n  "cte_inicial": "",\n  "valor_cte": 0,\n  "cte_complementar": "",\n  "valor_cte_complementar": 0,\n  "valor_total": <número decimal — campo VALOR R$ ex: 5950.00>,\n  "observacao": "<campo OBSERVAÇÃO ou ''>"\n}`,
          },
        ],
      }],
      max_tokens: 2500,
      temperature: 0,
    })

    const raw = extractRes.choices[0]?.message?.content?.trim() || ''
    const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`runOCR transporte: JSON nao encontrado. raw=${raw.slice(0, 200)}`)
    const json = JSON.parse(match[0])

    if (typeof json.valor_total === 'string') {
      json.valor_total = parseFloat(json.valor_total.replace(/[^\d,.]/g, '').replace(',', '.')) || 0
    }
    if (!Array.isArray(json.km_rows)) json.km_rows = []
    while (json.km_rows.length < 8) {
      const tipo = json.km_rows.length % 2 === 0 ? 'ASFALTO' : 'TERRA'
      json.km_rows.push({ tipo, saida: '', entrada: '', total: '' })
    }
    json.tipo_formulario = 'transporte'
    return json
  }

  // ── PASSO 2B: Extração de despesa padrão ────────────────────────────────────
  const extractRes = await groqWithRetry(groq, {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imgUrl } },
        {
          type: 'text',
          text: `Extraia os dados deste documento financeiro e retorne APENAS JSON:\n{\n  "tipo_formulario": "padrao",\n  "tipo": "despesa",\n  "valor": <número>,\n  "descricao": "<descrição, máx 80 chars>",\n  "data": "<YYYY-MM-DD>",\n  "categoria": "<Alimentação|Transporte|Saúde|Serviços|Material|Equipamento|Viagem|Comunicação|Manutenção|Outros>",\n  "centro_custo": "",\n  "observacoes": ""\n}`,
        },
      ],
    }],
    max_tokens: 600,
    temperature: 0,
  })

  const raw = extractRes.choices[0]?.message?.content?.trim() || ''
  // Remove cercas markdown (```json ... ```) e tenta extrair o JSON
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`runOCR padrao: JSON nao encontrado. raw=${raw.slice(0, 200)}`)
  const json = JSON.parse(match[0])

  if (typeof json.valor === 'string') {
    json.valor = parseFloat(json.valor.replace(',', '.')) || 0
  }
  json.tipo_formulario = 'padrao'
  return json
}

// ─────────────────────────────────────────────────────────────────────────────
// runOCRComTemplate — extração dinâmica guiada pelos campos do form_template
// ─────────────────────────────────────────────────────────────────────────────
async function runOCRComTemplate(groq, imgUrl, template, hoje) {
  const campos = template.campos || []
  const tipoBase = template.tipo_base || 'custom'
  const nomeTemplate = template.nome || 'Formulário personalizado'

  // Determina se é formulário de transporte (km_rows estruturado)
  const isTransporte = tipoBase === 'transporte'
  const isKmForm = isTransporte || campos.some(c => c.key === 'km_rows' || c.key === 'km_asfalto' || c.key === 'km_terra')

  // Campos fixos sempre presentes para formulários de transporte (estrutura obrigatória para o sistema)
  const camposTransporte = isTransporte ? [
    { key: 'numero_diario', label: 'Número do Formulário', ocr_hint: 'número Nº no canto superior direito do formulário', required: true },
    { key: 'data',          label: 'Data',                 ocr_hint: `data no topo do formulário, formato YYYY-MM-DD, use ${hoje} se ilegível`, required: true },
    { key: 'empresa',       label: 'Empresa/Cliente',      ocr_hint: 'nome da empresa no campo EMPRESA', required: true },
    { key: 'local_origem',  label: 'Local Origem',         ocr_hint: 'local no campo LOCAL ORIGEM' },
    { key: 'local_destino', label: 'Local Destino',        ocr_hint: 'local no campo LOCAL DESTINO' },
    { key: 'placa',         label: 'Placa',                ocr_hint: 'placa do veículo — campo PLACA' },
    { key: 'valor_total',   label: 'Valor Total',          ocr_hint: 'valor monetário no campo VALOR R$ (número decimal, ex: 5950.00)', required: true },
  ] : []

  // Mescla campos fixos (sem duplicar) com campos do template
  const camposFixosKeys = new Set(camposTransporte.map(c => c.key))
  const camposTemplate  = campos.filter(c => !camposFixosKeys.has(c.key))
  const todosCampos     = [...camposTransporte, ...camposTemplate]

  // Gera hints para o prompt
  const hints = buildTemplateHints(todosCampos)

  // Para transporte, adiciona instrução especial para km_rows
  const kmRowsInstr = isKmForm && !campos.some(c => c.key === 'km_rows')
    ? `\n  "km_rows": array de objetos com a tabela KM/HORAS do formulário. Cada linha tem: { "tipo": "ASFALTO" ou "TERRA", "saida": "<KM saída ou ''>", "entrada": "<KM entrada ou ''>", "total": "<TOTAL/KM ou ''>" }. Extraia TODAS as 8 linhas (4 ASFALTO + 4 TERRA alternadas).`
    : ''

  // Skeleton JSON com todos os campos
  const skeleton = buildTemplateJsonSkeleton(todosCampos, hoje)
  const skeletonComKm = isKmForm
    ? skeleton.replace(/\n\}$/, `,\n  "km_rows": []\n}`)
    : skeleton

  const prompt = `Este é um formulário físico: "${nomeTemplate}".

Extraia os seguintes campos e retorne APENAS o JSON abaixo preenchido (sem texto adicional):

CAMPOS A EXTRAIR:
${hints}${kmRowsInstr}

JSON a retornar (preencha os valores):
${skeletonComKm}`

  const extractRes = await groqWithRetry(groq, {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imgUrl } },
        { type: 'text', text: prompt },
      ],
    }],
    max_tokens: 3000,
    temperature: 0,
  })

  const raw     = extractRes.choices[0]?.message?.content?.trim() || ''
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const m       = cleaned.match(/\{[\s\S]*\}/)
  if (!m) throw new Error(`runOCRComTemplate: JSON não encontrado. raw=${raw.slice(0, 200)}`)

  const json = JSON.parse(m[0])

  // Normaliza valor_total / valor
  const valKey = isTransporte ? 'valor_total' : 'valor'
  if (typeof json[valKey] === 'string') {
    json[valKey] = parseFloat(json[valKey].replace(/[^\d,.]/g, '').replace(',', '.')) || 0
  }

  // Normaliza km_rows para transporte
  if (isKmForm) {
    if (!Array.isArray(json.km_rows)) json.km_rows = []
    while (json.km_rows.length < 8) {
      const tipo = json.km_rows.length % 2 === 0 ? 'ASFALTO' : 'TERRA'
      json.km_rows.push({ tipo, saida: '', entrada: '', total: '' })
    }
  }

  // Adiciona tipo do formulário para que o webhook saiba como processar
  json.tipo_formulario      = tipoBase  // 'diario', 'transporte', 'despesa', etc.
  json._template_id         = template.id   || null
  json._template_nome       = nomeTemplate

  console.log(`[runOCRComTemplate] template="${nomeTemplate}" tipo=${tipoBase} campos_extraidos=${Object.keys(json).length}`)
  return json
}

// ─────────────────────────────────────────────────────────────────────────────
// runOCRDiarioMotorista — extração hardcoded para o formulário DM Casagrande
// Usa novo schema de chaves: numero_dm, cliente, origem, destino,
// km_ast, km_ter, km_total, condutor, placa, data_boletim, total_geral
// ─────────────────────────────────────────────────────────────────────────────
export async function runOCRDiarioMotorista(imageBase64) {
  const hoje = new Date().toISOString().slice(0, 10)
  const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const imgUrl = `data:image/jpeg;base64,${imageBase64}`

  const extractRes = await groqWithRetry(groq, {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imgUrl } },
        {
          type: 'text',
          text: `Este é um formulário DIÁRIO DO MOTORISTA (Casagrande Transportes).
Extraia os dados e retorne APENAS este JSON (sem texto adicional, sem cerca de código):
{
  "tipo_formulario": "transporte",
  "numero_dm": "<número Nº no canto superior — ex: '1234'>",
  "data": "<data do dia — YYYY-MM-DD, use ${hoje} se ilegível>",
  "data_boletim": "<data impressa no boletim — YYYY-MM-DD, igual a data se não houver campo separado>",
  "cliente": "<nome da empresa/cliente — campo EMPRESA ou CLIENTE>",
  "condutor": "<nome do motorista — campo CONDUTOR ou assinatura>",
  "placa": "<placa do veículo — campo PLACA>",
  "origem": "<local de origem — campo LOCAL ORIGEM ou ORIGEM>",
  "destino": "<local de destino — campo LOCAL DESTINO ou DESTINO>",
  "km_ast": <total KM ASFALTO como número decimal, 0 se nenhum>,
  "km_ter": <total KM TERRA como número decimal, 0 se nenhum>,
  "km_total": <soma km_ast + km_ter como número decimal>,
  "total_geral": <valor monetário total — campo VALOR R$ como número decimal, ex: 5950.00>,
  "observacao": "<observações — campo OBSERVAÇÃO ou ''>",
  "km_rows": [
    { "tipo": "ASFALTO", "saida": "<KM saída ou ''>", "entrada": "<KM entrada ou ''>", "total": "<TOTAL ou ''>" },
    { "tipo": "TERRA",   "saida": "<KM saída ou ''>", "entrada": "<KM entrada ou ''>", "total": "<TOTAL ou ''>" },
    { "tipo": "ASFALTO", "saida": "", "entrada": "", "total": "" },
    { "tipo": "TERRA",   "saida": "", "entrada": "", "total": "" },
    { "tipo": "ASFALTO", "saida": "", "entrada": "", "total": "" },
    { "tipo": "TERRA",   "saida": "", "entrada": "", "total": "" },
    { "tipo": "ASFALTO", "saida": "", "entrada": "", "total": "" },
    { "tipo": "TERRA",   "saida": "", "entrada": "", "total": "" }
  ]
}`,
        },
      ],
    }],
    max_tokens: 1500,
    temperature: 0,
  })

  const raw     = extractRes.choices[0]?.message?.content?.trim() || ''
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const m       = cleaned.match(/\{[\s\S]*\}/)
  if (!m) throw new Error(`runOCRDiarioMotorista: JSON não encontrado. raw=${raw.slice(0, 200)}`)

  const json = JSON.parse(m[0])

  // Normaliza campos numéricos
  for (const k of ['km_ast', 'km_ter', 'km_total', 'total_geral']) {
    if (typeof json[k] === 'string') {
      json[k] = parseFloat(json[k].replace(/[^\d,.]/g, '').replace(',', '.')) || 0
    }
    if (json[k] == null) json[k] = 0
  }

  // Garante km_total coerente com km_ast + km_ter
  if (json.km_total === 0 && (json.km_ast > 0 || json.km_ter > 0)) {
    json.km_total = (json.km_ast || 0) + (json.km_ter || 0)
  }

  // Normaliza km_rows
  if (!Array.isArray(json.km_rows)) json.km_rows = []
  while (json.km_rows.length < 8) {
    const tipo = json.km_rows.length % 2 === 0 ? 'ASFALTO' : 'TERRA'
    json.km_rows.push({ tipo, saida: '', entrada: '', total: '' })
  }

  json.tipo_formulario = 'transporte'  // compatibilidade com registros existentes
  console.log(`[runOCRDiarioMotorista] numero_dm=${json.numero_dm} condutor=${json.condutor} total=${json.total_geral}`)
  return json
}
