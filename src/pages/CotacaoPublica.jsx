import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { CheckCircleIcon, ClockIcon, ArrowPathIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function tempoRestante(iso) {
  if (!iso) return null
  const diff = new Date(iso) - Date.now()
  if (diff <= 0) return null
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  return `${h}h ${m}min`
}

export default function CotacaoPublica() {
  const { token } = useParams()
  const [cotacao, setCotacao]           = useState(null)
  const [solicitacao, setSolicitacao]   = useState(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [submitted, setSubmitted]       = useState(false)
  const [saving, setSaving]             = useState(false)

  const [form, setForm] = useState({
    valor_unitario: '',
    valor_total: '',
    prazo_entrega_dias: '',
    condicao_pagamento: 'a_vista',
    observacoes: '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    async function load() {
      const { data: cot, error: cErr } = await supabase
        .from('cotacoes_compra')
        .select('*')
        .eq('token_acesso', token)
        .single()

      if (cErr || !cot) {
        setError('Link inválido ou expirado.')
        setLoading(false)
        return
      }

      // Verifica expiração
      if (cot.token_expira_em && new Date(cot.token_expira_em) < new Date()) {
        setError('O prazo para envio de cotações encerrou.')
        setLoading(false)
        return
      }

      const { data: sol } = await supabase
        .from('solicitacoes_compra')
        .select('*')
        .eq('id', cot.solicitacao_id)
        .single()

      setCotacao(cot)
      setSolicitacao(sol)

      // Pré-carrega se já enviou
      if (cot.status === 'enviado') {
        setForm({
          valor_unitario:    String(cot.valor_unitario || ''),
          valor_total:       String(cot.valor_total || ''),
          prazo_entrega_dias: String(cot.prazo_entrega_dias || ''),
          condicao_pagamento: cot.condicao_pagamento || 'a_vista',
          observacoes:       cot.observacoes || '',
        })
        setSubmitted(true)
      }

      // Marca como visualizado
      if (cot.status === 'convidado') {
        await supabase.from('cotacoes_compra').update({ status: 'visualizado' }).eq('id', cot.id)
      }

      setLoading(false)
    }
    load()
  }, [token])

  // Auto-calcula total quando qtd tem número
  function handleValorUnitario(v) {
    set('valor_unitario', v)
    const qtd = solicitacao?.quantidade ? parseFloat(solicitacao.quantidade) : null
    if (qtd && !isNaN(qtd) && v) {
      set('valor_total', String((parseFloat(v.replace(',', '.')) * qtd).toFixed(2)))
    }
  }

  async function handleSubmit() {
    if (!form.valor_total) { toast.error('Informe o valor total da proposta'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('cotacoes_compra').update({
        valor_unitario:    form.valor_unitario ? parseFloat(form.valor_unitario.replace(',', '.')) : null,
        valor_total:       parseFloat(form.valor_total.replace(',', '.')),
        prazo_entrega_dias: form.prazo_entrega_dias ? parseInt(form.prazo_entrega_dias) : null,
        condicao_pagamento: form.condicao_pagamento,
        observacoes:       form.observacoes || null,
        status:            'enviado',
        submitted_at:      new Date().toISOString(),
      }).eq('token_acesso', token)

      if (error) throw error
      setSubmitted(true)
      toast.success('Proposta enviada com sucesso!')
    } catch (e) {
      toast.error('Erro ao enviar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAtualizar() {
    setSubmitted(false)
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 9, fontSize: 14,
    background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
    color: '#f1f5f9', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 6, display: 'block',
  }

  // ── Tela de loading ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <ArrowPathIcon style={{ width: 32, height: 32, color: '#6366f1', animation: 'spin 1s linear infinite' }} />
      <div style={{ color: '#94a3b8', fontSize: 14 }}>Carregando cotação...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // ── Erro ────────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>Link inválido</div>
        <div style={{ fontSize: 14, color: '#94a3b8' }}>{error}</div>
      </div>
    </div>
  )

  const prazoEncerrado = cotacao.token_expira_em && new Date(cotacao.token_expira_em) < new Date()
  const tempo = tempoRestante(cotacao.token_expira_em)

  // ── Proposta enviada ────────────────────────────────────────────────────────
  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', background: '#1e293b', borderRadius: 20, padding: 36, border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
        <CheckCircleIcon style={{ width: 52, height: 52, color: '#10b981', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>Proposta enviada!</div>
        <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
          Sua cotação para <strong style={{ color: '#f1f5f9' }}>{solicitacao?.titulo}</strong> foi registrada com sucesso.
        </div>
        <div style={{ background: '#0f172a', borderRadius: 12, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase' }}>Resumo da sua proposta</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
            <span style={{ color: '#94a3b8' }}>Valor total</span>
            <span style={{ color: '#10b981', fontWeight: 800 }}>{fmtCurrency(parseFloat(form.valor_total))}</span>
          </div>
          {form.prazo_entrega_dias && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
              <span style={{ color: '#94a3b8' }}>Prazo de entrega</span>
              <span style={{ color: '#f1f5f9' }}>{form.prazo_entrega_dias} dias úteis</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ color: '#94a3b8' }}>Condição pagto</span>
            <span style={{ color: '#f1f5f9' }}>{{ a_vista: 'À vista', '30dd': '30 dias', '60dd': '60 dias', '90dd': '90 dias' }[form.condicao_pagamento] || form.condicao_pagamento}</span>
          </div>
        </div>
        {!prazoEncerrado && (
          <button onClick={handleAtualizar}
            style={{ padding: '10px 20px', borderRadius: 9, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', color: '#818cf8', fontSize: 13, fontWeight: 600 }}>
            Atualizar minha proposta
          </button>
        )}
      </div>
    </div>
  )

  // ── Formulário ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ maxWidth: 520, width: '100%' }}>

        {/* Logo / cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ShoppingCartIcon style={{ width: 22, height: 22, color: '#6366f1' }} />
            <span style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>DividíAí Compras</span>
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Portal de Cotação — acesso exclusivo via convite</div>
        </div>

        {/* Card principal */}
        <div style={{ background: '#1e293b', borderRadius: 20, padding: 32, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>

          {/* Prazo */}
          {tempo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 22 }}>
              <ClockIcon style={{ width: 16, height: 16, color: '#f59e0b', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>Prazo para enviar cotação: <strong>{tempo}</strong></span>
            </div>
          )}
          {prazoEncerrado && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 22, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
              ⚠ Prazo encerrado em {fmtDateTime(cotacao.token_expira_em)}
            </div>
          )}

          {/* Dados da solicitação */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Solicitação de Compra</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', marginBottom: 10 }}>{solicitacao?.titulo}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: '#94a3b8' }}>
              {solicitacao?.quantidade && <span>📦 Qtd: {solicitacao.quantidade}</span>}
              {solicitacao?.descricao && <span style={{ fontStyle: 'italic' }}>"{solicitacao.descricao}"</span>}
              {cotacao.token_expira_em && <span>📅 Prazo: {fmtDateTime(cotacao.token_expira_em)}</span>}
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 24 }} />

          {/* Fornecedor */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Sua empresa</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{cotacao.fornecedor_nome}</div>
          </div>

          {/* Formulário */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Valor unitário (R$)</label>
            <input style={inputStyle} type="number" step="0.01" value={form.valor_unitario}
              onChange={e => handleValorUnitario(e.target.value)} placeholder="0,00" disabled={prazoEncerrado} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Valor total da proposta (R$) *</label>
            <input style={{ ...inputStyle, fontSize: 18, fontWeight: 700, color: '#10b981' }} type="number" step="0.01"
              value={form.valor_total} onChange={e => set('valor_total', e.target.value)} placeholder="0,00" disabled={prazoEncerrado} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Prazo de entrega (dias úteis)</label>
              <input style={inputStyle} type="number" value={form.prazo_entrega_dias}
                onChange={e => set('prazo_entrega_dias', e.target.value)} placeholder="Ex: 5" disabled={prazoEncerrado} />
            </div>
            <div>
              <label style={labelStyle}>Condição de pagamento</label>
              <select style={inputStyle} value={form.condicao_pagamento} onChange={e => set('condicao_pagamento', e.target.value)} disabled={prazoEncerrado}>
                <option value="a_vista">À vista</option>
                <option value="30dd">30 dias</option>
                <option value="60dd">60 dias</option>
                <option value="90dd">90 dias</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Observações</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.observacoes}
              onChange={e => set('observacoes', e.target.value)} placeholder="Marca, especificações, condições especiais..."
              disabled={prazoEncerrado} />
          </div>

          {!prazoEncerrado && (
            <button onClick={handleSubmit} disabled={saving}
              style={{ width: '100%', padding: '14px', borderRadius: 11, background: '#6366f1', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 15, fontWeight: 800, opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              {saving
                ? <><ArrowPathIcon style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Enviando...</>
                : <><CheckCircleIcon style={{ width: 18, height: 18 }} /> Enviar Minha Proposta</>
              }
            </button>
          )}
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#475569' }}>
          🔒 Sua proposta é confidencial — os outros fornecedores não têm acesso ao seu preço<br />
          Você pode atualizar sua proposta até o prazo encerrar
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
