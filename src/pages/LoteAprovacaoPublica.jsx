import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { CheckCircleIcon, XCircleIcon, DocumentTextIcon, ClockIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

const s = {
  body: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: '#0f172a',
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '24px 12px 48px',
    color: '#e2e8f0',
  },
  wrap: {
    width: '100%',
    maxWidth: 520,
  },
  card: {
    background: '#1e293b',
    borderRadius: 20,
    border: '1px solid #334155',
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)',
    padding: '28px 24px 22px',
    borderBottom: '1px solid #334155',
  },
  title: { fontSize: 20, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 },
  sub: { fontSize: 13, color: '#94a3b8' },
  section: { padding: '18px 24px' },
  label: { fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 0.8, marginBottom: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #334155' },
  td: { padding: '10px 10px', borderBottom: '1px solid #1e293b', color: '#cbd5e1' },
  totalRow: { padding: '12px 24px', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 700 },
  btnGreen: {
    flex: 1, padding: '14px 10px', borderRadius: 12, background: '#10b981', border: 'none',
    cursor: 'pointer', color: '#fff', fontSize: 15, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnRed: {
    flex: 1, padding: '14px 10px', borderRadius: 12, background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.35)', cursor: 'pointer', color: '#ef4444',
    fontSize: 15, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
}

export default function LoteAprovacaoPublica() {
  const { token } = useParams()

  const [lote, setLote] = useState(null)
  const [lancamentos, setLancamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [acao, setAcao] = useState(null) // 'aprovar' | 'recusar'
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)

  // Canvas de assinatura
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const lastPos = useRef(null)
  const [hasSig, setHasSig] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error: e } = await supabase
        .from('lotes_cliente')
        .select('id, cliente, status, created_at, observacoes, aprovador_nome')
        .eq('token_acesso', token)
        .single()

      if (e || !data) {
        setError('Link inválido ou lote não encontrado.')
        setLoading(false)
        return
      }
      setLote(data)

      const { data: lancs } = await supabase
        .from('lancamentos')
        .select('id, data, descricao, valor, dados_extras')
        .eq('lote_cliente_id', data.id)
        .order('data')

      setLancamentos(lancs || [])
      setLoading(false)
    }
    load()
  }, [token])

  // ── Canvas helpers ─────────────────────────────────────────────────────────
  function getPos(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const onStart = useCallback(e => {
    e.preventDefault()
    drawing.current = true
    const pos = getPos(e)
    lastPos.current = pos
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }, [])

  const onMove = useCallback(e => {
    e.preventDefault()
    if (!drawing.current) return
    const pos = getPos(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineWidth = 2.5
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    lastPos.current = pos
    setHasSig(true)
  }, [])

  const onEnd = useCallback(e => {
    e.preventDefault()
    drawing.current = false
  }, [])

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSig(false)
  }

  function getCanvasBase64() {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.toDataURL('image/png').split(',')[1]
  }

  async function handleConfirm() {
    if (acao === 'aprovar' && !hasSig) {
      toast.error('Por favor, assine no campo acima para confirmar.')
      return
    }
    if (acao === 'recusar' && !obs.trim()) {
      toast.error('Por favor, informe o motivo da recusa.')
      return
    }
    setSaving(true)
    try {
      const body = {
        token,
        acao,
        obs,
        confirmadoPor: lote.aprovador_nome || null,
        assinatura: acao === 'aprovar' ? getCanvasBase64() : null,
      }
      const res = await fetch('/api/lote-aprovar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao processar')
      setDone({
        acao,
        sig: acao === 'aprovar' ? canvasRef.current?.toDataURL('image/png') : null,
        aprovadoEm: json.aprovadoEm || new Date().toISOString(),
        aprovadorNome: lote.aprovador_nome || null,
      })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const total = lancamentos.reduce((s, l) => s + (l.valor || 0), 0)

  // ─── Telas de resultado ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...s.body, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#94a3b8', fontSize: 15 }}>Carregando...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...s.body, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <XCircleIcon style={{ width: 48, height: 48, color: '#ef4444', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{error}</div>
        </div>
      </div>
    )
  }

  if (done) {
    const isAprovado = done.acao === 'aprovar'
    const fmtAprovado = done.aprovadoEm
      ? new Date(done.aprovadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : ''
    return (
      <div style={s.body}>
        <Toaster position="top-center" />
        <div style={{ ...s.wrap }}>
          <div style={s.card}>
            <div style={{ padding: '28px 24px', textAlign: 'center' }}>
              {isAprovado
                ? <CheckCircleIcon style={{ width: 52, height: 52, color: '#10b981', margin: '0 auto 14px' }} />
                : <XCircleIcon style={{ width: 52, height: 52, color: '#ef4444', margin: '0 auto 14px' }} />
              }
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', marginBottom: 6 }}>
                {isAprovado ? 'De Acordo confirmado!' : 'Lote recusado.'}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                {isAprovado
                  ? 'Sua aprovação foi registrada com sucesso.'
                  : 'Seu retorno foi registrado. Em breve entraremos em contato.'}
              </div>
            </div>

            {isAprovado && (
              <>
                {/* Bloco dados da aprovação */}
                <div style={{ borderTop: '1px solid #334155', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {done.aprovadorNome && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 0.8, minWidth: 90 }}>APROVADO POR</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{done.aprovadorNome}</span>
                    </div>
                  )}
                  {fmtAprovado && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 0.8, minWidth: 90 }}>DATA / HORA</span>
                      <span style={{ fontSize: 14, color: '#cbd5e1' }}>{fmtAprovado}</span>
                    </div>
                  )}
                </div>

                {/* Preview da assinatura */}
                {done.sig && (
                  <div style={{ borderTop: '1px solid #334155', padding: '16px 24px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 0.8, marginBottom: 10 }}>ASSINATURA REGISTRADA</div>
                    <div style={{ background: '#0f172a', borderRadius: 10, border: '1px solid #334155', overflow: 'hidden' }}>
                      <img src={done.sig} alt="Assinatura" style={{ width: '100%', display: 'block' }} />
                    </div>
                  </div>
                )}

                {/* Selos de validação */}
                <div style={{ borderTop: '1px solid #334155', padding: '14px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircleIcon style={{ width: 14, height: 14 }} />
                    Assinatura digital registrada no sistema
                  </div>
                  <div style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircleIcon style={{ width: 14, height: 14 }} />
                    PDF do lote incluirá esta assinatura
                  </div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                    Este comprovante pode ser impresso via botão de impressão do seu navegador.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (lote.status === 'aprovado_cliente') {
    return (
      <div style={{ ...s.body, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <CheckCircleIcon style={{ width: 56, height: 56, color: '#10b981', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Este lote já foi aprovado.</div>
        </div>
      </div>
    )
  }

  if (lote.status === 'recusado_cliente') {
    return (
      <div style={{ ...s.body, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <XCircleIcon style={{ width: 56, height: 56, color: '#ef4444', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Este lote foi recusado anteriormente.</div>
        </div>
      </div>
    )
  }

  // ─── Tela principal ───────────────────────────────────────────────────────
  return (
    <div style={s.body}>
      <Toaster position="top-center" />
      <div style={s.wrap}>

        {/* Header */}
        <div style={s.card}>
          <div style={s.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <DocumentTextIcon style={{ width: 22, height: 22, color: '#93c5fd' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: 1 }}>
                Aprovação de Lote
              </span>
            </div>
            <div style={s.title}>{lote.cliente}</div>
            <div style={s.sub}>
              {lancamentos.length} lançamento(s) · Gerado em {fmtDate(lote.created_at?.slice(0, 10))}
            </div>
          </div>

          {/* Tabela de lançamentos */}
          <div style={s.section}>
            <div style={s.label}>LANÇAMENTOS INCLUÍDOS</div>
            {lancamentos.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: 13 }}>Nenhum lançamento encontrado.</div>
            ) : (
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Data</th>
                    <th style={s.th}>Descrição</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map(l => {
                    const d = l.dados_extras || {}
                    const desc = d.cliente || d.empresa || l.descricao || '—'
                    return (
                      <tr key={l.id}>
                        <td style={{ ...s.td, whiteSpace: 'nowrap', color: '#94a3b8' }}>{fmtDate(l.data)}</td>
                        <td style={{ ...s.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</td>
                        <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#34d399', whiteSpace: 'nowrap' }}>
                          {fmtCurrency(l.valor)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div style={s.totalRow}>
            <span style={{ color: '#94a3b8' }}>TOTAL</span>
            <span style={{ fontSize: 18, color: '#34d399' }}>{fmtCurrency(total)}</span>
          </div>
        </div>

        {/* Ação */}
        {!acao ? (
          <div style={{ ...s.card }}>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16, textAlign: 'center' }}>
                Revise os lançamentos acima e escolha uma opção:
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={s.btnGreen} onClick={() => setAcao('aprovar')}>
                  <CheckCircleIcon style={{ width: 20, height: 20 }} />
                  De Acordo
                </button>
                <button style={s.btnRed} onClick={() => setAcao('recusar')}>
                  <XCircleIcon style={{ width: 20, height: 20 }} />
                  Recusar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={s.card}>
            <div style={{ padding: '20px 24px' }}>

              {/* Aprovador */}
              {lote.aprovador_nome && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#0f172a', borderRadius: 10, border: '1px solid #334155' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 0.8, marginBottom: 4 }}>APROVADOR</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{lote.aprovador_nome}</div>
                </div>
              )}

              {/* Texto de autorização (apenas ao aprovar) */}
              {acao === 'aprovar' && (
                <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(16,185,129,0.07)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.25)', fontSize: 13, color: '#94a3b8', lineHeight: 1.55 }}>
                  Declaro estar de acordo com os lançamentos acima listados, totalizando{' '}
                  <strong style={{ color: '#34d399' }}>{fmtCurrency(total)}</strong>, e autorizo o faturamento
                  dos serviços prestados conforme discriminado neste documento.
                </div>
              )}

              {/* Campo assinatura */}
              {acao === 'aprovar' && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 0.8, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <PencilIcon style={{ width: 11, height: 11 }} />
                      ASSINATURA *
                    </div>
                    <button
                      onClick={clearCanvas}
                      style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <TrashIcon style={{ width: 12, height: 12 }} />
                      Limpar
                    </button>
                  </div>
                  <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${hasSig ? 'rgba(16,185,129,0.5)' : '#334155'}` }}>
                    <canvas
                      ref={canvasRef}
                      width={520}
                      height={130}
                      style={{ width: '100%', height: 'auto', display: 'block', background: '#0f172a', cursor: 'crosshair', touchAction: 'none' }}
                      onMouseDown={onStart}
                      onMouseMove={onMove}
                      onMouseUp={onEnd}
                      onMouseLeave={onEnd}
                      onTouchStart={onStart}
                      onTouchMove={onMove}
                      onTouchEnd={onEnd}
                    />
                    {!hasSig && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#475569', fontSize: 13 }}>
                        Assine aqui com o dedo ou mouse
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Motivo recusa */}
              {acao === 'recusar' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ ...s.label, display: 'block', marginBottom: 6 }}>MOTIVO DA RECUSA *</label>
                  <textarea
                    value={obs}
                    onChange={e => setObs(e.target.value)}
                    placeholder="Descreva o motivo da recusa..."
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 10,
                      background: '#0f172a', border: '1px solid #334155',
                      color: '#e2e8f0', fontSize: 14, resize: 'vertical',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setAcao(null); setObs(''); clearCanvas() }}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'transparent', border: '1px solid #334155', cursor: 'pointer', color: '#94a3b8', fontSize: 14 }}
                >
                  Voltar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  style={{
                    flex: 2, padding: '12px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                    background: acao === 'aprovar' ? '#10b981' : '#ef4444',
                    color: '#fff', fontSize: 14, fontWeight: 800, opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Aguarde...' : acao === 'aprovar' ? 'Confirmar De Acordo' : 'Confirmar Recusa'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 11, color: '#475569', marginTop: 8 }}>
          <ClockIcon style={{ width: 11, height: 11, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          Este link é exclusivo para aprovação deste lote.
        </div>
      </div>
    </div>
  )
}
