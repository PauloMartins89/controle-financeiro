import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  BoltIcon, BeakerIcon, MapIcon, PlayIcon, ArrowPathIcon,
  CheckCircleIcon, XCircleIcon, ChevronRightIcon, InformationCircleIcon,
  ClockIcon, UserIcon, CodeBracketIcon, PlusIcon,
} from '@heroicons/react/24/outline'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STEP_COLORS = {
  rascunho:   { bg: '#1e293b', border: '#475569', text: '#94a3b8', dot: '#475569' },
  pendente:   { bg: '#1c1a0e', border: '#ca8a04', text: '#fde047', dot: '#f59e0b' },
  aprovado:   { bg: '#0a1f14', border: '#059669', text: '#6ee7b7', dot: '#10b981' },
  reprovado:  { bg: '#1f0a0a', border: '#dc2626', text: '#fca5a5', dot: '#ef4444' },
  entregue:   { bg: '#0f0e2a', border: '#4f46e5', text: '#a5b4fc', dot: '#6366f1' },
  fechado:    { bg: '#111827', border: '#374151', text: '#6b7280', dot: '#374151' },
  default:    { bg: '#111827', border: '#374151', text: '#9ca3af', dot: '#374151' },
}

function stepColor(status_valor) {
  return STEP_COLORS[status_valor] || STEP_COLORS.default
}

