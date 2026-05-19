import Header from '../components/Header'
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline'

export default function EmDesenvolvimento({ titulo = 'Em desenvolvimento', descricao }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title={titulo} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, color: 'var(--text-secondary)' }}>
        <WrenchScrewdriverIcon style={{ width: 56, height: 56, color: '#00c896', opacity: 0.7 }} />
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{titulo}</div>
        <div style={{ fontSize: 14, maxWidth: 360, textAlign: 'center', lineHeight: 1.6 }}>
          {descricao || 'Esta seção está sendo construída e estará disponível em breve.'}
        </div>
        <div style={{ marginTop: 8, padding: '6px 18px', borderRadius: 20, background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.18)', fontSize: 12, fontWeight: 700, color: '#00c896', letterSpacing: '0.05em' }}>
          EM DESENVOLVIMENTO
        </div>
      </div>
    </div>
  )
}
