import { useState, useEffect, useCallback } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { useLocation } from 'react-router-dom'
import {
  UsersIcon, WrenchScrewdriverIcon, BeakerIcon, ArrowTrendingUpIcon,
  ShieldCheckIcon, StarIcon, ArrowPathIcon, ChartBarIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDtHr(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

const inp = {
  height: 36, borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13, padding: '0 10px',
}

// ── Styles ────────────────────────────────────────────────────────────────────
const thStyle = {
  padding: '10px 13px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4,
  whiteSpace: 'nowrap', background: 'var(--bg-muted)',
}
const tdStyle = { padding: '10px 13px', fontSize: 13, borderTop: '1px solid var(--border)' }

// ── Componente de filtro de período ───────────────────────────────────────────
function FiltroPeriodo({ inicio, fim, onInicio, onFim, total, extra }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
      {[
        { label: 'Hoje', days: 0 },
        { label: '7 dias', days: 7 },
        { label: '30 dias', days: 30 },
      ].map(({ label, days }) => (
        <button key={label} onClick={() => {
          const hoje = new Date()
          const d = new Date(); d.setDate(d.getDate() - days)
          onInicio(d.toISOString().split('T')[0])
          onFim(hoje.toISOString().split('T')[0])
        }} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          {label}
        </button>
      ))}
      <input type="date" value={inicio} onChange={e => onInicio(e.target.value)} style={inp} />
      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>até</span>
      <input type="date" value={fim} onChange={e => onFim(e.target.value)} style={inp} />
      {extra}
      {total != null && (
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text)' }}>{total}</strong> registro(s)
        </span>
      )}
    </div>
  )
}

