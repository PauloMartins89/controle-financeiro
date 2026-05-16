import Groq from 'groq-sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { imageBase64 } = req.body
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' })

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
          },
          {
            type: 'text',
            text: `Analise este comprovante, nota fiscal ou extrato bancário brasileiro.
Extraia as seguintes informações:
- valor: valor total pago (número decimal, ex: 45.90)
- descricao: nome do estabelecimento ou descrição resumida (máx 60 chars)
- data: data da transação no formato YYYY-MM-DD (se não encontrar, use hoje)
- categoria: uma das opções: alimentacao, transporte, saude, lazer, moradia, educacao, vestuario, servicos, outros

Retorne APENAS um JSON válido sem texto adicional:
{"valor": 0.00, "descricao": "...", "data": "YYYY-MM-DD", "categoria": "outros"}`
          }
        ]
      }],
      max_tokens: 300
    })

    const text = response.choices[0].message.content.trim()
    // Extrai JSON mesmo que haja texto ao redor
    const match = text.match(/\{[\s\S]*?\}/)
    if (!match) throw new Error('Resposta inválida do modelo')
    const json = JSON.parse(match[0])

    // Normaliza valor para número
    if (typeof json.valor === 'string') {
      json.valor = parseFloat(json.valor.replace(',', '.')) || 0
    }

    return res.json(json)
  } catch (e) {
    console.error('[ocr-receipt] error:', e.message)
    return res.status(500).json({
      error: e.message,
      descricao: '',
      valor: 0,
      data: new Date().toISOString().slice(0, 10),
      categoria: 'outros'
    })
  }
}
