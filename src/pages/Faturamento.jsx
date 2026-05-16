import { useState, useCallback, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import {
  CheckCircleIcon, XCircleIcon, ClockIcon, TruckIcon,
  DocumentTextIcon, ChevronDownIcon, MagnifyingGlassIcon,
  CheckIcon, ArrowUturnLeftIcon, WrenchScrewdriverIcon,
  NoSymbolIcon, BanknotesIcon, XMarkIcon, MapPinIcon,
  PhoneIcon, SparklesIcon, PencilIcon, PaperAirplaneIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/24/outline'

async function registrarEvento({ lancamentoId, tipo, statusDe = null, statusPara = null, descricao = null, usuarioId = null, usuarioNome = null, dados = {} }) {
  if (!lancamentoId || !supabase) return
  await supabase.from('lancamento_eventos').insert({
    lancamento_id: lancamentoId,
    tipo,
    status_de:    statusDe,
    status_para:  statusPara,
    descricao,
    usuario_id:   usuarioId,
    usuario_nome: usuarioNome,
    dados,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CONF = {
  rascunho:             { icon: DocumentTextIcon,      color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'Rascunho' },
  aguardando_aprovacao: { icon: ClockIcon,             color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Ag. Aprovação' },
  aprovado:             { icon: CheckCircleIcon,       color: '#10b981', bg: 'rgba(16,185,129,0.12)',  label: 'Aprovado' },
  devolvido:            { icon: ArrowUturnLeftIcon,    color: '#f97316', bg: 'rgba(249,115,22,0.12)',  label: 'Devolvido' },
  corrigido:            { icon: WrenchScrewdriverIcon, color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  label: 'Corrigido' },
  reprovado:            { icon: XCircleIcon,           color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Reprovado' },
  cancelado:            { icon: NoSymbolIcon,          color: '#64748b', bg: 'rgba(100,116,139,0.12)', label: 'Cancelado' },
  faturado:             { icon: BanknotesIcon,         color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  label: 'Faturado' },
  // aliases legado (registros antigos no banco)
  pendente:             { icon: ClockIcon,             color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Ag. Aprovação' },
  rejeitado:            { icon: XCircleIcon,           color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Reprovado' },
}

// status que precisam de revisão (inclui legado 'pendente')
const isPendingReview = s => s === 'aguardando_aprovacao' || s === 'corrigido' || s === 'pendente'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d) {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function fmtHora(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDataHora(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const EVENTO_CONF = {
  criado:             { icon: DocumentTextIcon,      color: '#6366f1', label: 'Lançamento criado' },
  recebido_whatsapp:  { icon: PhoneIcon,             color: '#25d366', label: 'Recebido via WhatsApp' },
  processado_ia:      { icon: SparklesIcon,          color: '#818cf8', label: 'Processado pela IA' },
  editado:            { icon: PencilIcon,            color: '#94a3b8', label: 'Editado' },
  enviado_aprovacao:  { icon: PaperAirplaneIcon,     color: '#f59e0b', label: 'Enviado para aprovação' },
  aprovado:           { icon: CheckCircleIcon,       color: '#10b981', label: 'Aprovado' },
  devolvido:          { icon: ArrowUturnLeftIcon,    color: '#f97316', label: 'Devolvido para correção' },
  corrigido:          { icon: WrenchScrewdriverIcon, color: '#6366f1', label: 'Corrigido e reenviado' },
  reprovado:          { icon: XCircleIcon,           color: '#ef4444', label: 'Reprovado' },
  cancelado:          { icon: NoSymbolIcon,          color: '#64748b', label: 'Cancelado' },
  faturado:           { icon: BanknotesIcon,         color: '#8b5cf6', label: 'Faturado' },
}

function calcKmTotais(d = {}) {
  const parseKm = v => { const n = parseFloat(String(v || '').replace(/[^\d.,]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n }
  const rows = (d.km_rows || []).filter(r => r.total && String(r.total).trim() !== '')
  const asfalto = rows.filter(r => r.tipo === 'ASFALTO').reduce((s, r) => s + parseKm(r.total), 0)
  const terra   = rows.filter(r => r.tipo === 'TERRA').reduce((s, r) => s + parseKm(r.total), 0)
  return { asfalto, terra, total: asfalto + terra }
}

function StatusChip({ status }) {
  const conf = STATUS_CONF[status] || STATUS_CONF.rascunho
  const Icon = conf.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: conf.bg, color: conf.color }}>
      <Icon style={{ width: 11, height: 11 }} />{conf.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalhe de transporte (somente leitura)
// ─────────────────────────────────────────────────────────────────────────────
function TransporteDetail({ d = {} }) {
  const kmRows = (d.km_rows || []).filter(r => r.saida || r.entrada || r.total)

  const infoRows = [
    d.numero_diario && ['Nº Diário',   d.numero_diario],
    d.empresa       && ['Empresa',     d.empresa],
    d.setor         && ['Setor',       d.setor],
    d.solicitante   && ['Solicitante', d.solicitante],
    d.cc            && ['CC',          d.cc],
    (d.local_origem || d.local_destino) && ['Rota', `${d.local_origem || '—'} → ${d.local_destino || '—'}`],
    d.equipamento   && ['Equipamento', d.equipamento],
    d.placa         && ['Placa',       d.placa],
    d.veiculo       && ['Veículo',     d.veiculo],
    d.diarias       && ['Diárias',     d.diarias],
  ].filter(Boolean)

  return (
    <div>
      {infoRows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
          {infoRows.map(([label, value]) => (
            <div key={label}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      )}
      {kmRows.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border)' }}>
            {['', 'SAÍDA', 'ENTRADA', 'TOTAL/KM'].map(h => (
              <div key={h} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>{h}</div>
            ))}
          </div>
          {kmRows.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', borderBottom: i < kmRows.length - 1 ? '1px solid var(--border)' : 'none', background: row.tipo === 'ASFALTO' ? 'rgba(99,102,241,0.04)' : 'rgba(245,158,11,0.04)' }}>
              <div style={{ padding: '5px 8px', fontSize: 10, fontWeight: 800, color: row.tipo === 'ASFALTO' ? '#818cf8' : '#f59e0b', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{row.tipo}</div>
              {[row.saida, row.entrada, row.total].map((v, j) => (
                <div key={j} style={{ padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', textAlign: 'center' }}>{v || '—'}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de Histórico de Eventos
// ─────────────────────────────────────────────────────────────────────────────
function HistoricoModal({ lancamento, onClose }) {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lancamento?.id || !supabase) return
    setLoading(true)
    supabase
      .from('lancamento_eventos')
      .select('*')
      .eq('lancamento_id', lancamento.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setEventos(data || []); setLoading(false) })
  }, [lancamento?.id])

  const d = lancamento?.dados_extras || {}
  const labelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }
  const valueStyle = { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)' }}>

        {/* cabeçalho */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClockIcon style={{ width: 18, height: 18, color: '#818cf8' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Histórico do Lançamento</div>
              {d.numero_diario && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Nº {d.numero_diario}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* resumo do lançamento */}
          <div style={{ padding: '14px 16px', background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              {[
                ['Descrição', lancamento.descricao || '—'],
                ['Data', fmtDate(lancamento.data)],
                d.local_origem  && ['Origem',   d.local_origem],
                d.local_destino && ['Destino',  d.local_destino],
                d.condutor      && ['Condutor', d.condutor],
                d.placa         && ['Placa',    d.placa],
                ['Status', null],
                ['Valor',  null],
              ].filter(Boolean).map(([label, val]) => (
                <div key={label}>
                  <div style={labelStyle}>{label}</div>
                  {label === 'Status' ? (
                    <StatusChip status={lancamento.status} />
                  ) : label === 'Valor' ? (
                    <span style={{ ...valueStyle, color: lancamento.tipo === 'receita' ? '#10b981' : '#ef4444', fontSize: 15, fontWeight: 700 }}>{fmtCurrency(lancamento.valor)}</span>
                  ) : (
                    <div style={valueStyle}>{val}</div>
                  )}
                </div>
              ))}
            </div>

            {/* tabela de km */}
            {(() => {
              const kmRows = (d.km_rows || []).filter(r => r.saida || r.entrada || r.total)
              const km = calcKmTotais(d)
              if (kmRows.length === 0) return null
              return (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Quilometragem</div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                      {['TIPO', 'SAÍDA', 'ENTRADA', 'TOTAL KM'].map(h => (
                        <div key={h} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>{h}</div>
                      ))}
                    </div>
                    {kmRows.map((row, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', borderBottom: i < kmRows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 800, color: row.tipo === 'ASFALTO' ? '#818cf8' : '#f59e0b', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{row.tipo}</div>
                        {[row.saida, row.entrada, row.total].map((v, j) => (
                          <div key={j} style={{ padding: '6px 8px', fontSize: 13, fontWeight: j === 2 ? 700 : 400, color: j === 2 ? 'var(--text-primary)' : 'var(--text-secondary)', textAlign: 'center' }}>{v || '—'}</div>
                        ))}
                      </div>
                    ))}
                    {/* totais */}
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', borderTop: '2px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                      <div style={{ padding: '7px 8px', fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'center' }}>TOTAIS</div>
                      <div />
                      <div />
                      <div style={{ padding: '7px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#818cf8', fontWeight: 700 }}>ASF: {km.asfalto > 0 ? km.asfalto.toLocaleString('pt-BR') : '—'}</div>
                        <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>TER: {km.terra > 0 ? km.terra.toLocaleString('pt-BR') : '—'}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 800, marginTop: 2 }}>{km.total > 0 ? km.total.toLocaleString('pt-BR') + ' km' : '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* linha do tempo */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <ClockIcon style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.8, textTransform: 'uppercase' }}>Histórico de eventos</span>
              {!loading && eventos.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-primary)', borderRadius: 20, padding: '2px 8px', border: '1px solid var(--border)' }}>
                  {eventos.length} evento{eventos.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</div>
            ) : eventos.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px', background: 'var(--bg-primary)', borderRadius: 12, border: '1px dashed var(--border)', gap: 8 }}>
                <MapPinIcon style={{ width: 28, height: 28, color: 'var(--border)' }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>Nenhum evento registrado ainda.</p>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 14, top: 12, bottom: 12, width: 1, background: 'var(--border)' }} />
                {eventos.map((ev, i) => {
                  const conf = EVENTO_CONF[ev.tipo] || EVENTO_CONF.editado
                  const Icon = conf.icon
                  const campos = ev.dados?.campos_alterados || []
                  const isLast = i === eventos.length - 1
                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: 12, marginBottom: isLast ? 0 : 18, position: 'relative' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                        <Icon style={{ width: 13, height: 13, color: conf.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmtHora(ev.created_at)}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{conf.label}</span>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDataHora(ev.created_at)}</span>
                        </div>
                        {ev.usuario_nome && (
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>{ev.usuario_nome}</p>
                        )}
                        {ev.status_de && ev.status_para && (
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>
                            {STATUS_CONF[ev.status_de]?.label || ev.status_de} → {STATUS_CONF[ev.status_para]?.label || ev.status_para}
                          </p>
                        )}
                        {campos.map((c, ci) => (
                          <div key={ci} style={{ marginTop: 4, paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
                            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{c.campo}: {c.de || '—'} → {c.para || '—'}</p>
                          </div>
                        ))}
                        {ev.descricao && (
                          <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
                            {ev.tipo === 'devolvido' && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 4 }}>Motivo:</span>}
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ev.descricao}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Registrar Pagamento em Lote
// ─────────────────────────────────────────────────────────────────────────────
function PagamentoModal({ selecionados, workspaceId, userId, onClose, onSave }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ dataPagamento: hoje, numeroNf: '', chaveNfe: '', descricao: '' })
  const [nfFile, setNfFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const totalValor = selecionados.reduce((s, l) => s + (l.valor || 0), 0)

  async function handleSalvar() {
    if (!selecionados.length) return
    setSaving(true)
    try {
      let comprovante_nf_url = null
      if (nfFile) {
        const ext = nfFile.name.split('.').pop()
        const fileName = `pagamentos/${Date.now()}_nf.${ext}`
        const { data: uploaded, error: uploadErr } = await supabase.storage
          .from('comprovantes').upload(fileName, nfFile, { contentType: nfFile.type, upsert: false })
        if (!uploadErr && uploaded) {
          const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(uploaded.path)
          comprovante_nf_url = urlData?.publicUrl || null
        }
      }
      const descricaoPag = form.descricao.trim() ||
        `Pagamento ${selecionados.length} diário(s) — ${new Date(form.dataPagamento + 'T12:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
      const { data: pagamento, error: pgErr } = await supabase.from('pagamentos').insert({
        workspace_id:      workspaceId || null,
        descricao:         descricaoPag,
        valor_total:       totalValor,
        data_pagamento:    form.dataPagamento,
        numero_nf:         form.numeroNf.trim() || null,
        chave_nfe:         form.chaveNfe.trim() || null,
        comprovante_nf_url,
        criado_por:        userId || null,
      }).select('id').single()
      if (pgErr) throw pgErr
      const ids = selecionados.map(l => l.id)
      const { error: updErr } = await supabase.from('lancamentos')
        .update({ status: 'faturado', pagamento_id: pagamento.id })
        .in('id', ids)
      if (updErr) throw updErr
      for (const l of selecionados) {
        registrarEvento({
          lancamentoId: l.id,
          tipo: 'faturado',
          statusDe: l.status,
          statusPara: 'faturado',
          descricao: `Incluído no pagamento${form.numeroNf ? ' NF ' + form.numeroNf.trim() : ''} · ${fmtCurrency(totalValor)}`,
          usuarioId: userId,
          dados: { pagamento_id: pagamento.id },
        })
      }
      toast.success(`${selecionados.length} lançamento(s) faturado(s)!`)
      // Notificações WhatsApp para cada lançamento faturado
      for (const l of selecionados) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lancamentoId: l.id, status: 'faturado' }),
        })
          .then(r => r.json().then(data => console.log('[notify faturado]', l.id, r.status, data)))
          .catch(err => console.error('[notify faturado] fetch error:', err))
      }
      onSave()
    } catch (e) {
      toast.error('Erro ao registrar pagamento: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)' }}>

        {/* cabeçalho */}
        <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BanknotesIcon style={{ width: 20, height: 20, color: '#8b5cf6' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Registrar Pagamento</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {selecionados.length} lançamento(s) · <span style={{ color: '#8b5cf6', fontWeight: 700 }}>{fmtCurrency(totalValor)}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* lista dos lançamentos selecionados */}
          <div style={{ background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {selecionados.map((l, i) => {
              const d = l.dados_extras || {}
              return (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < selecionados.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    {d.numero_diario && <span style={{ fontSize: 11, fontWeight: 800, color: '#818cf8', flexShrink: 0 }}>Nº {d.numero_diario}</span>}
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.empresa || l.descricao}</span>
                    {d.placa && <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', flexShrink: 0 }}>{d.placa}</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap', marginLeft: 8 }}>{fmtCurrency(l.valor)}</span>
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', background: 'rgba(139,92,246,0.08)', borderTop: '2px solid rgba(139,92,246,0.2)' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>TOTAL</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#8b5cf6' }}>{fmtCurrency(totalValor)}</span>
            </div>
          </div>

          {/* campos do pagamento */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Data do Pagamento</label>
              <input type="date" value={form.dataPagamento} onChange={e => setForm(f => ({ ...f, dataPagamento: e.target.value }))}
                style={{ padding: '9px 10px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nº Nota Fiscal</label>
              <input type="text" value={form.numeroNf} onChange={e => setForm(f => ({ ...f, numeroNf: e.target.value }))} placeholder="Ex: 000123"
                style={{ padding: '9px 10px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Descrição</label>
            <input type="text" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder={`Pagamento ${selecionados.length} diário(s) — ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`}
              style={{ padding: '9px 10px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Chave NF-e <span style={{ fontWeight: 400, opacity: 0.6, fontSize: 10 }}>(opcional)</span></label>
            <input type="text" value={form.chaveNfe} onChange={e => setForm(f => ({ ...f, chaveNfe: e.target.value }))} placeholder="44 dígitos"
              style={{ padding: '9px 10px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12, outline: 'none', fontFamily: 'monospace' }} />
          </div>

          {/* upload comprovante */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Comprovante / NF <span style={{ fontWeight: 400, opacity: 0.6, fontSize: 10 }}>(PDF ou imagem)</span></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', borderRadius: 8, background: 'var(--bg-primary)', border: `2px dashed ${nfFile ? 'rgba(139,92,246,0.5)' : 'var(--border)'}`, cursor: 'pointer', transition: 'border-color 0.15s' }}>
              <input type="file" accept="image/*,.pdf" onChange={e => setNfFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              <DocumentArrowUpIcon style={{ width: 20, height: 20, color: nfFile ? '#8b5cf6' : 'var(--text-secondary)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: nfFile ? '#8b5cf6' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nfFile ? nfFile.name : 'Clique para anexar PDF ou imagem da NF'}
              </span>
              {nfFile && (
                <span onClick={e => { e.preventDefault(); setNfFile(null) }} style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}>
                  <XMarkIcon style={{ width: 15, height: 15 }} />
                </span>
              )}
            </label>
          </div>

        </div>

        {/* footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={saving} style={{ flex: 2, padding: 11, borderRadius: 10, background: saving ? 'rgba(139,92,246,0.5)' : 'linear-gradient(135deg,#7c3aed,#8b5cf6)', border: 'none', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <BanknotesIcon style={{ width: 16, height: 16 }} />
            {saving ? 'Salvando...' : `Registrar Pagamento (${selecionados.length})`}
          </button>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
export default function Faturamento() {
  const { workspaceId } = useStore()
  const [lancamentos, setLancamentos]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('revisao')
  const [expandedId, setExpandedId]     = useState(null)
  const [aprovandoTodos, setAprovandoTodos] = useState(false)
  const [userId, setUserId]             = useState(null)
  const [devolverItem, setDevolverItem] = useState(null)
  const [motivoDevolver, setMotivoDevolver] = useState('')
  const [historicoItem, setHistoricoItem] = useState(null)
  const [selectedIds, setSelectedIds]       = useState(new Set())
  const [pagamentoModal, setPagamentoModal] = useState(false)

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null))
  }, [])

  const loadData = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase
      .from('lancamentos')
      .select('*')
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { toast.error('Erro ao carregar lançamentos'); setLoading(false); return }
    setLancamentos(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleStatus(id, newStatus, motivo = null) {
    const lancamento = lancamentos.find(l => l.id === id)
    const statusAnterior = lancamento?.status || null
    const { error } = await supabase.from('lancamentos').update({ status: newStatus }).eq('id', id)
    if (error) { toast.error('Erro ao atualizar status'); return }
    setLancamentos(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))
    const tipoEvento = newStatus === 'aguardando_aprovacao' ? 'enviado_aprovacao' : newStatus
    await registrarEvento({
      lancamentoId: id,
      tipo: tipoEvento,
      statusDe: statusAnterior,
      statusPara: newStatus,
      descricao: motivo || null,
      usuarioId: userId,
    })
    const msgs = { aprovado: 'Aprovado!', devolvido: 'Devolvido para correção.', reprovado: 'Reprovado.', faturado: 'Marcado como faturado!' }
    toast.success(msgs[newStatus] || 'Status atualizado.')

    // Notificação WhatsApp para destinatários configurados (fire-and-forget)
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lancamentoId: id, status: newStatus, motivo: motivo || null }),
    }).catch(() => {})
  }

  async function handleDevolverConfirm() {
    if (!devolverItem) return
    await handleStatus(devolverItem.id, 'devolvido', motivoDevolver.trim() || null)
    setDevolverItem(null)
    setMotivoDevolver('')
  }

  async function handleAprovarTodos() {
    const pendentes = filtered.filter(l => isPendingReview(l.status))
    if (pendentes.length === 0) { toast('Nenhum lançamento pendente na lista atual.'); return }
    if (!window.confirm(`Aprovar ${pendentes.length} lançamento(s)?`)) return
    setAprovandoTodos(true)
    try {
      const ids = pendentes.map(l => l.id)
      const { error } = await supabase.from('lancamentos').update({ status: 'aprovado' }).in('id', ids)
      if (error) throw error
      setLancamentos(prev => prev.map(l => ids.includes(l.id) ? { ...l, status: 'aprovado' } : l))
      toast.success(`${pendentes.length} lançamento(s) aprovado(s)!`)
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setAprovandoTodos(false)
    }
  }

  const selecionados = lancamentos.filter(l => selectedIds.has(l.id))

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const aprovados = filtered.filter(l => l.status === 'aprovado')
    if (aprovados.length > 0 && aprovados.every(l => selectedIds.has(l.id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(aprovados.map(l => l.id)))
    }
  }

  function handlePagamentoSalvo() {
    setPagamentoModal(false)
    setSelectedIds(new Set())
    loadData()
  }

  // filtro 'revisao' também inclui legado 'pendente'
  const filtered = lancamentos.filter(l => {
    if (filterStatus === 'revisao') {
      if (!isPendingReview(l.status)) return false
    } else if (filterStatus !== 'todos' && l.status !== filterStatus) {
      return false
    }
    if (search) {
      const q = search.toLowerCase()
      const d = l.dados_extras || {}
      if (
        !l.descricao?.toLowerCase().includes(q) &&
        !d.numero_diario?.toLowerCase().includes(q) &&
        !d.empresa?.toLowerCase().includes(q) &&
        !d.placa?.toLowerCase().includes(q) &&
        !d.solicitante?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // ── Totais (do conjunto completo, não filtrado) ───────────────────────────
  const qtdRevisao    = lancamentos.filter(l => isPendingReview(l.status)).length
  const totalRevisao  = lancamentos.filter(l => isPendingReview(l.status)).reduce((s, l) => s + (l.valor || 0), 0)
  const totalAprovado = lancamentos.filter(l => l.status === 'aprovado').reduce((s, l) => s + (l.valor || 0), 0)
  const totalFaturado = lancamentos.filter(l => l.status === 'faturado').reduce((s, l) => s + (l.valor || 0), 0)
  const totalReprovado = lancamentos.filter(l => l.status === 'reprovado').reduce((s, l) => s + (l.valor || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      <Header title="Faturamento" subtitle="Aprovação e controle de lançamentos" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* ── Cards de resumo ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'A REVISAR',  value: fmtCurrency(totalRevisao),  color: '#f59e0b', sub: `${qtdRevisao} lançamento(s)` },
            { label: 'APROVADO',  value: fmtCurrency(totalAprovado),  color: '#10b981', sub: null },
            { label: 'FATURADO',  value: fmtCurrency(totalFaturado),  color: '#8b5cf6', sub: null },
            { label: 'REPROVADO', value: fmtCurrency(totalReprovado), color: '#ef4444', sub: null },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
              {c.sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{c.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── Barra de ações ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-secondary)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar Nº, placa, empresa, solicitante..."
              style={{ width: '100%', paddingLeft: 34, padding: '9px 12px 9px 34px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setSelectedIds(new Set()) }}
            style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer' }}
          >
            <option value="revisao">Pendentes de revisão</option>
            <option value="todos">Todos os status</option>
            <option value="aguardando_aprovacao">Ag. Aprovação</option>
            <option value="corrigido">Corrigidos</option>
            <option value="aprovado">Aprovados</option>
            <option value="faturado">Faturados</option>
            <option value="devolvido">Devolvidos</option>
            <option value="reprovado">Reprovados</option>
            <option value="rascunho">Rascunhos</option>
            <option value="cancelado">Cancelados</option>
          </select>
          {filterStatus === 'revisao' && (
            <button
              onClick={handleAprovarTodos}
              disabled={aprovandoTodos || filtered.filter(l => isPendingReview(l.status)).length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', opacity: aprovandoTodos ? 0.7 : 1 }}
            >
              <CheckIcon style={{ width: 16, height: 16 }} />
              {aprovandoTodos ? 'Aprovando...' : `Aprovar todos (${filtered.filter(l => isPendingReview(l.status)).length})`}
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={() => setPagamentoModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              <BanknotesIcon style={{ width: 16, height: 16 }} />
              Registrar Pagamento ({selectedIds.size}) · {fmtCurrency(selecionados.reduce((s, l) => s + (l.valor || 0), 0))}
            </button>
          )}
        </div>

        {/* ── Lista ───────────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <CheckCircleIcon style={{ width: 52, height: 52, color: 'var(--text-secondary)', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
              {filterStatus === 'pendente' ? 'Nenhum lançamento pendente de aprovação.' : 'Nenhum lançamento encontrado.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '10px 12px', width: 36, textAlign: 'center' }}>
                    <input type="checkbox"
                      checked={filtered.filter(l => l.status === 'aprovado').length > 0 && filtered.filter(l => l.status === 'aprovado').every(l => selectedIds.has(l.id))}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', width: 14, height: 14, accentColor: '#8b5cf6' }}
                    />
                  </th>
                  {['DATA', 'Nº DM', 'CLIENTE / DESCRIÇÃO', 'ORIGEM', 'DESTINO', 'PLACA', 'KM ASF', 'KM TER', 'KM TOTAL', 'VALOR', 'STATUS', 'AÇÕES'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: (h === 'VALOR' || h === 'KM ASF' || h === 'KM TER' || h === 'KM TOTAL') ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const isTransporte = (l.tipo_formulario || 'padrao') === 'transporte'
                  const d = l.dados_extras || {}
                  const km = isTransporte ? calcKmTotais(d) : null
                  const fmtKm = v => v > 0 ? v.toLocaleString('pt-BR') : '—'
                  return (
                    <tr key={l.id} style={{ borderBottom: `1px solid ${l.status === 'pendente' ? 'rgba(245,158,11,0.15)' : 'var(--border)'}`, transition: 'background 0.15s', background: selectedIds.has(l.id) ? 'rgba(139,92,246,0.06)' : '' }}
                      onMouseEnter={e => { if (!selectedIds.has(l.id)) e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
                      onMouseLeave={e => { if (!selectedIds.has(l.id)) e.currentTarget.style.background = '' }}
                    >
                      {/* CHECKBOX */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', width: 36 }}>
                        {l.status === 'aprovado' && (
                          <input type="checkbox"
                            checked={selectedIds.has(l.id)}
                            onChange={() => toggleSelect(l.id)}
                            onClick={e => e.stopPropagation()}
                            style={{ cursor: 'pointer', width: 14, height: 14, accentColor: '#8b5cf6' }}
                          />
                        )}
                      </td>
                      {/* DATA */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 12 }}>{fmtDate(l.data)}</td>
                      {/* Nº DM */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {isTransporte && d.numero_diario
                          ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{d.numero_diario}</span>
                          : <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        }
                      </td>
                      {/* CLIENTE */}
                      <td style={{ padding: '10px 12px', maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {isTransporte ? (d.cliente || d.empresa || l.descricao) : l.descricao}
                        </div>
                        {d.condutor && <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.condutor}</div>}
                      </td>
                      {/* ORIGEM */}
                      <td style={{ padding: '10px 12px', maxWidth: 160, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isTransporte ? (d.local_origem || '—') : '—'}
                      </td>
                      {/* DESTINO */}
                      <td style={{ padding: '10px 12px', maxWidth: 160, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isTransporte ? (d.local_destino || '—') : '—'}
                      </td>
                      {/* PLACA */}
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', letterSpacing: 0.5 }}>{d.placa || '—'}</td>
                      {/* KM ASF */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: km?.asfalto > 0 ? 700 : 400, color: km?.asfalto > 0 ? '#818cf8' : 'var(--text-secondary)', fontSize: 12 }}>{fmtKm(km?.asfalto)}</td>
                      {/* KM TER */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: km?.terra > 0 ? 700 : 400, color: km?.terra > 0 ? '#f59e0b' : 'var(--text-secondary)', fontSize: 12 }}>{fmtKm(km?.terra)}</td>
                      {/* KM TOTAL */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: km?.total > 0 ? 800 : 400, color: km?.total > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13 }}>{fmtKm(km?.total)}</td>
                      {/* VALOR */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmtCurrency(l.valor)}</td>
                      {/* STATUS */}
                      <td style={{ padding: '10px 12px' }}><StatusChip status={l.status} /></td>
                      {/* AÇÕES */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          {/* Aprovar — disponível para ag. aprovação e corrigido */}
                          {isPendingReview(l.status) && (
                            <button title="Aprovar" onClick={() => handleStatus(l.id, 'aprovado')}
                              style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#10b981', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.12)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <CheckCircleIcon style={{ width: 18, height: 18 }} />
                            </button>
                          )}
                          {/* Devolver para correção */}
                          {isPendingReview(l.status) && (
                            <button title="Devolver para correção" onClick={() => { setDevolverItem({ id: l.id, statusAnterior: l.status }); setMotivoDevolver('') }}
                              style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#f97316', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <ArrowUturnLeftIcon style={{ width: 18, height: 18 }} />
                            </button>
                          )}
                          {/* Reprovar definitivo */}
                          {(isPendingReview(l.status) || l.status === 'aprovado') && (
                            <button title="Reprovar definitivo" onClick={() => { if (window.confirm('Reprovar definitivamente este lançamento?')) handleStatus(l.id, 'reprovado') }}
                              style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <XCircleIcon style={{ width: 18, height: 18 }} />
                            </button>
                          )}
                          {/* Faturar — abre modal de pagamento */}
                          {l.status === 'aprovado' && (
                            <button title="Registrar Pagamento" onClick={() => { setSelectedIds(new Set([l.id])); setPagamentoModal(true) }}
                              style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#8b5cf6', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <BanknotesIcon style={{ width: 18, height: 18 }} />
                            </button>
                          )}
                          {l.comprovante_url && (
                            <button title="Ver comprovante" onClick={() => window.open(l.comprovante_url, '_blank')}
                              style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <DocumentTextIcon style={{ width: 15, height: 15 }} />
                            </button>
                          )}
                          <button title="Ver histórico de eventos" onClick={() => setHistoricoItem(l)}
                            style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <ClockIcon style={{ width: 15, height: 15 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ── Modal: Histórico de Eventos ── */}
      {historicoItem && <HistoricoModal lancamento={historicoItem} onClose={() => setHistoricoItem(null)} />}

      {/* ── Modal: Registrar Pagamento em Lote ── */}
      {pagamentoModal && (
        <PagamentoModal
          selecionados={selecionados}
          workspaceId={workspaceId}
          userId={userId}
          onClose={() => { setPagamentoModal(false); setSelectedIds(new Set()) }}
          onSave={handlePagamentoSalvo}
        />
      )}

      {/* ── Modal: Devolver com Motivo ── */}
      {devolverItem && (
        <div onClick={() => setDevolverItem(null)} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 16, width: '100%', maxWidth: 420, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowUturnLeftIcon style={{ width: 18, height: 18, color: '#f97316' }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Devolver para correção</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Informe o motivo da devolução</div>
                </div>
              </div>
              <button onClick={() => setDevolverItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                <XMarkIcon style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>MOTIVO <span style={{ fontWeight: 400, opacity: 0.6 }}>(opcional)</span></label>
              <textarea
                autoFocus
                value={motivoDevolver}
                onChange={e => setMotivoDevolver(e.target.value)}
                placeholder="Ex: KM divergente, falta de assinatura, valor incorreto..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDevolverItem(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleDevolverConfirm} style={{ flex: 2, padding: '11px', borderRadius: 10, background: 'rgba(249,115,22,0.15)', border: '1.5px solid rgba(249,115,22,0.4)', color: '#f97316', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <ArrowUturnLeftIcon style={{ width: 15, height: 15 }} /> Devolver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
