import { useState } from 'react'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { PencilIcon, TrashIcon, XMarkIcon, TruckIcon } from '@heroicons/react/24/outline'
import { formatCurrency } from '../lib/utils'

const COLORS = ['#a855f7','#6366f1','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4','#84cc16']

// Validação leve: AAA0000 (Mercosul AAA0A00 também)
function placaValida(p) {
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(String(p || '').toUpperCase().replace(/\s+/g, ''))
}

function VehicleModal({ vehicle, people, onClose, onSave }) {
  const [form, setForm] = useState(vehicle || {
    placa: '', apelido: '', pessoa_id: people[0]?.id || '', cor: COLORS[0], modelo: ''
  })
  const placaOk = placaValida(form.placa)
  const podeSalvar = placaOk && form.pessoa_id

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{vehicle ? 'Editar Veículo' : 'Novo Veículo'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <XMarkIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
            <div>
              <label className="label">Placa *</label>
              <input
                className="input"
                value={form.placa}
                onChange={e => setForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))}
                placeholder="ABC1D23"
                style={{ textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: 1 }}
              />
              {form.placa && !placaOk && (
                <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>Formato inválido</div>
              )}
            </div>
            <div>
              <label className="label">Apelido</label>
              <input className="input" value={form.apelido} onChange={e => setForm(f => ({ ...f, apelido: e.target.value }))} placeholder="Carro Camila, Moto, etc" />
            </div>
          </div>
          <div>
            <label className="label">Modelo</label>
            <input className="input" value={form.modelo || ''} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} placeholder="HB20, Onix, ..." />
          </div>
          <div>
            <label className="label">Dono / Quem paga *</label>
            <select className="input" value={form.pessoa_id} onChange={e => setForm(f => ({ ...f, pessoa_id: e.target.value }))}>
              {people.map(p => (
                <option key={p.id} value={p.id}>{p.apelido || p.nome}{p.is_owner ? ' (você)' : ''}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
              Toda passagem do Sem Parar com essa placa será atribuída a essa pessoa automaticamente.
            </div>
          </div>
          <div>
            <label className="label">Cor</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setForm(f => ({ ...f, cor: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: form.cor === c ? '3px solid white' : '3px solid transparent', transform: form.cor === c ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.15s' }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={!podeSalvar} onClick={() => podeSalvar && onSave(form)}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Veiculos() {
  const { vehicles, people, expenses, addVehicle, updateVehicle, deleteVehicle } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  function handleSave(data) {
    if (editing) updateVehicle(editing.id, data)
    else addVehicle(data)
    setShowModal(false); setEditing(null)
  }

  // Estatística por veículo: somar despesas que tem _veiculo === placa
  function statsForPlate(placa) {
    let total = 0, qtd = 0
    for (const e of expenses) {
      if (e._veiculo === placa) {
        total += e.valor
        qtd++
      }
    }
    return { total, qtd }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header
        title="Veículos"
        subtitle="Cadastre placas para direcionar débitos do Sem Parar à pessoa correta"
        action={{ label: 'Novo Veículo', onClick: () => { setEditing(null); setShowModal(true) } }}
      />

      <div style={{ padding: '24px 28px' }}>
        {vehicles.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <TruckIcon style={{ width: 48, height: 48, color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Nenhum veículo cadastrado</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Cadastre as placas e quem paga por cada veículo. Quando importar uma fatura Sem Parar,<br/>
              o sistema vai atribuir automaticamente o débito à pessoa dona da placa.
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>+ Cadastrar primeiro veículo</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {vehicles.map(v => {
              const dono = people.find(p => p.id === v.pessoa_id)
              const stats = statsForPlate(v.placa)
              return (
                <div key={v.id} className="card" style={{ padding: 18, borderLeft: `4px solid ${v.cor || '#a855f7'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: (v.cor || '#a855f7') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TruckIcon style={{ width: 22, height: 22, color: v.cor || '#a855f7' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 700, letterSpacing: 1 }}>{v.placa}</div>
                      {(v.apelido || v.modelo) && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {[v.apelido, v.modelo].filter(Boolean).join(' • ')}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setEditing(v); setShowModal(true) }} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 7, padding: 6, cursor: 'pointer', color: '#818cf8', display: 'flex' }}>
                        <PencilIcon style={{ width: 14, height: 14 }} />
                      </button>
                      <button onClick={() => { if (confirm(`Excluir veículo ${v.placa}?`)) deleteVehicle(v.id) }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: 6, cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                        <TrashIcon style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 8 }}>
                    {dono && (
                      <>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: dono.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>
                          {dono.avatar || dono.nome[0]}
                        </div>
                        <div style={{ flex: 1, fontSize: 13 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Pago por </span>
                          <strong>{dono.apelido || dono.nome}</strong>
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Lançamentos</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{stats.qtd}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total gasto</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginTop: 2 }}>{formatCurrency(stats.total)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <VehicleModal
          vehicle={editing}
          people={people}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
