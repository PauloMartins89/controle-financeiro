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

// ── Baixa PDF e converte para array de páginas base64 ──────────────────────
// Usa canvas nativo do Node.js via pdfjs-dist
async function pdfParaImagens(pdfBuffer, maxPaginas = 20) {
  // Importação dinâmica para não quebrar se não instalado
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(() => null)
  if (!pdfjsLib) {
    throw new Error('pdfjs-dist não instalado. Instale com: npm install pdfjs-dist')
  }

  // Desabilita worker para ambiente Node (serverless)
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) })
  const pdfDoc = await loadingTask.promise
  const numPages = Math.min(pdfDoc.numPages, maxPaginas)

  const paginas = []
  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })

    // Usa OffscreenCanvas se disponível, senão usa canvas npm package
    let canvas
    try {
      canvas = new OffscreenCanvas(viewport.width, viewport.height)
    } catch (_) {
      const { createCanvas } = await import('canvas').catch(() => ({ createCanvas: null }))
      if (!createCanvas) throw new Error('Canvas não disponível. Instale "canvas": npm install canvas')
      canvas = createCanvas(viewport.width, viewport.height)
    }

    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise

    // Converte para base64 JPEG
    const blob = canvas.toBuffer ? canvas.toBuffer('image/jpeg', { quality: 0.85 }) : null
    if (blob) {
      paginas.push({ pagina: i, base64: blob.toString('base64') })
    }
  }

  return paginas
}

// ── Identifica páginas de intervalos de manutenção ─────────────────────────
// Envia uma amostra de páginas ao Groq para identificar quais contêm tabelas de manutenção
async function identificarPaginasManutencao(groq, paginas) {
  // Amostra: verifica até 8 páginas distribuídas pelo documento
  const step = Math.max(1, Math.floor(paginas.length / 8))
  const amostra = paginas.filter((_, i) => i % step === 0).slice(0, 8)

  const promises = amostra.map(async (p) => {
    const imgUrl = `data:image/jpeg;base64,${p.base64}`
    const res = await groqWithRetry(groq, {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imgUrl } },
          {
            type: 'text',
            text: `Esta página contém uma tabela de INTERVALOS DE MANUTENÇÃO (serviço periódico em horas: 10h, 50h, 100h, 250h, 500h, etc.) de um manual de equipamento?\nResponda apenas: sim | nao`,
          },
        ],
      }],
      max_tokens: 5,
      temperature: 0,
    })
    const answer = res.choices[0]?.message?.content?.trim().toLowerCase() || 'nao'
    return { pagina: p.pagina, isManutencao: answer.includes('sim') }
  })

  const resultados = await Promise.all(promises)
  return resultados.filter(r => r.isManutencao).map(r => r.pagina)
}

