import { useState, useEffect, useCallback } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import {
  DocumentTextIcon, ArrowPathIcon, FunnelIcon, PrinterIcon,
  ChevronRightIcon, XMarkIcon, CheckCircleIcon, ClockIcon,
  UsersIcon, CalendarDaysIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline'

const TURNO_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const CAT_COLOR = {
  'Segurança':     '#ef4444',
  'Saúde':         '#3b82f6',
  'Meio Ambiente': '#22c55e',
  'Qualidade':     '#f59e0b',
  'Outros':        '#8b5cf6',
}

function fmt(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export default function LiderDDS() {
  const { workspaceId } = useStore()
  const [registros,  setRegistros]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [gerandoPdf, setGerandoPdf] = useState(null)  // registroId em geração

  // filtros
  const [filtroStatus,   setFiltroStatus]   = useState('todos')
  const [filtroInicio,   setFiltroInicio]   = useState('')
  const [filtroFim,      setFiltroFim]      = useState('')

  // painel lateral
  const [detalhe, setDetalhe] = useState(null)   // registro selecionado
  const [assinaturas, setAssinaturas] = useState([])
  const [loadingDet,  setLoadingDet]  = useState(false)

  // KPIs
  const hoje = new Date().toISOString().split('T')[0]
  const totalHoje  = registros.filter(r => r.data === hoje).length
  const concluidos = registros.filter(r => r.status === 'concluido').length
  const totalAssin = registros.reduce((a, r) => a + (r.total_assinantes || 0), 0)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    let q = supabase
      .from('dds_registros')
      .select(`
        id, data, turno, status, total_assinantes, concluido_em, created_at,
        lider_nome, equipe_nome,
        lider_equipes!grupo_id ( nome, lider_nome ),
        dds_temas ( titulo, categoria )
      `)
      .eq('workspace_id', workspaceId)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)

    if (filtroStatus !== 'todos') q = q.eq('status', filtroStatus)
    if (filtroInicio) q = q.gte('data', filtroInicio)
    if (filtroFim)    q = q.lte('data', filtroFim)

    const { data, error } = await q
    if (error) toast.error(error.message)
    setRegistros(data || [])
    setLoading(false)
  }, [workspaceId, filtroStatus, filtroInicio, filtroFim])

  useEffect(() => { load() }, [load])

  async function abrirDetalhe(reg) {
    setDetalhe(reg)
    setAssinaturas([])
    setLoadingDet(true)
    const { data } = await supabase
      .from('dds_assinaturas')
      .select('id, colaborador_nome, assinatura_svg, assinado_em')
      .eq('registro_id', reg.id)
      .order('assinado_em')
    setAssinaturas(data || [])
    setLoadingDet(false)
  }

  async function gerarAta(registroId, e) {
    e.stopPropagation()
    setGerandoPdf(registroId)
    try {
      const res = await fetch(`/api/dds-ata?registroId=${registroId}&workspaceId=${workspaceId}`)
      if (!res.ok) { toast.error('Erro ao gerar ata'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `ata-dds-${registroId.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error('Erro: ' + err.message)
    } finally {
      setGerandoPdf(null)
    }
  }

  async function gerarRelatorio() {
    setGerandoPdf('relatorio')
    try {
      const params = new URLSearchParams({ workspaceId })
      if (filtroInicio) params.set('inicio', filtroInicio)
      if (filtroFim)    params.set('fim',    filtroFim)
      if (filtroStatus !== 'todos') params.set('status', filtroStatus)
      const res = await fetch(`/api/dds-relatorio?${params}`)
      if (!res.ok) { toast.error('Erro ao gerar relatório'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `relatorio-dds-${hoje}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error('Erro: ' + err.message)
    } finally {
      setGerandoPdf(null)
    }
  }

  const COLS = ['Data', 'Turno', 'Grupo', 'Líder', 'Tema', 'Categoria', 'Assinantes', 'Status', '']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title="DDS — Diálogo Diário de Segurança"
        subtitle="Sessões registradas pelo app SmartLíder"
        action={{ label: 'Atualizar', icon: ArrowPathIcon, onClick: load }}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Coluna principal ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, minWidth: 0 }}>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Sessões hoje',     value: totalHoje,  color: '#6366f1', Icon: CalendarDaysIcon },
              { label: 'Concluídas',       value: concluidos, color: '#10b981', Icon: CheckCircleIcon },
              { label: 'Em andamento',     value: registros.filter(r => r.status === 'em_andamento').length, color: '#f59e0b', Icon: ClockIcon },
              { label: 'Total assinaturas',value: totalAssin, color: '#3b82f6', Icon: UsersIcon },
              { label: 'Sessões (período)',value: registros.length, color: '#8b5cf6', Icon: ShieldCheckIcon },
            ].map(k => (
              <div key={k.label} style={{ background: k.color + '12', border: `1px solid ${k.color}28`, borderTop: `3px solid ${k.color}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: k.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <k.Icon style={{ width: 15, height: 15, color: k.color }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{k.label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <FunnelIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)', flexShrink: 0, marginBottom: 2 }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Status</div>
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}>
                <option value="todos">Todos</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>De</div>
              <input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Até</div>
              <input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
            </div>
            <button
              onClick={gerarRelatorio}
              disabled={gerandoPdf === 'relatorio'}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: gerandoPdf === 'relatorio' ? 0.6 : 1 }}
            >
              <PrinterIcon style={{ width: 15, height: 15 }} />
              {gerandoPdf === 'relatorio' ? 'Gerando...' : '📋 Relatório de Presença'}
            </button>
          </div>

          {/* Tabela */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Carregando...</div>
            ) : registros.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
                <ShieldCheckIcon style={{ width: 40, height: 40, margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                Nenhuma sessão DDS encontrada
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-muted)' }}>
                      {COLS.map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map(r => {
                      const tema = r.dds_temas
                      const catColor = CAT_COLOR[tema?.categoria] || '#6366f1'
                      const ativo = detalhe?.id === r.id
                      return (
                        <tr
                          key={r.id}
                          onClick={() => abrirDetalhe(r)}
                          style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', background: ativo ? 'var(--primary-soft, rgba(99,102,241,0.07))' : undefined, transition: 'background 0.12s' }}
                          onMouseEnter={e => { if (!ativo) e.currentTarget.style.background = 'var(--bg-muted)' }}
                          onMouseLeave={e => { if (!ativo) e.currentTarget.style.background = '' }}
                        >
                          <td style={{ padding: '11px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(r.data)}</td>
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>{TURNO_LABEL[r.turno] || r.turno || '—'}</td>
                          <td style={{ padding: '11px 14px' }}>{r.lider_equipes?.nome || r.equipe_nome || '—'}</td>
                          <td style={{ padding: '11px 14px' }}>{r.lider_equipes?.lider_nome || r.lider_nome || '—'}</td>
                          <td style={{ padding: '11px 14px', maxWidth: 180 }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tema?.titulo || '—'}</span>
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            {tema?.categoria && (
                              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: catColor + '18', color: catColor }}>{tema.categoria}</span>
                            )}
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700 }}>{r.total_assinantes || 0}</td>
                          <td style={{ padding: '11px 14px' }}>
                            {r.status === 'concluido'
                              ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#10b98120', color: '#10b981' }}>✅ Concluído</span>
                              : <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#f59e0b20', color: '#f59e0b' }}>⏳ Em andamento</span>
                            }
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <button
                                onClick={e => gerarAta(r.id, e)}
                                disabled={gerandoPdf === r.id}
                                title="Gerar Ata DDS"
                                style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700, opacity: gerandoPdf === r.id ? 0.6 : 1, whiteSpace: 'nowrap' }}
                              >
                                <PrinterIcon style={{ width: 12, height: 12 }} />
                                {gerandoPdf === r.id ? '...' : 'Ata'}
                              </button>
                              <ChevronRightIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)', opacity: ativo ? 1 : 0.4 }} />
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
        </div>

        {/* ── Painel lateral de detalhe ── */}
        {detalhe && (
          <div style={{ width: 380, borderLeft: '1px solid var(--border)', overflowY: 'auto', background: 'var(--bg-card)', flexShrink: 0 }}>
            {/* Header do painel */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
                  {fmt(detalhe.data)} · {TURNO_LABEL[detalhe.turno] || detalhe.turno}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {detalhe.lider_equipes?.nome || detalhe.equipe_nome || '—'} · {detalhe.lider_equipes?.lider_nome || detalhe.lider_nome || '—'}
                </div>
              </div>
              <button onClick={() => setDetalhe(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)' }}>
                <XMarkIcon style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Tema */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Tema DDS</div>
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  {detalhe.dds_temas ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{detalhe.dds_temas.titulo}</div>
                      {detalhe.dds_temas.categoria && (
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: (CAT_COLOR[detalhe.dds_temas.categoria] || '#6366f1') + '18', color: CAT_COLOR[detalhe.dds_temas.categoria] || '#6366f1' }}>
                          {detalhe.dds_temas.categoria}
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>—</span>
                  )}
                </div>
              </div>

              {/* Status + total */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{detalhe.total_assinantes}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>assinaturas</div>
                </div>
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  {detalhe.status === 'concluido'
                    ? <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>✅ Concluído</div>
                    : <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>⏳ Em andamento</div>
                  }
                  {detalhe.concluido_em && (
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>{fmt(detalhe.concluido_em)}</div>
                  )}
                </div>
              </div>

              {/* Botão Ata no painel */}
              <button
                onClick={e => gerarAta(detalhe.id, e)}
                disabled={gerandoPdf === detalhe.id}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 0', cursor: 'pointer', fontWeight: 700, fontSize: 14, marginBottom: 20, opacity: gerandoPdf === detalhe.id ? 0.6 : 1 }}
              >
                <PrinterIcon style={{ width: 16, height: 16 }} />
                {gerandoPdf === detalhe.id ? 'Gerando PDF...' : '🖨️ Gerar Ata com Assinaturas'}
              </button>

              {/* Lista de assinaturas */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Assinaturas ({assinaturas.length})
              </div>

              {loadingDet ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</div>
              ) : assinaturas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', fontSize: 13 }}>Nenhuma assinatura</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {assinaturas.map((a, i) => (
                    <div key={a.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1e3a5f22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#1e3a5f', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.colaborador_nome}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{fmt(a.assinado_em)}</div>
                      </div>
                      {a.assinatura_svg && (
                        <div
                          style={{ width: 80, height: 36, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: '#fff', flexShrink: 0 }}
                          dangerouslySetInnerHTML={{ __html: a.assinatura_svg }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
