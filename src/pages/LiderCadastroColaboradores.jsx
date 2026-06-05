import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import { Badge, StatusChip, KpiCard, Toolbar, DataTable, TR, Modal, Field, Sel, inp } from './LiderCadastroShared'

const FUNCOES = ['Operador', 'Auxiliar', 'Tratorista', 'Pulverizador', 'Mecânico', 'Motorista', 'Supervisor', 'Outro']

export default function LiderCadastroColaboradores() {
  const { workspaceId } = useStore()
  const [records,   setRecords]   = useState([])
  const [equipes,   setEquipes]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [busca,     setBusca]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState({ nome: '', matricula: '', cargo: 'Operador', equipe_id: '', ativo: true })

  useEffect(() => { if (workspaceId) load() }, [workspaceId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      supabase.from('lider_colaboradores').select('*, lider_equipes(nome)').eq('workspace_id', workspaceId).order('nome'),
      supabase.from('lider_equipes').select('id, nome').eq('workspace_id', workspaceId).eq('ativo', true).order('nome'),
    ])
    setRecords(r1.data || [])
    setEquipes(r2.data || [])
    setLoading(false)
  }

  function openNew() {
    setEditId(null)
    setForm({ nome: '', matricula: '', cargo: 'Operador', equipe_id: equipes[0]?.id ?? '', ativo: true })
    setShowModal(true)
  }

  function openEdit(r) {
    setEditId(r.id)
    setForm({ nome: r.nome, matricula: r.matricula ?? '', cargo: r.cargo ?? 'Operador', equipe_id: r.equipe_id ?? '', ativo: r.ativo })
    setShowModal(true)
  }

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = { ...form, workspace_id: workspaceId, equipe_id: form.equipe_id || null }
    const { error } = editId
      ? await supabase.from('lider_colaboradores').update(payload).eq('id', editId)
      : await supabase.from('lider_colaboradores').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Atualizado!' : 'Colaborador cadastrado!')
    setShowModal(false); load()
  }

  async function toggleAtivo(id, atual) {
    const { error } = await supabase.from('lider_colaboradores').update({ ativo: !atual }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(!atual ? 'Ativado' : 'Inativado'); load() }
  }

  async function excluir(id, nome) {
    if (!window.confirm(`Excluir colaborador "${nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('lider_colaboradores').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Excluído'); load() }
  }

  const filtrados  = records.filter(r => r.nome?.toLowerCase().includes(busca.toLowerCase()))
  const ativos     = records.filter(r => r.ativo)
  const operadores = ativos.filter(r => r.cargo === 'Operador').length
  const auxiliares = ativos.filter(r => r.cargo === 'Auxiliar').length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header title="Colaboradores" subtitle="Cadastro de colaboradores, operadores e auxiliares do SmartLíder" action={{ label: 'Novo Colaborador', onClick: openNew }} />

      <div style={{ padding: '24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard label="Ativos"       value={ativos.length}           icon="👷" color="#3b82f6" />
          <KpiCard label="Operadores"   value={operadores}              icon="🚜" color="#10b981" />
          <KpiCard label="Auxiliares"   value={auxiliares}              icon="🧰" color="#f59e0b" />
          <KpiCard label="Inativos"     value={records.filter(r => !r.ativo).length} icon="⏸" color="#6b7280" />
        </div>

        <Toolbar busca={busca} setBusca={setBusca} onRefresh={load} onNovo={openNew} placeholder="Buscar colaboradores…" />

        <DataTable cols={['Nome', 'Matrícula', 'Cargo', 'Equipe', 'Status']} loading={loading} isEmpty={filtrados.length === 0}>
          {filtrados.map(r => (
            <TR key={r.id} ativo={r.ativo}
              onEdit={() => openEdit(r)}
              onToggle={() => toggleAtivo(r.id, r.ativo)}
              onDel={() => excluir(r.id, r.nome)}
              cells={[
                <strong key="n">{r.nome}</strong>,
                r.matricula ? `#${r.matricula}` : '—',
                <Badge key="c" text={r.cargo ?? '—'} />,
                r.lider_equipes ? <Badge key="e" text={r.lider_equipes.nome} /> : '—',
                <StatusChip key="s" ativo={r.ativo} />,
              ]}
            />
          ))}
        </DataTable>
      </div>

      {showModal && (
        <Modal title={editId ? 'Editar Colaborador' : 'Novo Colaborador'} onClose={() => setShowModal(false)} onSave={save} saving={saving}>
          <Field label="Nome *">
            <input style={inp} value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome completo" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Matrícula">
              <input style={inp} value={form.matricula} onChange={e => setForm(p => ({ ...p, matricula: e.target.value }))} placeholder="Ex: 00123" />
            </Field>
            <Field label="Cargo / Função">
              <Sel value={form.cargo} onChange={v => setForm(p => ({ ...p, cargo: v }))} options={FUNCOES} />
            </Field>
          </div>
          <Field label="Equipe">
            <Sel value={form.equipe_id} onChange={v => setForm(p => ({ ...p, equipe_id: v }))}
              options={[{ value: '', label: '— Sem equipe —' }, ...equipes.map(e => ({ value: e.id, label: e.nome }))]} />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} /> Ativo
          </label>
        </Modal>
      )}
    </div>
  )
}
