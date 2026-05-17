import { NavLink, useNavigate } from 'react-router-dom'
import {
  HomeIcon, CurrencyDollarIcon, UsersIcon, UserGroupIcon,
  CreditCardIcon, ArrowsRightLeftIcon, ChartBarIcon,
  ArrowPathIcon, CalendarDaysIcon, Cog6ToothIcon, ChevronDoubleLeftIcon,
  BuildingOffice2Icon, BanknotesIcon, ArrowUpTrayIcon, TruckIcon,
  PresentationChartLineIcon, LockClosedIcon, ArrowRightOnRectangleIcon, DocumentTextIcon,
  SignalIcon, CameraIcon
} from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/utils'
import { isAdmin } from '../lib/admin'

const navGroups = [
  {
    title: 'Financeiro',
    items: [
      { to: '/',            icon: HomeIcon,                  label: 'Início',        moduleKey: 'inicio' },
      { to: '/despesas',    icon: CurrencyDollarIcon,        label: 'Meus Gastos',   moduleKey: 'despesas' },
      { to: '/quem-deve',   icon: ArrowsRightLeftIcon,       label: 'Acertos',       moduleKey: 'acertos' },
      { to: '/recorrentes', icon: ArrowPathIcon,             label: 'Fixos do Mês',  moduleKey: 'recorrentes' },
      { to: '/cartoes',     icon: CreditCardIcon,            label: 'Cartões',       moduleKey: 'cartoes' },
    ],
  },
  {
    title: 'Minha Rede',
    items: [
      { to: '/grupos',   icon: UserGroupIcon,              label: 'Grupos',   moduleKey: 'grupos' },
      { to: '/pessoas',  icon: UsersIcon,                  label: 'Pessoas',  moduleKey: 'pessoas' },
      { to: '/veiculos', icon: TruckIcon,                  label: 'Veículos', moduleKey: 'veiculos' },
      { to: '/timeline', icon: ChartBarIcon,               label: 'Histórico', moduleKey: 'historico' },
      { to: '/balanco',  icon: PresentationChartLineIcon,  label: 'Balanço',  moduleKey: 'balanco' },
      { to: '/previsao', icon: BanknotesIcon,              label: 'Caixa',    moduleKey: 'caixa' },
    ],
  },
  {
    title: 'Negócios',
    items: [
      { to: '/negocios',     icon: BuildingOffice2Icon, label: 'Negócios',      moduleKey: 'negocios' },
      { to: '/proventos',    icon: BanknotesIcon,       label: 'Proventos',     moduleKey: 'proventos' },
      { to: '/lancamentos',  icon: DocumentTextIcon,    label: 'Lançamentos',   moduleKey: 'lancamentos' },
      { to: '/lotes-cliente', icon: UserGroupIcon,       label: 'Lotes Cliente', moduleKey: 'lancamentos' },
      { to: '/faturamento',  icon: BanknotesIcon,       label: 'Faturamento',   moduleKey: 'faturamento' },
      { to: '/pagamentos',    icon: BanknotesIcon,       label: 'Contas a Receber', moduleKey: 'faturamento' },
      { to: '/contas-pagar',  icon: BanknotesIcon,       label: 'Contas a Pagar',   moduleKey: 'faturamento' },
      { to: '/importar',     icon: ArrowUpTrayIcon,     label: 'Importar',      moduleKey: 'importar' },
      { to: '/escanear',     icon: CameraIcon,          label: 'Escanear Doc.', moduleKey: 'escanear' },
      { to: '/notas-fiscais',icon: DocumentTextIcon,    label: 'Notas Fiscais', moduleKey: 'notas-fiscais' },
      { to: '/acessos',      icon: LockClosedIcon,      label: 'Acessos',       moduleKey: null, adminOnly: true },
      { to: '/admin',        icon: SignalIcon,           label: 'Painel Admin',  moduleKey: null, adminOnly: true },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { getMeusDividas, getMinhasReceitas, getTotalPagar } = useStore()
  const enabledModules = useStore(s => s.enabledModules)
  const [authUser, setAuthUser] = useState(null)
  const navigate = useNavigate()

  // Função que decide se o item do menu deve aparecer:
  // - adminOnly: só admin vê
  // - moduleKey null: sempre visível (se não for adminOnly)
  // - moduleKey: visível se enabledModules é null (sem restrição) OU inclui o moduleKey
  function isItemVisible(item) {
    if (item.adminOnly) return isAdmin(authUser)
    if (!item.moduleKey) return true
    if (enabledModules === null) return true // admin / demo sem restrição
    return enabledModules.includes(item.moduleKey)
  }

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setAuthUser(data?.user || null))
    const { data: listener } = supabase?.auth.onAuthStateChange((_e, session) => {
      setAuthUser(session?.user || null)
    }) || {}
    return () => listener?.subscription?.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase?.auth.signOut()
    navigate('/login')
  }

  const totalPagar = getTotalPagar()

  return (
    <aside
      style={{ width: collapsed ? 64 : 240, minWidth: collapsed ? 64 : 240 }}
      className="h-screen flex flex-col transition-all duration-300 border-r"
      style={{
        width: collapsed ? 64 : 240,
        minWidth: collapsed ? 64 : 240,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
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
        margin: collapsed ? '10px 8px' : '10px 12px',
        borderRadius: 12,
        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
        boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: collapsed ? '10px 8px' : '8px 10px 8px 12px',
        minHeight: 52,
        cursor: collapsed ? 'pointer' : 'default',
      }}
        onClick={collapsed ? onToggle : undefined}
      >
        <img
          src="/logo.png"
          alt="Dividi Aí"
          style={{
            height: collapsed ? 29 : 34,
            width: collapsed ? 29 : 'auto',
            maxWidth: collapsed ? 29 : 137,
            objectFit: 'contain',
            filter: 'brightness(0) invert(1)',
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

      {/* My balance snippet */}
      {!collapsed && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ background: 'rgba(0,200,150,0.07)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo atual</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: '#10b981' }}>Receber</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>{formatCurrency(getMinhasReceitas())}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#ef4444' }}>Pagar</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{formatCurrency(totalPagar)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ padding: '8px', flex: 1, overflowY: 'auto' }}>
        {navGroups.map(({ title, items }) => (
          <div key={title} style={{ marginBottom: 4 }}>
            {!collapsed && (
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 10px 4px' }}>
                {title}
              </div>
            )}
            {collapsed && <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />}
            {items.filter(item => isItemVisible(item)).map(({ to, icon: Icon, label }) => (
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
        ))}
      </nav>

      {/* User info + logout */}
      <div style={{ padding: collapsed ? '12px 8px' : '12px 16px', borderTop: '1px solid var(--border)' }}>
        {collapsed ? (
          <button onClick={handleLogout} title="Sair" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', margin: 'auto' }}>
            <ArrowRightOnRectangleIcon style={{ width: 20, height: 20 }} />
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'white', flexShrink: 0 }}>
              {authUser?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {authUser?.email || 'Usuário'}
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
