import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import toast from 'react-hot-toast'
import {
  ExclamationTriangleIcon, ClockIcon, ShoppingCartIcon,
  CheckCircleIcon, TruckIcon, BanknotesIcon, ArrowRightIcon,
  BoltIcon, CalendarDaysIcon, BuildingStorefrontIcon,
  DocumentTextIcon, BellAlertIcon, FunnelIcon,
  MagnifyingGlassIcon, PlusIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'

function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00').toLocaleDateString('pt-BR')
}
function diasPara(iso) {
  if (!iso) return null
  const diff = Math.ceil((new Date(iso + 'T00:00') - new Date()) / 86400000)
  return diff
}
function diasAtras(iso) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso)) / 86400000)
}

const URGENCIA_COLOR = { alta: '#ef4444', media: '#f59e0b', baixa: '#10b981' }

export default function ComprasWorkspace() {
  const navigate = useNavigate()
  const { workspaceId } = useStore()
  const [wsId, setWsId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    urgentes: [],
    cotacoes: [],
    aprovacoes: [],
    entregas: [],
    vencidas: [],
  })
  const [lastRefresh, setLastRefresh] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    setWsId(workspaceId)
    loadAll(workspaceId).finally(() => setLoading(false))
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll(wid) {
    setRefreshing(true)
    const hoje = new Date().toISOString().slice(0, 10)
    const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const em3dias = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)

    const [resUrgentes, resCotacoes, resAprov, resEntregas, resVencidas] = await Promise.all([
      // Requisicoes urgentes sem cotacao em andamento
      supabase.from('solicitacoes_compra').select('id,titulo,urgencia,data_necessidade,criado_por,created_at,valor_estimado')
        .eq('workspace_id', wid).eq('urgencia', 'alta')
        .in('status', ['requisicao_nova', 'em_cotacao'])
        .order('data_necessidade', { ascending: true, nullsFirst: false }).limit(10),

      // Leiloes abertos perto do prazo (3 dias)
      supabase.from('solicitacoes_compra').select('id,titulo,data_necessidade,valor_estimado,created_at')
        .eq('workspace_id', wid).eq('status', 'leilao_aberto')
        .lte('data_necessidade', em3dias)
        .order('data_necessidade', { ascending: true }).limit(10),

      // Aguardando aprovacao
      supabase.from('solicitacoes_compra').select('id,titulo,urgencia,data_necessidade,valor_estimado,created_at')
        .eq('workspace_id', wid).eq('status', 'aguardando_aprovacao')
        .order('created_at', { ascending: true }).limit(10),

      // Entregas previstas nos próximos 7 dias
      supabase.from('solicitacoes_compra').select('id,titulo,data_necessidade,valor_estimado,fornecedor')
        .eq('workspace_id', wid).eq('status', 'pedido_emitido')
        .gte('data_necessidade', hoje).lte('data_necessidade', em7dias)
        .order('data_necessidade', { ascending: true }).limit(10),

      // Entregas atrasadas (pedido_emitido com data_necessidade passada)
      supabase.from('solicitacoes_compra').select('id,titulo,data_necessidade,valor_estimado,fornecedor')
        .eq('workspace_id', wid).eq('status', 'pedido_emitido')
        .lt('data_necessidade', hoje)
        .order('data_necessidade', { ascending: true }).limit(10),
    ])

    setData({
      urgentes: resUrgentes.data || [],
      cotacoes: resCotacoes.data || [],
      aprovacoes: resAprov.data || [],
      entregas: resEntregas.data || [],
      vencidas: resVencidas.data || [],
    })
    setLastRefresh(new Date())
    setRefreshing(false)
  }

  const totalPendencias = data.urgentes.length + data.cotacoes.length + data.aprovacoes.length + data.vencidas.length

  if (loading) return (
    <div style={{ padding: 40, color: 'var(--text-secondary)' }}>Carregando workspace...</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="Workspace do Comprador" subtitle="Todas as pendências e ações necessárias em um só lugar" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          {lastRefresh && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Atualizado às {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={() => wsId && loadAll(wsId)} disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
            <ArrowPathIcon style={{ width: 14, height: 14, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
          <button onClick={() => navigate('/compras/operacoes/requisicoes')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            <PlusIcon style={{ width: 14, height: 14 }} /> Nova Requisição
          </button>
        </div>

      {/* Score de pendências */}
      {totalPendencias > 0 ? (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <BellAlertIcon style={{ width: 20, height: 20, color: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: '#ef4444', fontWeight: 700 }}>
            {totalPendencias} pendência{totalPendencias > 1 ? 's' : ''} requerendo atenção
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            — {data.urgentes.length} urgente{data.urgentes.length !== 1 ? 's' : ''}, {data.aprovacoes.length} aguardando aprovação, {data.vencidas.length} entrega{data.vencidas.length !== 1 ? 's' : ''} atrasada{data.vencidas.length !== 1 ? 's' : ''}
          </span>
        </div>
      ) : (
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '12px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <CheckCircleIcon style={{ width: 20, height: 20, color: '#10b981' }} />
          <span style={{ fontSize: 14, color: '#10b981', fontWeight: 700 }}>Tudo em dia! Nenhuma pendência crítica no momento.</span>
        </div>
      )}

      {/* Grid de seções */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>

        {/* Requisições Urgentes */}
        <WorkspaceSection
          title="Requisições Urgentes"
          icon={BoltIcon}
          color="#ef4444"
          count={data.urgentes.length}
          emptyText="Nenhuma requisição urgente pendente"
          onViewAll={() => navigate('/compras/operacoes/requisicoes')}
        >
          {data.urgentes.map(r => (
            <TaskRow
              key={r.id}
              title={r.titulo}
              sub={r.data_necessidade ? `Necessário em ${fmtDate(r.data_necessidade)}` : `Aberta há ${diasAtras(r.created_at)} dias`}
              badge={{ label: 'Alta', color: '#ef4444' }}
              value={r.valor_estimado > 0 ? fmtCurrency(r.valor_estimado) : null}
              onClick={() => navigate('/compras/operacoes/cotacoes')}
              cta="Cotar"
            />
          ))}
        </WorkspaceSection>

        {/* Cotações expirando */}
        <WorkspaceSection
          title="Leilões Próximos do Prazo"
          icon={ClockIcon}
          color="#f59e0b"
          count={data.cotacoes.length}
          emptyText="Nenhum leilão com prazo próximo"
          onViewAll={() => navigate('/compras/operacoes/cotacoes')}
        >
          {data.cotacoes.map(r => {
            const dias = diasPara(r.data_necessidade)
            return (
              <TaskRow
                key={r.id}
                title={r.titulo}
                sub={dias === 0 ? 'Vence HOJE' : dias < 0 ? `Venceu há ${Math.abs(dias)} dia(s)` : `Vence em ${dias} dia(s)`}
                badge={{ label: dias <= 0 ? 'Urgente' : `${dias}d`, color: dias <= 0 ? '#ef4444' : '#f59e0b' }}
                value={r.valor_estimado > 0 ? fmtCurrency(r.valor_estimado) : null}
                onClick={() => navigate('/compras/operacoes/cotacoes')}
                cta="Ver Leilão"
              />
            )
          })}
        </WorkspaceSection>

        {/* Aprovações pendentes */}
        <WorkspaceSection
          title="Aguardando Aprovação"
          icon={CheckCircleIcon}
          color="#6366f1"
          count={data.aprovacoes.length}
          emptyText="Nenhuma aprovação pendente"
          onViewAll={() => navigate('/compras/operacoes/aprovacoes')}
        >
          {data.aprovacoes.map(r => (
            <TaskRow
              key={r.id}
              title={r.titulo}
              sub={`Aguardando há ${diasAtras(r.created_at)} dia(s)`}
              badge={{ label: r.urgencia === 'alta' ? 'Urgente' : 'Pendente', color: r.urgencia === 'alta' ? '#ef4444' : '#6366f1' }}
              value={r.valor_estimado > 0 ? fmtCurrency(r.valor_estimado) : null}
              onClick={() => navigate('/compras/operacoes/aprovacoes')}
              cta="Aprovar"
            />
          ))}
        </WorkspaceSection>

        {/* Entregas previstas */}
        <WorkspaceSection
          title="Entregas Esta Semana"
          icon={TruckIcon}
          color="#0ea5e9"
          count={data.entregas.length}
          emptyText="Nenhuma entrega prevista para os próximos 7 dias"
          onViewAll={() => navigate('/compras/operacoes/recebimento')}
        >
          {data.entregas.map(r => {
            const dias = diasPara(r.data_necessidade)
            return (
              <TaskRow
                key={r.id}
                title={r.titulo}
                sub={`${r.fornecedor || 'Fornecedor a definir'} · ${dias === 0 ? 'Hoje' : `Em ${dias} dia(s)`}`}
                badge={{ label: dias === 0 ? 'Hoje' : `${dias}d`, color: dias === 0 ? '#f59e0b' : '#0ea5e9' }}
                value={r.valor_estimado > 0 ? fmtCurrency(r.valor_estimado) : null}
                onClick={() => navigate('/compras/operacoes/recebimento')}
                cta="Receber"
              />
            )
          })}
        </WorkspaceSection>

        {/* Entregas atrasadas */}
        {data.vencidas.length > 0 && (
          <WorkspaceSection
            title="Entregas em Atraso"
            icon={ExclamationTriangleIcon}
            color="#ef4444"
            count={data.vencidas.length}
            emptyText=""
            onViewAll={() => navigate('/compras/operacoes/recebimento')}
          >
            {data.vencidas.map(r => {
              const dias = Math.abs(diasPara(r.data_necessidade) || 0)
              return (
                <TaskRow
                  key={r.id}
                  title={r.titulo}
                  sub={`${r.fornecedor || 'Fornecedor'} · Atrasado ${dias} dia(s)`}
                  badge={{ label: `${dias}d atraso`, color: '#ef4444' }}
                  value={r.valor_estimado > 0 ? fmtCurrency(r.valor_estimado) : null}
                  onClick={() => navigate('/compras/operacoes/recebimento')}
                  cta="Cobrar"
                  danger
                />
              )
            })}
          </WorkspaceSection>
        )}

        {/* Atalhos rápidos */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16 }}>Acesso Rápido</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Catálogo de Itens', sub: 'Itens padronizados c/ histórico de preço', icon: DocumentTextIcon, path: '/compras/cadastros/catalogo', color: '#6366f1' },
              { label: 'Buscar Fornecedores', sub: 'Encontrar fornecedores por cidade e produto', icon: BuildingStorefrontIcon, path: '/compras/cadastros/buscar', color: '#8b5cf6' },
              { label: 'Relatório de Economia', sub: 'Savings realizados nas compras', icon: BanknotesIcon, path: '/compras/relatorios/economia', color: '#10b981' },
              { label: 'Escaneamento de NF', sub: 'OCR de notas fiscais recebidas', icon: MagnifyingGlassIcon, path: '/escanear', color: '#f59e0b' },
            ].map(item => {
              const I = item.icon
              return (
                <button key={item.path} onClick={() => navigate(item.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: item.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <I style={{ width: 18, height: 18, color: item.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.sub}</div>
                  </div>
                  <ArrowRightIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />
                </button>
              )
            })}
          </div>
        </div>

      </div>
      </div>
    </div>
  )
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────
function WorkspaceSection({ title, icon: Icon, color, count, emptyText, onViewAll, children }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', border: `1px solid var(--border)`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon style={{ width: 16, height: 16, color }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{title}</span>
          {count > 0 && (
            <span style={{ background: color, color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{count}</span>
          )}
        </div>
        {count > 0 && (
          <button onClick={onViewAll}
            style={{ fontSize: 12, color, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            Ver todos <ArrowRightIcon style={{ width: 13, height: 13 }} />
          </button>
        )}
      </div>
      <div style={{ padding: '8px 0' }}>
        {count === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
            <CheckCircleIcon style={{ width: 20, height: 20, margin: '0 auto 6px', color: '#10b981', opacity: .6 }} />
            {emptyText}
          </div>
        ) : children}
      </div>
    </div>
  )
}

function TaskRow({ title, sub, badge, value, onClick, cta, danger }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={title}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {value && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{value}</span>}
        <span style={{ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: badge.color + '20', color: badge.color, whiteSpace: 'nowrap' }}>
          {badge.label}
        </span>
        <button onClick={onClick}
          style={{ background: danger ? '#ef444420' : '#6366f120', color: danger ? '#ef4444' : '#6366f1', border: `1px solid ${danger ? '#ef4444' : '#6366f1'}40`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {cta} →
        </button>
      </div>
    </div>
  )
}
