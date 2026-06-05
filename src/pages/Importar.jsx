import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { parseFile, getDemoTransactions } from '../lib/transactionParser'
import { normalizeTransaction, buildSugestaoRateio, IMPORT_CATEGORIAS, RATEIO_OPCOES, CAT_ICONS } from '../lib/transactionNormalizer'
import { formatCurrency } from '../lib/utils'
import {
  ArrowUpTrayIcon, CheckCircleIcon, XCircleIcon, PencilIcon,
  SparklesIcon, ArrowPathIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'

// ─── Step indicator ───────────────────────────────────────────────────────────
const STEPS = ['Importar arquivo', 'Revisar transações', 'Confirmar']

function StepBar({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {STEPS.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13,
              background: i < current ? '#10b981' : i === current ? '#6366f1' : 'rgba(0,0,0,0.05)',
              color: i <= current ? 'white' : 'var(--text-secondary)',
              border: i === current ? '2px solid #818cf8' : '2px solid transparent',
              transition: 'all 0.3s',
            }}>
              {i < current ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 13, fontWeight: i === current ? 700 : 500, color: i === current ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{s}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? '#10b981' : 'rgba(0,0,0,0.04)', margin: '0 12px', transition: 'background 0.3s' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────
function UploadZone({ onParsed, onDemo }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file) return
    setLoading(true); setError('')
    try {
      const rows = await parseFile(file)
      if (rows.length === 0) throw new Error('Nenhuma transação encontrada no arquivo.')
      toast.success(`${rows.length} transações carregadas!`)
      onParsed(rows, file.name)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#6366f1' : error ? '#ef4444' : 'var(--border)'}`,
          borderRadius: 20, padding: '56px 32px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? 'rgba(99,102,241,0.06)' : 'var(--bg-secondary)',
          transition: 'all 0.2s',
        }}
      >
        <input ref={inputRef} type="file" accept=".csv,.ofx,.qfx,.xlsx,.xls,.pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        {loading ? (
          <div>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Processando arquivo...</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>Para PDFs, o leitor é carregado da internet (pode demorar alguns segundos)</div>
          </div>
        ) : (
          <>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <ArrowUpTrayIcon style={{ width: 32, height: 32, color: '#818cf8' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              {dragging ? 'Solte o arquivo aqui' : 'Arraste ou clique para importar'}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '5px 12px', marginBottom: 12, fontSize: 12, color: '#fca5a5' }}>
              <span>📄</span> PDF de extrato bancário suportado
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Formatos suportados: PDF, CSV, OFX/QFX, XLSX
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { ext: 'PDF', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
                { ext: 'CSV', color: '#818cf8', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.2)' },
                { ext: 'OFX', color: '#818cf8', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.2)' },
                { ext: 'XLSX', color: '#818cf8', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.2)' },
              ].map(f => (
                <span key={f.ext} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: f.bg, color: f.color, border: `1px solid ${f.border}` }}>.{f.ext}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <XCircleIcon style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Bank instructions */}
      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {[
          { bank: '🟣 Nubank', how: 'App → Perfil → Exportar → CSV' },
          { bank: '🔵 Bradesco', how: 'Internet Banking → Extrato → Exportar OFX' },
          { bank: '🟠 Itaú', how: 'App → Extrato → Baixar → CSV' },
          { bank: '🟡 Santander', how: 'App → Extrato → Exportar → OFX' },
          { bank: '🔴 Banco do Brasil', how: 'Internet Banking → OFX/CSV' },
          { bank: '🟢 Nubank Crédito', how: 'Fatura → Baixar planilha' },
          { bank: '📄 PDF (qualquer banco)', how: 'Extrato digital → Salvar como PDF — lemos automaticamente as linhas com data e valor' },
        ].map(b => (
          <div key={b.bank} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{b.bank}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{b.how}</div>
          </div>
        ))}
      </div>

      {/* Demo button */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button className="btn-ghost" onClick={onDemo} style={{ fontSize: 13 }}>
          <SparklesIcon style={{ width: 15, height: 15 }} />
          Usar dados de demonstração
        </button>
      </div>
    </div>
  )
}

