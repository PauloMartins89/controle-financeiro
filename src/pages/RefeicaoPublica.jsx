import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { T, PageLayout, MainCard, Divider, SectionLabel, Badge, StatCard, InfoRow } from '../components/refeicao/RefeicaoUI'

function fmtBRL(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(d) {
  if (!d) return '—'
  return String(d).split('-').reverse().join('/')
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

const inputSt = {
  width: '100%',
  background: T.inputBg,
  border: `1px solid ${T.inputBorder}`,
  borderRadius: 10,
  color: T.text,
  padding: '10px 14px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
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
    <PageLayout>
      <Toaster position="top-center" />
      <MainCard maxWidth={520}>
        <div style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>Carregando...</div>
      </MainCard>
    </PageLayout>
  )

  if (error) return (
    <PageLayout>
      <Toaster position="top-center" />
      <MainCard maxWidth={520}>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Link inválido</div>
          <div style={{ color: T.textMuted, fontSize: 13 }}>{error}</div>
        </div>
      </MainCard>
    </PageLayout>
  )

  if (alreadySent) {
    const st = STATUS_DONE[alreadySent.status] || { icon: 'ℹ️', msg: 'Pedido em processamento.' }
    return (
      <PageLayout>
        <Toaster position="top-center" />
        <MainCard maxWidth={520}>
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{st.icon}</div>
            {alreadySent.numeroPedido && (
              <div style={{ color: T.indigo, fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{alreadySent.numeroPedido}</div>
            )}
            <div style={{ color: T.text, fontSize: 15, marginBottom: 24 }}>{st.msg}</div>
            <div style={{ background: T.rowBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px 18px', textAlign: 'left' }}>
              {equipe && <InfoRow label="Equipe" value={equipe.nome} />}
              <InfoRow label="Status" value={alreadySent.status} />
            </div>
          </div>
        </MainCard>
      </PageLayout>
    )
  }

  if (done) return (
    <PageLayout>
      <Toaster position="top-center" />
      <MainCard maxWidth={520}>
        <div style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ color: T.green, fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Pedido Enviado!</div>
          <div style={{ color: T.textMuted, fontSize: 13, marginBottom: 24 }}>Aguardando aprovação do supervisor.</div>
          <div style={{ background: T.rowBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px 18px', textAlign: 'left' }}>
            <InfoRow label="Pedido" value={done.numeroPedido || '—'} />
            {equipe && <InfoRow label="Equipe" value={equipe.nome} />}
            <InfoRow label="Total"  value={fmtBRL(done.valorTotal)} bold />
          </div>
        </div>
      </MainCard>
    </PageLayout>
  )

  // ── Formulário principal ─────────────────────────────────────────────────
  return (
    // height:100dvh + flex column + minHeight:0 no scroll = botão nunca sobreposta
    <div style={{ display:'flex', flexDirection:'column', height:'100dvh', background:T.pageBg, fontFamily:'Inter,system-ui,sans-serif', color:T.text }}>
      <Toaster position="top-center" toastOptions={{ style: { background: T.cardBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 14 } }} />

      {/* Área de scroll — minHeight:0 é obrigatório para overflow funcionar em flex */}
      <div style={{ flex:1, minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', overscrollBehavior:'contain' }}>
        <div style={{ maxWidth:520, margin:'0 auto', padding:'16px 12px 24px' }}>
          <div style={{ background:T.cardBg, borderRadius:20, overflow:'hidden', boxShadow:T.shadow }}>

          {/* ── Header ── */}
          <div style={{ padding: '24px 24px 16px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 14 }}>
              🍽️ Solicitação de Refeição
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: sol?.status === 'reprovado' && sol.motivo_reprovacao ? 12 : 0 }}>
              {equipe && <Badge bg='#1e3a5f' color='#93c5fd'>👥 {equipe.nome}{equipe.cdc ? ` · CDC ${equipe.cdc}` : ''}</Badge>}
              {equipe?.lider_nome && <Badge bg='#1a2e4a' color='#7dd3fc'>👤 {equipe.lider_nome}</Badge>}
              {sol?.status === 'reprovado' && <Badge bg='rgba(220,38,38,0.2)' color='#fca5a5'>❌ Reprovado</Badge>}
            </div>
            {sol?.status === 'reprovado' && sol.motivo_reprovacao && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#fca5a5', marginTop: 4 }}>
                ❌ Motivo: {sol.motivo_reprovacao}. Corrija e reenvie.
              </div>
            )}
          </div>

          <Divider />

          {/* ── Configuração ── */}
          <div style={{ padding: '20px 24px' }}>
            <SectionLabel>Configuração</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>📅 Data</div>
                <input type="date" value={dataRefeicao} onChange={e => setData(e.target.value)} style={inputSt} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, marginBottom: 6 }}>🏪 Restaurante</div>
                <select value={restauranteId} onChange={e => setRestId(e.target.value)} style={inputSt}>
                  <option value="">Selecione...</option>
                  {restaurantes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </div>
            </div>
            {restauranteSel && (
              <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: 13, color: T.textMuted, flexWrap: 'wrap' }}>
                {restauranteSel.numero_pedido && <span>📋 Pedido: <strong style={{ color: T.text }}>{restauranteSel.numero_pedido}</strong></span>}
                <span>🍽️ {fmtBRL(restauranteSel.valor_refeicao)}/ref</span>
                <span>☕ {fmtBRL(restauranteSel.valor_cafe)}/café</span>
              </div>
            )}
          </div>

          <Divider />

          {/* ── Colaboradores ── */}
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Colaboradores ({colaboradores.length})
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => marcarTodos('refeicao')} style={{ fontSize: 11, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>🍽️ Todos</button>
                <button onClick={() => marcarTodos('cafe')}    style={{ fontSize: 11, background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>☕ Todos</button>
              </div>
            </div>
            {colaboradores.length === 0 && (
              <div style={{ color: T.textDim, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Nenhum colaborador cadastrado nesta equipe.</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {colaboradores.map(c => {
                const m = marcacoes[c.id] || {}
                const algum = m.refeicao || m.cafe
                return (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 10,
                    background: algum ? 'rgba(99,102,241,0.08)' : T.rowBg,
                    border: `1px solid ${algum ? 'rgba(99,102,241,0.3)' : T.border}`,
                    transition: 'all 0.15s',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{c.nome}</div>
                      {c.cargo && <div style={{ fontSize: 11, color: T.textDim }}>{c.cargo}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => toggleMarca(c.id, 'refeicao')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: m.refeicao ? '#6366f1' : 'rgba(255,255,255,0.07)', color: m.refeicao ? '#fff' : '#94a3b8', transition: 'all 0.15s' }}>🍽️</button>
                      <button onClick={() => toggleMarca(c.id, 'cafe')}     style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: m.cafe     ? '#f59e0b' : 'rgba(255,255,255,0.07)', color: m.cafe     ? '#fff' : '#94a3b8', transition: 'all 0.15s' }}>☕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Divider />

          {/* ── Extras ── */}
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: extras.length > 0 ? 14 : 0 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚠️ Pedidos Extras</div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>Justificativa obrigatória</div>
              </div>
              <button onClick={addExtra} style={{ fontSize: 12, background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 700 }}>+ Adicionar</button>
            </div>
            {extras.map(e => (
              <div key={e._id} style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input placeholder="Nome da pessoa *" value={e.nome} onChange={ev => updateExtra(e._id, 'nome', ev.target.value)} style={{ ...inputSt, flex: 1, fontSize: 13 }} />
                  <button onClick={() => toggleExtra(e._id, 'refeicao')} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: e.refeicao ? '#6366f1' : 'rgba(255,255,255,0.07)', color: e.refeicao ? '#fff' : '#94a3b8', whiteSpace: 'nowrap' }}>🍽️</button>
                  <button onClick={() => toggleExtra(e._id, 'cafe')}    style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: e.cafe    ? '#f59e0b' : 'rgba(255,255,255,0.07)', color: e.cafe    ? '#fff' : '#94a3b8', whiteSpace: 'nowrap' }}>☕</button>
                  <button onClick={() => removeExtra(e._id)} style={{ background: 'rgba(239,68,68,0.15)', border: 'none', color: '#f87171', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <textarea
                    placeholder="Justificativa obrigatória (ex: Técnico externo, visitante, substituição...)"
                    value={e.justificativa}
                    onChange={ev => updateExtra(e._id, 'justificativa', ev.target.value)}
                    rows={2}
                    style={{ ...inputSt, resize: 'vertical', borderColor: e.justificativa.trim() ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)' }}
                  />
                  {!e.justificativa.trim() && <span style={{ position: 'absolute', top: 6, right: 10, fontSize: 10, color: '#f87171', fontWeight: 700 }}>OBRIGATÓRIO</span>}
                </div>
              </div>
            ))}
            {extras.length === 0 && (
              <div style={{ fontSize: 12, color: T.textDim, textAlign: 'center', padding: '8px 0' }}>Nenhum extra. Use para visitantes, substituições ou pessoas fora do quadro.</div>
            )}
          </div>

          <Divider />

          {/* ── Observações ── */}
          <div style={{ padding: '20px 24px' }}>
            <SectionLabel>Observações (opcional)</SectionLabel>
            <textarea
              value={observacoes}
              onChange={e => setObs(e.target.value)}
              placeholder="Ex: João não virá amanhã, substituir por..."
              rows={2}
              style={{ ...inputSt, resize: 'vertical' }}
            />
          </div>

          {/* ── Resumo (StatCards) ── */}
          {(totais.qtdRef > 0 || totais.qtdCafe > 0) && (
            <>
              <Divider />
              <div style={{ padding: '20px 24px 28px' }}>
                <SectionLabel>Resumo do Pedido</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <StatCard label="Refeições" value={totais.qtdRef}        icon="🍽️" />
                  <StatCard label="Cafés"     value={totais.qtdCafe}       icon="☕" />
                  <StatCard label="Total"     value={fmtBRL(totais.total)} icon="💰" green />
                </div>
                <div style={{ background: T.rowBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 14px' }}>
                  {totais.qtdRef  > 0 && <InfoRow label={`🍽️ ${totais.qtdRef} refeição(ões)`} value={fmtBRL(totais.totalRef)} />}
                  {totais.qtdCafe > 0 && <InfoRow label={`☕ ${totais.qtdCafe} café(s)`}      value={fmtBRL(totais.totalCafe)} />}
                  <InfoRow label="Total" value={fmtBRL(totais.total)} bold />
                </div>
              </div>
            </>
          )}

          </div>
        </div>
      </div>

      {/* Botão — fora do scroll, nunca sobreposta, com safe-area iOS */}
      <div style={{ flexShrink:0, padding:'12px 16px', paddingBottom:'calc(env(safe-area-inset-bottom) + 12px)', background:T.pageBg, borderTop:`1px solid ${T.divider}` }}>
        <div style={{ maxWidth:520, margin:'0 auto' }}>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              width:'100%', padding:'16px', borderRadius:12, border:'none', cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? 'rgba(255,255,255,0.08)' : '#6366f1',
              color: saving ? T.textMuted : '#fff',
              fontWeight:800, fontSize:16, transition:'all 0.2s',
            }}
          >
            {saving ? '⏳ Enviando...' : '🚀 Enviar Pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}