const ACTION_COLORS = {
  enviar:            { bg: 'rgba(99,102,241,0.15)', border: '#6366f1', text: '#a5b4fc', icon: '📤' },
  aprovar:           { bg: 'rgba(16,185,129,0.15)', border: '#10b981', text: '#6ee7b7', icon: '✅' },
  reprovar:          { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#fca5a5', icon: '❌' },
  confirmar_entrega: { bg: 'rgba(99,102,241,0.15)', border: '#8b5cf6', text: '#c4b5fd', icon: '📦' },
  fechar:            { bg: 'rgba(148,163,184,0.1)', border: '#475569', text: '#94a3b8', icon: '🔒' },
  reabrir:           { bg: 'rgba(245,158,11,0.15)', border: '#d97706', text: '#fde68a', icon: '↩️' },
  default:           { bg: 'rgba(99,102,241,0.1)',  border: '#6366f1', text: '#a5b4fc', icon: '▶' },
}

function actionColor(nome) {
  return ACTION_COLORS[nome] || ACTION_COLORS.default
}

function fmtRelativo(dt) {
  if (!dt) return '—'
  const diff = Date.now() - new Date(dt).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}min atrás`
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

// ─── Componente: Mapa Visual do Fluxo ────────────────────────────────────────
function FlowMapTab({ workspaceId }) {
  const [definitions, setDefinitions] = useState([])
  const [selectedDef, setSelectedDef] = useState(null)
  const [flowData, setFlowData] = useState(null) // { steps, transitions, actions, responsaveis }
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    supabase.from('flow_definitions')
      .select('id, nome, modulo, descricao')
      .eq('workspace_id', workspaceId)
      .eq('ativo', true)
      .then(({ data }) => {
        setDefinitions(data || [])
        if (data?.length) setSelectedDef(data[0].id)
      })
  }, [workspaceId])

  useEffect(() => {
    if (!selectedDef) return
    setLoading(true)
    Promise.all([
      supabase.from('flow_versions').select('id').eq('definition_id', selectedDef).eq('ativo', true).maybeSingle(),
    ]).then(async ([{ data: ver }]) => {
      if (!ver) { setFlowData(null); setLoading(false); return }
      const [{ data: steps }, { data: transitions }, { data: actions }, { data: responsaveis }] = await Promise.all([
        supabase.from('flow_steps').select('*').eq('version_id', ver.id).order('ordem', { ascending: true }),
        supabase.from('flow_transitions').select('*, from_step:flow_steps!from_step_id(nome, status_valor), to_step:flow_steps!to_step_id(nome, status_valor)').eq('version_id', ver.id),
        supabase.from('flow_actions').select('*, flow_steps(nome)').eq('version_id', ver.id),
        supabase.from('flow_step_responsaveis').select('*, flow_steps(nome, status_valor)').eq('version_id', ver.id).order('prioridade', { ascending: true }),
      ])
      setFlowData({ steps: steps || [], transitions: transitions || [], actions: actions || [], responsaveis: responsaveis || [], version_id: ver.id })
      setLoading(false)
    })
  }, [selectedDef])

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>Carregando mapa...</div>

  // Montar mapa: para cada step, quais ações saem dele e para onde vão
  const stepMap = {}
  if (flowData) {
    for (const step of flowData.steps) {
      stepMap[step.id] = {
        ...step,
        outgoing: flowData.transitions.filter(t => t.from_step_id === step.id),
        responsaveis: flowData.responsaveis.filter(r => r.step_id === step.id),
      }
    }
  }

  const stepList = flowData?.steps || []

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Seletor de processo */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ color: '#94a3b8', fontSize: 13, whiteSpace: 'nowrap' }}>Processo:</label>
        <select
          value={selectedDef || ''}
          onChange={e => setSelectedDef(e.target.value)}
          style={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: 8, padding: '7px 12px', fontSize: 14, cursor: 'pointer' }}
        >
          {definitions.map(d => <option key={d.id} value={d.id}>{d.nome} ({d.modulo})</option>)}
        </select>
        {flowData && <span style={{ color: '#475569', fontSize: 12 }}>{stepList.length} etapas · {flowData.transitions.length} transições</span>}
      </div>

      {/* Pipeline visual horizontal */}
      {flowData && (
        <>
          <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, minWidth: 'max-content' }}>
              {stepList.map((step, idx) => {
                const sc = stepColor(step.status_valor)
                const outgoing = stepMap[step.id]?.outgoing || []
                const resps = stepMap[step.id]?.responsaveis || []
                const stepActions = flowData.actions.filter(a => a.step_id === step.id)

                return (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start' }}>
                    {/* Caixa do Step */}
                    <div style={{
                      background: sc.bg, border: `1.5px solid ${sc.border}`,
                      borderRadius: 12, padding: '14px 16px', width: 200, minHeight: 160,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      {/* Header step */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                        <span style={{ color: sc.text, fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{step.nome}</span>
                        {step.is_final && <span style={{ fontSize: 10, color: '#6b7280', background: 'rgba(107,114,128,0.15)', padding: '1px 6px', borderRadius: 10 }}>FINAL</span>}
                      </div>

                      {/* Status valor */}
                      {step.status_valor && (
                        <div style={{ fontSize: 11, color: '#475569' }}>
                          status: <span style={{ color: sc.dot }}>{step.status_valor}</span>
                        </div>
                      )}

                      {/* Responsáveis */}
                      {resps.length > 0 && (
                        <div style={{ borderTop: `1px solid ${sc.border}30`, paddingTop: 8, marginTop: 2 }}>
                          <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>👤 RESPONSÁVEL</div>
                          {resps.map((r, ri) => (
                            <div key={ri} style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '3px 7px', marginBottom: 3 }}>
                              {r.tipo === 'supervisor_equipe' ? '👔 Supervisor' :
                               r.tipo === 'lider_equipe' ? '👷 Líder' :
                               r.tipo === 'solicitante' ? '🙋 Solicitante' :
                               r.tipo === 'usuario_fixo' ? `👤 ${r.config?.nome || 'Fixo'}` :
                               r.tipo === 'perfil' ? `🏷 Perfil` : r.tipo}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Ações disponíveis neste step */}
                      {stepActions.length > 0 && (
                        <div style={{ borderTop: `1px solid ${sc.border}30`, paddingTop: 8, marginTop: 2 }}>
                          <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>⚡ AÇÕES</div>
                          {stepActions.map(a => {
                            const ac = actionColor(a.nome)
                            return (
                              <div key={a.id} style={{ fontSize: 11, color: ac.text, background: ac.bg, border: `1px solid ${ac.border}40`, borderRadius: 6, padding: '3px 7px', marginBottom: 3 }}>
                                {ac.icon} {a.nome}
                                {a.requer_motivo && <span style={{ color: '#6b7280', marginLeft: 4 }}>(motivo)</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Setas de transição para próximos steps */}
                    {outgoing.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4, padding: '16px 4px', minHeight: 160, width: 80 }}>
                        {outgoing.map((t, ti) => {
                          const ac = flowData.actions.find(a => a.id === t.acao_gatilho_id)
                          const ac2 = actionColor(ac?.nome || '')
                          return (
                            <div key={ti} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                              <div style={{ fontSize: 10, color: ac2.text, background: ac2.bg, border: `1px solid ${ac2.border}40`, borderRadius: 10, padding: '2px 7px', whiteSpace: 'nowrap', maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ac?.nome || '→'}
                              </div>
                              <div style={{ color: '#475569', fontSize: 16 }}>→</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legenda de responsáveis completa */}
          <div style={{ marginTop: 32, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 700, marginBottom: 14, letterSpacing: 1 }}>MAPA DE RESPONSABILIDADE — QUEM FAZ O QUÊ</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {stepList.map(step => {
                const sc = stepColor(step.status_valor)
                const resps = stepMap[step.id]?.responsaveis || []
                const stepActions = flowData.actions.filter(a => a.step_id === step.id)
                const outgoing = stepMap[step.id]?.outgoing || []
                return (
                  <div key={step.id} style={{ background: '#111827', border: `1px solid ${sc.border}50`, borderRadius: 10, padding: 14 }}>
                    <div style={{ color: sc.text, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block', marginRight: 6 }} />
                      {step.nome}
                    </div>
                    {resps.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 10, color: '#475569' }}>Responsável: </span>
                        {resps.map((r, i) => (
                          <span key={i} style={{ fontSize: 11, color: '#94a3b8' }}>
                            {r.tipo === 'supervisor_equipe' ? '👔 Supervisor da Equipe' :
                             r.tipo === 'lider_equipe' ? '👷 Líder da Equipe' :
                             r.tipo === 'solicitante' ? '🙋 Quem Solicitou' :
                             r.tipo === 'usuario_fixo' ? `👤 ${r.config?.nome || 'Usuário Fixo'}` : r.tipo}
                            {i < resps.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {stepActions.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 10, color: '#475569' }}>Pode fazer: </span>
                        {stepActions.map((a, i) => {
                          const ac = actionColor(a.nome)
                          return (
                            <span key={i} style={{ fontSize: 11, color: ac.text }}>
                              {ac.icon} {a.nome}{i < stepActions.length - 1 ? ' · ' : ''}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {outgoing.length > 0 && (
                      <div>
                        <span style={{ fontSize: 10, color: '#475569' }}>Vai para: </span>
                        {outgoing.map((t, i) => {
                          const toStep = stepList.find(s => s.id === t.to_step_id)
                          const sc2 = stepColor(toStep?.status_valor)
                          return (
                            <span key={i} style={{ fontSize: 11, color: sc2.text }}>
                              {toStep?.nome || '?'}{i < outgoing.length - 1 ? ' / ' : ''}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {!flowData && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
          <MapIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
          <div>Nenhum fluxo ativo encontrado</div>
        </div>
      )}
    </div>
  )
}

// ─── Componente: Testador de Instância ───────────────────────────────────────
function InstanceTesterTab({ workspaceId }) {
  const [instances, setInstances] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [instanceData, setInstanceData] = useState(null)  // { instance, step, history }
  const [availableActions, setAvailableActions] = useState([])
  const [executing, setExecuting] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [motivoFor, setMotivoFor] = useState(null)
  const [loadingInstance, setLoadingInstance] = useState(false)
  const [filter, setFilter] = useState('ativo')

  // Carregar lista de instâncias
  const loadInstances = useCallback(async () => {
    if (!workspaceId) return
    let q = supabase
      .from('flow_instances')
      .select(`
        id, status, dados_contexto, updated_at, created_at,
        flow_steps(nome, status_valor),
        flow_definitions(nome)
      `)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (filter !== 'todos') q = q.eq('status', filter)
    const { data } = await q
    setInstances(data || [])
  }, [workspaceId, filter])

  useEffect(() => { loadInstances() }, [loadInstances])

  // Carregar dados da instância selecionada
  const loadInstance = useCallback(async (id) => {
    if (!id) return
    setLoadingInstance(true)
    try {
      const [instResp, actResp] = await Promise.all([
        fetch(`/api/flow-engine?action=instance&instance_id=${id}`),
        fetch(`/api/flow-engine?action=actions&instance_id=${id}`),
      ])
      const instData = await instResp.json()
      const actData = await actResp.json()
      setInstanceData(instData.error ? null : instData)
      setAvailableActions(actData.acoes || [])
    } finally {
      setLoadingInstance(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) loadInstance(selectedId)
  }, [selectedId, loadInstance])

  const executeAction = async (acao, forceMotivo = null) => {
    const motivoFinal = forceMotivo !== null ? forceMotivo : motivo
    if (acao.requer_motivo && !motivoFinal.trim()) {
      setMotivoFor(acao)
      return
    }
    setExecuting(acao.id)
    setLastResult(null)
    try {
      const resp = await fetch('/api/flow-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          instance_id: selectedId,
          acao_id: acao.id,
          executado_por: null,
          dados: motivoFinal ? { motivo: motivoFinal } : {},
          origem: 'flow-lab',
        }),
      })
      const result = await resp.json()
      setLastResult({ ok: resp.ok, status: resp.status, data: result, acao: acao.nome })
      if (resp.ok) {
        toast.success(`Ação "${acao.nome}" executada!`)
        setMotivo('')
        setMotivoFor(null)
        await loadInstance(selectedId)
        await loadInstances()
      } else {
        toast.error(result.error || 'Erro ao executar ação')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setExecuting(null)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, minHeight: 500 }}>
      {/* Coluna Esquerda: Lista de instâncias */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>Instâncias</span>
          <button onClick={loadInstances} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 2 }}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
        {/* Filtro */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b', display: 'flex', gap: 4 }}>
          {['ativo', 'concluido', 'todos'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: filter === f ? '#6366f1' : 'transparent',
                color: filter === f ? '#fff' : '#475569' }}>
              {f === 'ativo' ? 'ATIVOS' : f === 'concluido' ? 'CONCLUÍDOS' : 'TODOS'}
            </button>
          ))}
        </div>
        {/* Lista */}
        <div style={{ overflowY: 'auto', maxHeight: 520 }}>
          {instances.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 12 }}>Nenhuma instância</div>
          )}
          {instances.map(inst => {
            const ctx = inst.dados_contexto || {}
            const sc = stepColor(inst.flow_steps?.status_valor)
            const isSelected = inst.id === selectedId
            return (
              <button key={inst.id} onClick={() => setSelectedId(inst.id)}
                style={{ width: '100%', padding: '10px 14px', borderBottom: '1px solid #1e293b10', textAlign: 'left', cursor: 'pointer', border: 'none',
                  background: isSelected ? 'rgba(99,102,241,0.1)' : 'transparent',
                  borderLeft: isSelected ? '2px solid #6366f1' : '2px solid transparent' }}>
                <div style={{ color: isSelected ? '#a5b4fc' : '#e2e8f0', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                  {ctx.numero_pedido || inst.id.substring(0, 8) + '…'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: sc.text }}>{inst.flow_steps?.nome || '?'}</span>
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{fmtRelativo(inst.updated_at)}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Coluna Direita: Detalhes + Ações */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!selectedId && (
          <div style={{ flex: 1, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#475569' }}>
            <BeakerIcon style={{ width: 40, height: 40, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>Selecione uma instância para testar</div>
          </div>
        )}

        {selectedId && loadingInstance && (
          <div style={{ flex: 1, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
            Carregando...
          </div>
        )}

        {selectedId && !loadingInstance && instanceData && (
          <>
            {/* Estado atual */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>ESTADO ATUAL</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Processo', value: instanceData.processo || '—' },
                  { label: 'Etapa', value: instanceData.current_step?.nome || '—' },
                  { label: 'Status', value: instanceData.current_step?.status_valor || '—' },
                  { label: 'Pedido', value: instanceData.dados_contexto?.numero_pedido || '—' },
                  { label: 'Valor', value: instanceData.dados_contexto?.valor_total ? `R$ ${instanceData.dados_contexto.valor_total}` : '—' },
                  { label: 'Atualizado', value: fmtRelativo(instanceData.updated_at) },
                ].map(({ label, value }) => {
                  const sc = label === 'Etapa' ? stepColor(instanceData.current_step?.status_valor) : null
                  return (
                    <div key={label} style={{ background: '#111827', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 13, color: sc ? sc.text : '#e2e8f0', fontWeight: 600 }}>{value}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Ações disponíveis */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>
                AÇÕES DISPONÍVEIS {availableActions.length === 0 && <span style={{ color: '#374151', fontSize: 10, fontWeight: 400 }}>(nenhuma — etapa final ou instância inativa)</span>}
              </div>

              {availableActions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: motivoFor ? 16 : 0 }}>
                  {availableActions.map(acao => {
                    const ac = actionColor(acao.nome)
                    const isRunning = executing === acao.id
                    return (
                      <button key={acao.id} onClick={() => executeAction(acao)}
                        disabled={!!executing}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, cursor: executing ? 'not-allowed' : 'pointer', border: `1.5px solid ${ac.border}`, background: ac.bg, color: ac.text, fontSize: 13, fontWeight: 600, opacity: executing && !isRunning ? 0.4 : 1, transition: 'all 0.15s' }}>
                        {isRunning ? <ArrowPathIcon style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <span style={{ fontSize: 15 }}>{ac.icon}</span>}
                        {acao.nome}
                        {acao.requer_motivo && <span style={{ fontSize: 10, opacity: 0.6 }}>*</span>}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Mini form de motivo */}
              {motivoFor && (
                <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                    Motivo para <strong style={{ color: actionColor(motivoFor.nome).text }}>{motivoFor.nome}</strong>:
                  </div>
                  <textarea
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    placeholder="Descreva o motivo..."
                    autoFocus
                    rows={3}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#f1f5f9', borderRadius: 8, padding: '8px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => executeAction(motivoFor, motivo)}
                      disabled={!motivo.trim()}
                      style={{ padding: '7px 16px', background: '#6366f1', border: 'none', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: motivo.trim() ? 'pointer' : 'not-allowed', opacity: motivo.trim() ? 1 : 0.5 }}>
                      Confirmar
                    </button>
                    <button onClick={() => { setMotivoFor(null); setMotivo('') }}
                      style={{ padding: '7px 16px', background: 'transparent', border: '1px solid #374151', color: '#94a3b8', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Histórico da instância */}
            {instanceData.history && instanceData.history.length > 0 && (
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: 1, marginBottom: 14 }}>HISTÓRICO</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {instanceData.history.map((h, i) => {
                    const sc = stepColor(h.to_step?.status_valor)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 12px', background: '#111827', borderRadius: 8, fontSize: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.dot, flexShrink: 0, marginTop: 3 }} />
                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{h.acao_nome || h.acao_id?.substring(0, 8)}</span>
                          <span style={{ color: '#475569', marginLeft: 8 }}>→ {h.to_step?.nome || '?'}</span>
                          {h.dados?.motivo && <div style={{ color: '#6b7280', marginTop: 2, fontSize: 11 }}>"{h.dados.motivo}"</div>}
                        </div>
                        <span style={{ color: '#475569', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtRelativo(h.executado_em)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Resposta da última ação */}
        {lastResult && (
          <div style={{ background: '#0a0f1a', border: `1px solid ${lastResult.ok ? '#1a3a2a' : '#3a1a1a'}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {lastResult.ok
                ? <CheckCircleIcon style={{ width: 16, height: 16, color: '#10b981' }} />
                : <XCircleIcon style={{ width: 16, height: 16, color: '#ef4444' }} />}
              <span style={{ fontSize: 12, color: lastResult.ok ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {lastResult.ok ? `✓ "${lastResult.acao}" executado (${lastResult.status})` : `✗ Erro — "${lastResult.acao}" (${lastResult.status})`}
              </span>
              <button onClick={() => setLastResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
            <pre style={{ margin: 0, fontSize: 11, color: '#6b7280', overflowX: 'auto', fontFamily: 'monospace' }}>
              {JSON.stringify(lastResult.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Componente: Iniciar Novo Fluxo ──────────────────────────────────────────
function StartNewTab({ workspaceId }) {
  const [definitions, setDefinitions] = useState([])
  const [selectedDef, setSelectedDef] = useState('')
  const [entities, setEntities] = useState([])
  const [selectedEntity, setSelectedEntity] = useState('')
  const [loadingEntities, setLoadingEntities] = useState(false)
  const [starting, setStarting] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!workspaceId) return
    supabase.from('flow_definitions').select('id, nome, modulo, tipo_entidade').eq('workspace_id', workspaceId).eq('ativo', true)
      .then(({ data }) => { setDefinitions(data || []); if (data?.length) setSelectedDef(data[0].id) })
  }, [workspaceId])

  useEffect(() => {
    if (!selectedDef) return
    const def = definitions.find(d => d.id === selectedDef)
    if (!def?.tipo_entidade) return
    setLoadingEntities(true)
    setSelectedEntity('')
    setEntities([])

    // Buscar entidades sem flow_instance
    supabase.from(def.tipo_entidade)
      .select('id, numero_pedido, status, criado_em')
      .eq('workspace_id', workspaceId)
      .not('status', 'in', '(fechado,cancelado,encerrado)')
      .order('criado_em', { ascending: false })
      .limit(30)
      .then(async ({ data: all }) => {
        if (!all?.length) { setEntities([]); setLoadingEntities(false); return }
        // Verificar quais já têm flow_instance
        const { data: existing } = await supabase.from('flow_instances')
          .select('entidade_id')
          .eq('entidade_tipo', def.tipo_entidade)
          .in('entidade_id', all.map(e => e.id))
        const comInst = new Set((existing || []).map(e => e.entidade_id))
        // Mostrar todas, marcando as que já têm
        setEntities(all.map(e => ({ ...e, has_instance: comInst.has(e.id) })))
        setLoadingEntities(false)
      })
  }, [selectedDef, definitions, workspaceId])

  const startFlow = async () => {
    if (!selectedDef || !selectedEntity) return
    const def = definitions.find(d => d.id === selectedDef)
    setStarting(true)
    setResult(null)
    try {
      const resp = await fetch('/api/flow-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          definition_id: selectedDef,
          entidade_tipo: def.tipo_entidade,
          entidade_id: selectedEntity,
          workspace_id: workspaceId,
          dados_contexto: {},
        }),
      })
      const data = await resp.json()
      setResult({ ok: resp.ok, status: resp.status, data })
      if (resp.ok) toast.success('Fluxo iniciado!')
      else toast.error(data.error || 'Erro ao iniciar')
    } finally {
      setStarting(false)
    }
  }

  const selEntity = entities.find(e => e.id === selectedEntity)

  return (
    <div style={{ maxWidth: 540 }}>
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: 1 }}>INICIAR NOVO FLUXO MANUALMENTE</div>

        {/* Processo */}
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#475569', marginBottom: 6 }}>PROCESSO</label>
          <select value={selectedDef} onChange={e => setSelectedDef(e.target.value)}
            style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: 8, padding: '9px 12px', fontSize: 14 }}>
            {definitions.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>

        {/* Entidade */}
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#475569', marginBottom: 6 }}>
            SOLICITAÇÃO {loadingEntities && <span style={{ color: '#374151' }}>(carregando...)</span>}
          </label>
          <select value={selectedEntity} onChange={e => setSelectedEntity(e.target.value)}
            style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', borderRadius: 8, padding: '9px 12px', fontSize: 14 }}>
            <option value=''>— Selecione —</option>
            {entities.map(e => (
              <option key={e.id} value={e.id}>
                {e.numero_pedido || e.id.substring(0, 8)} — {e.status}{e.has_instance ? ' (já tem fluxo)' : ''}
              </option>
            ))}
          </select>
          {selEntity && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#475569' }}>
              Status atual: <span style={{ color: '#94a3b8' }}>{selEntity.status}</span>
              {selEntity.has_instance && <span style={{ color: '#f59e0b', marginLeft: 8 }}>⚠ Já possui flow_instance</span>}
            </div>
          )}
        </div>

        {/* Botão */}
        <button onClick={startFlow} disabled={!selectedEntity || starting || selEntity?.has_instance}
          style={{ padding: '11px 20px', background: selectedEntity && !selEntity?.has_instance ? '#6366f1' : '#1e293b', border: 'none', color: selectedEntity && !selEntity?.has_instance ? '#fff' : '#475569', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: (!selectedEntity || selEntity?.has_instance) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          {starting ? <ArrowPathIcon style={{ width: 16, height: 16 }} /> : <PlayIcon style={{ width: 16, height: 16 }} />}
          {starting ? 'Iniciando...' : 'Iniciar Fluxo'}
        </button>
      </div>

      {/* Resultado */}
      {result && (
        <div style={{ marginTop: 16, background: '#0a0f1a', border: `1px solid ${result.ok ? '#1a3a2a' : '#3a1a1a'}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {result.ok
              ? <CheckCircleIcon style={{ width: 16, height: 16, color: '#10b981' }} />
              : <XCircleIcon style={{ width: 16, height: 16, color: '#ef4444' }} />}
            <span style={{ fontSize: 12, color: result.ok ? '#10b981' : '#ef4444', fontWeight: 700 }}>
              {result.ok ? `✓ Fluxo iniciado (${result.status})` : `✗ Erro (${result.status})`}
            </span>
            <button onClick={() => setResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          <pre style={{ margin: 0, fontSize: 11, color: '#6b7280', overflowX: 'auto', fontFamily: 'monospace' }}>
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Página Principal: Flow Lab ───────────────────────────────────────────────
export default function FlowLab() {
  const workspaceId = useStore(s => s.workspaceId)
  const [tab, setTab] = useState('map')

  const tabs = [
    { id: 'map',   label: '🗺 Mapa do Fluxo',      desc: 'Visualize etapas e responsáveis' },
    { id: 'test',  label: '⚗️ Testar Instância',   desc: 'Execute ações passo a passo' },
    { id: 'start', label: '▶ Iniciar Novo',         desc: 'Inicie um fluxo manualmente' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#030712' }}>
      <Header />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px' }}>
        {/* Título */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <BeakerIcon style={{ width: 22, height: 22, color: '#6366f1' }} />
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>Flow Lab</h1>
            <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, letterSpacing: 1 }}>LABORATÓRIO</span>
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
            Ferramenta de teste visual do motor de fluxo — sem precisar chamar APIs manualmente
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 4 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                background: tab === t.id ? '#1e293b' : 'transparent',
                color: tab === t.id ? '#f1f5f9' : '#475569' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 1 }}>{t.label}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>{t.desc}</div>
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        {tab === 'map'   && <FlowMapTab workspaceId={workspaceId} />}
        {tab === 'test'  && <InstanceTesterTab workspaceId={workspaceId} />}
        {tab === 'start' && <StartNewTab workspaceId={workspaceId} />}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
