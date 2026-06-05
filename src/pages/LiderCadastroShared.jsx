/**
 * LiderCadastroShared.jsx
 * Componentes reutilizáveis para as telas de cadastro do SmartLíder.
 */
import { XMarkIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline'

// ── Estilos base ──────────────────────────────────────────────────────────────
export const inp = {
  width: '100%', padding: '10px 12px', borderRadius: 9,
  border: '1px solid var(--border)', background: 'var(--bg-muted)',
  color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
}

export const btnIcon = (color) => ({
  background: color + '15', border: '1px solid ' + color + '40',
  color, borderRadius: 8, padding: '6px 9px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
})

// ── Badge ──────────────────────────────────────────────────────────────────────
export function Badge({ text }) {
  if (!text) return null
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
      background: 'var(--bg-muted)', color: 'var(--text-secondary)', whiteSpace: 'nowrap',
    }}>{text}</span>
  )
}

// ── Status Chip ────────────────────────────────────────────────────────────────
export function StatusChip({ ativo }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: ativo ? '#22c55e20' : '#ef444420',
      color: ativo ? '#22c55e' : '#ef4444',
    }}>{ativo ? 'Ativo' : 'Inativo'}</span>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, icon, color = '#3b82f6' }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}14 0%, var(--bg-card) 55%)`,
      borderRadius: 12, padding: '18px 20px',
      border: `1px solid ${color}28`, borderTop: `3px solid ${color}`,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: color + '18', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 22, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginTop: 3 }}>{label}</p>
      </div>
    </div>
  )
}

// ── Toolbar (busca + botões) ──────────────────────────────────────────────────
export function Toolbar({ busca, setBusca, onRefresh, onNovo, placeholder }) {
  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'center',
      background: 'var(--bg-card)', borderRadius: 12,
      padding: '12px 16px', border: '1px solid var(--border)', marginBottom: 16,
    }}>
      <MagnifyingGlassIcon style={{ width: 18, color: 'var(--text-muted)', flexShrink: 0 }} />
      <input
        value={busca} onChange={e => setBusca(e.target.value)}
        placeholder={placeholder || 'Buscar…'}
        style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)' }}
      />
      <button onClick={onRefresh} title="Recarregar" style={{
        background: 'var(--bg-muted)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
        color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
      }}>
        <ArrowPathIcon style={{ width: 16 }} />
      </button>
      <button onClick={onNovo} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
        fontWeight: 700, fontSize: 13, background: 'var(--primary)', color: '#fff', flexShrink: 0,
      }}>
        <PlusIcon style={{ width: 16 }} /> Novo
      </button>
    </div>
  )
}

// ── Tabela gerencial ──────────────────────────────────────────────────────────
export function DataTable({ cols, children, loading, isEmpty }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-muted)', borderBottom: '2px solid var(--border)' }}>
            {cols.map(c => (
              <th key={c} style={{
                padding: '12px 16px', textAlign: 'left', fontSize: 11,
                fontWeight: 700, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
              }}>{c}</th>
            ))}
            <th style={{
              padding: '12px 16px', textAlign: 'right', fontSize: 11,
              fontWeight: 700, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>Ações</th>
          </tr>
        </thead>
        <tbody>{!loading && !isEmpty && children}</tbody>
      </table>
      {loading && (
        <p style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)', margin: 0 }}>Carregando…</p>
      )}
      {!loading && isEmpty && (
        <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: 36, marginBottom: 10 }}>📭</p>
          <p style={{ fontWeight: 700, margin: 0, fontSize: 15 }}>Nenhum cadastro encontrado</p>
          <p style={{ fontSize: 13, marginTop: 4, opacity: 0.7 }}>Clique em &quot;+ Novo&quot; para adicionar</p>
        </div>
      )}
    </div>
  )
}

// ── Linha da tabela ───────────────────────────────────────────────────────────
export function TR({ cells, ativo, onEdit, onToggle, onDel }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)', opacity: ativo ? 1 : 0.55 }}>
      {cells.map((cell, i) => (
        <td key={i} style={{ padding: '13px 16px', fontSize: 14, color: 'var(--text-primary)', verticalAlign: 'middle' }}>
          {cell}
        </td>
      ))}
      <td style={{ padding: '8px 16px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button onClick={onEdit}   style={btnIcon('#3b82f6')} title="Editar">
            <PencilIcon style={{ width: 14 }} />
          </button>
          <button onClick={onToggle} style={btnIcon(ativo ? '#f59e0b' : '#22c55e')} title={ativo ? 'Inativar' : 'Ativar'}>
            <span style={{ fontSize: 13 }}>{ativo ? '⏸' : '▶'}</span>
          </button>
          <button onClick={onDel}    style={btnIcon('#ef4444')} title="Excluir">
            <TrashIcon style={{ width: 14 }} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Modal genérico ─────────────────────────────────────────────────────────────
export function Modal({ title, onClose, onSave, saving, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 28,
        width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <XMarkIcon style={{ width: 22 }} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} disabled={saving} style={{
            flex: 1, padding: '13px 0', borderRadius: 10, border: 'none',
            background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
          }}>
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving} style={{
            flex: 2, padding: '13px 0', borderRadius: 10, border: 'none',
            background: '#22c55e', color: '#fff', fontWeight: 800, fontSize: 15,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Field (label + input) ──────────────────────────────────────────────────────
export function Field({ label, children }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 700,
        color: 'var(--text-secondary)', marginBottom: 5,
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>{label}</label>
      {children}
    </div>
  )
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Sel({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inp}>
      {options.map(o => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
  )
}
