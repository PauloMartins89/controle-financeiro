import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, BriefcaseIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const FLAGS = [
  { key: 'usa_whatsapp',        label: 'Usa WhatsApp',         desc: 'Recebe e envia mensagens pelo WhatsApp' },
  { key: 'usa_email',           label: 'Usa E-mail',           desc: 'Recebe notificações por e-mail' },
  { key: 'pode_aprovar',        label: 'Pode Aprovar',         desc: 'Pode responder SIM/NÃO a solicitações' },
  { key: 'pode_solicitar',      label: 'Pode Solicitar',       desc: 'Pode criar refeições e compras' },
  { key: 'recebe_notificacoes', label: 'Recebe Notificações',  desc: 'Recebe alertas de status de lançamentos' },
]

const EMPTY = {
  nome: '', descricao: '',
  usa_whatsapp: false, usa_email: false,
  pode_aprovar: false, pode_solicitar: false, recebe_notificacoes: false,
  ativo: true,
}

function FuncaoModal({ funcao, workspaceId, onClose, onSaved }) {
  const [form, setForm] = useState(funcao ? { ...funcao } : { ...EMPTY })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.nome.trim()) { toast.error('Informe o nome da função'); return }
    setSaving(true)
    const payload = { ...form, nome: form.nome.trim(), descricao: form.descricao?.trim() || null, workspace_id: workspaceId }
    let error
    if (funcao) {
      ;({ error } = await supabase.from('funcoes_efetivo').update(payload).eq('id', funcao.id))
    } else {
      ;({ error } = await supabase.from('funcoes_efetivo').insert(payload))
    }
    setSaving(false)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success(funcao ? 'Função atualizada!' : 'Função criada!')
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{funcao ? 'Editar Função' : 'Nova Função'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <XMarkIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Nome da Função *</label>
            <input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Supervisor, Motorista, Aprovador" />
          </div>
          <div>
            <label className="label">Descrição</label>
            <input className="input" value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Opcional" />
          </div>

          <div>
            <label className="label" style={{ marginBottom: 10 }}>Capacidades padrão desta função</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FLAGS.map(flag => (
                <label key={flag.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: form[flag.key] ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!form[flag.key]}
                    onChange={e => setForm(f => ({ ...f, [flag.key]: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: form[flag.key] ? '#a5b4fc' : 'var(--text-secondary)' }}>{flag.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{flag.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} style={{ accentColor: '#6366f1' }} />
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Função ativa</span>
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

export default function Funcoes() {
  const { workspaceId } = useStore()
  const [funcoes, setFuncoes]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState(null)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('funcoes_efetivo')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('nome')
    if (error) toast.error('Erro ao carregar funções')
    setFuncoes(data || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (!confirm('Remover esta função? Colaboradores vinculados perderão o vínculo.')) return
    const { error } = await supabase.from('funcoes_efetivo').delete().eq('id', id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Função removida')
    load()
  }

  const flagAtiva = (f, key) => f[key] ? '✓' : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header title="Funções do Efetivo" />

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* Topo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Funções</h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Defina os papéis e capacidades padrão para cada tipo de colaborador.
            </p>
          </div>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => { setEditing(null); setShowModal(true) }}>
            <PlusIcon style={{ width: 16, height: 16 }} /> Nova Função
          </button>
        </div>

        {/* Tabela */}
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando…</p>
        ) : funcoes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
            <BriefcaseIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: 15, marginBottom: 8 }}>Nenhuma função cadastrada</p>
            <p style={{ fontSize: 13 }}>Crie funções como "Supervisor", "Motorista", "Aprovador" para organizar o efetivo.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Função', 'WA', 'Email', 'Aprovar', 'Solicitar', 'Notif.', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funcoes.map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid var(--bg-secondary)' }}>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{f.nome}</div>
                      {f.descricao && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{f.descricao}</div>}
                    </td>
                    {['usa_whatsapp','usa_email','pode_aprovar','pode_solicitar','recebe_notificacoes'].map(key => (
                      <td key={key} style={{ padding: '12px 12px', color: f[key] ? '#6ee7b7' : 'var(--text-secondary)', fontWeight: f[key] ? 700 : 400 }}>{flagAtiva(f, key)}</td>
                    ))}
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: f.ativo ? 'rgba(16,185,129,0.15)' : 'rgba(100,100,100,0.15)', color: f.ativo ? '#6ee7b7' : 'var(--text-secondary)' }}>
                        {f.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setEditing(f); setShowModal(true) }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
                          <PencilIcon style={{ width: 15, height: 15 }} />
                        </button>
                        <button onClick={() => handleDelete(f.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}>
                          <TrashIcon style={{ width: 15, height: 15 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <FuncaoModal
          funcao={editing}
          workspaceId={workspaceId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
