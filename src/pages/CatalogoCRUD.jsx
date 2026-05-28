import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon,
  ArrowPathIcon, CheckIcon, XMarkIcon, FunnelIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

// ── Constantes ─────────────────────────────────────────────────────────────────
const CLASSES = ['agricola', 'construcao', 'florestal']
const TIPOS_POR_CLASSE = {
  agricola:   ['trator', 'colhedora', 'pulverizador', 'plantadeira', 'implemento', 'outro'],
  construcao: ['moto-niveladora', 'pa-carregadeira', 'escavadeira', 'trator-esteira', 'compactador', 'outro'],
  florestal:  ['harvester', 'forwarder', 'skidder', 'feller-buncher', 'outro'],
}
const TRACOES = ['4x2', '4x4', 'AWD', 'esteira', '6x6', '8x8']
const TRANSMISSOES = ['manual', 'powershuttle', 'powershift', 'CVT', 'autopowr', 'autocommand', 'powercommand', 'dyna-4', 'dyna-6', 'dyna-vt', 'e23', 'hidrostática', 'torque-conv', 'elétrica', 'cmatic', 'multiformance', 'powrshift', 'outra']
const MERCADOS = ['BR', 'GLOBAL', 'LA', 'NA', 'EU']

const EMPTY_FORM = {
  fabricante: '', familia: '', modelo: '', configuracao: '', classe: 'agricola', tipo: 'trator',
  ano_inicio: new Date().getFullYear(), ano_fim: '',
  potencia_cv_min: '', potencia_cv_max: '', transmissao: '', tracao: '',
  motor_cilindros: '', motor_litros: '', mercado: 'BR', imagem_url: '',
}

// ── Helper ─────────────────────────────────────────────────────────────────────
function badge(label, color = '#6366f1') {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, background: color + '22',
      color, padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase',
    }}>{label}</span>
  )
}

