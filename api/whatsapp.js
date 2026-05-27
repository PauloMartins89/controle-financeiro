import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'
import { runOCR } from './_ocr.js'
import ws from 'ws'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GH_MODELS_URL = 'https://models.inference.ai.azure.com/chat/completions'
const GH_MODEL = 'gpt-4o-mini'
const APP_URL = process.env.APP_URL || 'https://dividiai.app.br'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
    { realtime: { params: { log_level: 'disabled' }, transport: ws }, global: {} }
  )
}

function formatBRL(v) {
  return 'R$ ' + Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Garante que campos numéricos da IA nunca chegam como string "null"
function safeNum(v) {
  if (v === null || v === undefined || v === '' || v === 'null' || v === 'undefined') return null
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}
// Garante que campos texto nunca chegam como string "null"
function safeStr(v) {
  if (v === null || v === undefined || v === '' || v === 'null' || v === 'undefined') return null
  return String(v).trim() || null
}

// ── Cálculo de saldos — sempre no backend, nunca na IA ──────────────────────
function calcularSaldos(despesas, pessoas) {
  const balances = {}
  pessoas.forEach(p => { balances[p.id] = 0 })
  despesas.filter(e => e.status !== 'pago').forEach(exp => {
    const { valor, pago_por, participantes, parcelas } = exp
    if (!participantes?.length || !pago_por) return
    const share = (valor / (parcelas || 1)) / participantes.length
    participantes.forEach(pid => {
      if (pid === pago_por) return
      if (balances[pid] !== undefined) balances[pid] -= share
      if (balances[pago_por] !== undefined) balances[pago_por] += share
    })
  })
  return pessoas.map(p => ({
    id: p.id,
    nome: p.nome,
    saldo: Math.round((balances[p.id] || 0) * 100) / 100,
  }))
}

// ── IA: apenas interpreta intenção, nunca salva dados ────────────────────────
async function parseIntent(text, pessoas, today, historico = []) {
  const nomes = pessoas.map(p => p.nome).join(', ')
  const histMessages = (historico || []).slice(-6).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }))
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'system',
        content: `Você é um parser de intenções financeiras. Extraia a intenção e entidades do texto em JSON válido. Retorne APENAS JSON, sem explicação.

Pessoas disponíveis: ${nomes || 'nenhuma'}
Hoje: ${today}

Intenções:
- criar_despesa: {"intencao":"criar_despesa","descricao":"...","valor":0.00,"pago_por":"nome","participantes":["nome1","nome2"],"categoria":"Alimentação|Transporte|Moradia|Saúde|Lazer|Educação|Serviços|Vestuário|Outros","data":"YYYY-MM-DD"}
- consultar_saldo: {"intencao":"consultar_saldo","pessoa":"nome ou null"}
- listar_pendencias: {"intencao":"listar_pendencias"}
- fechar_mes: {"intencao":"fechar_mes","mes":"YYYY-MM"}
- marcar_como_pago: {"intencao":"marcar_como_pago","descricao":"..."}
- desconhecido: {"intencao":"desconhecido"}`,
      },
      ...histMessages,
      { role: 'user', content: text },
    ],
    max_tokens: 300,
    temperature: 0.1,
  })
  const raw = completion.choices[0]?.message?.content || '{}'
  const match = raw.match(/\{[\s\S]*\}/)
  try { return JSON.parse(match?.[0] || '{}') } catch { return { intencao: 'desconhecido' } }
}

