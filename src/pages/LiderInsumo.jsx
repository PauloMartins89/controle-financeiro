import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  XMarkIcon,
  CheckCircleIcon, ClockIcon, XCircleIcon, ShieldCheckIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const URGENCIA_CFG = {
  baixa:   { label: 'Baixa',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  media:   { label: 'Média',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  alta:    { label: 'Alta',    color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  urgente: { label: 'Urgente', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
}

const STATUS_CFG = {
  pendente:  { label: 'Pendente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  Icon: ClockIcon },
  aprovado:  { label: 'Aprovado',  color: '#6366f1', bg: 'rgba(99,102,241,0.15)',  Icon: CheckCircleIcon },
  reprovado: { label: 'Reprovado', color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   Icon: XCircleIcon },
  entregue:  { label: 'Entregue',  color: '#10b981', bg: 'rgba(16,185,129,0.15)',  Icon: CheckCircleIcon },
}

const lbl = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: 0.5, marginBottom: 5,
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: '#64748b', bg: 'rgba(100,116,139,0.15)', Icon: ShieldCheckIcon }
  const { Icon } = cfg
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <Icon style={{ width: 11, height: 11 }} />
      {cfg.label}
    </span>
  )
}

function UrgenciaBadge({ urgencia }) {
  const cfg = URGENCIA_CFG[urgencia] ?? { label: urgencia, color: '#64748b', bg: 'rgba(100,116,139,0.12)' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

function Modal({ title, onClose, children, maxWidth = 520 }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

// ─── página principal ─────────────────────────────────────────────────────────
export default function LiderInsumo() {
  const workspaceId = useStore(s => s.workspaceId)

  const [rows,         setRows]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('pendente')
  const [filtroUrgencia, setFiltroUrgencia] = useState('')
  const [buscaProduto, setBuscaProduto] = useState('')
  const [equipes,      setEquipes]      = useState([])
  const [filtroEquipe, setFiltroEquipe] = useState('')
  const [modalReprovar, setModalReprovar] = useState(null)
  const [motivoReprov,  setMotivoReprov]  = useState('')
  const [saving,       setSaving]       = useState(false)

  const carregar = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    let q = supabase
      .from('lider_solicitacoes_insumo')
      .select(`
        id, produto_nome, quantidade, unidade, talhao_nome,
        data_necessaria, urgencia, justificativa,
        status, motivo_reprovacao,
        solicitado_em, aprovado_em, aprovado_por,
        lider_turnos ( frente_nome, equipe_nome, lider_nome, turno, data )
      `)
      .eq('workspace_id', workspaceId)
      .is('excluido_em', null)
      .order('solicitado_em', { ascending: false })

    if (filtroStatus !== 'todos')   q = q.eq('status', filtroStatus)
    if (filtroUrgencia)             q = q.eq('urgencia', filtroUrgencia)

    const { data, error } = await q
    if (error) toast.error(error.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [workspaceId, filtroStatus, filtroUrgencia])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (!workspaceId) return
    supabase.from('lider_equipes').select('id, nome').eq('workspace_id', workspaceId).eq('ativo', true).order('nome')
      .then(({ data }) => setEquipes(data ?? []))
  }, [workspaceId])

  async function aprovar(id) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('lider_solicitacoes_insumo').update({
      status:       'aprovado',
      aprovado_por:  user?.email,
      aprovado_em:   new Date().toISOString(),
    }).eq('id', id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Solicitação aprovada')
    carregar()
  }

  async function confirmarReprovacao() {
    if (!motivoReprov.trim()) { toast.error('Informe o motivo da reprovação'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('lider_solicitacoes_insumo').update({
      status:            'reprovado',
      motivo_reprovacao: motivoReprov.trim(),
      aprovado_por:      user?.email,
      aprovado_em:       new Date().toISOString(),
    }).eq('id', modalReprovar)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Solicitação reprovada')
    setModalReprovar(null); setMotivoReprov(''); carregar()
  }

  async function marcarEntregue(id) {
    setSaving(true)
    const { error } = await supabase.from('lider_solicitacoes_insumo').update({ status: 'entregue' }).eq('id', id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Insumo marcado como entregue')
    carregar()
  }

  const contadores = { pendente: 0, aprovado: 0, reprovado: 0, entregue: 0 }
  rows.forEach(r => { if (contadores[r.status] !== undefined) contadores[r.status]++ })

  const rowsFiltrados = (() => {
    let list = rows
    if (buscaProduto.trim()) list = list.filter(r => r.produto_nome?.toLowerCase().includes(buscaProduto.toLowerCase().trim()))
    if (filtroEquipe)        list = list.filter(r => r.lider_turnos?.equipe_nome === filtroEquipe)
    return list
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="🧪 Solicitações de Insumo" subtitle="Aprovação e controle de insumos solicitados pelos líderes" />
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* ── Filtros ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>

          {/* Status */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 10, padding: 4 }}>
            {['todos', 'pendente', 'aprovado', 'reprovado', 'entregue'].map(s => {
              const cfg = STATUS_CFG[s]
              const ativo = filtroStatus === s
              return (
                <button
                  key={s}
                  onClick={() => setFiltroStatus(s)}
                  style={{
                    padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    background: ativo ? 'var(--bg-primary)' : 'transparent',
                    color: ativo ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: ativo ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'all 0.15s',
                  }}
                >
                  {s === 'todos' ? 'Todos' : cfg?.label}
                  {s !== 'todos' && contadores[s] > 0 && (
                    <span style={{ padding: '1px 6px', borderRadius: 10, background: cfg?.bg, color: cfg?.color, fontSize: 10, fontWeight: 700 }}>
                      {contadores[s]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Urgência */}
          <select
            value={filtroUrgencia}
            onChange={e => setFiltroUrgencia(e.target.value)}
            className="input"
            style={{ width: 150, fontSize: 12 }}
          >
            <option value="">Toda urgência</option>
            {['baixa', 'media', 'alta', 'urgente'].map(u => (
              <option key={u} value={u}>{URGENCIA_CFG[u]?.label ?? u}</option>
            ))}
          </select>

          {/* Equipe */}
          <select
            value={filtroEquipe}
            onChange={e => setFiltroEquipe(e.target.value)}
            className="input"
            style={{ width: 180, fontSize: 12 }}
          >
            <option value="">Todas as equipes</option>
            {equipes.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
          </select>

          {/* Busca produto */}
          <div style={{ position: 'relative' }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <input
              className="input"
              value={buscaProduto}
              onChange={e => setBuscaProduto(e.target.value)}
              placeholder="Buscar produto…"
              style={{ paddingLeft: 28, width: 190, fontSize: 12 }}
            />
            {buscaProduto && (
              <button onClick={() => setBuscaProduto('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, display: 'flex' }}>
                <XMarkIcon style={{ width: 13, height: 13 }} />
              </button>
            )}
          </div>
        </div>

        {/* ── Tabela ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : rowsFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🧪</div>
            <p style={{ fontSize: 13 }}>
              {buscaProduto.trim()
                ? `Nenhum produto encontrado para "${buscaProduto.trim()}"`
                : 'Nenhuma solicitação de insumo encontrada'}
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
                    {['Data', 'Produto', 'Qtd', 'Urgência', 'Talhão', 'Frente / Equipe / Líder', 'Nec. em', 'Status', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltrados.map((row, i) => {
                    const turno = row.lider_turnos
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDt(row.solicitado_em)}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {row.produto_nome}
                          {row.justificativa && (
                            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.justificativa}>
                              {row.justificativa}
                            </p>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{row.quantidade} {row.unidade}</td>
                        <td style={{ padding: '10px 14px' }}><UrgenciaBadge urgencia={row.urgencia} /></td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>{row.talhao_nome || '—'}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11 }}>
                          {turno ? (
                            <span>
                              {turno.frente_nome}<br />
                              {turno.equipe_nome}
                              {turno.lider_nome ? ` · ${turno.lider_nome}` : ''}
                              {turno.data ? ` · ${fmtData(turno.data)}` : ''}
                            </span>
                          ) : <span style={{ fontStyle: 'italic' }}>Sem turno</span>}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtData(row.data_necessaria)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <StatusBadge status={row.status} />
                          {row.motivo_reprovacao && (
                            <p style={{ fontSize: 11, color: '#f87171', marginTop: 4, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.motivo_reprovacao}>
                              {row.motivo_reprovacao}
                            </p>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {row.status === 'pendente' && (
                              <>
                                <button
                                  onClick={() => aprovar(row.id)}
                                  disabled={saving}
                                  className="btn-primary"
                                  style={{ fontSize: 11, padding: '4px 10px' }}
                                >Aprovar</button>
                                <button
                                  onClick={() => { setModalReprovar(row.id); setMotivoReprov('') }}
                                  style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f87171', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                                >Reprovar</button>
                              </>
                            )}
                            {row.status === 'aprovado' && (
                              <button
                                onClick={() => marcarEntregue(row.id)}
                                disabled={saving}
                                style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(16,185,129,0.12)', border: 'none', color: '#34d399', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                              >Entregue</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Modal Reprovar ───────────────────────────────────────────────── */}
        {modalReprovar && (
          <Modal title="Reprovar solicitação" onClose={() => setModalReprovar(null)} maxWidth={440}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Informe o motivo da reprovação. O líder será notificado.</p>
            <label style={lbl}>Motivo *</label>
            <textarea
              value={motivoReprov}
              onChange={e => setMotivoReprov(e.target.value)}
              rows={3}
              placeholder="Ex: produto disponível em estoque..."
              className="input"
              style={{ resize: 'none', height: 'auto' }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModalReprovar(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
              <button
                onClick={confirmarReprovacao}
                disabled={saving}
                style={{ fontSize: 13, padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 600 }}
              >{saving ? 'Salvando...' : 'Confirmar reprovação'}</button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}
