import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import {
  PlusIcon, PencilIcon, TrashIcon, XMarkIcon,
  ArrowUpTrayIcon, ArrowDownTrayIcon, MagnifyingGlassIcon,
  CheckCircleIcon, XCircleIcon, BuildingOffice2Icon,
  UserIcon, TruckIcon, UsersIcon, WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'

// ─────────────────────────────────────────────────────────────────────────────
// Configuração das abas
// ─────────────────────────────────────────────────────────────────────────────
const TABS_CONFIG = {
  clientes: {
    label: 'Clientes',
    singular: 'Cliente',
    icon: BuildingOffice2Icon,
    table: 'cadastros_clientes',
    color: '#6366f1',
    fields: [
      { key: 'nome',        label: 'Nome',        required: true,  span: 2 },
      { key: 'razao_social',label: 'Razão Social', span: 2 },
      { key: 'cnpj',        label: 'CNPJ' },
      { key: 'contato',     label: 'Contato Geral' },
      { key: 'telefone',    label: 'Telefone' },
      { key: 'email',       label: 'E-mail', type: 'email' },
      { key: 'observacoes', label: 'Observações', span: 2, multiline: true },
      { key: '_sep1', divider: 'Aprovador Nível 1 — Lançamentos', span: 2 },
      { key: 'aprovador_n1_nome',  label: 'Nome' },
      { key: 'aprovador_n1_wa',    label: 'WhatsApp' },
      { key: 'aprovador_n1_email', label: 'E-mail', type: 'email' },
      { key: '_sep2', divider: 'Aprovador Nível 2 — Faturamento', span: 2 },
      { key: 'aprovador_n2_nome',  label: 'Nome' },
      { key: 'aprovador_n2_wa',    label: 'WhatsApp' },
      { key: 'aprovador_n2_email', label: 'E-mail', type: 'email' },
      { key: '_sep3', divider: 'Aprovador Nível 3 — Financeiro', span: 2 },
      { key: 'aprovador_n3_nome',  label: 'Nome' },
      { key: 'aprovador_n3_wa',    label: 'WhatsApp' },
      { key: 'aprovador_n3_email', label: 'E-mail', type: 'email' },
    ],
    importCols: ['nome','razao_social','cnpj','contato','telefone','email','observacoes'],
  },
  fornecedores: {
    label: 'Fornecedores',
    singular: 'Fornecedor',
    icon: BuildingOffice2Icon,
    table: 'cadastros_fornecedores',
    color: '#f59e0b',
    fields: [
      { key: 'nome',        label: 'Nome',        required: true,  span: 2 },
      { key: 'razao_social',label: 'Razão Social', span: 2, listHide: true },
      { key: 'cnpj',        label: 'CNPJ' },
      { key: 'categoria',   label: 'Categoria' },
      { key: 'contato',     label: 'Contato' },
      { key: 'telefone',    label: 'Telefone' },
      { key: 'email',       label: 'E-mail', type: 'email' },
      { key: 'observacoes', label: 'Observações', span: 2, multiline: true },
    ],
    importCols: ['nome','razao_social','cnpj','categoria','contato','telefone','email','observacoes'],
  },
  solicitantes: {
    label: 'Solicitantes',
    singular: 'Solicitante',
    icon: UsersIcon,
    table: 'cadastros_solicitantes',
    color: '#10b981',
    fields: [
      { key: 'nome',       label: 'Nome',    required: true, span: 2 },
      { key: 'setor',      label: 'Setor' },
      { key: 'telefone',   label: 'Telefone' },
      { key: 'email',      label: 'E-mail', type: 'email' },
      { key: 'observacoes',label: 'Observações', span: 2, multiline: true },
    ],
    importCols: ['nome','setor','telefone','email','observacoes'],
  },
  condutores: {
    label: 'Condutores',
    singular: 'Condutor',
    icon: TruckIcon,
    table: 'cadastros_condutores',
    color: '#3b82f6',
    fields: [
      { key: 'nome',           label: 'Nome',          required: true, span: 2 },
      { key: 'cpf',            label: 'CPF' },
      { key: 'telefone',       label: 'Telefone' },
      { key: 'cnh',            label: 'Nº CNH' },
      { key: 'categoria_cnh',  label: 'Categoria CNH', placeholder: 'A, B, C, D, E' },
      { key: 'placa_vinculada',label: 'Placa Vinculada' },
      { key: 'email',          label: 'E-mail', type: 'email' },
      { key: 'observacoes',    label: 'Observações', span: 2, multiline: true },
    ],
    importCols: ['nome','cpf','cnh','categoria_cnh','placa_vinculada','telefone','email','observacoes'],
  },
}

const inputStyle = {
  padding: '8px 10px', borderRadius: 7,
  background: 'var(--bg-primary)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
  width: '100%', boxSizing: 'border-box',
}
const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 0.5,
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal add/editar
// ─────────────────────────────────────────────────────────────────────────────
function CadastroModal({ config, item, ownerId, onClose, onSave }) {
  const emptyForm = () => Object.fromEntries(config.fields.filter(f => !f.divider).map(f => [f.key, '']))
  const [form, setForm] = useState(item ? { ...item } : emptyForm())
  const [saving, setSaving] = useState(false)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSave() {
    const req = config.fields.filter(f => f.required && !f.divider)
    for (const f of req) {
      if (!form[f.key]?.trim()) { toast.error(`Campo "${f.label}" é obrigatório`); return }
    }
    setSaving(true)
    const payload = { ...form, owner_id: ownerId }
    let error
    if (item?.id) {
      ;({ error } = await supabase.from(config.table).update(payload).eq('id', item.id))
    } else {
      ;({ error } = await supabase.from(config.table).insert(payload))
    }
    setSaving(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    toast.success(item ? 'Registro atualizado!' : 'Cadastro criado!')
    onSave()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560, width: '95vw' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>
            {item ? 'Editar' : 'Novo'} {config.label.slice(0, -1)}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <XMarkIcon style={{ width: 20 }} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {config.fields.map(f => (
            f.divider ? (
              <div key={f.key} style={{ gridColumn: 'span 2', margin: '8px 0 4px', paddingBottom: 6, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.8 }}>{f.divider}</span>
              </div>
            ) : (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: f.span === 2 ? 'span 2' : 'span 1' }}>
              <label style={labelStyle}>{f.label}{f.required ? ' *' : ''}</label>
              {f.multiline ? (
                <textarea
                  value={form[f.key] ?? ''}
                  onChange={e => set(f.key, e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              ) : (
                <input
                  type={f.type || 'text'}
                  value={form[f.key] ?? ''}
                  placeholder={f.placeholder || ''}
                  onChange={e => set(f.key, e.target.value)}
                  style={inputStyle}
                />
              )}
            </div>
            )
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, background: config.color, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Aba genérica (lista + busca + ações)
// ─────────────────────────────────────────────────────────────────────────────
function CadastroTab({ tipo, config, ownerId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [colFilters, setColFilters] = useState({})
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [catFiltro, setCatFiltro] = useState('')
  const [sortKey, setSortKey] = useState('nome')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [editing, setEditing] = useState(null)  // null = fechado, {} = novo, objeto = editar
  const [showModal, setShowModal] = useState(false)
  const [importando, setImportando] = useState(false)
  const fileRef = useRef()

  useEffect(() => { load() }, [tipo, ownerId])

  async function load() {
    if (!supabase || !ownerId) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from(config.table)
      .select('*')
      .eq('owner_id', ownerId)
      .order('nome')
    setItems(data || [])
    setLoading(false)
    if (error) toast.error('Erro ao carregar: ' + error.message)
  }

  async function toggleAtivo(item) {
    const { error } = await supabase
      .from(config.table)
      .update({ ativo: !item.ativo })
      .eq('id', item.id)
    if (error) { toast.error('Erro: ' + error.message); return }
    setItems(it => it.map(i => i.id === item.id ? { ...i, ativo: !i.ativo } : i))
  }

  async function handleDelete(item) {
    if (!confirm(`Excluir "${item.nome}"?`)) return
    const { error } = await supabase.from(config.table).delete().eq('id', item.id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Excluído!')
    setItems(it => it.filter(i => i.id !== item.id))
  }

  // ── Download modelo XLSX ───────────────────────────────────────────────────
  function baixarModelo() {
    const headers = config.importCols.map(c => {
      const f = config.fields.find(ff => ff.key === c)
      return f ? f.label : c
    })
    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      config.importCols.map(() => ''),  // linha de exemplo vazia
    ])
    // Estilo mínimo: largura das colunas
    ws['!cols'] = headers.map(() => ({ wch: 22 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, config.label)
    XLSX.writeFile(wb, `modelo_${tipo}.xlsx`)
    toast.success('Modelo baixado!')
  }

  // ── Importar XLSX/CSV ──────────────────────────────────────────────────────
  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportando(true)

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (rows.length < 2) { toast.error('Planilha vazia ou sem dados.'); setImportando(false); return }

      // Mapeia cabeçalho da planilha para keys do config
      const header = rows[0].map(h => String(h || '').trim().toLowerCase())
      const labelToKey = {}
      config.fields.forEach(f => { labelToKey[f.label.toLowerCase()] = f.key; labelToKey[f.key.toLowerCase()] = f.key })

      const colMap = header.map(h => labelToKey[h] || null)
      const nomeIdx = colMap.findIndex(k => k === 'nome')
      if (nomeIdx === -1) { toast.error('Coluna "Nome" não encontrada na planilha.'); setImportando(false); return }

      const records = []
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const nome = String(row[nomeIdx] || '').trim()
        if (!nome) continue
        const rec = { owner_id: ownerId }
        colMap.forEach((key, ci) => { if (key) rec[key] = String(row[ci] || '').trim() })
        records.push(rec)
      }

      if (!records.length) { toast.error('Nenhum registro válido encontrado.'); setImportando(false); return }

      const { error } = await supabase.from(config.table).insert(records)
      if (error) { toast.error('Erro na importação: ' + error.message); setImportando(false); return }

      toast.success(`${records.length} registro(s) importado(s)!`)
      load()
    } catch (err) {
      toast.error('Erro ao ler arquivo: ' + err.message)
    }
    setImportando(false)
  }

  // Colunas visíveis na listagem (até 5 campos, exceto multiline e divider)
  const listCols = config.fields.filter(f => !f.multiline && !f.divider && !f.listHide).slice(0, 5)

  // Categorias únicas (para chips de filtro rápido)
  const categorias = useMemo(() => {
    if (!config.fields.find(f => f.key === 'categoria')) return []
    return [...new Set(items.map(i => i.categoria).filter(Boolean))].sort()
  }, [items, config])

  // Itens filtrados + ordenados
  const filtered = useMemo(() => {
    return items.filter(item => {
      if (busca) {
        const q = busca.toLowerCase()
        const str = listCols.map(f => String(item[f.key] || '')).join(' ').toLowerCase()
        if (!str.includes(q)) return false
      }
      if (statusFiltro === 'ativo' && item.ativo === false) return false
      if (statusFiltro === 'inativo' && item.ativo !== false) return false
      if (catFiltro && item.categoria !== catFiltro) return false
      for (const [k, v] of Object.entries(colFilters)) {
        if (v && !String(item[k] || '').toLowerCase().includes(v.toLowerCase())) return false
      }
      return true
    }).sort((a, b) => {
      const av = String(a[sortKey] || '').toLowerCase()
      const bv = String(b[sortKey] || '').toLowerCase()
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [items, busca, statusFiltro, catFiltro, colFilters, sortKey, sortDir, listCols])

  const totalPages = Math.ceil(filtered.length / perPage) || 1
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)
  const hasColFilters = Object.values(colFilters).some(v => v)

  // Paleta light-theme
  const C = {
    bg: '#f4f6fa', card: '#fff', secondary: '#f0f2f8', hover: '#f7f8fd',
    border: '#e2e6f0', borderStrong: '#d0d5e8',
    txtPrimary: '#1a1f36', txtSecondary: '#4a5580', txtMuted: '#9aa3bf',
    green: '#059669', greenBg: '#ecfdf5', greenBorder: '#6ee7b733',
    red: '#dc2626', redBg: '#fef2f2', redBorder: '#fca5a533',
    blue: '#2563eb', blueBg: '#eff6ff',
    accent: config.color,
  }
  const btnGhost = {
    display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
    borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
    background: '#fff', border: `1px solid ${C.border}`, color: C.txtSecondary,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)', whiteSpace: 'nowrap',
  }
  const btnPrimary = {
    display: 'flex', alignItems: 'center', gap: 5, padding: '7px 15px',
    borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    background: C.accent, border: 'none', color: '#fff',
    boxShadow: `0 1px 3px ${C.accent}55`, whiteSpace: 'nowrap',
  }
  const inputLight = {
    background: '#fff', border: `1px solid ${C.border}`, color: C.txtPrimary,
    borderRadius: 7, padding: '7px 10px', fontSize: 13, outline: 'none',
    width: '100%', boxSizing: 'border-box',
  }

  function exportarXLSX() {
    const headers = listCols.map(c => c.label).concat(['Status'])
    const rows = filtered.map(item => [
      ...listCols.map(c => String(item[c.key] || '')),
      item.ativo !== false ? 'Ativo' : 'Inativo',
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = headers.map(() => ({ wch: 22 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, config.label)
    XLSX.writeFile(wb, `${tipo}_${new Date().toISOString().slice(0,10)}.xlsx`)
    toast.success(`${filtered.length} registro(s) exportado(s)!`)
  }

  return (
    <div style={{ padding: '0 24px 28px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, color: C.txtMuted }} />
          <input
            value={busca}
            onChange={e => { setBusca(e.target.value); setPage(1) }}
            placeholder={`Buscar em ${config.label.toLowerCase()}...`}
            style={{ ...inputLight, paddingLeft: 34 }}
          />
        </div>
        <button onClick={baixarModelo} style={btnGhost}>
          <ArrowDownTrayIcon style={{ width: 15 }} /> Modelo
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={importando}
          style={{ ...btnGhost, color: '#d97706', borderColor: '#fde68a', background: '#fffbeb' }}>
          <ArrowUpTrayIcon style={{ width: 15 }} />
          {importando ? 'Importando...' : 'Importar'}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
        <button onClick={exportarXLSX} style={btnGhost}>
          <ArrowDownTrayIcon style={{ width: 15 }} /> Exportar
        </button>
        <button onClick={() => { setEditing({}); setShowModal(true) }} style={btnPrimary}>
          <PlusIcon style={{ width: 15 }} /> Novo {config.singular || config.label.replace(/es$/, '').replace(/s$/, '')}
        </button>
      </div>

      {/* Filtros rápidos (chips) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: C.txtMuted, marginRight: 2 }}>Filtrar:</span>
        {[
          { key: 'todos', label: `Todos (${items.length})` },
          { key: 'ativo', label: `Ativos (${items.filter(i => i.ativo !== false).length})` },
          { key: 'inativo', label: `Inativos (${items.filter(i => i.ativo === false).length})` },
        ].map(chip => (
          <button key={chip.key} onClick={() => { setStatusFiltro(chip.key); setPage(1) }}
            style={{
              padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', border: `1px solid ${statusFiltro === chip.key ? C.accent + '55' : C.border}`,
              color: statusFiltro === chip.key ? C.accent : C.txtSecondary,
              background: statusFiltro === chip.key ? C.accent + '12' : '#fff',
            }}>
            {chip.label}
          </button>
        ))}
        {categorias.map(cat => (
          <button key={cat} onClick={() => { setCatFiltro(catFiltro === cat ? '' : cat); setPage(1) }}
            style={{
              padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', border: `1px solid ${catFiltro === cat ? C.blue + '55' : C.border}`,
              color: catFiltro === cat ? C.blue : C.txtSecondary,
              background: catFiltro === cat ? C.blueBg : '#fff',
            }}>
            {cat}
          </button>
        ))}
        {hasColFilters && (
          <button onClick={() => setColFilters({})}
            style={{ padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1px solid ${C.redBorder}`, color: C.red, background: C.redBg }}>
            ✕ Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.txtMuted }}>Carregando...</div>
      ) : (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {/* Info bar */}
          <div style={{ padding: '7px 14px', borderBottom: `1px solid ${C.border}`, background: C.secondary, display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: C.txtMuted }}>
            <span>
              <strong style={{ color: C.txtSecondary }}>{Math.min((page - 1) * perPage + 1, Math.max(filtered.length, 1))}–{Math.min(page * perPage, filtered.length)}</strong> de <strong style={{ color: C.txtSecondary }}>{filtered.length}</strong> registros
            </span>
            <span style={{ color: C.green }}>· {items.filter(i => i.ativo !== false).length} ativos</span>
            {items.filter(i => i.ativo === false).length > 0 &&
              <span>· {items.filter(i => i.ativo === false).length} inativos</span>
            }
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                {/* Cabeçalho clicável para ordenação */}
                <tr style={{ background: C.secondary }}>
                  <th style={{ width: 20, padding: '9px 10px 9px 14px', borderBottom: `1px solid ${C.border}` }}></th>
                  {listCols.map(col => (
                    <th key={col.key}
                      onClick={() => { setSortKey(col.key); setSortDir(sortKey === col.key && sortDir === 'asc' ? 'desc' : 'asc') }}
                      style={{
                        padding: '9px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700,
                        color: sortKey === col.key ? C.accent : C.txtMuted,
                        textTransform: 'uppercase', letterSpacing: 0.6,
                        borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                        cursor: 'pointer', userSelect: 'none',
                      }}>
                      {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                  ))}
                  <th style={{ padding: '9px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 10.5, fontWeight: 700, color: C.txtMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Status</th>
                  <th style={{ padding: '9px 12px', borderBottom: `1px solid ${C.border}`, textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: C.txtMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Ações</th>
                </tr>
                {/* Linha de filtros por coluna */}
                <tr style={{ background: '#fafbff', borderBottom: `2px solid ${C.borderStrong}` }}>
                  <td style={{ padding: '4px 10px 4px 14px' }}></td>
                  {listCols.map(col => (
                    <td key={col.key} style={{ padding: '4px 8px' }}>
                      <input
                        value={colFilters[col.key] || ''}
                        onChange={e => { setColFilters(f => ({ ...f, [col.key]: e.target.value })); setPage(1) }}
                        placeholder="filtrar..."
                        style={{ width: '100%', background: '#fff', border: `1px solid ${C.border}`, color: C.txtPrimary, borderRadius: 5, padding: '3px 7px', fontSize: 11, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </td>
                  ))}
                  <td style={{ padding: '4px 8px' }}>
                    <select
                      value={colFilters.__status || ''}
                      onChange={e => { setColFilters(f => ({ ...f, __status: e.target.value })); setPage(1) }}
                      style={{ width: '100%', background: '#fff', border: `1px solid ${C.border}`, color: C.txtSecondary, borderRadius: 5, padding: '3px 6px', fontSize: 11, outline: 'none' }}>
                      <option value="">todos</option>
                      <option value="ativo">ativo</option>
                      <option value="inativo">inativo</option>
                    </select>
                  </td>
                  <td style={{ padding: '4px 8px' }}></td>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={listCols.length + 3} style={{ textAlign: 'center', padding: 40, color: C.txtMuted, fontSize: 13 }}>
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : paginated.map(item => (
                  <tr key={item.id}
                    style={{ borderBottom: `1px solid ${C.border}`, opacity: item.ativo === false ? 0.55 : 1, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.hover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {/* Bolinha indicadora */}
                    <td style={{ padding: '9px 10px 9px 14px' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: item.ativo !== false ? C.green : C.borderStrong }} />
                    </td>
                    {listCols.map((col, ci) => (
                      <td key={col.key} style={{
                        padding: '9px 12px', fontSize: 13, maxWidth: 200,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: ci === 0 ? C.txtPrimary : C.txtSecondary,
                        fontWeight: ci === 0 ? 600 : 400,
                        fontFamily: ['cnpj', 'cpf', 'cnh'].includes(col.key) ? 'monospace' : 'inherit',
                        fontSize: ['cnpj', 'cpf', 'cnh'].includes(col.key) ? 12 : 13,
                      }}>
                        {col.key === 'categoria' && item[col.key] ? (
                          <span style={{
                            display: 'inline-flex', padding: '2px 8px', borderRadius: 20,
                            fontSize: 11, fontWeight: 600, background: C.blueBg, color: C.blue,
                            border: `1px solid ${C.blue}33`,
                          }}>
                            {item[col.key]}
                          </span>
                        ) : (
                          item[col.key] || <span style={{ color: C.txtMuted }}>—</span>
                        )}
                      </td>
                    ))}
                    {/* Badge de status */}
                    <td style={{ padding: '9px 12px' }}>
                      {item.ativo !== false ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
                          borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.green }} />
                          Ativo
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
                          borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.red }} />
                          Inativo
                        </span>
                      )}
                    </td>
                    {/* Ações */}
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <button onClick={() => toggleAtivo(item)} title={item.ativo !== false ? 'Inativar' : 'Ativar'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 5, display: 'flex', alignItems: 'center' }}>
                          {item.ativo !== false
                            ? <CheckCircleIcon style={{ width: 15, color: C.green }} />
                            : <XCircleIcon style={{ width: 15, color: C.txtMuted }} />}
                        </button>
                        <button onClick={() => { setEditing(item); setShowModal(true) }} title="Editar"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 5, display: 'flex', alignItems: 'center' }}>
                          <PencilIcon style={{ width: 15, color: C.txtMuted }} />
                        </button>
                        <button onClick={() => handleDelete(item)} title="Excluir"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 5, display: 'flex', alignItems: 'center' }}>
                          <TrashIcon style={{ width: 15, color: '#fca5a5' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{ padding: '9px 14px', borderTop: `1px solid ${C.border}`, background: C.secondary, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, color: C.txtMuted, marginRight: 2 }}>Por página:</span>
              <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}
                style={{ background: '#fff', border: `1px solid ${C.border}`, color: C.txtSecondary, borderRadius: 6, padding: '3px 7px', fontSize: 12, outline: 'none' }}>
                {[25, 50, 100].map(n => <option key={n}>{n}</option>)}
              </select>
              <span style={{ fontSize: 11.5, color: C.txtMuted, flex: 1, marginLeft: 6 }}>
                {Math.min((page - 1) * perPage + 1, filtered.length)}–{Math.min(page * perPage, filtered.length)} de {filtered.length}
              </span>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                style={{ background: '#fff', border: `1px solid ${C.border}`, color: C.txtSecondary, borderRadius: 6, padding: '4px 10px', cursor: page === 1 ? 'default' : 'pointer', fontSize: 12, opacity: page === 1 ? 0.35 : 1 }}>
                ‹ Ant.
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  style={{ background: page === n ? C.accent : '#fff', border: `1px solid ${page === n ? C.accent : C.border}`, color: page === n ? '#fff' : C.txtSecondary, borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: 12, fontWeight: page === n ? 700 : 400, minWidth: 30 }}>
                  {n}
                </button>
              ))}
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                style={{ background: '#fff', border: `1px solid ${C.border}`, color: C.txtSecondary, borderRadius: 6, padding: '4px 10px', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 12, opacity: page === totalPages ? 0.35 : 1 }}>
                Próx. ›
              </button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <CadastroModal
          config={config}
          item={editing && editing.id ? editing : null}
          ownerId={ownerId}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={() => { setShowModal(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// Aba Máquinas — cadastro da hierarquia: Classe → Modelo → Equipamento + Frentes
// ─────────────────────────────────────────────────────────────────────────────

const MAQ_SUBTABS = [
  { key: 'classes',       label: 'Classes',          color: '#8b5cf6' },
  { key: 'modelos',       label: 'Modelos',          color: '#3b82f6' },
  { key: 'equipamentos',  label: 'Equipamentos',     color: '#10b981' },
  { key: 'frentes',       label: 'Frentes',          color: '#f59e0b' },
  { key: 'colaboradores', label: 'Colaboradores',    color: '#ec4899' },
  { key: 'boletim_tipos', label: 'Tipos de Boletim', color: '#6366f1' },
]

function MaqModal({ subtab, item, workspaceId, classes, modelos, frentes, boletimTipos, onClose, onSave }) {
  const [nome,          setNome]          = useState(item?.nome           || '')
  const [codigo,        setCodigo]        = useState(item?.codigo         || '')
  const [classeId,      setClasseId]      = useState(item?.classe_id      || '')
  const [modeloId,      setModeloId]      = useState(item?.modelo_id      || '')
  const [matricula,     setMatricula]     = useState(item?.matricula      || '')
  const [telefoneWa,    setTelefoneWa]    = useState(item?.telefone_wa    || '')
  const [frenteId,      setFrenteId]      = useState(item?.frente_id      || '')
  const [descricao,     setDescricao]     = useState(item?.descricao      || '')
  const [boletimTipoId, setBoletimTipoId] = useState(item?.boletim_tipo_id || '')
  const [imagemFile,    setImagemFile]    = useState(null)
  const [saving,        setSaving]        = useState(false)

  const modelosFiltrados = classeId
    ? modelos.filter(m => m.classe_id === classeId)
    : modelos

  async function handleSave() {
    let payload = {}
    let table   = ''
    if (subtab === 'classes') {
      if (!nome.trim()) { toast.error('Informe o nome da classe'); return }
      table   = 'maquinas_classes'
      payload = { workspace_id: workspaceId, nome: nome.trim() }
    } else if (subtab === 'modelos') {
      if (!nome.trim())    { toast.error('Informe o nome do modelo'); return }
      if (!classeId)       { toast.error('Selecione a Classe Operacional'); return }
      table   = 'maquinas_modelos'
      payload = { workspace_id: workspaceId, nome: nome.trim(), classe_id: classeId }
    } else if (subtab === 'equipamentos') {
      if (!codigo.trim())  { toast.error('Informe o Código / Matrícula'); return }
      if (!modeloId)       { toast.error('Selecione o Modelo'); return }
      table   = 'maquinas_equipamentos'
      payload = { workspace_id: workspaceId, codigo: codigo.trim().toUpperCase(), nome: nome.trim() || null, modelo_id: modeloId }
    } else if (subtab === 'frentes') {
      if (!nome.trim()) { toast.error('Informe o nome da frente'); return }
      table   = 'maquinas_frentes'
      payload = { workspace_id: workspaceId, nome: nome.trim(), boletim_tipo_id: boletimTipoId || null }
    } else if (subtab === 'colaboradores') {
      if (!nome.trim()) { toast.error('Informe o nome do colaborador'); return }
      table   = 'maquinas_colaboradores'
      payload = { workspace_id: workspaceId, nome: nome.trim(), matricula: matricula.trim() || null, telefone_wa: telefoneWa.replace(/\D/g, '') || null, frente_id: frenteId || null }
    } else if (subtab === 'boletim_tipos') {
      if (!nome.trim()) { toast.error('Informe o nome do tipo de boletim'); return }
      let imagemUrl = item?.imagem_url || null
      if (imagemFile) {
        setSaving(true)
        const ext  = imagemFile.name.split('.').pop()
        const path = `templates/${workspaceId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('maquinas').upload(path, imagemFile, { upsert: true })
        if (upErr) { toast.error('Erro ao enviar imagem: ' + upErr.message); setSaving(false); return }
        const { data: { publicUrl } } = supabase.storage.from('maquinas').getPublicUrl(path)
        imagemUrl = publicUrl
      }
      table   = 'maquinas_boletim_tipos'
      payload = { workspace_id: workspaceId, nome: nome.trim(), descricao: descricao.trim() || null, imagem_url: imagemUrl }
    }

    setSaving(true)
    let error
    if (item?.id) {
      ;({ error } = await supabase.from(table).update(payload).eq('id', item.id))
    } else {
      ;({ error } = await supabase.from(table).insert(payload))
    }
    setSaving(false)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success(item?.id ? 'Atualizado!' : 'Cadastrado!')
    onSave()
  }

  const cfg = MAQ_SUBTABS.find(s => s.key === subtab)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480, width: '95vw' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>
            {item?.id ? 'Editar' : 'Novo'} — {cfg?.label}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <XMarkIcon style={{ width: 20 }} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Classe select — para modelos */}
          {subtab === 'modelos' && (
            <div>
              <label style={labelStyle}>Classe Operacional *</label>
              <select value={classeId} onChange={e => setClasseId(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                <option value="">— Selecione —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}

          {/* Classe + Modelo select — para equipamentos */}
          {subtab === 'equipamentos' && (
            <>
              <div>
                <label style={labelStyle}>Classe Operacional</label>
                <select value={classeId} onChange={e => { setClasseId(e.target.value); setModeloId('') }} style={{ ...inputStyle, marginTop: 4 }}>
                  <option value="">— Todas as classes —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Modelo *</label>
                <select value={modeloId} onChange={e => setModeloId(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                  <option value="">— Selecione o Modelo —</option>
                  {modelosFiltrados.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Código — apenas equipamentos */}
          {subtab === 'equipamentos' && (
            <div>
              <label style={labelStyle}>Código / Matrícula *</label>
              <input style={{ ...inputStyle, marginTop: 4 }} placeholder="EH-03" value={codigo} onChange={e => setCodigo(e.target.value)} />
            </div>
          )}

          {/* Nome — para todos exceto boletim_tipos */}
          {subtab !== 'boletim_tipos' && (
            <div>
              <label style={labelStyle}>
                {subtab === 'equipamentos' ? 'Nome / Apelido (opcional)' : 'Nome *'}
              </label>
              <input
                style={{ ...inputStyle, marginTop: 4 }}
                placeholder={
                  subtab === 'classes'       ? 'Escavadeira Hidráulica' :
                  subtab === 'modelos'       ? 'CAT 320D' :
                  subtab === 'equipamentos'  ? 'Nome adicional...' :
                  subtab === 'frentes'       ? 'Frente Norte' :
                  subtab === 'colaboradores' ? 'João Ferreira' :
                  ''
                }
                value={nome}
                onChange={e => setNome(e.target.value)}
              />
            </div>
          )}

          {/* ── FRENTES: tipo de boletim vinculado ── */}
          {subtab === 'frentes' && (
            <div>
              <label style={labelStyle}>Tipo de Boletim</label>
              <select value={boletimTipoId} onChange={e => setBoletimTipoId(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                <option value="">— Nenhum vinculado —</option>
                {boletimTipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                Define qual template de boletim esta frente utiliza
              </div>
            </div>
          )}

          {/* ── COLABORADORES: matrícula, telefone WA, frente ── */}
          {subtab === 'colaboradores' && (
            <>
              <div>
                <label style={labelStyle}>Matrícula</label>
                <input style={{ ...inputStyle, marginTop: 4 }} placeholder="0042" value={matricula} onChange={e => setMatricula(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Telefone WhatsApp</label>
                <input
                  style={{ ...inputStyle, marginTop: 4 }}
                  placeholder="5511992345678 (somente números)"
                  value={telefoneWa}
                  onChange={e => setTelefoneWa(e.target.value)}
                />
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Usado para identificar o colaborador quando enviar a foto do boletim
                </div>
              </div>
              <div>
                <label style={labelStyle}>Frente padrão</label>
                <select value={frenteId} onChange={e => setFrenteId(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
                  <option value="">— Sem frente definida —</option>
                  {frentes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            </>
          )}

          {/* ── BOLETIM TIPOS: nome, descrição, imagem template ── */}
          {subtab === 'boletim_tipos' && (
            <>
              <div>
                <label style={labelStyle}>Nome do Tipo *</label>
                <input
                  style={{ ...inputStyle, marginTop: 4 }}
                  placeholder="Boletim Padrão v1"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Descrição</label>
                <input
                  style={{ ...inputStyle, marginTop: 4 }}
                  placeholder="Formulário usado nas frentes Norte e Sul"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Imagem do boletim em branco (template)</label>
                <div style={{ marginTop: 6 }}>
                  {item?.imagem_url && !imagemFile && (
                    <div style={{ marginBottom: 8 }}>
                      <img src={item.imagem_url} alt="Template atual" style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain' }} />
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Template atual — envie uma nova imagem para substituir</div>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setImagemFile(e.target.files[0] || null)}
                    style={{ fontSize: 13, color: 'var(--text-primary)' }}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                  📋 Após salvar, use "Analisar Template" para o sistema identificar os campos automaticamente
                </div>
              </div>
              {item?.campos_json && (
                <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, color: '#6366f1' }}>✅ Template analisado — {Object.keys(item.campos_json).length} campos mapeados</div>
                  {Object.entries(item.campos_json).map(([k, v]) => (
                    <div key={k} style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{k}</span>: {v.label} ({v.tipo})
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, background: cfg?.color || '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MaquinasTab({ workspaceId }) {
  const [subAba,        setSubAba]        = useState('classes')
  const [classes,       setClasses]       = useState([])
  const [modelos,       setModelos]       = useState([])
  const [equipamentos,  setEquipamentos]  = useState([])
  const [frentes,       setFrentes]       = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [boletimTipos,  setBoletimTipos]  = useState([])
  const [loading,       setLoading]       = useState(true)
  const [busca,         setBusca]         = useState('')
  const [modal,         setModal]         = useState(null)  // null | { subtab, item? }
  const [analisando,    setAnalisando]    = useState(null)  // id do tipo sendo analisado

  async function analisarTemplate(tipo) {
    if (analisando) return
    setAnalisando(tipo.id)
    try {
      const res = await fetch('/api/analisar-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boletimTipoId: tipo.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.error === 'groq_not_configured') {
          toast.error('GROQ_API_KEY não configurada no Vercel.')
        } else {
          toast.error(json.detail || json.error || 'Erro ao analisar template')
        }
      } else {
        toast.success(`✅ ${json.total} campos mapeados!`)
        load()
      }
    } catch (e) {
      toast.error('Erro ao analisar template: ' + e.message)
    } finally {
      setAnalisando(null)
    }
  }

  const load = async () => {
    if (!workspaceId) return
    setLoading(true)
    const [cl, mo, eq, fr, co, bt] = await Promise.all([
      supabase.from('maquinas_classes').select('*').eq('workspace_id', workspaceId).order('nome'),
      supabase.from('maquinas_modelos').select('*').eq('workspace_id', workspaceId).order('nome'),
      supabase.from('maquinas_equipamentos').select('*').eq('workspace_id', workspaceId).order('codigo'),
      supabase.from('maquinas_frentes').select('*, maquinas_boletim_tipos(nome)').eq('workspace_id', workspaceId).order('nome'),
      supabase.from('maquinas_colaboradores').select('*, maquinas_frentes(nome)').eq('workspace_id', workspaceId).order('nome'),
      supabase.from('maquinas_boletim_tipos').select('*').eq('workspace_id', workspaceId).order('nome'),
    ])
    setClasses(cl.data || [])
    setModelos(mo.data || [])
    setEquipamentos(eq.data || [])
    setFrentes(fr.data || [])
    setColaboradores(co.data || [])
    setBoletimTipos(bt.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [workspaceId])

  async function toggleAtivo(subtab, item) {
    const table = { classes: 'maquinas_classes', modelos: 'maquinas_modelos', equipamentos: 'maquinas_equipamentos', frentes: 'maquinas_frentes', colaboradores: 'maquinas_colaboradores', boletim_tipos: 'maquinas_boletim_tipos' }[subtab]
    const { error } = await supabase.from(table).update({ ativo: !item.ativo }).eq('id', item.id)
    if (error) { toast.error(error.message); return }
    load()
  }

  const activeList = { classes, modelos, equipamentos, frentes, colaboradores, boletim_tipos: boletimTipos }[subAba] || []
  const q = busca.toLowerCase()
  const filtered = activeList.filter(item => {
    const fields = [item.nome, item.codigo, item.matricula, item.telefone_wa, item.descricao].filter(Boolean).join(' ').toLowerCase()
    return fields.includes(q)
  })
  const cfg = MAQ_SUBTABS.find(s => s.key === subAba)

  const classNome  = (id) => classes.find(c => c.id === id)?.nome || '—'
  const modeloNome = (id) => {
    const m = modelos.find(m => m.id === id)
    if (!m) return '—'
    const cn = classNome(m.classe_id)
    return cn !== '—' ? `${m.nome} (${cn})` : m.nome
  }

  return (
    <div style={{ padding: '0 28px 28px' }}>
      {/* Sub-abas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {MAQ_SUBTABS.map(s => (
          <button
            key={s.key}
            onClick={() => { setSubAba(s.key); setBusca('') }}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              background: subAba === s.key ? s.color + '22' : 'transparent',
              border: `1px solid ${subAba === s.key ? s.color + '55' : 'var(--border)'}`,
              color: subAba === s.key ? s.color : 'var(--text-secondary)',
              fontWeight: subAba === s.key ? 700 : 400,
            }}
          >
            {s.label}
            <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>
              ({(subAba === s.key ? filtered : { classes, modelos, equipamentos, frentes }[s.key] || []).length})
            </span>
          </button>
        ))}
      </div>

      {/* Hierarquia info */}
      <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 18, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#8b5cf6', fontWeight: 700 }}>Classes</span>
        <span>→</span>
        <span style={{ color: '#3b82f6', fontWeight: 700 }}>Modelos</span>
        <span>→</span>
        <span style={{ color: '#10b981', fontWeight: 700 }}>Equipamentos</span>
        <span style={{ marginLeft: 16, opacity: 0.5 }}>|</span>
        <span style={{ color: '#f59e0b', fontWeight: 700 }}>Frentes</span>
        <span style={{ opacity: 0.5, marginLeft: 2 }}>→ template</span>
        <span style={{ marginLeft: 16, opacity: 0.5 }}>|</span>
        <span style={{ color: '#ec4899', fontWeight: 700 }}>Colaboradores</span>
        <span style={{ opacity: 0.5, marginLeft: 2 }}>→ frente → template</span>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <MagnifyingGlassIcon style={{ width: 15, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            placeholder={`Buscar ${cfg?.label?.toLowerCase()}...`}
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <button
          onClick={() => setModal({ subtab: subAba, item: null })}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: cfg?.color || '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          <PlusIcon style={{ width: 14 }} /> Novo
        </button>
      </div>

      {/* Lista */}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚙️</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Nenhum {cfg?.label?.slice(0, -1).toLowerCase()} cadastrado</div>
          <div style={{ fontSize: 12 }}>Clique em "Novo" para adicionar.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {filtered.map(item => (
          <div
            key={item.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 9,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              opacity: item.ativo ? 1 : 0.5,
            }}
          >
            {/* Cor / indicador de hierarquia */}
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg?.color, flexShrink: 0 }} />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {subAba === 'equipamentos' ? item.codigo : item.nome}
                {subAba === 'equipamentos' && item.nome && (
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8 }}>{item.nome}</span>
                )}
                {subAba === 'colaboradores' && item.matricula && (
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8, fontSize: 12 }}>#{item.matricula}</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {subAba === 'modelos'       && classNome(item.classe_id)}
                {subAba === 'equipamentos'  && modeloNome(item.modelo_id)}
                {subAba === 'frentes'       && item.maquinas_boletim_tipos?.nome && (
                  <span>📋 {item.maquinas_boletim_tipos.nome}</span>
                )}
                {subAba === 'colaboradores' && (
                  <>
                    {item.telefone_wa && <span>📱 {item.telefone_wa}</span>}
                    {item.maquinas_frentes?.nome && <span>📍 {item.maquinas_frentes.nome}</span>}
                  </>
                )}
                {subAba === 'boletim_tipos' && (
                  <>
                    {item.descricao && <span>{item.descricao}</span>}
                    {item.campos_json
                      ? <span style={{ color: '#10b981' }}>✅ {Object.keys(item.campos_json).length} campos mapeados</span>
                      : <span style={{ color: '#f59e0b' }}>⚠️ Template não analisado</span>
                    }
                  </>
                )}
              </div>
            </div>

            {/* Status badge */}
            {!item.ativo && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700 }}>INATIVO</span>}

            {/* Ações */}
            <div style={{ display: 'flex', gap: 4 }}>
              {subAba === 'boletim_tipos' && item.imagem_url && (
                <button
                  onClick={() => analisarTemplate(item)}
                  disabled={analisando === item.id}
                  title="Analisar Template com IA"
                  style={{ background: analisando === item.id ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', cursor: analisando === item.id ? 'default' : 'pointer', padding: '4px 10px', borderRadius: 6, color: '#6366f1', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  {analisando === item.id ? '⏳ Analisando...' : '🔍 Analisar'}
                </button>
              )}
              <button
                onClick={() => setModal({ subtab: subAba, item })}
                title="Editar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, color: 'var(--text-secondary)' }}
              >
                <PencilIcon style={{ width: 15 }} />
              </button>
              <button
                onClick={() => toggleAtivo(subAba, item)}
                title={item.ativo ? 'Desativar' : 'Ativar'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, borderRadius: 6, color: item.ativo ? '#ef4444' : '#10b981' }}
              >
                {item.ativo ? <XCircleIcon style={{ width: 15 }} /> : <CheckCircleIcon style={{ width: 15 }} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <MaqModal
          subtab={modal.subtab}
          item={modal.item}
          workspaceId={workspaceId}
          classes={classes}
          modelos={modelos}
          frentes={frentes}
          boletimTipos={boletimTipos}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
export default function Cadastros() {
  const [searchParams] = useSearchParams()
  const [aba, setAba] = useState(() => searchParams.get('aba') || 'clientes')
  const { currentUser, workspaceId } = useStore()
  const ownerId = currentUser?.owner_id || currentUser?.id
  const [tabCounts, setTabCounts] = useState({})

  useEffect(() => {
    if (!ownerId) return
    Promise.all(
      Object.entries(TABS_CONFIG).map(async ([key, cfg]) => {
        const { count } = await supabase
          .from(cfg.table)
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', ownerId)
        return [key, count ?? 0]
      })
    ).then(entries => setTabCounts(Object.fromEntries(entries)))
  }, [ownerId])

  const tabKeys = Object.keys(TABS_CONFIG)
  const C = { border: '#e2e6f0', txtMuted: '#9aa3bf' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <Header
        title="Cadastros"
        subtitle="Gerencie clientes, fornecedores, solicitantes, condutores e máquinas"
      />

      {/* Abas estilo tab-underline */}
      <div style={{ background: '#fff', borderBottom: `2px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
          {tabKeys.map(key => {
            const cfg = TABS_CONFIG[key]
            const Icon = cfg.icon
            const ativo = aba === key
            return (
              <button
                key={key}
                onClick={() => setAba(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '11px 16px', borderRadius: 0,
                  background: 'transparent', border: 'none',
                  borderBottom: ativo ? `2px solid ${cfg.color}` : '2px solid transparent',
                  color: ativo ? cfg.color : C.txtMuted,
                  cursor: 'pointer', fontSize: 13, fontWeight: ativo ? 700 : 400,
                  transition: 'all 0.15s', marginBottom: -2,
                }}
              >
                <Icon style={{ width: 15 }} />
                {cfg.label}
                {tabCounts[key] !== undefined && (
                  <span style={{
                    background: ativo ? cfg.color + '22' : '#f0f2f8',
                    color: ativo ? cfg.color : C.txtMuted,
                    border: `1px solid ${ativo ? cfg.color + '44' : C.border}`,
                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, marginLeft: 2,
                  }}>
                    {tabCounts[key]}
                  </span>
                )}
              </button>
            )
          })}
          <button
            onClick={() => setAba('maquinas')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '11px 16px', borderRadius: 0,
              background: 'transparent', border: 'none',
              borderBottom: aba === 'maquinas' ? '2px solid #10b981' : '2px solid transparent',
              color: aba === 'maquinas' ? '#10b981' : C.txtMuted,
              cursor: 'pointer', fontSize: 13, fontWeight: aba === 'maquinas' ? 700 : 400,
              transition: 'all 0.15s', marginBottom: -2,
            }}
          >
            <WrenchScrewdriverIcon style={{ width: 15 }} />
            Máquinas
          </button>
        </div>
      </div>

      <div style={{ paddingTop: 20 }}>
        {aba === 'maquinas' ? (
          <MaquinasTab workspaceId={workspaceId} />
        ) : (
          <CadastroTab
            key={aba}
            tipo={aba}
            config={TABS_CONFIG[aba]}
            ownerId={ownerId}
          />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook exportado para autocomplete em outras páginas
// ─────────────────────────────────────────────────────────────────────────────
export function useCadastros(ownerId) {
  const [data, setData] = useState({ clientes: [], fornecedores: [], solicitantes: [], condutores: [] })

  useEffect(() => {
    if (!supabase || !ownerId) return
    Promise.all([
      supabase.from('cadastros_clientes').select('nome').eq('owner_id', ownerId).eq('ativo', true).order('nome'),
      supabase.from('cadastros_fornecedores').select('nome').eq('owner_id', ownerId).eq('ativo', true).order('nome'),
      supabase.from('cadastros_solicitantes').select('nome').eq('owner_id', ownerId).eq('ativo', true).order('nome'),
      supabase.from('cadastros_condutores').select('nome').eq('owner_id', ownerId).eq('ativo', true).order('nome'),
    ]).then(([c, f, s, d]) => {
      setData({
        clientes:    (c.data || []).map(r => r.nome),
        fornecedores:(f.data || []).map(r => r.nome),
        solicitantes:(s.data || []).map(r => r.nome),
        condutores:  (d.data || []).map(r => r.nome),
      })
    })
  }, [ownerId])

  return data
}
