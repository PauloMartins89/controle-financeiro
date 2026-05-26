import OpenAI from 'openai'
import { createRequire } from 'module'
import { legadoParaNovoSchema, mesclarIntervalos } from './schema.js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

export async function extrairComOpenAIProvider({ pdfBuffer, modeloEquip, fabricanteEquip, edicao, idioma, openaiApiKey, L, label = 'OpenAI' }) {
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY não configurada')

  const openai = new OpenAI({ apiKey: openaiApiKey })
  const paginas = await pdfParaTexto(pdfBuffer, { maxPagina: 200 })
  L(`pdf-parse: ${paginas.length} págs extraídas (1-200)`)
  if (paginas.length === 0) throw new Error('Nenhum texto extraído do PDF (pdf-parse)')

  const sumario = detectarSumario(paginas)
  if (sumario) L(`sumário detectado: pág ${sumario.paginaToc}, ${sumario.refs.length} refs`)
  else L('sumário não detectado — buscando por texto')

  const candidatas = localizarSecaoManutencao(paginas, sumario)
  L(`seção localizada: ${candidatas.length} páginas candidatas`)

  const paginasFiltradas = candidatas.length > 0
    ? [...candidatas].sort((a, b) => a.pagina - b.pagina).slice(0, 40)
    : paginas.slice(0, 20)
  const paginasUsadas = paginasFiltradas.map(p => p.pagina)
  L(`${label}: ${paginasFiltradas.length} págs candidatas → OpenAI [${paginasUsadas.join(', ')}]`)

  const extracaoRaw = await extrairPorPaginas(openai, paginasFiltradas, modeloEquip, L)
  L(`${label}: ${extracaoRaw.intervalos?.length || 0} intervalos`)

  return {
    resultado: legadoParaNovoSchema(extracaoRaw, fabricanteEquip, modeloEquip, edicao, idioma),
    paginasUsadas,
  }
}

