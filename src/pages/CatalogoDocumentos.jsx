import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon,
  ArrowPathIcon, CheckIcon, XMarkIcon, DocumentTextIcon,
  ArrowTopRightOnSquareIcon, FunnelIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

// ── Constantes ─────────────────────────────────────────────────────────────────
const TIPOS_DOC = [
  { value: 'manual_operador',      label: 'Manual do Operador' },
  { value: 'manual_manutencao',    label: 'Manual de Manutenção' },
  { value: 'manual_servico',       label: 'Manual de Serviço' },
  { value: 'catalogo_pecas',       label: 'Catálogo de Peças' },
  { value: 'quick_reference',      label: 'Quick Reference' },
  { value: 'boletim_tecnico',      label: 'Boletim Técnico' },
  { value: 'procedimento_interno', label: 'Procedimento Interno' },
  { value: 'vista_explodida',      label: 'Vista Explodida' },
]
const STATUS_VAL = [
  { value: 'oficial',            label: 'Oficial',            color: '#16a34a' },
  { value: 'referencial',        label: 'Referencial',        color: '#0ea5e9' },
  { value: 'estimado',           label: 'Estimado',           color: '#94a3b8' },
  { value: 'pendente_validacao', label: 'Pendente',           color: '#ca8a04' },
]
const STATUS_LIC = [
  { value: 'link_oficial',     label: 'Link Oficial' },
  { value: 'licenciado',       label: 'Licenciado' },
  { value: 'interno_validado', label: 'Interno Validado' },
  { value: 'pendente',         label: 'Pendente' },
]
const IDIOMAS = ['PT-BR', 'EN-US', 'ES', 'FR', 'DE']