// ── Tabela genérica ───────────────────────────────────────────────────────────
function TabelaRegistros({ cols, rows, loading, empty }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{cols.map(c => <th key={c} style={thStyle}>{c}</th>)}</tr></thead>
            <tbody>
              {(!rows || rows.length === 0)
                ? <tr><td colSpan={cols.length} style={{ ...tdStyle, textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>{empty || 'Nenhum registro no período'}</td></tr>
                : rows.map((r, i) => <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-muted)' }}>{r}</tr>)
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Abas ──────────────────────────────────────────────────────────────────────
const ABAS = [
  { key: 'geral',            label: 'Visão Geral',           icon: ChartBarIcon },
  { key: 'mao-obra',         label: 'Mão de Obra',           icon: UsersIcon },
  { key: 'maquinas',         label: 'Máquinas',              icon: WrenchScrewdriverIcon },
  { key: 'insumos',          label: 'Insumos',               icon: ClipboardDocumentListIcon },
  { key: 'afericao',         label: 'Aferição',              icon: BeakerIcon },
  { key: 'prod-equipamento', label: 'Prod. Equipamento',     icon: ArrowTrendingUpIcon },
  { key: 'prod-equipe',      label: 'Prod. Equipe',          icon: ChartBarIcon },
  { key: 'avaliacoes',       label: 'Avaliações',            icon: StarIcon },
  { key: 'controle-epi',     label: 'Controle EPI',         icon: ShieldCheckIcon },
]

// ── Helpers de clima ──────────────────────────────────────────────────────────
const CLIMA_ICON = { sol: '☀️', parcial: '⛅', nublado: '☁️', chuva: '🌧️', tempestade: '⛈️', vento_forte: '💨' }
const TURNO_ICON = { manha: '🌅', tarde: '☀️', noite: '🌙' }
const STATUS_CHIP = ({ status }) => {
  const cfg = status === 'aberto'  ? { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Aberto' }
            : status === 'fechado' ? { bg: 'rgba(100,116,139,0.15)', color: '#64748b', label: 'Fechado' }
            : { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: status || '—' }
  return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
}

// ─── Aba: Visão Geral (todos os módulos por turno) ────────────────────────────
function AbaGeralTurnos({ workspaceId }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [inicio,  setInicio]  = useState(hoje30)
  const [fim,     setFim]     = useState(hoje)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      // 1. Turnos base
      const { data: turnos } = await supabase
        .from('lider_turnos')
        .select('id,data,turno,status,lider_nome,equipe_id,frente_id,created_at,lider_equipes(nome,codigo),lider_frentes(nome,codigo)')
        .eq('workspace_id', workspaceId)
        .gte('data', inicio)
        .lte('data', fim)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)

      if (!turnos || turnos.length === 0) { setRows([]); setLoading(false); return }

      const ids = turnos.map(t => t.id)

      // 2. Dados de todos os módulos em paralelo
      const [moData, maqData, insData, prodEquData, avalData, climaData, solInsData, solEpiData] = await Promise.all([
        supabase.from('lider_mao_obra').select('turno_id,presente').in('turno_id', ids),
        supabase.from('lider_apontamentos_maquina').select('turno_id').in('turno_id', ids),
        supabase.from('lider_apontamentos_insumo').select('turno_id').in('turno_id', ids),
        supabase.from('lider_produtividade_equipe').select('turno_id,realizado_ha,meta_ha').in('turno_id', ids),
        supabase.from('lider_avaliacoes_equipe').select('turno_id,nota_geral').in('turno_id', ids),
        supabase.from('lider_condicoes_climaticas').select('turno_id,condicao,temperatura_c').in('turno_id', ids),
        supabase.from('lider_solicitacoes_insumo').select('turno_id').in('turno_id', ids),
        supabase.from('lider_solicitacoes_epi').select('turno_id').in('turno_id', ids),
      ])

      // 3. Indexar por turno_id
      const idx = id => ({
        presentes:  0, ausentes: 0, maquinas: 0, insumos: 0,
        ha_real: 0, ha_meta: 0, nota: null, condicao: null, temp: null,
        sol_ins: 0, sol_epi: 0,
      })
      const map = Object.fromEntries(ids.map(id => [id, idx(id)]))

      ;(moData.data  || []).forEach(r => { if (r.presente) map[r.turno_id].presentes++; else map[r.turno_id].ausentes++ })
      ;(maqData.data || []).forEach(r => { map[r.turno_id].maquinas++ })
      ;(insData.data || []).forEach(r => { map[r.turno_id].insumos++ })
      ;(prodEquData.data || []).forEach(r => { map[r.turno_id].ha_real += r.realizado_ha || 0; map[r.turno_id].ha_meta += r.meta_ha || 0 })
      ;(avalData.data || []).forEach(r => { map[r.turno_id].nota = r.nota_geral })
      ;(climaData.data || []).forEach(r => { if (!map[r.turno_id].condicao) { map[r.turno_id].condicao = r.condicao; map[r.turno_id].temp = r.temperatura_c } })
      ;(solInsData.data || []).forEach(r => { map[r.turno_id].sol_ins++ })
      ;(solEpiData.data || []).forEach(r => { map[r.turno_id].sol_epi++ })

      setRows(turnos.map(t => ({ ...t, ...map[t.id] })))
    } finally {
      setLoading(false)
    }
  }, [workspaceId, inicio, fim])

  useEffect(() => { load() }, [load])

  const totalPresentes = rows.reduce((s, r) => s + r.presentes, 0)
  const totalMaq       = rows.reduce((s, r) => s + r.maquinas, 0)
  const totalHa        = rows.reduce((s, r) => s + r.ha_real, 0)

  return (
    <>
      <FiltroPeriodo inicio={inicio} fim={fim} onInicio={setInicio} onFim={setFim} total={rows.length} />

      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap', fontSize: 13 }}>
          <span>🗓️ <strong>{rows.length}</strong> <span style={{ color: 'var(--text-secondary)' }}>turnos</span></span>
          <span>👥 <strong style={{ color: '#10b981' }}>{totalPresentes}</strong> <span style={{ color: 'var(--text-secondary)' }}>presenças</span></span>
          <span>🚜 <strong style={{ color: '#3b82f6' }}>{totalMaq}</strong> <span style={{ color: 'var(--text-secondary)' }}>apontamentos máq.</span></span>
          <span>🌾 <strong style={{ color: '#f59e0b' }}>{totalHa.toFixed(1)} ha</strong> <span style={{ color: 'var(--text-secondary)' }}>realizados</span></span>
        </div>
      )}

      <TabelaRegistros loading={loading}
        cols={['Data', 'Turno', 'Equipe', 'Frente', 'Líder', 'Clima', 'Presença', 'Máq.', 'Insumos', 'Produt. ha', 'Efic.', 'Avaliação', 'Sol. Ins.', 'Sol. EPI', 'Status']}
        rows={rows.map(r => {
          const total = r.presentes + r.ausentes
          const efic  = r.ha_meta > 0 ? Math.round((r.ha_real / r.ha_meta) * 100) : null
          const eq    = r.lider_equipes
          const fr    = r.lider_frentes
          return [
            <td key="dt"  style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtData(r.data)}</td>,
            <td key="t"   style={tdStyle}>{TURNO_ICON[r.turno]} {r.turno}</td>,
            <td key="eq"  style={tdStyle}>{eq ? (eq.codigo ? `${eq.codigo} · ${eq.nome}` : eq.nome) : '—'}</td>,
            <td key="fr"  style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{fr ? (fr.codigo ? `${fr.codigo} · ${fr.nome}` : fr.nome) : '—'}</td>,
            <td key="li"  style={tdStyle}>{r.lider_nome || '—'}</td>,
            <td key="cl"  style={tdStyle}>
              {r.condicao
                ? <span title={r.condicao}>{CLIMA_ICON[r.condicao] || '🌡️'} {r.temp != null ? `${r.temp}°C` : r.condicao}</span>
                : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
            </td>,
            <td key="pr"  style={tdStyle}>
              {total > 0
                ? <span><strong style={{ color: '#10b981' }}>{r.presentes}</strong><span style={{ color: 'var(--text-secondary)' }}>/{total}</span></span>
                : '—'}
            </td>,
            <td key="mq"  style={{ ...tdStyle, textAlign: 'center' }}>{r.maquinas > 0 ? <strong style={{ color: '#3b82f6' }}>{r.maquinas}</strong> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>,
            <td key="in"  style={{ ...tdStyle, textAlign: 'center' }}>{r.insumos  > 0 ? <strong style={{ color: '#8b5cf6' }}>{r.insumos}</strong>  : <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>,
            <td key="ha"  style={tdStyle}>{r.ha_real > 0 ? <strong style={{ color: '#f59e0b' }}>{r.ha_real.toFixed(1)} ha</strong> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>,
            <td key="ef"  style={tdStyle}>{efic != null ? <span style={{ fontWeight: 700, color: efic >= 100 ? '#10b981' : efic >= 80 ? '#f59e0b' : '#ef4444' }}>{efic}%</span> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>,
            <td key="av"  style={tdStyle}>{r.nota != null ? <span>{'★'.repeat(Math.round(r.nota))} <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{Number(r.nota).toFixed(1)}</span></span> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>,
            <td key="si"  style={{ ...tdStyle, textAlign: 'center' }}>{r.sol_ins > 0 ? r.sol_ins : <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>,
            <td key="se"  style={{ ...tdStyle, textAlign: 'center' }}>{r.sol_epi > 0 ? r.sol_epi : <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>,
            <td key="st"  style={tdStyle}><STATUS_CHIP status={r.status} /></td>,
          ]
        })}
      />
    </>
  )
}

function hoje30() {
  const d = new Date(); d.setDate(d.getDate() - 30)
  return d.toISOString().split('T')[0]
}
function hoje() {
  return new Date().toISOString().split('T')[0]
}

// ─── Aba: Mão de Obra ─────────────────────────────────────────────────────────
function AbaMaoObra({ workspaceId }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [inicio,  setInicio]  = useState(hoje30)
  const [fim,     setFim]     = useState(hoje)
  const [filtroPres, setFiltroPres] = useState('todos')

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    let q = supabase.from('lider_mao_obra')
      .select('id,colaborador_nome,cargo,presente,hora_entrada,hora_saida,horas_trabalhadas,observacao,created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', inicio + 'T00:00:00')
      .lte('created_at', fim + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(300)
    if (filtroPres === 'presente') q = q.eq('presente', true)
    if (filtroPres === 'ausente')  q = q.eq('presente', false)
    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }, [workspaceId, inicio, fim, filtroPres])

  useEffect(() => { load() }, [load])

  const presentes = rows.filter(r => r.presente).length
  const ausentes  = rows.filter(r => !r.presente).length

  return (
    <>
      <FiltroPeriodo inicio={inicio} fim={fim} onInicio={setInicio} onFim={setFim} total={rows.length}
        extra={
          <select value={filtroPres} onChange={e => setFiltroPres(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
            <option value="todos">Todos</option>
            <option value="presente">Presentes</option>
            <option value="ausente">Ausentes</option>
          </select>
        }
      />
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13 }}>
          <span><strong style={{ color: '#10b981' }}>{presentes}</strong> <span style={{ color: 'var(--text-secondary)' }}>presentes</span></span>
          <span><strong style={{ color: '#ef4444' }}>{ausentes}</strong> <span style={{ color: 'var(--text-secondary)' }}>ausentes</span></span>
          <span><strong>{rows.length}</strong> <span style={{ color: 'var(--text-secondary)' }}>registros</span></span>
        </div>
      )}
      <TabelaRegistros loading={loading}
        cols={['Data/Hora', 'Colaborador', 'Cargo', 'Situação', 'Entrada', 'Saída', 'Horas', 'Observação']}
        rows={rows.map(r => [
          <td key="d" style={tdStyle}>{fmtDtHr(r.created_at)}</td>,
          <td key="n" style={{ ...tdStyle, fontWeight: 600 }}>{r.colaborador_nome || '—'}</td>,
          <td key="c" style={tdStyle}>{r.cargo || '—'}</td>,
          <td key="s" style={tdStyle}>
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: r.presente ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: r.presente ? '#10b981' : '#ef4444' }}>
              {r.presente ? 'Presente' : 'Ausente'}
            </span>
          </td>,
          <td key="e" style={tdStyle}>{r.hora_entrada || '—'}</td>,
          <td key="sa" style={tdStyle}>{r.hora_saida || '—'}</td>,
          <td key="h" style={tdStyle}>{r.horas_trabalhadas != null ? r.horas_trabalhadas + 'h' : '—'}</td>,
          <td key="o" style={{ ...tdStyle, color: 'var(--text-secondary)', maxWidth: 200 }}>{r.observacao || '—'}</td>,
        ])}
      />
    </>
  )
}

// ─── Aba: Máquinas ────────────────────────────────────────────────────────────
function AbaMaquinas({ workspaceId }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [inicio,  setInicio]  = useState(hoje30)
  const [fim,     setFim]     = useState(hoje)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase.from('lider_apontamentos_maquina')
      .select('id,maquina_nome,operador_nome,horimetro_inicial,horimetro_final,horas_trabalhadas,horas_paradas,motivo_parada,atividade,talhao_nome,observacao,created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', inicio + 'T00:00:00')
      .lte('created_at', fim + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(300)
    setRows(data || [])
    setLoading(false)
  }, [workspaceId, inicio, fim])

  useEffect(() => { load() }, [load])

  const totalHoras = rows.reduce((s, r) => s + (r.horas_trabalhadas || 0), 0)

  return (
    <>
      <FiltroPeriodo inicio={inicio} fim={fim} onInicio={setInicio} onFim={setFim} total={rows.length} />
      {rows.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          <strong>{totalHoras.toFixed(1)}h</strong> <span style={{ color: 'var(--text-secondary)' }}>total trabalhado</span>
        </div>
      )}
      <TabelaRegistros loading={loading}
        cols={['Data/Hora', 'Máquina', 'Operador', 'Hor. Ini.', 'Hor. Fin.', 'H. trab.', 'H. paradas', 'Atividade', 'Talhão', 'Motivo Parada']}
        rows={rows.map(r => [
          <td key="d" style={tdStyle}>{fmtDtHr(r.created_at)}</td>,
          <td key="m" style={{ ...tdStyle, fontWeight: 600 }}>{r.maquina_nome || '—'}</td>,
          <td key="o" style={tdStyle}>{r.operador_nome || '—'}</td>,
          <td key="hi" style={tdStyle}>{r.horimetro_inicial ?? '—'}</td>,
          <td key="hf" style={tdStyle}>{r.horimetro_final ?? '—'}</td>,
          <td key="ht" style={tdStyle}>{r.horas_trabalhadas != null ? r.horas_trabalhadas + 'h' : '—'}</td>,
          <td key="hp" style={tdStyle}>{r.horas_paradas != null ? r.horas_paradas + 'h' : '—'}</td>,
          <td key="a" style={tdStyle}>{r.atividade || '—'}</td>,
          <td key="t" style={tdStyle}>{r.talhao_nome || '—'}</td>,
          <td key="mp" style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{r.motivo_parada || '—'}</td>,
        ])}
      />
    </>
  )
}

