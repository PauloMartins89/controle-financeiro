import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { runOCR } from './_ocr.js'
import { rotearMensagem } from './_wa-router.js'
import { handleAgendaWA } from './_agenda-wa.js'
import { processarMensagemGrupo } from './_chamados-engine.js'

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Z-API — recebe mensagem do WhatsApp
// Fluxo: foto recebida → OCR → cria lançamento no Supabase → responde motorista
//
// Configurar no Z-API:
//   Webhook URL: ${APP_URL}/api/webhook-whatsapp
//   Webhook Token: valor de WHATSAPP_WEBHOOK_TOKEN
//
// Variáveis de ambiente necessárias (Vercel):
//   GROQ_API_KEY
//   SUPABASE_URL         (ou VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_KEY (service_role key — bypassa RLS)
//   ZAPI_INSTANCE_ID
//   ZAPI_TOKEN
//   WHATSAPP_WEBHOOK_TOKEN  (token de segurança — qualquer string aleatória)
// ─────────────────────────────────────────────────────────────────────────────

const supabaseUrl       = process.env.SUPABASE_URL       || process.env.VITE_SUPABASE_URL
const supabaseServiceKey= process.env.SUPABASE_SERVICE_KEY
const zapiInstanceId    = process.env.ZAPI_INSTANCE_ID
const zapiToken         = process.env.ZAPI_TOKEN
const webhookToken      = process.env.WHATSAPP_WEBHOOK_TOKEN
const APP_URL           = process.env.APP_URL || 'https://smartpro.app.br'

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey, { realtime: { params: { log_level: 'disabled' }, transport: ws }, global: {} })
}

