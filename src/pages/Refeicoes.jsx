import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import useStore from '../store/useStore'
import Header from '../components/Header'
import FlowHistory from '../components/refeicao/FlowHistory'
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
  rascunho:   { label: 'Rascunho',   color: '#64748b', bg: 'rgba(100,116,139,0.15)', icon: ClipboardDocumentListIcon },
  pendente:   { label: 'Pendente',   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  icon: ClockIcon },
  aprovado:   { label: 'Aprovado',   color: '#10b981', bg: 'rgba(16,185,129,0.15)',  icon: CheckCircleIcon },
  reprovado:  { label: 'Reprovado',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   icon: XCircleIcon },
  preparando: { label: 'Preparando', color: '#6366f1', bg: 'rgba(99,102,241,0.15)',  icon: ClockIcon },
  entregue:   { label: 'Entregue',   color: '#34d399', bg: 'rgba(52,211,153,0.15)',  icon: CheckCircleIcon },
  fechado:    { label: 'Fechado',    color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', icon: NoSymbolIcon },
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
    const payload = { nome: form.nome, cnpj: form.cnpj || null, numero_pedido: form.numero_pedido || null, valor_refeicao: form.valor_refeicao || 0, valor_cafe: form.valor_cafe || 0, telefone_wa: form.telefone_wa || null, ativo: !!form.ativo, workspace_id: workspaceId, owner_id: ownerId }
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

// ─── Parâmetros ───────────────────────────────────────────────────────────────
function CrudParametros({ workspaceId, ownerId }) {
  const [form, setForm] = useState({ antecedencia_horas: 2, teto_por_equipe: '', aprovacao_obrigatoria: true, permite_refeicao: true, permite_cafe: true })
  const [saving, setSaving] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  useEffect(() => {
    if (!workspaceId) return
    supabase.from('refei_parametros').select('*').eq('workspace_id', workspaceId).maybeSingle()
      .then(({ data }) => { if (data) setForm({ ...data }) })
  }, [workspaceId])
  async function save() {
    setSaving(true)
    const payload = { workspace_id: workspaceId, antecedencia_horas: Number(form.antecedencia_horas) || 2, teto_por_equipe: Number(form.teto_por_equipe) || null, aprovacao_obrigatoria: !!form.aprovacao_obrigatoria, permite_refeicao: !!form.permite_refeicao, permite_cafe: !!form.permite_cafe, atualizado_em: new Date().toISOString() }
    const { error } = await supabase.from('refei_parametros').upsert(payload, { onConflict: 'workspace_id' })
    if (error) toast.error(error.message); else toast.success('Parâmetros salvos')
    setSaving(false)
  }
  return (
    <div style={{ maxWidth: 480 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={lbl}>Antecedência (horas)</label>
            <input type="number" min={0} className="input" value={form.antecedencia_horas} onChange={e => f('antecedencia_horas', e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Horas antes para envio do formulário</div>
          </div>
          <div>
            <label style={lbl}>Teto por equipe</label>
            <input type="number" min={0} className="input" value={form.teto_por_equipe || ''} onChange={e => f('teto_por_equipe', e.target.value)} placeholder="Sem limite" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="p_aprov" checked={!!form.aprovacao_obrigatoria} onChange={e => f('aprovacao_obrigatoria', e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }} />
            <label htmlFor="p_aprov" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Aprovação obrigatória</label>
          </div>
          <div />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="p_ref" checked={!!form.permite_refeicao} onChange={e => f('permite_refeicao', e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }} />
            <label htmlFor="p_ref" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Permite refeição 🍽️</label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="p_cafe" checked={!!form.permite_cafe} onChange={e => f('permite_cafe', e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }} />
            <label htmlFor="p_cafe" style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Permite café ☕</label>
          </div>
        </div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={save} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}>{saving ? 'Salvando...' : 'Salvar Parâmetros'}</button>
        </div>
      </div>
    </div>
  )
}

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
  const [itens, setItens]   = useState([])
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('refei_itens').select('*').eq('solicitacao_id', sol.id).order('colaborador_nome')
      .then(({ data }) => setItens(data || []))
  }, [sol.id])

  async function executarAcaoFlow(acaoNome) {
    setSaving(true)
    try {
      const instRes = await fetch(`/api/refeicoes?module=flow&action=instance&entidade_tipo=refei_solicitacoes&entidade_id=${sol.id}`)
      if (!instRes.ok) throw new Error('Instância não encontrada')
      const { instancia } = await instRes.json()
      const actRes = await fetch(`/api/refeicoes?module=flow&action=actions&instance_id=${instancia.id}`)
      const { acoes } = await actRes.json()
      const acaoObj = acoes.find(a => a.nome === acaoNome)
      if (!acaoObj) throw new Error(`Ação "${acaoNome}" não disponível nesta etapa`)
      const execRes = await fetch('/api/refeicoes?module=flow&action=execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_id: instancia.id, acao_id: acaoObj.id, executado_por: userId, dados: {}, origem: 'humano' }),
      })
      const j = await execRes.json()
      if (!execRes.ok) throw new Error(j.error || 'Erro no motor de fluxo')
      toast.success('Ação executada com sucesso!')
      onUpdated()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Erro')
    }
    setSaving(false)
  }

  async function aprovar(acao) {
    if (acao === 'reprovado' && !motivo.trim()) { toast.error('Informe o motivo'); return }
    setSaving(true)
    try {
      if (useFlowEngine) {
        const instRes = await fetch(`/api/refeicoes?module=flow&action=instance&entidade_tipo=refei_solicitacoes&entidade_id=${sol.id}`)
        if (instRes.ok) {
          const { instancia } = await instRes.json()
          const actRes = await fetch(`/api/refeicoes?module=flow&action=actions&instance_id=${instancia.id}`)
          const { acoes } = await actRes.json()
          const acaoNome = acao === 'aprovado' ? 'aprovar' : 'reprovar'
          const acaoObj = acoes.find(a => a.nome === acaoNome)
          if (!acaoObj) throw new Error(`Ação "${acaoNome}" não disponível nesta etapa`)
          const execRes = await fetch('/api/refeicoes?module=flow&action=execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instance_id: instancia.id,
              acao_id: acaoObj.id,
              executado_por: userId,
              dados: acao === 'reprovado' ? { motivo } : {},
              origem: 'humano',
            }),
          })
          const j = await execRes.json()
          if (!execRes.ok) throw new Error(j.error || 'Erro no motor de fluxo')
          toast.success(acao === 'aprovado' ? 'Aprovado! ✅ (Flow Engine)' : 'Reprovado ❌ (Flow Engine)')
          onUpdated()
          onClose()
          return
        }
        // sem instância → cai no caminho antigo (compatibilidade)
      }
      const r = await fetch('/api/refeicoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'aprovar', solicitacaoId: sol.id, acao, motivo }),
      })
      const j = await r.json()
      if (r.ok) { toast.success(acao === 'aprovado' ? 'Aprovado!' : 'Reprovado'); onUpdated(); onClose() }
      else toast.error(j.error || 'Erro')
    } catch (err) {
      toast.error(err.message || 'Erro')
    }
    setSaving(false)
  }

  const st = STATUS[sol.status] || STATUS.rascunho
  return (
    <Modal title={`Pedido ${sol.numero_pedido || '—'}`} onClose={onClose} maxWidth={500}>
      {/* Badges */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatusBadge status={sol.status} />
        <span className="badge badge-neutral">📅 {fmtData(sol.data_refeicao)}</span>
        {sol.refei_restaurantes && <span className="badge badge-neutral">🏪 {sol.refei_restaurantes.nome}</span>}
      </div>

      {/* Totais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {[
          { label: '🍽️ Refeições', value: sol.total_refeicoes || 0, isCurrency: false },
          { label: '☕ Cafés',     value: sol.total_cafes || 0,     isCurrency: false },
          { label: '💰 Total',    value: fmtBRL(sol.valor_total),   isCurrency: false, accent: true },
        ].map((c, i) => (
          <div key={i} className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{c.label}</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: c.accent ? '#10b981' : 'var(--text-primary)' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Colaboradores */}
      {itens.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8 }}>Colaboradores</div>
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {itens.filter(it => !it.extra).map(it => (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-primary)' }}>{it.colaborador_nome}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{it.refeicao ? '🍽️ ' : ''}{it.cafe ? '☕' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extras */}
      {itens.some(it => it.extra) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8 }}>⚠️ Extras</div>
          <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {itens.filter(it => it.extra).map(it => (
              <div key={it.id} style={{ padding: '6px 10px', background: 'rgba(245,158,11,0.05)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{it.colaborador_nome}</span>
                  <span style={{ fontSize: 14 }}>{it.refeicao ? '🍽️ ' : ''}{it.cafe ? '☕' : ''}</span>
                </div>
                {it.justificativa && <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 3 }}>💬 {it.justificativa}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {sol.observacoes && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, border: '1px solid var(--border)' }}>
          📝 {sol.observacoes}
        </div>
      )}

      {sol.motivo_reprovacao && (
        <div className="badge badge-danger" style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 16, fontSize: 12, display: 'block' }}>
          ❌ Motivo: {sol.motivo_reprovacao}
        </div>
      )}

      {/* Histórico do Flow Engine */}
      {useFlowEngine && <FlowHistory solicitacaoId={sol.id} />}

      {/* Ações */}
      {sol.status === 'pendente' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <label style={lbl}>Motivo (obrigatório para reprovar)</label>
          <input className="input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Informe caso vá reprovar..." style={{ marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => aprovar('reprovado')} disabled={saving} className="btn-danger" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>❌ Reprovar</button>
            <button onClick={() => aprovar('aprovado')} disabled={saving} className="btn-success" style={{ flex: 1, justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>✅ Aprovar</button>
          </div>
        </div>
      )}

      {/* Ações extras via Flow Engine */}
      {useFlowEngine && sol.status === 'aprovado' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button onClick={() => executarAcaoFlow('confirmar_entrega')} disabled={saving} className="btn-success" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
            🚚 Confirmar Entrega
          </button>
        </div>
      )}
      {useFlowEngine && sol.status === 'entregue' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button onClick={() => executarAcaoFlow('fechar')} disabled={saving} className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
            🏁 Fechar Processo
          </button>
        </div>
      )}
      {useFlowEngine && sol.status === 'reprovado' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button onClick={() => executarAcaoFlow('reabrir')} disabled={saving} style={{ width: '100%', justifyContent: 'center', fontSize: 13, background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, padding: '10px', fontWeight: 700, cursor: 'pointer' }}>
            🔄 Reabrir para Correção
          </button>
        </div>
      )}
    </Modal>
  )
}