// ─── Aba: Insumos ─────────────────────────────────────────────────────────────
function AbaInsumos({ workspaceId }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [inicio,  setInicio]  = useState(hoje30)
  const [fim,     setFim]     = useState(hoje)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase.from('lider_apontamentos_insumo')
      .select('id,produto_nome,quantidade,unidade,atividade,maquina_nome,talhao_nome,observacao,created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', inicio + 'T00:00:00')
      .lte('created_at', fim + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(300)
    setRows(data || [])
    setLoading(false)
  }, [workspaceId, inicio, fim])

  useEffect(() => { load() }, [load])

  return (
    <>
      <FiltroPeriodo inicio={inicio} fim={fim} onInicio={setInicio} onFim={setFim} total={rows.length} />
      <TabelaRegistros loading={loading}
        cols={['Data/Hora', 'Produto', 'Quantidade', 'Unidade', 'Atividade', 'Máquina', 'Talhão', 'Observação']}
        rows={rows.map(r => [
          <td key="d" style={tdStyle}>{fmtDtHr(r.created_at)}</td>,
          <td key="p" style={{ ...tdStyle, fontWeight: 600 }}>{r.produto_nome || '—'}</td>,
          <td key="q" style={tdStyle}>{r.quantidade ?? '—'}</td>,
          <td key="u" style={tdStyle}>{r.unidade || '—'}</td>,
          <td key="a" style={tdStyle}>{r.atividade || '—'}</td>,
          <td key="m" style={tdStyle}>{r.maquina_nome || '—'}</td>,
          <td key="t" style={tdStyle}>{r.talhao_nome || '—'}</td>,
          <td key="o" style={{ ...tdStyle, color: 'var(--text-secondary)', maxWidth: 180 }}>{r.observacao || '—'}</td>,
        ])}
      />
    </>
  )
}

