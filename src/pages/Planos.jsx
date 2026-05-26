import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CheckIcon } from '@heroicons/react/24/solid'

// ─────────────────────────────────────────────────────────────
// CONFIGURAR: substitua pelo link do produto no Kiwify
// Ex: https://pay.kiwify.com.br/XXXXXXX?email={{EMAIL}}
// ─────────────────────────────────────────────────────────────
const KIWIFY_LINK_MENSAL = 'https://pay.kiwify.com.br/SEU-PRODUTO-MENSAL'
const KIWIFY_LINK_ANUAL  = 'https://pay.kiwify.com.br/SEU-PRODUTO-ANUAL'

function Feature({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <CheckIcon style={{ width: 12, height: 12, color: '#6366f1' }} />
      </div>
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{text}</span>
    </div>
  )
}

function PlanCard({ title, price, period, desc, link, email, highlight }) {
  return (
    <div style={{
      flex: 1,
      padding: '28px 24px',
      background: highlight ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' : 'var(--bg-card)',
      border: `1px solid ${highlight ? '#6366f1' : 'var(--border)'}`,
      borderRadius: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      position: 'relative',
    }}>
      {highlight && (
        <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
          MELHOR CUSTO-BENEFÍCIO
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>R$</span>
        <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{price}</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>/{period}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{desc}</div>
      <a
        href={`${link}?email=${encodeURIComponent(email)}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '12px 0',
          background: highlight ? '#6366f1' : 'transparent',
          border: highlight ? 'none' : '1px solid var(--border)',
          borderRadius: 10,
          color: highlight ? '#fff' : 'var(--text-primary)',
          fontWeight: 700,
          fontSize: 14,
          textDecoration: 'none',
          marginTop: 'auto',
          cursor: 'pointer',
        }}
      >
        Assinar agora
      </a>
    </div>
  )
}

export default function Planos() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null) // null = carregando

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { navigate('/login'); return }
      setEmail(data.user.email || '')
      const { data: sub } = await supabase
        .from('assinaturas')
        .select('status, trial_expires_at, expires_at, plan')
        .eq('user_id', data.user.id)
        .maybeSingle()
      setStatus(sub)
    })
  }, [])

  function handleBack() { navigate('/') }

  const trialDaysLeft = status?.trial_expires_at
    ? Math.max(0, Math.ceil((new Date(status.trial_expires_at) - Date.now()) / 86400000))
    : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src="/logo.png" alt="SmartPro" className="app-logo-light" style={{ height: 128, objectFit: 'contain', marginBottom: 12 }} />
          <img src="/logo-dark.png" alt="SmartPro" className="app-logo-dark" style={{ height: 128, objectFit: 'contain', marginBottom: 12 }} />
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 6 }}>
            Controle financeiro inteligente com IA via WhatsApp
          </p>
        </div>

        {/* Aviso de trial / vencimento */}
        {status?.status === 'trial' && (
          <div style={{ padding: '14px 18px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, marginBottom: 24, textAlign: 'center', fontSize: 14, color: '#f59e0b' }}>
            {trialDaysLeft > 0
              ? `⏳ Seu período de teste gratuito termina em ${trialDaysLeft} dia${trialDaysLeft !== 1 ? 's' : ''}. Assine para continuar.`
              : '⏰ Seu período de teste encerrou. Escolha um plano para continuar usando.'}
          </div>
        )}
        {(status?.status === 'cancelado' || status?.status === 'vencido') && (
          <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, marginBottom: 24, textAlign: 'center', fontSize: 14, color: '#ef4444' }}>
            🔒 Sua assinatura está {status.status}. Renove abaixo para reativar o acesso.
          </div>
        )}

        {/* Funcionalidades */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>O que está incluído</div>
          <Feature text="Registro de despesas por WhatsApp com IA" />
          <Feature text="Leitura de notas fiscais por foto" />
          <Feature text="Transcrição e categorização de áudios" />
          <Feature text="Dashboard, balanço e previsão financeira" />
          <Feature text="Cartões de crédito, parcelas e recorrentes" />
          <Feature text="Negócios, veículos e proventos" />
          <Feature text="Atualizações gratuitas incluídas" />
        </div>

        {/* Planos */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <PlanCard
            title="Mensal"
            price="39"
            period="mês"
            desc="Cancele quando quiser"
            link={KIWIFY_LINK_MENSAL}
            email={email}
          />
          <PlanCard
            title="Anual"
            price="29"
            period="mês"
            desc="Cobrado R$ 348/ano — economia de R$ 120"
            link={KIWIFY_LINK_ANUAL}
            email={email}
            highlight
          />
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)', opacity: 0.6 }}>
          Pagamento seguro via PIX, cartão ou boleto • Cancele a qualquer momento
        </div>

        {/* Voltar (só se ainda estiver em trial ativo) */}
        {status?.status === 'trial' && trialDaysLeft > 0 && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={handleBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
              Continuar no período de teste ({trialDaysLeft} dia{trialDaysLeft !== 1 ? 's' : ''} restante{trialDaysLeft !== 1 ? 's' : ''})
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