// ── Formulário de modelo ───────────────────────────────────────────────────────
function ModeloForm({ initial, fabricantes, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.fabricante.trim() || !form.modelo.trim()) {
      toast.error('Fabricante e modelo são obrigatórios')
      return
    }
    setSaving(true)
    try {
      const payload = {
        fabricante:      form.fabricante.trim(),
        familia:         form.familia.trim() || null,
        modelo:          form.modelo.trim(),
        configuracao:    form.configuracao.trim() || null,
        classe:          form.classe,
        tipo:            form.tipo,
        ano_inicio:      Number(form.ano_inicio) || null,
        ano_fim:         form.ano_fim ? Number(form.ano_fim) : null,
        potencia_cv_min: form.potencia_cv_min !== '' ? Number(form.potencia_cv_min) : null,
        potencia_cv_max: form.potencia_cv_max !== '' ? Number(form.potencia_cv_max) : null,
        transmissao:     form.transmissao || null,
        tracao:          form.tracao || null,
        motor_cilindros: form.motor_cilindros !== '' ? Number(form.motor_cilindros) : null,
        motor_litros:    form.motor_litros !== '' ? Number(form.motor_litros) : null,
        mercado:         form.mercado || null,
        imagem_url:      form.imagem_url.trim() || null,
      }
      await onSave(payload)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
    borderRadius: 7, background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    fontSize: 13, boxSizing: 'border-box',
  }
  const selectStyle = { ...inputStyle }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }
  const colStyle = { display: 'flex', flexDirection: 'column', gap: 2 }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={colStyle}>
          <label style={labelStyle}>Fabricante *</label>
          <input list="fab-list" value={form.fabricante} onChange={e => set('fabricante', e.target.value)} style={inputStyle} placeholder="Ex: John Deere" />
          <datalist id="fab-list">
            {fabricantes.map(f => <option key={f} value={f} />)}
          </datalist>
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>Família / Série</label>
          <input value={form.familia} onChange={e => set('familia', e.target.value)} style={inputStyle} placeholder="Ex: Série 8R" />
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>Modelo *</label>
          <input value={form.modelo} onChange={e => set('modelo', e.target.value)} style={inputStyle} placeholder="Ex: 8370R" />
        </div>
      </div>

      {/* Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <div style={colStyle}>
          <label style={labelStyle}>Configuração</label>
          <input value={form.configuracao} onChange={e => set('configuracao', e.target.value)} style={inputStyle} placeholder="Ex: ILS, MFWD" />
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>Classe</label>
          <select value={form.classe} onChange={e => { set('classe', e.target.value); set('tipo', TIPOS_POR_CLASSE[e.target.value]?.[0] || '') }} style={selectStyle}>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>Tipo</label>
          <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={selectStyle}>
            {(TIPOS_POR_CLASSE[form.classe] || []).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>Mercado</label>
          <select value={form.mercado} onChange={e => set('mercado', e.target.value)} style={selectStyle}>
            {MERCADOS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Row 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <div style={colStyle}>
          <label style={labelStyle}>Ano Início</label>
          <input type="number" value={form.ano_inicio} onChange={e => set('ano_inicio', e.target.value)} style={inputStyle} placeholder="2020" min="1990" max="2030" />
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>Ano Fim</label>
          <input type="number" value={form.ano_fim} onChange={e => set('ano_fim', e.target.value)} style={inputStyle} placeholder="Em produção" min="1990" max="2035" />
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>CV Mín</label>
          <input type="number" value={form.potencia_cv_min} onChange={e => set('potencia_cv_min', e.target.value)} style={inputStyle} placeholder="140" />
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>CV Máx</label>
          <input type="number" value={form.potencia_cv_max} onChange={e => set('potencia_cv_max', e.target.value)} style={inputStyle} placeholder="160" />
        </div>
      </div>

      {/* Row 4 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <div style={colStyle}>
          <label style={labelStyle}>Transmissão</label>
          <select value={form.transmissao} onChange={e => set('transmissao', e.target.value)} style={selectStyle}>
            <option value="">— selecionar —</option>
            {TRANSMISSOES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>Tração</label>
          <select value={form.tracao} onChange={e => set('tracao', e.target.value)} style={selectStyle}>
            <option value="">— selecionar —</option>
            {TRACOES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>Cilindros</label>
          <input type="number" value={form.motor_cilindros} onChange={e => set('motor_cilindros', e.target.value)} style={inputStyle} placeholder="6" min="1" max="16" />
        </div>
        <div style={colStyle}>
          <label style={labelStyle}>Motor (litros)</label>
          <input type="number" step="0.1" value={form.motor_litros} onChange={e => set('motor_litros', e.target.value)} style={inputStyle} placeholder="9.0" />
        </div>
      </div>

      {/* Row 5 — imagem */}
      <div style={colStyle}>
        <label style={labelStyle}>URL da Imagem (opcional)</label>
        <input value={form.imagem_url} onChange={e => set('imagem_url', e.target.value)} style={inputStyle} placeholder="https://..." />
      </div>

      {/* Botões */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={{ padding: '8px 18px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving} style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Salvando…' : initial?.id ? 'Salvar Alterações' : 'Criar Modelo'}
        </button>
      </div>
    </form>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function CatalogoCRUD() {
  const [modelos, setModelos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterClasse, setFilterClasse] = useState('')
  const [filterFab, setFilterFab] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingModelo, setEditingModelo] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 30

  const fabricantes = [...new Set(modelos.map(m => m.fabricante))].sort()

  const loadModelos = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cat_modelos')
      .select('*')
      .order('fabricante')
      .order('familia')
      .order('modelo')
    if (error) { toast.error('Erro ao carregar catálogo'); setLoading(false); return }
    setModelos(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadModelos() }, [loadModelos])

  // Filtragem
  const filtered = modelos.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || [m.fabricante, m.familia, m.modelo, m.configuracao, m.tipo]
      .some(v => v?.toLowerCase().includes(q))
    const matchClasse = !filterClasse || m.classe === filterClasse
    const matchFab = !filterFab || m.fabricante === filterFab
    return matchSearch && matchClasse && matchFab
  })
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  // Reset page on filter change
  useEffect(() => setPage(0), [search, filterClasse, filterFab])

  // Cores por classe
  const classColor = { agricola: '#16a34a', construcao: '#f59e0b', florestal: '#0ea5e9' }

  async function handleSave(payload) {
    if (editingModelo?.id) {
      const { error } = await supabase.from('cat_modelos').update(payload).eq('id', editingModelo.id)
      if (error) { toast.error('Erro ao salvar: ' + error.message); return }
      toast.success('Modelo atualizado')
    } else {
      const { error } = await supabase.from('cat_modelos').insert([payload])
      if (error) { toast.error('Erro ao criar: ' + error.message); return }
      toast.success('Modelo criado')
    }
    setShowForm(false)
    setEditingModelo(null)
    loadModelos()
  }

  async function handleDelete(id) {
    if (!window.confirm('Tem certeza que deseja excluir este modelo? Isso pode afetar planos vinculados.')) return
    setDeletingId(id)
    const { error } = await supabase.from('cat_modelos').delete().eq('id', id)
    setDeletingId(null)
    if (error) { toast.error('Erro ao excluir: ' + error.message); return }
    toast.success('Modelo excluído')
    loadModelos()
  }

  function startEdit(m) {
    setEditingModelo(m)
    setShowForm(true)
  }

  function startNew() {
    setEditingModelo(null)
    setShowForm(true)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{modelos.length}</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total de modelos</span>
        </div>
        {CLASSES.map(c => (
          <div key={c} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: classColor[c] }}>
              {modelos.filter(m => m.classe === c).length}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{c}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={loadModelos} title="Recarregar" style={{ padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} /> Atualizar
          </button>
          <button onClick={startNew} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <PlusIcon style={{ width: 16, height: 16 }} /> Novo Modelo
          </button>
        </div>
      </div>

      {/* Modal / inline form */}
      {showForm && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {editingModelo?.id ? `Editar — ${editingModelo.fabricante} ${editingModelo.modelo}` : 'Novo Modelo'}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingModelo(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <XMarkIcon style={{ width: 20, height: 20 }} />
            </button>
          </div>
          <ModeloForm
            initial={editingModelo || {}}
            fabricantes={fabricantes}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingModelo(null) }}
          />
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <MagnifyingGlassIcon style={{ width: 16, height: 16, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar fabricante, família, modelo..."
            style={{ width: '100%', paddingLeft: 34, paddingRight: 10, paddingTop: 8, paddingBottom: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>
        <select value={filterClasse} onChange={e => setFilterClasse(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }}>
          <option value="">Todas as classes</option>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterFab} onChange={e => setFilterFab(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, maxWidth: 200 }}>
          <option value="">Todos os fabricantes</option>
          {fabricantes.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        {(search || filterClasse || filterFab) && (
          <button onClick={() => { setSearch(''); setFilterClasse(''); setFilterFab('') }} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, cursor: 'pointer', color: '#ef4444', fontSize: 12 }}>
            Limpar filtros
          </button>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabela */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando catálogo…</div>
        ) : paginated.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <CpuChipIcon style={{ width: 32, height: 32, margin: '0 auto 8px', opacity: 0.4 }} />
            <p style={{ margin: 0 }}>Nenhum modelo encontrado</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
                {['Fabricante', 'Família', 'Modelo', 'Config.', 'Classe / Tipo', 'Potência (CV)', 'Ano', 'Transmissão', 'Tração', 'Motor', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(m => (
                <tr
                  key={m.id}
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover,rgba(0,0,0,0.03))'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{m.fabricante}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{m.familia || '—'}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{m.modelo}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>{m.configuracao || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {badge(m.classe, classColor[m.classe] || '#6366f1')}
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{m.tipo}</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {m.potencia_cv_min && m.potencia_cv_max
                      ? `${m.potencia_cv_min}–${m.potencia_cv_max}`
                      : m.potencia_cv_min || m.potencia_cv_max || '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {m.ano_inicio}{m.ano_fim ? `–${m.ano_fim}` : '+'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>{m.transmissao || '—'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>{m.tracao || '—'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 11 }}>
                    {m.motor_cilindros ? `${m.motor_cilindros}cil` : ''}
                    {m.motor_cilindros && m.motor_litros ? ' · ' : ''}
                    {m.motor_litros ? `${m.motor_litros}L` : ''}
                    {!m.motor_cilindros && !m.motor_litros ? '—' : ''}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => startEdit(m)}
                        title="Editar"
                        style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 5, padding: '4px 7px', cursor: 'pointer', color: '#6366f1', display: 'flex', alignItems: 'center' }}
                      >
                        <PencilIcon style={{ width: 13, height: 13 }} />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        title="Excluir"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 5, padding: '4px 7px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', opacity: deletingId === m.id ? 0.5 : 1 }}
                      >
                        <TrashIcon style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '6px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 7, cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontSize: 13 }}>
            ← Anterior
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Página {page + 1} de {totalPages} — {filtered.length} modelos
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ padding: '6px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 7, cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page === totalPages - 1 ? 0.4 : 1, fontSize: 13 }}>
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
