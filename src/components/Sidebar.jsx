import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  HomeIcon, CurrencyDollarIcon, UsersIcon, UserGroupIcon,
  CreditCardIcon, ArrowsRightLeftIcon, ChartBarIcon,
  ArrowPathIcon, CalendarDaysIcon, Cog6ToothIcon, ChevronDoubleLeftIcon,
  BuildingOffice2Icon, BanknotesIcon, ArrowUpTrayIcon, TruckIcon,
  PresentationChartLineIcon, LockClosedIcon, ArrowRightOnRectangleIcon, DocumentTextIcon,
  SignalIcon, CameraIcon, TableCellsIcon, ShoppingCartIcon, BuildingStorefrontIcon,
  ChevronDownIcon, ChevronRightIcon, ShieldCheckIcon, BellAlertIcon, ChatBubbleLeftRightIcon,
  ArrowTrendingUpIcon, MagnifyingGlassIcon, ClipboardDocumentListIcon,
  TrophyIcon, CheckCircleIcon, TagIcon, AdjustmentsHorizontalIcon, PuzzlePieceIcon, BoltIcon, BeakerIcon, DevicePhoneMobileIcon,
  WrenchScrewdriverIcon, ExclamationTriangleIcon, MapPinIcon, CubeIcon,
} from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/utils'

