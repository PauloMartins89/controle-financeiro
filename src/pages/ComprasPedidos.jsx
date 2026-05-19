import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, CheckCircleIcon, ClipboardDocumentListIcon,
  TruckIcon, BanknotesIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

const STAGE_CFG = {
  aprovado:       { label: 'Aprovado',       color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  pedido_emitido: { label: 'Pedido emitido', color: '#0ea5e9', bg: 'rgba(14,165,233,0.10)' },
  recebido:       { label: 'Recebido',       color: '#10b981', bg: 'rgba(16,185,129,0.10)' },
  pago:           { label: 'Pago',           color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
}

const URGENCIA_CFG = {
  baixa: { label: 'Baixa', color: '#10b981' },
  media: { label: 'Média', color: '#f59e0b' },
  alta:  { label: 'Alta',  color: '#ef4444' },
}

// Modal: Emitir Pedido
function ModalEmitirPedido({ sol, onClose, onSaved }) {
  const [obs, setObs]       = useState('')
  const [saving, setSaving] = useState(false)
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('solicitacoes_compra').update({
      status: 'pedido_emitido',
      observacao_aprovador: obs.trim() || sol.observacao_aprovador || null,
    }).eq('id', sol.id)
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    toast.success('Pedido marcado como emitido!')
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 14, width: '100%', maxWidth: 440, padding: 26 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Emitir Pedido</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 18 }}>#{sol.numero_requisicao || sol.id.slice(-6).toUpperCase()} — {sol.titulo}</div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 5 }}>Observação (opcional)</label>
          <input value={obs} onChange={e => setObs(e.target.value)} style={inp} placeholder="Número do pedido externo, condições..." autoFocus />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#0ea5e9', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : '📋 Emitir Pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal: Marcar Recebido
function ModalRecebido({ sol, onClose, onSaved }) {
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('solicitacoes_compra').update({ status: 'recebido' }).eq('id', sol.id)
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    toast.success('Recebimento confirmado!')
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 14, width: '100%', maxWidth: 440, padding: 26 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Confirmar Recebimento</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 18 }}>#{sol.numero_requisicao || sol.id.slice(-6).toUpperCase()} — {sol.titulo}</div>
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.2)', marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
          📦 Confirme que os itens foram recebidos em boas condições. O pagamento será processado pelo financeiro.
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 5 }}>Observações (opcional)</label>
          <input value={obs} onChange={e => setObs(e.target.value)} style={inp} placeholder="Itens conferidos, divergências..." autoFocus />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#10b981', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : '📦 Confirmar Recebimento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal: Marcar Pago
