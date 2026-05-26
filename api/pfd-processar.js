/* global process, Buffer */
// api/pfd-processar.js
// Orquestra a extração de planos de manutenção de PDFs técnicos.

import { createClient } from '@supabase/supabase-js'
import { extrairComGemini } from './_pfd/gemini.js'
import { extrairComOpenAIProvider } from './_pfd/openai.js'
import { validarExtracao } from './_pfd/validation.js'

const supabaseUrl        = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const geminiApiKey       = process.env.GEMINI_API_KEY
const openaiApiKey       = process.env.OPENAI_API_KEY

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function obterPdfBuffer({ modo, storage_path, url_pdf, pdf_base64, publicacao, L, sb }) {
  if (modo === 'storage') {
    if (!storage_path) throw new Error('storage_path obrigatório para modo storage')
    L(`baixando do storage: ${storage_path}`)
    const { data: fileBlob, error: fileErr } = await sb.storage.from('pfd-manuais').download(storage_path)
    if (fileErr) throw new Error('Erro ao baixar PDF do storage: ' + fileErr.message)
    return Buffer.from(await fileBlob.arrayBuffer())
  }

  if (modo === 'url') {
    const pdfUrl = url_pdf || publicacao?.url_pdf
    if (!pdfUrl) throw new Error('URL do PDF não informada')
    L(`baixando URL: ${pdfUrl}`)
    const pdfRes = await fetch(pdfUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartPro/1.0)', 'Accept': 'application/pdf,*/*' },
    })
    if (!pdfRes.ok) throw new Error(`Erro HTTP ${pdfRes.status} ao baixar PDF`)
    return Buffer.from(await pdfRes.arrayBuffer())
  }

  if (!pdf_base64) throw new Error('pdf_base64 obrigatório para modo upload')
  return Buffer.from(pdf_base64.replace(/^data:[^;]+;base64,/, ''), 'base64')
}

async function extrairPlano({ providerUsado, pdfBuffer, modeloEquip, fabricanteEquip, edicao, idioma, L }) {
  if (providerUsado === 'openai') {
    L('provider=openai → extraindo texto com pdf-parse (único pass 1-200)...')
    const openaiResult = await extrairComOpenAIProvider({
      pdfBuffer,
      modeloEquip,
      fabricanteEquip,
      edicao,
      idioma,
      openaiApiKey,
      L,
      label: 'OpenAI',
    })
    return {
      ...openaiResult,
      meta: { provider: 'openai', modelo_ai: 'gpt-4o-mini', modo_pdf: 'pdf-parse' },
    }
  }

  try {
    const geminiResult = await extrairComGemini({
      pdfBuffer,
      modelo: modeloEquip,
      fabricante: fabricanteEquip,
      geminiApiKey,
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      L,
    })
    const { resultado, meta } = geminiResult
    L(`Gemini: ${resultado.intervalos?.length || 0} intervalos extraídos`)
    return { resultado, paginasUsadas: null, meta }
  } catch (geminiErr) {
    L(`⚠️ Gemini falhou: ${geminiErr.message}`)
    if (!openaiApiKey) throw geminiErr
    L('Tentando fallback OpenAI + pdf-parse...')
    const fallbackResult = await extrairComOpenAIProvider({
      pdfBuffer,
      modeloEquip,
      fabricanteEquip,
      edicao,
      idioma,
      openaiApiKey,
      L,
      label: 'fallback OpenAI',
    })
    return {
      ...fallbackResult,
      meta: { provider: 'openai', modelo_ai: 'gpt-4o-mini', modo_pdf: 'pdf-parse', fallback_de: 'gemini' },
    }
  }
}

function criarPreviewPlano(intervalos) {
  return (intervalos || []).map(iv => {
    const paginas = (iv.tarefas || [])
      .map(t => t.pagina_fonte)
      .filter(p => p !== null && p !== undefined && p !== '')
    const paginaInicio = iv.pagina_inicio || (paginas.length ? paginas[0] : null)
    const paginaFim = iv.pagina_fim || (paginas.length ? paginas[paginas.length - 1] : null)

    return {
      h: iv.intervalo_horas,
      titulo: iv.titulo_intervalo,
      status_extracao: iv.status_extracao || 'ok',
      total_tarefas: iv.tarefas?.length || 0,
      pagina_inicio: paginaInicio,
      pagina_fim: paginaFim,
    }
  })
}

function normalizarEquipamentoResposta(equipamento, { publicacao, payload }) {
  return {
    marca: equipamento?.marca || publicacao?.fabricante || payload.fabricante || 'John Deere',
    modelo: equipamento?.modelo || publicacao?.modelo || payload.modelo || '',
    modelos_cobertos: Array.isArray(equipamento?.modelos_cobertos) ? equipamento.modelos_cobertos : [],
    codigo_manual: equipamento?.codigo_manual || equipamento?.manual || publicacao?.codigo_pub || payload.codigo_pub || '',
    manual: equipamento?.manual || equipamento?.codigo_manual || publicacao?.codigo_pub || payload.codigo_pub || '',
    edicao: equipamento?.edicao || publicacao?.edicao || payload.edicao || '',
    idioma: equipamento?.idioma || publicacao?.idioma || payload.idioma || 'pt',
    regiao: equipamento?.regiao || publicacao?.edicao || payload.edicao || '',
    serie: equipamento?.serie || publicacao?.serie_inicio || payload.serie_inicio || '',
  }
}

async function criarOuPrepararPublicacao({ sb, publicacao_id, payload, L }) {
  if (publicacao_id) {
    L(`usando publicação existente: ${publicacao_id}`)
    await sb.from('pfd_publicacoes')
      .update({ status: 'processando', updated_at: new Date().toISOString() })
      .eq('id', publicacao_id)
    return publicacao_id
  }

  L('criando publicação no banco...')
  const { data: novaPub, error: pubErr } = await sb
    .from('pfd_publicacoes')
    .insert({
      workspace_id: payload.workspace_id,
      codigo_pub: payload.codigo_pub || null,
      titulo: payload.titulo || `Manual ${payload.fabricante || 'John Deere'} ${payload.modelo || ''}`.trim(),
      fabricante: payload.fabricante || 'John Deere',
      modelo: payload.modelo || '',
      familia: payload.familia || null,
      classificacao: payload.classificacao || 'Base Unit',
      serie_inicio: payload.serie_inicio || null,
      serie_fim: payload.serie_fim || null,
      edicao: payload.edicao || null,
      idioma: payload.idioma || 'pt',
      url_pdf: payload.url_pdf || null,
      status: 'processando',
    })
    .select()
    .single()

  if (pubErr) throw new Error('Erro ao criar publicação: ' + pubErr.message)
  L(`publicação criada: ${novaPub.id}`)
  return novaPub.id
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const inicioProcessamento = Date.now()
  const logTexto = []
  const logEtapas = []
  const L = (msg) => { logTexto.push(`[${new Date().toISOString().slice(11, 23)}] ${msg}`); console.log('[pfd]', msg) }
  const medirEtapa = async (etapa, fn) => {
    const inicio = Date.now()
    try {
      const data = await fn()
      logEtapas.push({ etapa, status: 'ok', tempo_ms: Date.now() - inicio })
      return data
    } catch (err) {
      logEtapas.push({ etapa, status: 'erro', tempo_ms: Date.now() - inicio, erro: err.message })
      throw err
    }
  }

  const payload = req.body || {}
  const {
    modo, url_pdf, pdf_base64, storage_path, workspace_id,
    publicacao_id: pubIdRecebido,
    fabricante, modelo, edicao, idioma,
  } = payload

  const providerUsado = process.env.AI_PROVIDER || 'gemini'
  L(`request: modo=${modo}, provider=${providerUsado}, workspace=${workspace_id}`)

  if (!modo || !['url', 'upload', 'storage'].includes(modo)) {
    return res.status(400).json({ error: 'Parâmetro modo inválido. Use: url | storage | upload', log: logEtapas, log_texto: logTexto })
  }
  if (!workspace_id) return res.status(400).json({ error: 'workspace_id obrigatório', log: logEtapas, log_texto: logTexto })

  const sb = getSupabase()
  let publicacao_id = pubIdRecebido

  try {
    publicacao_id = await criarOuPrepararPublicacao({ sb, publicacao_id, payload, L })

    const { data: publicacao } = await sb.from('pfd_publicacoes').select('*').eq('id', publicacao_id).single()
    const pdfBuffer = await medirEtapa('download_pdf', () => obterPdfBuffer({ modo, storage_path, url_pdf, pdf_base64, publicacao, L, sb }))
    L(`PDF obtido: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    const modeloEquip = publicacao?.modelo || modelo || ''
    const fabricanteEquip = publicacao?.fabricante || fabricante || 'John Deere'

    const { resultado, paginasUsadas, meta } = await medirEtapa(providerUsado === 'openai' ? 'openai_extract' : 'gemini_extract', () => extrairPlano({
      providerUsado,
      pdfBuffer,
      modeloEquip,
      fabricanteEquip,
      edicao,
      idioma,
      L,
    }))

    const validacao = await medirEtapa('validacao', async () => validarExtracao(resultado))
    resultado.alertas = validacao.alertas
    L(`validação: status=${validacao.statusGeral}, intervalos=${validacao.totalIntervalos} (${validacao.intervalosOk} ok), tarefas=${validacao.totalTarefas}`)
    if (validacao.temFalhaCritica) L('⚠️ FALHA EM INTERVALO CRÍTICO — salvo com alertas')

    resultado.equipamento = normalizarEquipamentoResposta(resultado.equipamento, { publicacao, payload })

    const modeloDetectado = resultado.equipamento?.modelo || ''
    const marcaDetectada = resultado.equipamento?.marca || ''
    const edicaoDetectada = resultado.equipamento?.edicao || ''
    const modeloFinal = modeloDetectado || modeloEquip
    const fabricanteFinal = marcaDetectada || fabricanteEquip

    if (modeloDetectado && modeloDetectado !== modeloEquip && !modeloEquip) {
      L(`Gemini detectou modelo: "${modeloDetectado}" — atualizando publicação`)
      await sb.from('pfd_publicacoes')
        .update({ modelo: modeloDetectado, fabricante: fabricanteFinal, edicao: edicaoDetectada || edicao || null })
        .eq('id', publicacao_id)
    }

    L('salvando plano no banco...')
    const { data: planoSalvo, error: planoErr } = await sb
      .from('pfd_planos')
      .insert({
        publicacao_id,
        workspace_id,
        modelo: modeloFinal,
        fabricante: fabricanteFinal,
        intervalos: resultado.intervalos,
        total_intervalos: validacao.totalIntervalos,
        total_tarefas: validacao.totalTarefas,
        paginas_usadas: paginasUsadas,
        extraido_em: new Date().toISOString(),
      })
      .select()
      .single()

    if (planoErr) throw new Error('Erro ao salvar plano: ' + planoErr.message)

    await sb.from('pfd_publicacoes')
      .update({ status: 'processado', updated_at: new Date().toISOString() })
      .eq('id', publicacao_id)

    L(`✅ concluído: plano_id=${planoSalvo.id} (provider=${providerUsado})`)

    return res.json({
      ok: true,
      plano_id: planoSalvo.id,
      publicacao_id,
      provider: meta?.provider || providerUsado,
      modelo_ai: meta?.modelo_ai || null,
      modo_pdf: meta?.modo_pdf || null,
      status_extracao: validacao.statusGeral,
      total_intervalos: validacao.totalIntervalos,
      total_tarefas: validacao.totalTarefas,
      intervalos_ok: validacao.intervalosOk,
      intervalos_condicionais: validacao.intervalosCondicionais,
      intervalos_falha: validacao.intervalosFalha,
      intervalos_nao_encontrados: validacao.intervalosNaoEncontrados,
      tem_falha_critica: validacao.temFalhaCritica,
      intervalos_criticos_falhando: validacao.intervalosCriticosFalhando,
      alertas: validacao.alertas,
      equipamento: resultado.equipamento,
      modelo_detectado: modeloDetectado || null,
      plano_preview: criarPreviewPlano(resultado.intervalos),
      log: logEtapas,
      log_texto: logTexto,
      tempo_processamento_ms: Date.now() - inicioProcessamento,
    })
  } catch (err) {
    L(`❌ ERRO: ${err.message}`)
    console.error('[pfd] stack:', err.stack)
    const httpStatus = err?.status || 500
    const errMsg = httpStatus === 429
      ? `Rate limit / quota: ${err?.error?.message || err.message}`
      : err.message

    if (publicacao_id) {
      await sb.from('pfd_publicacoes')
        .update({ status: 'erro', erro_msg: errMsg, updated_at: new Date().toISOString() })
        .eq('id', publicacao_id)
    }
    return res.status(500).json({
      error: errMsg,
      log: logEtapas,
      log_texto: logTexto,
      tempo_processamento_ms: Date.now() - inicioProcessamento,
    })
  }
}