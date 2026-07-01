// api/_chamados-ia.js
// Serviço de classificação de mensagens por LLM (Groq / Llama)
// Retorna JSON padronizado com confiança, categoria e resumo.

const GROQ_API_KEY  = process.env.GROQ_API_KEY
const GROQ_MODEL    = 'meta-llama/llama-4-scout-17b-16e-instruct'
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_PROMPT = `Você é um classificador de mensagens de grupos WhatsApp de suporte técnico de sistemas de rastreamento, telemetria e aplicativos para operações agrícolas (colheita, manutenção florestal, baldeio, malha viária, etc.).

OBJETIVO: Analisar o conjunto completo de mensagens do período e identificar TODOS os chamados técnicos distintos presentes.
Cada equipamento diferente, cada serviço em local diferente = chamado separado.

Retorne SOMENTE um JSON válido, sem texto extra:
{
  "chamados": [
    {
      "eh_chamado": true,
      "confianca": 0.95,
      "categoria": "manutencao",
      "prioridade": "media",
      "resumo": "Descrição objetiva do problema ou serviço",
      "equipamento": "código ou modelo do equipamento ou null",
      "veiculo_ou_maquina": "veículo ou máquina ou null",
      "local": "fazenda/local mencionado ou null",
      "motivo": "motivo da classificação em 1 frase"
    }
  ]
}

Se não houver nenhum chamado técnico, retorne: { "chamados": [] }

Categorias: telemetria, rastreador, aplicativo, sistema, instalacao, manutencao, sensor, equipamento, comunicacao, mobilizacao, desmobilizacao, outros

Prioridades:
- critica: sistema totalmente parado, impossível operar, perda de dados críticos
- alta: falha funcional grave que impede operação diretamente
- media: problema parcial, existe alternativa temporária
- baixa: dúvida, ajuste de configuração, melhoria

━━━ É CHAMADO (eh_chamado: true) ━━━
Quando há um PROBLEMA TÉCNICO ATIVO, ATUAL ou INTERVENÇÃO TÉCNICA DE CAMPO necessária:
✓ Falha, erro ou mau funcionamento em rastreador, sensor, telemetria, aplicativo de campo
✓ Equipamento não liga, não comunica, não lê, trava, apresenta erro operacional
✓ Solicitação de MOBILIZAÇÃO (instalação de rastreador/equipamento em máquina ou veículo)
✓ Solicitação de DESMOBILIZAÇÃO (retirada de rastreador/equipamento de máquina ou veículo)
✓ MANUTENÇÃO CORRETIVA ou PREVENTIVA em equipamento de campo (troca de peça, conversor, cabo, suporte, sensor)
✓ Visita técnica agendada para campo com equipamento e local especificados
✓ Sensor com defeito, perda de sinal, dados incorretos, timeout de comunicação em campo

━━━ NÃO É CHAMADO (eh_chamado: false) ━━━
✗ Saudações, confirmações, agradecimentos, respostas curtas ("bom dia", "ok", "entendido", "certo")
✗ Formulários administrativos de troca de celular/tablet (bateria estufada, avaria, extravio)
✗ Mensagens com campos como "Centro de Custo", "CNPJ", "Endereço de entrega" — formulários admin
✗ Discussões sobre aprovações, procedimentos internos, protocolos burocráticos
✗ Conversas gerais sem equipamento de campo específico com necessidade de atendimento
✗ Histórico ou relato de atendimento já finalizado

REGRAS DE IDENTIFICAÇÃO MÚLTIPLA:
- Se o remetente mencionar 2 equipamentos diferentes → gere 2 itens no array
- Se mencionar 3 equipamentos → gere 3 itens
- Cada item deve ter o campo "equipamento" preenchido com o identificador específico
- Contexto compartilhado (local, tipo de serviço) pode ser atribuído a todos os itens relevantes
- Prefira eh_chamado: false com confiança ≥ 0.90 em caso de dúvida`

/**
 * Classifica um conjunto de mensagens e retorna TODOS os chamados distintos encontrados.
 * @param {string[]} mensagens - Textos das mensagens (contexto agrupado do período)
 * @param {object}  contexto   - { grupoNome, nomeRemetente }
 * @returns {{ chamados: object[], payloadEntrada, payloadSaida }} lista de chamados identificados
 */
export async function classificarChamado(mensagens, contexto = {}) {
  if (!GROQ_API_KEY) {
    console.error('[_chamados-ia] GROQ_API_KEY não configurada')
    return { chamados: [], erro: 'GROQ_API_KEY não configurada' }
  }

  const texto = mensagens
    .map((m, i) => `Mensagem ${i + 1}: "${m}"`)
    .join('\n')

  const userPrompt = `Grupo: ${contexto.grupoNome || 'desconhecido'}
Remetente: ${contexto.nomeRemetente || 'desconhecido'}
Mensagens do período:
${texto}

Identifique TODOS os chamados técnicos distintos presentes nestas mensagens. Um chamado por equipamento/serviço.`

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
        max_tokens:  1024,
        response_format: { type: 'json_object' },
      }),
    })

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '')
      console.error('[_chamados-ia] Groq erro HTTP', resp.status, errBody)
      return { chamados: [], erro: `Groq HTTP ${resp.status}`, payloadEntrada }
    }

    const data = await resp.json()
    const raw  = data.choices?.[0]?.message?.content || '{}'

    let resultado
    try {
      resultado = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      console.error('[_chamados-ia] JSON inválido da IA:', raw)
      return { chamados: [], erro: 'JSON inválido da IA', raw, payloadEntrada }
    }

    // Normaliza: suporta tanto { chamados: [...] } quanto o formato antigo { eh_chamado: ... }
    let chamados = []
    if (Array.isArray(resultado.chamados)) {
      chamados = resultado.chamados
    } else if (resultado.eh_chamado !== undefined) {
      // Backward compat: formato legado de item único
      chamados = [resultado]
    }

    // Normaliza confiança de cada item
    chamados = chamados.map(c => ({
      ...c,
      confianca: Math.max(0, Math.min(1, Number(c.confianca) || 0)),
    }))

    return { chamados, payloadEntrada, payloadSaida: data }
  } catch (e) {
    console.error('[_chamados-ia] exceção:', e?.message)
    return { chamados: [], erro: e?.message, payloadEntrada }
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
