import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import { Badge, StatusChip, KpiCard, Toolbar, DataTable, TR, Modal, Field, Sel, inp } from './LiderCadastroShared'

const TIPO_MAQ = ['Trator', 'Pulverizador', 'Colhedora', 'Plantadeira', 'Grade', 'Caminhão', 'Utilitário', 'Outro']

export default function LiderCadastroMaquinas() {
  const { workspaceId } = useStore()
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [busca,     setBusca]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState({ nome: '', codigo: '', tipo: 'Trator', modelo: '', ativo: true })

  useEffect(() => { if (workspaceId) load() }, [workspaceId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('lider_maquinas').select('*').eq('workspace_id', workspaceId).order('nome')
    setRecords(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditId(null)
    setForm({ nome: '', codigo: '', tipo: 'Trator', modelo: '', ativo: true })
    setShowModal(true)
  }

  function openEdit(r) {
    setEditId(r.id)
    setForm({ nome: r.nome, codigo: r.codigo ?? '', tipo: r.tipo ?? 'Trator', modelo: r.modelo ?? '', ativo: r.ativo })
    setShowModal(true)
  }

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = { ...form, workspace_id: workspaceId }
    const { error } = editId
      ? await supabase.from('lider_maquinas').update(payload).eq('id', editId)
      : await supabase.from('lider_maquinas').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Atualizado!' : 'Máquina cadastrada!')
    setShowModal(false); load()
  }

  async function toggleAtivo(id, atual) {
    const { error } = await supabase.from('lider_maquinas').update({ ativo: !atual }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(!atual ? 'Ativado' : 'Inativado'); load() }
  }

  async function excluir(id, nome) {
    if (!window.confirm(`Excluir máquina "${nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('lider_maquinas').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Excluído'); load() }
  }

  const filtrados  = records.filter(r => r.nome?.toLowerCase().includes(busca.toLowerCase()))
  const ativos     = records.filter(r => r.ativo)
  const tratores   = ativos.filter(r => r.tipo === 'Trator').length
  const pulvs      = ativos.filter(r => r.tipo === 'Pulverizador').length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header title="Máquinas" subtitle="Cadastro de máquinas e equipamentos do SmartLíder" action={{ label: 'Nova Máquina', onClick: openNew }} />

      <div style={{ padding: '24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard label="Máquinas Ativas"   value={ativos.length}             icon="🚜" color="#3b82f6" />
          <KpiCard label="Tratores"          value={tratores}                  icon="🚛" color="#10b981" />
          <KpiCard label="Pulverizadores"    value={pulvs}                     icon="💧" color="#06b6d4" />
          <KpiCard label="Inativas"          value={records.filter(r => !r.ativo).length} icon="⏸" color="#6b7280" />
        </div>

        <Toolbar busca={busca} setBusca={setBusca} onRefresh={load} onNovo={openNew} placeholder="Buscar máquinas…" />

        <DataTable cols={['Equipamento', 'Código / Frota', 'Tipo', 'Modelo', 'Status']} loading={loading} isEmpty={filtrados.length === 0}>
          {filtrados.map(r => (
            <TR key={r.id} ativo={r.ativo}
              onEdit={() => openEdit(r)}
              onToggle={() => toggleAtivo(r.id, r.ativo)}
              onDel={() => excluir(r.id, r.nome)}
              cells={[
                <strong key="n">{r.nome}</strong>,
                r.codigo ? <Badge key="cd" text={r.codigo} /> : '—',
                <Badge key="t" text={r.tipo ?? '—'} />,
                r.modelo || '—',
                <StatusChip key="s" ativo={r.ativo} />,
              ]}
            />
          ))}
        </DataTable>
      </div>

      {showModal && (
        <Modal title={editId ? 'Editar Máquina' : 'Nova Máquina'} onClose={() => setShowModal(false)} onSave={save} saving={saving}>
          <Field label="Nome / Descrição *">
            <input style={inp} value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Trator John Deere 6145J" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Código / Frota">
              <input style={inp} value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} placeholder="Ex: TR-01" />
            </Field>
            <Field label="Tipo">
              <Sel value={form.tipo} onChange={v => setForm(p => ({ ...p, tipo: v }))} options={TIPO_MAQ} />
            </Field>
          </div>
          <Field label="Modelo">
            <input style={inp} value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} placeholder="Ex: 6145J" />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} /> Ativo
          </label>
        </Modal>
      )}
    </div>
  )
}
