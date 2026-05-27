import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { CheckCircleIcon, XCircleIcon, DocumentTextIcon, ClockIcon } from '@heroicons/react/24/outline'

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
  const [confirmadoPor, setConfirmadoPor] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)

  useEffect(() => {
    async function load() {
      const { data, error: e } = await supabase
        .from('lotes_cliente')
        .select('id, cliente, status, created_at, observacoes')
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

  async function handleConfirm() {
    if (acao === 'recusar' && !obs.trim()) {
      toast.error('Por favor, informe o motivo da recusa.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/lote-aprovar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, acao, obs, confirmadoPor: confirmadoPor.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao processar')
      setDone(acao)
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
    const isAprovado = done === 'aprovar'
    return (
      <div style={{ ...s.body, alignItems: 'center', justifyContent: 'center' }}>
        <Toaster position="top-center" />
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          {isAprovado
            ? <CheckCircleIcon style={{ width: 64, height: 64, color: '#10b981', margin: '0 auto 16px' }} />
            : <XCircleIcon style={{ width: 64, height: 64, color: '#ef4444', margin: '0 auto 16px' }} />
          }
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>
            {isAprovado ? 'De Acordo confirmado!' : 'Lote recusado.'}
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            {isAprovado
              ? 'Obrigado pela confirmação. Seu retorno foi registrado.'
              : 'Seu retorno foi registrado. Em breve entraremos em contato.'}
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
              <div style={{ marginBottom: 14 }}>
                <label style={{ ...s.label, display: 'block', marginBottom: 6 }}>SEU NOME OU E-MAIL (opcional)</label>
                <input
                  type="text"
                  value={confirmadoPor}
                  onChange={e => setConfirmadoPor(e.target.value)}
                  placeholder="Ex: João Silva ou joao@empresa.com"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: '#0f172a', border: '1px solid #334155',
                    color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
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
                  onClick={() => { setAcao(null); setObs('') }}
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
