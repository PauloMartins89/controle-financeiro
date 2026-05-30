import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  PlusIcon, ArrowPathIcon, PencilIcon, TrashIcon, TagIcon,
} from '@heroicons/react/24/outline'

const CORES_PADRAO = [
  '#6366f1','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ef4444',
  '#f97316','#64748b','#ec4899','#14b8a6','#84cc16','#a16207',
]

const EMPTY = { nome: '', descricao: '', cor: '#6366f1', ativo: true }
const inp   = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
const lbl   = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, display: 'block' }

function ModalCategoria({ cat, onClose, onSaved, workspaceId }) {
  const isEdit = !!cat
  const [form, setForm] = useState(isEdit ? { nome: cat.nome || '', descricao: cat.descricao || '', cor: cat.cor || '#6366f1', ativo: cat.ativo !== false } : EMPTY)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.nome.trim()) { toast.error('Informe o nome da categoria'); return }
    setSaving(true)
    const payload = { nome: form.nome.trim(), descricao: form.descricao.trim() || null, cor: form.cor, ativo: form.ativo, workspace_id: workspaceId }
    let error
    if (isEdit) {
      ({ error } = await supabase.from('categorias_compra').update(payload).eq('id', cat.id))
    } else {
      ({ error } = await supabase.from('categorias_compra').insert(payload))
    }
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    toast.success(isEdit ? 'Categoria atualizada!' : 'Categoria criada!')
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 16, width: '100%', maxWidth: 440, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{isEdit ? 'Editar Categoria' : 'Nova Categoria'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Nome da Categoria *</label><input style={inp} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Lubrificantes" autoFocus /></div>
          <div><label style={lbl}>Descrição</label><input style={inp} value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Óleos, graxas, filtros..." /></div>
          <div>
            <label style={lbl}>Cor de identificação</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {CORES_PADRAO.map(c => (
                <button key={c} onClick={() => set('cor', c)}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${form.cor === c ? '#fff' : 'transparent'}`, cursor: 'pointer', outline: form.cor === c ? `2px solid ${c}` : 'none', flexShrink: 0 }} />
              ))}
            </div>
            <input type="color" value={form.cor} onChange={e => set('cor', e.target.value)} style={{ ...inp, height: 38, padding: 4, cursor: 'pointer' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} />
            Categoria ativa
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: form.cor || '#6366f1', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Categoria'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ComprasCategorias() {
  const { workspaceId } = useStore()
  const [data,        setData]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [editItem,    setEditItem]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: cats } = await supabase.from('categorias_compra').select('*').order('nome')
    setData(cats || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (!window.confirm('Excluir esta categoria?')) return
    const { error } = await supabase.from('categorias_compra').delete().eq('id', id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Categoria excluída')
    load()
  }

  const ativas   = data.filter(c => c.ativo !== false)
  const inativas = data.filter(c => c.ativo === false)

  function CategoriaRow({ c }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${c.cor || '#6366f1'}20`, border: `2px solid ${c.cor || '#6366f1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TagIcon style={{ width: 18, height: 18, color: c.cor || '#6366f1' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{c.nome}</div>
          {c.descricao && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.descricao}</div>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setEditItem(c)} title="Editar"
            style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.2)', cursor: 'pointer', color: '#f59e0b', display: 'flex', alignItems: 'center' }}>
            <PencilIcon style={{ width: 14, height: 14 }} />
          </button>
          <button onClick={() => handleDelete(c.id)} title="Excluir"
            style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
            <TrashIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Categorias de Compra"
        subtitle="Classifique as compras por tipo"
        action={{ label: 'Nova Categoria', onClick: () => setShowModal(true) }}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={load} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <ArrowPathIcon style={{ width: 28, height: 28, color: '#6366f1', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <TagIcon style={{ width: 52, height: 52, margin: '0 auto 14px', opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Nenhuma categoria cadastrada</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Crie categorias para classificar suas compras nos relatórios.</div>
            <button onClick={() => setShowModal(true)}
              style={{ padding: '9px 20px', borderRadius: 8, background: '#6366f1', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700 }}>
              Criar primeira categoria
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {ativas.map(c => <CategoriaRow key={c.id} c={c} />)}
            {inativas.length > 0 && (
              <>
                <div style={{ gridColumn: '1/-1', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  Inativas ({inativas.length})
                </div>
                {inativas.map(c => <CategoriaRow key={c.id} c={{ ...c, opacity: 0.5 }} />)}
              </>
            )}
          </div>
        )}
      </div>

      {(showModal || editItem) && (
        <ModalCategoria
          cat={editItem}
          workspaceId={workspaceId}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSaved={load}
        />
      )}
    </div>
  )
}
