import { runOCR } from './_ocr.js'

// POST /api/ocr-formulario
// Thin wrapper — lógica OCR em api/_ocr.js (compartilhada com webhook-whatsapp)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { imageBase64 } = req.body
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' })

    const json = await runOCR(imageBase64)
    return res.json(json)
  } catch (e) {
    console.error('[ocr-formulario] error:', e.message)
    return res.status(500).json({
      error: e.message,
      tipo_formulario: 'padrao',
      tipo: 'despesa',
      valor: 0,
      descricao: '',
      data: new Date().toISOString().slice(0, 10),
      categoria: 'Outros',
      centro_custo: '',
      observacoes: '',
    })
  }
}


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
            text: `Analise esta imagem de um formulário empresarial.

PASSO 1 — Identifique o tipo de formulário:
- Se contiver os campos "DIÁRIO DO MOTORISTA", "KM/HORAS", "ASFALTO", "TERRA", "PLACA" ou for da empresa Casagrande: tipo_formulario = "transporte"
- Caso contrário: tipo_formulario = "padrao"

PASSO 2A — Se for "transporte", retorne EXATAMENTE este JSON (sem texto adicional):
{
  "tipo_formulario": "transporte",
  "numero_diario": "<número do formulário/Nº>",
  "data": "<data no formato YYYY-MM-DD, use ${hoje} se ilegível>",
  "empresa": "<nome da empresa/cliente>",
  "setor": "<setor se houver>",
  "solicitante": "<nome do solicitante>",
  "cc": "<centro de custo/CC se houver>",
  "local_origem": "<local de origem>",
  "local_destino": "<local de destino>",
  "equipamento": "<equipamento transportado>",
  "placa": "<placa do veículo>",
  "veiculo": "<modelo/tipo do veículo>",
  "km_rows": [
    { "tipo": "ASFALTO", "saida": "<KM saída ou ''>", "entrada": "<KM entrada ou ''>", "total": "<total KM ou ''>" },
    { "tipo": "TERRA",   "saida": "",                  "entrada": "",                  "total": "" },
    { "tipo": "ASFALTO", "saida": "",                  "entrada": "",                  "total": "" },
    { "tipo": "TERRA",   "saida": "",                  "entrada": "",                  "total": "" },
    { "tipo": "ASFALTO", "saida": "",                  "entrada": "",                  "total": "" },
    { "tipo": "TERRA",   "saida": "",                  "entrada": "",                  "total": "" },
    { "tipo": "ASFALTO", "saida": "",                  "entrada": "",                  "total": "" },
    { "tipo": "TERRA",   "saida": "",                  "entrada": "",                  "total": "" }
  ],
  "horas_1": "<horas linha 1 ou ''>",
  "horas_1_desc": "",
  "horas_2": "<horas linha 2 ou ''>",
  "horas_2_desc": "",
  "diarias": "<diárias ou ''>",
  "valor_total": <valor numérico total, ex: 5950.00>,
  "observacao": "<observações ou ''>"
}

PASSO 2B — Se for "padrao", retorne EXATAMENTE este JSON (sem texto adicional):
{
  "tipo_formulario": "padrao",
  "tipo": "despesa",
  "valor": <valor numérico>,
  "descricao": "<descrição resumida, máx 80 chars>",
  "data": "<YYYY-MM-DD>",
  "categoria": "<Alimentação|Transporte|Saúde|Serviços|Material|Equipamento|Viagem|Comunicação|Manutenção|Outros>",
  "centro_custo": "",
  "observacoes": ""
}

Retorne APENAS o JSON, sem explicações.`
          }
        ]
      }],
      max_tokens: 800
    })

    const text = response.choices[0].message.content.trim()
    // Extrai JSON (pode ter texto antes/depois)
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Resposta inválida do modelo')
    const json = JSON.parse(match[0])

    // Normaliza valores numéricos
    if (json.tipo_formulario === 'transporte') {
      if (typeof json.valor_total === 'string') {
        json.valor_total = parseFloat(json.valor_total.replace(/[^\d,.]/g, '').replace(',', '.')) || 0
      }
      // Garante 8 km_rows
      if (!Array.isArray(json.km_rows)) json.km_rows = []
      while (json.km_rows.length < 8) {
        const tipo = json.km_rows.length % 2 === 0 ? 'ASFALTO' : 'TERRA'
        json.km_rows.push({ tipo, saida: '', entrada: '', total: '' })
      }
    } else {
      if (typeof json.valor === 'string') {
        json.valor = parseFloat(json.valor.replace(',', '.')) || 0
      }
      if (!json.tipo_formulario) json.tipo_formulario = 'padrao'
    }

    return res.json(json)
  } catch (e) {
    console.error('[ocr-formulario] error:', e.message)
    return res.status(500).json({
      error: e.message,
      tipo_formulario: 'padrao',
      tipo: 'despesa',
      valor: 0,
      descricao: '',
      data: new Date().toISOString().slice(0, 10),
      categoria: 'Outros',
      centro_custo: '',
      observacoes: '',
    })
  }
}
