import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import useStore from '../store/useStore'
import Header from '../components/Header'
import FlowHistory from '../components/refeicao/FlowHistory'
import FlowTaskBell from '../components/refeicao/FlowTaskBell'
import PedidoTimeline from '../components/refeicao/PedidoTimeline'
import {
  MagnifyingGlassIcon, Cog6ToothIcon, PlusIcon, PencilIcon,
  TrashIcon, XMarkIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon,
  UserGroupIcon, BuildingStorefrontIcon, ClipboardDocumentListIcon,
  CheckCircleIcon, ClockIcon, XCircleIcon, NoSymbolIcon,
  CalendarDaysIcon, TableCellsIcon, ChartBarIcon, ArrowDownTrayIcon,
  HomeIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtBRL(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(d) {
  if (!d) return '—'
  const [y, m, dia] = String(d).split('-')
  return `${dia}/${m}/${y}`
}
function todayISO() {
  return new Date().toISOString().split('T')[0]
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  // ── Novos status do fluxo completo ──
  rascunho:                    { label: 'Rascunho',             color: '#64748b', bg: 'rgba(100,116,139,0.15)', icon: ClipboardDocumentListIcon },
  aguardando_aprovacao:        { label: 'Aguard. Aprovação',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  icon: ClockIcon },
  aprovado:                    { label: 'Aprovado',             color: '#10b981', bg: 'rgba(16,185,129,0.15)',  icon: CheckCircleIcon },
  reprovado:                   { label: 'Reprovado',            color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   icon: XCircleIcon },
  consolidado:                 { label: 'Consolidado',          color: '#6366f1', bg: 'rgba(99,102,241,0.15)',  icon: CheckCircleIcon },
  enviado_restaurante:         { label: 'No Restaurante',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  icon: BuildingStorefrontIcon },
  confirmado_restaurante:      { label: 'Confirmado Rest.',      color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', icon: CheckCircleIcon },
  em_acompanhamento:           { label: 'Em Acompanhamento',    color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',   icon: ClockIcon },
  entregue:                    { label: 'Entregue',             color: '#34d399', bg: 'rgba(52,211,153,0.15)',  icon: CheckCircleIcon },
  aguardando_validacao:        { label: 'Aguard. Validação',    color: '#f97316', bg: 'rgba(249,115,22,0.15)',  icon: ClockIcon },
  finalizado:                  { label: 'Finalizado',           color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', icon: NoSymbolIcon },
  finalizado_com_ocorrencia:   { label: 'Finaliz. c/ Ocorrência', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: XCircleIcon },
  // ── Aliases de compatibilidade (status antigos) ──
  pendente:   { label: 'Aguard. Aprovação', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  icon: ClockIcon },
  preparando: { label: 'Em Preparo',        color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',   icon: ClockIcon },
  fechado:    { label: 'Finalizado',        color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', icon: NoSymbolIcon },
}

function StatusBadge({ status }) {
  const cfg = STATUS[status] || STATUS.rascunho
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <Icon style={{ width: 11, height: 11 }} />
      {cfg.label}
    </span>
  )
}

// ─── Estilos compartilhados (formulários) ─────────────────────────────────────
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }
const inp = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }

// ─── Modal genérico ───────────────────────────────────────────────────────────
function Modal({ title, onClose, children, maxWidth = 560 }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

// ─── CRUD Restaurantes ────────────────────────────────────────────────────────
function CrudRestaurantes({ workspaceId, ownerId }) {
  const [rows, setRows]   = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!workspaceId) return
    const { data } = await supabase.from('refei_restaurantes').select('*').eq('workspace_id', workspaceId).order('nome')
    setRows(data || [])
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  function openNew() { setForm({ ativo: true }); setModal({ mode: 'new' }) }
  function openEdit(r) { setForm({ ...r }); setModal({ mode: 'edit', id: r.id }) }

  async function save() {
    if (!form.nome?.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = { nome: form.nome, cnpj: form.cnpj || null, numero_pedido: form.numero_pedido || null, valor_refeicao: form.valor_refeicao || 0, valor_cafe: form.valor_cafe || 0, telefone_wa: form.telefone_wa || null, ativo: !!form.ativo, confirma_pedido: !!form.confirma_pedido, workspace_id: workspaceId, owner_id: ownerId }
    if (modal.mode === 'new') {
      const { error } = await supabase.from('refei_restaurantes').insert(payload)
      if (error) toast.error(error.message); else { toast.success('Criado'); setModal(null); load() }
    } else {
      const { error } = await supabase.from('refei_restaurantes').update(payload).eq('id', modal.id)
      if (error) toast.error(error.message); else { toast.success('Salvo'); setModal(null); load() }
    }
    setSaving(false)
  }

  async function remove(id) {
    if (!confirm('Excluir restaurante?')) return
    await supabase.from('refei_restaurantes').delete().eq('id', id)
    load()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={openNew} className="btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}>
          <PlusIcon style={{ width: 15, height: 15 }} /> Novo
        </button>
      </div>
      {rows.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 24, fontSize: 13 }}>Nenhum restaurante cadastrado.</p>}
      {rows.map(r => (
        <div key={r.id} className="card" style={{ padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{r.nome} {!r.ativo && <span className="badge badge-danger" style={{ fontSize: 10, marginLeft: 6 }}>Inativo</span>}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {r.numero_pedido && <span>Pedido {r.numero_pedido}</span>}
              <span>🍽️ {fmtBRL(r.valor_refeicao)}</span>
              <span>☕ {fmtBRL(r.valor_cafe)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => openEdit(r)} style={{ background: 'rgba(99,102,241,0.12)', border: 'none', color: '#818cf8', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><PencilIcon style={{ width: 13, height: 13 }} /></button>
            <button onClick={() => remove(r.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><TrashIcon style={{ width: 13, height: 13 }} /></button>
          </div>
        </div>
      ))}
      {modal && (
        <Modal title={modal.mode === 'new' ? 'Novo Restaurante' : 'Editar Restaurante'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Nome *</label>
              <input className="input" value={form.nome || ''} onChange={e => f('nome', e.target.value)} placeholder="Nome do restaurante" />
            </div>
            <div><label style={lbl}>CNPJ</label><input className="input" value={form.cnpj || ''} onChange={e => f('cnpj', e.target.value)} /></div>
            <div><label style={lbl}>Nº do Pedido</label><input className="input" value={form.numero_pedido || ''} onChange={e => f('numero_pedido', e.target.value)} /></div>
            <div><label style={lbl}>Valor Refeição (R$)</label><input type="number" step="0.01" className="input" value={form.valor_refeicao || ''} onChange={e => f('valor_refeicao', e.target.value)} /></div>
            <div><label style={lbl}>Valor Café (R$)</label><input type="number" step="0.01" className="input" value={form.valor_cafe || ''} onChange={e => f('valor_cafe', e.target.value)} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Telefone WA</label><input className="input" value={form.telefone_wa || ''} onChange={e => f('telefone_wa', e.target.value)} placeholder="5511..." /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="rAtivo" checked={!!form.ativo} onChange={e => f('ativo', e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }} />
              <label htmlFor="rAtivo" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Ativo</label>
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(139,92,246,0.08)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(139,92,246,0.15)' }}>
              <input type="checkbox" id="rConfirma" checked={!!form.confirma_pedido} onChange={e => f('confirma_pedido', e.target.checked)} style={{ width: 14, height: 14, accentColor: '#8b5cf6', cursor: 'pointer' }} />
              <label htmlFor="rConfirma" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', flex: 1 }}>Restaurante confirma via link antes da entrega</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setModal(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── CRUD Equipes ─────────────────────────────────────────────────────────────
function CrudEquipes({ workspaceId, ownerId }) {
  const [rows, setRows]           = useState([])
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [saving, setSaving]       = useState(false)
  const [colabEquipe, setColabEquipe] = useState(null)
  const [colabs, setColabs]       = useState([])
  const [colabForm, setColabForm] = useState({})
  const [sendingLink, setSendingLink] = useState(null)

  async function enviarLink(equipe) {
    if (!equipe.lider_telefone) { toast.error('Cadastre o telefone do líder primeiro'); return }
    setSendingLink(equipe.id)
    try {
      const r = await fetch('/api/refeicoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gerar-link', equipeId: equipe.id }),
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Erro ao enviar'); return }
      toast.success(`Link enviado para ${equipe.lider_nome || equipe.lider_telefone}!${j.reutilizado ? ' (rascunho existente)' : ''}`)
    } finally {
      setSendingLink(null)
    }
  }

  const load = useCallback(async () => {
    if (!workspaceId) return
    const { data } = await supabase.from('refei_equipes').select('*').eq('workspace_id', workspaceId).order('nome')
    setRows(data || [])
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  async function loadColabs(equipeId) {
    const { data } = await supabase.from('refei_colaboradores').select('*').eq('equipe_id', equipeId).order('nome')
    setColabs(data || [])
  }

  async function save() {
    if (!form.nome?.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = { nome: form.nome, cdc: form.cdc || null, lider_nome: form.lider_nome || null, lider_telefone: form.lider_telefone || null, supervisor_nome: form.supervisor_nome || null, supervisor_telefone: form.supervisor_telefone || null, ativo: form.ativo !== false, workspace_id: workspaceId, owner_id: ownerId }
    if (modal.mode === 'new') {
      const { error } = await supabase.from('refei_equipes').insert(payload)
      if (error) toast.error(error.message); else { toast.success('Criada'); setModal(null); load() }
    } else {
      const { error } = await supabase.from('refei_equipes').update(payload).eq('id', modal.id)
      if (error) toast.error(error.message); else { toast.success('Salvo'); setModal(null); load() }
    }
    setSaving(false)
  }

  async function saveColab() {
    if (!colabForm.nome?.trim()) { toast.error('Nome obrigatório'); return }
    if (colabForm.id) {
      await supabase.from('refei_colaboradores').update({ nome: colabForm.nome, cargo: colabForm.cargo || null, ativo: colabForm.ativo !== false }).eq('id', colabForm.id)
    } else {
      await supabase.from('refei_colaboradores').insert({ equipe_id: colabEquipe, nome: colabForm.nome, cargo: colabForm.cargo || null, ativo: true })
    }
    setColabForm({})
    loadColabs(colabEquipe)
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => { setForm({ ativo: true }); setModal({ mode: 'new' }) }} className="btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}>
          <PlusIcon style={{ width: 15, height: 15 }} /> Nova Equipe
        </button>
      </div>
      {rows.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 24, fontSize: 13 }}>Nenhuma equipe cadastrada.</p>}
      {rows.map(r => (
        <div key={r.id} className="card" style={{ padding: '12px 16px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                {r.nome}
                {r.cdc && <span className="badge badge-accent" style={{ fontSize: 10, marginLeft: 8 }}>CDC {r.cdc}</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {r.lider_nome && <span>👤 {r.lider_nome}</span>}
                {r.supervisor_nome && <span style={{ marginLeft: 12 }}>🎯 {r.supervisor_nome}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => enviarLink(r)}
                disabled={sendingLink === r.id}
                title="Enviar link do formulário para o líder via WhatsApp"
                style={{ background: 'rgba(245,158,11,0.12)', border: 'none', color: '#f59e0b', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                {sendingLink === r.id ? '...' : '📤 Link'}
              </button>
              <button onClick={() => { setColabEquipe(r.id); loadColabs(r.id) }} style={{ background: 'rgba(16,185,129,0.1)', border: 'none', color: '#34d399', borderRadius: 8, padding: '5px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>👥</button>
              <button onClick={() => { setForm({ ...r }); setModal({ mode: 'edit', id: r.id }) }} style={{ background: 'rgba(99,102,241,0.12)', border: 'none', color: '#818cf8', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><PencilIcon style={{ width: 13, height: 13 }} /></button>
              <button onClick={async () => { if (!confirm('Excluir equipe?')) return; await supabase.from('refei_equipes').delete().eq('id', r.id); load() }} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><TrashIcon style={{ width: 13, height: 13 }} /></button>
            </div>
          </div>
        </div>
      ))}

      {/* Modal equipe */}
      {modal && (
        <Modal title={modal.mode === 'new' ? 'Nova Equipe' : 'Editar Equipe'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Nome *</label><input className="input" value={form.nome || ''} onChange={e => f('nome', e.target.value)} /></div>
            <div><label style={lbl}>CDC</label><input className="input" value={form.cdc || ''} onChange={e => f('cdc', e.target.value)} placeholder="Ex: CDC-07" /></div>
            <div />
            <div><label style={lbl}>Nome do Líder</label><input className="input" value={form.lider_nome || ''} onChange={e => f('lider_nome', e.target.value)} /></div>
            <div><label style={lbl}>Telefone WA Líder</label><input className="input" value={form.lider_telefone || ''} onChange={e => f('lider_telefone', e.target.value)} placeholder="5511..." /></div>
            <div><label style={lbl}>Nome do Supervisor</label><input className="input" value={form.supervisor_nome || ''} onChange={e => f('supervisor_nome', e.target.value)} /></div>
            <div><label style={lbl}>Telefone WA Supervisor</label><input className="input" value={form.supervisor_telefone || ''} onChange={e => f('supervisor_telefone', e.target.value)} placeholder="5511..." /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setModal(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </Modal>
      )}

      {/* Modal colaboradores */}
      {colabEquipe && (
        <Modal title="Colaboradores da Equipe" onClose={() => { setColabEquipe(null); setColabForm({}) }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 14 }}>
            <input className="input" placeholder="Nome *" value={colabForm.nome || ''} onChange={e => setColabForm(p => ({ ...p, nome: e.target.value }))} />
            <input className="input" placeholder="Cargo (opcional)" value={colabForm.cargo || ''} onChange={e => setColabForm(p => ({ ...p, cargo: e.target.value }))} />
            <button onClick={saveColab} className="btn-primary" style={{ whiteSpace: 'nowrap', fontSize: 13, padding: '9px 14px' }}>
              {colabForm.id ? 'Salvar' : '+ Add'}
            </button>
          </div>
          {colabForm.id && <button onClick={() => setColabForm({})} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 10 }}>✕ Cancelar edição</button>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
            {colabs.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{c.nome}</span>
                  {c.cargo && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>{c.cargo}</span>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setColabForm({ ...c })} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: '2px 4px' }}><PencilIcon style={{ width: 13, height: 13 }} /></button>
                  <button onClick={async () => { await supabase.from('refei_colaboradores').delete().eq('id', c.id); loadColabs(colabEquipe) }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px 4px' }}><TrashIcon style={{ width: 13, height: 13 }} /></button>
                </div>
              </div>
            ))}
            {colabs.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: 16 }}>Sem colaboradores.</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── CRUD Centros de Custo ────────────────────────────────────────────────────
function CrudCDC({ workspaceId, ownerId }) {
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    if (!workspaceId) return
    const { data } = await supabase.from('refei_centros_custo').select('*').eq('workspace_id', workspaceId).order('nome')
    setRows(data || [])
  }, [workspaceId])
  useEffect(() => { load() }, [load])
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  async function save() {
    if (!form.nome?.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = { nome: form.nome, codigo: form.codigo || null, ativo: !!form.ativo, workspace_id: workspaceId, owner_id: ownerId }
    if (modal.mode === 'new') {
      const { error } = await supabase.from('refei_centros_custo').insert(payload)
      if (error) toast.error(error.message); else { toast.success('Criado'); setModal(null); load() }
    } else {
      const { error } = await supabase.from('refei_centros_custo').update(payload).eq('id', modal.id)
      if (error) toast.error(error.message); else { toast.success('Salvo'); setModal(null); load() }
    }
    setSaving(false)
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => { setForm({ ativo: true }); setModal({ mode: 'new' }) }} className="btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}>
          <PlusIcon style={{ width: 15, height: 15 }} /> Novo
        </button>
      </div>
      {rows.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 24, fontSize: 13 }}>Nenhum centro de custo cadastrado.</p>}
      {rows.map(r => (
        <div key={r.id} className="card" style={{ padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
              {r.codigo && <span className="badge badge-accent" style={{ fontSize: 10, marginRight: 8 }}>{r.codigo}</span>}
              {r.nome}
              {!r.ativo && <span className="badge badge-danger" style={{ fontSize: 10, marginLeft: 6 }}>Inativo</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => { setForm({ ...r }); setModal({ mode: 'edit', id: r.id }) }} style={{ background: 'rgba(99,102,241,0.12)', border: 'none', color: '#818cf8', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><PencilIcon style={{ width: 13, height: 13 }} /></button>
            <button onClick={async () => { if (!confirm('Excluir?')) return; await supabase.from('refei_centros_custo').delete().eq('id', r.id); load() }} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><TrashIcon style={{ width: 13, height: 13 }} /></button>
          </div>
        </div>
      ))}
      {modal && (
        <Modal title={modal.mode === 'new' ? 'Novo Centro de Custo' : 'Editar Centro de Custo'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Nome *</label><input className="input" value={form.nome || ''} onChange={e => f('nome', e.target.value)} /></div>
            <div><label style={lbl}>Código</label><input className="input" value={form.codigo || ''} onChange={e => f('codigo', e.target.value)} placeholder="Ex: CDC-07" /></div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={!!form.ativo} onChange={e => f('ativo', e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                Ativo
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setModal(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── CRUD Regionais ───────────────────────────────────────────────────────────
function CrudRegionais({ workspaceId, ownerId }) {
  const [rows, setRows] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    if (!workspaceId) return
    const { data } = await supabase.from('refei_regionais').select('*').eq('workspace_id', workspaceId).order('nome')
    setRows(data || [])
  }, [workspaceId])
  useEffect(() => { load() }, [load])
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  async function save() {
    if (!form.nome?.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = { nome: form.nome, ativo: !!form.ativo, workspace_id: workspaceId, owner_id: ownerId }
    if (modal.mode === 'new') {
      const { error } = await supabase.from('refei_regionais').insert(payload)
      if (error) toast.error(error.message); else { toast.success('Criada'); setModal(null); load() }
    } else {
      const { error } = await supabase.from('refei_regionais').update(payload).eq('id', modal.id)
      if (error) toast.error(error.message); else { toast.success('Salvo'); setModal(null); load() }
    }
    setSaving(false)
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => { setForm({ ativo: true }); setModal({ mode: 'new' }) }} className="btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}>
          <PlusIcon style={{ width: 15, height: 15 }} /> Nova Regional
        </button>
      </div>
      {rows.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 24, fontSize: 13 }}>Nenhuma regional cadastrada.</p>}
      {rows.map(r => (
        <div key={r.id} className="card" style={{ padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
            {r.nome}
            {!r.ativo && <span className="badge badge-danger" style={{ fontSize: 10, marginLeft: 6 }}>Inativo</span>}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => { setForm({ ...r }); setModal({ mode: 'edit', id: r.id }) }} style={{ background: 'rgba(99,102,241,0.12)', border: 'none', color: '#818cf8', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><PencilIcon style={{ width: 13, height: 13 }} /></button>
            <button onClick={async () => { if (!confirm('Excluir?')) return; await supabase.from('refei_regionais').delete().eq('id', r.id); load() }} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><TrashIcon style={{ width: 13, height: 13 }} /></button>
          </div>
        </div>
      ))}
      {modal && (
        <Modal title={modal.mode === 'new' ? 'Nova Regional' : 'Editar Regional'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
            <div><label style={lbl}>Nome *</label><input className="input" value={form.nome || ''} onChange={e => f('nome', e.target.value)} /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', paddingBottom: 2 }}>
              <input type="checkbox" checked={!!form.ativo} onChange={e => f('ativo', e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }} />
              Ativo
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setModal(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── CRUD Tabela de Preços ────────────────────────────────────────────────────
function CrudTabelaPrecos({ workspaceId, ownerId }) {
  const [rows, setRows] = useState([])
  const [rests, setRests] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    if (!workspaceId) return
    const [{ data: tp }, { data: rs }] = await Promise.all([
      supabase.from('refei_tabela_precos').select('*, refei_restaurantes(nome)').eq('workspace_id', workspaceId).order('criado_em', { ascending: false }),
      supabase.from('refei_restaurantes').select('id,nome').eq('workspace_id', workspaceId).order('nome'),
    ])
    setRows(tp || [])
    setRests(rs || [])
  }, [workspaceId])
  useEffect(() => { load() }, [load])
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  async function save() {
    if (!form.restaurante_id) { toast.error('Selecione um restaurante'); return }
    setSaving(true)
    const payload = { restaurante_id: form.restaurante_id, vigencia_inicio: form.vigencia_inicio || null, vigencia_fim: form.vigencia_fim || null, valor_refeicao: Number(form.valor_refeicao) || 0, valor_cafe: Number(form.valor_cafe) || 0, ativo: !!form.ativo, workspace_id: workspaceId, owner_id: ownerId }
    if (modal.mode === 'new') {
      const { error } = await supabase.from('refei_tabela_precos').insert(payload)
      if (error) toast.error(error.message); else { toast.success('Criado'); setModal(null); load() }
    } else {
      const { error } = await supabase.from('refei_tabela_precos').update(payload).eq('id', modal.id)
      if (error) toast.error(error.message); else { toast.success('Salvo'); setModal(null); load() }
    }
    setSaving(false)
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => { setForm({ ativo: true }); setModal({ mode: 'new' }) }} className="btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}>
          <PlusIcon style={{ width: 15, height: 15 }} /> Nova Vigência
        </button>
      </div>
      {rows.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 24, fontSize: 13 }}>Nenhuma tabela de preços cadastrada.</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Restaurante', 'Vigência Início', 'Vigência Fim', '🍽️ Refeição', '☕ Café', 'Status', ''].map((h, i) => (
                <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.refei_restaurantes?.nome || '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{fmtData(r.vigencia_inicio)}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{fmtData(r.vigencia_fim)}</td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#10b981' }}>{fmtBRL(r.valor_refeicao)}</td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: '#10b981' }}>{fmtBRL(r.valor_cafe)}</td>
                <td style={{ padding: '10px 12px' }}>{r.ativo ? <span className="badge badge-success" style={{ fontSize: 10 }}>Ativo</span> : <span className="badge badge-danger" style={{ fontSize: 10 }}>Inativo</span>}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setForm({ ...r }); setModal({ mode: 'edit', id: r.id }) }} style={{ background: 'rgba(99,102,241,0.12)', border: 'none', color: '#818cf8', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><PencilIcon style={{ width: 13, height: 13 }} /></button>
                    <button onClick={async () => { if (!confirm('Excluir?')) return; await supabase.from('refei_tabela_precos').delete().eq('id', r.id); load() }} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><TrashIcon style={{ width: 13, height: 13 }} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={modal.mode === 'new' ? 'Nova Tabela de Preços' : 'Editar Tabela de Preços'} onClose={() => setModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Restaurante *</label>
              <select className="input" value={form.restaurante_id || ''} onChange={e => f('restaurante_id', e.target.value)}>
                <option value="">Selecione...</option>
                {rests.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Vigência Início</label><input type="date" className="input" value={form.vigencia_inicio || ''} onChange={e => f('vigencia_inicio', e.target.value)} /></div>
            <div><label style={lbl}>Vigência Fim</label><input type="date" className="input" value={form.vigencia_fim || ''} onChange={e => f('vigencia_fim', e.target.value)} /></div>
            <div><label style={lbl}>Valor Refeição (R$)</label><input type="number" step="0.01" className="input" value={form.valor_refeicao || ''} onChange={e => f('valor_refeicao', e.target.value)} /></div>
            <div><label style={lbl}>Valor Café (R$)</label><input type="number" step="0.01" className="input" value={form.valor_cafe || ''} onChange={e => f('valor_cafe', e.target.value)} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!form.ativo} onChange={e => f('ativo', e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }} />
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Ativo</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setModal(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Todos os Colaboradores (visão completa) ──────────────────────────────────
function CrudColaboradores({ workspaceId }) {
  const [colabs, setColabs] = useState([])
  const [filtroEq, setFiltroEq] = useState('')
  const [equipes, setEquipes] = useState([])
  const load = useCallback(async () => {
    if (!workspaceId) return
    const [{ data: c }, { data: e }] = await Promise.all([
      supabase.from('refei_colaboradores').select('*, refei_equipes(nome)').order('nome'),
      supabase.from('refei_equipes').select('id,nome').eq('workspace_id', workspaceId).order('nome'),
    ])
    const eqIds = (e || []).map(eq => eq.id)
    setColabs((c || []).filter(col => eqIds.includes(col.equipe_id)))
    setEquipes(e || [])
  }, [workspaceId])
  useEffect(() => { load() }, [load])
  const filtered = filtroEq ? colabs.filter(c => c.equipe_id === filtroEq) : colabs
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <select className="input" style={{ width: 220, fontSize: 13 }} value={filtroEq} onChange={e => setFiltroEq(e.target.value)}>
          <option value="">Todas as equipes</option>
          {equipes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Nome', 'Cargo', 'Equipe', 'Status', ''].map((h, i) => (
                <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.nome}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{c.cargo || '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{c.refei_equipes?.nome || '—'}</td>
                <td style={{ padding: '10px 12px' }}>{c.ativo !== false ? <span className="badge badge-success" style={{ fontSize: 10 }}>Ativo</span> : <span className="badge badge-danger" style={{ fontSize: 10 }}>Inativo</span>}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <button onClick={async () => { if (!confirm('Excluir colaborador?')) return; await supabase.from('refei_colaboradores').delete().eq('id', c.id); load() }} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}><TrashIcon style={{ width: 13, height: 13 }} /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum colaborador encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 12 }}>Para adicionar colaboradores, vá em Cadastros → Equipes e clique no ícone 👥.</p>
    </div>
  )
}

// ─── Toggle Row (helper) ──────────────────────────────────────────────────────
function ToggleRow({ checked, onChange, label, desc }) {
  return (
    <div onClick={onChange} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 10, border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', userSelect: 'none', transition: 'border-color 0.15s' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ width: 44, height: 24, borderRadius: 12, background: checked ? 'var(--accent)' : 'var(--bg-secondary)', border: '1px solid var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: 14 }}>
        <div style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 16, height: 16, borderRadius: '50%', background: checked ? '#fff' : 'var(--text-secondary)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
    </div>
  )
}

// ─── Regras de Refeição ───────────────────────────────────────────────────────
function CrudRegras({ workspaceId, ownerId }) {
  const DIAS_SEMANA = [
    { n: 1, label: 'SEG' }, { n: 2, label: 'TER' }, { n: 3, label: 'QUA' },
    { n: 4, label: 'QUI' }, { n: 5, label: 'SEX' }, { n: 6, label: 'SÁB' }, { n: 0, label: 'DOM' },
  ]
  const DEFAULT = {
    dias_semana: [1, 2, 3, 4, 5],
    antecedencia_horas: 2,
    horario_corte: '10:00',
    teto_por_equipe: '',
    teto_valor_colaborador: '',
    max_refeicoes_dia: 1,
    permite_refeicao: true,
    permite_cafe: true,
    permite_extra: true,
    tipo_aprovacao: 'obrigatoria',
    valor_aprovacao_automatica: '',
    prazo_aprovacao_horas: 24,
    notifica_lider_resultado: true,
    notifica_supervisor_pendente: true,
  }
  const [form, setForm]     = useState(DEFAULT)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!workspaceId) return
    supabase.from('refei_parametros').select('*').eq('workspace_id', workspaceId).maybeSingle()
      .then(({ data }) => {
        if (data) setForm({ ...DEFAULT, ...data, dias_semana: data.dias_semana || [1, 2, 3, 4, 5] })
        setLoaded(true)
      })
  }, [workspaceId])

  function toggleDia(n) {
    const dias = form.dias_semana || []
    f('dias_semana', dias.includes(n) ? dias.filter(d => d !== n) : [...dias, n].sort((a, b) => (a || 7) - (b || 7)))
  }

  async function save() {
    if (!form.dias_semana?.length) { toast.error('Selecione pelo menos 1 dia da semana'); return }
    setSaving(true)
    const payload = {
      workspace_id:                 workspaceId,
      antecedencia_horas:           Number(form.antecedencia_horas) || 2,
      horario_corte:                form.horario_corte || '10:00',
      dias_semana:                  form.dias_semana,
      teto_por_equipe:              Number(form.teto_por_equipe) || null,
      teto_valor_colaborador:       Number(form.teto_valor_colaborador) || null,
      max_refeicoes_dia:            Number(form.max_refeicoes_dia) || 1,
      permite_refeicao:             !!form.permite_refeicao,
      permite_cafe:                 !!form.permite_cafe,
      permite_extra:                !!form.permite_extra,
      aprovacao_obrigatoria:        form.tipo_aprovacao === 'obrigatoria',
      tipo_aprovacao:               form.tipo_aprovacao || 'obrigatoria',
      valor_aprovacao_automatica:   form.tipo_aprovacao === 'por_valor' ? (Number(form.valor_aprovacao_automatica) || null) : null,
      prazo_aprovacao_horas:        Number(form.prazo_aprovacao_horas) || 24,
      notifica_lider_resultado:     !!form.notifica_lider_resultado,
      notifica_supervisor_pendente: !!form.notifica_supervisor_pendente,
      atualizado_em:                new Date().toISOString(),
    }
    const { error } = await supabase.from('refei_parametros').upsert(payload, { onConflict: 'workspace_id' })
    if (error) toast.error(error.message)
    else toast.success('Regras salvas! ✓')
    setSaving(false)
  }

  if (!loaded) return <div style={{ color: 'var(--text-secondary)', padding: 40, textAlign: 'center', fontSize: 13 }}>Carregando...</div>

  const sCard = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', marginBottom: 16 }

  function SH({ emoji, title, sub: subtitle }) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 20, lineHeight: 1, marginTop: 1 }}>{emoji}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 740 }}>

      {/* ── 1. Dias e Horários ── */}
      <div style={sCard}>
        <SH emoji="📅" title="Dias e Horários" sub="Em quais dias as refeições são permitidas e qual o horário limite para pedidos" />
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Dias da semana permitidos</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {DIAS_SEMANA.map(d => {
              const on = (form.dias_semana || []).includes(d.n)
              return (
                <button key={d.n} onClick={() => toggleDia(d.n)}
                  style={{ padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'transparent', color: on ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={lbl}>Horário de corte</label>
            <input type="time" className="input" value={form.horario_corte || '10:00'} onChange={e => f('horario_corte', e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Hora limite para envio do formulário pelo líder</div>
          </div>
          <div>
            <label style={lbl}>Antecedência mínima (horas)</label>
            <input type="number" min={0} className="input" value={form.antecedencia_horas} onChange={e => f('antecedencia_horas', e.target.value)} placeholder="2" />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Horas antes da refeição para encerrar pedidos</div>
          </div>
        </div>
      </div>

      {/* ── 2. Limites e Cotas ── */}
      <div style={sCard}>
        <SH emoji="📊" title="Limites e Cotas" sub="Controle de volume e valor por equipe e colaborador" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <label style={lbl}>Teto por equipe (itens)</label>
            <input type="number" min={0} className="input" value={form.teto_por_equipe || ''} onChange={e => f('teto_por_equipe', e.target.value)} placeholder="Sem limite" />
          </div>
          <div>
            <label style={lbl}>Valor máx. / colaborador / dia (R$)</label>
            <input type="number" min={0} step="0.01" className="input" value={form.teto_valor_colaborador || ''} onChange={e => f('teto_valor_colaborador', e.target.value)} placeholder="Sem limite" />
          </div>
          <div>
            <label style={lbl}>Máx. refeições / colaborador / dia</label>
            <input type="number" min={1} max={10} className="input" value={form.max_refeicoes_dia || 1} onChange={e => f('max_refeicoes_dia', e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── 3. Tipos Habilitados ── */}
      <div style={sCard}>
        <SH emoji="✅" title="Tipos Habilitados" sub="O que pode ser solicitado pelos líderes no formulário" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ToggleRow checked={!!form.permite_refeicao} onChange={() => f('permite_refeicao', !form.permite_refeicao)} label="🍽️ Refeição (Almoço / Jantar)" desc="Permite solicitar refeições no formulário do líder" />
          <ToggleRow checked={!!form.permite_cafe}     onChange={() => f('permite_cafe',     !form.permite_cafe)}     label="☕ Café da Manhã / Lanche"        desc="Permite solicitar café junto com a refeição" />
          <ToggleRow checked={!!form.permite_extra}    onChange={() => f('permite_extra',    !form.permite_extra)}    label="➕ Extras (com justificativa)"    desc="Permite adicionar pessoas fora da lista oficial da equipe" />
        </div>
      </div>

      {/* ── 4. Fluxo de Aprovação ── */}
      <div style={sCard}>
        <SH emoji="🔄" title="Fluxo de Aprovação" sub="Como os pedidos são processados antes de ir para o restaurante" />
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Tipo de aprovação</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 6 }}>
            {[
              { id: 'obrigatoria', emoji: '👤', title: 'Obrigatória',  desc: 'Supervisor sempre aprova' },
              { id: 'automatica',  emoji: '⚡', title: 'Automática',   desc: 'Aprovação sem intervenção' },
              { id: 'por_valor',   emoji: '💰', title: 'Por Valor',    desc: 'Auto-aprova abaixo de R$X' },
            ].map(opt => {
              const active = form.tipo_aprovacao === opt.id
              return (
                <button key={opt.id} onClick={() => f('tipo_aprovacao', opt.id)}
                  style={{ padding: '12px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-glow)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-secondary)', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 20, marginBottom: 5 }}>{opt.emoji}</div>
                  <div>{opt.title}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, marginTop: 3, opacity: 0.75 }}>{opt.desc}</div>
                </button>
              )
            })}
          </div>
        </div>
        {form.tipo_aprovacao === 'por_valor' && (
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Auto-aprovar pedidos abaixo de (R$)</label>
            <input type="number" min={0} step="0.01" className="input" style={{ maxWidth: 220 }} value={form.valor_aprovacao_automatica || ''} onChange={e => f('valor_aprovacao_automatica', e.target.value)} placeholder="Ex: 150.00" />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Pedidos com valor total abaixo deste limite são aprovados automaticamente</div>
          </div>
        )}
        {form.tipo_aprovacao !== 'automatica' && (
          <div>
            <label style={lbl}>Prazo para aprovação (horas)</label>
            <input type="number" min={1} className="input" style={{ maxWidth: 180 }} value={form.prazo_aprovacao_horas || 24} onChange={e => f('prazo_aprovacao_horas', e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Tempo que o supervisor tem para aprovar antes de ser alertado novamente</div>
          </div>
        )}
      </div>

      {/* ── 5. Notificações ── */}
      <div style={sCard}>
        <SH emoji="🔔" title="Notificações WhatsApp" sub="Quais mensagens automáticas são enviadas durante o processo" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ToggleRow checked={!!form.notifica_lider_resultado}     onChange={() => f('notifica_lider_resultado',     !form.notifica_lider_resultado)}     label="Notificar líder do resultado"          desc="Envia WA informando se o pedido foi aprovado ou reprovado" />
          <ToggleRow checked={!!form.notifica_supervisor_pendente} onChange={() => f('notifica_supervisor_pendente', !form.notifica_supervisor_pendente)} label="Alertar supervisor sobre pendências" desc="Lembrete quando o pedido aguarda aprovação além do prazo" />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 24 }}>
        <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 14, padding: '11px 28px', fontWeight: 800 }}>
          {saving ? 'Salvando...' : '💾 Salvar Regras'}
        </button>
      </div>
    </div>
  )
}

// Alias para compatibilidade
const CrudParametros = CrudRegras

// ─── Seção: Cadastros ─────────────────────────────────────────────────────────
function SecaoCadastros({ workspaceId, ownerId, sub }) {
  return (
    <div>
      {sub === 'restaurantes'  && <CrudRestaurantes  workspaceId={workspaceId} ownerId={ownerId} />}
      {sub === 'precos'        && <CrudTabelaPrecos  workspaceId={workspaceId} ownerId={ownerId} />}
      {sub === 'equipes'       && <CrudEquipes       workspaceId={workspaceId} ownerId={ownerId} />}
      {sub === 'colaboradores' && <CrudColaboradores workspaceId={workspaceId} />}
      {sub === 'cdc'           && <CrudCDC           workspaceId={workspaceId} ownerId={ownerId} />}
      {sub === 'regionais'     && <CrudRegionais     workspaceId={workspaceId} ownerId={ownerId} />}
      {sub === 'parametros'    && <CrudParametros    workspaceId={workspaceId} ownerId={ownerId} />}
    </div>
  )
}

// ─── Modal de Detalhe / Aprovação ────────────────────────────────────────────
function DetailModal({ sol, onClose, onUpdated, useFlowEngine, userId, workspaceId }) {
  const [itens,             setItens]             = useState([])
  const [motivo,            setMotivo]            = useState('')
  const [ocorr,             setOcorr]             = useState('')
  const [saving,            setSaving]            = useState(false)
  const [sendingSupervisor, setSendingSupervisor] = useState(false)
  const [tab,               setTab]               = useState('resumo')  // 'resumo' | 'timeline'

  async function reenviarSupervisor() {
    setSendingSupervisor(true)
    try {
      const r = await fetch('/api/refeicoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reenviar-supervisor', solicitacaoId: sol.id }),
      })
      const j = await r.json()
      if (r.ok) toast.success('Link enviado ao supervisor via WhatsApp!')
      else toast.error(j.error || 'Erro ao enviar')
    } catch { toast.error('Erro de conexão') }
    setSendingSupervisor(false)
  }

  useEffect(() => {
    supabase.from('refei_itens').select('*').eq('solicitacao_id', sol.id).order('colaborador_nome')
      .then(({ data }) => setItens(data || []))
  }, [sol.id])

  // ── Executar ação via API REST ──────────────────────────────────────────────
  async function execAcao(actionName, extra = {}) {
    setSaving(true)
    try {
      const r = await fetch('/api/refeicoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionName, solicitacaoId: sol.id, userId, ...extra }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      toast.success(j.mensagem || 'Ação realizada!')
      onUpdated()
      onClose()
    } catch (err) { toast.error(err.message || 'Erro') }
    setSaving(false)
  }

  // ── Aprovar / Reprovar (mantém compatibilidade com Flow Engine) ────────────
  async function aprovar(acao) {
    if (acao === 'reprovado' && !motivo.trim()) { toast.error('Informe o motivo'); return }
    setSaving(true)
    try {
      if (useFlowEngine) {
        const instRes = await fetch(`/api/flow-engine?action=instance&entidade_tipo=refei_solicitacoes&entidade_id=${sol.id}`)
        if (instRes.ok) {
          const { instancia } = await instRes.json()
          const actRes = await fetch(`/api/flow-engine?action=actions&instance_id=${instancia.id}`)
          const { acoes } = await actRes.json()
          const acaoNome = acao === 'aprovado' ? 'aprovar' : 'reprovar'
          const acaoObj = acoes.find(a => a.nome === acaoNome)
          if (!acaoObj) throw new Error(`Ação "${acaoNome}" não disponível nesta etapa`)
          const execRes = await fetch('/api/flow-engine?action=execute', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instance_id: instancia.id, acao_id: acaoObj.id, executado_por: userId, dados: acao === 'reprovado' ? { motivo } : {}, origem: 'humano' }),
          })
          const j = await execRes.json()
          if (!execRes.ok) throw new Error(j.error || 'Erro no motor de fluxo')
          toast.success(acao === 'aprovado' ? 'Aprovado! ✅' : 'Reprovado ❌')
          onUpdated(); onClose(); return
        }
      }
      const r = await fetch('/api/refeicoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'aprovar', solicitacaoId: sol.id, acao, motivo }),
      })
      const j = await r.json()
      if (r.ok) { toast.success(acao === 'aprovado' ? 'Aprovado!' : 'Reprovado'); onUpdated(); onClose() }
      else toast.error(j.error || 'Erro')
    } catch (err) { toast.error(err.message || 'Erro') }
    setSaving(false)
  }

  const st      = STATUS[sol.status] || STATUS.rascunho
  const ticket  = sol.ticket || sol.numero_pedido || '—'
  const isFinal = ['finalizado', 'finalizado_com_ocorrencia', 'fechado'].includes(sol.status)

  // ── Botões de ação por status ───────────────────────────────────────────────
  function ActionBlock() {
    const btnBase = { width: '100%', padding: '11px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }

    if (['pendente', 'aguardando_aprovacao'].includes(sol.status)) return (
      <div>
        {/* Info + botão reenvio para supervisor */}
        <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Supervisor</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {sol.supervisor_telefone
                ? <span>📱 {sol.supervisor_telefone}</span>
                : <span style={{ color: '#f87171' }}>⚠️ Telefone não cadastrado na equipe</span>}
            </div>
          </div>
          <button
            onClick={reenviarSupervisor}
            disabled={sendingSupervisor || !sol.supervisor_telefone}
            style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: sol.supervisor_telefone ? 'pointer' : 'not-allowed', opacity: sendingSupervisor || !sol.supervisor_telefone ? 0.5 : 1, whiteSpace: 'nowrap' }}
          >
            {sendingSupervisor ? '...' : '📲 Enviar link ao Supervisor'}
          </button>
        </div>
        <label style={lbl}>Motivo (obrigatório ao reprovar)</label>
        <input className="input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Descreva o motivo se for reprovar..." style={{ marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => aprovar('reprovado')} disabled={saving} className="btn-danger" style={{ flex: 1, justifyContent: 'center' }}>❌ Reprovar</button>
          <button onClick={() => aprovar('aprovado')}  disabled={saving} className="btn-success" style={{ flex: 1, justifyContent: 'center' }}>✅ Aprovar</button>
        </div>
      </div>
    )

    if (sol.status === 'aprovado') return (
      <button onClick={() => execAcao('consolidar')} disabled={saving} style={{ ...btnBase, background: '#6366f1', color: '#fff' }}>
        📦 Consolidar Pedido
      </button>
    )

    if (sol.status === 'consolidado') return (
      <button onClick={() => execAcao('enviar_restaurante')} disabled={saving} style={{ ...btnBase, background: '#8b5cf6', color: '#fff' }}>
        🏪 Marcar como Enviado ao Restaurante
      </button>
    )

    if (['enviado_restaurante', 'em_acompanhamento'].includes(sol.status)) return (
      <button onClick={() => execAcao('registrar_entrega')} disabled={saving} style={{ ...btnBase, background: '#10b981', color: '#fff' }}>
        🚚 Registrar Entrega
      </button>
    )

    if (sol.status === 'entregue') return (
      <button onClick={() => execAcao('enviar_validacao')} disabled={saving} style={{ ...btnBase, background: '#f97316', color: '#fff' }}>
        📱 Enviar Validação ao Líder
      </button>
    )

    if (sol.status === 'aguardando_validacao') return (
      <div>
        <div style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#f97316', marginBottom: 4 }}>📱 Aguardando validação do líder</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>O líder ainda não confirmou o recebimento. Você pode registrar manualmente abaixo.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button onClick={() => execAcao('validar_entrega', { resultado: 'correto' })} disabled={saving} style={{ ...btnBase, flex: 1, background: '#10b981', color: '#fff' }}>🎉 Confirmar Entrega Correta</button>
        </div>
        <label style={lbl}>Registrar ocorrência (se houve problema)</label>
        <input className="input" value={ocorr} onChange={e => setOcorr(e.target.value)} placeholder="Descreva o problema na entrega..." style={{ marginBottom: 10 }} />
        <button onClick={() => { if (!ocorr.trim()) { toast.error('Descreva a ocorrência'); return } execAcao('validar_entrega', { resultado: 'com_ocorrencia', ocorrencia: ocorr }) }} disabled={saving} style={{ ...btnBase, background: '#f59e0b', color: '#000' }}>⚠️ Finalizar com Ocorrência</button>
      </div>
    )

    if (sol.status === 'reprovado') return (
      <button onClick={() => execAcao('reabrir')} disabled={saving} style={{ ...btnBase, background: '#f59e0b', color: '#000' }}>
        🔄 Reabrir para Correção
      </button>
    )

    return null
  }

  return (
    <Modal title="" onClose={onClose} maxWidth={620}>

      {/* ── Cabeçalho do pedido ── */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '16px 20px', marginBottom: 18, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Protocolo</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: -0.5 }}>{ticket}</div>
          </div>
          <StatusBadge status={sol.status} />
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
          {[            { icon: '👥', val: sol.refei_equipes?.nome },
            { icon: '🏪', val: sol.refei_restaurantes?.nome },
            { icon: '📅', val: fmtData(sol.data_refeicao) },
            { icon: '👤', val: sol.lider_nome },
          ].filter(r => r.val).map((r, i) => (
            <span key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {r.icon} {r.val}
            </span>
          ))}
        </div>
      </div>

      {/* ── Cards de totais ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
        {[
          { label: 'Refeições', value: sol.total_refeicoes || 0, emoji: '🍽️', color: '#6366f1' },
          { label: 'Cafés',     value: sol.total_cafes     || 0, emoji: '☕', color: '#f59e0b' },
          { label: 'Pessoas',   value: itens.length,             emoji: '👥', color: '#06b6d4' },
          { label: 'Total',     value: fmtBRL(sol.valor_total),  emoji: '💰', color: '#10b981', text: true },
        ].map((c, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{c.emoji}</div>
            <div style={{ fontWeight: 800, fontSize: c.text ? 14 : 18, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Abas: Resumo / Timeline ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-secondary)', borderRadius: 10, padding: 4 }}>
        {[{ id: 'resumo', label: '📋 Resumo' }, { id: 'timeline', label: '⏱️ Timeline' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: tab === t.id ? 'var(--bg-card)' : 'transparent', color: tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)', boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Aba Resumo ── */}
      {tab === 'resumo' && (
        <div>
          {/* Colaboradores */}
          {itens.filter(it => !it.extra).length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={lbl}>Colaboradores ({itens.filter(it => !it.extra).length})</div>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {itens.filter(it => !it.extra).map(it => (
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{it.colaborador_nome}</span>
                    <span style={{ fontSize: 14 }}>{it.refeicao ? '🍽️ ' : ''}{it.cafe ? '☕' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Extras */}
          {itens.some(it => it.extra) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6 }}>⚠️ Extras</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {itens.filter(it => it.extra).map(it => (
                  <div key={it.id} style={{ padding: '6px 10px', background: 'rgba(245,158,11,0.05)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)', fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{it.colaborador_nome}</span>
                      <span>{it.refeicao ? '🍽️ ' : ''}{it.cafe ? '☕' : ''}</span>
                    </div>
                    {it.justificativa && <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2 }}>💬 {it.justificativa}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Observações e motivo */}
          {sol.observacoes && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, border: '1px solid var(--border)' }}>📝 {sol.observacoes}</div>
          )}
          {sol.motivo_reprovacao && (
            <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.07)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, border: '1px solid rgba(239,68,68,0.2)', borderLeft: '3px solid #ef4444' }}>❌ Reprovado: {sol.motivo_reprovacao}</div>
          )}
          {sol.ocorrencia && (
            <div style={{ fontSize: 12, color: '#fbbf24', background: 'rgba(245,158,11,0.07)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, border: '1px solid rgba(245,158,11,0.2)', borderLeft: '3px solid #f59e0b' }}>⚠️ Ocorrência: {sol.ocorrencia}</div>
          )}
          {/* Histórico de datas */}
          {[
            { label: 'Aprovado em',     val: sol.aprovado_em },
            { label: 'Consolidado em',  val: sol.consolidado_em },
            { label: 'Enviado rest.',   val: sol.env_restaurante_em },
            { label: 'Entregue em',     val: sol.entregue_em },
            { label: 'Validado em',     val: sol.validado_em },
          ].some(t => t.val) && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', padding: '10px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>🕐 Histórico</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { label: 'Aprovado em',     val: sol.aprovado_em },
                  { label: 'Consolidado em',  val: sol.consolidado_em },
                  { label: 'Enviado rest.',   val: sol.env_restaurante_em },
                  { label: 'Entregue em',     val: sol.entregue_em },
                  { label: 'Validado em',     val: sol.validado_em },
                ].filter(t => t.val).map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{t.label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{new Date(t.val).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Flow Engine */}
          {useFlowEngine && <FlowHistory solicitacaoId={sol.id} />}
        </div>
      )}

      {/* ── Aba Timeline ── */}
      {tab === 'timeline' && (
        <div style={{ minHeight: 120 }}>
          <PedidoTimeline solicitacaoId={sol.id} />
        </div>
      )}

      {/* ── Bloco de ações ── */}
      {!isFinal && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
          <ActionBlock />
        </div>
      )}

      {isFinal && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🏁 Pedido encerrado — nenhuma ação disponível</span>
        </div>
      )}
    </Modal>
  )
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#6366f1', width = 80, height = 28 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
    </svg>
  )
}

function relTime(iso) {
  if (!iso) return '—'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins}min`
  const h = Math.floor(mins / 60), m = mins % 60
  if (h < 24) return m > 0 ? `há ${h}h${m}m` : `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

// ─── Seção: Dashboard ─────────────────────────────────────────────────────────
function LineChart({ series, labels, height = 160, gridColor = '#E5EAF2', labelColor = '#A0AEC0', dotFill = 'white' }) {
  const VW = 480, VH = height
  const PAD = { t: 12, r: 16, b: 28, l: 36 }
  const cw = VW - PAD.l - PAD.r
  const ch = VH - PAD.t - PAD.b
  const allVals = series.flatMap(s => s.data)
  const mx = Math.max(...allVals, 1)
  const n = labels.length
  const px = i => PAD.l + (i / Math.max(n - 1, 1)) * cw
  const py = v => PAD.t + ch - (v / mx) * ch
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(p => {
        const y = PAD.t + ch * (1 - p)
        return (
          <g key={p}>
            <line x1={PAD.l} x2={VW - PAD.r} y1={y} y2={y} stroke={gridColor} strokeWidth={1} />
            <text x={PAD.l - 5} y={y + 4} textAnchor="end" fontSize={9} fill={labelColor} fontFamily="sans-serif">{p > 0 ? Math.round(mx * p) : '0'}</text>
          </g>
        )
      })}
      <defs>
        {series.map((s, si) => (
          <linearGradient key={si} id={`lg${si}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
        const area = `${PAD.l},${(PAD.t + ch).toFixed(1)} ${pts} ${px(n - 1).toFixed(1)},${(PAD.t + ch).toFixed(1)}`
        return (
          <g key={si}>
            <polygon points={area} fill={`url(#lg${si})`} />
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {s.data.map((v, i) => <circle key={i} cx={px(i)} cy={py(v)} r={3.5} fill={dotFill} stroke={s.color} strokeWidth={2} />)}
          </g>
        )
      })}
      {labels.map((l, i) => (
        <text key={i} x={px(i)} y={VH - 5} textAnchor="middle" fontSize={9} fill={labelColor} fontFamily="sans-serif">{l.slice(5)}</text>
      ))}
    </svg>
  )
}

function HBarChart({ items, colorFn, labelColor = '#1A2332', trackColor = '#EEF2F8' }) {
  if (!items || items.length === 0) return <div style={{ textAlign: 'center', color: labelColor, fontSize: 12, padding: '24px 0' }}>Sem dados disponíveis</div>
  const max = Math.max(...items.map(it => it.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((it, i) => {
        const pct = (it.value / max) * 100
        const color = colorFn(i)
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: labelColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{it.label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color }}>{it.value} itens</span>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: trackColor, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DonutChart({ segments, emptyColor = '#E5EAF2', centerColor = '#1A2332', subColor = '#6B7A99' }) {
  const r = 50, cx = 62, cy = 62, sw = 14
  const tot = segments.reduce((a, s) => a + s.value, 0)
  const C = 2 * Math.PI * r
  let off = 0
  return (
    <svg viewBox="0 0 124 124" style={{ width: '100%', maxWidth: 136, display: 'block', margin: '0 auto' }}>
      {segments.length === 0
        ? <circle cx={cx} cy={cy} r={r} fill="none" stroke={emptyColor} strokeWidth={sw} />
        : segments.map((s, i) => {
            const pct = s.value / tot
            const dash = pct * C, gap = C - dash
            const rot = off * 360 - 90
            off += pct
            return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`} transform={`rotate(${rot.toFixed(1)} ${cx} ${cy})`} strokeLinecap="butt" />
          })
      }
      {tot > 0 && <>
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={22} fontWeight={800} fill={centerColor} fontFamily="sans-serif">{tot}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={8} fill={subColor} fontFamily="sans-serif">TOTAL</text>
      </>}
    </svg>
  )
}

function SecaoDashboard({ sols, onNav }) {
  const [dateFilter, setDateFilter] = useState('')
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') !== 'light')
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.getAttribute('data-theme') !== 'light'))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const dash = useMemo(() => {
    const hoje      = dateFilter || todayISO()
    const now       = new Date()
    const y = now.getFullYear(), mo = now.getMonth()
    const ontemD    = new Date(now); ontemD.setDate(ontemD.getDate() - 1)
    const ontem     = ontemD.toISOString().slice(0, 10)
    const startMes  = new Date(y, mo, 1).toISOString().slice(0, 10)
    const startMAnt = new Date(y, mo - 1, 1).toISOString().slice(0, 10)
    const endMAnt   = new Date(y, mo, 0).toISOString().slice(0, 10)
    const last7     = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (6 - i)); return d.toISOString().slice(0, 10)
    })

    const ativos      = sols.filter(s => s.status !== 'rascunho')
    const pendentes   = ativos.filter(s => ['pendente', 'aguardando_aprovacao'].includes(s.status))
    const aprovSts    = ativos.filter(s => s.status === 'aprovado')
    const emPreparo   = ativos.filter(s => ['confirmado_restaurante', 'enviado_restaurante', 'em_acompanhamento'].includes(s.status))
    const entregues   = ativos.filter(s => s.status === 'entregue')
    const reprovados  = ativos.filter(s => s.status === 'reprovado')
    const divergencias = ativos.filter(s => ['aguardando_validacao', 'finalizado_com_ocorrencia'].includes(s.status))
    const aguardEnt   = ativos.filter(s => ['aprovado', 'confirmado_restaurante', 'enviado_restaurante', 'em_acompanhamento'].includes(s.status))

    const hojeSols  = ativos.filter(s => s.data_refeicao === hoje)
    const ontemSols = ativos.filter(s => s.data_refeicao === ontem)
    const sum       = (arr, k) => arr.reduce((a, s) => a + (Number(s[k]) || 0), 0)

    const hojeRef   = sum(hojeSols,  'total_refeicoes')
    const hojeCaf   = sum(hojeSols,  'total_cafes')
    const hojeCusto = sum(hojeSols,  'valor_total')
    const ontemRef  = sum(ontemSols, 'total_refeicoes')
    const ontemCaf  = sum(ontemSols, 'total_cafes')

    const mesSols   = ativos.filter(s => s.data_refeicao >= startMes)
    const mAntSols  = ativos.filter(s => s.data_refeicao >= startMAnt && s.data_refeicao <= endMAnt)
    const valorMes  = sum(mesSols, 'valor_total')
    const valorMAnt = sum(mAntSols, 'valor_total')
    const refMes    = sum(mesSols, 'total_refeicoes')
    const cafMes    = sum(mesSols, 'total_cafes')

    const entreguesHoje = entregues.filter(s => s.data_refeicao === hoje).length

    const fv = (cur, prev) => {
      if (!prev) return null
      const p = (cur - prev) / prev * 100
      return { text: `${p >= 0 ? '+' : ''}${p.toFixed(0)}%`, up: p >= 0 }
    }

    const hojePedRef = hojeSols.filter(s => (s.total_refeicoes || 0) > 0).length
    const hojePedCaf = hojeSols.filter(s => (s.total_cafes || 0) > 0).length

    const kpis = [
      { icon: '🍽️', label: 'Refeições hoje', val: hojePedRef, isText: false, color: '#4F6EF7', var: fv(hojeRef, ontemRef), varLabel: 'vs ontem', footer: `Mês: ${refMes} refeições`, secondary: hojeRef, secondaryLabel: 'refeições hoje' },
      { icon: '☕',  label: 'Cafés hoje',     val: hojePedCaf, isText: false, color: '#F59E0B', var: fv(hojeCaf, ontemCaf), varLabel: 'vs ontem', footer: `Mês: ${cafMes} cafés`,    secondary: hojeCaf, secondaryLabel: 'cafés hoje' },
      { icon: '⏳',  label: 'Pend. aprovação',     val: pendentes.length,  isText: false, color: pendentes.length > 0 ? '#EF4444' : '#10B981', var: null, varLabel: null, footer: pendentes.length > 0 ? `${pendentes.length} aguardando revisão` : 'Tudo em dia ✓' },
      { icon: '✅',  label: 'Aprovados',            val: aprovSts.length,  isText: false, color: '#10B981', var: null, varLabel: null, footer: `${entregues.length} já entregues` },
      { icon: '🚚',  label: 'Aguard. entrega',     val: aguardEnt.length,  isText: false, color: '#8B5CF6', var: null, varLabel: null, footer: `${entreguesHoje} entregues hoje` },
      { icon: '⚠️',  label: 'Divergências',        val: divergencias.length, isText: false, color: divergencias.length > 0 ? '#F97316' : '#94A3B8', var: null, varLabel: null, footer: divergencias.length > 0 ? 'Requer atenção' : 'Nenhuma ocorrência' },
      { icon: '💰',  label: 'Custo previsto dia',  val: fmtBRL(hojeCusto), isText: true,  color: '#14B8A6', var: null, varLabel: null, footer: `${hojeRef + hojeCaf} itens previstos` },
      { icon: '📊',  label: 'Custo no mês',        val: fmtBRL(valorMes),  isText: true,  color: '#6366f1', var: fv(valorMes, valorMAnt), varLabel: 'vs mês ant.', footer: valorMAnt > 0 ? `Ant.: ${fmtBRL(valorMAnt)}` : 'Sem comparativo' },
    ]

    const chartRef7 = last7.map(d => sum(ativos.filter(s => s.data_refeicao === d), 'total_refeicoes'))
    const chartCaf7 = last7.map(d => sum(ativos.filter(s => s.data_refeicao === d), 'total_cafes'))

    const hasCDC    = ativos.some(s => s.refei_equipes?.cdc)
    const cdcMap    = {}
    for (const s of ativos) {
      const key = hasCDC ? (s.refei_equipes?.cdc || 'Sem CDC') : (s.refei_equipes?.nome || 'Sem equipe')
      if (!cdcMap[key]) cdcMap[key] = 0
      cdcMap[key] += (s.total_refeicoes || 0) + (s.total_cafes || 0)
    }
    const chartCDC  = Object.entries(cdcMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6)
    const cdcLabel  = hasCDC ? 'Consumo por CDC' : 'Consumo por Equipe'

    const donut = [
      { label: 'Pend. Aprovação',  value: pendentes.length,    color: '#F59E0B' },
      { label: 'Aprovados',        value: aprovSts.length,     color: '#4F6EF7' },
      { label: 'Preparo/Entrega',  value: emPreparo.length,    color: '#8B5CF6' },
      { label: 'Entregues',        value: entregues.length,    color: '#10B981' },
      { label: 'Reprovados',       value: reprovados.length,   color: '#EF4444' },
      { label: 'Divergências',     value: divergencias.length, color: '#F97316' },
    ].filter(d => d.value > 0)

    const eqMap = {}
    for (const s of ativos) {
      const nome = s.refei_equipes?.nome || 'Sem equipe'
      if (!eqMap[nome]) eqMap[nome] = { nome, total: 0, valor: 0 }
      eqMap[nome].total += (s.total_refeicoes || 0) + (s.total_cafes || 0)
      eqMap[nome].valor += Number(s.valor_total) || 0
    }
    const rankingEq = Object.values(eqMap).sort((a, b) => b.total - a.total).slice(0, 5)

    const restMap = {}
    for (const s of ativos) {
      const nome = s.refei_restaurantes?.nome || 'Sem restaurante'
      if (!restMap[nome]) restMap[nome] = { nome, total: 0, valor: 0, ped: 0 }
      restMap[nome].total += (s.total_refeicoes || 0) + (s.total_cafes || 0)
      restMap[nome].valor += Number(s.valor_total) || 0
      restMap[nome].ped++
    }
    const rankingRest = Object.values(restMap).sort((a, b) => b.valor - a.valor).slice(0, 5)

    const painelMap = {}
    for (const s of hojeSols) {
      const nome = s.refei_restaurantes?.nome || 'Sem restaurante'
      if (!painelMap[nome]) painelMap[nome] = { nome, ref: 0, caf: 0, pend: 0, ent: 0, div: 0, valor: 0 }
      painelMap[nome].ref   += s.total_refeicoes || 0
      painelMap[nome].caf   += s.total_cafes || 0
      painelMap[nome].valor += Number(s.valor_total) || 0
      if (['pendente', 'aguardando_aprovacao'].includes(s.status)) painelMap[nome].pend++
      if (s.status === 'entregue') painelMap[nome].ent++
      if (['aguardando_validacao', 'finalizado_com_ocorrencia'].includes(s.status)) painelMap[nome].div++
    }
    const painelHoje = Object.values(painelMap).sort((a, b) => (b.ref + b.caf) - (a.ref + a.caf))

    const alertas = []
    const pendLongos = pendentes.filter(s => s.criado_em && (Date.now() - new Date(s.criado_em)) > 7200000)
    if (pendLongos.length) {
      const oldest = [...pendLongos].sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em))[0]
      alertas.push({ type: 'warn', icon: '🕐', title: `${pendLongos.length} solicitação${pendLongos.length > 1 ? 'ões' : ''} fora do prazo`, desc: `Aguardando aprovação há mais de 2h — mais antigo: ${relTime(oldest.criado_em)}`, action: 'Ver Aprovações', nav: () => onNav('operacoes', 'aprovacoes') })
    }
    const aprovHoje = aprovSts.filter(s => s.data_refeicao === hoje)
    if (aprovHoje.length) alertas.push({ type: 'warn', icon: '🚚', title: `${aprovHoje.length} entrega${aprovHoje.length > 1 ? 's' : ''} com confirmação pendente`, desc: 'Aprovados mas restaurante ainda não confirmou a entrega', action: null })
    if (valorMAnt > 0 && (valorMes - valorMAnt) / valorMAnt > 0.15) alertas.push({ type: 'danger', icon: '📈', title: 'Custo do mês acima do período anterior', desc: `${fmtBRL(valorMes)} vs ${fmtBRL(valorMAnt)} — variação de +${(((valorMes - valorMAnt) / valorMAnt) * 100).toFixed(0)}%`, action: null })
    const reprov7 = reprovados.filter(s => s.data_refeicao >= last7[0])
    if (reprov7.length) alertas.push({ type: 'danger', icon: '❌', title: `${reprov7.length} pedido${reprov7.length > 1 ? 's' : ''} reprovado${reprov7.length > 1 ? 's' : ''} nos últimos 7 dias`, desc: 'Verifique os motivos de reprovação no histórico', action: null })
    if (divergencias.length) alertas.push({ type: 'warn', icon: '⚠️', title: `${divergencias.length} divergência${divergencias.length > 1 ? 's' : ''} pendente${divergencias.length > 1 ? 's' : ''}`, desc: 'Pedidos com ocorrências aguardando validação', action: null })

    // ── Próxima Ação Recomendada ──────────────────────────────────────────
    let proximaAcao = null
    if (pendLongos.length > 0) {
      proximaAcao = { cor: '#ef4444', bg: 'rgba(239,68,68,0.10)', borda: 'rgba(239,68,68,0.30)',
        emoji: '🔴', msg: `${pendLongos.length} solicitação(ões) aguardando aprovação há mais de 2h`,
        acao: 'Aprovar agora', navKey: 'aprovacoes' }
    } else if (pendentes.length > 0) {
      proximaAcao = { cor: '#f59e0b', bg: 'rgba(245,158,11,0.10)', borda: 'rgba(245,158,11,0.30)',
        emoji: '⏳', msg: `${pendentes.length} solicitação(ões) aguardando aprovação`,
        acao: 'Ver aprovações', navKey: 'aprovacoes' }
    } else if (divergencias.length > 0) {
      proximaAcao = { cor: '#f97316', bg: 'rgba(249,115,22,0.10)', borda: 'rgba(249,115,22,0.30)',
        emoji: '⚠️', msg: `${divergencias.length} divergência(s) pendente(s) de validação`,
        acao: 'Resolver', navKey: 'historico' }
    } else if (aguardEnt.length > 0) {
      proximaAcao = { cor: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', borda: 'rgba(139,92,246,0.30)',
        emoji: '🚚', msg: `${aguardEnt.length} pedido(s) aprovado(s) aguardando entrega do restaurante`,
        acao: 'Monitorar', navKey: null }
    } else {
      proximaAcao = { cor: '#10b981', bg: 'rgba(16,185,129,0.10)', borda: 'rgba(16,185,129,0.25)',
        emoji: '✅', msg: 'Sem pendências críticas no momento' + (valorMes > 0 ? ` — custo acumulado no mês: ${fmtBRL(valorMes)}` : ''),
        acao: null, navKey: null }
    }

    return { kpis, chartLabels: last7, chartRef7, chartCaf7, chartCDC, cdcLabel, donut, rankingEq, rankingRest, painelHoje, alertas, pendentesCount: pendentes.length, hoje, proximaAcao }
  }, [sols, dateFilter])

  const COLORS  = ['#4F6EF7', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4', '#F97316', '#14B8A6']
  const REST_CL = ['#14B8A6', '#8B5CF6', '#4F6EF7', '#F59E0B', '#10B981']
  const BG     = isDark ? '#0d0f12'                : '#EEF2F8'
  const CARD   = isDark ? '#1a1d22'                : '#FFFFFF'
  const BORDER = isDark ? 'rgba(255,255,255,0.08)' : '#E5EAF2'
  const SHADOW = isDark
    ? '0 1px 4px rgba(0,0,0,0.3), 0 4px 20px rgba(0,0,0,0.25)'
    : '0 1px 4px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.05)'
  const TEXT   = isDark ? '#e8eaed'                : '#1A2332'
  const TEXT2  = isDark ? '#8a9099'                : '#6B7A99'
  const TEXT3  = isDark ? '#555d6e'                : '#A0AEC0'

  const cardStyle = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: SHADOW }

  return (
    <div style={{ margin: '-20px -24px', background: BG, minHeight: 'calc(100% + 40px)' }}>

      {/* ── Module Header ─────────────────────────────────────────────────────── */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, letterSpacing: '-0.02em', lineHeight: 1 }}>Dashboard</div>
          <div style={{ fontSize: 12, color: TEXT2, marginTop: 4 }}>Torre de Controle de Alimentação Operacional</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: isDark ? '#1f2329' : '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '7px 12px' }}>
            <CalendarDaysIcon style={{ width: 14, height: 14, color: TEXT2, flexShrink: 0 }} />
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: 12, color: TEXT, outline: 'none', cursor: 'pointer', minWidth: 0 }} />
            {dateFilter && <button onClick={() => setDateFilter('')} style={{ background: 'none', border: 'none', color: TEXT3, cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}>✕</button>}
          </div>
          <div style={{ fontSize: 11, color: TEXT3, background: isDark ? '#1f2329' : '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '7px 12px', whiteSpace: 'nowrap' }}>
            {dateFilter ? `Exibindo: ${fmtData(dateFilter)}` : `Hoje: ${fmtData(todayISO())}`}
          </div>
          {dash.pendentesCount > 0 && (
            <button onClick={() => onNav('operacoes', 'aprovacoes')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: isDark ? 'rgba(217,119,6,0.18)' : '#FEF3C7', border: `1px solid ${isDark ? 'rgba(217,119,6,0.45)' : '#FDE68A'}`, borderRadius: 10, padding: '7px 14px', cursor: 'pointer', color: isDark ? '#FCD34D' : '#92400E', fontSize: 12, fontWeight: 700 }}>
              ⏳ {dash.pendentesCount} pendente{dash.pendentesCount > 1 ? 's' : ''} →
            </button>
          )}
        </div>
      </div>

      {/* ── Faixa de Próxima Ação ── */}
      {dash.proximaAcao && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 28px', background: dash.proximaAcao.bg,
          borderBottom: `1px solid ${dash.proximaAcao.borda}`, gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15 }}>{dash.proximaAcao.emoji}</span>
            <span style={{ fontSize: 13, color: dash.proximaAcao.cor, fontWeight: 600 }}>Próxima ação:</span>
            <span style={{ fontSize: 13, color: TEXT }}>{dash.proximaAcao.msg}</span>
          </div>
          {dash.proximaAcao.acao && dash.proximaAcao.navKey && (
            <button
              onClick={() => onNav('operacoes', dash.proximaAcao.navKey)}
              style={{ padding: '6px 16px', borderRadius: 8, border: `1px solid ${dash.proximaAcao.borda}`,
                background: dash.proximaAcao.bg, color: dash.proximaAcao.cor,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={e => e.target.style.opacity = '0.75'}
              onMouseLeave={e => e.target.style.opacity = '1'}>
              {dash.proximaAcao.acao} →
            </button>
          )}
        </div>
      )}

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: 14 }}>
          {dash.kpis.map((k, i) => {
            if (k.secondary !== undefined) return (
              <div key={i} style={{ ...cardStyle, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                {/* accent top bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.color, borderRadius: '16px 16px 0 0' }} />
                {/* soft gradient wash */}
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${k.color}0a 0%, transparent 60%)`, borderRadius: 16, pointerEvents: 'none' }} />
                {/* header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, position: 'relative' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.label}</span>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${k.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{k.icon}</div>
                </div>
                {/* split value row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative', marginBottom: 12 }}>
                  {/* primary — pedidos */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: TEXT, lineHeight: 1, letterSpacing: '-0.03em' }}>{k.val}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: TEXT2, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pedidos</div>
                  </div>
                  {/* divider */}
                  <div style={{ width: 1, height: 42, background: BORDER, flexShrink: 0, margin: '0 14px' }} />
                  {/* secondary — refeições / cafés */}
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: k.color, lineHeight: 1, letterSpacing: '-0.02em', opacity: 0.9 }}>{k.secondary}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: TEXT3, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{k.secondaryLabel}</div>
                    {k.var && (
                      <div style={{ marginTop: 5, fontSize: 9, fontWeight: 700, color: k.var.up ? '#10B981' : '#EF4444', background: k.var.up ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${k.var.up ? '#A7F3D0' : '#FECACA'}`, borderRadius: 999, padding: '2px 7px', display: 'inline-block' }}>
                        {k.var.text} {k.varLabel}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ paddingTop: 10, borderTop: `1px solid ${BORDER}`, fontSize: 11, color: TEXT3, lineHeight: 1.4 }}>{k.footer}</div>
              </div>
            )
            return (
              <div key={i} style={{ ...cardStyle, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.color, borderRadius: '16px 16px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1.5, maxWidth: '72%' }}>{k.label}</span>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${k.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{k.icon}</div>
                </div>
                <div style={{ fontSize: k.isText ? 18 : 34, fontWeight: 800, color: TEXT, lineHeight: 1, letterSpacing: '-0.025em', marginBottom: 7 }}>{k.val}</div>
                {k.var
                  ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: k.var.up ? '#059669' : '#DC2626', background: k.var.up ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${k.var.up ? '#A7F3D0' : '#FECACA'}`, borderRadius: 999, padding: '2px 8px', marginBottom: 9 }}>
                      {k.var.text} {k.varLabel}
                    </div>
                  : <div style={{ height: 22, marginBottom: 1 }} />
                }
                <div style={{ paddingTop: 10, borderTop: `1px solid ${BORDER}`, fontSize: 11, color: TEXT3, lineHeight: 1.4 }}>{k.footer}</div>
              </div>
            )
          })}
        </div>

        {/* ── Charts Row ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 1fr', gap: 14 }}>

          {/* Evolução diária */}
          <div style={{ ...cardStyle, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Evolução diária</div>
                <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>Refeições e cafés — últimos 7 dias</div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontSize: 11, color: '#4F6EF7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 20, height: 3, background: '#4F6EF7', borderRadius: 2, display: 'inline-block' }} />Refeições
                </span>
                <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 20, height: 3, background: '#F59E0B', borderRadius: 2, display: 'inline-block' }} />Cafés
                </span>
              </div>
            </div>
            <LineChart series={[{ data: dash.chartRef7, color: '#4F6EF7' }, { data: dash.chartCaf7, color: '#F59E0B' }]} labels={dash.chartLabels} height={158} gridColor={BORDER} labelColor={TEXT3} dotFill={CARD} />
          </div>

          {/* CDC / Equipe breakdown */}
          <div style={{ ...cardStyle, padding: '20px 22px' }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{dash.cdcLabel}</div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>Itens consumidos {dash.cdcLabel.includes('CDC') ? 'por CDC' : 'por equipe'}</div>
            </div>
            <HBarChart items={dash.chartCDC} colorFn={i => COLORS[i % COLORS.length]} labelColor={TEXT} trackColor={BG} />
          </div>

          {/* Status donut */}
          <div style={{ ...cardStyle, padding: '20px 22px' }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Por status</div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>Distribuição atual</div>
            </div>
            <DonutChart segments={dash.donut} emptyColor={BORDER} centerColor={TEXT} subColor={TEXT2} />
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {dash.donut.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: TEXT2 }}>{d.label}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: d.color }}>{d.value}</span>
                </div>
              ))}
              {dash.donut.length === 0 && <div style={{ fontSize: 11, color: TEXT3, textAlign: 'center', padding: '8px 0' }}>Sem dados</div>}
            </div>
          </div>
        </div>

        {/* ── Operations Row ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 14 }}>

          {/* Ranking equipes */}
          <div style={{ ...cardStyle, padding: '20px 22px' }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>🏆 Top Equipes</div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>Por volume de consumo (itens)</div>
            </div>
            {dash.rankingEq.length === 0
              ? <div style={{ fontSize: 12, color: TEXT3, textAlign: 'center', padding: '24px 0' }}>Sem dados suficientes</div>
              : dash.rankingEq.map((eq, i) => {
                  const pct   = (eq.total / (dash.rankingEq[0].total || 1)) * 100
                  const color = COLORS[i % COLORS.length]
                  return (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 20, height: 20, borderRadius: '50%', background: `${color}18`, color, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{eq.nome}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color }}>{eq.total}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: BG }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999 }} />
                      </div>
                      <div style={{ fontSize: 10, color: TEXT3, marginTop: 4 }}>{fmtBRL(eq.valor)}</div>
                    </div>
                  )
                })
            }
          </div>

          {/* Ranking restaurantes */}
          <div style={{ ...cardStyle, padding: '20px 22px' }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>🍽️ Top Restaurantes</div>
              <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>Por valor total faturado</div>
            </div>
            {dash.rankingRest.length === 0
              ? <div style={{ fontSize: 12, color: TEXT3, textAlign: 'center', padding: '24px 0' }}>Sem dados suficientes</div>
              : dash.rankingRest.map((r, i) => {
                  const pct   = (r.valor / (dash.rankingRest[0].valor || 1)) * 100
                  const color = REST_CL[i] || COLORS[i % COLORS.length]
                  return (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 20, height: 20, borderRadius: '50%', background: `${color}18`, color, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{r.nome}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color }}>{fmtBRL(r.valor)}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: BG }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999 }} />
                      </div>
                      <div style={{ fontSize: 10, color: TEXT3, marginTop: 4 }}>{r.total} itens · {r.ped} pedido{r.ped > 1 ? 's' : ''}</div>
                    </div>
                  )
                })
            }
          </div>

          {/* Painel operacional */}
          <div style={{ ...cardStyle, padding: '20px 22px' }}>
            <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>📋 Painel Operacional</div>
                <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>{dash.hoje === todayISO() ? 'Situação de hoje' : fmtData(dash.hoje)}</div>
              </div>
            </div>
            {dash.painelHoje.length === 0
              ? <div style={{ fontSize: 12, color: TEXT3, textAlign: 'center', padding: '28px 0' }}>Sem pedidos para {dash.hoje === todayISO() ? 'hoje' : fmtData(dash.hoje)}</div>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                        {['Restaurante', '🍽️', '☕', '⏳', '📦', '⚠️', 'Valor'].map((h, i) => (
                          <th key={i} style={{ padding: '6px 8px', textAlign: i === 0 ? 'left' : 'center', fontSize: 9, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dash.painelHoje.map((r, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <td style={{ padding: '9px 8px', fontWeight: 600, color: TEXT, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{r.nome}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'center', color: '#4F6EF7', fontWeight: 700 }}>{r.ref}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'center', color: '#F59E0B', fontWeight: 700 }}>{r.caf}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'center' }}>{r.pend > 0 ? <span style={{ color: '#EF4444', fontWeight: 700 }}>{r.pend}</span> : <span style={{ color: TEXT3 }}>—</span>}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'center' }}>{r.ent > 0 ? <span style={{ color: '#10B981', fontWeight: 700 }}>{r.ent}</span> : <span style={{ color: TEXT3 }}>—</span>}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'center' }}>{r.div > 0 ? <span style={{ color: '#F97316', fontWeight: 700 }}>{r.div}</span> : <span style={{ color: TEXT3 }}>—</span>}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, color: '#14B8A6', whiteSpace: 'nowrap', fontSize: 11 }}>{fmtBRL(r.valor)}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: `2px solid ${BORDER}`, background: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }}>
                        <td style={{ padding: '9px 8px', fontWeight: 800, color: TEXT, fontSize: 11 }}>TOTAL GERAL</td>
                        <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 800, color: '#4F6EF7' }}>{dash.painelHoje.reduce((a, r) => a + r.ref, 0)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 800, color: '#F59E0B' }}>{dash.painelHoje.reduce((a, r) => a + r.caf, 0)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 800, color: '#EF4444' }}>{dash.painelHoje.reduce((a, r) => a + r.pend, 0)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 800, color: '#10B981' }}>{dash.painelHoje.reduce((a, r) => a + r.ent, 0)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 800, color: '#F97316' }}>{dash.painelHoje.reduce((a, r) => a + r.div, 0)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 800, color: '#14B8A6', fontSize: 11 }}>{fmtBRL(dash.painelHoje.reduce((a, r) => a + r.valor, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
            }
          </div>
        </div>

        {/* ── Alerts ──────────────────────────────────────────────────────────── */}
        {dash.alertas.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT2, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
              Alertas e Exceções
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {dash.alertas.map((a, i) => {
                const isWarn     = a.type === 'warn'
                const alertColor = isWarn ? '#D97706' : '#DC2626'
                const alertBg    = isWarn ? (isDark ? 'rgba(217,119,6,0.12)'  : '#FFFBEB') : (isDark ? 'rgba(220,38,38,0.12)'  : '#FFF5F5')
                const alertBrd   = isWarn ? (isDark ? 'rgba(217,119,6,0.4)'   : '#FDE68A') : (isDark ? 'rgba(220,38,38,0.4)'   : '#FEE2E2')
                return (
                  <div key={i} style={{ background: alertBg, border: `1px solid ${alertBrd}`, borderLeft: `4px solid ${isWarn ? '#F59E0B' : '#EF4444'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize: 20, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>{a.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 3 }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: TEXT2, lineHeight: 1.5 }}>{a.desc}</div>
                      {a.action && (
                        <button onClick={a.nav} style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: alertColor, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>{a.action} →</button>
                      )}
                    </div>
                    <span style={{ fontSize: 18, color: TEXT3, flexShrink: 0, lineHeight: 1 }}>›</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Seção: Solicitações ──────────────────────────────────────────────────────
function ModalNovaSolicitacao({ workspaceId, ownerId, onClose, onSaved }) {
  const [form,    setForm]    = useState({ equipe_id: '', restaurante_id: '', data_refeicao: todayISO(), total_refeicoes: '', total_cafes: '', observacoes: '' })
  const [equipes, setEquipes] = useState([])
  const [rests,   setRests]   = useState([])
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    supabase.from('refei_equipes').select('id,nome,cdc,lider_nome,supervisor_nome,supervisor_telefone').eq('workspace_id', workspaceId).eq('ativo', true).order('nome')
      .then(({ data }) => setEquipes(data || []))
    supabase.from('refei_restaurantes').select('id,nome,valor_refeicao,valor_cafe').eq('workspace_id', workspaceId).eq('ativo', true).order('nome')
      .then(({ data }) => setRests(data || []))
  }, [workspaceId])

  const eq  = equipes.find(e => e.id === form.equipe_id)
  const rst = rests.find(r => r.id === form.restaurante_id)
  const nRef = Number(form.total_refeicoes) || 0
  const nCaf = Number(form.total_cafes)     || 0
  const valorTotal = (rst ? (nRef * (rst.valor_refeicao || 0)) + (nCaf * (rst.valor_cafe || 0)) : 0)

  function f(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function salvar() {
    if (!form.equipe_id)       { toast.error('Selecione a equipe'); return }
    if (!form.restaurante_id)  { toast.error('Selecione o restaurante'); return }
    if (!form.data_refeicao)   { toast.error('Informe a data'); return }
    if (nRef + nCaf === 0)     { toast.error('Informe ao menos 1 refeição ou café'); return }
    setSaving(true)
    try {
      const payload = {
        workspace_id:      workspaceId,
        owner_id:          ownerId,
        equipe_id:         form.equipe_id,
        restaurante_id:    form.restaurante_id,
        data_refeicao:     form.data_refeicao,
        total_refeicoes:   nRef,
        total_cafes:       nCaf,
        valor_total:       valorTotal,
        observacoes:       form.observacoes || null,
        status:            'pendente',
        lider_nome:        eq?.lider_nome          || null,
        supervisor_nome:   eq?.supervisor_nome      || null,
        supervisor_telefone: eq?.supervisor_telefone || null,
        origem:            'manual',
      }
      const { error } = await supabase.from('refei_solicitacoes').insert(payload)
      if (error) throw new Error(error.message)
      toast.success('Solicitação criada!')
      onSaved()
      onClose()
    } catch (err) { toast.error(err.message || 'Erro ao salvar') }
    setSaving(false)
  }

  return (
    <Modal title="Nova Solicitação de Refeição" onClose={onClose} maxWidth={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Equipe *</label>
            <select className="input" style={{ fontSize: 13 }} value={form.equipe_id} onChange={e => f('equipe_id', e.target.value)}>
              <option value="">Selecione a equipe...</option>
              {equipes.map(e => <option key={e.id} value={e.id}>{e.nome}{e.cdc ? ` (CDC ${e.cdc})` : ''}</option>)}
            </select>
            {eq && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Líder: {eq.lider_nome || '—'} · Supervisor: {eq.supervisor_nome || '—'}</div>}
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Restaurante *</label>
            <select className="input" style={{ fontSize: 13 }} value={form.restaurante_id} onChange={e => f('restaurante_id', e.target.value)}>
              <option value="">Selecione o restaurante...</option>
              {rests.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
            {rst && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Refeição: {fmtBRL(rst.valor_refeicao)} · Café: {fmtBRL(rst.valor_cafe)}</div>}
          </div>
          <div>
            <label style={lbl}>Data da Refeição *</label>
            <input type="date" className="input" style={{ fontSize: 13 }} value={form.data_refeicao} onChange={e => f('data_refeicao', e.target.value)} />
          </div>
          <div />
          <div>
            <label style={lbl}>🍽️ Qtd. Refeições</label>
            <input type="number" min="0" className="input" style={{ fontSize: 13 }} placeholder="0" value={form.total_refeicoes} onChange={e => f('total_refeicoes', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>☕ Qtd. Cafés</label>
            <input type="number" min="0" className="input" style={{ fontSize: 13 }} placeholder="0" value={form.total_cafes} onChange={e => f('total_cafes', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Observações</label>
            <textarea className="input" rows={2} style={{ resize: 'vertical', fontSize: 13 }} placeholder="Opcional..." value={form.observacoes} onChange={e => f('observacoes', e.target.value)} />
          </div>
        </div>
        {(nRef + nCaf > 0 && rst) && (
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{nRef} refeição(ões) + {nCaf} café(s)</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{fmtBRL(valorTotal)}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }}>
            {saving ? 'Salvando...' : '✅ Criar Solicitação'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function SecaoSolicitacoes({ sols, workspaceId, ownerId, onReload, loading, useFlowEngine }) {
  const [busca,        setBusca]        = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroData,   setFiltroData]   = useState('')
  const [collapsed,    setCollapsed]    = useState({})
  const [detailSol,    setDetailSol]    = useState(null)
  const [sendingLembrete, setSendingLembrete] = useState(null)
  const [showNova,     setShowNova]     = useState(false)

  const filtered = useMemo(() => {
    let list = sols.filter(s => s.status !== 'rascunho')
    if (filtroStatus !== 'todos') {
      if (filtroStatus === 'pendente' || filtroStatus === 'aguardando_aprovacao') {
        list = list.filter(s => s.status === 'pendente' || s.status === 'aguardando_aprovacao')
      } else {
        list = list.filter(s => s.status === filtroStatus)
      }
    }
    if (filtroData)               list = list.filter(s => s.data_refeicao === filtroData)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(s =>
        (s.numero_pedido || '').toLowerCase().includes(q) ||
        (s.lider_nome    || '').toLowerCase().includes(q) ||
        (s.refei_equipes?.nome || '').toLowerCase().includes(q) ||
        (s.refei_equipes?.cdc  || '').toLowerCase().includes(q) ||
        (s.refei_restaurantes?.nome || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [sols, filtroStatus, filtroData, busca])

  const grupos = useMemo(() => {
    const map = {}
    for (const sol of filtered) {
      const key = sol.equipe_id || '__sem_equipe__'
      if (!map[key]) map[key] = { equipe: sol.refei_equipes || { id: key, nome: 'Sem equipe', cdc: null }, itens: [] }
      map[key].itens.push(sol)
    }
    return Object.values(map).sort((a, b) => a.equipe.nome.localeCompare(b.equipe.nome))
  }, [filtered])

  function toggleGroup(id) { setCollapsed(p => ({ ...p, [id]: !p[id] })) }

  const FILTROS = [
    'todos',
    'aguardando_aprovacao',
    'aprovado',
    'enviado_restaurante',
    'confirmado_restaurante',
    'entregue',
    'finalizado',
    'finalizado_com_ocorrencia',
    'reprovado',
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-secondary)' }} />
          <input className="input" style={{ paddingLeft: 32, fontSize: 13 }} placeholder="Buscar pedido, equipe, líder..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <input type="date" className="input" style={{ width: 160, fontSize: 13 }} value={filtroData} onChange={e => setFiltroData(e.target.value)} title="Filtrar por data de refeição" />
        {filtroData && <button onClick={() => setFiltroData('')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px 10px', fontSize: 11, fontWeight: 600 }}>Limpar data</button>}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTROS.map(s => {
            const cfg = STATUS[s]; const isAll = s === 'todos'; const active = filtroStatus === s
            return (
              <button key={s} onClick={() => setFiltroStatus(s)} style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: active ? (isAll ? 'var(--accent)' : cfg.bg) : 'rgba(255,255,255,0.05)', color: active ? (isAll ? '#fff' : cfg.color) : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                {isAll ? 'Todos' : cfg.label}
              </button>
            )
          })}
        </div>
        <button onClick={() => setShowNova(true)} className="btn-primary" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
          <PlusIcon style={{ width: 15, height: 15 }} /> Nova Solicitação
        </button>
      </div>

      {loading && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 48 }}>Carregando...</div>}
      {!loading && grupos.length === 0 && (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Nenhuma solicitação encontrada</div>
          <div style={{ fontSize: 13 }}>Ajuste os filtros ou aguarde novos pedidos via WhatsApp.</div>
        </div>
      )}
      {grupos.map(({ equipe, itens: solsGrupo }) => {
        const key = equipe.id || '__sem_equipe__'
        const isOpen = !collapsed[key]
        const vTotal = solsGrupo.reduce((acc, s) => acc + (Number(s.valor_total) || 0), 0)
        const nPend = solsGrupo.filter(s => ['pendente', 'aguardando_aprovacao'].includes(s.status)).length
        return (
          <div key={key} className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
            <div onClick={() => toggleGroup(key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', borderBottom: isOpen ? '1px solid var(--border)' : 'none', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isOpen ? <ChevronDownIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} /> : <ChevronRightIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />}
                <UserGroupIcon style={{ width: 16, height: 16, color: 'var(--accent)' }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{equipe.nome}</span>
                {equipe.cdc && <span className="badge badge-accent" style={{ fontSize: 10 }}>CDC {equipe.cdc}</span>}
                <span className="badge badge-neutral" style={{ fontSize: 10 }}>{solsGrupo.length} {solsGrupo.length === 1 ? 'pedido' : 'pedidos'}</span>
                {nPend > 0 && <span className="badge badge-warning" style={{ fontSize: 10 }}>⏳ {nPend} pendente{nPend > 1 ? 's' : ''}</span>}
              </div>
              <div style={{ fontWeight: 800, color: '#00c896', fontSize: 14 }}>{fmtBRL(vTotal)}</div>
            </div>
            {isOpen && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                      {['PEDIDO', 'DATA', 'STATUS', 'RESTAURANTE', '🍽️', '☕', 'TOTAL', ''].map((h, i) => (
                        <th key={i} style={{ padding: '9px 14px', textAlign: i >= 4 && i <= 6 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {solsGrupo.map(sol => (
                      <tr key={sol.id} onClick={() => setDetailSol(sol)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{sol.numero_pedido || '—'}</td>
                        <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtData(sol.data_refeicao)}</td>
                        <td style={{ padding: '11px 14px' }}><StatusBadge status={sol.status} /></td>
                        <td style={{ padding: '11px 14px', color: 'var(--text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sol.refei_restaurantes?.nome || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{sol.total_refeicoes || 0}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{sol.total_cafes || 0}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 800, color: '#10b981', whiteSpace: 'nowrap' }}>{fmtBRL(sol.valor_total)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          {['pendente', 'aguardando_aprovacao'].includes(sol.status) && (
                            <button title="Reenviar lembrete" disabled={sendingLembrete === sol.id} onClick={async () => { setSendingLembrete(sol.id); try { const r = await fetch('/api/refeicoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reenviar-supervisor', solicitacaoId: sol.id }) }); const j = await r.json(); if (r.ok) toast.success('Lembrete enviado!'); else toast.error(j.error || 'Erro') } finally { setSendingLembrete(null) } }} style={{ background: 'rgba(245,158,11,0.12)', border: 'none', color: '#f59e0b', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', fontSize: 13, lineHeight: 1, opacity: sendingLembrete === sol.id ? 0.5 : 1 }}>{sendingLembrete === sol.id ? '...' : '🔔'}</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
      {detailSol && <DetailModal sol={detailSol} onClose={() => setDetailSol(null)} onUpdated={onReload} useFlowEngine={useFlowEngine} userId={ownerId} workspaceId={workspaceId} />}
      {showNova  && <ModalNovaSolicitacao workspaceId={workspaceId} ownerId={ownerId} onClose={() => setShowNova(false)} onSaved={onReload} />}
    </div>
  )
}

// ─── Seção: Aprovações ────────────────────────────────────────────────────────
function SecaoAprovacoes({ sols, onReload, useFlowEngine, userId, workspaceId }) {
  const [subFiltro, setSubFiltro] = useState('pendente')
  const [detailSol, setDetailSol] = useState(null)

  const filtrado = useMemo(() => sols.filter(s => subFiltro === 'pendente' ? ['pendente', 'aguardando_aprovacao'].includes(s.status) : s.status === subFiltro), [sols, subFiltro])

  const SUB_TABS = [
    { id: 'pendente',  label: '⏳ Pendentes' },
    { id: 'aprovado',  label: '✅ Aprovados' },
    { id: 'reprovado', label: '❌ Reprovados' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubFiltro(t.id)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: subFiltro === t.id ? 'var(--accent)' : 'rgba(255,255,255,0.05)', color: subFiltro === t.id ? '#fff' : 'var(--text-secondary)' }}>{t.label}</button>
        ))}
      </div>
      {filtrado.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40, fontSize: 13 }}>Nenhuma solicitação nesse status.</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Pedido', 'Data', 'Equipe', 'Restaurante', 'Total', 'Valor', 'Status'].map((h, i) => (
                <th key={i} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrado.map(sol => (
              <tr key={sol.id} onClick={() => setDetailSol(sol)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--accent)' }}>{sol.numero_pedido || '—'}</td>
                <td style={{ padding: '11px 14px', color: 'var(--text-secondary)' }}>{fmtData(sol.data_refeicao)}</td>
                <td style={{ padding: '11px 14px', color: 'var(--text-primary)' }}>{sol.refei_equipes?.nome || '—'}</td>
                <td style={{ padding: '11px 14px', color: 'var(--text-primary)' }}>{sol.refei_restaurantes?.nome || '—'}</td>
                <td style={{ padding: '11px 14px', color: 'var(--text-secondary)' }}>{(sol.total_refeicoes || 0) + (sol.total_cafes || 0)}</td>
                <td style={{ padding: '11px 14px', fontWeight: 800, color: '#10b981' }}>{fmtBRL(sol.valor_total)}</td>
                <td style={{ padding: '11px 14px' }}><StatusBadge status={sol.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detailSol && <DetailModal sol={detailSol} onClose={() => setDetailSol(null)} onUpdated={onReload} useFlowEngine={useFlowEngine} userId={userId} workspaceId={workspaceId} />}
    </div>
  )
}

// ─── Seção: Fechamentos ───────────────────────────────────────────────────────
function SecaoFechamentos({ workspaceId, ownerId }) {
  const agora = new Date()
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [ano, setAno] = useState(agora.getFullYear())
  const [fechamentos, setFechamentos] = useState([])
  const [gerando, setGerando] = useState(false)

  const load = useCallback(async () => {
    if (!workspaceId) return
    const { data, error } = await supabase.from('refei_fechamentos').select('*').eq('workspace_id', workspaceId).order('periodo_inicio', { ascending: false })
    if (!error) setFechamentos(data || [])
  }, [workspaceId])
  useEffect(() => { load() }, [load])

  async function gerar() {
    const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const ultimo = new Date(ano, mes, 0).getDate()
    const fim    = `${ano}-${String(mes).padStart(2, '0')}-${ultimo}`
    setGerando(true)
    const { data: ss, error } = await supabase.from('refei_solicitacoes').select('total_refeicoes,total_cafes,valor_total').eq('workspace_id', workspaceId).in('status', ['aprovado', 'entregue']).gte('data_refeicao', inicio).lte('data_refeicao', fim)
    if (error) { toast.error(error.message); setGerando(false); return }
    const total_solicitacoes = (ss || []).length
    const total_refeicoes    = (ss || []).reduce((a, s) => a + (s.total_refeicoes || 0), 0)
    const total_cafes        = (ss || []).reduce((a, s) => a + (s.total_cafes || 0), 0)
    const total_valor        = (ss || []).reduce((a, s) => a + (Number(s.valor_total) || 0), 0)
    const { error: err2 } = await supabase.from('refei_fechamentos').insert({ workspace_id: workspaceId, owner_id: ownerId, periodo_inicio: inicio, periodo_fim: fim, total_solicitacoes, total_refeicoes, total_cafes, total_valor, status: 'aberto' })
    if (err2) toast.error(err2.message); else { toast.success('Fechamento gerado!'); load() }
    setGerando(false)
  }

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  return (
    <div>
      <div className="card" style={{ padding: 20, marginBottom: 24, display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={lbl}>Mês</label>
          <select className="input" style={{ width: 120 }} value={mes} onChange={e => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Ano</label>
          <input type="number" className="input" style={{ width: 100 }} value={ano} onChange={e => setAno(Number(e.target.value))} />
        </div>
        <button onClick={gerar} disabled={gerando} className="btn-primary" style={{ fontSize: 13, padding: '9px 18px' }}>{gerando ? 'Gerando...' : '📊 Gerar Fechamento'}</button>
      </div>
      {fechamentos.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40, fontSize: 13 }}>Nenhum fechamento gerado ainda.</p>}
      {fechamentos.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Período', 'Status', 'Solicitações', 'Refeições', 'Cafés', 'Valor Total', 'Gerado em'].map((h, i) => (
                  <th key={i} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fechamentos.map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>{fmtData(f.periodo_inicio)} – {fmtData(f.periodo_fim)}</td>
                  <td style={{ padding: '11px 14px' }}><span className={`badge badge-${f.status === 'fechado' ? 'neutral' : 'success'}`} style={{ fontSize: 10 }}>{f.status}</span></td>
                  <td style={{ padding: '11px 14px', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 700 }}>{f.total_solicitacoes}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'center', color: 'var(--text-primary)' }}>{f.total_refeicoes}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'center', color: 'var(--text-primary)' }}>{f.total_cafes}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 800, color: '#10b981' }}>{fmtBRL(f.total_valor)}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{f.gerado_em ? new Date(f.gerado_em).toLocaleDateString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Seção: Relatórios ────────────────────────────────────────────────────────
function SecaoRelatorios({ sub, sols }) {
  const [dtInicio, setDtInicio] = useState('')
  const [dtFim,    setDtFim]    = useState('')

  const base = useMemo(() => {
    let list = sols.filter(s => s.status !== 'rascunho')
    if (dtInicio) list = list.filter(s => s.data_refeicao >= dtInicio)
    if (dtFim)    list = list.filter(s => s.data_refeicao <= dtFim)
    return list
  }, [sols, dtInicio, dtFim])

  const grupos = useMemo(() => {
    const map = {}
    for (const s of base) {
      let key, label
      if      (sub === 'rel-equipe')      { key = s.equipe_id || '__';      label = s.refei_equipes?.nome || 'Sem equipe' }
      else if (sub === 'rel-restaurante') { key = s.restaurante_id || '__'; label = s.refei_restaurantes?.nome || 'Sem restaurante' }
      else if (sub === 'rel-cdc')         { key = s.refei_equipes?.cdc || '__'; label = s.refei_equipes?.cdc || 'Sem CDC' }
      else                               { key = s.id; label = `${s.numero_pedido || '—'} — ${s.refei_equipes?.nome || '—'}` }
      if (!map[key]) map[key] = { label, count: 0, refeicoes: 0, cafes: 0, valor: 0 }
      map[key].count++
      map[key].refeicoes += (s.total_refeicoes || 0)
      map[key].cafes     += (s.total_cafes || 0)
      map[key].valor     += (Number(s.valor_total) || 0)
    }
    return Object.values(map).sort((a, b) => b.valor - a.valor)
  }, [base, sub])

  const totais = useMemo(() => grupos.reduce((acc, g) => ({ count: acc.count + g.count, refeicoes: acc.refeicoes + g.refeicoes, cafes: acc.cafes + g.cafes, valor: acc.valor + g.valor }), { count: 0, refeicoes: 0, cafes: 0, valor: 0 }), [grupos])

  function exportCSV() {
    const header = 'Grupo,Solicitações,Refeições,Cafés,Valor Total\n'
    const rows   = grupos.map(g => `"${g.label}",${g.count},${g.refeicoes},${g.cafes},${g.valor.toFixed(2)}`).join('\n')
    const blob   = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href = url; a.download = `relatorio-refeicoes-${sub}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const REL_LABEL = { 'rel-equipe': 'Por Equipe', 'rel-restaurante': 'Por Restaurante', 'rel-cdc': 'Por CDC/Regional', 'rel-divergencias': 'Divergências (extras)' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><label style={lbl}>De</label><input type="date" className="input" style={{ width: 160 }} value={dtInicio} onChange={e => setDtInicio(e.target.value)} /></div>
        <div><label style={lbl}>Até</label><input type="date" className="input" style={{ width: 160 }} value={dtFim} onChange={e => setDtFim(e.target.value)} /></div>
        {(dtInicio || dtFim) && <button onClick={() => { setDtInicio(''); setDtFim('') }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px 10px', fontSize: 11, fontWeight: 600, alignSelf: 'flex-end' }}>Limpar</button>}
        <div style={{ flex: 1 }} />
        {grupos.length > 0 && <button onClick={exportCSV} className="btn-ghost" style={{ fontSize: 13, gap: 6, alignSelf: 'flex-end' }}><ArrowDownTrayIcon style={{ width: 15, height: 15 }} /> CSV</button>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {[REL_LABEL[sub] || 'Grupo', 'Solicitações', '🍽️ Refeições', '☕ Cafés', 'Valor Total'].map((h, i) => (
                <th key={i} style={{ padding: '9px 14px', textAlign: i > 0 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{g.label}</td>
                <td style={{ padding: '11px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>{g.count}</td>
                <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{g.refeicoes}</td>
                <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{g.cafes}</td>
                <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 800, color: '#10b981' }}>{fmtBRL(g.valor)}</td>
              </tr>
            ))}
            {grupos.length > 1 && (
              <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '11px 14px', fontWeight: 800, color: 'var(--text-primary)' }}>TOTAL</td>
                <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 800 }}>{totais.count}</td>
                <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 800 }}>{totais.refeicoes}</td>
                <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 800 }}>{totais.cafes}</td>
                <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 800, color: '#10b981' }}>{fmtBRL(totais.valor)}</td>
              </tr>
            )}
            {grupos.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum dado no período selecionado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}


// ─── Componente principal ─────────────────────────────────────────────────────
export default function Refeicoes() {
  const workspaceId = useStore(s => s.workspaceId)
  const ownerId     = useStore(s => s.currentUser?.id)

  const [flowEngineOn, setFlowEngineOn] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    supabase
      .from('configuracoes')
      .select('valor')
      .eq('workspace_id', workspaceId)
      .eq('chave', 'flow_engine_refeicoes')
      .maybeSingle()
      .then(({ data }) => setFlowEngineOn(data?.valor === 'true'))
  }, [workspaceId])

  const location = useLocation()
  const navigate = useNavigate()

  const { secao, sub } = useMemo(() => {
    const parts = location.pathname.replace(/\/$/, '').split('/')
    // parts: ['', 'refeicoes', 'cadastros', 'restaurantes']
    const s  = parts[2] || 'dashboard'
    const sb = parts[3] || (
      s === 'cadastros'  ? 'restaurantes' :
      s === 'operacoes'  ? 'solicitacoes' :
      s === 'relatorios' ? 'rel-equipe'   : null
    )
    return { secao: s, sub: sb }
  }, [location.pathname])

  const [sols,    setSols]    = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase
      .from('refei_solicitacoes')
      .select('*, refei_equipes(id,nome,cdc), refei_restaurantes(id,nome,numero_pedido)')
      .eq('workspace_id', workspaceId)
      .order('criado_em', { ascending: false })
    setSols(data || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  function nav(s, sb) {
    if (s === 'dashboard' || !sb) navigate('/refeicoes')
    else navigate(`/refeicoes/${s}/${sb}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="🍽️ Refeições" subtitle="Gestão completa de refeições" />
      {/* Barra de flow engine quando ativo */}
      {flowEngineOn && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 24px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
          <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>⚡ Flow Engine ativo</span>
          <FlowTaskBell
            userId={ownerId}
            workspaceId={workspaceId}
            onSelectTask={(entidadeId) => {
              // Navega para aprovações e abre o modal pela URL
              nav('operacoes', 'aprovacoes')
            }}
          />
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {secao === 'dashboard'  && <SecaoDashboard sols={sols} onNav={nav} />}
        {secao === 'cadastros'  && <SecaoCadastros workspaceId={workspaceId} ownerId={ownerId} sub={sub} />}
        {secao === 'operacoes'  && sub === 'solicitacoes' && <SecaoSolicitacoes sols={sols} workspaceId={workspaceId} ownerId={ownerId} onReload={load} loading={loading} useFlowEngine={flowEngineOn} />}
        {secao === 'operacoes'  && sub === 'aprovacoes'   && <SecaoAprovacoes sols={sols} onReload={load} useFlowEngine={flowEngineOn} userId={ownerId} workspaceId={workspaceId} />}
        {secao === 'operacoes'  && sub === 'fechamentos'  && <SecaoFechamentos workspaceId={workspaceId} ownerId={ownerId} />}
        {secao === 'relatorios' && <SecaoRelatorios sub={sub} sols={sols} />}
      </div>
    </div>
  )
}