// ─── Aba: Aferição ────────────────────────────────────────────────────────────
function AbaAfericao({ workspaceId }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [inicio,  setInicio]  = useState(hoje30)
  const [fim,     setFim]     = useState(hoje)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase.from('lider_afericoes')
      .select('id,implemento_nome,maquina_nome,vazao_medida_lmin,velocidade_kmh,largura_m,volume_calda_lha,volume_recomendado_lha,status,tipo_afericao,produto_aplicado,dose_kg_ha,observacao,created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', inicio + 'T00:00:00')
      .lte('created_at', fim + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(300)
    setRows(data || [])
    setLoading(false)
  }, [workspaceId, inicio, fim])

  useEffect(() => { load() }, [load])

  const foraPadrao = rows.filter(r => r.status && r.status !== 'ok').length

  return (
    <>
      <FiltroPeriodo inicio={inicio} fim={fim} onInicio={setInicio} onFim={setFim} total={rows.length} />
      {rows.length > 0 && foraPadrao > 0 && (
        <div style={{ marginBottom: 12, fontSize: 13, color: '#ef4444' }}>
          <strong>{foraPadrao}</strong> aferição(ões) fora do padrão
        </div>
      )}
      <TabelaRegistros loading={loading}
        cols={['Data/Hora', 'Tipo', 'Implemento', 'Máquina', 'Vazão L/min', 'Vel. km/h', 'Largura m', 'Vol. calda L/ha', 'Vol. ref. L/ha', 'Status', 'Produto', 'Dose kg/ha']}
        rows={rows.map(r => [
          <td key="d" style={tdStyle}>{fmtDtHr(r.created_at)}</td>,
          <td key="tp" style={tdStyle}>{r.tipo_afericao || 'líquido'}</td>,
          <td key="i" style={{ ...tdStyle, fontWeight: 600 }}>{r.implemento_nome || '—'}</td>,
          <td key="m" style={tdStyle}>{r.maquina_nome || '—'}</td>,
          <td key="v" style={tdStyle}>{r.vazao_medida_lmin ?? '—'}</td>,
          <td key="vel" style={tdStyle}>{r.velocidade_kmh ?? '—'}</td>,
          <td key="l" style={tdStyle}>{r.largura_m ?? '—'}</td>,
          <td key="vc" style={tdStyle}>{r.volume_calda_lha ?? '—'}</td>,
          <td key="vr" style={tdStyle}>{r.volume_recomendado_lha ?? '—'}</td>,
          <td key="s" style={tdStyle}>
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: r.status === 'ok' ? 'rgba(16,185,129,0.15)' : r.status ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.15)', color: r.status === 'ok' ? '#10b981' : r.status ? '#ef4444' : '#94a3b8' }}>
              {r.status === 'ok' ? 'OK' : r.status || '—'}
            </span>
          </td>,
          <td key="pr" style={tdStyle}>{r.produto_aplicado || '—'}</td>,
          <td key="do" style={tdStyle}>{r.dose_kg_ha ?? '—'}</td>,
        ])}
      />
    </>
  )
}

