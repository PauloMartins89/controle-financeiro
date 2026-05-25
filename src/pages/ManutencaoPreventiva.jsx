import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import {
  PlusIcon, PencilIcon, TrashIcon, XMarkIcon, CheckCircleIcon,
  CalendarDaysIcon, ArrowPathIcon, BoltIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

const today = () => new Date().toISOString().slice(0, 10)
const fmtD  = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

const PERIODICIDADE = [
  { value: 'diaria',       label: 'Diária',      dias: 1 },
  { value: 'semanal',      label: 'Semanal',     dias: 7 },
  { value: 'quinzenal',    label: 'Quinzenal',   dias: 15 },
  { value: 'mensal',       label: 'Mensal',      dias: 30 },
  { value: 'trimestral',   label: 'Trimestral',  dias: 90 },
  { value: 'semestral',    label: 'Semestral',   dias: 180 },
  { value: 'anual',        label: 'Anual',       dias: 365 },
]

function calcProxima(ultimaExecucao, periodicidade) {
  if (!ultimaExecucao || !periodicidade) return null
  const cfg = PERIODICIDADE.find(p => p.value === periodicidade)
  if (!cfg) return null
  const base = new Date(ultimaExecucao + 'T12:00:00')
  base.setDate(base.getDate() + cfg.dias)
  return base.toISOString().slice(0, 10)
}

const EMPTY_FORM = {
  titulo: '', descricao: '', equipamento_id: '', equipamento_nome: '',
  periodicidade: 'mensal', intervalo_horas: '', ultima_execucao: '', proxima_data: '', ativo: true,
}

function StatusPlano({ proxima }) {
  if (!proxima) return <span style={{ fontSize: 11, color: '#94a3b8' }}>Sem data</span>
  const diff = Math.ceil((new Date(proxima + 'T12:00:00') - new Date()) / 86400000)
  if (diff < 0) return <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>⚠️ Vencida ({Math.abs(diff)}d)</span>
  if (diff === 0) return <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>🔔 Vence Hoje</span>
  if (diff <= 7) return <span style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>⏰ Em {diff}d</span>
  return <span style={{ fontSize: 12, color: '#10b981' }}>{fmtD(proxima)}</span>
}

export default function ManutencaoPreventiva() {
  const { workspaceId } = useStore()
  const [lista, setLista] = useState([])
  const [equipamentos, setEquipamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [gerandoOS, setGerandoOS] = useState(null)

  useEffect(() => { if (workspaceId) init(workspaceId) }, [workspaceId]) // eslint-disable-line

  async function init(wid) {
    setLoading(true)
    const [rPlanos, rEq] = await Promise.all([
      supabase.from('manut_planos').select('*').eq('workspace_id', wid).order('proxima_data', { ascending: true, nullsFirst: false }),
      supabase.from('manut_equipamentos').select('id,nome,codigo').eq('workspace_id', wid).eq('ativo', true).order('nome'),
    ])
    setLista(rPlanos.data || [])
    setEquipamentos(rEq.data || [])
    setLoading(false)
  }

  function openNovo() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEditar(p) {
    setEditId(p.id)
    setForm({
      titulo: p.titulo || '',
      descricao: p.descricao || '',
      equipamento_id: p.equipamento_id || '',
      equipamento_nome: p.equipamento_nome || '',
      periodicidade: p.periodicidade || 'mensal',
      intervalo_horas: p.intervalo_horas ?? '',
      ultima_execucao: p.ultima_execucao || '',
      proxima_data: p.proxima_data || '',
      ativo: p.ativo !== false,
    })
    setShowModal(true)
  }

  const setField = (k, v) => setForm(f => {
    const novo = { ...f, [k]: v }
    if (k === 'ultima_execucao' || k === 'periodicidade') {
      const calc = calcProxima(k === 'ultima_execucao' ? v : f.ultima_execucao, k === 'periodicidade' ? v : f.periodicidade)
      if (calc) novo.proxima_data = calc
    }
    return novo
  })

  const onEquip = e => {
    const eq = equipamentos.find(x => x.id === e.target.value)
    setForm(f => ({ ...f, equipamento_id: e.target.value, equipamento_nome: eq ? `${eq.nome}${eq.codigo ? ` (${eq.codigo})` : ''}` : '' }))
  }

  async function salvar() {
    if (!form.titulo.trim()) return toast.error('Informe o título do plano')
    if (!form.periodicidade) return toast.error('Selecione a periodicidade')
    setSaving(true)
    const payload = {
      workspace_id: workspaceId,
      titulo: form.titulo.trim(),
      descricao: form.descricao || null,
      equipamento_id: form.equipamento_id || null,
      equipamento_nome: form.equipamento_nome || null,
      periodicidade: form.periodicidade,
      intervalo_horas: form.intervalo_horas !== '' ? Number(form.intervalo_horas) : null,
      ultima_execucao: form.ultima_execucao || null,
      proxima_data: form.proxima_data || null,
      ativo: form.ativo,
    }
    if (editId) {
      const { error } = await supabase.from('manut_planos').update(payload).eq('id', editId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Plano atualizado')
    } else {
      const { error } = await supabase.from('manut_planos').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Plano criado')
    }
    setSaving(false)
    setShowModal(false)
    init(workspaceId)
  }

  async function excluir(p) {
    if (!confirm(`Excluir plano "${p.titulo}"?`)) return
    await supabase.from('manut_planos').delete().eq('id', p.id)
    toast.success('Plano excluído')
    init(workspaceId)
  }

  async function gerarOS(plano) {
    setGerandoOS(plano.id)
    // Buscar próximo número
    const { data: osLista } = await supabase.from('manut_os').select('numero').eq('workspace_id', workspaceId)
    const ano = new Date().getFullYear()
    const nums = (osLista || []).map(o => o.numero).filter(n => n?.startsWith(`OS-${ano}-`)).map(n => parseInt(n.split('-')[2] || '0', 10))
    const max = nums.length > 0 ? Math.max(...nums) : 0
    const numero = `OS-${ano}-${String(max + 1).padStart(6, '0')}`

    const { error } = await supabase.from('manut_os').insert({
      workspace_id: workspaceId,
      numero,
      tipo: 'preventiva',
      prioridade: 'media',
      status: 'aberta',
      titulo: `[PREV] ${plano.titulo}`,
      descricao: plano.descricao || null,
      equipamento_id: plano.equipamento_id || null,
      equipamento_nome: plano.equipamento_nome || null,
      plano_id: plano.id,
      data_abertura: today(),
    })

    if (error) { toast.error(error.message); setGerandoOS(null); return }

    // Atualiza última execução e recalcula próxima
    const proxima = calcProxima(today(), plano.periodicidade)
    await supabase.from('manut_planos').update({ ultima_execucao: today(), proxima_data: proxima }).eq('id', plano.id)

    toast.success(`OS ${numero} criada a partir do plano!`)
    setGerandoOS(null)
    init(workspaceId)
  }

  const ativos   = lista.filter(p => p.ativo !== false)
  const inativos = lista.filter(p => p.ativo === false)

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        title="Planos Preventivos"
        subtitle="Agendamento e controle de manutenção preventiva por horas / período"
        action={{ label: 'Novo Plano', icon: PlusIcon, onClick: openNovo }}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Ativos */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>📅 Planos Ativos ({ativos.length})</span>
          </div>
          {loading
            ? <div style={emptyStyle}>Carregando...</div>
            : ativos.length === 0
              ? <div style={emptyStyle}>Nenhum plano ativo</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={thStyle}>Plano</th>
                      <th style={thStyle}>Equipamento</th>
                      <th style={thStyle}>Periodicidade</th>
                      <th style={thStyle}>Última Execução</th>
                      <th style={thStyle}>Próxima Data</th>
                      <th style={thStyle}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ativos.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.titulo}</div>
                          {p.descricao && <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descricao}</div>}
                          {p.intervalo_horas && <div style={{ fontSize: 10, color: '#8b5cf6' }}>A cada {p.intervalo_horas}h</div>}
                        </td>
                        <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.equipamento_nome || '—'}</span></td>
                        <td style={tdStyle}><span style={{ fontSize: 12, color: '#8b5cf6', textTransform: 'capitalize', fontWeight: 600 }}>{PERIODICIDADE.find(x => x.value === p.periodicidade)?.label || p.periodicidade}</span></td>
                        <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtD(p.ultima_execucao)}</span></td>
                        <td style={tdStyle}><StatusPlano proxima={p.proxima_data} /></td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button title="Gerar OS agora" onClick={() => gerarOS(p)} disabled={gerandoOS === p.id} style={iconBtn('#10b981')}>
                              <BoltIcon style={{ width: 14, height: 14 }} />
                            </button>
                            <button title="Editar" onClick={() => openEditar(p)} style={iconBtn('#6366f1')}>
                              <PencilIcon style={{ width: 14, height: 14 }} />
                            </button>
                            <button title="Desativar" onClick={() => supabase.from('manut_planos').update({ ativo: false }).eq('id', p.id).then(() => init(workspaceId))} style={iconBtn('#f59e0b')}>
                              <XMarkIcon style={{ width: 14, height: 14 }} />
                            </button>
                            <button title="Excluir" onClick={() => excluir(p)} style={iconBtn('#ef4444')}>
                              <TrashIcon style={{ width: 14, height: 14 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          }
        </div>

        {/* Inativos */}
        {inativos.length > 0 && (
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-secondary)' }}>⏸ Planos Inativos ({inativos.length})</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {inativos.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', opacity: 0.6 }}>
                    <td style={tdStyle}><span style={{ color: 'var(--text-secondary)' }}>{p.titulo}</span></td>
                    <td style={tdStyle}><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.equipamento_nome || '—'}</span></td>
                    <td style={tdStyle}><span style={{ fontSize: 11, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{p.periodicidade}</span></td>
                    <td style={tdStyle}>
                      <button onClick={() => supabase.from('manut_planos').update({ ativo: true }).eq('id', p.id).then(() => init(workspaceId))} style={iconBtn('#10b981')}>
                        <ArrowPathIcon style={{ width: 14, height: 14 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editId ? 'Editar Plano' : 'Novo Plano Preventivo'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <XMarkIcon style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div>
                <label style={labelStyle}>Título *</label>
                <input value={form.titulo} onChange={e => setField('titulo', e.target.value)} placeholder="Ex: Troca de óleo motor" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Equipamento</label>
                <select value={form.equipamento_id} onChange={onEquip} style={inputStyle}>
                  <option value="">Selecione...</option>
                  {equipamentos.map(e => <option key={e.id} value={e.id}>{e.nome}{e.codigo ? ` (${e.codigo})` : ''}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Descrição / Procedimento</label>
                <textarea value={form.descricao} onChange={e => setField('descricao', e.target.value)} rows={3} placeholder="Descreva os passos ou observações do plano" style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Periodicidade *</label>
                  <select value={form.periodicidade} onChange={e => setField('periodicidade', e.target.value)} style={inputStyle}>
                    {PERIODICIDADE.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Intervalo por Horas</label>
                  <input type="number" value={form.intervalo_horas} onChange={e => setField('intervalo_horas', e.target.value)} placeholder="Ex: 250 (a cada 250h)" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Última Execução</label>
                  <input type="date" value={form.ultima_execucao} onChange={e => setField('ultima_execucao', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Próxima Data</label>
                  <input type="date" value={form.proxima_data} onChange={e => setField('proxima_data', e.target.value)} style={inputStyle} />
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Calculada automaticamente</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="ativo" checked={form.ativo} onChange={e => setField('ativo', e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                <label htmlFor="ativo" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>Plano Ativo</label>
              </div>

            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowModal(false)} style={btnSecStyle}>Cancelar</button>
              <button onClick={salvar} disabled={saving} style={btnPrimStyle}>{saving ? 'Salvando...' : editId ? 'Salvar' : 'Criar Plano'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const cardStyle = { background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }
const cardHeaderStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }
const tdStyle = { padding: '10px 14px', verticalAlign: 'middle' }
const emptyStyle = { padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }
const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }
const btnPrimStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }
const btnSecStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }
const iconBtn = color => ({ background: `rgba(${color === '#6366f1' ? '99,102,241' : color === '#10b981' ? '16,185,129' : color === '#0ea5e9' ? '14,165,233' : color === '#f59e0b' ? '245,158,11' : color === '#ef4444' ? '239,68,68' : '148,163,184'},0.12)`, border: 'none', color, cursor: 'pointer', borderRadius: 6, padding: '5px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' })
