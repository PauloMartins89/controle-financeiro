import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import {
  BanknotesIcon, DocumentTextIcon, XMarkIcon, MagnifyingGlassIcon,
  ChevronDownIcon, ChevronUpIcon, TruckIcon, CalendarDaysIcon,
  DocumentArrowDownIcon, EyeIcon, CheckCircleIcon, ClockIcon,
  ArrowUpTrayIcon, CurrencyDollarIcon,
} from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}
function fmtDataHora(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function calcKmTotais(d = {}) {
  const parseKm = v => { const n = parseFloat(String(v || '').replace(/[^\d.,]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n }
  const rows = (d.km_rows || []).filter(r => r.total && String(r.total).trim() !== '')
  const asfalto = rows.filter(r => r.tipo === 'ASFALTO').reduce((s, r) => s + parseKm(r.total), 0)
  const terra   = rows.filter(r => r.tipo === 'TERRA').reduce((s, r) => s + parseKm(r.total), 0)
  return { asfalto, terra, total: asfalto + terra }
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Confirmar Recebimento
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmarRecebimentoModal({ pagamento, onClose, onSaved }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [dataRecebimento, setDataRecebimento] = useState(hoje)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  async function handleConfirmar() {
    setSaving(true)
    try {
      let comprovante_pagamento_url = pagamento.comprovante_pagamento_url || null

      if (file) {
        const ext = file.name.split('.').pop()
        const path = `pagamentos/recebimento/${pagamento.id}_${Date.now()}.${ext}`
        const { data: uploaded, error: upErr } = await supabase.storage
          .from('comprovantes').upload(path, file, { contentType: file.type, upsert: true })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('comprovantes').getPublicUrl(uploaded.path)
        comprovante_pagamento_url = pub?.publicUrl || null
      }

      const { error } = await supabase.from('pagamentos')
        .update({
          status: 'recebido',
          data_recebimento: dataRecebimento,
          comprovante_pagamento_url,
        })
        .eq('id', pagamento.id)
      if (error) throw error

      toast.success('Recebimento confirmado!')
      onSaved()
    } catch (e) {
      toast.error('Erro ao confirmar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460,
        border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircleIcon style={{ width: 18, height: 18, color: '#10b981' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Confirmar Recebimento</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{pagamento.descricao || 'Pagamento'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Valor destaque */}
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>VALOR A CONFIRMAR</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>{(pagamento.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>

        {/* Data de recebimento */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>DATA DE RECEBIMENTO</label>
          <input
            type="date"
            value={dataRecebimento}
            onChange={e => setDataRecebimento(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        {/* Upload comprovante */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>COMPROVANTE DE PAGAMENTO (opcional)</label>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} />
          <div
            onClick={() => fileRef.current.click()}
            style={{
              border: `2px dashed ${file ? '#10b981' : 'var(--border)'}`,
              borderRadius: 10, padding: '16px', textAlign: 'center', cursor: 'pointer',
              background: file ? 'rgba(16,185,129,0.05)' : 'var(--bg-primary)',
              transition: 'all 0.15s',
            }}
          >
            <ArrowUpTrayIcon style={{ width: 22, height: 22, color: file ? '#10b981' : 'var(--text-secondary)', margin: '0 auto 6px' }} />
            <div style={{ fontSize: 13, color: file ? '#10b981' : 'var(--text-secondary)', fontWeight: file ? 700 : 400 }}>
              {file ? file.name : 'Clique para anexar PIX / TED / boleto'}
            </div>
            {!file && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>PNG, JPG ou PDF</div>}
          </div>
          {pagamento.comprovante_pagamento_url && !file && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#10b981' }}>
              ✓ Já possui comprovante anexado —{' '}
              <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.open(pagamento.comprovante_pagamento_url, '_blank')}>visualizar</span>
            </div>
          )}
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={saving || !dataRecebimento}
            style={{ flex: 2, padding: '11px', borderRadius: 8, background: saving ? 'rgba(16,185,129,0.4)' : '#10b981', border: 'none', color: '#fff', fontSize: 14, cursor: saving ? 'default' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <CheckCircleIcon style={{ width: 16, height: 16 }} />
            {saving ? 'Salvando...' : 'Confirmar Recebimento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Card de um pagamento expandível
// ─────────────────────────────────────────────────────────────────────────────
function PagamentoCard({ pagamento, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [lancamentos, setLancamentos] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [showModalRecebimento, setShowModalRecebimento] = useState(false)

  const isRecebido = pagamento.status === 'recebido'

  async function carregarLancamentos() {
    if (lancamentos.length > 0) { setExpanded(e => !e); return }
    setLoadingItems(true)
    setExpanded(true)
    const { data } = await supabase
      .from('lancamentos')
      .select('*')
      .eq('pagamento_id', pagamento.id)
      .order('data', { ascending: true })
    setLancamentos(data || [])
    setLoadingItems(false)
  }

  const fmtKm = v => v > 0 ? v.toLocaleString('pt-BR') : '—'

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: `1px solid ${isRecebido ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, overflow: 'hidden', transition: 'box-shadow 0.2s' }}>

      {/* cabeçalho do card */}
      <div
        onClick={carregarLancamentos}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
        onMouseLeave={e => e.currentTarget.style.background = ''}
      >
        {/* ícone */}
        <div style={{ width: 44, height: 44, borderRadius: 12, background: isRecebido ? 'rgba(16,185,129,0.12)' : 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {isRecebido
            ? <CheckCircleIcon style={{ width: 22, height: 22, color: '#10b981' }} />
            : <BanknotesIcon style={{ width: 22, height: 22, color: '#8b5cf6' }} />
          }
        </div>

        {/* info principal */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pagamento.descricao || 'Pagamento'}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <CalendarDaysIcon style={{ width: 12, height: 12, display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
              NF: {fmtDate(pagamento.data_pagamento)}
            </span>
            {isRecebido && pagamento.data_recebimento && (
              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>
                <CheckCircleIcon style={{ width: 12, height: 12, display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                Recebido: {fmtDate(pagamento.data_recebimento)}
              </span>
            )}
            {pagamento.numero_nf && (
              <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 700 }}>
                NF {pagamento.numero_nf}
              </span>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {pagamento.qtd_lancamentos || 0} lançamento(s)
            </span>
          </div>
        </div>

        {/* valor + badge status */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: isRecebido ? '#10b981' : '#8b5cf6' }}>
            {(pagamento.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span style={{
            display: 'inline-block', marginTop: 4,
            padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 800,
            background: isRecebido ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
            color: isRecebido ? '#10b981' : '#f59e0b',
          }}>
            {isRecebido ? '✓ RECEBIDO' : 'AG. RECEBIMENTO'}
          </span>
        </div>

        {/* ações */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8, flexShrink: 0 }}>
          {/* Comprovante NF */}
          {pagamento.comprovante_nf_url && (
            <button
              title="Ver NF"
              onClick={e => { e.stopPropagation(); window.open(pagamento.comprovante_nf_url, '_blank') }}
              style={{ padding: 6, borderRadius: 7, background: 'rgba(129,140,248,0.1)', border: 'none', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center' }}
            >
              <DocumentArrowDownIcon style={{ width: 16, height: 16 }} />
            </button>
          )}
          {/* Comprovante Pagamento */}
          {pagamento.comprovante_pagamento_url && (
            <button
              title="Ver Comprovante de Pagamento"
              onClick={e => { e.stopPropagation(); window.open(pagamento.comprovante_pagamento_url, '_blank') }}
              style={{ padding: 6, borderRadius: 7, background: 'rgba(16,185,129,0.1)', border: 'none', cursor: 'pointer', color: '#10b981', display: 'flex', alignItems: 'center' }}
            >
              <EyeIcon style={{ width: 16, height: 16 }} />
            </button>
          )}
          {/* Confirmar Recebimento */}
          {!isRecebido && (
            <button
              title="Confirmar Recebimento"
              onClick={e => { e.stopPropagation(); setShowModalRecebimento(true) }}
              style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer', color: '#10b981', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              <CurrencyDollarIcon style={{ width: 15, height: 15 }} />
              Confirmar
            </button>
          )}
          <div style={{ padding: 6, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            {expanded
              ? <ChevronUpIcon style={{ width: 16, height: 16 }} />
              : <ChevronDownIcon style={{ width: 16, height: 16 }} />
            }
          </div>
        </div>
      </div>

      {/* detalhe expandido */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)' }}>

          {/* meta da NF */}
          {(pagamento.numero_nf || pagamento.chave_nfe || pagamento.observacoes) && (
            <div style={{ display: 'flex', gap: 24, padding: '12px 20px', background: 'rgba(139,92,246,0.04)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              {pagamento.numero_nf && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nº NF</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#818cf8' }}>{pagamento.numero_nf}</div>
                </div>
              )}
              {pagamento.chave_nfe && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Chave NF-e</div>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{pagamento.chave_nfe}</div>
                </div>
              )}
              {pagamento.observacoes && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Observações</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{pagamento.observacoes}</div>
                </div>
              )}
            </div>
          )}

          {/* lista de lançamentos */}
          {loadingItems ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</div>
          ) : lancamentos.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Nenhum lançamento vinculado.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                    {['DATA', 'Nº DM', 'EMPRESA / CLIENTE', 'MOTORISTA', 'PLACA', 'ORIGEM → DESTINO', 'KM ASF', 'KM TER', 'VALOR'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: h === 'VALOR' || h.startsWith('KM') ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((l, i) => {
                    const d = l.dados_extras || {}
                    const km = calcKmTotais(d)
                    return (
                      <tr key={l.id} style={{ borderBottom: i < lancamentos.length - 1 ? '1px solid var(--border)' : 'none' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <td style={{ padding: '9px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(l.data)}</td>
                        <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                          {d.numero_diario
                            ? <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{d.numero_diario}</span>
                            : <span style={{ color: 'var(--text-secondary)' }}>—</span>
                          }
                        </td>
                        <td style={{ padding: '9px 14px', maxWidth: 160 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {d.cliente || d.empresa || l.descricao || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '9px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{d.condutor || '—'}</td>
                        <td style={{ padding: '9px 14px', fontFamily: 'monospace', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{d.placa || '—'}</td>
                        <td style={{ padding: '9px 14px', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.local_origem && d.local_destino ? `${d.local_origem} → ${d.local_destino}` : (d.local_origem || d.local_destino || '—')}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', color: '#818cf8', fontWeight: km.asfalto > 0 ? 700 : 400 }}>{fmtKm(km.asfalto)}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', color: '#f59e0b', fontWeight: km.terra > 0 ? 700 : 400 }}>{fmtKm(km.terra)}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>{fmtCurrency(l.valor)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid rgba(139,92,246,0.2)', background: 'rgba(139,92,246,0.05)' }}>
                    <td colSpan={8} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>TOTAL</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 15, fontWeight: 800, color: '#8b5cf6', whiteSpace: 'nowrap' }}>
                      {fmtCurrency(lancamentos.reduce((s, l) => s + (l.valor || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Confirmar Recebimento */}
      {showModalRecebimento && (
        <ConfirmarRecebimentoModal
          pagamento={pagamento}
          onClose={() => setShowModalRecebimento(false)}
          onSaved={() => { setShowModalRecebimento(false); onRefresh() }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
export default function Pagamentos() {
  const { workspaceId } = useStore()
  const [pagamentos, setPagamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    // Busca pagamentos + contagem de lançamentos vinculados
    const { data, error } = await supabase
      .from('pagamentos')
      .select('*, lancamentos(count)')
      .order('status', { ascending: true })
      .order('data_pagamento', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { toast.error('Erro ao carregar pagamentos'); setLoading(false); return }
    const items = (data || []).map(p => ({
      ...p,
      qtd_lancamentos: p.lancamentos?.[0]?.count || 0,
    }))
    setPagamentos(items)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = pagamentos.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.descricao?.toLowerCase().includes(q) ||
      p.numero_nf?.toLowerCase().includes(q) ||
      p.data_pagamento?.includes(q)
    )
  })

  const totalGeral    = pagamentos.reduce((s, p) => s + (p.valor_total || 0), 0)
  const totalRecebido = pagamentos.filter(p => p.status === 'recebido').reduce((s, p) => s + (p.valor_total || 0), 0)
  const totalPendente = pagamentos.filter(p => p.status !== 'recebido').reduce((s, p) => s + (p.valor_total || 0), 0)
  const totalMes = pagamentos
    .filter(p => p.data_pagamento?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, p) => s + (p.valor_total || 0), 0)
  const qtdPendente = pagamentos.filter(p => p.status !== 'recebido').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      <Header title="Contas a Receber" subtitle="Lotes faturados com Nota Fiscal" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* ── Cards de resumo ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'TOTAL FATURADO',        value: fmtCurrency(totalGeral),    color: '#8b5cf6', sub: `${pagamentos.length} faturamento(s)` },
            { label: 'AG. RECEBIMENTO',       value: fmtCurrency(totalPendente), color: '#f59e0b', sub: `${qtdPendente} pendente${qtdPendente !== 1 ? 's' : ''}` },
            { label: 'JÁ RECEBIDO',           value: fmtCurrency(totalRecebido), color: '#10b981', sub: null },
            { label: 'FATURADO ESTE MÊS',     value: fmtCurrency(totalMes),      color: '#6366f1', sub: null },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
              {c.sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{c.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── Busca ── */}
        <div style={{ position: 'relative', marginBottom: 16, maxWidth: 400 }}>
          <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-secondary)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por NF, descrição, data..."
            style={{ width: '100%', paddingLeft: 34, padding: '9px 12px 9px 34px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* ── Lista ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <BanknotesIcon style={{ width: 52, height: 52, color: 'var(--text-secondary)', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
              {search ? 'Nenhum pagamento encontrado.' : 'Nenhum pagamento registrado ainda.\nUse Faturamento → selecione lançamentos aprovados → Registrar Pagamento.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(p => <PagamentoCard key={p.id} pagamento={p} onRefresh={loadData} />)}
          </div>
        )}

      </div>
    </div>
  )
}