// ─── Aba: Produtividade Equipamento ──────────────────────────────────────────
function AbaProdEquipamento({ workspaceId }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [inicio,  setInicio]  = useState(hoje30)
  const [fim,     setFim]     = useState(hoje)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase.from('lider_produtividade_equipamento')
      .select('id,maquina_nome,atividade,area_ha,quantidade_aplicada,unidade_aplicada,horas_trabalhadas,produtividade_hah,observacao,created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', inicio + 'T00:00:00')
      .lte('created_at', fim + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(300)
    setRows(data || [])
    setLoading(false)
  }, [workspaceId, inicio, fim])

  useEffect(() => { load() }, [load])

  const totalArea  = rows.reduce((s, r) => s + (r.area_ha || 0), 0)
  const totalHoras = rows.reduce((s, r) => s + (r.horas_trabalhadas || 0), 0)
  const mediaProd  = totalHoras ? (totalArea / totalHoras).toFixed(2) : '—'

  return (
    <>
      <FiltroPeriodo inicio={inicio} fim={fim} onInicio={setInicio} onFim={setFim} total={rows.length} />
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: 13 }}>
          <span><strong style={{ color: '#0ea5e9' }}>{totalArea.toFixed(1)} ha</strong> <span style={{ color: 'var(--text-secondary)' }}>total</span></span>
          <span><strong style={{ color: '#6366f1' }}>{totalHoras.toFixed(1)}h</strong> <span style={{ color: 'var(--text-secondary)' }}>trabalhadas</span></span>
          <span><strong style={{ color: '#10b981' }}>{mediaProd} ha/h</strong> <span style={{ color: 'var(--text-secondary)' }}>média</span></span>
        </div>
      )}
      <TabelaRegistros loading={loading}
        cols={['Data/Hora', 'Máquina', 'Atividade', 'Área ha', 'Qtd. aplic.', 'Unidade', 'Horas', 'ha/h', 'Observação']}
        rows={rows.map(r => [
          <td key="d" style={tdStyle}>{fmtDtHr(r.created_at)}</td>,
          <td key="m" style={{ ...tdStyle, fontWeight: 600 }}>{r.maquina_nome || '—'}</td>,
          <td key="a" style={tdStyle}>{r.atividade || '—'}</td>,
          <td key="ha" style={tdStyle}>{r.area_ha != null ? r.area_ha + ' ha' : '—'}</td>,
          <td key="q" style={tdStyle}>{r.quantidade_aplicada ?? '—'}</td>,
          <td key="u" style={tdStyle}>{r.unidade_aplicada || '—'}</td>,
          <td key="h" style={tdStyle}>{r.horas_trabalhadas != null ? r.horas_trabalhadas + 'h' : '—'}</td>,
          <td key="p" style={tdStyle}>{r.produtividade_hah != null ? r.produtividade_hah.toFixed(2) : '—'}</td>,
          <td key="o" style={{ ...tdStyle, color: 'var(--text-secondary)', maxWidth: 160 }}>{r.observacao || '—'}</td>,
        ])}
      />
    </>
  )
}

