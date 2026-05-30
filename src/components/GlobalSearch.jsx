import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MagnifyingGlassIcon, XMarkIcon,
  HomeIcon, CurrencyDollarIcon, UsersIcon, UserGroupIcon,
  CreditCardIcon, ArrowsRightLeftIcon, ChartBarIcon,
  ArrowPathIcon, Cog6ToothIcon, ChevronDoubleLeftIcon,
  BuildingOffice2Icon, BanknotesIcon, ArrowUpTrayIcon, TruckIcon,
  PresentationChartLineIcon, LockClosedIcon, DocumentTextIcon,
  TableCellsIcon, ShoppingCartIcon, BuildingStorefrontIcon,
  ShieldCheckIcon, BellAlertIcon, ChatBubbleLeftRightIcon,
  ArrowTrendingUpIcon, ClipboardDocumentListIcon,
  TrophyIcon, CheckCircleIcon, TagIcon, AdjustmentsHorizontalIcon,
  CameraIcon, SignalIcon,
} from '@heroicons/react/24/outline'

const ALL_ITEMS = [
  // FinanceiroPro
  { to: '/',            icon: HomeIcon,                  label: 'Início',             group: 'FinanceiroPro' },
  { to: '/despesas',    icon: CurrencyDollarIcon,        label: 'Meus Gastos',        group: 'FinanceiroPro' },
  { to: '/quem-deve',   icon: ArrowsRightLeftIcon,       label: 'Acertos',            group: 'FinanceiroPro' },
  { to: '/recorrentes', icon: ArrowPathIcon,             label: 'Fixos do Mês',       group: 'FinanceiroPro' },
  { to: '/cartoes',     icon: CreditCardIcon,            label: 'Cartões',            group: 'FinanceiroPro' },
  { to: '/grupos',      icon: UserGroupIcon,             label: 'Grupos',             group: 'FinanceiroPro' },
  { to: '/pessoas',     icon: UsersIcon,                 label: 'Pessoas',            group: 'FinanceiroPro' },
  { to: '/veiculos',    icon: TruckIcon,                 label: 'Veículos',           group: 'FinanceiroPro' },
  { to: '/timeline',    icon: ChartBarIcon,              label: 'Histórico',          group: 'FinanceiroPro' },
  { to: '/balanco',     icon: PresentationChartLineIcon, label: 'Balanço',            group: 'FinanceiroPro' },
  { to: '/previsao',    icon: BanknotesIcon,             label: 'Caixa',              group: 'FinanceiroPro' },
  { to: '/proventos',   icon: ArrowTrendingUpIcon,       label: 'Proventos',          group: 'FinanceiroPro' },
  { to: '/negocios',    icon: BuildingOffice2Icon,       label: 'Negócios',           group: 'FinanceiroPro' },
  // Gerencial
  { to: '/central',       icon: TableCellsIcon,   label: 'Central Gerencial', group: 'Gerencial' },
  { to: '/lancamentos',   icon: DocumentTextIcon, label: 'Lançamentos',       group: 'Gerencial' },
  { to: '/cadastros',     icon: UsersIcon,        label: 'Cadastros',         group: 'Gerencial' },
  { to: '/lotes-cliente', icon: UserGroupIcon,    label: 'Lotes Cliente',     group: 'Gerencial' },
  // Financeiro
  { to: '/faturamento',  icon: BanknotesIcon, label: 'Faturamento',      group: 'Financeiro' },
  { to: '/pagamentos',   icon: BanknotesIcon, label: 'Contas a Receber', group: 'Financeiro' },
  { to: '/contas-pagar', icon: BanknotesIcon, label: 'Contas a Pagar',   group: 'Financeiro' },
  // Compras
  { to: '/compras',                        icon: ShoppingCartIcon,          label: 'Workspace',          group: 'Compras' },
  { to: '/compras/dashboard',              icon: ChartBarIcon,              label: 'Dashboard Compras',  group: 'Compras' },
  { to: '/compras/operacoes/requisicoes',  icon: ClipboardDocumentListIcon, label: 'Requisições',        group: 'Compras' },
  { to: '/compras/operacoes/cotacoes',     icon: TrophyIcon,                label: 'Cotações',           group: 'Compras' },
  { to: '/compras/operacoes/aprovacoes',   icon: CheckCircleIcon,           label: 'Aprovações',         group: 'Compras' },
  { to: '/compras/operacoes/recebimento',  icon: TruckIcon,                 label: 'Recebimento',        group: 'Compras' },
  { to: '/compras/pedidos',                icon: DocumentTextIcon,          label: 'Pedidos',            group: 'Compras' },
  { to: '/compras/pesquisa-precos',        icon: MagnifyingGlassIcon,       label: 'Pesquisa de Preços', group: 'Compras' },
  { to: '/compras/cadastros/catalogo',     icon: TableCellsIcon,            label: 'Catálogo',           group: 'Compras' },
  { to: '/compras/cadastros/fornecedores', icon: BuildingOffice2Icon,       label: 'Fornecedores',       group: 'Compras' },
  { to: '/compras/cadastros/categorias',   icon: TagIcon,                   label: 'Categorias',         group: 'Compras' },
  { to: '/compras/relatorios/economia',    icon: BanknotesIcon,             label: 'Rel. Economia',      group: 'Compras' },
  { to: '/compras/relatorios/categoria',   icon: ChartBarIcon,              label: 'Rel. Categoria',     group: 'Compras' },
  { to: '/compras/relatorios/fornecedor',  icon: PresentationChartLineIcon, label: 'Rel. Fornecedor',    group: 'Compras' },
  { to: '/compras/parametros',             icon: AdjustmentsHorizontalIcon, label: 'Parâmetros Compras', group: 'Compras' },
  // Refeições
  { to: '/refeicoes',                             icon: HomeIcon,                  label: 'Dashboard Refeições', group: 'Refeições' },
  { to: '/refeicoes/cadastros/restaurantes',       icon: BuildingStorefrontIcon,    label: 'Restaurantes',        group: 'Refeições' },
  { to: '/refeicoes/cadastros/precos',             icon: BanknotesIcon,             label: 'Tabela de Preços',    group: 'Refeições' },
  { to: '/refeicoes/cadastros/equipes',            icon: UserGroupIcon,             label: 'Equipes',             group: 'Refeições' },
  { to: '/refeicoes/cadastros/colaboradores',      icon: UsersIcon,                 label: 'Colaboradores',       group: 'Refeições' },
  { to: '/refeicoes/cadastros/cdc',                icon: BuildingOffice2Icon,       label: 'Centros de Custo',    group: 'Refeições' },
  { to: '/refeicoes/cadastros/parametros',         icon: Cog6ToothIcon,             label: 'Parâmetros Refeições',group: 'Refeições' },
  { to: '/refeicoes/operacoes/solicitacoes',       icon: ClipboardDocumentListIcon, label: 'Solicitações',        group: 'Refeições' },
  { to: '/refeicoes/operacoes/aprovacoes',         icon: CheckCircleIcon,           label: 'Aprovações Refeições',group: 'Refeições' },
  { to: '/refeicoes/operacoes/fechamentos',        icon: DocumentTextIcon,          label: 'Fechamentos',         group: 'Refeições' },
  { to: '/refeicoes/relatorios/rel-equipe',        icon: ChartBarIcon,              label: 'Rel. Por Equipe',     group: 'Refeições' },
  { to: '/refeicoes/relatorios/rel-restaurante',   icon: PresentationChartLineIcon, label: 'Rel. Restaurante',    group: 'Refeições' },
  { to: '/refeicoes/relatorios/rel-cdc',           icon: TableCellsIcon,            label: 'Rel. CDC',            group: 'Refeições' },
  // Documentos
  { to: '/importar',      icon: ArrowUpTrayIcon,  label: 'Importar',      group: 'Documentos' },
  { to: '/escanear',      icon: CameraIcon,       label: 'Escanear Doc.', group: 'Documentos' },
  { to: '/notas-fiscais', icon: DocumentTextIcon, label: 'Notas Fiscais', group: 'Documentos' },
  // Sistema
  { to: '/acessos', icon: LockClosedIcon, label: 'Acessos', group: 'Sistema' },
]

