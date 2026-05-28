import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  ChevronLeftIcon, ChevronRightIcon, PlusIcon, XMarkIcon,
  PencilIcon, ChevronDownIcon, ChevronRightIcon as ChevronRtIcon,
  FunnelIcon, DocumentArrowDownIcon, WrenchScrewdriverIcon,
  ClockIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAY_PT = ['DOM','SEG','TER','QUA','QUI','SEX','SAB']

function todayISO() { return new Date().toISOString().slice(0, 10) }

function fmtD(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function buildDays(refDate, periodo) {
  const n = { '-7': 7, '-15': 15, '-30': 30 }[periodo] ?? 15
  const ref = new Date(refDate + 'T12:00:00')
  const days = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    days.push({
      iso,
      dow: DAY_PT[d.getDay()],
      num: iso.slice(8),
      full: `${DAY_PT[d.getDay()]} (${fmtD(iso)})`,
    })
  }
  return days
}

function calcPct(trabalhadas, disponiveis) {
  const t = Number(trabalhadas) || 0
  const d = Number(disponiveis) || 0
  if (d === 0) return null
  return (t / d) * 100
}

// ─── Cores da célula ──────────────────────────────────────────────────────────
const COLOR_BANDS = [
  { min: -Infinity, max: 0,  bg: '#ef4444', text: '#fff' },   // vermelho: 0%
  { min: 0,         max: 50, bg: '#f97316', text: '#fff' },   // laranja: >0 e <50
  { min: 50,        max: 90, bg: '#eab308', text: '#1a1a1a' },// amarelo: >=50 e <90
  { min: 90,        max: Infinity, bg: '#22c55e', text: '#fff' }, // verde: >=90
]

function getCellColor(value) {
  if (value == null) return null
  const v = Number(value)
  const band = COLOR_BANDS.find(b => v > b.min && v <= b.max) || (v === 0 ? COLOR_BANDS[0] : COLOR_BANDS[COLOR_BANDS.length - 1])
  // exact 0%
  if (v === 0) return COLOR_BANDS[0]
  return band
}

