import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, UsersIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const FLAGS = [
  { key: 'usa_whatsapp',        label: 'WhatsApp' },
  { key: 'usa_email',           label: 'E-mail' },
  { key: 'pode_aprovar',        label: 'Aprovar' },
  { key: 'pode_solicitar',      label: 'Solicitar' },
  { key: 'recebe_notificacoes', label: 'Notificações' },
]

const EMPTY = {
  nome: '', cpf: '', matricula: '', cargo: '',
  celular: '', email: '',
  funcao_id: '', equipe_id: '',
  usa_whatsapp: false, usa_email: false,
  pode_aprovar: false, pode_solicitar: false, recebe_notificacoes: false,
  ativo: true,
}

function EfetivoModal({ item, workspaceId, funcoes, equipes, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...EMPTY, ...item } : { ...EMPTY })
  const [saving, setSaving] = useState(false)

  // Ao trocar a função, herda as flags padrão (não sobrescreve se já editou)
  function handleFuncaoChange(funcao_id) {
    const funcao = funcoes.find(f => f.id === funcao_id)
    if (!funcao) { setForm(f => ({ ...f, funcao_id })); return }
    setForm(f => ({
      ...f,
      funcao_id,
      usa_whatsapp:        funcao.usa_whatsapp,
      usa_email:           funcao.usa_email,
      pode_aprovar:        funcao.pode_aprovar,
      pode_solicitar:      funcao.pode_solicitar,
      recebe_notificacoes: funcao.recebe_notificacoes,
    }))
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error('Informe o nome'); return }
    setSaving(true)
    const payload = {
      ...form,
      nome:       form.nome.trim(),
      cpf:        form.cpf?.trim() || null,
      matricula:  form.matricula?.trim() || null,
      cargo:      form.cargo?.trim() || null,
      celular:    form.celular?.replace(/\D/g, '') || null,
      email:      form.email?.trim().toLowerCase() || null,
      funcao_id:  form.funcao_id || null,
      equipe_id:  form.equipe_id || null,
      workspace_id: workspaceId,
    }
    let error
    if (item) {
      ;({ error } = await supabase.from('efetivo').update(payload).eq('id', item.id))
    } else {
      ;({ error } = await supabase.from('efetivo').insert(payload))
    }
    setSaving(false)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success(item ? 'Colaborador atualizado!' : 'Colaborador cadastrado!')
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{item ? 'Editar Colaborador' : 'Novo Colaborador'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <XMarkIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto' }}>
          {/* Identificação */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="label">Nome *</label>
              <input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div>
              <label className="label">CPF</label>
              <input className="input" value={form.cpf || ''} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className="label">Matrícula</label>
              <input className="input" value={form.matricula || ''} onChange={e => setForm(f => ({ ...f, matricula: e.target.value }))} placeholder="Opcional" />
            </div>
            <div>
              <label className="label">Cargo / Título</label>
              <input className="input" value={form.cargo || ''} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Motorista, Gerente" />
            </div>
            <div>
              <label className="label">Função</label>
              <select className="input" value={form.funcao_id || ''} onChange={e => handleFuncaoChange(e.target.value)}>
                <option value="">— Sem função —</option>
                {funcoes.filter(f => f.ativo).map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Equipe</label>
              <select className="input" value={form.equipe_id || ''} onChange={e => setForm(f => ({ ...f, equipe_id: e.target.value }))}>
                <option value="">— Sem equipe —</option>
                {equipes.map(e => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Canais */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Celular / WhatsApp</label>
              <input className="input" value={form.celular || ''} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} placeholder="5567999990000 (com DDI+DDD)" />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input className="input" type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" />
            </div>
          </div>

          {/* Flags */}
          <div>
            <label className="label" style={{ marginBottom: 10 }}>Capacidades individuais</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {FLAGS.map(flag => (
                <label key={flag.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 20, border: '1px solid var(--border)', background: form[flag.key] ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={!!form[flag.key]}
                    onChange={e => setForm(f => ({ ...f, [flag.key]: e.target.checked }))}
                    style={{ accentColor: '#6366f1', cursor: 'pointer' }}
                  />
                  <span style={{ color: form[flag.key] ? '#a5b4fc' : 'var(--text-secondary)', fontWeight: form[flag.key] ? 600 : 400 }}>{flag.label}</span>
                </label>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} style={{ accentColor: '#6366f1' }} />
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Colaborador ativo</span>
          </label>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Efetivo() {
  const { workspaceId } = useStore()
  const [efetivo, setEfetivo]   = useState([])
  const [funcoes, setFuncoes]   = useState([])
  const [equipes, setEquipes]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [busca, setBusca]       = useState('')
  const [filtroFuncao, setFiltroFuncao] = useState('')

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const [{ data: ef }, { data: fn }, { data: eq }] = await Promise.all([
      supabase.from('efetivo').select('*, funcoes_efetivo(nome)').eq('workspace_id', workspaceId).order('nome'),
      supabase.from('funcoes_efetivo').select('*').eq('workspace_id', workspaceId).order('nome'),
      supabase.from('refei_equipes').select('id, nome').order('nome'),
    ])
    setEfetivo(ef || [])
    setFuncoes(fn || [])
    setEquipes(eq || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (!confirm('Remover este colaborador?')) return
    const { error } = await supabase.from('efetivo').delete().eq('id', id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Colaborador removido')
    load()
  }

  const lista = efetivo
    .filter(e => !busca || e.nome.toLowerCase().includes(busca.toLowerCase()) || e.celular?.includes(busca) || e.matricula?.includes(busca))
    .filter(e => !filtroFuncao || e.funcao_id === filtroFuncao)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header title="Efetivo" />

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* Topo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Colaboradores</h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Cadastro central de motoristas, supervisores, aprovadores e demais colaboradores.
            </p>
          </div>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => { setEditing(null); setShowModal(true) }}>
            <PlusIcon style={{ width: 16, height: 16 }} /> Novo Colaborador
          </button>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Buscar por nome, celular ou matrícula…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <select className="input" style={{ minWidth: 180 }} value={filtroFuncao} onChange={e => setFiltroFuncao(e.target.value)}>
            <option value="">Todas as funções</option>
            {funcoes.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>

        {/* Contagem */}
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          {lista.length} colaborador{lista.length !== 1 ? 'es' : ''} encontrado{lista.length !== 1 ? 's' : ''}
        </p>

        {/* Lista */}
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando…</p>
        ) : lista.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
            <UsersIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: 15, marginBottom: 8 }}>Nenhum colaborador encontrado</p>
            <p style={{ fontSize: 13 }}>Cadastre motoristas, supervisores e aprovadores aqui.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lista.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap' }}>
                {/* Avatar */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: e.ativo ? '#6366f1' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: 'white', flexShrink: 0 }}>
                  {e.nome?.[0]?.toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {e.nome}
                    {!e.ativo && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'rgba(100,100,100,0.2)', color: 'var(--text-secondary)' }}>Inativo</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {e.funcoes_efetivo?.nome && <span>{e.funcoes_efetivo.nome}</span>}
                    {e.cargo && <span>{e.funcoes_efetivo?.nome ? ' · ' : ''}{e.cargo}</span>}
                    {e.matricula && <span> · #{e.matricula}</span>}
                  </div>
                </div>

                {/* Contatos */}
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 160 }}>
                  {e.celular && <div>📱 {e.celular}</div>}
                  {e.email && <div>✉️ {e.email}</div>}
                </div>

                {/* Flags ativas */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {FLAGS.filter(fl => e[fl.key]).map(fl => (
                    <span key={fl.key} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', fontWeight: 600 }}>
                      {fl.label}
                    </span>
                  ))}
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  <button onClick={() => { setEditing(e); setShowModal(true) }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 6 }}>
                    <PencilIcon style={{ width: 15, height: 15 }} />
                  </button>
                  <button onClick={() => handleDelete(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6 }}>
                    <TrashIcon style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <EfetivoModal
          item={editing}
          workspaceId={workspaceId}
          funcoes={funcoes}
          equipes={equipes}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