const EMPTY_FORM = {
  fabricante: '', modelo_nome: '', modelo_id: '',
  tipo: 'manual_manutencao', titulo: '', codigo_pub: '',
  idioma: 'PT-BR', fonte: '', url_oficial: '',
  pagina_ref: '', data_doc: '',
  status_licenca: 'link_oficial', status_val: 'pendente_validacao',
  observacoes: '',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function StatusBadge({ val }) {
  const cfg = STATUS_VAL.find(s => s.value === val) || STATUS_VAL[3]
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${cfg.color}18`, color: cfg.color, fontWeight: 700 }}>
      {cfg.label}
    </span>
  )
}
function TipoBadge({ val }) {
  const cfg = TIPOS_DOC.find(t => t.value === val)
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
      {cfg?.label || val}
    </span>
  )
}

// ── Componente principal ────────────────────────────────────────────────────────
export default function CatalogoDocumentos() {
  const [docs, setDocs]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [modelos, setModelos]     = useState([])  // para autocomplete modelo_id
  const [search, setSearch]       = useState('')
  const [filterTipo, setFilterTipo]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFab, setFilterFab] = useState('')

  // Form state
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cat_documentos')
      .select('*')
      .order('fabricante')
      .order('tipo')
    if (error) { toast.error('Erro ao carregar documentos'); console.error(error) }
    else setDocs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  // Carrega modelos para vincular
  useEffect(() => {
    supabase.from('cat_modelos').select('id,fabricante,modelo').order('fabricante').order('modelo').limit(600)
      .then(({ data }) => setModelos(data || []))
  }, [])

  // ── Filtro local ───────────────────────────────────────────────────────────
  const filtered = docs.filter(d => {
    const q = search.toLowerCase()
    const matchSearch = !q || d.titulo?.toLowerCase().includes(q) || d.fabricante?.toLowerCase().includes(q) ||
      d.modelo_nome?.toLowerCase().includes(q) || d.codigo_pub?.toLowerCase().includes(q)
    const matchTipo   = !filterTipo   || d.tipo       === filterTipo
    const matchStatus = !filterStatus || d.status_val === filterStatus
    const matchFab    = !filterFab    || d.fabricante?.toLowerCase().includes(filterFab.toLowerCase())
    return matchSearch && matchTipo && matchStatus && matchFab
  })

  const fabricantes = [...new Set(docs.map(d => d.fabricante).filter(Boolean))].sort()

  // ── Form handlers ──────────────────────────────────────────────────────────
  function handleNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }
  function handleEdit(doc) {
    setEditing(doc.id)
    setForm({
      fabricante:     doc.fabricante    || '',
      modelo_nome:    doc.modelo_nome   || '',
      modelo_id:      doc.modelo_id     || '',
      tipo:           doc.tipo          || 'manual_manutencao',
      titulo:         doc.titulo        || '',
      codigo_pub:     doc.codigo_pub    || '',
      idioma:         doc.idioma        || 'PT-BR',
      fonte:          doc.fonte         || '',
      url_oficial:    doc.url_oficial   || '',
      pagina_ref:     doc.pagina_ref    || '',
      data_doc:       doc.data_doc      || '',
      status_licenca: doc.status_licenca|| 'link_oficial',
      status_val:     doc.status_val    || 'pendente_validacao',
      observacoes:    doc.observacoes   || '',
    })
    setShowForm(true)
  }
  function handleCancel() { setShowForm(false); setEditing(null); setForm(EMPTY_FORM) }

  async function handleSave() {
    if (!form.fabricante.trim()) return toast.error('Fabricante obrigatório')
    if (!form.titulo.trim())     return toast.error('Título obrigatório')
    if (!form.tipo)              return toast.error('Tipo obrigatório')
    setSaving(true)
    const payload = {
      fabricante:     form.fabricante.trim(),
      modelo_nome:    form.modelo_nome.trim() || null,
      modelo_id:      form.modelo_id || null,
      tipo:           form.tipo,
      titulo:         form.titulo.trim(),
      codigo_pub:     form.codigo_pub.trim()  || null,
      idioma:         form.idioma             || 'PT-BR',
      fonte:          form.fonte.trim()       || null,
      url_oficial:    form.url_oficial.trim() || null,
      pagina_ref:     form.pagina_ref.trim()  || null,
      data_doc:       form.data_doc           || null,
      status_licenca: form.status_licenca,
      status_val:     form.status_val,
      observacoes:    form.observacoes.trim() || null,
    }
    let error
    if (editing) {
      ;({ error } = await supabase.from('cat_documentos').update(payload).eq('id', editing))
    } else {
      ;({ error } = await supabase.from('cat_documentos').insert(payload))
    }
    setSaving(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    toast.success(editing ? 'Documento atualizado!' : 'Documento cadastrado!')
    handleCancel()
    fetchDocs()
  }

  async function handleDelete(id) {
    setDeleting(id)
    const { error } = await supabase.from('cat_documentos').delete().eq('id', id)
    setDeleting(null)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Documento removido')
    setDocs(d => d.filter(x => x.id !== id))
  }

  const inp = (field, label, type = 'text', opts = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</label>
      {opts.as === 'select' ? (
        <select value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
          style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, background: 'white' }}>
          {opts.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : opts.as === 'textarea' ? (
        <textarea value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
          rows={3} placeholder={opts.placeholder}
          style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical' }} />
      ) : (
        <input type={type} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
          placeholder={opts.placeholder}
          style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13 }} />
      )}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 0 32px' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>
            <DocumentTextIcon style={{ width: 20, height: 20, display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Biblioteca de Documentos Técnicos
          </h2>
          <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0' }}>
            {docs.length} documento{docs.length !== 1 ? 's' : ''} cadastrado{docs.length !== 1 ? 's' : ''} · Manuais, catálogos e boletins técnicos
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchDocs} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
            <ArrowPathIcon style={{ width: 13, height: 13 }} /> Atualizar
          </button>
          <button onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <PlusIcon style={{ width: 13, height: 13 }} /> Novo Documento
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <MagnifyingGlassIcon style={{ width: 14, height: 14, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, código, modelo..."
            style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxSizing: 'border-box' }} />
        </div>
        <select value={filterFab} onChange={e => setFilterFab(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, minWidth: 130 }}>
          <option value="">Todos fabricantes</option>
          {fabricantes.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, minWidth: 150 }}>
          <option value="">Todos os tipos</option>
          {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, minWidth: 130 }}>
          <option value="">Todos os status</option>
          {STATUS_VAL.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Formulário inline */}
      {showForm && (
        <div style={{ background: 'white', border: '2px solid #16a34a', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 4px 20px rgba(22,163,74,.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {editing ? 'Editar Documento' : 'Novo Documento Técnico'}
            </h3>
            <button onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {inp('fabricante', 'Fabricante *', 'text', { placeholder: 'ex: John Deere' })}
            {inp('modelo_nome', 'Modelo (nome)', 'text', { placeholder: 'ex: 8R Series, 8400R' })}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.4 }}>Vincular a Modelo (ID)</label>
              <select value={form.modelo_id} onChange={e => setForm(f => ({ ...f, modelo_id: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, background: 'white' }}>
                <option value="">— sem vínculo por ID —</option>
                {modelos.filter(m => !form.fabricante || m.fabricante.toLowerCase().includes(form.fabricante.toLowerCase())).map(m => (
                  <option key={m.id} value={m.id}>{m.fabricante} — {m.modelo}</option>
                ))}
              </select>
            </div>
            {inp('tipo', 'Tipo *', 'text', { as: 'select', options: TIPOS_DOC })}
            {inp('titulo', 'Título *', 'text', { placeholder: 'ex: Operation & Maintenance Manual' })}
            {inp('codigo_pub', 'Código / Publicação', 'text', { placeholder: 'ex: OMN400413' })}
            {inp('idioma', 'Idioma', 'text', { as: 'select', options: IDIOMAS.map(i => ({ value: i, label: i })) })}
            {inp('fonte', 'Fonte / Portal', 'text', { placeholder: 'ex: John Deere Service ADVISOR' })}
            {inp('url_oficial', 'URL Oficial', 'url', { placeholder: 'https://...' })}
            {inp('pagina_ref', 'Seção / Página', 'text', { placeholder: 'ex: p. 42, Seção 3.4' })}
            {inp('data_doc', 'Data do Documento', 'date')}
            {inp('status_licenca', 'Status de Licença', 'text', { as: 'select', options: STATUS_LIC })}
            {inp('status_val', 'Status de Validação', 'text', { as: 'select', options: STATUS_VAL })}
          </div>
          <div style={{ marginTop: 12 }}>
            {inp('observacoes', 'Observações', 'text', { as: 'textarea', placeholder: 'Descreva o conteúdo e relevância do documento...' })}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button onClick={handleCancel} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 8, background: saving ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              <CheckIcon style={{ width: 14, height: 14 }} />
              {saving ? 'Salvando...' : (editing ? 'Atualizar' : 'Cadastrar')}
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Carregando documentos...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 24px', background: '#f8fafc', borderRadius: 12, border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📁</div>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>{docs.length === 0 ? 'Nenhum documento cadastrado ainda.' : 'Nenhum documento corresponde aos filtros.'}</p>
          {docs.length === 0 && (
            <button onClick={handleNew} style={{ marginTop: 12, background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              + Cadastrar primeiro documento
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(doc => (
            <div key={doc.id} style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  <TipoBadge val={doc.tipo} />
                  <StatusBadge val={doc.status_val} />
                  {doc.idioma && <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{doc.idioma}</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>
                  {doc.titulo}
                  {doc.codigo_pub && <span style={{ marginLeft: 8, fontSize: 11, color: '#64748b', background: '#f1f5f9', borderRadius: 5, padding: '1px 6px' }}>{doc.codigo_pub}</span>}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  <strong>{doc.fabricante}</strong>
                  {doc.modelo_nome && ` · ${doc.modelo_nome}`}
                  {doc.fonte && ` · ${doc.fonte}`}
                </div>
                {doc.observacoes && <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0', lineHeight: 1.4 }}>{doc.observacoes.slice(0, 120)}{doc.observacoes.length > 120 ? '…' : ''}</p>}
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {doc.url_oficial && (
                  <a href={doc.url_oficial} target="_blank" rel="noopener noreferrer" title="Abrir link oficial"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f0fdf4', color: '#16a34a', textDecoration: 'none', borderRadius: 7, padding: '5px 9px', fontSize: 11, fontWeight: 600, border: '1px solid #bbf7d0' }}>
                    <ArrowTopRightOnSquareIcon style={{ width: 12, height: 12 }} /> Abrir
                  </a>
                )}
                <button onClick={() => handleEdit(doc)} title="Editar"
                  style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <PencilIcon style={{ width: 12, height: 12 }} /> Editar
                </button>
                <button onClick={() => handleDelete(doc.id)} disabled={deleting === doc.id} title="Excluir"
                  style={{ background: deleting === doc.id ? '#f9fafb' : '#fff1f2', color: deleting === doc.id ? '#9ca3af' : '#dc2626', border: `1px solid ${deleting === doc.id ? '#e5e7eb' : '#fecaca'}`, borderRadius: 7, padding: '5px 9px', cursor: deleting === doc.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <TrashIcon style={{ width: 12, height: 12 }} /> {deleting === doc.id ? '...' : 'Excluir'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Aviso legal */}
      <div style={{ marginTop: 20, padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', fontSize: 11, color: '#92400e' }}>
        <strong>⚖️ Nota legal:</strong> Cadastre apenas links oficiais e metadados. Não armazene nem redistribua arquivos protegidos por direitos autorais sem licença expressa do fabricante.
      </div>
    </div>
  )
}
