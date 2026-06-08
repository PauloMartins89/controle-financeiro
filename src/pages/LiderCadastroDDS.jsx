import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import { Badge, StatusChip, KpiCard, Toolbar, DataTable, TR, Modal, Field, Sel, inp } from './LiderCadastroShared'

const CAT_DDS = ['Segurança', 'Saúde', 'Meio Ambiente', 'Qualidade', 'Outros']

const CAT_COLOR = {
  'Segurança':     '#ef4444',
  'Saúde':         '#3b82f6',
  'Meio Ambiente': '#22c55e',
  'Qualidade':     '#f59e0b',
  'Outros':        '#8b5cf6',
}

export default function LiderCadastroDDS() {
  const { workspaceId } = useStore()
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [busca,     setBusca]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [form,      setForm]      = useState({
    titulo: '', categoria: 'Segurança', conteudo: '', imagem_url: '', ativo: true,
  })

  useEffect(() => { if (workspaceId) load() }, [workspaceId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('dds_temas')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('categoria')
      .order('titulo')
    setRecords(data || [])
    setLoading(false)
  }

  function openNew() {
    setEditId(null)
    setForm({ titulo: '', categoria: 'Segurança', conteudo: '', imagem_url: '', ativo: true })
    setShowModal(true)
  }

  function openEdit(r) {
    setEditId(r.id)
    setForm({
      titulo:     r.titulo,
      categoria:  r.categoria ?? 'Segurança',
      conteudo:   r.conteudo ?? '',
      imagem_url: r.imagem_url ?? '',
      ativo:      r.ativo,
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.titulo.trim()) { toast.error('Título obrigatório'); return }
    setSaving(true)
    const payload = {
      titulo:      form.titulo.trim(),
      categoria:   form.categoria,
      conteudo:    form.conteudo || null,
      imagem_url:  form.imagem_url || null,
      ativo:       form.ativo,
      workspace_id: workspaceId,
    }
    const { error } = editId
      ? await supabase.from('dds_temas').update(payload).eq('id', editId)
      : await supabase.from('dds_temas').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Tema atualizado!' : 'Tema cadastrado!')
    setShowModal(false); load()
  }

  async function toggleAtivo(id, atual) {
    const { error } = await supabase.from('dds_temas').update({ ativo: !atual }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(!atual ? 'Ativado' : 'Inativado'); load() }
  }

  async function excluir(id, titulo) {
    if (!window.confirm(`Excluir tema "${titulo}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('dds_temas').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Excluído'); load() }
  }

  const filtrados = records.filter(r =>
    r.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
    r.categoria?.toLowerCase().includes(busca.toLowerCase())
  )
  const ativos   = records.filter(r => r.ativo)
  const inativos = records.filter(r => !r.ativo)

  const catCount = {}
  ativos.forEach(r => { if (r.categoria) catCount[r.categoria] = (catCount[r.categoria] || 0) + 1 })
  const maisComum = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header
        title="Temas de DDS"
        subtitle="Diálogos Diários de Segurança — temas disponíveis no app SmartLíder"
        action={{ label: 'Novo Tema', onClick: openNew }}
      />

      <div style={{ padding: '24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard label="Temas Ativos"   value={ativos.length}   icon="🦺" color="#10b981" />
          <KpiCard label="Inativos"       value={inativos.length} icon="⏸"  color="#6b7280" />
          <KpiCard label="Total"          value={records.length}  icon="📋" color="#3b82f6" />
          <KpiCard label="Mais frequente" value={maisComum}       icon="🏆" color="#f59e0b" />
        </div>

        <Toolbar busca={busca} setBusca={setBusca} onRefresh={load} onNovo={openNew} placeholder="Buscar temas…" />

        <DataTable cols={['Tema', 'Categoria', 'Conteúdo', 'Status']} loading={loading} isEmpty={filtrados.length === 0}>
          {filtrados.map(r => {
            const cor = CAT_COLOR[r.categoria] ?? '#8b5cf6'
            return (
              <TR key={r.id} ativo={r.ativo}
                onEdit={() => openEdit(r)}
                onToggle={() => toggleAtivo(r.id, r.ativo)}
                onDel={() => excluir(r.id, r.titulo)}
                cells={[
                  <strong key="t">{r.titulo}</strong>,
                  <Badge key="c" text={r.categoria ?? '—'} color={cor} />,
                  r.conteudo
                    ? <span key="ct" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {r.conteudo.slice(0, 60)}{r.conteudo.length > 60 ? '…' : ''}
                      </span>
                    : <span key="ct" style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>sem texto</span>,
                  <StatusChip key="s" ativo={r.ativo} />,
                ]}
              />
            )
          })}
        </DataTable>
      </div>

      {showModal && (
        <Modal
          title={editId ? 'Editar Tema DDS' : 'Novo Tema DDS'}
          onClose={() => setShowModal(false)}
          onSave={save}
          saving={saving}
        >
          <Field label="Título *">
            <input
              style={inp}
              value={form.titulo}
              onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
              placeholder="Ex: Uso correto de EPI"
            />
          </Field>
          <Field label="Categoria">
            <Sel value={form.categoria} onChange={v => setForm(p => ({ ...p, categoria: v }))} options={CAT_DDS} />
          </Field>
          <Field label="Conteúdo (texto lido pelo líder com a equipe)">
            <textarea
              style={{ ...inp, minHeight: 120, resize: 'vertical' }}
              value={form.conteudo}
              onChange={e => setForm(p => ({ ...p, conteudo: e.target.value }))}
              placeholder="Descreva o tema do DDS. Este texto será exibido no app para o líder ler com a equipe."
            />
          </Field>
          <Field label="URL da Imagem (opcional)">
            <input
              style={inp}
              value={form.imagem_url}
              onChange={e => setForm(p => ({ ...p, imagem_url: e.target.value }))}
              placeholder="https://..."
            />
            {form.imagem_url && (
              <img
                src={form.imagem_url}
                alt="preview"
                style={{ marginTop: 8, width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }}
                onError={e => (e.target.style.display = 'none')}
              />
            )}
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} /> Ativo
          </label>
        </Modal>
      )}
    </div>
  )
}
