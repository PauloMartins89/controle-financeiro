// api/pfd-processar.js
// Importa e processa PDF de manual técnico John Deere
// Extrai intervalos de manutenção via Groq vision (Llama 4)
//
// Modos de entrada (JSON body):
//   { modo: 'url',    url_pdf, publicacao_id, workspace_id }
//   { modo: 'upload', pdf_base64, publicacao_id, workspace_id }
//
// Fluxo:
//   1. Obtém o PDF (baixa URL ou usa base64 enviado)
//   2. Converte páginas para imagens base64 via pdfjs-dist (server-side)
//   3. Envia páginas relevantes ao Groq vision
//   4. Extrai JSON com intervalos + tarefas de manutenção
//   5. Salva em pfd_planos + atualiza status em pfd_publicacoes

import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
// Usa o lib interno do pdf-parse v1.1.1 para evitar leitura de arquivo de
// teste no carregamento do módulo (bug conhecido do index.js do pacote).
// pdf-parse v1 usa pdfjs-dist v2 internamente — sem Worker nem DOMMatrix.
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

const supabaseUrl        = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
const groqApiKey         = process.env.GROQ_API_KEY

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// ── Groq com retry/backoff ──────────────────────────────────────────────────
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
      const delay = Math.pow(2, attempt - 1) * 1000 + Math.floor(Math.random() * 500)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

// ── Extrai texto por página via pdf-parse (Node.js nativo, sem worker/DOM) ─────
async function pdfParaTexto(pdfBuffer, maxPaginas = 40) {
  const paginas = []
  let paginaAtual = 0

  async function renderPage(pageData) {
    paginaAtual++
    if (paginaAtual > maxPaginas) return ''
    const textContent = await pageData.getTextContent()
    const texto = textContent.items.map(item => item.str || '').join(' ').replace(/\s+/g, ' ').trim()
    if (texto.length > 10) paginas.push({ pagina: paginaAtual, texto })
    return texto
  }

  await pdfParse(pdfBuffer, { pagerender: renderPage })
  return paginas
}

// ── Identifica páginas de manutenção por palavras-chave (sem Groq, instantâneo) ──
function identificarPaginasManutencao(paginas) {
  const KEYWORDS = [
    '10 h', '50 h', '100 h', '250 h', '500 h', '1000 h', '1500 h', '2000 h',
    '10h', '50h', '100h', '250h', '500h', '1000h',
    'intervalo de manutenção', 'serviço periódico', 'manutenção periódica',
    'lubrificação', 'troca de óleo', 'verificar nível', 'drenar', 'filtro de óleo',
    'óleo do motor', 'fluido hidráulico', 'graxa', 'lubrificar',
  ]
  return paginas.filter(p => {
    const lower = p.texto.toLowerCase()
    const matches = KEYWORDS.filter(kw => lower.includes(kw.toLowerCase())).length
    return matches >= 2
  })
}

// ── Extrai intervalos de manutenção de uma página (texto → Groq LLM) ────────
async function extrairIntervalosDaPagina(groq, texto, modelo) {
  const res = await groqWithRetry(groq, {
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'Você é um especialista em extrair dados de manuais técnicos de equipamentos agrícolas. Responda APENAS com JSON válido, sem texto adicional, sem markdown.',
      },
      {
        role: 'user',
        content: `Analise o texto abaixo de uma página do manual do operador do equipamento ${modelo || 'John Deere'} e extraia os intervalos de manutenção periódica.

TEXTO DA PÁGINA:
${texto.slice(0, 6000)}

Retorne APENAS este JSON:
{
  "intervalos": [
    {
      "horas": 10,
      "nome": "A cada 10 horas ou diariamente",
      "tarefas": [
        {
          "sistema": "Motor",
          "tarefa": "Verificar nível do óleo do motor",
          "codigo_lubrificante": "JD Plus-50 II",
          "capacidade": "",
          "unidade": ""
        }
      ]
    }
  ]
}

Regras:
- Inclua TODOS os intervalos (10h, 25h, 50h, 100h, 250h, 500h, 1000h, 1500h, 2000h, anual, etc.)
- Para cada tarefa: sistema, descrição, código do lubrificante, capacidade e unidade se presentes
- Se não houver tabela de manutenção no texto, retorne: {"intervalos": []}`,
      },
    ],
    max_tokens: 4000,
    temperature: 0,
  })

  const raw = res.choices[0]?.message?.content?.trim() || ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return { intervalos: [] }

  try {
    return JSON.parse(match[0])
  } catch (_) {
    return { intervalos: [] }
  }
}