// ─── Review Table ─────────────────────────────────────────────────────────────
function ReviewTable({ rows, onRowsChange, people, currentUser }) {
  const [editing, setEditing] = useState(null) // { id, field }

  function toggleRow(id) {
    onRowsChange(rows.map(r => r.id === id ? { ...r, _incluir: !r._incluir } : r))
  }
  function toggleAll(val) {
    onRowsChange(rows.map(r => ({ ...r, _incluir: val })))
  }
  function updateRow(id, field, value) {
    onRowsChange(rows.map(r => r.id === id ? { ...r, [field]: value } : r))
    setEditing(null)
  }

  const allChecked = rows.every(r => r._incluir)
  const someChecked = rows.some(r => r._incluir)
  const incluidos = rows.filter(r => r._incluir)
  const total = incluidos.reduce((s, r) => s + r.valor, 0)

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: '12px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          <span style={{ fontWeight: 800, color: '#818cf8' }}>{incluidos.length}</span> de {rows.length} selecionadas
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Total: <span style={{ fontWeight: 800, color: '#10b981' }}>{formatCurrency(total)}</span>
        </span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => toggleAll(true)}>Selecionar tudo</button>
          <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => toggleAll(false)}>Limpar</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left' }}>
                <input type="checkbox" checked={allChecked} onChange={e => toggleAll(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#6366f1', cursor: 'pointer' }} />
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Data</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descrição original</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome normalizado</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categoria</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rateio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} style={{
                borderBottom: '1px solid var(--border)',
                opacity: row._incluir ? 1 : 0.35,
                background: !row._incluir ? 'rgba(0,0,0,0.15)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                transition: 'opacity 0.15s',
              }}>
                {/* Checkbox */}
                <td style={{ padding: '10px 14px' }}>
                  <input type="checkbox" checked={row._incluir} onChange={() => toggleRow(row.id)} style={{ width: 15, height: 15, accentColor: '#6366f1', cursor: 'pointer' }} />
                </td>

                {/* Date */}
                <td style={{ padding: '10px 12px', fontSize: 13, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                  {row.data}
                </td>

                {/* Original description */}
                <td style={{ padding: '10px 12px', maxWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    {row.cartao_digitos && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(130,10,209,0.15)', color: '#a855f7', border: '1px solid rgba(130,10,209,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        •••• {row.cartao_digitos}
                      </span>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.descricao}>
                      {row.descricao}
                    </div>
                  </div>
                  {row.conta && !row.cartao_digitos && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{row.conta}</div>}
                </td>

                {/* Normalized name — editable */}
                <td style={{ padding: '10px 12px' }}>
                  {editing?.id === row.id && editing?.field === 'nome' ? (
                    <input
                      autoFocus
                      className="input"
                      defaultValue={row._nome}
                      style={{ fontSize: 13, padding: '4px 8px', width: 160 }}
                      onBlur={e => updateRow(row.id, '_nome', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && updateRow(row.id, '_nome', e.target.value)}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => setEditing({ id: row.id, field: 'nome' })}>
                      <span style={{ fontSize: 13, fontWeight: 600, cursor: 'text' }}>{row._nome}</span>
                      {row._matched && <span title="Normalizado automaticamente" style={{ fontSize: 9, color: '#818cf8' }}>✦</span>}
                      <PencilIcon style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                    </div>
                  )}
                </td>

                {/* Category — editable */}
                <td style={{ padding: '10px 12px' }}>
                  <select
                    value={row._cat}
                    onChange={e => updateRow(row.id, '_cat', e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 8px', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}
                  >
                    {IMPORT_CATEGORIAS.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
                  </select>
                </td>

                {/* Amount */}
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#ef4444', whiteSpace: 'nowrap' }}>
                  {formatCurrency(row.valor)}
                </td>

                {/* Split suggestion — editable */}
                <td style={{ padding: '10px 12px' }}>
                  <select
                    value={row._rateio}
                    onChange={e => updateRow(row.id, '_rateio', e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 8px', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}
                  >
                    {RATEIO_OPCOES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Confirm Step ─────────────────────────────────────────────────────────────
function ConfirmStep({ rows, people, currentUser, onConfirm, saving }) {
  const incluidos = rows.filter(r => r._incluir)
  const total = incluidos.reduce((s, r) => s + r.valor, 0)
  const byCat = {}
  incluidos.forEach(r => {
    byCat[r._cat] = (byCat[r._cat] || 0) + r.valor
  })

  const byRateio = {}
  incluidos.forEach(r => {
    byRateio[r._rateio] = (byRateio[r._rateio] || 0) + 1
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {[
          { label: 'Despesas', value: incluidos.length, isCur: false, color: '#6366f1', icon: '🧾' },
          { label: 'Total a importar', value: total, isCur: true, color: '#ef4444', icon: '💸' },
          { label: 'Rateadas (casal/grupo)', value: incluidos.filter(r => r._rateio !== 'pessoal').length, isCur: false, color: '#10b981', icon: '🤝' },
          { label: 'Pessoais', value: incluidos.filter(r => r._rateio === 'pessoal').length, isCur: false, color: '#8b5cf6', icon: '👤' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.color, borderRadius: '14px 14px 0 0' }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{s.isCur ? formatCurrency(s.value) : s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* By category */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Por categoria</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{CAT_ICONS[cat] || '📦'}</span>
                <span style={{ flex: 1, fontSize: 13 }}>{cat}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#ef4444' }}>{formatCurrency(val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By rateio */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Por tipo de rateio</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {RATEIO_OPCOES.map(o => {
              const count = byRateio[o.value] || 0
              const pct = incluidos.length > 0 ? (count / incluidos.length) * 100 : 0
              return (
                <div key={o.value}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{o.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#6366f1', borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <button className="btn-primary" onClick={onConfirm} disabled={saving || incluidos.length === 0} style={{ padding: '14px 28px', fontSize: 16, fontWeight: 800, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {saving ? (
          <><ArrowPathIcon style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Importando...</>
        ) : (
          <><CheckCircleIcon style={{ width: 20, height: 20 }} /> Importar {incluidos.length} despesas</>
        )}
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Importar() {
  const navigate = useNavigate()
  const { people, currentUser, addExpense, cards, vehicles, getOwner, getVehicleByPlate } = useStore()
  const owner = getOwner()
  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [saving, setSaving] = useState(false)
  const [imported, setImported] = useState(0)

  function processRawRows(rawRows) {
    return rawRows.map(r => {
      const { nome, cat, rateio, matched } = normalizeTransaction(r.descricao)
      return {
        ...r,
        _nome: nome,
        _cat: cat,
        _rateio: rateio,
        _matched: matched,
        _incluir: true,
      }
    })
  }

  function handleParsed(rawRows, name) {
    setRows(processRawRows(rawRows))
    setFileName(name)
    setStep(1)
  }

  function handleDemo() {
    const raw = getDemoTransactions()
    setRows(processRawRows(raw))
    setFileName('demonstração')
    setStep(1)
  }

  async function handleConfirm() {
    setSaving(true)
    const incluidos = rows.filter(r => r._incluir)
    let count = 0

    for (const row of incluidos) {
      const config = buildSugestaoRateio(row._rateio, people, currentUser)
      // Amarração: se a despesa veio com placa de veículo cadastrado,
      // sobrepõe o rateio sugerido, atribuindo 100% ao dono da placa.
      let pago_por = config.pago_por || currentUser?.id
      let participantes = config.participantes
      let tipo_divisao = config.tipo_divisao
      let valores_fixos = null
      if (row._veiculo) {
        const veh = getVehicleByPlate(row._veiculo)
        if (veh && veh.pessoa_id) {
          const ownerId = owner?.id || currentUser?.id
          pago_por = ownerId
          if (veh.pessoa_id === ownerId) {
            // 100% próprio
            participantes = [ownerId]
            tipo_divisao = 'pessoal'
          } else {
            // 100% para o dono da placa
            participantes = [ownerId, veh.pessoa_id]
            tipo_divisao = 'valor_fixo'
            valores_fixos = { [ownerId]: 0, [veh.pessoa_id]: row.valor }
          }
        }
      }
      const expense = {
        descricao: row._nome,
        valor: row.valor,
        data: row.data,
        categoria: row._cat,
        pago_por,
        participantes,
        tipo_divisao,
        valores_fixos,
        status: 'pendente',
        parcelas: 1,
        grupo_id: null,
        notas: `Importado de: ${row.descricao}`,
        _veiculo: row._veiculo || null,
      }
      await addExpense(expense)
      count++
    }

    setSaving(false)
    setImported(count)
    setStep(2)
    toast.success(`${count} despesas importadas com sucesso!`)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header
        title="Importar Transações"
        subtitle="Importe seu extrato bancário e revise antes de gravar"
      />

      <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
        <StepBar current={step} />

        {/* Step 0 — Upload */}
        {step === 0 && (
          <UploadZone onParsed={handleParsed} onDemo={handleDemo} />
        )}

        {/* Step 1 — Review */}
        {step === 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Revisar e editar transações</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Arquivo: <span style={{ color: '#818cf8' }}>{fileName}</span> — Clique no nome para editar, ajuste categoria e rateio conforme necessário
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-ghost" onClick={() => setStep(0)}>← Voltar</button>
                <button className="btn-primary" onClick={() => setStep(2)} disabled={!rows.some(r => r._incluir)}>
                  Continuar <ChevronRightIcon style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>
            <ReviewTable rows={rows} onRowsChange={setRows} people={people} currentUser={currentUser} />
          </div>
        )}

        {/* Step 2 — Confirm */}
        {step === 2 && imported === 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Confirmar importação</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Revise o resumo antes de gravar as despesas oficialmente</div>
              </div>
              <button className="btn-ghost" onClick={() => setStep(1)}>← Voltar para revisão</button>
            </div>
            <ConfirmStep rows={rows} people={people} currentUser={currentUser} onConfirm={handleConfirm} saving={saving} />
          </div>
        )}

        {/* Done */}
        {step === 2 && imported > 0 && (
          <div style={{ textAlign: 'center', padding: '60px 32px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '3px solid rgba(16,185,129,0.3)' }}>
              <CheckCircleIcon style={{ width: 44, height: 44, color: '#10b981' }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Importação concluída!</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 28 }}>
              <span style={{ color: '#10b981', fontWeight: 700 }}>{imported} despesas</span> foram registradas com sucesso no seu financeiro.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={() => navigate('/despesas')}>
                Ver despesas importadas →
              </button>
              <button className="btn-ghost" onClick={() => navigate('/quem-deve')}>
                Quem deve a quem →
              </button>
              <button className="btn-ghost" onClick={() => { setStep(0); setRows([]); setImported(0); setFileName('') }}>
                Importar mais
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
