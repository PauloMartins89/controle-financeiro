import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import useStore from '../store/useStore'
import {
  PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon,
  BookOpenIcon, ShoppingCartIcon, TagIcon, FunnelIcon,
  BuildingStorefrontIcon, Squares2X2Icon, ListBulletIcon,
  ChartBarIcon, XMarkIcon, ClockIcon, CheckCircleIcon,
  CubeIcon, ExclamationTriangleIcon, ArrowPathIcon,
  ArrowDownTrayIcon, ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

const UNIDADES = ['un','kg','g','l','ml','m','m²','m³','cx','pc','par','fardo','saco','rolo','hora','serviço','kit','jogo']

export default function ComprasCatalogo() {
  const { currentUser: user, workspaceId } = useStore()
  const navigate = useNavigate()
  const [wsId, setWsId] = useState(null)
  const [items, setItems] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [histItem, setHistItem] = useState(null)
  const [historico, setHistorico] = useState([])
  const [loadingHist, setLoadingHist] = useState(false)
  const [importando, setImportando] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!workspaceId) return
    setWsId(workspaceId)
    Promise.all([loadItems(workspaceId), loadCategorias(workspaceId)])
      .finally(() => setLoading(false))
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadItems(wid) {
    const { data } = await supabase
      .from('catalogo_compras').select('*')
      .eq('workspace_id', wid).eq('ativo', true).order('nome')
    setItems(data || [])
  }

  async function loadCategorias(wid) {
    const { data } = await supabase
      .from('categorias_compra').select('nome, cor')
      .eq('workspace_id', wid).order('nome')
    setCategorias(data || [])
  }

  async function loadHistorico(item) {
    setHistItem(item)
    setLoadingHist(true)
    setHistorico([])
    const palavra = item.nome.split(' ')[0]
    const { data } = await supabase
      .from('solicitacoes_compra')
      .select('id, titulo, data_solicitacao, cotacoes_compra(preco_unitario, fornecedor_nome, vencedor)')
      .eq('workspace_id', wsId)
      .ilike('titulo', `%${palavra}%`)
      .order('data_solicitacao', { ascending: false })
      .limit(30)
    const hist = []
    if (data) {
      for (const sol of data) {
        for (const cot of (sol.cotacoes_compra || [])) {
          if (cot.preco_unitario > 0) {
            hist.push({
              data: sol.data_solicitacao,
              fornecedor: cot.fornecedor_nome,
              preco: cot.preco_unitario,
              vencedor: cot.vencedor,
              titulo: sol.titulo,
            })
          }
        }
      }
    }
    hist.sort((a, b) => new Date(b.data) - new Date(a.data))
    setHistorico(hist)
    setLoadingHist(false)
  }

  async function handleDelete(item) {
    if (!confirm(`Remover "${item.nome}" do catálogo?`)) return
    const { error } = await supabase.from('catalogo_compras').update({ ativo: false }).eq('id', item.id)
    if (error) toast.error('Erro ao remover')
    else { toast.success('Item removido'); loadItems(wsId) }
  }

  function handlePedir(item) {
    navigate('/compras/operacoes/requisicoes', {
      state: {
        prefill: {
          titulo: item.nome,
          descricao: item.especificacoes || item.descricao || '',
          fornecedor: item.fornecedor_preferido_nome || '',
        }
      }
    })
  }

  // ── Baixar template XLSX ─────────────────────────────────────────────────
  function baixarModelo() {
    const headers = ['Nome *', 'Descrição', 'Unidade de Medida', 'Categoria', 'Especificações', 'Preço de Referência', 'Fornecedor Preferido']
    const exemplo = ['Parafuso M8 Inox', 'Parafuso 25mm cabeça sextavada', 'un', 'Fixadores', 'DIN 933, aço inox A2', '3.50', 'Metalúrgica Silva']
    const ws = XLSX.utils.aoa_to_sheet([headers, exemplo])
    ws['!cols'] = headers.map(() => ({ wch: 24 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Catálogo')
    XLSX.writeFile(wb, 'modelo_catalogo_itens.xlsx')
    toast.success('Template baixado!')
  }

  // ── Importar XLSX/CSV ────────────────────────────────────────────────────────
  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!wsId) { toast.error('Workspace não identificado. Recarregue a página.'); return }
    setImportando(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (rows.length < 2) { toast.error('Planilha vazia ou sem dados.'); setImportando(false); return }

      const colMap = {
        nome: ['nome *', 'nome', 'name'],
        descricao: ['descrição', 'descricao', 'description'],
        unidade_medida: ['unidade de medida', 'unidade', 'un', 'unit'],
        categoria: ['categoria', 'category'],
        especificacoes: ['especificações', 'especificacoes', 'especificação'],
        preco_referencia: ['preço de referência', 'preco referencia', 'preço', 'preco', 'price', 'valor'],
        fornecedor_preferido_nome: ['fornecedor preferido', 'fornecedor', 'supplier'],
      }
      const header = rows[0].map(h => String(h || '').trim().toLowerCase())
      const idx = {}
      Object.entries(colMap).forEach(([key, aliases]) => {
        const found = header.findIndex(h => aliases.includes(h))
        if (found !== -1) idx[key] = found
      })
      if (idx.nome === undefined) { toast.error('Coluna "Nome" não encontrada no arquivo.'); setImportando(false); return }

      const records = []
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const nome = String(row[idx.nome] ?? '').trim()
        if (!nome) continue
        const rec = {
          workspace_id: wsId,
          ativo: true,
          nome,
          descricao:                String(row[idx.descricao]               ?? '').trim() || null,
          unidade_medida:           String(row[idx.unidade_medida]          ?? '').trim() || 'un',
          categoria:                String(row[idx.categoria]               ?? '').trim() || null,
          especificacoes:           String(row[idx.especificacoes]          ?? '').trim() || null,
          preco_referencia:         parseFloat(String(row[idx.preco_referencia] ?? '').replace(',', '.')) || null,
          fornecedor_preferido_nome:String(row[idx.fornecedor_preferido_nome] ?? '').trim() || null,
        }
        records.push(rec)
      }
      if (!records.length) { toast.error('Nenhum registro válido encontrado.'); setImportando(false); return }

      const { error } = await supabase.from('catalogo_compras').insert(records)
      if (error) { toast.error('Erro na importação: ' + error.message); setImportando(false); return }

      toast.success(`${records.length} item(ns) importado(s)!`)
      await loadItems(wsId)
    } catch (err) {
      toast.error('Erro ao ler arquivo: ' + err.message)
    }
    setImportando(false)
  }

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    const matchSearch = !q || i.nome.toLowerCase().includes(q) || (i.descricao || '').toLowerCase().includes(q)
    const matchCat = !filterCat || i.categoria === filterCat
    return matchSearch && matchCat
  })

  const stats = {
    total: items.length,
    comPreco: items.filter(i => i.preco_referencia > 0).length,
    comFornecedor: items.filter(i => i.fornecedor_preferido_nome).length,
  }

  if (loading) return (
    <div style={{ padding: 40, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <ArrowPathIcon style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} />
      Carregando catálogo...
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Catálogo de Itens"
        subtitle="Itens padronizados com referência de preço e histórico de compras"
        action={{ label: 'Novo Item', onClick: () => { setEditItem(null); setModalOpen(true) } }}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total no Catálogo', value: stats.total, icon: BookOpenIcon, color: '#6366f1' },
          { label: 'Com Preço de Referência', value: stats.comPreco, icon: TagIcon, color: '#10b981' },
          { label: 'Com Fornecedor Preferido', value: stats.comFornecedor, icon: BuildingStorefrontIcon, color: '#f59e0b' },
        ].map(c => {
          const I = c.icon
          return (
            <div key={c.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: c.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <I style={{ width: 22, height: 22, color: c.color }} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{c.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{c.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-secondary)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar item..."
            style={{ width: '100%', paddingLeft: 34, paddingRight: 12, height: 38, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ height: 38, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14 }}
        >
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
        </select>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {[['grid', Squares2X2Icon], ['list', ListBulletIcon]].map(([m, Icon]) => (
            <button key={m} onClick={() => setViewMode(m)} title={m === 'grid' ? 'Grade' : 'Lista'}
              style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: viewMode === m ? '#6366f1' : 'var(--bg-secondary)', border: 'none', cursor: 'pointer', transition: 'all .15s' }}>
              <Icon style={{ width: 16, height: 16, color: viewMode === m ? '#fff' : 'var(--text-secondary)' }} />
            </button>
          ))}
        </div>
        <button onClick={baixarModelo}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 38, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
          <ArrowDownTrayIcon style={{ width: 15, height: 15 }} />
          Baixar Template
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={importando}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 38, borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', cursor: importando ? 'not-allowed' : 'pointer', fontSize: 13, whiteSpace: 'nowrap', opacity: importando ? 0.7 : 1 }}>
          {importando ? <ArrowPathIcon style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> : <ArrowUpTrayIcon style={{ width: 15, height: 15 }} />}
          {importando ? 'Importando...' : 'Importar Planilha'}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
        <button
          onClick={() => { setEditItem(null); setModalOpen(true) }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '0 18px', height: 38, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
        >
          <PlusIcon style={{ width: 16, height: 16 }} /> Novo Item
        </button>
      </div>

      {/* Lista de itens */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <BookOpenIcon style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.25 }} />
          <p style={{ fontSize: 16, margin: 0, fontWeight: 500 }}>
            {search || filterCat ? 'Nenhum item encontrado para este filtro' : 'Catálogo vazio — adicione o primeiro item'}
          </p>
          {!search && !filterCat && (
            <button onClick={() => setModalOpen(true)}
              style={{ marginTop: 16, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 600 }}>
              Adicionar Primeiro Item
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
          {filtered.map(item => (
            <CatalogoCard
              key={item.id} item={item} categorias={categorias}
              onEdit={() => { setEditItem(item); setModalOpen(true) }}
              onDelete={() => handleDelete(item)}
              onHistorico={() => loadHistorico(item)}
              onPedir={() => handlePedir(item)}
            />
          ))}
        </div>
      ) : (
        <CatalogoTable
          items={filtered} categorias={categorias}
          onEdit={item => { setEditItem(item); setModalOpen(true) }}
          onDelete={handleDelete}
          onHistorico={loadHistorico}
          onPedir={handlePedir}
        />
      )}

      {modalOpen && (
        <ModalItemCatalogo
          item={editItem} categorias={categorias} workspaceId={wsId}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); loadItems(wsId) }}
        />
      )}

      {histItem && (
        <ModalHistoricoPrecos
          item={histItem} historico={historico} loading={loadingHist}
          refPrice={histItem.preco_referencia}
          onClose={() => setHistItem(null)}
        />
      )}
      </div>
    </div>
  )
}

