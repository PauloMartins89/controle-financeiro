import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import {
  PlusIcon, MagnifyingGlassIcon, XMarkIcon, CheckCircleIcon,
  ExclamationCircleIcon, ClockIcon, PencilIcon, TrashIcon,
  BanknotesIcon, CalendarDaysIcon, ArrowPathIcon, DevicePhoneMobileIcon,
  EyeIcon, NoSymbolIcon, ChevronDownIcon, ChevronRightIcon,
  TruckIcon, UserIcon, IdentificationIcon, ShoppingCartIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}
function todayISO() {
  return new Date().toISOString().split('T')[0]
}

// Calcula o status visual de qualquer item (contas_pagar ou lancamento normalizado)
function calcStatus(item) {
  if (item.status === 'pago') return 'pago'
  const refDate = item.vencimento || item.data
  if (refDate && refDate < todayISO()) return 'vencido'
  return 'pendente'
}

// Normaliza um lancamento (WhatsApp) para o formato unificado
function normalizeLancamento(l) {
  const extras = l.dados_extras || {}
  return {
    _source:         'whatsapp',
    _original:       l,
    id:              l.id,
    descricao:       l.descricao || extras.descricao || 'Lançamento via WhatsApp',
    fornecedor:      extras.fornecedor || extras.empresa || extras.estabelecimento || null,
    categoria:       l.categoria || extras.categoria || null,
    valor:           l.valor || 0,
    vencimento:      null,
    data:            l.data || null,
    data_pagamento:  null,
    status:          l.status === 'pago' ? 'pago' : 'pendente',
    observacoes:     l.observacoes || extras.observacoes || null,
    tipo_formulario: l.tipo_formulario || null,
    created_at:      l.created_at,
  }
}

const STATUS_CFG = {
  pago:     { label: 'Pago',     color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircleIcon },
  pendente: { label: 'Pendente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: ClockIcon },
  vencido:  { label: 'Vencido',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: ExclamationCircleIcon },
}

const CATEGORIAS = [
  'Aluguel', 'Combustível', 'Folha de Pagamento', 'Fornecedor',
  'Impostos', 'Manutenção', 'Serviços', 'Telefone / Internet',
  'Transporte', 'Outros',
]

const EMPTY_FORM = {
  descricao: '', fornecedor: '', categoria: '', valor: '',
  vencimento: '', observacoes: '',
}

// ─── Estilos compartilhados ───────────────────────────────────────────────────
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: 0.5, marginBottom: 5,
}
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1px solid var(--border)', background: 'var(--bg-primary)',
  color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', outline: 'none',
}

