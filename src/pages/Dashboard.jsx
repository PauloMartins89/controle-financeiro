import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import StatCard from '../components/StatCard'
import Avatar from '../components/Avatar'
import WelcomeDashboard from '../components/WelcomeDashboard'
import NotificacoesRecorrentes from '../components/NotificacoesRecorrentes'
import useStore from '../store/useStore'
import { formatCurrency, formatDate, getCategoryIcon } from '../lib/utils'

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    expenses, people, groups, recurring,
    currentUser, authUserName, getSaldos, getDebitos,
    getMinhasReceitas, getMeusDividas, getTotalPagar, getTotalAlheio,
    negocios, proventos,
  } = useStore()

  const debitos = useMemo(() => getDebitos(), [expenses])
  const saldos = useMemo(() => getSaldos(), [expenses])

  const minhaCota = useMemo(() => getTotalPagar(), [expenses, currentUser])
  const cotaAlheia = useMemo(() => getTotalAlheio(), [expenses, currentUser])
  const rateiosAtivos = expenses.filter(e => e.status === 'pendente' && e.participantes?.length > 1).length
  const proximasFaturas = recurring.filter(r => r.ativo)

  // Onboarding: mostra boas-vindas se não tiver pessoas nem despesas
  const hasPeople = people.length > 0
  const hasExpenses = expenses.length > 0
  const hasShared = expenses.some(e => e.participantes?.length > 1)

  if (!hasPeople && !hasExpenses) {
    return <WelcomeDashboard hasPeople={hasPeople} hasExpenses={hasExpenses} hasShared={hasShared} />
  }

  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .slice(0, 5)

  // Business income data
  const totalReceitaNegocios = proventos.reduce((s, p) => s + p.valor, 0)
  const proventosPendentes = proventos.filter(p => p.status === 'pendente')
  const totalPendenteDist = proventosPendentes.reduce((s, p) => s + p.valor, 0)
  const minhaPartPendente = proventosPendentes.reduce((total, prov) => {
    const neg = negocios.find(n => n.id === prov.negocio_id)
    const socio = neg?.socios?.find(s => s.pessoa_id === currentUser?.id)
    return total + (socio ? (prov.valor * socio.percentual) / 100 : 0)
  }, 0)

  const pendentes = expenses.filter(e => e.status === 'pendente');
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header
        title="Dashboard"
        subtitle={`Olá, ${currentUser?.nome || authUserName || 'usuário'} 👋`}
        action={{ label: 'Nova Despesa', onClick: () => navigate('/despesas?new=1') }}
      />

      <div style={{ padding: '24px 28px' }}>
        <NotificacoesRecorrentes />
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
          <StatCard icon="💚" label="Você recebe" value={getMinhasReceitas()} color="#10b981" />
          <StatCard icon="🔴" label="Você deve" value={getMeusDividas()} color="#ef4444" />
          <StatCard icon="⏳" label="Sua parte" value={minhaCota} color="#f59e0b" sub="do total pendente" />
          <StatCard icon="👤" label="Cabe a outros" value={cotaAlheia} color="#6366f1" sub="em rateios ativos" />
          <StatCard icon="🔁" label="Contas fixas" value={proximasFaturas.length} isCurrency={false} color="#8b5cf6" sub={`${formatCurrency(proximasFaturas.reduce((s, r) => s + r.valor, 0))} / mês`} />
          <StatCard icon="👥" label="Pessoas" value={people.length} isCurrency={false} color="#ec4899" sub={`${groups.length} grupos ativos`} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Quem deve a quem */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Quem deve a quem</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{debitos.length} pendência{debitos.length !== 1 ? 's' : ''}</div>
              </div>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => navigate('/quem-deve')}>
                Ver tudo →
              </button>
            </div>
            <div>
              {debitos.slice(0, 4).map((d, i) => {
                const dePerson = people.find(p => p.id === d.de)
                const paraPerson = people.find(p => p.id === d.para)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar personId={d.de} size={28} />
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dePerson?.nome}</span>
                        {' '}deve para{' '}
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{paraPerson?.nome}</span>
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 14 }}>{formatCurrency(d.valor)}</span>
                  </div>
                )
              })}
              {debitos.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                  ✅ Tudo certo! Nenhuma pendência.
                </div>
              )}
            </div>
          </div>

          {/* Últimas despesas */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Últimas despesas</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}</div>
              </div>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => navigate('/despesas')}>
                Ver tudo →
              </button>
            </div>
            <div>
              {recentExpenses.map((exp, i) => {
                const grupo = groups.find(g => g.id === exp.grupo_id)
                return (
                  <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < recentExpenses.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{getCategoryIcon(exp.categoria)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exp.descricao}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {formatDate(exp.data)} {grupo && `· ${grupo.icone} ${grupo.nome}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(exp.valor)}</div>
                      <span className={`badge badge-${exp.status === 'pago' ? 'success' : 'warning'}`} style={{ fontSize: 10 }}>
                        {exp.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Contas Recorrentes */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Contas Recorrentes do Mês</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Vencimentos e valores fixos</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 0 }}>
            {proximasFaturas.map((r, i) => (
              <div key={r.id} style={{
                padding: '14px 20px',
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 22 }}>{getCategoryIcon(r.categoria)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.descricao}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Dia {r.dia_vencimento} de cada mês</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>{formatCurrency(r.valor)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Negócios — Business Income Overview */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Proventos de Negócios</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Receitas e distribuições dos seus negócios compartilhados</div>
            </div>
            <button onClick={() => navigate('/proventos')} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: '#818cf8', fontSize: 13, fontWeight: 600 }}>
              Ver todos →
            </button>
          </div>

          {/* Mini stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Receita total', value: totalReceitaNegocios, color: '#10b981', icon: '💰' },
              { label: 'A distribuir', value: totalPendenteDist, color: '#f59e0b', icon: '⏳' },
              { label: 'Minha participação', value: minhaPartPendente, color: '#8b5cf6', icon: '👤' },
              { label: 'Negócios ativos', value: negocios.filter(n => n.ativo).length, color: '#6366f1', icon: '🏢', isCur: false },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.color }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{s.isCur === false ? s.value : formatCurrency(s.value)}</div>
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Business cards row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {negocios.filter(n => n.ativo).map(neg => {
              const negProvs = proventos.filter(p => p.negocio_id === neg.id)
              const recTotal = negProvs.reduce((s, p) => s + p.valor, 0)
              const pendente = negProvs.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)
              const minhaP = negProvs.filter(p => p.status === 'pendente').reduce((t, prov) => {
                const socio = neg.socios?.find(s => s.pessoa_id === currentUser?.id)
                return t + (socio ? (prov.valor * socio.percentual) / 100 : 0)
              }, 0)

              return (
                <div key={neg.id} onClick={() => navigate('/proventos')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.2s', position: 'relative', overflow: 'hidden' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = neg.cor}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: neg.cor }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${neg.cor}, ${neg.cor}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                      {neg.icone}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{neg.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{negProvs.length} proventos</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: 'rgba(16,185,129,0.07)', borderRadius: 8, padding: '7px 10px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Receita</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginTop: 2 }}>{formatCurrency(recTotal)}</div>
                    </div>
                    <div style={{ background: 'rgba(139,92,246,0.07)', borderRadius: 8, padding: '7px 10px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Minha parte</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#8b5cf6', marginTop: 2 }}>{formatCurrency(minhaP)}</div>
                    </div>
                  </div>
                  {/* Partner pills */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {(neg.socios || []).map(s => {
                      const p = people.find(x => x.id === s.pessoa_id)
                      if (!p) return null
                      return (
                        <div key={s.pessoa_id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: `${p.cor}18`, border: `1px solid ${p.cor}44`, borderRadius: 6, padding: '2px 7px' }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: p.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: 'white' }}>{p.avatar}</div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{p.nome.split(' ')[0]}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.percentual}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
