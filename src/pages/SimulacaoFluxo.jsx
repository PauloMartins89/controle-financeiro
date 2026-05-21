import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import toast from 'react-hot-toast'

const agora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const gerarCodigo = () => {
  const year = new Date().getFullYear()
  const num = String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0')
  return `REF-${year}-${num}`
}
const interp = (tpl = '', vars = {}) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))

const PALETA = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#3b82f6']
const ICONS_PAPEL = ['👤', '✍️', '🍽️', '📋', '🔔', '🏢', '💰', '🛒', '🏭', '📍', '🚀', '🧑\u200d💼']

// ─── Labels amigáveis das chaves de mensagem ──────────────────────────
const MSG_LABELS = {
  boas:              'Boas-vindas ao P1 (início)',
  confirm_p1:        'P1 · Confirmação de envio',
  notif_p2:          'P2 · Notificação (aprovador)',
  aguarda_p1:        'P1 · Aguardando resposta do P2',
  aprovado_p2:       'P2 · Resposta de aprovação',
  aprovado_p1:       'P1 · Notificação de aprovação',
  reprovado_p1:      'P1 · Notificação de reprovação',
  sistema_consolida: 'Sistema · Consolidação automática',
  notif_p3:          'P3 · Notificação ao 3º participante',
  confirmado_p3:     'P3 · Confirmação do 3º participante',
  confirmado_p1:     'P1 · Aviso após P3 confirmar',
  notif_validacao:   'P1 Líder · Solicitação de validação de entrega',
  validado_ok:       'P1 Líder · Confirmação de entrega OK',
  concluido:         'Conclusão do fluxo (sistema)',
  notif_extra:       'P4/P5 · Notificação para participantes extras',
}
const VARS_HINT = '{nome_p1} {nome_p2} {nome_p3} {nome_lider} {papel_p1} {papel_p2} {papel_p3} {pedido} {cod} {link_p2} {link_p3} {link_lider} {motivo} {ocorrencia} {instance_id} {msg_p3}'

