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

export default function RefeicaoAprovar() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()

  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [motivo, setMotivo]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(null)

  useEffect(() => {
    fetch(`/api/refeicoes?action=load-aprovar&token=${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) setError(json.error)
        else setData(json)
      })
      .catch(() => setError('Erro de conexão. Tente novamente.'))
      .finally(() => setLoading(false))
  }, [token])

  async function confirmar(acao) {
    if (acao === 'reprovado' && !motivo.trim()) {
      toast.error('Informe o motivo da reprovação')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/refeicoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'aprovar-link', token, acao, motivo: motivo.trim() || null }),
      })
      const json = await r.json()
      if (!r.ok) {
        if (r.status === 409) { setDone({ acao: json.status, ja: true }); return }
        toast.error(json.error || 'Erro ao processar')
        setSaving(false)
        return
      }
      setDone({ acao, ja: false })
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    }
    setSaving(false)
  }

  if (loading) return (
    <PageLayout>
      <Toaster position="top-center" />
      <MainCard>
        <div style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>Carregando...</div>
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

  const { sol, equipeNome, equipeCdc, restauranteNome, itens } = data

  if (done || !['pendente', 'aguardando_aprovacao'].includes(sol.status)) {
    const status = done?.acao || sol.status
    const cfg = {
      aprovado:  { icon: '✅', label: 'Aprovado!',  color: '#10b981', msg: 'O restaurante e o líder foram notificados via WhatsApp.' },
      reprovado: { icon: '❌', label: 'Reprovado',   color: '#ef4444', msg: 'O líder foi notificado com o motivo para corrigir o pedido.' },
      entregue:  { icon: '📦', label: 'Entregue',    color: '#6366f1', msg: '' },
      fechado:   { icon: '🔒', label: 'Fechado',     color: '#6b7280', msg: '' },
    }[status] || { icon: '📋', label: status, color: T.textMuted, msg: '' }

    return (
      <PageLayout>
        <Toaster position="top-center" />
        <MainCard>
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{cfg.icon}</div>
            <div style={{ color: cfg.color, fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Pedido {cfg.label}</div>
            <div style={{ color: T.textMuted, fontSize: 13, marginBottom: 24 }}>{cfg.msg}</div>
            <div style={{ background: T.rowBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px 18px', textAlign: 'left' }}>
              <InfoRow label="Pedido" value={sol.numero_pedido || '—'} />
              <InfoRow label="Equipe" value={equipeNome || '—'} />
              <InfoRow label="Data"   value={fmtData(sol.data_refeicao)} />
              <InfoRow label="Total"  value={fmtBRL(sol.valor_total)} bold />
            </div>
          </div>
        </MainCard>
      </PageLayout>
    )
  }

  // ── Tela de aprovação ─────────────────────────────────────────────────────
  return (
    <PageLayout>
      <Toaster position="top-center" />
      <MainCard>

        {/* Header */}
        <div style={{ padding: '24px 24px 16px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 14 }}>
            Pedido {sol.numero_pedido || '—'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Badge bg='#92400e' color='#fcd34d'>⏳ Pendente</Badge>
            <Badge bg='#1e3a5f' color='#93c5fd'>📅 {fmtData(sol.data_refeicao)}</Badge>
            {restauranteNome && <Badge bg='#1e3a5f' color='#93c5fd'>🏪 {restauranteNome}</Badge>}
            {equipeNome && <Badge bg='#1a2e4a' color='#7dd3fc'>👥 {equipeNome}{equipeCdc ? ` · CDC ${equipeCdc}` : ''}</Badge>}
          </div>
        </div>

        <Divider />

        {/* Stat cards */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <StatCard label="Refeições" value={sol.total_refeicoes || 0} icon="🍽️" />
            <StatCard label="Cafés"     value={sol.total_cafes || 0}     icon="☕" />
            <StatCard label="Total"     value={fmtBRL(sol.valor_total)}  icon="💰" green />
          </div>
        </div>

        <Divider />

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

        {/* Observações */}
        {sol.observacoes && (
          <>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#c7d2fe' }}>
                📝 {sol.observacoes}
              </div>
            </div>
            <Divider />
          </>
        )}

        {/* Motivo */}
        <div style={{ padding: '20px 24px' }}>
          <SectionLabel>Motivo (obrigatório para reprovar)</SectionLabel>
          <textarea
            rows={3}
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Informe caso vá reprovar..."
            style={{
              width: '100%',
              background: T.inputBg,
              border: `1px solid ${T.inputBorder}`,
              borderRadius: 10,
              color: T.text,
              fontSize: 14,
              padding: '10px 14px',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Botões */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 24px 28px' }}>
          <button
            onClick={() => confirmar('reprovado')}
            disabled={saving}
            style={{
              padding: '14px', borderRadius: 12, border: 'none',
              background: 'rgba(220,38,38,0.25)', color: '#fca5a5',
              fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}
          >
            ❌ Reprovar
          </button>
          <button
            onClick={() => confirmar('aprovado')}
            disabled={saving}
            style={{
              padding: '14px', borderRadius: 12, border: 'none',
              background: 'rgba(16,185,129,0.25)', color: '#6ee7b7',
              fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}
          >
            ✅ Aprovar
          </button>
        </div>

      </MainCard>
    </PageLayout>
  )
}


