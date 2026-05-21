import { useState, useEffect, useRef, useCallback } from 'react'
import { BellIcon, XMarkIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

// ─── Status dos steps ─────────────────────────────────────────────────────────
const STEP_COLORS = {
  rascunho:  '#64748b',
  pendente:  '#f59e0b',
  aprovado:  '#10b981',
  reprovado: '#ef4444',
  entregue:  '#6366f1',
  fechado:   '#94a3b8',
}

function fmtSla(dt) {
  if (!dt) return null
  const diff = new Date(dt) - new Date()
  if (diff <= 0) return { label: 'Vencido', color: '#ef4444' }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 48) return { label: `${Math.floor(h / 24)}d`, color: '#94a3b8' }
  if (h > 0) return { label: `${h}h ${m}m`, color: h < 2 ? '#f59e0b' : '#94a3b8' }
  return { label: `${m}m`, color: '#ef4444' }
}

// ─── FlowTaskBell ─────────────────────────────────────────────────────────────
// Props:
//   userId      (uuid)   — responsável para filtrar tarefas
//   workspaceId (uuid)   — workspace
//   onSelectTask (fn)    — callback opcional: onSelectTask(entidade_id)
export default function FlowTaskBell({ userId, workspaceId, onSelectTask }) {
  const [open, setOpen]   = useState(false)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  const load = useCallback(async () => {
    if (!userId && !workspaceId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ action: 'tasks', status: 'pendente' })
      if (userId)      params.set('user_id', userId)
      if (workspaceId) params.set('workspace_id', workspaceId)
      const res = await fetch(`/api/flow-engine?${params}`)
      if (res.ok) {
        const { tasks: t } = await res.json()
        setTasks(t || [])
      }
    } catch (_) {}
    setLoading(false)
  }, [userId, workspaceId])

  // Carrega ao montar e a cada 60s
  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [load])

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const count = tasks.length
  const vencidas = tasks.filter(t => t.sla_vence_em && new Date(t.sla_vence_em) < new Date()).length

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Botão do sino */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) load() }}
        title={count > 0 ? `${count} tarefa${count > 1 ? 's' : ''} pendente${count > 1 ? 's' : ''}` : 'Sem tarefas pendentes'}
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 8px', borderRadius: 8, display: 'flex', alignItems: 'center',
          color: count > 0 ? (vencidas > 0 ? '#ef4444' : '#f59e0b') : 'var(--text-secondary)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <BellIcon style={{ width: 20, height: 20 }} />
        {count > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            minWidth: 16, height: 16, borderRadius: 8,
            background: vencidas > 0 ? '#ef4444' : '#f59e0b',
            color: '#fff', fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1,
          }}>{count > 9 ? '9+' : count}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          width: 320, maxHeight: 400, overflowY: 'auto',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 9999,
        }}>
          {/* Header dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
              🔔 Tarefas Pendentes
              {count > 0 && <span style={{ marginLeft: 6, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: 11, padding: '1px 6px', borderRadius: 10, fontWeight: 800 }}>{count}</span>}
            </span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2 }}>
              <XMarkIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
              Carregando...
            </div>
          )}

          {/* Empty */}
          {!loading && count === 0 && (
            <div style={{ padding: '28px 16px', textAlign: 'center' }}>
              <CheckCircleIcon style={{ width: 32, height: 32, color: '#10b981', margin: '0 auto 8px' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Tudo em dia!</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Nenhuma tarefa pendente</div>
            </div>
          )}

          {/* Lista de tarefas */}
          {!loading && tasks.map(task => {
            const stepColor = STEP_COLORS[task.flow_steps?.status_valor] || '#94a3b8'
            const sla = fmtSla(task.sla_vence_em)
            const entidadeId = task.flow_instances?.entidade_id
            const ctx = task.flow_instances?.dados_contexto || {}

            return (
              <div
                key={task.id}
                onClick={() => {
                  if (onSelectTask && entidadeId) onSelectTask(entidadeId)
                  setOpen(false)
                }}
                style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  cursor: onSelectTask ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (onSelectTask) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Processo */}
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>
                      {task.processo_nome || task.titulo || '—'}
                    </div>
                    {/* Etapa */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: stepColor, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
                        {task.flow_steps?.nome || 'Etapa desconhecida'}
                      </span>
                    </div>
                    {/* Contexto */}
                    {(ctx.numero_pedido || ctx.valor_total) && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {ctx.numero_pedido && <span>#{ctx.numero_pedido} </span>}
                        {ctx.valor_total && <span>· R$ {Number(ctx.valor_total).toFixed(2).replace('.', ',')}</span>}
                      </div>
                    )}
                  </div>
                  {/* SLA badge */}
                  {sla && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      <ClockIcon style={{ width: 11, height: 11, color: sla.color }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: sla.color }}>{sla.label}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Rodapé */}
          {count > 0 && (
            <div style={{ padding: '10px 16px', textAlign: 'center' }}>
              <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)', textDecoration: 'underline' }}>
                Atualizar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
