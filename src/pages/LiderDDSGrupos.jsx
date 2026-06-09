import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import { ArrowPathIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import {
  Badge, StatusChip, KpiCard, Toolbar, DataTable, TR, Modal, Field, Sel, inp,
} from './LiderCadastroShared'

const CORES = [
  { value: '#6366f1', label: '🟣 Índigo'   },
  { value: '#ef4444', label: '🔴 Vermelho'  },
  { value: '#3b82f6', label: '🔵 Azul'     },
  { value: '#10b981', label: '🟢 Verde'    },
  { value: '#f59e0b', label: '🟡 Âmbar'   },
  { value: '#f97316', label: '🟠 Laranja'  },
  { value: '#8b5cf6', label: '🟣 Violeta'  },
  { value: '#14b8a6', label: '🩵 Teal'     },
  { value: '#1e3a5f', label: '🔵 Navy'     },
]

const EMPTY = { nome: '', descricao: '', lider_nome: '', cor: '#6366f1', ativo: true }

export default function LiderDDSGrupos() {
  const { workspaceId } = useStore()
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [busca,     setBusca]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState(EMPTY)

  useEffect(() => { if (workspaceId) load() }, [workspaceId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('dds_grupos')
      .select('id, nome, descricao, lider_nome, cor, ativo, created_at')
      .eq('workspace_id', workspaceId)
      .order('nome')
    setRecords(data || [])
    setLoading(false)
  }

  function f(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function openNew()  { setEditId(null); setForm(EMPTY); setShowModal(true) }
  function openEdit(r) {
    setEditId(r.id)
    setForm({ nome: r.nome, descricao: r.descricao || '', lider_nome: r.lider_nome || '', cor: r.cor || '#6366f1', ativo: r.ativo })
    setShowModal(true)
  }

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = { workspace_id: workspaceId, nome: form.nome.trim(), descricao: form.descricao || null, lider_nome: form.lider_nome || null, cor: form.cor, ativo: form.ativo }
    const { error } = editId
      ? await supabase.from('dds_grupos').update(payload).eq('id', editId)
      : await supabase.from('dds_grupos').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Grupo atualizado!' : 'Grupo criado!')
    setShowModal(false)
    load()
  }

  async function toggle(r) {
    await supabase.from('dds_grupos').update({ ativo: !r.ativo }).eq('id', r.id)
    load()
  }

  async function del(r) {
    if (!confirm(`Excluir grupo "${r.nome}"?\nTemas e sessões vinculadas perderão a associação.`)) return
    const { error } = await supabase.from('dds_grupos').delete().eq('id', r.id)
    if (error) { toast.error(error.message); return }
    toast.success('Grupo excluído')
    load()
  }

  const filtrados = records.filter(r =>
    r.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (r.lider_nome || '').toLowerCase().includes(busca.toLowerCase())
  )
  const ativos = records.filter(r => r.ativo).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title="Grupos DDS"
        subtitle="Programas temáticos com líder responsável"
        action={{ label: 'Atualizar', icon: ArrowPathIcon, onClick: load }}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          <KpiCard label="Total de grupos"  value={records.length} icon="🗂️"  color="#6366f1" />
          <KpiCard label="Grupos ativos"    value={ativos}          icon="✅"  color="#10b981" />
          <KpiCard label="Com líder"        value={records.filter(r => r.lider_nome).length} icon="👤" color="#3b82f6" />
        </div>

        <Toolbar
          busca={busca} setBusca={setBusca}
          onRefresh={load} onNovo={openNew}
          placeholder="Buscar por nome ou líder…"
        />

        <DataTable
          cols={['Grupo', 'Líder Responsável', 'Descrição', 'Status']}
          loading={loading}
          isEmpty={filtrados.length === 0}
        >
          {filtrados.map(r => (
            <TR
              key={r.id}
              ativo={r.ativo}
              onEdit={() => openEdit(r)}
              onToggle={() => toggle(r)}
              onDel={() => del(r)}
              cells={[
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: r.cor || '#6366f1', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>{r.nome}</span>
                </div>,
                r.lider_nome
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>👤</span> {r.lider_nome}
                    </span>
                  : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>,
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.descricao || '—'}</span>,
                <StatusChip ativo={r.ativo} />,
              ]}
            />
          ))}
        </DataTable>
      </div>

      {showModal && (
        <Modal
          title={editId ? 'Editar Grupo DDS' : 'Novo Grupo DDS'}
          onClose={() => setShowModal(false)}
          onSave={save}
          saving={saving}
        >
          <Field label="Nome do grupo *">
            <input
              value={form.nome} onChange={e => f('nome', e.target.value)}
              placeholder="Ex: DDS de Segurança Operacional"
              style={inp}
            />
          </Field>

          <Field label="Líder responsável">
            <input
              value={form.lider_nome} onChange={e => f('lider_nome', e.target.value)}
              placeholder="Nome do líder / coordenador"
              style={inp}
            />
          </Field>

          <Field label="Descrição">
            <textarea
              value={form.descricao} onChange={e => f('descricao', e.target.value)}
              placeholder="Objetivo e escopo do grupo…"
              rows={3}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
            />
          </Field>

          <Field label="Cor de identificação">
            <Sel value={form.cor} onChange={v => f('cor', v)} options={CORES} />
          </Field>

          <Field label="Status">
            <Sel
              value={form.ativo ? 'ativo' : 'inativo'}
              onChange={v => f('ativo', v === 'ativo')}
              options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]}
            />
          </Field>
        </Modal>
      )}
    </div>
  )
}
