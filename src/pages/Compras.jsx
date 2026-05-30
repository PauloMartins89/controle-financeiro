import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  PlusIcon, ShoppingCartIcon, ClockIcon, CheckCircleIcon,
  XCircleIcon, ArrowPathIcon, MagnifyingGlassIcon,
  ExclamationTriangleIcon, DocumentTextIcon, BanknotesIcon,
  TruckIcon, FunnelIcon, PencilIcon, TrashIcon, ListBulletIcon,
  ClipboardDocumentIcon, TrophyIcon,
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

// ─── Config de status ─────────────────────────────────────────────────────────
const STATUS = {
  requisicao_nova:       { label: 'Requisição',      color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  em_cotacao:            { label: 'Montando pedido', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  aguardando_aprovacao:  { label: 'Ag. Aprovação',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  leilao_aberto:         { label: 'Leilão aberto',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  leilao_encerrado:      { label: 'Selecionando',    color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  aprovado:              { label: 'Aprovado',         color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  recusado:              { label: 'Recusado',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  pedido_emitido:        { label: 'Pedido emitido',  color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  recebido:              { label: 'Recebido',         color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  pago:                  { label: 'Pago',             color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
}
const URGENCIA = {
  baixa:  { label: 'Baixa',  color: '#10b981' },
  media:  { label: 'Média',  color: '#f59e0b' },
  alta:   { label: 'Alta',   color: '#ef4444' },
}

function StatusBadge({ status }) {
  const cfg = STATUS[status] || { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

// ─── Modal: Nova Solicitação ──────────────────────────────────────────────────
function ModalNovaSolicitacao({ onClose, onSaved, workspaceId }) {
  const [form, setForm] = useState({
    titulo: '', descricao: '', valor_estimado: '', fornecedor: '',
    quantidade: '', urgencia: 'media', data_necessidade: '', tipo: 'direta',
    requisitante_nome: '', requisitante_telefone: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.titulo.trim()) { toast.error('Informe o que precisa comprar'); return }
    setSaving(true)
    const { data: inserted, error } = await supabase.from('solicitacoes_compra').insert({
      workspace_id:          workspaceId,
      titulo:                form.titulo.trim(),
      descricao:             form.descricao.trim() || null,
      valor_estimado:        form.valor_estimado ? parseFloat(form.valor_estimado.replace(',', '.')) : null,
      fornecedor:            form.fornecedor.trim() || null,
      quantidade:            form.quantidade.trim() || null,
      urgencia:              form.urgencia,
      tipo:                  form.tipo,
      data_necessidade:      form.data_necessidade || null,
      requisitante_nome:     form.requisitante_nome.trim() || null,
      requisitante_telefone: form.requisitante_telefone.trim() || null,
      status:                'em_cotacao',
    }).select('id').single()
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    toast.success('Solicitação criada!')
    // Notifica aprovador (telefone buscado automaticamente das configurações)
    if (inserted?.id) {
      fetch('/api/notify-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento: 'nova_solicitacao', solicitacaoId: inserted.id }),
      }).catch(() => {})
    }
    onSaved()
    onClose()
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
    background: 'var(--bg-primary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, display: 'block' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>Nova Solicitação de Compra</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>Será enviada para aprovação após salvar</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20 }}>×</button>
        </div>

        {/* Requisitante (opcional) */}
        <div style={{ background: 'rgba(99,102,241,0.06)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, border: '1px solid rgba(99,102,241,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Quem solicitou? (opcional)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Nome</label>
              <input style={inputStyle} value={form.requisitante_nome} onChange={e => set('requisitante_nome', e.target.value)} placeholder="Ex: Pedro Motorista" />
            </div>
            <div>
              <label style={labelStyle}>WhatsApp do solicitante</label>
              <input style={inputStyle} value={form.requisitante_telefone} onChange={e => set('requisitante_telefone', e.target.value)} placeholder="(11) 99999-0000" />
            </div>
          </div>
        </div>

        {/* Pedido */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>O que comprar? *</label>
          <input style={inputStyle} value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex: Óleo 15W40 — 50 litros" autoFocus />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Quantidade / Unidade</label>
            <input style={inputStyle} value={form.quantidade} onChange={e => set('quantidade', e.target.value)} placeholder="Ex: 50 litros" />
          </div>
          <div>
            <label style={labelStyle}>Valor estimado (R$)</label>
            <input style={inputStyle} value={form.valor_estimado} onChange={e => set('valor_estimado', e.target.value)} placeholder="0,00" type="number" step="0.01" />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Fornecedor sugerido</label>
          <input style={inputStyle} value={form.fornecedor} onChange={e => set('fornecedor', e.target.value)} placeholder="Ex: Auto Peças Central" />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Motivo / Justificativa</label>
          <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Por que é necessário comprar?" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Urgência</label>
            <select style={inputStyle} value={form.urgencia} onChange={e => set('urgencia', e.target.value)}>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Prazo necessário</label>
            <input style={inputStyle} type="date" value={form.data_necessidade} onChange={e => set('data_necessidade', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Tipo de compra</label>
            <select style={inputStyle} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="direta">Compra direta</option>
              <option value="leilao">Abrir leilão</option>
            </select>
          </div>
        </div>

        {form.tipo === 'leilao' && (
          <div style={{ background: 'rgba(139,92,246,0.06)', borderRadius: 10, padding: '12px 14px', marginBottom: 14, border: '1px solid rgba(139,92,246,0.2)', fontSize: 12, color: '#a78bfa' }}>
            🏷 Leilão: o aprovador poderá convidar fornecedores para enviar cotações. Vence o menor preço.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#6366f1', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 7 }}>
            {saving ? <ArrowPathIcon style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> : <ShoppingCartIcon style={{ width: 15, height: 15 }} />}
            {saving ? 'Salvando...' : 'Enviar para Aprovação'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Modal: Editar Solicitação ───────────────────────────────────────────────
function ModalEditar({ solicitacao, onClose, onSaved }) {
  const [form, setForm] = useState({
    titulo:            solicitacao.titulo || '',
    descricao:         solicitacao.descricao || '',
    valor_estimado:    solicitacao.valor_estimado ? String(solicitacao.valor_estimado) : '',
    fornecedor:        solicitacao.fornecedor || '',
    quantidade:        solicitacao.quantidade || '',
    urgencia:          solicitacao.urgencia || 'media',
    data_necessidade:  solicitacao.data_necessidade || '',
    requisitante_nome: solicitacao.requisitante_nome || '',
    requisitante_telefone: solicitacao.requisitante_telefone || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.titulo.trim()) { toast.error('Informe o que precisa comprar'); return }
    setSaving(true)
    const { error } = await supabase.from('solicitacoes_compra').update({
      titulo:                form.titulo.trim(),
      descricao:             form.descricao.trim() || null,
      valor_estimado:        form.valor_estimado ? parseFloat(form.valor_estimado.replace(',', '.')) : null,
      fornecedor:            form.fornecedor.trim() || null,
      quantidade:            form.quantidade.trim() || null,
      urgencia:              form.urgencia,
      data_necessidade:      form.data_necessidade || null,
      requisitante_nome:     form.requisitante_nome.trim() || null,
      requisitante_telefone: form.requisitante_telefone.trim() || null,
    }).eq('id', solicitacao.id)
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    toast.success('Solicitação atualizada!')
    onSaved(); onClose()
  }

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, display: 'block' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>Editar Solicitação</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>#{solicitacao.id.slice(-6).toUpperCase()}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20 }}>×</button>
        </div>

        <div style={{ background: 'rgba(99,102,241,0.06)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, border: '1px solid rgba(99,102,241,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Requisitante (opcional)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Nome</label>
              <input style={inputStyle} value={form.requisitante_nome} onChange={e => set('requisitante_nome', e.target.value)} placeholder="Ex: Pedro Motorista" />
            </div>
            <div>
              <label style={labelStyle}>WhatsApp</label>
              <input style={inputStyle} value={form.requisitante_telefone} onChange={e => set('requisitante_telefone', e.target.value)} placeholder="(11) 99999-0000" />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>O que comprar? *</label>
          <input style={inputStyle} value={form.titulo} onChange={e => set('titulo', e.target.value)} autoFocus />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Quantidade / Unidade</label>
            <input style={inputStyle} value={form.quantidade} onChange={e => set('quantidade', e.target.value)} placeholder="Ex: 50 litros" />
          </div>
          <div>
            <label style={labelStyle}>Valor estimado (R$)</label>
            <input style={inputStyle} type="number" step="0.01" value={form.valor_estimado} onChange={e => set('valor_estimado', e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Fornecedor sugerido</label>
          <input style={inputStyle} value={form.fornecedor} onChange={e => set('fornecedor', e.target.value)} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Motivo / Justificativa</label>
          <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={form.descricao} onChange={e => set('descricao', e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
          <div>
            <label style={labelStyle}>Urgência</label>
            <select style={inputStyle} value={form.urgencia} onChange={e => set('urgencia', e.target.value)}>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Prazo necessário</label>
            <input style={inputStyle} type="date" value={form.data_necessidade} onChange={e => set('data_necessidade', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#6366f1', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Histórico ─────────────────────────────────────────────────────────
function ModalHistorico({ solicitacao, onClose }) {
  function fmtDT(iso) {
    if (!iso) return null
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const steps = [
    { label: 'Solicitação criada',  date: solicitacao.created_at,    icon: '📝', color: '#6366f1' },
    { label: 'Enviada para aprovação', date: solicitacao.created_at,  icon: '📤', color: '#f59e0b', skip: !['aguardando_aprovacao','aprovado','recusado','leilao_aberto','leilao_encerrado','pedido_emitido','recebido','pago'].includes(solicitacao.status) },
    solicitacao.tipo === 'leilao'
      ? { label: 'Leilão aberto',   date: solicitacao.data_aprovacao, icon: '🏷',  color: '#8b5cf6', skip: !['leilao_aberto','leilao_encerrado','aprovado','pedido_emitido','pago'].includes(solicitacao.status) }
      : { label: 'Aprovado',        date: solicitacao.data_aprovacao, icon: '✅',  color: '#10b981', skip: !['aprovado','pedido_emitido','recebido','pago'].includes(solicitacao.status) },
    { label: 'Recusado',            date: solicitacao.data_aprovacao, icon: '❌',  color: '#ef4444', skip: solicitacao.status !== 'recusado' },
    { label: 'Fornecedor selecionado', date: solicitacao.data_aprovacao, icon: '🏆', color: '#10b981', skip: !solicitacao.fornecedor_vencedor },
    { label: 'Pedido emitido',      date: null,                       icon: '📋',  color: '#0ea5e9', skip: !['pedido_emitido','recebido','pago'].includes(solicitacao.status) },
    { label: 'Recebido',            date: null,                       icon: '📦',  color: '#10b981', skip: !['recebido','pago'].includes(solicitacao.status) },
    { label: 'Pago',                date: solicitacao.data_pagamento, icon: '💰',  color: '#10b981', skip: solicitacao.status !== 'pago' },
  ].filter(s => !s.skip)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: 420, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Histórico do Pedido</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>#{solicitacao.id.slice(-6).toUpperCase()} — {solicitacao.titulo}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20 }}>×</button>
        </div>

        <div style={{ position: 'relative' }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: i < steps.length - 1 ? 0 : 0, position: 'relative' }}>
              {/* Linha vertical */}
              {i < steps.length - 1 && (
                <div style={{ position: 'absolute', left: 17, top: 34, width: 2, height: 'calc(100% - 10px)', background: 'var(--border)', zIndex: 0 }} />
              )}
              {/* Ícone */}
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${step.color}18`, border: `2px solid ${step.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, zIndex: 1, position: 'relative' }}>
                {step.icon}
              </div>
              {/* Texto */}
              <div style={{ paddingBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{step.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{fmtDT(step.date) || '—'}</div>
                {/* Detalhes extras */}
                {step.icon === '✅' && solicitacao.observacao_aprovador && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontStyle: 'italic' }}>Obs: {solicitacao.observacao_aprovador}</div>
                )}
                {step.icon === '❌' && solicitacao.justificativa_recusa && (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>Motivo: {solicitacao.justificativa_recusa}</div>
                )}
                {step.icon === '🏆' && solicitacao.fornecedor_vencedor && (
                  <div style={{ fontSize: 11, color: '#10b981', marginTop: 3 }}>Vencedor: {solicitacao.fornecedor_vencedor}</div>
                )}
                {step.icon === '💰' && solicitacao.valor_aprovado && (
                  <div style={{ fontSize: 11, color: '#10b981', marginTop: 3, fontWeight: 700 }}>Valor pago: {(solicitacao.valor_aprovado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {solicitacao.comprovante_url && (
          <a href={solicitacao.comprovante_url} target="_blank" rel="noreferrer"
            style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: '9px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Ver comprovante ↗
          </a>
        )}

        <button onClick={onClose} style={{ width: '100%', marginTop: 12, padding: '9px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Fechar</button>
      </div>
    </div>
  )
}

// ─── Modal: Selecionar vencedor do leilão (visão do comprador) ───────────────
function ModalSelecionarVencedor({ solicitacao, cotacoes, onClose, onSaved }) {
  const [selecionado, setSelecionado] = useState(null)
  const [saving, setSaving] = useState(false)

  const enviadas = cotacoes.filter(c => c.status === 'enviado').sort((a, b) => (a.valor_total || 999999) - (b.valor_total || 999999))

  async function handleSelecionar() {
    if (!selecionado) { toast.error('Selecione um fornecedor'); return }
    setSaving(true)
    try {
      const cot = cotacoes.find(c => c.id === selecionado)
      const valorVencedor = cot.valor_total
      const { error } = await supabase.from('solicitacoes_compra').update({
        status: 'aprovado',
        fornecedor_vencedor: cot.fornecedor_nome,
        valor_aprovado: valorVencedor,
        economia: Math.max(0, (solicitacao.valor_estimado || 0) - (valorVencedor || 0)),
        data_aprovacao: new Date().toISOString(),
      }).eq('id', solicitacao.id)
      if (error) throw error
      await supabase.from('cotacoes_compra').update({ status: 'ganhou' }).eq('id', selecionado)
      const perdedores = cotacoes.filter(c => c.id !== selecionado && c.status === 'enviado').map(c => c.id)
      if (perdedores.length > 0) {
        await supabase.from('cotacoes_compra').update({ status: 'perdeu' }).in('id', perdedores)
      }

      // ── Cria despesa "contas a pagar" no financeiro ────────────────────────
      const { data: novaDespesa } = await supabase.from('despesas').insert({
        workspace_id:  solicitacao.workspace_id,
        descricao:     `[Compra] ${solicitacao.titulo} — ${cot.fornecedor_nome}`,
        valor:         valorVencedor || solicitacao.valor_estimado || 0,
        data:          solicitacao.data_necessidade || new Date().toISOString().split('T')[0],
        categoria:     'Compras',
        status:        'pendente',
        observacoes:   `Pedido #${solicitacao.id.slice(-6).toUpperCase()} | Leilão — vencedor: ${cot.fornecedor_nome}`,
        parcelas:      1,
        parcela_atual: 1,
      }).select('id').single()
      if (novaDespesa?.id) {
        await supabase.from('solicitacoes_compra').update({ despesa_id: novaDespesa.id }).eq('id', solicitacao.id)
      }
      // ──────────────────────────────────────────────────────────────────────

      toast.success(`${cot.fornecedor_nome} selecionado! Despesa criada no financeiro.`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>Selecionar Vencedor do Leilão</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{solicitacao.titulo} — {enviadas.length} proposta(s) recebida(s)</div>

        {cotacoes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum fornecedor cadastrado.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {cotacoes.map((c, i) => {
              const isEnviada = c.status === 'enviado'
              const isWinner  = enviadas[0]?.id === c.id
              return (
                <div key={c.id} onClick={() => isEnviada && setSelecionado(c.id)}
                  style={{
                    padding: '14px 16px', borderRadius: 10, cursor: isEnviada ? 'pointer' : 'default',
                    border: `2px solid ${selecionado === c.id ? '#10b981' : isEnviada ? 'var(--border)' : 'rgba(148,163,184,0.15)'}`,
                    background: selecionado === c.id ? 'rgba(16,185,129,0.06)' : 'var(--bg-primary)',
                    opacity: isEnviada ? 1 : 0.5,
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                        {isEnviada && isWinner ? '🥇' : isEnviada ? '🥈' : '✗'} {c.fornecedor_nome}
                      </div>
                      {c.condicao_pagamento && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Cond.: {c.condicao_pagamento}{c.prazo_entrega_dias ? ` · Entrega: ${c.prazo_entrega_dias}d` : ''}</div>}
                      {c.observacoes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{c.observacoes}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {isEnviada ? (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 900, color: isWinner ? '#10b981' : 'var(--text-primary)' }}>{fmtCurrency(c.valor_total)}</div>
                          {solicitacao.valor_estimado && c.valor_total < solicitacao.valor_estimado && (
                            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                              -{Math.round(((solicitacao.valor_estimado - c.valor_total) / solicitacao.valor_estimado) * 100)}%
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {c.status === 'visualizado' ? '👁 Visualizou' : 'Aguardando...'}
                        </div>
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

// ─── Modal: Confirmar compra realizada → envia ao financeiro ─────────────────
function ModalComprovante({ solicitacao, onClose, onSaved }) {
  const [valorReal, setValorReal]   = useState(solicitacao.valor_aprovado || solicitacao.valor_estimado || '')
  const [obs, setObs]               = useState('')
  const [saving, setSaving]         = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const valorPago = parseFloat(String(valorReal).replace(',', '.')) || null
      const { error } = await supabase.from('solicitacoes_compra').update({
        status:          'pedido_emitido',
        valor_aprovado:  valorPago,
        observacao_aprovador: obs.trim() || solicitacao.observacao_aprovador || null,
      }).eq('id', solicitacao.id)
      if (error) throw error

      // ── Atualiza a despesa vinculada (mantém pendente — financeiro vai quitar) ──
      if (solicitacao.despesa_id) {
        await supabase.from('despesas').update({
          valor: valorPago || solicitacao.valor_estimado || 0,
          observacoes: `Pedido #${solicitacao.id.slice(-6).toUpperCase()} | Aguardando NF${obs.trim() ? ' | ' + obs.trim() : ''}`,
        }).eq('id', solicitacao.despesa_id)
      }

      // ── Cria/Atualiza em Contas a Pagar com todos os dados da requisição ──
      const { data: { user } } = await supabase.auth.getUser()
      const obsContasPagar = [
        `Pedido #${solicitacao.id.slice(-6).toUpperCase()}`,
        solicitacao.quantidade ? `Qtd: ${solicitacao.quantidade}` : null,
        solicitacao.requisitante_nome ? `Solicitante: ${solicitacao.requisitante_nome}` : null,
        obs.trim() || null,
      ].filter(Boolean).join(' | ')

      const contaBase = {
        descricao:   `[Compra] ${solicitacao.titulo}`,
        fornecedor:  solicitacao.fornecedor_vencedor || solicitacao.fornecedor || null,
        categoria:   'Compras',
        valor:       valorPago || solicitacao.valor_estimado || 0,
        vencimento:  solicitacao.data_necessidade || new Date().toISOString().split('T')[0],
        observacoes: obsContasPagar,
        status:      'pendente',
        user_id:     user?.id,
      }

      // Tenta verificar duplicata via solicitacao_id (requer migration)
      let contaExistenteId = null
      try {
        const { data: found } = await supabase
          .from('contas_pagar').select('id').eq('solicitacao_id', solicitacao.id).maybeSingle()
        contaExistenteId = found?.id || null
      } catch (_) {}

      if (contaExistenteId) {
        await supabase.from('contas_pagar')
          .update({ ...contaBase, solicitacao_id: solicitacao.id })
          .eq('id', contaExistenteId)
      } else {
        // Tenta com solicitacao_id; se falhar (coluna inexistente), insere sem ela
        const withLink = { ...contaBase, solicitacao_id: solicitacao.id }
        const res1 = await supabase.from('contas_pagar').insert(withLink)
        if (res1.error) {
          const res2 = await supabase.from('contas_pagar').insert(contaBase)
          if (res2.error) throw res2.error
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      toast.success('✅ Compra confirmada! Enviada ao financeiro (Contas a Pagar).')
      fetch('/api/notify-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento: 'compra_paga', solicitacaoId: solicitacao.id }),
      }).catch(() => {})
      onSaved()
      onClose()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const fornDesc = solicitacao.fornecedor_vencedor || solicitacao.fornecedor

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: 440, padding: 28 }}>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Confirmar Compra Realizada</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>#{solicitacao.id.slice(-6).toUpperCase()} — {solicitacao.titulo}</div>
        </div>

        {/* Aviso ao comprador */}
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>📋</span>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Confirme que a compra foi realizada. A <strong style={{ color: 'var(--text-primary)' }}>Nota Fiscal</strong> e o <strong style={{ color: 'var(--text-primary)' }}>pagamento</strong> serão tratados pelo <strong style={{ color: '#10b981' }}>Financeiro (Contas a Pagar)</strong>.
          </div>
        </div>

        {/* Resumo */}
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', marginBottom: 18, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {fornDesc && <div>🏪 Fornecedor: <strong style={{ color: 'var(--text-primary)' }}>{fornDesc}</strong></div>}
          {solicitacao.quantidade && <div>📦 Quantidade: {solicitacao.quantidade}</div>}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 5 }}>Valor pago (R$)</label>
          <input
            value={valorReal}
            onChange={e => setValorReal(e.target.value)}
            type="number" step="0.01"
            placeholder="0,00"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Se diferir do aprovado, informe o valor real cobrado pelo fornecedor.</div>
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 5 }}>Observação para o financeiro <span style={{ fontWeight: 400, textTransform: 'none' }}>(opcional)</span></label>
          <input
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Ex: entrega em 3 dias, pagar após recebimento..."
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#10b981', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Enviando...' : '✅ Enviar ao Financeiro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de solicitação ──────────────────────────────────────────────────────
function SolicitacaoCard({ s, cotacoes, onRefresh }) {
  const [showComprovante, setShowComprovante] = useState(false)
  const [showEditar, setShowEditar]           = useState(false)
  const [showHistorico, setShowHistorico]     = useState(false)
  const [showVencedor, setShowVencedor]       = useState(false)
  const [deleting, setDeleting]               = useState(false)
  const urg = URGENCIA[s.urgencia] || URGENCIA.media
  const diasCriado = diasAtras(s.created_at)
  const isAprovado = s.status === 'aprovado' || s.status === 'pedido_emitido'
  const isPago = s.status === 'pago' || s.status === 'recebido'
  const isAberto = ['em_cotacao', 'aguardando_aprovacao', 'leilao_aberto'].includes(s.status)
  const canEdit = ['em_cotacao', 'requisicao_nova', 'aguardando_aprovacao'].includes(s.status)
  const canDelete = ['em_cotacao', 'requisicao_nova', 'aguardando_aprovacao', 'recusado'].includes(s.status)
  const isLeilao = ['leilao_aberto', 'leilao_encerrado'].includes(s.status) || s.tipo === 'leilao'
  const meusCotacoes = (cotacoes || []).filter(c => c.solicitacao_id === s.id)
  const temPropostas = meusCotacoes.some(c => c.status === 'enviado')
  const podeSelecionarVencedor = isLeilao && temPropostas && ['leilao_aberto','leilao_encerrado'].includes(s.status)

  async function handleDelete() {
    if (!window.confirm('Excluir esta solicitação?')) return
    setDeleting(true)
    const { error } = await supabase.from('solicitacoes_compra').delete().eq('id', s.id)
    if (error) { toast.error('Erro: ' + error.message); setDeleting(false); return }
    toast.success('Solicitação excluída')
    onRefresh()
  }

  return (
    <>
      <div style={{
        background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 12, padding: '16px 18px',
        border: `1px solid ${isPago ? 'rgba(16,185,129,0.3)' : isAprovado ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
        borderLeft: `3px solid ${STATUS[s.status]?.color || '#94a3b8'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{s.titulo}</span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: `${urg.color}15`, color: urg.color }}>
                {urg.label.toUpperCase()}
              </span>
              {s.tipo === 'leilao' && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>LEILÃO</span>
              )}
            </div>

            {s.descricao && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{s.descricao}</div>}

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
              {s.valor_estimado && <span>💰 {fmtCurrency(s.valor_estimado)}</span>}
              {s.fornecedor && <span>🏪 {s.fornecedor}</span>}
              {s.quantidade && <span>📦 {s.quantidade}</span>}
              {s.data_necessidade && <span>📅 Precisa até {fmtDate(s.data_necessidade)}</span>}
              {s.requisitante_nome && <span>👤 Req: {s.requisitante_nome}</span>}
              <span style={{ color: diasCriado > 5 && isAberto ? '#f59e0b' : 'var(--text-secondary)' }}>
                🕐 {diasCriado === 0 ? 'hoje' : `há ${diasCriado}d`}
              </span>
            </div>

            {s.observacao_aprovador && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', fontSize: 12, color: '#10b981' }}>
                ✓ Aprovador: "{s.observacao_aprovador}"
              </div>
            )}
            {s.justificativa_recusa && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 12, color: '#ef4444' }}>
                ✗ Recusado: "{s.justificativa_recusa}"
              </div>
            )}

            {/* ── Painel do leilão ─────────────────────────────────────────── */}
            {meusCotacoes.length > 0 && (
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🏷 LEILÃO — {meusCotacoes.filter(c => c.status === 'enviado').length}/{meusCotacoes.length} propostas recebidas</span>
                  {s.prazo_cotacao && (
                    <span style={{ fontSize: 10, color: new Date(s.prazo_cotacao) < new Date() ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                      {new Date(s.prazo_cotacao) < new Date() ? '⚠ Prazo encerrado' : `⏱ até ${fmtDate(s.prazo_cotacao)}`}
                    </span>
                  )}
                </div>

                {meusCotacoes.map(c => {
                  const link = `${window.location.origin}/cotacao/${c.token_acesso}`
                  const msgWA = `Olá ${c.fornecedor_nome}! Por favor envie sua cotação para *${s.titulo}* pelo link abaixo:\n${link}`
                  const isSent = c.status === 'enviado'
                  const isGanhou = c.status === 'ganhou'
                  const isPerdeu = c.status === 'perdeu'
                  return (
                    <div key={c.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: 8,
                      opacity: isPerdeu ? 0.45 : 1,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          {isGanhou && <span>🏆</span>}
                          {isPerdeu && <span>✗</span>}
                          {!isGanhou && !isPerdeu && isSent && <span>✅</span>}
                          {c.fornecedor_nome}
                        </div>
                        {isSent && c.condicao_pagamento && (
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {c.condicao_pagamento}{c.prazo_entrega_dias ? ` · ${c.prazo_entrega_dias}d` : ''}
                          </div>
                        )}
                        {isSent && c.observacoes && (
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1, fontStyle: 'italic' }}>{c.observacoes}</div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {isSent || isGanhou ? (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 900, color: isGanhou ? '#10b981' : 'var(--text-primary)' }}>
                              {fmtCurrency(c.valor_total)}
                            </div>
                            {c.valor_unitario && c.valor_unitario !== c.valor_total && (
                              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmtCurrency(c.valor_unitario)}/un</div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: c.status === 'visualizado' ? '#6366f1' : '#94a3b8', fontWeight: 600 }}>
                            {c.status === 'visualizado' ? '👁 Visualizou' : 'Aguardando...'}
                          </span>
                        )}

                        {/* Botões de compartilhamento — para quem ainda não enviou */}
                        {['convidado','visualizado'].includes(c.status) && (
                          <div style={{ display: 'flex', gap: 3 }}>
                            <button title="Copiar link"
                              onClick={() => { navigator.clipboard.writeText(link); toast.success('Link copiado!') }}
                              style={{ padding: '4px 7px', borderRadius: 5, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center' }}>
                              <ClipboardDocumentIcon style={{ width: 13, height: 13 }} />
                            </button>
                            {c.fornecedor_telefone && (
                              <a title="Enviar pelo WhatsApp"
                                href={`https://wa.me/${c.fornecedor_telefone.replace(/\D/g,'')}?text=${encodeURIComponent(msgWA)}`}
                                target="_blank" rel="noreferrer"
                                style={{ padding: '4px 7px', borderRadius: 5, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', cursor: 'pointer', color: '#25d366', textDecoration: 'none', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                                WA
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {temPropostas && s.valor_estimado && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#a78bfa' }}>
                    Orçamento inicial: {fmtCurrency(s.valor_estimado)}
                    {(() => {
                      const melhor = Math.min(...meusCotacoes.filter(c => c.valor_total > 0).map(c => c.valor_total))
                      const eco = s.valor_estimado - melhor
                      return eco > 0 ? <span style={{ color: '#10b981', fontWeight: 700 }}> · Melhor oferta economiza {fmtCurrency(eco)}</span> : null
                    })()}
                  </div>
                )}
              </div>
            )}
            {s.economia > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                💚 Economia: {fmtCurrency(s.economia)} ({Math.round((s.economia / s.valor_estimado) * 100)}% abaixo do orçamento)
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <StatusBadge status={s.status} />

            {/* Botões de ação principais */}
            {s.status === 'aprovado' && (
              <button onClick={() => setShowComprovante(true)}
                style={{ padding: '6px 12px', borderRadius: 7, background: '#10b981', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircleIcon style={{ width: 13, height: 13 }} />
                Enviar ao Financeiro
              </button>
            )}

            {/* Selecionar vencedor do leilão */}
            {podeSelecionarVencedor && (
              <button onClick={() => setShowVencedor(true)}
                style={{ padding: '6px 12px', borderRadius: 7, background: '#8b5cf6', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                <TrophyIcon style={{ width: 13, height: 13 }} />
                Selecionar vencedor
              </button>
            )}

            {/* Linha de ícones de ação */}
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              {/* Histórico — sempre visível */}
              <button onClick={() => setShowHistorico(true)} title="Histórico"
                style={{ padding: '5px 7px', borderRadius: 7, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center' }}>
                <ListBulletIcon style={{ width: 14, height: 14 }} />
              </button>

              {/* Editar — só pendentes */}
              {canEdit && (
                <button onClick={() => setShowEditar(true)} title="Editar"
                  style={{ padding: '5px 7px', borderRadius: 7, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', cursor: 'pointer', color: '#f59e0b', display: 'flex', alignItems: 'center' }}>
                  <PencilIcon style={{ width: 14, height: 14 }} />
                </button>
              )}

              {/* Excluir — só pendentes/recusados */}
              {canDelete && (
                <button onClick={handleDelete} disabled={deleting} title="Excluir"
                  style={{ padding: '5px 7px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', cursor: deleting ? 'not-allowed' : 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', opacity: deleting ? 0.5 : 1 }}>
                  <TrashIcon style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>

            {s.comprovante_url && (
              <a href={s.comprovante_url} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: '#818cf8', textDecoration: 'none' }}>
                Ver comprovante ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {showComprovante && <ModalComprovante solicitacao={s} onClose={() => setShowComprovante(false)} onSaved={onRefresh} />}
      {showEditar     && <ModalEditar      solicitacao={s} onClose={() => setShowEditar(false)}     onSaved={onRefresh} />}
      {showHistorico  && <ModalHistorico   solicitacao={s} onClose={() => setShowHistorico(false)} />}
      {showVencedor   && <ModalSelecionarVencedor solicitacao={s} cotacoes={meusCotacoes} onClose={() => setShowVencedor(false)} onSaved={onRefresh} />}
    </>
  )
}

// ─── Modal: Configurar aprovador de compras ───────────────────────────────────
function ModalConfigAprovador({ onClose }) {
  const [telefone, setTelefone] = useState('')
  const [saving, setSaving]     = useState(false)
  const [testing, setTesting]   = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    supabase.from('configuracoes').select('valor').eq('chave', 'aprovador_compras_telefone').limit(1)
      .then(({ data }) => {
        if (data?.[0]?.valor) {
          const val = String(data[0].valor).replace(/"/g, '')
          setTelefone(val)
          setSaved(true)
        }
      })
  }, [])

  async function handleSave() {
    if (!telefone.trim()) { toast.error('Informe o telefone do aprovador'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Usuário não autenticado'); setSaving(false); return }
    const { error } = await supabase.from('configuracoes').upsert(
      { chave: 'aprovador_compras_telefone', valor: telefone.trim(), user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,chave' }
    )
    setSaving(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    setSaved(true)
    toast.success('✅ Aprovador configurado! Notificará a cada novo pedido.')
    onClose()
  }

  async function handleTestar() {
    if (!saved && !telefone.trim()) { toast.error('Salve o telefone primeiro'); return }
    setTesting(true)
    try {
      const res = await fetch('/api/notify-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evento: '_teste', telefone: telefone.replace(/\D/g, '') }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.ok) toast.success('📱 Mensagem de teste enviada!')
      else toast.error('Falha no teste: ' + (json.error || res.status))
    } catch (e) {
      toast.error('Erro de rede: ' + e.message)
    } finally {
      setTesting(false)
    }
  }

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 14, width: '100%', maxWidth: 400, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>⚙️ Aprovador de Compras</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>Recebe aviso no WhatsApp a cada nova solicitação</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20 }}>×</button>
        </div>

        {saved && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', marginBottom: 14, fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>✅</span> Aprovador configurado — notificações ativas
          </div>
        )}

        <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', marginBottom: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Configure uma vez e esqueça. Toda nova solicitação de compra enviará automaticamente uma notificação para este número.
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, display: 'block' }}>
          WhatsApp do aprovador
        </label>
        <input
          style={inputStyle}
          value={telefone}
          onChange={e => { setTelefone(e.target.value); setSaved(false) }}
          placeholder="(11) 99999-0000"
          autoFocus
        />
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 5 }}>
          Inclua o DDD. Ex: 11999990000 ou +5511999990000
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 20 }}>
          <button onClick={handleTestar} disabled={testing || !telefone.trim()} style={{ padding: '9px 14px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: (testing || !telefone.trim()) ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)', fontSize: 12, opacity: (testing || !telefone.trim()) ? 0.5 : 1 }}>
            {testing ? 'Enviando...' : '📱 Testar'}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#8b5cf6', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Compras() {
  const [solicitacoes, setSolicitacoes] = useState([])
  const [cotacoes, setCotacoes]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [showConfig, setShowConfig]     = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca]               = useState('')
  const [workspaceId, setWorkspaceId]   = useState(null)

  const loadWorkspace = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: wm } = await supabase.from('workspace_members')
      .select('workspace_id').eq('user_id', user.id).limit(1).single()
    if (wm) setWorkspaceId(wm.workspace_id)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: sols, error }, { data: cots }] = await Promise.all([
      supabase.from('solicitacoes_compra').select('*').order('created_at', { ascending: false }),
      supabase.from('cotacoes_compra').select('*').order('valor_total', { ascending: true }),
    ])
    if (error) toast.error('Erro ao carregar: ' + error.message)
    else {
      setSolicitacoes(sols || [])
      setCotacoes(cots || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadWorkspace().then(loadData) }, [loadWorkspace, loadData])

  // KPIs
  const total          = solicitacoes.length
  const pendentes      = solicitacoes.filter(s => ['em_cotacao', 'aguardando_aprovacao'].includes(s.status)).length
  const aprovadas      = solicitacoes.filter(s => ['aprovado', 'pedido_emitido'].includes(s.status)).length
  const pagas          = solicitacoes.filter(s => s.status === 'pago').length
  const valorMes       = solicitacoes.filter(s => {
    const d = new Date(s.created_at)
    const n = new Date()
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() && s.valor_aprovado
  }).reduce((acc, s) => acc + (s.valor_aprovado || 0), 0)

  // Filtros
  const filtradas = solicitacoes.filter(s => {
    const matchStatus = filtroStatus === 'todos' || s.status === filtroStatus
    const matchBusca  = !busca || s.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
                        s.fornecedor?.toLowerCase().includes(busca.toLowerCase()) ||
                        s.requisitante_nome?.toLowerCase().includes(busca.toLowerCase())
    return matchStatus && matchBusca
  })

  const kpiStyle = {
    background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 12, padding: '16px 18px',
    border: '1px solid var(--border)', flex: 1,
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header
        title="Compras"
        subtitle="Solicitações e aprovações de compra"
        action={{ label: 'Nova Solicitação', onClick: () => setShowModal(true), icon: PlusIcon }}
      />

      <div style={{ padding: '0 24px 32px' }}>

        {/* Botão de configuração do aprovador */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={() => setShowConfig(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Aprovador de Compras
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={kpiStyle}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Total este mês</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#6366f1' }}>{total}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>solicitações</div>
          </div>
          <div style={kpiStyle}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Aguardando</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b' }}>{pendentes}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>aguardando aprovação</div>
          </div>
          <div style={kpiStyle}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Aprovadas</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981' }}>{aprovadas}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>para executar</div>
          </div>
          <div style={kpiStyle}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Gasto no mês</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>{fmtCurrency(valorMes)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{pagas} compra(s) paga(s)</div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-secondary)' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por produto, fornecedor ou requisitante..."
              style={{ width: '100%', paddingLeft: 32, padding: '9px 12px 9px 32px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['todos', 'aguardando_aprovacao', 'aprovado', 'leilao_aberto', 'pago', 'recusado'].map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)}
                style={{ padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                  background: filtroStatus === s ? '#6366f1' : 'var(--bg-secondary)',
                  borderColor: filtroStatus === s ? '#6366f1' : 'var(--border)',
                  color: filtroStatus === s ? '#fff' : 'var(--text-secondary)',
                }}>
                {s === 'todos' ? 'Todos' : (STATUS[s]?.label || s)}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <ArrowPathIcon style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
            <div>Carregando...</div>
          </div>
        ) : filtradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <ShoppingCartIcon style={{ width: 40, height: 40, color: 'var(--text-secondary)', margin: '0 auto 14px', opacity: 0.4 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Nenhuma solicitação</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {busca || filtroStatus !== 'todos' ? 'Nenhum resultado para os filtros.' : 'Crie a primeira solicitação de compra.'}
            </div>
            {filtroStatus === 'todos' && !busca && (
              <button onClick={() => setShowModal(true)} style={{ padding: '10px 20px', borderRadius: 9, background: '#6366f1', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <PlusIcon style={{ width: 15, height: 15 }} />
                Nova Solicitação
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtradas.map(s => (
              <SolicitacaoCard key={s.id} s={s} cotacoes={cotacoes} onRefresh={loadData} />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ModalNovaSolicitacao
          workspaceId={workspaceId}
          onClose={() => setShowModal(false)}
          onSaved={loadData}
        />
      )}
      {showConfig && <ModalConfigAprovador onClose={() => setShowConfig(false)} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
