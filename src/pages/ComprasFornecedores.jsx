import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { waLink } from '../lib/utils'
import useStore from '../store/useStore'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  PlusIcon, ArrowPathIcon, PencilIcon, TrashIcon,
  BuildingOfficeIcon, MagnifyingGlassIcon, PhoneIcon,
} from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Máscara de telefone brasileiro (XX) 9XXXX-XXXX ou (XX) XXXX-XXXX
function maskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return d
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// Avalia se o número parece ser celular (9 dígitos após DDD)
function phoneInfo(raw) {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  if (d.length === 11 && ['6','7','8','9'].includes(d[2]))
    return { ok: true,  color: '#10b981', msg: '📱 Celular — pode ter WhatsApp' }
  if (d.length === 10)
    return { ok: false, color: '#f59e0b', msg: '📞 Fixo — provavelmente sem WhatsApp' }
  if (d.length >= 3)
    return { ok: null,  color: '#94a3b8', msg: 'Número incompleto' }
  return null
}

const EMPTY = { nome: '', telefone: '', email: '', cnpj: '', contato: '', observacoes: '', ativo: true }
const inp   = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }
const lbl   = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, display: 'block' }

function ModalFornecedor({ forn, onClose, onSaved, workspaceId }) {
  const isEdit = !!forn
  const [form, setForm] = useState(isEdit ? { nome: forn.nome || '', telefone: forn.telefone || '', email: forn.email || '', cnpj: forn.cnpj || '', contato: forn.contato || '', observacoes: forn.observacoes || '', ativo: forn.ativo !== false } : EMPTY)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.nome.trim()) { toast.error('Informe o nome do fornecedor'); return }
    setSaving(true)
    const payload = { nome: form.nome.trim(), telefone: form.telefone.trim() || null, email: form.email.trim() || null, cnpj: form.cnpj.trim() || null, contato: form.contato.trim() || null, observacoes: form.observacoes.trim() || null, ativo: form.ativo, workspace_id: workspaceId }
    let error
    if (isEdit) {
      ({ error } = await supabase.from('fornecedores_compra').update(payload).eq('id', forn.id))
    } else {
      ({ error } = await supabase.from('fornecedores_compra').insert(payload))
    }
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    toast.success(isEdit ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!')
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Nome / Razão Social *</label><input style={inp} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Distribuidora ABC Ltda." autoFocus /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lbl}>CNPJ</label><input style={inp} value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" /></div>
            <div><label style={lbl}>Contato (pessoa)</label><input style={inp} value={form.contato} onChange={e => set('contato', e.target.value)} placeholder="Nome do responsável" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>WhatsApp / Telefone</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inp, flex: 1 }} value={form.telefone}
                  onChange={e => set('telefone', maskPhone(e.target.value))}
                  placeholder="(67) 99999-0000" maxLength={15} />
                {waLink(form.telefone) && (
                  <a href={waLink(form.telefone)} target="_blank" rel="noreferrer"
                    title="Abrir no WhatsApp para verificar"
                    style={{ padding: '9px 10px', borderRadius: 8, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)', color: '#25d366', textDecoration: 'none', display: 'flex', alignItems: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, gap: 4 }}>
                    <PhoneIcon style={{ width: 14, height: 14 }} />WA
                  </a>
                )}
              </div>
              {phoneInfo(form.telefone) && (
                <div style={{ fontSize: 11, marginTop: 4, color: phoneInfo(form.telefone).color }}>
                  {phoneInfo(form.telefone).msg}
                </div>
              )}
            </div>
            <div><label style={lbl}>E-mail</label><input style={inp} value={form.email} onChange={e => set('email', e.target.value)} placeholder="vendas@empresa.com" /></div>
          </div>
          <div><label style={lbl}>Observações</label><textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} placeholder="Condições comerciais, prazos habituais..." style={{ ...inp, resize: 'vertical', minHeight: 64 }} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} />
            Fornecedor ativo (aparece nas cotações)
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#0ea5e9', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ComprasFornecedores() {
  const { workspaceId } = useStore()
  const [data,        setData]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [editItem,    setEditItem]    = useState(null)
  const [busca,       setBusca]       = useState('')
  const [historico,   setHistorico]   = useState({}) // totais por nome

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: forn }, { data: sols }] = await Promise.all([
      supabase.from('fornecedores_compra').select('*').order('nome'),
      supabase.from('solicitacoes_compra').select('fornecedor,fornecedor_vencedor,valor_aprovado,valor_estimado').in('status', ['aprovado','pedido_emitido','recebido','pago']),
    ])
    setData(forn || [])
    // Constrói histórico por nome de fornecedor
    const hist = {}
    ;(sols || []).forEach(s => {
      const nome = s.fornecedor_vencedor || s.fornecedor
      if (!nome) return
      hist[nome] = (hist[nome] || 0) + (s.valor_aprovado || s.valor_estimado || 0)
    })
    setHistorico(hist)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (!window.confirm('Excluir este fornecedor?')) return
    const { error } = await supabase.from('fornecedores_compra').delete().eq('id', id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Fornecedor excluído')
    load()
  }

  const filtrado = data.filter(f => !busca || f.nome?.toLowerCase().includes(busca.toLowerCase()) || f.email?.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Fornecedores"
        subtitle="Cadastro de fornecedores do módulo Compras"
        action={{ label: 'Novo Fornecedor', onClick: () => setShowModal(true) }}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* Busca */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
            <MagnifyingGlassIcon style={{ width: 14, height: 14, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail..."
              style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8, fontSize: 13, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <button onClick={load} style={{ padding: '8px 13px', borderRadius: 8, fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <ArrowPathIcon style={{ width: 28, height: 28, color: '#0ea5e9', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtrado.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <BuildingOfficeIcon style={{ width: 52, height: 52, margin: '0 auto 14px', opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              {data.length === 0 ? 'Nenhum fornecedor cadastrado' : 'Nenhum resultado para a busca'}
            </div>
            {data.length === 0 && (
              <button onClick={() => setShowModal(true)}
                style={{ padding: '9px 20px', borderRadius: 8, background: '#0ea5e9', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, marginTop: 8 }}>
                Cadastrar primeiro fornecedor
              </button>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Fornecedor', 'Contato', 'WhatsApp / E-mail', 'Total comprado', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: h === '' || h === 'Total comprado' || h === 'Status' ? 'center' : 'left', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrado.map(f => {
                  const gasto = historico[f.nome] || 0
                  return (
                    <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{f.nome}</div>
                        {f.cnpj && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{f.cnpj}</div>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {f.contato || '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {f.telefone && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{f.telefone}</div>}
                        {f.email    && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f.email}</div>}
                        {!f.telefone && !f.email && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: gasto > 0 ? '#10b981' : 'var(--text-secondary)' }}>
                        {gasto > 0 ? fmtCurrency(gasto) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: f.ativo !== false ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)', color: f.ativo !== false ? '#10b981' : '#ef4444' }}>
                          {f.ativo !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button onClick={() => setEditItem(f)} title="Editar"
                            style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.2)', cursor: 'pointer', color: '#f59e0b', display: 'flex', alignItems: 'center' }}>
                            <PencilIcon style={{ width: 14, height: 14 }} />
                          </button>
                          <button onClick={() => handleDelete(f.id)} title="Excluir"
                            style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                            <TrashIcon style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(showModal || editItem) && (
        <ModalFornecedor
          forn={editItem}
          workspaceId={workspaceId}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSaved={load}
        />
      )}
    </div>
  )
}
