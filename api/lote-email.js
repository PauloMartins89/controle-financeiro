/**
 * POST /api/lote-email
 *
 * Envia email profissional de aprovação de lote via Resend,
 * com PDF e/ou CSV do lote em anexo.
 *
 * Body: {
 *   toEmail      : string   — destinatário (aprovador N1)
 *   toNome       : string   — nome do aprovador (para saudação)
 *   remetente    : string   — email do remetente (reply-to)
 *   link         : string   — link de aprovação pública do lote
 *   loteCliente  : string   — nome do cliente
 *   loteNome     : string   — nome/título do lote (opcional)
 *   pdfBase64    : string   — PDF gerado pelo frontend em base64 (sem prefixo data:)
 *   csvContent   : string   — conteúdo CSV em texto
 * }
 */

import { Resend } from 'resend'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    toEmail,
    toNome,
    remetente,
    link,
    loteCliente,
    loteNome,
    pdfBase64,
    csvContent,
  } = req.body || {}

  if (!toEmail || !link || !loteCliente) {
    return res.status(400).json({ error: 'Campos obrigatórios: toEmail, link, loteCliente' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY não configurada' })

  const resend = new Resend(apiKey)

  const saudacao = toNome ? `Olá, <strong>${toNome}</strong>!` : 'Olá!'
  const assinatura = remetente ? `<p style="margin:0;color:#6b7280;font-size:13px;">Atenciosamente,<br/>${remetente}</p>` : ''

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;">
      <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">SmartPro</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px;">Aprovação de Lote de Lançamentos</div>
    </div>
    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px;color:#1f2937;font-size:15px;">${saudacao}</p>
      <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">
        Segue para aprovação o lote de lançamentos do cliente <strong>${loteCliente}</strong>${loteNome ? ` — <em>${loteNome}</em>` : ''}.
        ${pdfBase64 ? 'O relatório completo está em anexo neste e-mail.' : ''}
      </p>
      <!-- CTA -->
      <div style="text-align:center;margin:28px 0;">
        <a href="${link}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
          ✅ Acessar e Aprovar Lote
        </a>
      </div>
      <p style="margin:0 0 8px;color:#6b7280;font-size:12px;text-align:center;">
        Ou acesse diretamente: <a href="${link}" style="color:#4f46e5;">${link}</a>
      </p>
    </div>
    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
      ${assinatura}
      <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">SmartPro Financeiro — ${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
  </div>
</body>
</html>`

  const attachments = []

  if (pdfBase64) {
    attachments.push({
      filename: `lote-${loteCliente.replace(/[^a-z0-9]/gi, '_')}.pdf`,
      content: pdfBase64,
    })
  }

  if (csvContent) {
    attachments.push({
      filename: `lote-${loteCliente.replace(/[^a-z0-9]/gi, '_')}.csv`,
      content: Buffer.from(csvContent, 'utf-8').toString('base64'),
    })
  }

  const fromAddress = 'SmartPro <noreply@smartpro.app.br>'

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [toEmail],
      ...(remetente ? { reply_to: remetente } : {}),
      subject: `Aprovação de Lote — ${loteCliente}`,
      html,
      attachments,
    })

    if (error) return res.status(400).json({ error: error.message || 'Erro ao enviar email' })

    return res.status(200).json({ ok: true, id: data?.id })
  } catch (err) {
    console.error('[lote-email]', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
