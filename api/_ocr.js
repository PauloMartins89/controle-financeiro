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

export async function runOCR(imageBase64) {
  const hoje = new Date().toISOString().slice(0, 10)
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const imgUrl = `data:image/jpeg;base64,${imageBase64}`

  // ── PASSO 1: Classificação rápida (resposta mínima, sem risco de truncamento) ──
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
  const isTransporte = tipoRaw.includes('transporte')

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
            text: `Este é um formulário DIÁRIO DO MOTORISTA. Extraia todos os dados e retorne APENAS este JSON (sem texto adicional):\n{\n  "tipo_formulario": "transporte",\n  "numero_diario": "<número do formulário/Nº>",\n  "data": "<YYYY-MM-DD, use ${hoje} se ilegível>",\n  "empresa": "<nome da empresa/cliente>",\n  "setor": "<setor ou ''>",\n  "solicitante": "<nome do solicitante ou ''>",\n  "cc": "<centro de custo/CC ou ''>",\n  "local_origem": "<local de origem>",\n  "local_destino": "<local de destino>",\n  "equipamento": "<equipamento transportado ou ''>",\n  "cliente": "<cliente ou ''>",\n  "tipo_atendimento": "<PLATAFORMA|PRANCHA|BASCULANTE|outro ou ''>",\n  "modulo": "<módulo ou ''>",\n  "condutor": "<nome do motorista ou ''>",\n  "tipo_material": "<tipo de material ou ''>",\n  "km_inicial": "<hodômetro inicial ou ''>",\n  "km_final": "<hodômetro final ou ''>",\n  "viagens": 1,\n  "placa": "<placa do veículo>",\n  "veiculo": "<modelo/tipo do veículo ou ''>",\n  "km_rows": [\n    { "tipo": "ASFALTO", "saida": "<KM ou ''>", "entrada": "<KM ou ''>", "total": "<total ou ''>" },\n    { "tipo": "TERRA",   "saida": "",            "entrada": "",            "total": "" },\n    { "tipo": "ASFALTO", "saida": "",            "entrada": "",            "total": "" },\n    { "tipo": "TERRA",   "saida": "",            "entrada": "",            "total": "" },\n    { "tipo": "ASFALTO", "saida": "",            "entrada": "",            "total": "" },\n    { "tipo": "TERRA",   "saida": "",            "entrada": "",            "total": "" },\n    { "tipo": "ASFALTO", "saida": "",            "entrada": "",            "total": "" },\n    { "tipo": "TERRA",   "saida": "",            "entrada": "",            "total": "" }\n  ],\n  "horas_1": "",\n  "horas_1_desc": "",\n  "horas_2": "",\n  "horas_2_desc": "",\n  "diarias": "",\n  "horas_espera": 0,\n  "valor_unit_espera": 0,\n  "horas_trabalhadas": 0,\n  "valor_unit_horas": 0,\n  "km_projeto": 0,\n  "valor_unit_km_projeto": 0,\n  "km_deslocamento": 0,\n  "valor_unit_km_deslocamento": 0,\n  "pedagio": 0,\n  "escolta": 0,\n  "nota_fiscal": "",\n  "cte_inicial": "",\n  "valor_cte": 0,\n  "cte_complementar": "",\n  "valor_cte_complementar": 0,\n  "valor_total": <número, ex: 5950.00>,\n  "observacao": ""\n}`,
          },
        ],
      }],
      max_tokens: 2500,
      temperature: 0,
    })

    const raw = extractRes.choices[0]?.message?.content?.trim() || ''
    const match = raw.match(/\{[\s\S]*\}/)
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
    max_tokens: 300,
    temperature: 0,
  })

  const raw = extractRes.choices[0]?.message?.content?.trim() || ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`runOCR padrao: JSON nao encontrado. raw=${raw.slice(0, 200)}`)
  const json = JSON.parse(match[0])

  if (typeof json.valor === 'string') {
    json.valor = parseFloat(json.valor.replace(',', '.')) || 0
  }
  json.tipo_formulario = 'padrao'
  return json
}
