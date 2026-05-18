import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

function fmtBRL(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(d) {
  if (!d) return '—'
  return String(d).split('-').reverse().join('/')
}
function today() {
  return new Date().toISOString().slice(0, 10)
}
function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

const STATUS_DONE = {
  pendente:   { icon: '⏳', msg: 'Pedido enviado! Aguardando aprovação do supervisor.' },
  aprovado:   { icon: '✅', msg: 'Pedido aprovado! O restaurante foi notificado.' },
  reprovado:  { icon: '❌', msg: 'Pedido reprovado. Motivo indicado abaixo.' },
  preparando: { icon: '👨‍🍳', msg: 'Restaurante preparando as refeições.' },
  entregue:   { icon: '🎉', msg: 'Pedido entregue com sucesso!' },
  fechado:    { icon: '🗂️', msg: 'Pedido fechado financeiramente.' },
}

const card = {
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: '20px 24px',
  marginBottom: 16,
}

const input = {
  width: '100%',
  background: '#0f172a',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  color: '#f1f5f9',
  padding: '10px 14px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const label = {
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  marginBottom: 6,
  display: 'block',
}

export default function RefeicaoPublica() {
  const { token } = useParams()

  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [done, setDone]           = useState(null)   // { numeroPedido, valorTotal }
  const [alreadySent, setAlready] = useState(null)   // { status, numeroPedido }

  const [sol, setSol]               = useState(null)
  const [equipe, setEquipe]         = useState(null)
  const [colaboradores, setColab]   = useState([])
  const [restaurantes, setRests]    = useState([])

  const [dataRefeicao, setData]         = useState(tomorrow())
  const [restauranteId, setRestId]      = useState('')
  const [marcacoes, setMarcacoes]       = useState({})  // { [colaboradorId]: { refeicao, cafe } }
  const [observacoes, setObs]           = useState('')
  const [extras, setExtras]             = useState([])  // [{ _id, nome, refeicao, cafe, justificativa }]
  const [saving, setSaving]             = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`/api/refeicoes?action=load&token=${token}`)
        const json = await r.json()
        if (r.status === 409) { setAlready({ status: json.status, numeroPedido: json.numeroPedido }); setLoading(false); return }
        if (!r.ok) { setError(json.error || 'Erro ao carregar'); setLoading(false); return }

        setSol(json.sol)
        setEquipe(json.equipe)
        setColab(json.colaboradores || [])
        setRests(json.restaurantes || [])

        // Restaura seleções anteriores (caso seja reenvio após reprovação)
        if (json.sol.restaurante_id) setRestId(json.sol.restaurante_id)
        if (json.sol.data_refeicao)  setData(json.sol.data_refeicao)

        // Restaura marcações anteriores
        if (json.itens?.length) {
          const m = {}
          json.itens.forEach(it => {
            if (it.colaborador_id) m[it.colaborador_id] = { refeicao: !!it.refeicao, cafe: !!it.cafe }
          })
          setMarcacoes(m)
        }
      } catch (e) {
        setError('Erro de conexão. Tente novamente.')
      }
      setLoading(false)
    }
    load()
  }, [token])

  const restauranteSel = restaurantes.find(r => r.id === restauranteId)

  const totais = useMemo(() => {
    const vRef  = Number(restauranteSel?.valor_refeicao || 0)
    const vCafe = Number(restauranteSel?.valor_cafe || 0)
    let qtdRef = 0, qtdCafe = 0
    colaboradores.forEach(c => {
      const m = marcacoes[c.id] || {}
      if (m.refeicao) qtdRef++
      if (m.cafe)     qtdCafe++
    })
    extras.forEach(e => {
      if (e.refeicao) qtdRef++
      if (e.cafe)     qtdCafe++
    })
    return {
      qtdRef, qtdCafe, vRef, vCafe,
      totalRef:  qtdRef  * vRef,
      totalCafe: qtdCafe * vCafe,
      total:     (qtdRef * vRef) + (qtdCafe * vCafe),
    }
  }, [marcacoes, restauranteSel, colaboradores, extras])

  function toggleMarca(colaboradorId, tipo) {
    setMarcacoes(prev => {
      const atual = prev[colaboradorId] || {}
      return { ...prev, [colaboradorId]: { ...atual, [tipo]: !atual[tipo] }  }
    })
  }

  function marcarTodos(tipo) {
    const todos = colaboradores.every(c => marcacoes[c.id]?.[tipo])
    setMarcacoes(prev => {
      const next = { ...prev }
      colaboradores.forEach(c => { next[c.id] = { ...(next[c.id] || {}), [tipo]: !todos } })
      return next
    })
  }

  function addExtra() {
    setExtras(p => [...p, { _id: Date.now(), nome: '', refeicao: true, cafe: false, justificativa: '' }])
  }
  function removeExtra(id) {
    setExtras(p => p.filter(e => e._id !== id))
  }
  function updateExtra(id, field, value) {
    setExtras(p => p.map(e => e._id === id ? { ...e, [field]: value } : e))
  }
  function toggleExtra(id, field) {
    setExtras(p => p.map(e => e._id === id ? { ...e, [field]: !e[field] } : e))
  }

  async function handleSubmit() {
    if (!restauranteId) { toast.error('Selecione o restaurante'); return }
    if (!dataRefeicao)  { toast.error('Selecione a data'); return }
    const colabPayload = colaboradores.map(c => ({
      colaboradorId:   c.id,
      colaboradorNome: c.nome,
      refeicao:        !!(marcacoes[c.id]?.refeicao),
      cafe:            !!(marcacoes[c.id]?.cafe),
      extra:           false,
    }))
    const extrasValidos = extras.filter(e => e.nome.trim() && (e.refeicao || e.cafe))
    const extrasSemJust = extrasValidos.filter(e => !e.justificativa.trim())
    if (extrasSemJust.length > 0) {
      toast.error('Justificativa obrigatória para todos os extras')
      return
    }
    const extrasPayload = extrasValidos.map(e => ({
      colaboradorNome: e.nome.trim(),
      refeicao:        e.refeicao,
      cafe:            e.cafe,
      extra:           true,
      justificativa:   e.justificativa.trim(),
    }))
    const itensPayload = [...colabPayload, ...extrasPayload]
    if (!itensPayload.some(i => i.refeicao || i.cafe)) {
      toast.error('Marque pelo menos um item para algum colaborador')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/refeicoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', token, dataRefeicao, restauranteId, itens: itensPayload, observacoes }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || 'Erro ao enviar')
      setDone(json)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Telas de estado ──────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ ...card, textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
        <div style={{ color: '#f87171', fontWeight: 700, fontSize: 16 }}>{error}</div>
      </div>
    </div>
  )

  if (alreadySent) {
    const st = STATUS_DONE[alreadySent.status] || { icon: 'ℹ️', msg: 'Pedido em processamento.' }
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ ...card, textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{st.icon}</div>
          {alreadySent.numeroPedido && <div style={{ color: '#818cf8', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{alreadySent.numeroPedido}</div>}
          <div style={{ color: '#e2e8f0', fontSize: 15 }}>{st.msg}</div>
        </div>
      </div>
    )
  }

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ ...card, textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <div style={{ color: '#818cf8', fontWeight: 800, fontSize: 22, marginBottom: 8 }}>{done.numeroPedido}</div>
        <div style={{ color: '#e2e8f0', fontSize: 15, marginBottom: 16 }}>Pedido enviado com sucesso!</div>
        <div style={{ color: '#94a3b8', fontSize: 13 }}>
          Total: <strong style={{ color: '#34d399' }}>{fmtBRL(done.valorTotal)}</strong>
        </div>
        <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>Aguardando aprovação do supervisor.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'Inter,system-ui,sans-serif' }}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 14 } }} />

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', padding: '20px 24px 16px' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>🍽️ Solicitação de Refeição</div>
          {equipe && (
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              {equipe.nome}{equipe.cdc ? ` · CDC ${equipe.cdc}` : ''}{equipe.lider_nome ? ` · Líder: ${equipe.lider_nome}` : ''}
            </div>
          )}
          {sol?.status === 'reprovado' && (
            <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#fca5a5' }}>
              ❌ Pedido anterior reprovado{sol.motivo_reprovacao ? `: ${sol.motivo_reprovacao}` : ''}. Corrija e reenvie.
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* Data + Restaurante */}
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <span style={label}>Data do Pedido</span>
              <input type="date" value={dataRefeicao} onChange={e => setData(e.target.value)} style={input} />
            </div>
            <div>
              <span style={label}>Restaurante</span>
              <select value={restauranteId} onChange={e => setRestId(e.target.value)} style={input}>
                <option value="">Selecione...</option>
                {restaurantes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          </div>
          {restauranteSel && (
            <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: 13, color: '#94a3b8', flexWrap: 'wrap' }}>
              {restauranteSel.numero_pedido && <span>📋 Pedido: <strong style={{ color: '#e2e8f0' }}>{restauranteSel.numero_pedido}</strong></span>}
              <span>🍽️ {fmtBRL(restauranteSel.valor_refeicao)}/ref</span>
              <span>☕ {fmtBRL(restauranteSel.valor_cafe)}/café</span>
            </div>
          )}
        </div>

        {/* Colaboradores */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>👥 Colaboradores <span style={{ color: '#64748b', fontWeight: 400 }}>({colaboradores.length})</span></span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => marcarTodos('refeicao')} style={{ fontSize: 11, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
                🍽️ Todos
              </button>
              <button onClick={() => marcarTodos('cafe')} style={{ fontSize: 11, background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
                ☕ Todos
              </button>
            </div>
          </div>

          {colaboradores.length === 0 && (
            <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Nenhum colaborador cadastrado nesta equipe.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {colaboradores.map(c => {
              const m = marcacoes[c.id] || {}
              const algum = m.refeicao || m.cafe
              return (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 10,
                  background: algum ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${algum ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 0.15s',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nome}</div>
                    {c.cargo && <div style={{ fontSize: 11, color: '#64748b' }}>{c.cargo}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => toggleMarca(c.id, 'refeicao')}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: m.refeicao ? '#6366f1' : 'rgba(255,255,255,0.07)',
                        color: m.refeicao ? '#fff' : '#94a3b8',
                        transition: 'all 0.15s',
                      }}
                    >🍽️</button>
                    <button
                      onClick={() => toggleMarca(c.id, 'cafe')}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
                        background: m.cafe ? '#f59e0b' : 'rgba(255,255,255,0.07)',
                        color: m.cafe ? '#fff' : '#94a3b8',
                        transition: 'all 0.15s',
                      }}
                    >☕</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Observações */}
        <div style={card}>
          <span style={label}>Observações (opcional)</span>
          <textarea
            value={observacoes}
            onChange={e => setObs(e.target.value)}
            placeholder="Ex: João não virá amanhã, substituir por..."
            rows={2}
            style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {/* Extras */}
        <div style={{ ...card, border: extras.length > 0 ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: extras.length > 0 ? 14 : 0 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>⚠️ Pedidos Extras <span style={{ color: '#64748b', fontWeight: 400, fontSize: 12 }}>(com justificativa obrigatória)</span></span>
            <button
              onClick={addExtra}
              style={{ fontSize: 12, background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 700 }}
            >+ Adicionar</button>
          </div>
          {extras.map(e => (
            <div key={e._id} style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input
                  placeholder="Nome da pessoa *"
                  value={e.nome}
                  onChange={ev => updateExtra(e._id, 'nome', ev.target.value)}
                  style={{ ...input, flex: 1, fontSize: 13 }}
                />
                <button
                  onClick={() => toggleExtra(e._id, 'refeicao')}
                  style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: e.refeicao ? '#6366f1' : 'rgba(255,255,255,0.07)', color: e.refeicao ? '#fff' : '#94a3b8', whiteSpace: 'nowrap' }}
                >🍽️</button>
                <button
                  onClick={() => toggleExtra(e._id, 'cafe')}
                  style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: e.cafe ? '#f59e0b' : 'rgba(255,255,255,0.07)', color: e.cafe ? '#fff' : '#94a3b8', whiteSpace: 'nowrap' }}
                >☕</button>
                <button onClick={() => removeExtra(e._id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ position: 'relative' }}>
                <textarea
                  placeholder="Justificativa obrigatória (ex: Técnico externo, visitante, substituição...)"
                  value={e.justificativa}
                  onChange={ev => updateExtra(e._id, 'justificativa', ev.target.value)}
                  rows={2}
                  style={{ ...input, resize: 'vertical', fontFamily: 'inherit', fontSize: 13, borderColor: e.justificativa.trim() ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)' }}
                />
                {!e.justificativa.trim() && <span style={{ position: 'absolute', top: 6, right: 10, fontSize: 10, color: '#f87171', fontWeight: 700 }}>OBRIGATÓRIO</span>}
              </div>
            </div>
          ))}
          {extras.length === 0 && (
            <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', padding: '8px 0' }}>Nenhum extra adicionado. Use para visitantes, substituições ou pessoas fora do quadro.</div>
          )}
        </div>

        {/* Totais */}
        {(totais.qtdRef > 0 || totais.qtdCafe > 0) && (
          <div style={{ ...card, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#818cf8', marginBottom: 10 }}>📊 RESUMO DO PEDIDO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              {totais.qtdRef  > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>🍽️ {totais.qtdRef} refeição(ões)</span><span>{fmtBRL(totais.totalRef)}</span></div>}
              {totais.qtdCafe > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>☕ {totais.qtdCafe} café(s)</span><span>{fmtBRL(totais.totalCafe)}</span></div>}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
                <span>Total</span>
                <span style={{ color: '#34d399' }}>{fmtBRL(totais.total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botão fixo no rodapé */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? '#334155' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff', fontWeight: 800, fontSize: 16, transition: 'all 0.2s',
            }}
          >
            {saving ? '⏳ Enviando...' : '🚀 Enviar Pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}
