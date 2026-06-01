import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// POST /api/reprocessar-diario
// Reprocessa um lançamento diário usando Gemini Vision no comprovante original.
// Atualiza APENAS os campos que estiverem vazios/errados — não sobrescreve dados bons.

const supabaseUrl        = process.env.SUPABASE_URL        || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function callGemini(apiKey, imageUrl) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 2048 },
  })

  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`Erro ao baixar imagem: ${res.status}`)
  const buf = await res.arrayBuffer()
  const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]
  const imageData = { inlineData: { mimeType: mime, data: Buffer.from(buf).toString('base64') } }

  const prompt = `Analise este boletim/formulário de campo e extraia APENAS os campos listados abaixo.
Retorne SOMENTE JSON, sem texto adicional:
{
  "empresa": "<nome da empresa/cliente contratante>",
  "unidade_empresa": "<unidade, filial ou cidade/estado da empresa>",
  "numero_documento": "<número da ficha ou documento, somente dígitos>",
  "placa": "<placa do equipamento/veículo, ex: QAB7D45>",
  "equipamento": "<modelo/tipo do equipamento, ex: HJ-22>",
  "jornada_inicio": "<horário de início HH:MM ou null>",
  "jornada_fim": "<horário de fim HH:MM ou null>",
  "linhas_jornada": [
    { "e1": "<entrada 1 HH:MM ou ''>", "s1": "<saída 1 HH:MM ou ''>", "e2": "<entrada 2 ou ''>", "s2": "<saída 2 ou ''>", "total": "<total horas HH:MM ou ''>" }
  ],
  "responsavel_birigui_nome": "<nome do responsável pela Birigui/prestadora>",
  "responsavel_birigui_matricula": "<matrícula do responsável Birigui>",
  "responsavel_cliente_nome": "<nome do responsável pelo cliente>",
  "responsavel_cliente_matricula": "<matrícula do responsável cliente>",
  "local_servico": "<local de realização dos serviços>",
  "descricao_servico": "<descrição dos serviços realizados>"
}
Se um campo não estiver visível ou legível, use null ou string vazia.`

  const MAX = 3
  let lastErr
  for (let i = 1; i <= MAX; i++) {
    try {
      const result = await model.generateContent([{ text: prompt }, imageData])
      return JSON.parse(result.response.text())
    } catch (err) {
      lastErr = err
      const retry = /503|529|overloaded|unavailable|429|quota/i.test(err.message)
      if (retry && i < MAX) await new Promise(r => setTimeout(r, i * 6000))
      else throw err
    }
  }
  throw lastErr
}

// Retorna true se o valor é considerado "vazio" (ausente, placeholder)
function isEmpty(v) {
  if (v == null) return true
  const s = String(v).trim()
  return s === '' || s === '—' || s === '-' || s.toLowerCase() === 'null'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { lancamentoId, workspaceId } = req.body
  if (!lancamentoId) return res.status(400).json({ error: 'lancamentoId obrigatório' })

  const geminiApiKey = process.env.GEMINI_API_KEY
  if (!geminiApiKey) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada' })

  const db = getSupabase()
  if (!db) return res.status(500).json({ error: 'Supabase não configurado (falta SUPABASE_SERVICE_KEY)' })

  try {
    // 1. Carrega o lançamento
    const { data: lanc, error: lancErr } = await db
      .from('lancamentos')
      .select('id, comprovante_url, dados_extras, tipo_formulario')
      .eq('id', lancamentoId)
      .single()

    if (lancErr || !lanc) {
      return res.status(404).json({ error: 'Lançamento não encontrado' })
    }

    if (!lanc.comprovante_url) {
      return res.status(400).json({ error: 'Este lançamento não possui imagem para reprocessar' })
    }

    // 2. Chama Gemini Vision
    const ocr = await callGemini(geminiApiKey, lanc.comprovante_url)

    const extras = lanc.dados_extras || {}

    // 3. Monta patch — só substitui campos que estiverem vazios no atual
    const patch = {}

    const merge = (key, newVal, aliases = []) => {
      // Verifica no extras direto e aliases
      const currentVal = extras[key] || aliases.reduce((v, a) => v || extras[a], '')
      if (isEmpty(currentVal) && !isEmpty(newVal)) {
        patch[key] = String(newVal).trim()
      }
    }

    merge('cliente',                      ocr.empresa,                      ['empresa'])
    merge('empresa',                      ocr.empresa)
    merge('unidade_empresa',              ocr.unidade_empresa)
    merge('numero_documento',             ocr.numero_documento)
    merge('placa',                        ocr.placa)
    merge('equipamento',                  ocr.equipamento)
    merge('jornada_inicio',               ocr.jornada_inicio)
    merge('jornada_fim',                  ocr.jornada_fim)
    merge('responsavel_birigui_nome',     ocr.responsavel_birigui_nome)
    merge('responsavel_birigui_matricula',ocr.responsavel_birigui_matricula)
    merge('responsavel_cliente_nome',     ocr.responsavel_cliente_nome)
    merge('responsavel_cliente_matricula',ocr.responsavel_cliente_matricula)
    merge('local_origem',                 ocr.local_servico)
    merge('local_servico',                ocr.local_servico)

    // linhas_jornada: só atualiza se ausente e OCR retornou algo útil
    if (
      isEmpty(extras.jornada_inicio) &&
      Array.isArray(ocr.linhas_jornada) && ocr.linhas_jornada.length > 0 &&
      ocr.linhas_jornada.some(l => l.e1 || l.s1)
    ) {
      patch.linhas_jornada = ocr.linhas_jornada

      // Deriva jornada_inicio/fim das linhas se ainda não foram preenchidos
      if (!patch.jornada_inicio) {
        const firstLine = ocr.linhas_jornada.find(l => l.e1)
        if (firstLine?.e1) patch.jornada_inicio = firstLine.e1
      }
      if (!patch.jornada_fim) {
        const lastLine = [...ocr.linhas_jornada].reverse().find(l => l.s2 || l.s1)
        if (lastLine) patch.jornada_fim = lastLine.s2 || lastLine.s1
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.json({ ok: true, updated: 0, message: 'Nenhum campo novo identificado' })
    }

    // 4. Salva no Supabase
    const newExtras = { ...extras, ...patch, ocr_reprocessado_em: new Date().toISOString() }
    const { error: updateErr } = await db
      .from('lancamentos')
      .update({ dados_extras: newExtras, updated_at: new Date().toISOString() })
      .eq('id', lancamentoId)

    if (updateErr) throw updateErr

    return res.json({ ok: true, updated: Object.keys(patch).length, fields: Object.keys(patch), dados_extras: newExtras })
  } catch (err) {
    console.error('[reprocessar-diario] error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
