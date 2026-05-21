/**
 * FlowHistory — exibe a linha do tempo de um processo no Flow Engine.
 *
 * Props:
 *   solicitacaoId : string (uuid da refei_solicitacoes)
 *   open          : boolean
 */
import { useEffect, useState } from 'react'

const STATUS_COR = {
  rascunho:  { bg: '#f1f5f9', txt: '#64748b', label: 'Rascunho' },
  pendente:  { bg: '#fef3c7', txt: '#b45309', label: 'Aguard. Aprovação' },
  aprovado:  { bg: '#d1fae5', txt: '#065f46', label: 'Aprovado' },
  reprovado: { bg: '#fee2e2', txt: '#991b1b', label: 'Reprovado' },
  entregue:  { bg: '#ede9fe', txt: '#5b21b6', label: 'Entregue' },
  fechado:   { bg: '#f1f5f9', txt: '#475569', label: 'Fechado' },
}

function Badge({ status }) {
  const c = STATUS_COR[status] || { bg: '#f1f5f9', txt: '#64748b', label: status }
  return (
    <span style={{
      background: c.bg, color: c.txt,
      borderRadius: 9999, padding: '2px 10px',
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

function fmtDt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function FlowHistory({ solicitacaoId, open }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!open || !solicitacaoId) return
    setLoading(true)
    setError(null)
    fetch(`/api/flow-engine?action=instance&entidade_tipo=refei_solicitacoes&entidade_id=${solicitacaoId}`)
      .then(r => r.json())
      .then(j => {
        if (j.error) { setError(j.error); return }
        setData(j)
      })
      .catch(() => setError('Erro ao carregar histórico'))
      .finally(() => setLoading(false))
  }, [open, solicitacaoId])

  if (!open) return null

  if (loading) return (
    <div style={{ padding: '16px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
      Carregando histórico...
    </div>
  )

  if (error) return (
    <div style={{ padding: '12px 0', color: '#ef4444', fontSize: 13 }}>
      {error === 'Instância não encontrada'
        ? 'Motor de fluxo não iniciado para esta solicitação.'
        : `Erro: ${error}`}
    </div>
  )

  if (!data) return null

  const { instancia, historico } = data
  const etapaAtual = instancia?.flow_steps

  return (
    <div style={{ marginTop: 8 }}>
      {/* Etapa atual */}
      {etapaAtual && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 12, padding: '8px 12px',
          background: '#f8fafc', borderRadius: 8,
          border: '1px solid #e2e8f0',
        }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Etapa atual:</span>
          <Badge status={instancia.flow_steps?.status_valor} />
          {instancia.sla_vence_em && (
            <span style={{ fontSize: 11, color: '#f59e0b', marginLeft: 'auto' }}>
              ⏱ SLA: {fmtDt(instancia.sla_vence_em)}
            </span>
          )}
        </div>
      )}

      {/* Timeline */}
      {(!historico || historico.length === 0) ? (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>Nenhum evento registrado.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[...historico].reverse().map((h, i) => (
            <div key={h.id || i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Linha vertical */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: i === 0 ? '#10b981' : '#cbd5e1',
                  marginTop: 4,
                }} />
                {i < historico.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: '#e2e8f0', minHeight: 16 }} />
                )}
              </div>

              {/* Conteúdo */}
              <div style={{ paddingBottom: 12, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {h.step_origem_nome && (
                    <>
                      <Badge status={h.status_antes} />
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>→</span>
                    </>
                  )}
                  <Badge status={h.status_depois} />
                  <span style={{
                    fontSize: 11, color: '#475569',
                    background: '#f1f5f9', borderRadius: 4, padding: '1px 6px',
                  }}>
                    {h.acao_nome === 'inicio' ? 'início' : h.acao_nome || '—'}
                  </span>
                </div>

                <div style={{ marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDt(h.created_at)}</span>
                  {h.executado_por_id && (
                    <span style={{ fontSize: 11, color: '#64748b' }}>por {h.executado_por_id.slice(0, 8)}…</span>
                  )}
                  {h.dados?.motivo && (
                    <span style={{ fontSize: 11, color: '#dc2626' }}>"{h.dados.motivo}"</span>
                  )}
                  {h.origem && h.origem !== 'humano' && (
                    <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>{h.origem}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
