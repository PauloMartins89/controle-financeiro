import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import toast from 'react-hot-toast'

const agora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const gerarCodigo = () => 'SIM-' + Math.random().toString(36).toUpperCase().substring(2, 7)

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 285, maxWidth: 310 }}>
      {/* Label acima do celular */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 28 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: cor, boxShadow: ativo ? `0 0 10px ${cor}` : 'none', transition: 'box-shadow 0.4s' }} />
        <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 13 }}>{papel}</span>
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
          height: 350,
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
                <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>
                  {renderMsgTexto(msg.texto)}
                </pre>
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
                style={{ flex: 1, background: '#2A3942', border: 'none', borderRadius: 20, padding: '9px 14px', color: '#e2e8f0', fontSize: 12.5, outline: 'none' }}
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

// Render texto com bold (*palavra*)
function renderMsgTexto(texto) {
  return texto
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────
export default function SimulacaoFluxo() {
  const { workspaceId } = useStore()

  const [setup, setSetup] = useState({
    nome_sol: '', cel_sol: '',
    nome_sup: '', cel_sup: '',
    nome_res: '', cel_res: '',
  })
  const [fase, setFase] = useState('setup')
  // setup | sol_input | enviando | sup_decide | res_confirma | concluido
  const [codigo] = useState(gerarCodigo)
  const [pedido, setPedido] = useState('')
  const [instanceId, setInstanceId] = useState(null)
  const [definicoes, setDefinicoes] = useState([])
  const [defSelecionada, setDefSelecionada] = useState('')
  const [executando, setExecutando] = useState(false)
  const [motivoReprova, setMotivoReprova] = useState('')

  const [msgs1, setMsgs1] = useState([]) // solicitante
  const [msgs2, setMsgs2] = useState([]) // supervisor
  const [msgs3, setMsgs3] = useState([]) // restaurante

  const add1 = (texto, saida = false, sistema = false) =>
    setMsgs1(p => [...p, { texto, saida, sistema, hora: agora() }])
  const add2 = (texto, saida = false, sistema = false) =>
    setMsgs2(p => [...p, { texto, saida, sistema, hora: agora() }])
  const add3 = (texto, saida = false, sistema = false) =>
    setMsgs3(p => [...p, { texto, saida, sistema, hora: agora() }])

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

  const s = setup

  // ── Enviar WhatsApp real via flow-engine ──────────────
  const enviarWA = async (to, message) => {
    try {
      await fetch('/api/flow-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'wa_send', to, message }),
      })
    } catch (e) { /* silencioso */ }
  }

  // ── FASE: iniciar simulação ───────────────────────────
  const iniciar = () => {
    if (!s.nome_sol?.trim() || !s.cel_sol?.trim()) {
      toast.error('Preencha nome e celular do solicitante')
      return
    }
    if (!s.nome_sup?.trim() || !s.cel_sup?.trim()) {
      toast.error('Preencha nome e celular do supervisor')
      return
    }
    setFase('sol_input')
    setTimeout(() => {
      add1(`Olá, *${s.nome_sol}*! 👋\n\nSou o assistente de pedidos de refeição.\n\nDigite sua solicitação abaixo:\n(ex: 1 almoço para 2 pessoas, dia 22/05)`)
    }, 400)
  }

  // ── FASE: solicitante digita e envia ─────────────────
  const solEnvia = async (texto) => {
    setPedido(texto)
    add1(texto, true)
    setFase('enviando')

    // Bot confirma imediatamente
    setTimeout(() => {
      add1(`✅ *Pedido recebido!*\n\nCódigo: *${codigo}*\n\nEnviando para aprovação de *${s.nome_sup}*...`)
    }, 700)

    // Criar registro real + enviar WA para solicitante e supervisor
    try {
      const resp = await fetch('/api/flow-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sim_start',
          definition_id: defSelecionada || undefined,
          workspace_id: workspaceId,
          dados_simulacao: {
            nome_solicitante: s.nome_sol, celular_solicitante: s.cel_sol,
            nome_supervisor:  s.nome_sup, celular_supervisor:  s.cel_sup,
            nome_restaurante: s.nome_res, celular_restaurante: s.cel_res,
            pedido: texto, codigo,
          },
        }),
      })
      const data = await resp.json()
      if (resp.ok) {
        setInstanceId(data.instance_id)
        toast.success(`Registro criado · WA enviado para ${s.nome_sup}`)
      }
    } catch (e) {
      toast.error('Erro ao criar registro')
    }

    // Mensagem chega ao supervisor
    const linkAprovar = `https://smartpro.app.br/aprovar?sim=${codigo}`
    setTimeout(() => {
      add2(
        `📋 *Solicitação de Refeição*\n\n` +
        `Solicitante: *${s.nome_sol}*\n` +
        `Pedido: *${texto}*\n` +
        `Código: *${codigo}*\n\n` +
        `🔗 *${linkAprovar}*\n\n` +
        `Use os botões abaixo para responder:`
      )
      setFase('sup_decide')
    }, 2400)

    setTimeout(() => {
      add1(`📨 Notificação enviada para *${s.nome_sup}*.\n\nAguardando resposta...`)
    }, 2900)
  }

  // ── FASE: supervisor aprova ───────────────────────────
  const supAprova = async () => {
    if (executando) return
    setExecutando(true)
    add2('✅ Aprovado!', true)

    // Envia WA real ao restaurante
    if (s.cel_res) {
      enviarWA(
        s.cel_res,
        `🧪 [SIMULAÇÃO]\n📦 Pedido aprovado!\n\nSolicitante: ${s.nome_sol}\nPedido: ${pedido}\nCódigo: ${codigo}\nAprovado por: ${s.nome_sup}`,
      )
    }

    setTimeout(() => {
      add2(`✅ *Aprovação registrada!*\n\nCódigo: *${codigo}*\nPor: *${s.nome_sup}*`)
      add1(
        `🎉 *Pedido Aprovado!*\n\n` +
        `Aprovado por *${s.nome_sup}*.\n` +
        `Código: *${codigo}*\n\n` +
        (s.nome_res ? `O restaurante *${s.nome_res}* foi notificado.` : 'Aguarde o preparo.')
      )

      if (s.cel_res && s.nome_res) {
        const linkConfirmar = `https://smartpro.app.br/confirmar?sim=${codigo}`
        setTimeout(() => {
          add3(
            `📦 *Novo Pedido Aprovado*\n\n` +
            `Solicitante: *${s.nome_sol}*\n` +
            `Pedido: *${pedido}*\n` +
            `Código: *${codigo}*\n` +
            `Aprovado por: *${s.nome_sup}*\n\n` +
            `🔗 Confirmar preparo:\n*${linkConfirmar}*`
          )
          setFase('res_confirma')
        }, 600)
      } else {
        setFase('concluido')
        setTimeout(() => {
          add1(
            `✅ *Simulação concluída!*\n\n` +
            `Fluxo executado:\n1. Solicitante → Enviou ✓\n2. Supervisor → Aprovou ✓\n\n` +
            `ID: ${instanceId?.substring(0, 8) || codigo}`,
            false, true
          )
        }, 400)
      }
    }, 900)

    setExecutando(false)
  }

  // ── FASE: supervisor reprova ──────────────────────────
  const supReprova = async () => {
    if (executando) return
    setExecutando(true)
    const motivo = motivoReprova.trim() || 'Não informado'
    add2(`❌ Reprovado\nMotivo: ${motivo}`, true)

    setTimeout(() => {
      add2(`❌ *Reprovação registrada.*\n\nMotivo: *${motivo}*\nCódigo: *${codigo}*`)
      add1(
        `❌ *Pedido Reprovado*\n\n` +
        `Reprovado por *${s.nome_sup}*.\n` +
        `Motivo: *${motivo}*\n` +
        `Código: *${codigo}*\n\n` +
        `Entre em contato com seu gestor.`
      )
      setFase('concluido')
    }, 900)

    setExecutando(false)
  }

  // ── FASE: restaurante confirma ────────────────────────
  const resConfirma = () => {
    add3('Pedido confirmado! ✅', true)
    setTimeout(() => {
      add3(`✅ *Recebimento confirmado!*\n\nCódigo: *${codigo}*\nStatus: em preparo`)
      add1(`🍽️ *Pedido em Preparo!*\n\n${s.nome_res} confirmou o recebimento.\nSeu pedido está sendo preparado!`)
      setFase('concluido')
      setTimeout(() => {
        add1(
          `✅ *Simulação completa!*\n\n` +
          `Fluxo executado de ponta a ponta:\n` +
          `1. Solicitante → Pedido enviado ✓\n` +
          `2. Supervisor → Aprovado ✓\n` +
          `3. Restaurante → Confirmado ✓\n\n` +
          `ID: ${instanceId?.substring(0, 8) || codigo}`,
          false, true
        )
      }, 500)
    }, 900)
  }

  const resetar = () => {
    setFase('setup')
    setMsgs1([]); setMsgs2([]); setMsgs3([])
    setInstanceId(null); setPedido(''); setMotivoReprova('')
  }

  // Ações dos celulares por fase
  const acoes2 = fase === 'sup_decide' ? [
    { label: '✅ Aprovar', cor: '#10b981', onClick: supAprova, disabled: executando },
    { label: '❌ Reprovar', cor: '#ef4444', onClick: supReprova, disabled: executando },
  ] : []
  const acoes3 = fase === 'res_confirma' ? [
    { label: '✅ Confirmar Recebimento', cor: '#10b981', onClick: resConfirma },
  ] : []

  // Progress steps
  const steps = [
    { key: 'sol_input',   label: '1. Solicitante' },
    { key: 'sup_decide',  label: '2. Supervisor' },
    { key: 'res_confirma',label: '3. Restaurante' },
    { key: 'concluido',   label: '✅ Concluído' },
  ]
  const faseOrder = ['sol_input', 'enviando', 'sup_decide', 'res_confirma', 'concluido']
  const faseIdx = faseOrder.indexOf(fase)

  return (
    <div style={{ minHeight: '100vh', background: '#07070f', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .phone-fade { animation: fadeIn 0.4s ease; }
      `}</style>

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '28px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{
              margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: -0.5,
              background: 'linear-gradient(90deg, #6366f1 0%, #10b981 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              📱 Simulação Interativa de Fluxo
            </h1>
            <p style={{ margin: '4px 0 0', color: '#334155', fontSize: 13 }}>
              3 participantes · WhatsApp real · Fluxo de ponta a ponta
            </p>
          </div>
          {fase !== 'setup' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#334155', fontSize: 11 }}>Código da simulação</div>
                <div style={{ color: '#6366f1', fontWeight: 900, fontFamily: 'monospace', fontSize: 17 }}>{codigo}</div>
                {instanceId && <div style={{ color: '#1e3a5f', fontSize: 10, fontFamily: 'monospace' }}>ID: {instanceId.substring(0, 8)}</div>}
              </div>
              <button onClick={resetar}
                style={{ padding: '9px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                🔄 Reiniciar
              </button>
            </div>
          )}
        </div>

        {/* ── SETUP ────────────────────────────────────────── */}
        {fase === 'setup' && (
          <div className="phone-fade" style={{ background: '#0f0f1e', border: '1px solid #1a1a35', borderRadius: 18, padding: 28 }}>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 4px', color: '#e2e8f0', fontSize: 16, fontWeight: 800 }}>⚙️ Configurar participantes</h3>
              <p style={{ margin: 0, color: '#334155', fontSize: 13 }}>
                Preencha os dados. WhatsApp real será enviado para cada celular em cada etapa.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
              {[
                { campo: 'sol', label: 'Solicitante',          cor: '#6366f1', icon: '👤', obrig: true },
                { campo: 'sup', label: 'Supervisor / Aprovador', cor: '#f59e0b', icon: '✍️', obrig: true },
                { campo: 'res', label: 'Restaurante',           cor: '#10b981', icon: '🍽️', obrig: false },
              ].map(({ campo, label, cor, icon, obrig }) => (
                <div key={campo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${cor}30` }}>
                    <span style={{ fontSize: 15 }}>{icon}</span>
                    <span style={{ color: cor, fontWeight: 800, fontSize: 13 }}>{label}</span>
                    {!obrig && <span style={{ color: '#334155', fontSize: 10 }}>(opcional)</span>}
                  </div>
                  <input
                    placeholder={`Nome do(a) ${label.split(' ')[0].toLowerCase()}`}
                    value={setup[`nome_${campo}`]}
                    onChange={e => setSetup(p => ({ ...p, [`nome_${campo}`]: e.target.value }))}
                    style={inputSt}
                  />
                  <input
                    placeholder="Celular com DDI: 5511999..."
                    value={setup[`cel_${campo}`]}
                    onChange={e => setSetup(p => ({ ...p, [`cel_${campo}`]: e.target.value }))}
                    style={{ ...inputSt, marginTop: 8 }}
                  />
                </div>
              ))}
            </div>

            {definicoes.length > 0 && (
              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ color: '#334155', fontSize: 12, whiteSpace: 'nowrap' }}>Processo real:</label>
                <select
                  value={defSelecionada}
                  onChange={e => setDefSelecionada(e.target.value)}
                  style={{ ...inputSt, width: 'auto', minWidth: 240, flex: 'none' }}>
                  <option value="">Apenas simulação visual</option>
                  {definicoes.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
            )}

            <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
              <button onClick={iniciar}
                style={{
                  padding: '14px 32px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  border: 'none', color: '#fff', borderRadius: 12,
                  fontSize: 15, fontWeight: 900, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                  boxShadow: '0 8px 30px rgba(99,102,241,0.3)',
                }}>
                🚀 Iniciar Simulação
              </button>
              <span style={{ color: '#1e293b', fontSize: 12 }}>Restaurante é opcional</span>
            </div>
          </div>
        )}

        {/* ── PROGRESS BAR ─────────────────────────────────── */}
        {fase !== 'setup' && (
          <div className="phone-fade" style={{
            background: '#0f0f1e', border: '1px solid #1a1a35',
            borderRadius: 12, padding: '12px 20px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {steps.map((step, i) => {
              const stepOrder = ['sol_input', 'sup_decide', 'res_confirma', 'concluido']
              const stepIdx = stepOrder.indexOf(step.key)
              const done = faseIdx > ['sol_input', 'enviando', 'sup_decide', 'res_confirma', 'concluido'].indexOf(step.key === 'sol_input' ? 'enviando' : step.key)
              const active = step.key === 'sol_input'
                ? (fase === 'sol_input' || fase === 'enviando')
                : fase === step.key
              return (
                <React.Fragment key={step.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: done ? '#10b981' : (active ? '#6366f1' : '#1a1a35'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 900,
                      color: done || active ? '#fff' : '#334155',
                      boxShadow: active ? '0 0 12px rgba(99,102,241,0.5)' : 'none',
                      transition: 'all 0.3s',
                    }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? '#e2e8f0' : (done ? '#10b981' : '#334155'), whiteSpace: 'nowrap' }}>
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ flex: 1, height: 1, background: done ? '#10b981' : '#1a1a35', maxWidth: 50, transition: 'background 0.4s' }} />
                  )}
                </React.Fragment>
              )
            })}
            {fase === 'enviando' && (
              <span style={{ marginLeft: 'auto', color: '#f59e0b', fontSize: 11, animation: 'pulse 1.2s infinite' }}>
                ⏳ Enviando...
              </span>
            )}
          </div>
        )}

        {/* ── 3 PHONES ─────────────────────────────────────── */}
        {fase !== 'setup' && (
          <>
            <div className="phone-fade" style={{
              display: 'flex', gap: 18, overflowX: 'auto',
              paddingBottom: 12, justifyContent: 'center', alignItems: 'flex-start',
            }}>
              <PhoneMock
                papel="Solicitante"
                nome={s.nome_sol}
                cor="#6366f1"
                messages={msgs1}
                inputAtivo={fase === 'sol_input'}
                inputPlaceholder="Ex: 1 almoço para 22/05, 2 pessoas..."
                onEnviar={solEnvia}
                acoes={[]}
                ativo={fase === 'sol_input' || fase === 'enviando'}
              />
              <PhoneMock
                papel="Supervisor"
                nome={s.nome_sup}
                cor="#f59e0b"
                messages={msgs2}
                inputAtivo={false}
                acoes={acoes2}
                badge={fase === 'sup_decide' ? 'Ação necessária ⚡' : ''}
                ativo={fase === 'sup_decide'}
              />
              <PhoneMock
                papel="Restaurante"
                nome={s.nome_res || '—'}
                cor="#10b981"
                messages={msgs3}
                inputAtivo={false}
                acoes={acoes3}
                badge={fase === 'res_confirma' ? 'Confirmar ⚡' : ''}
                ativo={fase === 'res_confirma'}
              />
            </div>

            {/* Campo motivo reprovação (abaixo dos phones) */}
            {fase === 'sup_decide' && (
              <div className="phone-fade" style={{
                background: '#0f0f1e', border: '1px solid rgba(239,68,68,0.12)',
                borderRadius: 12, padding: '14px 18px', marginTop: 16,
                maxWidth: 400, margin: '14px auto 0',
              }}>
                <label style={{ color: '#475569', fontSize: 12, display: 'block', marginBottom: 6 }}>
                  💬 Motivo da reprovação (preencha antes de clicar Reprovar)
                </label>
                <input
                  value={motivoReprova}
                  onChange={e => setMotivoReprova(e.target.value)}
                  placeholder="Ex: Data inválida, orçamento excedido..."
                  style={{ ...inputSt }}
                />
              </div>
            )}

            {/* Resultado final */}
            {fase === 'concluido' && (
              <div className="phone-fade" style={{
                background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 12, padding: 20, marginTop: 20, textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                <div style={{ color: '#10b981', fontWeight: 900, fontSize: 16, marginBottom: 4 }}>
                  Simulação concluída com sucesso!
                </div>
                <div style={{ color: '#334155', fontSize: 13, marginBottom: 16 }}>
                  O fluxo foi executado de ponta a ponta com registro real no banco de dados.
                </div>
                {instanceId && (
                  <div style={{ color: '#475569', fontSize: 12, fontFamily: 'monospace', marginBottom: 16 }}>
                    Instância criada: <span style={{ color: '#6366f1' }}>{instanceId}</span>
                  </div>
                )}
                <button onClick={resetar}
                  style={{ padding: '11px 24px', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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
  background: '#1a1a30',
  border: '1px solid #2a2a4a',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#e2e8f0',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}