// ─── Modal de Criação / Edição (apenas entradas manuais) ─────────────────────
function ContaModal({ conta, onClose, onSave }) {
  const isEdit = !!conta?.id
  const [form, setForm] = useState(
    conta
      ? { ...conta, valor: conta.valor ? String(conta.valor).replace('.', ',') : '' }
      : { ...EMPTY_FORM, vencimento: todayISO() }
  )
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.descricao.trim())  { toast.error('Informe a descrição'); return }
    if (!form.vencimento)        { toast.error('Informe o vencimento'); return }
    const valorNum = parseFloat(String(form.valor).replace(/\./g, '').replace(',', '.'))
    if (!form.valor || isNaN(valorNum) || valorNum <= 0) { toast.error('Informe um valor válido'); return }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        descricao:   form.descricao.trim(),
        fornecedor:  form.fornecedor?.trim() || null,
        categoria:   form.categoria || null,
        valor:       valorNum,
        vencimento:  form.vencimento,
        observacoes: form.observacoes?.trim() || null,
        status:      form.status || 'pendente',
        user_id:     user?.id,
      }

      let result
      if (isEdit) {
        result = await supabase.from('contas_pagar')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', conta.id).select().single()
      } else {
        result = await supabase.from('contas_pagar').insert(payload).select().single()
      }

      if (result.error) throw result.error
      toast.success(isEdit ? 'Conta atualizada!' : 'Conta cadastrada!')
      onSave({ ...result.data, _source: 'manual' }, isEdit)
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar conta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 540, border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BanknotesIcon style={{ width: 18, height: 18, color: '#ef4444' }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {isEdit ? 'Editar Conta' : 'Nova Conta a Pagar'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Descrição *</label>
            <input value={form.descricao} onChange={e => set('descricao', e.target.value)}
              placeholder="Ex: Aluguel galpão Maio" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Fornecedor</label>
              <input value={form.fornecedor} onChange={e => set('fornecedor', e.target.value)}
                placeholder="Nome do fornecedor" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Categoria</label>
              <select value={form.categoria} onChange={e => set('categoria', e.target.value)} style={inputStyle}>
                <option value="">Selecionar...</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Valor *</label>
              <input value={form.valor} onChange={e => set('valor', e.target.value)}
                placeholder="0,00" style={{ ...inputStyle, fontWeight: 700 }} />
            </div>
            <div>
              <label style={labelStyle}>Vencimento *</label>
              <input type="date" value={form.vencimento} onChange={e => set('vencimento', e.target.value)}
                style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Observações</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
              rows={2} placeholder="Notas adicionais..." style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: saving ? '#555' : '#ef4444', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
            {saving ? <ArrowPathIcon style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> : null}
            {saving ? 'Salvando...' : (isEdit ? 'Salvar alterações' : 'Cadastrar conta')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal confirmar pagamento ────────────────────────────────────────────────
function MarcarPagoModal({ conta, onClose, onConfirm }) {
  const [dataPagamento, setDataPagamento] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    setSaving(true)
    try {
      if (conta._source === 'whatsapp') {
        const { data, error } = await supabase.from('lancamentos')
          .update({ status: 'pago' })
          .eq('id', conta.id).select().single()
        if (error) throw error
        toast.success('Lançamento marcado como pago!')
        onConfirm(normalizeLancamento({ ...data, status: 'pago' }))
      } else {
        const { data, error } = await supabase.from('contas_pagar')
          .update({ status: 'pago', data_pagamento: dataPagamento, updated_at: new Date().toISOString() })
          .eq('id', conta.id).select().single()
        if (error) throw error
        // Se for compra, marca a solicitação como paga também
        if (conta._source === 'compras' && conta.solicitacao_id) {
          await supabase.from('solicitacoes_compra')
            .update({ status: 'pago', data_pagamento: dataPagamento })
            .eq('id', conta.solicitacao_id)
        }
        toast.success('Conta marcada como paga!')
        onConfirm({ ...data, _source: conta._source, solicitacao: conta.solicitacao })
      }
    } catch (e) {
      console.error(e)
      toast.error('Erro ao registrar pagamento')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 420, border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircleIcon style={{ width: 24, height: 24, color: '#10b981' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Confirmar Pagamento</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{conta.descricao}</div>
          </div>
        </div>

        {conta._source === 'whatsapp' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', marginBottom: 14 }}>
            <DevicePhoneMobileIcon style={{ width: 14, height: 14, color: '#25d366', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#25d366', fontWeight: 600 }}>Status será atualizado também em Lançamentos</span>
          </div>
        )}

        <div style={{ marginBottom: 8, fontSize: 18, fontWeight: 800, color: '#10b981' }}>{fmtCurrency(conta.valor)}</div>

        {conta._source !== 'whatsapp' && (
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Data do pagamento</label>
            <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} style={inputStyle} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving}
            style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: saving ? '#555' : '#10b981', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700 }}>
            {saving ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Badge Status ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pendente
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <Icon style={{ width: 12, height: 12 }} />
      {cfg.label}
    </span>
  )
}

// ─── Modal de Detalhes ───────────────────────────────────────────────────────
function DetalhesModal({ item, onClose }) {
  const [jsonAberto, setJsonAberto] = useState(false)
  const extras = item._original?.dados_extras || item.dados_extras || {}
  const realStatus = calcStatus(item)

  const Row = ({ label, value, color }) => value ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0, marginRight: 12 }}>{label}</span>
      <span style={{ fontSize: 13, color: color || 'var(--text-primary)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  ) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 560, border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SourceBadge source={item._source} />
            <StatusBadge status={realStatus} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Valor em destaque */}
        <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: realStatus === 'pago' ? '#10b981' : realStatus === 'vencido' ? '#ef4444' : 'var(--text-primary)' }}>
            {fmtCurrency(item.valor)}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{item.descricao}</div>
        </div>

        {/* Corpo scrollável */}
        <div style={{ overflowY: 'auto', padding: '12px 24px 20px', flex: 1 }}>

          {/* Dados principais */}
          <Row label="Fornecedor"    value={item.fornecedor} />
          <Row label="Categoria"     value={item.categoria} />
          <Row label="Data / Venc." value={fmtDate(item.vencimento || item.data)} />
          {item.data_pagamento && <Row label="Pago em" value={fmtDate(item.data_pagamento)} color="#10b981" />}
          {item.forma_pagamento && <Row label="Forma Pgto" value={item.forma_pagamento} />}
          {item.observacoes && <Row label="Observações" value={item.observacoes} />}

          {/* Bloco Compras */}
          {item._source === 'compras' && item.solicitacao && (
            <>
              <div style={{ margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShoppingCartIcon style={{ width: 14, height: 14, color: '#f59e0b' }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Dados da Requisição de Compra</span>
              </div>
              {item.solicitacao.urgencia && (
                <Row label="Urgência"
                  value={{ baixa: '🟢 Baixa', media: '🟡 Média', alta: '🔴 ALTA' }[item.solicitacao.urgencia] || item.solicitacao.urgencia}
                  color={item.solicitacao.urgencia === 'alta' ? '#ef4444' : undefined}
                />
              )}
              {item.solicitacao.quantidade       && <Row label="Quantidade"        value={item.solicitacao.quantidade} />}
              {item.solicitacao.requisitante_nome && <Row label="Solicitante"       value={item.solicitacao.requisitante_nome} />}
              {item.solicitacao.data_necessidade  && <Row label="Data necessidade"  value={fmtDate(item.solicitacao.data_necessidade)} />}
              {item.solicitacao.descricao         && <Row label="Detalhamento"      value={item.solicitacao.descricao} />}

              {item.solicitacao.comprovante_url && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Imagem da Requisição</div>
                  <a href={item.solicitacao.comprovante_url} target="_blank" rel="noreferrer">
                    <img
                      src={item.solicitacao.comprovante_url}
                      alt="Imagem da requisição"
                      style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)', maxHeight: 320, objectFit: 'contain', background: 'rgba(0,0,0,0.3)', cursor: 'zoom-in' }}
                    />
                    <div style={{ fontSize: 11, color: '#818cf8', marginTop: 4, textAlign: 'center' }}>Clique para abrir em tamanho completo ↗</div>
                  </a>
                </div>
              )}
            </>
          )}

          {/* Bloco WhatsApp */}
          {item._source === 'whatsapp' && (
            <>
              <div style={{ margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <DevicePhoneMobileIcon style={{ width: 14, height: 14, color: '#25d366' }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#25d366', textTransform: 'uppercase', letterSpacing: 0.5 }}>Dados do Formulário OCR</span>
              </div>

              {item.tipo_formulario && <Row label="Tipo formulário" value={item.tipo_formulario} />}
              {extras.motorista    && <Row label="Motorista"       value={extras.motorista} />}
              {extras.placa        && <Row label="Placa"           value={extras.placa} />}
              {extras.numero_diario && <Row label="Nº Diário"      value={extras.numero_diario} />}
              {extras.empresa      && <Row label="Empresa"         value={extras.empresa} />}
              {extras.solicitante  && <Row label="Solicitante"     value={extras.solicitante} />}
              {extras.km_inicial != null && <Row label="KM Inicial" value={String(extras.km_inicial)} />}
              {extras.km_final   != null && <Row label="KM Final"   value={String(extras.km_final)} />}
              {extras.local_origem  && <Row label="Origem"  value={extras.local_origem} />}
              {extras.local_destino && <Row label="Destino" value={extras.local_destino} />}

              {/* JSON expansível */}
              {Object.keys(extras).length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <button onClick={() => setJsonAberto(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>
                    {jsonAberto
                      ? <ChevronDownIcon style={{ width: 13, height: 13 }} />
                      : <ChevronRightIcon style={{ width: 13, height: 13 }} />}
                    Dados extraídos pela IA
                  </button>
                  {jsonAberto && (
                    <pre style={{ marginTop: 8, padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', fontSize: 11, color: '#94a3b8', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify(extras, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '9px 22px', borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Badge Fonte ──────────────────────────────────────────────────────────────
function SourceBadge({ source }) {
  if (source === 'whatsapp') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, background: 'rgba(37,211,102,0.1)', color: '#25d366', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid rgba(37,211,102,0.2)' }}>
        <DevicePhoneMobileIcon style={{ width: 10, height: 10 }} />
        WhatsApp
      </span>
    )
  }
  if (source === 'compras') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid rgba(245,158,11,0.2)' }}>
        <ShoppingCartIcon style={{ width: 10, height: 10 }} />
        Compras
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid rgba(99,102,241,0.2)' }}>
      Manual
    </span>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ContasPagar() {
  const [contas,       setContas]       = useState([])  // contas_pagar (manual)
  const [lancamentos,  setLancamentos]  = useState([])  // lancamentos tipo=despesa (whatsapp)
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterFonte,  setFilterFonte]  = useState('todos')
  const [filterMes,    setFilterMes]    = useState('')
  const [modal,        setModal]        = useState(null)
  const [pagoModal,    setPagoModal]    = useState(null)
  const [detalhesModal,setDetalhesModal]= useState(null)
  const [deletingId,   setDeletingId]   = useState(null)
  const [reprovandoId, setReprovandoId] = useState(null)

  // ── Carrega as duas fontes em paralelo ────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [resContas, resLanc] = await Promise.all([
        supabase.from('contas_pagar').select('*, solicitacao:solicitacoes_compra(id,titulo,descricao,urgencia,quantidade,requisitante_nome,data_necessidade,comprovante_url)').order('vencimento', { ascending: true }),
        supabase.from('lancamentos')
          .select('*')
          .eq('tipo', 'despesa')
          .neq('status', 'reprovado')
          .order('data', { ascending: false }),
      ])
      if (resContas.error) throw resContas.error
      setContas(resContas.data || [])
      setLancamentos(resLanc.data || [])
    } catch (e) {
      console.error(e)
      toast.error('Erro ao carregar contas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Lista unificada (ordena por data de referência) ───────────────────────
  const allItems = [
    ...contas.map(c => ({ ...c, _source: c.solicitacao_id ? 'compras' : 'manual' })),
    ...lancamentos.map(normalizeLancamento),
  ].sort((a, b) => {
    const da = a.vencimento || a.data || ''
    const db = b.vencimento || b.data || ''
    return da.localeCompare(db)
  })

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filtered = allItems.filter(c => {
    const realStatus = calcStatus(c)
    if (filterStatus !== 'todos' && realStatus !== filterStatus) return false
    if (filterFonte  !== 'todos' && c._source !== filterFonte)   return false
    const refDate = c.vencimento || c.data || ''
    if (filterMes && !refDate.startsWith(filterMes)) return false
    if (search) {
      const q = search.toLowerCase()
      const extras = c._original?.dados_extras || c.dados_extras || {}
      return (c.descricao         || '').toLowerCase().includes(q)
          || (c.fornecedor        || '').toLowerCase().includes(q)
          || (c.categoria         || '').toLowerCase().includes(q)
          || (extras.placa        || '').toLowerCase().includes(q)
          || (extras.motorista    || '').toLowerCase().includes(q)
          || (extras.numero_diario|| '').toString().toLowerCase().includes(q)
          || (extras.empresa      || '').toLowerCase().includes(q)
    }
    return true
  })

  // ── Totais ────────────────────────────────────────────────────────────────
  const pendentes = allItems.filter(c => calcStatus(c) === 'pendente').reduce((s, c) => s + (c.valor || 0), 0)
  const vencidos  = allItems.filter(c => calcStatus(c) === 'vencido') .reduce((s, c) => s + (c.valor || 0), 0)
  const hojeISO   = todayISO()
  const mesAtual  = hojeISO.slice(0, 7)
  const mesPago   = allItems.filter(c => {
    if (c.status !== 'pago') return false
    const ref = c.data_pagamento || c.vencimento || c.data || ''
    return ref.startsWith(mesAtual)
  }).reduce((s, c) => s + (c.valor || 0), 0)

  const totalFiltrado = filtered.reduce((s, c) => s + (c.valor || 0), 0)

  // ── Handlers ──────────────────────────────────────────────────────────────
  function onSaveConta(data, isEdit) {
    setContas(prev => isEdit
      ? prev.map(c => c.id === data.id ? data : c)
      : [...prev, data]
    )
    setModal(null)
  }

  function onConfirmPago(updatedItem) {
    if (updatedItem._source === 'whatsapp') {
      setLancamentos(prev => prev.map(l => l.id === updatedItem.id ? { ...l, status: 'pago' } : l))
    } else {
      setContas(prev => prev.map(c => c.id === updatedItem.id ? updatedItem : c))
    }
    setPagoModal(null)
  }

  async function handleDesfazerPago(item) {
    try {
      if (item._source === 'whatsapp') {
        const { error } = await supabase.from('lancamentos')
          .update({ status: 'pendente' }).eq('id', item.id)
        if (error) throw error
        setLancamentos(prev => prev.map(l => l.id === item.id ? { ...l, status: 'pendente' } : l))
      } else {
        const { data, error } = await supabase.from('contas_pagar')
          .update({ status: 'pendente', data_pagamento: null, updated_at: new Date().toISOString() })
          .eq('id', item.id).select().single()
        if (error) throw error
        // Se for compra, reverte status da solicitação
        if (item._source === 'compras' && item.solicitacao_id) {
          await supabase.from('solicitacoes_compra')
            .update({ status: 'pedido_emitido', data_pagamento: null })
            .eq('id', item.solicitacao_id)
        }
        setContas(prev => prev.map(c => c.id === data.id ? { ...data, solicitacao: c.solicitacao } : c))
      }
      toast.success('Pagamento desfeito')
    } catch {
      toast.error('Erro ao desfazer pagamento')
    }
  }

  async function handleRejectWhatsapp(item) {
    if (!window.confirm('Reprovar este lançamento do WhatsApp? Ele será marcado como reprovado e sairá da lista.')) return
    setReprovandoId(item.id)
    try {
      const { error } = await supabase.from('lancamentos')
        .update({ status: 'reprovado' })
        .eq('id', item.id)
      if (error) throw error
      setLancamentos(prev => prev.filter(l => l.id !== item.id))
      toast.success('Lançamento reprovado')
    } catch {
      toast.error('Erro ao reprovar lançamento')
    } finally {
      setReprovandoId(null)
    }
  }

  async function handleDelete(item) {
    if (item._source === 'whatsapp') {
      toast.error('Entradas do WhatsApp não podem ser excluídas aqui. Use a tela de Lançamentos.')
      return
    }
    if (!window.confirm('Excluir esta conta?')) return
    setDeletingId(item.id)
    try {
      const { error } = await supabase.from('contas_pagar').delete().eq('id', item.id)
      if (error) throw error
      setContas(prev => prev.filter(c => c.id !== item.id))
      toast.success('Conta excluída')
    } catch {
      toast.error('Erro ao excluir')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Meses para filtro ─────────────────────────────────────────────────────
  const meses = [...new Set(
    allItems.map(c => (c.vencimento || c.data || '').slice(0, 7)).filter(Boolean)
  )].sort()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header title="Contas a Pagar" subtitle="Controle de pagamentos e vencimentos" />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px' }}>

        {/* Cards resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Pendentes',    value: fmtCurrency(pendentes),              color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',    icon: ClockIcon },
            { label: 'Vencidos',     value: fmtCurrency(vencidos),               color: '#ef4444', bg: 'rgba(239,68,68,0.1)',     icon: ExclamationCircleIcon },
            { label: 'Pago no Mês',  value: fmtCurrency(mesPago),                color: '#10b981', bg: 'rgba(16,185,129,0.1)',    icon: CheckCircleIcon },
            { label: 'Via WhatsApp', value: lancamentos.length + ' lançamentos', color: '#25d366', bg: 'rgba(37,211,102,0.1)',    icon: DevicePhoneMobileIcon },
          ].map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--shadow-card)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 22, height: 22, color: card.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{card.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: card.color, marginTop: 2 }}>{card.value}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Barra de ações */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-secondary)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por descrição, fornecedor..."
              style={{ ...inputStyle, paddingLeft: 34 }} />
          </div>

          <select value={filterFonte} onChange={e => setFilterFonte(e.target.value)}
            style={{ ...inputStyle, width: 'auto', paddingLeft: 12 }}>
            <option value="todos">Todas as fontes</option>
            <option value="manual">Manual</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="compras">Compras</option>
          </select>

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ ...inputStyle, width: 'auto', paddingLeft: 12 }}>
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendentes</option>
            <option value="vencido">Vencidos</option>
            <option value="pago">Pagos</option>
          </select>

          <select value={filterMes} onChange={e => setFilterMes(e.target.value)}
            style={{ ...inputStyle, width: 'auto', paddingLeft: 12 }}>
            <option value="">Todos os meses</option>
            {meses.map(m => {
              const [ano, mes] = m.split('-')
              const label = new Date(+ano, +mes - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
              return <option key={m} value={m}>{label}</option>
            })}
          </select>

          <button onClick={() => setModal('new')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
            <PlusIcon style={{ width: 16, height: 16 }} />
            Nova Conta
          </button>

          <button onClick={load} title="Atualizar"
            style={{ padding: '9px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Tabela */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
              <ArrowPathIcon style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <div>Carregando...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <BanknotesIcon style={{ width: 40, height: 40, color: 'var(--text-secondary)', margin: '0 auto 12px', opacity: 0.4 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {allItems.length === 0 ? 'Nenhuma conta cadastrada' : 'Nenhum item com esses filtros'}
              </div>
              {allItems.length === 0 && (
                <button onClick={() => setModal('new')}
                  style={{ marginTop: 16, padding: '9px 20px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                  + Cadastrar primeira conta
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                      {['FONTE', 'DESCRIÇÃO', 'FORNECEDOR', 'CATEGORIA', 'DATA / VENC.', 'VALOR', 'STATUS', 'AÇÕES'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: h === 'VALOR' ? 'right' : h === 'AÇÕES' ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, i) => {
                      const realStatus = calcStatus(item)
                      const isVencido  = realStatus === 'vencido'
                      const isPago     = realStatus === 'pago'
                      const refDate    = item.vencimento || item.data
                      return (
                        <tr key={`${item._source}-${item.id}`}
                          style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', opacity: isPago ? 0.65 : 1 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            <SourceBadge source={item._source} />
                          </td>

                          <td style={{ padding: '11px 14px', maxWidth: 200 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isPago ? 'line-through' : 'none' }}>
                              {item.descricao}
                            </div>
                            {item.observacoes && (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.observacoes}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {item.fornecedor || '—'}
                          </td>

                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            {item.categoria
                              ? <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>{item.categoria}</span>
                              : <span style={{ color: 'var(--text-secondary)' }}>—</span>
                            }
                          </td>

                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: isVencido ? '#ef4444' : 'var(--text-secondary)', fontWeight: isVencido ? 700 : 400 }}>
                              <CalendarDaysIcon style={{ width: 13, height: 13 }} />
                              {fmtDate(refDate)}
                            </div>
                            {isPago && item.data_pagamento && (
                              <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>Pago em {fmtDate(item.data_pagamento)}</div>
                            )}
                            {item._source === 'whatsapp' && (
                              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1, opacity: 0.55 }}>data entrada</div>
                            )}
                          </td>

                          <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: isVencido ? '#ef4444' : isPago ? '#10b981' : 'var(--text-primary)', whiteSpace: 'nowrap', fontSize: 14 }}>
                            {fmtCurrency(item.valor)}
                          </td>

                          <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                            <StatusBadge status={realStatus} />
                          </td>

                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', alignItems: 'center' }}>
                              {/* Ver detalhes */}
                              <button title="Ver detalhes" onClick={() => setDetalhesModal(item)}
                                style={{ padding: 6, borderRadius: 8, background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                <EyeIcon style={{ width: 15, height: 15 }} />
                              </button>

                              {!isPago ? (
                                <button title="Marcar como pago" onClick={() => setPagoModal(item)}
                                  style={{ padding: 6, borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer', color: '#10b981', display: 'flex', alignItems: 'center' }}>
                                  <CheckCircleSolid style={{ width: 15, height: 15 }} />
                                </button>
                              ) : (
                                <button title="Desfazer pagamento" onClick={() => handleDesfazerPago(item)}
                                  style={{ padding: 6, borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', cursor: 'pointer', color: '#f59e0b', display: 'flex', alignItems: 'center' }}>
                                  <ArrowPathIcon style={{ width: 15, height: 15 }} />
                                </button>
                              )}

                              {item._source === 'manual' && (
                                <button title="Editar" onClick={() => setModal(item)}
                                  style={{ padding: 6, borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center' }}>
                                  <PencilIcon style={{ width: 15, height: 15 }} />
                                </button>
                              )}

                              {item._source === 'manual' ? (
                                <button title="Excluir" disabled={deletingId === item.id} onClick={() => handleDelete(item)}
                                  style={{ padding: 6, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', opacity: deletingId === item.id ? 0.5 : 1 }}>
                                  <TrashIcon style={{ width: 15, height: 15 }} />
                                </button>
                              ) : item._source === 'whatsapp' ? (
                                <button
                                  title="Reprovar lançamento"
                                  disabled={reprovandoId === item.id || realStatus === 'pago'}
                                  onClick={() => handleRejectWhatsapp(item)}
                                  style={{ padding: 6, borderRadius: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', cursor: reprovandoId === item.id || realStatus === 'pago' ? 'not-allowed' : 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', opacity: realStatus === 'pago' ? 0.3 : 1 }}>
                                  <NoSymbolIcon style={{ width: 15, height: 15 }} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Rodapé */}
              <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {filtered.length} item(s) —&nbsp;
                  <span style={{ color: '#25d366' }}>{filtered.filter(c => c._source === 'whatsapp').length} WhatsApp</span>
                  &nbsp;/&nbsp;
                  <span style={{ color: '#818cf8' }}>{filtered.filter(c => c._source === 'manual').length} manual</span>
                  &nbsp;/&nbsp;
                  <span style={{ color: '#f59e0b' }}>{filtered.filter(c => c._source === 'compras').length} compras</span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Total: <span style={{ color: '#ef4444' }}>{fmtCurrency(totalFiltrado)}</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {modal && (
        <ContaModal
          conta={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={onSaveConta}
        />
      )}
      {pagoModal && (
        <MarcarPagoModal
          conta={pagoModal}
          onClose={() => setPagoModal(null)}
          onConfirm={onConfirmPago}
        />
      )}
      {detalhesModal && (
        <DetalhesModal
          item={detalhesModal}
          onClose={() => setDetalhesModal(null)}
        />
      )}
    </div>
  )
}
