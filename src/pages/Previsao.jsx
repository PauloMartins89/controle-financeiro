import { useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { formatCurrency } from '../lib/utils'
import {
  CreditCardIcon, CheckCircleIcon, BanknotesIcon,
  ArrowTrendingDownIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'

// ─── helpers ─────────────────────────────────────────────────────────────────
function getDaysUntil(dayOfMonth) {
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dayOfMonth)
  if (thisMonth < today) {
    const next = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth)
    return Math.round((next - today) / 86400000)
  }
  return Math.round((thisMonth - today) / 86400000)
}

function urgencyBadge(days) {
  if (days < 0)   return { label: 'Vencida',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  dot: '🔴' }
  if (days === 0) return { label: 'Hoje!',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  dot: '🔴' }
  if (days <= 3)  return { label: `${days}d`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', dot: '🟡' }
  if (days <= 7)  return { label: `${days}d`, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', dot: '🟡' }
  return                 { label: `${days}d`, color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', dot: '🟢' }
}

function CurrencyInput({ value, onChange }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ position: 'absolute', left: 10, fontSize: 14, fontWeight: 700, color: '#10b981', pointerEvents: 'none' }}>R$</span>
      <input
        type="number" min="0" step="0.01"
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => onChange(e.target.value)}
        style={{
          background: focused ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${focused ? '#10b981' : 'var(--border)'}`,
          borderRadius: 10, padding: '8px 12px 8px 36px', color: 'var(--text-primary)',
          fontSize: 18, fontWeight: 800, width: 180, outline: 'none', transition: 'all 0.2s',
        }}
      />
    </div>
  )
}

// ─── Fatura Card ──────────────────────────────────────────────────────────────
function FaturaCard({ card, expenses, people, saldoAntes, onPagar }) {
  const itens = expenses.filter(e => e.card_id === card.id && e.status !== 'pago')
  const total = itens.reduce((s, e) => s + e.valor, 0)
  const days = getDaysUntil(card.dia_vencimento)
  const urg = urgencyBadge(days)
  const pago = total === 0
  const saldoDepois = saldoAntes - total

  const byPessoa = {}
  itens.forEach(e => {
    const pid = e.pago_por || e.participantes?.[0]
    if (pid) byPessoa[pid] = (byPessoa[pid] || 0) + e.valor
  })

  return (
    <div style={{
      borderRadius: 16, border: `1px solid ${pago ? 'rgba(16,185,129,0.25)' : urg.border}`,
      background: pago ? 'rgba(16,185,129,0.04)' : 'var(--bg-card)',
      overflow: 'hidden', opacity: pago ? 0.7 : 1,
    }}>
      <div style={{ height: 3, background: pago ? '#10b981' : urg.color }} />
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: `linear-gradient(135deg, ${card.cor}, ${card.cor}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCardIcon style={{ width: 22, height: 22, color: 'white' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{card.nome}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{card.bandeira}</span>
              {!pago && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: urg.bg, color: urg.color, border: `1px solid ${urg.border}` }}>{urg.dot} Vence dia {card.dia_vencimento} · {urg.label}</span>}
              {pago  && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>✓ Zerada</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Fecha dia {card.dia_fechamento} · Limite {formatCurrency(card.limite)} · {itens.length} transações</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: pago ? '#10b981' : 'var(--text-primary)' }}>{formatCurrency(total)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>fatura aberta</div>
          </div>
        </div>

        {!pago && Object.keys(byPessoa).length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {Object.entries(byPessoa).map(([pid, val]) => {
              const p = people.find(x => x.id === pid)
              if (!p) return null
              return (
                <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: `${p.cor || '#6366f1'}14`, border: `1px solid ${p.cor || '#6366f1'}30` }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: p.cor || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white', flexShrink: 0 }}>{p.nome[0]}</div>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{p.nome.split(' ')[0]}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatCurrency(val)}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>({total > 0 ? ((val/total)*100).toFixed(0) : 0}%)</span>
                </div>
              )
            })}
          </div>
        )}

        {!pago && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 14, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Saldo após pagar</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: saldoDepois >= 0 ? '#10b981' : '#ef4444' }}>
                {formatCurrency(saldoDepois)}
                {saldoDepois < 0 && <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.8 }}>⚠️ insuficiente</span>}
              </div>
            </div>
            <button onClick={() => onPagar(card)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: `linear-gradient(135deg, ${card.cor}, ${card.cor}bb)`, border: `1px solid ${card.cor}`, color: 'white', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <CheckCircleIcon style={{ width: 16, height: 16 }} /> Pagar fatura
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Recorrente Row ───────────────────────────────────────────────────────────
function RecorrenteRow({ item, paga, saldoAntes, onPagar, isLast }) {
  const days = getDaysUntil(item.dia_vencimento)
  const urg = urgencyBadge(days)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 150px 130px', padding: '13px 20px', borderBottom: isLast ? 'none' : '1px solid var(--border)', alignItems: 'center', opacity: paga ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🔁</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.categoria}</div>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#8b5cf6' }}>{formatCurrency(item.valor)}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Dia {item.dia_vencimento}</div>
      <div>
        {paga
          ? <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>✓ Paga</span>
          : <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: urg.bg, color: urg.color, border: `1px solid ${urg.border}` }}>{urg.dot} {urg.label}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!paga && (
          <>
            <div style={{ fontSize: 11, color: (saldoAntes - item.valor) >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{formatCurrency(saldoAntes - item.valor)}</div>
            <button onClick={() => onPagar(item)}
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa', transition: 'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}
            >✓ Pagar</button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Previsao() {
  const { cards, expenses, people, recurring, proventos, negocios, saldoCaixa, setSaldoCaixa, pagarFaturaCartao, pagarContaRecorrente, isPagaEsseMes } = useStore()

  // Proventos já recebidos (status pago/distribuido) somam automaticamente ao
  // saldo informado em conta. Apenas proventos vinculados a um negócio entram.
  const proventosRecebidos = useMemo(() =>
    proventos.filter(p => p.negocio_id && (p.status === 'pago' || p.status === 'distribuido'))
  , [proventos])
  const totalProventosRecebidos = useMemo(() =>
    proventosRecebidos.reduce((s, p) => s + (p.valor || 0), 0)
  , [proventosRecebidos])
  const proventosPendentes = useMemo(() =>
    proventos.filter(p => p.negocio_id && p.status === 'pendente')
  , [proventos])
  const totalProventosPendentes = useMemo(() =>
    proventosPendentes.reduce((s, p) => s + (p.valor || 0), 0)
  , [proventosPendentes])

  // Saldo total considerado em todos os cálculos = saldo manual + proventos recebidos
  const saldoTotal = saldoCaixa + totalProventosRecebidos

  const cardsOrdenados = useMemo(() =>
    [...cards].sort((a, b) => getDaysUntil(a.dia_vencimento) - getDaysUntil(b.dia_vencimento))
  , [cards])

  const recOrdenadas = useMemo(() =>
    [...recurring].filter(r => r.ativo).sort((a, b) => getDaysUntil(a.dia_vencimento) - getDaysUntil(b.dia_vencimento))
  , [recurring])

  const totalFaturas = useMemo(() =>
    cards.reduce((sum, c) => sum + expenses.filter(e => e.card_id === c.id && e.status !== 'pago').reduce((s, e) => s + e.valor, 0), 0)
  , [cards, expenses])

  const totalRecPendente = useMemo(() =>
    recOrdenadas.filter(r => !isPagaEsseMes(r.id)).reduce((s, r) => s + r.valor, 0)
  , [recOrdenadas, recurring])

  const totalSaidas = totalFaturas + totalRecPendente
  const sobraProjetada = saldoTotal - totalSaidas
  const faturasPendentes = cards.filter(c => expenses.some(e => e.card_id === c.id && e.status !== 'pago')).length

  function handlePagarFatura(card) {
    const total = expenses.filter(e => e.card_id === card.id && e.status !== 'pago').reduce((s, e) => s + e.valor, 0)
    pagarFaturaCartao(card.id)
    setSaldoCaixa(saldoCaixa - total)
    toast.success(`Fatura ${card.nome} paga! ${formatCurrency(total)} debitado.`)
  }

  function handlePagarRecorrente(item) {
    pagarContaRecorrente(item.id)
    setSaldoCaixa(saldoCaixa - item.valor)
    toast.success(`${item.descricao} paga! ${formatCurrency(item.valor)} debitado.`)
  }

  const runningBalances = useMemo(() => {
    let saldo = saldoTotal
    return cardsOrdenados.map(card => {
      const fatura = expenses.filter(e => e.card_id === card.id && e.status !== 'pago').reduce((s, e) => s + e.valor, 0)
      const antes = saldo
      saldo -= fatura
      return { cardId: card.id, antes }
    })
  }, [cardsOrdenados, expenses, saldoTotal])

  const runningBalancesRec = useMemo(() => {
    let saldo = saldoTotal - totalFaturas
    return recOrdenadas.map(r => {
      const paga = isPagaEsseMes(r.id)
      const antes = saldo
      if (!paga) saldo -= r.valor
      return { id: r.id, antes }
    })
  }, [recOrdenadas, saldoTotal, totalFaturas, recurring])

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Central de Caixa" subtitle="Pagamentos, faturas e saldo projetado" />
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Painel de Caixa ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#10b981' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BanknotesIcon style={{ width: 18, height: 18, color: '#10b981' }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo total</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#10b981', lineHeight: 1.1 }}>{formatCurrency(saldoTotal)}</div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>EM CONTA</span>
                <CurrencyInput value={saldoCaixa} onChange={setSaldoCaixa} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>+ PROVENTOS</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{formatCurrency(totalProventosRecebidos)}</span>
              </div>
              {totalProventosPendentes > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-secondary)' }}>
                  <span>· pendentes</span>
                  <span>{formatCurrency(totalProventosPendentes)}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#ef4444' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Total a pagar</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#ef4444' }}>{formatCurrency(totalSaidas)}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{formatCurrency(totalFaturas)} cartões + {formatCurrency(totalRecPendente)} recorrentes</div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: `1px solid ${sobraProjetada >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: sobraProjetada >= 0 ? '#10b981' : '#ef4444' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {sobraProjetada >= 0 ? '✅ Sobra projetada' : '⚠️ Déficit'}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: sobraProjetada >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(Math.abs(sobraProjetada))}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{sobraProjetada >= 0 ? 'após pagar tudo' : 'faltam recursos'}</div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#6366f1' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Faturas abertas</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#818cf8' }}>{faturasPendentes}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>de {cards.length} cartão{cards.length !== 1 ? 'ões' : ''}</div>
          </div>
        </div>

        {/* ── Faturas dos Cartões ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <CreditCardIcon style={{ width: 20, height: 20, color: '#818cf8' }} />
            <div style={{ fontSize: 16, fontWeight: 800 }}>Faturas dos Cartões</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ordenadas por urgência de vencimento</div>
          </div>
          {cards.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)' }}>💳 Nenhum cartão cadastrado ainda.</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 14 }}>
            {cardsOrdenados.map(card => {
              const rb = runningBalances.find(r => r.cardId === card.id)
              return <FaturaCard key={card.id} card={card} expenses={expenses} people={people} saldoAntes={rb?.antes ?? saldoCaixa} onPagar={handlePagarFatura} />
            })}
          </div>
        </div>

        {/* ── Contas Recorrentes ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <ArrowPathIcon style={{ width: 20, height: 20, color: '#a78bfa' }} />
            <div style={{ fontSize: 16, fontWeight: 800 }}>Contas Recorrentes</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>mensalidades e contas fixas</div>
            {totalRecPendente > 0 && <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#8b5cf6' }}>{formatCurrency(totalRecPendente)} pendente</span>}
          </div>
          {recOrdenadas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)' }}>🔁 Nenhuma conta recorrente ativa.</div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 150px 130px', padding: '10px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                {['Conta', 'Valor', 'Vencimento', 'Status', 'Ação'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                ))}
              </div>
              {recOrdenadas.map((item, i) => {
                const paga = isPagaEsseMes(item.id)
                const rb = runningBalancesRec.find(r => r.id === item.id)
                return <RecorrenteRow key={item.id} item={item} paga={paga} saldoAntes={rb?.antes ?? saldoCaixa - totalFaturas} onPagar={handlePagarRecorrente} isLast={i === recOrdenadas.length - 1} />
              })}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)' }}>
                <span>{recOrdenadas.filter(r => isPagaEsseMes(r.id)).length} de {recOrdenadas.length} pagas este mês</span>
                <span>Total mensal: <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(recOrdenadas.reduce((s, r) => s + r.valor, 0))}</span></span>
              </div>
            </div>
          )}
        </div>

        {/* ── Waterfall Timeline ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <ArrowTrendingDownIcon style={{ width: 20, height: 20, color: '#f59e0b' }} />
            <div style={{ fontSize: 16, fontWeight: 800 }}>Impacto no Caixa</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>como cada pagamento afeta seu saldo</div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            {(() => {
              const allItems = [
                ...cardsOrdenados.map(c => ({
                  id: c.id, tipo: 'cartao', label: c.nome, cor: c.cor, dia: c.dia_vencimento,
                  valor: expenses.filter(e => e.card_id === c.id && e.status !== 'pago').reduce((s, e) => s + e.valor, 0),
                  pago: !expenses.some(e => e.card_id === c.id && e.status !== 'pago'),
                })),
                ...recOrdenadas.map(r => ({
                  id: r.id, tipo: 'recorrente', label: r.descricao, cor: '#8b5cf6',
                  dia: r.dia_vencimento, valor: r.valor, pago: isPagaEsseMes(r.id),
                })),
              ].sort((a, b) => getDaysUntil(a.dia) - getDaysUntil(b.dia))

              if (allItems.length === 0) return (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>Cadastre cartões e contas recorrentes para ver o impacto no caixa.</div>
              )

              let saldo = saldoCaixa
              const rows = allItems.map(item => {
                const antes = saldo
                if (!item.pago && item.valor > 0) saldo -= item.valor
                return { ...item, antes, depois: saldo }
              })

              return rows.map((row, i) => {
                const days = getDaysUntil(row.dia)
                const urg = urgencyBadge(days)
                return (
                  <div key={row.id + row.tipo} style={{ padding: '14px 20px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 14, opacity: row.pago ? 0.45 : 1 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: `${row.cor}18`, border: `1px solid ${row.cor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, flexDirection: 'column' }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: row.cor, lineHeight: 1.1 }}>{row.dia}</div>
                      <div style={{ fontSize: 8, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>dia</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{row.label}</span>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: row.tipo === 'cartao' ? 'rgba(99,102,241,0.1)' : 'rgba(139,92,246,0.1)', color: row.tipo === 'cartao' ? '#818cf8' : '#a78bfa' }}>
                          {row.tipo === 'cartao' ? '💳' : '🔁'}
                        </span>
                        {row.pago
                          ? <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>✓ pago</span>
                          : <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: urg.bg, color: urg.color, border: `1px solid ${urg.border}` }}>{urg.dot} {urg.label}</span>
                        }
                      </div>
                      <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${row.pago ? 100 : row.antes > 0 ? Math.max((row.depois/row.antes)*100,0) : 0}%`, background: row.pago ? '#10b981' : row.depois >= 0 ? '#6366f1' : '#ef4444', borderRadius: 3, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>− {formatCurrency(row.valor)}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: row.depois >= 0 ? '#10b981' : '#ef4444' }}>
                        {formatCurrency(row.depois)} <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 400 }}>restante</span>
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>

      </div>
    </div>
  )
}