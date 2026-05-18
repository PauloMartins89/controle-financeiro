import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon, ExclamationTriangleIcon,
  ClockIcon, DocumentTextIcon, UserGroupIcon, BanknotesIcon, PhoneIcon,
  SparklesIcon, ArrowUturnLeftIcon, TrashIcon, PaperAirplaneIcon,
  ShieldCheckIcon, BoltIcon, TableCellsIcon, SignalSlashIcon,
} from '@heroicons/react/24/outline'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function diasAtras(iso) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso)) / 86400000)
}
function horasAtras(iso) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso)) / 3600000)
}

// ─── Semáforo ─────────────────────────────────────────────────────────────────
function SemaforoCard({ label, status, detail, icon: Icon }) {
  const cfg = {
    ok:     { color: '#10b981', bg: 'rgba(16,185,129,0.10)', label: 'Saudável' },
    warn:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: 'Atenção' },
    error:  { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  label: 'Crítico' },
  }[status] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', label: '—' }

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 18px',
      border: `1px solid ${cfg.color}33`, borderLeft: `3px solid ${cfg.color}`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 18, height: 18, color: cfg.color }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{detail}</div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
        {cfg.label}
      </span>
    </div>
  )
}

// ─── KPI mini ─────────────────────────────────────────────────────────────────
function KpiMini({ label, value, color, sub }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ─── Alerta de gargalo ────────────────────────────────────────────────────────
function Gargalo({ color, bg, icon: Icon, title, desc, badge, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
      borderRadius: 10, background: bg, border: `1px solid ${color}22`, marginBottom: 8,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon style={{ width: 16, height: 16, color }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ padding: '2px 8px', borderRadius: 20, background: `${color}22`, color, fontSize: 11, fontWeight: 800 }}>{badge}</span>
        {action && (
          <button onClick={action.fn} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Linha de tabela com ações ────────────────────────────────────────────────
function TabelaRow({ cells, acoes }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      {cells.map((c, i) => (
        <td key={i} style={{ padding: '9px 12px', fontSize: 12, ...c.style }}>{c.value}</td>
      ))}
      {acoes && (
        <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
            {acoes.map((a, i) => (
              <button key={i} onClick={a.fn} title={a.title}
                style={{ padding: '4px 8px', borderRadius: 6, background: a.bg || 'rgba(255,255,255,0.06)', border: `1px solid ${a.borderColor || 'var(--border)'}`, cursor: 'pointer', color: a.color || 'var(--text-secondary)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                {a.icon && <a.icon style={{ width: 13, height: 13 }} />}
                {a.label}
              </button>
            ))}
          </div>
        </td>
      )}
    </tr>
  )
}

function TabelaHeader({ cols, comAcoes }) {
  return (
    <thead>
      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
        {cols.map(c => (
          <th key={c} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{c}</th>
        ))}
        {comAcoes && <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>AÇÕES</th>}
      </tr>
    </thead>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SecTitle({ icon: Icon, color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Icon style={{ width: 16, height: 16, color }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    </div>
  )
}

// ─── Badge de status ──────────────────────────────────────────────────────────
const STATUS_CFG = {
  rascunho:             { color: '#94a3b8', label: 'Rascunho' },
  aguardando_aprovacao: { color: '#f59e0b', label: 'Ag. Aprovação' },
  aprovado:             { color: '#10b981', label: 'Aprovado' },
  devolvido:            { color: '#f97316', label: 'Devolvido' },
  corrigido:            { color: '#6366f1', label: 'Corrigido' },
  reprovado:            { color: '#ef4444', label: 'Reprovado' },
  faturado:             { color: '#8b5cf6', label: 'Faturado' },
  cancelado:            { color: '#64748b', label: 'Cancelado' },
  pendente:             { color: '#f59e0b', label: 'Ag. Aprovação' },
  enviado_cliente:      { color: '#f59e0b', label: 'Ag. Cliente' },
  aprovado_cliente:     { color: '#10b981', label: 'Aprov. Cliente' },
  recusado_cliente:     { color: '#ef4444', label: 'Recusado' },
  faturado_status:      { color: '#8b5cf6', label: 'Faturado' },
  recebido:             { color: '#10b981', label: 'Recebido' },
}
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || { color: '#94a3b8', label: status }
  return (
    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800, background: `${cfg.color}20`, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SaudeTab() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [actionLoading, setActionLoading] = useState({})

  const setAl = (key, v) => setActionLoading(p => ({ ...p, [key]: v }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const hoje = new Date().toISOString().split('T')[0]
      const h24  = new Date(Date.now() - 86400000).toISOString()
      const d30  = new Date(Date.now() - 30 * 86400000).toISOString()

      const [
        resLanc,
        resLotes,
        resPagamentos,
        resMsgs,
        resEventos,
      ] = await Promise.all([
        supabase.from('lancamentos')
          .select('id,tipo,status,valor,data,categoria,descricao,created_at,dados_extras,origem')
          .gte('created_at', d30)
          .order('created_at', { ascending: false })
          .limit(300),
        supabase.from('lotes_cliente')
          .select('id,cliente,status,created_at,updated_at')
          .order('updated_at', { ascending: false })
          .limit(100),
        supabase.from('pagamentos')
          .select('id,descricao,valor_total,data_pagamento,status,numero_nf,created_at')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('mensagens_whatsapp')
          .select('id,telefone,direcao,conteudo,created_at')
          .gte('created_at', h24)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('lancamento_eventos')
          .select('id,lancamento_id,tipo,descricao,created_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      const lancs    = resLanc.data      || []
      const lotes    = resLotes.data     || []
      const pagtos   = resPagamentos.data || []
      const msgs     = resMsgs.data      || []
      const eventos  = resEventos.data   || []

      // ── IA/OCR indicators ──────────────────────────────────────────────────
      const lancWA = lancs.filter(l => l.origem === 'whatsapp' || !l.origem) // default origem = whatsapp
      const lancImagem = lancWA.filter(l =>
        l.dados_extras && Object.keys(l.dados_extras).length > 2
      )
      const lancSemExtraction = lancWA.filter(l =>
        !l.dados_extras || Object.keys(l.dados_extras).length <= 1
      )

      // Possíveis duplicados: mesmo valor + data + (placa ou descricao)
      const dupMap = {}
      lancWA.forEach(l => {
        const key = `${l.valor}__${l.data}__${l.dados_extras?.placa || l.descricao || ''}`
        if (!dupMap[key]) dupMap[key] = []
        dupMap[key].push(l)
      })
      const duplicados = Object.values(dupMap).filter(g => g.length > 1).flat()

      const erroWA = msgs.filter(m => m.direcao === 'saida_erro')
      const entradaWA = msgs.filter(m => m.direcao === 'entrada')

      // ── Gargalos ───────────────────────────────────────────────────────────
      const paradosLanc  = lancs.filter(l =>
        ['aguardando_aprovacao','pendente','corrigido'].includes(l.status) && diasAtras(l.created_at) > 3
      )
      const lotesParados = lotes.filter(l => l.status === 'enviado_cliente' && diasAtras(l.updated_at) > 5)
      const pagtosAbertos = pagtos.filter(p => p.status !== 'recebido')
      const lotesParaFaturar = lotes.filter(l => l.status === 'aprovado_cliente')

      setData({
        // IA/OCR
        ocr: {
          processados:  lancWA.length,
          extraidos:    lancImagem.length,
          baixaConf:    lancSemExtraction.length,
          duplicados:   duplicados.length,
          paraRevisao:  lancWA.filter(l => ['aguardando_aprovacao','pendente'].includes(l.status)).length,
          duplicadosList: duplicados.slice(0, 10),
        },
        // Gargalos
        gargalos: {
          paradosLanc,
          lotesParados,
          pagtosAbertos,
          erroWA,
          lancSemExtraction: lancSemExtraction.slice(0, 10),
        },
        // Tabelas
        tabelas: {
          ultimosLanc:    lancs.slice(0, 10),
          lotesAgCliente: lotes.filter(l => l.status === 'enviado_cliente'),
          lotesParaFaturar,
          pagtosAbertos: pagtosAbertos.slice(0, 10),
          errosWA:        erroWA.slice(0, 10),
        },
        // Semáforo
        saude: {
          pipeline: paradosLanc.length === 0 ? 'ok' : paradosLanc.length <= 3 ? 'warn' : 'error',
          whatsapp: erroWA.length === 0 ? 'ok' : erroWA.length <= 2 ? 'warn' : 'error',
          ocr:      lancSemExtraction.length === 0 ? 'ok' : lancSemExtraction.length <= 5 ? 'warn' : 'error',
          faturamento: pagtosAbertos.length === 0 ? 'ok' : pagtosAbertos.length <= 5 ? 'warn' : 'error',
          lotesCliente: lotesParados.length === 0 ? 'ok' : lotesParados.length <= 2 ? 'warn' : 'error',
        },
      })
      setLastUpdate(new Date())
    } catch (e) {
      console.error('[SaudeTab]', e)
      toast.error('Erro ao carregar saúde: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Ações de restabelecimento ──────────────────────────────────────────────

  async function reprocessarLancamento(id) {
    setAl(id, true)
    const { error } = await supabase.from('lancamentos')
      .update({ status: 'rascunho' })
      .eq('id', id)
    if (error) toast.error('Erro: ' + error.message)
    else { toast.success('Lançamento enviado de volta para Rascunho'); load() }
    setAl(id, false)
  }

  async function marcarReprovado(id) {
    if (!confirm('Marcar como reprovado (possível duplicado)?')) return
    setAl(id, true)
    const { error } = await supabase.from('lancamentos')
      .update({ status: 'reprovado' })
      .eq('id', id)
    if (error) toast.error('Erro: ' + error.message)
    else { toast.success('Lançamento reprovado'); load() }
    setAl(id, false)
  }

  async function reenviarAprovacao(id) {
    setAl(id, true)
    const { error } = await supabase.from('lancamentos')
      .update({ status: 'aguardando_aprovacao' })
      .eq('id', id)
    if (error) toast.error('Erro: ' + error.message)
    else { toast.success('Reenviado para aprovação'); load() }
    setAl(id, false)
  }

  async function reenviarLoteWA(loteId, cliente) {
    setAl('lote_' + loteId, true)
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reenviar_lote', lote_id: loteId }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`Lote de "${cliente}" reenviado via WhatsApp`)
      load()
    } catch (e) {
      toast.error('Falha ao reenviar: ' + e.message)
    }
    setAl('lote_' + loteId, false)
  }

  const cardStyle = {
    background: 'var(--bg-secondary)', borderRadius: 14,
    border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 20,
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>
      <ArrowPathIcon style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
      <div style={{ fontSize: 13 }}>Analisando saúde do sistema...</div>
    </div>
  )

  if (!data) return null

  return (
    <div>
      {/* Última atualização */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ArrowPathIcon style={{ width: 12, height: 12 }} />
          Atualizado às {lastUpdate?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <button onClick={load} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 7, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ArrowPathIcon style={{ width: 13, height: 13 }} />
          Atualizar
        </button>
      </div>

      {/* ── 1. STATUS GERAL ───────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <SecTitle icon={ShieldCheckIcon} color="#6366f1" label="Status Geral do Sistema" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          <SemaforoCard label="Pipeline de Lançamentos" status={data.saude.pipeline}
            detail={data.gargalos.paradosLanc.length > 0 ? `${data.gargalos.paradosLanc.length} lançamento(s) parado(s) há >3 dias` : 'Nenhum item travado'}
            icon={DocumentTextIcon} />
          <SemaforoCard label="WhatsApp / Bot" status={data.saude.whatsapp}
            detail={data.gargalos.erroWA.length > 0 ? `${data.gargalos.erroWA.length} erro(s) nas últimas 24h` : 'Nenhum erro recente'}
            icon={PhoneIcon} />
          <SemaforoCard label="OCR / Extração IA" status={data.saude.ocr}
            detail={data.ocr.baixaConf > 0 ? `${data.ocr.baixaConf} lançamento(s) sem dados extraídos` : 'Extração funcionando bem'}
            icon={SparklesIcon} />
          <SemaforoCard label="Faturamentos Pendentes" status={data.saude.faturamento}
            detail={data.gargalos.pagtosAbertos.length > 0 ? `${data.gargalos.pagtosAbertos.length} NF(s) aguardando recebimento` : 'Todos recebidos'}
            icon={BanknotesIcon} />
          <SemaforoCard label="Resposta do Cliente" status={data.saude.lotesCliente}
            detail={data.gargalos.lotesParados.length > 0 ? `${data.gargalos.lotesParados.length} lote(s) sem resposta há >5 dias` : 'Todos os lotes respondidos'}
            icon={UserGroupIcon} />
        </div>
      </div>

      {/* ── 2. INDICADORES IA/OCR ─────────────────────────────────────────── */}
      <div style={cardStyle}>
        <SecTitle icon={SparklesIcon} color="#8b5cf6" label="Indicadores IA / OCR — últimos 30 dias" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
          <KpiMini label="Documentos processados" value={data.ocr.processados} color="#6366f1" sub="via WhatsApp" />
          <KpiMini label="Extraídos com sucesso"  value={data.ocr.extraidos}   color="#10b981" sub="campos preenchidos" />
          <KpiMini label="Baixa confiança"        value={data.ocr.baixaConf}   color={data.ocr.baixaConf > 0 ? '#f59e0b' : '#10b981'} sub="sem dados extras" />
          <KpiMini label="Possíveis duplicados"   value={data.ocr.duplicados}  color={data.ocr.duplicados > 0 ? '#ef4444' : '#10b981'} sub="mesmo valor+data" />
          <KpiMini label="Enviados p/ revisão"    value={data.ocr.paraRevisao} color="#f59e0b" sub="aguardando aprovação" />
        </div>

        {/* Duplicados */}
        {data.ocr.duplicadosList.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <ExclamationCircleIcon style={{ width: 14, height: 14 }} />
              Possíveis duplicados detectados
            </div>
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <TabelaHeader cols={['DATA', 'DESCRIÇÃO', 'VALOR', 'STATUS', 'PLACA']} comAcoes />
                <tbody>
                  {data.ocr.duplicadosList.map(l => (
                    <TabelaRow key={l.id}
                      cells={[
                        { value: l.data || '—' },
                        { value: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{l.descricao || '—'}</span> },
                        { value: fmtCurrency(l.valor) },
                        { value: <StatusBadge status={l.status} /> },
                        { value: <span style={{ fontFamily: 'monospace' }}>{l.dados_extras?.placa || '—'}</span> },
                      ]}
                      acoes={[
                        { label: 'Reprovar', fn: () => marcarReprovado(l.id), icon: TrashIcon, color: '#ef4444', bg: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', title: 'Marcar como duplicado e reprovar' },
                      ]}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── 3. GARGALOS ──────────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <SecTitle icon={BoltIcon} color="#f59e0b" label="Gargalos Detectados" />

        {[
          data.gargalos.paradosLanc.length === 0,
          data.gargalos.lotesParados.length === 0,
          data.gargalos.pagtosAbertos.length === 0,
          data.gargalos.erroWA.length === 0,
          data.gargalos.lancSemExtraction.length === 0,
        ].every(Boolean) ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <CheckCircleIcon style={{ width: 20, height: 20, color: '#10b981' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>Nenhum gargalo detectado! Sistema operando normalmente.</span>
          </div>
        ) : (
          <>
            {data.gargalos.paradosLanc.length > 0 && (
              <Gargalo
                icon={ClockIcon} color="#f59e0b" bg="rgba(245,158,11,0.05)"
                title={`${data.gargalos.paradosLanc.length} lançamento(s) parado(s) há +3 dias`}
                desc="Aguardando aprovação sem movimentação — pode indicar aprovador ausente"
                badge="PIPELINE"
              />
            )}
            {data.gargalos.lotesParados.length > 0 && (
              <Gargalo
                icon={UserGroupIcon} color="#f97316" bg="rgba(249,115,22,0.05)"
                title={`${data.gargalos.lotesParados.length} lote(s) sem resposta do cliente há +5 dias`}
                desc="Cliente não aprovou nem recusou — necessário follow-up"
                badge="CLIENTE"
              />
            )}
            {data.gargalos.pagtosAbertos.length > 0 && (
              <Gargalo
                icon={BanknotesIcon} color="#8b5cf6" bg="rgba(139,92,246,0.05)"
                title={`${data.gargalos.pagtosAbertos.length} NF(s) emitida(s) sem recebimento confirmado`}
                desc="Faturamentos registrados aguardando confirmação do pagamento"
                badge="FINANCEIRO"
              />
            )}
            {data.gargalos.erroWA.length > 0 && (
              <Gargalo
                icon={SignalSlashIcon} color="#ef4444" bg="rgba(239,68,68,0.05)"
                title={`${data.gargalos.erroWA.length} erro(s) de envio WhatsApp nas últimas 24h`}
                desc="Mensagens que falharam ao ser entregues — verifique o status da Z-API"
                badge="WHATSAPP"
              />
            )}
            {data.gargalos.lancSemExtraction.length > 0 && (
              <Gargalo
                icon={SparklesIcon} color="#6366f1" bg="rgba(99,102,241,0.05)"
                title={`${data.gargalos.lancSemExtraction.length} lançamento(s) sem dados extraídos pelo OCR`}
                desc="Documentos recebidos mas sem campos preenchidos — imagens de baixa qualidade ou OCR falhou"
                badge="OCR"
              />
            )}
          </>
        )}
      </div>

      {/* ── 4. TABELAS DE ACOMPANHAMENTO ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Últimos lançamentos */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <DocumentTextIcon style={{ width: 15, height: 15, color: '#6366f1' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Últimos Lançamentos</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <TabelaHeader cols={['DATA', 'DESCRIÇÃO', 'VALOR', 'STATUS']} comAcoes />
            <tbody>
              {data.tabelas.ultimosLanc.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>Nenhum lançamento nos últimos 30 dias</td></tr>
              ) : data.tabelas.ultimosLanc.map(l => (
                <TabelaRow key={l.id}
                  cells={[
                    { value: l.data || '—', style: { color: 'var(--text-secondary)', whiteSpace: 'nowrap' } },
                    { value: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.descricao || l.dados_extras?.placa || '—'}</span> },
                    { value: fmtCurrency(l.valor) },
                    { value: <StatusBadge status={l.status} /> },
                  ]}
                  acoes={[
                    ...(['aguardando_aprovacao','pendente','corrigido'].includes(l.status)
                      ? [{ label: 'Reprocessar', fn: () => reprocessarLancamento(l.id), icon: ArrowUturnLeftIcon, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)', title: 'Voltar para Rascunho para reenvio' }]
                      : []),
                  ]}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Lotes aguardando cliente */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserGroupIcon style={{ width: 15, height: 15, color: '#f59e0b' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Lotes Aguardando Cliente</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <TabelaHeader cols={['CLIENTE', 'ENVIADO HÁ', 'STATUS']} comAcoes />
            <tbody>
              {data.tabelas.lotesAgCliente.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>Nenhum lote aguardando</td></tr>
              ) : data.tabelas.lotesAgCliente.map(l => (
                <TabelaRow key={l.id}
                  cells={[
                    { value: <span style={{ fontWeight: 600 }}>{l.cliente || '—'}</span> },
                    { value: <span style={{ color: diasAtras(l.updated_at) > 5 ? '#ef4444' : 'var(--text-secondary)' }}>{diasAtras(l.updated_at)}d</span> },
                    { value: <StatusBadge status={l.status} /> },
                  ]}
                  acoes={[
                    { label: 'Reenviar WA', fn: () => reenviarLoteWA(l.id, l.cliente), icon: PaperAirplaneIcon, color: '#25d366', bg: 'rgba(37,211,102,0.08)', borderColor: 'rgba(37,211,102,0.3)', title: 'Reenviar notificação WhatsApp ao cliente' },
                  ]}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Lotes prontos para faturar */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircleIcon style={{ width: 15, height: 15, color: '#10b981' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Prontos para Faturar</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <TabelaHeader cols={['CLIENTE', 'APROVADO HÁ', 'STATUS']} comAcoes />
            <tbody>
              {data.tabelas.lotesParaFaturar.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>Nenhum lote pronto para faturar</td></tr>
              ) : data.tabelas.lotesParaFaturar.map(l => (
                <TabelaRow key={l.id}
                  cells={[
                    { value: <span style={{ fontWeight: 600 }}>{l.cliente || '—'}</span> },
                    { value: <span style={{ color: diasAtras(l.updated_at) > 7 ? '#ef4444' : '#10b981' }}>{diasAtras(l.updated_at)}d</span> },
                    { value: <StatusBadge status={l.status} /> },
                  ]}
                  acoes={[
                    { label: 'Ir para Faturamento', fn: () => window.location.href = '/faturamento', icon: BanknotesIcon, color: '#6366f1', bg: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.3)', title: 'Abrir página de Faturamento' },
                  ]}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Faturamentos pendentes */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BanknotesIcon style={{ width: 15, height: 15, color: '#8b5cf6' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Faturamentos s/ Recebimento</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <TabelaHeader cols={['DESCRIÇÃO', 'VALOR', 'NF', 'STATUS']} comAcoes />
            <tbody>
              {data.tabelas.pagtosAbertos.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>Nenhum faturamento pendente</td></tr>
              ) : data.tabelas.pagtosAbertos.map(p => (
                <TabelaRow key={p.id}
                  cells={[
                    { value: <span style={{ fontWeight: 600 }}>{p.descricao || '—'}</span> },
                    { value: fmtCurrency(p.valor_total) },
                    { value: p.numero_nf ? <span style={{ color: '#818cf8', fontFamily: 'monospace' }}>{p.numero_nf}</span> : <span style={{ color: '#ef4444', fontSize: 10 }}>SEM NF</span> },
                    { value: <StatusBadge status={p.status || 'faturado_status'} /> },
                  ]}
                  acoes={[
                    { label: 'Contas a Receber', fn: () => window.location.href = '/pagamentos', icon: BanknotesIcon, color: '#10b981', bg: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)', title: 'Confirmar recebimento' },
                  ]}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Erros WhatsApp */}
      {data.tabelas.errosWA.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid rgba(239,68,68,0.3)', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.04)' }}>
            <SignalSlashIcon style={{ width: 15, height: 15, color: '#ef4444' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.4 }}>Erros WhatsApp — últimas 24h</span>
            <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 11, fontWeight: 800 }}>{data.tabelas.errosWA.length}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <TabelaHeader cols={['QUANDO', 'TELEFONE', 'MENSAGEM']} comAcoes={false} />
            <tbody>
              {data.tabelas.errosWA.map(m => (
                <TabelaRow key={m.id}
                  cells={[
                    { value: fmtDate(m.created_at), style: { color: 'var(--text-secondary)', whiteSpace: 'nowrap' } },
                    { value: <span style={{ fontFamily: 'monospace', color: '#ef4444' }}>{m.telefone}</span> },
                    { value: <span style={{ color: 'var(--text-secondary)' }}>{m.conteudo?.slice(0, 80) || '—'}</span> },
                  ]}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lançamentos sem extração (OCR falhou) */}
      {data.gargalos.lancSemExtraction.length > 0 && (
        <div style={{ ...cardStyle }}>
          <SecTitle icon={SparklesIcon} color="#6366f1" label="Lançamentos com OCR incompleto — ação necessária" />
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <TabelaHeader cols={['CRIADO EM', 'TELEFONE ORIGEM', 'STATUS']} comAcoes />
              <tbody>
                {data.gargalos.lancSemExtraction.map(l => (
                  <TabelaRow key={l.id}
                    cells={[
                      { value: fmtDate(l.created_at), style: { color: 'var(--text-secondary)', whiteSpace: 'nowrap' } },
                      { value: l.descricao || '—' },
                      { value: <StatusBadge status={l.status} /> },
                    ]}
                    acoes={[
                      { label: 'Reprocessar', fn: () => reprocessarLancamento(l.id), icon: ArrowUturnLeftIcon, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)', title: 'Voltar para rascunho para reenvio manual' },
                      { label: 'Reprovar', fn: () => marcarReprovado(l.id), icon: TrashIcon, color: '#ef4444', bg: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', title: 'Reprovar lançamento inválido' },
                    ]}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
