/**
 * _agenda-wa.js
 * Módulo auxiliar — processa mensagens WhatsApp (Z-API) de gestores cadastrados
 * para criar agendamentos de serviços via:
 *   1) Áudio  → Groq Whisper transcreve → LLaMA extrai campos → cria agendamento
 *   2) Texto  → LLaMA extrai campos → cria agendamento
 *   3) Link   → gera token → salva pendente → envia link do formulário público
 *
 * Exporta: handleAgendaWA(body, fromPhone, phoneVariants, zapiSendText, supabase)
 */

import Groq, { toFile } from 'groq-sdk'
import { aplicarRegrasAlerta } from './_agenda-motor-alertas.js'

const APP_URL = process.env.APP_URL || 'https://dividiai.app.br'

// ─── Tipos de serviço válidos ────────────────────────────────────────────────
const TIPOS_SERVICO = [
  'Caminhão Prancha',
  'Caminhão Munck',
  'Guindaste',
  'Caminhão Basculante',
  'Betoneira',
  'Retroescavadeira',
  'Motoniveladora',
  'Pá Carregadeira',
  'Trator',
  'Escavadeira Hidráulica',
  'Caminhão Pipa',
  'Locação de Equipamento',
  'Transporte de Pessoal',
  'Outro',
]

// ─── Data de hoje no formato ISO ─────────────────────────────────────────────
function hoje() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Formata data ISO → DD/MM/YYYY ───────────────────────────────────────────
function fmtData(iso) {
  if (!iso) return '—'
  return String(iso).split('-').reverse().join('/')
}

// ─── Baixa áudio e transcreve com Groq Whisper ───────────────────────────────
async function transcribeAudio(audioUrl) {
  // Baixa o arquivo de áudio do Z-API
  const audioRes = await fetch(audioUrl, {
    headers: process.env.ZAPI_CLIENT_TOKEN
      ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN }
      : {},
  })
  if (!audioRes.ok) throw new Error(`Falha ao baixar áudio: HTTP ${audioRes.status}`)
  const buffer = Buffer.from(await audioRes.arrayBuffer())

  // Tenta detectar mime type pelo URL (padrão ogg para PTT do WhatsApp)
  const mime = audioUrl.includes('.mp4') ? 'audio/mp4'
    : audioUrl.includes('.mp3') ? 'audio/mpeg'
    : 'audio/ogg; codecs=opus'
  const ext = audioUrl.includes('.mp4') ? 'audio.mp4'
    : audioUrl.includes('.mp3') ? 'audio.mp3'
    : 'audio.ogg'

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const transcription = await groq.audio.transcriptions.create({
    file: await toFile(buffer, ext, { type: mime }),
    model: 'whisper-large-v3',
    language: 'pt',
    response_format: 'text',
  })
  return typeof transcription === 'string' ? transcription : (transcription?.text || '')
}

// ─── Extrai campos de agendamento a partir de texto com LLaMA ────────────────
async function parseAgendamento(texto) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    temperature: 0,
    max_tokens: 512,
    messages: [
      {
        role: 'system',
        content: [
          `Você é um parser especializado em agendamentos de serviços operacionais (logística, transporte, maquinário).`,
          `Extraia informações do texto informado e retorne APENAS JSON válido, sem markdown, sem explicações.`,
          `Hoje: ${hoje()}`,
          `Tipos de serviço válidos: ${TIPOS_SERVICO.join(', ')}`,
          `Ao interpretar datas: "amanhã" = ${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}, "depois de amanhã" = ${new Date(Date.now() + 172800000).toISOString().slice(0, 10)}.`,
          `Formato data_servico: YYYY-MM-DD. Formato horario_servico: HH:MM ou null.`,
          `Se algum campo não for mencionado, use null.`,
        ].join('\n'),
      },
      {
        role: 'user',
        content: `Texto: "${texto}"\n\nRetorne apenas o JSON:\n{"cliente_nome":null,"tipo_servico":null,"atividade":null,"data_servico":null,"horario_servico":null,"origem":null,"destino":null,"observacao":null}`,
      },
    ],
  })

  const raw = (completion.choices[0]?.message?.content || '').trim()
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return {}
  try { return JSON.parse(match[0]) } catch { return {} }
}

