import { useState, useCallback, useRef } from 'react'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { formatCurrency, BANDEIRAS } from '../lib/utils'
import { BANCOS, getBanco, BancoLogo, BandeiraIcon, ChipIcon, ContactlessIcon } from '../lib/banks.jsx'
import { parseFile } from '../lib/transactionParser'
import { normalizeTransaction, IMPORT_CATEGORIAS, CAT_ICONS } from '../lib/transactionNormalizer'
import { toast } from 'react-hot-toast'
import { PencilIcon, TrashIcon, XMarkIcon, CreditCardIcon, ArrowUpTrayIcon, CheckCircleIcon, ArrowPathIcon, ChevronLeftIcon, PlusIcon } from '@heroicons/react/24/outline'

// ─── Lançamento Manual Modal ──────────────────────────────────────────────────
function ManualEntryModal({ card, onClose, onSave }) {
  const { people, groups, getOwner } = useStore()
  const owner = getOwner()
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    data: new Date().toISOString().slice(0, 10),
    parcelas: 1,
    categoria: 'Outros',
    grupo_id: '',
    observacoes: '',
  })

  const valorNum = parseFloat(form.valor) || 0
  const parcelaValor = form.parcelas > 1 ? valorNum / form.parcelas : valorNum
  const ownerId = owner?.id

  function handleSave() {
    if (!form.descricao.trim()) { toast.error('Informe a descrição.'); return }
    if (valorNum <= 0) { toast.error('Informe um valor válido.'); return }
    if (form.parcelas < 1 || form.parcelas > 72) { toast.error('Parcelas entre 1 e 72.'); return }
    onSave({
      descricao: form.descricao.trim(),
      valor: valorNum,
      data: form.data,
      categoria: form.categoria,
      grupo_id: form.grupo_id || null,
      parcelas: parseInt(form.parcelas) || 1,
      observacoes: form.observacoes,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(135deg, ${card.cor}22, transparent)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${card.cor}33`, border: `1px solid ${card.cor}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCardIcon style={{ width: 18, height: 18, color: card.cor }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Lançamento manual</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{card.nome}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <XMarkIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>

        <div style={{ padding: '20px 22px', display: 'grid', gap: 14 }}>
          <div>
            <label className="label">Descrição da despesa *</label>
            <input className="input" autoFocus placeholder="Ex: Compra mercado, Netflix, Combustível..."
              value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Valor total (R$) *</label>
              <input className="input" type="number" step="0.01" min="0" placeholder="0,00"
                value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div>
              <label className="label">Data da compra *</label>
              <input className="input" type="date"
                value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Parcelas</label>
              <input className="input" type="number" min="1" max="72"
                value={form.parcelas} onChange={e => setForm(f => ({ ...f, parcelas: parseInt(e.target.value) || 1 }))} />
              {form.parcelas > 1 && valorNum > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {form.parcelas}× de <strong style={{ color: card.cor }}>{formatCurrency(parcelaValor)}</strong>
                </div>
              )}
            </div>
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {IMPORT_CATEGORIAS.map(c => <option key={c} value={c}>{CAT_ICONS[c] || ''} {c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Grupo (opcional)</label>
            <select className="input" value={form.grupo_id} onChange={e => setForm(f => ({ ...f, grupo_id: e.target.value }))}>
              <option value="">— Sem grupo —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.icone} {g.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} placeholder="Notas opcionais..."
              value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>

          {/* Resumo */}
          {valorNum > 0 && (
            <div style={{ padding: 12, background: `${card.cor}10`, border: `1px solid ${card.cor}33`, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: form.parcelas > 1 ? 8 : 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Será lançado em <strong style={{ color: 'var(--text-primary)' }}>{card.nome}</strong>
                  {form.parcelas > 1 && <> · {form.parcelas} parcelas mensais</>}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: card.cor }}>{formatCurrency(valorNum)}</div>
              </div>
              {form.parcelas > 1 && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', borderTop: `1px dashed ${card.cor}33`, paddingTop: 8 }}>
                  💡 Será criada <strong>1 despesa por mês</strong> de <strong style={{ color: card.cor }}>{formatCurrency(parcelaValor)}</strong> a partir de {new Date(form.data).toLocaleDateString('pt-BR')}.
                  Assim a fatura/consolidação de cada mês mostra apenas o valor da parcela.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave}>
            <PlusIcon style={{ width: 14, height: 14, marginRight: 4 }} />
            Lançar despesa
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Importar Extrato Modal ───────────────────────────────────────────────────

// Considera uma despesa como vinda de import anterior se tem origem='import'
// (registros novos) ou se o campo observações indica origem de extrato (legado).
function isImportada(exp) {
  if (!exp) return false
  if (exp.origem === 'import') return true
  const obs = exp.observacoes || ''
  return obs.startsWith('Importado do extrato')
}

// Detecta se uma transação do CSV/OFX/PDF já foi importada antes para o mesmo
// cartão (chave: card_id + data + valor). Lançamentos manuais são ignorados.
function isDuplicada(row, allExpenses, cardId) {
  return allExpenses.some(e =>
    e.card_id === cardId &&
    isImportada(e) &&
    e.data === row.data &&
    Math.abs((e.valor || 0) - (row.valor || 0)) < 0.005
  )
}

function CartaoImportModal({ card, people, owner, vehicles, expenses, onClose, onImport }) {
  const [step, setStep] = useState(0)   // 0=upload 1=review 2=confirm
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedRow, setExpandedRow] = useState(null)
  const inputRef = useRef()

  // Pessoas para atribuição (todos exceto owner)
  const others = people.filter(p => p.id !== owner?.id)
  const defaultOther = others[0]?.id || ''

  function makeEmptyValores() {
    const v = {}
    others.forEach(p => { v[p.id] = '' })
    return v
  }

  async function handleFile(file) {
    if (!file) return
    setLoading(true); setError('')
    try {
      const rawRows = await parseFile(file)
      if (rawRows.length === 0) throw new Error('Nenhuma transação encontrada.')
      const processed = rawRows.map((r, i) => {
        const { nome, cat } = normalizeTransaction(r.descricao)
        const _duplicada = isDuplicada(r, expenses || [], card.id)
        // Auto-atribuição por veículo (Sem Parar): se a placa estiver cadastrada,
        // direciona o débito ao dono do veículo automaticamente.
        let _modo = 'owner'
        let _pessoa = defaultOther
        if (r._veiculo) {
          const norm = String(r._veiculo).toUpperCase().replace(/\s+/g, '')
          const veh = (vehicles || []).find(v => v.placa === norm)
          if (veh && veh.pessoa_id) {
            if (veh.pessoa_id === owner?.id) {
              _modo = 'owner'
            } else {
              _modo = 'pessoa'
              _pessoa = veh.pessoa_id
            }
          }
        }
        return {
          ...r, id: i, _nome: nome, _cat: cat,
          _duplicada,
          _incluir: !_duplicada,            // duplicadas vêm desmarcadas por padrão
          _modo,                            // 'owner' | 'pessoa' | 'rateio' | 'manual'
          _pessoa,                          // quando _modo === 'pessoa'
          _pessoas: [],                     // quando _modo === 'rateio'
          _valores: makeEmptyValores(),     // quando _modo === 'manual'
        }
      })
      setRows(processed)
      setStep(1)
      const novas = processed.filter(p => !p._duplicada).length
      const dups = processed.length - novas
      if (dups > 0) {
        toast.success(`${processed.length} carregadas — ${novas} novas, ${dups} já importadas`)
      } else {
        toast.success(`${rawRows.length} transações carregadas!`)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onDrop = useCallback(e => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [defaultOther])

  function update(id, field, value) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  function toggleAll(val) {
    setRows(rs => rs.map(r => ({ ...r, _incluir: val })))
  }
  // Atribui um modo + alvo padrão para todas as linhas
  function bulkSetMode(modo, target) {
    setRows(rs => rs.map(r => {
      if (modo === 'owner') return { ...r, _modo: 'owner' }
      if (modo === 'pessoa') return { ...r, _modo: 'pessoa', _pessoa: target }
      return r
    }))
  }

  async function handleConfirm() {
    setSaving(true)
    const selected = rows.filter(r => r._incluir)
    await onImport(selected)
    setSaving(false)
  }

  // Resumo de atribuição de uma linha (texto curto)
  function getRowSummary(row) {
    if (row._modo === 'owner') return { txt: `100% ${owner?.apelido || owner?.nome || 'própria'}`, color: '#a855f7' }
    if (row._modo === 'pessoa') {
      const p = others.find(x => x.id === row._pessoa)
      return { txt: `→ ${p?.nome || '?'} (100%)`, color: p?.cor || '#6366f1' }
    }
    if (row._modo === 'rateio') {
      const n = (row._pessoas || []).length + 1 // +owner
      return { txt: `÷ ${n} pessoas (igual)`, color: '#06b6d4' }
    }
    if (row._modo === 'manual') {
      const total = Object.values(row._valores || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)
      return { txt: `Manual: ${formatCurrency(total)} atribuído`, color: total > row.valor + 0.01 ? '#ef4444' : '#f59e0b' }
    }
    return { txt: '', color: 'var(--text-secondary)' }
  }

  const selected = rows.filter(r => r._incluir)
  const total = selected.reduce((s, r) => s + r.valor, 0)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{ alignItems: 'flex-start', paddingTop: 40 }}>
      <div className="modal" style={{ maxWidth: 900, width: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${card.cor}, ${card.cor}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCardIcon style={{ width: 20, height: 20, color: 'white' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Importar Extrato — {card.nome}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {step === 0 ? 'Selecione o arquivo do extrato' : step === 1 ? `${rows.length} transações — defina de quem é cada uma` : 'Confirmar importação'}
            </div>
          </div>
          {/* Step pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {['Arquivo', 'Revisão', 'Confirmar'].map((s, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                background: i < step ? '#10b981' : i === step ? '#6366f1' : 'rgba(0,0,0,0.05)',
                color: i <= step ? 'white' : 'var(--text-secondary)' }}>
                {i < step ? '✓ ' : ''}{s}
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
            <XMarkIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── STEP 0: Upload ── */}
          {step === 0 && (
            <div>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                style={{ border: '2px dashed var(--border)', borderRadius: 18, padding: '52px 32px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-secondary)', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <input ref={inputRef} type="file" accept=".csv,.ofx,.qfx,.xlsx,.xls,.pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
                {loading ? (
                  <div>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
                    <div style={{ fontWeight: 600 }}>Processando...</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>PDFs podem demorar alguns segundos</div>
                  </div>
                ) : (
                  <>
                    <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                      <ArrowUpTrayIcon style={{ width: 30, height: 30, color: '#818cf8' }} />
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Arraste ou clique para importar o extrato</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>Formatos: PDF, CSV, OFX, XLSX</div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      {['PDF','CSV','OFX','XLSX'].map(f => (
                        <span key={f} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>.{f}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {error && (
                <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: 13 }}>
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 1: Review ── */}
          {step === 1 && (
            <div>
              {/* Summary + bulk assign */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', fontSize: 13 }}>
                  <span style={{ fontWeight: 800, color: '#818cf8' }}>{selected.length}</span>
                  <span style={{ color: 'var(--text-secondary)' }}> de {rows.length} selecionadas</span>
                </div>
                {(() => {
                  const dups = rows.filter(r => r._duplicada).length
                  const novas = rows.length - dups
                  if (rows.length === 0) return null
                  return (
                    <div style={{ padding: '10px 16px', borderRadius: 10, background: dups > 0 ? 'rgba(148,163,184,0.10)' : 'rgba(16,185,129,0.08)', border: `1px solid ${dups > 0 ? 'rgba(148,163,184,0.25)' : 'rgba(16,185,129,0.15)'}`, fontSize: 13 }}>
                      <span style={{ fontWeight: 800, color: '#10b981' }}>{novas}</span>
                      <span style={{ color: 'var(--text-secondary)' }}> novas</span>
                      {dups > 0 && <>
                        <span style={{ color: 'var(--text-secondary)' }}> · </span>
                        <span style={{ fontWeight: 800, color: '#94a3b8' }}>{dups}</span>
                        <span style={{ color: 'var(--text-secondary)' }}> já importadas</span>
                      </>}
                    </div>
                  )
                })()}
                <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', fontSize: 13 }}>
                  Total: <span style={{ fontWeight: 800, color: '#10b981' }}>{formatCurrency(total)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Em massa:</span>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => bulkSetMode('owner')}>
                    100% {owner?.apelido || 'própria'}
                  </button>
                  <select onChange={e => e.target.value && bulkSetMode('pessoa', e.target.value)}
                    defaultValue=""
                    style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer' }}>
                    <option value="">100% para…</option>
                    {others.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => toggleAll(true)}>✓ Todos</button>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => toggleAll(false)}>✗ Nenhum</button>
                  {rows.some(r => r._duplicada) && (
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: '5px 10px', color: '#94a3b8' }}
                      title="Marca também as transações já importadas anteriormente"
                      onClick={() => setRows(rs => rs.map(r => r._duplicada ? { ...r, _incluir: true } : r))}
                    >
                      🔁 Re-incluir duplicadas
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '40px 90px 1fr 130px 110px 200px', padding: '9px 14px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  {['', 'Data', 'Descrição', 'Categoria', 'Valor', 'De quem é?'].map((h, i) => (
                    <span key={i} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                  ))}
                </div>

                {/* Rows */}
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {rows.map((row, i) => {
                    const summary = getRowSummary(row)
                    const isExp = expandedRow === row.id
                    return (
                      <div key={row.id} style={{
                        borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                        opacity: row._incluir ? 1 : 0.35,
                        background: row._incluir ? 'transparent' : 'rgba(0,0,0,0.15)',
                        transition: 'opacity 0.15s',
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 90px 1fr 130px 110px 200px',
                          padding: '9px 14px',
                          alignItems: 'center',
                        }}>
                          {/* Checkbox */}
                          <input type="checkbox" checked={row._incluir} onChange={() => update(row.id, '_incluir', !row._incluir)}
                            style={{ width: 15, height: 15, accentColor: '#6366f1', cursor: 'pointer' }} />

                          {/* Date */}
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.data}</div>

                          {/* Description (editable) */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                value={row._nome}
                                onChange={e => update(row.id, '_nome', e.target.value)}
                                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, width: '100%', cursor: 'text' }}
                                onFocus={e => e.target.style.background = 'rgba(0,0,0,0.05)'}
                                onBlur={e => e.target.style.background = 'transparent'}
                              />
                              {row._duplicada && (
                                <span
                                  title="Já existe uma despesa com este cartão, data e valor (importada anteriormente)"
                                  style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.3)', whiteSpace: 'nowrap' }}
                                >
                                  🔁 Já importada
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.descricao}</div>
                          </div>

                          {/* Category */}
                          <select value={row._cat} onChange={e => update(row.id, '_cat', e.target.value)}
                            style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 6px', color: 'var(--text-primary)', fontSize: 11, cursor: 'pointer', width: '100%' }}>
                            {IMPORT_CATEGORIAS.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
                          </select>

                          {/* Amount */}
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#ef4444', textAlign: 'right', paddingRight: 4 }}>
                            {formatCurrency(row.valor)}
                          </div>

                          {/* Atribuição: summary + edit toggle */}
                          <button
                            onClick={() => setExpandedRow(isExp ? null : row.id)}
                            style={{
                              background: 'var(--bg-secondary)',
                              border: `1px solid ${isExp ? summary.color : 'var(--border)'}`,
                              borderRadius: 8, padding: '5px 8px',
                              color: 'var(--text-primary)', fontSize: 11, fontWeight: 600,
                              cursor: 'pointer', textAlign: 'left',
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: summary.color, flexShrink: 0 }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.txt}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{isExp ? '▲' : '▼'}</span>
                          </button>
                        </div>

                        {/* Expanded — atribuição editor */}
                        {isExp && (
                          <div style={{ padding: '12px 16px 14px 64px', background: 'rgba(0,0,0,0.18)', borderTop: '1px solid var(--bg-secondary)' }}>
                            {/* Mode selector */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                              {[
                                { v: 'owner', l: `100% ${owner?.apelido || 'Camila'}`, c: '#a855f7' },
                                { v: 'pessoa', l: '100% para outra pessoa', c: '#6366f1' },
                                { v: 'rateio', l: 'Dividir igual', c: '#06b6d4' },
                                { v: 'manual', l: 'Valor manual por pessoa', c: '#f59e0b' },
                              ].map(m => (
                                <button key={m.v} onClick={() => update(row.id, '_modo', m.v)}
                                  style={{
                                    padding: '6px 12px', borderRadius: 8,
                                    background: row._modo === m.v ? m.c : 'var(--bg-secondary)',
                                    border: `1px solid ${row._modo === m.v ? m.c : 'var(--border)'}`,
                                    color: row._modo === m.v ? 'white' : 'var(--text-primary)',
                                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                  }}>{m.l}</button>
                              ))}
                            </div>

                            {/* Mode-specific controls */}
                            {row._modo === 'owner' && (
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                💜 A despesa é 100% sua — ninguém deve nada.
                              </div>
                            )}

                            {row._modo === 'pessoa' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Quem deve {formatCurrency(row.valor)}:</span>
                                <select value={row._pessoa} onChange={e => update(row.id, '_pessoa', e.target.value)}
                                  style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>
                                  {others.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                </select>
                              </div>
                            )}

                            {row._modo === 'rateio' && (
                              <div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                  Selecione quem participa (você e os marcados dividem igualmente):
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {others.map(p => {
                                    const checked = (row._pessoas || []).includes(p.id)
                                    return (
                                      <button key={p.id} onClick={() => {
                                        const cur = row._pessoas || []
                                        const next = checked ? cur.filter(x => x !== p.id) : [...cur, p.id]
                                        update(row.id, '_pessoas', next)
                                      }}
                                        style={{
                                          padding: '6px 12px', borderRadius: 20,
                                          background: checked ? p.cor : 'var(--bg-secondary)',
                                          border: `1px solid ${checked ? p.cor : 'var(--border)'}`,
                                          color: checked ? 'white' : 'var(--text-primary)',
                                          fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                          display: 'flex', alignItems: 'center', gap: 6,
                                        }}>
                                        {checked ? '✓' : '+'} {p.nome}
                                      </button>
                                    )
                                  })}
                                </div>
                                {(row._pessoas || []).length > 0 && (
                                  <div style={{ marginTop: 10, fontSize: 12, color: '#06b6d4' }}>
                                    Cada pessoa pagará {formatCurrency(row.valor / ((row._pessoas || []).length + 1))}
                                  </div>
                                )}
                              </div>
                            )}

                            {row._modo === 'manual' && (
                              <div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                  Defina quanto cada pessoa deve (o restante fica com você):
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                                  {others.map(p => (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: p.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'white', flexShrink: 0 }}>{p.nome[0]}</div>
                                      <span style={{ fontSize: 11, fontWeight: 600, minWidth: 50 }}>{p.nome}</span>
                                      <input
                                        type="number" step="0.01" placeholder="0,00"
                                        value={row._valores?.[p.id] ?? ''}
                                        onChange={e => update(row.id, '_valores', { ...(row._valores || {}), [p.id]: e.target.value })}
                                        style={{ flex: 1, background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)', fontSize: 12, width: '100%' }}
                                      />
                                    </div>
                                  ))}
                                </div>
                                {(() => {
                                  const tot = Object.values(row._valores || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0)
                                  const restante = row.valor - tot
                                  return (
                                    <div style={{ marginTop: 10, fontSize: 12, color: tot > row.valor + 0.01 ? '#ef4444' : restante > 0.01 ? '#a855f7' : '#10b981' }}>
                                      Atribuído: {formatCurrency(tot)} de {formatCurrency(row.valor)} —
                                      {tot > row.valor + 0.01
                                        ? ` ⚠️ excede em ${formatCurrency(tot - row.valor)}`
                                        : ` sobra ${formatCurrency(restante)} para ${owner?.apelido || 'você'}`}
                                    </div>
                                  )
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Confirm ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
                {[
                  { label: 'Transações', value: selected.length, color: '#6366f1', fmt: false },
                  { label: 'Total', value: total, color: '#ef4444', fmt: true },
                  { label: 'Cartão', value: card.nome, color: card.cor, fmt: false },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color, borderRadius: '12px 12px 0 0' }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{s.fmt ? formatCurrency(s.value) : s.value}</div>
                  </div>
                ))}
              </div>

              {/* By person breakdown */}
              {(() => {
                // Calcular quanto cada pessoa deve para o owner
                const devedores = {}
                let ownerSelf = 0
                selected.forEach(r => {
                  if (r._modo === 'owner') {
                    ownerSelf += r.valor
                  } else if (r._modo === 'pessoa') {
                    devedores[r._pessoa] = (devedores[r._pessoa] || 0) + r.valor
                  } else if (r._modo === 'rateio') {
                    const n = (r._pessoas || []).length + 1
                    const share = r.valor / n
                    ;(r._pessoas || []).forEach(pid => {
                      devedores[pid] = (devedores[pid] || 0) + share
                    })
                    ownerSelf += share
                  } else if (r._modo === 'manual') {
                    let atribuido = 0
                    Object.entries(r._valores || {}).forEach(([pid, v]) => {
                      const val = parseFloat(v) || 0
                      if (val > 0) {
                        devedores[pid] = (devedores[pid] || 0) + val
                        atribuido += val
                      }
                    })
                    ownerSelf += Math.max(0, r.valor - atribuido)
                  }
                })
                return (
                  <div className="card" style={{ padding: '18px 20px' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Quem deve quanto para {owner?.nome || 'você'}</div>
                    {/* Owner self */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: owner?.cor || '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'white' }}>
                        {owner?.nome?.[0] || 'C'}
                      </div>
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{owner?.nome || 'Você'} <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>(parte própria)</span></div>
                      <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{formatCurrency(ownerSelf)}</div>
                    </div>
                    {Object.entries(devedores).sort(([, a], [, b]) => b - a).map(([pid, val]) => {
                      const p = people.find(x => x.id === pid)
                      return (
                        <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: p?.cor || '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'white' }}>
                            {p?.nome?.[0] || '?'}
                          </div>
                          <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p?.nome || 'Desconhecido'} <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 400 }}>deve para {owner?.apelido || 'você'}</span></div>
                          <div style={{ fontWeight: 700, color: '#ef4444' }}>{formatCurrency(val)}</div>
                        </div>
                      )
                    })}
                    {Object.keys(devedores).length === 0 && (
                      <div style={{ padding: '8px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                        Nenhuma despesa atribuída a outras pessoas — tudo é seu.
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Preview list (compact) */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13 }}>
                  Prévia das {selected.length} despesas
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {selected.map((r, i) => {
                    const summary = getRowSummary(r)
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: i < selected.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: summary.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r._nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.data}</div>
                        <div style={{ fontSize: 11, color: summary.color, whiteSpace: 'nowrap', fontWeight: 600 }}>{summary.txt}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#ef4444', whiteSpace: 'nowrap' }}>{formatCurrency(r.valor)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button className="btn-ghost" onClick={() => step > 0 ? setStep(s => s - 1) : onClose()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {step > 0 && <ChevronLeftIcon style={{ width: 15, height: 15 }} />}
            {step === 0 ? 'Fechar' : 'Voltar'}
          </button>

          {step === 1 && (
            <button className="btn-primary" onClick={() => setStep(2)} disabled={selected.length === 0}
              style={{ padding: '10px 24px', fontWeight: 700 }}>
              Revisar {selected.length} transações →
            </button>
          )}

          {step === 2 && (
            <button className="btn-primary" onClick={handleConfirm} disabled={saving || selected.length === 0}
              style={{ padding: '10px 24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving
                ? <><ArrowPathIcon style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Importando...</>
                : <><CheckCircleIcon style={{ width: 18, height: 18 }} /> Importar {selected.length} despesas</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Card Modal ───────────────────────────────────────────────────────────────
function CardModal({ card, onClose, onSave }) {
  const [form, setForm] = useState(card || { nome: '', bandeira: 'Visa', limite: '', dia_fechamento: 15, dia_vencimento: 22, cor: '#6366f1' })
  const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#1e293b','#C0C5CE']

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{card ? 'Editar Cartão' : 'Novo Cartão'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><XMarkIcon style={{ width: 22, height: 22 }} /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Card preview */}
          <div style={{ borderRadius: 14, padding: '20px 22px', background: `linear-gradient(135deg, ${form.cor}, ${form.cor}99)`, minHeight: 100, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ fontSize: 12, opacity: 0.8, color: 'white' }}>{form.bandeira}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginTop: 8 }}>{form.nome || 'Nome do Cartão'}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Fecha dia {form.dia_fechamento} · Vence dia {form.dia_vencimento}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Nome do cartão *</label>
              <input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Nubank, Itaú..." />
            </div>
            <div>
              <label className="label">Bandeira</label>
              <select className="input" value={form.bandeira} onChange={e => setForm(f => ({ ...f, bandeira: e.target.value }))}>
                {BANDEIRAS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Limite (R$)</label>
            <input className="input" type="number" value={form.limite} onChange={e => setForm(f => ({ ...f, limite: parseFloat(e.target.value) || '' }))} placeholder="0,00" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Dia de fechamento</label>
              <input className="input" type="number" min="1" max="28" value={form.dia_fechamento} onChange={e => setForm(f => ({ ...f, dia_fechamento: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <label className="label">Dia de vencimento</label>
              <input className="input" type="number" min="1" max="28" value={form.dia_vencimento} onChange={e => setForm(f => ({ ...f, dia_vencimento: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>
          <div>
            <label className="label">Cor do cartão</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setForm(f => ({ ...f, cor: c }))} style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer', border: form.cor === c ? '3px solid white' : '3px solid transparent', transform: form.cor === c ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.15s' }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => form.nome && onSave({ ...form, limite: parseFloat(form.limite) || 0 })}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Cartoes() {
  const { cards, expenses, people, vehicles, getOwner, addCard, updateCard, deleteCard, addExpense } = useStore()
  const owner = getOwner()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [importingCard, setImportingCard] = useState(null) // card object being imported
  const [manualCard, setManualCard] = useState(null)        // card object for manual entry

  function handleSave(data) {
    if (editing) updateCard(editing.id, data)
    else addCard(data)
    setShowModal(false); setEditing(null)
  }

  async function handleImport(rows) {
    for (const row of rows) {
      // Determinar pago_por, participantes, tipo_divisao, valores_fixos
      const ownerId = owner?.id
      let participantes = [ownerId]
      let tipo_divisao = 'pessoal'
      let valores_fixos = null

      if (row._modo === 'owner') {
        // 100% Camila — sem dívida
        participantes = [ownerId]
        tipo_divisao = 'pessoal'
      } else if (row._modo === 'pessoa') {
        // 100% para outra pessoa — owner só é pago_por, não participa do rateio
        participantes = [row._pessoa]
        tipo_divisao = 'valor_fixo'
        valores_fixos = { [row._pessoa]: row.valor }
      } else if (row._modo === 'rateio') {
        const ps = row._pessoas || []
        if (ps.length === 0) {
          participantes = [ownerId]
          tipo_divisao = 'pessoal'
        } else {
          participantes = [ownerId, ...ps]
          tipo_divisao = 'igual'
        }
      } else if (row._modo === 'manual') {
        const vf = {}
        let atribuido = 0
        Object.entries(row._valores || {}).forEach(([pid, v]) => {
          const val = parseFloat(v) || 0
          if (val > 0) { vf[pid] = val; atribuido += val }
        })
        const sobra = Math.max(0, row.valor - atribuido)
        // Inclui owner só se ele realmente fica com alguma parte (sobra > 0)
        if (sobra > 0) vf[ownerId] = sobra
        participantes = Object.keys(vf)
        tipo_divisao = 'valor_fixo'
        valores_fixos = vf
      }

      await addExpense({
        descricao: row._nome,
        valor: row.valor,
        data: row.data,
        categoria: row._cat,
        card_id: importingCard.id,
        pago_por: ownerId,
        participantes,
        tipo_divisao,
        valores_fixos,
        grupo_id: null,
        parcelas: 1,
        parcela_atual: 1,
        recorrente: false,
        status: 'pendente',
        origem: 'import',
        observacoes: `Importado do extrato ${importingCard.nome}`,
        _veiculo: row._veiculo || null,
      })
    }
    toast.success(`${rows.length} despesas importadas para ${importingCard.nome}!`)
    setImportingCard(null)
  }

  async function handleManualEntry(data) {
    const ownerId = owner?.id
    const n = Math.max(1, parseInt(data.parcelas) || 1)
    // Valor de cada parcela (com ajuste de centavos na 1ª para fechar o total)
    const baseParc = Math.round((data.valor / n) * 100) / 100
    const ajuste = Math.round((data.valor - baseParc * n) * 100) / 100
    // Data base
    const [yy, mm, dd] = data.data.split('-').map(Number)
    const lote = `lote_${Date.now()}`

    for (let i = 0; i < n; i++) {
      const dt = new Date(yy, (mm - 1) + i, dd)
      const dataParc = dt.toISOString().slice(0, 10)
      const valorParc = i === 0 ? baseParc + ajuste : baseParc
      const sufixo = n > 1 ? ` (${i + 1}/${n})` : ''
      await addExpense({
        descricao: data.descricao + sufixo,
        valor: valorParc,
        data: dataParc,
        categoria: data.categoria,
        card_id: manualCard.id,
        pago_por: ownerId,
        participantes: [ownerId],
        tipo_divisao: 'pessoal',
        valores_fixos: null,
        grupo_id: data.grupo_id,
        parcelas: n,
        parcela_atual: i + 1,
        valor_total: data.valor,
        lote_parcelamento: n > 1 ? lote : null,
        recorrente: false,
        status: 'pendente',
        observacoes: data.observacoes || `Lançamento manual em ${manualCard.nome}`,
        _veiculo: null,
      })
    }
    toast.success(n > 1
      ? `${n} parcelas de ${formatCurrency(baseParc)} lançadas em ${manualCard.nome}!`
      : `Despesa lançada em ${manualCard.nome}!`)
    setManualCard(null)
  }

  function getCardUsage(card) {
    const ownerId = owner?.id
    const cardExpenses = expenses.filter(e => e.card_id === card.id && e.status !== 'pago')
    const fatura = cardExpenses.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0)

    const devedoresMap = {}
    let ownerParte = 0

    cardExpenses.forEach(e => {
      const val = parseFloat(e.valor) || 0
      if (e.tipo_divisao === 'pessoal' || !e.tipo_divisao) {
        ownerParte += val
      } else if (e.tipo_divisao === 'igual') {
        const n = (e.participantes || []).length || 1
        const share = val / n
        ;(e.participantes || []).forEach(pid => {
          if (pid === ownerId) ownerParte += share
          else devedoresMap[pid] = (devedoresMap[pid] || 0) + share
        })
      } else if (e.tipo_divisao === 'valor_fixo') {
        const vf = e.valores_fixos || {}
        Object.entries(vf).forEach(([pid, v]) => {
          const pval = parseFloat(v) || 0
          if (pid === ownerId) ownerParte += pval
          else devedoresMap[pid] = (devedoresMap[pid] || 0) + pval
        })
      } else {
        ownerParte += val
      }
    })

    const totalReceber = Object.values(devedoresMap).reduce((s, v) => s + v, 0)
    const parteReal = Math.max(0, fatura - totalReceber)
    const devedores = Object.entries(devedoresMap)
      .map(([pid, val]) => ({ pessoaId: pid, valor: val, percentual: fatura > 0 ? (val / fatura) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor)

    return {
      fatura,
      percentual: card.limite ? (fatura / card.limite) * 100 : 0,
      totalReceber,
      parteReal,
      ownerPercentual: fatura > 0 ? (parteReal / fatura) * 100 : 0,
      devedores,
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header title="Cartões de Crédito" subtitle="Gerencie faturas e vencimentos" action={{ label: 'Novo Cartão', onClick: () => { setEditing(null); setShowModal(true) } }} />

      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(314px, 1fr))', gap: 16 }}>
          {cards.map(card => {
            const usage = getCardUsage(card)
            // Auto-detecta banco pelo nome se ainda não foi escolhido manualmente
            let bancoId = card.banco
            if (!bancoId || bancoId === 'custom') {
              const n = (card.nome || '').toLowerCase().replace(/\s+/g, '')
              if (/semparar/.test(n)) bancoId = 'semparar'
              else if (/nubank|nuconta/.test(n)) bancoId = 'nubank'
              else if (/itau|itaú/.test(n)) bancoId = 'itau'
              else if (/bradesco/.test(n)) bancoId = 'bradesco'
              else if (/santander/.test(n)) bancoId = 'santander'
              else if (/^bb$|bancodobrasil/.test(n)) bancoId = 'bb'
              else if (/caixa/.test(n)) bancoId = 'caixa'
              else if (/^inter$|bancointer/.test(n)) bancoId = 'inter'
              else if (/c6bank|^c6$/.test(n)) bancoId = 'c6'
              else if (/btg/.test(n)) bancoId = 'btg'
              else if (/mercadopago|mp$/.test(n)) bancoId = 'mercadopago'
              else if (/picpay/.test(n)) bancoId = 'picpay'
              else if (/sicredi/.test(n)) bancoId = 'sicredi'
              else if (/sicoob/.test(n)) bancoId = 'sicoob'
              else if (/havan/.test(n)) bancoId = 'havan'
              else if (/^bv$|bancobv|votorantim/.test(n)) bancoId = 'bv'
            }
            const banco = getBanco(bancoId)
            const isPreset = bancoId && bancoId !== 'custom'
            const cardBg = isPreset
              ? banco.gradiente
              : `linear-gradient(135deg, ${card.cor}, ${card.cor}88)`
            const txt = (isPreset && banco.textColor) || 'white'
            const txtSoft = txt === 'white' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)'
            const txtDim = txt === 'white' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'
            return (
              <div key={card.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Card visual — proporção real (1.586:1, padrão ISO/IEC 7810 ID-1) */}
                <div style={{ padding: '6% 7% 6%', background: cardBg, position: 'relative', overflow: 'hidden', aspectRatio: '2.636 / 1', borderRadius: '12px 12px 0 0' }}>
                  <div style={{ position: 'absolute', top: '-15%', right: '-10%', width: '40%', aspectRatio: '1', borderRadius: '50%', background: txt === 'white' ? 'var(--border)' : 'rgba(0,0,0,0.05)' }} />
                  <div style={{ position: 'absolute', bottom: '-10%', left: '8%', width: '28%', aspectRatio: '1', borderRadius: '50%', background: txt === 'white' ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.04)' }} />
                  {isPreset && banco.watermark && (
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      pointerEvents: 'none', whiteSpace: 'pre-line', textAlign: 'center',
                      fontSize: 56, fontWeight: 900, lineHeight: 0.95, letterSpacing: -2,
                      color: 'rgba(0,0,0,0.05)', textTransform: 'uppercase',
                      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
                    }}>{banco.watermark}</div>
                  )}
                  {isPreset && banco.id === 'semparar' && (
                    <svg width="180" height="180" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
                      style={{ position: 'absolute', top: -20, right: -10, pointerEvents: 'none', opacity: 0.85 }}>
                      <path d="M30 85 L65 30 L50 30 L50 15 L80 15 L80 45 L65 45 L65 30"
                        stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {isPreset && banco.id === 'bv' && (
                    <svg viewBox="0 0 200 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                      <path d="M105 -10 L60 110" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" fill="none" />
                      <path d="M150 -10 L105 110" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" fill="none" />
                      <path d="M125 -10 Q110 50 80 110" stroke="var(--border)" strokeWidth="1" fill="none" />
                    </svg>
                  )}
                  {isPreset && banco.id === 'havan' && (
                    <>
                      {/* Estátua da Liberdade silhueta */}
                      <svg viewBox="0 0 40 80" xmlns="http://www.w3.org/2000/svg"
                        style={{ position: 'absolute', right: '4%', bottom: '8%', height: '70%', pointerEvents: 'none', opacity: 0.95 }}>
                        <path d="M20 5 L18 8 L17 12 L18 14 L20 14 L22 14 L23 12 L22 8 Z M20 14 L19 18 L17 22 L15 25 L13 28 L13 32 L15 35 L18 38 L18 50 L16 55 L14 60 L14 70 L26 70 L26 60 L24 55 L22 50 L22 38 L25 35 L27 32 L27 28 L25 25 L23 22 L21 18 Z M22 14 L26 6 L28 4 L30 4 L32 6 L31 9 L29 11 L26 13 Z M14 70 L26 70 L28 75 L12 75 Z"
                          fill="rgba(255,255,255,0.85)" />
                      </svg>
                      {/* ACREDITAMOS NO BRASIL */}
                      <div style={{ position: 'absolute', top: '14%', right: '8%', textAlign: 'right', color: '#0A4B8E', fontWeight: 800, fontSize: '11px', lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: 0.3, zIndex: 3 }}>
                        ACREDITAMOS<br />NO BRASIL
                      </div>
                    </>
                  )}
                  {/* Bandeira no canto superior direito (grande) */}
                  <div style={{ position: 'absolute', top: '8%', right: '6%', zIndex: 2 }}>
                    <BandeiraIcon bandeira={card.bandeira} size={52} />
                  </div>
                  {/* Topo: chip + contactless */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', marginBottom: 8 }}>
                    <ChipIcon size={24} />
                    <ContactlessIcon size={13} color={txt === 'white' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)'} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative' }}>
                    <div>
                      {isPreset
                        ? <BancoLogo banco={banco} size={22} />
                        : <div style={{ fontSize: 10, color: txtSoft, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.bandeira}</div>}
                      <div style={{ fontSize: 13, fontWeight: 700, color: txt === 'white' ? 'rgba(255,255,255,0.95)' : txt, marginTop: 5, letterSpacing: 0.3 }}>{card.nome}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, color: txtDim }}>FECHA</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: txt }}>Dia {card.dia_fechamento}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: txtDim }}>VENCE</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: txt }}>Dia {card.dia_vencimento}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: txtDim }}>LIMITE</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: txt }}>{formatCurrency(card.limite)}</div>
                    </div>
                  </div>
                </div>

                {/* Usage bar + breakdown */}
                <div style={{ padding: '12px 16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Fatura estimada</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{formatCurrency(usage.fatura)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Utilização</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: usage.percentual > 80 ? '#ef4444' : usage.percentual > 50 ? '#f59e0b' : '#10b981', marginTop: 2 }}>
                        {usage.percentual.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.05)', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(usage.percentual, 100)}%`, background: usage.percentual > 80 ? '#ef4444' : usage.percentual > 50 ? '#f59e0b' : card.cor, transition: 'width 0.5s' }} />
                  </div>

                  {/* Breakdown por pessoa */}
                  {usage.fatura > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      {/* 3 métricas */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                        {[
                          { label: 'Total fatura', value: usage.fatura, color: '#ef4444' },
                          { label: 'A receber', value: usage.totalReceber, color: '#10b981' },
                          { label: 'Sua parte', value: usage.parteReal, color: '#6366f1' },
                        ].map(m => (
                          <div key={m.label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{m.label}</div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: m.color }}>{formatCurrency(m.value)}</div>
                          </div>
                        ))}
                      </div>

                      {/* Participação por pessoa */}
                      {(usage.devedores.length > 0 || usage.parteReal > 0) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {/* Owner */}
                          {owner && usage.parteReal > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', background: owner.cor || '#a855f7', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'white' }}>
                                {owner.avatar || owner.nome?.[0] || 'P'}
                              </div>
                              <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{owner.apelido || owner.nome}</div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', minWidth: 56, textAlign: 'right' }}>{formatCurrency(usage.parteReal)}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-secondary)', minWidth: 36, textAlign: 'right' }}>{usage.ownerPercentual.toFixed(0)}%</div>
                              <div style={{ width: 50, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
                                <div style={{ height: '100%', width: `${usage.ownerPercentual}%`, background: '#6366f1', borderRadius: 2 }} />
                              </div>
                            </div>
                          )}
                          {/* Devedores */}
                          {usage.devedores.map(({ pessoaId, valor, percentual }) => {
                            const p = people.find(x => x.id === pessoaId)
                            return (
                              <div key={pessoaId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: p?.cor || '#6366f1', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'white' }}>
                                  {p?.avatar || p?.nome?.[0] || '?'}
                                </div>
                                <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{p?.apelido || p?.nome || 'Desconhecido'}</div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', minWidth: 56, textAlign: 'right' }}>{formatCurrency(valor)}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-secondary)', minWidth: 36, textAlign: 'right' }}>{percentual.toFixed(0)}%</div>
                                <div style={{ width: 50, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
                                  <div style={{ height: '100%', width: `${percentual}%`, background: p?.cor || '#f59e0b', borderRadius: 2 }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(() => {
                    // Cor de ação legível: se o card.cor for muito escuro, usa accent indigo
                    const hex = (card.cor || '#6366f1').replace('#','')
                    const r = parseInt(hex.substring(0,2),16) || 0
                    const g = parseInt(hex.substring(2,4),16) || 0
                    const b = parseInt(hex.substring(4,6),16) || 0
                    const lum = (0.299*r + 0.587*g + 0.114*b)
                    const isDark = lum < 80
                    const actCor = isDark ? '#6366f1' : card.cor
                    return (
                      <>
                        <button onClick={() => setManualCard(card)}
                          style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: actCor, border: 'none', borderRadius: 9, padding: '10px 12px', cursor: 'pointer', color: 'white', fontWeight: 700, fontSize: 13, transition: 'all 0.15s', boxShadow: `0 2px 8px ${actCor}55` }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                          onMouseLeave={e => e.currentTarget.style.transform = ''}
                        >
                          <PlusIcon style={{ width: 15, height: 15 }} /> Lançar despesa
                        </button>
                        <button onClick={() => setImportingCard(card)}
                          style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: `linear-gradient(135deg, ${actCor}22, ${actCor}11)`, border: `1px solid ${actCor}44`, borderRadius: 9, padding: '9px 12px', cursor: 'pointer', color: actCor, fontWeight: 700, fontSize: 12, transition: 'all 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = `${actCor}33`}
                          onMouseLeave={e => e.currentTarget.style.background = `linear-gradient(135deg, ${actCor}22, ${actCor}11)`}>
                          <ArrowUpTrayIcon style={{ width: 14, height: 14 }} /> Importar Extrato
                        </button>
                      </>
                    )
                  })()}
                  <button onClick={() => { setEditing(card); setShowModal(true) }} className="btn-ghost" style={{ flex: 1, fontSize: 12, padding: '8px 12px' }}>
                    <PencilIcon style={{ width: 14, height: 14 }} /> Editar
                  </button>
                  <button onClick={() => deleteCard(card.id)} className="btn-danger" style={{ fontSize: 12, padding: '8px 12px' }}>
                    <TrashIcon style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {cards.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💳</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum cartão cadastrado</div>
            <div style={{ fontSize: 13 }}>Adicione seus cartões de crédito para controle de fatura.</div>
          </div>
        )}
      </div>

      {showModal && <CardModal card={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSave={handleSave} />}
      {importingCard && <CartaoImportModal card={importingCard} people={people} owner={owner} vehicles={vehicles} expenses={expenses} onClose={() => setImportingCard(null)} onImport={handleImport} />}
      {manualCard && <ManualEntryModal card={manualCard} onClose={() => setManualCard(null)} onSave={handleManualEntry} />}
    </div>
  )
}