async function openaiWithRetry(client, params, maxAttempts = 2) {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await client.chat.completions.create(params)
    } catch (err) {
      lastErr = err
      const status = err?.status || err?.response?.status
      const retriable = status === 429 || (status >= 500 && status < 600)
      if (!retriable || attempt === maxAttempts) throw err
      const retryAfter = Number(err?.headers?.['retry-after'] || 0)
      const delay = Math.min(
        retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 2000 + Math.floor(Math.random() * 1000),
        12000
      )
      console.log(`[pfd] OpenAI ${status} — aguardando ${Math.round(delay / 1000)}s (tentativa ${attempt}/${maxAttempts})`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

async function pdfParaTexto(pdfBuffer, opcoes = {}) {
  const { minPagina = 1, maxPagina = 9999 } = opcoes
  const paginas = []
  let paginaAtual = 0
  async function renderPage(pageData) {
    paginaAtual++
    if (paginaAtual > maxPagina) return ''
    if (paginaAtual < minPagina) return ''
    const textContent = await pageData.getTextContent()
    const texto = textContent.items.map(item => item.str || '').join(' ').replace(/\s+/g, ' ').trim()
    if (texto.length > 10) paginas.push({ pagina: paginaAtual, texto })
    return texto
  }
  const opts = { pagerender: renderPage }
  if (maxPagina < 9999) opts.max = maxPagina
  await pdfParse(pdfBuffer, opts)
  return paginas
}

function detectarSumario(paginas) {
  const TITULOS = [
    /tabela\s+de\s+intervalos\s+de\s+servi[çc]o/i,
    /manuten[çc][ãa]o\s*[—–-]\s*a\s+cada\s+\d/i,
    /manuten[çc][ãa]o\s*[—–-]\s*(diariamente|semanalmente|anualmente)/i,
    /maintenance\s+(interval|schedule)/i,
    /service\s+interval/i,
  ]
  for (const p of paginas) {
    const hits = TITULOS.filter(pat => pat.test(p.texto)).length
    if (hits >= 2) {
      const refs = [...p.texto.matchAll(/\b(\d{3}-\d{1,3})\b/g)].map(m => m[1])
      if (refs.length >= 3) {
        return { paginaToc: p.pagina, refs: [...new Set(refs)] }
      }
    }
  }
  return null
}

function localizarSecaoManutencao(paginas, sumario) {
  let candidatas = []

  if (sumario?.refs?.length > 0) {
    for (const p of paginas) {
      if (sumario.refs.some(ref => p.texto.includes(ref))) {
        candidatas.push(p)
      }
    }
  }

  if (candidatas.length < 3) {
    candidatas = paginas.filter(p =>
      /manuten[çc][ãa]o\s*[—–-]\s*(a\s+cada|diariamente|semanalmente)/i.test(p.texto) ||
      /tabela\s+de\s+intervalos\s+de\s+servi[çc]o/i.test(p.texto) ||
      /intervalos\s+de\s+servi[çc]o/i.test(p.texto) ||
      /service\s+interval\s+chart/i.test(p.texto)
    )
  }

  return candidatas
}

async function extrairComOpenAI(openai, textoBloco, modelo) {
  const res = await openaiWithRetry(openai, {
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Você é um especialista em extrair dados estruturados de manuais técnicos de equipamentos agrícolas John Deere. Responda APENAS com JSON válido.',
      },
      {
        role: 'user',
        content: `Abaixo está o texto extraído das páginas de manutenção do manual do operador do equipamento ${modelo || 'John Deere'}.

O texto pode estar desformatado (tabelas viram texto corrido). Identifique TODOS os intervalos de manutenção e TODAS as tarefas de cada intervalo.

Intervalos típicos John Deere: Amaciamento, Primeiras 600h, 10h/Diário, 50h/Semanal, 100h, 125h, 200h/Mensal, 250h, 400h, 500h, 750h, 1000h, 1500h/2 anos, 2000h/2 anos, Anual, 6000h/6 anos.

TEXTO DAS PÁGINAS DE MANUTENÇÃO (cada bloco começa com === PÁGINA N ===):
${textoBloco}

Retorne este JSON:
{
  "intervalos": [
    {
      "horas": 10,
      "nome": "Diariamente ou a cada 10 horas de operação",
      "tarefas": [
        {
          "sistema": "Motor",
          "componente": "Cárter",
          "tarefa": "Verificar nível do óleo do motor",
          "tipo": "verificacao",
          "insumo": "JD Plus-50 II",
          "quantidade": "10,2 L",
          "pagina": 120
        },
        {
          "sistema": "Motor",
          "componente": "Filtro de ar",
          "tarefa": "Verificar filtro de ar",
          "tipo": "verificacao",
          "pagina": 121,
          "condicional": true,
          "condicao": "Se equipado com pré-filtro"
        }
      ]
    }
  ]
}

Regras OBRIGATÓRIAS:
- Inclua TODOS os intervalos encontrados no texto — não resuma nem agrupe
- Para cada intervalo, inclua TODAS as tarefas listadas sem exceção
- "horas": número inteiro (Amaciamento=0, Primeiras 600h=600, Anual=1000, A cada 2 anos ou 1500h=1500, A cada 6 anos=6000)
- "sistema": Motor | Transmissão | Hidráulico | Eixo Dianteiro | Freios | Cabine | Combustível | Geral | outro
- "componente": SEMPRE infira a parte do equipamento envolvida: "Cárter" (óleo motor), "Filtro de óleo", "Filtro de ar", "Radiador", "Transmissão", "Diferencial", etc. — use "Geral" apenas se realmente não há componente específico
- "tipo": verificacao | troca | lubrificacao | limpeza | ajuste | inspecao | substituicao | outro
- "insumo": se o texto mencionar lubrificante, fluido ou peça, inclua exatamente ("JD Plus-50 II", "Hy-Gard", "Cool-Gard II") — OMITA apenas se não citado
- "quantidade": com unidade ("10,2 L", "500 g") — OMITA se não mencionado
- "pagina": número da página do marcador === PÁGINA N === de onde veio a tarefa — SEMPRE inclua
- "condicional"+"condicao": apenas se há condição explícita no texto ("se equipado", "somente quando") — OMITA se não condicional
- Omita apenas campos com valor false ou null; nunca omita "componente" ou "pagina"
- Se um intervalo não tiver tarefas identificáveis, omita-o`,
      },
    ],
    max_tokens: 16000,
    temperature: 0,
  })

  const choice = res.choices[0]
  if (choice?.finish_reason === 'length') {
    console.warn('[pfd] AVISO: resposta OpenAI truncada (max_tokens atingido)')
  }
  try {
    return JSON.parse(choice?.message?.content || '{}')
  } catch {
    return { intervalos: [] }
  }
}

async function extrairPorPaginas(openai, paginasFiltradas, modeloEquip, L) {
  if (paginasFiltradas.length === 0) return { intervalos: [] }

  const n = paginasFiltradas.length
  const c1 = Math.ceil(n / 3)
  const c2 = Math.ceil(2 * n / 3)
  const grupos = [
    paginasFiltradas.slice(0, c1),
    paginasFiltradas.slice(c1, c2),
    paginasFiltradas.slice(c2),
  ].filter(g => g.length > 0)

  const labels = grupos.map(g => `${g[0].pagina}-${g[g.length - 1].pagina}`)
  L(`extração: ${n} págs → ${grupos.length} grupos paralelos [${labels.join(' | ')}]`)

  const resultados = await Promise.all(grupos.map(grupo => {
    const texto = grupo.map(p => `=== PÁGINA ${p.pagina} ===\n${p.texto}`).join('\n\n')
    return extrairComOpenAI(openai, texto, modeloEquip)
  }))

  const totalBruto = resultados.reduce((acc, r) => acc + (r.intervalos?.length || 0), 0)
  L(`merge: ${totalBruto} intervalos brutos de ${resultados.length} grupos`)
  return { intervalos: mesclarIntervalos(resultados) }
}