import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import {
  PlusIcon, PencilIcon, TrashIcon, XMarkIcon,
  ChevronUpIcon, ChevronDownIcon, DocumentDuplicateIcon,
  EyeIcon, EyeSlashIcon, CheckCircleIcon, Squares2X2Icon,
  SparklesIcon, PhotoIcon,
} from '@heroicons/react/24/outline'

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
const TIPO_OPCOES = [
  { value: 'transporte', label: 'Transporte' },
  { value: 'diario',     label: 'Diário (km)' },
  { value: 'despesa',    label: 'Despesa' },
  { value: 'custom',     label: 'Personalizado' },
]

const FIELD_TYPES = [
  { value: 'text',     label: 'Texto' },
  { value: 'number',   label: 'Número' },
  { value: 'date',     label: 'Data' },
  { value: 'select',   label: 'Seleção (lista)' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'checkbox', label: 'Sim/Não' },
]

const WIDTH_OPCOES = [
  { value: 'full', label: 'Largura total' },
  { value: 'half', label: 'Meia largura' },
]

const CAMPO_VAZIO = {
  key: '',
  label: '',
  type: 'text',
  required: false,
  section: '',
  ocr_hint: '',
  show_in_table: true,
  show_in_pdf: true,
  width: 'full',
  options: '', // Para campos tipo 'select': opções separadas por vírgula
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────
function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: editor de um campo
// ─────────────────────────────────────────────────────────────────────────────
function CampoEditor({ campo, idx, total, onChange, onRemove, onMove }) {
  return (
    <div style={{
      background: 'var(--bg-secondary, #1a2035)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Cabeçalho do campo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
          Campo {idx + 1}
          {campo.label && <span style={{ color: '#6366f1', marginLeft: 6 }}>— {campo.label}</span>}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => onMove(idx, -1)}
            disabled={idx === 0}
            title="Mover para cima"
            style={btnIconStyle(idx === 0)}
          >
            <ChevronUpIcon style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={() => onMove(idx, 1)}
            disabled={idx === total - 1}
            title="Mover para baixo"
            style={btnIconStyle(idx === total - 1)}
          >
            <ChevronDownIcon style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={() => onRemove(idx)}
            title="Remover campo"
            style={{ ...btnIconStyle(false), color: '#f87171' }}
          >
            <TrashIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Linha 1: label + key */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Label (exibição)</label>
          <input
            style={inputStyle}
            value={campo.label}
            placeholder="Ex: Empresa"
            onChange={e => {
              const newLabel = e.target.value
              onChange(idx, {
                ...campo,
                label: newLabel,
                key: campo.key || slugify(newLabel),
              })
            }}
          />
        </div>
        <div>
          <label style={labelStyle}>Chave interna (key)</label>
          <input
            style={inputStyle}
            value={campo.key}
            placeholder="Ex: empresa"
            onChange={e => onChange(idx, { ...campo, key: slugify(e.target.value) })}
          />
        </div>
      </div>

      {/* Linha 2: tipo + width + section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Tipo</label>
          <select style={inputStyle} value={campo.type} onChange={e => onChange(idx, { ...campo, type: e.target.value })}>
            {FIELD_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Largura</label>
          <select style={inputStyle} value={campo.width} onChange={e => onChange(idx, { ...campo, width: e.target.value })}>
            {WIDTH_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Seção</label>
          <input
            style={inputStyle}
            value={campo.section}
            placeholder="Ex: identificacao"
            onChange={e => onChange(idx, { ...campo, section: e.target.value })}
          />
        </div>
      </div>

      {/* Opções para select */}
      {campo.type === 'select' && (
        <div>
          <label style={labelStyle}>Opções (separadas por vírgula)</label>
          <input
            style={inputStyle}
            value={campo.options}
            placeholder="Ex: Sim, Não, Parcial"
            onChange={e => onChange(idx, { ...campo, options: e.target.value })}
          />
        </div>
      )}

      {/* Hint para OCR */}
      <div>
        <label style={labelStyle}>Hint para OCR (instrução para a IA reconhecer)</label>
        <input
          style={inputStyle}
          value={campo.ocr_hint}
          placeholder="Ex: razão social da empresa contratante"
          onChange={e => onChange(idx, { ...campo, ocr_hint: e.target.value })}
        />
      </div>

      {/* Checkboxes */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'required',      label: 'Obrigatório' },
          { key: 'show_in_table', label: 'Mostrar na tabela' },
          { key: 'show_in_pdf',   label: 'Mostrar no PDF' },
        ].map(({ key, label }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#cbd5e1' }}>
            <input
              type="checkbox"
              checked={!!campo[key]}
              onChange={e => onChange(idx, { ...campo, [key]: e.target.checked })}
              style={{ accentColor: '#6366f1', width: 14, height: 14 }}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de criação/edição de template
// ─────────────────────────────────────────────────────────────────────────────
function TemplateModal({ template, workspaceId, onClose, onSave }) {
  const [nome, setNome] = useState(template?.nome || '')
  const [tipoBase, setTipoBase] = useState(template?.tipo_base || 'transporte')
  const [campos, setCampos] = useState(
    template?.campos?.length ? template.campos : []
  )
  const [saving, setSaving] = useState(false)
  const [analisando, setAnalisando] = useState(false)

  async function handleAnalisarImagem(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem (JPEG, PNG ou WebP)'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Imagem muito grande (máx 10 MB)'); return }

    setAnalisando(true)
    const tid = toast.loading('Analisando formulário com IA...')
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const resp = await fetch('/api/analisar-form-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.detail || json.error || 'Erro desconhecido')

      setCampos(json.campos)
      toast.success(`${json.total} campo(s) identificados!`, { id: tid })
    } catch (err) {
      toast.error(`Falha na análise: ${err.message}`, { id: tid })
    } finally {
      setAnalisando(false)
      // Limpa o input para permitir reuso
      e.target.value = ''
    }
  }


  const handleCampoChange = useCallback((idx, updated) => {
    setCampos(prev => prev.map((c, i) => i === idx ? updated : c))
  }, [])

  const handleRemoveCampo = useCallback((idx) => {
    setCampos(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const handleMoveCampo = useCallback((idx, dir) => {
    setCampos(prev => {
      const arr = [...prev]
      const dest = idx + dir
      if (dest < 0 || dest >= arr.length) return arr
      ;[arr[idx], arr[dest]] = [arr[dest], arr[idx]]
      return arr
    })
  }, [])

  const handleAddCampo = () => {
    setCampos(prev => [...prev, { ...CAMPO_VAZIO }])
  }

  const validate = () => {
    if (!nome.trim()) { toast.error('Informe o nome do template'); return false }
    for (let i = 0; i < campos.length; i++) {
      if (!campos[i].key.trim()) { toast.error(`Campo ${i + 1}: informe a chave interna`); return false }
      if (!campos[i].label.trim()) { toast.error(`Campo ${i + 1}: informe o label`); return false }
      // chaves duplicadas
      const keys = campos.map(c => c.key)
      if (new Set(keys).size !== keys.length) { toast.error('Existem chaves internas duplicadas'); return false }
    }
    return true
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      // Normaliza opções de select: string → array
      const camposNormalizados = campos.map(c => ({
        ...c,
        options: c.type === 'select' && c.options
          ? c.options.split(',').map(o => o.trim()).filter(Boolean)
          : (Array.isArray(c.options) ? c.options : undefined),
      }))

      const payload = {
        workspace_id: workspaceId,
        nome: nome.trim(),
        tipo_base: tipoBase,
        campos: camposNormalizados,
        ativo: template?.ativo !== false,
      }

      let result
      if (template?.id) {
        result = await supabase.from('form_templates').update(payload).eq('id', template.id).select().single()
      } else {
        result = await supabase.from('form_templates').insert(payload).select().single()
      }

      if (result.error) throw result.error
      toast.success(template?.id ? 'Template atualizado!' : 'Template criado!')
      onSave(result.data)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-primary, #0f172a)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        width: '90%',
        maxWidth: 760,
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
            {template?.id ? 'Editar Template' : 'Novo Template de Formulário'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Nome + tipo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
            <div>
              <label style={labelStyle}>Nome do Template</label>
              <input
                style={inputStyle}
                value={nome}
                placeholder="Ex: Formulário Birigui - Transporte"
                onChange={e => setNome(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Tipo base</label>
              <select style={inputStyle} value={tipoBase} onChange={e => setTipoBase(e.target.value)}>
                {TIPO_OPCOES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Campos */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
                Campos ({campos.length})
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Botão Analisar Imagem */}
                <label
                  title="Envie uma foto do formulário físico e a IA detecta os campos automaticamente"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 13px', borderRadius: 8, cursor: analisando ? 'not-allowed' : 'pointer',
                    background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)',
                    color: '#a78bfa', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                    opacity: analisando ? 0.6 : 1,
                  }}
                >
                  {analisando
                    ? <><SparklesIcon style={{ width: 15, height: 15 }} /> Analisando...</>
                    : <><PhotoIcon style={{ width: 15, height: 15 }} /> Analisar Imagem</>
                  }
                  <input
                    type="file"
                    accept="image/*"
                    disabled={analisando}
                    onChange={handleAnalisarImagem}
                    style={{ display: 'none' }}
                  />
                </label>
                <button onClick={handleAddCampo} style={btnPrimaryStyle}>
                  <PlusIcon style={{ width: 15, height: 15 }} />
                  Adicionar Campo
                </button>
              </div>
            </div>

            {campos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569', fontSize: 14 }}>
                Nenhum campo definido. Clique em "Adicionar Campo" para começar.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {campos.map((campo, idx) => (
                  <CampoEditor
                    key={idx}
                    campo={campo}
                    idx={idx}
                    total={campos.length}
                    onChange={handleCampoChange}
                    onRemove={handleRemoveCampo}
                    onMove={handleMoveCampo}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={btnSecStyle}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimaryStyle, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : (template?.id ? 'Salvar alterações' : 'Criar Template')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de preview do template
// ─────────────────────────────────────────────────────────────────────────────
function PreviewModal({ template, onClose }) {
  const campos = template?.campos || []
  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-primary, #0f172a)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        width: '90%',
        maxWidth: 640,
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>
            Visualizar — {template.nome}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {campos.length === 0 ? (
            <p style={{ color: '#475569', textAlign: 'center' }}>Sem campos definidos.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {campos.map((c, i) => (
                <div key={i} style={{
                  gridColumn: c.width === 'full' ? 'span 2' : 'span 1',
                }}>
                  <label style={{ ...labelStyle, color: c.required ? '#f87171' : '#94a3b8' }}>
                    {c.label}{c.required && ' *'}
                  </label>
                  {c.type === 'textarea' ? (
                    <textarea disabled rows={2} placeholder={c.ocr_hint || '...'} style={{ ...inputStyle, resize: 'vertical' }} />
                  ) : c.type === 'select' ? (
                    <select disabled style={inputStyle}>
                      <option value="">Selecione...</option>
                      {(Array.isArray(c.options) ? c.options : (c.options || '').split(','))
                        .map(o => o.trim()).filter(Boolean)
                        .map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : c.type === 'checkbox' ? (
                    <div style={{ height: 38, display: 'flex', alignItems: 'center' }}>
                      <input type="checkbox" disabled style={{ accentColor: '#6366f1', width: 16, height: 16 }} />
                    </div>
                  ) : (
                    <input disabled type={c.type} placeholder={c.ocr_hint || '...'} style={inputStyle} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
export default function FormTemplates() {
  const workspaceId = useStore(s => s.workspaceId)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [previewing, setPreviewing] = useState(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('form_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    if (error) { toast.error('Erro ao carregar templates'); console.error(error) }
    setTemplates(data || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const handleNew = () => { setEditing(null); setModalOpen(true) }
  const handleEdit = (t) => { setEditing(t); setModalOpen(true) }

  const handleSave = (saved) => {
    setTemplates(prev => {
      const exists = prev.find(t => t.id === saved.id)
      return exists ? prev.map(t => t.id === saved.id ? saved : t) : [saved, ...prev]
    })
    setModalOpen(false)
    setEditing(null)
  }

  const handleToggleAtivo = async (t) => {
    const { error } = await supabase
      .from('form_templates')
      .update({ ativo: !t.ativo })
      .eq('id', t.id)
    if (error) { toast.error('Erro ao atualizar'); return }
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, ativo: !x.ativo } : x))
    toast.success(t.ativo ? 'Template desativado' : 'Template ativado')
  }

  const handleDelete = async (t) => {
    if (!window.confirm(`Excluir template "${t.nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('form_templates').delete().eq('id', t.id)
    if (error) { toast.error('Erro ao excluir'); return }
    setTemplates(prev => prev.filter(x => x.id !== t.id))
    toast.success('Template excluído')
  }

  const handleDuplicate = async (t) => {
    const { id, created_at, ...rest } = t
    const payload = { ...rest, nome: `${t.nome} (cópia)`, ativo: false }
    const { data, error } = await supabase.from('form_templates').insert(payload).select().single()
    if (error) { toast.error('Erro ao duplicar'); return }
    setTemplates(prev => [data, ...prev])
    toast.success('Template duplicado')
  }

  const filtered = templates.filter(t =>
    !search || t.nome.toLowerCase().includes(search.toLowerCase())
  )

  const tipoLabel = (v) => TIPO_OPCOES.find(t => t.value === v)?.label || v

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary, #0f172a)' }}>
      <Header title="Templates de Formulário" subtitle="Defina campos personalizados por cliente" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Barra de ações */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input
            style={{ ...inputStyle, maxWidth: 320 }}
            placeholder="Buscar template..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={handleNew} style={btnPrimaryStyle}>
            <PlusIcon style={{ width: 16, height: 16 }} />
            Novo Template
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#475569' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <Squares2X2Icon style={{ width: 48, height: 48, margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <p style={{ margin: 0 }}>Nenhum template encontrado.</p>
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>Crie o primeiro template para personalizar os formulários do cliente.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filtered.map(t => (
              <div key={t.id} style={{
                background: 'var(--bg-secondary, #1a2035)',
                border: `1px solid ${t.ativo ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 14,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                opacity: t.ativo ? 1 : 0.55,
              }}>
                {/* Header card */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.nome}
                    </div>
                    <div style={{ fontSize: 12, color: '#6366f1', marginTop: 3, fontWeight: 600 }}>
                      {tipoLabel(t.tipo_base)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {t.ativo
                      ? <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.15)', color: '#4ade80', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Ativo</span>
                      : <span style={{ fontSize: 11, background: 'rgba(148,163,184,0.1)', color: '#64748b', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Inativo</span>
                    }
                  </div>
                </div>

                {/* Campos count */}
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  {(t.campos || []).length} campo(s) definido(s)
                  {(t.campos || []).length > 0 && (
                    <span style={{ marginLeft: 8, color: '#475569' }}>
                      · {(t.campos || []).slice(0, 3).map(c => c.label).join(', ')}
                      {(t.campos || []).length > 3 ? '...' : ''}
                    </span>
                  )}
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginTop: 2 }}>
                  <button onClick={() => handleEdit(t)} style={btnSmallStyle} title="Editar">
                    <PencilIcon style={{ width: 14, height: 14 }} />
                    Editar
                  </button>
                  <button onClick={() => setPreviewing(t)} style={btnSmallStyle} title="Visualizar">
                    <EyeIcon style={{ width: 14, height: 14 }} />
                    Visualizar
                  </button>
                  <button onClick={() => handleDuplicate(t)} style={btnSmallStyle} title="Duplicar">
                    <DocumentDuplicateIcon style={{ width: 14, height: 14 }} />
                  </button>
                  <button onClick={() => handleToggleAtivo(t)} style={btnSmallStyle} title={t.ativo ? 'Desativar' : 'Ativar'}>
                    {t.ativo ? <EyeSlashIcon style={{ width: 14, height: 14 }} /> : <CheckCircleIcon style={{ width: 14, height: 14, color: '#4ade80' }} />}
                  </button>
                  <button onClick={() => handleDelete(t)} style={{ ...btnSmallStyle, marginLeft: 'auto', color: '#f87171' }} title="Excluir">
                    <TrashIcon style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <TemplateModal
          template={editing}
          workspaceId={workspaceId}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}

      {previewing && (
        <PreviewModal
          template={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Estilos compartilhados
// ─────────────────────────────────────────────────────────────────────────────
const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: 16,
}

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#f1f5f9',
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
}

const btnPrimaryStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: '#6366f1', color: '#fff',
  border: 'none', borderRadius: 8,
  padding: '8px 16px', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', flexShrink: 0,
}

const btnSecStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  padding: '8px 16px', fontSize: 14,
  cursor: 'pointer',
}

const btnSmallStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7,
  padding: '5px 10px', fontSize: 12,
  cursor: 'pointer',
}

const btnIconStyle = (disabled) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.05)', color: disabled ? '#334155' : '#94a3b8',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
  padding: 5, cursor: disabled ? 'default' : 'pointer',
})
