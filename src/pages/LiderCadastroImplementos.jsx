import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import { Badge, StatusChip, KpiCard, Toolbar, DataTable, TR, Modal, Field, inp } from './LiderCadastroShared'

export default function LiderCadastroImplementos() {
  const { workspaceId } = useStore()
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [busca,     setBusca]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState({ nome: '', codigo: '', modelo: '', largura_m: '', volume_recomendado_lha: '', ativo: true })

  useEffect(() => { if (workspaceId) load() }, [workspaceId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('lider_implementos').select('*').eq('workspace_id', workspaceId).order('nome')
    setRecords(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditId(null)
    setForm({ nome: '', codigo: '', modelo: '', largura_m: '', volume_recomendado_lha: '', ativo: true })
    setShowModal(true)
  }

  function openEdit(r) {
    setEditId(r.id)
    setForm({ nome: r.nome, codigo: r.codigo ?? '', modelo: r.modelo ?? '', largura_m: r.largura_m ?? '', volume_recomendado_lha: r.volume_recomendado_lha ?? '', ativo: r.ativo })
    setShowModal(true)
  }

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = {
      ...form, workspace_id: workspaceId,
      largura_m: form.largura_m ? parseFloat(form.largura_m) : null,
      volume_recomendado_lha: form.volume_recomendado_lha ? parseFloat(form.volume_recomendado_lha) : null,
    }
    const { error } = editId
      ? await supabase.from('lider_implementos').update(payload).eq('id', editId)
      : await supabase.from('lider_implementos').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Atualizado!' : 'Implemento cadastrado!')
    setShowModal(false); load()
  }

  async function toggleAtivo(id, atual) {
    const { error } = await supabase.from('lider_implementos').update({ ativo: !atual }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(!atual ? 'Ativado' : 'Inativado'); load() }
  }

  async function excluir(id, nome) {
    if (!window.confirm(`Excluir implemento "${nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('lider_implementos').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Excluído'); load() }
  }

  const filtrados    = records.filter(r => r.nome?.toLowerCase().includes(busca.toLowerCase()))
  const ativos       = records.filter(r => r.ativo)
  const comLargura   = ativos.filter(r => r.largura_m).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header title="Implementos" subtitle="Cadastro de implementos e equipamentos acoplados do SmartLíder" action={{ label: 'Novo Implemento', onClick: openNew }} />

      <div style={{ padding: '24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard label="Implementos Ativos"  value={ativos.length}             icon="⚙️"  color="#3b82f6" />
          <KpiCard label="Com Largura"         value={comLargura}                icon="📏"  color="#10b981" />
          <KpiCard label="Sem Modelo"          value={ativos.filter(r => !r.modelo).length} icon="❓" color="#f59e0b" />
          <KpiCard label="Inativos"            value={records.filter(r => !r.ativo).length} icon="⏸" color="#6b7280" />
        </div>

        <Toolbar busca={busca} setBusca={setBusca} onRefresh={load} onNovo={openNew} placeholder="Buscar implementos…" />

        <DataTable cols={['Implemento', 'Código', 'Modelo', 'Largura (m)', 'Vol. L/ha', 'Status']} loading={loading} isEmpty={filtrados.length === 0}>
          {filtrados.map(r => (
            <TR key={r.id} ativo={r.ativo}
              onEdit={() => openEdit(r)}
              onToggle={() => toggleAtivo(r.id, r.ativo)}
              onDel={() => excluir(r.id, r.nome)}
              cells={[
                <strong key="n">{r.nome}</strong>,
                r.codigo ? <Badge key="c" text={r.codigo} /> : '—',
                r.modelo || '—',
                r.largura_m ? `${r.largura_m} m` : '—',
                r.volume_recomendado_lha ? `${r.volume_recomendado_lha} L/ha` : '—',
                <StatusChip key="s" ativo={r.ativo} />,
              ]}
            />
          ))}
        </DataTable>
      </div>

      {showModal && (
        <Modal title={editId ? 'Editar Implemento' : 'Novo Implemento'} onClose={() => setShowModal(false)} onSave={save} saving={saving}>
          <Field label="Nome / Descrição *">
            <input style={inp} value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Pulverizador Jacto 3000" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Código">
              <input style={inp} value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} placeholder="Ex: PB-01" />
            </Field>
            <Field label="Modelo">
              <input style={inp} value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))} placeholder="Ex: Condor 3000" />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Largura de trabalho (m)">
              <input style={inp} type="number" step="0.1" value={form.largura_m} onChange={e => setForm(p => ({ ...p, largura_m: e.target.value }))} placeholder="Ex: 12" />
            </Field>
            <Field label="Volume recomendado (L/ha)">
              <input style={inp} type="number" value={form.volume_recomendado_lha} onChange={e => setForm(p => ({ ...p, volume_recomendado_lha: e.target.value }))} placeholder="Ex: 150" />
            </Field>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} /> Ativo
          </label>
        </Modal>
      )}
    </div>
  )
}
