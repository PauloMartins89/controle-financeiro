import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { ArrowPathIcon, TagIcon, ChartBarIcon } from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ComprasRelCategoria() {
  const [data,    setData]    = useState([])
  const [itens,   setItens]   = useState([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('12')

  const load = useCallback(async () => {
    setLoading(true)
    const desde = new Date()
    desde.setMonth(desde.getMonth() - parseInt(periodo))

    const [{ data: sols }, { data: its }] = await Promise.all([
      supabase.from('solicitacoes_compra')
        .select('id,titulo,valor_aprovado,valor_estimado,status,created_at')
        .gte('created_at', desde.toISOString())
        .in('status', ['aprovado','pedido_emitido','recebido','pago']),
      supabase.from('itens_solicitacao_compra')
        .select('descricao,valor_total,quantidade,solicitacao_id'),
    ])
    setData(sols || [])
    setItens(its || [])
    setLoading(false)
  }, [periodo])

  useEffect(() => { load() }, [load])

  // Agrupa por palavra-chave do título das solicitações
  // Como não há campo "categoria", usamos agrupamentos por título aproximado
  // Ou podemos derivar das primeiras palavras do título
  function extrairCategoria(titulo) {
    if (!titulo) return 'Outros'
    const t = titulo.toLowerCase()
    if (t.includes('lubrif') || t.includes('óleo') || t.includes('filtro')) return 'Lubrificantes / Filtros'
    if (t.includes('pneu') || t.includes('borracha')) return 'Pneus / Borracha'
    if (t.includes('eletric') || t.includes('lâmpada') || t.includes('fio') || t.includes('cabo')) return 'Elétrica'
    if (t.includes('epi') || t.includes('segurança') || t.includes('capacete') || t.includes('bota')) return 'EPI / Segurança'
    if (t.includes('ferramenta') || t.includes('broca') || t.includes('disco')) return 'Ferramentas'
    if (t.includes('papel') || t.includes('caneta') || t.includes('escritório')) return 'Escritório'
    if (t.includes('limpeza') || t.includes('detergente') || t.includes('sabão')) return 'Limpeza'
    if (t.includes('informática') || t.includes('computador') || t.includes('mouse') || t.includes('teclado')) return 'TI / Informática'
    if (t.includes('serviço') || t.includes('manutenção') || t.includes('reparo')) return 'Serviços / Manutenção'
    if (t.includes('aliment') || t.includes('café') || t.includes('água') || t.includes('refei')) return 'Alimentação'
    return 'Outros'
  }

  // Agrega por categoria
  const porCategoria = {}
  data.forEach(sol => {
    const cat = extrairCategoria(sol.titulo)
    if (!porCategoria[cat]) porCategoria[cat] = { total: 0, count: 0, estimado: 0 }
    porCategoria[cat].count++
    porCategoria[cat].total    += sol.valor_aprovado || sol.valor_estimado || 0
    porCategoria[cat].estimado += sol.valor_estimado || 0
  })

  const categorias = Object.entries(porCategoria)
    .map(([cat, vals]) => ({ cat, ...vals }))
    .sort((a, b) => b.total - a.total)

  const totalGeral = categorias.reduce((a, c) => a + c.total, 0)

  const CORES = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ef4444','#f97316','#64748b','#ec4899','#14b8a6']

  const PERIODOS = [
    { key: '1', label: 'Último mês' },
    { key: '3', label: '3 meses' },
    { key: '6', label: '6 meses' },
    { key: '12', label: '12 meses' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        icon={ChartBarIcon} iconColor="#3b82f6"
        title="Relatório por Categoria"
        subtitle="Distribuição de gastos por tipo de compra"
        badges={[
          categorias.length > 0 && { label: `${categorias.length} categorias`, color: '#64748b' },
          totalGeral > 0 && { label: fmtCurrency(totalGeral), color: '#10b981', primary: true },
        ].filter(Boolean)}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        <div style={{ display: 'flex', gap: 8, marginBottom: 22, alignItems: 'center' }}>
          {PERIODOS.map(p => (
            <button key={p.key} onClick={() => setPeriodo(p.key)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: periodo === p.key ? '#6366f1' : 'var(--border)', background: periodo === p.key ? 'rgba(99,102,241,0.10)' : 'var(--bg-secondary)', color: periodo === p.key ? '#818cf8' : 'var(--text-secondary)' }}>
              {p.label}
            </button>
          ))}
          <button onClick={load} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <ArrowPathIcon style={{ width: 28, height: 28, color: '#6366f1', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : categorias.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <TagIcon style={{ width: 48, height: 48, margin: '0 auto 14px', opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 700 }}>Nenhum dado no período</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* Barras horizontais */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '22px 24px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>Gasto por Categoria</div>
              {categorias.map((c, i) => {
                const pct = totalGeral > 0 ? (c.total / totalGeral) * 100 : 0
                const cor = CORES[i % CORES.length]
                return (
                  <div key={c.cat} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: cor, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{c.cat}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{c.count} req.</span>
                        <span style={{ fontWeight: 800, color: cor }}>{fmtCurrency(c.total)}</span>
                      </div>
                    </div>
                    <div style={{ height: 8, borderRadius: 8, background: 'var(--border)' }}>
                      <div style={{ height: '100%', borderRadius: 8, width: `${pct}%`, background: cor, transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, textAlign: 'right' }}>{pct.toFixed(1)}% do total</div>
                  </div>
                )
              })}
            </div>

            {/* Tabela detalhada */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '22px 24px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>Detalhamento</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Categoria', 'Qtd. Req.', 'Total', '% do gasto'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: h === 'Categoria' ? 'left' : 'right', borderBottom: '2px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((c, i) => {
                    const pct = totalGeral > 0 ? ((c.total / totalGeral) * 100).toFixed(1) : '0'
                    const cor = CORES[i % CORES.length]
                    return (
                      <tr key={c.cat} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{c.cat}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>{c.count}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: cor }}>{fmtCurrency(c.total)}</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>{pct}%</td>
                      </tr>
                    )
                  })}
                  <tr>
                    <td colSpan={2} style={{ padding: '12px 10px', fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', borderTop: '2px solid var(--border)' }}>TOTAL</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontSize: 14, fontWeight: 900, color: '#6366f1', borderTop: '2px solid var(--border)' }}>{fmtCurrency(totalGeral)}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)', borderTop: '2px solid var(--border)' }}>100%</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: 16, padding: '10px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Categorias detectadas automaticamente pelo título da solicitação. Para categorias personalizadas, acesse <strong>Cadastros → Categorias</strong>.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
