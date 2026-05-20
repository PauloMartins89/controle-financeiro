import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import { ArrowPathIcon, BuildingOfficeIcon, StarIcon } from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ComprasRelFornecedor() {
  const [sols,    setSols]    = useState([])
  const [cotacoes,setCotacoes]= useState([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('12')

  const load = useCallback(async () => {
    setLoading(true)
    const desde = new Date()
    desde.setMonth(desde.getMonth() - parseInt(periodo))
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from('solicitacoes_compra')
        .select('id,titulo,fornecedor,fornecedor_vencedor,valor_aprovado,valor_estimado,economia,status,tipo,created_at,data_aprovacao')
        .gte('created_at', desde.toISOString())
        .in('status', ['aprovado','pedido_emitido','recebido','pago']),
      supabase.from('cotacoes_compra')
        .select('fornecedor_nome,fornecedor_telefone,valor_total,status,solicitacao_id'),
    ])
    setSols(s || [])
    setCotacoes(c || [])
    setLoading(false)
  }, [periodo])

  useEffect(() => { load() }, [load])

  // Agrega por fornecedor
  const porFornecedor = {}

  sols.forEach(sol => {
    const nome = sol.fornecedor_vencedor || sol.fornecedor
    if (!nome) return
    if (!porFornecedor[nome]) porFornecedor[nome] = { vitorias: 0, totalGasto: 0, economiaTrazida: 0, solicitacoes: [] }
    porFornecedor[nome].vitorias++
    porFornecedor[nome].totalGasto += sol.valor_aprovado || sol.valor_estimado || 0
    porFornecedor[nome].economiaTrazida += Math.max(0, (sol.valor_estimado || 0) - (sol.valor_aprovado || 0))
    porFornecedor[nome].solicitacoes.push(sol)
  })

  // Conta participações em leilões (cotacoes_compra)
  cotacoes.forEach(c => {
    const nome = c.fornecedor_nome
    if (!nome) return
    if (!porFornecedor[nome]) porFornecedor[nome] = { vitorias: 0, totalGasto: 0, economiaTrazida: 0, solicitacoes: [], participacoes: 0 }
    porFornecedor[nome].participacoes = (porFornecedor[nome].participacoes || 0) + 1
  })

  const fornecedores = Object.entries(porFornecedor)
    .map(([nome, vals]) => ({ nome, ...vals }))
    .sort((a, b) => b.totalGasto - a.totalGasto)

  const totalGeral = fornecedores.reduce((a, f) => a + f.totalGasto, 0)

  const PERIODOS = [
    { key: '1', label: 'Último mês' },
    { key: '3', label: '3 meses' },
    { key: '6', label: '6 meses' },
    { key: '12', label: '12 meses' },
    { key: '24', label: '2 anos' },
  ]

  function taxaConversao(forn) {
    const participacoes = forn.participacoes || forn.vitorias
    if (!participacoes) return 0
    return Math.round((forn.vitorias / participacoes) * 100)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="Relatório por Fornecedor" subtitle="Histórico, ranking e desempenho dos fornecedores" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>>

        <div style={{ display: 'flex', gap: 8, marginBottom: 22, alignItems: 'center' }}>
          {PERIODOS.map(p => (
            <button key={p.key} onClick={() => setPeriodo(p.key)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: periodo === p.key ? '#0ea5e9' : 'var(--border)', background: periodo === p.key ? 'rgba(14,165,233,0.10)' : 'var(--bg-secondary)', color: periodo === p.key ? '#0ea5e9' : 'var(--text-secondary)' }}>
              {p.label}
            </button>
          ))}
          <button onClick={load} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <ArrowPathIcon style={{ width: 28, height: 28, color: '#0ea5e9', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : fornecedores.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <BuildingOfficeIcon style={{ width: 48, height: 48, margin: '0 auto 14px', opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 700 }}>Nenhum fornecedor no período</div>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
              {[
                { label: 'Fornecedores ativos',  value: fornecedores.length,                  color: '#0ea5e9' },
                { label: 'Total comprado',        value: fmtCurrency(totalGeral),              color: '#6366f1', isText: true },
                { label: 'Maior fornecedor',      value: fornecedores[0]?.nome?.split(' ')[0] || '—', color: '#f59e0b' },
                { label: 'Maior gasto único',     value: fmtCurrency(fornecedores[0]?.totalGasto || 0), color: '#8b5cf6', isText: true },
              ].map((k, i) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)', borderTop: `3px solid ${k.color}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>{k.label}</div>
                  <div style={{ fontSize: k.isText ? 16 : 26, fontWeight: 900, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Ranking */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>
                Ranking de Fornecedores
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['#', 'Fornecedor', 'Compras', 'Total gasto', 'Economia gerada', 'Part. leilão', '% parte gasto'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: h === 'Fornecedor' || h === '#' ? 'left' : 'right', borderBottom: '2px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fornecedores.map((f, i) => {
                    const pct = totalGeral > 0 ? ((f.totalGasto / totalGeral) * 100).toFixed(1) : '0'
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}°`
                    return (
                      <tr key={f.nome} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{medal}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{f.nome}</div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>{f.vitorias}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtCurrency(f.totalGasto)}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: f.economiaTrazida > 0 ? '#10b981' : 'var(--text-secondary)' }}>
                          {f.economiaTrazida > 0 ? fmtCurrency(f.economiaTrazida) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>
                          {f.participacoes ? f.participacoes : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                            <div style={{ width: 60, height: 6, borderRadius: 6, background: 'var(--border)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: '#0ea5e9', transition: 'width 0.4s ease' }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#0ea5e9', minWidth: 32 }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
