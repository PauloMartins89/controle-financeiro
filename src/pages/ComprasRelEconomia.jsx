import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import { ArrowPathIcon, BanknotesIcon, TrophyIcon } from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function ComprasRelEconomia() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('12') // meses

  const load = useCallback(async () => {
    setLoading(true)
    const desde = new Date()
    desde.setMonth(desde.getMonth() - parseInt(periodo))
    const { data: rows } = await supabase
      .from('solicitacoes_compra')
      .select('id,titulo,status,tipo,valor_estimado,valor_aprovado,economia,fornecedor,fornecedor_vencedor,data_aprovacao,created_at')
      .gte('created_at', desde.toISOString())
      .in('status', ['aprovado','pedido_emitido','recebido','pago','leilao_aberto','leilao_encerrado'])
      .order('created_at', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }, [periodo])

  useEffect(() => { load() }, [load])

  const comValores    = data.filter(s => s.valor_estimado && s.valor_aprovado)
  const totalEstimado = comValores.reduce((a, s) => a + (s.valor_estimado || 0), 0)
  const totalAprovado = comValores.reduce((a, s) => a + (s.valor_aprovado  || 0), 0)
  const totalEconomia = comValores.reduce((a, s) => a + Math.max(0, (s.valor_estimado || 0) - (s.valor_aprovado || 0)), 0)
  const pctEconomia   = totalEstimado > 0 ? ((totalEconomia / totalEstimado) * 100).toFixed(1) : '0'

  const deLeilao  = comValores.filter(s => s.tipo === 'leilao')
  const ecoLeilao = deLeilao.reduce((a, s) => a + Math.max(0, (s.valor_estimado || 0) - (s.valor_aprovado || 0)), 0)

  // Top savings por solicitação
  const topSavings = comValores
    .map(s => ({ ...s, saving: Math.max(0, (s.valor_estimado || 0) - (s.valor_aprovado || 0)) }))
    .filter(s => s.saving > 0)
    .sort((a, b) => b.saving - a.saving)
    .slice(0, 10)

  const PERIODOS = [
    { key: '1', label: 'Último mês' },
    { key: '3', label: '3 meses' },
    { key: '6', label: '6 meses' },
    { key: '12', label: '12 meses' },
    { key: '24', label: '2 anos' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="Economia / Savings" subtitle="Comparativo entre orçamento e valor aprovado" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* Filtro de período */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 22, alignItems: 'center' }}>
          {PERIODOS.map(p => (
            <button key={p.key} onClick={() => setPeriodo(p.key)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: periodo === p.key ? '#10b981' : 'var(--border)', background: periodo === p.key ? 'rgba(16,185,129,0.10)' : 'var(--bg-secondary)', color: periodo === p.key ? '#10b981' : 'var(--text-secondary)' }}>
              {p.label}
            </button>
          ))}
          <button onClick={load} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <ArrowPathIcon style={{ width: 28, height: 28, color: '#10b981', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Orçamento inicial',  value: fmtCurrency(totalEstimado), color: '#6366f1' },
                { label: 'Valor aprovado',      value: fmtCurrency(totalAprovado), color: '#0ea5e9' },
                { label: 'Total economizado',   value: fmtCurrency(totalEconomia), color: '#10b981' },
                { label: '% economia média',    value: `${pctEconomia}%`,          color: '#10b981' },
                { label: 'Savings via leilão',  value: fmtCurrency(ecoLeilao),     color: '#8b5cf6' },
                { label: 'Solicitações analis.', value: comValores.length,         color: '#f59e0b' },
              ].map((k, i) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '16px 18px', border: '1px solid var(--border)', borderTop: `3px solid ${k.color}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Barra comparativa */}
            {totalEstimado > 0 && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '22px 24px', border: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>Orçamento × Aprovado</div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Orçamento inicial</span>
                    <span style={{ fontWeight: 800, color: '#6366f1' }}>{fmtCurrency(totalEstimado)}</span>
                  </div>
                  <div style={{ height: 14, borderRadius: 8, background: 'rgba(99,102,241,0.15)' }}>
                    <div style={{ height: '100%', borderRadius: 8, width: '100%', background: '#6366f1' }} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Valor aprovado</span>
                    <span style={{ fontWeight: 800, color: '#0ea5e9' }}>{fmtCurrency(totalAprovado)}</span>
                  </div>
                  <div style={{ height: 14, borderRadius: 8, background: 'rgba(14,165,233,0.10)' }}>
                    <div style={{ height: '100%', borderRadius: 8, width: `${Math.min(100, (totalAprovado / totalEstimado) * 100)}%`, background: '#0ea5e9', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>💚 Economia total</span>
                    <span style={{ fontWeight: 900, color: '#10b981' }}>{fmtCurrency(totalEconomia)} ({pctEconomia}%)</span>
                  </div>
                  <div style={{ height: 14, borderRadius: 8, background: 'rgba(16,185,129,0.10)' }}>
                    <div style={{ height: '100%', borderRadius: 8, width: `${Math.min(100, (totalEconomia / totalEstimado) * 100)}%`, background: '#10b981', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Top savings */}
            {topSavings.length > 0 && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '22px 24px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 18 }}>
                  <TrophyIcon style={{ width: 16, height: 16, display: 'inline', marginRight: 6, verticalAlign: 'middle', color: '#10b981' }} />
                  Top Economias Geradas
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Solicitação', 'Fornecedor', 'Orçamento', 'Aprovado', 'Economia', 'Data'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', borderBottom: '2px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topSavings.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 10px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                          {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : ''}{s.titulo}
                          {s.tipo === 'leilao' && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>leilão</span>}
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>{s.fornecedor_vencedor || s.fornecedor || '—'}</td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>{fmtCurrency(s.valor_estimado)}</td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text-primary)', fontWeight: 700 }}>{fmtCurrency(s.valor_aprovado)}</td>
                        <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 900, color: '#10b981' }}>
                          {fmtCurrency(s.saving)}
                          <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>
                            -{Math.round((s.saving / s.valor_estimado) * 100)}%
                          </div>
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>{fmtDate(s.data_aprovacao || s.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {comValores.length === 0 && (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
                <BanknotesIcon style={{ width: 48, height: 48, margin: '0 auto 14px', opacity: 0.3 }} />
                <div style={{ fontSize: 15, fontWeight: 700 }}>Nenhum dado no período selecionado</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
