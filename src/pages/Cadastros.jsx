import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import {
  PlusIcon, PencilIcon, TrashIcon, XMarkIcon,
  ArrowUpTrayIcon, ArrowDownTrayIcon, MagnifyingGlassIcon,
  CheckCircleIcon, XCircleIcon, BuildingOffice2Icon,
  UserIcon, TruckIcon, UsersIcon,
} from '@heroicons/react/24/outline'

// ─────────────────────────────────────────────────────────────────────────────
// Configuração das abas
// ─────────────────────────────────────────────────────────────────────────────
const TABS_CONFIG = {
  clientes: {
    label: 'Clientes',
    icon: BuildingOffice2Icon,
    table: 'cadastros_clientes',
    color: '#6366f1',
    fields: [
      { key: 'nome',        label: 'Nome',        required: true,  span: 2 },
      { key: 'razao_social',label: 'Razão Social', span: 2 },
      { key: 'cnpj',        label: 'CNPJ' },
      { key: 'contato',     label: 'Contato' },
      { key: 'telefone',    label: 'Telefone' },
      { key: 'email',       label: 'E-mail', type: 'email' },
      { key: 'observacoes', label: 'Observações', span: 2, multiline: true },
    ],
    importCols: ['nome','razao_social','cnpj','contato','telefone','email','observacoes'],
  },
  fornecedores: {
    label: 'Fornecedores',
    icon: BuildingOffice2Icon,
    table: 'cadastros_fornecedores',
    color: '#f59e0b',
    fields: [
      { key: 'nome',        label: 'Nome',        required: true,  span: 2 },
      { key: 'razao_social',label: 'Razão Social', span: 2 },
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
  const emptyForm = () => Object.fromEntries(config.fields.map(f => [f.key, '']))
  const [form, setForm] = useState(item ? { ...item } : emptyForm())
  const [saving, setSaving] = useState(false)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSave() {
    const req = config.fields.filter(f => f.required)
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

  const filtered = items.filter(i =>
    !busca || i.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    i.cnpj?.includes(busca) || i.email?.toLowerCase().includes(busca.toLowerCase())
  )

  // Colunas visíveis na listagem (primeiras 4 fields exceto observações)
  const listCols = config.fields.filter(f => !f.multiline).slice(0, 4)

  return (
    <div style={{ padding: '0 28px 28px' }}>
      {/* Barra de ações */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: 200 }}>
          <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, color: 'var(--text-secondary)' }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder={`Buscar em ${config.label.toLowerCase()}...`}
            style={{ ...inputStyle, paddingLeft: 34 }}
          />
        </div>

        {/* Botão Baixar Modelo */}
        <button onClick={baixarModelo} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
          <ArrowDownTrayIcon style={{ width: 16 }} />
          Baixar Modelo
        </button>

        {/* Botão Importar */}
        <button onClick={() => fileRef.current?.click()} disabled={importando} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', opacity: importando ? 0.7 : 1 }}>
          <ArrowUpTrayIcon style={{ width: 16 }} />
          {importando ? 'Importando...' : 'Importar Planilha'}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />

        {/* Botão Novo */}
        <button onClick={() => { setEditing({}); setShowModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: config.color, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <PlusIcon style={{ width: 16 }} />
          Novo
        </button>
      </div>

      {/* Contador */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
        {filtered.length} de {items.length} registro(s)
        {items.filter(i => !i.ativo).length > 0 && <span style={{ marginLeft: 8, color: '#64748b' }}>· {items.filter(i => !i.ativo).length} inativo(s)</span>}
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13 }}>Nenhum registro encontrado.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Clique em "Novo" ou importe uma planilha.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Cabeçalho da tabela */}
          <div style={{ display: 'grid', gridTemplateColumns: `1fr ${listCols.slice(1).map(() => '1fr').join(' ')} 90px`, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
            {listCols.map(f => (
              <div key={f.key} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</div>
            ))}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>AÇÕES</div>
          </div>

          {/* Linhas */}
          {filtered.map((item, idx) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: `1fr ${listCols.slice(1).map(() => '1fr').join(' ')} 90px`, padding: '10px 16px', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center', opacity: item.ativo ? 1 : 0.5, transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

              {listCols.map((f, fi) => (
                <div key={f.key} style={{ fontSize: 13, color: fi === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: fi === 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                  {item[f.key] || <span style={{ color: '#475569' }}>—</span>}
                </div>
              ))}

              {/* Ações */}
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button onClick={() => toggleAtivo(item)} title={item.ativo ? 'Inativar' : 'Ativar'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5, color: item.ativo ? '#10b981' : '#64748b' }}>
                  {item.ativo ? <CheckCircleIcon style={{ width: 16 }} /> : <XCircleIcon style={{ width: 16 }} />}
                </button>
                <button onClick={() => { setEditing(item); setShowModal(true) }} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5, color: 'var(--text-secondary)' }}>
                  <PencilIcon style={{ width: 16 }} />
                </button>
                <button onClick={() => handleDelete(item)} title="Excluir" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 5, color: '#ef4444' }}>
                  <TrashIcon style={{ width: 16 }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
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
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
export default function Cadastros() {
  const [aba, setAba] = useState('clientes')
  const { currentUser } = useStore()
  const ownerId = currentUser?.owner_id || currentUser?.id

  const tabKeys = Object.keys(TABS_CONFIG)

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header
        title="Cadastros"
        subtitle="Gerencie clientes, fornecedores, solicitantes e condutores"
      />

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, padding: '0 28px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
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
                padding: '8px 16px', borderRadius: 8,
                background: ativo ? cfg.color + '22' : 'transparent',
                border: `1px solid ${ativo ? cfg.color + '55' : 'var(--border)'}`,
                color: ativo ? cfg.color : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 13, fontWeight: ativo ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >
              <Icon style={{ width: 16 }} />
              {cfg.label}
            </button>
          )
        })}
      </div>

      <div style={{ paddingTop: 20 }}>
        <CadastroTab
          key={aba}
          tipo={aba}
          config={TABS_CONFIG[aba]}
          ownerId={ownerId}
        />
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
