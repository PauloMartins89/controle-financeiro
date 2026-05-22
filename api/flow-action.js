/**
 * SmartPro Flow Action — Execução de ações por link de e-mail
 *
 * GET  /api/flow-action?token=xxx              → página HTML de confirmação
 * GET  /api/flow-action?token=xxx&acao=aprovar → executa ação diretamente
 * POST /api/flow-action  { token, acao, motivo }  → executa ação (formulário)
 *
 * Segurança:
 *  - Token aleatório de 64 chars hex (gen_random_bytes(32))
 *  - Validade configurável (padrão: 7 dias)
 *  - Uso único por padrão
 *  - Ação restrita ao que o token permite
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { handleExecute } from './flow-engine.js'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
    { realtime: { params: { log_level: 'disabled' }, transport: ws }, global: {} }
  )
}

// ─────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  const params = req.method === 'GET' ? req.query : (req.body || {})
  const token  = params?.token
  const motivo = params?.motivo || ''

  if (!token) {
    return res.status(400).send(htmlPage('Parâmetro inválido', '❌ Token não informado na URL.'))
  }

  const db = getDb()

  // Buscar token no banco
  const { data: tk, error: tkErr } = await db
    .from('flow_action_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (tkErr || !tk) {
    return res.status(404).send(htmlPage('Link inválido', '❌ Este link não existe ou foi removido.'))
  }

  // ── Verificar status ──────────────────────────────────────────────
  if (tk.status === 'usado') {
    return res.status(409).send(htmlPage(
      'Link já utilizado',
      '⚠️ Este link de aprovação já foi utilizado anteriormente. Cada link é de uso único.'
    ))
  }

  if (tk.status === 'cancelado') {
    return res.status(410).send(htmlPage('Link cancelado', '⚠️ Este link foi cancelado pelo sistema.'))
  }

  // Verificar expiração
  if (tk.status === 'expirado' || new Date(tk.expira_em) < new Date()) {
    if (tk.status !== 'expirado') {
      await db.from('flow_action_tokens').update({ status: 'expirado' }).eq('id', tk.id)
    }
    return res.status(410).send(htmlPage(
      'Link expirado',
      `⏰ Este link expirou em ${new Date(tk.expira_em).toLocaleDateString('pt-BR')}. Solicite um novo ao responsável.`
    ))
  }

  // ── GET sem ação → página de confirmação ─────────────────────────
  const acao = params?.acao
  if (req.method === 'GET' && !acao) {
    return res.status(200).send(htmlConfirmPage(tk, token))
  }

  // ── Validar ação solicitada ───────────────────────────────────────
  const acaoSolicitada = acao || tk.acao_permitida.split(',')[0].trim()
  const acoesPermitidas = tk.acao_permitida.split(',').map(a => a.trim())

  if (!acoesPermitidas.includes(acaoSolicitada)) {
    return res.status(403).send(htmlPage(
      'Ação não permitida',
      `❌ Este link não autoriza a ação "${acaoSolicitada}".<br>Ações permitidas: <strong>${tk.acao_permitida}</strong>`
    ))
  }

  // ── Executar no motor de fluxo ────────────────────────────────────
  let execResult
  try {
    execResult = await handleExecute(db, {
      instance_id:   tk.instance_id,
      acao_id:       tk.acao_id,
      executado_por: null,
      dados: {
        motivo:           motivo || null,
        _origem_token:    tk.id,
        _acao_email:      acaoSolicitada,
        _participante:    tk.participante_ref,
      },
      origem: 'email',
    })
  } catch (err) {
    console.error('[flow-action] erro ao executar:', err)
    return res.status(500).send(htmlPage('Erro interno', '⚠️ Ocorreu um erro ao processar sua ação. Tente novamente ou contate o suporte.'))
  }

  // ── Marcar token como usado ───────────────────────────────────────
  if (tk.uso_unico) {
    await db.from('flow_action_tokens')
      .update({
        status:       'usado',
        usado_em:     new Date().toISOString(),
        usado_origem: 'email_link',
      })
      .eq('id', tk.id)
  }

  // ── Registrar evento no histórico ────────────────────────────────
  await db.from('flow_history').insert({
    instance_id:   tk.instance_id,
    step_id:       tk.step_id,
    workspace_id:  tk.workspace_id,
    acao_nome:     `email_${acaoSolicitada}`,
    origem:        'email',
    dados: {
      token_id:         tk.id,
      participante_ref: tk.participante_ref,
      acao:             acaoSolicitada,
      motivo:           motivo || null,
      exec_status:      execResult?.status,
    },
  }).then(null, () => {}) // histórico não pode bloquear a resposta

  // ── Resposta ao usuário ───────────────────────────────────────────
  if (execResult?.status < 300) {
    const msgs = {
      aprovar:   '✅ Aprovação registrada com sucesso! O solicitante será notificado.',
      reprovar:  '❌ Reprovação registrada. O solicitante será notificado com o motivo.',
      confirmar: '✅ Confirmação de recebimento registrada com sucesso!',
      corrigir:  '🔄 Solicitação de correção registrada. O responsável será notificado.',
    }
    return res.status(200).send(htmlPage(
      'Ação Registrada!',
      msgs[acaoSolicitada] || `✅ Ação "<strong>${acaoSolicitada}</strong>" registrada com sucesso!`
    ))
  }

  return res.status(execResult?.status || 500).send(
    htmlPage('Erro ao processar', `⚠️ ${execResult?.body?.error || 'Erro interno. Contate o suporte.'}`)
  )
}

// ─────────────────────────────────────────────
// HTML Templates
// ─────────────────────────────────────────────

function htmlBase(titulo, conteudo) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titulo} — SmartPro</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      background: #07070f; color: #e2e8f0;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 20px;
    }
    .card {
      background: #0f0f1e; border: 1px solid #1a1a35;
      border-radius: 20px; padding: 44px 52px;
      text-align: center; max-width: 540px; width: 100%;
      box-shadow: 0 24px 80px rgba(0,0,0,0.6);
    }
    .logo {
      font-size: 12px; color: #334155; margin-bottom: 28px;
      letter-spacing: 2px; text-transform: uppercase;
    }
    .logo span { color: #6366f1; }
    h1 { font-size: 22px; font-weight: 900; margin-bottom: 12px; }
    p  { color: #475569; font-size: 15px; line-height: 1.7; margin-bottom: 20px; }
    .card-info {
      background: #0a0a18; border: 1px solid #1e1e3f; border-radius: 12px;
      padding: 14px 16px; margin-bottom: 24px; text-align: left;
    }
    .card-info-row { display: flex; gap: 8px; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
    .card-info-row:last-child { margin-bottom: 0; }
    .card-info-label { color: #475569; min-width: 90px; }
    .btn {
      display: inline-block; padding: 13px 28px;
      border: none; border-radius: 12px; cursor: pointer;
      font-size: 15px; font-weight: 700; color: #fff;
      text-decoration: none; margin: 4px; transition: opacity 0.15s;
      font-family: inherit;
    }
    .btn:hover { opacity: 0.85; }
    .btn-ok     { background: #10b981; }
    .btn-danger { background: #ef4444; }
    .btn-blue   { background: #6366f1; }
    .btn-gray   { background: #1e293b; border: 1px solid #334155; }
    textarea {
      width: 100%; margin-bottom: 12px; padding: 12px 14px;
      background: #1a1a30; border: 1px solid #2a2a4a;
      border-radius: 10px; color: #e2e8f0; font-size: 14px;
      resize: vertical; outline: none; font-family: inherit;
      min-height: 80px;
    }
    textarea:focus { border-color: #6366f1; }
    .divider { height: 1px; background: #1a1a35; margin: 24px 0; }
    .expiry { font-size: 12px; color: #1e293b; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Smart<span>Pro</span> · Flow Center</div>
    ${conteudo}
  </div>
</body>
</html>`
}

function htmlPage(titulo, mensagem) {
  return htmlBase(titulo, `<h1>${titulo}</h1><p>${mensagem}</p>`)
}

function htmlConfirmPage(tk, token) {
  const acoesArr  = tk.acao_permitida.split(',').map(a => a.trim())
  const extras    = tk.dados_extras || {}
  const precisaMotivo = acoesArr.includes('reprovar') || acoesArr.includes('corrigir')

  const btnMap = {
    aprovar:   { cls: 'btn-ok',     emoji: '✅', label: 'Aprovar'           },
    reprovar:  { cls: 'btn-danger', emoji: '❌', label: 'Reprovar'          },
    confirmar: { cls: 'btn-ok',     emoji: '✅', label: 'Confirmar Recebimento' },
    corrigir:  { cls: 'btn-gray',   emoji: '🔄', label: 'Solicitar Correção' },
  }

  const infoRows = [
    extras.processo  && `<div class="card-info-row"><span class="card-info-label">Processo:</span><span>${extras.processo}</span></div>`,
    extras.solicitante && `<div class="card-info-row"><span class="card-info-label">Solicitante:</span><span>${extras.solicitante}</span></div>`,
    extras.descricao && `<div class="card-info-row"><span class="card-info-label">Descrição:</span><span>${extras.descricao}</span></div>`,
    extras.valor     && `<div class="card-info-row"><span class="card-info-label">Valor:</span><span>${extras.valor}</span></div>`,
  ].filter(Boolean).join('')

  const forms = acoesArr.map(a => {
    const btn = btnMap[a] || { cls: 'btn-blue', emoji: '▶', label: a }
    const needsMotivo = (a === 'reprovar' || a === 'corrigir')
    return `
    <form method="POST" style="display:inline-block">
      <input type="hidden" name="token" value="${token}">
      <input type="hidden" name="acao"  value="${a}">
      ${needsMotivo ? '<input type="text" name="motivo" id="motivo_input" placeholder="Informe o motivo..." style="display:block;width:100%;margin-bottom:8px;padding:10px 14px;background:#1a1a30;border:1px solid #2a2a4a;border-radius:8px;color:#e2e8f0;font-size:13px;outline:none">' : ''}
      <button type="submit" class="btn ${btn.cls}">${btn.emoji} ${btn.label}</button>
    </form>`
  }).join('')

  const expiryDate = new Date(tk.expira_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return htmlBase('Ação de Aprovação', `
    <h1>🔐 Ação de Aprovação</h1>
    <p>Você recebeu este link para registrar sua resposta no SmartPro Flow. Clique na ação desejada.</p>
    ${infoRows ? `<div class="card-info">${infoRows}</div>` : ''}
    <div class="divider"></div>
    ${forms}
    <p class="expiry">
      Link ${tk.uso_unico ? 'de uso único' : 'reutilizável'} · Expira em ${expiryDate}
    </p>
  `)
}
