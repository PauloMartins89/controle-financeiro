import { NavLink } from 'react-router-dom'
import {
  HomeIcon, CurrencyDollarIcon, UsersIcon, UserGroupIcon,
  CreditCardIcon, ArrowsRightLeftIcon, ChartBarIcon,
  ArrowPathIcon, CalendarDaysIcon, Cog6ToothIcon, ChevronDoubleLeftIcon,
  BuildingOffice2Icon, BanknotesIcon, ArrowUpTrayIcon, TruckIcon,
  PresentationChartLineIcon
} from '@heroicons/react/24/outline'
import useStore from '../store/useStore'
import { formatCurrency } from '../lib/utils'

const navItems = [
  { to: '/', icon: HomeIcon, label: 'Dashboard' },
  { to: '/despesas', icon: CurrencyDollarIcon, label: 'Despesas' },
  { to: '/quem-deve', icon: ArrowsRightLeftIcon, label: 'Quem deve a quem' },
  { to: '/grupos', icon: UserGroupIcon, label: 'Grupos' },
  { to: '/pessoas', icon: UsersIcon, label: 'Pessoas' },
  { to: '/cartoes', icon: CreditCardIcon, label: 'Cartões' },
  { to: '/veiculos', icon: TruckIcon, label: 'Veículos' },
  { to: '/recorrentes', icon: ArrowPathIcon, label: 'Recorrentes' },
  { to: '/timeline', icon: ChartBarIcon, label: 'Timeline' },
  { to: '/balanco', icon: PresentationChartLineIcon, label: 'Balanço' },
  { to: '/previsao', icon: BanknotesIcon, label: 'Caixa' },
  { to: '/negocios', icon: BuildingOffice2Icon, label: 'Negócios', divider: true },
  { to: '/proventos', icon: BanknotesIcon, label: 'Proventos' },
  { to: '/importar', icon: ArrowUpTrayIcon, label: 'Importar', divider: true },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { currentUser, people, setCurrentUser, getMeusDividas, getMinhasReceitas, getTotalPagar } = useStore()

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
      {/* Logo */}
      <div style={{ padding: collapsed ? '20px 12px' : '20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>💰</span>
              <span>RateioPro</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Controle Financeiro</div>
          </div>
        )}
        {collapsed && <span style={{ fontSize: 22, margin: 'auto' }}>💰</span>}
        <button
          onClick={onToggle}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}
        >
          <ChevronDoubleLeftIcon style={{ width: 16, height: 16, transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
        </button>
      </div>

      {/* My balance snippet */}
      {!collapsed && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ background: 'rgba(99,102,241,0.08)', borderRadius: 10, padding: '10px 12px' }}>
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
        {navItems.map(({ to, icon: Icon, label, divider }) => (
          <div key={to}>
            {divider && !collapsed && <div style={{ height: 1, background: 'var(--border)', margin: '8px 6px', opacity: 0.6 }} />}
            {divider && collapsed && <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />}
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              title={collapsed ? label : undefined}
              style={{ marginBottom: 2, justifyContent: collapsed ? 'center' : 'flex-start' }}
            >
              <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          </div>
        ))}
      </nav>

      {/* User picker */}
      <div style={{ padding: collapsed ? '12px 8px' : '12px 16px', borderTop: '1px solid var(--border)' }}>
        {collapsed ? (
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: currentUser?.cor || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, margin: 'auto' }}>
            {currentUser?.avatar}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usuário ativo</div>
            <select
              className="input"
              value={currentUser?.id || ''}
              onChange={e => setCurrentUser(people.find(p => p.id === e.target.value))}
              style={{ fontSize: 13, padding: '6px 10px' }}
            >
              {people.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </aside>
  )
}