// Envia mensagem de texto via Z-API
async function zapiSendText(phone, message) {
  if (!zapiInstanceId || !zapiToken) {
    console.error('[zapiSendText] ZAPI_INSTANCE_ID ou ZAPI_TOKEN não configurado')
    return false
  }
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
        },
        body: JSON.stringify({ phone, message }),
      }
    )
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      console.error(`[zapiSendText] falhou ${res.status} para ${phone}:`, err)
      return false
    }
    return true
  } catch (e) {
    console.error('[zapiSendText] exceção:', e?.message)
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Processa aprovação/reprovação de refeição via botão ou texto WA
// tokenCompact = UUID sem hífens (32 chars)
// ─────────────────────────────────────────────────────────────────────────────
async function processRefeiApproval(supabase, tokenCompact, acao, fromPhone) {
  // Reconstrói UUID com hífens
  const token = [
    tokenCompact.slice(0, 8),
    tokenCompact.slice(8, 12),
    tokenCompact.slice(12, 16),
    tokenCompact.slice(16, 20),
    tokenCompact.slice(20),
  ].join('-')

  const { data: sol } = await supabase
    .from('refei_solicitacoes')
    .select('*')
    .eq('token_aprovacao', token)
    .maybeSingle()

  if (!sol) {
    await zapiSendText(fromPhone, '⚠️ Solicitação não encontrada. O link pode ter expirado.')
    return
  }
  if (!['pendente', 'aguardando_aprovacao'].includes(sol.status)) {
    const statusTxt = { aprovado: 'já aprovado', reprovado: 'já reprovado', entregue: 'já entregue', fechado: 'fechado' }
    await zapiSendText(fromPhone, `ℹ️ Este pedido já foi processado (${statusTxt[sol.status] || sol.status}).`)
    return
  }

  const fmtBRL = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const fmtData = d => d ? String(d).split('-').reverse().join('/') : '—'

  await supabase.from('refei_solicitacoes').update({
    status:            acao,
    motivo_reprovacao: null,
    aprovado_em:       acao === 'aprovado' ? new Date().toISOString() : null,
  }).eq('id', sol.id)

  // Registra evento de auditoria
  await supabase.from('refei_pedido_eventos').insert({
    solicitacao_id: sol.id,
    tipo:           acao === 'aprovado' ? 'aprovado' : 'reprovado',
    descricao:      acao === 'aprovado' ? 'Pedido aprovado pelo supervisor via WhatsApp' : 'Pedido reprovado pelo supervisor via WhatsApp',
    ator:           fromPhone,
    ator_tipo:      'supervisor',
  }).catch(e => console.error('[webhook-whatsapp] logEvento error:', e?.message))
    // Usa o fluxo automático: notifica restaurante e avança status
    const { data: itens } = await supabase.from('refei_itens').select('*').eq('solicitacao_id', sol.id)
    // Chama o endpoint interno de aprovação para reutilizar triggerRestauranteFlow
    // Como estamos no webhook não podemos chamar a função diretamente, replicamos a lógica
    const [{ data: rest }, { data: equipe }] = await Promise.all([
      supabase.from('refei_restaurantes').select('*').eq('id', sol.restaurante_id).maybeSingle(),
      supabase.from('refei_equipes').select('nome').eq('id', sol.equipe_id).maybeSingle(),
    ])
    const fmtBRL2 = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    if (rest?.telefone_wa) {
      const nomes   = (itens || []).map(i => `• ${i.colaborador_nome}${i.refeicao ? ' 🍽️' : ''}${i.cafe ? ' ☕' : ''}`)
      const qtdRef  = (itens || []).filter(i => i.refeicao).length
      const qtdCafe = (itens || []).filter(i => i.cafe).length
      const linkRestaurante = `${APP_URL}/rc/${sol.token_restaurante}`
      const confirmaLinha = rest.confirma_pedido
        ? `\n\n✅ *Confirme o recebimento do pedido:*\n${linkRestaurante}`
        : `\n\n📋 *Acesse os detalhes do pedido:*\n${linkRestaurante}`
      const msg = [
        `🏪 *Pedido Confirmado: ${sol.ticket || sol.numero_pedido}*`,
        `Equipe: ${equipe?.nome || '—'}`,
        `📅 Data: ${fmtData(sol.data_refeicao)}`,
        `─────────────────────`,
        ...nomes,
        `─────────────────────`,
        `🍽️ ${qtdRef} refeição(ões)  ☕ ${qtdCafe} café(s)`,
        `*Total: ${fmtBRL2(sol.valor_total)}*${confirmaLinha}`,
      ].join('\n')
      await zapiSendText(rest.telefone_wa, msg)
    }
    await supabase.from('refei_solicitacoes').update({
      status: 'enviado_restaurante',
      env_restaurante_em: new Date().toISOString(),
    }).eq('id', sol.id)
    const msgLider = rest?.confirma_pedido
      ? `✅ Pedido *${sol.ticket || sol.numero_pedido}* aprovado!\n📅 Data: ${fmtData(sol.data_refeicao)}\n\nO restaurante receberá a solicitação e confirmará o recebimento.`
      : `✅ Pedido *${sol.ticket || sol.numero_pedido}* aprovado!\n📅 Data: ${fmtData(sol.data_refeicao)}\n\nO restaurante foi notificado.`
    if (sol.lider_telefone) await zapiSendText(sol.lider_telefone, msgLider)
    // Confirma para o supervisor
    await zapiSendText(fromPhone, `✅ *${sol.numero_pedido} aprovado!*\nO restaurante e o líder foram notificados.`)
  } else {
    // Notifica líder
    if (sol.lider_telefone) {
      await zapiSendText(sol.lider_telefone, `❌ Pedido *${sol.numero_pedido}* reprovado.\n\nAcesse o link para editar e reenviar: ${APP_URL}/refeicao/${sol.token_lider}`)
    }
    // Confirma para o supervisor
    await zapiSendText(fromPhone, `❌ *${sol.numero_pedido} reprovado.* O líder foi notificado.`)
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Processa validação de entrega pelo líder via SIM/NÃO ou link
// ────────────────────────────────────────────────────────────────────────────────
async function processRefeiValidacao(supabase, solId, resultado, fromPhone) {
  const { data: sol } = await supabase
    .from('refei_solicitacoes').select('*').eq('id', solId).maybeSingle()
  if (!sol) return

  const novoStatus = resultado === 'correto' ? 'finalizado' : 'finalizado_com_ocorrencia'
  await supabase.from('refei_solicitacoes').update({
    status:              novoStatus,
    validado_em:         new Date().toISOString(),
    resultado_validacao: resultado,
  }).eq('id', sol.id)

  // Registra evento de auditoria
  await supabase.from('refei_pedido_eventos').insert({
    solicitacao_id: sol.id,
    tipo:           resultado === 'correto' ? 'entrega_confirmada' : 'ocorrencia_registrada',
    descricao:      resultado === 'correto' ? 'Entrega confirmada pelo líder via WhatsApp' : 'Ocorrência registrada pelo líder via WhatsApp',
    ator:           fromPhone,
    ator_tipo:      'lider',
  }).catch(e => console.error('[webhook-whatsapp] logEvento validacao error:', e?.message))

  const fmtData2 = d => d ? String(d).split('-').reverse().join('/') : '—'
  if (resultado === 'correto') {
    await zapiSendText(fromPhone, `✅ *${sol.ticket || sol.numero_pedido}* — Entrega confirmada! Obrigado.`)
  } else {
    await zapiSendText(
      fromPhone,
      `⚠️ *${sol.ticket || sol.numero_pedido}* — Ocorrência registrada.\nSe quiser detalhar, acesse: ${APP_URL}/vr/${sol.token_lider}`,
    )
  }
}

// Busca workspace configurado para um número de telefone
async function getWorkspaceForPhone(supabase, phone) {
  // 1️⃣ Busca em cadastros_condutores (fonte principal)
  const { data: condutor } = await supabase
    .from('cadastros_condutores')
    .select('workspace_id, owner_id, nome')
    .eq('telefone', phone)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()
  if (condutor?.workspace_id) {
    return { workspace_id: condutor.workspace_id, user_id: condutor.owner_id, nome_motorista: condutor.nome }
  }
  // 2️⃣ Fallback: whatsapp_config (compatibilidade retroativa)
  const { data } = await supabase
    .from('whatsapp_config')
    .select('workspace_id, user_id, nome_motorista')
    .eq('phone_number', phone)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()
  return data || null
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Aceita GET para verificação do webhook (Z-API às vezes faz GET)
  if (req.method === 'GET') return res.status(200).send('OK')
  if (req.method !== 'POST') return res.status(405).end()

  // Verifica token de segurança (header ou query string)
  if (webhookToken) {
    const tokenHeader = req.headers['x-webhook-token'] || req.query.token
    if (tokenHeader !== webhookToken) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  try {
    const body = req.body || {}

    // Z-API envia mensagens em body.phone e body.type
    const fromPhone = body.phone || body.from
    const msgType   = (body.type || '').toLowerCase()
    const fromMe    = body.fromMe === true

    // Mensagens de grupo: redireciona para o motor de chamados (fire-and-forget)
    // O bot NÃO responde no grupo — apenas lê e processa internamente.
    if (body.isGroupMsg) {
      processarMensagemGrupo(body).catch(e =>
        console.error('[webhook-whatsapp] processarMensagemGrupo:', e?.message)
      )
      return res.status(200).json({ ok: true, grupo: true })
    }

    // Ignora mensagens enviadas pelo próprio bot (individuais)
    if (fromMe) return res.status(200).json({ ignored: true })

    // ── Variantes do número (com/sem 55, com/sem dígito 9) ─────────────────
    const fromNorm = (fromPhone || '').replace(/\D/g, '')
    const sem55    = fromNorm.replace(/^55/, '')
    const com9     = sem55.length === 10 ? sem55.slice(0,2) + '9' + sem55.slice(2) : sem55
    const sem9     = sem55.length === 11 && sem55[2] === '9' ? sem55.slice(0,2) + sem55.slice(3) : sem55
    const phoneVariants = [...new Set([fromNorm, sem55, '55'+sem55, '55'+com9, com9, '55'+sem9, sem9].filter(Boolean))]

    // ── Resposta de botão Z-API (ButtonResponseMessage) ────────────────────
    if (msgType === 'buttonresponsemessage' || body.buttonResponseMessage) {
      const btnId = (body.buttonResponseMessage?.buttonId || '').toLowerCase()
      const supabase = getSupabase()
      if (supabase && (btnId.startsWith('sim:') || btnId.startsWith('nao:'))) {
        const acao          = btnId.startsWith('sim:') ? 'aprovado' : 'reprovado'
        const tokenCompact  = btnId.slice(4).replace(/-/g, '')
        await processRefeiApproval(supabase, tokenCompact, acao, fromPhone)
      }
      return res.status(200).json({ ok: true })
    }

    // ── Texto "SIM" / "NÃO" do supervisor (fallback p/ quando botões falham) ─
    if (msgType === 'chat' || msgType === 'text') {
      const txtRaw = (body.text?.message || body.text || body.body || '').trim().toUpperCase()
      if (txtRaw === 'SIM' || txtRaw === 'NÃO' || txtRaw === 'NAO' || txtRaw === 'N') {
        const supabase = getSupabase()
        if (supabase && fromPhone) {
          // Busca a solicitação pendente mais recente para este supervisor (todas as variantes de número)
          // 1️⃣ Verifica se é supervisor com pedido aguardando aprovação
          let sol = null
          for (const v of phoneVariants) {
            const { data } = await supabase
              .from('refei_solicitacoes')
              .select('token_aprovacao')
              .eq('supervisor_telefone', v)
              .in('status', ['pendente', 'aguardando_aprovacao'])
              .order('criado_em', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (data) { sol = data; break }
          }
          if (sol) {
            const acao = (txtRaw === 'SIM') ? 'aprovado' : 'reprovado'
            const tokenCompact = sol.token_aprovacao.replace(/-/g, '')
            await processRefeiApproval(supabase, tokenCompact, acao, fromPhone)
            return res.status(200).json({ ok: true })
          }

          // 2️⃣ Verifica se é líder com pedido aguardando validação de entrega
          let solValidacao = null
          for (const v of phoneVariants) {
            const { data } = await supabase
              .from('refei_solicitacoes')
              .select('id')
              .eq('lider_telefone', v)
              .eq('status', 'aguardando_validacao')
              .order('data_refeicao', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (data) { solValidacao = data; break }
          }
          if (solValidacao) {
            const resultado = (txtRaw === 'SIM') ? 'correto' : 'com_ocorrencia'
            await processRefeiValidacao(supabase, solValidacao.id, resultado, fromPhone)
            return res.status(200).json({ ok: true })
          }
        }
      }
    }

    // ── Resposta do restaurante: PREPARANDO / ENTREGUE ──────────────────────
    if (msgType === 'chat' || msgType === 'text') {
      const txtRaw2 = (body.text?.message || body.text || body.body || '').trim().toUpperCase()
      if (txtRaw2 === 'PREPARANDO' || txtRaw2 === 'ENTREGUE') {
        const supabase = getSupabase()
        if (supabase && fromPhone) {
          // Busca restaurante pelo telefone (todas as variantes)
          let rest = null
          for (const v of phoneVariants) {
            const { data } = await supabase
              .from('refei_restaurantes')
              .select('id, nome')
              .eq('telefone_wa', v)
              .eq('ativo', true)
              .limit(1)
              .maybeSingle()
            if (data) { rest = data; break }
          }
          if (rest) {
            const novoStatus = txtRaw2 === 'PREPARANDO' ? 'preparando' : 'entregue'
            const statusAtual = txtRaw2 === 'PREPARANDO' ? 'aprovado' : 'preparando'
            const { data: sol } = await supabase
              .from('refei_solicitacoes')
              .select('*')
              .eq('restaurante_id', rest.id)
              .eq('status', statusAtual)
              .order('aprovado_em', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (sol) {
              await supabase.from('refei_solicitacoes').update({ status: novoStatus }).eq('id', sol.id)
              const fmtData = d => d ? String(d).split('-').reverse().join('/') : '—'
              if (txtRaw2 === 'PREPARANDO') {
                // Avisa líder que está em preparo
                if (sol.lider_telefone) {
                  await zapiSendText(sol.lider_telefone, `🍳 Pedido *${sol.numero_pedido}* em preparo!\nData: ${fmtData(sol.data_refeicao)}\nRestaurante: ${rest.nome}`)
                }
                await zapiSendText(fromPhone, `✅ *${sol.numero_pedido}* marcado como PREPARANDO. Obrigado!`)
              } else {
                // Avisa líder e supervisor que foi entregue
                if (sol.lider_telefone) {
                  await zapiSendText(sol.lider_telefone, `✅ Pedido *${sol.numero_pedido}* entregue!\nData: ${fmtData(sol.data_refeicao)}\nBom proveito! 🍽️`)
                }
                if (sol.supervisor_telefone) {
                  await zapiSendText(sol.supervisor_telefone, `✅ Pedido *${sol.numero_pedido}* entregue pelo restaurante ${rest.nome}.\nData: ${fmtData(sol.data_refeicao)}`)
                }
                await zapiSendText(fromPhone, `✅ *${sol.numero_pedido}* marcado como ENTREGUE. Obrigado!`)
              }
            } else {
              await zapiSendText(fromPhone, `ℹ️ Nenhum pedido ${statusAtual} encontrado para confirmar.`)
            }
            return res.status(200).json({ ok: true, restaurante: true })
          }
        }
      }
    }

    // ── Líder de refeição: reenviar link do formulário ─────────────────────
    if (fromPhone) {
      const supabaseRef = getSupabase()
      if (supabaseRef) {
        let equipe = null
        for (const v of phoneVariants) {
          const { data } = await supabaseRef
            .from('refei_equipes')
            .select('*')
            .eq('lider_telefone', v)
            .eq('ativo', true)
            .limit(1)
            .maybeSingle()
          if (data) { equipe = data; break }
        }
        if (equipe) {
          const { data: sol } = await supabaseRef
            .from('refei_solicitacoes')
            .select('token_lider, numero_pedido, status')
            .eq('equipe_id', equipe.id)
            .in('status', ['rascunho', 'reprovado', 'pendente'])
            .order('criado_em', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (sol && ['rascunho', 'reprovado'].includes(sol.status)) {
            const avisoReprovado = sol.status === 'reprovado' ? '\n\n⚠️ Seu pedido anterior foi reprovado. Corrija e reenvie.' : ''
            await zapiSendText(fromPhone,
              `🍽️ *Pedido de Refeição — ${equipe.nome}*${avisoReprovado}\n\nAcesse o formulário para preencher e enviar:\n${APP_URL}/refeicao/${sol.token_lider}`)
          } else if (sol?.status === 'pendente') {
            await zapiSendText(fromPhone,
              `⏳ Seu pedido *${sol.numero_pedido}* já foi enviado e está aguardando aprovação do supervisor.`)
          } else {
            // Nenhum pedido ativo — cria novo rascunho automaticamente
            const { data: novo } = await supabaseRef.from('refei_solicitacoes').insert({
              workspace_id:        equipe.workspace_id,
              owner_id:            equipe.owner_id,
              equipe_id:           equipe.id,
              lider_nome:          equipe.lider_nome,
              lider_telefone:      equipe.lider_telefone,
              supervisor_telefone: equipe.supervisor_telefone,
              status:              'rascunho',
            }).select('token_lider').single()
            if (novo?.token_lider) {
              await zapiSendText(fromPhone,
                `🍽️ *Pedido de Refeição — ${equipe.nome}*\n\nAcesse o formulário para preencher e enviar:\n${APP_URL}/refeicao/${novo.token_lider}`)
            } else {
              await zapiSendText(fromPhone, `⚠️ Erro ao criar pedido. Contate o administrador.`)
            }
          }
          return res.status(200).json({ ok: true, leader: true })
        }
      }
    }

    // ── Agenda: roteamento inteligente para áudio/texto de gestores ──────────
    if (fromPhone && (msgType === 'audio' || msgType === 'ptt' || msgType === 'chat' || msgType === 'text')) {
      const supabaseAgenda = getSupabase()
      if (supabaseAgenda) {
        try {
          const destino = await rotearMensagem(body, fromPhone, phoneVariants, supabaseAgenda)
          if (destino === 'agenda') {
            await handleAgendaWA(body, fromPhone, phoneVariants, zapiSendText, supabaseAgenda)
            return res.status(200).json({ ok: true, routed: 'agenda' })
          }
        } catch (e) {
          console.error('[webhook-wa] agenda routing error:', e.message)
        }
      }
    }

    // Só processa se for imagem
    if (msgType !== 'image') {
      if (fromPhone) {
        await zapiSendText(
          fromPhone,
          '📋 Olá! Envie uma *foto do Diário do Motorista* para eu registrar automaticamente o lançamento.'
        )
      }
      return res.status(200).json({ ignored: true, reason: 'not_image' })
    }

    // Obtém base64 da imagem
    const imageBase64 = body.image?.base64 || body.imageBase64
    if (!imageBase64) {
      if (fromPhone) await zapiSendText(fromPhone, '⚠️ Não consegui ler a imagem. Tente enviar novamente.')
      return res.status(200).json({ error: 'no_image_data' })
    }

    // Confirma recebimento imediatamente
    if (fromPhone) {
      await zapiSendText(fromPhone, '⏳ Recebi a foto! Estou analisando o formulário com IA...')
    }

    // Supabase — precisa antes do OCR para buscar template do workspace
    const supabase = getSupabase()
    if (!supabase) {
      if (fromPhone) await zapiSendText(fromPhone, '⚠️ Erro interno. Contate o administrador.')
      return res.status(500).json({ error: 'supabase_not_configured' })
    }

    // Busca workspace associado ao número do motorista
    const wsConfig = await getWorkspaceForPhone(supabase, fromPhone)
    if (!wsConfig) {
      await zapiSendText(
        fromPhone,
        `⚠️ Seu número *${fromPhone}* não está cadastrado no sistema.\nPeça ao administrador para cadastrá-lo em *Configurações → WhatsApp*.`
      )
      return res.status(200).json({ error: 'phone_not_configured' })
    }

    // Busca form_template ativo para o workspace (primeiro ativo encontrado)
    let formTemplate = null
    try {
      const { data: tmpl } = await supabase
        .from('form_templates')
        .select('id, nome, tipo_base, campos')
        .eq('workspace_id', wsConfig.workspace_id)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      formTemplate = tmpl || null
      if (formTemplate) {
        console.log(`[webhook-wa] usando form_template: "${formTemplate.nome}" (${formTemplate.tipo_base})`)
      }
    } catch (e) {
      console.warn('[webhook-wa] erro ao buscar form_template:', e.message)
    }

    // Roda OCR — passa o template para extração dinâmica se disponível
    let ocr
    try {
      ocr = await runOCR(imageBase64, { template: formTemplate })
    } catch (e) {
      if (fromPhone) await zapiSendText(fromPhone, '❌ Não consegui ler o formulário. Verifique se a foto está nítida e tente novamente.')
      return res.status(200).json({ error: 'ocr_failed', detail: e.message })
    }

    // Monta payload
    const d = ocr
    const isTransporte = d.tipo_formulario === 'transporte'
    const valorFinal   = isTransporte ? (d.valor_total || 0) : (d.valor || 0)

    // Usa nome_motorista do cadastro como fallback para condutor se OCR não encontrou
    const nomeCondutor = d.condutor || d.motorista || wsConfig.nome_motorista || null
    const ocrComCondutor = {
      ...ocr,
      ...(nomeCondutor ? { condutor: nomeCondutor } : {}),
      phone_whatsapp:          fromPhone || null,
      nome_motorista_cadastro: wsConfig.nome_motorista || null,
    }

    const descricao = isTransporte
      ? `Nº ${d.numero_diario || '—'} | ${d.empresa || ''} | ${d.local_origem || ''} → ${d.local_destino || ''}`.trim()
      : (d.tipo_formulario === 'rdo' || d._template_nome?.includes('Relatório Diário'))
        ? `RDO ${d.numero_rdo || d.numero_documento || '—'} | ${d.empresa || ''} | ${d.data || ''}`.trim()
        : (d.descricao || 'Documento digitalizado via WhatsApp')

    const { error: dbError } = await supabase.from('lancamentos').insert({
      workspace_id:    wsConfig.workspace_id,
      user_id:         wsConfig.user_id,
      tipo:            isTransporte ? 'receita' : (d.tipo || 'despesa'),
      descricao,
      valor:           valorFinal,
      data:            d.data || new Date().toISOString().slice(0, 10),
      categoria:       isTransporte ? 'Transporte' : (d.categoria || 'Outros'),
      centro_custo:    isTransporte ? (d.cc || '') : (d.centro_custo || ''),
      status:          'pendente',
      observacoes:     isTransporte ? (d.observacao || '') : (d.observacoes || ''),
      tipo_formulario: d.tipo_formulario,
      dados_extras:    ocrComCondutor,
      comprovante_url: '',
    })

    if (dbError) {
      await zapiSendText(fromPhone, '❌ Erro ao salvar o lançamento. Contate o administrador.')
      return res.status(200).json({ error: 'db_insert_failed', detail: dbError.message })
    }

    // Confirmação para o motorista
    let confirmMsg
    if (isTransporte) {
      const fmtVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorFinal)
      confirmMsg = [
        `✅ *Diário do Motorista registrado com sucesso!*`,
        ``,
        `📋 *Nº:* ${d.numero_diario || '—'}`,
        `🏢 *Empresa:* ${d.empresa || '—'}`,
        `📍 *Rota:* ${d.local_origem || '—'} → ${d.local_destino || '—'}`,
        `🚗 *Placa:* ${d.placa || '—'}`,
        `👤 *Solicitante:* ${d.solicitante || '—'}`,
        `💰 *Valor:* ${fmtVal}`,
        ``,
        `_Status: Pendente de aprovação_`,
      ].join('\n')
    } else {
      const fmtVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorFinal)
      // Mensagem enriquecida para RDO Birigui
      if (d.tipo_formulario === 'rdo' || d._template_nome?.includes('Relatório Diário')) {
        const totalH = d.jornada_total_horas || '—'
        const locais = d.locais_servico ? `\n📍 *Locais:* ${d.locais_servico}` : ''
        const hDiur  = d.horas_diurnas   ? `\n☀️ *H Diurnas:* ${d.horas_diurnas}h` : ''
        const hNot   = d.horas_noturnas  ? `\n🌙 *H Noturnas:* ${d.horas_noturnas}h` : ''
        const hFds   = (parseFloat(d.h_fds_diurnas)||0) + (parseFloat(d.h_fds_noturnas)||0)
        const hFer   = (parseFloat(d.h_feriado_diurnas)||0) + (parseFloat(d.h_feriado_noturnas)||0)
        confirmMsg = [
          `✅ *RDO registrado com sucesso!*`,
          ``,
          `📋 *Nº:* ${d.numero_rdo || d.numero_documento || '—'}`,
          `📅 *Data:* ${d.data || '—'}`,
          `🏢 *Empresa:* ${d.empresa || '—'}`,
          `🔧 *Equipamento:* ${d.equipamento || '—'}`,
          `⏱️ *Jornada:* ${d.jornada_inicio || '—'} → ${d.jornada_fim || '—'} (${totalH}h)`,
          hDiur, hNot,
          hFds > 0 ? `\n📅 *H FDS:* ${hFds}h` : '',
          hFer > 0 ? `\n🎉 *H Feriado:* ${hFer}h` : '',
          locais,
          ``,
          `_Status: Pendente de aprovação_`,
        ].filter(l => l !== '').join('\n')
      } else {
        confirmMsg = [
          `✅ *Lançamento registrado!*`,
          ``,
          `📄 ${descricao}`,
          `💰 ${fmtVal}`,
          ``,
          `_Status: Pendente de aprovação_`,
        ].join('\n')
      }
    }

    await zapiSendText(fromPhone, confirmMsg)

    return res.status(200).json({ ok: true, descricao, valor: valorFinal })
  } catch (e) {
    console.error('[webhook-whatsapp] error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