// ─── Seção: Dashboard ────────────────────────────────────────────────────────
function SecaoDashboard({ sols, onNav }) {
  const stats = useMemo(() => {
    const ativos = sols.filter(s => s.status !== 'rascunho')
    const hoje   = ativos.filter(s => s.data_refeicao === todayISO())
    return {
      total:     ativos.length,
      hoje:      hoje.length,
      pendentes: ativos.filter(s => s.status === 'pendente').length,
      aprovados: ativos.filter(s => s.status === 'aprovado').length,
      valor:     ativos.reduce((acc, s) => acc + (Number(s.valor_total) || 0), 0),
    }
  }, [sols])

  const recentes = useMemo(() => sols.filter(s => s.status !== 'rascunho').slice(0, 8), [sols])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Pedidos', value: stats.total,     sub: `${stats.hoje} hoje`,          color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  emoji: '📋', grad: 'linear-gradient(90deg,#6366f1,#818cf8)' },
          { label: 'Pendentes',     value: stats.pendentes, sub: 'aguardando aprovação',         color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  emoji: '⏳', grad: 'linear-gradient(90deg,#f59e0b,#fbbf24)' },
          { label: 'Aprovados',     value: stats.aprovados, sub: 'confirmados',                  color: '#10b981', bg: 'rgba(16,185,129,0.12)',  emoji: '✅', grad: 'linear-gradient(90deg,#10b981,#34d399)' },
          { label: 'Valor Total',   value: fmtBRL(stats.valor), sub: 'todos os pedidos',        color: '#00c896', bg: 'rgba(0,200,150,0.12)',   emoji: '💰', grad: 'linear-gradient(90deg,#00c896,#00a87a)', isText: true },
        ].map((c, i) => (
          <div key={i} className="stat-card">
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.grad, borderRadius: '16px 16px 0 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{c.label}</div>
                <div style={{ fontSize: c.isText ? 20 : 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 5 }}>{c.sub}</div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{c.emoji}</div>
            </div>
          </div>
        ))}
      </div>

      {stats.pendentes > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '12px 20px', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>⏳ {stats.pendentes} pedido{stats.pendentes > 1 ? 's' : ''} aguardando aprovação</span>
          <button onClick={() => onNav('operacoes', 'aprovacoes')} style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Ver Aprovações →</button>
        </div>
      )}

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>Atividade Recente</div>
        {recentes.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Nenhuma solicitação ainda.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {recentes.map(s => (
            <div key={s.id} className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <StatusBadge status={s.status} />
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{s.numero_pedido || '—'}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.refei_equipes?.nome || '—'}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtData(s.data_refeicao)}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#10b981', whiteSpace: 'nowrap' }}>{fmtBRL(s.valor_total)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Seção: Solicitações ──────────────────────────────────────────────────────
function SecaoSolicitacoes({ sols, workspaceId, ownerId, onReload, loading, useFlowEngine }) {
  const [busca,        setBusca]        = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroData,   setFiltroData]   = useState('')
  const [collapsed,    setCollapsed]    = useState({})
  const [detailSol,    setDetailSol]    = useState(null)
  const [sendingLembrete, setSendingLembrete] = useState(null)

  const filtered = useMemo(() => {
    let list = sols.filter(s => s.status !== 'rascunho')
    if (filtroStatus !== 'todos') list = list.filter(s => s.status === filtroStatus)
    if (filtroData)               list = list.filter(s => s.data_refeicao === filtroData)
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(s =>
        (s.numero_pedido || '').toLowerCase().includes(q) ||
        (s.lider_nome    || '').toLowerCase().includes(q) ||
        (s.refei_equipes?.nome || '').toLowerCase().includes(q) ||
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

  const FILTROS = ['todos', 'pendente', 'aprovado', 'reprovado', 'entregue', 'fechado']

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
        const nPend = solsGrupo.filter(s => s.status === 'pendente').length
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
                          {sol.status === 'pendente' && (
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
    </div>
  )
}

// ─── Seção: Aprovações ────────────────────────────────────────────────────────
function SecaoAprovacoes({ sols, onReload, useFlowEngine, userId, workspaceId }) {
  const [subFiltro, setSubFiltro] = useState('pendente')
  const [detailSol, setDetailSol] = useState(null)

  const filtrado = useMemo(() => sols.filter(s => s.status === subFiltro), [sols, subFiltro])

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
