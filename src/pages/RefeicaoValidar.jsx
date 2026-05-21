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

export default function RefeicaoValidar() {
  const { token } = useParams()

  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [ocorrencia, setOcorrencia] = useState('')
  const [mostrarOcorrencia, setMostrarOcorrencia] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(null)

  useEffect(() => {
    fetch(`/api/refeicoes?action=load-validar&token=${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) setError(json.error)
        else setData(json)
      })
      .catch(() => setError('Erro de conexão. Tente novamente.'))
      .finally(() => setLoading(false))
  }, [token])

  async function confirmar(resultado) {
    if (resultado === 'com_ocorrencia' && !ocorrencia.trim()) {
      toast.error('Descreva o problema antes de registrar')
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/refeicoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validar-entrega-link',
          token,
          resultado,
          ocorrencia: ocorrencia.trim() || null,
        }),
      })
      const json = await r.json()
      if (!r.ok) {
        if (r.status === 409) { setDone({ resultado: json.status, ja: true }); return }
        toast.error(json.error || 'Erro ao processar')
        setSaving(false)
        return
      }
      setDone({ resultado, ja: false })
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

  const { sol, equipe, restaurante, itens } = data

  if (done || ['finalizado', 'finalizado_com_ocorrencia'].includes(sol.status)) {
    const resultado = done?.resultado || sol.status
    const cfg = {
      correto:                 { icon: '✅', label: 'Entrega Confirmada!',   color: '#10b981', msg: 'Obrigado pela confirmação. O pedido foi finalizado com sucesso.' },
      finalizado:              { icon: '✅', label: 'Entrega Confirmada!',   color: '#10b981', msg: 'Este pedido já foi validado com sucesso.' },
      com_ocorrencia:          { icon: '⚠️', label: 'Ocorrência Registrada', color: '#f59e0b', msg: 'A ocorrência foi registrada e será analisada.' },
      finalizado_com_ocorrencia: { icon: '⚠️', label: 'Ocorrência Registrada', color: '#f59e0b', msg: 'Este pedido já foi finalizado com ocorrência.' },
    }[resultado] || { icon: '📋', label: resultado, color: T.textMuted, msg: '' }

    return (
      <PageLayout>
        <Toaster position="top-center" />
        <MainCard>
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{cfg.icon}</div>
            <div style={{ color: cfg.color, fontWeight: 800, fontSize: 22, marginBottom: 8 }}>{cfg.label}</div>
            <div style={{ color: T.textMuted, fontSize: 13, marginBottom: 24 }}>{cfg.msg}</div>
            <div style={{ background: T.rowBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '14px 18px', textAlign: 'left' }}>
              <InfoRow label="Pedido" value={sol.numero_pedido || '—'} />
              <InfoRow label="Equipe" value={equipe?.nome || '—'} />
              <InfoRow label="Data"   value={fmtData(sol.data_refeicao)} />
              <InfoRow label="Total"  value={fmtBRL(sol.valor_total)} bold />
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
        <div style={{ padding: '24px 24px 16px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 14 }}>
            Confirmar Entrega — {sol.numero_pedido || '—'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Badge bg='#1a3a2f' color='#6ee7b7'>🚚 Entregue</Badge>
            <Badge bg='#1e3a5f' color='#93c5fd'>📅 {fmtData(sol.data_refeicao)}</Badge>
            {restaurante?.nome && <Badge bg='#1e3a5f' color='#93c5fd'>🏪 {restaurante.nome}</Badge>}
            {equipe?.nome && <Badge bg='#1a2e4a' color='#7dd3fc'>👥 {equipe.nome}</Badge>}
          </div>
        </div>

        <Divider />

        {/* Stat cards */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <StatCard label="Refeições" value={sol.total_refeicoes || (itens || []).filter(i => i.refeicao).length} icon="🍽️" />
            <StatCard label="Cafés"     value={sol.total_cafes || (itens || []).filter(i => i.cafe).length}         icon="☕" />
            <StatCard label="Total"     value={fmtBRL(sol.valor_total)} icon="💰" green />
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

        {/* Pergunta */}
        <div style={{ padding: '20px 24px 4px' }}>
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>
              A refeição foi entregue corretamente?
            </div>
            <div style={{ fontSize: 13, color: T.textMuted }}>
              Confirme abaixo para finalizar o pedido
            </div>
          </div>
        </div>

        {/* Área de ocorrência */}
        {mostrarOcorrencia && (
          <div style={{ padding: '16px 24px 0' }}>
            <SectionLabel>Descreva o problema</SectionLabel>
            <textarea
              rows={3}
              value={ocorrencia}
              onChange={e => setOcorrencia(e.target.value)}
              placeholder="Ex: Faltou 2 refeições, pedido chegou frio, houve atraso…"
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
        )}

        {/* Botões */}
        <div style={{ display: 'grid', gridTemplateColumns: mostrarOcorrencia ? '1fr' : '1fr 1fr', gap: 12, padding: '20px 24px 28px' }}>
          {!mostrarOcorrencia && (
            <button
              onClick={() => setMostrarOcorrencia(true)}
              disabled={saving}
              style={{
                padding: '14px', borderRadius: 12, border: 'none',
                background: 'rgba(220,38,38,0.25)', color: '#fca5a5',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}
            >
              ⚠️ Houve problema
            </button>
          )}
          {mostrarOcorrencia ? (
            <button
              onClick={() => confirmar('com_ocorrencia')}
              disabled={saving}
              style={{
                padding: '14px', borderRadius: 12, border: 'none',
                background: 'rgba(245,158,11,0.25)', color: '#fcd34d',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}
            >
              {saving ? 'Enviando…' : '📋 Registrar ocorrência'}
            </button>
          ) : (
            <button
              onClick={() => confirmar('correto')}
              disabled={saving}
              style={{
                padding: '14px', borderRadius: 12, border: 'none',
                background: 'rgba(16,185,129,0.25)', color: '#6ee7b7',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}
            >
              {saving ? 'Enviando…' : '✅ Tudo certo'}
            </button>
          )}
        </div>

      </MainCard>
    </PageLayout>
  )
}
