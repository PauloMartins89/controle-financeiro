import { useState, useEffect, useCallback } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import {
  CalendarDaysIcon, ArrowPathIcon, ChevronDownIcon, ChevronRightIcon,
  UsersIcon, WrenchScrewdriverIcon, CheckCircleIcon, ClockIcon,
} from '@heroicons/react/24/outline'

function fmtData(iso) {
  if (!iso) return '—'
  const s = (iso || '').split('T')[0]
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}
function fmtDtHr(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_CFG = {
  aberto:  { label: 'Aberto',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  fechado: { label: 'Fechado', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
}
const TURNO_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

const inp = {
  height: 36, borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13, padding: '0 10px',
}
const sel = { ...inp, cursor: 'pointer' }

function TurnoDetalhe({ turnoId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { data: mo },
        { data: maq },
        { data: ins },
        { data: afr },
        { data: pEq },
        { data: pEqp },
        { data: aval },
        { data: epi },
      ] = await Promise.all([
        supabase.from('lider_mao_obra').select('colaborador_nome,cargo,presente,hora_entrada,hora_saida,horas_trabalhadas').eq('turno_id', turnoId).order('colaborador_nome'),
        supabase.from('lider_apontamentos_maquina').select('maquina_nome,operador_nome,horas_trabalhadas,horas_paradas,atividade').eq('turno_id', turnoId).order('maquina_nome'),
        supabase.from('lider_apontamentos_insumo').select('produto_nome,quantidade,unidade,atividade,maquina_nome').eq('turno_id', turnoId).order('produto_nome'),
        supabase.from('lider_afericoes').select('implemento_nome,maquina_nome,vazao_medida_lmin,volume_calda_lha,volume_recomendado_lha,status,tipo_afericao').eq('turno_id', turnoId),
        supabase.from('lider_produtividade_equipe').select('atividade,meta_ha,realizado_ha,eficiencia_pct').eq('turno_id', turnoId),
        supabase.from('lider_produtividade_equipamento').select('maquina_nome,atividade,area_ha,horas_trabalhadas,produtividade_hah').eq('turno_id', turnoId),
        supabase.from('lider_avaliacoes_equipe').select('equipe_nome,presenca,produtividade,qualidade,seguranca,uso_epi,disciplina,nota_geral,comentario').eq('turno_id', turnoId),
        supabase.from('lider_controle_epi').select('colaborador_nome,epi_nome,motivo,status').eq('turno_id', turnoId),
      ])
      setData({ mo, maq, ins, afr, pEq, pEqp, aval, epi })
      setLoading(false)
    }
    load()
  }, [turnoId])

  if (loading) return <div style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: 13 }}>Carregando detalhe...</div>
  if (!data) return null

  const thStyle = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }
  const tdStyle = { padding: '9px 12px', fontSize: 13, borderTop: '1px solid var(--border)' }
  const secStyle = { marginBottom: 16 }
  const secTitle = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }

  function Tabela({ cols, rows, empty }) {
    return (
      <div style={{ overflowX: 'auto', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--bg-muted)' }}>{cols.map(c => <th key={c} style={thStyle}>{c}</th>)}</tr></thead>
          <tbody>
            {(!rows || rows.length === 0)
              ? <tr><td colSpan={cols.length} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-secondary)' }}>{empty || 'Nenhum registro'}</td></tr>
              : rows.map((r, i) => <tr key={i}>{r}</tr>)
            }
          </tbody>
        </table>
      </div>
    )
  }

  const presentes = (data.mo || []).filter(r => r.presente).length

  return (
    <div style={{ padding: '16px 24px 20px', background: 'var(--bg-muted)', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>

        {/* Mão de Obra */}
        <div style={secStyle}>
          <div style={secTitle}>Mão de Obra ({presentes}/{(data.mo || []).length} presentes)</div>
          <Tabela
            cols={['Nome', 'Cargo', 'Situação', 'Entrada', 'Saída', 'Horas']}
            rows={(data.mo || []).map((r, i) => [
              <td key="n" style={tdStyle}>{r.colaborador_nome || '—'}</td>,
              <td key="c" style={tdStyle}>{r.cargo || '—'}</td>,
              <td key="s" style={tdStyle}>
                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: r.presente ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: r.presente ? '#10b981' : '#ef4444' }}>
                  {r.presente ? 'Presente' : 'Ausente'}
                </span>
              </td>,
              <td key="e" style={tdStyle}>{r.hora_entrada || '—'}</td>,
              <td key="sa" style={tdStyle}>{r.hora_saida || '—'}</td>,
              <td key="h" style={tdStyle}>{r.horas_trabalhadas != null ? r.horas_trabalhadas + 'h' : '—'}</td>,
            ])}
          />
        </div>

        {/* Máquinas */}
        {(data.maq || []).length > 0 && (
          <div style={secStyle}>
            <div style={secTitle}>Máquinas ({(data.maq || []).length})</div>
            <Tabela
              cols={['Máquina', 'Operador', 'Atividade', 'H. trab.', 'H. paradas']}
              rows={(data.maq || []).map((r, i) => [
                <td key="m" style={tdStyle}>{r.maquina_nome || '—'}</td>,
                <td key="o" style={tdStyle}>{r.operador_nome || '—'}</td>,
                <td key="a" style={tdStyle}>{r.atividade || '—'}</td>,
                <td key="ht" style={tdStyle}>{r.horas_trabalhadas != null ? r.horas_trabalhadas + 'h' : '—'}</td>,
                <td key="hp" style={tdStyle}>{r.horas_paradas != null ? r.horas_paradas + 'h' : '—'}</td>,
              ])}
            />
          </div>
        )}

        {/* Insumos */}
        {(data.ins || []).length > 0 && (
          <div style={secStyle}>
            <div style={secTitle}>Insumos ({(data.ins || []).length})</div>
            <Tabela
              cols={['Produto', 'Qtd', 'Unid', 'Atividade', 'Máquina']}
              rows={(data.ins || []).map((r, i) => [
                <td key="p" style={tdStyle}>{r.produto_nome || '—'}</td>,
                <td key="q" style={tdStyle}>{r.quantidade ?? '—'}</td>,
                <td key="u" style={tdStyle}>{r.unidade || '—'}</td>,
                <td key="a" style={tdStyle}>{r.atividade || '—'}</td>,
                <td key="m" style={tdStyle}>{r.maquina_nome || '—'}</td>,
              ])}
            />
          </div>
        )}

        {/* Produtividade Equipe */}
        {(data.pEq || []).length > 0 && (
          <div style={secStyle}>
            <div style={secTitle}>Produtividade Equipe</div>
            <Tabela
              cols={['Atividade', 'Meta ha', 'Realizado ha', 'Eficiência']}
              rows={(data.pEq || []).map((r, i) => [
                <td key="a" style={tdStyle}>{r.atividade || '—'}</td>,
                <td key="m" style={tdStyle}>{r.meta_ha != null ? r.meta_ha + ' ha' : '—'}</td>,
                <td key="r" style={tdStyle}>{r.realizado_ha != null ? r.realizado_ha + ' ha' : '—'}</td>,
                <td key="e" style={tdStyle}>{r.eficiencia_pct != null ? r.eficiencia_pct + '%' : '—'}</td>,
              ])}
            />
          </div>
        )}

        {/* Produtividade Equipamento */}
        {(data.pEqp || []).length > 0 && (
          <div style={secStyle}>
            <div style={secTitle}>Produtividade Equipamento</div>
            <Tabela
              cols={['Máquina', 'Atividade', 'Área ha', 'Horas', 'ha/h']}
              rows={(data.pEqp || []).map((r, i) => [
                <td key="m" style={tdStyle}>{r.maquina_nome || '—'}</td>,
                <td key="a" style={tdStyle}>{r.atividade || '—'}</td>,
                <td key="ha" style={tdStyle}>{r.area_ha != null ? r.area_ha + ' ha' : '—'}</td>,
                <td key="h" style={tdStyle}>{r.horas_trabalhadas != null ? r.horas_trabalhadas + 'h' : '—'}</td>,
                <td key="p" style={tdStyle}>{r.produtividade_hah != null ? r.produtividade_hah.toFixed(2) : '—'}</td>,
              ])}
            />
          </div>
        )}

        {/* Aferição */}
        {(data.afr || []).length > 0 && (
          <div style={secStyle}>
            <div style={secTitle}>Aferição ({(data.afr || []).length})</div>
            <Tabela
              cols={['Implemento', 'Máquina', 'Vazão L/min', 'Volume L/ha', 'Ref. L/ha', 'Status']}
              rows={(data.afr || []).map((r, i) => [
                <td key="i" style={tdStyle}>{r.implemento_nome || '—'}</td>,
                <td key="m" style={tdStyle}>{r.maquina_nome || '—'}</td>,
                <td key="v" style={tdStyle}>{r.vazao_medida_lmin ?? '—'}</td>,
                <td key="vc" style={tdStyle}>{r.volume_calda_lha ?? '—'}</td>,
                <td key="vr" style={tdStyle}>{r.volume_recomendado_lha ?? '—'}</td>,
                <td key="s" style={tdStyle}>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: r.status === 'ok' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: r.status === 'ok' ? '#10b981' : '#ef4444' }}>
                    {r.status === 'ok' ? 'OK' : r.status || '—'}
                  </span>
                </td>,
              ])}
            />
          </div>
        )}

        {/* Avaliações */}
        {(data.aval || []).length > 0 && (
          <div style={secStyle}>
            <div style={secTitle}>Avaliação da Equipe</div>
            <Tabela
              cols={['Equipe', 'Presença', 'Produtiv.', 'Qualidade', 'Segurança', 'EPI', 'Disciplina', 'Nota']}
              rows={(data.aval || []).map((r, i) => [
                <td key="e" style={tdStyle}>{r.equipe_nome || '—'}</td>,
                <td key="p" style={tdStyle}>{r.presenca ?? '—'}</td>,
                <td key="pr" style={tdStyle}>{r.produtividade ?? '—'}</td>,
                <td key="q" style={tdStyle}>{r.qualidade ?? '—'}</td>,
                <td key="s" style={tdStyle}>{r.seguranca ?? '—'}</td>,
                <td key="ep" style={tdStyle}>{r.uso_epi ?? '—'}</td>,
                <td key="d" style={tdStyle}>{r.disciplina ?? '—'}</td>,
                <td key="n" style={tdStyle}><strong>{r.nota_geral != null ? r.nota_geral.toFixed(1) : '—'}</strong></td>,
              ])}
            />
          </div>
        )}

        {/* EPI */}
        {(data.epi || []).length > 0 && (
          <div style={secStyle}>
            <div style={secTitle}>Controle EPI ({(data.epi || []).length})</div>
            <Tabela
              cols={['Colaborador', 'EPI', 'Motivo', 'Status']}
              rows={(data.epi || []).map((r, i) => [
                <td key="c" style={tdStyle}>{r.colaborador_nome || '—'}</td>,
                <td key="e" style={tdStyle}>{r.epi_nome || '—'}</td>,
                <td key="m" style={tdStyle}>{r.motivo || '—'}</td>,
                <td key="s" style={tdStyle}>{r.status || '—'}</td>,
              ])}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function LiderTurnos() {
  const workspaceId = useStore(s => s.workspaceId)
  const [turnos,    setTurnos]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [dataInicio,   setDataInicio]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split('T')[0])
  const [expandido, setExpandido] = useState(null)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    let q = supabase
      .from('lider_turnos')
      .select('id,frente_nome,equipe_nome,lider_nome,data,turno,status,fechado_em,created_at')
      .eq('workspace_id', workspaceId)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
    if (filtroStatus !== 'todos') q = q.eq('status', filtroStatus)
    const { data } = await q
    setTurnos(data || [])
    setLoading(false)
  }, [workspaceId, dataInicio, dataFim, filtroStatus])

  useEffect(() => { load() }, [load])

  const abertos  = turnos.filter(t => t.status === 'aberto').length
  const fechados  = turnos.filter(t => t.status === 'fechado').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title="Turnos"
        subtitle="Todos os turnos registrados pelo aplicativo SmartLíder"
        action={{ label: 'Atualizar', icon: ArrowPathIcon, onClick: load }}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>De</span>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inp} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inp} />
          </div>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={sel}>
            <option value="todos">Todos os status</option>
            <option value="aberto">Abertos</option>
            <option value="fechado">Fechados</option>
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 13 }}>
            <span><strong style={{ color: '#f59e0b' }}>{abertos}</strong> <span style={{ color: 'var(--text-secondary)' }}>abertos</span></span>
            <span><strong style={{ color: '#10b981' }}>{fechados}</strong> <span style={{ color: 'var(--text-secondary)' }}>fechados</span></span>
            <span><strong>{turnos.length}</strong> <span style={{ color: 'var(--text-secondary)' }}>total</span></span>
          </div>
        </div>

        {/* Tabela */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>Carregando...</div>
          ) : turnos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
              <CalendarDaysIcon style={{ width: 40, height: 40, marginBottom: 10, opacity: 0.4 }} />
              <div>Nenhum turno no período</div>
            </div>
          ) : (
            <div>
              {turnos.map(t => {
                const cfg = STATUS_CFG[t.status] || { label: t.status, color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' }
                const isOpen = expandido === t.id
                return (
                  <div key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* Linha do turno */}
                    <div
                      onClick={() => setExpandido(isOpen ? null : t.id)}
                      style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 90px 100px 36px', alignItems: 'center', gap: 8, padding: '13px 16px', cursor: 'pointer', fontSize: 13, transition: 'background 0.1s', background: isOpen ? 'var(--bg-muted)' : 'transparent' }}
                      onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--bg-muted)' }}
                      onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ fontWeight: 600 }}>{fmtData(t.data || t.created_at)}</span>
                      <span style={{ color: 'var(--text)' }}>{t.frente_nome || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</span>
                      <span style={{ color: 'var(--text)' }}>{t.equipe_nome || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</span>
                      <span style={{ color: 'var(--text)' }}>{t.lider_nome || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{TURNO_LABEL[t.turno] || t.turno || '—'}</span>
                      <span>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                        {t.status === 'fechado' && t.fechado_em && (
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{fmtDtHr(t.fechado_em)}</div>
                        )}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center' }}>
                        {isOpen
                          ? <ChevronDownIcon style={{ width: 16, height: 16 }} />
                          : <ChevronRightIcon style={{ width: 16, height: 16 }} />
                        }
                      </span>
                    </div>
                    {/* Detalhe expandido */}
                    {isOpen && <TurnoDetalhe turnoId={t.id} />}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Header da tabela (legenda) */}
        {!loading && turnos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 90px 100px 36px', gap: 8, padding: '6px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 }}>
            <span>Data</span><span>Frente</span><span>Equipe</span><span>Líder</span><span>Turno</span><span>Status</span><span></span>
          </div>
        )}
      </div>
    </div>
  )
}
