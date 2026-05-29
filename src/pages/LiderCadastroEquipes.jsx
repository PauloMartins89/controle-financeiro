import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import { Badge, StatusChip, KpiCard, Toolbar, DataTable, TR, Modal, Field, Sel, inp } from './LiderCadastroShared'

export default function LiderCadastroEquipes() {
  const { workspaceId } = useStore()
  const [records,     setRecords]     = useState([])
  const [frentes,     setFrentes]     = useState([])
  const [liderUsers,  setLiderUsers]  = useState([])
  const [refeiEquipes, setRefeiEquipes] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [busca,       setBusca]       = useState('')
  const [showModal,   setShowModal]   = useState(false)
  const [editId,      setEditId]      = useState(null)
  const [form,        setForm]        = useState({ nome: '', codigo: '', frente_id: '', lider_id: '', lider_nome: '', lider_email: '', refei_equipe_id: '', ativo: true })

  useEffect(() => { if (workspaceId) load() }, [workspaceId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from('lider_equipes').select('*, lider_frentes(nome), refei_equipes(id, nome, cdc)').eq('workspace_id', workspaceId).order('nome'),
      supabase.from('lider_frentes').select('id, nome').eq('workspace_id', workspaceId).eq('ativo', true).order('nome'),
      supabase
        .from('lider_perfis')
        .select('user_id, matricula, nome, equipe_id')
        .eq('workspace_id', workspaceId)
        .eq('ativo', true)
        .order('matricula')
        .then(({ data }) => ({ usuarios: (data || []).map(p => ({ id: p.user_id, matricula: p.matricula, nome: p.nome, equipe_id: p.equipe_id, email: `${p.matricula}@lider.smartpro` })) })),
      supabase.from('refei_equipes').select('id, nome, cdc').eq('workspace_id', workspaceId).eq('ativo', true).order('nome'),
    ])
    setRecords(r1.data || [])
    setFrentes(r2.data || [])
    setLiderUsers(r3.usuarios || [])
    setRefeiEquipes(r4.data || [])
    setLoading(false)
  }

  function openNew() {
    setEditId(null)
    setForm({ nome: '', codigo: '', frente_id: frentes[0]?.id ?? '', lider_id: '', lider_nome: '', lider_email: '', refei_equipe_id: '', ativo: true })
    setShowModal(true)
  }

  function openEdit(r) {
    setEditId(r.id)
    setForm({ nome: r.nome, codigo: r.codigo ?? '', frente_id: r.frente_id ?? '', lider_id: r.lider_id ?? '', lider_nome: r.lider_nome ?? '', lider_email: r.lider_email ?? '', refei_equipe_id: r.refei_equipe_id ?? '', ativo: r.ativo })
    setShowModal(true)
  }

  function handleSelectLider(userId) {
    if (!userId) {
      setForm(p => ({ ...p, lider_id: '', lider_nome: '', lider_email: '' }))
      return
    }
    const u = liderUsers.find(u => u.id === userId)
    if (u) setForm(p => ({ ...p, lider_id: u.id, lider_nome: u.nome || u.matricula, lider_email: u.email }))
  }

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = { ...form, workspace_id: workspaceId, frente_id: form.frente_id || null, lider_id: form.lider_id || null, refei_equipe_id: form.refei_equipe_id || null }
    const { error } = editId
      ? await supabase.from('lider_equipes').update(payload).eq('id', editId)
      : await supabase.from('lider_equipes').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Atualizado!' : 'Equipe cadastrada!')
    setShowModal(false); load()
  }

  async function toggleAtivo(id, atual) {
    const { error } = await supabase.from('lider_equipes').update({ ativo: !atual }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(!atual ? 'Ativado' : 'Inativado'); load() }
  }

  async function excluir(id, nome) {
    if (!window.confirm(`Excluir equipe "${nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('lider_equipes').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Excluído'); load() }
  }

  const filtrados  = records.filter(r => r.nome?.toLowerCase().includes(busca.toLowerCase()))
  const ativos     = records.filter(r => r.ativo).length
  const comLider   = records.filter(r => r.lider_id || r.lider_nome).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header title="Equipes" subtitle="Cadastro de equipes de campo vinculadas às frentes operacionais" />

      <div style={{ padding: '24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard label="Total de Equipes"  value={records.length}                     icon="👥" color="#3b82f6" />
          <KpiCard label="Equipes Ativas"    value={ativos}                             icon="✅" color="#10b981" />
          <KpiCard label="Com Líder"         value={comLider}                           icon="👤" color="#8b5cf6" />
          <KpiCard label="Inativas"          value={records.filter(r => !r.ativo).length} icon="⏸" color="#6b7280" />
        </div>

        <Toolbar busca={busca} setBusca={setBusca} onRefresh={load} onNovo={openNew} placeholder="Buscar equipes…" />

        <DataTable cols={['Equipe', 'Código', 'Frente', 'Líder', 'Equipe Refeições', 'Status']} loading={loading} isEmpty={filtrados.length === 0}>
          {filtrados.map(r => (
            <TR key={r.id} ativo={r.ativo}
              onEdit={() => openEdit(r)}
              onToggle={() => toggleAtivo(r.id, r.ativo)}
              onDel={() => excluir(r.id, r.nome)}
              cells={[
                <strong key="n">{r.nome}</strong>,
                r.codigo ? <Badge text={r.codigo} /> : '—',
                r.lider_frentes ? <Badge text={r.lider_frentes.nome} /> : '—',
                r.lider_nome || (r.lider_email ? r.lider_email.split('@')[0] : '—'),
                r.refei_equipes ? <Badge text={r.refei_equipes.cdc ? `${r.refei_equipes.cdc} · ${r.refei_equipes.nome}` : r.refei_equipes.nome} /> : <span style={{ color: '#94a3b8' }}>— não vinculada —</span>,
                <StatusChip key="s" ativo={r.ativo} />,
              ]}
            />
          ))}
        </DataTable>
      </div>

      {showModal && (
        <Modal title={editId ? 'Editar Equipe' : 'Nova Equipe'} onClose={() => setShowModal(false)} onSave={save} saving={saving}>
          <Field label="Nome *">
            <input style={inp} value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Equipe 005" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Código">
              <input style={inp} value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} placeholder="Ex: EQ-005" />
            </Field>
            <Field label="Frente">
              <Sel value={form.frente_id} onChange={v => setForm(p => ({ ...p, frente_id: v }))}
                options={[{ value: '', label: '— Sem frente —' }, ...frentes.map(f => ({ value: f.id, label: f.nome }))]} />
            </Field>
          </div>
          <Field label="Líder (usuário do app)">
            <Sel
              value={form.lider_id}
              onChange={handleSelectLider}
              options={[
                { value: '', label: '— Sem líder —' },
                ...liderUsers.map(u => ({ value: u.id, label: `${u.matricula} · ${u.nome || u.email}` }))
              ]}
            />
            {form.lider_email && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {form.lider_email}
              </div>
            )}
          </Field>
          <Field label="Equipe de Refeições (vínculo p/ pedidos)">
            <Sel
              value={form.refei_equipe_id}
              onChange={v => setForm(p => ({ ...p, refei_equipe_id: v }))}
              options={[
                { value: '', label: '— Sem vínculo —' },
                ...refeiEquipes.map(e => ({ value: e.id, label: e.cdc ? `${e.cdc} · ${e.nome}` : e.nome }))
              ]}
            />
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Vincula esta equipe operacional à equipe do módulo Refeições.
              Quando o líder solicitar refeição pelo app, a lista de colaboradores virá deste vínculo.
            </div>
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} /> Ativo
          </label>
        </Modal>
      )}
    </div>
  )
}
