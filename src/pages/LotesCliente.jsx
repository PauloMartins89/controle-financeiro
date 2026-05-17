import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import {
  CheckCircleIcon, XCircleIcon, ClockIcon, PaperAirplaneIcon,
  ChevronDownIcon, ChevronUpIcon, PhotoIcon, DocumentTextIcon,
  ArrowPathIcon, PlusIcon, XMarkIcon, UserGroupIcon,
  ArrowUpTrayIcon, BanknotesIcon,
} from '@heroicons/react/24/outline'

// ── Status ────────────────────────────────────────────────────────────────────
const STATUS_CONF = {
  rascunho:          { label: 'Rascunho',           color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: DocumentTextIcon },
  enviado_cliente:   { label: 'Aguardando Cliente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: ClockIcon },
  aprovado_cliente:  { label: 'Aprovado pelo Cliente', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: CheckCircleIcon },
  recusado_cliente:  { label: 'Recusado pelo Cliente', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: XCircleIcon },
}

function StatusChip({ status }) {
  const c = STATUS_CONF[status] || STATUS_CONF.rascunho
  const Icon = c.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>
      <Icon style={{ width: 11, height: 11 }} />{c.label}
    </span>
  )
}

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

// ── Modal: Criar Lote ─────────────────────────────────────────────────────────
function CriarLoteModal({ workspaceId, userId, onClose, onSaved }) {
  const [cliente, setCliente] = useState('')
  const [obs, setObs] = useState('')
  const [rascunhos, setRascunhos] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('lancamentos')
      .select('id, data, descricao, valor, dados_extras, status, lote_cliente_id')
      .eq('status', 'rascunho')
      .is('lote_cliente_id', null)
      .order('data', { ascending: false })
      .then(({ data }) => { setRascunhos(data || []); setLoading(false) })
  }, [])

  function toggle(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    if (rascunhos.every(r => selected.has(r.id))) setSelected(new Set())
    else setSelected(new Set(rascunhos.map(r => r.id)))
  }

  async function handleSave() {
    if (!cliente.trim()) { toast.error('Informe o nome do cliente.'); return }
    if (selected.size === 0) { toast.error('Selecione ao menos 1 lançamento.'); return }
    setSaving(true)
    try {
      const { data: lote, error: errLote } = await supabase
        .from('lotes_cliente')
        .insert({ workspace_id: workspaceId, cliente: cliente.trim(), observacoes: obs.trim() || null, created_by: userId, status: 'rascunho' })
        .select('id')
        .single()
      if (errLote) throw errLote

      const ids = [...selected]
      const { error: errUp } = await supabase
        .from('lancamentos')
        .update({ lote_cliente_id: lote.id })
        .in('id', ids)
      if (errUp) throw errUp

      toast.success(`Lote criado com ${ids.length} lançamento(s).`)
      onSaved()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Criar Lote para Cliente</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
        </div>

        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>CLIENTE *</label>
            <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nome do cliente"
              style={{ width: '100%', marginTop: 4, padding: '9px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>OBSERVAÇÕES</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional..."
              style={{ width: '100%', marginTop: 4, padding: '9px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
              RASCUNHOS DISPONÍVEIS {loading ? '' : `(${rascunhos.length})`}
            </div>
            {rascunhos.length > 0 && (
              <button onClick={toggleAll} style={{ fontSize: 12, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                {rascunhos.every(r => selected.has(r.id)) ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            )}
          </div>
          {loading ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '20px 0' }}>Carregando...</div>
          ) : rascunhos.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
              Nenhum rascunho disponível (sem lote)
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rascunhos.map(l => {
                const d = l.dados_extras || {}
                const isSelected = selected.has(l.id)
                return (
                  <div key={l.id} onClick={() => toggle(l.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', background: isSelected ? 'rgba(99,102,241,0.1)' : 'var(--bg-primary)', border: `1px solid ${isSelected ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`, transition: 'all 0.15s' }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(l.id)} onClick={e => e.stopPropagation()} style={{ width: 14, height: 14, accentColor: '#818cf8', cursor: 'pointer' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.cliente || d.empresa || l.descricao || '—'}
                        {d.numero_diario && <span style={{ marginLeft: 8, fontSize: 11, color: '#818cf8', fontWeight: 800 }}>Nº {d.numero_diario}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {fmtDate(l.data)} {d.condutor && `· ${d.condutor}`} {d.placa && `· ${d.placa}`}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#10b981', fontSize: 13, whiteSpace: 'nowrap' }}>{fmtCurrency(l.valor)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {selected.size > 0 && <span><strong style={{ color: 'var(--text-primary)' }}>{selected.size}</strong> selecionado(s) · {fmtCurrency([...selected].reduce((s, id) => s + (rascunhos.find(r => r.id === id)?.valor || 0), 0))}</span>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving || selected.size === 0 || !cliente.trim()} style={{ padding: '9px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, opacity: (saving || selected.size === 0 || !cliente.trim()) ? 0.6 : 1 }}>
              {saving ? 'Criando...' : 'Criar Lote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Registrar De Acordo ────────────────────────────────────────────────
function DeAcordoModal({ lote, workspaceId, onClose, onSaved }) {
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
        } catch (upErr) {
          // Upload falhou — registra De Acordo sem comprovante e avisa
          toast('Aviso: comprovante não pôde ser enviado (bucket não configurado). De Acordo registrado sem arquivo.', { icon: '⚠️' })
        }
      }

      // Atualiza lote
      const { error: errLote } = await supabase
        .from('lotes_cliente')
        .update({ status: 'aprovado_cliente', comprovante_url, observacoes: obs || null, updated_at: new Date().toISOString() })
        .eq('id', lote.id)
      if (errLote) throw errLote

      // Avança TODOS os lançamentos do lote para aguardando_aprovacao
      const { error: errLanc } = await supabase
        .from('lancamentos')
        .update({ status: 'aguardando_aprovacao' })
        .eq('lote_cliente_id', lote.id)
      if (errLanc) throw errLanc

      toast.success('De Acordo registrado! Lançamentos enviados para Faturamento.')
      onSaved()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 480, border: '1px solid var(--border)' }}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Registrar De Acordo</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{lote.cliente}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
        </div>

        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 13, color: '#10b981' }}>
            ✔ Ao confirmar, todos os lançamentos deste lote serão enviados automaticamente para <strong>Faturamento (Aguardando Aprovação)</strong>.
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>COMPROVANTE DO DE ACORDO (PDF, imagem)</label>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0])}
              style={{ marginTop: 6, width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>OBSERVAÇÕES</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3}
              style={{ width: '100%', marginTop: 4, padding: '9px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Registrando...' : 'Confirmar De Acordo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Gerar Lotes por Cliente (automático) ───────────────────────────────
function GerarLotesModal({ lancamentos, workspaceId, userId, onClose, onSaved }) {
  const grupos = (() => {
    const mapa = {}
    lancamentos.forEach(l => {
      const key = (l.dados_extras?.cliente || l.dados_extras?.empresa || l.descricao || 'Sem Cliente').trim()
      if (!mapa[key]) mapa[key] = []
      mapa[key].push(l)
    })
    return Object.entries(mapa)
      .map(([cliente, itens]) => ({ cliente, itens, total: itens.reduce((s, i) => s + (i.valor || 0), 0) }))
      .sort((a, b) => a.cliente.localeCompare(b.cliente))
  })()

  const [desabilitados, setDesabilitados] = useState(new Set())
  const [saving, setSaving] = useState(false)

  function toggleGrupo(cliente) {
    setDesabilitados(prev => {
      const n = new Set(prev)
      n.has(cliente) ? n.delete(cliente) : n.add(cliente)
      return n
    })
  }

  const gruposAtivos = grupos.filter(g => !desabilitados.has(g.cliente))
  const totalItens = gruposAtivos.reduce((s, g) => s + g.itens.length, 0)
  const totalValor = gruposAtivos.reduce((s, g) => s + g.total, 0)

  async function handleConfirmar() {
    if (gruposAtivos.length === 0) { toast.error('Selecione ao menos 1 grupo.'); return }
    setSaving(true)
    try {
      let criados = 0, adicionados = 0
      for (const grupo of gruposAtivos) {
        const { data: existente } = await supabase
          .from('lotes_cliente')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('cliente', grupo.cliente)
          .eq('status', 'rascunho')
          .maybeSingle()
        let loteId
        if (existente?.id) {
          loteId = existente.id
          adicionados++
        } else {
          const { data: novo, error: errNovo } = await supabase
            .from('lotes_cliente')
            .insert({ workspace_id: workspaceId, cliente: grupo.cliente, status: 'rascunho', created_by: userId })
            .select('id')
            .single()
          if (errNovo) throw errNovo
          loteId = novo.id
          criados++
        }
        const ids = grupo.itens.filter(l => !l.lote_cliente_id).map(l => l.id)
        if (ids.length > 0) {
          const { error: errUp } = await supabase
            .from('lancamentos')
            .update({ lote_cliente_id: loteId })
            .in('id', ids)
          if (errUp) throw errUp
        }
      }
      const msg = [
        criados > 0 && `${criados} lote(s) criado(s)`,
        adicionados > 0 && `${adicionados} já existente(s) atualizado(s)`,
      ].filter(Boolean).join(' · ')
      toast.success(msg || 'Lotes gerados!')
      onSaved()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserGroupIcon style={{ width: 20, height: 20, color: '#818cf8' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Gerar Lotes por Cliente</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {grupos.length} cliente(s) · {lancamentos.length} lançamento(s)
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Info */}
        <div style={{ margin: '12px 22px 0', padding: '10px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 12, color: '#818cf8', lineHeight: 1.6 }}>
          1 lote por cliente. Se já houver um lote em <strong>rascunho</strong> com o mesmo nome, os itens são adicionados. Desmarque clientes que não devem gerar lote agora.
        </div>

        {/* Grupos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 22px' }}>
          {grupos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>
              Nenhum lançamento disponível para agrupar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {grupos.map(grupo => {
                const ativo = !desabilitados.has(grupo.cliente)
                return (
                  <div key={grupo.cliente} onClick={() => toggleGrupo(grupo.cliente)}
                    style={{ borderRadius: 12, border: `1px solid ${ativo ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`, background: ativo ? 'rgba(99,102,241,0.06)' : 'var(--bg-primary)', cursor: 'pointer', transition: 'all 0.15s', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="checkbox" checked={ativo} onChange={() => toggleGrupo(grupo.cliente)} onClick={e => e.stopPropagation()} style={{ width: 15, height: 15, accentColor: '#818cf8', cursor: 'pointer', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: ativo ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grupo.cliente}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {grupo.itens.length} lançamento(s)
                          {grupo.itens.some(l => l.lote_cliente_id) && <span style={{ marginLeft: 6, color: '#f59e0b' }}>⚠ {grupo.itens.filter(l => l.lote_cliente_id).length} já em lote (mantidos)</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: ativo ? '#10b981' : 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtCurrency(grupo.total)}</div>
                    </div>
                    {ativo && (
                      <div style={{ borderTop: '1px solid var(--border)' }}>
                        {grupo.itens.slice(0, 4).map((l, i) => {
                          const d = l.dados_extras || {}
                          return (
                            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 14px 7px 38px', borderBottom: i < Math.min(grupo.itens.length, 4) - 1 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                                {d.numero_diario && <span style={{ fontSize: 10, fontWeight: 800, color: '#818cf8', flexShrink: 0 }}>Nº {d.numero_diario}</span>}
                                {d.placa && <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', flexShrink: 0 }}>{d.placa}</span>}
                                <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.condutor || l.descricao || '—'}</span>
                              </div>
                              <span style={{ fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap', marginLeft: 8 }}>{fmtCurrency(l.valor)}</span>
                            </div>
                          )
                        })}
                        {grupo.itens.length > 4 && (
                          <div style={{ padding: '6px 14px 8px 38px', fontSize: 11, color: 'var(--text-secondary)' }}>+ {grupo.itens.length - 4} item(ns) adicional(is)</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {gruposAtivos.length > 0
              ? <><strong style={{ color: 'var(--text-primary)' }}>{gruposAtivos.length}</strong> lote(s) · <strong style={{ color: '#10b981' }}>{fmtCurrency(totalValor)}</strong> · {totalItens} item(ns)</>
              : 'Nenhum grupo selecionado'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
            <button onClick={handleConfirmar} disabled={saving || gruposAtivos.length === 0}
              style={{ padding: '9px 22px', borderRadius: 9, background: saving || gruposAtivos.length === 0 ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg,#4f46e5,#818cf8)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7, opacity: gruposAtivos.length === 0 ? 0.6 : 1 }}>
              <UserGroupIcon style={{ width: 15, height: 15 }} />
              {saving ? 'Gerando...' : `Gerar ${gruposAtivos.length} Lote(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card do Lote ──────────────────────────────────────────────────────────────
function LoteCard({ lote, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [lancamentos, setLancamentos] = useState([])
  const [loadingLanc, setLoadingLanc] = useState(false)
  const [deAcordoModal, setDeAcordoModal] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadLancamentos() {
    if (lancamentos.length > 0) { setExpanded(e => !e); return }
    setExpanded(true)
    setLoadingLanc(true)
    const { data } = await supabase.from('lancamentos').select('id, data, descricao, valor, status, dados_extras').eq('lote_cliente_id', lote.id).order('data')
    setLancamentos(data || [])
    setLoadingLanc(false)
  }

  async function handleEnviar() {
    if (!window.confirm(`Marcar lote "${lote.cliente}" como Enviado ao Cliente?`)) return
    setSaving(true)
    await supabase.from('lotes_cliente').update({ status: 'enviado_cliente', updated_at: new Date().toISOString() }).eq('id', lote.id)
    setSaving(false)
    toast.success('Lote marcado como enviado ao cliente.')
    onRefresh()
  }

  async function handleRecusar() {
    if (!window.confirm('Marcar como Recusado pelo cliente? Os lançamentos voltarão a ficar disponíveis.')) return
    setSaving(true)
    await supabase.from('lotes_cliente').update({ status: 'recusado_cliente', updated_at: new Date().toISOString() }).eq('id', lote.id)
    // Volta lançamentos para rascunho
    await supabase.from('lancamentos').update({ status: 'rascunho' }).eq('lote_cliente_id', lote.id).eq('status', 'aguardando_aprovacao')
    setSaving(false)
    toast('Lote marcado como recusado. Lançamentos voltaram para rascunho.')
    onRefresh()
  }

  async function handleDesfazer() {
    if (!window.confirm('Desfazer lote? Os lançamentos voltarão como rascunhos individuais.')) return
    setSaving(true)
    await supabase.from('lancamentos').update({ lote_cliente_id: null }).eq('lote_cliente_id', lote.id)
    await supabase.from('lotes_cliente').delete().eq('id', lote.id)
    setSaving(false)
    toast('Lote desfeito.')
    onRefresh()
  }

  const st = STATUS_CONF[lote.status] || STATUS_CONF.rascunho

  return (
    <>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
        {/* Header do card */}
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={loadLancamentos}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{lote.cliente}</span>
              <StatusChip status={lote.status} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>{lote.qtd_lancamentos || 0} lançamento(s)</span>
              <span style={{ fontWeight: 700, color: '#10b981' }}>{fmtCurrency(lote.total_valor || 0)}</span>
              <span>Criado {fmtDatetime(lote.created_at)}</span>
            </div>
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            {lote.comprovante_url && (
              <button title="Ver comprovante" onClick={() => window.open(lote.comprovante_url, '_blank')}
                style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(99,102,241,0.1)', border: 'none', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700 }}>
                <PhotoIcon style={{ width: 14, height: 14 }} /> Comprovante
              </button>
            )}
            {lote.status === 'rascunho' && (
              <>
                <button onClick={handleEnviar} disabled={saving}
                  title="Marcar como enviado ao cliente"
                  style={{ padding: '6px 12px', borderRadius: 7, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700 }}>
                  <PaperAirplaneIcon style={{ width: 14, height: 14 }} /> Enviar ao Cliente
                </button>
                <button onClick={handleDesfazer} disabled={saving} title="Desfazer lote"
                  style={{ padding: '6px 10px', borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                  <XMarkIcon style={{ width: 16, height: 16 }} />
                </button>
              </>
            )}
            {lote.status === 'enviado_cliente' && (
              <>
                <button onClick={() => setDeAcordoModal(true)} disabled={saving}
                  title="Registrar De Acordo do cliente"
                  style={{ padding: '6px 12px', borderRadius: 7, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer', color: '#10b981', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700 }}>
                  <CheckCircleIcon style={{ width: 14, height: 14 }} /> Registrar De Acordo
                </button>
                <button onClick={handleRecusar} disabled={saving} title="Cliente recusou"
                  style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                  <XCircleIcon style={{ width: 14, height: 14 }} />
                </button>
              </>
            )}
          </div>

          <div style={{ color: 'var(--text-secondary)' }}>
            {expanded ? <ChevronUpIcon style={{ width: 18, height: 18 }} /> : <ChevronDownIcon style={{ width: 18, height: 18 }} />}
          </div>
        </div>

        {/* Lançamentos expandidos */}
        {expanded && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {loadingLanc ? (
              <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</div>
            ) : lancamentos.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum lançamento neste lote.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-primary)' }}>
                    {['DATA', 'Nº DM', 'CLIENTE / DESC.', 'CONDUTOR', 'PLACA', 'VALOR', 'STATUS'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: h === 'VALOR' ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map(l => {
                    const d = l.dados_extras || {}
                    const SC = STATUS_CONF[l.status]
                    return (
                      <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(l.data)}</td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {d.numero_diario ? <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{d.numero_diario}</span> : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{d.cliente || d.empresa || l.descricao}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{d.condutor || '—'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap' }}>{d.placa || '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>{fmtCurrency(l.valor)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {SC && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: STATUS_CONF[l.status]?.bg || 'rgba(148,163,184,0.12)', color: STATUS_CONF[l.status]?.color || '#94a3b8' }}>
                              {STATUS_CONF[l.status]?.label || l.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {deAcordoModal && (
        <DeAcordoModal
          lote={lote}
          workspaceId={lote.workspace_id}
          onClose={() => setDeAcordoModal(false)}
          onSaved={() => { setDeAcordoModal(false); onRefresh() }}
        />
      )}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function LotesCliente() {
  const { workspaceId } = useStore()
  const [lotes, setLotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('todos')
  const [search, setSearch] = useState('')
  const [criarModal, setCriarModal] = useState(false)
  const [gerarModal, setGerarModal] = useState(false)
  const [gerarLancs, setGerarLancs] = useState([])
  const [loadingGerar, setLoadingGerar] = useState(false)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null))
  }, [])

  const loadData = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    // Busca lotes com contagem e total
    const { data, error } = await supabase
      .from('lotes_cliente')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { toast.error('Erro ao carregar lotes'); setLoading(false); return }

    // Enriquece com qtd e total de lançamentos
    const ids = (data || []).map(l => l.id)
    let enriched = data || []
    if (ids.length > 0) {
      const { data: lancs } = await supabase
        .from('lancamentos')
        .select('lote_cliente_id, valor')
        .in('lote_cliente_id', ids)

      const map = {}
      ;(lancs || []).forEach(l => {
        if (!map[l.lote_cliente_id]) map[l.lote_cliente_id] = { qtd: 0, total: 0 }
        map[l.lote_cliente_id].qtd++
        map[l.lote_cliente_id].total += l.valor || 0
      })
      enriched = enriched.map(l => ({ ...l, qtd_lancamentos: map[l.id]?.qtd || 0, total_valor: map[l.id]?.total || 0 }))
    }

    setLotes(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = lotes.filter(l => {
    if (filterStatus !== 'todos' && l.status !== filterStatus) return false
    if (search && !l.cliente.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Totais por status
  const counts = lotes.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc }, {})

  async function handleAbrirGerar() {
    setLoadingGerar(true)
    const { data, error } = await supabase
      .from('lancamentos')
      .select('id, data, descricao, valor, dados_extras, lote_cliente_id, status')
      .eq('status', 'rascunho')
      .is('lote_cliente_id', null)
      .order('data', { ascending: false })
    setLoadingGerar(false)
    if (error) { toast.error('Erro ao carregar lançamentos'); return }
    if (!data || data.length === 0) { toast('Nenhum rascunho disponível sem lote.', { icon: 'ℹ️' }); return }
    setGerarLancs(data)
    setGerarModal(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      <Header title="Lotes ao Cliente" subtitle="Gestão de aprovação de lotes pelo cliente (De Acordo)" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'RASCUNHO',         value: counts.rascunho || 0,         color: '#94a3b8' },
            { label: 'AGUARD. CLIENTE',  value: counts.enviado_cliente || 0,  color: '#f59e0b' },
            { label: 'APROVADOS',        value: counts.aprovado_cliente || 0, color: '#10b981' },
            { label: 'RECUSADOS',        value: counts.recusado_cliente || 0, color: '#ef4444' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 18px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Barra de ações */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente..."
            style={{ flex: 1, minWidth: 160, padding: '9px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer' }}>
            <option value="todos">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="enviado_cliente">Aguardando Cliente</option>
            <option value="aprovado_cliente">Aprovados</option>
            <option value="recusado_cliente">Recusados</option>
          </select>
          <button onClick={handleAbrirGerar} disabled={loadingGerar}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', opacity: loadingGerar ? 0.7 : 1 }}>
            <UserGroupIcon style={{ width: 16, height: 16 }} />
            {loadingGerar ? 'Carregando...' : 'Gerar Automático'}
          </button>
          <button onClick={() => setCriarModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
            <PlusIcon style={{ width: 16, height: 16 }} /> Novo Lote
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <UserGroupIcon style={{ width: 52, height: 52, color: 'var(--text-secondary)', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Nenhum lote encontrado.</p>
            <button onClick={() => setCriarModal(true)}
              style={{ marginTop: 12, padding: '9px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
              Criar primeiro lote
            </button>
          </div>
        ) : (
          filtered.map(lote => (
            <LoteCard key={lote.id} lote={lote} onRefresh={loadData} />
          ))
        )}
      </div>

      {criarModal && (
        <CriarLoteModal
          workspaceId={workspaceId}
          userId={userId}
          onClose={() => setCriarModal(false)}
          onSaved={() => { setCriarModal(false); loadData() }}
        />
      )}
      {gerarModal && (
        <GerarLotesModal
          lancamentos={gerarLancs}
          workspaceId={workspaceId}
          userId={userId}
          onClose={() => setGerarModal(false)}
          onSaved={() => { setGerarModal(false); loadData() }}
        />
      )}
    </div>
  )
}