// ─── Aba: Produtividade Equipe ────────────────────────────────────────────────
function AbaProdEquipe({ workspaceId }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [inicio,  setInicio]  = useState(hoje30)
  const [fim,     setFim]     = useState(hoje)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase.from('lider_produtividade_equipe')
      .select('id,equipe_id,atividade,meta_ha,realizado_ha,eficiencia_pct,observacao,created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', inicio + 'T00:00:00')
      .lte('created_at', fim + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(300)
    setRows(data || [])
    setLoading(false)
  }, [workspaceId, inicio, fim])

  useEffect(() => { load() }, [load])

  const totalReal = rows.reduce((s, r) => s + (r.realizado_ha || 0), 0)
  const totalMeta = rows.reduce((s, r) => s + (r.meta_ha || 0), 0)
  const eficienciaGeral = totalMeta ? Math.round((totalReal / totalMeta) * 100) : null

  return (
    <>
      <FiltroPeriodo inicio={inicio} fim={fim} onInicio={setInicio} onFim={setFim} total={rows.length} />
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: 13 }}>
          <span><strong style={{ color: '#10b981' }}>{totalReal.toFixed(1)} ha</strong> <span style={{ color: 'var(--text-secondary)' }}>realizado</span></span>
          <span><strong style={{ color: '#94a3b8' }}>{totalMeta.toFixed(1)} ha</strong> <span style={{ color: 'var(--text-secondary)' }}>meta</span></span>
          {eficienciaGeral != null && (
            <span><strong style={{ color: eficienciaGeral >= 100 ? '#10b981' : eficienciaGeral >= 80 ? '#f59e0b' : '#ef4444' }}>{eficienciaGeral}%</strong> <span style={{ color: 'var(--text-secondary)' }}>eficiência geral</span></span>
          )}
        </div>
      )}
      <TabelaRegistros loading={loading}
        cols={['Data/Hora', 'Atividade', 'Meta ha', 'Realizado ha', 'Eficiência', 'Observação']}
        rows={rows.map(r => [
          <td key="d" style={tdStyle}>{fmtDtHr(r.created_at)}</td>,
          <td key="a" style={{ ...tdStyle, fontWeight: 600 }}>{r.atividade || '—'}</td>,
          <td key="m" style={tdStyle}>{r.meta_ha != null ? r.meta_ha + ' ha' : '—'}</td>,
          <td key="r" style={tdStyle}>{r.realizado_ha != null ? r.realizado_ha + ' ha' : '—'}</td>,
          <td key="e" style={tdStyle}>
            {r.eficiencia_pct != null ? (
              <span style={{ fontWeight: 700, color: r.eficiencia_pct >= 100 ? '#10b981' : r.eficiencia_pct >= 80 ? '#f59e0b' : '#ef4444' }}>
                {r.eficiencia_pct}%
              </span>
            ) : '—'}
          </td>,
          <td key="o" style={{ ...tdStyle, color: 'var(--text-secondary)', maxWidth: 180 }}>{r.observacao || '—'}</td>,
        ])}
      />
    </>
  )
}

