/**
 * api/ocr-test-image.js
 *
 * Endpoint de TESTE para benchmark OCR — não usar em produção para processamento de boletins.
 * Aceita uma imagem via URL ou base64 e retorna o JSON extraído pelo Gemini.
 *
 * Autenticação: header `x-test-token: <SUPABASE_SERVICE_KEY>`
 *
 * POST /api/ocr-test-image
 * Body: { imageUrl?: string, imageBase64?: string, mimeType?: string }
 * Response: { ocr: {...}, tempo_ms: number }
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const SYSTEM_PROMPT = [
  'Você é um sistema de OCR especializado em formulários de apontamento de máquinas e Relatório Diário de Obra.',
  'Extraia os campos do formulário da imagem e retorne um JSON com as chaves exatamente como listadas.',
  'ATENÇÃO ESPECIAL: o campo numero_documento é o número isolado impresso em destaque no CANTO SUPERIOR DIREITO do formulário, dentro de uma caixa/quadro. Ele SEMPRE existe e deve ser extraído.',
  'Para campos não preenchidos ou ilegíveis, use null.',
  'Retorne APENAS o JSON, sem explicações.',
].join(' ')

const USER_PROMPT = `Extraia TODOS os dados deste formulário de apontamento/diário. Retorne um JSON com as seguintes chaves (use null se o campo não existir ou estiver ilegível):
- numero_documento: OBRIGATÓRIO — número de 4 a 6 dígitos PRÉ-IMPRESSO (não manuscrito) no CANTO SUPERIOR DIREITO do formulário, dentro de uma caixa/quadro retangular com borda. Exemplo de posição: ao lado ou abaixo do título "DIÁRIO DO MOTORISTA" ou "Nº". Leia com MÁXIMA ATENÇÃO cada dígito — dígitos comumente confundidos: 7 com 9, 0 com 6, 1 com 7. O número costuma ter 5 dígitos (ex: 81772, 01234). Extraia SOMENTE os dígitos como string. NÃO retorne null.
- data: data do boletim (DD/MM/YYYY)
- turno: "dia", "noite" ou "integral" conforme marcado
- empresa: nome da empresa/cliente no campo ESPECÍFICO "EMPRESA:" do formulário (linha com label). NÃO confundir com o nome do fabricante do formulário impresso no cabeçalho (ex: CASAGRANDE, SINCO, BIRIGUI). O campo empresa é o nome preenchido na linha "EMPRESA:" pelo usuário.
- colaborador: nome do operador, colaborador ou motorista principal
- solicitante: nome do solicitante ou responsável pela emissão
- equipamento: código ou nome do equipamento (ex: EH-22, J Po-01, Hidrojato 10.000 PSI)
- modelo: modelo do equipamento (se informado separadamente)
- classe_operacional: classe/tipo do equipamento
- frente: local ou frente de trabalho (campo "SETOR" ou "FRENTE")
- cdc: centro de custo (campo "CC" ou "CDC")
- local_origem: local, cidade ou endereço de origem/saída do veículo ou serviço
- local_destino: local, cidade ou endereço de destino/chegada do veículo ou serviço
- condutor: nome do motorista/condutor (se houver campo específico separado de colaborador)
- placa: placa do veículo. Formato Mercosul: 3 letras + 1 dígito + 1 letra + 2 dígitos (ex: ABC1D23, QAY2B18). IMPORTANTE: a 5ª posição é SEMPRE uma letra do alfabeto, nunca um dígito — Y ≠ 4, B ≠ 8, D ≠ 0, Q ≠ 0, G ≠ 6. Formato antigo: 3 letras + 4 dígitos.
- km_rows: IMPORTANTE — array com TODAS as linhas preenchidas da tabela de KM/HORAS do formulário. Cada objeto: { "tipo": "ASFALTO" | "TERRA" | "HORAS" | "DIÁRIAS", "saida": número ou null, "entrada": número ou null, "total": número ou null }. Extraia os números sem pontos/vírgulas de milhar. Retorne [] se não houver tabela.
- valor_total: valor total em reais do formulário (campo "VALOR RS", "VALOR R$" ou similar, geralmente próximo ao final do formulário antes das assinaturas). ATENÇÃO ao formato brasileiro: ponto como separador de milhar e vírgula como decimal (ex: "5.950,00" = 5950.0, "12.500,00" = 12500.0). Retorne somente o número decimal sem símbolo de moeda.
- km_ast: hodômetro na saída / km aferido (número, se houver campo direto separado da tabela)
- km_ter: hodômetro na chegada / km terminal (número, se houver campo direto)
- km_total: total de km percorridos (número, se houver campo direto)
- jornada_inicio: horário de início/HORA INICIAL (HH:MM)
- jornada_fim: horário de encerramento/HORA FINAL (HH:MM)
- jornada_total_horas: total de horas corridas ou HORAS ENVOLVIDAS (número decimal, ex: 1.0)
- horimetro_inicial: leitura inicial do horímetro (número)
- horimetro_final: leitura final do horímetro (número)
- horas_trabalhadas: total de horas trabalhadas (número)
- horas_disponiveis: horas disponíveis ou totais do turno (número)
- horas_espera: horas em espera ou ociosas (número)
- atividade_realizada: atividade ou serviço realizado (resumo)
- descritivo_trabalho: descrição detalhada do serviço (campo "DESCRIÇÃO DO SERVIÇO" ou similar)
- observacoes: observações, ocorrências ou anomalias
- produtividade_quantidade: quantidade produzida (número)
- produtividade_unidade: unidade de medida (ex: m3, ton)
- responsavel_birigui_nome: responsável da empresa executora
- responsavel_birigui_matricula: matrícula do responsável
- responsavel_cliente_nome: responsável do cliente
- responsavel_cliente_matricula: matrícula do responsável do cliente
- cliente: razão social do cliente (se diferente de empresa)
- unidade_empresa: unidade/filial/localidade
- cidade_estado: cidade e estado (ex: "Três Lagoas/MS")
- telefone: telefone de contato
- equipe_diurna: membros da equipe diurna separados por ponto-e-vírgula
- equipe_noturna: membros da equipe noturna
- acessorios_utilizados: acessórios e materiais utilizados
- local_servico: campo "LOCAL DE REALIZAÇÃO DOS SERVIÇOS" ou similar
- setores: array com os nomes dos setores/áreas com checkbox marcado. Retorne [].
- linhas_jornada: array de linhas da tabela Jornada de Trabalho. Cada objeto: { "data": "DD/MM/AA", "e1": "HH:MM", "s1": "HH:MM", "e2": "HH:MM ou null", "s2": "HH:MM ou null", "total": "HH:MM", "servico": "descrição" }. Retorne [].
- assinatura_cliente: nome por extenso na linha de assinatura do cliente/recebedor
- assinatura_empresa: nome por extenso na linha de assinatura da empresa/entregador
Retorne APENAS o JSON, sem comentários.`

export default async function handler(req, res) {
  // Aceita apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' })
  }

  // Autenticação simples via service key
  const token = req.headers['x-test-token']
  if (!token || token !== process.env.SUPABASE_SERVICE_KEY) {
    return res.status(401).json({ error: 'Não autorizado.' })
  }

  const geminiApiKey = process.env.GEMINI_API_KEY
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não configurada.' })
  }

  const { imageUrl, imageBase64, mimeType = 'image/jpeg' } = req.body || {}
  if (!imageUrl && !imageBase64) {
    return res.status(400).json({ error: 'Forneça imageUrl ou imageBase64 no body.' })
  }

  const inicio = Date.now()

  try {
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 16384 },
      systemInstruction: SYSTEM_PROMPT,
    })

    // Prepara a parte de imagem
    let imagePart
    if (imageBase64) {
      imagePart = { inlineData: { mimeType, data: imageBase64 } }
    } else {
      // Baixa a imagem via URL
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) throw new Error(`Erro ao baixar imagem (${imgRes.status}): ${imageUrl}`)
      const buf = await imgRes.arrayBuffer()
      const mime = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0]
      imagePart = { inlineData: { mimeType: mime, data: Buffer.from(buf).toString('base64') } }
    }

    // Retry 3x em 503/429 (igual à produção)
    const MAX_ATTEMPTS = 3
    let lastErr, result
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        result = await model.generateContent([{ text: USER_PROMPT }, imagePart])
        break
      } catch (err) {
        lastErr = err
        const retryable = /503|529|overloaded|unavailable|429|quota/i.test(err.message)
        if (retryable && attempt < MAX_ATTEMPTS) {
          const delay = attempt * 8000
          console.warn(`[ocr-test] tentativa ${attempt} falhou, aguardando ${delay/1000}s...`)
          await new Promise(r => setTimeout(r, delay))
        } else throw err
      }
    }
    if (!result) throw lastErr

    let ocr = JSON.parse(result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim())

    // Gemini pode retornar array com múltiplos objetos — pega o mais rico
    if (Array.isArray(ocr)) {
      const count = obj => Object.values(obj || {}).filter(v => v != null).length
      ocr = ocr.reduce((best, cur) => count(cur) > count(best) ? cur : best, {})
    }

    const tempo_ms = Date.now() - inicio
    return res.status(200).json({ ocr, tempo_ms })
  } catch (e) {
    console.error('[ocr-test-image] erro:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