async function sendWA(to, text) {
  const res = await fetch(
    `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
      },
      body: JSON.stringify({ phone: to, message: text }),
    }
  )
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error(`[WA] sendWA falhou ${res.status} para ${to}:`, errBody)
    try {
      getDb().from('mensagens_whatsapp').insert({
        telefone: to, direcao: 'saida_erro',
        conteudo: `[ERRO Z-API ${res.status}] ${errBody.slice(0, 500)}`
      }).then(() => {})
    } catch (_) {}
  }
  return res.ok
}

// ── Monta texto de confirmação de despesa (reutilizado em confirmação e edição)
function montarConfirmacao(p) {
  const n = (v) => v || '—'
  const share = p.participantes_ids?.length > 1
    ? formatBRL(p.valor / p.participantes_ids.length)
    : null
  const outros = (p.participantes_nomes || []).filter(n => n !== p.pago_por_nome)
  const divisaoStr = share && outros.length
    ? `\n${outros.join(' e ')} ${outros.length > 1 ? 'devem' : 'deve'} ${share} para ${p.pago_por_nome}`
    : ''

  const combustivel = p.litros
    ? `\n⛽ ${p.litros}L × ${p.valor_litro ? formatBRL(p.valor_litro) + '/L' : '—'}`
    : ''

  const linhas = [
    `📅 Data: ${p.data || '—'}${p.hora ? ' às ' + p.hora : ''}`,
    `🏢 Local: ${n(p.descricao)}`,
    `💰 Valor: ${formatBRL(p.valor)}`,
    `💳 Pagamento: ${n(p.forma_pagamento)}`,
    `🏷️ Categoria: ${p.categoria || 'Outros'}`,
    `🛒 Produto: ${n(p.produto)}${p.quantidade ? ' (' + p.quantidade + ')' : ''}${combustivel}`,
    `🏢 CNPJ: ${n(p.cnpj)}`,
    `📍 Endereço: ${n(p.endereco)}`,
    `📞 Telefone: ${n(p.telefone)}`,
    `🔗 NF-e: ${p.nfe_url ? p.nfe_url : '—'}`,
    `👤 Pago por: ${p.pago_por_nome}`,
  ]

  return linhas.join('\n') + `${divisaoStr}\n\nConfirmar?`
}

// ── Fechar mês com detalhamento por pessoa ───────────────────────────────────
function fecharMes(despesas, pessoas, mes) {
  const doMes = despesas.filter(e => e.data?.slice(0, 7) === mes)
  if (!doMes.length) return null

  // Quanto cada pessoa pagou no mês
  const pagouMap = {}
  pessoas.forEach(p => { pagouMap[p.id] = 0 })
  doMes.forEach(e => {
    if (e.pago_por && pagouMap[e.pago_por] !== undefined) {
      pagouMap[e.pago_por] += e.valor || 0
    }
  })

  const total = doMes.reduce((s, e) => s + (e.valor || 0), 0)
  const saldos = calcularSaldos(despesas, pessoas).filter(s => Math.abs(s.saldo) > 0.01)

  const [ano, m] = mes.split('-')
  const nomeMes = new Date(+ano, +m - 1).toLocaleString('pt-BR', { month: 'long' })

  let texto = `*Fechamento de ${nomeMes}/${ano}*\nTotal: ${formatBRL(total)}\n`

  const pagamentos = pessoas
    .filter(p => pagouMap[p.id] > 0)
    .map(p => `${p.nome} pagou ${formatBRL(pagouMap[p.id])}`)
  if (pagamentos.length) texto += '\n' + pagamentos.join('\n')

  if (saldos.length) {
    texto += '\n\n*Saldo final:*\n'
    texto += saldos.map(s =>
      s.saldo > 0
        ? `${s.nome} recebe ${formatBRL(s.saldo)}`
        : `${s.nome} deve ${formatBRL(Math.abs(s.saldo))}`
    ).join('\n')
  } else {
    texto += '\n\n✅ Todos quitados!'
  }

  return texto
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).send('OK')

  if (req.method !== 'POST') return res.status(405).end()

  try {
    const body = req.body
    // DEBUG TEMPORÁRIO — loga tipo e campos recebidos do Z-API
    console.log('[whatsapp] body.type=', body?.type, 'fromMe=', body?.fromMe, 'keys=', Object.keys(body || {}).join(','))
    // Z-API: ignora tudo exceto mensagens recebidas de terceiros
    if (body?.fromMe) return res.status(200).end()
    // Aceita ReceivedCallback e outros tipos que Z-API Multi Device possa enviar
    const isValidType = !body?.type || body?.type === 'ReceivedCallback' || body?.type?.includes?.('Message') || body?.type?.includes?.('Received')
    if (!isValidType) return res.status(200).json({ ignored: true, type: body?.type })
    if (!body?.text && !body?.audio && !body?.image) return res.status(200).end()

    const messageType = body.text ? 'text' : body.audio ? 'audio' : 'image'
    const message = {
      id: body.messageId,
      from: body.phone?.replace(/[^0-9]/g, '') || '',
      type: messageType,
      text: body.text ? { body: body.text.message } : undefined,
      audio: body.audio ? { _url: body.audio.audioUrl, _mime: body.audio.mimeType || 'audio/ogg' } : undefined,
      image: body.image ? { _url: body.image.imageUrl, _mime: 'image/jpeg', caption: body.image.caption } : undefined,
    }

    // ── Dedup: INSERT como mutex — se já existe, ignora
    const msgId = message.id
    if (msgId) {
      const dbDedup = getDb()
      const { error: dedupErr } = await dbDedup
        .from('mensagens_whatsapp')
        .insert({ telefone: message.from, direcao: 'entrada', conteudo: '__dedup__', message_id: msgId })
      // error code 23505 = unique violation → já processado
      if (dedupErr) {
        if (dedupErr.code === '23505') return res.status(200).end()
        // coluna message_id não existe ainda → continua sem dedup
      }
    }

    const from = message.from
    const today = new Date().toISOString().slice(0, 10)
    let text = ''
    let textoOriginal = ''
    let comprovanteUrl = null
    let imagemExtraida = null
    let formularioTransporte = null

    // ── Áudio: transcreve com Whisper ────────────────────────────────────────
    if (message.type === 'audio') {
      const audioRes = await fetch(message.audio._url)
      const audioBuffer = await audioRes.arrayBuffer()
      const audioFile = new File([audioBuffer], 'audio.ogg', { type: message.audio._mime })
      const transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-large-v3',
        language: 'pt',
      })
      text = transcription.text?.trim() || ''
      textoOriginal = `[áudio] ${text}`
      if (!text) return res.status(200).end()

    // ── Imagem: classifica primeiro, depois extrai ───────────────────────────
    } else if (message.type === 'image') {
      const mimeType = message.image._mime
      const caption = message.image.caption || ''

      // Tenta usar base64 diretamente do payload Z-API (se "Receber Base64" estiver ativado)
      // Caso contrário, faz fetch com Client-Token (obrigatório na Z-API para download de mídia)
      let base64 = body.image?.imageBase64 || body.image?.base64 || null
      let imgBuffer = null

      if (!base64) {
        const fetchHeaders = {}
        if (process.env.ZAPI_CLIENT_TOKEN) fetchHeaders['Client-Token'] = process.env.ZAPI_CLIENT_TOKEN
        const imgRes = await fetch(message.image._url, { headers: fetchHeaders })
        if (!imgRes.ok) {
          console.error('[WA] Falha ao baixar imagem:', imgRes.status, message.image._url)
          await sendWA(from, '❌ Não consegui baixar a imagem. Tente reenviar ou ative "Receber Base64" no painel Z-API.')
          return res.status(200).end()
        }
        imgBuffer = await imgRes.arrayBuffer()
        base64 = Buffer.from(imgBuffer).toString('base64')
      } else {
        // Remove prefixo data:image/jpeg;base64, se presente
        base64 = base64.replace(/^data:[^;]+;base64,/, '')
        imgBuffer = Buffer.from(base64, 'base64').buffer
      }

      // Upload sempre (independente do tipo)
      try {
        const db0 = getDb()
        const fileName = `whatsapp/${Date.now()}_${from}.jpg`
        const uploadData = Buffer.from(base64, 'base64')
        const { data: uploaded, error: uploadErr } = await db0.storage
          .from('comprovantes')
          .upload(fileName, uploadData, { contentType: mimeType, upsert: false })
        if (!uploadErr && uploaded) {
          const { data: urlData } = db0.storage.from('comprovantes').getPublicUrl(uploaded.path)
          comprovanteUrl = urlData?.publicUrl || null
        }
      } catch (_) {}

      // ── PASSO 1: classificação inteligente — identifica o tipo de documento ──
      // runOCR conhece DIÁRIO DO MOTORISTA, formulários Casagrande, e também
      // despesas genéricas. Roda primeiro para decidir o fluxo correto.
      let ocrClassificacao = null
      let ocrFalhou = false
      try {
        ocrClassificacao = await runOCR(base64)
      } catch (ocrErr) {
        console.error('[WA] runOCR erro:', ocrErr?.message || ocrErr)
        ocrFalhou = true
      }

      if (ocrFalhou) {
        await sendWA(from, '❌ Não consegui processar a imagem agora. Tente novamente em alguns instantes.')
        return res.status(200).end()
      }

      if (ocrClassificacao?.tipo_formulario === 'transporte') {
        // ── Formulário de transporte (DIÁRIO DO MOTORISTA) ──────────────────
        formularioTransporte = ocrClassificacao
        text = '[imagem-transporte]'
        textoOriginal = '[formulário: diário do motorista]'

      } else {
        // ── Fallback: motorista cadastrado → força extração de transporte ────
        // Se o modelo errou a classificação mas o número é de um condutor ativo,
        // reexecuta o runOCR forçando a extração de transporte.
        const _norm = from.replace(/\D/g, '')
        const _sem55 = _norm.replace(/^55/, '')
        const _com9 = _sem55.length === 10 ? _sem55.slice(0, 2) + '9' + _sem55.slice(2) : _sem55
        const _variantsEarly = [...new Set([_norm, _sem55, '55' + _sem55, _com9, '55' + _com9])]
        let _condutorEncontrado = false
        for (const v of _variantsEarly) {
          const { data: cond } = await getDb().from('cadastros_condutores')
            .select('workspace_id').eq('telefone', v).eq('ativo_whatsapp', true).eq('ativo', true).maybeSingle()
          if (cond?.workspace_id) { _condutorEncontrado = true; break }
        }
        if (_condutorEncontrado) {
          try {
            const ocrForcado = await runOCR(base64, { forceTransporte: true })
            formularioTransporte = ocrForcado
            text = '[imagem-transporte]'
            textoOriginal = '[formulário: diário do motorista - forçado]'
          } catch (errForce) {
            console.error('[WA] runOCR forceTransporte erro:', errForce?.message || errForce)
            await sendWA(from, '❌ Não consegui processar a imagem. Tente uma foto mais nítida.')
            return res.status(200).end()
          }
        } else {
        // ── PASSO 2: comprovante/despesa — OCR rico com NF-e, CNPJ, litros ──
        const visionResult = await groq.chat.completions.create({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise esta imagem de nota fiscal, cupom, comprovante ou recibo — incluindo recibos manuais, manuscritos, cupons não fiscais e comprovantes de pagamento. Extraia as informações e retorne APENAS JSON válido, sem markdown, sem explicação:
{
  "estabelecimento": "nome do estabelecimento ou prestador de serviço",
  "endereco": "endereço completo ou null",
  "telefone": "telefone(s) ou null",
  "cnpj": "XX.XXX.XXX/XXXX-XX ou null (pode ser CPF se for pessoa física)",
  "produto": "produto ou descrição do serviço principal ou null",
  "quantidade": "quantidade com unidade ou null (ex: 3 unidades, 40,52 litros)",
  "litros": null,
  "valor_litro": null,
  "valor": 0.00,
  "data": "YYYY-MM-DD ou null",
  "hora": "HH:MM ou null",
  "forma_pagamento": "pix|crédito|débito|dinheiro ou null",
  "nfe_url": "URL da consulta NF-e ou chave de acesso 44 dígitos ou null",
  "categoria": "Alimentação|Transporte|Moradia|Saúde|Lazer|Educação|Serviços|Vestuário|Outros"
}
Regras importantes:
- Recibos manuais, manuscritos e cupons não eletrônicos são válidos — extraia o máximo possível
- Se o CNPJ/CPF estiver ilegível ou ausente, coloque null
- litros e valor_litro: preencher SOMENTE se for posto de combustível (números, nunca string)
- Para campos não encontrados use sempre JSON null (nunca a string "null")
- nfe_url: somente se houver URL ou chave NF-e real; caso contrário null
- Datas em outros formatos (DD/MM/AAAA) converter para YYYY-MM-DD
Se não for absolutamente nenhum tipo de comprovante financeiro, retorne {"erro":"não é comprovante"}.
${caption ? `Contexto adicional: "${caption}"` : ''}`
              },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
            ]
          }],
          max_tokens: 600,
          temperature: 0.1,
        })

        const raw = visionResult.choices[0]?.message?.content || '{}'
        const matchJson = raw.match(/\{[\s\S]*\}/)
        let extracted = {}
        try { extracted = JSON.parse(matchJson?.[0] || '{}') } catch { extracted = { erro: 'parse' } }

        if (extracted.erro) {
          await sendWA(from, 'Não reconheci um comprovante nessa imagem. 🤔\nTente uma foto mais nítida ou me diga o valor manualmente.')
          return res.status(200).end()
        }

        imagemExtraida = {
          estabelecimento: safeStr(extracted.estabelecimento),
          endereco:        safeStr(extracted.endereco),
          telefone:        safeStr(extracted.telefone),
          cnpj:            safeStr(extracted.cnpj),
          produto:         safeStr(extracted.produto),
          quantidade:      safeStr(extracted.quantidade),
          litros:          safeNum(extracted.litros),
          valor_litro:     safeNum(extracted.valor_litro),
          valor:           safeNum(extracted.valor),
          data:            safeStr(extracted.data) || today,
          hora:            safeStr(extracted.hora),
          forma_pagamento: safeStr(extracted.forma_pagamento),
          nfe_url:         safeStr(extracted.nfe_url),
          categoria:       safeStr(extracted.categoria) || 'Outros',
        }

        if (!imagemExtraida.estabelecimento && !imagemExtraida.valor) {
          await sendWA(from, 'Não consegui identificar estabelecimento nem valor. 🤔\nTente uma foto mais nítida ou me diga manualmente.')
          return res.status(200).end()
        }

        text = '[imagem]'
        textoOriginal = `[imagem${caption ? ': ' + caption : ''}]`
        } // fecha else (não é condutor)
      }

    } else {
      text = message.text.body.trim()
      textoOriginal = text
    }

    const db = getDb()

    // ── Log: atualiza o registro dedup com o conteúdo real ───────────────────
    if (msgId) {
      db.from('mensagens_whatsapp').update({ conteudo: textoOriginal || text }).eq('message_id', msgId).then(() => {})
    } else {
      db.from('mensagens_whatsapp').insert({ telefone: from, direcao: 'entrada', conteudo: textoOriginal || text }).then(() => {})
    }

    // ── Canal / auto-registro ─────────────────────────────────────────────────
    // Busca canal ativo OU inativo (para não bloquear quem foi auto-criado sem ativo=true)
    // Tenta match exato primeiro, depois variações com/sem 55
    const fromNorm = from.replace(/\D/g, '')
    // Gera variantes: com/sem 55, com/sem o dígito 9 após o DDD (padrão BR)
    const sem55 = fromNorm.replace(/^55/, '')                       // ex: 6792844450
    const com9  = sem55.length === 10 ? sem55.slice(0,2) + '9' + sem55.slice(2) : sem55  // 67992844450
    const sem9  = sem55.length === 11 && sem55[2] === '9' ? sem55.slice(0,2) + sem55.slice(3) : sem55 // 6792844450
    const fromVariants = [...new Set([
      fromNorm,
      sem55,
      '55' + sem55,
      '55' + com9,
      com9,
      '55' + sem9,
      sem9,
    ])]
    let canal = null
    for (const v of [...new Set(fromVariants)]) {
      const { data } = await db.from('canais_mensagem').select('*').eq('telefone', v).maybeSingle()
      if (data) { canal = data; break }
    }

    if (!canal) {
      // Tenta achar pessoa pelo telefone (fuzzy) e criar canal automaticamente
      const { data: todasPessoas } = await db.from('pessoas').select('id, telefone, owner_id')
      const matched = todasPessoas?.find(p => {
        const tel = p.telefone?.replace(/\D/g, '') || ''
        return fromVariants.includes(tel) || fromVariants.includes('55' + tel) || fromVariants.includes(tel.replace(/^55/, ''))
      })
      if (matched) {
        const { data: novo } = await db.from('canais_mensagem')
          .insert({ telefone: fromNorm, pessoa_id: matched.id, owner_id: matched.owner_id || null, ativo: true })
          .select().single()
        canal = novo
      }
    } else if (!canal.ativo) {
      // Ativa canal que foi criado sem ativo=true
      await db.from('canais_mensagem').update({ ativo: true }).eq('id', canal.id)
      canal = { ...canal, ativo: true }
    }

    if (!canal) {
      // ── Antes de rejeitar: verifica se é líder de refeição ─────────────────
      let equipeRef = null
      for (const v of fromVariants) {
        const { data } = await db.from('refei_equipes')
          .select('*').eq('lider_telefone', v).eq('ativo', true).limit(1).maybeSingle()
        if (data) { equipeRef = data; break }
      }
      if (equipeRef) {
        const { data: solRef } = await db.from('refei_solicitacoes')
          .select('token_lider, numero_pedido, status')
          .eq('equipe_id', equipeRef.id)
          .in('status', ['rascunho', 'reprovado', 'pendente'])
          .order('criado_em', { ascending: false })
          .limit(1).maybeSingle()
        if (solRef && ['rascunho', 'reprovado'].includes(solRef.status)) {
          const avisoRep = solRef.status === 'reprovado' ? '\n\n⚠️ Pedido anterior reprovado. Corrija e reenvie.' : ''
          await sendWA(from, `🍽️ *Pedido de Refeição — ${equipeRef.nome}*${avisoRep}\n\nAcesse o formulário:\n${APP_URL}/refeicao/${solRef.token_lider}`)
        } else if (solRef?.status === 'pendente') {
          await sendWA(from, `⏳ Seu pedido *${solRef.numero_pedido}* já foi enviado e aguarda aprovação do supervisor.`)
        } else {
          // Nenhum pedido ativo — cria novo rascunho automaticamente
          const { data: novo } = await db.from('refei_solicitacoes').insert({
            workspace_id:        equipeRef.workspace_id,
            owner_id:            equipeRef.owner_id,
            equipe_id:           equipeRef.id,
            lider_nome:          equipeRef.lider_nome,
            lider_telefone:      equipeRef.lider_telefone,
            supervisor_telefone: equipeRef.supervisor_telefone,
            status:              'rascunho',
          }).select('token_lider').single()
          if (novo?.token_lider) {
            await sendWA(from, `🍽️ *Pedido de Refeição — ${equipeRef.nome}*\n\nAcesse o formulário para preencher e enviar:\n${APP_URL}/refeicao/${novo.token_lider}`)
          } else {
            await sendWA(from, `⚠️ Erro ao criar pedido. Contate o administrador.`)
          }
        }
        return res.status(200).end()
      }

      // ── Verifica se é telefone de restaurante de refeições ────────────────
      let restFound = null
      for (const v of fromVariants) {
        const { data: rData } = await db.from('refei_restaurantes')
          .select('id, nome').eq('telefone_wa', v).eq('ativo', true).limit(1).maybeSingle()
        if (rData) { restFound = rData; break }
      }
      if (restFound) {
        // Restaurante respondeu uma mensagem — busca o pedido mais recente enviado
        const { data: solRest } = await db.from('refei_solicitacoes')
          .select('token_restaurante, numero_pedido, status')
          .eq('restaurante_id', restFound.id)
          .in('status', ['enviado_restaurante', 'confirmado_restaurante', 'entregue'])
          .order('criado_em', { ascending: false })
          .limit(1).maybeSingle()
        if (solRest?.token_restaurante) {
          const linkRest = `${APP_URL}/rc/${solRest.token_restaurante}`
          await sendWA(from, `✅ Olá, *${restFound.nome}*! Para confirmar ou ver os detalhes do pedido *${solRest.numero_pedido}*, acesse:\n${linkRest}`)
        } else {
          await sendWA(from, `✅ Olá, *${restFound.nome}*! Nenhum pedido ativo no momento. Aguarde o envio da próxima solicitação.`)
        }
        return res.status(200).end()
      }
      // ─────────────────────────────────────────────────────────────────────

      // Se é formulário de transporte (Diário do Motorista), processa mesmo sem canal
      // O bloco de transporte usa cadastros_condutores para o workspace — não depende de canal
      if (formularioTransporte) {
        canal = { id: null, sessao_pendente: null, pessoa_id: null }
      } else {
        await sendWA(from, `Olá! 👋 Seu número não está vinculado ao SmartPro.\n\nAcesse *${APP_URL}* → Admin para cadastrar.`)
        return res.status(200).end()
      }
    }

    // owner_id real: busca da pessoa vinculada ao canal (fonte de verdade)
    // Assim despesas sempre vão para a conta correta, mesmo que canal.owner_id esteja errado
    let ownerId = canal.owner_id || null
    if (canal.pessoa_id) {
      const { data: pessoaCanal } = await db.from('pessoas').select('owner_id').eq('id', canal.pessoa_id).single()
      if (pessoaCanal?.owner_id) {
        ownerId = pessoaCanal.owner_id
        // Corrige o canal se estiver com owner_id errado
        if (ownerId !== canal.owner_id) {
          await db.from('canais_mensagem').update({ owner_id: ownerId }).eq('id', canal.id)
        }
      }
    }

    // ── Carrega dados (cálculos sempre no backend) ────────────────────────────
    const pessoasQuery = db.from('pessoas').select('id, nome, apelido')
    if (ownerId) pessoasQuery.eq('owner_id', ownerId)
    const despesasQuery = db.from('despesas').select('id, descricao, valor, data, categoria, status, pago_por, participantes, parcelas')
    if (ownerId) despesasQuery.eq('owner_id', ownerId)
    const [{ data: pessoas }, { data: despesas }] = await Promise.all([pessoasQuery, despesasQuery])
    const todasPessoas = pessoas || []
    const todasDespesas = despesas || []

    const findPessoa = (nome) => {
      if (!nome) return null
      const l = nome.toLowerCase()
      return todasPessoas.find(p =>
        p.nome.toLowerCase().includes(l) || (p.apelido || '').toLowerCase().includes(l)
      )
    }

    const l = text.toLowerCase().trim()
    // lNorm: remove pontuação final (Whisper transcreve "Sim." "Ok!" etc.)
    const lNorm = l.replace(/[^a-záéíóúàãõç\d\s]/gi, '').trim()
    let reply = ''

    // ════════════════════════════════════════════════════════════════════════
    // FORMULÁRIO DE TRANSPORTE — tem prioridade absoluta, ignora sessão ativa
    // ════════════════════════════════════════════════════════════════════════
    if (formularioTransporte) {
      // Limpa sessão residual para não interferir
      if (canal.sessao_pendente) {
        await db.from('canais_mensagem').update({ sessao_pendente: null }).eq('id', canal.id)
      }

      const f = formularioTransporte
      const valorFinal = f.valor_total || 0
      const fmtVal = formatBRL(valorFinal)

      // Busca workspace_id via cadastros_condutores (principal) ou whatsapp_config (fallback)
      // Tenta todas as variantes do telefone (Z-API pode mandar 55XX ou XX)
      let wsId = null
      let wsUserId = ownerId
      let nomeMotorista = null
      let waConf = null
      for (const v of fromVariants) {
        // 1️⃣ Tenta cadastros_condutores
        const { data: condutor } = await db.from('cadastros_condutores')
          .select('workspace_id, owner_id, nome')
          .eq('telefone', v)
          .eq('ativo_whatsapp', true)
          .eq('ativo', true)
          .maybeSingle()
        if (condutor?.workspace_id) {
          waConf = { workspace_id: condutor.workspace_id, user_id: condutor.owner_id }
          nomeMotorista = condutor.nome
          break
        }
        // 2️⃣ Fallback: whatsapp_config
        const { data } = await db.from('whatsapp_config')
          .select('workspace_id, user_id, nome_motorista')
          .eq('phone_number', v)
          .eq('ativo', true)
          .maybeSingle()
        if (data) { waConf = data; nomeMotorista = data.nome_motorista; break }
      }
      if (waConf) {
        wsId = waConf.workspace_id
        wsUserId = waConf.user_id || ownerId
      } else if (ownerId) {
        // workspaces não tem owner_id — usa workspace_members para achar o workspace do usuário
        const { data: mem } = await db.from('workspace_members')
          .select('workspace_id')
          .eq('user_id', ownerId)
          .limit(1)
          .maybeSingle()
        wsId = mem?.workspace_id || null
        if (!wsUserId && wsId) wsUserId = ownerId
      }

      // Garante user_id nunca null (lancamentos.user_id NOT NULL)
      if (wsId && !wsUserId) {
        const { data: membro } = await db.from('workspace_members')
          .select('user_id')
          .eq('workspace_id', wsId)
          .limit(1)
          .maybeSingle()
        wsUserId = membro?.user_id || null
      }

      if (wsId) {
        const descricaoTransporte = [
          f.numero_diario ? `Nº ${f.numero_diario}` : null,
          f.empresa || null,
          (f.local_origem && f.local_destino) ? `${f.local_origem} → ${f.local_destino}` : null,
        ].filter(Boolean).join(' | ')

        // Usa nome do cadastro como fallback para condutor se OCR não encontrou
        const condutorFinal = f.condutor || f.motorista || nomeMotorista || null
        const dadosExtras = {
          ...f,
          ...(condutorFinal ? { condutor: condutorFinal } : {}),
          phone_whatsapp:          from || null,
          nome_motorista_cadastro: nomeMotorista || null,
        }

        const { data: inserted, error: dbErr } = await db.from('lancamentos').insert({
          workspace_id: wsId,
          user_id:      wsUserId,
          tipo:         'receita',
          descricao:    descricaoTransporte || 'Diário do Motorista',
          valor:        valorFinal,
          data:         f.data || today,
          categoria:    'Transporte',
          centro_custo: f.cc || '',
          status:       'rascunho',
          observacoes:  f.observacao || '',
          tipo_formulario: 'transporte',
          dados_extras:    dadosExtras,
          comprovante_url: comprovanteUrl || '',
        }).select('id').single()

        if (dbErr) {
          console.error('[WA] insert lancamento error:', JSON.stringify(dbErr))
        } else if (inserted?.id) {
          db.from('lancamento_eventos').insert({
            lancamento_id: inserted.id,
            tipo:          'criado',
            status_para:   'rascunho',
            descricao:     'Recebido via WhatsApp — aguardando envio para aprovação.',
            usuario_nome:  from || null,
          }).then(() => {}).catch(() => {})
        }

        // Monta resumo de KM para confirmação
        const kmRows = (f.km_rows || []).filter(r => r.total && String(r.total).trim() !== '')
        const parseKm = v => { const n = parseFloat(String(v || '').replace(/[^\d.,]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n }
        const kmAsf = kmRows.filter(r => r.tipo === 'ASFALTO').reduce((s, r) => s + parseKm(r.total), 0)
        const kmTer = kmRows.filter(r => r.tipo === 'TERRA').reduce((s, r) => s + parseKm(r.total), 0)
        const kmTotal = kmAsf + kmTer

        if (dbErr) {
          reply = `❌ Erro ao salvar. Contate o administrador.`
        } else {
          const linhas = [
            `✅ *Imagem processada!*`,
            ``,
            `📋 Nº ${f.numero_diario || '—'} | ${f.empresa || '—'}`,
            `💰 Valor: ${fmtVal}`,
            kmTotal > 0 ? `📏 KM: ${kmTotal.toLocaleString('pt-BR')} (ASF: ${kmAsf.toLocaleString('pt-BR')} / TER: ${kmTer.toLocaleString('pt-BR')})` : null,
            `🚗 Placa: ${f.placa || '—'}`,
            ``,
            `_Pendente de aprovação_`,
          ].filter(v => v !== null)
          reply = linhas.join('\n')
        }
      } else {
        reply = `✅ *Diário do Motorista reconhecido!*\n\n💰 Valor: ${fmtVal}\n🏢 ${f.empresa || '—'}\n\n⚠️ Seu número não está configurado. Acesse *Lançamentos → WhatsApp* para ativar o registro automático.`
      }

    // ════════════════════════════════════════════════════════════════════════
    // ESTADO: aguardando_complemento — preenche campo faltante da imagem
    // ════════════════════════════════════════════════════════════════════════
    } else if (canal.sessao_pendente?.estado === 'aguardando_complemento') {
      const sess = canal.sessao_pendente
      const dados = { ...sess.dados_extraidos }

      if (sess.campo_pendente === 'valor') {
        const novoValor = parseFloat(text.replace(/[^\d.,]/g, '').replace(',', '.'))
        if (!novoValor || novoValor <= 0) {
          reply = 'Valor inválido. Tente novamente, ex: _78,59_'
        } else {
          dados.valor = novoValor
        }
      } else if (sess.campo_pendente === 'estabelecimento') {
        dados.estabelecimento = text.trim()
      }

      if (!reply) {
        const proximoCampo = !dados.valor ? 'valor' : !dados.estabelecimento ? 'estabelecimento' : null
        if (proximoCampo) {
          const novoSess = { ...sess, dados_extraidos: dados, campo_pendente: proximoCampo }
          await db.from('canais_mensagem').update({ sessao_pendente: novoSess }).eq('id', canal.id)
          reply = proximoCampo === 'valor'
            ? 'Qual foi o *valor total*? (ex: 78,59)'
            : 'Qual o *nome do estabelecimento*?'
        } else {
          const pagador = todasPessoas.find(p => p.id === canal.pessoa_id)
          const rascunho = {
            estado: 'aguardando_confirmacao',
            descricao: dados.estabelecimento,
            valor: dados.valor,
            data: dados.data,
            categoria: dados.categoria,
            forma_pagamento: dados.forma_pagamento,
            cnpj: dados.cnpj,
            endereco: dados.endereco,
            telefone: dados.telefone,
            produto: dados.produto,
            quantidade: dados.quantidade,
            litros: dados.litros,
            valor_litro: dados.valor_litro,
            hora: dados.hora,
            nfe_url: dados.nfe_url,
            pago_por_id: canal.pessoa_id,
            pago_por_nome: pagador?.nome || 'você',
            participantes_ids: [canal.pessoa_id],
            participantes_nomes: [pagador?.nome || 'você'],
            comprovante_url: sess.comprovante_url,
          }
          await db.from('canais_mensagem').update({ sessao_pendente: rascunho }).eq('id', canal.id)
          reply = montarConfirmacao(rascunho)
        }
      }

    // ════════════════════════════════════════════════════════════════════════
    // ESTADO: aguardando_confirmacao — só aceita sim/editar/cancelar
    // ════════════════════════════════════════════════════════════════════════
    } else if (canal.sessao_pendente?.estado === 'aguardando_confirmacao') {
      const p = canal.sessao_pendente

      // sim → salva despesa
      if (/^(sim|s|ok|pode|confirma|confirmar)$/i.test(lNorm)) {
        await db.from('canais_mensagem').update({ sessao_pendente: null }).eq('id', canal.id)

        const insertPayload = {
          descricao: p.descricao,
          valor: p.valor,
          data: p.data || today,
          categoria: p.categoria || 'Outros',
          pago_por: p.pago_por_id,
          participantes: p.participantes_ids || [],
          tipo_divisao: 'igual',
          parcelas: 1,
          parcela_atual: 1,
          status: 'pendente',
          cnpj:             safeStr(p.cnpj),
          endereco:         safeStr(p.endereco),
          telefone_local:   safeStr(p.telefone),
          produto:          safeStr(p.produto),
          quantidade:       safeStr(p.quantidade),
          litros:           safeNum(p.litros),
          valor_litro:      safeNum(p.valor_litro),
          hora:             safeStr(p.hora),
          forma_pagamento:  safeStr(p.forma_pagamento),
          nfe_url:          safeStr(p.nfe_url),
          origem:           'whatsapp',
          observacoes:      null,
          comprovante_url:  p.comprovante_url  || null,
          owner_id:         ownerId,
        }
        console.log('[WA] inserindo despesa:', JSON.stringify(insertPayload))
        const { data: inserted, error } = await db.from('despesas').insert(insertPayload).select().single()
        if (error) console.error('[WA] insert despesa error:', JSON.stringify(error))
        else console.log('[WA] despesa inserida id:', inserted?.id)
        reply = error ? '❌ Erro ao salvar. Tente novamente.' : `✅ *${p.descricao}* ${formatBRL(p.valor)} registrado!`

      } else if (/^(n(ão|ao)?|cancelar?|cancela)$/i.test(lNorm)) {
        await db.from('canais_mensagem').update({ sessao_pendente: null }).eq('id', canal.id)
        reply = 'Cancelado. 👍'

      // editar valor X
      } else if (/^editar\s+valor\s+/i.test(lNorm)) {
        const novoValor = parseFloat(lNorm.replace(/[^\d.,]/g, '').replace(',', '.'))
        if (!novoValor || novoValor <= 0) {
          reply = 'Valor inválido. Ex: _editar valor 190_'
        } else {
          const novoP = { ...p, valor: novoValor }
          await db.from('canais_mensagem').update({ sessao_pendente: novoP }).eq('id', canal.id)
          reply = montarConfirmacao(novoP)
        }

      // editar pessoa X
      } else if (/^editar\s+pessoa\s+/i.test(lNorm)) {
        const nomesRaw = lNorm.replace(/^editar\s+pessoa\s+/i, '').split(/\s+e\s+|\s*,\s*/i)
        const novos = nomesRaw.map(n => findPessoa(n.trim())).filter(Boolean)
        if (!novos.length) {
          reply = `Não encontrei essas pessoas. Verifique os nomes em ${APP_URL}`
        } else {
          const novoP = {
            ...p,
            participantes_ids: novos.map(p => p.id),
            participantes_nomes: novos.map(p => p.nome),
          }
          await db.from('canais_mensagem').update({ sessao_pendente: novoP }).eq('id', canal.id)
          reply = montarConfirmacao(novoP)
        }

      // editar categoria X
      } else if (/^editar\s+categoria\s+/i.test(lNorm)) {
        const cats = ['Alimentação','Transporte','Moradia','Saúde','Lazer','Educação','Serviços','Vestuário','Outros']
        const novaStr = text.replace(/^editar\s+categoria\s+/i, '').trim()
        const novaCat = cats.find(c => c.toLowerCase().startsWith(novaStr.toLowerCase())) || 'Outros'
        const novoP = { ...p, categoria: novaCat }
        await db.from('canais_mensagem').update({ sessao_pendente: novoP }).eq('id', canal.id)
        reply = montarConfirmacao(novoP)

      } else {
        reply = 'Aguardando confirmação. Responda *sim* ou *cancelar*.'
      }

    // ════════════════════════════════════════════════════════════════════════
    // ESTADO: normal — parse de intenção via IA
    // ════════════════════════════════════════════════════════════════════════
    } else {
      // Limpa qualquer sessão residual
      if (canal.sessao_pendente) {
        await db.from('canais_mensagem').update({ sessao_pendente: null }).eq('id', canal.id)
      }

      // ════════════════════════════════════════════════════════════════════════
      // MÓDULO REFEIÇÕES — Líder solicita via WA
      // ════════════════════════════════════════════════════════════════════════
      if (/pedido.*(refei[çc][ãa]|almo[çc]o|caf[eé])|refei[çc][ãa]o|marmita|solicita.*comi/i.test(text)) {
        let equipe = null
        for (const v of fromVariants) {
          const { data } = await db.from('refei_equipes')
            .select('*').eq('lider_telefone', v).eq('ativo', true).limit(1).maybeSingle()
          if (data) { equipe = data; break }
        }
        if (equipe) {
          const { data: existente } = await db.from('refei_solicitacoes')
            .select('token_lider, status').eq('equipe_id', equipe.id).eq('status', 'rascunho')
            .order('criado_em', { ascending: false }).limit(1).maybeSingle()
          let tokenLider
          if (existente) {
            tokenLider = existente.token_lider
          } else {
            const { data: novo } = await db.from('refei_solicitacoes').insert({
              workspace_id:        equipe.workspace_id,
              owner_id:            equipe.owner_id,
              equipe_id:           equipe.id,
              lider_nome:          equipe.lider_nome,
              lider_telefone:      fromNorm,
              supervisor_telefone: equipe.supervisor_telefone,
              status:              'rascunho',
            }).select('token_lider').single()
            tokenLider = novo?.token_lider
          }
          const base = APP_URL
          await sendWA(from, `🍽️ *Solicitação de Refeição*\n\nClique para fazer seu pedido:\n${base}/refeicao/${tokenLider}\n\n_Após enviar, aguarde aprovação do supervisor._`)
          return res.status(200).end()
        }
        // Se não encontrou equipe para este telefone, cai para fluxo normal
      }

      if (imagemExtraida) {
        const campoFaltante = !imagemExtraida.valor ? 'valor' : !imagemExtraida.estabelecimento ? 'estabelecimento' : null
        if (campoFaltante) {
          const partes = []
          if (imagemExtraida.estabelecimento) partes.push(`📍 *${imagemExtraida.estabelecimento}*`)
          if (imagemExtraida.valor) partes.push(`💰 ${formatBRL(imagemExtraida.valor)}`)
          if (imagemExtraida.forma_pagamento) partes.push(`💳 ${imagemExtraida.forma_pagamento}`)
          if (imagemExtraida.data && imagemExtraida.data !== today) partes.push(`📅 ${imagemExtraida.data.split('-').reverse().join('/')}`)
          const resumo = partes.join('\n')
          const pergunta = campoFaltante === 'valor'
            ? `${resumo}\n\nQual foi o *valor total*? (ex: 78,59)`.trimStart()
            : `${resumo}\n\nQual o *nome do estabelecimento*?`.trimStart()
          const sessao = {
            estado: 'aguardando_complemento',
            campo_pendente: campoFaltante,
            dados_extraidos: imagemExtraida,
            comprovante_url: comprovanteUrl,
          }
          await db.from('canais_mensagem').update({ sessao_pendente: sessao }).eq('id', canal.id)
          reply = pergunta
        } else {
          const pagador = todasPessoas.find(p => p.id === canal.pessoa_id)
          const rascunho = {
            estado: 'aguardando_confirmacao',
            descricao: imagemExtraida.estabelecimento,
            valor: imagemExtraida.valor,
            data: imagemExtraida.data,
            categoria: imagemExtraida.categoria,
            forma_pagamento: imagemExtraida.forma_pagamento,
            cnpj: imagemExtraida.cnpj,
            endereco: imagemExtraida.endereco,
            telefone: imagemExtraida.telefone,
            produto: imagemExtraida.produto,
            quantidade: imagemExtraida.quantidade,
            litros: imagemExtraida.litros,
            valor_litro: imagemExtraida.valor_litro,
            hora: imagemExtraida.hora,
            nfe_url: imagemExtraida.nfe_url,
            pago_por_id: canal.pessoa_id,
            pago_por_nome: pagador?.nome || 'você',
            participantes_ids: [canal.pessoa_id],
            participantes_nomes: [pagador?.nome || 'você'],
            comprovante_url: comprovanteUrl,
          }
          await db.from('canais_mensagem').update({ sessao_pendente: rascunho }).eq('id', canal.id)
          reply = montarConfirmacao(rascunho)
        }
      } else {

      const intent = await parseIntent(text, todasPessoas, today, canal.historico)

      // ── criar_despesa: modo rascunho obrigatório ─────────────────────────
      if (intent.intencao === 'criar_despesa') {
        if (!intent.descricao || !intent.valor) {
          reply = 'Não entendi o valor. Ex: _"Paguei R$ 80 no mercado, dividir com Camila"_'
        } else {
          const pagador = findPessoa(intent.pago_por) || { id: canal.pessoa_id, nome: 'você' }
          const parts = (intent.participantes || []).map(n => findPessoa(n)).filter(Boolean)
          const participantesIds = parts.length > 0 ? parts.map(p => p.id) : [canal.pessoa_id]
          const participantesNomes = parts.length > 0 ? parts.map(p => p.nome) : ['você']

          const rascunho = {
            estado: 'aguardando_confirmacao',
            descricao: intent.descricao,
            valor: intent.valor,
            data: intent.data || today,
            categoria: intent.categoria || 'Outros',
            pago_por_id: pagador.id,
            pago_por_nome: pagador.nome,
            participantes_ids: participantesIds,
            participantes_nomes: participantesNomes,
            comprovante_url: comprovanteUrl,
          }

          await db.from('canais_mensagem').update({ sessao_pendente: rascunho }).eq('id', canal.id)
          reply = montarConfirmacao(rascunho)
        }

      // ── consultar_saldo ──────────────────────────────────────────────────
      } else if (intent.intencao === 'consultar_saldo') {
        const saldos = calcularSaldos(todasDespesas, todasPessoas)
        if (intent.pessoa) {
          const s = saldos.find(s => s.nome.toLowerCase().includes(intent.pessoa.toLowerCase()))
          reply = !s
            ? `Não encontrei "${intent.pessoa}".`
            : s.saldo > 0 ? `${s.nome} te deve ${formatBRL(s.saldo)}.`
            : s.saldo < 0 ? `Você deve ${formatBRL(Math.abs(s.saldo))} para ${s.nome}.`
            : `${s.nome} está quite. ✅`
        } else {
          const pendentes = saldos.filter(s => Math.abs(s.saldo) > 0.01)
          reply = pendentes.length === 0
            ? '✅ Todos os saldos estão quitados!'
            : '*Saldos pendentes:*\n' + pendentes.map(s =>
                s.saldo > 0
                  ? `${s.nome} te deve ${formatBRL(s.saldo)}`
                  : `Você deve ${formatBRL(Math.abs(s.saldo))} a ${s.nome}`
              ).join('\n')
        }

      // ── listar_pendencias ────────────────────────────────────────────────
      } else if (intent.intencao === 'listar_pendencias') {
        const pendentes = todasDespesas.filter(e => e.status === 'pendente')
        if (!pendentes.length) {
          reply = '✅ Nenhuma despesa pendente!'
        } else {
          reply = '*Pendências:*\n' + pendentes.slice(0, 5).map(e =>
            `• ${e.descricao} — ${formatBRL(e.valor)}`
          ).join('\n')
          if (pendentes.length > 5) reply += `\n_...e mais ${pendentes.length - 5}. Veja em ${APP_URL}_`
        }

      // ── fechar_mes: detalhamento completo ───────────────────────────────
      } else if (intent.intencao === 'fechar_mes') {
        const mes = intent.mes || today.slice(0, 7)
        const resultado = fecharMes(todasDespesas, todasPessoas, mes)
        reply = resultado || `Nenhuma despesa encontrada para ${mes}.`

      // ── marcar_como_pago: nunca sobrescreve sem confirmação ──────────────
      } else if (intent.intencao === 'marcar_como_pago') {
        const busca = (intent.descricao || '').toLowerCase()
        const d = todasDespesas.find(e => e.status === 'pendente' && e.descricao.toLowerCase().includes(busca))
        if (!d) {
          reply = `Não encontrei despesa pendente com "${intent.descricao}".`
        } else {
          const rascunho = {
            estado: 'aguardando_confirmacao',
            intencao: 'marcar_como_pago',
            despesa_id: d.id,
            descricao: d.descricao,
            valor: d.valor,
          }
          await db.from('canais_mensagem').update({ sessao_pendente: rascunho }).eq('id', canal.id)
          reply = `Marcar *"${d.descricao}"* (${formatBRL(d.valor)}) como pago?\nResponda *sim* ou *cancelar*.`
        }

      // ── desconhecido ─────────────────────────────────────────────────────
      } else {
        reply = 'Posso te ajudar com:\n• _"Paguei 80 no uber"_ — registrar gasto\n• _"Quanto devo?"_ — ver saldos\n• _"Lista pendências"_ — despesas em aberto\n• _"Fechar meu mês"_ — resumo do mês\n• _"Marcar mercado como pago"_'
      }

      } // fim else imagemExtraida
    }

    // ── Confirma marcar_como_pago quando está na sessão ───────────────────
    // (resolvido dentro do bloco aguardando_confirmacao, mas precisa checar intencao)
    if (canal.sessao_pendente?.estado === 'aguardando_confirmacao' &&
        canal.sessao_pendente?.intencao === 'marcar_como_pago' &&
        /^(sim|s|ok|pode|confirma|confirmar)$/i.test(lNorm) && !reply) {
      const p = canal.sessao_pendente
      await db.from('canais_mensagem').update({ sessao_pendente: null }).eq('id', canal.id)
      await db.from('despesas').update({ status: 'pago' }).eq('id', p.despesa_id)
      reply = `✅ "${p.descricao}" marcada como paga.`
    }

    if (reply) {
      await sendWA(from, reply)
      db.from('mensagens_whatsapp').insert({
        telefone: from,
        direcao: 'saida',
        conteudo: reply,
      }).then(() => {})

      // Histórico: últimas 10 trocas
      const novoHistorico = [
        ...(canal.historico || []),
        { role: 'user', content: textoOriginal || text },
        { role: 'assistant', content: reply },
      ].slice(-20)
      db.from('canais_mensagem').update({ historico: novoHistorico }).eq('id', canal.id).then(() => {})
    }

    return res.status(200).end()
  } catch (err) {
    console.error('[WA] webhook error:', JSON.stringify({ msg: err.message, type: err.constructor?.name, stack: (err.stack || '').slice(0, 400) }))
    return res.status(200).end()
  }
}

