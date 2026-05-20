import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, TruckIcon, CheckCircleIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}
function diasDesde(iso) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso)) / 86400000)
}

// Modal de confirmação de recebimento
function ModalRecebimento({ sol, onClose, onSaved }) {
  const [obs, setObs]     = useState('')
  const [saving, setSaving] = useState(false)
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('solicitacoes_compra').update({
      status: 'recebido',
    }).eq('id', sol.id)
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    toast.success('✅ Recebimento confirmado!')
    onSaved(); onClose()
  }

  const fornecedor = sol.fornecedor_vencedor || sol.fornecedor

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 16, width: '100%', maxWidth: 460, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Confirmar Recebimento</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>#{sol.numero_requisicao || sol.id.slice(-6).toUpperCase()}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20 }}>×</button>
        </div>

        {/* Resumo do pedido */}
        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{sol.titulo}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            {fornecedor && <div>🏪 Fornecedor: <strong style={{ color: 'var(--text-primary)' }}>{fornecedor}</strong></div>}
            {sol.quantidade && <div>📦 Quantidade: {sol.quantidade}</div>}
            <div>💰 Valor: <strong style={{ color: 'var(--text-primary)' }}>{fmtCurrency(sol.valor_aprovado || sol.valor_estimado)}</strong></div>
            {sol.data_necessidade && <div>📅 Prazo: {fmtDate(sol.data_necessidade)}</div>}
          </div>
        </div>

        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.2)', marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Ao confirmar, o status do pedido passa para <strong style={{ color: '#0ea5e9' }}>Recebido</strong>. O pagamento deve ser finalizado no módulo <strong>Contas a Pagar</strong>.
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 5 }}>Observações (opcional)</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Itens conferidos, divergências de quantidade ou qualidade..."
            style={{ ...inp, resize: 'vertical', minHeight: 64 }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#0ea5e9', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 7 }}>
            {saving ? <ArrowPathIcon style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> : <TruckIcon style={{ width: 15, height: 15 }} />}
            {saving ? 'Confirmando...' : 'Confirmar Recebimento'}
          </button>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

// Card de pedido pendente de recebimento
function PedidoCard({ sol, onRefresh }) {
  const [showModal, setShowModal] = useState(false)
  const dias     = diasDesde(sol.data_aprovacao || sol.created_at)
  const atrasado = sol.data_necessidade && new Date(sol.data_necessidade) < new Date()
  const fornecedor = sol.fornecedor_vencedor || sol.fornecedor

  return (
    <>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '18px 20px', border: `1px solid ${atrasado ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`, borderLeft: `4px solid ${atrasado ? '#ef4444' : '#0ea5e9'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700 }}>#{sol.numero_requisicao || sol.id.slice(-6).toUpperCase()}</span>
              {atrasado && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 10, fontWeight: 700 }}>
                  <ExclamationTriangleIcon style={{ width: 11, height: 11 }} /> ATRASADO
                </span>
              )}
              {sol.urgencia === 'alta' && !atrasado && (
                <span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.10)', color: '#ef4444', fontSize: 10, fontWeight: 700 }}>ALTA</span>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{sol.titulo}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
              {fornecedor && <span>🏪 {fornecedor}</span>}
              {sol.quantidade && <span>📦 {sol.quantidade}</span>}
              <span>💰 {fmtCurrency(sol.valor_aprovado || sol.valor_estimado)}</span>
              {sol.data_necessidade && <span style={{ color: atrasado ? '#ef4444' : 'var(--text-secondary)', fontWeight: atrasado ? 700 : 400 }}>📅 Prazo: {fmtDate(sol.data_necessidade)}</span>}
              <span style={{ color: dias > 7 ? '#f59e0b' : 'var(--text-secondary)' }}>
                🕐 Pedido há {dias === 0 ? 'hoje' : `${dias}d`}
              </span>
            </div>
          </div>

          <button onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, background: '#0ea5e9', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
            <TruckIcon style={{ width: 15, height: 15 }} />
            Confirmar Recebimento
          </button>
        </div>
      </div>

      {showModal && <ModalRecebimento sol={sol} onClose={() => setShowModal(false)} onSaved={onRefresh} />}
    </>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ComprasRecebimento() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('solicitacoes_compra')
      .select('*')
      .eq('status', 'pedido_emitido')
      .order('data_necessidade', { ascending: true, nullsLast: true })
    setData(rows || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const atrasados = data.filter(s => s.data_necessidade && new Date(s.data_necessidade) < new Date())

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="Recebimento" subtitle="Confirme a entrega das compras emitidas" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>>

        {/* Stats rápidas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
          {[
            { label: 'Aguardando entrega', value: data.length,         color: '#0ea5e9', icon: TruckIcon },
            { label: 'Atrasados',          value: atrasados.length,    color: '#ef4444', icon: ExclamationTriangleIcon },
            { label: 'Total a pagar',      value: fmtCurrency(data.reduce((a, s) => a + (s.valor_aprovado || s.valor_estimado || 0), 0)), color: '#f59e0b', isText: true, icon: CheckCircleIcon },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)', borderTop: `3px solid ${k.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{k.label}</div>
                <k.icon style={{ width: 16, height: 16, color: k.color, opacity: 0.8 }} />
              </div>
              <div style={{ fontSize: k.isText ? 15 : 26, fontWeight: 900, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} /> Atualizar
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <ArrowPathIcon style={{ width: 28, height: 28, color: '#0ea5e9', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <TruckIcon style={{ width: 52, height: 52, margin: '0 auto 14px', color: '#0ea5e9', opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Nenhum pedido aguardando entrega</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Quando um pedido for emitido, ele aparecerá aqui para confirmação de recebimento.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {atrasados.length > 0 && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <ExclamationTriangleIcon style={{ width: 18, height: 18, color: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}><strong style={{ color: '#ef4444' }}>{atrasados.length}</strong> pedido(s) com prazo de entrega vencido</span>
              </div>
            )}
            {data.map(sol => (
              <PedidoCard key={sol.id} sol={sol} onRefresh={load} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
