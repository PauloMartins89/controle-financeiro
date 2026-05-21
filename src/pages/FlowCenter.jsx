import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import FlowHistory from '../components/refeicao/FlowHistory'
import toast from 'react-hot-toast'
import {
  ClockIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon,
  ArrowPathIcon, FunnelIcon, MagnifyingGlassIcon, BoltIcon,
  PlayIcon, EyeIcon, ChevronDownIcon, ChevronUpIcon,
} from '@heroicons/react/24/outline'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtRelativo(dt) {
  if (!dt) return '—'
  const diff = Date.now() - new Date(dt).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}min atrás`
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

function slaStatus(dt) {
  if (!dt) return null
  const diff = new Date(dt) - Date.now()
  if (diff < 0) return { label: 'Vencido', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' }
  const h = Math.floor(diff / 3600000)
  if (h < 2) return { label: `${h}h ${Math.floor((diff % 3600000)/60000)}m`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' }
  if (h < 24) return { label: `${h}h`, color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' }
  return { label: `${Math.floor(h/24)}d`, color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' }
}

const STATUS_CFG = {
  rascunho:  { label: 'Rascunho',  color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  pendente:  { label: 'Pendente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  aprovado:  { label: 'Aprovado',  color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  reprovado: { label: 'Reprovado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  entregue:  { label: 'Entregue',  color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  fechado:   { label: 'Fechado',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

function StatusPill({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.rascunho
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

// ─── Linha de instância ───────────────────────────────────────────────────────
function InstanceRow({ inst, onAction }) {
  const [expanded, setExpanded] = useState(false)
  const step = inst.flow_steps
  const sla = slaStatus(inst.sla_vence_em)
  const ctx = inst.dados_contexto || {}

  return (
    <>
      <tr
        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Processo */}
        <td style={{ padding: '11px 14px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
            {inst.flow_definitions?.nome || '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {inst.entidade_tipo} · {ctx.numero_pedido ? `#${ctx.numero_pedido}` : inst.entidade_id?.slice(0,8) + '…'}
          </div>
        </td>
        {/* Etapa atual */}
        <td style={{ padding: '11px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: step?.config?.cor || '#94a3b8', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{step?.nome || '—'}</span>
          </div>
        </td>
        {/* Status */}
        <td style={{ padding: '11px 14px' }}>
          <StatusPill status={inst.flow_steps?.status_valor || inst.status} />
        </td>
        {/* SLA */}
        <td style={{ padding: '11px 14px' }}>
          {sla ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: sla.color, background: sla.bg, padding: '3px 8px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ClockIcon style={{ width: 10, height: 10 }} />
              {sla.label}
            </span>
          ) : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>}
        </td>
        {/* Valor */}
        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: '#10b981' }}>
          {ctx.valor_total ? `R$ ${Number(ctx.valor_total).toFixed(2).replace('.', ',')}` : '—'}
        </td>
        {/* Criado */}
        <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>
          {fmtRelativo(inst.created_at)}
        </td>
        {/* Expand */}
        <td style={{ padding: '11px 14px', textAlign: 'center' }}>
          {expanded
            ? <ChevronUpIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />
            : <ChevronDownIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />
          }
        </td>
      </tr>
      {/* Painel expandido */}
      {expanded && (
        <tr style={{ background: 'rgba(255,255,255,0.015)' }}>
          <td colSpan={7} style={{ padding: '0 24px 16px' }}>
            <div style={{ paddingTop: 16 }}>
              <FlowHistory solicitacaoId={inst.entidade_id} open={expanded} />
            </div>
            {/* Ações rápidas */}
            <ActionButtons instanceId={inst.id} status={inst.status} onAction={onAction} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Botões de ação ───────────────────────────────────────────────────────────
function ActionButtons({ instanceId, status, onAction }) {
  const userId = useStore(s => s.currentUser?.id)
  const [acoes, setAcoes] = useState([])
  const [resolvedId, setResolvedId] = useState(null)
  const [executing, setExecuting] = useState(null)
  const [motivoAcao, setMotivoAcao] = useState(null) // { acao } aguardando motivo
  const [motivoText, setMotivoText] = useState('')

  useEffect(() => {
    setAcoes([])
    setResolvedId(null)
    fetch(`/api/flow-engine?action=actions&instance_id=${instanceId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setAcoes(d?.acoes || [])
        setResolvedId(d?.instance_id || instanceId)
      })
      .catch(() => {})
  }, [instanceId])

  async function executar(acao, dados) {
    const iid = resolvedId || instanceId
    setExecuting(acao.id)
    const r = await fetch('/api/flow-engine?action=execute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: iid, acao_id: acao.id, executado_por: userId, dados, origem: 'humano' }),
    })
    const j = await r.json()
    setExecuting(null)
    if (r.ok) { toast.success('Executado com sucesso!'); onAction() }
    else toast.error(j.error || 'Erro ao executar')
  }

  function exec(acao) {
    if (acao.campos_obrigatorios?.includes('motivo')) {
      setMotivoText('')
      setMotivoAcao(acao)
      return
    }
    executar(acao, {})
  }

  async function confirmarMotivo() {
    if (!motivoText.trim()) return
    const acao = motivoAcao
    setMotivoAcao(null)
    await executar(acao, { motivo: motivoText.trim() })
  }

  if (acoes.length === 0) return null

  const tipoStyle = (tipo) => {
    if (tipo === 'aprovar') return { background: '#10b981', color: '#fff' }
    if (tipo === 'reprovar') return { background: '#ef4444', color: '#fff' }
    return { background: 'var(--accent)', color: '#fff' }
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* Botões */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {acoes.map(a => (
          <button
            key={a.id}
            onClick={() => exec(a)}
            disabled={!!executing}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, ...tipoStyle(a.tipo),
              opacity: executing === a.id ? 0.6 : 1,
            }}
          >
            {executing === a.id ? '...' : a.label}
          </button>
        ))}
      </div>
      {/* Mini-form de motivo (substitui window.prompt) */}
      {motivoAcao && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            autoFocus
            className="input"
            value={motivoText}
            onChange={e => setMotivoText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmarMotivo()}
            placeholder={`Motivo para "${motivoAcao.label}"...`}
            style={{ flex: 1, minWidth: 200, fontSize: 12, padding: '6px 10px' }}
          />
          <button onClick={confirmarMotivo} disabled={!motivoText.trim()} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: '#ef4444', color: '#fff', opacity: motivoText.trim() ? 1 : 0.5 }}>
            Confirmar
          </button>
          <button onClick={() => setMotivoAcao(null)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, background: 'none', color: 'var(--text-secondary)' }}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function FlowCenter() {
  const workspaceId = useStore(s => s.workspaceId)
  const [instances, setInstances] = useState([])
  const [loading, setLoading]     = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('ativos')
  const [filtroModulo, setFiltroModulo] = useState('todos')
  const [busca, setBusca]         = useState('')

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase
      .from('flow_instances')
      .select(`
        id, entidade_tipo, entidade_id, status, dados_contexto, sla_vence_em, created_at, updated_at,
        flow_steps(id, nome, status_valor, config),
        flow_definitions(id, nome, modulo)
      `)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(200)
    setInstances(data || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  // Stats
  const stats = useMemo(() => {
    const bStatus = i => i.flow_steps?.status_valor || i.status
    const ativas = instances.filter(i => bStatus(i) !== 'fechado')
    const vencidas = ativas.filter(i => i.sla_vence_em && new Date(i.sla_vence_em) < new Date())
    return {
      total:     instances.length,
      ativas:    ativas.length,
      pendentes: instances.filter(i => bStatus(i) === 'pendente').length,
      vencidas:  vencidas.length,
      fechadas:  instances.filter(i => bStatus(i) === 'fechado').length,
    }
  }, [instances])

  // Filtros
  const modulos = useMemo(() => {
    const set = new Set(instances.map(i => i.flow_definitions?.modulo).filter(Boolean))
    return ['todos', ...set]
  }, [instances])

  const filtradas = useMemo(() => {
    let list = instances

    const bSt = i => i.flow_steps?.status_valor || i.status
    if (filtroStatus === 'ativos') list = list.filter(i => bSt(i) !== 'fechado')
    else if (filtroStatus === 'vencidos') list = list.filter(i => i.sla_vence_em && new Date(i.sla_vence_em) < new Date())
    else if (filtroStatus === 'fechados') list = list.filter(i => bSt(i) === 'fechado')

    if (filtroModulo !== 'todos') list = list.filter(i => i.flow_definitions?.modulo === filtroModulo)

    if (busca.trim()) {
      const b = busca.toLowerCase()
      list = list.filter(i =>
        i.flow_definitions?.nome?.toLowerCase().includes(b) ||
        i.dados_contexto?.numero_pedido?.toLowerCase()?.includes(b) ||
        i.entidade_id?.includes(b)
      )
    }

    return list
  }, [instances, filtroStatus, filtroModulo, busca])

  const TAB_STATUS = [
    { id: 'ativos',   label: `Ativos (${stats.ativas})` },
    { id: 'vencidos', label: `SLA Vencido (${stats.vencidas})`, warn: stats.vencidas > 0 },
    { id: 'fechados', label: `Fechados (${stats.fechadas})` },
    { id: 'todos',    label: `Todos (${stats.total})` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="⚡ Flow Center" subtitle="Monitoramento de processos e instâncias de fluxo" />
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* Cards de stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Instâncias Ativas', value: stats.ativas,    color: '#6366f1', emoji: '⚡' },
            { label: 'Pendentes',         value: stats.pendentes, color: '#f59e0b', emoji: '⏳' },
            { label: 'SLA Vencido',       value: stats.vencidas,  color: '#ef4444', emoji: '🚨' },
            { label: 'Concluídos',        value: stats.fechadas,  color: '#10b981', emoji: '✅' },
          ].map((c, i) => (
            <div key={i} className="stat-card" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</div>
                </div>
                <span style={{ fontSize: 22 }}>{c.emoji}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Alerta SLA vencido */}
        {stats.vencidas > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 20 }}>
            <ExclamationTriangleIcon style={{ width: 18, height: 18, color: '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
              {stats.vencidas} instância{stats.vencidas > 1 ? 's' : ''} com SLA vencido — ação necessária
            </span>
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          {/* Tabs de status */}
          <div style={{ display: 'flex', gap: 4 }}>
            {TAB_STATUS.map(t => (
              <button key={t.id} onClick={() => setFiltroStatus(t.id)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: 'none', cursor: 'pointer',
                background: filtroStatus === t.id ? (t.warn ? '#ef4444' : 'var(--accent)') : 'rgba(255,255,255,0.05)',
                color: filtroStatus === t.id ? '#fff' : (t.warn ? '#ef4444' : 'var(--text-secondary)'),
              }}>{t.label}</button>
            ))}
          </div>

          {/* Filtro módulo */}
          {modulos.length > 2 && (
            <select value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)} className="input" style={{ padding: '5px 10px', fontSize: 12, width: 'auto' }}>
              {modulos.map(m => <option key={m} value={m}>{m === 'todos' ? 'Todos módulos' : m}</option>)}
            </select>
          )}

          {/* Busca */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-secondary)' }} />
            <input className="input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pedido, processo..." style={{ paddingLeft: 30, fontSize: 12 }} />
          </div>

          {/* Reload */}
          <button onClick={load} title="Atualizar" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Tabela */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', fontSize: 13 }}>Carregando instâncias...</div>
        ) : filtradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <BoltIcon style={{ width: 40, height: 40, color: 'var(--text-secondary)', margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nenhuma instância encontrada</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Processo', 'Etapa Atual', 'Status', 'SLA', 'Valor', 'Atualizado', ''].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map(inst => (
                  <InstanceRow key={inst.id} inst={inst} onAction={load} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
