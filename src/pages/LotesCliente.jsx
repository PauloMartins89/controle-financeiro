import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/utils'
import { buildLotePDFDoc } from '../lib/exportPDF'
import {
  CheckCircleIcon, XCircleIcon, ClockIcon, PaperAirplaneIcon,
  ChevronDownIcon, ChevronUpIcon, PhotoIcon, DocumentTextIcon,
  ArrowPathIcon, PlusIcon, XMarkIcon, UserGroupIcon,
  ArrowUpTrayIcon, BanknotesIcon, LinkIcon, ArrowDownTrayIcon,
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
  const [clienteId, setClienteId] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [clientes, setClientes] = useState([])
  const [showDrop, setShowDrop] = useState(false)
  const [obs, setObs] = useState('')
  const [rascunhos, setRascunhos] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmDivModal, setConfirmDivModal] = useState(false)
  const [clientesDivergentes, setClientesDivergentes] = useState([])

  useEffect(() => {
    if (!supabase) return
    // Carrega clientes cadastrados (inclui aprovador N1 para salvar no lote)
    supabase.from('cadastros_clientes').select('id, nome, aprovador_n1_nome').eq('workspace_id', workspaceId).order('nome')
      .then(({ data }) => setClientes(data || []))
    // Carrega rascunhos
    supabase
      .from('lancamentos')
      .select('id, data, descricao, valor, dados_extras, status, lote_cliente_id')
      .eq('status', 'rascunho')
      .is('lote_cliente_id', null)
      .order('data', { ascending: false })
      .then(({ data }) => { setRascunhos(data || []); setLoading(false) })
  }, [])

  const clientesFiltrados = clienteSearch.trim()
    ? clientes.filter(c => c.nome.toLowerCase().includes(clienteSearch.toLowerCase()))
    : clientes

  function selecionarCliente(c) {
    setClienteId(c.id)
    setClienteNome(c.nome)
    setClienteSearch(c.nome)
    setShowDrop(false)
  }

  function toggle(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    if (rascunhos.every(r => selected.has(r.id))) setSelected(new Set())
    else setSelected(new Set(rascunhos.map(r => r.id)))
  }

  async function executarSave() {
    const nomeUsar = clienteNome.trim() || clienteSearch.trim()
    setSaving(true)
    setConfirmDivModal(false)
    try {
      // Busca aprovador N1 do cliente selecionado
      const clienteSelecionado = clientes.find(c => c.id === clienteId || c.nome === nomeUsar)
      const payload = {
        workspace_id: workspaceId,
        cliente: nomeUsar,
        observacoes: obs.trim() || null,
        created_by: userId,
        status: 'rascunho',
        aprovador_nome: clienteSelecionado?.aprovador_n1_nome || null,
      }
      if (clienteId) payload.cliente_id = clienteId

      const { data: lote, error: errLote } = await supabase
        .from('lotes_cliente')
        .insert(payload)
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

  async function handleSave() {
    const nomeUsar = clienteNome.trim() || clienteSearch.trim()
    if (!nomeUsar) { toast.error('Informe o cliente.'); return }
    if (selected.size === 0) { toast.error('Selecione ao menos 1 lançamento.'); return }
    // Verifica se há lançamentos com clientes diferentes entre si (mesma lógica da coluna CLIENTE/DESCRIÇÃO)
    const selecionados = rascunhos.filter(r => selected.has(r.id))
    const getNomeCliente = r => (r.dados_extras?.cliente || r.dados_extras?.empresa || r.descricao || '').trim().toLowerCase()
    const nomesUnicos = [...new Set(selecionados.map(getNomeCliente).filter(Boolean))]
    if (nomesUnicos.length > 1) {
      const nomesDiv = [...new Set(
        selecionados.map(r => r.dados_extras?.cliente || r.dados_extras?.empresa || r.descricao || '').filter(Boolean)
      )]
      setClientesDivergentes(nomesDiv)
      setConfirmDivModal(true)
      return
    }
    await executarSave()
  }

  return (
    <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Criar Lote para Cliente</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
        </div>

        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700 }}>CLIENTE *</label>
            <input
              value={clienteSearch}
              onChange={e => { setClienteSearch(e.target.value); setClienteId(''); setClienteNome(''); setShowDrop(true) }}
              onFocus={() => setShowDrop(true)}
              onBlur={() => setTimeout(() => setShowDrop(false), 180)}
              placeholder="Buscar cliente cadastrado..."
              style={{ width: '100%', marginTop: 4, padding: '9px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: `1px solid ${clienteId ? 'rgba(99,102,241,0.5)' : 'var(--border)'}`, color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
            {clienteId && <span style={{ position: 'absolute', right: 12, top: 32, fontSize: 12, color: '#818cf8', fontWeight: 700 }}>✓</span>}
            {showDrop && clientesFiltrados.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxHeight: 180, overflowY: 'auto', marginTop: 2 }}>
                {clientesFiltrados.map(c => (
                  <div key={c.id} onMouseDown={() => selecionarCliente(c)}
                    style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {c.nome}
                  </div>
                ))}
              </div>
            )}
            {showDrop && clienteSearch.trim() && clientesFiltrados.length === 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Nenhum cliente encontrado — será criado como texto livre
              </div>
            )}
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
            <button onClick={handleSave} disabled={saving || selected.size === 0 || !(clienteNome.trim() || clienteSearch.trim())} style={{ padding: '9px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, opacity: (saving || selected.size === 0 || !(clienteNome.trim() || clienteSearch.trim())) ? 0.6 : 1 }}>
              {saving ? 'Criando...' : 'Criar Lote'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Modal: Clientes divergentes */}
    {confirmDivModal && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 500, border: '1px solid rgba(245,158,11,0.4)', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
          {/* Header */}
          <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>⚠️</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#f59e0b' }}>Atenção — Clientes Diferentes</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Verificação de consistência do lote</div>
            </div>
          </div>
          {/* Corpo */}
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              Um ou mais lançamentos selecionados pertencem a clientes <strong>diferentes</strong> do cliente informado no lote:
            </p>
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {clientesDivergentes.map((c, i) => (
                <div key={i} style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ opacity: 0.7 }}>•</span> {c}
                </div>
              ))}
            </div>
            {/* Contexto legal */}
            <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.22)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 5, fontSize: 12 }}>📋 Nota Fiscal e Validade Documental</strong>
              Em conformidade com a legislação fiscal brasileira (Lei nº 8.846/94 e Decreto nº 3.000/99), documentos de prestação de serviços devem identificar de forma clara o tomador do serviço. A consolidação de lançamentos de diferentes clientes em um único lote pode prejudicar a rastreabilidade fiscal, dificultar auditorias e comprometer a validade jurídica do comprovante emitido. Recomenda-se fortemente criar lotes individuais por cliente.
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              Deseja prosseguir mesmo assim e criar o lote unificado sob o cliente <strong style={{ color: 'var(--text-primary)' }}>{clienteNome || clienteSearch}</strong>?
            </p>
          </div>
          {/* Ações */}
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmDivModal(false)}
              style={{ padding: '9px 20px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={executarSave} disabled={saving}
              style={{ padding: '9px 22px', borderRadius: 8, background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.5)', color: '#f59e0b', cursor: 'pointer', fontSize: 14, fontWeight: 800, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Criando...' : 'Sim, criar assim mesmo'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
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

// ── Modal: Enviar ao Cliente via WA / Email ──────────────────────────────────
const LS_REMETENTE = 'smartpro_email_remetente'

function EnviarModal({ lote, workspaceId, onClose, onSent }) {
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [remetente, setRemetente]     = useState(() => localStorage.getItem(LS_REMETENTE) || '')
  const [remetenteLocked, setRemetenteLocked] = useState(() => !!localStorage.getItem(LS_REMETENTE))
  const [aprovadorNome, setAprovadorNome] = useState('')
  const [cadastroEncontrado, setCadastroEncontrado] = useState(false)
  const [token, setToken] = useState(lote.token_acesso || null)
  const [lancamentos, setLancamentos] = useState([])
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  const link = token ? `${window.location.origin}/lote/${token}` : null

  useEffect(() => {
    async function init() {
      // Garante que o lote tem token
      let t = lote.token_acesso
      if (!t) {
        t = crypto.randomUUID()
        await supabase.from('lotes_cliente').update({ token_acesso: t }).eq('id', lote.id)
        setToken(t)
      }

      // Busca aprovador N1 do cadastro de clientes (por cliente_id ou nome)
      const query = supabase
        .from('cadastros_clientes')
        .select('telefone, email, aprovador_n1_nome, aprovador_n1_wa, aprovador_n1_email')
        .eq('workspace_id', workspaceId)
        .limit(1)
        .maybeSingle()

      const { data } = lote.cliente_id
        ? await query.eq('id', lote.cliente_id)
        : await query.ilike('nome', `%${lote.cliente}%`)

      if (data) {
        setCadastroEncontrado(true)
        // Prioriza dados do aprovador N1, cai para contato geral
        const wa  = data.aprovador_n1_wa    || data.telefone || ''
        const em  = data.aprovador_n1_email || data.email    || ''
        const nom = data.aprovador_n1_nome  || ''
        if (wa)  setTelefone(wa)
        if (em)  setEmail(em)
        if (nom) setAprovadorNome(nom)
      }

      // Lançamentos do lote (para gerar PDF/CSV)
      const { data: lancs } = await supabase
        .from('lancamentos')
        .select('id, data, descricao, valor, status, categoria, observacoes, dados_extras')
        .eq('lote_cliente_id', lote.id)
        .order('data')
      setLancamentos(lancs || [])
    }
    init()
  }, [])

  function toggleLock() {
    if (remetenteLocked) {
      localStorage.removeItem(LS_REMETENTE)
      setRemetenteLocked(false)
    } else {
      if (remetente.trim()) {
        localStorage.setItem(LS_REMETENTE, remetente.trim())
        setRemetenteLocked(true)
      }
    }
  }

  function handleRemetenteChange(v) {
    setRemetente(v)
    if (remetenteLocked) {
      localStorage.setItem(LS_REMETENTE, v)
    }
  }

  function handleCopy() {
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleWA() {
    if (!telefone.replace(/\D/g, '').length || !link) return
    setSending(true)
    try {
      const pdfBase64 = lancamentos.length > 0 ? (await buildPDFDoc()).output('datauristring').split(',')[1] : undefined
      const pdfNome = `lote-${lote.cliente.replace(/[^a-z0-9]/gi, '_')}.pdf`
      const res = await fetch('/api/wa-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone, cliente: lote.cliente, link, loteId: lote.id, pdfBase64, pdfNome }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar')
      toast.success(pdfBase64 ? 'WhatsApp enviado com PDF em anexo!' : 'WhatsApp enviado via Z-API!')
      onSent()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSending(false)
    }
  }

  function handleEmail() {
    const subject = encodeURIComponent(`Aprovação de Lote — ${lote.cliente}`)
    const assinatura = remetente.trim() ? `\n\nAtenciosamente,\n${remetente.trim()}` : '\n\nAtenciosamente.'
    const body = encodeURIComponent(
      `Olá${aprovadorNome ? `, ${aprovadorNome}` : ''}!\n\nSegue o link para aprovação do lote de lançamentos:\n${link}\n\nPor favor, acesse e confirme o De Acordo.${assinatura}`
    )
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank')
  }

  async function handleConfirmar() {
    setSaving(true)
    await supabase
      .from('lotes_cliente')
      .update({ status: 'enviado_cliente', updated_at: new Date().toISOString() })
      .eq('id', lote.id)
    setSaving(false)
    toast.success('Lote enviado ao cliente!')
    onSent()
  }

  // ── Gera doc jsPDF do lote (reutiliza modelo de exportPDF.js) ──────────────
  async function buildPDFDoc() {
    let assinaturaBase64 = null
    if (lote.assinatura_url) {
      try {
        const res = await fetch(lote.assinatura_url)
        const blob = await res.blob()
        assinaturaBase64 = await new Promise(resolve => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.readAsDataURL(blob)
        })
      } catch (_) {}
    }
    return buildLotePDFDoc({
      lancamentos, lote, link,
      assinaturaBase64,
      aprovadoEm: lote.aprovado_em || null,
      aprovadorNome: lote.confirmado_por || lote.aprovador_nome || null,
    })
  }

  function gerarCSV() {
    const header = 'Data,Descrição,Valor,Status'
    const rows = lancamentos.map(l =>
      [formatDate(l.data), `"${(l.descricao || '').replace(/"/g, '""')}"`, formatCurrency(l.valor), l.status || ''].join(',')
    )
    return [header, ...rows].join('\n')
  }

  function handleDownloadCSV() {
    const blob = new Blob([gerarCSV()], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lote-${lote.cliente.replace(/[^a-z0-9]/gi, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDownloadPDF() {
    const blob = (await buildPDFDoc()).output('blob')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lote-${lote.cliente.replace(/[^a-z0-9]/gi, '_')}.pdf`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  async function handleEmailComAnexo() {
    if (!email.trim() || !link) return
    setSendingEmail(true)
    try {
      const pdfBase64 = (await buildPDFDoc()).output('datauristring').split(',')[1]
      const csvContent = gerarCSV()
      const res = await fetch('/api/lote-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: email.trim(),
          toNome: aprovadorNome,
          remetente: remetente.trim(),
          link,
          loteCliente: lote.cliente,
          loteNome: lote.nome || '',
          pdfBase64,
          csvContent,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao enviar email')
      toast.success('E-mail enviado com PDF e CSV em anexo!')
      onSent()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 480, border: '1px solid var(--border)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Enviar para Aprovação</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{lote.cliente}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {/* Link */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              <LinkIcon style={{ width: 12, height: 12 }} /> LINK DE APROVAÇÃO
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, padding: '9px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {link || 'Gerando...'}
              </div>
              <button onClick={handleCopy} disabled={!link}
                style={{ padding: '9px 14px', borderRadius: 8, background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.1)', border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.3)'}`, cursor: 'pointer', color: copied ? '#10b981' : '#818cf8', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* Aprovador N1 */}
          {cadastroEncontrado && aprovadorNome && (
            <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Aprovador N1 Lançamentos: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{aprovadorNome}</strong>
            </div>
          )}
          {cadastroEncontrado && !aprovadorNome && (
            <div style={{ marginBottom: 12, padding: '7px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 11, color: 'var(--text-secondary)' }}>
              ✓ Dados preenchidos do cadastro de clientes
            </div>
          )}

          {/* Contato do aprovador N1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>WHATSAPP — N1</label>
              <input value={telefone} onChange={e => setTelefone(e.target.value)}
                placeholder="(99) 99999-9999"
                style={{ width: '100%', marginTop: 4, padding: '9px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>E-MAIL — N1</label>
              <input value={email} onChange={e => setEmail(e.target.value)}
                placeholder="email@cliente.com" type="email"
                style={{ width: '100%', marginTop: 4, padding: '9px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Remetente com cadeado */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>SEU E-MAIL (REMETENTE)</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input
                value={remetente}
                onChange={e => handleRemetenteChange(e.target.value)}
                placeholder="seu@email.com"
                type="email"
                disabled={remetenteLocked}
                style={{ flex: 1, padding: '9px 12px', borderRadius: 8, background: remetenteLocked ? 'var(--bg-primary)' : 'var(--bg-primary)', border: `1px solid ${remetenteLocked ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`, color: 'var(--text-primary)', fontSize: 13, outline: 'none', opacity: remetenteLocked ? 0.85 : 1 }}
              />
              <button
                onClick={toggleLock}
                title={remetenteLocked ? 'Clique para editar o remetente' : 'Clique para salvar e travar o remetente'}
                style={{ padding: '9px 13px', borderRadius: 8, background: remetenteLocked ? 'rgba(16,185,129,0.12)' : 'var(--bg-primary)', border: `1px solid ${remetenteLocked ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`, cursor: 'pointer', color: remetenteLocked ? '#10b981' : 'var(--text-secondary)', fontSize: 16, lineHeight: 1 }}>
                {remetenteLocked ? '🔒' : '🔓'}
              </button>
            </div>
            {!remetenteLocked && remetente.trim() && (
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>Clique no cadeado para salvar e não pedir novamente</div>
            )}
          </div>

          {/* Downloads CSV / PDF */}
          {lancamentos.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>ANEXOS:</span>
              <button onClick={handleDownloadCSV}
                style={{ padding: '6px 13px', borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer', color: '#10b981', fontSize: 12, fontWeight: 700 }}>
                📥 CSV
              </button>
              <button onClick={handleDownloadPDF}
                style={{ padding: '6px 13px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', cursor: 'pointer', color: '#818cf8', fontSize: 12, fontWeight: 700 }}>
                📥 PDF
              </button>
            </div>
          )}

          {/* Botões WA / Email */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button onClick={handleWA} disabled={!link || !telefone.replace(/\D/g, '').length || sending}
              style={{ flex: 1, padding: '10px', borderRadius: 9, background: '#25D366', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (!link || !telefone.replace(/\D/g, '').length || sending) ? 0.65 : 1 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              {sending ? 'Enviando...' : lancamentos.length > 0 ? 'WA + PDF' : 'WhatsApp N1'}
            </button>
            <button onClick={handleEmailComAnexo} disabled={!link || !email.trim() || sendingEmail}
              style={{ flex: 1, padding: '10px', borderRadius: 9, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer', color: '#818cf8', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (!link || !email.trim() || sendingEmail) ? 0.45 : 1 }}>
              {sendingEmail ? '⏳ Enviando...' : '✉ E-mail + PDF'}
            </button>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>
              Cancelar
            </button>
            <button onClick={handleConfirmar} disabled={saving || !link}
              style={{ flex: 2, padding: '10px', borderRadius: 9, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', cursor: 'pointer', color: '#f59e0b', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
              <PaperAirplaneIcon style={{ width: 14, height: 14 }} />
              {saving ? 'Salvando...' : 'Confirmar Envio'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card do Lote ──────────────────────────────────────────────────────────────
function LoteCard({ lote, onRefresh }) {
  const { workspaceId } = useStore()
  const [expanded, setExpanded] = useState(false)
  const [lancamentos, setLancamentos] = useState([])
  const [loadingLanc, setLoadingLanc] = useState(false)
  const [deAcordoModal, setDeAcordoModal] = useState(false)
  const [enviarModal, setEnviarModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sigModal, setSigModal] = useState(false)
  const [downloadingPDF, setDownloadingPDF] = useState(false)

  async function handleDownloadPDFAssinado(e) {
    e.stopPropagation()
    setDownloadingPDF(true)
    try {
      let lancs = lancamentos
      if (lancs.length === 0) {
        const { data } = await supabase
          .from('lancamentos')
          .select('id, data, descricao, valor, status, dados_extras, observacoes')
          .eq('lote_cliente_id', lote.id)
          .order('data')
        lancs = data || []
        setLancamentos(lancs)
      }
      let assinaturaBase64 = null
      if (lote.assinatura_url) {
        try {
          const r = await fetch(lote.assinatura_url)
          const blob = await r.blob()
          assinaturaBase64 = await new Promise(resolve => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.readAsDataURL(blob)
          })
        } catch (_) {}
      }
      const link = lote.token_acesso ? `${window.location.origin}/lote/${lote.token_acesso}` : null
      const doc = buildLotePDFDoc({
        lancamentos: lancs, lote, link,
        assinaturaBase64,
        aprovadoEm: lote.aprovado_em || null,
        aprovadorNome: lote.confirmado_por || lote.aprovador_nome || null,
      })
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lote-${lote.cliente.replace(/[^a-z0-9]/gi, '_')}${lote.assinatura_url ? '-assinado' : ''}.pdf`
      a.target = '_blank'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (err) {
      toast.error('Erro ao gerar PDF: ' + err.message)
    } finally {
      setDownloadingPDF(false)
    }
  }

  async function loadLancamentos() {
    if (lancamentos.length > 0) { setExpanded(e => !e); return }
    setExpanded(true)
    setLoadingLanc(true)
    const { data } = await supabase.from('lancamentos').select('id, data, descricao, valor, status, dados_extras').eq('lote_cliente_id', lote.id).order('data')
    setLancamentos(data || [])
    setLoadingLanc(false)
  }

  function handleEnviar() {
    setEnviarModal(true)
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
              {lote.confirmado_por && (
                <span style={{ color: lote.status === 'aprovado_cliente' ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {lote.status === 'aprovado_cliente' ? '✓' : '✕'} Confirmado por: {lote.confirmado_por}
                </span>
              )}
              {lote.assinatura_url && lote.status === 'aprovado_cliente' && (
                <button
                  onClick={e => { e.stopPropagation(); setSigModal(true) }}
                  style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  ✎ Assinado digitalmente
                </button>
              )}
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
            {lote.status === 'aprovado_cliente' && (
              <button
                onClick={handleDownloadPDFAssinado}
                disabled={downloadingPDF}
                title={lote.assinatura_url ? 'Baixar PDF com assinatura digital' : 'Baixar PDF do lote'}
                style={{
                  padding: '6px 12px', borderRadius: 7,
                  background: lote.assinatura_url ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.08)',
                  border: `1px solid ${lote.assinatura_url ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.2)'}`,
                  cursor: downloadingPDF ? 'not-allowed' : 'pointer',
                  color: '#818cf8', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
                  opacity: downloadingPDF ? 0.6 : 1,
                }}
              >
                <ArrowDownTrayIcon style={{ width: 14, height: 14 }} />
                {downloadingPDF ? '...' : lote.assinatura_url ? 'PDF Assinado' : 'PDF'}
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
      {enviarModal && (
        <EnviarModal
          lote={lote}
          workspaceId={workspaceId}
          onClose={() => setEnviarModal(false)}
          onSent={() => { setEnviarModal(false); onRefresh() }}
        />
      )}
      {sigModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setSigModal(false)}
        >
          <div
            style={{ background: '#1e293b', borderRadius: 16, border: '1px solid #334155', padding: 24, maxWidth: 480, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>Assinatura Digital</div>
              <button onClick={() => setSigModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ background: '#0f172a', borderRadius: 10, border: '1px solid #334155', overflow: 'hidden', marginBottom: 14 }}>
              <img src={lote.assinatura_url} alt="Assinatura" style={{ width: '100%', display: 'block' }} />
            </div>
            {lote.confirmado_por && (
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                <span style={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>APROVADO POR </span>{lote.confirmado_por}
              </div>
            )}
            {lote.aprovado_em && (
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                <span style={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>DATA/HORA </span>
                {new Date(lote.aprovado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: '#10b981' }}>
              ✓ Assinatura digital registrada — o PDF baixado inclui esta assinatura
            </div>
          </div>
        </div>
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
