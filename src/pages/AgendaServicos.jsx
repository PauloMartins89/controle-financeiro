import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import useStore from '../store/useStore'
import toast from 'react-hot-toast'
import {
  PlusIcon, CalendarDaysIcon, TruckIcon, CheckCircleIcon, XCircleIcon,
  ClockIcon, ExclamationTriangleIcon, ChatBubbleLeftRightIcon,
  PencilIcon, TrashIcon, ArrowPathIcon, EyeIcon, BellAlertIcon,
  FunnelIcon, MagnifyingGlassIcon, XMarkIcon, ChevronDownIcon,
  DevicePhoneMobileIcon, MapPinIcon, UserIcon, WrenchScrewdriverIcon,
  DocumentTextIcon, AdjustmentsHorizontalIcon, CheckBadgeIcon,
  PhoneIcon, PlayIcon, StopIcon, UsersIcon, LinkIcon, MicrophoneIcon,
  ChatBubbleOvalLeftEllipsisIcon,
} from '@heroicons/react/24/outline'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_SERVICO = [
  'Caminhão Prancha', 'Caminhão Munck', 'Guindaste', 'Caminhão Basculante',
  'Betoneira', 'Retroescavadeira', 'Motoniveladora', 'Pá Carregadeira',
  'Trator', 'Escavadeira Hidráulica', 'Caminhão Pipa', 'Caminhão Tanque',
  'Ambulância / UTI Móvel', 'Reboque / Guincho', 'Caminhão Baú',
  'Caminhão Refrigerado', 'Plataforma Elevatória', 'Caminhão Cegonha',
  'Locação de Equipamento', 'Transporte Especial', 'Outro',
]