const navGroups = [
  {
    title: 'FinanceiroPro',
    items: [
      { to: '/',            icon: HomeIcon,                  label: 'Início',        moduleKey: 'dashboard' },
      { to: '/despesas',    icon: CurrencyDollarIcon,        label: 'Meus Gastos',   moduleKey: 'despesas' },
      { to: '/quem-deve',   icon: ArrowsRightLeftIcon,       label: 'Acertos',       moduleKey: 'acertos' },
      { to: '/recorrentes', icon: ArrowPathIcon,             label: 'Fixos do Mês',  moduleKey: 'recorrentes' },
      { to: '/cartoes',     icon: CreditCardIcon,            label: 'Cartões',       moduleKey: 'cartoes' },
      { to: '/grupos',      icon: UserGroupIcon,             label: 'Grupos',        moduleKey: 'grupos' },
      { to: '/pessoas',     icon: UsersIcon,                 label: 'Pessoas',       moduleKey: 'pessoas' },
      { to: '/veiculos',    icon: TruckIcon,                 label: 'Veículos',      moduleKey: 'veiculos' },
      { to: '/timeline',    icon: ChartBarIcon,              label: 'Histórico',     moduleKey: 'timeline' },
      { to: '/balanco',     icon: PresentationChartLineIcon, label: 'Balanço',       moduleKey: 'balanco' },
      { to: '/previsao',    icon: BanknotesIcon,             label: 'Caixa',         moduleKey: 'previsao' },      { to: '/proventos',   icon: ArrowTrendingUpIcon,        label: 'Proventos',          moduleKey: 'proventos' },
      { to: '/negocios',    icon: BuildingOffice2Icon,        label: 'Negócios',           moduleKey: 'negocios' },
    ],
  },
  {
    title: 'Prospectar',
    items: [
      { to: '/prospectar/dashboard',  icon: ChartBarIcon,              label: 'Dashboard',         moduleKey: 'negocios' },
      { to: '/prospectar/buscar',     icon: MagnifyingGlassIcon,       label: 'Buscar Prospectos', moduleKey: 'negocios' },
      { to: '/prospectar/contratos',  icon: DocumentTextIcon,          label: 'Contratos',         moduleKey: 'negocios' },
      { to: '/prospectar/relatorios', icon: PresentationChartLineIcon, label: 'Relatórios',        moduleKey: 'negocios' },
    ],
  },
  {
    title: 'Gerencial',
    items: [
      { to: '/central',       icon: TableCellsIcon,   label: 'Central Gerencial', moduleKey: 'central' },
      { to: '/lancamentos',   icon: DocumentTextIcon, label: 'Lançamentos',       moduleKey: 'lancamentos' },
      { to: '/cadastros',     icon: UsersIcon,        label: 'Cadastros',         moduleKey: 'cadastros' },
      { to: '/lotes-cliente', icon: UserGroupIcon,    label: 'Lotes Cliente',     moduleKey: 'lancamentos' },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { to: '/faturamento',  icon: BanknotesIcon,      label: 'Faturamento',      moduleKey: 'faturamento' },
      { to: '/pagamentos',   icon: BanknotesIcon,      label: 'Contas a Receber', moduleKey: 'faturamento' },
      { to: '/contas-pagar', icon: BanknotesIcon,      label: 'Contas a Pagar',   moduleKey: 'faturamento' },
    ],
  },
  {
    title: 'Compras',
    items: [
      { to: '/compras',                        icon: ShoppingCartIcon,           label: 'Workspace',          moduleKey: 'compras' },
      { to: '/compras/dashboard',              icon: ChartBarIcon,               label: 'Dashboard',          moduleKey: 'compras' },
      { to: '/compras/operacoes/requisicoes',  icon: ClipboardDocumentListIcon,  label: 'Requisições',        moduleKey: 'compras' },
      { to: '/compras/operacoes/cotacoes',     icon: TrophyIcon,                 label: 'Cotações',           moduleKey: 'compras' },
      { to: '/compras/operacoes/aprovacoes',   icon: CheckCircleIcon,            label: 'Aprovações',         moduleKey: 'compras' },
      { to: '/compras/operacoes/recebimento',  icon: TruckIcon,                  label: 'Recebimento',        moduleKey: 'compras' },
      { to: '/compras/pedidos',                icon: DocumentTextIcon,           label: 'Pedidos',            moduleKey: 'compras' },
      { to: '/compras/pesquisa-precos',        icon: MagnifyingGlassIcon,        label: 'Pesquisa de Preços', moduleKey: 'compras' },
      { to: '/compras/cadastros/catalogo',     icon: TableCellsIcon,             label: 'Catálogo',           moduleKey: 'compras' },
      { to: '/compras/cadastros/fornecedores', icon: BuildingOffice2Icon,        label: 'Fornecedores',       moduleKey: 'compras' },
      { to: '/compras/cadastros/categorias',   icon: TagIcon,                    label: 'Categorias',         moduleKey: 'compras' },
      { to: '/compras/cadastros/buscar',       icon: MagnifyingGlassIcon,        label: 'Buscar Fornecedor',  moduleKey: 'compras' },
      { to: '/compras/relatorios/economia',    icon: BanknotesIcon,              label: 'Rel. Economia',      moduleKey: 'compras' },
      { to: '/compras/relatorios/categoria',   icon: ChartBarIcon,               label: 'Rel. Categoria',     moduleKey: 'compras' },
      { to: '/compras/relatorios/fornecedor',  icon: PresentationChartLineIcon,  label: 'Rel. Fornecedor',    moduleKey: 'compras' },
      { to: '/compras/parametros',             icon: AdjustmentsHorizontalIcon,  label: 'Parâmetros',         moduleKey: 'compras' },
    ],
  },
  {
    title: 'Automação',
    items: [
      { to: '/flow-center', icon: BoltIcon,    label: 'Flow Center', moduleKey: null },
      { to: '/flow-lab',        icon: BeakerIcon,      label: 'Flow Lab',    moduleKey: null },
      { to: '/simulacao-fluxo', icon: DevicePhoneMobileIcon, label: 'Simulação',   moduleKey: null },
    ],
  },
  {
    title: 'Refeições',
    items: [
      { to: '/refeicoes',                               icon: HomeIcon,                  label: 'Dashboard',        moduleKey: 'refeicoes' },
      { to: '/refeicoes/cadastros/restaurantes',        icon: BuildingStorefrontIcon,     label: 'Restaurantes',     moduleKey: 'refeicoes' },
      { to: '/refeicoes/cadastros/precos',              icon: BanknotesIcon,              label: 'Tabela de Preços', moduleKey: 'refeicoes' },
      { to: '/refeicoes/cadastros/equipes',             icon: UserGroupIcon,              label: 'Equipes',          moduleKey: 'refeicoes' },
      { to: '/refeicoes/cadastros/colaboradores',       icon: UsersIcon,                  label: 'Colaboradores',    moduleKey: 'refeicoes' },
      { to: '/refeicoes/cadastros/cdc',                 icon: BuildingOffice2Icon,        label: 'Centros de Custo', moduleKey: 'refeicoes' },
      { to: '/refeicoes/cadastros/regionais',           icon: MagnifyingGlassIcon,        label: 'Regionais',        moduleKey: 'refeicoes' },
      { to: '/refeicoes/cadastros/parametros',          icon: Cog6ToothIcon,              label: 'Regras',           moduleKey: 'refeicoes' },
      { to: '/refeicoes/operacoes/solicitacoes',        icon: ClipboardDocumentListIcon,  label: 'Solicitações',     moduleKey: 'refeicoes' },
      { to: '/refeicoes/operacoes/aprovacoes',          icon: CheckCircleIcon,            label: 'Aprovações',       moduleKey: 'refeicoes' },
      { to: '/refeicoes/operacoes/fechamentos',         icon: DocumentTextIcon,           label: 'Fechamentos',      moduleKey: 'refeicoes' },
      { to: '/refeicoes/relatorios/rel-equipe',         icon: ChartBarIcon,               label: 'Rel. Por Equipe',  moduleKey: 'refeicoes' },
      { to: '/refeicoes/relatorios/rel-restaurante',    icon: PresentationChartLineIcon,  label: 'Rel. Restaurante', moduleKey: 'refeicoes' },
      { to: '/refeicoes/relatorios/rel-cdc',            icon: TableCellsIcon,             label: 'Rel. CDC',         moduleKey: 'refeicoes' },
      { to: '/refeicoes/relatorios/rel-divergencias',   icon: ChartBarIcon,               label: 'Divergências',     moduleKey: 'refeicoes' },
    ],
  },
  {
    title: 'SmartLíder',
    items: [
      { to: '/lider/dashboard',                   icon: ChartBarIcon,              label: 'Dashboard',           moduleKey: null },
      { to: '/lider/turnos',                       icon: CalendarDaysIcon,           label: 'Turnos',              moduleKey: null },
      { to: '/lider/apontamentos',                 icon: ClipboardDocumentListIcon,  label: 'Apontamentos',        moduleKey: null },
      { to: '/lider/cadastros/frentes',            icon: MapPinIcon,                 label: 'Frentes',             moduleKey: null },
      { to: '/lider/cadastros/equipes',            icon: UserGroupIcon,              label: 'Equipes',             moduleKey: null },
      { to: '/lider/cadastros/colaboradores',      icon: UsersIcon,                  label: 'Colaboradores',       moduleKey: null },
      { to: '/lider/cadastros/maquinas',           icon: WrenchScrewdriverIcon,      label: 'Máquinas',            moduleKey: null },
      { to: '/lider/cadastros/implementos',        icon: BeakerIcon,                 label: 'Implementos',         moduleKey: null },
      { to: '/lider/cadastros/produtos',           icon: CubeIcon,                   label: 'Produtos',            moduleKey: null },
      { to: '/lider/cadastros/epis',               icon: ShieldCheckIcon,            label: 'EPIs',                moduleKey: null },
      { to: '/lider/epi/solicitacoes',             icon: ShieldCheckIcon,            label: 'Solicitações EPI',    moduleKey: null },
      { to: '/lider/epi/catalogo',                 icon: TableCellsIcon,             label: 'Catálogo EPI',        moduleKey: null },
      { to: '/lider/epc/catalogo',                 icon: WrenchScrewdriverIcon,      label: 'Catálogo EPC',        moduleKey: null },
    ],
  },
  {
    title: 'Manutenção',
    items: [
      { to: '/manutencao/dashboard',              icon: ChartBarIcon,               label: 'Dashboard',         moduleKey: 'manutencao' },
      { to: '/manutencao/operacoes/os',           icon: ClipboardDocumentListIcon,  label: 'Ordens de Serviço', moduleKey: 'manutencao' },
      { to: '/manutencao/operacoes/preventiva',   icon: CalendarDaysIcon,           label: 'Preventiva',        moduleKey: 'manutencao' },
      { to: '/manutencao/cadastros/equipamentos', icon: WrenchScrewdriverIcon,      label: 'Equipamentos',      moduleKey: 'manutencao' },
      { to: '/manutencao/api-planos',             icon: BeakerIcon,                 label: 'Planos API',        moduleKey: 'manutencao' },
      { to: '/manutencao/planos-pfd',             icon: DocumentTextIcon,           label: 'Planos PFD',        moduleKey: 'manutencao' },
    ],
  },
  {
    title: 'Agenda',
    items: [
      { to: '/agenda-servicos', icon: CalendarDaysIcon, label: 'Agenda de Serviços', moduleKey: null },
    ],
  },
  {
    title: 'Documentos',
    items: [
      { to: '/importar',      icon: ArrowUpTrayIcon,  label: 'Importar',      moduleKey: 'importar' },
      { to: '/escanear',      icon: CameraIcon,       label: 'Escanear Doc.', moduleKey: 'escanear' },
      { to: '/notas-fiscais', icon: DocumentTextIcon, label: 'Notas Fiscais', moduleKey: 'notas-fiscais' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { to: '/acessos', icon: LockClosedIcon, label: 'Acessos', moduleKey: null, empresaAdminOnly: true },
    ],
  },
  {
    title: 'Plataforma SmartPro',
    items: [
      { to: '/plataforma/empresas',  icon: BuildingOffice2Icon,      label: 'Empresas',   moduleKey: null, adminOnly: true },
      { to: '/plataforma/auditoria', icon: ClipboardDocumentListIcon, label: 'Auditoria', moduleKey: null, adminOnly: true },
    ],
  },
  {
    title: 'Desenvolvedor',
    items: [
      { to: '/admin/saude',        icon: ShieldCheckIcon,          label: 'Saúde do Sistema',  moduleKey: null, adminOnly: true },
      { to: '/admin/workspaces',   icon: BuildingOffice2Icon,       label: 'Workspaces',         moduleKey: null, adminOnly: true },
      { to: '/admin/notificacoes', icon: BellAlertIcon,             label: 'Notificações',       moduleKey: null, adminOnly: true },
      { to: '/admin/motoristas',   icon: TruckIcon,                 label: 'Motoristas WA',      moduleKey: null, adminOnly: true },
      { to: '/admin/conexoes',     icon: SignalIcon,                label: 'Conexões WhatsApp', moduleKey: null, adminOnly: true },
      { to: '/admin/mensagens',    icon: ChatBubbleLeftRightIcon,   label: 'Log de Mensagens',   moduleKey: null, adminOnly: true },
      { to: '/admin/usuarios',     icon: UsersIcon,                 label: 'Usuários',           moduleKey: null, adminOnly: true },
      { to: '/admin/assinaturas',  icon: CreditCardIcon,            label: 'Assinaturas',        moduleKey: null, adminOnly: true },
    ],
  },
]

function weatherIcon(code) {
  if (code <= 1) return '☀️'
  if (code === 2) return '⛅'
  if (code === 3) return '☁️'
  if (code === 45 || code === 48) return '🌫️'
  if (code >= 51 && code <= 55) return '🌦️'
  if (code >= 61 && code <= 65) return '🌧️'
  if (code >= 71 && code <= 77) return '🌨️'
  if (code >= 80 && code <= 82) return '🌦️'
  if (code >= 95) return '⛈️'
  return '🌡️'
}

export default function Sidebar({ collapsed, onToggle }) {
  const { getMeusDividas, getMinhasReceitas, getTotalPagar } = useStore()
  const enabledModules = useStore(s => s.enabledModules)
  const isPlatformAdmin = useStore(s => s.isPlatformAdmin)
  const permissoes = useStore(s => s.permissoes)
  const authUserName = useStore(s => s.authUserName)
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()
  const [openGroups, setOpenGroups] = useState(() => {
    const open = {}
    navGroups.forEach(({ title, items }) => {
      open[title] = items.some(item =>
        item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
      )
    })
    // Se nenhum grupo ativo, abre o primeiro
    if (!Object.values(open).some(Boolean)) open[navGroups[0].title] = true
    return open
  })

  function toggleGroup(title) {
    setOpenGroups(p => ({ ...p, [title]: !p[title] }))
  }

  // Função que decide se o item do menu deve aparecer:
  // - adminOnly: só admin vê
  // - moduleKey null: sempre visível (se não for adminOnly)
  // - moduleKey: visível apenas se enabledModules (whitelist) incluir o moduleKey, ou se enabledModules=null (sem restrição)
  function isItemVisible(item) {
    if (item.adminOnly) return isPlatformAdmin
    if (item.empresaAdminOnly) return isPlatformAdmin || permissoes?.includes('*')
    if (!item.moduleKey) return true
    if (enabledModules === null) return true // sem restrição (admin ou workspace sem config)
    return enabledModules.includes(item.moduleKey) // enabledModules = whitelist de habilitados
  }

  useEffect(() => {
    const cached = sessionStorage.getItem('sp_weather')
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < 30 * 60 * 1000) {
          setWeather(data); setWeatherLoading(false); return
        }
      } catch {}
    }
    const load = async (lat, lon, city) => {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=precipitation_probability_max,weather_code&timezone=auto&forecast_days=2`)
        const d = await r.json()
        const result = { ...d, city }
        setWeather(result)
        sessionStorage.setItem('sp_weather', JSON.stringify({ data: result, ts: Date.now() }))
      } catch {}
      finally { setWeatherLoading(false) }
    }
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          const d = await r.json()
          const city = d.address?.city || d.address?.town || d.address?.state || 'Local'
          load(latitude, longitude, city)
        } catch { load(latitude, longitude, 'Local') }
      },
      () => load(-23.5505, -46.6333, 'São Paulo')
    )
  }, [])

  async function handleLogout() {
    await supabase?.auth.signOut()
    navigate('/login')
  }

  const totalPagar = getTotalPagar()

  return (
    <aside
      style={{ width: collapsed ? 64 : 246, minWidth: collapsed ? 64 : 246 }}
      className="h-screen flex flex-col transition-all duration-300 border-r"
      style={{
        width: collapsed ? 64 : 246,
        minWidth: collapsed ? 64 : 246,
        background: 'var(--sb-bg)',
        borderRight: '1px solid var(--sb-border)',
        transition: 'all 0.3s ease',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Logo — card verde fixo, independe do tema */}
      <div style={{
        margin: collapsed ? '8px 6px' : '8px 10px',
        borderRadius: 10,
        background: 'var(--sb-balance-bg)',
        boxShadow: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: collapsed ? '8px 6px' : '0px 8px 0px 10px',
        minHeight: collapsed ? 48 : 100,
        cursor: collapsed ? 'pointer' : 'default',
      }}
        onClick={collapsed ? onToggle : undefined}
      >
        <img
          src="/logo_smartpro.png"
          alt="SmartPro"
          style={{
            height: collapsed ? 36 : 60,
            width: 'auto',
            maxWidth: '100%',
            objectFit: 'contain',
            margin: collapsed ? 'auto' : 0,
          }}
        />
        {!collapsed && (
          <button
            onClick={onToggle}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', flexShrink: 0 }}
          >
            <ChevronDoubleLeftIcon style={{ width: 15, height: 15 }} />
          </button>
        )}
      </div>



      {/* Weather card */}
      {!collapsed && (
        <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--sb-border)' }}>
          <div style={{ background: 'var(--sb-balance-bg)', borderRadius: 10, padding: '10px 12px' }}>
            {weatherLoading ? (
              <div style={{ fontSize: 11, color: 'var(--sb-text)', textAlign: 'center' }}>⏳ Carregando clima...</div>
            ) : weather ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--sb-text)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📍 {weather.city}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sb-text-active)' }}>
                    {weatherIcon(weather.current?.weather_code)} {Math.round(weather.current?.temperature_2m)}°C
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--sb-text)' }}>Hoje</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: (weather.daily?.precipitation_probability_max?.[0] ?? 0) >= 60 ? '#60a5fa' : '#10b981' }}>
                      {weatherIcon(weather.daily?.weather_code?.[0])} {weather.daily?.precipitation_probability_max?.[0] ?? 0}% chuva
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--sb-text)' }}>Amanhã</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: (weather.daily?.precipitation_probability_max?.[1] ?? 0) >= 60 ? '#60a5fa' : '#10b981' }}>
                      {weatherIcon(weather.daily?.weather_code?.[1])} {weather.daily?.precipitation_probability_max?.[1] ?? 0}% chuva
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--sb-text)' }}>🌡️ Clima indisponível</div>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ padding: '8px', flex: 1, overflowY: 'auto' }}>
        {navGroups.map(({ title, items }) => {
          const visibleItems = items.filter(item => isItemVisible(item))
          if (visibleItems.length === 0) return null
          const isOpen = openGroups[title]
          return (
            <div key={title} style={{ marginBottom: 4 }}>
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(title)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '8px 10px 4px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 700, color: 'var(--sb-title)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}
                >
                  <span>{title}</span>
                  {isOpen
                    ? <ChevronDownIcon style={{ width: 12, height: 12 }} />
                    : <ChevronRightIcon style={{ width: 12, height: 12 }} />}
                </button>
              )}
              {collapsed && <div style={{ height: 1, background: 'var(--sb-border)', margin: '6px 4px' }} />}
              {(isOpen || collapsed) && visibleItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                  title={collapsed ? label : undefined}
                  style={{ marginBottom: 2, justifyContent: collapsed ? 'center' : 'flex-start' }}
                >
                  <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div style={{ padding: collapsed ? '12px 8px' : '12px 16px', borderTop: '1px solid var(--sb-border)' }}>
        {collapsed ? (
          <button onClick={handleLogout} title="Sair" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sb-text)', display: 'flex', margin: 'auto' }}>
            <ArrowRightOnRectangleIcon style={{ width: 20, height: 20 }} />
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--sb-avatar-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'white', flexShrink: 0 }}>
              {authUserName?.[0] || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--sb-text-active)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {authUserName || 'Usuário'}
              </div>
              <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11, padding: 0, marginTop: 2 }}>
                Sair
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
