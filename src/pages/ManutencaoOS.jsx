import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import {
  PlusIcon, MagnifyingGlassIcon, FunnelIcon, XMarkIcon, PencilIcon,
  CheckCircleIcon, PlayIcon, ArrowPathIcon, TrashIcon, ClipboardDocumentListIcon,
  WrenchScrewdriverIcon, CalendarDaysIcon, ExclamationTriangleIcon,
  ChevronDownIcon, ClockIcon,
} from '@heroicons/react/24/outline'

const today = () => new Date().toISOString().slice(0, 10)
const fmtD  = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
const fmtDT = d => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const STATUS_CFG = {
  aberta:          { label: 'Aberta',          color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  em_andamento:    { label: 'Em Andamento',     color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  aguardando_peca: { label: 'Aguard. Peça',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  concluida:       { label: 'Concluída',        color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  cancelada:       { label: 'Cancelada',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}
const PRIOR_CFG = {
  critica: { label: 'Crítica', color: '#ef4444' },
  alta:    { label: 'Alta',    color: '#f97316' },
  media:   { label: 'Média',   color: '#f59e0b' },
  baixa:   { label: 'Baixa',   color: '#10b981' },
}
const TIPO_CFG = {
  corretiva:  { label: 'Corretiva',  icon: '🔧' },
  preventiva: { label: 'Preventiva', icon: '📅' },
  preditiva:  { label: 'Preditiva',  icon: '📊' },
  melhoria:   { label: 'Melhoria',   icon: '⬆️' },
}

function Badge({ cfg }) {
  return <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.label}</span>
}

function PriorBadge({ p }) {
  const c = PRIOR_CFG[p] || { label: p, color: '#94a3b8' }
  return <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>● {c.label}</span>
}

function nextNumero(lista) {
  const ano = new Date().getFullYear()
  const nums = lista
    .map(o => o.numero)
    .filter(n => n && n.startsWith(`OS-${ano}-`))
    .map(n => parseInt(n.split('-')[2] || '0', 10))
  const max = nums.length > 0 ? Math.max(...nums) : 0
  return `OS-${ano}-${String(max + 1).padStart(6, '0')}`
}

const EMPTY_FORM = {
  tipo: 'corretiva', prioridade: 'media', status: 'aberta',
  titulo: '', descricao: '', solicitante: '',
  equipamento_id: '', equipamento_nome: '',
  tecnico_id: '', tecnico_nome: '',
  data_abertura: today(), data_prevista: '',
  horimetro_abertura: '', causa_raiz: '', resolucao: '',
  observacoes: '', custo_total: '',
}

export default function ManutencaoOS() {
  const { workspaceId } = useStore()
  const [params] = useSearchParams()

  const [lista, setLista] = useState([])
  const [equipamentos, setEquipamentos] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState(params.get('status') || '')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroPrior, setFiltroPrior] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [itens, setItens] = useState([])
  const [novoItem, setNovoItem] = useState({ descricao: '', quantidade: 1, unidade: 'un', custo_unit: '' })
  const [showItens, setShowItens] = useState(false)

  useEffect(() => { if (workspaceId) init(workspaceId) }, [workspaceId]) // eslint-disable-line
  useEffect(() => {
    if (params.get('nova')) openNova(params.get('nova'))
  }, []) // eslint-disable-line

  async function init(wid) {
    setLoading(true)
    const [rOs, rEq, rTec] = await Promise.all([
      supabase.from('manut_os').select('*').eq('workspace_id', wid).order('created_at', { ascending: false }),
      supabase.from('manut_equipamentos').select('id,nome,codigo').eq('workspace_id', wid).eq('ativo', true).order('nome'),
      supabase.from('manut_tecnicos').select('id,nome,especialidade').eq('workspace_id', wid).eq('ativo', true).order('nome'),
    ])
    setLista(rOs.data || [])
    setEquipamentos(rEq.data || [])
    setTecnicos(rTec.data || [])
    setLoading(false)
  }

  function openNova(tipo) {
    setEditId(null)
    setItens([])
    setForm({ ...EMPTY_FORM, tipo: ['corretiva', 'preventiva', 'preditiva', 'melhoria'].includes(tipo) ? tipo : 'corretiva' })
    setShowModal(true)
    setShowItens(false)
  }

  function openEditar(os) {
    setEditId(os.id)
    setForm({
      tipo: os.tipo || 'corretiva',
      prioridade: os.prioridade || 'media',
      status: os.status || 'aberta',
      titulo: os.titulo || '',
      descricao: os.descricao || '',
      solicitante: os.solicitante || '',
      equipamento_id: os.equipamento_id || '',
      equipamento_nome: os.equipamento_nome || '',
      tecnico_id: os.tecnico_id || '',
      tecnico_nome: os.tecnico_nome || '',
      data_abertura: os.data_abertura || today(),
      data_prevista: os.data_prevista || '',
      horimetro_abertura: os.horimetro_abertura ?? '',
      causa_raiz: os.causa_raiz || '',
      resolucao: os.resolucao || '',
      observacoes: os.observacoes || '',
      custo_total: os.custo_total ?? '',
    })
    loadItens(os.id)
    setShowModal(true)
    setShowItens(true)
  }

  async function loadItens(osId) {
    const { data } = await supabase.from('manut_os_itens').select('*').eq('os_id', osId).order('created_at')
    setItens(data || [])
  }

  async function salvar() {
    if (!form.titulo.trim()) return toast.error('Informe o título da OS')
    setSaving(true)
    const payload = {
      workspace_id: workspaceId,
      tipo: form.tipo,
      prioridade: form.prioridade,
      status: form.status,
      titulo: form.titulo.trim(),
      descricao: form.descricao || null,
      solicitante: form.solicitante || null,
      equipamento_id: form.equipamento_id || null,
      equipamento_nome: form.equipamento_nome || null,
      tecnico_id: form.tecnico_id || null,
      tecnico_nome: form.tecnico_nome || null,
      data_abertura: form.data_abertura || today(),
      data_prevista: form.data_prevista || null,
      horimetro_abertura: form.horimetro_abertura !== '' ? Number(form.horimetro_abertura) : null,
      causa_raiz: form.causa_raiz || null,
      resolucao: form.resolucao || null,
      observacoes: form.observacoes || null,
      custo_total: form.custo_total !== '' ? Number(form.custo_total) : null,
    }

    if (editId) {
      const { error } = await supabase.from('manut_os').update(payload).eq('id', editId)
      if (error) { toast.error('Erro ao salvar: ' + error.message); setSaving(false); return }
      toast.success('OS atualizada')
    } else {
      payload.numero = nextNumero(lista)
      if (payload.status === 'em_andamento' && !payload.data_inicio) payload.data_inicio = new Date().toISOString()
      const { error } = await supabase.from('manut_os').insert(payload)
      if (error) { toast.error('Erro ao criar: ' + error.message); setSaving(false); return }
      toast.success('OS criada: ' + payload.numero)
    }

    setSaving(false)
    setShowModal(false)
    init(workspaceId)
  }

  async function mudarStatus(os, novoStatus) {
    const up = { status: novoStatus }
    if (novoStatus === 'em_andamento' && !os.data_inicio) up.data_inicio = new Date().toISOString()
    if (novoStatus === 'concluida') up.data_conclusao = new Date().toISOString()
    const { error } = await supabase.from('manut_os').update(up).eq('id', os.id)
    if (error) return toast.error(error.message)
    toast.success(`OS → ${STATUS_CFG[novoStatus]?.label}`)
    init(workspaceId)
  }

  async function deletar(os) {
    if (!confirm(`Excluir OS ${os.numero || os.id.slice(0, 8)}?`)) return
    await supabase.from('manut_os').delete().eq('id', os.id)
    toast.success('OS excluída')
    init(workspaceId)
  }

  async function addItem() {
    if (!novoItem.descricao.trim() || !editId) return
    const custo_total = novoItem.custo_unit && novoItem.quantidade ? Number(novoItem.custo_unit) * Number(novoItem.quantidade) : null
    const { data, error } = await supabase.from('manut_os_itens').insert({
      os_id: editId,
      descricao: novoItem.descricao.trim(),
      quantidade: Number(novoItem.quantidade) || 1,
      unidade: novoItem.unidade,
      custo_unit: novoItem.custo_unit !== '' ? Number(novoItem.custo_unit) : null,
      custo_total,
    }).select().single()
    if (error) return toast.error(error.message)
    setItens(prev => [...prev, data])
    setNovoItem({ descricao: '', quantidade: 1, unidade: 'un', custo_unit: '' })
    // Atualiza custo total da OS
    const total = [...itens, data].reduce((s, i) => s + (i.custo_total || 0), 0)
    await supabase.from('manut_os').update({ custo_total: total }).eq('id', editId)
  }

  async function removeItem(id) {
    await supabase.from('manut_os_itens').delete().eq('id', id)
    const novos = itens.filter(i => i.id !== id)
    setItens(novos)
    if (editId) {
      const total = novos.reduce((s, i) => s + (i.custo_total || 0), 0)
      await supabase.from('manut_os').update({ custo_total: total }).eq('id', editId)
    }
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const onEquip = e => {
    const eq = equipamentos.find(x => x.id === e.target.value)
    setField('equipamento_id', e.target.value)
    setField('equipamento_nome', eq ? `${eq.nome}${eq.codigo ? ` (${eq.codigo})` : ''}` : '')
  }
  const onTec = e => {
    const t = tecnicos.find(x => x.id === e.target.value)
    setField('tecnico_id', e.target.value)
    setField('tecnico_nome', t ? t.nome : '')
  }

  const filtrado = lista.filter(os => {
    if (filtroStatus && os.status !== filtroStatus) return false
    if (filtroTipo && os.tipo !== filtroTipo) return false
    if (filtroPrior && os.prioridade !== filtroPrior) return false
    if (busca) {
      const b = busca.toLowerCase()
      return (os.titulo?.toLowerCase().includes(b) || os.numero?.toLowerCase().includes(b) || os.equipamento_nome?.toLowerCase().includes(b))
    }
    return true
  })

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        title="Ordens de Serviço"
        subtitle="Gestão de OS corretivas, preventivas e preditivas"
        action={{ label: 'Nova OS', icon: PlusIcon, onClick: () => openNova('corretiva') }}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-secondary)' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por título, número ou equipamento..." style={{ ...inputStyle, paddingLeft: 32, width: '100%' }} />
          </div>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={selectStyle}>
            <option value="">Todos os Status</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={selectStyle}>
            <option value="">Todos os Tipos</option>
            {Object.entries(TIPO_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <select value={filtroPrior} onChange={e => setFiltroPrior(e.target.value)} style={selectStyle}>
            <option value="">Todas Prioridades</option>
            {Object.entries(PRIOR_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {(filtroStatus || filtroTipo || filtroPrior || busca) && (
            <button onClick={() => { setBusca(''); setFiltroStatus(''); setFiltroTipo(''); setFiltroPrior('') }} style={btnSecStyle}>
              <XMarkIcon style={{ width: 13, height: 13 }} /> Limpar
            </button>
          )}
        </div>

        {/* Tabela */}
        <div style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>Nº / Título</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Prioridade</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Equipamento</th>
                <th style={thStyle}>Técnico</th>
                <th style={thStyle}>Abertura</th>
                <th style={thStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando...</td></tr>
                : filtrado.length === 0
                  ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma OS encontrada</td></tr>
                  : filtrado.map(os => {
                    const sc = STATUS_CFG[os.status] || {}
                    const tc = TIPO_CFG[os.tipo] || {}
                    const diasAtraso = os.data_prevista && ['aberta', 'em_andamento', 'aguardando_peca'].includes(os.status)
                      ? Math.ceil((new Date() - new Date(os.data_prevista + 'T12:00:00')) / 86400000)
                      : null
                    return (
                      <tr key={os.id} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700, fontSize: 11, color: '#6366f1' }}>{os.numero || '—'}</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: 220 }}>{os.titulo}</div>
                          {diasAtraso > 0 && <div style={{ fontSize: 10, color: '#ef4444' }}>⚠ {diasAtraso}d atrasada</div>}
                        </td>
                        <td style={tdStyle}><span style={{ fontSize: 12 }}>{tc.icon} {tc.label}</span></td>
                        <td style={tdStyle}><PriorBadge p={os.prioridade} /></td>
                        <td style={tdStyle}><Badge cfg={sc} /></td>
                        <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{os.equipamento_nome || '—'}</span></td>
                        <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{os.tecnico_nome || '—'}</span></td>
                        <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtD(os.data_abertura)}</span></td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {os.status === 'aberta' && (
                              <button title="Iniciar" onClick={() => mudarStatus(os, 'em_andamento')} style={iconBtn('#0ea5e9')}>
                                <PlayIcon style={{ width: 14, height: 14 }} />
                              </button>
                            )}
                            {['aberta', 'em_andamento', 'aguardando_peca'].includes(os.status) && (
                              <button title="Concluir" onClick={() => mudarStatus(os, 'concluida')} style={iconBtn('#10b981')}>
                                <CheckCircleIcon style={{ width: 14, height: 14 }} />
                              </button>
                            )}
                            {os.status === 'em_andamento' && (
                              <button title="Aguardando Peça" onClick={() => mudarStatus(os, 'aguardando_peca')} style={iconBtn('#f59e0b')}>
                                <ClockIcon style={{ width: 14, height: 14 }} />
                              </button>
                            )}
                            {os.status === 'aguardando_peca' && (
                              <button title="Retomar" onClick={() => mudarStatus(os, 'em_andamento')} style={iconBtn('#0ea5e9')}>
                                <ArrowPathIcon style={{ width: 14, height: 14 }} />
                              </button>
                            )}
                            <button title="Editar" onClick={() => openEditar(os)} style={iconBtn('#6366f1')}>
                              <PencilIcon style={{ width: 14, height: 14 }} />
                            </button>
                            {!['concluida', 'cancelada'].includes(os.status) && (
                              <button title="Cancelar" onClick={() => mudarStatus(os, 'cancelada')} style={iconBtn('#ef4444')}>
                                <XMarkIcon style={{ width: 14, height: 14 }} />
                              </button>
                            )}
                            <button title="Excluir" onClick={() => deletar(os)} style={iconBtn('#94a3b8')}>
                              <TrashIcon style={{ width: 14, height: 14 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
            {filtrado.length} de {lista.length} OS
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editId ? 'Editar OS' : 'Nova Ordem de Serviço'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <XMarkIcon style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Linha 1: tipo, prioridade, status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Tipo *</label>
                  <select value={form.tipo} onChange={e => setField('tipo', e.target.value)} style={inputStyle}>
                    {Object.entries(TIPO_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Prioridade *</label>
                  <select value={form.prioridade} onChange={e => setField('prioridade', e.target.value)} style={inputStyle}>
                    {Object.entries(PRIOR_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status *</label>
                  <select value={form.status} onChange={e => setField('status', e.target.value)} style={inputStyle}>
                    {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Título */}
              <div>
                <label style={labelStyle}>Título *</label>
                <input value={form.titulo} onChange={e => setField('titulo', e.target.value)} placeholder="Descreva brevemente o problema ou serviço" style={inputStyle} />
              </div>

              {/* Equipamento e Técnico */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Equipamento</label>
                  <select value={form.equipamento_id} onChange={onEquip} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {equipamentos.map(e => <option key={e.id} value={e.id}>{e.nome}{e.codigo ? ` (${e.codigo})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Técnico Responsável</label>
                  <select value={form.tecnico_id} onChange={onTec} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}{t.especialidade ? ` — ${t.especialidade}` : ''}</option>)}
                  </select>
                </div>
              </div>

              {/* Datas e Horimetro */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Data de Abertura *</label>
                  <input type="date" value={form.data_abertura} onChange={e => setField('data_abertura', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Data Prevista</label>
                  <input type="date" value={form.data_prevista} onChange={e => setField('data_prevista', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Horímetro Abertura</label>
                  <input type="number" value={form.horimetro_abertura} onChange={e => setField('horimetro_abertura', e.target.value)} placeholder="Ex: 2350.5" style={inputStyle} />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label style={labelStyle}>Descrição / Problema Relatado</label>
                <textarea value={form.descricao} onChange={e => setField('descricao', e.target.value)} rows={3} placeholder="Detalhe o problema ou serviço a ser executado" style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* Solicitante */}
              <div>
                <label style={labelStyle}>Solicitante</label>
                <input value={form.solicitante} onChange={e => setField('solicitante', e.target.value)} placeholder="Nome de quem abriu a OS" style={inputStyle} />
              </div>

              {/* Causa Raiz / Resolução (só se editando) */}
              {editId && <>
                <div>
                  <label style={labelStyle}>Causa Raiz</label>
                  <textarea value={form.causa_raiz} onChange={e => setField('causa_raiz', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div>
                  <label style={labelStyle}>Resolução Aplicada</label>
                  <textarea value={form.resolucao} onChange={e => setField('resolucao', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Observações</label>
                    <input value={form.observacoes} onChange={e => setField('observacoes', e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Custo Total (R$)</label>
                    <input type="number" value={form.custo_total} onChange={e => setField('custo_total', e.target.value)} placeholder="0,00" style={inputStyle} />
                  </div>
                </div>

                {/* Itens / Peças */}
                <div style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <button
                    onClick={() => setShowItens(v => !v)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}
                  >
                    <span>🔩 Peças e Materiais ({itens.length})</span>
                    <ChevronDownIcon style={{ width: 16, height: 16, transform: showItens ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                  </button>
                  {showItens && (
                    <div style={{ padding: '0 14px 14px' }}>
                      {itens.map(it => (
                        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                          <span style={{ flex: 1, color: 'var(--text-primary)' }}>{it.descricao}</span>
                          <span style={{ color: 'var(--text-secondary)', minWidth: 60 }}>{it.quantidade} {it.unidade}</span>
                          <span style={{ color: '#10b981', minWidth: 80, textAlign: 'right' }}>
                            {it.custo_total != null ? `R$ ${Number(it.custo_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                          </span>
                          <button onClick={() => removeItem(it.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}>
                            <TrashIcon style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
                      ))}
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 6, marginTop: 10 }}>
                        <input value={novoItem.descricao} onChange={e => setNovoItem(n => ({ ...n, descricao: e.target.value }))} placeholder="Descrição da peça" style={{ ...inputStyle, fontSize: 12 }} />
                        <input type="number" value={novoItem.quantidade} onChange={e => setNovoItem(n => ({ ...n, quantidade: e.target.value }))} placeholder="Qtd" style={{ ...inputStyle, fontSize: 12 }} />
                        <input value={novoItem.unidade} onChange={e => setNovoItem(n => ({ ...n, unidade: e.target.value }))} placeholder="un" style={{ ...inputStyle, fontSize: 12 }} />
                        <input type="number" value={novoItem.custo_unit} onChange={e => setNovoItem(n => ({ ...n, custo_unit: e.target.value }))} placeholder="R$ unit" style={{ ...inputStyle, fontSize: 12 }} />
                        <button onClick={addItem} style={{ ...btnPrimStyle, padding: '6px 10px' }}><PlusIcon style={{ width: 13, height: 13 }} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </>}

            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowModal(false)} style={btnSecStyle}>Cancelar</button>
              <button onClick={salvar} disabled={saving} style={btnPrimStyle}>{saving ? 'Salvando...' : editId ? 'Salvar' : 'Criar OS'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', background: 'var(--bg-secondary)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '10px 14px', verticalAlign: 'middle' }
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }
const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }
const selectStyle = { padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }
const btnPrimStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }
const btnSecStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }
const iconBtn = color => ({ background: `rgba(${color === '#6366f1' ? '99,102,241' : color === '#10b981' ? '16,185,129' : color === '#0ea5e9' ? '14,165,233' : color === '#f59e0b' ? '245,158,11' : color === '#ef4444' ? '239,68,68' : '148,163,184'},0.12)`, border: 'none', color, cursor: 'pointer', borderRadius: 6, padding: '4px 5px', display: 'flex', alignItems: 'center', justifyContent: 'center' })
