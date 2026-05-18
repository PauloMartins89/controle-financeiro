import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import {
  CheckCircleIcon, XCircleIcon, TrophyIcon, ArrowPathIcon,
  ShoppingCartIcon, PlusIcon, ClockIcon,
} from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

const URGENCIA = {
  baixa: { label: 'Baixa', color: '#10b981' },
  media: { label: 'Média', color: '#f59e0b' },
  alta:  { label: '🔴 ALTA', color: '#ef4444' },
}

export default function AprovarPublica() {
  const { token } = useParams()

  const [sol, setSol]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [acao, setAcao]       = useState(null)   // 'aprovar' | 'recusar' | 'leilao'
  const [obs, setObs]         = useState('')
  const [prazo, setPrazo]     = useState('')
  const [fornecedores, setFornecedores] = useState([{ nome: '', telefone: '' }])
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(null)   // acao concluída

  useEffect(() => {
    async function load() {
      const { data, error: e } = await supabase
        .from('solicitacoes_compra')
        .select('*')
        .eq('token_aprovador', token)
        .single()

      if (e || !data) {
        setError('Link inválido ou solicitação não encontrada.')
        setLoading(false)
        return
      }
      setSol(data)
      setLoading(false)
    }
    load()
  }, [token])

  const addFornecedor = () => setFornecedores(p => [...p, { nome: '', telefone: '' }])
  const setForn = (i, k, v) => setFornecedores(p => p.map((f, idx) => idx === i ? { ...f, [k]: v } : f))

  async function handleConfirm() {
    if (acao === 'recusar' && !obs.trim()) { toast.error('Informe o motivo da recusa'); return }
    if (acao === 'leilao' && fornecedores.every(f => !f.nome.trim())) { toast.error('Informe pelo menos 1 fornecedor'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/aprovar-compra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, acao, obs, fornecedores, prazo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao processar')
      setDone(acao)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ─── estilos ───────────────────────────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 9, fontSize: 14,
    background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
    color: '#f1f5f9', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 6, display: 'block',
  }

  // ─── loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <ArrowPathIcon style={{ width: 32, height: 32, color: '#6366f1', animation: 'spin 1s linear infinite' }} />
      <div style={{ color: '#94a3b8', fontSize: 14 }}>Carregando solicitação...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // ─── erro ──────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>Link inválido</div>
        <div style={{ fontSize: 14, color: '#94a3b8' }}>{error}</div>
      </div>
    </div>
  )

  // ─── já decidida ───────────────────────────────────────────────────────────
  const decididos = { aprovado: '✅ Aprovado', recusado: '❌ Recusado', leilao_aberto: '🏷 Leilão aberto', pedido_emitido: '📦 Em andamento', pago: '✅ Pago' }
  if (!done && decididos[sol.status]) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', background: '#1e293b', borderRadius: 20, padding: 40, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>
          {sol.status === 'recusado' ? '❌' : '✅'}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>Pedido já {decididos[sol.status]}</div>
        <div style={{ fontSize: 14, color: '#94a3b8' }}>Esta solicitação já foi processada anteriormente.</div>
        <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 12, background: '#0f172a', textAlign: 'left', fontSize: 13, color: '#94a3b8' }}>
          <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>{sol.titulo}</div>
          {sol.observacao_aprovador && <div>📝 {sol.observacao_aprovador}</div>}
          {sol.justificativa_recusa && <div>📝 Motivo: {sol.justificativa_recusa}</div>}
        </div>
      </div>
    </div>
  )

  // ─── concluído agora ───────────────────────────────────────────────────────
  if (done) {
    const msgs = {
      aprovar: { icon: '✅', titulo: 'Compra Aprovada!', sub: 'O comprador será notificado e já pode realizar o pedido.', color: '#10b981' },
      recusar: { icon: '❌', titulo: 'Pedido Recusado', sub: 'O comprador será notificado com o motivo informado.', color: '#ef4444' },
      leilao:  { icon: '🏷', titulo: 'Leilão Aberto!', sub: `${fornecedores.filter(f=>f.nome.trim()).length} fornecedor(es) convidado(s). Links enviados.`, color: '#a78bfa' },
    }
    const m = msgs[done]
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Toaster />
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', background: '#1e293b', borderRadius: 20, padding: 40, border: `1px solid ${m.color}30` }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{m.icon}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', marginBottom: 10 }}>{m.titulo}</div>
          <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>{m.sub}</div>
          <div style={{ padding: '14px 18px', borderRadius: 12, background: '#0f172a', textAlign: 'left', fontSize: 13, color: '#94a3b8' }}>
            <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{sol.titulo}</div>
            {sol.valor_estimado && <div>💰 Valor estimado: {fmtCurrency(sol.valor_estimado)}</div>}
            {sol.fornecedor && <div>🏪 Fornecedor: {sol.fornecedor}</div>}
            {sol.requisitante_nome && <div>👤 Solicitante: {sol.requisitante_nome}</div>}
            {obs.trim() && <div style={{ marginTop: 6 }}>📝 {obs}</div>}
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: '#475569' }}>Você pode fechar esta janela.</div>
        </div>
      </div>
    )
  }

  const urg = URGENCIA[sol.urgencia] || URGENCIA.media

  // ─── tela principal ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px' }}>
      <Toaster />
      <div style={{ maxWidth: 540, width: '100%' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ShoppingCartIcon style={{ width: 22, height: 22, color: '#6366f1' }} />
            <span style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>DividíAí Compras</span>
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Solicitação de Aprovação</div>
        </div>

        {/* Card da solicitação */}
        <div style={{ background: '#1e293b', borderRadius: 20, padding: 28, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>

          {/* Urgência badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${urg.color}20`, color: urg.color, border: `1px solid ${urg.color}40` }}>
              ⚡ {urg.label}
            </span>
            {sol.tipo === 'leilao' && (
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                LEILÃO
              </span>
            )}
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', marginBottom: 16 }}>{sol.titulo}</div>

          {sol.descricao && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16, fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>
              "{sol.descricao}"
            </div>
          )}

          {/* Detalhes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {sol.valor_estimado && (
              <div style={{ padding: '12px', borderRadius: 10, background: '#0f172a' }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Valor estimado</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#6366f1' }}>{fmtCurrency(sol.valor_estimado)}</div>
              </div>
            )}
            {sol.quantidade && (
              <div style={{ padding: '12px', borderRadius: 10, background: '#0f172a' }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Quantidade</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>📦 {sol.quantidade}</div>
              </div>
            )}
            {sol.fornecedor && (
              <div style={{ padding: '12px', borderRadius: 10, background: '#0f172a' }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Fornecedor sugerido</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>🏪 {sol.fornecedor}</div>
              </div>
            )}
            {sol.data_necessidade && (
              <div style={{ padding: '12px', borderRadius: 10, background: '#0f172a' }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Precisa até</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: sol.urgencia === 'alta' ? '#ef4444' : '#f59e0b' }}>📅 {fmtDate(sol.data_necessidade)}</div>
              </div>
            )}
          </div>

          {sol.requisitante_nome && (
            <div style={{ fontSize: 13, color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
              👤 Solicitado por: <strong style={{ color: '#94a3b8' }}>{sol.requisitante_nome}</strong>
            </div>
          )}
        </div>

        {/* Ações */}
        <div style={{ background: '#1e293b', borderRadius: 20, padding: 28, border: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Seleção de ação */}
          {!acao && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.4 }}>Sua decisão</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => setAcao('aprovar')}
                  style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(16,185,129,0.06)', border: '2px solid rgba(16,185,129,0.25)', cursor: 'pointer', color: '#10b981', fontSize: 14, fontWeight: 700, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircleIcon style={{ width: 24, height: 24, flexShrink: 0 }} />
                  <div>
                    <div>✅ Aprovar compra direta</div>
                    <div style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginTop: 3 }}>Comprador já pode realizar a compra no fornecedor indicado</div>
                  </div>
                </button>
                <button onClick={() => setAcao('leilao')}
                  style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(139,92,246,0.06)', border: '2px solid rgba(139,92,246,0.25)', cursor: 'pointer', color: '#a78bfa', fontSize: 14, fontWeight: 700, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <TrophyIcon style={{ width: 24, height: 24, flexShrink: 0 }} />
                  <div>
                    <div>🏷 Abrir leilão de preços</div>
                    <div style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginTop: 3 }}>Convidar fornecedores para cotar — vence o menor preço</div>
                  </div>
                </button>
                <button onClick={() => setAcao('recusar')}
                  style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '2px solid rgba(239,68,68,0.25)', cursor: 'pointer', color: '#ef4444', fontSize: 14, fontWeight: 700, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <XCircleIcon style={{ width: 24, height: 24, flexShrink: 0 }} />
                  <div>
                    <div>❌ Recusar pedido</div>
                    <div style={{ fontSize: 12, fontWeight: 400, color: '#64748b', marginTop: 3 }}>Compra não autorizada — comprador será notificado</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Aprovar */}
          {acao === 'aprovar' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981', marginBottom: 16 }}>✅ Aprovar Compra Direta</div>
              <label style={labelStyle}>Observação para o comprador (opcional)</label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical', marginBottom: 20 }}
                value={obs} onChange={e => setObs(e.target.value)}
                placeholder="Ex: Atenção ao prazo de entrega, pedir NF em nome da empresa..." />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setAcao(null)} style={{ padding: '10px 18px', borderRadius: 9, background: 'none', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>Voltar</button>
                <button onClick={handleConfirm} disabled={saving}
                  style={{ padding: '10px 22px', borderRadius: 9, background: '#10b981', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 14, fontWeight: 800, opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {saving ? <><ArrowPathIcon style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Aprovando...</> : <><CheckCircleIcon style={{ width: 16, height: 16 }} /> Confirmar Aprovação</>}
                </button>
              </div>
            </div>
          )}

          {/* Recusar */}
          {acao === 'recusar' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444', marginBottom: 16 }}>❌ Recusar Pedido</div>
              <label style={labelStyle}>Motivo da recusa *</label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical', marginBottom: 20 }}
                value={obs} onChange={e => setObs(e.target.value)}
                placeholder="Ex: Item já disponível em estoque / fora do orçamento..." />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setAcao(null)} style={{ padding: '10px 18px', borderRadius: 9, background: 'none', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>Voltar</button>
                <button onClick={handleConfirm} disabled={saving}
                  style={{ padding: '10px 22px', borderRadius: 9, background: '#ef4444', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 14, fontWeight: 800, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Recusando...' : 'Confirmar Recusa'}
                </button>
              </div>
            </div>
          )}

          {/* Leilão */}
          {acao === 'leilao' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa', marginBottom: 16 }}>🏷 Abrir Leilão de Preços</div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Prazo para receber cotações</label>
                <input type="date" style={inputStyle} value={prazo} onChange={e => setPrazo(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Se não preenchido, prazo automático de 48h</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Fornecedores convidados</label>
                  <button onClick={addFornecedor}
                    style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <PlusIcon style={{ width: 13, height: 13 }} /> Adicionar
                  </button>
                </div>
                {fornecedores.map((f, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <input style={inputStyle} value={f.nome} onChange={e => setForn(i, 'nome', e.target.value)} placeholder={`Fornecedor ${i + 1}`} />
                    <input style={inputStyle} value={f.telefone} onChange={e => setForn(i, 'telefone', e.target.value)} placeholder="WhatsApp (opcional)" />
                  </div>
                ))}
                <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                  🔒 Cada fornecedor recebe um link único. Eles NÃO veem os preços dos concorrentes.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={() => setAcao(null)} style={{ padding: '10px 18px', borderRadius: 9, background: 'none', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>Voltar</button>
                <button onClick={handleConfirm} disabled={saving}
                  style={{ padding: '10px 22px', borderRadius: 9, background: '#8b5cf6', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 14, fontWeight: 800, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Abrindo...' : '🏷 Abrir Leilão'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#334155', marginTop: 20 }}>
          DividíAí — Controle Financeiro Inteligente
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
