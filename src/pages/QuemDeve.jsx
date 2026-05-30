import { useMemo, useState } from 'react'
import Header from '../components/Header'
import Avatar from '../components/Avatar'
import useStore from '../store/useStore'
import { formatCurrency, getCategoryIcon } from '../lib/utils'
import { CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, LightBulbIcon } from '@heroicons/react/24/outline'

function SplitInsights({ expenses, people }) {
  // Para cada par (pagador, categoria), calcula quem paga mais
  const pagadorPorCategoria = useMemo(() => {
    const map = {}
    expenses.filter(e => e.pago_por && e.participantes?.length > 1).forEach(e => {
      const cat = e.categoria || 'Outros'
      if (!map[cat]) map[cat] = {}
      map[cat][e.pago_por] = (map[cat][e.pago_por] || 0) + (parseFloat(e.valor) || 0)
    })
    return Object.entries(map).map(([cat, pagadores]) => {
      const [topId, topVal] = Object.entries(pagadores).sort((a, b) => b[1] - a[1])[0]
      const total = Object.values(pagadores).reduce((s, v) => s + v, 0)
      const pct = Math.round((topVal / total) * 100)
      const pessoa = people.find(p => p.id === topId)
      return { cat, pessoa, pct, total }
    }).filter(r => r.pct > 60 && r.total > 0).sort((a, b) => b.total - a.total).slice(0, 4)
  }, [expenses, people])

  if (pagadorPorCategoria.length === 0) return null

  return (
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <LightBulbIcon style={{ width: 18, height: 18, color: '#f59e0b' }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Split Inteligente</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Quem costuma pagar em cada categoria (baseado no histórico)</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {pagadorPorCategoria.map(({ cat, pessoa, pct, total }) => (
          <div key={cat} style={{ padding: 12, background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{getCategoryIcon(cat)}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{cat}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: pessoa?.cor || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {pessoa?.avatar || pessoa?.nome?.[0] || '?'}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{pessoa?.apelido || pessoa?.nome || 'Desconhecido'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>paga {pct}% das vezes</div>
              </div>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--border)' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#ef4444' : '#f59e0b', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{formatCurrency(total)} histórico</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function QuemDeve() {
  const { expenses, people, groups, getDebitos, settleDebt, getOwner, getDevedoresParaOwner } = useStore()
  const [expandedPair, setExpandedPair] = useState(null)
  const [expandedDev, setExpandedDev] = useState(null)

  const owner = getOwner()
  const debitos = useMemo(() => getDebitos(), [expenses])
  const devedoresOwner = useMemo(() => getDevedoresParaOwner(), [expenses, owner?.id])
  const totalParaOwner = Object.values(devedoresOwner).reduce((s, d) => s + d.total, 0)
  const devOrdenados = Object.entries(devedoresOwner).sort(([, a], [, b]) => b.total - a.total)

  function getExpensesForPair(de, para) {
    return expenses.filter(exp => {
      if (exp.status === 'pago') return false
      return exp.pago_por === para && exp.participantes?.includes(de)
    })
  }

  const totalPendente = debitos.reduce((s, d) => s + d.valor, 0)

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Quem deve a quem" subtitle="Saldos pendentes entre pessoas" />

      <div style={{ padding: '24px 28px' }}>
        {/* ── Painel Owner: Quem deve para Camila ─────────────────────────── */}
        {owner && (
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24, border: `1px solid ${owner.cor}33` }}>
            <div style={{ background: `linear-gradient(135deg, ${owner.cor}22, ${owner.cor}08)`, padding: '20px 24px', borderBottom: `1px solid ${owner.cor}22` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: owner.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, color: 'white', border: '2px solid rgba(255,255,255,0.15)' }}>
                  {owner.avatar || owner.nome[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Central de acerto — dona do sistema</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>Quem deve para {owner.nome}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total a receber</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{formatCurrency(totalParaOwner)}</div>
                </div>
              </div>
            </div>

            {devOrdenados.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>✨</div>
                <div style={{ fontSize: 14 }}>Ninguém deve nada para {owner.apelido || owner.nome} no momento.</div>
              </div>
            ) : (
              <div>
                {devOrdenados.map(([pid, dev]) => {
                  const p = people.find(x => x.id === pid)
                  const isOpen = expandedDev === pid
                  return (
                    <div key={pid} style={{ borderBottom: '1px solid var(--border)' }}>
                      <div
                        onClick={() => setExpandedDev(isOpen ? null : pid)}
                        style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: p?.cor || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'white' }}>
                          {p?.avatar || p?.nome?.[0] || '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{p?.nome || 'Desconhecido'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {dev.despesas.length} {dev.despesas.length === 1 ? 'despesa' : 'despesas'} pendente{dev.despesas.length === 1 ? '' : 's'}
                          </div>
                        </div>
                        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '6px 14px', fontWeight: 800, fontSize: 16, color: '#ef4444' }}>
                          {formatCurrency(dev.total)}
                        </div>
                        <button
                          className="btn-success"
                          style={{ fontSize: 12, padding: '7px 12px' }}
                          onClick={e => { e.stopPropagation(); settleDebt(pid, owner.id) }}
                        >
                          <CheckCircleIcon style={{ width: 14, height: 14 }} />
                          Pago
                        </button>
                        {isOpen
                          ? <ChevronUpIcon style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} />
                          : <ChevronDownIcon style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} />}
                      </div>
                      {isOpen && (
                        <div style={{ background: 'rgba(0,0,0,0.18)', borderTop: '1px solid var(--bg-secondary)' }}>
                          {/* Resumo por veículo (se houver despesas com placa) */}
                          {(() => {
                            const porVeic = {}
                            for (const exp of dev.despesas) {
                              if (!exp._veiculo) continue
                              porVeic[exp._veiculo] = porVeic[exp._veiculo] || { total: 0, qtd: 0 }
                              porVeic[exp._veiculo].total += exp._share
                              porVeic[exp._veiculo].qtd += 1
                            }
                            const placas = Object.entries(porVeic)
                            if (placas.length === 0) return null
                            return (
                              <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--bg-secondary)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 }}>Por veículo:</span>
                                {placas.map(([placa, agg]) => (
                                  <div key={placa} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 8 }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#c084fc', letterSpacing: 0.5 }}>🚗 {placa}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>· {agg.qtd}×</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{formatCurrency(agg.total)}</span>
                                  </div>
                                ))}
                              </div>
                            )
                          })()}
                          <div style={{ padding: '10px 24px 6px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Composição da dívida
                          </div>
                          {dev.despesas.map(exp => (
                            <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 24px', borderBottom: '1px solid var(--bg-secondary)' }}>
                              <span style={{ fontSize: 18 }}>{getCategoryIcon(exp.categoria)}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>
                                  {exp.descricao}
                                  {exp._veiculo && (
                                    <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'rgba(168,85,247,0.15)', color: '#c084fc', fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5 }}>
                                      🚗 {exp._veiculo}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  {exp.data}
                                  {exp.tipo_divisao === 'igual' && ` · dividida entre ${exp.participantes?.length || 1}`}
                                  {exp.tipo_divisao === 'valor_fixo' && ` · valor manual`}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total: {formatCurrency(exp.valor)}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>Parte: {formatCurrency(exp._share)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          <div className="stat-card">
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #ef4444, #f97316)', borderRadius: '16px 16px 0 0' }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Total em aberto</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>{formatCurrency(totalPendente)}</div>
          </div>
          <div className="stat-card">
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #f59e0b, #eab308)', borderRadius: '16px 16px 0 0' }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Pendências</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{debitos.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>entre {people.length} pessoas</div>
          </div>
          <div className="stat-card">
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '16px 16px 0 0' }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Média por pendência</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{formatCurrency(debitos.length ? totalPendente / debitos.length : 0)}</div>
          </div>
        </div>

        {debitos.length === 0 ? (
          <div className="card" style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Tudo zerado!</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Nenhuma pendência entre as pessoas do grupo.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {debitos.map((d, i) => {
              const dePerson = people.find(p => p.id === d.de)
              const paraPerson = people.find(p => p.id === d.para)
              const key = `${d.de}→${d.para}`
              const isOpen = expandedPair === key
              const pairExpenses = getExpensesForPair(d.de, d.para)

              return (
                <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Main row */}
                  <div
                    style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                    onClick={() => setExpandedPair(isOpen ? null : key)}
                  >
                    {/* Avatar de */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: dePerson?.cor || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: 'white', border: '2px solid rgba(255,255,255,0.1)' }}>
                        {dePerson?.avatar}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{dePerson?.nome}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>deve para</div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ borderTop: '2px dashed rgba(99,102,241,0.4)', flex: 1, margin: '0 12px' }} />
                      <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '6px 16px', fontWeight: 800, fontSize: 18, color: '#ef4444', whiteSpace: 'nowrap' }}>
                        {formatCurrency(d.valor)}
                      </div>
                      <div style={{ borderTop: '2px dashed rgba(99,102,241,0.4)', flex: 1, margin: '0 12px' }} />
                    </div>

                    {/* Avatar para */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, textAlign: 'right' }}>{paraPerson?.nome}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>a receber</div>
                      </div>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: paraPerson?.cor || '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: 'white', border: '2px solid rgba(255,255,255,0.1)' }}>
                        {paraPerson?.avatar}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                      <button
                        className="btn-success"
                        style={{ fontSize: 13, padding: '8px 14px' }}
                        onClick={e => { e.stopPropagation(); settleDebt(d.de, d.para) }}
                      >
                        <CheckCircleIcon style={{ width: 15, height: 15 }} />
                        Acertado via Pix
                      </button>
                      {isOpen
                        ? <ChevronUpIcon style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} />
                        : <ChevronDownIcon style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
                      <div style={{ padding: '12px 24px 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Despesas que geram esse débito
                      </div>
                      {pairExpenses.map(exp => {
                        const grupo = groups.find(g => g.id === exp.grupo_id)
                        // Calcula a "parte" do devedor (d.de) nesta despesa
                        // respeitando o tipo_divisao escolhido na importação.
                        const valorParcela = exp.valor / (exp.parcelas || 1)
                        const np = exp.participantes?.length || 1
                        let share
                        if (exp.tipo_divisao === 'valor_fixo' && exp.valores_fixos) {
                          share = exp.valores_fixos[d.de] || 0
                        } else if (exp.tipo_divisao === 'porcentagem' && exp.porcentagens) {
                          share = (valorParcela * (exp.porcentagens[d.de] || 0)) / 100
                        } else {
                          // 'igual' ou fallback
                          share = valorParcela / np
                        }
                        return (
                          <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', borderBottom: '1px solid var(--bg-secondary)' }}>
                            <span style={{ fontSize: 18 }}>{getCategoryIcon(exp.categoria)}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{exp.descricao}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                {exp.data} {grupo && `· ${grupo.icone} ${grupo.nome}`}
                                {exp.parcelas > 1 && ` · ${exp.parcela_atual}/${exp.parcelas}x`}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total: {formatCurrency(exp.valor)}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>Sua parte: {formatCurrency(share)}</div>
                            </div>
                          </div>
                        )
                      })}
                      {pairExpenses.length === 0 && (
                        <div style={{ padding: '12px 24px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>Cálculo de saldo líquido entre os dois.</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
