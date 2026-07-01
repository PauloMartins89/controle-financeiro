// api/_chamados-ia.js
// Serviço de classificação de mensagens por LLM (Groq / Llama)
// Retorna JSON padronizado com confiança, categoria e resumo.

const GROQ_API_KEY  = process.env.GROQ_API_KEY
const GROQ_MODEL    = 'meta-llama/llama-4-scout-17b-16e-instruct'
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_PROMPT = `Você é um classificador de mensagens de grupos WhatsApp de suporte técnico de sistemas de rastreamento, telemetria e aplicativos para operações agrícolas (colheita, manutenção florestal, baldeio, malha viária, etc.).

Seu objetivo é identificar com ALTA PRECISÃO se uma mensagem é um chamado real de suporte técnico, EVITANDO ao máximo falsos positivos.

Retorne SOMENTE um JSON válido, sem texto extra:
{
  "eh_chamado": true,
  "confianca": 0.91,
  "categoria": "telemetria",
  "prioridade": "media",
  "resumo": "Descrição objetiva do problema",
  "equipamento": "modelo do equipamento com problema ou null",
  "veiculo_ou_maquina": "veículo ou máquina com problema ou null",
  "local": "local mencionado ou null",
  "motivo": "motivo da classificação em 1 frase"
}

Categorias: telemetria, rastreador, aplicativo, sistema, instalacao, manutencao, sensor, equipamento, comunicacao, outros

Prioridades:
- critica: sistema totalmente parado, impossível operar, perda de dados críticos
- alta: falha funcional grave que impede operação diretamente
- media: problema parcial, existe alternativa temporária
- baixa: dúvida, ajuste de configuração, melhoria

━━━ É CHAMADO (eh_chamado: true) ━━━
Apenas quando há um PROBLEMA TÉCNICO ATIVO e ATUAL em equipamento ou sistema:
✓ Falha, erro ou mau funcionamento em rastreador, sensor, telemetria, aplicativo de campo
✓ Equipamento não liga, não comunica, não lê, trava, apresenta erro operacional
✓ Solicitação explícita de visita técnica para resolver problema específico e atual
✓ Sensor com defeito, perda de sinal, dados incorretos, timeout de comunicação em campo
✓ Descrição clara no formato: equipamento X apresenta problema Y, necessita atendimento

━━━ NÃO É CHAMADO (eh_chamado: false) ━━━
✗ Saudações, confirmações, agradecimentos, respostas curtas ("bom dia", "ok", "entendido", "certo", "entrei")
✗ Formulários e templates de solicitação administrativa (modelos de pedido de troca de celular/tablet, formulário de substituição de aparelho, requisição de equipamento novo)
✗ Compartilhamento de modelos/templates para outros usarem como referência futura
✗ Pedidos de substituição de celular ou tablet (bateria estufada, avaria, extravio) — processo administrativo, não suporte técnico de campo
✗ Mensagens com campos como "Centro de Custo", "CNPJ", "Endereço de entrega", "E-mail do solicitante" — são formulários administrativos
✗ Discussões sobre aprovações, procedimentos internos, protocolos burocráticos
✗ Informações sobre projetos, unidades, filiais, equipes sem problema técnico descrito
✗ Conversas gerais sobre como funciona um processo, sistema ou fluxo de trabalho
✗ Histórico ou relato de atendimento já finalizado ou resolvido
✗ Mensagens que descrevem o que SERÁ feito (previsão, planejamento), não problema atual
✗ Discussões técnicas genéricas sem equipamento específico com falha ativa

REGRA PRINCIPAL: Para ser chamado, a mensagem DEVE descrever um problema técnico ATIVO em equipamento ou sistema ESPECÍFICO que requer intervenção técnica AGORA.
Em caso de dúvida, prefira eh_chamado: false com confiança alta (≥ 0.90).
Falso positivo (abrir SAT indevido) é mais prejudicial que falso negativo.
Confiança entre 0.00 e 1.00.`

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

// ── Prompt de detecção de resolução ───────────────────────────────────────────
const RESOLUCAO_PROMPT = `Você analisa mensagens de WhatsApp de grupos de suporte técnico de rastreadores e telemetria agrícola.

Detecte se a mensagem indica que um chamado foi RESOLVIDO, FINALIZADO ou CONCLUÍDO.

Retorne SOMENTE um JSON válido, sem texto extra:
{
  "eh_resolucao": true,
  "confianca": 0.95,
  "equipamento": "identificador do equipamento mencionado (placa, código, modelo) ou null",
  "resolucao_descricao": "o que foi feito/resolvido em 1-2 frases",
  "motivo": "motivo da classificação"
}

Exemplos de mensagens de RESOLUÇÃO (eh_resolucao: true):
- "trator F-TPX-256 consertado"
- "equipamento 354 ok, troca feita"
- "finalizado, sensor substituído no veículo BZX-123"
- "SAT-000001 resolvido"
- "ONTEM FOI REALIZADO A MANUTENCAO DO TRATOR F-TPX-256 SUBSTITUIDO O CONVERSOR USB"
- "resolvido o problema do rastreador da maquina 7"

Exemplos que NÃO são resolução (eh_resolucao: false):
- "bom dia, tudo bem?"
- "vou ver amanhã"
- "preciso de ajuda com o equipamento 354"
- "estou chegando"
- "ok"

Se mencionar mais de um equipamento, retorne o primeiro identificado.`

/**
 * Detecta se uma mensagem indica resolução/fechamento de chamado.
 * @param {string} mensagem - Texto da mensagem
 * @param {object} contexto - { grupoNome, nomeRemetente }
 * @returns {object} { eh_resolucao, confianca, equipamento, resolucao_descricao, motivo }
 */
export async function detectarResolucao(mensagem, contexto = {}) {
  if (!GROQ_API_KEY) return { eh_resolucao: false, confianca: 0 }

  const userPrompt = `Grupo: ${contexto.grupoNome || 'desconhecido'}
Remetente: ${contexto.nomeRemetente || 'desconhecido'}
Mensagem: "${mensagem}"

Esta mensagem indica que um chamado técnico foi resolvido/finalizado?`

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
          { role: 'system', content: RESOLUCAO_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens:  256,
        response_format: { type: 'json_object' },
      }),
    })

    if (!resp.ok) return { eh_resolucao: false, confianca: 0 }

    const data = await resp.json()
    const raw  = data.choices?.[0]?.message?.content || '{}'
    let resultado
    try { resultado = typeof raw === 'string' ? JSON.parse(raw) : raw }
    catch { return { eh_resolucao: false, confianca: 0 } }

    if (resultado.confianca !== undefined) {
      resultado.confianca = Math.max(0, Math.min(1, Number(resultado.confianca) || 0))
    }
    return resultado
  } catch (e) {
    console.error('[_chamados-ia] detectarResolucao exceção:', e?.message)
    return { eh_resolucao: false, confianca: 0 }
  }
}
