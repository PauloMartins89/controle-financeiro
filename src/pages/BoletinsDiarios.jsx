import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  ChevronDownIcon, ChevronRightIcon, CheckCircleIcon,
  XMarkIcon, PencilSquareIcon, ArrowPathIcon, PhotoIcon,
  ClipboardDocumentListIcon, UserGroupIcon, TruckIcon,
  WrenchScrewdriverIcon, BuildingOffice2Icon, ClockIcon,
  MagnifyingGlassIcon, FunnelIcon, CurrencyDollarIcon,
} from '@heroicons/react/24/outline'

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function fmtDt(iso) {
  if (!iso) return '—'
  const dt = new Date(iso)
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_CONF = {
  pendente:             { label: 'Pendente',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  aprovado:             { label: 'Aprovado',       color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  aguardando_aprovacao: { label: 'Ag. Aprovação',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  reprovado:            { label: 'Reprovado',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  rascunho:             { label: 'Rascunho',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
}

function StatusBadge({ status }) {
  const c = STATUS_CONF[status] || STATUS_CONF.rascunho
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: c.bg, color: c.color, border: `1px solid ${c.color}40`,
    }}>
      {c.label}
    </span>
  )
}

// ─── Photo Lightbox ───────────────────────────────────────────────────────────
function PhotoLightbox({ url }) {
  const [open, setOpen] = useState(false)
  if (!url) return null
  return (
    <>
      <button
        title="Ver boletim original"
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: 'rgba(6,182,212,0.1)', color: '#06b6d4',
          border: '1px solid rgba(6,182,212,0.3)', cursor: 'pointer',
        }}
      >
        <PhotoIcon style={{ width: 13, height: 13 }} /> Ver foto
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
            <img
              src={url} alt="Boletim"
              style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
            />
            <button
              onClick={() => setOpen(false)}
              style={{
                position: 'absolute', top: -12, right: -12,
                width: 32, height: 32, borderRadius: '50%',
                background: '#ef4444', border: 'none', cursor: 'pointer',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <XMarkIcon style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ lancamento, onClose, onSaved }) {
  const [valor, setValor] = useState(String(lancamento.valor || ''))
  const [descricao, setDescricao] = useState(lancamento.descricao || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const valorNum = parseFloat(String(valor).replace(',', '.')) || 0
    const { error } = await supabase
      .from('lancamentos')
      .update({ valor: valorNum, descricao })
      .eq('id', lancamento.id)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    toast.success('Salvo!')
    onSaved({ ...lancamento, valor: valorNum, descricao })
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', borderRadius: 16,
          border: '1px solid var(--border)',
          padding: 24, width: 420, maxWidth: '95vw',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Editar Lançamento</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <XMarkIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Valor (R$)</span>
          <input
            type="number" step="0.01" min="0"
            value={valor}
            onChange={e => setValor(e.target.value)}
            style={{
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
              fontSize: 15, fontWeight: 700,
            }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Descrição</span>
          <input
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            style={{
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', color: 'var(--text)', fontSize: 13,
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >Cancelar</button>
          <button
            onClick={save} disabled={saving}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: '#6366f1', border: 'none',
              color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── OCR Field Row ────────────────────────────────────────────────────────────
function OcrField({ icon: Icon, label, value, color = '#94a3b8' }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon style={{ width: 14, height: 14, color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
          {value}
        </div>
      </div>
    </div>
  )
}

// ─── Lancamento Card ──────────────────────────────────────────────────────────
function LancamentoCard({ lancamento: lanc, onApprove, onReject, onEdit, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)

  const ocr = lanc.dados_extras?.ocr || {}
  const camposPendentes = lanc.dados_extras?.campos_pendentes
  const titulo = ocr.equipamento
    ? `${ocr.equipamento}${ocr.empresa ? ` — ${ocr.empresa}` : ''}`
    : lanc.descricao

  async function aprovar() {
    setBusy(true)
    const { error } = await supabase
      .from('lancamentos')
      .update({ status: 'aprovado' })
      .eq('id', lanc.id)
    setBusy(false)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Lançamento aprovado!')
    onUpdate({ ...lanc, status: 'aprovado' })
  }

  async function reprovar() {
    setBusy(true)
    const { error } = await supabase
      .from('lancamentos')
      .update({ status: 'reprovado' })
      .eq('id', lanc.id)
    setBusy(false)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Lançamento reprovado.')
    onUpdate({ ...lanc, status: 'reprovado' })
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${
        lanc.status === 'aprovado' ? '#10b981' :
        lanc.status === 'reprovado' ? '#ef4444' :
        camposPendentes ? '#f59e0b' : '#6366f1'
      }`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'box-shadow 0.15s',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {expanded
          ? <ChevronDownIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)', flexShrink: 0 }} />
          : <ChevronRightIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)', flexShrink: 0 }} />
        }

        <ClipboardDocumentListIcon style={{ width: 16, height: 16, color: '#818cf8', flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700, fontSize: 13, color: 'var(--text)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {titulo}
          </div>
          {ocr.servico_executado && (
            <div style={{
              fontSize: 11, color: 'var(--text-secondary)', marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {ocr.servico_executado}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{fmtDate(lanc.data)}</span>
          {camposPendentes && !expanded && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
              background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.3)',
            }}>⚠ Revisar</span>
          )}
          <StatusBadge status={lanc.status} />
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{
          padding: '0 16px 16px 42px',
          borderTop: '1px solid var(--border)',
          paddingTop: 14,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* OCR fields grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
          }}>
            <OcrField icon={WrenchScrewdriverIcon} label="Equipamento"     value={ocr.equipamento}      color="#34d399" />
            <OcrField icon={BuildingOffice2Icon}   label="Empresa"          value={ocr.empresa}          color="#60a5fa" />
            <OcrField icon={TruckIcon}             label="Veículo / Placa"  value={ocr.veiculo_placa}    color="#fb923c" />
            <OcrField icon={UserGroupIcon}         label="Equipe Diurna"    value={ocr.equipe_diurna}    color="#a78bfa" />
            <OcrField icon={UserGroupIcon}         label="Equipe Noturna"   value={ocr.equipe_noturna}   color="#818cf8" />
            <OcrField icon={ClipboardDocumentListIcon} label="Serviço"      value={ocr.servico_executado} color="#6366f1" />
            <OcrField icon={ClipboardDocumentListIcon} label="Observações"  value={ocr.observacoes}      color="#94a3b8" />
          </div>

          {/* Valor + criação */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--bg-hover)',
          }}>
            <CurrencyDollarIcon style={{ width: 16, height: 16, color: '#10b981', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Valor</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: lanc.valor > 0 ? '#10b981' : '#f59e0b' }}>
                {fmtCurrency(lanc.valor)}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
              <div>Criado em</div>
              <div>{fmtDt(lanc.created_at)}</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <PhotoLightbox url={lanc.comprovante_url} />

            <button
              onClick={() => onEdit(lanc)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'rgba(99,102,241,0.1)', color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.3)', cursor: 'pointer',
              }}
            >
              <PencilSquareIcon style={{ width: 13, height: 13 }} /> Editar
            </button>

            {lanc.status !== 'aprovado' && (
              <button
                onClick={aprovar} disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: 'rgba(16,185,129,0.12)', color: '#10b981',
                  border: '1px solid rgba(16,185,129,0.3)',
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
                }}
              >
                <CheckCircleIcon style={{ width: 13, height: 13 }} /> Aprovar
              </button>
            )}

            {lanc.status !== 'reprovado' && lanc.status !== 'aprovado' && (
              <button
                onClick={reprovar} disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.25)',
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
                }}
              >
                <XMarkIcon style={{ width: 13, height: 13 }} /> Reprovar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BoletinsDiarios() {
  const workspaceId = useStore(s => s.workspaceId)

  const [lancamentos, setLancamentos] = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filtroStatus, setFiltroStatus] = useState('pendente')
  const [editItem, setEditItem]       = useState(null)

  async function load() {
    if (!workspaceId) return
    setLoading(true)
    let q = supabase
      .from('lancamentos')
      .select('id, descricao, valor, data, status, tipo_formulario, dados_extras, comprovante_url, created_at')
      .eq('workspace_id', workspaceId)
      .eq('tipo_formulario', 'diario')
      .order('created_at', { ascending: false })
    if (filtroStatus !== 'todos') {
      q = q.eq('status', filtroStatus)
    }
    const { data, error } = await q
    if (error) { toast.error('Erro ao carregar: ' + error.message) }
    setLancamentos(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [workspaceId, filtroStatus])

  function handleUpdate(updated) {
    setLancamentos(prev => prev.map(l => l.id === updated.id ? updated : l))
  }

  const filtered = lancamentos.filter(l => {
    if (!search.trim()) return true
    const ocr = l.dados_extras?.ocr || {}
    const hay = [l.descricao, ocr.equipamento, ocr.empresa, ocr.veiculo_placa,
                 ocr.equipe_diurna, ocr.equipe_noturna, ocr.servico_executado]
      .filter(Boolean).join(' ').toLowerCase()
    return hay.includes(search.toLowerCase())
  })

  const counts = {
    pendente: lancamentos.filter(l => l.status === 'pendente' || l.status === 'aguardando_aprovacao').length,
    aprovado: lancamentos.filter(l => l.status === 'aprovado').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header title="Boletins Diários" subtitle="Revisão de OCR via WhatsApp" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px' }}>

        {/* KPI strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Pendentes',  value: counts.pendente, color: '#f59e0b' },
            { label: 'Aprovados',  value: counts.aprovado, color: '#10b981' },
            { label: 'Total',      value: lancamentos.length, color: '#818cf8' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              flex: '1 1 120px', minWidth: 120,
              background: 'var(--bg-card)', borderRadius: 10,
              border: `1px solid ${kpi.color}28`,
              borderTop: `3px solid ${kpi.color}`,
              padding: '12px 16px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{
            flex: '1 1 200px', position: 'relative', display: 'flex', alignItems: 'center',
          }}>
            <MagnifyingGlassIcon style={{
              width: 14, height: 14, position: 'absolute', left: 10,
              color: 'var(--text-secondary)', pointerEvents: 'none',
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por equipamento, empresa, placa…"
              style={{
                width: '100%', padding: '7px 12px 7px 30px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text)', fontSize: 12,
              }}
            />
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {[
              { key: 'pendente', label: 'Pendentes' },
              { key: 'aprovado', label: 'Aprovados' },
              { key: 'todos',    label: 'Todos'     },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setFiltroStatus(opt.key)}
                style={{
                  padding: '7px 14px', fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: filtroStatus === opt.key ? '#6366f1' : 'var(--bg-card)',
                  color: filtroStatus === opt.key ? '#fff' : 'var(--text-secondary)',
                  transition: 'background 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={load}
            title="Atualizar"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            <ArrowPathIcon style={{ width: 13, height: 13 }} /> Atualizar
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
            <ArrowPathIcon style={{ width: 24, height: 24, margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
            <div>Carregando…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            color: 'var(--text-secondary)', fontSize: 14,
          }}>
            <ClipboardDocumentListIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
            <div>
              {search
                ? 'Nenhum resultado para a busca.'
                : filtroStatus === 'pendente'
                  ? 'Nenhum boletim pendente de revisão.'
                  : 'Nenhum boletim encontrado.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(l => (
              <LancamentoCard
                key={l.id}
                lancamento={l}
                onEdit={setEditItem}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editItem && (
        <EditModal
          lancamento={editItem}
          onClose={() => setEditItem(null)}
          onSaved={handleUpdate}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