function ModalPago({ sol, onClose, onSaved }) {
  const [valor, setValor] = useState(sol.valor_aprovado || sol.valor_estimado || '')
  const [obs, setObs]     = useState('')
  const [saving, setSaving] = useState(false)
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('solicitacoes_compra').update({
      status: 'pago',
      valor_aprovado: parseFloat(String(valor).replace(',', '.')) || sol.valor_aprovado,
      data_pagamento: new Date().toISOString().split('T')[0],
    }).eq('id', sol.id)
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    toast.success('Compra marcada como paga!')
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 14, width: '100%', maxWidth: 440, padding: 26 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Marcar como Pago</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 18 }}>#{sol.numero_requisicao || sol.id.slice(-6).toUpperCase()} — {sol.titulo}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 5 }}>Valor pago (R$)</label>
            <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 5 }}>Fornecedor</label>
            <input value={sol.fornecedor_vencedor || sol.fornecedor || ''} disabled style={{ ...inp, opacity: 0.6 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: '#10b981', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : '💰 Confirmar Pagamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Linha da tabela ──────────────────────────────────────────────────────────
function PedidoRow({ sol, onRefresh }) {
  const [showEmitir,   setShowEmitir]   = useState(false)
  const [showRecebido, setShowRecebido] = useState(false)
  const [showPago,     setShowPago]     = useState(false)
  const cfg = STAGE_CFG[sol.status] || STAGE_CFG.aprovado
  const urg = URGENCIA_CFG[sol.urgencia] || URGENCIA_CFG.media

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
          #{sol.numero_requisicao || sol.id.slice(-6).toUpperCase()}
        </td>
        <td style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{sol.titulo}</div>
          {sol.requisitante_nome && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Req: {sol.requisitante_nome}</div>}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
          {sol.fornecedor_vencedor || sol.fornecedor || '—'}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          {fmtCurrency(sol.valor_aprovado || sol.valor_estimado)}
          {sol.economia > 0 && (
            <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>-{fmtCurrency(sol.economia)}</div>
          )}
        </td>
        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {fmtDate(sol.data_aprovacao || sol.created_at)}
        </td>
        <td style={{ padding: '10px 12px' }}>
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.label}</span>
        </td>
        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
          {sol.status === 'aprovado' && (
            <button onClick={() => setShowEmitir(true)}
              style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', cursor: 'pointer', color: '#0ea5e9', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
              <ClipboardDocumentListIcon style={{ width: 13, height: 13 }} /> Emitir Pedido
            </button>
          )}
          {sol.status === 'pedido_emitido' && (
            <button onClick={() => setShowRecebido(true)}
              style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', cursor: 'pointer', color: '#0ea5e9', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
              <TruckIcon style={{ width: 13, height: 13 }} /> Confirmar Recebimento
            </button>
          )}
          {sol.status === 'recebido' && (
            <button onClick={() => setShowPago(true)}
              style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer', color: '#10b981', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
              <BanknotesIcon style={{ width: 13, height: 13 }} /> Marcar como Pago
            </button>
          )}
          {sol.status === 'pago' && (
            <span style={{ fontSize: 11, color: '#64748b' }}>Concluído {fmtDate(sol.data_pagamento)}</span>
          )}
        </td>
      </tr>

      {showEmitir   && <ModalEmitirPedido sol={sol} onClose={() => setShowEmitir(false)}   onSaved={onRefresh} />}
      {showRecebido && <ModalRecebido     sol={sol} onClose={() => setShowRecebido(false)} onSaved={onRefresh} />}
      {showPago     && <ModalPago         sol={sol} onClose={() => setShowPago(false)}     onSaved={onRefresh} />}
    </>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ComprasPedidos() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [aba,     setAba]     = useState('todos')
  const [busca,   setBusca]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('solicitacoes_compra')
      .select('*')
      .in('status', ['aprovado','pedido_emitido','recebido','pago'])
      .order('updated_at', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const abas = [
    { key: 'todos',         label: 'Todos',            count: data.length },
    { key: 'aprovado',      label: 'Aprovados',        count: data.filter(s => s.status === 'aprovado').length },
    { key: 'pedido_emitido',label: 'Pedido emitido',   count: data.filter(s => s.status === 'pedido_emitido').length },
    { key: 'recebido',      label: 'Recebido',         count: data.filter(s => s.status === 'recebido').length },
    { key: 'pago',          label: 'Pago',             count: data.filter(s => s.status === 'pago').length },
  ]

  const filtrado = data
    .filter(s => aba === 'todos' || s.status === aba)
    .filter(s => !busca || s.titulo?.toLowerCase().includes(busca.toLowerCase()) || s.fornecedor?.toLowerCase().includes(busca.toLowerCase()))

  const pendentes = data.filter(s => ['aprovado','pedido_emitido'].includes(s.status))

  const thStyle = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="Pedidos Emitidos" subtitle="Acompanhe a execução das compras aprovadas" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }}>

        {/* Alerta de pendentes */}
        {pendentes.length > 0 && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.2)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
            <TruckIcon style={{ width: 18, height: 18, color: '#0ea5e9', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{pendentes.length}</strong> pedido(s) aguardando ação (emissão ou recebimento)
            </span>
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {abas.map(a => (
            <button key={a.key} onClick={() => setAba(a.key)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid', borderColor: aba === a.key ? '#0ea5e9' : 'var(--border)', background: aba === a.key ? 'rgba(14,165,233,0.10)' : 'var(--bg-secondary)', color: aba === a.key ? '#0ea5e9' : 'var(--text-secondary)' }}>
              {a.label}{a.count > 0 ? ` (${a.count})` : ''}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <MagnifyingGlassIcon style={{ width: 14, height: 14, position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." style={{ padding: '6px 10px 6px 28px', borderRadius: 8, fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', width: 180 }} />
            </div>
            <button onClick={load} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <ArrowPathIcon style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <ArrowPathIcon style={{ width: 28, height: 28, color: '#0ea5e9', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtrado.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <CheckCircleIcon style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 700 }}>Nenhum pedido encontrado</div>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Descrição</th>
                  <th style={thStyle}>Fornecedor</th>
                  <th style={thStyle}>Valor</th>
                  <th style={thStyle}>Data</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map(sol => (
                  <PedidoRow key={sol.id} sol={sol} onRefresh={load} />
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}
