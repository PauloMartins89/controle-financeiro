import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  PlusIcon, PencilIcon, XMarkIcon,
  CheckCircleIcon, ClockIcon, XCircleIcon, ShieldCheckIcon,
  MagnifyingGlassIcon, UserIcon,
} from '@heroicons/react/24/outline'

// -- helpers ------------------------------------------------------------------
const lbl = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: 0.5, marginBottom: 5,
}

function fmtDt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

// -- domínio -------------------------------------------------------------------
const MOTIVO_LABEL = {
  novo:             'Novo colaborador',
  troca_vencido:    'Troca por desgaste',
  troca_danificado: 'Troca por dano',
  perda:            'Perda / extravio',
  outro:            'Outro',
}

const STATUS_CFG = {
  pendente:  { label: 'Pendente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  Icon: ClockIcon },
  aprovado:  { label: 'Aprovado',  color: '#6366f1', bg: 'rgba(99,102,241,0.15)',  Icon: CheckCircleIcon },
  reprovado: { label: 'Reprovado', color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   Icon: XCircleIcon },
  entregue:  { label: 'Entregue',  color: '#10b981', bg: 'rgba(16,185,129,0.15)',  Icon: CheckCircleIcon },
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

// -- Modal genÉrico ------------------------------------------------------------
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

// -- componente principal ------------------------------------------------------
export default function LiderEpi() {
  const location    = useLocation()
  const workspaceId = useStore(s => s.workspaceId)
  const path = location.pathname
  const secao = path.includes('/epc/') ? 'catalogo-epc'
              : path.includes('/epi/catalogo') ? 'catalogo-epi'
              : 'solicitacoes'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="?? Controle de EPIs / EPCs" subtitle="Solicitações, catálogo individual e coletivo" />
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {secao === 'solicitacoes' && <SecaoSolicitacoes workspaceId={workspaceId} />}
        {secao === 'catalogo-epi' && <SecaoCatalogoEPI  workspaceId={workspaceId} />}
        {secao === 'catalogo-epc' && <SecaoCatalogoEPC  workspaceId={workspaceId} />}
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------------
// SEÇÃO — SOLICITAÇõES
// -------------------------------------------------------------------------------
function SecaoSolicitacoes({ workspaceId }) {
  const [rows,              setRows]              = useState([])
  const [loading,           setLoading]           = useState(true)
  const [filtroStatus,      setFiltroStatus]      = useState('pendente')
  const [filtroEquipe,      setFiltroEquipe]      = useState('')
  const [buscaColaborador,  setBuscaColaborador]  = useState('')
  const [equipes,           setEquipes]           = useState([])
  const [modalFoto,         setModalFoto]         = useState(null)
  const [modalReprovar,     setModalReprovar]     = useState(null)
  const [motivoReprov,      setMotivoReprov]      = useState('')
  const [saving,            setSaving]            = useState(false)

  const carregar = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    let q = supabase
      .from('lider_solicitacoes_epi')
      .select(`
        id, colaborador_nome, epi_nome, quantidade, motivo,
        observacao, foto_url, status, motivo_reprovacao,
        solicitado_em, aprovado_em, aprovado_por,
        lider_turnos ( frente_nome, equipe_nome, turno, data )
      `)
      .eq('workspace_id', workspaceId)
      .is('excluido_em', null)
      .order('solicitado_em', { ascending: false })

    if (filtroStatus !== 'todos') q = q.eq('status', filtroStatus)
    if (filtroEquipe)             q = q.eq('lider_turnos.equipe_nome', filtroEquipe)

    const { data, error } = await q
    if (error) toast.error(error.message)
    else setRows(data ?? [])
    setLoading(false)
  }, [workspaceId, filtroStatus, filtroEquipe])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (!workspaceId) return
    supabase.from('lider_equipes').select('id, nome').eq('workspace_id', workspaceId).eq('ativo', true).order('nome')
      .then(({ data }) => setEquipes(data ?? []))
  }, [workspaceId])

  async function aprovar(id) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('lider_solicitacoes_epi').update({
      status:      'aprovado',
      aprovado_por: user?.email,
      aprovado_em:  new Date().toISOString(),
    }).eq('id', id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('EPI aprovado')
    carregar()
  }

  async function confirmarReprovacao() {
    if (!motivoReprov.trim()) { toast.error('Informe o motivo da reprovaçÃo'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('lider_solicitacoes_epi').update({
      status:            'reprovado',
      motivo_reprovacao: motivoReprov.trim(),
      aprovado_por:      user?.email,
      aprovado_em:       new Date().toISOString(),
    }).eq('id', modalReprovar)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('SolicitaçÃo reprovada')
    setModalReprovar(null); setMotivoReprov(''); carregar()
  }

  async function marcarEntregue(id) {
    setSaving(true)
    const { error } = await supabase.from('lider_solicitacoes_epi').update({ status: 'entregue' }).eq('id', id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('EPI marcado como entregue')
    carregar()
  }

  const contadores = { pendente: 0, aprovado: 0, reprovado: 0, entregue: 0 }
  rows.forEach(r => { if (contadores[r.status] !== undefined) contadores[r.status]++ })

  const rowsFiltrados = buscaColaborador.trim()
    ? rows.filter(r => r.colaborador_nome?.toLowerCase().includes(buscaColaborador.toLowerCase().trim()))
    : rows

  return (
    <div>
      {/* -- Filtros ------------------------------------------------------- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>
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

        <select
          value={filtroEquipe}
          onChange={e => setFiltroEquipe(e.target.value)}
          className="input"
          style={{ width: 180, fontSize: 12 }}
        >
          <option value="">Todas as equipes</option>
          {equipes.map(e => <option key={e.id} value={e.nome}>{e.nome}</option>)}
        </select>

        {/* Busca por colaborador */}
        <div style={{ position: 'relative' }}>
          <UserIcon style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input
            className="input"
            value={buscaColaborador}
            onChange={e => setBuscaColaborador(e.target.value)}
            placeholder="Buscar colaborador…"
            style={{ paddingLeft: 28, width: 180, fontSize: 12 }}
          />
          {buscaColaborador && (
            <button onClick={() => setBuscaColaborador('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, display: 'flex' }}>
              <XMarkIcon style={{ width: 13, height: 13 }} />
            </button>
          )}
        </div>
      </div>

      {/* -- ConteÚdo ------------------------------------------------------ */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : rowsFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>??</div>
          <p style={{ fontSize: 13 }}>
            {buscaColaborador.trim() ? `Nenhum colaborador encontrado para "${buscaColaborador.trim()}"` : 'Nenhuma solicitaçÃo de EPI encontrada'}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
                  {['Data', 'Colaborador', 'EPI', 'Qtd', 'Motivo', 'Frente / Equipe', 'Foto', 'Status', 'Ações'].map(h => (
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
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDt(row.solicitado_em)}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.colaborador_nome}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>{row.epi_nome}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{row.quantidade}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{MOTIVO_LABEL[row.motivo] ?? row.motivo}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11 }}>
                        {turno ? (
                          <span>{turno.frente_nome}<br />{turno.equipe_nome} · {fmtData(turno.data)}</span>
                        ) : <span style={{ fontStyle: 'italic' }}>Sem turno</span>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {row.foto_url
                          ? <button onClick={() => setModalFoto(row.foto_url)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, textDecoration: 'underline' }}>Ver foto</button>
                          : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—/span>}
                      </td>
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
                        {row.observacao && (
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.observacao}>
                            {row.observacao}
                          </p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -- Modal Foto ---------------------------------------------------- */}
      {modalFoto && (
        <div className="modal-overlay" onClick={() => setModalFoto(null)}>
          <div style={{ position: 'relative', maxWidth: 520, width: '100%' }} onClick={e => e.stopPropagation()}>
            <img src={modalFoto} alt="Foto do EPI" style={{ width: '100%', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
            <button
              onClick={() => setModalFoto(null)}
              style={{ position: 'absolute', top: 8, right: 8, background: 'var(--bg-primary)', border: 'none', color: 'var(--text-primary)', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >?</button>
          </div>
        </div>
      )}

      {/* -- Modal Reprovar ------------------------------------------------ */}
      {modalReprovar && (
        <Modal title="Reprovar solicitaçÃo" onClose={() => setModalReprovar(null)} maxWidth={440}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Informe o motivo da reprovaçÃo. O líder será notificado.</p>
          <label style={lbl}>Motivo *</label>
          <textarea
            value={motivoReprov}
            onChange={e => setMotivoReprov(e.target.value)}
            rows={3}
            placeholder="Ex: EPI disponível no almoxarifado..."
            className="input"
            style={{ resize: 'none', height: 'auto' }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setModalReprovar(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
            <button
              onClick={confirmarReprovacao}
              disabled={saving}
              style={{ fontSize: 13, padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 600 }}
            >{saving ? 'Salvando...' : 'Confirmar reprovaçÃo'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// -------------------------------------------------------------------------------
// SEÇÃO — CATÁLOGO DE EPIs (Individual — por colaborador)
// -------------------------------------------------------------------------------
function SecaoCatalogoEPI({ workspaceId }) {
  const [epis,       setEpis]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(null) // null | 'novo' | {id, nome, ca}
  const [nome,       setNome]       = useState('')
  const [ca,         setCa]         = useState('')
  const [saving,     setSaving]     = useState(false)
  const [busca,      setBusca]      = useState('')
  const [dropOpen,   setDropOpen]   = useState(false)

  const carregar = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase.from('lider_epis').select('id, nome, ca, ativo, created_at').eq('workspace_id', workspaceId).order('nome')
    setEpis(data ?? [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo()      { setNome(''); setCa(''); setModal('novo') }
  function abrirEditar(epi) { setNome(epi.nome); setCa(epi.ca ?? ''); setModal(epi) }

  async function salvar() {
    if (!nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = { nome: nome.trim(), ca: ca.trim() || null }
    const { error } = modal === 'novo'
      ? await supabase.from('lider_epis').insert({ ...payload, workspace_id: workspaceId })
      : await supabase.from('lider_epis').update(payload).eq('id', modal.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(modal === 'novo' ? 'EPI cadastrado' : 'EPI atualizado')
    setModal(null); carregar()
  }

  async function toggleAtivo(epi) {
    const { error } = await supabase.from('lider_epis').update({ ativo: !epi.ativo }).eq('id', epi.id)
    if (error) { toast.error(error.message); return }
    toast.success(epi.ativo ? 'EPI desativado' : 'EPI reativado')
    carregar()
  }

  const ativos = epis.filter(e => e.ativo).length
  const episFiltrados = busca.trim()
    ? epis.filter(e => e.nome.toLowerCase().includes(busca.toLowerCase().trim()) || (e.ca ?? '').includes(busca.trim()))
    : epis

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Catálogo de EPIs</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 10 }}>{ativos} ativo{ativos !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={abrirNovo} className="btn-primary" style={{ fontSize: 13, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
          <PlusIcon style={{ width: 14, height: 14 }} /> Novo EPI
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : epis.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>??</div>
          <p style={{ fontSize: 13 }}>Nenhum EPI cadastrado ainda</p>
        </div>
      ) : (
        <div>
          {/* -- Campo de busca / autocomplete ----------------------- */}
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <input
              className="input"
              value={busca}
              onChange={e => { setBusca(e.target.value); setDropOpen(true) }}
              onFocus={() => setDropOpen(true)}
              onBlur={() => setTimeout(() => setDropOpen(false), 150)}
              placeholder="Localizar EPI por nome ou CA…"
              style={{ paddingLeft: 32, fontSize: 13 }}
              autoComplete="off"
            />
            {busca && (
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setBusca(''); setDropOpen(true) }}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, display: 'flex' }}
              >
                <XMarkIcon style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>

          {/* -- Dropdown de resultados ------------------------------- */}
          {dropOpen && (
            <div
              className="card"
              style={{ padding: 0, overflow: 'hidden', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', maxHeight: 360, overflowY: 'auto' }}
              onMouseDown={e => e.preventDefault()}
            >
              {episFiltrados.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                  Nenhum EPI encontrado para &ldquo;{busca}&rdquo;
                </div>
              ) : (
                episFiltrados.map((epi, i) => (
                  <div
                    key={epi.id}
                    style={{
                      padding: '10px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                      borderBottom: i < episFiltrados.length - 1 ? '1px solid var(--border)' : 'none',
                      opacity: epi.ativo ? 1 : 0.55,
                      background: 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{epi.nome}</span>
                      {epi.ca
                        ? <span className="badge badge-accent" style={{ fontSize: 10, marginLeft: 8 }}>CA {epi.ca}</span>
                        : <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8, fontStyle: 'italic' }}>Sem CA</span>}
                      {!epi.ativo && <span className="badge badge-danger" style={{ fontSize: 10, marginLeft: 6 }}>Inativo</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => { abrirEditar(epi); setDropOpen(false) }}
                        style={{ background: 'rgba(99,102,241,0.12)', border: 'none', color: '#818cf8', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}
                      >
                        <PencilIcon style={{ width: 13, height: 13 }} />
                      </button>
                      <button
                        onClick={() => toggleAtivo(epi)}
                        style={{ background: epi.ativo ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.12)', border: 'none', color: epi.ativo ? '#f87171' : '#34d399', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                      >
                        {epi.ativo ? 'Desativar' : 'Reativar'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* -- Legenda quando dropdown fechado --------------------- */}
          {!dropOpen && !busca && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              {ativos} EPI{ativos !== 1 ? 's' : ''} ativo{ativos !== 1 ? 's' : ''} · clique no campo para listar todos
            </p>
          )}
        </div>
      )}

      {modal && (
        <Modal title={modal === 'novo' ? 'Novo EPI' : `Editar: ${modal.nome}`} onClose={() => setModal(null)} maxWidth={400}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}>Nome *</label>
              <input className="input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Capacete de segurança" />
            </div>
            <div>
              <label style={lbl}>CA (Certificado de AprovaçÃo)</label>
              <input className="input" value={ca} onChange={e => setCa(e.target.value)} placeholder="Ex: 12345" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setModal(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
            <button onClick={salvar} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// -------------------------------------------------------------------------------
// SEÇÃO — CATÁLOGO DE EPCs (Coletivo — por módulo / frente de trabalho)
// -------------------------------------------------------------------------------
function SecaoCatalogoEPC({ workspaceId }) {
  const [epcs,     setEpcs]    = useState([])
  const [loading,  setLoading] = useState(true)
  const [modal,    setModal]   = useState(null) // null | 'novo' | {id,...}
  const [nome,     setNome]    = useState('')
  const [ca,       setCa]      = useState('')
  const [frente,   setFrente]  = useState('')
  const [frentes,  setFrente2] = useState([])
  const [saving,   setSaving]  = useState(false)

  const carregar = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase.from('lider_epcs').select('id, nome, ca, frente_nome, ativo, created_at').eq('workspace_id', workspaceId).order('nome')
    setEpcs(data ?? [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (!workspaceId) return
    supabase.from('lider_frentes').select('id, nome').eq('workspace_id', workspaceId).eq('ativo', true).order('nome')
      .then(({ data }) => setFrente2(data ?? []))
  }, [workspaceId])

  function abrirNovo()      { setNome(''); setCa(''); setFrente(''); setModal('novo') }
  function abrirEditar(e)   { setNome(e.nome); setCa(e.ca ?? ''); setFrente(e.frente_nome ?? ''); setModal(e) }

  async function salvar() {
    if (!nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const payload = { nome: nome.trim(), ca: ca.trim() || null, frente_nome: frente || null }
    const { error } = modal === 'novo'
      ? await supabase.from('lider_epcs').insert({ ...payload, workspace_id: workspaceId })
      : await supabase.from('lider_epcs').update(payload).eq('id', modal.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(modal === 'novo' ? 'EPC cadastrado' : 'EPC atualizado')
    setModal(null); carregar()
  }

  async function toggleAtivo(epc) {
    const { error } = await supabase.from('lider_epcs').update({ ativo: !epc.ativo }).eq('id', epc.id)
    if (error) { toast.error(error.message); return }
    toast.success(epc.ativo ? 'EPC desativado' : 'EPC reativado')
    carregar()
  }

  const ativos = epcs.filter(e => e.ativo).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Catálogo de EPCs</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>Equipamento de ProteçÃo Coletiva — por módulo</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 10 }}>{ativos} ativo{ativos !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={abrirNovo} className="btn-primary" style={{ fontSize: 13, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
          <PlusIcon style={{ width: 14, height: 14 }} /> Novo EPC
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        </div>
      ) : epcs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>???</div>
          <p style={{ fontSize: 13 }}>Nenhum EPC cadastrado ainda</p>
        </div>
      ) : (
        <>
          {epcs.map(epc => (
            <div key={epc.id} className="card" style={{ padding: '10px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, opacity: epc.ativo ? 1 : 0.55 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{epc.nome}</span>
                {epc.ca
                  ? <span className="badge badge-accent" style={{ fontSize: 10, marginLeft: 8 }}>CA {epc.ca}</span>
                  : <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8, fontStyle: 'italic' }}>Sem CA</span>}
                {!epc.ativo && <span className="badge badge-danger" style={{ fontSize: 10, marginLeft: 6 }}>Inativo</span>}
                {epc.frente_nome && (
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 10 }}>?? {epc.frente_nome}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => abrirEditar(epc)} style={{ background: 'rgba(99,102,241,0.12)', border: 'none', color: '#818cf8', borderRadius: 8, padding: '5px 8px', cursor: 'pointer' }}>
                  <PencilIcon style={{ width: 13, height: 13 }} />
                </button>
                <button
                  onClick={() => toggleAtivo(epc)}
                  style={{ background: epc.ativo ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.12)', border: 'none', color: epc.ativo ? '#f87171' : '#34d399', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                >
                  {epc.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {modal && (
        <Modal title={modal === 'novo' ? 'Novo EPC' : `Editar: ${modal.nome}`} onClose={() => setModal(null)} maxWidth={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}>Nome *</label>
              <input className="input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: SinalizaçÃo de segurança" />
            </div>
            <div>
              <label style={lbl}>CA (Certificado de AprovaçÃo)</label>
              <input className="input" value={ca} onChange={e => setCa(e.target.value)} placeholder="Ex: 12345" />
            </div>
            <div>
              <label style={lbl}>Módulo / Frente de trabalho</label>
              {frentes.length > 0 ? (
                <select className="input" value={frente} onChange={e => setFrente(e.target.value)}>
                  <option value="">— Sem módulo específico —</option>
                  {frentes.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                </select>
              ) : (
                <input className="input" value={frente} onChange={e => setFrente(e.target.value)} placeholder="Ex: Frente 07" />
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setModal(null)} className="btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>Cancelar</button>
            <button onClick={salvar} disabled={saving} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