// ─── Card (grade) ─────────────────────────────────────────────────────────────
function CatalogoCard({ item, categorias, onEdit, onDelete, onHistorico, onPedir }) {
  const cat = categorias.find(c => c.nome === item.categoria)
  const catColor = cat?.cor || '#6366f1'
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, transition: 'box-shadow .15s' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.nome}>{item.nome}</div>
          {item.descricao && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.descricao}</div>}
        </div>
        {item.categoria && (
          <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: catColor + '20', color: catColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {item.categoria}
          </span>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 2, fontWeight: 500 }}>UNIDADE</div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.unidade_medida || 'un'}</div>
        </div>
        {item.preco_referencia > 0 && (
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 2, fontWeight: 500 }}>PREÇO REF.</div>
            <div style={{ fontWeight: 700, color: '#10b981' }}>{fmtCurrency(item.preco_referencia)}</div>
          </div>
        )}
      </div>

      {/* Fornecedor preferido */}
      {item.fornecedor_preferido_nome && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px' }}>
          <BuildingStorefrontIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.fornecedor_preferido_nome}</span>
        </div>
      )}

      {/* Ações */}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
        <button onClick={onPedir}
          style={{ flex: 1, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <ShoppingCartIcon style={{ width: 14, height: 14 }} /> Criar Pedido
        </button>
        <button onClick={onHistorico} title="Histórico de preços"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ChartBarIcon style={{ width: 14, height: 14 }} /> Histórico
        </button>
        <button onClick={onEdit} title="Editar"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <PencilIcon style={{ width: 13, height: 13 }} />
        </button>
        <button onClick={onDelete} title="Remover"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px', cursor: 'pointer', color: '#ef4444' }}>
          <TrashIcon style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </div>
  )
}

