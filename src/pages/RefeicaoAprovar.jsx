import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

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

  // ── Estilos base ───────────────────────────────────────────────────────────
  const page = {
    minHeight: '100dvh',
    background: '#111827',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '0 0 48px',
  }
  const card = {
    width: '100%',
    maxWidth: 480,
    background: '#1f2937',
    borderRadius: 24,
    margin: '24px 12px',
    overflow: 'hidden',
    boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
  }

  if (loading) return (
    <div style={page}>
      <Toaster position="top-center" />
      <div style={{ ...card, padding: 48, textAlign: 'center', color: '#9ca3af' }}>Carregando...</div>
    </div>
  )

  if (error) return (
    <div style={page}>
      <Toaster position="top-center" />
      <div style={{ ...card, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ color: '#f87171', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Link inválido</div>
        <div style={{ color: '#9ca3af', fontSize: 13 }}>{error}</div>
      </div>
    </div>
  )

  const { sol, equipeNome, equipeCdc, restauranteNome, itens } = data

  // ── Pedido já processado ──────────────────────────────────────────────────
  if (done || sol.status !== 'pendente') {
    const status = done?.acao || sol.status
    const cfg = {
      aprovado:  { icon: '✅', label: 'Aprovado!',  color: '#10b981', msg: 'O restaurante e o líder foram notificados via WhatsApp.' },
      reprovado: { icon: '❌', label: 'Reprovado',   color: '#ef4444', msg: 'O líder foi notificado com o motivo para corrigir o pedido.' },
      entregue:  { icon: '📦', label: 'Entregue',    color: '#6366f1', msg: '' },
      fechado:   { icon: '🔒', label: 'Fechado',     color: '#6b7280', msg: '' },
    }[status] || { icon: '📋', label: status, color: '#9ca3af', msg: '' }

    return (
      <div style={page}>
        <Toaster position="top-center" />
        <div style={{ ...card, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{cfg.icon}</div>
          <div style={{ color: cfg.color, fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Pedido {cfg.label}</div>
          <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 24 }}>{cfg.msg}</div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: '14px 18px', textAlign: 'left' }}>
            <InfoRow label="Pedido"     value={sol.numero_pedido || '—'} />
            <InfoRow label="Equipe"     value={equipeNome || '—'} />
            <InfoRow label="Data"       value={fmtData(sol.data_refeicao)} />
            <InfoRow label="Total"      value={fmtBRL(sol.valor_total)} bold />
          </div>
        </div>
      </div>
    )
  }

  // ── Tela de aprovação ─────────────────────────────────────────────────────
  return (
    <div style={page}>
      <Toaster position="top-center" />
      <div style={card}>

        {/* Header */}
        <div style={{ padding: '24px 24px 16px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#f9fafb', marginBottom: 14 }}>
            Pedido {sol.numero_pedido || '—'}
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            <span style={badge('#92400e', '#fcd34d')}>⏳ Pendente</span>
            <span style={badge('#1e3a5f', '#93c5fd')}>📅 {fmtData(sol.data_refeicao)}</span>
            {restauranteNome && <span style={badge('#1e3a5f', '#93c5fd')}>🏪 {restauranteNome}</span>}
            {equipeNome && <span style={badge('#1a2e4a', '#7dd3fc')}>👥 {equipeNome}{equipeCdc ? ` · CDC ${equipeCdc}` : ''}</span>}
          </div>
        </div>

        {/* Divisor */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 0 16px' }} />

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '0 24px 20px' }}>
          <StatCard label="Refeições" value={sol.total_refeicoes || 0} icon="🍽️" />
          <StatCard label="Cafés"     value={sol.total_cafes || 0}     icon="☕" />
          <StatCard label="Total"     value={fmtBRL(sol.valor_total)}  icon="💰" green />
        </div>

        {/* Colaboradores */}
        {itens?.length > 0 && (
          <div style={{ padding: '0 24px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Colaboradores
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {itens.map((it, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
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
        )}

        {/* Observações */}
        {sol.observacoes && (
          <div style={{ margin: '0 24px 20px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#c7d2fe' }}>
            📝 {sol.observacoes}
          </div>
        )}

        {/* Motivo */}
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Motivo (obrigatório para reprovar)
          </div>
          <textarea
            rows={3}
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Informe caso vá reprovar..."
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#f9fafb',
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

      </div>
    </div>
  )
}

function badge(bg, color) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: bg, color, borderRadius: 20,
    padding: '4px 10px', fontSize: 12, fontWeight: 600,
  }
}

function StatCard({ label, value, icon, green }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '12px 10px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: green ? '#34d399' : '#f9fafb' }}>{value}</div>
    </div>
  )
}

function InfoRow({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ color: '#6b7280', fontSize: 13 }}>{label}</span>
      <span style={{ color: bold ? '#34d399' : '#e5e7eb', fontWeight: bold ? 700 : 500, fontSize: 13 }}>{value}</span>
    </div>
  )
}

