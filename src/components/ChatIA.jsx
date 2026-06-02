import { useState, useRef, useEffect } from 'react'
import { SparklesIcon, XMarkIcon, PaperAirplaneIcon, CheckIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { SparklesIcon as SparklesSolid } from '@heroicons/react/24/solid'
import useStore from '../store/useStore'
import { chatWithAI, buildContext } from '../lib/ai'

const WELCOME = 'Oi! 👋 Sou a Livia, sua assistente financeira do SmartPro!\n\nPode me perguntar qualquer coisa sobre seus gastos ou pedir pra eu lançar uma despesa. Exemplos:\n• "Quanto gastei essa semana?"\n• "Quem me deve mais?"\n• "Lança 50 reais de Uber hoje"'

const DAILY_LIMIT = 30
const WELCOME_MSG = { role: 'assistant', text: WELCOME, type: 'text' }

function getDailyCount(wsId = '') {
  try {
    const raw = localStorage.getItem(`livia-daily${wsId ? '-' + wsId : ''}`)
    const data = raw ? JSON.parse(raw) : null
    const today = new Date().toDateString()
    if (!data || data.date !== today) return 0
    return data.count || 0
  } catch { return 0 }
}

function incrementDaily(wsId = '') {
  try {
    const count = getDailyCount(wsId) + 1
    localStorage.setItem(`livia-daily${wsId ? '-' + wsId : ''}`, JSON.stringify({ date: new Date().toDateString(), count }))
    return count
  } catch { return 0 }
}

function buildProactiveSuggestion(expenses, recurring) {
  const today = new Date()
  const insights = []

  const upcoming = recurring.filter(r => {
    const day = parseInt(r.dia_vencimento)
    if (!day) return false
    const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), day)
    const due = dueThisMonth >= today ? dueThisMonth : new Date(today.getFullYear(), today.getMonth() + 1, day)
    return (due - today) / 86400000 <= 7
  })
  if (upcoming.length > 0) {
    const names = upcoming.slice(0, 2).map(r => r.descricao).join(', ')
    insights.push(`📅 *${upcoming.length} conta(s)* vence(m) em até 7 dias: ${names}`)
  }

  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7)
  const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(today.getDate() - 14)
  const thisWeek = expenses.filter(e => new Date(e.data) >= weekAgo).reduce((s, e) => s + (e.valor || 0), 0)
  const lastWeek = expenses.filter(e => { const d = new Date(e.data); return d >= twoWeeksAgo && d < weekAgo }).reduce((s, e) => s + (e.valor || 0), 0)
  if (lastWeek > 50 && thisWeek > 0) {
    const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
    if (pct > 15) insights.push(`📈 Você gastou *${pct}% a mais* essa semana (R$ ${thisWeek.toFixed(2)} vs R$ ${lastWeek.toFixed(2)})`)
    else if (pct < -15) insights.push(`📉 Boa! Você gastou *${Math.abs(pct)}% a menos* essa semana 🎉`)
  }

  if (!insights.length) return null
  return `Aqui vai um resuminho rápido:\n\n${insights.join('\n')}\n\nPosso te ajudar com algo? 😊`
}

function renderText(text) {
  if (!text) return null
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const parts = line.split(/\*([^*]+)\*/g)
    return (
      <span key={i}>
        {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
        {i < lines.length - 1 && '\n'}
      </span>
    )
  })
}

