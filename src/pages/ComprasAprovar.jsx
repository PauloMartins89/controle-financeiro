import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon, XCircleIcon, ArrowPathIcon, MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon, TrophyIcon, PlusIcon, ClockIcon,
  ShoppingCartIcon, ExclamationTriangleIcon, BanknotesIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}
function diasAtras(iso) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso)) / 86400000)
}

const STATUS_CFG = {
  requisicao_nova:      { label: 'Requisição',      color: '#94a3b8' },
  em_cotacao:           { label: 'Mont. pedido',    color: '#6366f1' },
  aguardando_aprovacao: { label: 'Ag. Aprovação',   color: '#f59e0b' },
  leilao_aberto:        { label: 'Leilão aberto',   color: '#8b5cf6' },
  leilao_encerrado:     { label: 'Selecionando',    color: '#f97316' },
  aprovado:             { label: 'Aprovado',         color: '#10b981' },
  recusado:             { label: 'Recusado',         color: '#ef4444' },
  pedido_emitido:       { label: 'Pedido emitido',  color: '#0ea5e9' },
  recebido:             { label: 'Recebido',         color: '#10b981' },
  pago:                 { label: 'Pago',             color: '#10b981' },
}
const URGENCIA_CFG = {
  baixa:  { label: 'Baixa', color: '#10b981' },
  media:  { label: 'Média', color: '#f59e0b' },
  alta:   { label: 'Alta',  color: '#ef4444' },
}

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || { label: status, color: '#94a3b8' }
  return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${c.color}18`, color: c.color }}>{c.label}</span>
}

// ─── Modal de ação do aprovador ───────────────────────────────────────────────
function ModalAcao({ solicitacao, onClose, onSaved }) {
  const [acao, setAcao]     = useState(null)   // 'aprovar' | 'recusar' | 'leilao'
  const [obs, setObs]       = useState('')
  const [fornecedores, setFornecedores] = useState([{ nome: '', telefone: '' }])
  const [prazo, setPrazo]   = useState('')
  const [saving, setSaving] = useState(false)

  function notifyCompras(evento, solicitacaoId, destinos) {
    fetch('/api/notify-compras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento, solicitacaoId, destinos }),
    }).catch(() => {})
  }

  async function handleConfirm() {
    if (acao === 'recusar' && !obs.trim()) { toast.error('Informe o motivo da recusa'); return }
    if (acao === 'leilao' && fornecedores.every(f => !f.nome)) { toast.error('Informe pelo menos 1 fornecedor'); return }

    setSaving(true)
    try {
      if (acao === 'aprovar') {
        const { error } = await supabase.from('solicitacoes_compra').update({
          status: 'aprovado',
          observacao_aprovador: obs.trim() || null,
          data_aprovacao: new Date().toISOString(),
        }).eq('id', solicitacao.id)
        if (error) throw error

        // ── Cria despesa "contas a pagar" no financeiro ──────────────────────
        const valorDespesa = solicitacao.valor_aprovado || solicitacao.valor_estimado
        const fornDesc = solicitacao.fornecedor_vencedor || solicitacao.fornecedor
        const { data: novaDespesa, error: despErr } = await supabase
          .from('despesas')
          .insert({
            workspace_id: solicitacao.workspace_id,
            descricao:    `[Compra] ${solicitacao.titulo}${fornDesc ? ' — ' + fornDesc : ''}`,
            valor:        valorDespesa || 0,
            data:         solicitacao.data_necessidade || new Date().toISOString().split('T')[0],
            categoria:    'Compras',
            status:       'pendente',
            observacoes:  `Pedido #${solicitacao.id.slice(-6).toUpperCase()}${obs.trim() ? ' | ' + obs.trim() : ''}`,
            parcelas:     1,
            parcela_atual: 1,
          })
          .select('id')
          .single()
        // Vincula a despesa criada à solicitação de compra
        if (!despErr && novaDespesa?.id) {
          await supabase.from('solicitacoes_compra')
            .update({ despesa_id: novaDespesa.id })
            .eq('id', solicitacao.id)
        }
        // ────────────────────────────────────────────────────────────────────

        toast.success('Pedido aprovado! Despesa criada no financeiro.')
        notifyCompras('aprovado', solicitacao.id)

      } else if (acao === 'recusar') {
        const { error } = await supabase.from('solicitacoes_compra').update({
          status: 'recusado',
          justificativa_recusa: obs.trim(),
        }).eq('id', solicitacao.id)
        if (error) throw error
        toast.success('Pedido recusado.')
        notifyCompras('recusado', solicitacao.id)

      } else if (acao === 'leilao') {
        const prazoTs = prazo ? new Date(prazo + 'T23:59:00').toISOString() : new Date(Date.now() + 48 * 3600000).toISOString()
        const { error: updErr } = await supabase.from('solicitacoes_compra').update({
          status: 'leilao_aberto',
          tipo: 'leilao',
          prazo_cotacao: prazoTs,
          data_aprovacao: new Date().toISOString(),
        }).eq('id', solicitacao.id)
        if (updErr) throw updErr

        // Cria cotações para cada fornecedor
        const cotacoes = fornecedores.filter(f => f.nome.trim()).map(f => ({
          solicitacao_id: solicitacao.id,
          fornecedor_nome: f.nome.trim(),
          fornecedor_telefone: f.telefone.trim() || null,
          token_expira_em: prazoTs,
          status: 'convidado',
        }))
        if (cotacoes.length > 0) {
          const { error: cErr } = await supabase.from('cotacoes_compra').insert(cotacoes)
          if (cErr) throw cErr
        }
        toast.success(`Leilão aberto para ${cotacoes.length} fornecedor(es)!`)
        notifyCompras('leilao_aberto', solicitacao.id)
      }

      onSaved()
      onClose()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const addFornecedor = () => setFornecedores(p => [...p, { nome: '', telefone: '' }])
  const setForn = (i, k, v) => setFornecedores(p => p.map((f, idx) => idx === i ? { ...f, [k]: v } : f))

  const inputStyle = { width: '100%', padding: '8px 11px', borderRadius: 7, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>

        {/* Cabeçalho */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Decisão — Pedido #{solicitacao.id.slice(-6).toUpperCase()}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{solicitacao.titulo}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {solicitacao.valor_estimado && <span>💰 {fmtCurrency(solicitacao.valor_estimado)}</span>}
            {solicitacao.fornecedor && <span>🏪 {solicitacao.fornecedor}</span>}
            {solicitacao.requisitante_nome && <span>👤 {solicitacao.requisitante_nome}</span>}
          </div>
        </div>

        {/* Seleção de ação */}
        {!acao && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => setAcao('aprovar')}
              style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '2px solid rgba(16,185,129,0.3)', cursor: 'pointer', color: '#10b981', fontSize: 14, fontWeight: 700, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircleIcon style={{ width: 22, height: 22 }} />
              <div>
                <div>✅ Aprovar compra direta</div>
                <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>Comprador já pode realizar a compra no fornecedor indicado</div>
              </div>
            </button>
            <button onClick={() => setAcao('leilao')}
              style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(139,92,246,0.08)', border: '2px solid rgba(139,92,246,0.3)', cursor: 'pointer', color: '#a78bfa', fontSize: 14, fontWeight: 700, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
              <TrophyIcon style={{ width: 22, height: 22 }} />
              <div>
                <div>🏷 Abrir leilão de preços</div>
                <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>Convidar múltiplos fornecedores para cotar — vence o menor preço</div>
              </div>
            </button>
            <button onClick={() => setAcao('recusar')}
              style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '2px solid rgba(239,68,68,0.3)', cursor: 'pointer', color: '#ef4444', fontSize: 14, fontWeight: 700, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
              <XCircleIcon style={{ width: 22, height: 22 }} />
              <div>
                <div>❌ Recusar pedido</div>
                <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>Compra não autorizada — comprador será notificado</div>
              </div>
            </button>
            <button onClick={onClose} style={{ marginTop: 4, padding: '9px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Fechar</button>
          </div>
        )}

        {/* Aprovar */}
        {acao === 'aprovar' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>✅ Aprovar Compra Direta</div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Observação (opcional)</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical', marginBottom: 16 }} value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: Atenção ao prazo de entrega..." />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setAcao(null)} style={{ padding: '9px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Voltar</button>
              <button onClick={handleConfirm} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#10b981', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Aprovando...' : 'Confirmar Aprovação'}
              </button>
            </div>
          </div>
        )}

        {/* Recusar */}
        {acao === 'recusar' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>❌ Recusar Pedido</div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Motivo da recusa *</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical', marginBottom: 16 }} value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: Item já disponível em estoque..." />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setAcao(null)} style={{ padding: '9px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Voltar</button>
              <button onClick={handleConfirm} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#ef4444', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Recusando...' : 'Confirmar Recusa'}
              </button>
            </div>
          </div>
        )}

        {/* Leilão */}
        {acao === 'leilao' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', marginBottom: 12 }}>🏷 Abrir Leilão de Preços</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Prazo para receber cotações</label>
              <input type="date" style={inputStyle} value={prazo} onChange={e => setPrazo(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Se não preenchido, prazo automático de 48h</div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fornecedores convidados</label>
                <button onClick={addFornecedor} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <PlusIcon style={{ width: 12, height: 12 }} /> Adicionar
                </button>
              </div>
              {fornecedores.map((f, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input style={inputStyle} value={f.nome} onChange={e => setForn(i, 'nome', e.target.value)} placeholder={`Fornecedor ${i + 1}`} />
                  <input style={inputStyle} value={f.telefone} onChange={e => setForn(i, 'telefone', e.target.value)} placeholder="WhatsApp (opcional)" />
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 4, padding: '8px 10px', borderRadius: 7, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                🔒 Cada fornecedor recebe um link único. Eles NÃO veem os preços dos concorrentes.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setAcao(null)} style={{ padding: '9px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Voltar</button>
              <button onClick={handleConfirm} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#8b5cf6', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Abrindo...' : 'Abrir Leilão'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Modal: Selecionar vencedor do leilão ─────────────────────────────────────
function ModalSelecionarVencedor({ solicitacao, cotacoes, onClose, onSaved }) {
  const [selecionado, setSelecionado] = useState(null)
  const [saving, setSaving] = useState(false)

  const enviadas = cotacoes.filter(c => c.status === 'enviado').sort((a, b) => (a.valor_total || 999999) - (b.valor_total || 999999))

  async function handleSelecionar() {
    if (!selecionado) { toast.error('Selecione um fornecedor'); return }
    setSaving(true)
    try {
      const cot = cotacoes.find(c => c.id === selecionado)
      // Atualiza solicitação
      const { error } = await supabase.from('solicitacoes_compra').update({
        status: 'aprovado',
        fornecedor_vencedor: cot.fornecedor_nome,
        valor_aprovado: cot.valor_total,
        economia: Math.max(0, (solicitacao.valor_estimado || 0) - (cot.valor_total || 0)),
        data_aprovacao: new Date().toISOString(),
      }).eq('id', solicitacao.id)
      if (error) throw error
      // Marca vencedor e perdedores
      await supabase.from('cotacoes_compra').update({ status: 'ganhou' }).eq('id', selecionado)
      const perdedores = cotacoes.filter(c => c.id !== selecionado && c.status === 'enviado').map(c => c.id)
      if (perdedores.length > 0) {
        await supabase.from('cotacoes_compra').update({ status: 'perdeu' }).in('id', perdedores)
      }
      toast.success(`${cot.fornecedor_nome} selecionado como vencedor!`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Selecionar Vencedor do Leilão</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{solicitacao.titulo} — {enviadas.length} proposta(s) recebida(s)</div>

        {enviadas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum fornecedor enviou proposta ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {cotacoes.map((c, i) => {
              const isEnviada = c.status === 'enviado'
              const isWinner = enviadas[0]?.id === c.id
              return (
                <div key={c.id} onClick={() => isEnviada && setSelecionado(c.id)}
                  style={{
                    padding: '14px 16px', borderRadius: 10, cursor: isEnviada ? 'pointer' : 'default',
                    border: `2px solid ${selecionado === c.id ? '#10b981' : isEnviada ? 'var(--border)' : 'rgba(148,163,184,0.15)'}`,
                    background: selecionado === c.id ? 'rgba(16,185,129,0.06)' : 'var(--bg-primary)',
                    opacity: isEnviada ? 1 : 0.4,
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                        {isEnviada && isWinner && <span style={{ fontSize: 16 }}>🥇</span>}
                        {isEnviada && !isWinner && <span style={{ fontSize: 16 }}>🥈</span>}
                        {!isEnviada && <span style={{ fontSize: 16 }}>✗</span>}
                        {c.fornecedor_nome}
                      </div>
                      {c.condicao_pagamento && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Cond.: {c.condicao_pagamento} {c.prazo_entrega_dias ? `· Entrega: ${c.prazo_entrega_dias}d` : ''}</div>}
                      {c.observacoes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{c.observacoes}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {isEnviada ? (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 900, color: isWinner ? '#10b981' : 'var(--text-primary)' }}>{fmtCurrency(c.valor_total)}</div>
                          {solicitacao.valor_estimado && c.valor_total < solicitacao.valor_estimado && (
                            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>-{Math.round(((solicitacao.valor_estimado - c.valor_total) / solicitacao.valor_estimado) * 100)}%</div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sem resposta</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Fechar</button>
          {selecionado && (
            <button onClick={handleSelecionar} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#10b981', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Selecionando...' : '🏆 Selecionar Vencedor'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Card do aprovador ────────────────────────────────────────────────────────
function CardAprovador({ s, cotacoes, onRefresh }) {
  const [showAcao, setShowAcao]         = useState(false)
  const [showVencedor, setShowVencedor] = useState(false)
  const urg = URGENCIA_CFG[s.urgencia] || URGENCIA_CFG.media
  const dias = diasAtras(s.created_at)
  const meusCotacoes = cotacoes.filter(c => c.solicitacao_id === s.id)
  const aguardando = s.status === 'aguardando_aprovacao' || s.status === 'em_cotacao'
  const leilaoEncerrado = s.status === 'leilao_encerrado'
  const leilaoAberto = s.status === 'leilao_aberto'

  return (
    <>
      <div style={{
        background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 12, padding: '18px 20px',
        border: `1px solid ${aguardando ? 'rgba(245,158,11,0.3)' : leilaoEncerrado ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`,
        borderLeft: `3px solid ${STATUS_CFG[s.status]?.color || '#94a3b8'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{s.titulo}</span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: `${urg.color}15`, color: urg.color }}>{urg.label.toUpperCase()}</span>
              {s.tipo === 'leilao' && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>LEILÃO</span>}
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {s.valor_estimado && <span>💰 {fmtCurrency(s.valor_estimado)}</span>}
              {s.fornecedor && <span>🏪 {s.fornecedor}</span>}
              {s.quantidade && <span>📦 {s.quantidade}</span>}
              {s.requisitante_nome && <span>👤 Req: {s.requisitante_nome}</span>}
              {s.data_necessidade && <span>📅 Até {fmtDate(s.data_necessidade)}</span>}
              <span style={{ color: dias > 3 && aguardando ? '#ef4444' : 'var(--text-secondary)' }}>
                🕐 há {dias === 0 ? 'hoje' : `${dias}d`}
              </span>
            </div>

            {s.descricao && <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{s.descricao}"</div>}

            {/* Cotações do leilão */}
            {meusCotacoes.length > 0 && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 9, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>
                  COTAÇÕES — {meusCotacoes.filter(c => c.status === 'enviado').length}/{meusCotacoes.length} respondidas
                </div>
                {meusCotacoes.map(c => {
                  const link = `${window.location.origin}/cotacao/${c.token_acesso}`
                  const msgWA = `Olá ${c.fornecedor_nome}! Por favor envie sua cotação para *${s.titulo}* pelo link abaixo:\n${link}`
                  return (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 8 }}>
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{c.fornecedor_nome}</span>
                      <span style={{ fontWeight: 700, color: c.status === 'enviado' ? '#10b981' : c.status === 'visualizado' ? '#6366f1' : '#94a3b8', flexShrink: 0 }}>
                        {c.status === 'enviado' ? fmtCurrency(c.valor_total) : c.status === 'visualizado' ? '👁 Visualizou' : 'Aguardando...'}
                      </span>
                      {/* Botões de compartilhamento */}
                      {['convidado','visualizado'].includes(c.status) && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            title="Copiar link"
                            onClick={() => { navigator.clipboard.writeText(link); toast.success('Link copiado!') }}
                            style={{ padding: '3px 6px', borderRadius: 5, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center' }}>
                            <ClipboardDocumentIcon style={{ width: 12, height: 12 }} />
                          </button>
                          {c.fornecedor_telefone && (
                            <a
                              title="Enviar pelo WhatsApp"
                              href={`https://wa.me/${c.fornecedor_telefone.replace(/\D/g, '')}?text=${encodeURIComponent(msgWA)}`}
                              target="_blank" rel="noreferrer"
                              style={{ padding: '3px 6px', borderRadius: 5, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', cursor: 'pointer', color: '#25d366', display: 'flex', alignItems: 'center', textDecoration: 'none', fontSize: 11, fontWeight: 700 }}>
                              WA
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {s.prazo_cotacao && (
                  <div style={{ fontSize: 11, color: new Date(s.prazo_cotacao) < new Date() ? '#ef4444' : '#f59e0b', marginTop: 6 }}>
                    ⏱ Prazo: {new Date(s.prazo_cotacao) < new Date() ? '⚠ Encerrado' : `até ${fmtDate(s.prazo_cotacao)}`}
                  </div>
                )}
              </div>
            )}

            {s.justificativa_recusa && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 12, color: '#ef4444' }}>
                Recusado: "{s.justificativa_recusa}"
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <StatusBadge status={s.status} />
            {aguardando && (
              <button onClick={() => setShowAcao(true)}
                style={{ padding: '7px 14px', borderRadius: 8, background: '#f59e0b', border: 'none', cursor: 'pointer', color: '#000', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                Decidir →
              </button>
            )}
            {(leilaoEncerrado || (leilaoAberto && meusCotacoes.some(c => c.status === 'enviado'))) && (
              <button onClick={() => setShowVencedor(true)}
                style={{ padding: '7px 14px', borderRadius: 8, background: '#8b5cf6', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                🏆 Selecionar
              </button>
            )}
          </div>
        </div>
      </div>

      {showAcao && <ModalAcao solicitacao={s} onClose={() => setShowAcao(false)} onSaved={onRefresh} />}
      {showVencedor && <ModalSelecionarVencedor solicitacao={s} cotacoes={meusCotacoes} onClose={() => setShowVencedor(false)} onSaved={onRefresh} />}
    </>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ComprasAprovar() {
  const [solicitacoes, setSolicitacoes] = useState([])
  const [cotacoes, setCotacoes]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [filtro, setFiltro]             = useState('pendentes')
  const [busca, setBusca]               = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: sols }, { data: cots }] = await Promise.all([
      supabase.from('solicitacoes_compra').select('*').order('created_at', { ascending: false }),
      supabase.from('cotacoes_compra').select('*').order('valor_total', { ascending: true }),
    ])
    setSolicitacoes(sols || [])
    setCotacoes(cots || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // KPIs
  const aguardando   = solicitacoes.filter(s => ['aguardando_aprovacao', 'em_cotacao'].includes(s.status))
  const leiloesAbertos = solicitacoes.filter(s => ['leilao_aberto', 'leilao_encerrado'].includes(s.status))
  const totalMes     = solicitacoes.filter(s => {
    const d = new Date(s.created_at); const n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
  }).length
  const savings = solicitacoes.filter(s => s.economia > 0).reduce((acc, s) => acc + (s.economia || 0), 0)

  const filtradas = solicitacoes.filter(s => {
    const matchFiltro =
      filtro === 'todos'      ? true :
      filtro === 'pendentes'  ? ['aguardando_aprovacao', 'em_cotacao'].includes(s.status) :
      filtro === 'leiloes'    ? ['leilao_aberto', 'leilao_encerrado'].includes(s.status) :
      filtro === 'aprovados'  ? ['aprovado', 'pedido_emitido', 'pago'].includes(s.status) :
      s.status === filtro
    const matchBusca = !busca || s.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
                       s.requisitante_nome?.toLowerCase().includes(busca.toLowerCase()) ||
                       s.fornecedor?.toLowerCase().includes(busca.toLowerCase())
    return matchFiltro && matchBusca
  })

  const kpiStyle = { background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 12, padding: '16px 18px', border: '1px solid var(--border)', flex: 1 }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Aprovações de Compra" subtitle="Decisão central de todos os pedidos" action={{ label: 'Atualizar', onClick: loadData }} />

      <div style={{ padding: '0 24px 32px' }}>
        {/* KPIs */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={kpiStyle}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Aguardando decisão</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#f59e0b' }}>{aguardando.length}</div>
          </div>
          <div style={kpiStyle}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Leilões ativos</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#8b5cf6' }}>{leiloesAbertos.length}</div>
          </div>
          <div style={kpiStyle}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Pedidos este mês</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#6366f1' }}>{totalMes}</div>
          </div>
          <div style={kpiStyle}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Economia gerada</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>{fmtCurrency(savings)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>via leilões</div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-secondary)' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
              style={{ width: '100%', paddingLeft: 30, padding: '9px 12px 9px 30px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {[
            { key: 'pendentes', label: `Pendentes (${aguardando.length})` },
            { key: 'leiloes',   label: `Leilões (${leiloesAbertos.length})` },
            { key: 'aprovados', label: 'Aprovados' },
            { key: 'todos',     label: 'Todos' },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                background: filtro === f.key ? '#6366f1' : 'var(--bg-secondary)',
                borderColor: filtro === f.key ? '#6366f1' : 'var(--border)',
                color: filtro === f.key ? '#fff' : 'var(--text-secondary)',
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Alerta de urgentes */}
        {aguardando.filter(s => diasAtras(s.created_at) > 3).length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>
            <ExclamationTriangleIcon style={{ width: 16, height: 16, color: '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
              {aguardando.filter(s => diasAtras(s.created_at) > 3).length} pedido(s) aguardando há mais de 3 dias
            </span>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <ArrowPathIcon style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
            <div>Carregando...</div>
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <CheckCircleIcon style={{ width: 40, height: 40, color: 'var(--text-secondary)', margin: '0 auto 14px', opacity: 0.4 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              {filtro === 'pendentes' ? 'Nenhum pedido aguardando decisão' : 'Nenhum resultado'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {filtro === 'pendentes' ? 'Tudo em ordem. 👌' : 'Ajuste os filtros para ver mais resultados.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtradas.map(s => (
              <CardAprovador key={s.id} s={s} cotacoes={cotacoes} onRefresh={loadData} />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
