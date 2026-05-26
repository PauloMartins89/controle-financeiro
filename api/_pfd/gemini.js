import fs from 'fs'
import os from 'os'
import path from 'path'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAIFileManager } from '@google/generative-ai/server'
import { GEMINI_INLINE_LIMIT } from './constants.js'
import { buildGeminiPrompt } from './prompt.js'
import { expandGeminiCompact } from './schema.js'

export async function extrairComGemini({ pdfBuffer, modelo, fabricante, geminiApiKey, geminiModel, L }) {
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY não configurada')

  const mbSize = (pdfBuffer.length / 1024 / 1024).toFixed(2)
  L(`Gemini: PDF ${mbSize} MB`)

  const genAI = new GoogleGenerativeAI(geminiApiKey)
  const model = genAI.getGenerativeModel({
    model: geminiModel,
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 65536,
      temperature: 0,
      thinkingConfig: { thinkingBudget: 10000 },
    },
  })
  L(`Gemini model: ${geminiModel}`)

  const prompt = buildGeminiPrompt(modelo, fabricante)
  const pdfPart = await prepararPdfPart({ pdfBuffer, geminiApiKey, fabricante, modelo, mbSize, L })

  L('Enviando PDF + prompt ao Gemini...')
  const result = await model.generateContent([pdfPart, { text: prompt }])

  const usage = result.response.usageMetadata
  if (usage) {
    const thinkingTokens = usage.thoughtsTokenCount || 0
    const outputTokens = usage.candidatesTokenCount || 0
    L(`Gemini tokens: entrada=${usage.promptTokenCount}, thinking=${thinkingTokens}, saída=${outputTokens}, total=${usage.totalTokenCount}`)
    if (outputTokens >= 60000) L('⚠️ AVISO: saída próxima do limite máximo — possível truncamento')
  }

  const text = result.response.text()
  L(`Gemini respondeu: ${text.length} chars`)

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (parseErr) {
    L(`⚠️ JSON inválido (${parseErr.message}) — ${text.length} chars recebidos. Verificar limites de token.`)
    const match = text.match(/"iv"\s*:\s*(\[[\s\S]*)/)
    if (match) L('Tentando recuperação parcial do JSON...')
    throw new Error(`Resposta Gemini truncada (JSON inválido): ${parseErr.message}. Chars recebidos: ${text.length}. Tokens de saída: ${usage?.candidatesTokenCount || '?'}`, { cause: parseErr })
  }

  const expanded = expandGeminiCompact(parsed)
  L(`Gemini extraiu: ${expanded.intervalos.length} intervalos, ${expanded.intervalos.reduce((a, iv) => a + iv.tarefas.length, 0)} tarefas`)
  return expanded
}

async function prepararPdfPart({ pdfBuffer, geminiApiKey, fabricante, modelo, mbSize, L }) {
  if (pdfBuffer.length <= GEMINI_INLINE_LIMIT) {
    L('Modo: inline data')
    return { inlineData: { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') } }
  }

  L(`PDF ${mbSize} MB > 18 MB — usando Gemini File API`)
  const fileManager = new GoogleAIFileManager(geminiApiKey)
  const tmpPath = path.join(os.tmpdir(), `pfd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`)
  fs.writeFileSync(tmpPath, pdfBuffer)
  L(`Arquivo temporário: ${tmpPath}`)

  try {
    L('Enviando ao Gemini File API...')
    const upload = await fileManager.uploadFile(tmpPath, {
      mimeType: 'application/pdf',
      displayName: `${fabricante || 'JD'}_${modelo || ''}.pdf`,
    })
    L(`Upload concluído: ${upload.file.uri}`)

    let file = upload.file
    let retries = 0
    while (file.state === 'PROCESSING' && retries < 12) {
      await new Promise(r => setTimeout(r, 5000))
      file = await fileManager.getFile(file.name)
      retries++
      L(`File API estado: ${file.state} (${retries}/12)`)
    }
    if (file.state !== 'ACTIVE') {
      throw new Error(`Gemini File API: estado inesperado ${file.state}`)
    }

    return { fileData: { mimeType: 'application/pdf', fileUri: file.uri } }
  } finally {
    try { fs.unlinkSync(tmpPath) } catch (unlinkErr) {
      if (unlinkErr?.code !== 'ENOENT') L(`Aviso: não foi possível remover arquivo temporário: ${unlinkErr.message}`)
    }
  }
}