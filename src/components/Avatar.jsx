import useStore from '../store/useStore'
import { getInitials } from '../lib/utils'

export default function Avatar({ personId, size = 32, showName = false }) {
  const { getPersonById } = useStore()
  const person = getPersonById(personId)
  if (!person) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: person.cor || '#6366f1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
        border: '2px solid rgba(255,255,255,0.1)',
        color: 'white',
      }}>
        {person.avatar || getInitials(person.nome)}
      </div>
      {showName && <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{person.nome}</span>}
    </div>
  )
}