// ─── Aba: Avaliações ──────────────────────────────────────────────────────────
function AbaAvaliacoes({ workspaceId }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [inicio,  setInicio]  = useState(hoje30)
  const [fim,     setFim]     = useState(hoje)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase.from('lider_avaliacoes_equipe')
      .select('id,equipe_nome,presenca,produtividade,qualidade,seguranca,uso_epi,disciplina,nota_geral,comentario,created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', inicio + 'T00:00:00')
      .lte('created_at', fim + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(300)
    setRows(data || [])
    setLoading(false)
  }, [workspaceId, inicio, fim])

  useEffect(() => { load() }, [load])

  const mediaGeral = rows.length ? (rows.reduce((s, r) => s + (r.nota_geral || 0), 0) / rows.length).toFixed(1) : null

  return (
    <>
      <FiltroPeriodo inicio={inicio} fim={fim} onInicio={setInicio} onFim={setFim} total={rows.length} />
      {mediaGeral != null && (
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          <strong style={{ color: '#f59e0b' }}>{mediaGeral}</strong> <span style={{ color: 'var(--text-secondary)' }}>nota média geral</span>
        </div>
      )}
      <TabelaRegistros loading={loading}
        cols={['Data/Hora', 'Equipe', 'Presença', 'Produtiv.', 'Qualidade', 'Segurança', 'EPI', 'Disciplina', 'Nota Geral', 'Comentário']}
        rows={rows.map(r => [
          <td key="d" style={tdStyle}>{fmtDtHr(r.created_at)}</td>,
          <td key="e" style={{ ...tdStyle, fontWeight: 600 }}>{r.equipe_nome || '—'}</td>,
          <td key="p" style={tdStyle}>{r.presenca ?? '—'}</td>,
          <td key="pr" style={tdStyle}>{r.produtividade ?? '—'}</td>,
          <td key="q" style={tdStyle}>{r.qualidade ?? '—'}</td>,
          <td key="s" style={tdStyle}>{r.seguranca ?? '—'}</td>,
          <td key="ep" style={tdStyle}>{r.uso_epi ?? '—'}</td>,
          <td key="di" style={tdStyle}>{r.disciplina ?? '—'}</td>,
          <td key="n" style={tdStyle}>
            <strong style={{ fontSize: 15, color: r.nota_geral >= 4 ? '#10b981' : r.nota_geral >= 3 ? '#f59e0b' : '#ef4444' }}>
              {r.nota_geral != null ? r.nota_geral.toFixed(1) : '—'}
            </strong>
          </td>,
          <td key="c" style={{ ...tdStyle, color: 'var(--text-secondary)', maxWidth: 200 }}>{r.comentario || '—'}</td>,
        ])}
      />
    </>
  )
}

