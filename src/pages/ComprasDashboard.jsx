import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCartIcon, ClockIcon, CheckCircleIcon, TrophyIcon,
  BanknotesIcon, ArrowPathIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_CFG = {
  requisicao_nova:      { label: 'Requisição nova',  color: '#94a3b8' },
  em_cotacao:           { label: 'Mont. pedido',     color: '#6366f1' },
  aguardando_aprovacao: { label: 'Ag. Aprovação',    color: '#f59e0b' },
  leilao_aberto:        { label: 'Leilão aberto',    color: '#8b5cf6' },
  leilao_encerrado:     { label: 'Selecionando',     color: '#f97316' },
  aprovado:             { label: 'Aprovado',          color: '#10b981' },
  recusado:             { label: 'Recusado',          color: '#ef4444' },
  pedido_emitido:       { label: 'Pedido emitido',   color: '#0ea5e9' },
  recebido:             { label: 'Recebido',          color: '#10b981' },
  pago:                 { label: 'Pago',              color: '#10b981' },
}

const PIPELINE_ORDER = [
  'requisicao_nova', 'em_cotacao', 'aguardando_aprovacao',
  'leilao_aberto', 'aprovado', 'pedido_emitido', 'recebido', 'pago', 'recusado',
]

export default function ComprasDashboard() {
  const navigate = useNavigate()
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from('solicitacoes_compra')
      .select('id,titulo,status,urgencia,tipo,valor_estimado,valor_aprovado,economia,created_at,fornecedor,fornecedor_vencedor,requisitante_nome')
      .order('created_at', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const now   = new Date()
  const mes   = now.getMonth()
  const ano   = now.getFullYear()
  const doMes = data.filter(s => {
    const d = new Date(s.created_at)
    return d.getMonth() === mes && d.getFullYear() === ano
  })

  const emAndamento     = data.filter(s => ['requisicao_nova','em_cotacao','aguardando_aprovacao','leilao_aberto','leilao_encerrado'].includes(s.status))
  const agAprovacao     = data.filter(s => s.status === 'aguardando_aprovacao')
  const leiloesAbertos  = data.filter(s => s.status === 'leilao_aberto')
  const valorMes        = doMes.reduce((acc, s) => acc + (s.valor_aprovado || 0), 0)
  const economiaMes     = doMes.filter(s => s.economia > 0).reduce((acc, s) => acc + (s.economia || 0), 0)
  const recentes        = data.slice(0, 8)

  const statusCounts = {}
  data.forEach(s => { statusCounts[s.status] = (statusCounts[s.status] || 0) + 1 })
  const maxCount = Math.max(...Object.values(statusCounts), 1)

  const kpis = [
    { label: 'Requisições no mês', value: doMes.length,            icon: ShoppingCartIcon,       color: '#6366f1' },
    { label: 'Em andamento',       value: emAndamento.length,       icon: ClockIcon,              color: '#f59e0b' },
    { label: 'Ag. Aprovação',      value: agAprovacao.length,       icon: ExclamationTriangleIcon,color: agAprovacao.length > 0 ? '#ef4444' : '#94a3b8' },
    { label: 'Leilões abertos',    value: leiloesAbertos.length,    icon: TrophyIcon,             color: '#8b5cf6' },
    { label: 'Gasto no mês',       value: fmtCurrency(valorMes),    icon: BanknotesIcon,          color: '#0ea5e9', isText: true },
    { label: 'Economia no mês',    value: fmtCurrency(economiaMes), icon: CheckCircleIcon,        color: '#10b981', isText: true },
  ]

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header title="Dashboard de Compras" subtitle="Visão geral e KPIs do módulo de compras" action={{ label: 'Atualizar', icon: ArrowPathIcon, onClick: load }} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ArrowPathIcon style={{ width: 24, height: 24, color: 'var(--text-secondary)', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  // ── Próxima Ação Recomendada ──────────────────────────────────────────
  const requisicaoNova   = data.filter(s => s.status === 'requisicao_nova')
  const emCotacao        = data.filter(s => s.status === 'em_cotacao')
  const leilaoEncerrado  = data.filter(s => s.status === 'leilao_encerrado')

  const diasAtras = (isoDate) => Math.floor((now - new Date(isoDate)) / 86400000)

  let proximaAcao = null
  if (agAprovacao.length > 0) {
    const maisParado = Math.max(...agAprovacao.map(s => diasAtras(s.created_at)))
    proximaAcao = {
      cor: '#ef4444', bg: 'rgba(239,68,68,0.10)', borda: 'rgba(239,68,68,0.30)',
      emoji: '🔴',
      msg: `${agAprovacao.length} pedido${agAprovacao.length > 1 ? 's' : ''} aguarda${agAprovacao.length === 1 ? '' : 'm'} aprovação${maisParado > 1 ? ` — o mais antigo há ${maisParado} dias` : ''}`,
      acao: 'Aprovar agora', rota: '/compras/aprovar',
    }
  } else if (leilaoEncerrado.length > 0) {
    proximaAcao = {
      cor: '#f97316', bg: 'rgba(249,115,22,0.10)', borda: 'rgba(249,115,22,0.30)',
      emoji: '⏰',
      msg: `${leilaoEncerrado.length} leilão${leilaoEncerrado.length > 1 ? 'ões' : ''} encerrado${leilaoEncerrado.length > 1 ? 's' : ''} aguardando seleção do vencedor`,
      acao: 'Selecionar vencedor', rota: '/compras/cotacoes',
    }
  } else if (leiloesAbertos.length > 0) {
    proximaAcao = {
      cor: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', borda: 'rgba(139,92,246,0.30)',
      emoji: '🏆',
      msg: `${leiloesAbertos.length} leilão${leiloesAbertos.length > 1 ? 'ões' : ''} aberto${leiloesAbertos.length > 1 ? 's' : ''} — fornecedores podem enviar propostas`,
      acao: 'Ver leilões', rota: '/compras/cotacoes',
    }
  } else if (requisicaoNova.length > 0) {
    proximaAcao = {
      cor: '#6366f1', bg: 'rgba(99,102,241,0.10)', borda: 'rgba(99,102,241,0.30)',
      emoji: '💬',
      msg: `${requisicaoNova.length} requisição${requisicaoNova.length > 1 ? 'ões' : ''} nova${requisicaoNova.length > 1 ? 's' : ''} aguardando início de cotação`,
      acao: 'Iniciar cotação', rota: '/compras/pedidos',
    }
  } else if (emCotacao.length > 0) {
    proximaAcao = {
      cor: '#0ea5e9', bg: 'rgba(14,165,233,0.10)', borda: 'rgba(14,165,233,0.30)',
      emoji: '📋',
      msg: `${emCotacao.length} pedido${emCotacao.length > 1 ? 's' : ''} em montagem aguardando envio ao fornecedor`,
      acao: 'Ver pedidos', rota: '/compras/pedidos',
    }
  } else {
    proximaAcao = {
      cor: '#10b981', bg: 'rgba(16,185,129,0.10)', borda: 'rgba(16,185,129,0.25)',
      emoji: '✅',
      msg: 'Pipeline sem pendências críticas' + (economiaMes > 0 ? ` — economia acumulada no mês: ${fmtCurrency(economiaMes)}` : ''),
      acao: null, rota: null,
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Dashboard de Compras"
        subtitle="Visão geral e KPIs do módulo de compras"
        action={{ label: 'Atualizar', icon: ArrowPathIcon, onClick: load }}
      />

      {/* ── Faixa de Próxima Ação ── */}
      {proximaAcao && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 28px',
          background: proximaAcao.bg,
          borderBottom: `1px solid ${proximaAcao.borda}`,
          gap: 12, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15 }}>{proximaAcao.emoji}</span>
            <span style={{ fontSize: 13, color: proximaAcao.cor, fontWeight: 600 }}>
              Próxima ação:
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
              {proximaAcao.msg}
            </span>
          </div>
          {proximaAcao.acao && (
            <button
              onClick={() => navigate(proximaAcao.rota)}
              style={{
                padding: '6px 16px', borderRadius: 8, border: `1px solid ${proximaAcao.borda}`,
                background: proximaAcao.bg, color: proximaAcao.cor,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.target.style.opacity = '0.75'}
              onMouseLeave={e => e.target.style.opacity = '1'}
            >
              {proximaAcao.acao} →
            </button>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 24 }}>
          {kpis.map((k, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 12, padding: '16px 18px', border: '1px solid var(--border)', borderTop: `3px solid ${k.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 1.4 }}>{k.label}</div>
                <k.icon style={{ width: 18, height: 18, color: k.color, flexShrink: 0, opacity: 0.8 }} />
              </div>
              <div style={{ fontSize: k.isText ? 17 : 30, fontWeight: 900, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Pipeline */}
          <div style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 14, padding: '20px 22px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 18 }}>Pipeline de Status</div>
            {PIPELINE_ORDER.filter(s => statusCounts[s]).map(s => {
              const cfg   = STATUS_CFG[s]
              const count = statusCounts[s] || 0
              const pct   = Math.round((count / maxCount) * 100)
              return (
                <div key={s} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{cfg?.label || s}</span>
                    <span style={{ fontWeight: 800, color: cfg?.color || '#94a3b8' }}>{count}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 6, background: 'var(--border)' }}>
                    <div style={{ height: '100%', borderRadius: 6, width: `${pct}%`, background: cfg?.color || '#94a3b8', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              )
            })}
            {Object.keys(statusCounts).length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: 24 }}>Nenhuma requisição cadastrada</div>
            )}
          </div>

          {/* Últimas requisições */}
          <div style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 14, padding: '20px 22px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 18 }}>Últimas Requisições</div>
            {recentes.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: 24 }}>Nenhuma requisição ainda</div>
            ) : recentes.map(s => {
              const cfg = STATUS_CFG[s.status]
              return (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.titulo}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                      {s.fornecedor || s.fornecedor_vencedor || 'Sem fornecedor'}
                      {s.valor_estimado ? ` · ${fmtCurrency(s.valor_estimado)}` : ''}
                    </div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${cfg?.color || '#94a3b8'}18`, color: cfg?.color || '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {cfg?.label || s.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Alertas */}
        {(agAprovacao.length > 0 || leiloesAbertos.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {agAprovacao.length > 0 && (
              <div onClick={() => navigate('/compras/operacoes/aprovacoes')}
                style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <ExclamationTriangleIcon style={{ width: 20, height: 20, color: '#f59e0b', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{agAprovacao.length} requisição(ões) aguardando aprovação</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Clique para ir a Operações → Aprovações</div>
                </div>
              </div>
            )}
            {leiloesAbertos.length > 0 && (
              <div onClick={() => navigate('/compras/operacoes/cotacoes')}
                style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <TrophyIcon style={{ width: 20, height: 20, color: '#8b5cf6', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{leiloesAbertos.length} leilão(ões) em andamento</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Clique para ir a Operações → Cotações / Leilão</div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