const GROUP_COLORS = {
  FinanceiroPro: '#6366f1',
  Gerencial:     '#0ea5e9',
  Financeiro:    '#10b981',
  Compras:       '#f59e0b',
  Refeições:     '#ec4899',
  Documentos:    '#8b5cf6',
  Sistema:       '#64748b',
  Desenvolvedor: '#ef4444',
}

function highlight(text, query) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(99,102,241,0.4)', color: 'inherit', borderRadius: 2 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

const RECENTES_KEY = 'globalsearch_recentes'
function getRecentes() {
  try { return JSON.parse(localStorage.getItem(RECENTES_KEY) || '[]') } catch { return [] }
}
function saveRecente(to) {
  const prev = getRecentes().filter(r => r !== to)
  localStorage.setItem(RECENTES_KEY, JSON.stringify([to, ...prev].slice(0, 5)))
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    function onOpen() { setOpen(true) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('openGlobalSearch', onOpen)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('openGlobalSearch', onOpen) }
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setQuery('')
  }, [open])

  const items = query.trim()
    ? ALL_ITEMS.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.group.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)
    : getRecentes().map(to => ALL_ITEMS.find(i => i.to === to)).filter(Boolean)

  useEffect(() => { setSelected(0) }, [query])

  function go(item) {
    saveRecente(item.to)
    navigate(item.to)
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, items.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && items[selected]) go(items[selected])
  }

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={e => e.target === e.currentTarget && setOpen(false)}
    >
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <MagnifyingGlassIcon style={{ width: 20, height: 20, color: '#6366f1', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ir para..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: 'var(--text-primary)' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>
          )}
          <kbd onClick={() => setOpen(false)} style={{ fontSize: 11, background: 'var(--border)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Esc</kbd>
        </div>

        {/* Label quando sem query */}
        {!query && items.length > 0 && (
          <div style={{ padding: '8px 16px 0', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Recentes
          </div>
        )}

        {/* Results */}
        {items.length > 0 && (
          <div style={{ maxHeight: 380, overflowY: 'auto', padding: '4px 0 8px' }}>
            {items.map((item, i) => {
              const Icon = item.icon
              const color = GROUP_COLORS[item.group] || '#6366f1'
              return (
                <div
                  key={item.to}
                  onClick={() => go(item)}
                  onMouseEnter={() => setSelected(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '9px 16px', cursor: 'pointer',
                    background: i === selected ? 'rgba(99,102,241,0.1)' : 'transparent',
                    borderLeft: i === selected ? '3px solid #6366f1' : '3px solid transparent',
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 16, height: 16, color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {highlight(item.label, query)}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color, background: `${color}18`, borderRadius: 4, padding: '2px 7px', flexShrink: 0, fontWeight: 500 }}>
                    {item.group}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {query && items.length === 0 && (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
            Nenhuma tela encontrada para "<strong>{query}</strong>"
          </div>
        )}

        {!query && items.length === 0 && (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            Digite o nome de uma tela para navegar
          </div>
        )}

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-secondary)' }}>
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>Esc fechar</span>
        </div>
      </div>
    </div>
  )
}