// ─── Aba: Controle EPI ────────────────────────────────────────────────────────
function AbaControleEpi({ workspaceId }) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [inicio,  setInicio]  = useState(hoje30)
  const [fim,     setFim]     = useState(hoje)

  const MOTIVO_LABEL = {
    novo:             'Novo colaborador',
    troca_vencido:    'Troca desgaste',
    troca_danificado: 'Troca dano',
    perda:            'Perda / extravio',
    outro:            'Outro',
  }

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase.from('lider_controle_epi')
      .select('id,colaborador_nome,epi_nome,motivo,validade,status,observacao,created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', inicio + 'T00:00:00')
      .lte('created_at', fim + 'T23:59:59')
      .order('created_at', { ascending: false })
      .limit(300)
    setRows(data || [])
    setLoading(false)
  }, [workspaceId, inicio, fim])

  useEffect(() => { load() }, [load])

  const STATUS_COLOR = {
    pendente:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    entregue:  { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    reprovado: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  }

  return (
    <>
      <FiltroPeriodo inicio={inicio} fim={fim} onInicio={setInicio} onFim={setFim} total={rows.length} />
      <TabelaRegistros loading={loading}
        cols={['Data/Hora', 'Colaborador', 'EPI', 'Motivo', 'Validade', 'Status', 'Observação']}
        rows={rows.map(r => {
          const sc = STATUS_COLOR[r.status] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' }
          return [
            <td key="d" style={tdStyle}>{fmtDtHr(r.created_at)}</td>,
            <td key="c" style={{ ...tdStyle, fontWeight: 600 }}>{r.colaborador_nome || '—'}</td>,
            <td key="e" style={tdStyle}>{r.epi_nome || '—'}</td>,
            <td key="m" style={tdStyle}>{MOTIVO_LABEL[r.motivo] || r.motivo || '—'}</td>,
            <td key="v" style={tdStyle}>{r.validade ? fmtData(r.validade) : '—'}</td>,
            <td key="s" style={tdStyle}>
              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>
                {r.status || '—'}
              </span>
            </td>,
            <td key="o" style={{ ...tdStyle, color: 'var(--text-secondary)', maxWidth: 160 }}>{r.observacao || '—'}</td>,
          ]
        })}
      />
    </>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function LiderApontamentos() {
  const workspaceId = useStore(s => s.workspaceId)
  const location    = useLocation()

  const queryAba = new URLSearchParams(location.search).get('aba')
  const [aba, setAba] = useState(queryAba || 'geral')

  const abaAtual = ABAS.find(a => a.key === aba) || ABAS[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title="Apontamentos & Registros"
        subtitle="Visualização de todos os registros operacionais do SmartLíder"
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '16px 0 14px', borderBottom: '1px solid var(--border)', marginBottom: 20, position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
          {ABAS.map(a => {
            const Icon = a.icon
            const active = aba === a.key
            return (
              <button key={a.key} onClick={() => setAba(a.key)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                borderRadius: 9, border: active ? 'none' : '1px solid var(--border)',
                cursor: 'pointer', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
                background: active ? 'var(--primary)' : 'var(--bg-card)',
                color: active ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}>
                <Icon style={{ width: 14, height: 14 }} />
                {a.label}
              </button>
            )
          })}
        </div>

        {/* Conteúdo da aba */}
        {aba === 'geral'            && <AbaGeralTurnos       workspaceId={workspaceId} />}
        {aba === 'mao-obra'         && <AbaMaoObra          workspaceId={workspaceId} />}
        {aba === 'maquinas'         && <AbaMaquinas          workspaceId={workspaceId} />}
        {aba === 'insumos'          && <AbaInsumos           workspaceId={workspaceId} />}
        {aba === 'afericao'         && <AbaAfericao          workspaceId={workspaceId} />}
        {aba === 'prod-equipamento' && <AbaProdEquipamento   workspaceId={workspaceId} />}
        {aba === 'prod-equipe'      && <AbaProdEquipe        workspaceId={workspaceId} />}
        {aba === 'avaliacoes'       && <AbaAvaliacoes        workspaceId={workspaceId} />}
        {aba === 'controle-epi'     && <AbaControleEpi       workspaceId={workspaceId} />}
      </div>
    </div>
  )
}
