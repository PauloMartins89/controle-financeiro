import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import { Badge, StatusChip, KpiCard, Toolbar, DataTable, TR, Modal, Field, Sel, inp } from './LiderCadastroShared'

const TIPO_PROD = ['Herbicida', 'Inseticida', 'Fungicida', 'Adubo', 'Semente', 'Adjuvante', 'Óleo', 'Outro']
const UNIDADES  = ['L', 'kg', 'sc', 'ton', 'un', 'cx', 'g', 'ml']

export default function LiderCadastroProdutos() {
  const { workspaceId } = useStore()
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [busca,     setBusca]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState({ nome: '', tipo: 'Herbicida', unidade: 'L', ativo: true })

  useEffect(() => { if (workspaceId) load() }, [workspaceId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('lider_produtos').select('*').eq('workspace_id', workspaceId).order('nome')
    setRecords(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditId(null)
    setForm({ nome: '', tipo: 'Herbicida', unidade: 'L', ativo: true })
    setShowModal(true)
  }

  function openEdit(r) {
    setEditId(r.id)
    setForm({ nome: r.nome, tipo: r.tipo ?? 'Herbicida', unidade: r.unidade ?? 'L', ativo: r.ativo })
    setShowModal(true)
  }

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = { ...form, workspace_id: workspaceId }
    const { error } = editId
      ? await supabase.from('lider_produtos').update(payload).eq('id', editId)
      : await supabase.from('lider_produtos').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Atualizado!' : 'Produto cadastrado!')
    setShowModal(false); load()
  }

  async function toggleAtivo(id, atual) {
    const { error } = await supabase.from('lider_produtos').update({ ativo: !atual }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(!atual ? 'Ativado' : 'Inativado'); load() }
  }

  async function excluir(id, nome) {
    if (!window.confirm(`Excluir produto "${nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('lider_produtos').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Excluído'); load() }
  }

  const filtrados   = records.filter(r => r.nome?.toLowerCase().includes(busca.toLowerCase()))
  const ativos      = records.filter(r => r.ativo)
  const herbicidas  = ativos.filter(r => r.tipo === 'Herbicida').length
  const inseticidas = ativos.filter(r => r.tipo === 'Inseticida').length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header title="Produtos / Insumos" subtitle="Cadastro de produtos agrícolas e insumos utilizados no campo" action={{ label: 'Novo Produto', onClick: openNew }} />

      <div style={{ padding: '24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard label="Produtos Ativos"   value={ativos.length}             icon="🌱" color="#10b981" />
          <KpiCard label="Herbicidas"        value={herbicidas}                icon="🌿" color="#3b82f6" />
          <KpiCard label="Inseticidas"       value={inseticidas}               icon="🐛" color="#f59e0b" />
          <KpiCard label="Inativos"          value={records.filter(r => !r.ativo).length} icon="⏸" color="#6b7280" />
        </div>

        <Toolbar busca={busca} setBusca={setBusca} onRefresh={load} onNovo={openNew} placeholder="Buscar produtos…" />

        <DataTable cols={['Produto', 'Categoria', 'Unidade', 'Status']} loading={loading} isEmpty={filtrados.length === 0}>
          {filtrados.map(r => (
            <TR key={r.id} ativo={r.ativo}
              onEdit={() => openEdit(r)}
              onToggle={() => toggleAtivo(r.id, r.ativo)}
              onDel={() => excluir(r.id, r.nome)}
              cells={[
                <strong key="n">{r.nome}</strong>,
                <Badge key="t" text={r.tipo ?? '—'} />,
                <Badge key="u" text={r.unidade ?? '—'} />,
                <StatusChip key="s" ativo={r.ativo} />,
              ]}
            />
          ))}
        </DataTable>
      </div>

      {showModal && (
        <Modal title={editId ? 'Editar Produto' : 'Novo Produto'} onClose={() => setShowModal(false)} onSave={save} saving={saving}>
          <Field label="Nome *">
            <input style={inp} value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Roundup Original" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Categoria / Tipo">
              <Sel value={form.tipo} onChange={v => setForm(p => ({ ...p, tipo: v }))} options={TIPO_PROD} />
            </Field>
            <Field label="Unidade">
              <Sel value={form.unidade} onChange={v => setForm(p => ({ ...p, unidade: v }))} options={UNIDADES} />
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
