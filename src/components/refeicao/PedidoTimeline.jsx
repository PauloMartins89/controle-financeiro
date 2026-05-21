import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// ─── Configuração de cada tipo de evento na timeline ────────────────────────
const EV = {
  pedido_criado:               { emoji: '📋', color: '#6366f1', label: 'Pedido criado' },
  enviado_aprovacao:           { emoji: '📤', color: '#f59e0b', label: 'Enviado para aprovação' },
  aprovado:                    { emoji: '✅', color: '#10b981', label: 'Aprovado' },
  reprovado:                   { emoji: '❌', color: '#ef4444', label: 'Reprovado' },
  consolidado:                 { emoji: '📦', color: '#6366f1', label: 'Pedido consolidado' },
  enviado_restaurante:         { emoji: '🏪', color: '#8b5cf6', label: 'Enviado ao restaurante' },
  em_acompanhamento:           { emoji: '🔍', color: '#06b6d4', label: 'Em acompanhamento' },
  entrega_registrada:          { emoji: '🚚', color: '#34d399', label: 'Entrega registrada' },
  validacao_enviada:           { emoji: '📱', color: '#f97316', label: 'Validação enviada ao líder' },
  entrega_confirmada:          { emoji: '🎉', color: '#10b981', label: 'Entrega confirmada pelo líder' },
  ocorrencia_registrada:       { emoji: '⚠️', color: '#f59e0b', label: 'Ocorrência registrada' },
  pedido_finalizado:           { emoji: '🏁', color: '#94a3b8', label: 'Pedido finalizado' },
  pedido_finalizado_ocorr:     { emoji: '📌', color: '#f59e0b', label: 'Finalizado com ocorrência' },
  reabertura:                  { emoji: '🔄', color: '#f59e0b', label: 'Pedido reaberto' },
}

function fmtHora(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDiaMes(d) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function fmtDiaCompleto(d) {
  if (!d) return ''
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function PedidoTimeline({ solicitacaoId }) {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!solicitacaoId) return
    setLoading(true)
    supabase
      .from('refei_pedido_eventos')
      .select('*')
      .eq('solicitacao_id', solicitacaoId)
      .order('criado_em', { ascending: true })
      .then(({ data }) => { setEventos(data || []); setLoading(false) })
  }, [solicitacaoId])

  if (loading) {
    return (
      <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Carregando timeline...</span>
      </div>
    )
  }

  if (!eventos.length) {
    return (
      <div style={{ padding: '14px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
        Nenhum evento registrado neste pedido.
      </div>
    )
  }

  // Agrupar por dia (YYYY-MM-DD)
  const grupos = {}
  for (const ev of eventos) {
    const key = (ev.criado_em || '').split('T')[0] || 'sem-data'
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(ev)
  }

  return (
    <div>
      {Object.entries(grupos).map(([day, evs]) => (
        <div key={day} style={{ marginBottom: 6 }}>

          {/* ── Separador de data ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingLeft: 32 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: 1, textTransform: 'uppercase' }}>
              {fmtDiaCompleto(day)}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* ── Eventos do dia ── */}
          {evs.map((ev, i) => {
            const cfg = EV[ev.tipo] || { emoji: '📌', color: '#64748b', label: ev.tipo }
            const isLast = i === evs.length - 1

            return (
              <div key={ev.id} style={{ display: 'flex', gap: 10, position: 'relative', paddingBottom: isLast ? 6 : 18 }}>

                {/* Coluna da esquerda: dot + linha */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
                  <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: `${cfg.color}18`,
                    border: `2px solid ${cfg.color}50`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    flexShrink: 0,
                    zIndex: 1,
                  }}>
                    {cfg.emoji}
                  </div>
                  {!isLast && (
                    <div style={{ flex: 1, width: 2, background: 'var(--border)', marginTop: 4, minHeight: 14 }} />
                  )}
                </div>

                {/* Conteúdo do evento */}
                <div style={{ flex: 1, paddingTop: 5, paddingBottom: 2, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        {ev.descricao}
                      </div>
                      {ev.ator && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ opacity: 0.5 }}>●</span>
                          <span>{ev.ator}</span>
                          {ev.ator_tipo && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                              {ev.ator_tipo}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Dados extras do evento */}
                      {ev.dados?.motivo && (
                        <div style={{ fontSize: 11, color: '#f87171', marginTop: 5, background: 'rgba(239,68,68,0.07)', padding: '4px 8px', borderRadius: 6, borderLeft: '2px solid #ef4444' }}>
                          Motivo: {ev.dados.motivo}
                        </div>
                      )}
                      {ev.dados?.ocorrencia && (
                        <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 5, background: 'rgba(245,158,11,0.08)', padding: '4px 8px', borderRadius: 6, borderLeft: '2px solid #f59e0b' }}>
                          ⚠️ {ev.dados.ocorrencia}
                        </div>
                      )}
                      {ev.dados?.restaurante && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                          🏪 {ev.dados.restaurante}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
                      {fmtHora(ev.criado_em)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