const STATUS_CONFIG = {
  agendado:               { label: 'Agendado',            color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  alerta_pendente:        { label: 'Alerta Pendente',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  alerta_enviado:         { label: 'Alerta Enviado',      color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  confirmado:             { label: 'Confirmado',          color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  ajuste_solicitado:      { label: 'Ajuste Solicitado',   color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  reagendamento_solicitado:{ label: 'Reagendamento',      color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  em_execucao:            { label: 'Em Execução',         color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  concluido:              { label: 'Concluído',           color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  cancelado:              { label: 'Cancelado',           color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

const ALERTA_STATUS_CONFIG = {
  pendente:    { label: 'Pendente',   color: '#f59e0b', icon: '⏳' },
  enviado:     { label: 'Enviado',    color: '#0ea5e9', icon: '📤' },
  confirmado:  { label: 'Confirmado', color: '#10b981', icon: '✅' },
  falha:       { label: 'Falha',      color: '#ef4444', icon: '❌' },
  reenviado:   { label: 'Reenviado',  color: '#8b5cf6', icon: '🔄' },
  cancelado:   { label: 'Cancelado',  color: '#94a3b8', icon: '🚫' },
}

const ANTECEDENCIAS = [
  { label: '30 minutos', value: 30 },
  { label: '1 hora',     value: 60 },
  { label: '2 horas',    value: 120 },
  { label: '3 horas',    value: 180 },
  { label: '6 horas',    value: 360 },
  { label: '12 horas',   value: 720 },
  { label: '1 dia',      value: 1440 },
  { label: '2 dias',     value: 2880 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—'
  const [y, m, dia] = String(d).slice(0, 10).split('-')
  return `${dia}/${m}/${y}`
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  const dt = new Date(iso)
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function normalizarTelefone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (!digits || digits.length < 8) return null
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return '55' + digits
  return '55' + digits
}

function waLink(phone) {
  const normalized = normalizarTelefone(phone)
  if (!normalized) return null
  return `https://wa.me/${normalized}`
}

function calcHorarioAlerta(dataServico, horarioServico, antecedenciaMinutos) {
  if (!dataServico) return null
  const baseStr = horarioServico ? `${dataServico}T${horarioServico}` : `${dataServico}T08:00:00`
  const base = new Date(baseStr)
  return new Date(base.getTime() - antecedenciaMinutos * 60 * 1000).toISOString()
}

// ─── Chips de status ──────────────────────────────────────────────────────────

function StatusChip({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

function AlertaChip({ status }) {
  const cfg = ALERTA_STATUS_CONFIG[status] || { label: status || '—', color: '#94a3b8', icon: '📋' }
  return (
    <span style={{ fontSize: 11, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

// ─── Card de Estatística ──────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = '#6366f1', onClick, highlight }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)', border: `1px solid ${highlight ? color + '44' : 'var(--border)'}`,
        borderRadius: 14, padding: '16px 20px', cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s', minWidth: 120, flex: 1,
        boxShadow: highlight ? `0 0 0 1px ${color}33, 0 4px 20px ${color}18` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 16, height: 16, color }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.2 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: -1 }}>{value ?? '—'}</div>
    </div>
  )
}

// ─── Modal: Novo / Editar Agendamento ────────────────────────────────────────

function ModalAgendamento({ agendamento, onClose, onSaved, workspaceId }) {
  const { currentUser } = useStore()
  const [aba, setAba] = useState('servico')
  const [saving, setSaving] = useState(false)

  const empty = {
    cliente_nome: '', tipo_servico: '', atividade: '', descricao: '',
    data_servico: '', horario_servico: '', previsao_duracao_min: '',
    origem: '', destino: '', observacao: '',
    responsavel_nome: '', responsavel_whatsapp: '',
    motorista_nome: '', motorista_whatsapp: '',
    veiculo_nome: '', contato_cliente: '', whatsapp_cliente: '',
    // Alertas
    ativar_alerta: true,
    destinatario_tipo: 'responsavel',
    destinatario_nome: '',
    destinatario_whatsapp: '',
    antecedencia_minutos: 180,
    solicitar_confirmacao: false,
    reenviar_se_nao_confirmar: false,
    max_tentativas: 3,
    intervalo_reenvio_min: 60,
  }

  const [form, setForm] = useState(agendamento ? {
    ...empty,
    ...agendamento,
    ativar_alerta: true,
    destinatario_tipo: 'responsavel',
    destinatario_nome: agendamento.responsavel_nome || '',
    destinatario_whatsapp: agendamento.responsavel_whatsapp || '',
    antecedencia_minutos: 180,
    solicitar_confirmacao: false,
    reenviar_se_nao_confirmar: false,
    max_tentativas: 3,
    intervalo_reenvio_min: 60,
  } : empty)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  // Auto-preenche destinatário do alerta conforme tipo
  useEffect(() => {
    if (form.destinatario_tipo === 'responsavel') {
      setForm(f => ({ ...f, destinatario_nome: f.responsavel_nome, destinatario_whatsapp: f.responsavel_whatsapp }))
    } else if (form.destinatario_tipo === 'motorista') {
      setForm(f => ({ ...f, destinatario_nome: f.motorista_nome, destinatario_whatsapp: f.motorista_whatsapp }))
    } else if (form.destinatario_tipo === 'cliente') {
      setForm(f => ({ ...f, destinatario_nome: f.cliente_nome, destinatario_whatsapp: f.whatsapp_cliente }))
    }
  }, [form.destinatario_tipo, form.responsavel_nome, form.motorista_nome, form.cliente_nome])

  async function salvar() {
    if (!form.cliente_nome.trim()) return toast.error('Informe o cliente')
    if (!form.tipo_servico) return toast.error('Selecione o tipo de serviço')
    if (!form.data_servico) return toast.error('Informe a data do serviço')
    setSaving(true)
    try {
      const dataHora = form.horario_servico
        ? new Date(`${form.data_servico}T${form.horario_servico}:00`).toISOString()
        : new Date(`${form.data_servico}T00:00:00`).toISOString()

      const payload = {
        workspace_id: workspaceId || null,
        cliente_nome: form.cliente_nome.trim(),
        tipo_servico: form.tipo_servico,
        atividade: form.atividade?.trim() || null,
        descricao: form.descricao?.trim() || null,
        data_servico: form.data_servico,
        horario_servico: form.horario_servico || null,
        data_hora_servico: dataHora,
        previsao_duracao_min: form.previsao_duracao_min ? parseInt(form.previsao_duracao_min) : null,
        origem: form.origem?.trim() || null,
        destino: form.destino?.trim() || null,
        observacao: form.observacao?.trim() || null,
        responsavel_nome: form.responsavel_nome?.trim() || null,
        responsavel_whatsapp: normalizarTelefone(form.responsavel_whatsapp),
        motorista_nome: form.motorista_nome?.trim() || null,
        motorista_whatsapp: normalizarTelefone(form.motorista_whatsapp),
        veiculo_nome: form.veiculo_nome?.trim() || null,
        contato_cliente: form.contato_cliente?.trim() || null,
        whatsapp_cliente: normalizarTelefone(form.whatsapp_cliente),
        criado_por_nome: currentUser?.nome || currentUser?.apelido || null,
      }

      let agendamentoId
      if (agendamento?.id) {
        // Edição
        const { error } = await supabase.from('agendamentos_servicos').update(payload).eq('id', agendamento.id)
        if (error) throw error
        agendamentoId = agendamento.id
        // Registra histórico
        await supabase.from('agendamento_historico').insert({
          agendamento_id: agendamentoId,
          tipo_evento: 'edicao',
          descricao: `Agendamento editado por ${payload.criado_por_nome || 'usuário'}`,
          usuario_nome: payload.criado_por_nome,
        })
      } else {
        // Criação
        const { data: novo, error } = await supabase.from('agendamentos_servicos').insert(payload).select().single()
        if (error) throw error
        agendamentoId = novo.id
        // Registra histórico de criação
        await supabase.from('agendamento_historico').insert({
          agendamento_id: agendamentoId,
          tipo_evento: 'criacao',
          descricao: `Agendamento criado por ${payload.criado_por_nome || 'usuário'}`,
          usuario_nome: payload.criado_por_nome,
        })
      }

      // Cria alerta WhatsApp se ativado
      if (form.ativar_alerta && form.destinatario_whatsapp) {
        const horarioPrevisto = calcHorarioAlerta(form.data_servico, form.horario_servico, form.antecedencia_minutos)
        if (horarioPrevisto) {
          const idempotencyKey = `${agendamentoId}_${form.destinatario_whatsapp}_${form.antecedencia_minutos}_${Date.now()}`
          const alertaPayload = {
            agendamento_id: agendamentoId,
            destinatario_tipo: form.destinatario_tipo,
            destinatario_nome: form.destinatario_nome?.trim() || null,
            destinatario_whatsapp: normalizarTelefone(form.destinatario_whatsapp),
            antecedencia_minutos: parseInt(form.antecedencia_minutos),
            horario_previsto_envio: horarioPrevisto,
            status: 'pendente',
            solicitar_confirmacao: form.solicitar_confirmacao,
            reenviar_se_nao_confirmar: form.reenviar_se_nao_confirmar,
            max_tentativas: parseInt(form.max_tentativas) || 3,
            intervalo_reenvio_min: parseInt(form.intervalo_reenvio_min) || 60,
            idempotency_key: idempotencyKey,
            ativo: true,
          }
          await supabase.from('agendamento_alertas').insert(alertaPayload)
          // Atualiza status do agendamento
          await supabase.from('agendamentos_servicos').update({ status: 'alerta_pendente' }).eq('id', agendamentoId)
          await supabase.from('agendamento_historico').insert({
            agendamento_id: agendamentoId,
            tipo_evento: 'alerta_configurado',
            descricao: `Alerta WhatsApp configurado para ${ANTECEDENCIAS.find(a => a.value === parseInt(form.antecedencia_minutos))?.label || form.antecedencia_minutos + ' min'} antes`,
            usuario_nome: payload.criado_por_nome,
          })
        }
      }

      toast.success(agendamento?.id ? 'Agendamento atualizado!' : 'Agendamento criado!')
      onSaved()
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar: ' + (e.message || 'Erro desconhecido'))
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }
  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 760, width: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{agendamento ? 'Editar Agendamento' : 'Novo Agendamento'}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Preencha os dados do serviço a ser realizado</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', flexShrink: 0 }}>
          {[
            { key: 'servico',     label: '📋 Serviço' },
            { key: 'operacional', label: '⚙️ Operacional' },
            { key: 'alerta',      label: '🔔 WhatsApp' },
          ].map(ab => (
            <button key={ab.key} onClick={() => setAba(ab.key)} style={{
              padding: '10px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: `2px solid ${aba === ab.key ? 'var(--accent)' : 'transparent'}`,
              color: aba === ab.key ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}>
              {ab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── ABA: Serviço ── */}
          {aba === 'servico' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Cliente *</label>
                  <input style={inputStyle} value={form.cliente_nome} onChange={e => set('cliente_nome', e.target.value)} placeholder="Nome do cliente" />
                </div>
                <div>
                  <label style={labelStyle}>Tipo de Serviço *</label>
                  <select style={inputStyle} value={form.tipo_servico} onChange={e => set('tipo_servico', e.target.value)}>
                    <option value="">Selecione...</option>
                    {TIPOS_SERVICO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Atividade / Finalidade</label>
                <input style={inputStyle} value={form.atividade} onChange={e => set('atividade', e.target.value)} placeholder="Ex: Transporte de máquina, Movimentação de cargas..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Data do Serviço *</label>
                  <input type="date" style={inputStyle} value={form.data_servico} onChange={e => set('data_servico', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Horário</label>
                  <input type="time" style={inputStyle} value={form.horario_servico} onChange={e => set('horario_servico', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Duração (min)</label>
                  <input type="number" style={inputStyle} value={form.previsao_duracao_min} onChange={e => set('previsao_duracao_min', e.target.value)} placeholder="480" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Origem</label>
                  <input style={inputStyle} value={form.origem} onChange={e => set('origem', e.target.value)} placeholder="Cidade/local de saída" />
                </div>
                <div>
                  <label style={labelStyle}>Destino</label>
                  <input style={inputStyle} value={form.destino} onChange={e => set('destino', e.target.value)} placeholder="Cidade/local de chegada" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Descrição</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Detalhes adicionais sobre o serviço..." />
              </div>
              <div>
                <label style={labelStyle}>Observações</label>
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.observacao} onChange={e => set('observacao', e.target.value)} placeholder="Observações internas..." />
              </div>
            </div>
          )}

          {/* ── ABA: Operacional ── */}
          {aba === 'operacional' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, borderLeft: '3px solid #6366f1' }}>
                Preencha os dados operacionais. Os WhatsApps cadastrados serão utilizados para envio dos alertas.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Responsável Interno</label>
                  <input style={inputStyle} value={form.responsavel_nome} onChange={e => set('responsavel_nome', e.target.value)} placeholder="Nome do responsável" />
                </div>
                <div>
                  <label style={labelStyle}>WhatsApp do Responsável</label>
                  <input style={inputStyle} value={form.responsavel_whatsapp} onChange={e => set('responsavel_whatsapp', e.target.value)} placeholder="67999999999" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Motorista / Operador</label>
                  <input style={inputStyle} value={form.motorista_nome} onChange={e => set('motorista_nome', e.target.value)} placeholder="Nome do motorista" />
                </div>
                <div>
                  <label style={labelStyle}>WhatsApp do Motorista</label>
                  <input style={inputStyle} value={form.motorista_whatsapp} onChange={e => set('motorista_whatsapp', e.target.value)} placeholder="67999999999" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Veículo / Equipamento</label>
                <input style={inputStyle} value={form.veiculo_nome} onChange={e => set('veiculo_nome', e.target.value)} placeholder="Ex: Prancha 01, Munck 02, Retroescavadeira..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Contato do Cliente</label>
                  <input style={inputStyle} value={form.contato_cliente} onChange={e => set('contato_cliente', e.target.value)} placeholder="Nome do contato" />
                </div>
                <div>
                  <label style={labelStyle}>WhatsApp do Cliente</label>
                  <input style={inputStyle} value={form.whatsapp_cliente} onChange={e => set('whatsapp_cliente', e.target.value)} placeholder="67999999999" />
                </div>
              </div>
            </div>
          )}

          {/* ── ABA: WhatsApp ── */}
          {aba === 'alerta' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Toggle ativar alerta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: form.ativar_alerta ? 'rgba(0,200,150,0.08)' : 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div
                  onClick={() => set('ativar_alerta', !form.ativar_alerta)}
                  style={{ width: 40, height: 22, borderRadius: 11, background: form.ativar_alerta ? 'var(--accent)' : 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 3, left: form.ativar_alerta ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Ativar alerta WhatsApp</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Enviar mensagem automática antes do serviço</div>
                </div>
              </div>

              {form.ativar_alerta && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Enviar para</label>
                      <select style={inputStyle} value={form.destinatario_tipo} onChange={e => set('destinatario_tipo', e.target.value)}>
                        <option value="responsavel">Responsável interno</option>
                        <option value="motorista">Motorista</option>
                        <option value="cliente">Cliente</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="personalizado">Número personalizado</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Antecedência</label>
                      <select style={inputStyle} value={form.antecedencia_minutos} onChange={e => set('antecedencia_minutos', parseInt(e.target.value))}>
                        {ANTECEDENCIAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {(form.destinatario_tipo === 'supervisor' || form.destinatario_tipo === 'personalizado') && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Nome do destinatário</label>
                        <input style={inputStyle} value={form.destinatario_nome} onChange={e => set('destinatario_nome', e.target.value)} placeholder="Ex: Supervisor Paulo" />
                      </div>
                      <div>
                        <label style={labelStyle}>Número WhatsApp *</label>
                        <input style={inputStyle} value={form.destinatario_whatsapp} onChange={e => set('destinatario_whatsapp', e.target.value)} placeholder="67999999999" />
                      </div>
                    </div>
                  )}

                  {form.destinatario_whatsapp && (
                    <div style={{ padding: '10px 14px', background: 'rgba(0,200,150,0.06)', borderRadius: 8, border: '1px solid rgba(0,200,150,0.15)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      📤 Será enviado para: <strong style={{ color: 'var(--text-primary)' }}>{form.destinatario_nome || 'Destinatário'}</strong> ({normalizarTelefone(form.destinatario_whatsapp) || form.destinatario_whatsapp})<br />
                      {form.data_servico && (
                        <>⏰ Horário previsto de envio: <strong style={{ color: 'var(--accent)' }}>
                          {(() => {
                            const h = calcHorarioAlerta(form.data_servico, form.horario_servico, form.antecedencia_minutos)
                            return h ? fmtDateTime(h) : '—'
                          })()}
                        </strong></>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" checked={form.solicitar_confirmacao} onChange={e => set('solicitar_confirmacao', e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
                      <span style={{ color: 'var(--text-primary)' }}>Solicitar confirmação de ciência</span>
                    </label>
                    {form.solicitar_confirmacao && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox" checked={form.reenviar_se_nao_confirmar} onChange={e => set('reenviar_se_nao_confirmar', e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
                        <span style={{ color: 'var(--text-primary)' }}>Reenviar se não confirmar</span>
                      </label>
                    )}
                  </div>

                  {form.solicitar_confirmacao && form.reenviar_se_nao_confirmar && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Intervalo entre reenvios</label>
                        <select style={inputStyle} value={form.intervalo_reenvio_min} onChange={e => set('intervalo_reenvio_min', parseInt(e.target.value))}>
                          <option value={30}>30 minutos</option>
                          <option value={60}>1 hora</option>
                          <option value={120}>2 horas</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Máx. tentativas</label>
                        <select style={inputStyle} value={form.max_tentativas} onChange={e => set('max_tentativas', parseInt(e.target.value))}>
                          {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : agendamento ? 'Salvar Alterações' : 'Criar Agendamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Detalhes / Timeline ───────────────────────────────────────────────

function ModalDetalhes({ agendamento, onClose, onEdit, onStatusChange }) {
  const [historico, setHistorico] = useState([])
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)
  const [enviandoWA, setEnviandoWA] = useState(false)

  useEffect(() => {
    if (!agendamento?.id) return
    Promise.all([
      supabase.from('agendamento_historico').select('*').eq('agendamento_id', agendamento.id).order('data_evento', { ascending: false }),
      supabase.from('agendamento_alertas').select('*').eq('agendamento_id', agendamento.id).order('created_at', { ascending: false }),
    ]).then(([h, a]) => {
      setHistorico(h.data || [])
      setAlertas(a.data || [])
      setLoading(false)
    })
  }, [agendamento?.id])

  async function enviarWAAgora(alerta) {
    setEnviandoWA(true)
    try {
      const res = await fetch('/api/agenda-alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertaId: alerta.id, force: true }),
      })
      if (res.ok) toast.success('WhatsApp enviado!')
      else toast.error('Erro ao enviar WhatsApp')
    } catch {
      toast.error('Erro ao enviar WhatsApp')
    } finally {
      setEnviandoWA(false)
    }
  }

  const tipoEventoIcon = {
    criacao: '🟢', edicao: '✏️', alerta_configurado: '🔔', whatsapp_enviado: '📤',
    reenvio_whatsapp: '🔄', falha_whatsapp: '❌', confirmacao_recebida: '✅',
    ajuste_solicitado: '⚠️', cancelamento: '🚫', conclusao: '🏁', em_execucao: '▶️',
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 800, width: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{agendamento.tipo_servico}</h2>
              <StatusChip status={agendamento.status} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {agendamento.cliente_nome} · {fmtDate(agendamento.data_servico)}{agendamento.horario_servico ? ` às ${agendamento.horario_servico.slice(0,5)}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => onEdit(agendamento)} style={{ padding: '6px 14px', borderRadius: 7, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', color: '#6366f1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Editar
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <XMarkIcon style={{ width: 20, height: 20 }} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 300px', gap: 0 }}>
          {/* Coluna principal */}
          <div style={{ padding: '20px 24px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Dados do serviço */}
            <section>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Dados do Serviço</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Cliente', value: agendamento.cliente_nome },
                  { label: 'Tipo', value: agendamento.tipo_servico },
                  { label: 'Atividade', value: agendamento.atividade },
                  { label: 'Data', value: fmtDate(agendamento.data_servico) },
                  { label: 'Horário', value: agendamento.horario_servico?.slice(0,5) },
                  { label: 'Origem', value: agendamento.origem },
                  { label: 'Destino', value: agendamento.destino },
                  { label: 'Veículo', value: agendamento.veiculo_nome },
                ].filter(i => i.value).map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {agendamento.observacao && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, borderLeft: '3px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>OBSERVAÇÃO</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{agendamento.observacao}</div>
                </div>
              )}
            </section>

            {/* Equipe */}
            <section>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Equipe</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Responsável', nome: agendamento.responsavel_nome, wa: agendamento.responsavel_whatsapp },
                  { label: 'Motorista', nome: agendamento.motorista_nome, wa: agendamento.motorista_whatsapp },
                  { label: 'Cliente', nome: agendamento.contato_cliente || agendamento.cliente_nome, wa: agendamento.whatsapp_cliente },
                ].filter(p => p.nome || p.wa).map(pessoa => (
                  <div key={pessoa.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>{pessoa.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{pessoa.nome || '—'}</div>
                    </div>
                    {pessoa.wa && waLink(pessoa.wa) && (
                      <a href={waLink(pessoa.wa)} target="_blank" rel="noreferrer" style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.2)', color: '#25d366', fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <DevicePhoneMobileIcon style={{ width: 12, height: 12 }} /> WA
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Alertas */}
            {alertas.length > 0 && (
              <section>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Alertas WhatsApp</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alertas.map(al => (
                    <div key={al.id} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: `1px solid ${ALERTA_STATUS_CONFIG[al.status]?.color || '#94a3b8'}22` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{al.destinatario_nome || al.destinatario_whatsapp}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            Envio: {fmtDateTime(al.horario_previsto_envio)} · {ANTECEDENCIAS.find(a => a.value === al.antecedencia_minutos)?.label || al.antecedencia_minutos + ' min'} antes
                          </div>
                          {al.enviado_em && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Enviado: {fmtDateTime(al.enviado_em)}</div>}
                          {al.erro_envio && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>Erro: {al.erro_envio}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AlertaChip status={al.status} />
                          {(al.status === 'falha' || al.status === 'pendente') && (
                            <button onClick={() => enviarWAAgora(al)} disabled={enviandoWA} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)', color: '#25d366', fontSize: 11, cursor: 'pointer' }}>
                              Enviar agora
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Ações de status */}
            <section>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Ações</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {agendamento.status !== 'em_execucao' && agendamento.status !== 'concluido' && agendamento.status !== 'cancelado' && (
                  <button onClick={() => onStatusChange(agendamento.id, 'em_execucao')} style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)', color: '#06b6d4', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <PlayIcon style={{ width: 13, height: 13 }} /> Iniciar
                  </button>
                )}
                {agendamento.status === 'em_execucao' && (
                  <button onClick={() => onStatusChange(agendamento.id, 'concluido')} style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircleIcon style={{ width: 13, height: 13 }} /> Concluir
                  </button>
                )}
                {agendamento.status !== 'cancelado' && agendamento.status !== 'concluido' && (
                  <button onClick={() => onStatusChange(agendamento.id, 'cancelado')} style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <XCircleIcon style={{ width: 13, height: 13 }} /> Cancelar
                  </button>
                )}
              </div>
            </section>
          </div>

          {/* Timeline */}
          <div style={{ padding: '20px 20px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Timeline</h3>
            {loading && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Carregando...</div>}
            {!loading && historico.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>Nenhum evento registrado</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {historico.map((ev, i) => (
                <div key={ev.id} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                      {tipoEventoIcon[ev.tipo_evento] || '📋'}
                    </div>
                    {i < historico.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border)', margin: '3px 0' }} />}
                  </div>
                  <div style={{ paddingBottom: 14, flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>{ev.descricao}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{fmtDateTime(ev.data_evento)}</div>
                    {ev.usuario_nome && <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>por {ev.usuario_nome}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Regras de Alerta ──────────────────────────────────────────────────

function ModalRegras({ onClose, workspaceId }) {
  const [regras, setRegras] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({
    nome_regra: '', tipo_servico: '', destinatario_tipo: 'responsavel',
    destinatario_nome: '', destinatario_whatsapp: '', antecedencia_minutos: 180,
    solicitar_confirmacao: false, reenviar_se_nao_confirmar: false,
    intervalo_reenvio_min: 60, max_tentativas: 3, ativo: true,
  })

  const carregarRegras = useCallback(async () => {
    const { data } = await supabase.from('agendamento_regras_alerta').select('*').order('created_at', { ascending: false })
    setRegras(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { carregarRegras() }, [carregarRegras])

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function salvarRegra() {
    if (!form.nome_regra.trim()) return toast.error('Informe o nome da regra')
    if (!form.destinatario_whatsapp) return toast.error('Informe o número WhatsApp')
    const payload = { ...form, workspace_id: workspaceId || null, antecedencia_minutos: parseInt(form.antecedencia_minutos) }
    if (editando?.id) {
      await supabase.from('agendamento_regras_alerta').update(payload).eq('id', editando.id)
      toast.success('Regra atualizada!')
    } else {
      await supabase.from('agendamento_regras_alerta').insert(payload)
      toast.success('Regra criada!')
    }
    setShowForm(false); setEditando(null)
    setForm({ nome_regra: '', tipo_servico: '', destinatario_tipo: 'responsavel', destinatario_nome: '', destinatario_whatsapp: '', antecedencia_minutos: 180, solicitar_confirmacao: false, reenviar_se_nao_confirmar: false, intervalo_reenvio_min: 60, max_tentativas: 3, ativo: true })
    carregarRegras()
  }

  async function toggleRegra(id, ativo) {
    await supabase.from('agendamento_regras_alerta').update({ ativo: !ativo }).eq('id', id)
    carregarRegras()
  }

  async function excluirRegra(id) {
    if (!window.confirm('Excluir esta regra?')) return
    await supabase.from('agendamento_regras_alerta').delete().eq('id', id)
    toast.success('Regra excluída')
    carregarRegras()
  }

  const inputStyle = { width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }
  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700, width: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Regras de Alerta WhatsApp</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Configure envios automáticos por tipo de serviço ou cliente</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowForm(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <PlusIcon style={{ width: 14, height: 14 }} /> Nova Regra
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <XMarkIcon style={{ width: 20, height: 20 }} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {showForm && (
            <div style={{ padding: 18, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>{editando ? 'Editar Regra' : 'Nova Regra'}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Nome da Regra *</label><input style={inputStyle} value={form.nome_regra} onChange={e => setF('nome_regra', e.target.value)} placeholder="Ex: Prancha - Supervisor" /></div>
                  <div><label style={labelStyle}>Tipo de Serviço (filtro)</label>
                    <select style={inputStyle} value={form.tipo_servico} onChange={e => setF('tipo_servico', e.target.value)}>
                      <option value="">Todos os serviços</option>
                      {TIPOS_SERVICO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={labelStyle}>Destinatário</label>
                    <select style={inputStyle} value={form.destinatario_tipo} onChange={e => setF('destinatario_tipo', e.target.value)}>
                      <option value="responsavel">Responsável</option>
                      <option value="motorista">Motorista</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="personalizado">Número fixo</option>
                    </select>
                  </div>
                  <div><label style={labelStyle}>Antecedência</label>
                    <select style={inputStyle} value={form.antecedencia_minutos} onChange={e => setF('antecedencia_minutos', parseInt(e.target.value))}>
                      {ANTECEDENCIAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                </div>
                {(form.destinatario_tipo === 'supervisor' || form.destinatario_tipo === 'personalizado') && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><label style={labelStyle}>Nome</label><input style={inputStyle} value={form.destinatario_nome} onChange={e => setF('destinatario_nome', e.target.value)} /></div>
                    <div><label style={labelStyle}>WhatsApp *</label><input style={inputStyle} value={form.destinatario_whatsapp} onChange={e => setF('destinatario_whatsapp', e.target.value)} placeholder="67999999999" /></div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.solicitar_confirmacao} onChange={e => setF('solicitar_confirmacao', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                    Solicitar confirmação
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.ativo} onChange={e => setF('ativo', e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                    Regra ativa
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowForm(false); setEditando(null) }} style={{ padding: '7px 16px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={salvarRegra} style={{ padding: '7px 16px', borderRadius: 7, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Salvar</button>
              </div>
            </div>
          )}

          {loading && <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>Carregando...</div>}
          {!loading && regras.length === 0 && !showForm && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
              <BellAlertIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>Nenhuma regra configurada</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Crie regras para envio automático de alertas</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {regras.map(r => (
              <div key={r.id} style={{ padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 10, border: `1px solid ${r.ativo ? 'rgba(0,200,150,0.15)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.ativo ? 'var(--accent)' : '#ef4444', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.nome_regra}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {r.tipo_servico || 'Todos os serviços'} · {ANTECEDENCIAS.find(a => a.value === r.antecedencia_minutos)?.label || r.antecedencia_minutos + 'min'} antes · {r.destinatario_tipo}
                    {r.destinatario_nome ? ` (${r.destinatario_nome})` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditando(r); setForm({ ...form, ...r }); setShowForm(true) }} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', border: 'none', color: '#6366f1', fontSize: 11, cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => toggleRegra(r.id, r.ativo)} style={{ padding: '4px 10px', borderRadius: 6, background: r.ativo ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', border: 'none', color: r.ativo ? '#f59e0b' : '#10b981', fontSize: 11, cursor: 'pointer' }}>{r.ativo ? 'Pausar' : 'Ativar'}</button>
                  <button onClick={() => excluirRegra(r.id)} style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>
                    <TrashIcon style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

// ─── Modal: Gestores WhatsApp ─────────────────────────────────────────────────
function ModalGestores({ onClose, workspaceId }) {
  const [gestores, setGestores]     = useState([])
  const [loadingG, setLoadingG]     = useState(true)
  const [saving, setSaving]         = useState(false)
  const [editando, setEditando]     = useState(null) // { id?, nome, telefone, audio, texto, link }
  const [form, setForm]             = useState({ nome: '', telefone: '', audio_habilitado: false, texto_habilitado: false, link_habilitado: true })

  const carregar = async () => {
    setLoadingG(true)
    const { data } = await supabase
      .from('agenda_gestores')
      .select('*')
      .order('nome')
    setGestores(data || [])
    setLoadingG(false)
  }

  useEffect(() => { carregar() }, [])

  const novoForm = () => {
    setEditando({ id: null })
    setForm({ nome: '', telefone: '', audio_habilitado: false, texto_habilitado: false, link_habilitado: true })
  }

  const editarForm = (g) => {
    setEditando({ id: g.id })
    setForm({ nome: g.nome, telefone: g.telefone, audio_habilitado: g.audio_habilitado, texto_habilitado: g.texto_habilitado, link_habilitado: g.link_habilitado })
  }

  const cancelarForm = () => {
    setEditando(null)
    setForm({ nome: '', telefone: '', audio_habilitado: false, texto_habilitado: false, link_habilitado: true })
  }

  const salvar = async () => {
    if (!form.nome.trim() || !form.telefone.trim()) {
      toast.error('Nome e telefone são obrigatórios')
      return
    }
    const tel = form.telefone.replace(/\D/g, '')
    if (tel.length < 10) { toast.error('Telefone inválido'); return }
    const telNorm = tel.startsWith('55') ? tel : '55' + tel

    setSaving(true)
    try {
      const payload = {
        nome:             form.nome.trim(),
        telefone:         telNorm,
        audio_habilitado: form.audio_habilitado,
        texto_habilitado: form.texto_habilitado,
        link_habilitado:  form.link_habilitado,
        workspace_id:     workspaceId,
        ativo:            true,
        updated_at:       new Date().toISOString(),
      }
      if (editando.id) {
        const { error } = await supabase.from('agenda_gestores').update(payload).eq('id', editando.id)
        if (error) throw error
        toast.success('Gestor atualizado!')
      } else {
        const { error } = await supabase.from('agenda_gestores').insert(payload)
        if (error) throw error
        toast.success('Gestor cadastrado!')
      }
      cancelarForm()
      carregar()
    } catch (e) {
      toast.error(e.message?.includes('unique') ? 'Telefone já cadastrado' : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const remover = async (id) => {
    if (!confirm('Remover este gestor? Ele não poderá mais criar agendamentos via WhatsApp.')) return
    await supabase.from('agenda_gestores').delete().eq('id', id)
    toast.success('Gestor removido')
    carregar()
  }

  const toggleAtivo = async (g) => {
    await supabase.from('agenda_gestores').update({ ativo: !g.ativo, updated_at: new Date().toISOString() }).eq('id', g.id)
    carregar()
  }

  const inp = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <UsersIcon style={{ width: 18, height: 18, color: '#0ea5e9' }} />
              <span style={{ fontWeight: 700, fontSize: 16 }}>Gestores WhatsApp</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Cadastre os números que podem criar agendamentos via bot (áudio, texto ou link).
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Formulário de adição/edição */}
        {editando ? (
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'rgba(14,165,233,0.05)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: '#0ea5e9' }}>
              {editando.id ? '✏️ Editar Gestor' : '➕ Novo Gestor'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>NOME</label>
                <input style={inp} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do gestor" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>TELEFONE (WhatsApp)</label>
                <input style={inp} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="Ex: 5511999999999" />
              </div>
            </div>

            {/* Flags de modalidade */}
            <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>MODALIDADES HABILITADAS</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {[
                { key: 'audio_habilitado', icon: <MicrophoneIcon style={{ width: 14, height: 14 }} />, label: 'Áudio', desc: 'Cria agendamento enviando nota de voz' },
                { key: 'texto_habilitado', icon: <ChatBubbleOvalLeftEllipsisIcon style={{ width: 14, height: 14 }} />, label: 'Texto', desc: 'Cria agendamento enviando mensagem de texto' },
                { key: 'link_habilitado',  icon: <LinkIcon style={{ width: 14, height: 14 }} />, label: 'Link', desc: 'Recebe link de formulário para preencher' },
              ].map(({ key, icon, label, desc }) => (
                <div
                  key={key}
                  onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    padding: '8px 14px', borderRadius: 8, border: `1px solid ${form[key] ? 'rgba(14,165,233,0.5)' : 'var(--border)'}`,
                    background: form[key] ? 'rgba(14,165,233,0.1)' : 'var(--bg-card)',
                    color: form[key] ? '#38bdf8' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
                    userSelect: 'none', transition: 'all 0.15s',
                  }}
                >
                  {icon} {label}
                  {form[key] && <span style={{ fontSize: 11, color: '#34d399' }}>✓</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={cancelarForm} style={{ padding: '8px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, background: '#0ea5e9', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <button onClick={novoForm} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)', color: '#38bdf8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <PlusIcon style={{ width: 14, height: 14 }} /> Adicionar Gestor
            </button>
          </div>
        )}

        {/* Lista de gestores */}
        <div style={{ padding: '8px 16px 20px' }}>
          {loadingG ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</div>
          ) : gestores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)', fontSize: 13 }}>
              Nenhum gestor cadastrado ainda.
            </div>
          ) : gestores.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', borderBottom: '1px solid var(--border)', opacity: g.ativo ? 1 : 0.5 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: g.ativo ? 'rgba(14,165,233,0.15)' : 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UserIcon style={{ width: 16, height: 16, color: g.ativo ? '#38bdf8' : 'var(--text-secondary)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{g.nome}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{g.telefone}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {g.audio_habilitado && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>🎤 Áudio</span>
                  )}
                  {g.texto_habilitado && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>💬 Texto</span>
                  )}
                  {g.link_habilitado && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(14,165,233,0.15)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.2)' }}>🔗 Link</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => toggleAtivo(g)}
                  title={g.ativo ? 'Desativar' : 'Ativar'}
                  style={{ padding: '5px 8px', borderRadius: 6, background: g.ativo ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${g.ativo ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, cursor: 'pointer', color: g.ativo ? '#34d399' : '#f87171', fontSize: 11, fontWeight: 700 }}
                >
                  {g.ativo ? 'Ativo' : 'Inativo'}
                </button>
                <button onClick={() => editarForm(g)} title="Editar" style={{ padding: 6, borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <PencilIcon style={{ width: 13, height: 13 }} />
                </button>
                <button onClick={() => remover(g.id)} title="Remover" style={{ padding: 6, borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', color: '#f87171' }}>
                  <TrashIcon style={{ width: 13, height: 13 }} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Legenda */}
        <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong>🎤 Áudio</strong> — Gestor envia nota de voz; IA transcreve e cria o agendamento automaticamente.<br />
          <strong>💬 Texto</strong> — Gestor envia mensagem de texto; IA interpreta e cria o agendamento.<br />
          <strong>🔗 Link</strong> — Gestor recebe um link de formulário para preencher manualmente.
        </div>
      </div>
    </div>
  )
}

export default function AgendaServicos() {
  const { workspaceId } = useStore()
  const [agendamentos, setAgendamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalNovo, setModalNovo] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [modalDetalhes, setModalDetalhes] = useState(null)
  const [modalRegras, setModalRegras] = useState(false)
  const [modalGestores, setModalGestores] = useState(false)
  const [linkGerado, setLinkGerado] = useState(null)
  const [gerandoLink, setGerandoLink] = useState(false)
  const [filtros, setFiltros] = useState({ periodo: '', cliente: '', tipo: '', status: '', responsavel: '', motorista: '', veiculo: '', alertaStatus: '' })
  const [busca, setBusca] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('agendamentos_servicos')
        .select(`
          *,
          agendamento_alertas (id, status, horario_previsto_envio, enviado_em, destinatario_nome, destinatario_tipo)
        `)
        .order('data_servico', { ascending: true })
        .order('horario_servico', { ascending: true })
      if (error) throw error
      setAgendamentos(data || [])
    } catch (e) {
      toast.error('Erro ao carregar agendamentos')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ── Estatísticas ────────────────────────────────────────────────────────────
  const hoje = new Date().toISOString().slice(0, 10)
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const stats = {
    hoje: agendamentos.filter(a => a.data_servico === hoje && !['cancelado', 'concluido'].includes(a.status)).length,
    amanha: agendamentos.filter(a => a.data_servico === amanha && !['cancelado', 'concluido'].includes(a.status)).length,
    proximos7: agendamentos.filter(a => a.data_servico > hoje && a.data_servico <= em7dias && !['cancelado', 'concluido'].includes(a.status)).length,
    alertasPendentes: agendamentos.flatMap(a => a.agendamento_alertas || []).filter(al => al.status === 'pendente').length,
    alertasEnviados: agendamentos.flatMap(a => a.agendamento_alertas || []).filter(al => al.status === 'enviado' || al.status === 'reenviado').length,
    falhas: agendamentos.flatMap(a => a.agendamento_alertas || []).filter(al => al.status === 'falha').length,
    concluidos: agendamentos.filter(a => a.status === 'concluido').length,
  }

  // ── Filtrar ─────────────────────────────────────────────────────────────────
  const filtrados = agendamentos.filter(a => {
    const buscaLow = busca.toLowerCase()
    if (busca && !`${a.cliente_nome} ${a.tipo_servico} ${a.atividade} ${a.responsavel_nome} ${a.motorista_nome} ${a.veiculo_nome} ${a.origem} ${a.destino}`.toLowerCase().includes(buscaLow)) return false
    if (filtros.periodo === 'hoje' && a.data_servico !== hoje) return false
    if (filtros.periodo === 'amanha' && a.data_servico !== amanha) return false
    if (filtros.periodo === 'semana' && (a.data_servico <= hoje || a.data_servico > em7dias)) return false
    if (filtros.cliente && !a.cliente_nome?.toLowerCase().includes(filtros.cliente.toLowerCase())) return false
    if (filtros.tipo && a.tipo_servico !== filtros.tipo) return false
    if (filtros.status && a.status !== filtros.status) return false
    if (filtros.responsavel && !a.responsavel_nome?.toLowerCase().includes(filtros.responsavel.toLowerCase())) return false
    if (filtros.motorista && !a.motorista_nome?.toLowerCase().includes(filtros.motorista.toLowerCase())) return false
    if (filtros.veiculo && !a.veiculo_nome?.toLowerCase().includes(filtros.veiculo.toLowerCase())) return false
    if (filtros.alertaStatus) {
      const temAlerta = (a.agendamento_alertas || []).some(al => al.status === filtros.alertaStatus)
      if (!temAlerta) return false
    }
    return true
  })

  // ── Ações ───────────────────────────────────────────────────────────────────
  async function mudarStatus(id, novoStatus) {
    const confirmacaoNecessaria = novoStatus === 'cancelado' || novoStatus === 'concluido'
    if (confirmacaoNecessaria && !window.confirm(`Confirma marcar como "${STATUS_CONFIG[novoStatus]?.label}"?`)) return
    try {
      await supabase.from('agendamentos_servicos').update({ status: novoStatus }).eq('id', id)
      await supabase.from('agendamento_historico').insert({
        agendamento_id: id,
        tipo_evento: novoStatus === 'cancelado' ? 'cancelamento' : novoStatus === 'concluido' ? 'conclusao' : novoStatus,
        descricao: `Status alterado para "${STATUS_CONFIG[novoStatus]?.label}"`,
        usuario_nome: 'Usuário',
      })
      if (novoStatus === 'cancelado') {
        await supabase.from('agendamento_alertas').update({ status: 'cancelado', ativo: false }).eq('agendamento_id', id).eq('status', 'pendente')
      }
      toast.success(`Agendamento ${STATUS_CONFIG[novoStatus]?.label}`)
      carregar()
      setModalDetalhes(null)
    } catch (e) {
      toast.error('Erro ao atualizar status')
    }
  }

  async function enviarWAManual(agendamento) {
    const wa = agendamento.responsavel_whatsapp || agendamento.motorista_whatsapp || agendamento.whatsapp_cliente
    if (!wa) return toast.error('Nenhum número WhatsApp cadastrado')
    const phone = normalizarTelefone(wa)
    if (!phone) return toast.error('Número inválido')
    const link = waLink(wa)
    if (link) window.open(link, '_blank')
  }

  async function gerarLinkExterno() {
    setGerandoLink(true)
    setLinkGerado(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/agenda-link', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setLinkGerado(json.url)
    } catch (e) {
      toast.error('Erro ao gerar link: ' + e.message)
    } finally {
      setGerandoLink(false)
    }
  }

  async function excluirAgendamento(id) {
    if (!window.confirm('Excluir este agendamento? Esta ação não pode ser desfeita.')) return
    await supabase.from('agendamentos_servicos').delete().eq('id', id)
    toast.success('Agendamento excluído')
    carregar()
  }

  // ── Destaque de linha ───────────────────────────────────────────────────────
  function rowHighlight(ag) {
    if (ag.data_servico === hoje && !['cancelado', 'concluido'].includes(ag.status)) return 'rgba(0,200,150,0.04)'
    if ((ag.agendamento_alertas || []).some(al => al.status === 'falha')) return 'rgba(239,68,68,0.04)'
    return 'transparent'
  }

  // ── Alerta principal do agendamento ─────────────────────────────────────────
  function alertaPrincipal(ag) {
    const alertas = ag.agendamento_alertas || []
    return alertas.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        title="Agendamentos"
        subtitle="Gerencie agendamentos operacionais com alertas automáticos WhatsApp"
        action={{ label: 'Novo Agendamento', onClick: () => setModalNovo(true) }}
      />

      <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Cards de estatística ── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard icon={CalendarDaysIcon} label="Hoje" value={stats.hoje} color="#00c896" highlight={stats.hoje > 0} onClick={() => setFiltros(f => ({ ...f, periodo: f.periodo === 'hoje' ? '' : 'hoje' }))} />
          <StatCard icon={CalendarDaysIcon} label="Amanhã" value={stats.amanha} color="#6366f1" onClick={() => setFiltros(f => ({ ...f, periodo: f.periodo === 'amanha' ? '' : 'amanha' }))} />
          <StatCard icon={CalendarDaysIcon} label="Próximos 7 dias" value={stats.proximos7} color="#0ea5e9" onClick={() => setFiltros(f => ({ ...f, periodo: f.periodo === 'semana' ? '' : 'semana' }))} />
          <StatCard icon={BellAlertIcon} label="Alertas Pendentes" value={stats.alertasPendentes} color="#f59e0b" highlight={stats.alertasPendentes > 0} onClick={() => setFiltros(f => ({ ...f, alertaStatus: f.alertaStatus === 'pendente' ? '' : 'pendente' }))} />
          <StatCard icon={ChatBubbleLeftRightIcon} label="Alertas Enviados" value={stats.alertasEnviados} color="#10b981" onClick={() => setFiltros(f => ({ ...f, alertaStatus: f.alertaStatus === 'enviado' ? '' : 'enviado' }))} />
          <StatCard icon={ExclamationTriangleIcon} label="Falhas de Envio" value={stats.falhas} color="#ef4444" highlight={stats.falhas > 0} onClick={() => setFiltros(f => ({ ...f, alertaStatus: f.alertaStatus === 'falha' ? '' : 'falha' }))} />
          <StatCard icon={CheckCircleIcon} label="Concluídos" value={stats.concluidos} color="#64748b" onClick={() => setFiltros(f => ({ ...f, status: f.status === 'concluido' ? '' : 'concluido' }))} />
        </div>

        {/* ── Barra de busca + botões ── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <MagnifyingGlassIcon style={{ width: 15, height: 15, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por cliente, tipo, motorista, veículo..."
              style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px 8px 36px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
          </div>
          <button onClick={() => setShowFiltros(f => !f)} style={{ padding: '8px 14px', borderRadius: 8, background: showFiltros ? 'rgba(99,102,241,0.15)' : 'var(--bg-card)', border: `1px solid ${showFiltros ? 'rgba(99,102,241,0.4)' : 'var(--border)'}`, color: showFiltros ? '#6366f1' : 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <FunnelIcon style={{ width: 14, height: 14 }} /> Filtros
          </button>
          <button onClick={() => setModalRegras(true)} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <AdjustmentsHorizontalIcon style={{ width: 14, height: 14 }} /> Regras WA
          </button>
          <button onClick={() => setModalGestores(true)} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <UsersIcon style={{ width: 14, height: 14 }} /> Gestores WA
          </button>
          <button onClick={gerarLinkExterno} disabled={gerandoLink} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <LinkIcon style={{ width: 14, height: 14 }} /> {gerandoLink ? 'Gerando...' : 'Link Externo'}
          </button>
          <button onClick={carregar} style={{ padding: '8px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <ArrowPathIcon style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* ── Link externo gerado ── */}
        {linkGerado && (
          <div style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>🔗 Link público (válido 7 dias):</span>
            <code style={{ fontSize: 11, color: '#38bdf8', wordBreak: 'break-all', flex: 1 }}>{linkGerado}</code>
            <button onClick={() => { navigator.clipboard.writeText(linkGerado); toast.success('Link copiado!') }} style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', color: '#38bdf8', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Copiar
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent('📋 Formulário de Agendamento:\n' + linkGerado)}`} target="_blank" rel="noreferrer" style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', color: '#25d366', fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Enviar WA
            </a>
            <button onClick={() => setLinkGerado(null)} style={{ padding: '4px 8px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* ── Painel de filtros ── */}
        {showFiltros && (
          <div style={{ padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Período</label>
              <select value={filtros.periodo} onChange={e => setFiltros(f => ({ ...f, periodo: e.target.value }))} style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12 }}>
                <option value="">Todos</option>
                <option value="hoje">Hoje</option>
                <option value="amanha">Amanhã</option>
                <option value="semana">Próximos 7 dias</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Status</label>
              <select value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12 }}>
                <option value="">Todos</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Tipo de Serviço</label>
              <select value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))} style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12 }}>
                <option value="">Todos</option>
                {TIPOS_SERVICO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>WhatsApp</label>
              <select value={filtros.alertaStatus} onChange={e => setFiltros(f => ({ ...f, alertaStatus: e.target.value }))} style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12 }}>
                <option value="">Todos</option>
                {Object.entries(ALERTA_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            {[
              { key: 'cliente', label: 'Cliente', placeholder: 'Filtrar...' },
              { key: 'responsavel', label: 'Responsável', placeholder: 'Filtrar...' },
              { key: 'motorista', label: 'Motorista', placeholder: 'Filtrar...' },
              { key: 'veiculo', label: 'Veículo', placeholder: 'Filtrar...' },
            ].map(fi => (
              <div key={fi.key}>
                <label style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>{fi.label}</label>
                <input value={filtros[fi.key]} onChange={e => setFiltros(f => ({ ...f, [fi.key]: e.target.value }))} placeholder={fi.placeholder} style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12 }} />
              </div>
            ))}
            <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setFiltros({ periodo: '', cliente: '', tipo: '', status: '', responsavel: '', motorista: '', veiculo: '', alertaStatus: '' })} style={{ padding: '5px 14px', borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 12, cursor: 'pointer' }}>
                Limpar filtros
              </button>
            </div>
          </div>
        )}

        {/* ── Tabela ── */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Cabeçalho da tabela */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {filtrados.length} agendamento{filtrados.length !== 1 ? 's' : ''}
            </span>
            {(busca || Object.values(filtros).some(Boolean)) && (
              <button onClick={() => { setBusca(''); setFiltros({ periodo: '', cliente: '', tipo: '', status: '', responsavel: '', motorista: '', veiculo: '', alertaStatus: '' }) }} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                Limpar filtros
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <ArrowPathIcon style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.4, animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: 13 }}>Carregando agendamentos...</p>
              </div>
            ) : filtrados.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <CalendarDaysIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.3 }} />
                <p style={{ fontSize: 14, fontWeight: 600 }}>Nenhum agendamento encontrado</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>Crie o primeiro agendamento clicando em "Novo Agendamento"</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {['Data/Hora', 'Cliente', 'Tipo de Serviço', 'Atividade', 'Origem → Destino', 'Responsável', 'Motorista', 'Veículo', 'Status', 'WhatsApp', 'Ações'].map(col => (
                      <th key={col} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(ag => {
                    const alerta = alertaPrincipal(ag)
                    const isHoje = ag.data_servico === hoje
                    const isFalha = (ag.agendamento_alertas || []).some(al => al.status === 'falha')
                    return (
                      <tr key={ag.id} style={{ background: rowHighlight(ag), borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = rowHighlight(ag)}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isHoje ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {fmtDate(ag.data_servico)}
                          </div>
                          {ag.horario_servico && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{ag.horario_servico.slice(0,5)}</div>}
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 150 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.cliente_nome}</div>
                          {ag.contato_cliente && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{ag.contato_cliente}</div>}
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 160, whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>🚛 {ag.tipo_servico}</div>
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 130 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.atividade || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 160 }}>
                          {ag.origem || ag.destino ? (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {ag.origem && <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPinIcon style={{ width: 10, height: 10 }} />{ag.origem}</div>}
                              {ag.destino && <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>→ {ag.destino}</div>}
                            </div>
                          ) : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 120 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.responsavel_nome || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 120 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.motorista_nome || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 110 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.veiculo_nome || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <StatusChip status={ag.status} />
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {alerta ? (
                            <div>
                              <AlertaChip status={alerta.status} />
                              {isFalha && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>⚠ Falha</div>}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Sem alerta</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                            <button title="Ver detalhes" onClick={() => setModalDetalhes(ag)} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(99,102,241,0.1)', border: 'none', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <EyeIcon style={{ width: 13, height: 13 }} />
                            </button>
                            <button title="Editar" onClick={() => setModalEditar(ag)} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(245,158,11,0.1)', border: 'none', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <PencilIcon style={{ width: 13, height: 13 }} />
                            </button>
                            {!['cancelado', 'concluido'].includes(ag.status) && (
                              <button title="Concluir" onClick={() => mudarStatus(ag.id, 'concluido')} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CheckCircleIcon style={{ width: 13, height: 13 }} />
                              </button>
                            )}
                            {!['cancelado', 'concluido'].includes(ag.status) && (
                              <button title="Cancelar" onClick={() => mudarStatus(ag.id, 'cancelado')} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <XCircleIcon style={{ width: 13, height: 13 }} />
                              </button>
                            )}
                            {(ag.responsavel_whatsapp || ag.motorista_whatsapp || ag.whatsapp_cliente) && (
                              <button title="Abrir WhatsApp" onClick={() => enviarWAManual(ag)} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(37,211,102,0.1)', border: 'none', color: '#25d366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <DevicePhoneMobileIcon style={{ width: 13, height: 13 }} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Modais ── */}
      {modalNovo && (
        <ModalAgendamento
          onClose={() => setModalNovo(false)}
          onSaved={() => { setModalNovo(false); carregar() }}
          workspaceId={workspaceId}
        />
      )}
      {modalEditar && (
        <ModalAgendamento
          agendamento={modalEditar}
          onClose={() => setModalEditar(null)}
          onSaved={() => { setModalEditar(null); carregar() }}
          workspaceId={workspaceId}
        />
      )}
      {modalDetalhes && (
        <ModalDetalhes
          agendamento={modalDetalhes}
          onClose={() => setModalDetalhes(null)}
          onEdit={ag => { setModalDetalhes(null); setModalEditar(ag) }}
          onStatusChange={mudarStatus}
        />
      )}
      {modalRegras && (
        <ModalRegras
          onClose={() => setModalRegras(false)}
          workspaceId={workspaceId}
        />
      )}
      {modalGestores && (
        <ModalGestores
          onClose={() => setModalGestores(false)}
          workspaceId={workspaceId}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
