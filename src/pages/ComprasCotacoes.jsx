import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { waLink } from '../lib/utils'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  TrophyIcon, PlusIcon, ArrowPathIcon, ClipboardDocumentIcon,
  ClockIcon, CheckCircleIcon, XCircleIcon, UserGroupIcon,
} from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}
function countdownLabel(iso) {
  if (!iso) return null
  const diff = new Date(iso) - new Date()
  if (diff <= 0) return { label: 'Encerrado', expired: true }
  const hrs = Math.floor(diff / 3600000)
  if (hrs < 24) return { label: `${hrs}h restantes`, expired: false }
  const dias = Math.floor(diff / 86400000)
  return { label: `${dias}d restantes`, expired: false }
}

const COTACAO_STATUS = {
  convidado:  { label: 'Convidado',   color: '#94a3b8' },
  visualizado:{ label: 'Visualizou',  color: '#6366f1' },
  enviado:    { label: 'Proposta enviada', color: '#10b981' },
  ganhou:     { label: '🏆 Vencedor', color: '#10b981' },
  perdeu:     { label: 'Perdeu',      color: '#94a3b8' },
}

// ─── Modal: Adicionar fornecedor ao leilão ────────────────────────────────────
function ModalAddFornecedor({ solicitacao, onClose, onSaved }) {
  const [form, setForm] = useState({ nome: '', telefone: '', email: '' })
  const [prazo, setPrazo] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, display: 'block' }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error('Informe o nome do fornecedor'); return }
    setSaving(true)
    try {
      const insert = {
        solicitacao_id:     solicitacao.id,
        fornecedor_nome:    form.nome.trim(),
        fornecedor_telefone:form.telefone.trim() || null,
        fornecedor_email:   form.email.trim() || null,
        status:             'convidado',
      }
      if (prazo) insert.token_expira_em = new Date(prazo).toISOString()
      const { data: cot, error } = await supabase.from('cotacoes_compra').insert(insert).select('token_acesso').single()
      if (error) throw error
      // Atualiza prazo na solicitação se fornecido e ainda não há
      if (prazo && !solicitacao.prazo_cotacao) {
        await supabase.from('solicitacoes_compra').update({ prazo_cotacao: new Date(prazo).toISOString() }).eq('id', solicitacao.id)
      }
      toast.success('Fornecedor convidado!')
      if (form.telefone && cot?.token_acesso) {
        const link = `${window.location.origin}/cotacao/${cot.token_acesso}`
        const msg  = `Olá ${form.nome.trim()}! Por favor envie sua cotação para *${solicitacao.titulo}* pelo link:\n${link}`
        const wa = waLink(form.telefone, msg)
        if (wa) window.open(wa, '_blank')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: 480, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Convidar Fornecedor</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{solicitacao.titulo}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Nome do Fornecedor *</label><input style={inp} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Distribuidora ABC" autoFocus /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>WhatsApp</label><input style={inp} value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(67) 99999-0000" /></div>
            <div><label style={lbl}>E-mail</label><input style={inp} value={form.email} onChange={e => set('email', e.target.value)} placeholder="vendas@empresa.com" /></div>
          </div>
          <div><label style={lbl}>Prazo para envio da cotação</label><input style={inp} type="datetime-local" value={prazo} onChange={e => setPrazo(e.target.value)} /></div>
        </div>

        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.2)', fontSize: 12, color: 'var(--text-secondary)' }}>
          Se WhatsApp informado, abrirá o WA automaticamente ao salvar.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#8b5cf6', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 7 }}>
            {saving ? <ArrowPathIcon style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> : <UserGroupIcon style={{ width: 15, height: 15 }} />}
            {saving ? 'Salvando...' : 'Convidar'}
          </button>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

// ─── Modal: Selecionar vencedor ───────────────────────────────────────────────
function ModalVencedor({ solicitacao, cotacoes, onClose, onSaved }) {
  const [selecionado, setSelecionado] = useState(null)
  const [saving, setSaving] = useState(false)
  const enviadas = cotacoes.filter(c => c.status === 'enviado').sort((a, b) => (a.valor_total || 999999) - (b.valor_total || 999999))

  async function handleSelecionar() {
    if (!selecionado) { toast.error('Selecione um fornecedor'); return }
    setSaving(true)
    try {
      const cot = cotacoes.find(c => c.id === selecionado)
      await supabase.from('solicitacoes_compra').update({
        status: 'aprovado',
        fornecedor_vencedor: cot.fornecedor_nome,
        valor_aprovado: cot.valor_total,
        economia: Math.max(0, (solicitacao.valor_estimado || 0) - (cot.valor_total || 0)),
        data_aprovacao: new Date().toISOString(),
      }).eq('id', solicitacao.id)
      await supabase.from('cotacoes_compra').update({ status: 'ganhou' }).eq('id', selecionado)
      const perdedores = cotacoes.filter(c => c.id !== selecionado && c.status === 'enviado').map(c => c.id)
      if (perdedores.length) await supabase.from('cotacoes_compra').update({ status: 'perdeu' }).in('id', perdedores)
      fetch('/api/notify-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento: 'leilao_encerrado', solicitacaoId: solicitacao.id }),
      }).catch(() => {})
      toast.success(`Vencedor: ${cot.fornecedor_nome}`)
      onSaved(); onClose()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Selecionar Vencedor</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{solicitacao.titulo} · {enviadas.length} proposta(s)</div>

        {cotacoes.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>Nenhuma cotação registrada</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {cotacoes.map((c, i) => {
              const isEnviada = c.status === 'enviado'
              const isFirst   = enviadas[0]?.id === c.id
              return (
                <div key={c.id} onClick={() => isEnviada && setSelecionado(c.id)}
                  style={{ padding: '14px 16px', borderRadius: 10, cursor: isEnviada ? 'pointer' : 'default', border: `2px solid ${selecionado === c.id ? '#10b981' : isEnviada ? 'var(--border)' : 'rgba(148,163,184,0.12)'}`, background: selecionado === c.id ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)', opacity: isEnviada ? 1 : 0.45 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
                        {isEnviada && isFirst ? '🥇 ' : isEnviada ? '🥈 ' : '✗ '}{c.fornecedor_nome}
                      </div>
                      {c.condicao_pagamento && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{c.condicao_pagamento}{c.prazo_entrega_dias ? ` · ${c.prazo_entrega_dias}d` : ''}</div>}
                    </div>
                    {isEnviada ? (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: isFirst ? '#10b981' : 'var(--text-primary)' }}>{fmtCurrency(c.valor_total)}</div>
                        {solicitacao.valor_estimado && c.valor_total < solicitacao.valor_estimado && (
                          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                            -{Math.round(((solicitacao.valor_estimado - c.valor_total) / solicitacao.valor_estimado) * 100)}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>
                        {c.status === 'visualizado' ? '👁 Visualizou' : 'Aguardando...'}
                      </span>
                    )}
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
              {saving ? 'Salvando...' : '🏆 Confirmar Vencedor'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Leilão Card ──────────────────────────────────────────────────────────────
function LeilaoCard({ sol, cotacoesDaSol, onRefresh }) {
  const [showAddForn,  setShowAddForn]  = useState(false)
  const [showVencedor, setShowVencedor] = useState(false)
  const cd = countdownLabel(sol.prazo_cotacao)
  const enviadas   = cotacoesDaSol.filter(c => c.status === 'enviado')
  const temPropost = enviadas.length > 0
  const podePick   = temPropost && ['leilao_aberto','leilao_encerrado'].includes(sol.status)
  const isEncerrado = sol.status === 'leilao_encerrado'

  async function handleEncerrar() {
    if (!window.confirm('Encerrar este leilão?')) return
    await supabase.from('solicitacoes_compra').update({ status: 'leilao_encerrado' }).eq('id', sol.id)
    fetch('/api/notify-compras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento: 'leilao_encerrado', solicitacaoId: sol.id }),
    }).catch(() => {})
    toast.success('Leilão encerrado')
    onRefresh()
  }

  return (
    <>
      <div style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 14, padding: '20px 22px', border: `1px solid ${isEncerrado ? 'rgba(249,115,22,0.25)' : 'rgba(139,92,246,0.25)'}`, borderLeft: `4px solid ${isEncerrado ? '#f97316' : '#8b5cf6'}` }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{sol.titulo}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
              {sol.valor_estimado && <span>💰 Orçamento: {fmtCurrency(sol.valor_estimado)}</span>}
              {sol.data_necessidade && <span>📅 Necessidade: {fmtDate(sol.data_necessidade)}</span>}
              <span>📦 {cotacoesDaSol.length} fornecedor(es) convidado(s)</span>
              <span style={{ fontWeight: 700, color: '#10b981' }}>✅ {enviadas.length} proposta(s) recebida(s)</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: isEncerrado ? 'rgba(249,115,22,0.12)' : 'rgba(139,92,246,0.12)', color: isEncerrado ? '#f97316' : '#8b5cf6' }}>
              {isEncerrado ? 'Selecionando' : 'Leilão aberto'}
            </span>
            {cd && (
              <span style={{ fontSize: 11, fontWeight: 700, color: cd.expired ? '#ef4444' : '#f59e0b' }}>
                <ClockIcon style={{ width: 12, height: 12, display: 'inline', marginRight: 3 }} />
                {cd.label}
              </span>
            )}
          </div>
        </div>

        {/* Propostas */}
        {cotacoesDaSol.length > 0 && (
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(139,92,246,0.15)', marginBottom: 14 }}>
            {cotacoesDaSol.sort((a, b) => {
              const statusOrder = { enviado: 0, ganhou: 1, visualizado: 2, convidado: 3, perdeu: 4 }
              return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5)
            }).map((c, i) => {
              const link = `${window.location.origin}/cotacao/${c.token_acesso}`
              const msg  = `Olá ${c.fornecedor_nome}! Envie sua cotação para *${sol.titulo}*:\n${link}`
              const isSent = c.status === 'enviado' || c.status === 'ganhou'
              return (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: i % 2 === 0 ? 'rgba(139,92,246,0.03)' : 'transparent', borderBottom: '1px solid var(--bg-secondary)', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {c.status === 'ganhou' ? '🏆 ' : ''}{c.fornecedor_nome}
                    </div>
                    {isSent && c.condicao_pagamento && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {c.condicao_pagamento}{c.prazo_entrega_dias ? ` · ${c.prazo_entrega_dias}d` : ''}{c.observacoes ? ` · ${c.observacoes}` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isSent ? (
                      <span style={{ fontSize: 15, fontWeight: 900, color: c.status === 'ganhou' ? '#10b981' : 'var(--text-primary)' }}>{fmtCurrency(c.valor_total)}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: COTACAO_STATUS[c.status]?.color || '#94a3b8', fontWeight: 600 }}>{COTACAO_STATUS[c.status]?.label || c.status}</span>
                    )}
                    {['convidado','visualizado'].includes(c.status) && (
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button title="Copiar link" onClick={() => { navigator.clipboard.writeText(link); toast.success('Link copiado!') }}
                          style={{ padding: '4px 7px', borderRadius: 5, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center' }}>
                          <ClipboardDocumentIcon style={{ width: 13, height: 13 }} />
                        </button>
                        {c.fornecedor_telefone && (
                          <a href={waLink(c.fornecedor_telefone, msg) || '#'} target="_blank" rel="noreferrer"
                            style={{ padding: '4px 7px', borderRadius: 5, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', color: '#25d366', textDecoration: 'none', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                            WA
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Comparativo de economia */}
        {temPropost && sol.valor_estimado && (() => {
          const melhor = Math.min(...enviadas.map(c => c.valor_total || Infinity).filter(v => v < Infinity))
          const eco = sol.valor_estimado - melhor
          return eco > 0 ? (
            <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: '#10b981', fontWeight: 700 }}>
              💚 Melhor oferta economiza {fmtCurrency(eco)} ({Math.round((eco / sol.valor_estimado) * 100)}% abaixo do orçamento)
            </div>
          ) : null
        })()}

        {/* Ações */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isEncerrado && (
            <button onClick={() => setShowAddForn(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', cursor: 'pointer', color: '#a78bfa', fontSize: 12, fontWeight: 700 }}>
              <PlusIcon style={{ width: 14, height: 14 }} /> Convidar Fornecedor
            </button>
          )}
          {podePick && (
            <button onClick={() => setShowVencedor(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#10b981', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 700 }}>
              <TrophyIcon style={{ width: 14, height: 14 }} /> Selecionar Vencedor
            </button>
          )}
          {sol.status === 'leilao_aberto' && (
            <button onClick={handleEncerrar}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', cursor: 'pointer', color: '#f97316', fontSize: 12, fontWeight: 700 }}>
              <XCircleIcon style={{ width: 14, height: 14 }} /> Encerrar Leilão
            </button>
          )}
        </div>
      </div>

      {showAddForn  && <ModalAddFornecedor solicitacao={sol} onClose={() => setShowAddForn(false)}  onSaved={onRefresh} />}
      {showVencedor && <ModalVencedor     solicitacao={sol} cotacoes={cotacoesDaSol} onClose={() => setShowVencedor(false)} onSaved={onRefresh} />}
    </>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ComprasCotacoes() {
  const [sols,    setSols]    = useState([])
  const { workspaceId } = useStore()
  const [cotacoes,setCotacoes]= useState([])
  const [loading, setLoading] = useState(true)
  const [filtro,  setFiltro]  = useState('ativos')

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from('solicitacoes_compra').select('*').eq('workspace_id', workspaceId).in('status', ['leilao_aberto','leilao_encerrado']).order('created_at', { ascending: false }),
      supabase.from('cotacoes_compra').select('*').order('valor_total', { ascending: true }),
    ])
    setSols(s || [])
    setCotacoes(c || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const filtrados = filtro === 'ativos'
    ? sols.filter(s => s.status === 'leilao_aberto')
    : filtro === 'encerrados'
    ? sols.filter(s => s.status === 'leilao_encerrado')
    : sols

  const FILTROS = [
    { key: 'ativos',    label: 'Em andamento', count: sols.filter(s => s.status === 'leilao_aberto').length },
    { key: 'encerrados',label: 'Encerrados',   count: sols.filter(s => s.status === 'leilao_encerrado').length },
    { key: 'todos',     label: 'Todos',        count: sols.length },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Cotações / Leilão"
        subtitle="Leilões abertos e propostas de fornecedores"
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          {FILTROS.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: filtro === f.key ? '#8b5cf6' : 'var(--border)', background: filtro === f.key ? 'rgba(139,92,246,0.12)' : 'var(--bg-secondary)', color: filtro === f.key ? '#a78bfa' : 'var(--text-secondary)' }}>
              {f.label} {f.count > 0 && <span style={{ background: 'rgba(139,92,246,0.18)', borderRadius: 20, padding: '0 6px', marginLeft: 4 }}>{f.count}</span>}
            </button>
          ))}
          <button onClick={load} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} /> Atualizar
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <ArrowPathIcon style={{ width: 28, height: 28, color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <TrophyIcon style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 700 }}>Nenhum leilão {filtro === 'ativos' ? 'em andamento' : filtro === 'encerrados' ? 'encerrado' : ''}</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Abra um leilão em Operações → Aprovações</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtrados.map(sol => (
              <LeilaoCard
                key={sol.id}
                sol={sol}
                cotacoesDaSol={cotacoes.filter(c => c.solicitacao_id === sol.id)}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