export default function ChatIA() {
  const [open, setOpen] = useState(false)
  const { expenses, people, groups, cards, addExpense, recurring, saldoCaixa, currentUser, workspaceId } = useStore()
  const chatKey = workspaceId ? `livia-chat-${workspaceId}` : 'livia-chat'
  const [messages, setMessages] = useState(() => {
    try { const s = localStorage.getItem(chatKey); return s ? JSON.parse(s) : [WELCOME_MSG] } catch { return [WELCOME_MSG] }
  })
  const [dailyCount, setDailyCount] = useState(() => getDailyCount(workspaceId))
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingExpense, setPendingExpense] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const hadUser = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Persistir histórico
  useEffect(() => {
    try { localStorage.setItem(chatKey, JSON.stringify(messages)) } catch {}
  }, [messages, chatKey])

  // Limpar no logout
  useEffect(() => {
    if (currentUser) { hadUser.current = true; return }
    if (hadUser.current) {
      localStorage.removeItem(chatKey)
      setMessages([WELCOME_MSG])
      hadUser.current = false
    }
  }, [currentUser?.id])

  // Sugestão proativa (1x por dia, na primeira abertura)
  useEffect(() => {
    if (!open || messages.length > 1) return
    const key = `livia-proactive-${workspaceId ? workspaceId + '-' : ''}${new Date().toDateString()}`
    if (localStorage.getItem(key)) return
    const suggestion = buildProactiveSuggestion(expenses, recurring)
    if (!suggestion) return
    localStorage.setItem(key, '1')
    setTimeout(() => setMessages(prev => [...prev, { role: 'assistant', type: 'text', text: suggestion }]), 900)
  }, [open])

  async function handleSend() {
    if (!input.trim() || loading) return
    if (dailyCount >= DAILY_LIMIT) {
      setMessages(prev => [...prev, { role: 'assistant', type: 'text', text: `Eita! Cheguei no limite de ${DAILY_LIMIT} perguntas por dia 😅 Volta amanhã que estarei fresquinha!` }])
      return
    }
    const userText = input.trim()
    setInput('')
    const newMessages = [...messages, { role: 'user', text: userText, type: 'text' }]
    setMessages(newMessages)
    setLoading(true)
    const newCount = incrementDaily(workspaceId)
    setDailyCount(newCount)

    try {
      const context = buildContext({ expenses, people, groups, cards, recurring, saldoCaixa })
      const history = newMessages
        .filter(m => m.type === 'text')
        .map(m => ({ role: m.role, content: m.text }))

      const result = await chatWithAI(history, context)

      if (result.type === 'insert') {
        setPendingExpense(result.expense)
        setMessages(prev => [...prev, {
          role: 'assistant',
          type: 'confirm',
          expense: result.expense,
          text: null,
        }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', type: 'text', text: result.text }])
      }
    } catch (err) {
      const isRateLimit = err.message?.includes('429') || err.message?.includes('Rate limit') || err.message?.includes('rate_limit')
      setMessages(prev => [...prev, {
        role: 'assistant', type: 'text',
        text: isRateLimit
          ? 'Eita, fiz muitas perguntas de uma vez e travei um segundo! 😅 Me dá um minutinho e tenta de novo?'
          : 'Ops, tive um probleminha técnico agora. Tenta de novo em instantes! 😅',
      }])
    }
    setLoading(false)
  }

  async function handleConfirm(expense) {
    await addExpense({
      descricao: expense.descricao,
      valor: parseFloat(expense.valor),
      data: expense.data,
      categoria: expense.categoria || 'Outros',
      status: expense.status || 'pendente',
      participantes: [],
      tipo_divisao: 'igual',
      parcelas: 1,
      parcela_atual: 1,
      recorrente: false,
    })
    setPendingExpense(null)
    setMessages(prev => [
      ...prev.filter(m => m.type !== 'confirm'),
      { role: 'assistant', type: 'text', text: `✅ Despesa "${expense.descricao}" de R$ ${parseFloat(expense.valor).toFixed(2)} adicionada com sucesso!` },
    ])
  }

  function handleCancel() {
    setPendingExpense(null)
    setMessages(prev => [
      ...prev.filter(m => m.type !== 'confirm'),
      { role: 'assistant', type: 'text', text: 'Tudo bem, despesa não foi adicionada.' },
    ])
  }

  return (
    <>
      {/* Bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
          transition: 'transform 0.2s',
        }}
        title="Assistente IA"
      >
        {open
          ? <XMarkIcon style={{ width: 22, height: 22, color: 'white' }} />
          : <SparklesSolid style={{ width: 22, height: 22, color: 'white' }} />
        }
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 999,
          width: 468, height: 740,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
          }}>
            <SparklesSolid style={{ width: 18, height: 18, color: '#6366f1', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Livia 💜</div>
              <div style={{ fontSize: 11, color: dailyCount >= DAILY_LIMIT ? '#ef4444' : '#10b981' }}>
                ● Online — {dailyCount}/{DAILY_LIMIT} perguntas hoje
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.type === 'confirm' ? (
                  <ConfirmCard expense={msg.expense} onConfirm={handleConfirm} onCancel={handleCancel} />
                ) : (
                  <div style={{
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: msg.role === 'user' ? '#6366f1' : 'var(--bg-secondary)',
                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {msg.role === 'assistant' ? renderText(msg.text) : msg.text}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '8px 14px', borderRadius: '14px 14px 14px 4px', background: 'var(--bg-secondary)', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#6366f1',
                      animation: `bounce 1s ease-in-out ${i * 0.2}s infinite`,
                      display: 'inline-block',
                    }} />
                  ))}
                  <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }`}</style>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 14px 14px',
            borderTop: '1px solid var(--border)',
            background: 'rgba(99,102,241,0.04)',
          }}>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 10,
              background: 'var(--bg-secondary)',
              border: '1.5px solid var(--border)',
              borderRadius: 14,
              padding: '10px 12px 8px',
              transition: 'border-color 0.2s',
            }}
              onFocusCapture={e => e.currentTarget.style.borderColor = '#6366f1'}
              onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Fala comigo! Sobre gastos, dívidas..."
                rows={3}
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.55,
                  resize: 'none', fontFamily: 'inherit',
                  placeholder: 'color: var(--text-secondary)',
                }}
                disabled={loading}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Enter para enviar · Shift+Enter nova linha</span>
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  style={{
                    background: loading || !input.trim() ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none', borderRadius: 10, padding: '7px 14px',
                    cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.2s', color: 'white', fontSize: 12, fontWeight: 600,
                  }}
                >
                  <PaperAirplaneIcon style={{ width: 14, height: 14 }} />
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ConfirmCard({ expense, onConfirm, onCancel }) {
  return (
    <div style={{
      background: 'rgba(99,102,241,0.1)',
      border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: 12, padding: 12, width: '100%',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', marginBottom: 8 }}>Confirmar inserção:</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>📝 {expense.descricao}</div>
      <div style={{ fontSize: 13, color: '#10b981', fontWeight: 700, marginBottom: 2 }}>
        R$ {parseFloat(expense.valor || 0).toFixed(2)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
        {expense.data} · {expense.categoria}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onConfirm(expense)} style={{
          flex: 1, background: '#10b981', border: 'none', borderRadius: 8,
          padding: '6px 0', cursor: 'pointer', color: 'white', fontSize: 12,
          fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <CheckIcon style={{ width: 14, height: 14 }} /> Confirmar
        </button>
        <button onClick={onCancel} style={{
          flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '6px 0', cursor: 'pointer', color: '#ef4444', fontSize: 12,
          fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <XCircleIcon style={{ width: 14, height: 14 }} /> Cancelar
        </button>
      </div>
    </div>
  )
}