// ─── Templates de fluxo ───────────────────────────────────────────────
const TEMPLATES = {
  refeicoes: {
    label: 'Refeições 🍽️',
    inputPlaceholder: 'Ex: 2 almoços para 22/05, turno manhã...',
    participantes: [
      { papel: 'Líder',       icon: '👤', cor: '#6366f1', obrig: true,  email: '', canal: 'whatsapp' },
      { papel: 'Supervisor',  icon: '✍️', cor: '#f59e0b', obrig: true,  email: '', canal: 'whatsapp' },
      { papel: 'Restaurante', icon: '🍽️', cor: '#10b981', obrig: false, email: '', canal: 'whatsapp' },
    ],
    msgs: {
      boas:              'Olá, *{nome_p1}*! 👋\n\nSou o assistente de pedidos de refeição.\n\nDigite sua solicitação:\n(ex: 2 almoços para 22/05, turno manhã)',
      confirm_p1:        '✅ *Pedido registrado!*\n\n🎫 Protocolo: *{cod}*\n\nEnviado para aprovação de *{nome_p2}*...',
      notif_p2:          '📋 *Solicitação de Refeição*\n\nLíder: *{nome_p1}*\nPedido: *{pedido}*\nProtocolo: *{cod}*\n\n🔗 *{link_p2}*\n\nUse os botões abaixo:',
      aguarda_p1:        '📨 Aguardando resposta de *{nome_p2}*...\n\n🎫 Protocolo: *{cod}*',
      aprovado_p2:       '✅ *Aprovação registrada!*\n\nProtocolo: *{cod}*\nAprovado por: *{nome_p2}*',
      aprovado_p1:       '🎉 *Pedido Aprovado!*\n\nAprovado por *{nome_p2}*.\n🎫 Protocolo: *{cod}*',
      reprovado_p1:      '❌ *Pedido Reprovado*\n\nReprovado por *{nome_p2}*.\nMotivo: *{motivo}*\n🎫 Protocolo: *{cod}*\n\nEntre em contato com seu gestor.',
      sistema_consolida: '⚙️ *Sistema · Pedido consolidado*\n\nSeu pedido foi consolidado e encaminhado ao restaurante.\n🎫 Protocolo: *{cod}*',
      notif_p3:          '📦 *Novo Pedido — Ação Necessária*\n\nLíder: *{nome_p1}*\nPedido: *{pedido}*\nProtocolo: *{cod}*\nAprovado por: *{nome_p2}*\n\n🔗 Confirmar recebimento:\n*{link_p3}*',
      confirmado_p3:     '✅ *Recebimento confirmado!*\n\nProtocolo: *{cod}*\nStatus: em acompanhamento',
      confirmado_p1:     '🍽️ *Pedido em Acompanhamento*\n\nRestaurante confirmou o recebimento.\nSeu pedido está sendo preparado!',
      notif_validacao:   '🔍 *Valide a entrega recebida*\n\nA entrega foi registrada pelo sistema.\nProtocolo: *{cod}*\n\nA refeição chegou corretamente?\n\n🔗 *{link_lider}*',
      validado_ok:       '✅ *Entrega Validada!*\n\nEntrega confirmada por *{nome_p1}*.\n🎫 Protocolo: *{cod}*\n\nFluxo concluído com sucesso!',
      concluido:         '✅ *Fluxo Corporativo Concluído!*\n\n1. {papel_p1} → Solicitou ✓\n2. {papel_p2} → Aprovou ✓\n3. Sistema → Consolidou e enviou ✓\n4. {papel_p3} → Confirmou ✓\n5. {papel_p1} → Validou entrega ✓\n\nID: {instance_id}',
      notif_extra:       '🔔 *Informativo*\n\nPedido finalizado!\n{papel_p1}: {nome_p1}\nPedido: {pedido}\nProtocolo: *{cod}*',
    },
  },
  compras: {
    label: 'Compras 🛒',
    inputPlaceholder: 'Ex: 5 caixas de papel A4, urgente...',
    participantes: [
      { papel: 'Comprador',   icon: '🛒', cor: '#6366f1', obrig: true,  email: '', canal: 'whatsapp' },
      { papel: 'Aprovador',   icon: '✍️', cor: '#f59e0b', obrig: true,  email: '', canal: 'whatsapp' },
      { papel: 'Fornecedor',  icon: '🏭', cor: '#10b981', obrig: false, email: '', canal: 'whatsapp' },
    ],
    msgs: {
      boas:          'Olá, *{nome_p1}*! 👋\n\nSou o assistente de cotação de compras.\n\nDescreva o item que precisa comprar:',
      confirm_p1:    '✅ *Solicitação enviada!*\n\nCódigo: *{cod}*\n\nAguardando aprovação de *{nome_p2}*...',
      notif_p2:      '🛒 *Solicitação de Compra*\n\nComprador: *{nome_p1}*\nItem: *{pedido}*\nCódigo: *{cod}*\n\n🔗 *{link_p2}*\n\nAprove ou reprove:',
      aguarda_p1:    '📨 Solicitação enviada para *{nome_p2}*.\n\nAguardando aprovação...',
      aprovado_p2:   '✅ *Compra aprovada!*\n\nCódigo: *{cod}*\nPor: *{nome_p2}*',
      aprovado_p1:   '✅ *Compra Aprovada!*\n\nAprovado por *{nome_p2}*.\nCódigo: *{cod}*\n\n{msg_p3}',
      reprovado_p1:  '❌ *Compra Reprovada*\n\nReprovado por *{nome_p2}*.\nMotivo: *{motivo}*\nCódigo: *{cod}*',
      notif_p3:      '📋 *Cotação Solicitada*\n\nComprador: *{nome_p1}*\nItem: *{pedido}*\nCódigo: *{cod}*\n\n🔗 Confirmar disponibilidade:\n*{link_p3}*',
      confirmado_p3: '✅ *Pedido aceito!*\n\nCódigo: *{cod}*\nStatus: em processamento',
      confirmado_p1: '📦 *Fornecedor Confirmado!*\n\n{nome_p3} aceitou o pedido de compra.',
      concluido:     '✅ *Fluxo de Compras Concluído!*\n\n1. {papel_p1} → Solicitou ✓\n2. {papel_p2} → Aprovou ✓\n3. {papel_p3} → Confirmou ✓\n\nID: {instance_id}',
      notif_extra:   '🔔 *Informativo*\n\nCompra aprovada!\n{papel_p1}: {nome_p1}\nItem: {pedido}\nCódigo: *{cod}*',
    },
  },
  financeiro: {
    label: 'Financeiro 💰',
    inputPlaceholder: 'Ex: Pagamento fornecedor, R$ 5.000...',
    participantes: [
      { papel: 'Solicitante',   icon: '💳', cor: '#6366f1', obrig: true,  email: '', canal: 'whatsapp' },
      { papel: 'Gerente Fin.',  icon: '💰', cor: '#f59e0b', obrig: true,  email: '', canal: 'whatsapp' },
      { papel: 'Diretoria',     icon: '🏦', cor: '#10b981', obrig: false, email: '', canal: 'whatsapp' },
    ],
    msgs: {
      boas:          'Olá, *{nome_p1}*! 👋\n\nSou o assistente financeiro.\n\nDescreva a solicitação (tipo, valor, justificativa):',
      confirm_p1:    '✅ *Solicitação enviada!*\n\nCódigo: *{cod}*\n\nEnviando para análise de *{nome_p2}*...',
      notif_p2:      '💰 *Solicitação Financeira*\n\nSolicitante: *{nome_p1}*\nDescrição: *{pedido}*\nCódigo: *{cod}*\n\n🔗 *{link_p2}*',
      aguarda_p1:    '📨 Enviado para *{nome_p2}*.\n\nAguardando análise...',
      aprovado_p2:   '✅ *Aprovado!*\n\nCódigo: *{cod}*\nGerente: *{nome_p2}*',
      aprovado_p1:   '✅ *Aprovado pelo Gerente!*\n\nAprovado por *{nome_p2}*.\nCódigo: *{cod}*\n\n{msg_p3}',
      reprovado_p1:  '❌ *Solicitação Reprovada*\n\nReprovado por *{nome_p2}*.\nMotivo: *{motivo}*\nCódigo: *{cod}*',
      notif_p3:      '📊 *Aprovação da Diretoria*\n\nSolicitante: *{nome_p1}*\nDescrição: *{pedido}*\nCódigo: *{cod}*\n\n🔗 *{link_p3}*',
      confirmado_p3: '✅ *Aprovado pela Diretoria!*\n\nCódigo: *{cod}*\nStatus: liberado',
      confirmado_p1: '🏦 *Aprovação Final!*\n\n{nome_p3} deu a aprovação da Diretoria.',
      concluido:     '✅ *Fluxo Financeiro Concluído!*\n\n1. {papel_p1} → Solicitou ✓\n2. {papel_p2} → Aprovou ✓\n3. {papel_p3} → Confirmou ✓\n\nID: {instance_id}',
      notif_extra:   '🔔 *Informativo Financeiro*\n\nSolicitação aprovada!\nSolicitante: {nome_p1}\nCódigo: *{cod}*',
    },
  },
  campo: {
    label: 'Campo 📍',
    inputPlaceholder: 'Ex: Avaria no equipamento X, setor 3...',
    participantes: [
      { papel: 'Operador',       icon: '📍', cor: '#6366f1', obrig: true,  email: '', canal: 'whatsapp' },
      { papel: 'Coordenador',    icon: '📋', cor: '#f59e0b', obrig: true,  email: '', canal: 'whatsapp' },
      { papel: 'Base / Suporte', icon: '🏢', cor: '#10b981', obrig: false, email: '', canal: 'whatsapp' },
    ],
    msgs: {
      boas:          'Olá, *{nome_p1}*! 👋\n\nDescreva a ocorrência ou solicitação de campo:',
      confirm_p1:    '✅ *Registro enviado!*\n\nCódigo: *{cod}*\n\nNotificando *{nome_p2}*...',
      notif_p2:      '📍 *Registro de Campo*\n\nOperador: *{nome_p1}*\nOcorrência: *{pedido}*\nCódigo: *{cod}*\n\n🔗 *{link_p2}*',
      aguarda_p1:    '📨 Enviado para *{nome_p2}*.\n\nAguardando resposta...',
      aprovado_p2:   '✅ *Validado!*\n\nCódigo: *{cod}*\nCoordenador: *{nome_p2}*',
      aprovado_p1:   '✅ *Validado pelo Coordenador!*\n\nPor *{nome_p2}*.\nCódigo: *{cod}*\n\n{msg_p3}',
      reprovado_p1:  '❌ *Registro Negado*\n\nNegado por *{nome_p2}*.\nMotivo: *{motivo}*\nCódigo: *{cod}*',
      notif_p3:      '🏢 *Registro de Campo*\n\nOperador: *{nome_p1}*\nOcorrência: *{pedido}*\nCódigo: *{cod}*\n\n🔗 Confirmar recebimento:\n*{link_p3}*',
      confirmado_p3: '✅ *Recebido na Base!*\n\nCódigo: *{cod}*',
      confirmado_p1: '🏢 *Base Confirmada!*\n\n{nome_p3} recebeu o registro.',
      concluido:     '✅ *Ocorrência Processada!*\n\n1. {papel_p1} → Registrou ✓\n2. {papel_p2} → Validou ✓\n3. {papel_p3} → Confirmou ✓\n\nID: {instance_id}',
      notif_extra:   '🔔 *Informativo de Campo*\n\nOcorrência processada!\nOperador: {nome_p1}\nCódigo: *{cod}*',
    },
  },
}