// ─── Tabela (lista) ───────────────────────────────────────────────────────────
function CatalogoTable({ items, categorias, onEdit, onDelete, onHistorico, onPedir }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-primary)' }}>
            {['Item / Descrição', 'Categoria', 'Und.', 'Preço Ref.', 'Fornecedor Preferido', 'Ações'].map(h => (
              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const cat = categorias.find(c => c.nome === item.categoria)
            const catColor = cat?.cor || '#6366f1'
            return (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{item.nome}</div>
                  {item.descricao && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.descricao}</div>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {item.categoria && (
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: catColor + '20', color: catColor }}>
                      {item.categoria}
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>{item.unidade_medida || 'un'}</td>
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: item.preco_referencia > 0 ? '#10b981' : 'var(--text-secondary)' }}>
                  {item.preco_referencia > 0 ? fmtCurrency(item.preco_referencia) : '—'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{item.fornecedor_preferido_nome || '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onPedir(item)} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Pedir</button>
                    <button onClick={() => onHistorico(item)} title="Histórico" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <ChartBarIcon style={{ width: 14, height: 14 }} />
                    </button>
                    <button onClick={() => onEdit(item)} title="Editar" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <PencilIcon style={{ width: 13, height: 13 }} />
                    </button>
                    <button onClick={() => onDelete(item)} title="Remover" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: '#ef4444' }}>
                      <TrashIcon style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Modal Criar/Editar Item ─────────────────────────────────────────────────
function ModalItemCatalogo({ item, categorias, workspaceId, onClose, onSaved }) {
  const [form, setForm] = useState({
    nome: item?.nome || '',
    descricao: item?.descricao || '',
    unidade_medida: item?.unidade_medida || 'un',
    categoria: item?.categoria || '',
    especificacoes: item?.especificacoes || '',
    preco_referencia: item?.preco_referencia || '',
    fornecedor_preferido_nome: item?.fornecedor_preferido_nome || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return }
    setSaving(true)
    const payload = {
      ...form,
      preco_referencia: parseFloat(form.preco_referencia) || null,
      workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    }
    let error
    if (item?.id) {
      ;({ error } = await supabase.from('catalogo_compras').update(payload).eq('id', item.id))
    } else {
      ;({ error } = await supabase.from('catalogo_compras').insert({ ...payload, ativo: true }))
    }
    setSaving(false)
    if (error) toast.error('Erro ao salvar: ' + error.message)
    else { toast.success(item ? 'Item atualizado!' : 'Item adicionado ao catálogo!'); onSaved() }
  }

  const inp = { width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', outline: 'none' }
  const lbl = { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.03em' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{item ? 'Editar Item' : 'Novo Item do Catálogo'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={lbl}>Nome do Item *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} style={inp} placeholder="Ex: Parafuso M8 × 25mm Inox" autoFocus />
          </div>
          <div>
            <label style={lbl}>Descrição Resumida</label>
            <input value={form.descricao} onChange={e => set('descricao', e.target.value)} style={inp} placeholder="Descrição curta para identificação rápida" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Unidade de Medida</label>
              <select value={form.unidade_medida} onChange={e => set('unidade_medida', e.target.value)} style={inp}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Categoria</label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)} style={inp}>
                <option value="">Sem categoria</option>
                {categorias.map(c => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>Especificações Técnicas</label>
            <textarea value={form.especificacoes} onChange={e => set('especificacoes', e.target.value)}
              rows={3} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
              placeholder="Normas técnicas, medidas exatas, material, cor, voltagem, etc." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Preço de Referência (R$)</label>
              <input type="number" value={form.preco_referencia} onChange={e => set('preco_referencia', e.target.value)}
                style={inp} placeholder="0,00" min="0" step="0.01" />
            </div>
            <div>
              <label style={lbl}>Fornecedor Preferido</label>
              <input value={form.fornecedor_preferido_nome} onChange={e => set('fornecedor_preferido_nome', e.target.value)}
                style={inp} placeholder="Nome do fornecedor padrão" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
          <button onClick={save} disabled={saving}
            style={{ padding: '9px 28px', border: 'none', borderRadius: 8, background: '#6366f1', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: saving ? .7 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Histórico de Preços ─────────────────────────────────────────────
function ModalHistoricoPrecos({ item, historico, loading, refPrice, onClose }) {
  const precos = historico.filter(h => h.preco > 0).map(h => h.preco)
  const avg = precos.length ? precos.reduce((a, b) => a + b, 0) / precos.length : 0
  const minP = precos.length ? Math.min(...precos) : 0
  const maxP = precos.length ? Math.max(...precos) : 0
  const ultimoPreco = historico.find(h => h.vencedor)?.preco || 0
  const varVsRef = refPrice > 0 && ultimoPreco > 0 ? ((ultimoPreco - refPrice) / refPrice) * 100 : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Histórico de Preços</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{item.nome}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>Buscando histórico de compras...</div>
        ) : historico.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
            <ClockIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.25 }} />
            <p style={{ margin: 0, fontWeight: 500 }}>Nenhum histórico encontrado</p>
            <p style={{ margin: '8px 0 0', fontSize: 12 }}>O histórico aparece conforme cotações forem recebidas para requisições com nome similar a este item.</p>
          </div>
        ) : (
          <>
            {/* Stats resumo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Preço Médio', value: avg, color: '#6366f1' },
                { label: 'Menor Cotado', value: minP, color: '#10b981' },
                { label: 'Maior Cotado', value: maxP, color: '#ef4444' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{fmtCurrency(s.value)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Comparação vs referência */}
            {refPrice > 0 && varVsRef !== null && (
              <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, background: varVsRef > 10 ? 'rgba(239,68,68,0.08)' : varVsRef < -10 ? 'rgba(16,185,129,0.08)' : 'rgba(99,102,241,0.08)', border: `1px solid ${varVsRef > 10 ? '#ef4444' : varVsRef < -10 ? '#10b981' : '#6366f1'}40` }}>
                <div style={{ fontSize: 13, color: varVsRef > 10 ? '#ef4444' : varVsRef < -10 ? '#10b981' : '#6366f1', fontWeight: 600 }}>
                  {varVsRef > 10 ? '⚠ Último preço pago está ' + varVsRef.toFixed(1) + '% acima do preço de referência'
                    : varVsRef < -10 ? '✓ Último preço pago está ' + Math.abs(varVsRef).toFixed(1) + '% abaixo do preço de referência'
                    : '✓ Último preço pago está dentro da faixa de referência'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Referência: {fmtCurrency(refPrice)} · Último pago: {fmtCurrency(ultimoPreco)}
                </div>
              </div>
            )}

            {/* Gráfico de barras simples */}
            {precos.length > 1 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>VARIAÇÃO DE PREÇO</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60, padding: '0 4px' }}>
                  {historico.slice(0, 12).reverse().map((h, i) => {
                    const pct = maxP > 0 ? Math.max((h.preco / maxP) * 100, 8) : 50
                    return (
                      <div key={i}
                        title={`${h.fornecedor}: ${fmtCurrency(h.preco)}\n${fmtDate(h.data)}`}
                        style={{ flex: 1, height: `${pct}%`, background: h.vencedor ? '#10b981' : '#6366f120', border: h.vencedor ? 'none' : '1px solid #6366f140', borderRadius: '3px 3px 0 0', cursor: 'default', transition: 'opacity .15s' }}
                      />
                    )
                  })}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6 }}>Verde = cotação vencedora · Azul = outras cotações · Mais antigo → mais recente</div>
              </div>
            )}

            {/* Tabela de histórico */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-muted)' }}>
                    {['Data', 'Requisição', 'Fornecedor', 'Preço Unit.', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--border)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h, i) => (
                    <tr key={i} style={{ borderBottom: i < historico.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(h.data)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)' }}>{h.titulo}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)' }}>{h.fornecedor}</td>
                      <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 700, color: h.vencedor ? '#10b981' : 'var(--text-primary)' }}>
                        {fmtCurrency(h.preco)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {h.vencedor && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 20 }}>✓ Vencedor</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
