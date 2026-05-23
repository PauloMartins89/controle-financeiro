import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

async function imageUrlToBase64(url) {
  const resp = await fetch(url)
  const buffer = await resp.arrayBuffer()
  const mimeType = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0]
  return { inlineData: { mimeType, data: Buffer.from(buffer).toString('base64') } }
}

async function callGemini(apiKey, parts) {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  )
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Gemini API error ${resp.status}: ${err.slice(0, 400)}`)
  }
  const json = await resp.json()
  return json.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analisar-template
// Analisa a imagem de um Tipo de Boletim via GPT-4o Vision e popula campos_json
//
// Body: { boletimTipoId: "uuid" }
// Retorna: { ok: true, campos: { ... } }
// ─────────────────────────────────────────────────────────────────────────────

const supabaseUrl        = process.env.SUPABASE_URL        || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const geminiApiKey       = process.env.GEMINI_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'supabase_not_configured' })
  }
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'gemini_not_configured', detail: 'GEMINI_API_KEY não configurada no servidor' })
  }

  const { boletimTipoId } = req.body || {}
  if (!boletimTipoId) return res.status(400).json({ error: 'boletimTipoId obrigatório' })

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    realtime: { params: { log_level: 'disabled' }, transport: ws },
    global: {},
  })

  // Carrega o tipo de boletim
  const { data: tipo, error: tipoErr } = await supabase
    .from('maquinas_boletim_tipos')
    .select('id, nome, imagem_url')
    .eq('id', boletimTipoId)
    .single()

  if (tipoErr || !tipo) {
    return res.status(404).json({ error: 'tipo_nao_encontrado', detail: tipoErr?.message })
  }
  if (!tipo.imagem_url) {
    return res.status(400).json({ error: 'sem_imagem', detail: 'Cadastre uma imagem template antes de analisar' })
  }

  const systemPrompt = `Você é um sistema especializado em análise de formulários físicos de apontamento de máquinas e equipamentos.
Analise a imagem do formulário em branco e identifique TODOS os campos preenchíveis.
Para cada campo, retorne um objeto JSON com a chave sendo um identificador em snake_case simples (sem acentos) e o valor sendo:
  { "label": "TEXTO EXATO DO LABEL NO FORMULÁRIO", "tipo": "TIPO" }

Tipos possíveis:
- "data"          → campo de data
- "colaborador"   → nome do operador/colaborador
- "equipamento"   → código ou nome do equipamento/máquina
- "classe"        → classe operacional do equipamento
- "frente"        → frente de trabalho / local
- "numero"        → valor numérico (horas, quantidades, horímetro, litros, km)
- "texto"         → texto livre (observações, descrições, atividades, CDC, turno, checklist OK/NÃO)

Retorne APENAS o JSON, sem explicações, sem markdown.
Exemplo:
{
  "data": { "label": "DATA:", "tipo": "data" },
  "colaborador": { "label": "NOME DO COLABORADOR:", "tipo": "colaborador" },
  "equipamento": { "label": "EQUIPAMENTO:", "tipo": "equipamento" }
}`

  let campos = {}
  try {
    const imagePart = await imageUrlToBase64(tipo.imagem_url)
    const parts = [
      { text: systemPrompt },
      { text: `Analise este formulário de boletim "${tipo.nome}" e mapeie todos os campos preenchíveis.` },
      imagePart,
    ]
    const rawText = await callGemini(geminiApiKey, parts)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    campos = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  } catch (e) {
    console.error('[analisar-template] gemini error:', e.message)
    return res.status(500).json({ error: 'gemini_error', detail: e.message })
  }

  if (!Object.keys(campos).length) {
    return res.status(422).json({ error: 'sem_campos', detail: 'GPT não conseguiu identificar campos no template' })
  }

  // Salva campos_json no banco
  const { error: updErr } = await supabase
    .from('maquinas_boletim_tipos')
    .update({ campos_json: campos })
    .eq('id', boletimTipoId)

  if (updErr) {
    return res.status(500).json({ error: 'db_error', detail: updErr.message })
  }

  return res.status(200).json({ ok: true, campos, total: Object.keys(campos).length })
}
