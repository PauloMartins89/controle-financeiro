import ws from 'ws'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analisar-form-template
// Analisa imagem de formulário físico via Groq Vision e retorna lista de campos
// prontos para usar no form_templates.campos[]
//
// Body: { imageBase64: "...", mimeType: "image/jpeg" }
// Returns: { campos: [...] }
// ─────────────────────────────────────────────────────────────────────────────

const groqApiKey = process.env.GROQ_API_KEY

const SYSTEM_PROMPT = `Você é um especialista em análise de formulários físicos empresariais.
Analise a imagem do formulário em branco fornecida e identifique TODOS os campos preenchíveis visíveis.

Para cada campo retorne um objeto JSON com EXATAMENTE estas propriedades:
- "key": identificador único em snake_case sem acentos (ex: "numero_diario", "local_origem")
- "label": texto exato do label como aparece no formulário (ex: "Nº do Diário", "Local de Origem")
- "type": um dos valores: "text", "number", "date", "select", "textarea", "checkbox"
- "required": true se o campo parecer obrigatório (geralmente os principais), false caso contrário
- "section": nome da seção/grupo do formulário onde o campo aparece (ex: "Identificação", "Percurso", "Custos"). Se não houver seção clara, use ""
- "ocr_hint": descrição em português de como identificar este campo no formulário preenchido, usada para guiar extração por IA (ex: "número sequencial do diário do motorista, geralmente no canto superior")
- "show_in_table": true para campos importantes que vale ver na tabela de listagem (limite de 6-8 campos), false para demais
- "show_in_pdf": true para campos que devem aparecer no PDF/relatório
- "width": "full" para campos que ocupam linha inteira, "half" para campos lado a lado
- "options": "" (string vazia, a menos que seja select com opções visíveis no formulário)

Regras para o tipo:
- "date" → campos de data
- "number" → valores numéricos: km, horas, quantidades, valores monetários
- "checkbox" → sim/não, ok/não ok, assinado/não assinado
- "textarea" → observações, descrições longas
- "select" → listas com opções predefinidas visíveis no formulário
- "text" → tudo o mais

Retorne APENAS um array JSON. Nenhuma explicação, nenhum markdown.
Exemplo de saída:
[
  {"key":"numero_diario","label":"Nº do Diário","type":"text","required":true,"section":"Identificação","ocr_hint":"número sequencial no cabeçalho do formulário","show_in_table":true,"show_in_pdf":true,"width":"half","options":""},
  {"key":"data","label":"Data","type":"date","required":true,"section":"Identificação","ocr_hint":"data de emissão do diário","show_in_table":true,"show_in_pdf":true,"width":"half","options":""}
]`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  if (!groqApiKey) {
    return res.status(500).json({ error: 'groq_not_configured', detail: 'GROQ_API_KEY não configurada' })
  }

  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {}

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 obrigatório' })
  }

  // Valida mime type
  const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!validMimes.includes(mimeType)) {
    return res.status(400).json({ error: 'mimeType inválido', detail: `Use: ${validMimes.join(', ')}` })
  }

  const imageUrl = `data:${mimeType};base64,${imageBase64}`

  let rawText = ''
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 4096,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analise este formulário e retorne o array JSON com todos os campos identificados.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    })

    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Groq API ${resp.status}: ${err.slice(0, 300)}`)
    }

    const json = await resp.json()
    rawText = json.choices?.[0]?.message?.content || ''
  } catch (e) {
    console.error('[analisar-form-template] groq error:', e.message)
    return res.status(500).json({ error: 'groq_error', detail: e.message })
  }

  // Extrai JSON do texto
  let campos = []
  try {
    const match = rawText.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Nenhum array JSON encontrado na resposta')
    campos = JSON.parse(match[0])
    if (!Array.isArray(campos)) throw new Error('Resposta não é um array')
  } catch (e) {
    console.error('[analisar-form-template] parse error:', e.message, '\nRaw:', rawText.slice(0, 500))
    return res.status(422).json({ error: 'parse_error', detail: e.message, rawText: rawText.slice(0, 800) })
  }

  if (campos.length === 0) {
    return res.status(422).json({ error: 'sem_campos', detail: 'Nenhum campo identificado no formulário' })
  }

  // Garante que todos os campos têm as propriedades obrigatórias com defaults
  const camposNormalizados = campos.map(c => ({
    key:           String(c.key   || '').replace(/[^a-z0-9_]/g, '_'),
    label:         String(c.label || ''),
    type:          ['text','number','date','select','textarea','checkbox'].includes(c.type) ? c.type : 'text',
    required:      Boolean(c.required),
    section:       String(c.section || ''),
    ocr_hint:      String(c.ocr_hint || ''),
    show_in_table: Boolean(c.show_in_table !== false),
    show_in_pdf:   Boolean(c.show_in_pdf   !== false),
    width:         c.width === 'half' ? 'half' : 'full',
    options:       typeof c.options === 'string' ? c.options : (Array.isArray(c.options) ? c.options.join(', ') : ''),
  }))

  return res.status(200).json({ ok: true, campos: camposNormalizados, total: camposNormalizados.length })
}
