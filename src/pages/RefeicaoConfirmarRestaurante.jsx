import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { T, PageLayout, MainCard, Divider, SectionLabel, Badge, StatCard, InfoRow } from '../components/refeicao/RefeicaoUI'

function fmtBRL(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(d) {
  if (!d) return '—'
  return String(d).split('-').reverse().join('/')
}

export default function RefeicaoConfirmarRestaurante() {
  const { token } = useParams()

  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone]     = useState(false)

  useEffect(() => {
    fetch(`/api/refeicoes?action=load-confirmar-restaurante&token=${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) setError(json.error)
        else setData(json)
      })
      .catch(() => setError('Erro de conexão. Tente novamente.'))
      .finally(() => setLoading(false))
  }, [token])

  async function confirmar() {
    setSaving(true)
    try {
      const r = await fetch('/api/refeicoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirmar-restaurante', token }),
      })
      const json = await r.json()
      if (!r.ok) {
        if (r.status === 409) { setDone(true); return }
        toast.error(json.error || 'Erro ao confirmar')
        setSaving(false)
        return
      }
      setDone(true)
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    }
    setSaving(false)
  }

  if (loading) return (
    <PageLayout>
      <Toaster position="top-center" />
      <MainCard>
        <div style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>Carregando pedido…</div>
      </MainCard>
    </PageLayout>
  )

  if (error) return (
    <PageLayout>
      <Toaster position="top-center" />
      <MainCard>
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Link inválido</div>
          <div style={{ color: T.textMuted, fontSize: 13 }}>{error}</div>
        </div>
      </MainCard>
    </PageLayout>
  )

  const { sol, equipe, restaurante, itens, equipeNome, equipeCdc, restauranteNome } = data
  const supervisorNome = sol.supervisor_nome || equipe?.supervisor_nome || null
  const jaConfirmado = done || !['enviado_restaurante'].includes(sol.status)
  const precisaConfirmar = restaurante?.confirma_pedido

  if (jaConfirmado && precisaConfirmar) {
    return (
      <PageLayout>
        <Toaster position="top-center" />
        <MainCard>
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <div style={{ color: '#10b981', fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Pedido Confirmado!</div>
            <div style={{ color: T.textMuted, fontSize: 13, marginBottom: 24 }}>
              {done ? 'Confirmação registrada com sucesso.' : 'Este pedido já foi confirmado anteriormente.'}
            </div>
            <div style={{ background: T.rowBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px 18px', textAlign: 'left' }}>
              <InfoRow label="Pedido"      value={sol.ticket || sol.numero_pedido || '—'} />
              <InfoRow label="Equipe"      value={equipe?.nome || '—'} />
              <InfoRow label="Data"        value={fmtData(sol.data_refeicao)} />
              <InfoRow label="Total"       value={fmtBRL(sol.valor_total)} bold />
            </div>
          </div>
        </MainCard>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <Toaster position="top-center" />
      <MainCard>

        {/* Header */}
        <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 4 }}>
            {precisaConfirmar ? 'Confirmar Pedido' : 'Detalhes do Pedido'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.textMuted, marginBottom: 14 }}>
            {sol.ticket || sol.numero_pedido || '—'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            <Badge bg='#1a3a2f' color='#6ee7b7'>🏪 {restauranteNome || restaurante?.nome || 'Restaurante'}</Badge>
            <Badge bg='#1e3a5f' color='#93c5fd'>📅 {fmtData(sol.data_refeicao)}</Badge>
            {(equipeNome || equipe?.nome) && <Badge bg='#1a2e4a' color='#7dd3fc'>👥 {equipeNome || equipe?.nome}{equipeCdc ? ` · CDC ${equipeCdc}` : ''}</Badge>}
          </div>
        </div>

        <Divider />

        {/* Stat cards */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <StatCard label="Refeições" value={sol.total_refeicoes || (itens || []).filter(i => i.refeicao).length} icon="🍽️" />
            <StatCard label="Cafés"     value={sol.total_cafes    || (itens || []).filter(i => i.cafe).length}      icon="☕" />
            <StatCard label="Total"     value={fmtBRL(sol.valor_total)} icon="💰" green />
          </div>
        </div>

        <Divider />

        {/* Líder e Supervisor */}
        {(sol.lider_nome || supervisorNome) && (
          <>
            <div style={{ padding: '16px 24px' }}>
              <SectionLabel>Responsáveis</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sol.lider_nome && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.rowBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px' }}>
                    <span style={{ fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Líder</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#e5e7eb' }}>{sol.lider_nome}</span>
                  </div>
                )}
                {supervisorNome && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.rowBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px' }}>
                    <span style={{ fontSize: 12, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Aprovado por</span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#e5e7eb' }}>{supervisorNome}</span>
                  </div>
                )}
              </div>
            </div>
            <Divider />
          </>
        )}

        {/* Colaboradores */}
        {itens?.length > 0 && (
          <>
            <div style={{ padding: '20px 24px' }}>
              <SectionLabel>Colaboradores</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {itens.map((it, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: T.rowBg,
                    border: `1px solid ${T.border}`,
                    borderRadius: 10, padding: '10px 14px',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#e5e7eb' }}>
                      {it.colaborador_nome}
                    </span>
                    <span style={{ display: 'flex', gap: 6, fontSize: 16 }}>
                      {it.refeicao && <span title="Refeição">🍽️</span>}
                      {it.cafe     && <span title="Café">☕</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Divider />
          </>
        )}

        {/* Botão de confirmação (só se restaurante precisa confirmar) */}
        {precisaConfirmar ? (
          <div style={{ padding: '20px 24px 28px' }}>
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '14px 18px', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>
                Confirme o recebimento deste pedido
              </div>
              <div style={{ fontSize: 13, color: T.textMuted }}>
                Toque no botão abaixo para registrar a confirmação
              </div>
            </div>
            <button
              onClick={confirmar}
              disabled={saving}
              style={{
                width: '100%',
                padding: '16px', borderRadius: 12, border: 'none',
                background: saving ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.25)',
                color: '#6ee7b7',
                fontWeight: 700, fontSize: 16, cursor: saving ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Confirmando…' : '✅ Confirmar recebimento do pedido'}
            </button>
          </div>
        ) : (
          <div style={{ padding: '20px 24px 28px' }}>
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>
                📋 Pedido recebido
              </div>
              <div style={{ fontSize: 13, color: T.textMuted }}>
                Prepare as refeições conforme a lista acima. Nenhuma ação adicional é necessária.
              </div>
            </div>
          </div>
        )}

      </MainCard>
    </PageLayout>
  )
}
