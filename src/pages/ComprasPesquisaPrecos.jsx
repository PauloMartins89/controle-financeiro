import { useState, useRef } from 'react'
import {
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  ArrowTopRightOnSquareIcon,
  TagIcon,
  TruckIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  BanknotesIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const fmtBRL = v =>
  v != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    : '—'

const FONTES = [
  { key: 'todos',  label: 'Todos' },
  { key: 'ml',     label: 'Mercado Livre' },
  { key: 'google', label: 'Google Shopping' },
]

const SITE_COLORS = {
  'Mercado Livre': '#FFE600',
  'Americanas':    '#E60014',
  'Magazine Luiza':'#0086FF',
  'Shopee':        '#EE4D2D',
  'Amazon':        '#FF9900',
  'Kabum':         '#F77900',
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1px solid var(--border)', background: 'var(--bg-primary)',
  color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', outline: 'none',
}

function SiteBadge({ site }) {
  const bg = SITE_COLORS[site] ?? '#6b7280'
  const dark = ['#FFE600'].includes(bg)
  return (
    <span style={{ background: bg, color: dark ? '#111' : '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>
      {site}
    </span>
  )
}

function CardResultado({ item, menorPreco, onBenchmark }) {
  const isMenor = item.preco === menorPreco
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 16px', background: isMenor ? 'rgba(34,197,94,0.05)' : 'transparent', alignItems: 'center' }}>
      {item.imagem ? (
        <img src={item.imagem} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, flexShrink: 0, background: '#fff', border: '1px solid var(--border)' }}
          onError={e => { e.target.style.display = 'none' }} />
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--bg-primary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
          <ShoppingCartIcon style={{ width: 20, color: 'var(--text-secondary)' }} />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.titulo}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <SiteBadge site={item.site} />
          {item.condicao === 'Usado' && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>Usado</span>}
          {item.frete && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#22c55e', fontWeight: 600 }}>
              <TruckIcon style={{ width: 11 }} /> {item.frete}
            </span>
          )}
          {item.vendedor && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.vendedor}</span>}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
          {isMenor && (
            <span style={{ fontSize: 10, fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '2px 8px', borderRadius: 99 }}>
              MENOR PREÇO
            </span>
          )}
          <span style={{ fontSize: 17, fontWeight: 800, color: isMenor ? '#22c55e' : 'var(--text-primary)' }}>
            {fmtBRL(item.preco)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {onBenchmark && (
            <button onClick={() => onBenchmark(item.preco)}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, border: '1px solid #3b82f6', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', cursor: 'pointer', fontWeight: 700 }}>
              Usar preço
            </button>
          )}
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>
            Ver <ArrowTopRightOnSquareIcon style={{ width: 11 }} />
          </a>
        </div>
      </div>
    </div>
  )
}