// ── Extrai intervalos de manutenção de uma página ──────────────────────────
async function extrairIntervalosDaPagina(groq, pageBase64, modelo) {
  const imgUrl = `data:image/jpeg;base64,${pageBase64}`

  const res = await groqWithRetry(groq, {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imgUrl } },
        {
          type: 'text',
          text: `Você está analisando uma página do manual do operador do equipamento ${modelo || 'John Deere'}.
Extraia a tabela de intervalos de manutenção periódica e retorne APENAS este JSON (sem texto adicional):
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
- Inclua TODOS os intervalos visíveis (10h, 25h, 50h, 100h, 250h, 500h, 1000h, 1500h, 2000h, anual, etc.)
- Para cada tarefa: extraia sistema (ex: Motor, Transmissão, Hidráulico), descrição da tarefa, código do lubrificante/fluido se indicado, capacidade e unidade se presentes
- Se a página não tiver tabela de manutenção, retorne: {"intervalos": []}
- Responda SOMENTE o JSON, sem markdown`,
        },
      ],
    }],
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

  const {
    modo, url_pdf, pdf_base64, workspace_id,
    // publicacao_id pode vir pronto OU os dados do form para criar aqui
    publicacao_id: pubIdRecebido,
    codigo_pub, titulo, fabricante, modelo,
    familia, classificacao, serie_inicio, serie_fim,
    edicao, idioma,
  } = req.body || {}

  if (!modo || !['url', 'upload'].includes(modo)) {
    return res.status(400).json({ error: 'Parâmetro modo inválido. Use: url | upload' })
  }
  if (!workspace_id) return res.status(400).json({ error: 'workspace_id obrigatório' })

  const sb = getSupabase()
  const groq = new Groq({ apiKey: groqApiKey })

  // ── Cria ou usa a publicação ──────────────────────────────────────────────
  let publicacao_id = pubIdRecebido
  if (!publicacao_id) {
    // Frontend passou os dados do form — criamos aqui com SERVICE_KEY (sem RLS)
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
    if (pubErr) return res.status(500).json({ error: 'Erro ao criar publicação: ' + pubErr.message })
    publicacao_id = novaPub.id
  } else {
    // Atualiza status → processando
    await sb.from('pfd_publicacoes')
      .update({ status: 'processando', updated_at: new Date().toISOString() })
      .eq('id', publicacao_id)
  }

  let pdfBuffer
  let publicacao = null

  try {
    // ── Carrega dados da publicação ────────────────────────────────────────
    if (publicacao_id) {
      const { data } = await sb.from('pfd_publicacoes').select('*').eq('id', publicacao_id).single()
      publicacao = data
    }

    // ── Obtém o PDF ───────────────────────────────────────────────────────
    if (modo === 'url') {
      const pdfUrl = url_pdf || publicacao?.url_pdf
      if (!pdfUrl) throw new Error('URL do PDF não informada')
      const pdfRes = await fetch(pdfUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartPro/1.0)',
          'Accept': 'application/pdf,*/*',
        },
      })
      if (!pdfRes.ok) throw new Error(`Erro ao baixar PDF: HTTP ${pdfRes.status}`)
      pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
    } else {
      // upload: base64 → buffer
      if (!pdf_base64) throw new Error('pdf_base64 obrigatório para modo upload')
      const b64 = pdf_base64.replace(/^data:[^;]+;base64,/, '')
      pdfBuffer = Buffer.from(b64, 'base64')
    }

    // ── Converte PDF → imagens ─────────────────────────────────────────────
    const paginas = await pdfParaImagens(pdfBuffer, 30)

    if (paginas.length === 0) throw new Error('Não foi possível converter o PDF em imagens')

    // ── Identifica páginas de manutenção ──────────────────────────────────
    const paginasManutencao = await identificarPaginasManutencao(groq, paginas)

    // Se não encontrou nenhuma na amostra, processa todas até 15
    const paginasParaProcessar = paginasManutencao.length > 0
      ? paginas.filter(p => paginasManutencao.includes(p.pagina))
      : paginas.slice(0, 15)

    // ── Extrai intervalos de cada página ──────────────────────────────────
    const modelo = publicacao?.modelo || req.body?.modelo || 'John Deere'
    const extracoesPromises = paginasParaProcessar.map(p =>
      extrairIntervalosDaPagina(groq, p.base64, modelo)
    )
    const extracoes = await Promise.all(extracoesPromises)

    // ── Mescla todos os intervalos ────────────────────────────────────────
    const intervalos = mesclarIntervalos(extracoes)
    const totalIntervalos = intervalos.length
    const totalTarefas = intervalos.reduce((acc, iv) => acc + (iv.tarefas?.length || 0), 0)

    // ── Salva no banco ────────────────────────────────────────────────────
    const planoData = {
      publicacao_id: publicacao_id || null,
      workspace_id,
      modelo: publicacao?.modelo || req.body?.modelo,
      fabricante: publicacao?.fabricante || 'John Deere',
      intervalos,
      total_intervalos: totalIntervalos,
      total_tarefas: totalTarefas,
      paginas_usadas: paginasParaProcessar.map(p => p.pagina),
      extraido_em: new Date().toISOString(),
    }

    const { data: planoSalvo, error: planoErr } = await sb
      .from('pfd_planos')
      .insert(planoData)
      .select()
      .single()

    if (planoErr) throw new Error(`Erro ao salvar plano: ${planoErr.message}`)

    // Atualiza publicação → processado
    if (publicacao_id) {
      await sb.from('pfd_publicacoes').update({
        status: 'processado',
        paginas_total: paginas.length,
        updated_at: new Date().toISOString(),
      }).eq('id', publicacao_id)
    }

    return res.json({
      ok: true,
      plano_id: planoSalvo.id,
      total_intervalos: totalIntervalos,
      total_tarefas: totalTarefas,
      paginas_processadas: paginasParaProcessar.length,
      intervalos,
    })

  } catch (err) {
    console.error('[pfd-processar]', err)

    // Atualiza publicação → erro
    if (publicacao_id) {
      await sb.from('pfd_publicacoes').update({
        status: 'erro',
        erro_msg: err.message,
        updated_at: new Date().toISOString(),
      }).eq('id', publicacao_id)
    }

    return res.status(500).json({ error: err.message })
  }
}
