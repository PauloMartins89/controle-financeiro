import { useState, useEffect, useCallback } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import {
  Badge, StatusChip, KpiCard, Toolbar, DataTable, TR, Modal, Field, Sel, inp,
} from './LiderCadastroShared'
import { KeyIcon, XMarkIcon } from '@heroicons/react/24/outline'

// ── Helpers ───────────────────────────────────────────────────────────────────
function derivePwd(matricula) {
  return matricula.padEnd(8, matricula)
}

// ── Modal Reset Senha ─────────────────────────────────────────────────────────
function ModalResetSenha({ perfil, onClose }) {
  const [novaSenha, setNovaSenha] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleReset() {
    if (!novaSenha.trim()) { toast.error('Informe a nova senha'); return }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch('/api/lider-workspace-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'resetar-senha', workspace_id: perfil.workspace_id, user_id: perfil.user_id, nova_senha: novaSenha.trim() }),
    })
    const json = await resp.json()
    setSaving(false)
    if (json.ok) { toast.success('Senha redefinida'); onClose() }
    else toast.error(json.error || 'Erro ao redefinir senha')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 28,
        width: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
            🔑 Redefinir Senha
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <XMarkIcon style={{ width: 22 }} />
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
          Líder: <strong style={{ color: 'var(--text-primary)' }}>{perfil.nome}</strong>
          <br />Login: <code style={{ fontSize: 12 }}>{perfil.matricula}@lider.smartpro</code>
        </p>
        <Field label="Nova Senha *">
          <input
            style={inp} type="text" value={novaSenha}
            onChange={e => setNovaSenha(e.target.value)}
            placeholder={`Padrão: ${derivePwd(perfil.matricula || '00000')}`}
          />
        </Field>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} disabled={saving} style={{
            flex: 1, padding: '13px 0', borderRadius: 10, border: 'none',
            background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
          }}>
            Cancelar
          </button>
          <button onClick={handleReset} disabled={saving} style={{
            flex: 2, padding: '13px 0', borderRadius: 10, border: 'none',
            background: '#f59e0b', color: '#fff', fontWeight: 800, fontSize: 15,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Redefinindo…' : 'Redefinir Senha'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function LiderCadastroLideres() {
  const { workspaceId } = useStore()
  const [records,      setRecords]      = useState([])
  const [equipes,      setEquipes]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [busca,        setBusca]        = useState('')
  const [showModal,    setShowModal]    = useState(false)
  const [editId,       setEditId]       = useState(null)   // perfil.id
  const [editUserId,   setEditUserId]   = useState(null)   // perfil.user_id
  const [modalSenha,   setModalSenha]   = useState(null) // { perfil, workspace_id }
  const [form,         setForm]         = useState({ matricula: '', nome: '', celular: '', equipe_id: '' })

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const [r1, r2] = await Promise.all([
      supabase
        .from('lider_perfis')
        .select('id, user_id, matricula, nome, celular, equipe_id, ativo, workspace_id, lider_equipes(nome)')
        .eq('workspace_id', workspaceId)
        .order('matricula'),
      supabase
        .from('lider_equipes')
        .select('id, nome')
        .eq('workspace_id', workspaceId)
        .eq('ativo', true)
        .order('nome'),
    ])
    setRecords(r1.data || [])
    setEquipes(r2.data || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditId(null)
    setEditUserId(null)
    setForm({ matricula: '', nome: '', celular: '', equipe_id: equipes[0]?.id ?? '' })
    setShowModal(true)
  }

  function openEdit(r) {
    setEditId(r.id)
    setEditUserId(r.user_id)
    setForm({ matricula: r.matricula ?? '', nome: r.nome ?? '', celular: r.celular ?? '', equipe_id: r.equipe_id ?? '' })
    setShowModal(true)
  }

  async function save() {
    if (!editId) {
      // Criar novo líder via API
      if (!form.matricula.trim()) { toast.error('Matrícula obrigatória'); return }
      if (!form.nome.trim())      { toast.error('Nome obrigatório'); return }
      setSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/lider-workspace-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          action: 'criar-usuario',
          workspace_id: workspaceId,
          matricula: form.matricula.trim(),
          nome: form.nome.trim(),
          celular: form.celular.trim(),
        }),
      })
      const json = await resp.json()
      setSaving(false)
      if (json.ok) {
        toast.success(json.ja_existia ? 'Usuário já existia' : `Líder ${json.email} criado!`)
        setShowModal(false)
        load()
      } else {
        toast.error(json.error || 'Erro ao criar líder')
      }
    } else {
      // Editar perfil existente
      if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
      setSaving(true)
      const { error } = await supabase
        .from('lider_perfis')
        .update({ nome: form.nome.trim(), celular: form.celular.trim() || null, equipe_id: form.equipe_id || null })
        .eq('id', editId)
      setSaving(false)
      if (error) { toast.error(error.message); return }
      toast.success('Atualizado!')
      setShowModal(false)
      load()
    }
  }

  async function toggleAtivo(id, atual) {
    const { error } = await supabase.from('lider_perfis').update({ ativo: !atual }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(!atual ? 'Ativado' : 'Inativado'); load() }
  }

  async function excluir(r) {
    if (!window.confirm(`Excluir líder "${r.nome}" (#${r.matricula})? Esta ação não pode ser desfeita.`)) return
    const { data: { session } } = await supabase.auth.getSession()
    const resp = await fetch('/api/lider-workspace-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'excluir-usuario', workspace_id: workspaceId, user_id: r.user_id }),
    })
    const json = await resp.json()
    if (json.ok) { toast.success('Excluído'); load() }
    else toast.error(json.error || 'Erro ao excluir')
  }

  const filtrados  = records.filter(r =>
    r.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    r.matricula?.toLowerCase().includes(busca.toLowerCase())
  )
  const ativos     = records.filter(r => r.ativo).length
  const comEquipe  = records.filter(r => r.equipe_id).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header title="Líderes" subtitle="Cadastro de líderes com acesso ao app SmartLíder" action={{ label: 'Novo Líder', onClick: openNew }} />

      <div style={{ padding: '24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard label="Total de Líderes" value={records.length}                        icon="🔑" color="#8b5cf6" />
          <KpiCard label="Ativos"           value={ativos}                                icon="✅" color="#22c55e" />
          <KpiCard label="Com Equipe"       value={comEquipe}                             icon="👥" color="#3b82f6" />
          <KpiCard label="Inativos"         value={records.filter(r => !r.ativo).length}  icon="⏸" color="#6b7280" />
        </div>

        <Toolbar busca={busca} setBusca={setBusca} onRefresh={load} onNovo={openNew} placeholder="Buscar por nome ou matrícula…" />

        <DataTable
          cols={['Matrícula', 'Nome', 'Equipe', 'Celular', 'Login', 'Status']}
          loading={loading}
          isEmpty={filtrados.length === 0}
        >
          {filtrados.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', opacity: r.ativo ? 1 : 0.55 }}>
              <td style={{ padding: '13px 16px', fontSize: 14 }}>
                <Badge text={`#${r.matricula}`} />
              </td>
              <td style={{ padding: '13px 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {r.nome}
              </td>
              <td style={{ padding: '13px 16px', fontSize: 14 }}>
                {r.lider_equipes ? <Badge text={r.lider_equipes.nome} /> : <span style={{ color: '#94a3b8' }}>— sem equipe —</span>}
              </td>
              <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                {r.celular || '—'}
              </td>
              <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                {r.matricula}@lider.smartpro
              </td>
              <td style={{ padding: '13px 16px' }}>
                <StatusChip ativo={r.ativo} />
              </td>
              <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => openEdit(r)} title="Editar"
                    style={{ background: '#3b82f615', border: '1px solid #3b82f640', color: '#3b82f6', borderRadius: 8, padding: '6px 9px', cursor: 'pointer' }}>
                    ✏️
                  </button>
                  <button onClick={() => setModalSenha(r)} title="Redefinir Senha"
                    style={{ background: '#f59e0b15', border: '1px solid #f59e0b40', color: '#f59e0b', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <KeyIcon style={{ width: 14 }} />
                  </button>
                  <button onClick={() => toggleAtivo(r.id, r.ativo)} title={r.ativo ? 'Inativar' : 'Ativar'}
                    style={{ background: r.ativo ? '#f59e0b15' : '#22c55e15', border: `1px solid ${r.ativo ? '#f59e0b' : '#22c55e'}40`, color: r.ativo ? '#f59e0b' : '#22c55e', borderRadius: 8, padding: '6px 9px', cursor: 'pointer' }}>
                    {r.ativo ? '⏸' : '▶'}
                  </button>
                  <button onClick={() => excluir(r)} title="Excluir"
                    style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444', borderRadius: 8, padding: '6px 9px', cursor: 'pointer' }}>
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      {/* ── Modal Criar / Editar ───────────────────────────────────────────── */}
      {showModal && (
        <Modal
          title={editId ? `Editar Líder — #${form.matricula}` : 'Novo Líder'}
          onClose={() => setShowModal(false)}
          onSave={save}
          saving={saving}
        >
          {!editId && (
            <Field label="Matrícula *">
              <input style={inp} value={form.matricula}
                onChange={e => setForm(p => ({ ...p, matricula: e.target.value }))}
                placeholder="Ex: 00123" />
            </Field>
          )}
          <Field label="Nome completo *">
            <input style={inp} value={form.nome}
              onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: João da Silva" />
          </Field>
          <Field label="Celular (WhatsApp)">
            <input style={inp} value={form.celular}
              onChange={e => setForm(p => ({ ...p, celular: e.target.value }))}
              placeholder="Ex: (16) 99999-9999" />
          </Field>
          <Field label="Equipe">
            <Sel value={form.equipe_id} onChange={v => setForm(p => ({ ...p, equipe_id: v }))}>
              <option value="">— Sem equipe —</option>
              {equipes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </Sel>
          </Field>
          {!editId && (
            <div style={{
              background: '#22c55e10', border: '1px solid #22c55e30',
              borderRadius: 10, padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)',
            }}>
              📱 <strong>Login gerado automaticamente:</strong><br />
              <code style={{ fontSize: 12 }}>{form.matricula ? `${form.matricula}@lider.smartpro` : '{matrícula}@lider.smartpro'}</code><br />
              🔑 Senha padrão: <code style={{ fontSize: 12 }}>{form.matricula ? derivePwd(form.matricula) : '(baseada na matrícula)'}</code>
            </div>
          )}
        </Modal>
      )}

      {/* ── Modal Reset Senha ──────────────────────────────────────────────── */}
      {modalSenha && (
        <ModalResetSenha perfil={modalSenha} onClose={() => setModalSenha(null)} />
      )}
    </div>
  )
}