// ─── Cria agendamento no Supabase ─────────────────────────────────────────────
async function criarAgendamento(supabase, dados, gestor, origem, textoOrigem) {
  const dataServico = dados.data_servico || hoje()
  const horario     = dados.horario_servico || null

  const payload = {
    workspace_id:    gestor.workspace_id,
    cliente_nome:    dados.cliente_nome   || 'A definir',
    tipo_servico:    dados.tipo_servico   || 'Outro',
    atividade:       dados.atividade      || null,
    data_servico:    dataServico,
    horario_servico: horario,
    data_hora_servico: horario
      ? new Date(`${dataServico}T${horario}:00`).toISOString()
      : new Date(`${dataServico}T00:00:00`).toISOString(),
    origem:          dados.origem         || null,
    destino:         dados.destino        || null,
    observacao:      dados.observacao     || null,
    status:          'agendado',
    criado_por_nome: gestor.nome,
  }

  const { data, error } = await supabase
    .from('agendamentos_servicos')
    .insert(payload)
    .select('id, numero_agendamento')
    .single()

  if (error) throw new Error(`DB insert: ${error.message}`)

  // Registra histórico
  await supabase.from('agendamento_historico').insert({
    agendamento_id: data.id,
    tipo_evento:    'criacao',
    descricao: `Criado via ${origem === 'audio' ? '🎤 áudio WhatsApp' : origem === 'texto' ? '💬 mensagem de texto' : '📋 formulário público'} pelo gestor ${gestor.nome}`,
    usuario_nome:   gestor.nome,
    payload_json:   { origem, texto_original: (textoOrigem || '').slice(0, 500) },
  }).then(null, () => {}) // não bloqueia se histórico falhar

  // Aplica regras automáticas de alerta configuradas
  aplicarRegrasAlerta(supabase, {
    id:               data.id,
    workspace_id:     payload.workspace_id,
    tipo_servico:     payload.tipo_servico,
    data_hora_servico: payload.data_hora_servico,
  }).then(null, () => {}) // não bloqueia

  return data
}

// ─── Monta mensagem de confirmação WA ────────────────────────────────────────
function montarConfirmacao(dados, ag) {
  const num = ag.numero_agendamento ? `*${ag.numero_agendamento}*` : ''
  const linhas = [
    `✅ *Agendamento criado com sucesso!* ${num}`,
    '',
    `🔧 Serviço: *${dados.tipo_servico || 'A definir'}*`,
    `👤 Cliente: *${dados.cliente_nome || 'A definir'}*`,
    dados.atividade      ? `📌 Atividade: ${dados.atividade}`                : null,
    dados.data_servico   ? `📅 Data: *${fmtData(dados.data_servico)}*`        : null,
    dados.horario_servico ? `⏰ Horário: *${dados.horario_servico}*`           : null,
    dados.origem         ? `📍 Origem: ${dados.origem}`                       : null,
    dados.destino        ? `🏁 Destino: ${dados.destino}`                     : null,
    dados.observacao     ? `📝 Obs: ${dados.observacao}`                      : null,
    '',
    '_Acesse o sistema para adicionar detalhes, alertas e anexos._',
  ].filter(l => l !== null)
  return linhas.join('\n')
}