// ── Mescla intervalos de múltiplas páginas ──────────────────────────────────
function mesclarIntervalos(lista) {
  const mapa = {}
  for (const item of lista) {
    for (const iv of (item.intervalos || [])) {
      const key = String(iv.horas)
      if (!mapa[key]) {
        mapa[key] = { ...iv, tarefas: [] }
      }
      // Evita duplicatas de tarefas pelo texto
      for (const t of (iv.tarefas || [])) {
        const exists = mapa[key].tarefas.some(
          ex => ex.tarefa?.toLowerCase() === t.tarefa?.toLowerCase()
        )
        if (!exists) mapa[key].tarefas.push(t)
      }
    }
  }
  return Object.values(mapa).sort((a, b) => Number(a.horas) - Number(b.horas))
}

// ── Handler principal ───────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const log = []
  const L = (msg) => { log.push(`[${new Date().toISOString().slice(11,23)}] ${msg}`); console.log('[pfd]', msg) }

  const {
    modo, url_pdf, pdf_base64, storage_path, workspace_id,
    publicacao_id: pubIdRecebido,
    codigo_pub, titulo, fabricante, modelo,
    familia, classificacao, serie_inicio, serie_fim,
    edicao, idioma,
  } = req.body || {}

  L(`request recebido: modo=${modo}, workspace_id=${workspace_id}, storage_path=${storage_path}`)

  if (!modo || !['url', 'upload', 'storage'].includes(modo)) {
    return res.status(400).json({ error: 'Parâmetro modo inválido. Use: url | storage | upload', log })
  }
  if (!workspace_id) return res.status(400).json({ error: 'workspace_id obrigatório', log })

  const sb = getSupabase()
  const groq = new Groq({ apiKey: groqApiKey })

  // ── Cria ou usa a publicação ──────────────────────────────────────────────
  let publicacao_id = pubIdRecebido
  if (!publicacao_id) {
    L('criando publicação no banco...')
    const { data: novaPub, error: pubErr } = await sb
      .from('pfd_publicacoes')
      .insert({
        workspace_id,
        codigo_pub: codigo_pub || null,
        titulo: titulo || `Manual ${fabricante || 'John Deere'} ${modelo || ''}`.trim(),
        fabricante: fabricante || 'John Deere',
        modelo: modelo || '',
        familia: familia || null,
        classificacao: classificacao || 'Base Unit',
        serie_inicio: serie_inicio || null,
        serie_fim: serie_fim || null,
        edicao: edicao || null,
        idioma: idioma || 'pt',
        url_pdf: url_pdf || null,
        status: 'processando',
      })
      .select()
      .single()
    if (pubErr) {
      L(`ERRO ao criar publicação: ${pubErr.message}`)
      return res.status(500).json({ error: 'Erro ao criar publicação: ' + pubErr.message, log })
    }
    publicacao_id = novaPub.id
    L(`publicação criada: ${publicacao_id}`)
  } else {
    L(`usando publicação existente: ${publicacao_id}`)
    await sb.from('pfd_publicacoes')
      .update({ status: 'processando', updated_at: new Date().toISOString() })
      .eq('id', publicacao_id)
  }

  let pdfBuffer
  let publicacao = null

  try {
    const { data } = await sb.from('pfd_publicacoes').select('*').eq('id', publicacao_id).single()
    publicacao = data

    // ── Obtém o PDF ───────────────────────────────────────────────────────
    if (modo === 'storage') {
      if (!storage_path) throw new Error('storage_path obrigatório para modo storage')
      L(`baixando PDF do storage: ${storage_path}`)
      const { data: fileBlob, error: fileErr } = await sb.storage
        .from('pfd-manuais')
        .download(storage_path)
      if (fileErr) throw new Error('Erro ao baixar PDF do storage: ' + fileErr.message)
      pdfBuffer = Buffer.from(await fileBlob.arrayBuffer())
      L(`PDF baixado do storage: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`)
    } else if (modo === 'url') {
      const pdfUrl = url_pdf || publicacao?.url_pdf
      if (!pdfUrl) throw new Error('URL do PDF não informada')
      L(`baixando PDF da URL: ${pdfUrl}`)
      const pdfRes = await fetch(pdfUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartPro/1.0)', 'Accept': 'application/pdf,*/*' },
      })
      if (!pdfRes.ok) throw new Error(`Erro ao baixar PDF: HTTP ${pdfRes.status}`)
      pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
      L(`PDF baixado da URL: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`)
    } else {
      if (!pdf_base64) throw new Error('pdf_base64 obrigatório para modo upload')
      const b64 = pdf_base64.replace(/^data:[^;]+;base64,/, '')
      pdfBuffer = Buffer.from(b64, 'base64')
      L(`PDF decodificado de base64: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`)
    }

    // ── Extrai texto ──────────────────────────────────────────────────────
    L('iniciando extração de texto (pdf-parse)...')
    const paginas = await pdfParaTexto(pdfBuffer, 40)
    L(`extração concluída: ${paginas.length} páginas com texto`)

    if (paginas.length === 0) throw new Error('Não foi possível extrair texto do PDF')

    // ── Filtra páginas de manutenção ──────────────────────────────────────
    const paginasManutencao = identificarPaginasManutencao(paginas)
    L(`keyword filter: ${paginasManutencao.length}/${paginas.length} páginas com termos de manutenção`)

    const paginasParaProcessar = paginasManutencao.length > 0
      ? paginasManutencao
      : paginas.slice(0, 20)
    L(`páginas para Groq: ${paginasParaProcessar.map(p => p.pagina).join(', ')}`)

    // ── Groq em lotes de 5 ────────────────────────────────────────────────
    const modeloEquip = publicacao?.modelo || req.body?.modelo || 'John Deere'
    L(`enviando para Groq (${paginasParaProcessar.length} páginas em lotes de 5)...`)
    const extracoes = []
    const LOTE = 5
    for (let i = 0; i < paginasParaProcessar.length; i += LOTE) {
      const lote = paginasParaProcessar.slice(i, i + LOTE)
      const resultados = await Promise.all(lote.map(p => extrairIntervalosDaPagina(groq, p.texto, modeloEquip)))
      extracoes.push(...resultados)
      const ivCount = resultados.reduce((a, r) => a + (r.intervalos?.length || 0), 0)
      L(`lote ${Math.floor(i / LOTE) + 1}: ${ivCount} intervalos encontrados`)
    }

    // ── Mescla e salva ────────────────────────────────────────────────────
    const intervalos = mesclarIntervalos(extracoes)
    const totalIntervalos = intervalos.length
    const totalTarefas = intervalos.reduce((acc, iv) => acc + (iv.tarefas?.length || 0), 0)
    L(`mesclagem: ${totalIntervalos} intervalos, ${totalTarefas} tarefas`)

    L('salvando plano no banco...')
    const { data: planoSalvo, error: planoErr } = await sb
      .from('pfd_planos')
      .insert({
        publicacao_id: publicacao_id || null,
        workspace_id,
        modelo: publicacao?.modelo || req.body?.modelo,
        fabricante: publicacao?.fabricante || 'John Deere',
        intervalos,
        total_intervalos: totalIntervalos,
        total_tarefas: totalTarefas,
        paginas_usadas: paginasParaProcessar.map(p => p.pagina),
        extraido_em: new Date().toISOString(),
      })
      .select()
      .single()

    if (planoErr) throw new Error(`Erro ao salvar plano: ${planoErr.message}`)

    await sb.from('pfd_publicacoes').update({
      status: 'processado',
      paginas_total: paginas.length,
      updated_at: new Date().toISOString(),
    }).eq('id', publicacao_id)

    L(`✅ concluído com sucesso: plano_id=${planoSalvo.id}`)
    return res.json({
      ok: true,
      plano_id: planoSalvo.id,
      total_intervalos: totalIntervalos,
      total_tarefas: totalTarefas,
      paginas_processadas: paginasParaProcessar.length,
      intervalos,
      log,
    })

  } catch (err) {
    L(`❌ ERRO: ${err.message}`)
    console.error('[pfd] stack:', err.stack)

    if (publicacao_id) {
      await sb.from('pfd_publicacoes').update({
        status: 'erro',
        erro_msg: err.message,
        updated_at: new Date().toISOString(),
      }).eq('id', publicacao_id)
    }

    return res.status(500).json({ error: err.message, log })
  }
}
