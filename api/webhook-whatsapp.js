import { createClient } from '@supabase/supabase-js'
import { runOCR } from './_ocr.js'

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Z-API — recebe mensagem do WhatsApp
// Fluxo: foto recebida → OCR → cria lançamento no Supabase → responde motorista
//
// Configurar no Z-API:
//   Webhook URL: https://dividiai.app.br/api/webhook-whatsapp
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

function getSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Envia mensagem de texto via Z-API
async function zapiSendText(phone, message) {
  if (!zapiInstanceId || !zapiToken) return
  try {
    await fetch(
      `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message }),
      }
    )
  } catch { /* silencioso */ }
}

}

// Busca workspace configurado para um número de telefone
async function getWorkspaceForPhone(supabase, phone) {
  const { data } = await supabase
    .from('whatsapp_config')
    .select('workspace_id, user_id')
    .eq('phone_number', phone)
    .eq('ativo', true)
    .limit(1)
    .single()
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

    // Ignora mensagens enviadas pelo próprio bot ou de grupos
    if (fromMe || body.isGroupMsg) return res.status(200).json({ ignored: true })

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

    // Roda OCR
    let ocr
    try {
      ocr = await runOCR(imageBase64)
    } catch (e) {
      if (fromPhone) await zapiSendText(fromPhone, '❌ Não consegui ler o formulário. Verifique se a foto está nítida e tente novamente.')
      return res.status(200).json({ error: 'ocr_failed', detail: e.message })
    }

    // Supabase
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

    // Monta payload
    const d = ocr
    const isTransporte = d.tipo_formulario === 'transporte'
    const valorFinal   = isTransporte ? (d.valor_total || 0) : (d.valor || 0)

    const descricao = isTransporte
      ? `Nº ${d.numero_diario || '—'} | ${d.empresa || ''} | ${d.local_origem || ''} → ${d.local_destino || ''}`.trim()
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
      dados_extras:    ocr,
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
      confirmMsg = [
        `✅ *Lançamento registrado!*`,
        ``,
        `📄 ${descricao}`,
        `💰 ${fmtVal}`,
        ``,
        `_Status: Pendente de aprovação_`,
      ].join('\n')
    }

    await zapiSendText(fromPhone, confirmMsg)

    return res.status(200).json({ ok: true, descricao, valor: valorFinal })
  } catch (e) {
    console.error('[webhook-whatsapp] error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
