import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import {
  PlusIcon, MagnifyingGlassIcon, XMarkIcon, CheckCircleIcon,
  ExclamationCircleIcon, ClockIcon, PencilIcon, TrashIcon,
  BanknotesIcon, CalendarDaysIcon, ArrowPathIcon, DevicePhoneMobileIcon,
  EyeIcon, NoSymbolIcon, ChevronDownIcon, ChevronRightIcon,
  TruckIcon, UserIcon, IdentificationIcon, ShoppingCartIcon,
  DocumentArrowDownIcon, PaperAirplaneIcon,
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
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 540, border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

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
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 420, border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', padding: 28 }}>
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
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 560, border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>

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

// ─── Formata mensagem WA para um item ────────────────────────────────────────
function formatWaMsg(item, { valorOverride } = {}) {
  const realStatus = calcStatus(item)
  const statusLabel = { pago: '✅ Pago', pendente: '⏳ Pendente', vencido: '🔴 Vencido' }[realStatus] || realStatus
  const extras = item._original?.dados_extras || item.dados_extras || {}
  const refDate = item.vencimento || item.data
  const valorExibir = valorOverride != null ? valorOverride : item.valor

  let msg =
    `📋 *REQUISIÇÃO DE PAGAMENTO*\n\n` +
    `💼 *${item.descricao}*\n` +
    (item.fornecedor           ? `🏪 Fornecedor: ${item.fornecedor}\n`         : '') +
    (item.categoria            ? `🗂 Categoria: ${item.categoria}\n`           : '') +
    (refDate                   ? `📅 Vencimento: ${fmtDate(refDate)}\n`       : '') +
    (item.data_pagamento       ? `✅ Pago em: ${fmtDate(item.data_pagamento)}\n` : '') +
    `💰 Valor: *${fmtCurrency(valorExibir)}*\n` +
    `📊 Status: ${statusLabel}\n` +
    (item.observacoes          ? `📝 Obs: ${item.observacoes}\n`              : '')

  if (item._source === 'compras' && item.solicitacao) {
    const sol = item.solicitacao
    msg += `\n🛒 *Requisição de Compra*\n`
    if (sol.requisitante_nome) msg += `👤 Solicitante: ${sol.requisitante_nome}\n`
    if (sol.urgencia)          msg += `⚡ Urgência: ${{ baixa: 'Baixa', media: 'Média', alta: '🔴 ALTA' }[sol.urgencia] || sol.urgencia}\n`
    if (sol.quantidade)        msg += `📦 Quantidade: ${sol.quantidade}\n`
    if (sol.data_necessidade)  msg += `📅 Necessidade: ${fmtDate(sol.data_necessidade)}\n`
    if (sol.descricao)         msg += `📄 Detalhe: ${sol.descricao}\n`
  }

  if (item._source === 'whatsapp') {
    const cond = extras.condutor || extras.motorista
    if (cond)                       msg += `\n🚗 *Dados do Formulário*\n👨‍✈️ Condutor: ${cond}\n`
    if (extras.placa)               msg += `🚗 Placa: ${extras.placa}\n`
    if (extras.local_origem)        msg += `📍 Origem: ${extras.local_origem}\n`
    if (extras.local_destino)       msg += `📍 Destino: ${extras.local_destino}\n`
    if (extras.km_inicial != null)  msg += `🔢 KM Inicial: ${extras.km_inicial}\n`
    if (extras.km_final   != null)  msg += `🔢 KM Final: ${extras.km_final}\n`
  }

  msg += `\n_Casagrande Locações e Transportes_`
  return msg
}

// ─── Modal envio WhatsApp ─────────────────────────────────────────────────────
function WaSendModal({ item, onClose }) {
  const [phone,    setPhone]   = useState('')
  const [sending,  setSending] = useState(false)
  const [preview,  setPreview] = useState(false)
  const msg = formatWaMsg(item)

  async function handleSend() {
    const p = phone.replace(/\D/g, '')
    if (p.length < 10) { toast.error('Informe um número válido com DDD'); return }
    setSending(true)
    try {
      // 1️⃣ Busca itens da compra se for compra
      let itensDetalhe = ''
      let valorTotalItens = null
      if (item._source === 'compras') {
        let itensWA = []
        if (item.solicitacao_id) {
          const { data: itens, error: itensErr } = await supabase
            .from('itens_solicitacao_compra')
            .select('descricao, quantidade, valor_unitario, valor_total')
            .eq('solicitacao_id', item.solicitacao_id)
          if (!itensErr && itens && itens.length > 0) {
            itensWA = itens
          }
        }
        // Fallback: sem itens no banco → usa dados da solicitação
        if (itensWA.length === 0) {
          const sol = item.solicitacao
          const qtd   = parseFloat(sol?.quantidade) || 1
          const total = parseFloat(item.valor) || 0
          const desc  = sol?.titulo || item.descricao || '—'
          itensWA = [{ descricao: desc, quantidade: qtd, valor_total: total }]
        }
        valorTotalItens = itensWA.reduce((s, it) => s + (parseFloat(it.valor_total) || 0), 0)
        itensDetalhe = '\n\n🧾 *Itens da Compra:*\n' +
          itensWA.map(it => {
            const qtd   = parseFloat(it.quantidade) || 1
            const total = parseFloat(it.valor_total) || 0
            const unit  = total / qtd
            return `• ${qtd}x ${it.descricao} — ${fmtCurrency(unit)} = ${fmtCurrency(total)}`
          }).join('\n')
      }

      // 2️⃣ Gera PDF e faz upload para link público
      toast('Gerando PDF...', { icon: '📄', duration: 2000 })
      const pdfData = await exportContaPDF(item, { returnBase64: true })

      const storagePath = `temp_wa/${Date.now()}_${pdfData.nome}`
      const { data: uploaded, error: upErr } = await supabase.storage
        .from('comprovantes')
        .upload(storagePath, pdfData.blob, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw new Error('Upload PDF falhou: ' + upErr.message)

      const { data: pub } = supabase.storage.from('comprovantes').getPublicUrl(uploaded.path)
      const pdfUrl = pub.publicUrl

      // 3️⃣ Monta mensagem com itens + link para download
      const msgFinal = formatWaMsg(item, { valorOverride: valorTotalItens })
      const mensagemComLink = msgFinal + itensDetalhe + `\n\n📄 *PDF para download:*\n${pdfUrl}`

      // 4️⃣ Envia só o texto (com o link) via WhatsApp
      toast('Enviando via WhatsApp...', { icon: '📤', duration: 2000 })
      const res = await fetch('/api/notify-compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evento:   '_direto',
          telefone: p,
          mensagem: mensagemComLink,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || `Erro ${res.status}`)
      toast.success('✅ Enviado com sucesso!')
      onClose()
    } catch (e) {
      console.error('[WA] handleSend erro:', e)
      toast.error('Erro: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 460, border: '1px solid var(--border)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PaperAirplaneIcon style={{ width: 18, height: 18, color: '#25d366' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Enviar via WhatsApp</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Resumo do item */}
          <div style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.descricao}</div>
            <div style={{ fontSize: 12, color: '#25d366', fontWeight: 700, marginTop: 2 }}>{fmtCurrency(item.valor)}</div>
            {item.fornecedor && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>🏪 {item.fornecedor}</div>}
          </div>

          {/* Input telefone */}
          <div>
            <label style={labelStyle}>Número WhatsApp (com DDD)</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ex: 11 99999-0000"
              style={inputStyle}
              type="tel"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
              DDI 55 (Brasil) é adicionado automaticamente se não informado.
            </div>
          </div>

          {/* Preview toggle */}
          <button onClick={() => setPreview(v => !v)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
            {preview ? <ChevronDownIcon style={{ width: 13, height: 13 }} /> : <ChevronRightIcon style={{ width: 13, height: 13 }} />}
            Ver mensagem que será enviada
          </button>

          {preview && (
            <pre style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflowY: 'auto', margin: 0 }}>
              {msg}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 24px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={handleSend} disabled={sending}
            style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: sending ? '#555' : '#25d366', color: '#fff', cursor: sending ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
            {sending
              ? <ArrowPathIcon style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} />
              : <PaperAirplaneIcon style={{ width: 15, height: 15 }} />}
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Export PDF individual ────────────────────────────────────────────────────
async function exportContaPDF(item, { returnBase64 = false } = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const realStatus = calcStatus(item)
  const extras = item._original?.dados_extras || item.dados_extras || {}

  // ── Logo / cabeçalho ──────────────────────────────────────────────────────
  doc.setFillColor(22, 163, 74)
  doc.rect(0, 0, W, 30, 'F')

  try {
    const resp = await fetch('/CASAGRANDELOGO.png')
    if (resp.ok) {
      const blob = await resp.blob()
      const b64 = await new Promise(res => {
        const r = new FileReader()
        r.onload = () => res(r.result)
        r.readAsDataURL(blob)
      })
      doc.addImage(b64, 'PNG', 10, 3, 44, 24)
    }
  } catch { /* logo opcional */ }

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('REQUISIÇÃO DE PAGAMENTO', W - 14, 14, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Casagrande Locações e Transportes', W - 14, 21, { align: 'right' })

  // ── Status badge ──────────────────────────────────────────────────────────
  const statusColors = { pago: [16, 185, 129], pendente: [245, 158, 11], vencido: [239, 68, 68] }
  const [r, g, b] = statusColors[realStatus] || [100, 100, 100]
  doc.setFillColor(r, g, b)
  doc.roundedRect(14, 36, 36, 7, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(realStatus.toUpperCase(), 32, 41.2, { align: 'center' })

  const sourceLabel = { manual: 'Manual', whatsapp: 'WhatsApp / OCR', compras: 'Requisição de Compra' }
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`Fonte: ${sourceLabel[item._source] || item._source}`, 56, 41)

  // ── Descrição ─────────────────────────────────────────────────────────────
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  const descLines = doc.splitTextToSize(item.descricao || '—', W - 28)
  doc.text(descLines, 14, 54)
  const afterDesc = 54 + (descLines.length - 1) * 7 + 6

  doc.setDrawColor(226, 232, 240)
  doc.line(14, afterDesc, W - 14, afterDesc)

  // ── Dados principais ──────────────────────────────────────────────────────
  const refDate = item.vencimento || item.data
  // Se for compra, busca itens e soma total
  let itensCompra = []
  let valorTotalItens = null
  if (item._source === 'compras' && item.solicitacao_id) {
    try {
      const { data: itens, error: itensErr } = await supabase
        .from('itens_solicitacao_compra')
        .select('descricao, quantidade, valor_unitario, valor_total')
        .eq('solicitacao_id', item.solicitacao_id)
      if (!itensErr && itens && itens.length > 0) {
        itensCompra = itens
        valorTotalItens = itens.reduce((s, it) => s + (parseFloat(it.valor_total) || 0), 0)
      }
    } catch {}
  }
  // Fallback: se não há itens no banco, monta 1 linha com dados da solicitação
  if (item._source === 'compras' && itensCompra.length === 0) {
    const sol = item.solicitacao
    const qtd   = parseFloat(sol?.quantidade) || 1
    const total = parseFloat(item.valor) || 0
    const desc  = sol?.titulo || item.descricao || '—'
    itensCompra   = [{ descricao: desc, quantidade: qtd, valor_total: total, _fallback: true }]
    valorTotalItens = total
  }

  const mainRows = [
    ['Fornecedor',       item.fornecedor || '—'],
    ['Categoria',        item.categoria  || '—'],
    ['Data / Vencimento', fmtDate(refDate)],
    item.data_pagamento ? ['Data do Pagamento', fmtDate(item.data_pagamento)] : null,
    ['Valor',            fmtCurrency(valorTotalItens !== null ? valorTotalItens : item.valor)],
    item.observacoes ? ['Observações', item.observacoes] : null,
  ].filter(Boolean)

  let currentY = afterDesc + 4
  autoTable(doc, {
    startY: currentY,
    head: [],
    body: mainRows,
    styles: { fontSize: 10, cellPadding: [3.5, 4] },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 55 },
      1: { textColor: [15, 23, 42] },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: 'grid',
    margin: { left: 14, right: 14 },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.3,
  })
  currentY = doc.lastAutoTable.finalY + 6

  // ── Bloco Compras + Itens ───────────────────────────────────────────────
  if (item._source === 'compras') {
    // Cabeçalho + dados da requisição (só se existir solicitacao join)
    if (item.solicitacao) {
      const sol = item.solicitacao
      doc.setFillColor(254, 243, 199)
      doc.setDrawColor(251, 191, 36)
      doc.roundedRect(14, currentY, W - 28, 7, 2, 2, 'FD')
      doc.setTextColor(146, 64, 14)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('DADOS DA REQUISIÇÃO DE COMPRA', 18, currentY + 4.8)
      currentY += 9

      const comprasRows = [
        sol.requisitante_nome  ? ['Solicitante',       sol.requisitante_nome] : null,
        sol.urgencia           ? ['Urgência',           { baixa: 'Baixa', media: 'Média', alta: 'ALTA' }[sol.urgencia] || sol.urgencia] : null,
        sol.data_necessidade   ? ['Data Necessidade',   fmtDate(sol.data_necessidade)] : null,
        sol.descricao          ? ['Detalhamento',       sol.descricao] : null,
      ].filter(Boolean)

      if (comprasRows.length > 0) {
        autoTable(doc, {
          startY: currentY,
          head: [],
          body: comprasRows,
          styles: { fontSize: 9.5, cellPadding: [3, 4] },
          columnStyles: {
            0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 55 },
            1: { textColor: [15, 23, 42] },
          },
          alternateRowStyles: { fillColor: [255, 251, 235] },
          theme: 'grid',
          margin: { left: 14, right: 14 },
          tableLineColor: [251, 191, 36],
          tableLineWidth: 0.3,
        })
        currentY = doc.lastAutoTable.finalY + 6
      }
    }

    // Tabela de itens — sempre exibida para compras (itens reais ou fallback)
    if (itensCompra.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(71, 85, 105)
      doc.text('ITENS DA COMPRA', 14, currentY + 6)
      currentY += 8
      autoTable(doc, {
        startY: currentY,
        head: [['Qtd', 'Descrição', 'Valor Unitário', 'Valor Total']],
        body: itensCompra.map(it => {
          const qtd   = parseFloat(it.quantidade) || 1
          const total = parseFloat(it.valor_total) || 0
          const unit  = total / qtd
          return [String(qtd), it.descricao, fmtCurrency(unit), fmtCurrency(total)]
        }),
        styles: { fontSize: 9.5, cellPadding: [3, 4] },
        headStyles: { fillColor: [251, 191, 36], textColor: [146, 64, 14], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 251, 235] },
        columnStyles: {
          0: { cellWidth: 16, halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
        },
        theme: 'grid',
        margin: { left: 14, right: 14 },
        tableLineColor: [251, 191, 36],
        tableLineWidth: 0.3,
      })
      currentY = doc.lastAutoTable.finalY + 6
    }
  }

  // ── Bloco WhatsApp / OCR ──────────────────────────────────────────────────
  if (item._source === 'whatsapp' && Object.keys(extras).length > 0) {
    doc.setFillColor(220, 252, 231)
    doc.setDrawColor(74, 222, 128)
    doc.roundedRect(14, currentY, W - 28, 7, 2, 2, 'FD')
    doc.setTextColor(22, 101, 52)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('DADOS DO FORMULÁRIO OCR', 18, currentY + 4.8)
    currentY += 9

    const wppRows = [
      extras.condutor || extras.motorista ? ['Condutor',   extras.condutor || extras.motorista] : null,
      extras.placa              ? ['Placa',        extras.placa] : null,
      extras.empresa            ? ['Empresa',      extras.empresa] : null,
      extras.solicitante        ? ['Solicitante',  extras.solicitante] : null,
      extras.numero_diario      ? ['Nº Diário',    String(extras.numero_diario)] : null,
      extras.km_inicial != null ? ['KM Inicial',   String(extras.km_inicial)] : null,
      extras.km_final   != null ? ['KM Final',     String(extras.km_final)] : null,
      extras.local_origem       ? ['Origem',       extras.local_origem] : null,
      extras.local_destino      ? ['Destino',      extras.local_destino] : null,
    ].filter(Boolean)

    if (wppRows.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [],
        body: wppRows,
        styles: { fontSize: 9.5, cellPadding: [3, 4] },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 55 },
          1: { textColor: [15, 23, 42] },
        },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        theme: 'grid',
        margin: { left: 14, right: 14 },
        tableLineColor: [74, 222, 128],
        tableLineWidth: 0.3,
      })
      currentY = doc.lastAutoTable.finalY + 6
    }
  }

  // ── Área de assinatura ────────────────────────────────────────────────────
  const assinaturaY = Math.max(currentY + 10, 230)
  doc.setDrawColor(200, 200, 200)
  doc.line(14, assinaturaY, 90, assinaturaY)
  doc.line(120, assinaturaY, W - 14, assinaturaY)
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('Responsável / Aprovador', 52, assinaturaY + 5, { align: 'center' })
  doc.text('Financeiro', W - 14 - 23, assinaturaY + 5, { align: 'center' })

  // ── Rodapé ────────────────────────────────────────────────────────────────
  doc.setFillColor(22, 163, 74)
  doc.rect(0, 282, W, 15, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  const now = new Date()
  doc.text(`Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 14, 290.5)
  doc.text('smartosapp.app.br', W - 14, 290.5, { align: 'right' })

  const slug = (item.descricao || 'conta').replace(/[^a-z0-9]/gi, '_').slice(0, 30)
  const fileName = `requisicao_${slug}.pdf`
  if (returnBase64) {
    const b64 = doc.output('datauristring') // data:application/pdf;base64,...
    return { blob: doc.output('blob'), nome: fileName, b64 }
  }
  doc.save(fileName)
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
  const [waModal,      setWaModal]      = useState(null)

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      <Header title="Contas a Pagar" subtitle="Controle de pagamentos e vencimentos" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

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
              <div key={card.label} style={{ background: 'var(--bg-secondary)', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
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
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
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

                              {/* Exportar PDF */}
                              <button title="Exportar PDF" onClick={() => exportContaPDF(item)}
                                style={{ padding: 6, borderRadius: 8, background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)', cursor: 'pointer', color: '#16a34a', display: 'flex', alignItems: 'center' }}>
                                <DocumentArrowDownIcon style={{ width: 15, height: 15 }} />
                              </button>

                              {/* Enviar via WhatsApp */}
                              <button title="Enviar via WhatsApp" onClick={() => setWaModal(item)}
                                style={{ padding: 6, borderRadius: 8, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', cursor: 'pointer', color: '#25d366', display: 'flex', alignItems: 'center' }}>
                                <PaperAirplaneIcon style={{ width: 15, height: 15 }} />
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
      {waModal && (
        <WaSendModal
          item={waModal}
          onClose={() => setWaModal(null)}
        />
      )}
    </div>
  )
}