// Componente principal — pode ser usado como página standalone
// ou como modal passando props: produto, onBenchmark, onClose
export default function ComprasPesquisaPrecos({ produto: produtoProp, onBenchmark, onClose }) {
  const [query, setQuery]         = useState(produtoProp ?? '')
  const [loading, setLoading]     = useState(false)
  const [resultado, setResultado] = useState(null)
  const [filtro, setFiltro]       = useState('todos')
  const [sort, setSort]           = useState('preco_asc')
  const inputRef = useRef(null)

  const isModal = !!onClose

  async function buscar() {
    if (!query.trim()) { toast.error('Digite o produto'); return }
    setLoading(true)
    setResultado(null)
    try {
      const { data, error } = await supabase.functions.invoke('busca-precos', {
        body: { query: query.trim() },
      })
      if (error) throw error
      setResultado(data)
      if (!data.resultados?.length) toast('Nenhum resultado. Tente um termo mais genérico.', { icon: 'ℹ️' })
    } catch (e) {
      console.error(e)
      toast.error('Erro ao buscar preços.')
    } finally {
      setLoading(false)
    }
  }

  function handleUsarBenchmark(preco) {
    if (onBenchmark) {
      onBenchmark(preco)
      toast.success(`Benchmark definido: ${fmtBRL(preco)}`)
      if (onClose) onClose()
    } else {
      navigator.clipboard?.writeText(String(preco))
      toast.success(`Preço copiado: ${fmtBRL(preco)}`)
    }
  }

  const listaFiltrada = (resultado?.resultados ?? [])
    .filter(r => filtro === 'todos' || r.fonte === filtro)
    .sort((a, b) => {
      if (sort === 'preco_desc') return b.preco - a.preco
      if (sort === 'site') return a.site.localeCompare(b.site)
      return a.preco - b.preco
    })

  // â”€â”€ Modal wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isModal) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div style={{ width: '100%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-primary)', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <TagIcon style={{ width: 22, color: '#3b82f6' }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Pesquisa de Preço</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mercado Livre + Google Shopping em tempo real</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
          </div>
          <CorpoBusca query={query} setQuery={setQuery} inputRef={inputRef} loading={loading} buscar={buscar}
            resultado={resultado} filtro={filtro} setFiltro={setFiltro} sort={sort} setSort={setSort}
            listaFiltrada={listaFiltrada} handleUsarBenchmark={handleUsarBenchmark} onBenchmark={onBenchmark} />
        </div>
      </div>
    )
  }

  // â”€â”€ Página standalone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      <Header
        title="Pesquisa de Preço"
        subtitle="Mercado Livre + Google Shopping em tempo real"
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* Cards resumo */}
        {resultado?.resumo && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Menor Preço',   value: fmtBRL(resultado.resumo.menor), color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    icon: ChevronUpIcon },
              { label: 'Média',         value: fmtBRL(resultado.resumo.media), color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   icon: BanknotesIcon },
              { label: 'Maior Preço',   value: fmtBRL(resultado.resumo.maior), color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    icon: ChevronDownIcon },
              { label: 'Total de Resultados', value: `${resultado.resultados.length} itens`, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', icon: ShoppingCartIcon },
            ].map(card => {
              const Icon = card.icon
              return (
                <div key={card.label} style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 22, height: 22, color: card.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{card.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: card.color, marginTop: 2 }}>{card.value}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Barra de busca + ações */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-secondary)' }} />
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar()}
              placeholder="Ex: papel A4 resma, parafuso 3/8, caixa papelão..."
              style={{ ...inputStyle, paddingLeft: 34 }} />
          </div>
          <button onClick={buscar} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 10, border: 'none', background: loading ? '#6b7280' : '#3b82f6', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {loading ? <ArrowPathIcon style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <MagnifyingGlassIcon style={{ width: 16, height: 16 }} />}
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
          {resultado && (
            <button onClick={() => setResultado(null)} title="Limpar"
              style={{ padding: '9px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <XCircleIcon style={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>

        {/* Resultado container */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>

          {loading ? (
            <div style={{ padding: 56, textAlign: 'center', color: 'var(--text-secondary)' }}>
              <ArrowPathIcon style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14 }}>Consultando Mercado Livre e Google Shopping...</div>
            </div>

          ) : resultado ? (
            <>
              {/* Filtros de fonte + ordenação */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 8, flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {FONTES.map(f => {
                    const count = f.key === 'todos' ? resultado.resultados.length : resultado.resultados.filter(r => r.fonte === f.key).length
                    return (
                      <button key={f.key} onClick={() => setFiltro(f.key)}
                        style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: filtro === f.key ? '#3b82f6' : 'var(--border)', background: filtro === f.key ? 'rgba(59,130,246,0.1)' : 'transparent', color: filtro === f.key ? '#3b82f6' : 'var(--text-secondary)' }}>
                        {f.label}{count > 0 ? ` (${count})` : ''}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { key: 'preco_asc',  label: 'Menor preço', icon: <ChevronUpIcon style={{ width: 12 }} /> },
                    { key: 'preco_desc', label: 'Maior preço', icon: <ChevronDownIcon style={{ width: 12 }} /> },
                    { key: 'site',       label: 'Por loja' },
                  ].map(s => (
                    <button key={s.key} onClick={() => setSort(s.key)}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', border: '1px solid', fontWeight: 600, borderColor: sort === s.key ? '#8b5cf6' : 'var(--border)', background: sort === s.key ? 'rgba(139,92,246,0.1)' : 'transparent', color: sort === s.key ? '#8b5cf6' : 'var(--text-secondary)' }}>
                      {s.icon}{s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de resultados */}
              {listaFiltrada.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                  Nenhum resultado para o filtro selecionado.
                </div>
              ) : (
                <>
                  {listaFiltrada.map((item, i) => (
                    <div key={i} style={{ borderBottom: i < listaFiltrada.length - 1 ? '1px solid var(--border)' : 'none' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <CardResultado item={item} menorPreco={resultado.resumo.menor}
                        onBenchmark={onBenchmark ? handleUsarBenchmark : null} />
                    </div>
                  ))}
                  <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    {resultado.resumo.fontes.ml} do Mercado Livre · {resultado.resumo.fontes.google} do Google Shopping
                  </div>
                </>
              )}
            </>

          ) : (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <ShoppingCartIcon style={{ width: 44, height: 44, margin: '0 auto 14px', opacity: 0.25 }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Pesquise um produto</div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Digite o nome acima e clique em Buscar para ver preços em tempo real do Mercado Livre e Google Shopping.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// â”€â”€ Corpo compartilhado entre modal e standalone (não usado na versão standalone acima) â”€â”€
function CorpoBusca({ query, setQuery, inputRef, loading, buscar, resultado, filtro, setFiltro, sort, setSort, listaFiltrada, handleUsarBenchmark, onBenchmark }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="Ex: papel A4 resma, parafuso 3/8..."
          style={{ flex: 1, padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
        <button onClick={buscar} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: loading ? '#6b7280' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 9, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}>
          <MagnifyingGlassIcon style={{ width: 16 }} />
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          <ArrowPathIcon style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14 }}>Consultando Mercado Livre e Google Shopping...</div>
        </div>
      )}

      {resultado && !loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Menor preço', value: fmtBRL(resultado.resumo.menor), color: '#22c55e' },
              { label: 'Média',       value: fmtBRL(resultado.resumo.media), color: 'var(--text-primary)' },
              { label: 'Maior preço', value: fmtBRL(resultado.resumo.maior), color: '#ef4444' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {FONTES.map(f => {
                const count = f.key === 'todos' ? resultado.resultados.length : resultado.resultados.filter(r => r.fonte === f.key).length
                return (
                  <button key={f.key} onClick={() => setFiltro(f.key)}
                    style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: filtro === f.key ? '#3b82f6' : 'var(--border)', background: filtro === f.key ? 'rgba(59,130,246,0.1)' : 'transparent', color: filtro === f.key ? '#3b82f6' : 'var(--text-secondary)' }}>
                    {f.label}{count > 0 ? ` (${count})` : ''}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { key: 'preco_asc',  label: 'Menor preço', icon: <ChevronUpIcon style={{ width: 12 }} /> },
                { key: 'preco_desc', label: 'Maior preço', icon: <ChevronDownIcon style={{ width: 12 }} /> },
                { key: 'site',       label: 'Por loja' },
              ].map(s => (
                <button key={s.key} onClick={() => setSort(s.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer', border: '1px solid', fontWeight: 600, borderColor: sort === s.key ? '#8b5cf6' : 'var(--border)', background: sort === s.key ? 'rgba(139,92,246,0.1)' : 'transparent', color: sort === s.key ? '#8b5cf6' : 'var(--text-secondary)' }}>
                  {s.icon}{s.label}
                </button>
              ))}
            </div>
          </div>
          {listaFiltrada.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)', fontSize: 14 }}>Nenhum resultado para o filtro.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {listaFiltrada.map((item, i) => (
                <CardResultado key={i} item={item} menorPreco={resultado.resumo.menor}
                  onBenchmark={onBenchmark ? handleUsarBenchmark : null} />
              ))}
            </div>
          )}
          <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
            {resultado.resumo.fontes.ml} do Mercado Livre · {resultado.resumo.fontes.google} do Google Shopping
          </div>
        </>
      )}

      {!resultado && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
          <ShoppingCartIcon style={{ width: 36, marginBottom: 10, opacity: 0.25 }} />
          <p style={{ fontSize: 14, margin: 0 }}>Digite o nome do produto e clique em Buscar.</p>
        </div>
      )}
    </>
  )
}


