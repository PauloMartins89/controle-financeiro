import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  XMarkIcon, ExclamationTriangleIcon, CheckCircleIcon,
  WrenchScrewdriverIcon, CloudIcon, StarIcon,
  ShieldCheckIcon, EllipsisHorizontalCircleIcon,
} from '@heroicons/react/24/outline'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function hoje() { return new Date().toISOString().split('T')[0] }
function hoje30() { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] }

// ─── configs ──────────────────────────────────────────────────────────────────
const TIPO_CFG = {
  quebra_equipamento: { label: 'Quebra Equip.', icon: WrenchScrewdriverIcon, color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  acidente_pessoal:   { label: 'Acidente',      icon: ExclamationTriangleIcon, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  chuva_vento:        { label: 'Chuva/Vento',  icon: CloudIcon,              color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  qualidade:          { label: 'Qualidade',     icon: StarIcon,               color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  seguranca:          { label: 'Segurança',     icon: ShieldCheckIcon,        color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  outro:              { label: 'Outro',         icon: EllipsisHorizontalCircleIcon, color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
}

const GRAV_CFG = {
  baixa:   { label: 'Baixa',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  media:   { label: 'Média',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  alta:    { label: 'Alta',    color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  critica: { label: 'Crítica', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
}

const STATUS_CFG = {
  aberta:        { label: 'Aberta',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  em_tratamento: { label: 'Em tratamento', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  resolvida:     { label: 'Resolvida',     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
}

const tdS = { padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }

function Badge({ cfg, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label || cfg.label}
    </span>
  )
}

function TipoBadge({ tipo }) {
  const cfg = TIPO_CFG[tipo] ?? TIPO_CFG.outro
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 600 }}>
      <Icon style={{ width: 13, height: 13 }} />
      {cfg.label}
    </span>
  )
}

function Modal({ title, onClose, children, maxWidth = 540 }) {
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

const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }

// ─── página principal ─────────────────────────────────────────────────────────
export default function LiderOcorrencias() {
  const workspaceId = useStore(s => s.workspaceId)

  const [rows,        setRows]       = useState([])
  const [loading,     setLoading]    = useState(true)
  const [inicio,      setInicio]     = useState(hoje30)
  const [fim,         setFim]        = useState(hoje)
  const [filtroStatus, setFiltroStatus] = useState('aberta')
  const [filtroTipo,  setFiltroTipo] = useState('')
  const [filtroGrav,  setFiltroGrav] = useState('')
  const [filtroEquipe, setFiltroEquipe] = useState('')
  const [equipes,     setEquipes]    = useState([])
  const [detalhe,     setDetalhe]    = useState(null)
  const [saving,      setSaving]     = useState(false)

  const carregar = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    let q = supabase
      .from('lider_ocorrencias')
      .select(`
        id, tipo, descricao, gravidade, status, foto_url, observacao, created_at,
        equipe_id,
        lider_equipes(nome),
        lider_turnos(data, turno)
      `)
      .eq('workspace_id', workspaceId)
      .gte('created_at', inicio + 'T00:00:00')
      .lte('created_at', fim + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(300)

    if (filtroStatus)  q = q.eq('status', filtroStatus)
    if (filtroTipo)    q = q.eq('tipo', filtroTipo)
    if (filtroGrav)    q = q.eq('gravidade', filtroGrav)
    if (filtroEquipe)  q = q.eq('equipe_id', filtroEquipe)

    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }, [workspaceId, inicio, fim, filtroStatus, filtroTipo, filtroGrav, filtroEquipe])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (!workspaceId) return
    supabase.from('lider_equipes').select('id, nome').eq('workspace_id', workspaceId).eq('ativo', true).order('nome')
      .then(({ data }) => setEquipes(data || []))
  }, [workspaceId])

  async function atualizarStatus(id, novoStatus) {
    setSaving(true)
    const { error } = await supabase.from('lider_ocorrencias').update({ status: novoStatus }).eq('id', id)
    setSaving(false)
    if (error) { toast.error('Erro ao atualizar'); return }
    toast.success('Status atualizado')
    setDetalhe(prev => prev?.id === id ? { ...prev, status: novoStatus } : prev)
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: novoStatus } : r))
  }

  // KPIs
  const criticas  = rows.filter(r => r.gravidade === 'critica').length
  const abertas   = rows.filter(r => r.status === 'aberta').length
  const resolvidas = rows.filter(r => r.status === 'resolvida').length

  const chipStyle = (active, color = '#6366f1') => ({
    padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
    border: `1px solid ${active ? color : 'var(--border)'}`,
    background: active ? color : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
    transition: 'all .15s',
  })

  const selectStyle = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Header title="Ocorrências de Campo" />
      <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

        {/* KPIs */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total',     value: rows.length,   color: '#64748b' },
            { label: 'Abertas',   value: abertas,       color: '#ef4444' },
            { label: 'Críticas',  value: criticas,      color: '#dc2626' },
            { label: 'Resolvidas',value: resolvidas,    color: '#10b981' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '12px 20px', border: '1px solid var(--border)', minWidth: 100 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 18px', border: '1px solid var(--border)', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} style={selectStyle} />
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>até</span>
          <input type="date" value={fim} onChange={e => setFim(e.target.value)} style={selectStyle} />

          <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} style={selectStyle}>
            <option value="">Todas equipes</option>
            {equipes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>

          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={selectStyle}>
            <option value="">Todos tipos</option>
            {Object.entries(TIPO_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <select value={filtroGrav} onChange={e => setFiltroGrav(e.target.value)} style={selectStyle}>
            <option value="">Todas gravidades</option>
            {Object.entries(GRAV_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Chips de status */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { key: '',             label: 'Todos',         color: '#64748b' },
            { key: 'aberta',       label: 'Aberta',        color: '#ef4444' },
            { key: 'em_tratamento',label: 'Em tratamento', color: '#f59e0b' },
            { key: 'resolvida',    label: 'Resolvida',     color: '#10b981' },
          ].map(s => (
            <button key={s.key} onClick={() => setFiltroStatus(s.key)} style={chipStyle(filtroStatus === s.key, s.color)}>
              {s.label}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 12, alignSelf: 'center' }}>
            {rows.length} registro{rows.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Tabela */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              <ExclamationTriangleIcon style={{ width: 36, height: 36, margin: '0 auto 8px', display: 'block', color: '#10b981' }} />
              Nenhuma ocorrência encontrada
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-main)' }}>
                    {['Data/Hora', 'Equipe', 'Turno', 'Tipo', 'Descrição', 'Gravidade', 'Status', 'Ações'].map(h => (
                      <th key={h} style={{ ...tdS, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setDetalhe(r)}>
                      <td style={{ ...tdS, whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtDt(r.created_at)}</td>
                      <td style={tdS}>{r.lider_equipes?.nome || '—'}</td>
                      <td style={{ ...tdS, color: 'var(--text-secondary)' }}>
                        {r.lider_turnos ? `${r.lider_turnos.data?.slice(5).split('-').reverse().join('/')} ${r.lider_turnos.turno}` : '—'}
                      </td>
                      <td style={tdS}><TipoBadge tipo={r.tipo} /></td>
                      <td style={{ ...tdS, maxWidth: 260 }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.descricao}
                        </span>
                      </td>
                      <td style={tdS}><Badge cfg={GRAV_CFG[r.gravidade] ?? GRAV_CFG.media} /></td>
                      <td style={tdS}><Badge cfg={STATUS_CFG[r.status] ?? STATUS_CFG.aberta} /></td>
                      <td style={tdS} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {r.status !== 'resolvida' && (
                            <button
                              disabled={saving}
                              onClick={() => atualizarStatus(r.id, r.status === 'aberta' ? 'em_tratamento' : 'resolvida')}
                              style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: r.status === 'aberta' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', color: r.status === 'aberta' ? '#f59e0b' : '#10b981' }}
                            >
                              {r.status === 'aberta' ? 'Tratar' : 'Resolver'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalhe */}
      {detalhe && (
        <Modal title="Detalhe da Ocorrência" onClose={() => setDetalhe(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
            <div><label style={lbl}>Tipo</label><TipoBadge tipo={detalhe.tipo} /></div>
            <div><label style={lbl}>Gravidade</label><Badge cfg={GRAV_CFG[detalhe.gravidade] ?? GRAV_CFG.media} /></div>
            <div><label style={lbl}>Status</label><Badge cfg={STATUS_CFG[detalhe.status] ?? STATUS_CFG.aberta} /></div>
            <div><label style={lbl}>Data</label><span style={{ fontSize: 13 }}>{fmtDt(detalhe.created_at)}</span></div>
            <div><label style={lbl}>Equipe</label><span style={{ fontSize: 13 }}>{detalhe.lider_equipes?.nome || '—'}</span></div>
            <div><label style={lbl}>Turno</label>
              <span style={{ fontSize: 13 }}>{detalhe.lider_turnos ? `${detalhe.lider_turnos.turno} — ${detalhe.lider_turnos.data}` : '—'}</span>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Descrição</label>
              <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>{detalhe.descricao}</p>
            </div>
            {detalhe.observacao && (
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Observação</label>
                <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{detalhe.observacao}</p>
              </div>
            )}
            {detalhe.foto_url && (
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Foto</label>
                <img src={detalhe.foto_url} alt="ocorrência" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
              </div>
            )}
          </div>

          {/* Ações de status */}
          {detalhe.status !== 'resolvida' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              {detalhe.status === 'aberta' && (
                <button disabled={saving} onClick={() => atualizarStatus(detalhe.id, 'em_tratamento')}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: 13 }}>
                  Iniciar Tratamento
                </button>
              )}
              <button disabled={saving} onClick={() => atualizarStatus(detalhe.id, 'resolvida')}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: '#22c55e', color: '#fff', fontSize: 13 }}>
                Marcar como Resolvida
              </button>
              <button onClick={() => setDetalhe(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: '#f97316', color: '#fff', fontSize: 13 }}>
                Fechar
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