// ─────────────────────────────────────────────
// Componente: tela de celular WhatsApp
// ─────────────────────────────────────────────
function PhoneMock({ papel, nome, cor, messages, inputAtivo, inputPlaceholder, onEnviar, acoes, badge, ativo }) {
  const [texto, setTexto] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const enviar = () => {
    if (!texto.trim()) return
    onEnviar?.(texto.trim())
    setTexto('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 260, maxWidth: 295, flex: '0 0 auto' }}>
      {/* Label acima do celular */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 28 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: cor, boxShadow: ativo ? `0 0 10px ${cor}` : 'none', transition: 'box-shadow 0.4s' }} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 12 }}>{papel}</span>
        {nome && <span style={{ color: '#475569', fontSize: 11 }}>· {nome}</span>}
        {badge && (
          <span style={{ background: `${cor}22`, color: cor, border: `1px solid ${cor}50`, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, animation: 'pulse 1.5s infinite' }}>
            {badge}
          </span>
        )}
      </div>

      {/* Corpo do celular */}
      <div style={{
        width: '100%',
        background: '#0d0d1e',
        borderRadius: 30,
        border: `5px solid ${ativo ? cor + '40' : '#0a0a16'}`,
        boxShadow: ativo
          ? `0 0 0 1px ${cor}30, 0 25px 70px rgba(0,0,0,0.7)`
          : '0 25px 70px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        transition: 'border-color 0.4s, box-shadow 0.4s',
      }}>
        {/* Notch */}
        <div style={{ height: 12, background: '#0a0a16', display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
          <div style={{ width: 65, height: 5, background: '#0d0d1e', borderRadius: 10 }} />
        </div>

        {/* Header WhatsApp */}
        <div style={{ background: '#128C7E', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', background: cor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, color: '#fff', fontSize: 15, flexShrink: 0,
          }}>
            {(nome || papel)[0]}
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>Flow Bot</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10 }}>simulação ativa</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            {(nome || '').substring(0, 12)}
          </div>
        </div>

        {/* Chat */}
        <div style={{
          background: '#0B141A',
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'10\' cy=\'10\' r=\'1\' fill=\'rgba(255,255,255,0.01)\'/%3E%3C/svg%3E")',
          height: 320,
          overflowY: 'auto',
          padding: '10px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {messages.length === 0 && (
            <div style={{ color: '#1a3050', fontSize: 11, textAlign: 'center', margin: 'auto' }}>
              Sem mensagens
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.saida ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 4 }}>
              {!msg.saida && !msg.sistema && (
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: cor + '40', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: cor, fontWeight: 700, marginBottom: 2 }}>
                  B
                </div>
              )}
              <div style={{
                background: msg.saida ? '#005C4B' : (msg.sistema ? '#0f1e35' : '#1F2C34'),
                color: msg.sistema ? '#4b6080' : '#e2e8f0',
                borderRadius: msg.saida ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                padding: '8px 11px',
                maxWidth: '82%',
                fontSize: 12,
                border: msg.sistema ? '1px solid #1e3a5f' : 'none',
              }}>
                <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>{msg.texto}</pre>
                <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 9.5, textAlign: 'right', marginTop: 3 }}>
                  {msg.hora}{msg.saida ? ' ✓✓' : ''}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Ações + Input */}
        <div style={{ background: '#1F2C34', padding: '8px 8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {acoes?.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {acoes.map((a, i) => (
                <button key={i} onClick={a.onClick} disabled={a.disabled}
                  style={{
                    flex: 1, minWidth: 80, padding: '10px 6px',
                    background: a.disabled ? '#1a2030' : (a.cor || '#6366f1'),
                    border: 'none', color: '#fff', borderRadius: 10,
                    fontSize: 12, fontWeight: 700,
                    cursor: a.disabled ? 'not-allowed' : 'pointer',
                    opacity: a.disabled ? 0.45 : 1,
                    transition: 'opacity 0.2s',
                  }}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
          {inputAtivo ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
                placeholder={inputPlaceholder || 'Mensagem...'}
                style={{ flex: 1, background: '#2A3942', border: 'none', borderRadius: 20, padding: '9px 14px', color: 'var(--text-primary)', fontSize: 12.5, outline: 'none' }}
                autoFocus
              />
              <button onClick={enviar}
                style={{ width: 36, height: 36, borderRadius: '50%', background: texto.trim() ? '#00A884' : '#2A3942', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15, flexShrink: 0, transition: 'background 0.2s' }}>
                ➤
              </button>
            </div>
          ) : (
            !acoes?.length && (
              <div style={{ color: '#263548', fontSize: 10, textAlign: 'center', padding: '2px 0' }}>
                aguardando...
              </div>
            )
          )}
        </div>

        {/* Home bar */}
        <div style={{ height: 10, background: '#0a0a16', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: 50, height: 3, background: '#1a1a30', borderRadius: 10 }} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Componente: caixa de e-mail simulada
// ─────────────────────────────────────────────
function EmailInboxMock({ papel, nome, cor, emails, inputAtivo, inputPlaceholder, onEnviar, acoes, badge, ativo }) {
  const [texto, setTexto] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [emails])

  const enviar = () => {
    if (!texto.trim()) return
    onEnviar?.(texto.trim())
    setTexto('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 270, maxWidth: 320, flex: '0 0 auto' }}>
      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 28 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: cor, boxShadow: ativo ? `0 0 10px ${cor}` : 'none', transition: 'box-shadow 0.4s' }} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 12 }}>{papel}</span>
        <span style={{ color: cor, fontSize: 10, background: cor + '18', border: `1px solid ${cor}30`, padding: '1px 7px', borderRadius: 20, fontWeight: 700 }}>📧 E-mail</span>
        {nome && <span style={{ color: '#475569', fontSize: 11 }}>· {nome}</span>}
        {badge && (
          <span style={{ background: `${cor}22`, color: cor, border: `1px solid ${cor}50`, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, animation: 'pulse 1.5s infinite' }}>
            {badge}
          </span>
        )}
      </div>

      {/* Envelope */}
      <div style={{
        width: '100%', background: '#0d0d1e',
        borderRadius: 16,
        border: `2px solid ${ativo ? cor + '60' : cor + '20'}`,
        boxShadow: ativo ? `0 0 0 1px ${cor}30, 0 20px 60px rgba(0,0,0,0.6)` : '0 20px 60px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        transition: 'border-color 0.4s, box-shadow 0.4s',
      }}>
        {/* Header */}
        <div style={{ background: '#111124', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${cor}20` }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>📧</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 12, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome || papel}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>Caixa de Entrada · SmartPro Flow</div>
          </div>
          <div style={{ fontSize: 18, color: cor, opacity: 0.6 }}>✉️</div>
        </div>

        {/* E-mails */}
        <div style={{ height: 320, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-secondary)' }}>
          {emails.length === 0 && (
            <div style={{ color: '#1a2540', fontSize: 11, textAlign: 'center', margin: 'auto' }}>Sem e-mails</div>
          )}
          {emails.map((em, i) => (
            <div key={i} style={{
              background: em.saida ? '#0f1e35' : '#10102a',
              border: `1px solid ${em.saida ? '#1e3a5f' : cor + '30'}`,
              borderRadius: 10, padding: '10px 12px',
              animation: 'fadeIn 0.3s ease',
            }}>
              {em.assunto && (
                <div style={{ fontSize: 11, fontWeight: 800, color: cor, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>{em.saida ? '📤' : '📨'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{em.assunto}</span>
                </div>
              )}
              <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#c8d4e0', lineHeight: 1.55 }}>
                {em.corpo}
              </pre>
              {em.linkAcao?.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {em.linkAcao.map((la, j) => (
                    <button key={j} onClick={la.onClick}
                      style={{ padding: '6px 14px', background: la.cor || cor, border: 'none', borderRadius: 8, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                      {la.label}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ color: '#1e3050', fontSize: 9.5, marginTop: 5, textAlign: 'right' }}>{em.hora}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {inputAtivo && (
          <div style={{ background: '#111124', padding: '8px', borderTop: `1px solid ${cor}20`, display: 'flex', gap: 6 }}>
            <input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviar()}
              placeholder={inputPlaceholder || 'Escrever e-mail...'}
              style={{ flex: 1, background: 'var(--bg-secondary)', border: `1px solid ${cor}30`, borderRadius: 8, padding: '9px 12px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
              autoFocus
            />
            <button onClick={enviar}
              style={{ width: 36, height: 36, borderRadius: 8, background: texto.trim() ? cor : '#1e1e3f', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, flexShrink: 0, transition: 'background 0.2s' }}>
              ✉️
            </button>
          </div>
        )}

        {/* Acões */}
        {acoes?.length > 0 && (
          <div style={{ background: '#111124', padding: '8px', borderTop: `1px solid ${cor}20`, display: 'flex', gap: 6 }}>
            {acoes.map((a, i) => (
              <button key={i} onClick={a.onClick} disabled={a.disabled}
                style={{ flex: 1, padding: '10px 6px', background: a.disabled ? '#1a2030' : (a.cor || cor), border: 'none', borderRadius: 9, color: '#fff', fontSize: 12, fontWeight: 700, cursor: a.disabled ? 'not-allowed' : 'pointer', opacity: a.disabled ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        {!inputAtivo && !acoes?.length && (
          <div style={{ height: 24, background: '#090910', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#1a2540', fontSize: 9 }}>Caixa de Entrada</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────
export default function SimulacaoFluxo() {
  const { workspaceId } = useStore()

  // ── Configuração do fluxo
  const [tipoFluxo, setTipoFluxo] = useState('refeicoes')
  const [participantes, setParticipantes] = useState(() =>
    TEMPLATES.refeicoes.participantes.map((p, i) => ({ ...p, id: i + 1, nome: '', cel: '' }))
  )
  const [msgs, setMsgs] = useState(() => ({ ...TEMPLATES.refeicoes.msgs }))
  const [mostrarMsgs, setMostrarMsgs] = useState(false)

  // ── Estado da simulação
  const [fase, setFase] = useState('setup')
  const [codigo] = useState(gerarCodigo)
  const [pedido, setPedido] = useState('')
  const [instanceId, setInstanceId] = useState(null)
  const [definicoes, setDefinicoes] = useState([])
  const [defSelecionada, setDefSelecionada] = useState('')
  const [executando, setExecutando] = useState(false)
  const [motivoReprova, setMotivoReprova] = useState('')
  const [ocorrenciaInput, setOcorrenciaInput] = useState('')

  // Mensagens por phone (até 5)
  const [msgsPhone, setMsgsPhone] = useState([[], [], [], [], []])
  // Mensagens por caixa de e-mail (até 5)
  const [msgsEmail, setMsgsEmail] = useState([[], [], [], [], []])

  const addMsg = (idx, texto, saida = false, sistema = false) =>
    setMsgsPhone(prev => {
      const n = prev.map(a => [...a])
      n[idx] = [...n[idx], { texto, saida, sistema, hora: agora() }]
      return n
    })

  const addEmailMsg = (idx, assunto, corpo, saida = false, linkAcao = null) =>
    setMsgsEmail(prev => {
      const n = prev.map(a => [...a])
      n[idx] = [...n[idx], { assunto, corpo, saida, linkAcao, hora: agora() }]
      return n
    })

  // Carregar definições de fluxo
  useEffect(() => {
    if (!workspaceId) return
    supabase
      .from('flow_definitions')
      .select('id, nome, modulo')
      .eq('workspace_id', workspaceId)
      .eq('ativo', true)
      .then(({ data }) => {
        setDefinicoes(data || [])
        const def = data?.find(d => d.modulo === 'refeicoes')
        if (def) setDefSelecionada(def.id)
      })
  }, [workspaceId])

  // ── Mudar tipo de fluxo
  const mudarTipo = (tipo) => {
    setTipoFluxo(tipo)
    setParticipantes(TEMPLATES[tipo].participantes.map((p, i) => ({ ...p, id: i + 1, nome: '', cel: '' })))
    setMsgs({ ...TEMPLATES[tipo].msgs })
  }

  // ── Adicionar participante (até 5)
  const adicionarParticipante = () => {
    if (participantes.length >= 5) return
    const idx = participantes.length
    setParticipantes(p => [...p, {
      id: idx + 1,
      papel: `Participante ${idx + 1}`,
      icon: ICONS_PAPEL[idx % ICONS_PAPEL.length],
      cor: PALETA[idx % PALETA.length],
      obrig: false,
      nome: '',
      cel: '',
      email: '',
      canal: 'whatsapp',
    }])
  }

  const removerParticipante = (id) => {
    if (participantes.length <= 3) return
    setParticipantes(p => p.filter(x => x.id !== id))
  }

  const atualizarParticipante = (id, campo, valor) =>
    setParticipantes(p => p.map(x => x.id === id ? { ...x, [campo]: valor } : x))

  // ── Variáveis para interpolação
  const buildVars = (pedidoAtual, instanceIdAtual) => {
    const p = participantes
    return {
      nome_p1: p[0]?.nome || 'P1',
      nome_p2: p[1]?.nome || 'P2',
      nome_p3: p[2]?.nome || 'P3',
      nome_lider: p[3]?.nome || 'Líder',
      papel_p1: p[0]?.papel || 'Participante 1',
      papel_p2: p[1]?.papel || 'Participante 2',
      papel_p3: p[2]?.papel || 'Participante 3',
      pedido: pedidoAtual || pedido,
      cod: codigo,
      link_p2: `https://smartpro.app.br/aprovar?sim=${codigo}`,
      link_p3: `https://smartpro.app.br/confirmar?sim=${codigo}`,
      link_lider: `https://smartpro.app.br/validar?sim=${codigo}`,
      instance_id: (instanceIdAtual || instanceId)?.substring(0, 8) || codigo,
      motivo: motivoReprova || 'Não informado',
      msg_p3: p[2]?.nome
        ? `${p[2]?.papel} *${p[2]?.nome}* foi notificado.`
        : 'Aguarde o próximo passo.',
    }
  }

  // ── Enviar WA real
  const enviarWA = async (to, message) => {
    if (!to) return
    try {
      await fetch('/api/flow-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wa_send', to, message }),
      })
    } catch { /* silencioso */ }
  }

  // ── INICIAR
  const iniciar = () => {
    const precisaCel = (p) => !p?.canal || p.canal === 'whatsapp' || p.canal === 'ambos'
    if (!participantes[0]?.nome?.trim()) {
      toast.error(`Preencha o nome do ${participantes[0]?.papel || 'Participante 1'}`); return
    }
    if (precisaCel(participantes[0]) && !participantes[0]?.cel?.trim()) {
      toast.error(`Preencha o celular do ${participantes[0]?.papel || 'Participante 1'}`); return
    }
    if (!participantes[1]?.nome?.trim()) {
      toast.error(`Preencha o nome do ${participantes[1]?.papel || 'Participante 2'}`); return
    }
    if (precisaCel(participantes[1]) && !participantes[1]?.cel?.trim()) {
      toast.error(`Preencha o celular do ${participantes[1]?.papel || 'Participante 2'}`); return
    }
    setFase('p1_input')
    const v = buildVars('', null)
    setTimeout(() => {
      addMsg(0, interp(msgs.boas, v))
      if ((participantes[0]?.canal === 'email' || participantes[0]?.canal === 'ambos') && participantes[0]?.email) {
        addEmailMsg(0, `Boas-vindas — ${TEMPLATES[tipoFluxo].label}`, interp(msgs.boas, v))
      }
    }, 400)
  }

  // ── P1 ENVIA
  const p1Envia = async (texto) => {
    setPedido(texto)
    addMsg(0, texto, true)
    setFase('enviando')
    const v = buildVars(texto, null)

    setTimeout(() => addMsg(0, interp(msgs.confirm_p1, v)), 600)

    try {
      const resp = await fetch('/api/flow-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sim_start',
          definition_id: defSelecionada || undefined,
          workspace_id: workspaceId,
          dados_simulacao: {
            nome_solicitante: participantes[0]?.nome, celular_solicitante: participantes[0]?.cel,
            nome_supervisor:  participantes[1]?.nome, celular_supervisor:  participantes[1]?.cel,
            nome_restaurante: participantes[2]?.nome, celular_restaurante: participantes[2]?.cel,
            pedido: texto, codigo,
          },
        }),
      })
      const data = await resp.json()
      if (resp.ok) {
        setInstanceId(data.instance_id)
        toast.success('Registro criado · WA enviado')
      }
    } catch { toast.error('Erro ao criar registro') }

    setTimeout(() => {
      addMsg(1, interp(msgs.notif_p2, v))
      if ((participantes[1]?.canal === 'email' || participantes[1]?.canal === 'ambos') && participantes[1]?.email) {
        addEmailMsg(1, `[Aprovação Necessária] ${texto}`,
          interp(msgs.notif_p2, v), false,
          [
            { label: '✅ Aprovar',   cor: '#10b981', onClick: p2Aprova },
            { label: '❌ Reprovar', cor: '#ef4444', onClick: p2Reprova },
          ]
        )
      }
      setFase('p2_decide')
    }, 2200)

    setTimeout(() => addMsg(0, interp(msgs.aguarda_p1, v)), 2700)
  }

  // ── P2 APROVA
  const p2Aprova = async () => {
    if (executando) return
    setExecutando(true)
    const v = buildVars(pedido, instanceId)

    addMsg(1, '✅ Aprovado!', true)

    if (participantes[2]?.cel && (participantes[2]?.canal !== 'email')) {
      enviarWA(
        participantes[2].cel,
        `🧪 [SIMULAÇÃO]\n📦 Pedido aprovado!\n\nSolicitante: ${participantes[0]?.nome}\nPedido: ${pedido}\nCódigo: ${codigo}\nAprovado por: ${participantes[1]?.nome}`,
      )
    }

    setTimeout(() => {
      addMsg(1, interp(msgs.aprovado_p2, v))
      addMsg(0, interp(msgs.aprovado_p1, v))
      if ((participantes[0]?.canal === 'email' || participantes[0]?.canal === 'ambos') && participantes[0]?.email) {
        addEmailMsg(0, `✅ Aprovado! Código: ${codigo}`, interp(msgs.aprovado_p1, v))
      }

      if (participantes[2]?.nome) {
        const vFull = { ...v, instance_id: instanceId?.substring(0, 8) || codigo }
        // Sistema: consolidar + encaminhar ao restaurante
        if (msgs.sistema_consolida) setTimeout(() => addMsg(0, interp(msgs.sistema_consolida, vFull), false, true), 300)
        setTimeout(() => {
          addMsg(2, interp(msgs.notif_p3, vFull))
          if ((participantes[2]?.canal === 'email' || participantes[2]?.canal === 'ambos') && participantes[2]?.email) {
            addEmailMsg(2, `[Confirmação Necessária] ${pedido || 'Pedido aprovado'}`,
              interp(msgs.notif_p3, vFull), false,
              [{ label: '✅ Confirmar Recebimento', cor: '#10b981', onClick: p3Confirma }]
            )
          }
          setFase('p3_confirma')
        }, 800)
      } else {
        const vFull = { ...v, instance_id: instanceId?.substring(0, 8) || codigo }
        if (tipoFluxo === 'refeicoes') {
          // Sem restaurante → sistema consolida e encaminha direto para validação do líder
          if (msgs.sistema_consolida) setTimeout(() => addMsg(0, interp(msgs.sistema_consolida, vFull), false, true), 300)
          setTimeout(() => {
            addMsg(0, interp(msgs.notif_validacao || '🔍 Valide a entrega recebida.\n\nProtocolo: *{cod}*\n\n🔗 *{link_lider}*', vFull))
            setFase('p1_valida')
          }, 800)
        } else {
          setFase('concluido')
          setTimeout(() => {
            addMsg(0, interp(msgs.concluido, vFull), false, true)
            notificarExtras(vFull)
          }, 400)
        }
      }
    }, 900)

    setExecutando(false)
  }

  // ── P2 REPROVA
  const p2Reprova = async () => {
    if (executando) return
    setExecutando(true)
    const motivo = motivoReprova.trim() || 'Não informado'
    const v = { ...buildVars(pedido, instanceId), motivo }

    addMsg(1, `❌ Reprovado\nMotivo: ${motivo}`, true)
    setTimeout(() => {
      addMsg(1, `❌ *Reprovação registrada.*\n\nMotivo: *${motivo}*\nCódigo: *${codigo}*`)
      addMsg(0, interp(msgs.reprovado_p1, v))
      if ((participantes[0]?.canal === 'email' || participantes[0]?.canal === 'ambos') && participantes[0]?.email) {
        addEmailMsg(0, `❌ Reprovado — Código: ${codigo}`, interp(msgs.reprovado_p1, v))
      }
      setFase('concluido')
    }, 900)

    setExecutando(false)
  }

  // ── P3 CONFIRMA
  const p3Confirma = () => {
    const v = buildVars(pedido, instanceId)
    addMsg(2, 'Pedido confirmado! ✅', true)
    setTimeout(() => {
      addMsg(2, interp(msgs.confirmado_p3, v))
      addMsg(0, interp(msgs.confirmado_p1, v))
      if ((participantes[0]?.canal === 'email' || participantes[0]?.canal === 'ambos') && participantes[0]?.email) {
        addEmailMsg(0, `✅ Confirmado por ${participantes[2]?.nome || 'P3'}`, interp(msgs.confirmado_p1, v))
      }
      // Fluxo de refeições corporativo → validação pelo próprio Líder (P1)
      if (tipoFluxo === 'refeicoes') {
        const vL = { ...v, instance_id: instanceId?.substring(0, 8) || codigo }
        setTimeout(() => {
          addMsg(0, interp(msgs.notif_validacao || '🔍 Valide a entrega recebida.\n\nProtocolo: *{cod}*\n\n🔗 *{link_lider}*', vL))
          setFase('p1_valida')
        }, 700)
      } else {
        setFase('concluido')
        const vEnd = { ...v, instance_id: instanceId?.substring(0, 8) || codigo }
        setTimeout(() => {
          addMsg(0, interp(msgs.concluido, vEnd), false, true)
          notificarExtras(vEnd)
        }, 500)
      }
    }, 900)
  }

  // ── LÍDER VALIDA entrega (P1 = Líder, phone 0)
  const liderValida = () => {
    const v = buildVars(pedido, instanceId)
    addMsg(0, '✅ Entrega confirmada!', true)
    setTimeout(() => {
      addMsg(0, interp(msgs.validado_ok || '✅ *Entrega Validada!*\n\nProtocolo: *{cod}*', v))
      setFase('concluido')
      const vEnd = { ...v, instance_id: instanceId?.substring(0, 8) || codigo }
      setTimeout(() => {
        addMsg(0, interp(msgs.concluido, vEnd), false, true)
        notificarExtras(vEnd)
      }, 500)
    }, 700)
  }

  // ── LÍDER REPORTA ocorrência (P1 = Líder, phone 0)
  const liderReportaOcorrencia = () => {
    const ocorr = ocorrenciaInput.trim() || 'Ocorrência não especificada'
    const v = { ...buildVars(pedido, instanceId), ocorrencia: ocorr }
    addMsg(0, `⚠️ Ocorrência: ${ocorr}`, true)
    setTimeout(() => {
      addMsg(0, `⚠️ *Ocorrência Registrada*\n\nProtocolo: *${codigo}*\nDescrição: *${ocorr}*`)
      setFase('concluido')
      const vEnd = { ...v, instance_id: instanceId?.substring(0, 8) || codigo }
      setTimeout(() => {
        addMsg(0, `⚠️ *Fluxo Encerrado com Ocorrência*\n\nDescrição: "${ocorr}"\nID: ${vEnd.instance_id}`, false, true)
        notificarExtras(vEnd)
      }, 500)
    }, 700)
  }

  // ── Notificar P4/P5 ao concluir
  const notificarExtras = (v) => {
    // Extras começam em P4 (índice 3) para todos os templates
    const sliceFrom = 3
    participantes.slice(sliceFrom).forEach((p, i) => {
      if (!p.nome) return
      const msgTxt = interp(msgs.notif_extra, { ...v, papel_extra: p.papel, nome_extra: p.nome })
      setTimeout(() => {
        addMsg(sliceFrom + i, msgTxt)
        if ((p.canal === 'email' || p.canal === 'ambos') && p.email) {
          addEmailMsg(sliceFrom + i, `Informativo — ${codigo}`, msgTxt)
        }
        if (p.cel && p.canal !== 'email') enviarWA(p.cel, `🧪 [SIMULAÇÃO]\n${msgTxt}`)
      }, 300 * (i + 1))
    })
  }

  const resetar = () => {
    setFase('setup')
    setMsgsPhone([[], [], [], [], []])
    setMsgsEmail([[], [], [], [], []])
    setInstanceId(null); setPedido(''); setMotivoReprova(''); setOcorrenciaInput('')
  }

  // ── Ações dos phones
  const acoes2 = fase === 'p2_decide'
    ? [
        { label: '✅ Aprovar', cor: '#10b981', onClick: p2Aprova, disabled: executando },
        { label: '❌ Reprovar', cor: '#ef4444', onClick: p2Reprova, disabled: executando },
      ]
    : []
  const acoes3 = fase === 'p3_confirma'
    ? [{ label: '✅ Confirmar Recebimento', cor: '#10b981', onClick: p3Confirma }]
    : []
  const acoesValida = fase === 'p1_valida'
    ? [
        { label: '✅ Entrega OK', cor: '#10b981', onClick: liderValida },
        { label: '⚠️ Ocorrência', cor: '#f59e0b', onClick: liderReportaOcorrencia },
      ]
    : []

  // ── Progress steps (dinâmico)
  const steps = [
    { key: 'p1_input',   label: `1. ${participantes[0]?.papel || 'P1'}` },
    { key: 'p2_decide',  label: `2. ${participantes[1]?.papel || 'P2'}` },
    ...(participantes[2]?.nome ? [{ key: 'p3_confirma', label: `3. ${participantes[2]?.papel || 'P3'}` }] : []),
    ...(tipoFluxo === 'refeicoes' ? [{ key: 'p1_valida', label: `4. ${participantes[0]?.papel || 'Líder'} valida` }] : []),
    { key: 'concluido',  label: '✅ Concluído' },
  ]
  const faseOrder = ['p1_input', 'enviando', 'p2_decide', 'p3_confirma', 'p1_valida', 'concluido']
  const faseIdx = faseOrder.indexOf(fase)

  const p = participantes

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .pf { animation: fadeIn 0.4s ease; }
        .icon-btn:hover { opacity: 0.7 !important; }
      `}</style>

      <div style={{ padding: '24px 20px' }}>

        {/* ── Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 900, letterSpacing: -0.5, background: 'linear-gradient(90deg, #6366f1 0%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              📱 Simulação Interativa de Fluxo
            </h1>
            <p style={{ margin: '3px 0 0', color: 'var(--text-secondary)', fontSize: 12 }}>
              {participantes.length} participante{participantes.length > 1 ? 's' : ''} · WhatsApp real · Fluxo de ponta a ponta
            </p>
          </div>
          {fase !== 'setup' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>Código</div>
                <div style={{ color: '#6366f1', fontWeight: 900, fontFamily: 'monospace', fontSize: 16 }}>{codigo}</div>
                {instanceId && <div style={{ color: '#1e3a5f', fontSize: 10, fontFamily: 'monospace' }}>ID: {instanceId.substring(0, 8)}</div>}
              </div>
              <button onClick={resetar}
                style={{ padding: '9px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                🔄 Reiniciar
              </button>
            </div>
          )}
        </div>

        {/* ── SETUP */}
        {fase === 'setup' && (
          <div className="pf">

            {/* ── Grid: Tipo de Fluxo + Iniciar | Participantes ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>

            {/* Coluna esquerda */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Tipo de fluxo */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: 12, color: '#475569', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Tipo de Fluxo</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(TEMPLATES).map(([key, tpl]) => (
                  <button key={key} onClick={() => mudarTipo(key)}
                    style={{ padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: tipoFluxo === key ? '#6366f1' : 'transparent', border: `1px solid ${tipoFluxo === key ? '#6366f1' : '#1e1e3f'}`, color: tipoFluxo === key ? '#fff' : '#475569', transition: 'all 0.15s' }}>
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Processo real + Iniciar */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
              {definicoes.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>Processo real:</label>
                  <select value={defSelecionada} onChange={e => setDefSelecionada(e.target.value)}
                    style={{ ...inputSt, width: 'auto', minWidth: 240 }}>
                    <option value=''>Apenas simulação visual</option>
                    {definicoes.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button onClick={iniciar}
                  style={{ padding: '13px 30px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 30px rgba(99,102,241,0.3)' }}>
                  🚀 Iniciar Simulação
                </button>
                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>P1 e P2 obrigatórios · P3–P5 opcionais</span>
              </div>
            </div>
            </div>{/* /col-esquerda */}

            {/* Participantes - coluna direita */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 800 }}>⚙️ Participantes</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>WhatsApp real enviado para cada celular em cada etapa</div>
                </div>
                {participantes.length < 5 && (
                  <button onClick={adicionarParticipante}
                    style={{ padding: '8px 14px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#6366f1', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    + Participante
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {participantes.map((part, idx) => (
                  <div key={part.id} style={{ background: 'var(--bg-card)', border: `1px solid ${part.cor}25`, borderRadius: 12, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${part.cor}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 15 }}>{part.icon}</span>
                        {idx >= 3 ? (
                          <input
                            value={part.papel}
                            onChange={e => atualizarParticipante(part.id, 'papel', e.target.value)}
                            style={{ ...inputSt, padding: '3px 8px', fontSize: 12, color: part.cor, fontWeight: 800, background: 'transparent', border: 'none', outline: 'none', width: 120 }}
                          />
                        ) : (
                          <span style={{ color: part.cor, fontWeight: 800, fontSize: 12 }}>{part.papel}</span>
                        )}
                        {!part.obrig && idx < 3 && <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>(opcional)</span>}
                      </div>
                      {idx >= 3 && (
                        <button onClick={() => removerParticipante(part.id)} className="icon-btn"
                          style={{ background: 'none', border: 'none', color: '#ef444460', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                      )}
                    </div>

                    {idx >= 3 && (
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                        {ICONS_PAPEL.map(ic => (
                          <button key={ic} onClick={() => atualizarParticipante(part.id, 'icon', ic)}
                            style={{ background: part.icon === ic ? part.cor + '30' : 'transparent', border: `1px solid ${part.icon === ic ? part.cor : 'transparent'}`, borderRadius: 6, padding: '2px 4px', cursor: 'pointer', fontSize: 13 }}>
                            {ic}
                          </button>
                        ))}
                      </div>
                    )}

                    {idx >= 3 && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        {PALETA.map(c => (
                          <button key={c} onClick={() => atualizarParticipante(part.id, 'cor', c)}
                            style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: `2px solid ${part.cor === c ? '#fff' : 'transparent'}`, cursor: 'pointer', padding: 0 }} />
                        ))}
                      </div>
                    )}

                    <input
                      placeholder={`Nome do(a) ${part.papel.split(' ')[0].toLowerCase()}`}
                      value={part.nome}
                      onChange={e => atualizarParticipante(part.id, 'nome', e.target.value)}
                      style={inputSt}
                    />
                    <input
                      placeholder="Celular com DDI: 5511999..."
                      value={part.cel}
                      onChange={e => atualizarParticipante(part.id, 'cel', e.target.value)}
                      style={{ ...inputSt, marginTop: 7 }}
                    />
                    <input
                      type="email"
                      placeholder="E-mail (opcional)"
                      value={part.email || ''}
                      onChange={e => atualizarParticipante(part.id, 'email', e.target.value)}
                      style={{ ...inputSt, marginTop: 7 }}
                    />
                    <select
                      value={part.canal || 'whatsapp'}
                      onChange={e => atualizarParticipante(part.id, 'canal', e.target.value)}
                      style={{ ...inputSt, marginTop: 7, appearance: 'none', cursor: 'pointer' }}
                    >
                      <option value="whatsapp">📱 WhatsApp</option>
                      <option value="email">📧 E-mail</option>
                      <option value="ambos">📱📧 Ambos (WA + E-mail)</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>{/* /col-direita */}
            </div>{/* /grid */}

            {/* Personalizar mensagens */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 16, overflow: 'hidden' }}>
              <button onClick={() => setMostrarMsgs(v => !v)}
                style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>💬 Personalizar Mensagens</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 10 }}>Edite os textos que o bot envia em cada etapa</span>
                </div>
                <span style={{ color: '#475569', transition: 'transform 0.2s', display: 'inline-block', transform: mostrarMsgs ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </button>

              {mostrarMsgs && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid #1e2a4a', borderRadius: 9, padding: '10px 14px', margin: '14px 0', fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.8, fontFamily: 'monospace' }}>
                    <span style={{ color: '#475569', fontWeight: 700 }}>Variáveis: </span>{VARS_HINT}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                    {Object.entries(msgs).map(([key, val]) => (
                      <div key={key}>
                        <label style={{ display: 'block', fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 4 }}>
                          {MSG_LABELS[key] || key}
                        </label>
                        <textarea
                          value={val}
                          onChange={e => setMsgs(m => ({ ...m, [key]: e.target.value }))}
                          rows={4}
                          style={{ ...inputSt, fontFamily: 'monospace', fontSize: 11.5, resize: 'vertical', lineHeight: 1.5 }}
                        />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setMsgs({ ...TEMPLATES[tipoFluxo].msgs })}
                    style={{ marginTop: 12, padding: '7px 16px', background: 'transparent', border: '1px solid #1e1e3f', color: '#475569', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                    ↺ Restaurar padrões
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── PROGRESS BAR */}
        {fase !== 'setup' && (
          <div className="pf" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {steps.map((step, i) => {
              const done = faseIdx > faseOrder.indexOf(step.key === 'p1_input' ? 'enviando' : step.key)
              const active = step.key === 'p1_input'
                ? (fase === 'p1_input' || fase === 'enviando')
                : fase === step.key
              return (
                <React.Fragment key={step.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: done ? '#10b981' : (active ? '#6366f1' : '#1a1a35'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: done || active ? '#fff' : '#334155', boxShadow: active ? '0 0 12px rgba(99,102,241,0.5)' : 'none', transition: 'all 0.3s' }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? '#e2e8f0' : (done ? '#10b981' : '#334155'), whiteSpace: 'nowrap' }}>
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: done ? '#10b981' : '#1a1a35', maxWidth: 40, minWidth: 10, transition: 'background 0.4s' }} />}
                </React.Fragment>
              )
            })}
            {fase === 'enviando' && (
              <span style={{ marginLeft: 'auto', color: '#f59e0b', fontSize: 11, animation: 'pulse 1.2s infinite' }}>⏳ Enviando...</span>
            )}
          </div>
        )}

        {/* ── PHONES GRID */}
        {fase !== 'setup' && (
          <>
            <div className="pf" style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 12, justifyContent: participantes.length <= 3 ? 'center' : 'flex-start', alignItems: 'flex-start' }}>
              {/* P1 */}
              {(p[0]?.canal !== 'email') && (
                <PhoneMock papel={p[0]?.papel || 'P1'} nome={p[0]?.nome} cor={p[0]?.cor || '#6366f1'}
                  messages={msgsPhone[0]} inputAtivo={fase === 'p1_input'}
                  inputPlaceholder={TEMPLATES[tipoFluxo]?.inputPlaceholder || 'Mensagem...'}
                  onEnviar={p1Envia} acoes={acoesValida}
                  badge={fase === 'p1_valida' ? 'Validar entrega ⚡' : ''}
                  ativo={fase === 'p1_input' || fase === 'enviando' || fase === 'p1_valida'}
                />
              )}
              {(p[0]?.canal === 'email' || p[0]?.canal === 'ambos') && (
                <EmailInboxMock papel={p[0]?.papel || 'P1'} nome={p[0]?.nome} cor={p[0]?.cor || '#6366f1'}
                  emails={msgsEmail[0]} inputAtivo={fase === 'p1_input'}
                  inputPlaceholder={TEMPLATES[tipoFluxo]?.inputPlaceholder || 'Mensagem...'}
                  onEnviar={p1Envia} acoes={acoesValida}
                  badge={fase === 'p1_valida' ? 'Validar entrega ⚡' : ''}
                  ativo={fase === 'p1_input' || fase === 'enviando' || fase === 'p1_valida'}
                />
              )}
              {/* P2 */}
              {p[1] && (p[1]?.canal !== 'email') && (
                <PhoneMock papel={p[1]?.papel || 'P2'} nome={p[1]?.nome} cor={p[1]?.cor || '#f59e0b'}
                  messages={msgsPhone[1]} inputAtivo={false} acoes={acoes2}
                  badge={fase === 'p2_decide' ? 'Ação necessária ⚡' : ''}
                  ativo={fase === 'p2_decide'}
                />
              )}
              {p[1] && (p[1]?.canal === 'email' || p[1]?.canal === 'ambos') && (
                <EmailInboxMock papel={p[1]?.papel || 'P2'} nome={p[1]?.nome} cor={p[1]?.cor || '#f59e0b'}
                  emails={msgsEmail[1]} inputAtivo={false} acoes={acoes2}
                  badge={fase === 'p2_decide' ? 'Ação necessária ⚡' : ''}
                  ativo={fase === 'p2_decide'}
                />
              )}
              {/* P3 */}
              {p[2] && (p[2]?.canal !== 'email') && (
                <PhoneMock papel={p[2]?.papel || 'P3'} nome={p[2]?.nome || '—'} cor={p[2]?.cor || '#10b981'}
                  messages={msgsPhone[2]} inputAtivo={false} acoes={acoes3}
                  badge={fase === 'p3_confirma' ? 'Confirmar ⚡' : ''}
                  ativo={fase === 'p3_confirma'}
                />
              )}
              {p[2] && (p[2]?.canal === 'email' || p[2]?.canal === 'ambos') && (
                <EmailInboxMock papel={p[2]?.papel || 'P3'} nome={p[2]?.nome || '—'} cor={p[2]?.cor || '#10b981'}
                  emails={msgsEmail[2]} inputAtivo={false} acoes={acoes3}
                  badge={fase === 'p3_confirma' ? 'Confirmar ⚡' : ''}
                  ativo={fase === 'p3_confirma'}
                />
              )}
              {/* P4 */}
              {p[3] && (p[3]?.canal !== 'email') && (
                <PhoneMock papel={p[3]?.papel || 'P4'} nome={p[3]?.nome || '—'} cor={p[3]?.cor || '#ec4899'}
                  messages={msgsPhone[3]} inputAtivo={false} acoes={[]}
                  badge={fase === 'concluido' && msgsPhone[3].length > 0 ? 'Notificado ✓' : ''}
                  ativo={false}
                />
              )}
              {p[3] && (p[3]?.canal === 'email' || p[3]?.canal === 'ambos') && (
                <EmailInboxMock papel={p[3]?.papel || 'P4'} nome={p[3]?.nome || '—'} cor={p[3]?.cor || '#ec4899'}
                  emails={msgsEmail[3]} inputAtivo={false} acoes={[]} ativo={false}
                />
              )}
              {/* P5 */}
              {p[4] && (p[4]?.canal !== 'email') && (
                <PhoneMock papel={p[4]?.papel || 'P5'} nome={p[4]?.nome || '—'} cor={p[4]?.cor || '#3b82f6'}
                  messages={msgsPhone[4]} inputAtivo={false} acoes={[]}
                  badge={fase === 'concluido' && msgsPhone[4].length > 0 ? 'Notificado ✓' : ''}
                  ativo={false}
                />
              )}
              {p[4] && (p[4]?.canal === 'email' || p[4]?.canal === 'ambos') && (
                <EmailInboxMock papel={p[4]?.papel || 'P5'} nome={p[4]?.nome || '—'} cor={p[4]?.cor || '#3b82f6'}
                  emails={msgsEmail[4]} inputAtivo={false} acoes={[]} ativo={false}
                />
              )}
            </div>

            {/* Motivo reprovação */}
            {fase === 'p2_decide' && (
              <div className="pf" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 12, padding: '14px 18px', marginTop: 14, maxWidth: 420, margin: '14px auto 0' }}>
                <label style={{ color: '#475569', fontSize: 12, display: 'block', marginBottom: 6 }}>
                  💬 Motivo da reprovação (preencha antes de clicar Reprovar)
                </label>
                <input
                  value={motivoReprova}
                  onChange={e => setMotivoReprova(e.target.value)}
                  placeholder="Ex: Data inválida, orçamento excedido..."
                  style={inputSt}
                />
              </div>
            )}

            {/* Ocorrência — validação pelo Líder (P1) */}
            {fase === 'p1_valida' && (
              <div className="pf" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12, padding: '14px 18px', maxWidth: 480, margin: '14px auto 0' }}>
                <label style={{ color: '#475569', fontSize: 12, display: 'block', marginBottom: 6 }}>
                  ⚠️ Descreva a ocorrência antes de clicar em "Ocorrência" (opcional)
                </label>
                <input
                  value={ocorrenciaInput}
                  onChange={e => setOcorrenciaInput(e.target.value)}
                  placeholder="Ex: Faltou 1 refeição, temperatura incorreta..."
                  style={inputSt}
                />
              </div>
            )}

            {/* Resultado final */}
            {fase === 'concluido' && (
              <div className="pf" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: 20, marginTop: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>🎉</div>
                <div style={{ color: '#10b981', fontWeight: 900, fontSize: 15, marginBottom: 4 }}>Simulação concluída com sucesso!</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                  Fluxo executado de ponta a ponta com registro real no banco de dados.
                </div>
                {instanceId && (
                  <div style={{ color: '#475569', fontSize: 12, fontFamily: 'monospace', marginBottom: 16 }}>
                    Instância: <span style={{ color: '#6366f1' }}>{instanceId}</span>
                  </div>
                )}
                <button onClick={resetar}
                  style={{ padding: '11px 24px', background: '#1e293b', border: '1px solid #334155', color: 'var(--text-primary)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  🔄 Nova Simulação
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const inputSt = {
  width: '100%',
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}
