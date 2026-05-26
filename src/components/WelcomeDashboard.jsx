import { useNavigate } from 'react-router-dom'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'

const STEPS = [
  {
    num: 1,
    icon: '👥',
    title: 'Cadastre as pessoas',
    desc: 'Adicione quem divide as despesas com você: parceiro(a), amigos, família ou colegas.',
    cta: 'Adicionar pessoas',
    to: '/pessoas',
    doneKey: 'hasPeople',
    color: '#6366f1',
    bg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
    preview: [
      { nome: 'Ana', cor: '#6366f1', val: 'R$ 320,00' },
      { nome: 'João', cor: '#8b5cf6', val: 'R$ 185,50' },
      { nome: 'Maria', cor: '#06b6d4', val: 'R$ 97,00' },
    ],
  },
  {
    num: 2,
    icon: '📄',
    title: 'Importe sua fatura',
    desc: 'Envie o arquivo da fatura do cartão ou cadastre os gastos manualmente.',
    cta: 'Importar fatura',
    ctaAlt: 'Adicionar despesa',
    to: '/importar',
    toAlt: '/despesas?new=1',
    doneKey: 'hasExpenses',
    color: '#0ea5e9',
    bg: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    preview: [
      { desc: 'Supermercado', val: 'R$ 312,40', cat: '🛒' },
      { desc: 'Restaurante', val: 'R$ 89,90', cat: '🍔' },
      { desc: 'Combustível', val: 'R$ 150,00', cat: '⛽' },
    ],
  },
  {
    num: 3,
    icon: '✂️',
    title: 'Divida os gastos',
    desc: 'Informe os participantes e o sistema divide: igual, por valor ou por percentual.',
    cta: 'Ver despesas',
    to: '/despesas',
    doneKey: 'hasShared',
    color: '#8b5cf6',
    bg: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)',
    preview: [
      { nome: 'Ana', pct: '50%', val: 'R$ 44,95' },
      { nome: 'João', pct: '50%', val: 'R$ 44,95' },
    ],
  },
  {
    num: 4,
    icon: '💰',
    title: 'Veja quem deve o quê',
    desc: 'O sistema calcula e mostra quem deve quanto para quem em tempo real.',
    cta: 'Ver saldos',
    to: '/quem-deve',
    doneKey: 'hasExpenses',
    color: '#10b981',
    bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    preview: [
      { de: 'João', para: 'Ana', val: 'R$ 127,30', positivo: false },
      { de: 'Ana', para: 'Maria', val: 'R$ 43,20', positivo: true },
    ],
  },
]

function StepPreview({ step }) {
  if (step.num === 1) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {step.preview.map(p => (
        <div key={p.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '6px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: p.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 700 }}>{p.nome[0]}</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{p.nome}</span>
          </div>
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{p.val}</span>
        </div>
      ))}
    </div>
  )
  if (step.num === 2) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {step.preview.map(p => (
        <div key={p.desc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '6px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>{p.cat}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{p.desc}</span>
          </div>
          <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{p.val}</span>
        </div>
      ))}
    </div>
  )
  if (step.num === 3) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '8px 10px', marginBottom: 2 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Restaurante — R$ 89,90</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {step.preview.map(p => (
            <div key={p.nome} style={{ flex: 1, background: '#fff', borderRadius: 6, padding: '4px 6px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 10, color: '#6b7280' }}>{p.nome}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{p.val}</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>{p.pct}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
  if (step.num === 4) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {step.preview.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '7px 10px' }}>
          <span style={{ fontSize: 12, color: '#374151' }}>
            <strong>{p.de}</strong> → {p.para}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: p.positivo ? '#10b981' : '#ef4444' }}>{p.val}</span>
        </div>
      ))}
    </div>
  )
  return null
}

export default function WelcomeDashboard({ hasPeople, hasExpenses, hasShared }) {
  const navigate = useNavigate()
  const done = { hasPeople, hasExpenses, hasShared }

  const completedCount = [hasPeople, hasExpenses].filter(Boolean).length
  const progressPct = Math.round((completedCount / 2) * 100)

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* Hero centralizado */}
      <div style={{
        width: '100%',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.06) 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '40px 24px 32px',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div style={{ maxWidth: 760, width: '100%', textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
          }}>💸</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            Bem-vindo ao SmartPro
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.6, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
            Importe sua fatura, marque quem participou de cada gasto e veja automaticamente quem deve o quê.
          </p>

          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ width: 200, height: 6, borderRadius: 99, background: 'rgba(99,102,241,0.12)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                width: `${progressPct}%`,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
              {completedCount} de 2 etapas concluídas
            </span>
            {progressPct === 100 && (
              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>🎉 Pronto!</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 900, padding: '32px 24px' }}>
        {/* Steps */}
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, textAlign: 'center', letterSpacing: '-0.01em' }}>
          Como funciona — 4 passos simples
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 }}>
          {STEPS.map((step) => {
            const isDone = done[step.doneKey]
            return (
              <div key={step.num} style={{
                borderRadius: 16,
                background: isDone ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : step.bg,
                border: `1px solid ${isDone ? 'rgba(16,185,129,0.25)' : 'rgba(0,0,0,0.06)'}`,
                padding: '20px 18px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'default',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                {/* Badge passo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: isDone ? '#10b981' : step.color,
                    background: isDone ? 'rgba(16,185,129,0.12)' : `${step.color}18`,
                    padding: '3px 8px', borderRadius: 99,
                  }}>
                    {isDone ? '✓ Concluído' : `Passo ${step.num}`}
                  </span>
                  <span style={{ fontSize: 20 }}>{step.icon}</span>
                </div>

                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 6px', lineHeight: 1.3 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5, margin: '0 0 14px' }}>
                  {step.desc}
                </p>

                {/* Mini preview */}
                <div style={{ marginBottom: 14 }}>
                  <StepPreview step={step} />
                </div>

                {/* CTAs */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => navigate(step.to)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: isDone ? '#10b981' : step.color,
                      border: 'none', borderRadius: 8, padding: '7px 12px',
                      cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      color: '#fff', boxShadow: `0 2px 8px ${isDone ? 'rgba(16,185,129,0.3)' : step.color + '40'}`,
                    }}
                  >
                    {isDone ? '✓ Ver' : step.cta}
                    {!isDone && <ArrowRightIcon style={{ width: 12, height: 12 }} />}
                  </button>
                  {step.ctaAlt && !isDone && (
                    <button
                      onClick={() => navigate(step.toAlt)}
                      style={{
                        background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, color: '#374151',
                      }}
                    >
                      {step.ctaAlt}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Casos de uso */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14, letterSpacing: '-0.01em' }}>
            Para quem é o SmartPro?
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {[
              { icon: '💑', label: 'Casal dividindo contas do mês' },
              { icon: '👨‍👩‍👧‍👦', label: 'Família organizando o cartão' },
              { icon: '✈️', label: 'Amigos em viagem' },
              { icon: '🏠', label: 'República com despesas da casa' },
              { icon: '🍔', label: 'Galera no restaurante' },
              { icon: '⛽', label: 'Divisão de combustível' },
              { icon: '💳', label: 'Terceiros no seu cartão' },
            ].map(({ icon, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 99, padding: '6px 14px',
                fontSize: 12, color: 'var(--text-secondary)',
              }}>
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
