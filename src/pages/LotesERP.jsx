/**
 * LotesERP.jsx
 * Tela de Lotes ao Cliente no estilo ERP — mesma paleta de LancamentosERP.jsx
 * Rota: /lotes-erp
 *
 * ► Dados: mesma lógica de LotesCliente.jsx (sem alterar regras de negócio)
 * ► Visual: paleta corporativa navy/white, tabela ERP com KPI strip, filtros inline
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { buildLotePDFDoc } from '../lib/exportPDF'
import { formatCurrency, formatDate } from '../lib/utils'
import {
  CheckCircleIcon, XCircleIcon, ClockIcon, PaperAirplaneIcon,
  DocumentTextIcon, ArrowPathIcon, PlusIcon, XMarkIcon, UserGroupIcon,
  ArrowDownTrayIcon, BanknotesIcon, LinkIcon, ChevronDownIcon,
  ChevronLeftIcon, ChevronRightIcon, FunnelIcon, MagnifyingGlassIcon,
  ExclamationTriangleIcon, TableCellsIcon, DocumentArrowDownIcon,
  EyeIcon, PhotoIcon,
} from '@heroicons/react/24/outline'

// ─── PALETA ERP (idêntica à LancamentosERP) ──────────────────────────────────
const C = {
  navy:    '#0B1F3A',
  blue:    '#1D4ED8',
  green:   '#059669',
  amber:   '#F59E0B',
  red:     '#DC2626',
  purple:  '#7C3AED',
  bgPage:  '#F4F6FA',
  border:  '#D8DEE9',
  text:    '#172033',
  textSec: '#64748B',
  white:   '#FFFFFF',
}

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS_MAP = {
  rascunho:         { label: 'Rascunho',               bg: '#F8FAFC', color: '#64748B', border: '#CBD5E1' },
  enviado_cliente:  { label: 'Aguardando Cliente',      bg: '#FFFBEB', color: '#B45309', border: '#FCD34D' },
  aprovado_cliente: { label: 'Aprovado pelo Cliente',   bg: '#F0FDF4', color: '#065F46', border: '#86EFAC' },
  recusado_cliente: { label: 'Recusado pelo Cliente',   bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' },
  faturado:         { label: 'Faturado',                bg: '#F5F3FF', color: '#5B21B6', border: '#C4B5FD' },
  pago:             { label: 'Pago / Recebido',         bg: '#F0FDF4', color: '#065F46', border: '#86EFAC' },
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, bg: '#F8FAFC', color: '#64748B', border: '#CBD5E1' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function fmtDatetime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── MODAL: CRIAR LOTE ────────────────────────────────────────────────────────
function CriarLoteModal({ workspaceId, userId, onClose, onSaved }) {
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [clientes, setClientes] = useState([])
  const [showDrop, setShowDrop] = useState(false)
  const [obs, setObs] = useState('')
  const [rascunhos, setRascunhos] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.from('cadastros_clientes').select('id, nome, aprovador_n1_nome').eq('workspace_id', workspaceId).order('nome')
      .then(({ data }) => setClientes(data || []))
    supabase.from('lancamentos')
      .select('id, data, descricao, valor, dados_extras, status, lote_cliente_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'rascunho')
      .is('lote_cliente_id', null)
      .order('data', { ascending: false })
      .then(({ data }) => { setRascunhos(data || []); setLoading(false) })
  }, [workspaceId])

  const clientesFiltrados = clienteSearch.trim()
    ? clientes.filter(c => c.nome.toLowerCase().includes(clienteSearch.toLowerCase()))
    : clientes

  function toggle(id) { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSelected(rascunhos.every(r => selected.has(r.id)) ? new Set() : new Set(rascunhos.map(r => r.id))) }

  async function handleSave() {
    const nome = clienteNome.trim() || clienteSearch.trim()
    if (!nome) { toast.error('Informe o cliente.'); return }
    if (selected.size === 0) { toast.error('Selecione ao menos 1 lançamento.'); return }
    setSaving(true)
    try {
      const clienteSel = clientes.find(c => c.id === clienteId || c.nome === nome)
      const payload = { workspace_id: workspaceId, cliente: nome, observacoes: obs.trim() || null, created_by: userId, status: 'rascunho', aprovador_nome: clienteSel?.aprovador_n1_nome || null }
      if (clienteId) payload.cliente_id = clienteId
      const { data: lote, error: errL } = await supabase.from('lotes_cliente').insert(payload).select('id').single()
      if (errL) throw errL
      const { error: errU } = await supabase.from('lancamentos').update({ lote_cliente_id: lote.id }).in('id', [...selected])
      if (errU) throw errU
      toast.success(`Lote criado com ${selected.size} lançamento(s).`)
      onSaved()
    } catch (e) { toast.error('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  const inputSel = { padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(11,31,58,0.55)' }} />
      <div style={{ position: 'relative', width: 620, maxHeight: '90vh', background: C.white, borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: C.navy, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase' }}>Novo Lote</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginTop: 2 }}>Criar Lote para Cliente</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, cursor: 'pointer', color: C.white, padding: 6, display: 'flex' }}><XMarkIcon style={{ width: 16, height: 16 }} /></button>
        </div>

        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>CLIENTE *</div>
            <input value={clienteSearch}
              onChange={e => { setClienteSearch(e.target.value); setClienteId(''); setClienteNome(''); setShowDrop(true) }}
              onFocus={() => setShowDrop(true)} onBlur={() => setTimeout(() => setShowDrop(false), 180)}
              placeholder="Buscar cliente cadastrado..." style={{ ...inputSel, width: '100%' }} />
            {clienteId && <span style={{ position: 'absolute', right: 12, top: 30, fontSize: 12, color: C.green, fontWeight: 700 }}>✓</span>}
            {showDrop && clientesFiltrados.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 160, overflowY: 'auto', marginTop: 2 }}>
                {clientesFiltrados.map(c => (
                  <div key={c.id} onMouseDown={() => { setClienteId(c.id); setClienteNome(c.nome); setClienteSearch(c.nome); setShowDrop(false) }}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: C.text, borderBottom: `1px solid ${C.border}` }}
                    onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{c.nome}</div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>OBSERVAÇÕES</div>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Opcional..."
              style={{ ...inputSel, width: '100%', resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5 }}>
              RASCUNHOS DISPONÍVEIS {!loading && `(${rascunhos.length})`}
            </div>
            {rascunhos.length > 0 && (
              <button onClick={toggleAll} style={{ fontSize: 11, color: C.blue, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                {rascunhos.every(r => selected.has(r.id)) ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            )}
          </div>
          {loading ? <div style={{ color: C.textSec, fontSize: 12, padding: '20px 0' }}>Carregando...</div>
            : rascunhos.length === 0 ? <div style={{ color: C.textSec, fontSize: 12, padding: '20px 0', textAlign: 'center' }}>Nenhum rascunho disponível</div>
            : rascunhos.map(l => {
              const d = l.dados_extras || {}
              const isSel = selected.has(l.id)
              return (
                <div key={l.id} onClick={() => toggle(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: isSel ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${isSel ? C.blue : C.border}`, marginBottom: 5, transition: 'all .12s' }}>
                  <input type="checkbox" checked={isSel} onChange={() => toggle(l.id)} onClick={e => e.stopPropagation()} style={{ width: 13, height: 13, accentColor: C.blue, cursor: 'pointer' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.cliente || d.empresa || l.descricao || '—'}</div>
                    <div style={{ fontSize: 10, color: C.textSec }}>{fmtDate(l.data)}{d.numero_rdo && ` · Nº ${d.numero_rdo}`}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: C.green, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtCurrency(l.valor)}</span>
                </div>
              )
            })}
        </div>

        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: C.textSec }}>
            {selected.size > 0 && <span><strong style={{ color: C.text }}>{selected.size}</strong> selecionado(s) · {fmtCurrency([...selected].reduce((s, id) => s + (rascunhos.find(r => r.id === id)?.valor || 0), 0))}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving || selected.size === 0 || !(clienteNome || clienteSearch).trim()}
              style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: C.green, color: C.white, cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: (saving || selected.size === 0 || !(clienteNome || clienteSearch).trim()) ? 0.6 : 1 }}>
              {saving ? 'Criando...' : 'Criar Lote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL: ENVIAR AO CLIENTE ─────────────────────────────────────────────────
function EnviarModal({ lote, workspaceId, onClose, onSent }) {
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [remetente, setRemetente] = useState(() => localStorage.getItem(`rem_${workspaceId}`) || '')
  const [remetenteLocked, setRemetenteLocked] = useState(() => !!localStorage.getItem(`rem_${workspaceId}`))
  const [link, setLink] = useState('')
  const [lancamentos, setLancamentos] = useState([])
  const [sending, setSending] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [aprovadorNome, setAprovadorNome] = useState('')

  useEffect(() => {
    async function init() {
      // Gera token se não existir
      let token = lote.token_acesso
      if (!token) {
        token = crypto.randomUUID()
        await supabase.from('lotes_cliente').update({ token_acesso: token }).eq('id', lote.id)
      }
      setLink(`${window.location.origin}/lote/${token}`)

      // Carrega dados do cliente
      if (lote.cliente_id) {
        const { data } = await supabase.from('cadastros_clientes').select('aprovador_n1_wa, aprovador_n1_email, aprovador_n1_nome').eq('id', lote.cliente_id).maybeSingle()
        if (data) {
          if (data.aprovador_n1_wa) setTelefone(data.aprovador_n1_wa)
          if (data.aprovador_n1_email) setEmail(data.aprovador_n1_email)
          if (data.aprovador_n1_nome) setAprovadorNome(data.aprovador_n1_nome)
        }
      }

      const { data: lancs } = await supabase.from('lancamentos').select('id, data, descricao, valor, status, dados_extras, observacoes').eq('lote_cliente_id', lote.id).order('data')
      setLancamentos(lancs || [])
    }
    init()
  }, [lote])

  async function buildPDF() {
    return buildLotePDFDoc({ lancamentos, lote, link, assinaturaBase64: null, aprovadoEm: null, aprovadorNome: null })
  }

  async function handleWA() {
    if (!link || !telefone.replace(/\D/g, '').length) return
    setSending(true)
    try {
      const pdfBase64 = lancamentos.length > 0 ? (await buildPDF()).output('datauristring').split(',')[1] : undefined
      const res = await fetch('/api/wa-lote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone, cliente: lote.cliente, link, loteId: lote.id, pdfBase64, pdfNome: `lote-${lote.cliente}.pdf` }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar')
      toast.success('WhatsApp enviado!')
      onSent()
    } catch (e) { toast.error(e.message) }
    finally { setSending(false) }
  }

  async function handleEmailEnviar() {
    if (!link || !email.trim()) return
    setSendingEmail(true)
    try {
      const pdfBase64 = (await buildPDF()).output('datauristring').split(',')[1]
      const res = await fetch('/api/lote-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toEmail: email.trim(), toNome: aprovadorNome, remetente: remetente.trim(), link, loteCliente: lote.cliente, pdfBase64 }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar')
      toast.success('E-mail enviado!')
      onSent()
    } catch (e) { toast.error(e.message) }
    finally { setSendingEmail(false) }
  }

  async function handleConfirmar() {
    setSaving(true)
    await supabase.from('lotes_cliente').update({ status: 'enviado_cliente', updated_at: new Date().toISOString() }).eq('id', lote.id)
    setSaving(false)
    toast.success('Lote marcado como enviado ao cliente!')
    onSent()
  }

  function toggleLock() {
    if (remetenteLocked) { localStorage.removeItem(`rem_${workspaceId}`); setRemetenteLocked(false) }
    else if (remetente.trim()) { localStorage.setItem(`rem_${workspaceId}`, remetente.trim()); setRemetenteLocked(true) }
  }

  const inputSel = { padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, color: C.text, fontSize: 12, outline: 'none', boxSizing: 'border-box', width: '100%' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(11,31,58,0.55)' }} />
      <div style={{ position: 'relative', width: 480, background: C.white, borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ background: C.navy, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase' }}>Enviar para Aprovação</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginTop: 2 }}>{lote.cliente}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, cursor: 'pointer', color: C.white, padding: 6, display: 'flex' }}><XMarkIcon style={{ width: 16, height: 16 }} /></button>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Link */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}><LinkIcon style={{ width: 11, height: 11 }} /> LINK DE APROVAÇÃO</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, padding: '7px 10px', borderRadius: 6, background: '#F8FAFC', border: `1px solid ${C.border}`, fontSize: 11, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link || 'Gerando...'}</div>
              <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) }} disabled={!link}
                style={{ padding: '7px 12px', borderRadius: 6, background: copied ? '#F0FDF4' : '#EFF6FF', border: `1px solid ${copied ? C.green : C.blue}`, cursor: 'pointer', color: copied ? C.green : C.blue, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
          {/* Contatos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>WHATSAPP</div>
              <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(99) 99999-9999" style={inputSel} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>E-MAIL</div>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@cliente.com" type="email" style={inputSel} />
            </div>
          </div>
          {/* Remetente */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>SEU E-MAIL (REMETENTE)</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={remetente} onChange={e => { setRemetente(e.target.value); if (remetenteLocked) localStorage.setItem(`rem_${workspaceId}`, e.target.value) }} disabled={remetenteLocked} placeholder="seu@email.com" style={{ ...inputSel, border: `1px solid ${remetenteLocked ? C.green : C.border}` }} />
              <button onClick={toggleLock} title={remetenteLocked ? 'Editar remetente' : 'Salvar remetente'} style={{ padding: '7px 11px', borderRadius: 6, background: remetenteLocked ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${remetenteLocked ? C.green : C.border}`, cursor: 'pointer', fontSize: 15 }}>{remetenteLocked ? '🔒' : '🔓'}</button>
            </div>
          </div>
          {/* Botões envio */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleWA} disabled={!link || !telefone.replace(/\D/g, '').length || sending}
              style={{ flex: 1, padding: '9px', borderRadius: 7, background: '#25D366', border: 'none', cursor: 'pointer', color: C.white, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: (!link || !telefone.replace(/\D/g, '').length || sending) ? 0.6 : 1 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              {sending ? 'Enviando...' : 'WA + PDF'}
            </button>
            <button onClick={handleEmailEnviar} disabled={!link || !email.trim() || sendingEmail}
              style={{ flex: 1, padding: '9px', borderRadius: 7, background: '#EFF6FF', border: `1px solid #BFDBFE`, cursor: 'pointer', color: C.blue, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: (!link || !email.trim() || sendingEmail) ? 0.45 : 1 }}>
              {sendingEmail ? '⏳...' : '✉ E-mail + PDF'}
            </button>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
          <button onClick={handleConfirmar} disabled={saving || !link}
            style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: C.amber, color: C.white, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, opacity: saving ? 0.7 : 1 }}>
            <PaperAirplaneIcon style={{ width: 13, height: 13 }} />{saving ? 'Salvando...' : 'Confirmar Envio'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL: DE ACORDO ─────────────────────────────────────────────────────────
function DeAcordoModal({ lote, onClose, onSaved }) {
  const [file, setFile] = useState(null)
  const [obs, setObs] = useState(lote.observacoes || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      let comprovante_url = lote.comprovante_url || null
      if (file) {
        try {
          const ext = file.name.split('.').pop()
          const path = `lotes_cliente/${lote.id}/de_acordo_${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage.from('comprovantes').upload(path, file, { upsert: true })
          if (upErr) throw upErr
          const { data: pub } = supabase.storage.from('comprovantes').getPublicUrl(path)
          comprovante_url = pub.publicUrl
        } catch { toast('Comprovante não enviado — De Acordo registrado sem arquivo.', { icon: '⚠️' }) }
      }
      await supabase.from('lotes_cliente').update({ status: 'aprovado_cliente', comprovante_url, observacoes: obs || null, updated_at: new Date().toISOString() }).eq('id', lote.id)
      await supabase.from('lancamentos').update({ status: 'aguardando_aprovacao' }).eq('lote_cliente_id', lote.id)
      toast.success('De Acordo registrado! Lançamentos enviados para Faturamento.')
      onSaved()
    } catch (e) { toast.error('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(11,31,58,0.55)' }} />
      <div style={{ position: 'relative', width: 460, background: C.white, borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ background: C.navy, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: .8, textTransform: 'uppercase' }}>Registrar</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginTop: 2 }}>De Acordo — {lote.cliente}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, cursor: 'pointer', color: C.white, padding: 6, display: 'flex' }}><XMarkIcon style={{ width: 16, height: 16 }} /></button>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: '#F0FDF4', border: `1px solid #86EFAC`, fontSize: 12, color: C.green }}>
            ✔ Ao confirmar, todos os lançamentos deste lote serão enviados para <strong>Faturamento</strong>.
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>COMPROVANTE (PDF / IMAGEM)</div>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0])}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, color: C.text, fontSize: 12, cursor: 'pointer', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>OBSERVAÇÕES</div>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${C.border}`, color: C.text, fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: C.green, color: C.white, cursor: 'pointer', fontSize: 12, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Registrando...' : 'Confirmar De Acordo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DRAWER: DETALHES DO LOTE ─────────────────────────────────────────────────
function LoteDrawer({ lote, onClose, onRefresh }) {
  const { workspaceId } = useStore()
  const [lancamentos, setLancamentos] = useState(null)
  const [saving, setSaving] = useState(false)
  const [enviarModal, setEnviarModal] = useState(false)
  const [deAcordoModal, setDeAcordoModal] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)

  useEffect(() => {
    if (!lote) return
    supabase.from('lancamentos').select('id, data, descricao, valor, status, dados_extras').eq('lote_cliente_id', lote.id).order('data')
      .then(({ data }) => setLancamentos(data || []))
  }, [lote?.id])

  async function handleDesfazer() {
    if (!window.confirm('Desfazer lote? Os lançamentos voltarão como rascunhos.')) return
    setSaving(true)
    await supabase.from('lancamentos').update({ lote_cliente_id: null }).eq('lote_cliente_id', lote.id)
    await supabase.from('lotes_cliente').delete().eq('id', lote.id)
    setSaving(false)
    toast('Lote desfeito.')
    onClose(); onRefresh()
  }

  async function handleRecusar() {
    if (!window.confirm('Marcar como Recusado?')) return
    setSaving(true)
    await supabase.from('lotes_cliente').update({ status: 'recusado_cliente', updated_at: new Date().toISOString() }).eq('id', lote.id)
    await supabase.from('lancamentos').update({ status: 'rascunho' }).eq('lote_cliente_id', lote.id).eq('status', 'aguardando_aprovacao')
    setSaving(false)
    toast('Lote recusado. Lançamentos voltaram para rascunho.')
    onClose(); onRefresh()
  }

  async function handleConfirmarPagamento() {
    if (!window.confirm(`Confirmar recebimento do pagamento — "${lote.cliente}"?`)) return
    const now = new Date().toISOString()
    const { error } = await supabase.from('lotes_cliente').update({ status: 'pago', pago_em: now, updated_at: now }).eq('id', lote.id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Pagamento confirmado! Lote encerrado.')
    onClose(); onRefresh()
  }

  async function handleDownloadPDF() {
    setDownloadingPDF(true)
    try {
      const lancs = lancamentos || []
      const link = lote.token_acesso ? `${window.location.origin}/lote/${lote.token_acesso}` : null
      let assinaturaBase64 = null
      if (lote.assinatura_url) {
        try {
          const r = await fetch(lote.assinatura_url)
          const blob = await r.blob()
          assinaturaBase64 = await new Promise(resolve => { const fr = new FileReader(); fr.onloadend = () => resolve(fr.result); fr.readAsDataURL(blob) })
        } catch (_) {}
      }
      const doc = buildLotePDFDoc({ lancamentos: lancs, lote, link, assinaturaBase64, aprovadoEm: lote.aprovado_em || null, aprovadorNome: lote.confirmado_por || lote.aprovador_nome || null })
      const url = URL.createObjectURL(doc.output('blob'))
      const a = document.createElement('a'); a.href = url; a.download = `lote-${lote.cliente.replace(/[^a-z0-9]/gi, '_')}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) { toast.error('Erro ao gerar PDF: ' + e.message) }
    finally { setDownloadingPDF(false) }
  }

  if (!lote) return null
  const totalValor = (lancamentos || []).reduce((s, l) => s + (l.valor || 0), 0)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(11,31,58,0.45)' }} />
      <div style={{ width: 440, background: C.white, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${C.border}`, background: C.navy, position: 'sticky', top: 0, zIndex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: .5, marginBottom: 4 }}>DETALHES DO LOTE</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>{lote.cliente}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>
                Criado {fmtDatetime(lote.created_at)} · {lote.qtd_lancamentos || (lancamentos?.length ?? 0)} lançamento(s)
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, cursor: 'pointer', color: C.white, padding: 6, display: 'flex' }}>
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>
          </div>
          <div style={{ marginTop: 12 }}><StatusBadge status={lote.status} /></div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', flex: 1 }}>
          {/* Resumo financeiro */}
          <div style={{ marginBottom: 20, padding: '12px 14px', background: '#F8FAFC', borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>RESUMO FINANCEIRO</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: C.textSec }}>Total apurado</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{fmtCurrency(lote.total_valor || totalValor)}</span>
            </div>
            {lote.aprovado_em && (
              <div style={{ marginTop: 8, fontSize: 11, color: C.textSec }}>
                Aprovado em: <strong style={{ color: C.text }}>{fmtDatetime(lote.aprovado_em)}</strong>
                {lote.confirmado_por && <> por <strong style={{ color: C.text }}>{lote.confirmado_por}</strong></>}
              </div>
            )}
          </div>

          {/* Ações conforme status */}
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>AÇÕES</div>
            {lote.status === 'rascunho' && (
              <>
                <button onClick={() => setEnviarModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 7, background: '#FFFBEB', border: `1px solid #FCD34D`, color: C.amber, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <PaperAirplaneIcon style={{ width: 14, height: 14 }} /> Enviar ao Cliente
                </button>
                <button onClick={handleDesfazer} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 7, background: '#FEF2F2', border: `1px solid #FECACA`, color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <XMarkIcon style={{ width: 14, height: 14 }} /> Desfazer Lote
                </button>
              </>
            )}
            {lote.status === 'enviado_cliente' && (
              <>
                <button onClick={() => setDeAcordoModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 7, background: '#F0FDF4', border: `1px solid #86EFAC`, color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <CheckCircleIcon style={{ width: 14, height: 14 }} /> Registrar De Acordo
                </button>
                <button onClick={handleRecusar} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 7, background: '#FEF2F2', border: `1px solid #FECACA`, color: C.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <XCircleIcon style={{ width: 14, height: 14 }} /> Cliente Recusou
                </button>
              </>
            )}
            {lote.status === 'faturado' && (
              <button onClick={handleConfirmarPagamento} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 7, background: '#F0FDF4', border: `1px solid #86EFAC`, color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <BanknotesIcon style={{ width: 14, height: 14 }} /> Confirmar Pagamento Recebido
              </button>
            )}
            {(lote.status === 'aprovado_cliente' || lote.status === 'faturado' || lote.status === 'pago') && (
              <button onClick={handleDownloadPDF} disabled={downloadingPDF} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 7, background: '#EFF6FF', border: `1px solid #BFDBFE`, color: C.blue, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: downloadingPDF ? 0.6 : 1 }}>
                <ArrowDownTrayIcon style={{ width: 14, height: 14 }} /> {downloadingPDF ? 'Gerando PDF...' : lote.assinatura_url ? 'Baixar PDF Assinado' : 'Baixar PDF'}
              </button>
            )}
            {lote.comprovante_url && (
              <button onClick={() => window.open(lote.comprovante_url, '_blank')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 7, background: '#F5F3FF', border: `1px solid #C4B5FD`, color: C.purple, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <EyeIcon style={{ width: 14, height: 14 }} /> Ver Comprovante
              </button>
            )}
          </div>

          {/* Lançamentos */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>LANÇAMENTOS ({lancamentos?.length ?? '…'})</div>
            {lancamentos === null && <div style={{ fontSize: 12, color: C.textSec, padding: '12px 0' }}>Carregando...</div>}
            {lancamentos !== null && lancamentos.length === 0 && <div style={{ fontSize: 12, color: C.textSec }}>Nenhum lançamento neste lote.</div>}
            {lancamentos !== null && lancamentos.map(l => {
              const d = l.dados_extras || {}
              return (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${C.border}`, gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.empresa || d.cliente || l.descricao || '—'}</div>
                    <div style={{ fontSize: 10, color: C.textSec }}>{fmtDate(l.data)}{d.numero_rdo && ` · Nº ${d.numero_rdo}`}</div>
                  </div>
                  <span style={{ fontWeight: 700, color: C.green, fontSize: 12, whiteSpace: 'nowrap' }}>{fmtCurrency(l.valor)}</span>
                </div>
              )
            })}
            {lancamentos !== null && lancamentos.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Total</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.green }}>{fmtCurrency(totalValor)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {enviarModal && <EnviarModal lote={lote} workspaceId={lote.workspace_id} onClose={() => setEnviarModal(false)} onSent={() => { setEnviarModal(false); onClose(); onRefresh() }} />}
      {deAcordoModal && <DeAcordoModal lote={lote} onClose={() => setDeAcordoModal(false)} onSaved={() => { setDeAcordoModal(false); onClose(); onRefresh() }} />}
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function LotesERP() {
  const { workspaceId } = useStore()
  const navigate = useNavigate()
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [userId, setUserId] = useState(null)

  // Filtros
  const [filterStatus, setFilterStatus] = useState('todos')
  const [search, setSearch] = useState('')

  // UI
  const [drawerLote, setDrawerLote] = useState(null)
  const [criarModal, setCriarModal] = useState(false)
  const [actionMenuId, setActionMenuId] = useState(null)
  const [actionMenuPos, setActionMenuPos] = useState({ top: 0, right: 0 })
  const actionMenuRef = useRef(null)

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null))
  }, [])

  // Fecha action menu ao clicar fora
  useEffect(() => {
    if (!actionMenuId) return
    const h = (e) => { if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) setActionMenuId(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [actionMenuId])

  const loadData = useCallback(async () => {
    if (!supabase || !workspaceId) return
    setLoading(true)
    const { data, error } = await supabase.from('lotes_cliente').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
    if (error) { toast.error('Erro ao carregar lotes'); setLoading(false); return }

    // Enriquece com qtd + total de lançamentos
    const ids = (data || []).map(l => l.id)
    let enriched = data || []
    if (ids.length > 0) {
      const { data: lancs } = await supabase.from('lancamentos').select('lote_cliente_id, valor').in('lote_cliente_id', ids)
      const map = {}
      ;(lancs || []).forEach(l => { if (!map[l.lote_cliente_id]) map[l.lote_cliente_id] = { qtd: 0, total: 0 }; map[l.lote_cliente_id].qtd++; map[l.lote_cliente_id].total += l.valor || 0 })
      enriched = enriched.map(l => ({ ...l, qtd_lancamentos: map[l.id]?.qtd || 0, total_valor: map[l.id]?.total || 0 }))
    }
    setLotes(enriched)
    setLastUpdate(new Date())
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { loadData() }, [loadData])

  // KPIs
  const kpis = useMemo(() => {
    let rascunho = 0, aguardando = 0, aprovado = 0, recusado = 0, faturado = 0, totalPendente = 0, totalAprovado = 0
    for (const l of lotes) {
      if (l.status === 'rascunho') { rascunho++; totalPendente += l.total_valor || 0 }
      if (l.status === 'enviado_cliente') aguardando++
      if (l.status === 'aprovado_cliente') { aprovado++; totalAprovado += l.total_valor || 0 }
      if (l.status === 'recusado_cliente') recusado++
      if (l.status === 'faturado' || l.status === 'pago') faturado++
    }
    return { rascunho, aguardando, aprovado, recusado, faturado, totalPendente, totalAprovado }
  }, [lotes])

  // Filtrado
  const filtered = useMemo(() => lotes.filter(l => {
    if (filterStatus !== 'todos' && l.status !== filterStatus) return false
    if (search && !l.cliente.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [lotes, filterStatus, search])

  const inputSel = { padding: '5px 8px', borderRadius: 5, border: `1px solid ${C.border}`, background: C.white, color: C.text, fontSize: 12, outline: 'none', cursor: 'pointer' }

  return (
    <div style={{ background: C.bgPage, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '0 16px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, lineHeight: 1.2 }}>Lotes ao Cliente</div>
            <div style={{ fontSize: 11, color: C.textSec }}>Gestão de aprovação de lotes pelo cliente (De Acordo)</div>
          </div>
        </div>

        {/* Barra de ações */}
        <div style={{ display: 'flex', alignItems: 'center', height: 34, borderTop: `1px solid ${C.border}`, gap: 0 }}>
          {/* Atualização */}
          <span style={{ fontSize: 10, color: C.textSec, opacity: .7, marginRight: 4 }}>
            {lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
          <button onClick={loadData} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, padding: 2, display: 'flex', marginRight: 8 }}>
            <ArrowPathIcon style={{ width: 13, height: 13 }} />
          </button>
          <div style={{ width: 1, height: 18, background: C.border, margin: '0 8px' }} />

          {/* Botão principal */}
          <button onClick={() => setCriarModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: C.green, color: C.white, fontSize: 12, cursor: 'pointer', fontWeight: 700, boxShadow: `0 1px 3px rgba(5,150,105,0.3)` }}>
            <PlusIcon style={{ width: 13, height: 13 }} /> Novo Lote
          </button>
          <button onClick={() => navigate('/lancamentos-erp')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1px solid #BFDBFE`, background: '#EFF6FF', color: C.blue, fontSize: 12, cursor: 'pointer', fontWeight: 600, marginLeft: 6 }}>
            <DocumentTextIcon style={{ width: 12, height: 12 }} /> Lançamentos
          </button>

          {/* Exportar CSV */}
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={() => {
              const header = 'Cliente;Status;Lançamentos;Total (R$);Criado Em'
              const rows = filtered.map(l => `${l.cliente};${STATUS_MAP[l.status]?.label || l.status};${l.qtd_lancamentos || 0};${(l.total_valor || 0).toFixed(2).replace('.', ',')};${fmtDatetime(l.created_at)}`)
              const csv = '\uFEFF' + [header, ...rows].join('\r\n')
              const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
              const a = document.createElement('a'); a.href = url; a.download = `lotes-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
            }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <TableCellsIcon style={{ width: 12, height: 12, color: C.green }} /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '12px 16px' }}>

        {/* KPI STRIP */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', alignItems: 'stretch', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {[
            { label: 'Total de Lotes',      value: lotes.length,          color: C.navy,   accent: '#F8FAFC', Icon: UserGroupIcon,          alert: false },
            { label: 'Rascunho',            value: kpis.rascunho,         color: C.textSec, accent: '#F8FAFC', Icon: DocumentTextIcon,       alert: false },
            { label: 'Aguardando Cliente',  value: kpis.aguardando,       color: C.amber,   accent: kpis.aguardando > 0 ? '#FFFBEB' : '#F8FAFC', Icon: ClockIcon, alert: kpis.aguardando > 0 },
            { label: 'Aprovados',           value: kpis.aprovado,         color: C.green,   accent: '#F0FDF4', Icon: CheckCircleIcon,        alert: false },
            { label: 'Recusados',           value: kpis.recusado,         color: C.red,     accent: kpis.recusado > 0 ? '#FEF2F2' : '#F8FAFC', Icon: XCircleIcon, alert: kpis.recusado > 0 },
            { label: 'Valor Aprovado',      value: fmtCurrency(kpis.totalAprovado), color: C.green, accent: '#F0FDF4', Icon: BanknotesIcon, alert: false },
          ].map(({ label, value, color, accent, Icon, alert }, i, arr) => (
            <div key={label} style={{ flex: 1, padding: '10px 14px', borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', borderLeft: `3px solid ${alert ? color : 'transparent'}`, background: accent, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 7, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 15, height: 15, color }} />
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: alert ? color : C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 1 }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FILTROS */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FunnelIcon style={{ width: 11, height: 11 }} /> Filtros
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {/* Busca */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>BUSCAR</div>
              <div style={{ position: 'relative' }}>
                <MagnifyingGlassIcon style={{ width: 13, height: 13, color: C.textSec, position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome do cliente..." style={{ ...inputSel, paddingLeft: 24, width: 180 }} />
              </div>
            </div>
            {/* Status */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>STATUS</div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputSel}>
                <option value="todos">Todos</option>
                <option value="rascunho">Rascunho</option>
                <option value="enviado_cliente">Aguardando Cliente</option>
                <option value="aprovado_cliente">Aprovado pelo Cliente</option>
                <option value="recusado_cliente">Recusado</option>
                <option value="faturado">Faturado</option>
                <option value="pago">Pago / Recebido</option>
              </select>
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button onClick={() => { setFilterStatus('todos'); setSearch('') }}
                style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, fontSize: 12, cursor: 'pointer', height: 29 }}>Limpar</button>
            </div>
          </div>
        </div>

        {/* TABELA */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserGroupIcon style={{ width: 14, height: 14, color: C.navy }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>Lotes</span>
              <span style={{ fontSize: 11, color: C.textSec }}>({filtered.length} registro{filtered.length !== 1 ? 's' : ''})</span>
            </div>
            {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textSec }}><ArrowPathIcon style={{ width: 12, height: 12 }} /> Carregando...</div>}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: C.navy }}>
                  {[
                    { label: 'CLIENTE',           width: 200 },
                    { label: 'STATUS',            width: 160 },
                    { label: 'LANÇAMENTOS',       width: 100, align: 'center' },
                    { label: 'VALOR TOTAL',       width: 130, align: 'right' },
                    { label: 'CRIADO EM',         width: 140 },
                    { label: 'APROVADO EM',       width: 140 },
                    { label: 'CONFIRMADO POR',    width: 160 },
                    { label: 'AÇÕES',             width: 80, align: 'center' },
                  ].map(({ label, width, align }) => (
                    <th key={label} style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, letterSpacing: .5, color: C.white, textAlign: align || 'left', whiteSpace: 'nowrap', minWidth: width, borderRight: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.18)' }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: C.textSec, fontSize: 13 }}>Nenhum lote encontrado.</td></tr>
                )}
                {filtered.map((lote, idx) => {
                  const isOpen = actionMenuId === lote.id
                  const rowBg = idx % 2 === 0 ? C.white : '#F8FAFC'
                  return (
                    <tr key={lote.id}
                      style={{ background: rowBg, cursor: 'pointer', borderLeft: lote.status === 'recusado_cliente' ? `3px solid ${C.red}` : lote.status === 'aprovado_cliente' ? `3px solid ${C.green}` : lote.status === 'enviado_cliente' ? `3px solid ${C.amber}` : '3px solid transparent' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
                      onMouseLeave={e => e.currentTarget.style.background = rowBg}
                      onClick={() => setDrawerLote(lote)}
                    >
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid #EEF2F7`, fontWeight: 700, color: C.navy }}>{lote.cliente}</td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid #EEF2F7` }}><StatusBadge status={lote.status} /></td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid #EEF2F7`, textAlign: 'center', fontWeight: 700 }}>{lote.qtd_lancamentos || 0}</td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid #EEF2F7`, textAlign: 'right', fontWeight: 800, color: C.green }}>{fmtCurrency(lote.total_valor || 0)}</td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid #EEF2F7`, color: C.textSec }}>{fmtDatetime(lote.created_at)}</td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid #EEF2F7`, color: C.textSec }}>{lote.aprovado_em ? fmtDatetime(lote.aprovado_em) : '—'}</td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid #EEF2F7`, color: C.text }}>{lote.confirmado_por || '—'}</td>
                      {/* AÇÕES */}
                      <td onClick={e => e.stopPropagation()} style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, textAlign: 'center', position: 'relative' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            onClick={(e) => {
                              if (isOpen) { setActionMenuId(null); return }
                              const rect = e.currentTarget.getBoundingClientRect()
                              setActionMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                              setActionMenuId(lote.id)
                            }}
                            style={{ display: 'flex', alignItems: 'center', padding: '3px 6px', borderRadius: 4, border: `1px solid ${C.border}`, background: C.white, color: C.navy, cursor: 'pointer' }}>
                            <ChevronDownIcon style={{ width: 13, height: 13 }} />
                          </button>
                          {isOpen && (
                            <div ref={actionMenuRef} style={{ position: 'fixed', right: actionMenuPos.right, top: actionMenuPos.top, zIndex: 9999, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 200, overflow: 'hidden' }}>
                              {[
                                { label: 'Ver detalhes',         icon: EyeIcon,            action: () => setDrawerLote(lote) },
                                { label: 'Enviar ao cliente',    icon: PaperAirplaneIcon,  disabled: lote.status !== 'rascunho', action: () => { setDrawerLote(lote) } },
                                { label: 'Registrar De Acordo',  icon: CheckCircleIcon,    disabled: lote.status !== 'enviado_cliente', action: () => setDrawerLote(lote) },
                                { label: 'Baixar PDF',           icon: ArrowDownTrayIcon,  disabled: !['aprovado_cliente', 'faturado', 'pago'].includes(lote.status), action: () => setDrawerLote(lote) },
                                { label: 'Ver no clássico',      icon: DocumentTextIcon,   action: () => navigate('/lotes-cliente') },
                              ].map(item => (
                                <button key={item.label} disabled={item.disabled} onClick={() => { item.action(); setActionMenuId(null) }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', background: 'none', border: 'none', color: item.disabled ? '#CBD5E1' : C.text, fontSize: 12, cursor: item.disabled ? 'not-allowed' : 'pointer', textAlign: 'left', borderBottom: `1px solid ${C.border}`, opacity: item.disabled ? 0.5 : 1 }}
                                  onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = '#F8FAFC' }}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                  <item.icon style={{ width: 13, height: 13, color: item.disabled ? '#CBD5E1' : C.textSec }} />
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RODAPÉ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textSec }}>
          <span>SmartPro © 2026 — Todos os direitos reservados</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>Versão 2.5.0</span>
            <span style={{ background: '#F0FDF4', color: C.green, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Produção</span>
          </div>
        </div>
      </div>

      {/* DRAWER */}
      {drawerLote && (
        <LoteDrawer
          lote={drawerLote}
          onClose={() => setDrawerLote(null)}
          onRefresh={loadData}
        />
      )}

      {/* MODAL CRIAR */}
      {criarModal && (
        <CriarLoteModal
          workspaceId={workspaceId}
          userId={userId}
          onClose={() => setCriarModal(false)}
          onSaved={() => { setCriarModal(false); loadData() }}
        />
      )}
    </div>
  )
}