// ─── MultiSelect simplificado ────────────────────────────────────────────────
function MultiSelect({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const toggle = (opt) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt))
    else onChange([...value, opt])
  }
  const displayText = value.length === 0 ? 'nenhum item selecionado' : value.length === options.length ? 'todos selecionados' : `${value.length} selecionado(s)`

  return (
    <div style={{ position: 'relative' }}>
      {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: value.length ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText} ▼</span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
            {options.length === 0 && <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 13 }}>Sem opções</div>}
            {options.map(opt => (
              <div key={opt} onClick={() => toggle(opt)} style={{ padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', background: value.includes(opt) ? 'rgba(99,102,241,0.12)' : 'transparent' }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${value.includes(opt) ? '#6366f1' : 'var(--border)'}`, background: value.includes(opt) ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {value.includes(opt) && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
                </div>
                {opt}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Modal Boletim (criar / editar) ──────────────────────────────────────────
function BoletimModal({ boletim, workspaceId, ownerId, onClose, onSaved }) {
  const [form, setForm] = useState({
    data:                boletim?.dados_extras?.data || todayISO(),
    modelo:              boletim?.dados_extras?.modelo || '',
    equipamento:         boletim?.dados_extras?.equipamento || '',
    classe_operacional:  boletim?.dados_extras?.classe_operacional || '',
    frente:              boletim?.dados_extras?.frente || '',
    horas_disponiveis:   boletim?.dados_extras?.horas_disponiveis ?? '',
    horas_trabalhadas:   boletim?.dados_extras?.horas_trabalhadas ?? '',
    horas_espera:        boletim?.dados_extras?.horas_espera ?? '',
    observacoes:         boletim?.dados_extras?.observacoes || '',
  })
  const [saving, setSaving] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const hDisp  = Number(form.horas_disponiveis) || 0
  const hTrab  = Number(form.horas_trabalhadas) || 0
  const pct    = hDisp > 0 ? (hTrab / hDisp) * 100 : null
  const color  = pct != null ? getCellColor(pct) : null

  async function salvar() {
    if (!form.modelo.trim())     { toast.error('Informe o Modelo'); return }
    if (!form.equipamento.trim()) { toast.error('Informe o Equipamento'); return }
    if (!form.data)               { toast.error('Informe a data'); return }
    setSaving(true)
    try {
      const extras = {
        data:               form.data,
        modelo:             form.modelo.trim(),
        equipamento:        form.equipamento.trim().toUpperCase(),
        classe_operacional: form.classe_operacional.trim(),
        frente:             form.frente.trim(),
        horas_disponiveis:  hDisp || null,
        horas_trabalhadas:  hTrab || null,
        horas_espera:       Number(form.horas_espera) || null,
        porcentagem:        pct != null ? parseFloat(pct.toFixed(4)) : null,
        observacoes:        form.observacoes.trim() || null,
      }
      const payload = {
        workspace_id:    workspaceId,
        owner_id:        ownerId,
        tipo:            'despesa',
        tipo_formulario: 'maquina',
        descricao:       `Boletim ${extras.equipamento} — ${fmtD(form.data)}`,
        data:            form.data,
        valor:           0,
        status:          'aprovado',
        dados_extras:    extras,
      }
      if (boletim?.id) {
        const { error } = await supabase.from('lancamentos').update({ dados_extras: extras, descricao: payload.descricao, data: form.data }).eq('id', boletim.id)
        if (error) throw new Error(error.message)
        toast.success('Boletim atualizado!')
      } else {
        const { error } = await supabase.from('lancamentos').insert(payload)
        if (error) throw new Error(error.message)
        toast.success('Boletim criado!')
      }
      onSaved()
      onClose()
    } catch (err) { toast.error(err.message || 'Erro ao salvar') }
    setSaving(false)
  }

  const inp = (lbl, key, opts = {}) => (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{lbl}</label>
      <input type={opts.type || 'text'} className="input" style={{ fontSize: 13 }} placeholder={opts.placeholder || ''} min={opts.min} step={opts.step} value={form[key] ?? ''} onChange={e => f(key, e.target.value)} />
    </div>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{boletim?.id ? 'Editar Boletim' : 'Novo Boletim de Máquina'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Data */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Data do Boletim *</label>
            <input type="date" className="input" style={{ fontSize: 13 }} value={form.data} onChange={e => f('data', e.target.value)} />
          </div>
          {/* Modelo + Equipamento */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {inp('Modelo *', 'modelo', { placeholder: 'CAT 320D' })}
            {inp('Equipamento *', 'equipamento', { placeholder: 'EH-03' })}
          </div>
          {/* Classe Operacional + Frente */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {inp('Classe Operacional', 'classe_operacional', { placeholder: 'Escavadeira Hidráulica' })}
            {inp('Frente', 'frente', { placeholder: 'Frente A' })}
          </div>
          {/* Horas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {inp('Horas Disponíveis', 'horas_disponiveis', { type: 'number', placeholder: '8', min: '0', step: '0.25' })}
            {inp('Horas Trabalhadas', 'horas_trabalhadas', { type: 'number', placeholder: '0', min: '0', step: '0.25' })}
            {inp('Horas Espera', 'horas_espera',        { type: 'number', placeholder: '0', min: '0', step: '0.25' })}
          </div>
          {/* Preview % */}
          {pct != null && (
            <div style={{ borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: color ? `${color.bg}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${color ? color.bg : 'var(--border)'}55` }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{hTrab}h trabalhadas / {hDisp}h disponíveis</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: color?.bg || '#fff' }}>{pct.toFixed(2)}%</span>
            </div>
          )}
          {/* Observações */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Observações</label>
            <textarea className="input" rows={2} style={{ resize: 'vertical', fontSize: 13 }} placeholder="Opcional..." value={form.observacoes} onChange={e => f('observacoes', e.target.value)} />
          </div>
          {/* Botões */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 9, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancelar</button>
            <button onClick={salvar} disabled={saving} className="btn-primary" style={{ padding: '9px 22px', fontSize: 13 }}>
              {saving ? 'Salvando...' : boletim?.id ? '💾 Salvar' : '✅ Criar Boletim'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Painel lateral (Boletim aberto) ─────────────────────────────────────────
function BoletimPanel({ records, equipKey, date, onClose, onEdit, onNew }) {
  const d = records[0]?.dados_extras
  const allRecs = records

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, zIndex: 800, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', boxShadow: '-8px 0 32px rgba(0,0,0,0.35)', animation: 'slideInRight 0.2s ease' }}>
      {/* Header */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
            {d?.modelo || '—'} — <span style={{ color: 'var(--accent)' }}>{d?.equipamento || equipKey}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            📅 {fmtD(date)}
            {d?.frente && <span style={{ marginLeft: 8 }}>· 🚧 {d.frente}</span>}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
          <XMarkIcon style={{ width: 20, height: 20 }} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {allRecs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚙️</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Sem boletim nesta data</div>
            <div style={{ fontSize: 12, marginBottom: 20 }}>Nenhum apontamento registrado para {d?.equipamento || equipKey} em {fmtD(date)}.</div>
            <button onClick={onNew} className="btn-primary" style={{ padding: '9px 18px', fontSize: 13 }}>
              <PlusIcon style={{ width: 14, height: 14 }} /> Lançar Boletim
            </button>
          </div>
        ) : allRecs.map((rec, idx) => {
          const ex = rec.dados_extras || {}
          const pct = ex.porcentagem != null ? ex.porcentagem : calcPct(ex.horas_trabalhadas, ex.horas_disponiveis)
          const col = pct != null ? getCellColor(pct) : null
          return (
            <div key={rec.id}>
              {allRecs.length > 1 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Boletim {idx + 1}</div>
              )}
              {/* KPI de utilização */}
              {pct != null && (
                <div style={{ borderRadius: 14, padding: '16px 20px', marginBottom: 16, background: col ? `${col.bg}22` : 'rgba(255,255,255,0.04)', border: `2px solid ${col ? col.bg + '88' : 'var(--border)'}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: col?.bg || 'var(--text-primary)' }}>{pct.toFixed(2)}%</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Utilização</div>
                </div>
              )}
              {/* Cards de horas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Disponíveis', value: ex.horas_disponiveis, unit: 'h', color: '#6366f1' },
                  { label: 'Trabalhadas', value: ex.horas_trabalhadas, unit: 'h', color: '#10b981' },
                  { label: 'Em Espera',   value: ex.horas_espera,      unit: 'h', color: '#f59e0b' },
                ].map(k => (
                  <div key={k.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value != null ? `${Number(k.value).toFixed(1)}${k.unit}` : '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{k.label}</div>
                  </div>
                ))}
              </div>
              {/* Detalhes */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                {[
                  { label: 'Modelo',             value: ex.modelo },
                  { label: 'Equipamento',        value: ex.equipamento },
                  { label: 'Classe Operacional', value: ex.classe_operacional },
                  { label: 'Frente',             value: ex.frente },
                  { label: 'Status',             value: rec.status },
                ].filter(r => r.value).map((row, i, arr) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
              {ex.observacoes && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                  📝 {ex.observacoes}
                </div>
              )}
              {/* Ações */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onEdit(rec)} style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <PencilIcon style={{ width: 14, height: 14 }} /> Editar
                </button>
              </div>
              {idx < allRecs.length - 1 && <hr style={{ margin: '20px 0', borderColor: 'var(--border)' }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MapaApontamentoMaquina() {
  const workspaceId = useStore(s => s.workspaceId)
  const ownerId     = useStore(s => s.currentUser?.id)

  // ── Filtros ──────────────────────────────────────────────────────────────────
  const [refDate,  setRefDate]  = useState(todayISO)
  const [periodo,  setPeriodo]  = useState('-15')
  const [tipoRel,  setTipoRel]  = useState('porcentagem')  // porcentagem | horas
  const [exibir,   setExibir]   = useState('todos')         // todos | acima | abaixo
  const [fClasseOp,   setFClasseOp]   = useState([])
  const [fModelo,     setFModelo]     = useState([])
  const [fEquipamento, setFEquipamento] = useState([])
  const [fFrente,     setFFrente]     = useState([])

  // ── Estado da tabela ─────────────────────────────────────────────────────────
  const [lancamentos, setLancamentos] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [expanded,    setExpanded]    = useState({})

  // ── Estado painel/modal ──────────────────────────────────────────────────────
  const [panel,    setPanel]    = useState(null)   // { equipKey, date, records[] }
  const [editRec,  setEditRec]  = useState(null)   // rec a editar ou {} para novo

  // ── Dias do período ──────────────────────────────────────────────────────────
  const days = useMemo(() => buildDays(refDate, periodo), [refDate, periodo])

  // ── Carregar dados ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const startDate = days[0].iso
    const endDate   = days[days.length - 1].iso
    const { data, error } = await supabase
      .from('lancamentos')
      .select('id, data, descricao, status, dados_extras')
      .eq('workspace_id', workspaceId)
      .eq('tipo_formulario', 'maquina')
      .gte('data', startDate)
      .lte('data', endDate)
      .order('data')
    if (error) toast.error('Erro ao carregar boletins')
    setLancamentos(data || [])
    setLoading(false)
  }, [workspaceId, days])

  useEffect(() => { load() }, [load])

  // ── Construção da matriz ─────────────────────────────────────────────────────
  const { rows, options } = useMemo(() => {
    const rowMap = {}
    const opts = { classeOp: new Set(), modelo: new Set(), equipamento: new Set(), frente: new Set() }

    for (const lanc of lancamentos) {
      const ex = lanc.dados_extras || {}
      const equip = (ex.equipamento || '').trim().toUpperCase() || '__'
      const model = (ex.modelo || '').trim() || '—'
      const key   = `${model}::${equip}`

      if (ex.classe_operacional) opts.classeOp.add(ex.classe_operacional)
      if (model !== '—')         opts.modelo.add(model)
      if (equip !== '__')        opts.equipamento.add(equip)
      if (ex.frente)             opts.frente.add(ex.frente)

      if (!rowMap[key]) rowMap[key] = { key, modelo: model, equipamento: equip, classeOp: ex.classe_operacional || '', frente: ex.frente || '', cells: {} }

      const dateKey = lanc.data || ex.data
      if (dateKey) {
        if (!rowMap[key].cells[dateKey]) rowMap[key].cells[dateKey] = []
        rowMap[key].cells[dateKey].push(lanc)
      }
    }

    const rowList = Object.values(rowMap).sort((a, b) => a.modelo.localeCompare(b.modelo) || a.equipamento.localeCompare(b.equipamento))

    return {
      rows: rowList,
      options: {
        classeOp:    [...opts.classeOp].sort(),
        modelo:      [...opts.modelo].sort(),
        equipamento: [...opts.equipamento].sort(),
        frente:      [...opts.frente].sort(),
      },
    }
  }, [lancamentos])

  // ── Filtragem ────────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (fClasseOp.length   && !fClasseOp.includes(r.classeOp))     return false
      if (fModelo.length     && !fModelo.includes(r.modelo))          return false
      if (fEquipamento.length && !fEquipamento.includes(r.equipamento)) return false
      if (fFrente.length     && !fFrente.includes(r.frente))          return false

      if (exibir !== 'todos') {
        const pcts = Object.values(r.cells).flat().map(l => {
          const ex = l.dados_extras || {}
          return ex.porcentagem ?? calcPct(ex.horas_trabalhadas, ex.horas_disponiveis)
        }).filter(v => v != null)
        if (pcts.length === 0) return false
        const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length
        if (exibir === 'acima'  && avg < 90)  return false
        if (exibir === 'abaixo' && avg >= 90) return false
      }
      return true
    })
  }, [rows, fClasseOp, fModelo, fEquipamento, fFrente, exibir])

  // ── Navegar período ──────────────────────────────────────────────────────────
  function shiftPeriod(dir) {
    const n = { '-7': 7, '-15': 15, '-30': 30 }[periodo] ?? 15
    const d = new Date(refDate + 'T12:00:00')
    d.setDate(d.getDate() + dir * n)
    setRefDate(d.toISOString().slice(0, 10))
  }

  // ── Clique na célula ─────────────────────────────────────────────────────────
  function openCell(row, day) {
    const records = row.cells[day.iso] || []
    setPanel({ equipKey: row.equipamento, date: day.iso, records, row })
  }

  function handleEdit(rec) {
    setEditRec(rec)
    setPanel(null)
  }

  function handleNew(row, date) {
    setEditRec({
      _new: true,
      dados_extras: {
        modelo:             row?.modelo || '',
        equipamento:        row?.equipamento || '',
        classe_operacional: row?.classeOp || '',
        frente:             row?.frente || '',
        data:               date || todayISO(),
      }
    })
    setPanel(null)
  }

  function getCellValue(records) {
    if (!records || records.length === 0) return null
    const vals = records.map(r => {
      const ex = r.dados_extras || {}
      if (tipoRel === 'horas') return Number(ex.horas_trabalhadas) || 0
      return ex.porcentagem ?? calcPct(ex.horas_trabalhadas, ex.horas_disponiveis)
    }).filter(v => v != null)
    if (vals.length === 0) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  function fmtCellValue(v) {
    if (v == null) return ''
    return tipoRel === 'horas' ? `${Number(v).toFixed(1)}h` : `${Number(v).toFixed(2)}%`
  }

  const STICKY_LEFT_W = 160
  const STICKY_COL2_W = 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="⚙️ Mapa de Apontamento" subtitle="Mapa de utilização de máquinas por período" />

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* ── Filtros ── */}
        <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
          {/* Linha 1: Data, Período, Tipo, Exibir */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Data:</label>
              <input type="date" className="input" style={{ fontSize: 13 }} value={refDate} onChange={e => setRefDate(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Período:</label>
              <select className="input" style={{ fontSize: 13 }} value={periodo} onChange={e => setPeriodo(e.target.value)}>
                <option value="-7">-7 dias</option>
                <option value="-15">-15 dias</option>
                <option value="-30">-30 dias</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Tipo Relatório:</label>
              <select className="input" style={{ fontSize: 13 }} value={tipoRel} onChange={e => setTipoRel(e.target.value)}>
                <option value="porcentagem">Porcentagem</option>
                <option value="horas">Horas</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Exibir:</label>
              <select className="input" style={{ fontSize: 13 }} value={exibir} onChange={e => setExibir(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="acima">Acima de 90%</option>
                <option value="abaixo">Abaixo de 90%</option>
              </select>
            </div>
          </div>
          {/* Linha 2: Multi-selects */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
            <MultiSelect label="Classe Operacional" options={options.classeOp}    value={fClasseOp}    onChange={setFClasseOp} />
            <MultiSelect label="Modelo"             options={options.modelo}      value={fModelo}      onChange={setFModelo} />
            <MultiSelect label="Equipamento"        options={options.equipamento} value={fEquipamento} onChange={setFEquipamento} />
            <MultiSelect label="Frente"             options={options.frente}      value={fFrente}      onChange={setFFrente} />
          </div>
          {/* Linha 3: Botões */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn-primary" style={{ padding: '8px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={load}>
              <FunnelIcon style={{ width: 15, height: 15 }} /> Filtrar
            </button>
            {(fClasseOp.length + fModelo.length + fEquipamento.length + fFrente.length) > 0 && (
              <button onClick={() => { setFClasseOp([]); setFModelo([]); setFEquipamento([]); setFFrente([]) }}
                style={{ padding: '8px 14px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Limpar filtros
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Legenda */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', gap: 10 }}>
                <span>Indicadores:</span>
                {[
                  { bg: '#ef4444', label: '0%' },
                  { bg: '#f97316', label: '>0%' },
                  { bg: '#eab308', label: '>=50%', text: '#1a1a1a' },
                  { bg: '#22c55e', label: '>=90%' },
                ].map(c => (
                  <span key={c.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: c.bg, display: 'inline-block' }} />
                    <span style={{ color: 'var(--text-primary)' }}>{c.label}</span>
                  </span>
                ))}
              </div>
              <button onClick={() => handleNew(null, todayISO())} className="btn-primary" style={{ padding: '8px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <PlusIcon style={{ width: 14, height: 14 }} /> Novo Boletim
              </button>
            </div>
          </div>
        </div>

        {/* Navegação de período */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <button onClick={() => shiftPeriod(-1)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ChevronLeftIcon style={{ width: 16, height: 16 }} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {fmtD(days[0]?.iso)} — {fmtD(days[days.length - 1]?.iso)}
          </span>
          <button onClick={() => shiftPeriod(1)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ChevronRightIcon style={{ width: 16, height: 16 }} />
          </button>
          {loading && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Carregando...</span>}
          {!loading && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Foram encontrado(s) <strong style={{ color: 'var(--text-primary)' }}>{filteredRows.length}</strong> registro(s)</span>}
        </div>

        {/* ── Matriz ── */}
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', minWidth: '100%' }}>
            {/* THEAD */}
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                {/* sticky col 1: + */}
                <th style={{ width: 36, padding: '10px 8px', position: 'sticky', left: 0, zIndex: 20, background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)' }} />
                {/* sticky col 2: Modelo */}
                <th style={{ width: STICKY_LEFT_W, padding: '10px 12px', position: 'sticky', left: 36, zIndex: 20, background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' }}>Modelo</th>
                {/* sticky col 3: Equipamento */}
                <th style={{ width: STICKY_COL2_W, padding: '10px 12px', position: 'sticky', left: 36 + STICKY_LEFT_W, zIndex: 20, background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)', borderRight: '2px solid var(--border)', textAlign: 'left', fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' }}>Equip.</th>
                {/* Date cols */}
                {days.map(day => (
                  <th key={day.iso} style={{ width: 90, padding: '6px 4px', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'center', fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                    <div style={{ color: ['SAB', 'DOM'].includes(day.dow) ? '#f59e0b' : 'var(--text-secondary)' }}>{day.dow}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)', opacity: 0.7 }}>({fmtD(day.iso)})</div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* TBODY */}
            <tbody>
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={3 + days.length} style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>⚙️</div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Nenhum boletim encontrado</div>
                    <div style={{ fontSize: 12 }}>Ajuste os filtros ou crie o primeiro boletim.</div>
                  </td>
                </tr>
              )}

              {filteredRows.map((row) => {
                const isOpen = expanded[row.key]
                return (
                  <tr key={row.key} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                    {/* expand button */}
                    <td style={{ width: 36, padding: '6px 8px', position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                      <button onClick={() => setExpanded(p => ({ ...p, [row.key]: !p[row.key] }))}
                        style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900 }}>
                        {isOpen ? '−' : '+'}
                      </button>
                    </td>

                    {/* Modelo */}
                    <td style={{ width: STICKY_LEFT_W, padding: '8px 12px', position: 'sticky', left: 36, zIndex: 10, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: STICKY_LEFT_W }}>
                      {row.modelo}
                      {row.classeOp && <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-secondary)', marginTop: 1 }}>{row.classeOp}</div>}
                    </td>

                    {/* Equipamento */}
                    <td style={{ width: STICKY_COL2_W, padding: '8px 12px', position: 'sticky', left: 36 + STICKY_LEFT_W, zIndex: 10, background: 'var(--bg-card)', borderRight: '2px solid var(--border)', fontWeight: 800, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                      {row.equipamento}
                      {row.frente && <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-secondary)', marginTop: 1 }}>{row.frente}</div>}
                    </td>

                    {/* Date cells */}
                    {days.map(day => {
                      const records = row.cells[day.iso] || []
                      const val = getCellValue(records)
                      const col = val != null ? getCellColor(val) : null
                      const isEmpty = records.length === 0

                      return (
                        <td key={day.iso}
                          onClick={() => openCell(row, day)}
                          style={{ width: 90, padding: '6px 4px', borderRight: '1px solid var(--border)', textAlign: 'center', cursor: 'pointer', background: col ? col.bg : 'transparent', color: col ? col.text : 'var(--text-secondary)', fontWeight: col ? 700 : 400, fontSize: 11, transition: 'filter 0.12s', whiteSpace: 'nowrap' }}
                          title={isEmpty ? `Sem boletim — ${row.equipamento} em ${fmtD(day.iso)}` : `${row.equipamento} em ${fmtD(day.iso)}: ${fmtCellValue(val)}`}
                          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.12)'}
                          onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                          {isEmpty ? <span style={{ fontSize: 10, opacity: 0.3 }}>—</span> : fmtCellValue(val)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Overlay backdrop para painel ── */}
      {panel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 799, background: 'rgba(0,0,0,0.3)' }} onClick={() => setPanel(null)} />
      )}

      {/* ── Painel lateral ── */}
      {panel && (
        <BoletimPanel
          records={panel.records}
          equipKey={panel.equipKey}
          date={panel.date}
          onClose={() => setPanel(null)}
          onEdit={handleEdit}
          onNew={() => handleNew(panel.row, panel.date)}
        />
      )}

      {/* ── Modal criar / editar boletim ── */}
      {editRec && (
        <BoletimModal
          boletim={editRec._new ? null : editRec}
          workspaceId={workspaceId}
          ownerId={ownerId}
          onClose={() => setEditRec(null)}
          onSaved={() => { setEditRec(null); load() }}
        />
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}
