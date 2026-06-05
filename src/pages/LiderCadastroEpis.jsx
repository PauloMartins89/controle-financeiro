import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import { Badge, StatusChip, KpiCard, Toolbar, DataTable, TR, Modal, Field, Sel, inp } from './LiderCadastroShared'

const CAT_EPI = [
  'Proteção da Cabeça', 'Proteção dos Olhos', 'Proteção Respiratória',
  'Proteção Auditiva', 'Proteção dos Membros Superiores',
  'Proteção dos Membros Inferiores', 'Proteção do Tronco',
  'Proteção Contra Quedas', 'Outro',
]

export default function LiderCadastroEpis() {
  const { workspaceId } = useStore()
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [busca,     setBusca]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState({ nome: '', categoria: 'Proteção da Cabeça', ca: '', vida_util_meses: '', ativo: true })

  useEffect(() => { if (workspaceId) load() }, [workspaceId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('lider_epis').select('*').eq('workspace_id', workspaceId).order('nome')
    setRecords(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditId(null)
    setForm({ nome: '', categoria: 'Proteção da Cabeça', ca: '', vida_util_meses: '', ativo: true })
    setShowModal(true)
  }

  function openEdit(r) {
    setEditId(r.id)
    setForm({ nome: r.nome, categoria: r.categoria ?? 'Proteção da Cabeça', ca: r.ca ?? '', vida_util_meses: r.vida_util_meses ?? '', ativo: r.ativo })
    setShowModal(true)
  }

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = {
      ...form, workspace_id: workspaceId,
      vida_util_meses: form.vida_util_meses ? parseInt(form.vida_util_meses) : null,
    }
    const { error } = editId
      ? await supabase.from('lider_epis').update(payload).eq('id', editId)
      : await supabase.from('lider_epis').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Atualizado!' : 'EPI cadastrado!')
    setShowModal(false); load()
  }

  async function toggleAtivo(id, atual) {
    const { error } = await supabase.from('lider_epis').update({ ativo: !atual }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(!atual ? 'Ativado' : 'Inativado'); load() }
  }

  async function excluir(id, nome) {
    if (!window.confirm(`Excluir EPI "${nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('lider_epis').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Excluído'); load() }
  }

  const filtrados = records.filter(r => r.nome?.toLowerCase().includes(busca.toLowerCase()))
  const ativos    = records.filter(r => r.ativo)
  const comCA     = ativos.filter(r => r.ca).length

  // EPIs com vida útil vencendo (< 3 meses a partir da data de cadastro - proxy sem data real)
  const categCount = {}
  ativos.forEach(r => { if (r.categoria) categCount[r.categoria] = (categCount[r.categoria] || 0) + 1 })
  const maisComum  = Object.entries(categCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header title="Catálogo de EPIs" subtitle="Cadastro de Equipamentos de Proteção Individual disponíveis no SmartLíder" action={{ label: 'Novo EPI', onClick: openNew }} />

      <div style={{ padding: '24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard label="EPIs Ativos"         value={ativos.length}             icon="🦺" color="#10b981" />
          <KpiCard label="Com CA"              value={comCA}                     icon="📋" color="#3b82f6" />
          <KpiCard label="Sem CA"              value={ativos.length - comCA}     icon="⚠️" color="#f59e0b" />
          <KpiCard label="Inativos"            value={records.filter(r => !r.ativo).length} icon="⏸" color="#6b7280" />
        </div>

        <Toolbar busca={busca} setBusca={setBusca} onRefresh={load} onNovo={openNew} placeholder="Buscar EPIs…" />

        <DataTable cols={['EPI', 'CA', 'Categoria', 'Vida Útil', 'Status']} loading={loading} isEmpty={filtrados.length === 0}>
          {filtrados.map(r => (
            <TR key={r.id} ativo={r.ativo}
              onEdit={() => openEdit(r)}
              onToggle={() => toggleAtivo(r.id, r.ativo)}
              onDel={() => excluir(r.id, r.nome)}
              cells={[
                <strong key="n">{r.nome}</strong>,
                r.ca ? <Badge key="ca" text={`CA ${r.ca}`} /> : '—',
                r.categoria ? <Badge key="ct" text={r.categoria} /> : '—',
                r.vida_util_meses ? `${r.vida_util_meses} meses` : '—',
                <StatusChip key="s" ativo={r.ativo} />,
              ]}
            />
          ))}
        </DataTable>

        {maisComum !== '—' && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12, textAlign: 'right' }}>
            Categoria mais comum: <strong>{maisComum}</strong>
          </p>
        )}
      </div>

      {showModal && (
        <Modal title={editId ? 'Editar EPI' : 'Novo EPI'} onClose={() => setShowModal(false)} onSave={save} saving={saving}>
          <Field label="Nome / Descrição *">
            <input style={inp} value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Capacete de Segurança" />
          </Field>
          <Field label="Categoria">
            <Sel value={form.categoria} onChange={v => setForm(p => ({ ...p, categoria: v }))} options={CAT_EPI} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="CA (Cert. de Aprovação)">
              <input style={inp} value={form.ca} onChange={e => setForm(p => ({ ...p, ca: e.target.value }))} placeholder="Ex: 12345" />
            </Field>
            <Field label="Vida útil (meses)">
              <input style={inp} type="number" value={form.vida_util_meses} onChange={e => setForm(p => ({ ...p, vida_util_meses: e.target.value }))} placeholder="Ex: 12" />
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