// ─── Gera token de link público e salva registro pendente ────────────────────
async function gerarLink(supabase, gestor, dadosParciais) {
  const token = crypto.randomUUID().replace(/-/g, '')
  await supabase.from('agenda_links_pendentes').insert({
    token,
    workspace_id:    gestor.workspace_id,
    gestor_id:       gestor.id,
    gestor_telefone: gestor.telefone,
    gestor_nome:     gestor.nome,
    dados_parciais:  dadosParciais || null,
    usado:           false,
    expires_at:      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })
  return token
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler principal — chamado pelo webhook-whatsapp.js
// Retorna true se o remetente era um gestor de agenda (consumido), false caso contrário.
// ─────────────────────────────────────────────────────────────────────────────
export async function handleAgendaWA(body, fromPhone, phoneVariants, zapiSendText, supabase) {
  // Busca gestor pelo telefone (todas as variantes normalizadas)
  let gestor = null
  for (const v of phoneVariants) {
    const { data } = await supabase
      .from('agenda_gestores')
      .select('*')
      .eq('telefone', v)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()
    if (data) { gestor = data; break }
  }

  // Não é um gestor cadastrado — deixa o fluxo normal prosseguir
  if (!gestor) return false

  // Determina tipo pelo conteúdo do payload (Z-API usa body.type = 'ReceivedCallback')
  const isAudioMsg = !!(body.audio || body.ptt)
  const isTextMsg  = !isAudioMsg && !!(body.text || body.body)
  const msgType = (body.type || '').toLowerCase()
  const txtRaw  = (body.text?.message || body.text || body.body || '').trim()

  // ─── ÁUDIO / PTT ──────────────────────────────────────────────────────────
  if ((isAudioMsg || msgType === 'audio' || msgType === 'ptt') && gestor.audio_habilitado) {
    const audioUrl = body.audio?.audioUrl || body.audio?.fileUrl || body.ptt?.audioUrl
    if (!audioUrl) {
      await zapiSendText(fromPhone, '❌ Não consegui acessar o áudio. Tente enviar novamente.')
      return true
    }

    await zapiSendText(fromPhone, '⏳ Processando seu áudio... aguarde.')
    try {
      const transcricao = await transcribeAudio(audioUrl)
      if (!transcricao || transcricao.length < 5) {
        await zapiSendText(fromPhone, '❓ Não entendi o áudio. Tente novamente ou use o formulário:\n' + APP_URL + '/ag/' + await gerarLink(supabase, gestor, null))
        return true
      }

      const dados = await parseAgendamento(transcricao)

      // Se não extraiu dados mínimos, envia transcrição + link
      if (!dados.cliente_nome && !dados.tipo_servico && !dados.data_servico) {
        const token = await gerarLink(supabase, gestor, null)
        await zapiSendText(fromPhone,
          `🎤 Transcrição: _"${transcricao}"_\n\n❓ Não identifiquei os dados do agendamento. Use o formulário:\n${APP_URL}/ag/${token}`)
        return true
      }

      const ag = await criarAgendamento(supabase, dados, gestor, 'audio', transcricao)
      await zapiSendText(fromPhone, montarConfirmacao(dados, ag))
    } catch (e) {
      console.error('[_agenda-wa] audio error:', e.message)
      await zapiSendText(fromPhone, `❌ Erro ao processar áudio: ${e.message}`)
    }
    return true
  }

  // ─── TEXTO ────────────────────────────────────────────────────────────────
  if (isTextMsg || msgType === 'chat' || msgType === 'text' || msgType === 'extendedtextmessage') {
    if (!txtRaw) return true

    const txtLower = txtRaw.toLowerCase()

    // Palavra-chave explícita para link — sempre envia link (se habilitado)
    const querLink = /\b(link|form|formulário|formulario|agendar)\b/.test(txtLower)
    if (querLink && gestor.link_habilitado) {
      // Tenta pré-preencher se texto contém mais informações
      const dadosParciais = txtLower !== 'link' && txtLower !== 'form' && txtLower !== 'agendar'
        ? await parseAgendamento(txtRaw).catch(() => null)
        : null
      const token = await gerarLink(supabase, gestor, dadosParciais)
      await zapiSendText(fromPhone,
        `📋 *Formulário de Agendamento*\n\nPreencha os dados do serviço:\n${APP_URL}/ag/${token}\n\n_Link válido por 24 horas._`)
      return true
    }

    // Criação direta por texto
    if (gestor.texto_habilitado && txtRaw.length > 8) {
      try {
        const dados = await parseAgendamento(txtRaw)
        const temDados = dados.cliente_nome || dados.tipo_servico || dados.data_servico
        if (!temDados) {
          // Não deu pra extrair → tenta link
          if (gestor.link_habilitado) {
            const token = await gerarLink(supabase, gestor, null)
            await zapiSendText(fromPhone,
              `❓ Não entendi os dados do agendamento.\n\nUse o formulário:\n${APP_URL}/ag/${token}`)
          }
          return true
        }
        const ag = await criarAgendamento(supabase, dados, gestor, 'texto', txtRaw)
        await zapiSendText(fromPhone, montarConfirmacao(dados, ag))
      } catch (e) {
        console.error('[_agenda-wa] text error:', e.message)
        await zapiSendText(fromPhone, `❌ Erro ao processar mensagem: ${e.message}`)
      }
      return true
    }

    // Gestor enviou texto mas só tem link habilitado → gera link
    if (gestor.link_habilitado) {
      const dadosParciais = txtRaw.length > 10
        ? await parseAgendamento(txtRaw).catch(() => null)
        : null
      const token = await gerarLink(supabase, gestor, dadosParciais)
      await zapiSendText(fromPhone,
        `📋 *Formulário de Agendamento*\n\nPreencha os dados do serviço:\n${APP_URL}/ag/${token}\n\n_Link válido por 24 horas._`)
      return true
    }
  }

  return true // gestor reconhecido, nenhuma ação aplicável
}
