// api/_chamados-ia.js
// Serviço de classificação de mensagens por LLM (Groq / Llama)
// Retorna JSON padronizado com confiança, categoria e resumo.

const GROQ_API_KEY  = process.env.GROQ_API_KEY
const GROQ_MODEL    = 'meta-llama/llama-4-scout-17b-16e-instruct'
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_PROMPT = `Você é um classificador de mensagens de suporte técnico de rastreadores, telemetria e aplicativos agrícolas.

Analise o conjunto de mensagens enviadas por um usuário em um grupo de WhatsApp e classifique se trata-se de uma solicitação real de atendimento técnico.

Retorne SOMENTE um JSON válido no formato abaixo, sem texto extra:
{
  "eh_chamado": true,
  "confianca": 0.91,
  "categoria": "telemetria",
  "prioridade": "media",
  "resumo": "Descrição objetiva do problema relatado",
  "equipamento": "modelo do equipamento se mencionado, ou null",
  "veiculo_ou_maquina": "veículo ou máquina se mencionado, ou null",
  "local": "local se mencionado, ou null",
  "motivo": "motivo da classificação em 1 frase"
}

Categorias possíveis: telemetria, rastreador, aplicativo, sistema, instalacao, manutencao, sensor, equipamento, comunicacao, outros

Prioridades:
- critica: sistema parado, impossibilidade de operar, perda de dados críticos
- alta: falha funcional grave, afeta operação diretamente
- media: problema que afeta parcialmente, tem workaround
- baixa: dúvida, configuração, melhoria

Regras:
- Mensagens como "bom dia", "ok", "obrigado", "resolvido", "estou chegando" → eh_chamado: false, confianca: 0.95
- Mensagens informativas sem pedido de ação técnica → eh_chamado: false
- Apenas classifique como chamado se houver pedido explícito ou implícito de suporte técnico
- Confiança entre 0 e 1 (0.00 a 1.00)`

/**
 * Classifica se um conjunto de mensagens representa um chamado técnico real.
 * @param {string[]} mensagens - Textos das mensagens (contexto agrupado)
 * @param {object}  contexto   - { grupoNome, nomeRemetente }
 * @returns {object} resultado JSON da IA ou objeto de erro
 */
export async function classificarChamado(mensagens, contexto = {}) {
  if (!GROQ_API_KEY) {
    console.error('[_chamados-ia] GROQ_API_KEY não configurada')
    return { erro: 'GROQ_API_KEY não configurada' }
  }

  const texto = mensagens
    .map((m, i) => `Mensagem ${i + 1}: "${m}"`)
    .join('\n')

  const userPrompt = `Grupo: ${contexto.grupoNome || 'desconhecido'}
Remetente: ${contexto.nomeRemetente || 'desconhecido'}
Mensagens enviadas:
${texto}

Classifique se este conjunto de mensagens representa um chamado de suporte técnico.`

  const payloadEntrada = { mensagens, contexto }

  try {
    const resp = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens:  512,
        response_format: { type: 'json_object' },
      }),
    })

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '')
      console.error('[_chamados-ia] Groq erro HTTP', resp.status, errBody)
      return { erro: `Groq HTTP ${resp.status}`, payloadEntrada }
    }

    const data  = await resp.json()
    const raw   = data.choices?.[0]?.message?.content || '{}'

    let resultado
    try {
      resultado = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      console.error('[_chamados-ia] JSON inválido da IA:', raw)
      return { erro: 'JSON inválido da IA', raw, payloadEntrada }
    }

    // Normaliza confiança: garante número 0-1
    if (resultado.confianca !== undefined) {
      resultado.confianca = Math.max(0, Math.min(1, Number(resultado.confianca) || 0))
    }

    return { ...resultado, payloadEntrada, payloadSaida: data }
  } catch (e) {
    console.error('[_chamados-ia] exceção:', e?.message)
    return { erro: e?.message, payloadEntrada }
  }
}
