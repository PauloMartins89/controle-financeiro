/**
 * AgendaServicosERP.jsx
 * Visão ERP 3 painéis: Pipeline (esq.) | Lista (centro) | Detalhes (dir.)
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import useStore from '../store/useStore'
import toast from 'react-hot-toast'
import {
  CalendarDaysIcon, CheckCircleIcon, XCircleIcon,
  PencilIcon, ArrowPathIcon, BellAlertIcon,
  MagnifyingGlassIcon, MapPinIcon, PlayIcon,
  DevicePhoneMobileIcon, PlusIcon, XMarkIcon,
  TrashIcon, ExclamationTriangleIcon, ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'

// ─── Constantes ────────────────────────────────────────────────────────────────
const TIPOS_SERVICO = [
  'Caminhão Prancha', 'Caminhão Munck', 'Guindaste', 'Caminhão Basculante',
  'Betoneira', 'Retroescavadeira', 'Motoniveladora', 'Pá Carregadeira',
  'Trator', 'Escavadeira Hidráulica', 'Caminhão Pipa', 'Caminhão Tanque',
  'Ambulância / UTI Móvel', 'Reboque / Guincho', 'Caminhão Baú',
  'Caminhão Refrigerado', 'Plataforma Elevatória', 'Caminhão Cegonha',
  'Locação de Equipamento', 'Transporte Especial', 'Outro',
]

const ANTECEDENCIAS = [
  { label: '10 minutos', value: 10 },
  { label: '30 minutos', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
  { label: '3 horas', value: 180 },
  { label: '6 horas', value: 360 },
  { label: '12 horas', value: 720 },
  { label: '1 dia', value: 1440 },
  { label: '2 dias', value: 2880 },
]

const STATUS_CONFIG = {
  agendado:                  { label: 'Agendado',          color: '#6366f1', bg: 'rgba(99,102,241,0.12)',   icon: '🗓' },
  alerta_pendente:           { label: 'Alerta Pendente',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '⏳' },
  alerta_enviado:            { label: 'Alerta Enviado',    color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  icon: '📤' },
  confirmado:                { label: 'Confirmado',        color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: '✅' },
  ajuste_solicitado:         { label: 'Ajuste Solic.',     color: '#f97316', bg: 'rgba(249,115,22,0.12)',  icon: '⚠️' },
  reagendamento_solicitado:  { label: 'Reagendamento',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: '🔄' },
  em_execucao:               { label: 'Em Execução',       color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   icon: '▶️' },
  concluido:                 { label: 'Concluído',         color: '#10b981', bg: 'rgba(16,185,129,0.15)',  icon: '🏁' },
  cancelado:                 { label: 'Cancelado',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '✖' },
}

const ALERTA_STATUS_CONFIG = {
  pendente:   { label: 'Pendente',   color: '#f59e0b', icon: '⏳' },
  enviado:    { label: 'Enviado',    color: '#0ea5e9', icon: '📤' },
  confirmado: { label: 'Confirmado', color: '#10b981', icon: '✅' },
  falha:      { label: 'Falha',      color: '#ef4444', icon: '❌' },
  reenviado:  { label: 'Reenviado',  color: '#8b5cf6', icon: '🔄' },
  cancelado:  { label: 'Cancelado',  color: '#94a3b8', icon: '🚫' },
}

const PIPELINE = [
  { key: 'todos',                    label: 'Todos',            color: '#6366f1', icon: '📋' },
  { key: '__sep_periodo__',          sep: true,                 label: 'Período' },
  { key: 'hoje',                     label: 'Hoje',             color: '#00c896', icon: '📅', periodo: true },
  { key: 'amanha',                   label: 'Amanhã',           color: '#6366f1', icon: '📆', periodo: true },
  { key: 'semana',                   label: 'Próx. 7 dias',     color: '#0ea5e9', icon: '🗓', periodo: true },
  { key: '__sep_status__',           sep: true,                 label: 'Por Status' },
  { key: 'agendado',                 label: 'Agendado',         color: '#6366f1', icon: '🗓' },
  { key: 'alerta_pendente',          label: 'Alerta Pendente',  color: '#f59e0b', icon: '⏳' },
  { key: 'alerta_enviado',           label: 'Alerta Enviado',   color: '#0ea5e9', icon: '📤' },
  { key: 'confirmado',               label: 'Confirmado',       color: '#10b981', icon: '✅' },
  { key: 'em_execucao',              label: 'Em Execução',      color: '#06b6d4', icon: '▶️' },
  { key: 'ajuste_solicitado',        label: 'Ajuste Solic.',    color: '#f97316', icon: '⚠️' },
  { key: 'reagendamento_solicitado', label: 'Reagendamento',    color: '#8b5cf6', icon: '🔄' },
  { key: 'concluido',                label: 'Concluído',        color: '#10b981', icon: '🏁' },
  { key: 'cancelado',                label: 'Cancelado',        color: '#ef4444', icon: '✖' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────
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
  return '55' + digits
}

function waLink(phone) {
  const n = normalizarTelefone(phone)
  return n ? `https://wa.me/${n}` : null
}

function calcHorarioAlerta(dataServico, horarioServico, antecedenciaMinutos) {
  if (!dataServico) return null
  const baseStr = horarioServico ? `${dataServico}T${horarioServico}` : `${dataServico}T08:00:00`
  const base = new Date(baseStr)
  return new Date(base.getTime() - antecedenciaMinutos * 60 * 1000).toISOString()
}

// ─── Chips ────────────────────────────────────────────────────────────────────
function StatusChip({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: '' }
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function AlertaChip({ status }) {
  const cfg = ALERTA_STATUS_CONFIG[status] || { label: status || '—', color: '#94a3b8', icon: '📋' }
  return (
    <span style={{ fontSize: 11, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.icon} {cfg.label}</span>
  )
}

// ─── Modal: Novo / Editar Agendamento ─────────────────────────────────────────
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
    ativar_alerta: true, destinatario_tipo: 'responsavel',
    destinatario_nome: '', destinatario_whatsapp: '',
    antecedencia_minutos: 180, solicitar_confirmacao: false,
    reenviar_se_nao_confirmar: false, max_tentativas: 3, intervalo_reenvio_min: 60,
  }

  const [form, setForm] = useState(agendamento ? {
    ...empty, ...agendamento,
    ativar_alerta: true, destinatario_tipo: 'responsavel',
    destinatario_nome: agendamento.responsavel_nome || '',
    destinatario_whatsapp: agendamento.responsavel_whatsapp || '',
    antecedencia_minutos: 180, solicitar_confirmacao: false,
    reenviar_se_nao_confirmar: false, max_tentativas: 3, intervalo_reenvio_min: 60,
  } : empty)

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  useEffect(() => {
    if (form.destinatario_tipo === 'responsavel')
      setForm(f => ({ ...f, destinatario_nome: f.responsavel_nome, destinatario_whatsapp: f.responsavel_whatsapp }))
    else if (form.destinatario_tipo === 'motorista')
      setForm(f => ({ ...f, destinatario_nome: f.motorista_nome, destinatario_whatsapp: f.motorista_whatsapp }))
    else if (form.destinatario_tipo === 'cliente')
      setForm(f => ({ ...f, destinatario_nome: f.cliente_nome, destinatario_whatsapp: f.whatsapp_cliente }))
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
        const { error } = await supabase.from('agendamentos_servicos').update(payload).eq('id', agendamento.id)
        if (error) throw error
        agendamentoId = agendamento.id
        await supabase.from('agendamento_historico').insert({
          agendamento_id: agendamentoId, tipo_evento: 'edicao',
          descricao: `Agendamento editado por ${payload.criado_por_nome || 'usuário'}`,
          usuario_nome: payload.criado_por_nome,
        })
      } else {
        const { data: novo, error } = await supabase.from('agendamentos_servicos').insert(payload).select().single()
        if (error) throw error
        agendamentoId = novo.id
        await supabase.from('agendamento_historico').insert({
          agendamento_id: agendamentoId, tipo_evento: 'criacao',
          descricao: `Agendamento criado por ${payload.criado_por_nome || 'usuário'}`,
          usuario_nome: payload.criado_por_nome,
        })
      }

      if (form.ativar_alerta && form.destinatario_whatsapp) {
        const horarioPrevisto = calcHorarioAlerta(form.data_servico, form.horario_servico, form.antecedencia_minutos)
        if (horarioPrevisto) {
          await supabase.from('agendamento_alertas').insert({
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
            idempotency_key: `${agendamentoId}_${form.destinatario_whatsapp}_${form.antecedencia_minutos}_${Date.now()}`,
            ativo: true,
          })
          await supabase.from('agendamentos_servicos').update({ status: 'alerta_pendente' }).eq('id', agendamentoId)
        }
      }

      toast.success(agendamento?.id ? 'Agendamento atualizado!' : 'Agendamento criado!')
      onSaved()
    } catch (e) {
      toast.error('Erro ao salvar: ' + (e.message || 'Desconhecido'))
    } finally {
      setSaving(false)
    }
  }

  const inp = { width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }
  const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 760, width: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{agendamento ? 'Editar Agendamento' : 'Novo Agendamento'}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Preencha os dados do serviço a ser realizado</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', flexShrink: 0 }}>
          {[{ key: 'servico', label: '📋 Serviço' }, { key: 'operacional', label: '⚙️ Operacional' }, { key: 'alerta', label: '🔔 WhatsApp' }].map(ab => (
            <button key={ab.key} onClick={() => setAba(ab.key)} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${aba === ab.key ? 'var(--accent)' : 'transparent'}`, color: aba === ab.key ? 'var(--accent)' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
              {ab.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {aba === 'servico' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Cliente *</label><input style={inp} value={form.cliente_nome} onChange={e => set('cliente_nome', e.target.value)} placeholder="Nome do cliente" /></div>
                <div>
                  <label style={lbl}>Tipo de Serviço *</label>
                  <select style={inp} value={form.tipo_servico} onChange={e => set('tipo_servico', e.target.value)}>
                    <option value="">Selecione...</option>
                    {TIPOS_SERVICO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={lbl}>Atividade / Finalidade</label><input style={inp} value={form.atividade} onChange={e => set('atividade', e.target.value)} placeholder="Ex: Transporte de máquina, movimentação de cargas..." /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12 }}>
                <div><label style={lbl}>Data do Serviço *</label><input type="date" style={inp} value={form.data_servico} onChange={e => set('data_servico', e.target.value)} /></div>
                <div><label style={lbl}>Horário</label><input type="time" style={inp} value={form.horario_servico} onChange={e => set('horario_servico', e.target.value)} /></div>
                <div><label style={lbl}>Duração (min)</label><input type="number" style={inp} value={form.previsao_duracao_min} onChange={e => set('previsao_duracao_min', e.target.value)} placeholder="480" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Origem</label><input style={inp} value={form.origem} onChange={e => set('origem', e.target.value)} placeholder="Local de saída" /></div>
                <div><label style={lbl}>Destino</label><input style={inp} value={form.destino} onChange={e => set('destino', e.target.value)} placeholder="Local de chegada" /></div>
              </div>
              <div><label style={lbl}>Descrição</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.descricao} onChange={e => set('descricao', e.target.value)} /></div>
              <div><label style={lbl}>Observações</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.observacao} onChange={e => set('observacao', e.target.value)} /></div>
            </div>
          )}

          {aba === 'operacional' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Responsável Interno</label><input style={inp} value={form.responsavel_nome} onChange={e => set('responsavel_nome', e.target.value)} placeholder="Nome do responsável" /></div>
                <div><label style={lbl}>WhatsApp do Responsável</label><input style={inp} value={form.responsavel_whatsapp} onChange={e => set('responsavel_whatsapp', e.target.value)} placeholder="67999999999" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Motorista / Operador</label><input style={inp} value={form.motorista_nome} onChange={e => set('motorista_nome', e.target.value)} placeholder="Nome do motorista" /></div>
                <div><label style={lbl}>WhatsApp do Motorista</label><input style={inp} value={form.motorista_whatsapp} onChange={e => set('motorista_whatsapp', e.target.value)} placeholder="67999999999" /></div>
              </div>
              <div><label style={lbl}>Veículo / Equipamento</label><input style={inp} value={form.veiculo_nome} onChange={e => set('veiculo_nome', e.target.value)} placeholder="Ex: Prancha 01, Munck 02..." /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={lbl}>Contato do Cliente</label><input style={inp} value={form.contato_cliente} onChange={e => set('contato_cliente', e.target.value)} /></div>
                <div><label style={lbl}>WhatsApp do Cliente</label><input style={inp} value={form.whatsapp_cliente} onChange={e => set('whatsapp_cliente', e.target.value)} placeholder="67999999999" /></div>
              </div>
            </div>
          )}

          {aba === 'alerta' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: form.ativar_alerta ? 'rgba(0,200,150,0.08)' : 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div onClick={() => set('ativar_alerta', !form.ativar_alerta)} style={{ width: 40, height: 22, borderRadius: 11, background: form.ativar_alerta ? 'var(--accent)' : 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
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
                      <label style={lbl}>Enviar para</label>
                      <select style={inp} value={form.destinatario_tipo} onChange={e => set('destinatario_tipo', e.target.value)}>
                        <option value="responsavel">Responsável interno</option>
                        <option value="motorista">Motorista</option>
                        <option value="cliente">Cliente</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="personalizado">Número personalizado</option>
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Antecedência</label>
                      <select style={inp} value={form.antecedencia_minutos} onChange={e => set('antecedencia_minutos', parseInt(e.target.value))}>
                        {ANTECEDENCIAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {(form.destinatario_tipo === 'supervisor' || form.destinatario_tipo === 'personalizado') && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div><label style={lbl}>Nome do destinatário</label><input style={inp} value={form.destinatario_nome} onChange={e => set('destinatario_nome', e.target.value)} /></div>
                      <div><label style={lbl}>Número WhatsApp *</label><input style={inp} value={form.destinatario_whatsapp} onChange={e => set('destinatario_whatsapp', e.target.value)} placeholder="67999999999" /></div>
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form.solicitar_confirmacao} onChange={e => set('solicitar_confirmacao', e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
                    <span style={{ color: 'var(--text-primary)' }}>Solicitar confirmação de ciência</span>
                  </label>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvando...' : agendamento ? 'Salvar Alterações' : 'Criar Agendamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Painel Direito: Detalhes ──────────────────────────────────────────────────
function PainelDetalhe({ ag, onClose, onEdit, onStatusChange, onNovoAgendamento }) {
  const [historico, setHistorico] = useState([])
  const [alertas, setAlertas] = useState([])
  const [loadingD, setLoadingD] = useState(false)
  const [tabD, setTabD] = useState('resumo')

  useEffect(() => {
    if (!ag?.id) return
    setLoadingD(true)
    setTabD('resumo')
    Promise.all([
      supabase.from('agendamento_historico').select('*').eq('agendamento_id', ag.id).order('data_evento', { ascending: false }),
      supabase.from('agendamento_alertas').select('*').eq('agendamento_id', ag.id).order('created_at', { ascending: false }),
    ]).then(([h, a]) => {
      setHistorico(h.data || [])
      setAlertas(a.data || [])
      setLoadingD(false)
    })
  }, [ag?.id])

  const tipoIcon = {
    criacao: '🟢', edicao: '✏️', alerta_configurado: '🔔', whatsapp_enviado: '📤',
    reenvio_whatsapp: '🔄', falha_whatsapp: '❌', confirmacao_recebida: '✅',
    ajuste_solicitado: '⚠️', cancelamento: '🚫', conclusao: '🏁', em_execucao: '▶️',
  }

  const cfg = ag ? (STATUS_CONFIG[ag.status] || { color: '#94a3b8' }) : { color: '#94a3b8' }
  const proximoAlerta = alertas.find(al => al.status === 'pendente' || al.status === 'agendado')

  // Placeholder quando nada selecionado
  if (!ag) {
    return (
      <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', padding: 24 }}>
        <CalendarDaysIcon style={{ width: 48, height: 48, opacity: 0.2 }} />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Nenhum agendamento selecionado</p>
          <p style={{ fontSize: 12 }}>Clique em uma linha da tabela para ver os detalhes.</p>
        </div>
        <button onClick={onNovoAgendamento} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <PlusIcon style={{ width: 14 }} /> Novo Agendamento
        </button>
      </div>
    )
  }

  const isAtrasado = ag.data_servico < new Date().toISOString().slice(0, 10) && !['cancelado','concluido'].includes(ag.status)

  return (
    <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Header do painel */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, borderTop: `3px solid ${cfg.color}`, background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Detalhes do agendamento</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 2 }}>
            <XMarkIcon style={{ width: 16 }} />
          </button>
        </div>

        {isAtrasado && (
          <div style={{ marginBottom: 8, padding: '6px 10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>⏰</span>
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>Atraso identificado</span>
          </div>
        )}

        <div style={{ marginBottom: 6 }}><StatusChip status={ag.status} /></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>🚛 {ag.tipo_servico}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {ag.cliente_nome} · {fmtDate(ag.data_servico)}{ag.horario_servico ? ` às ${ag.horario_servico.slice(0, 5)}` : ''}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-card)' }}>
        {[
          { key: 'resumo',         label: 'Resumo' },
          { key: 'comunicacoes',   label: `Comunicações${alertas.length > 0 ? ` (${alertas.length})` : ''}` },
          { key: 'historico',      label: 'Histórico' },
          { key: 'anexos',         label: 'Anexos' },
        ].map(t => (
          <button key={t.key} onClick={() => setTabD(t.key)} style={{ flex: 1, padding: '8px 4px', fontSize: 10, fontWeight: tabD === t.key ? 700 : 500, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${tabD === t.key ? 'var(--accent)' : 'transparent'}`, color: tabD === t.key ? 'var(--accent)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ─ Resumo ─ */}
        {tabD === 'resumo' && (
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Campo grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Data',       value: fmtDate(ag.data_servico) },
                { label: 'Horário',    value: ag.horario_servico?.slice(0,5) || '—' },
                { label: 'Cliente',    value: ag.cliente_nome },
                { label: 'Tipo',       value: ag.tipo_servico },
                { label: 'Atividade',  value: ag.atividade || '—' },
                { label: 'Veículo',    value: ag.veiculo_nome || '—' },
                { label: 'Motorista',  value: ag.motorista_nome || '—' },
                { label: 'Responsável',value: ag.responsavel_nome || '—' },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{f.value}</div>
                </div>
              ))}
            </div>

            {(ag.origem || ag.destino) && (
              <div style={{ padding: '9px 12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>Localização</div>
                {ag.origem && <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}><MapPinIcon style={{ width: 11 }} /> {ag.origem}</div>}
                {ag.destino && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>→ {ag.destino}</div>}
              </div>
            )}

            {ag.observacao && (
              <div style={{ padding: '9px 12px', background: 'var(--bg-secondary)', borderRadius: 8, borderLeft: '3px solid var(--border)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Observação</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{ag.observacao}</div>
              </div>
            )}

            {/* Próximas ações */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>Próximas ações</div>
              {proximoAlerta ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🔔</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Alerta agendado</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{fmtDateTime(proximoAlerta.horario_previsto_envio)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Para: {proximoAlerta.destinatario_nome || '—'}</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📭</span> Nenhum alerta pendente
                </div>
              )}
            </div>

            {/* Ações rápidas */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>Ações rápidas</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                <button onClick={() => onEdit(ag)} style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#6366f1', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <PencilIcon style={{ width: 12 }} /> Editar
                </button>
                {ag.responsavel_whatsapp && waLink(ag.responsavel_whatsapp) && (
                  <a href={waLink(ag.responsavel_whatsapp)} target="_blank" rel="noreferrer" style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', color: '#25d366', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                    <ChatBubbleLeftRightIcon style={{ width: 12 }} /> WhatsApp
                  </a>
                )}
                {!['em_execucao','concluido','cancelado'].includes(ag.status) && (
                  <button onClick={() => onStatusChange(ag.id, 'em_execucao')} style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: '#06b6d4', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <PlayIcon style={{ width: 12 }} /> Iniciar
                  </button>
                )}
                {ag.status === 'em_execucao' && (
                  <button onClick={() => onStatusChange(ag.id, 'concluido')} style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircleIcon style={{ width: 12 }} /> Concluir
                  </button>
                )}
                {!['cancelado','concluido'].includes(ag.status) && (
                  <button onClick={() => onStatusChange(ag.id, 'cancelado')} style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <XCircleIcon style={{ width: 12 }} /> Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─ Comunicações (alertas) ─ */}
        {tabD === 'comunicacoes' && (
          <div style={{ padding: '14px 16px' }}>
            {loadingD ? <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 24 }}>Carregando...</div>
            : alertas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                <BellAlertIcon style={{ width: 32, margin: '0 auto 8px', opacity: 0.3 }} />
                <p style={{ fontSize: 12 }}>Nenhum alerta configurado</p>
              </div>
            ) : alertas.map(al => (
              <div key={al.id} style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 8, border: `1px solid ${ALERTA_STATUS_CONFIG[al.status]?.color || '#94a3b8'}22` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{al.destinatario_nome || al.destinatario_whatsapp}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {ANTECEDENCIAS.find(a => a.value === al.antecedencia_minutos)?.label || al.antecedencia_minutos + ' min'} antes
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Envio: {fmtDateTime(al.horario_previsto_envio)}</div>
                    {al.enviado_em && <div style={{ fontSize: 10, color: '#10b981' }}>✓ {fmtDateTime(al.enviado_em)}</div>}
                    {al.erro_envio && <div style={{ fontSize: 10, color: '#ef4444' }}>⚠ {al.erro_envio}</div>}
                  </div>
                  <AlertaChip status={al.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─ Histórico ─ */}
        {tabD === 'historico' && (
          <div style={{ padding: '14px 16px' }}>
            {loadingD ? <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 24 }}>Carregando...</div>
            : historico.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 24 }}>Nenhum evento registrado</div>
            : historico.map((ev, i) => (
              <div key={ev.id} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                    {tipoIcon[ev.tipo_evento] || '📋'}
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
        )}

        {/* ─ Anexos ─ */}
        {tabD === 'anexos' && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: 36 }}>📎</span>
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 10, marginBottom: 4 }}>Nenhum anexo</p>
            <p style={{ fontSize: 12 }}>Anexos serão exibidos aqui quando disponíveis.</p>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Componente Principal ──────────────────────────────────────────────────────
export default function AgendaServicosERP() {
  const { workspaceId } = useStore()
  const [agendamentos, setAgendamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tabAtiva, setTabAtiva] = useState('todos')
  const [busca, setBusca] = useState('')
  const [selected, setSelected] = useState(null)
  const [modalNovo, setModalNovo] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)

  // filtros laterais
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [filtroStatus, setFiltroStatus] = useState([])
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroVeiculo, setFiltroVeiculo] = useState('')
  const [filtroMotorista, setFiltroMotorista] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroSalvo, setFiltroSalvo] = useState(false)

  const hoje = new Date().toISOString().slice(0, 10)
  const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const carregar = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('agendamentos_servicos')
        .select('*, agendamento_alertas(id, status, horario_previsto_envio, enviado_em, destinatario_nome, destinatario_tipo, antecedencia_minutos, erro_envio)')
        .eq('workspace_id', workspaceId)
        .order('data_servico', { ascending: true })
        .order('horario_servico', { ascending: true })
      if (error) throw error
      setAgendamentos(data || [])
    } catch {
      toast.error('Erro ao carregar agendamentos')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (selected) {
      const updated = agendamentos.find(a => a.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [agendamentos]) // eslint-disable-line

  // ── Contagens para KPIs e tabs ──
  const kpis = {
    hoje:      agendamentos.filter(a => a.data_servico === hoje && !['cancelado','concluido'].includes(a.status)).length,
    amanha:    agendamentos.filter(a => a.data_servico === amanha && !['cancelado','concluido'].includes(a.status)).length,
    prox7:     agendamentos.filter(a => a.data_servico > hoje && a.data_servico <= em7dias && !['cancelado','concluido'].includes(a.status)).length,
    atrasados: agendamentos.filter(a => a.data_servico < hoje && !['cancelado','concluido'].includes(a.status)).length,
    alertasEnviados: agendamentos.flatMap(a => a.agendamento_alertas || []).filter(al => al.status === 'enviado').length,
    falhas:    agendamentos.flatMap(a => a.agendamento_alertas || []).filter(al => al.status === 'falha').length,
    concluidos:agendamentos.filter(a => a.status === 'concluido').length,
    todos:     agendamentos.length,
  }

  // ── Filtro lateral + tab ──
  const filtrados = agendamentos.filter(a => {
    if (tabAtiva === 'atrasados' && !(a.data_servico < hoje && !['cancelado','concluido'].includes(a.status))) return false
    if (tabAtiva === 'hoje'      && a.data_servico !== hoje) return false
    if (tabAtiva === 'amanha'    && a.data_servico !== amanha) return false
    if (tabAtiva === 'prox7'     && !(a.data_servico > hoje && a.data_servico <= em7dias)) return false
    if (tabAtiva === 'concluidos'&& a.status !== 'concluido') return false
    if (periodoInicio && a.data_servico < periodoInicio) return false
    if (periodoFim    && a.data_servico > periodoFim)    return false
    if (filtroStatus.length > 0 && !filtroStatus.includes(a.status)) return false
    if (filtroTipo      && a.tipo_servico !== filtroTipo) return false
    if (filtroVeiculo   && !(a.veiculo_nome || '').toLowerCase().includes(filtroVeiculo.toLowerCase())) return false
    if (filtroMotorista && !(a.motorista_nome || '').toLowerCase().includes(filtroMotorista.toLowerCase())) return false
    if (filtroCliente   && !(a.cliente_nome || '').toLowerCase().includes(filtroCliente.toLowerCase())) return false
    if (busca) {
      const q = busca.toLowerCase()
      if (!`${a.cliente_nome} ${a.tipo_servico} ${a.atividade} ${a.responsavel_nome} ${a.motorista_nome} ${a.veiculo_nome} ${a.origem} ${a.destino}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  const veiculosDisponiveis  = [...new Set(agendamentos.map(a => a.veiculo_nome).filter(Boolean))]
  const motoristasDisponiveis = [...new Set(agendamentos.map(a => a.motorista_nome).filter(Boolean))]

  function limparFiltros() {
    setPeriodoInicio(''); setPeriodoFim(''); setFiltroStatus([])
    setFiltroTipo(''); setFiltroVeiculo(''); setFiltroMotorista(''); setFiltroCliente('')
    setFiltroSalvo(false)
  }

  function toggleStatusFiltro(s) {
    setFiltroStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  // ── Ações de status ──
  async function mudarStatus(id, novoStatus) {
    if ((novoStatus === 'cancelado' || novoStatus === 'concluido') && !window.confirm(`Confirma marcar como "${STATUS_CONFIG[novoStatus]?.label}"?`)) return
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
      toast.success(`${STATUS_CONFIG[novoStatus]?.label}`)
      await carregar()
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  async function excluir(ag) {
    if (!window.confirm(`Excluir "${ag.tipo_servico}" de ${ag.cliente_nome}?`)) return
    await supabase.from('agendamentos_servicos').delete().eq('id', ag.id)
    toast.success('Agendamento excluído')
    if (selected?.id === ag.id) setSelected(null)
    await carregar()
  }

  function alertaPrincipal(ag) {
    const alertas = ag.agendamento_alertas || []
    return alertas.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null
  }

  const TABS = [
    { key: 'todos',      label: 'Todos',        count: kpis.todos },
    { key: 'atrasados',  label: 'Atrasados',    count: kpis.atrasados, color: '#f59e0b' },
    { key: 'hoje',       label: 'Hoje',         count: kpis.hoje },
    { key: 'amanha',     label: 'Amanhã',       count: kpis.amanha },
    { key: 'prox7',      label: 'Próx. 7 dias', count: kpis.prox7 },
    { key: 'concluidos', label: 'Concluídos',   count: kpis.concluidos, color: '#10b981' },
  ]

  const inpF = { width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 9px', color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Agendamentos"
        subtitle="Gerencie agendamentos operacionais com alertas e anúncios via WhatsApp"
        action={{ label: '+ Novo Agendamento', onClick: () => setModalNovo(true) }}
      />

      {/* ── KPI strip ── */}
      <div style={{ padding: '10px 20px 8px', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {[
            { label: 'Hoje',              value: kpis.hoje,            icon: CalendarDaysIcon, color: '#6366f1', alert: false,            tab: 'hoje'      },
            { label: 'Amanhã',            value: kpis.amanha,          icon: CalendarDaysIcon, color: '#6366f1', alert: false,            tab: 'amanha'    },
            { label: 'Próximos 7 dias',   value: kpis.prox7,           icon: CalendarDaysIcon, color: '#0ea5e9', alert: false,            tab: 'prox7'     },
            { label: 'Atrasos Pendentes', value: kpis.atrasados,       icon: ExclamationTriangleIcon, color: '#f59e0b', alert: kpis.atrasados > 0, tab: 'atrasados' },
            { label: 'Alertas Enviados',  value: kpis.alertasEnviados, icon: ChatBubbleLeftRightIcon, color: '#10b981', alert: false,      tab: 'todos'     },
            { label: 'Falhas de Envio',   value: kpis.falhas,          icon: ExclamationTriangleIcon, color: '#ef4444', alert: kpis.falhas > 0, tab: 'todos' },
            { label: 'Concluídos',        value: kpis.concluidos,      icon: CheckCircleIcon,  color: '#6b7280', alert: false,            tab: 'concluidos'},
          ].map(({ label, value, icon: Icon, color, alert, tab }) => (
            <div key={label} onClick={() => setTabAtiva(tab)}
              style={{ background: 'var(--bg-card)', border: `1px solid var(--border)`, borderTop: `3px solid ${alert ? color : 'var(--border)'}`, borderRadius: 8, padding: '10px 12px', boxShadow: alert ? `0 2px 8px ${color}20` : '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.3 }}>{label}</div>
                <Icon style={{ width: 13, color, flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1, marginBottom: 3 }}>{value}</div>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
                {kpis.todos > 0 ? Math.round((value / kpis.todos) * 100) : 0}% do total
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Layout: filtros | tabela | detalhe ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '175px 1fr 340px', overflow: 'hidden', borderTop: '1px solid var(--border)' }}>

        {/* ── Filtros laterais ── */}
        <div style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--bg-card)', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Header filtros */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>Filtros</span>
            <button onClick={limparFiltros} style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Limpar</button>
          </div>

          {/* Período */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Período</div>
            <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} style={inpF} placeholder="De" />
            <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} style={{ ...inpF, marginTop: 4 }} placeholder="Até" />
          </div>

          {/* Status */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Status</div>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const qtd = agendamentos.filter(a => a.status === key).length
              const ativo = filtroStatus.includes(key)
              return (
                <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: ativo ? cfg.color : 'var(--text-primary)', fontWeight: ativo ? 700 : 400 }}>
                    <input type="checkbox" checked={ativo} onChange={() => toggleStatusFiltro(key)} style={{ accentColor: cfg.color, cursor: 'pointer' }} />
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, background: ativo ? cfg.color : 'var(--bg-secondary)', color: ativo ? '#fff' : 'var(--text-secondary)', borderRadius: 99, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>{qtd}</span>
                </label>
              )
            })}
          </div>

          {/* Tipo de serviço */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Tipo de Serviço</div>
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={inpF}>
              <option value="">Todos</option>
              {TIPOS_SERVICO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Veículo */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Veículo</div>
            <select value={filtroVeiculo} onChange={e => setFiltroVeiculo(e.target.value)} style={inpF}>
              <option value="">Todos</option>
              {veiculosDisponiveis.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Motorista */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Motorista</div>
            <select value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)} style={inpF}>
              <option value="">Todos</option>
              {motoristasDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Cliente */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Cliente</div>
            <div style={{ position: 'relative' }}>
              <MagnifyingGlassIcon style={{ width: 11, position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} placeholder="Buscar..." style={{ ...inpF, paddingLeft: 22 }} />
            </div>
          </div>

          <button onClick={() => setFiltroSalvo(true)} style={{ marginTop: 'auto', padding: '7px 0', borderRadius: 7, border: '1px solid var(--border)', background: filtroSalvo ? 'var(--accent)' : 'transparent', color: filtroSalvo ? '#fff' : 'var(--text-secondary)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            {filtroSalvo ? '✓ Filtro salvo' : '💾 Salvar filtro'}
          </button>
        </div>

        {/* ── Painel Central: Tabela ── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Busca global */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-card)' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <MagnifyingGlassIcon style={{ width: 12, position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cliente, tipo, motorista, veículo..."
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px 6px 26px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
            </div>
            <button onClick={() => setModalNovo(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              <PlusIcon style={{ width: 13 }} /> Novo
            </button>
            <button onClick={carregar} style={{ padding: 6, borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <ArrowPathIcon style={{ width: 13 }} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ borderBottom: '1px solid var(--border)', display: 'flex', flexShrink: 0, background: 'var(--bg-card)', paddingLeft: 10 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTabAtiva(t.key)} style={{ padding: '7px 10px', fontSize: 11, fontWeight: tabAtiva === t.key ? 700 : 500, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${tabAtiva === t.key ? (t.color || 'var(--accent)') : 'transparent'}`, color: tabAtiva === t.key ? (t.color || 'var(--accent)') : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                {t.label}
                {t.count > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '0 5px', borderRadius: 99, background: tabAtiva === t.key ? (t.color || 'var(--accent)') : 'rgba(148,163,184,0.25)', color: tabAtiva === t.key ? '#fff' : 'var(--text-secondary)', minWidth: 16, textAlign: 'center' }}>{t.count}</span>}
              </button>
            ))}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 10 }}>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{filtrados.length} itens</span>
            </div>
          </div>

          {/* Tabela */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <ArrowPathIcon style={{ width: 28, margin: '0 auto 10px', opacity: 0.4 }} />
                <p style={{ fontSize: 13 }}>Carregando...</p>
              </div>
            ) : filtrados.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <CalendarDaysIcon style={{ width: 36, margin: '0 auto 10px', opacity: 0.3 }} />
                <p style={{ fontSize: 14, fontWeight: 600 }}>Nenhum agendamento</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>{busca ? 'Nenhum resultado para a busca.' : 'Clique em "+ Novo" para criar o primeiro.'}</p>
              </div>
            ) : (
              <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 2 }}>
                    {['Data / Hora', 'Cliente', 'Tipo de Serviço', 'Atividade', 'Origem → Destino', 'Motorista', 'Veículo', 'Status', 'WA', 'Ações'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(ag => {
                    const alerta = alertaPrincipal(ag)
                    const isSel  = selected?.id === ag.id
                    const isAtrasado = ag.data_servico < hoje && !['cancelado','concluido'].includes(ag.status)
                    const isFalha = (ag.agendamento_alertas || []).some(al => al.status === 'falha')
                    return (
                      <tr key={ag.id} onClick={() => setSelected(isSel ? null : ag)}
                        style={{ background: isSel ? 'rgba(99,102,241,0.06)' : 'transparent', borderBottom: '1px solid var(--border)', cursor: 'pointer', borderLeft: `3px solid ${isSel ? 'var(--accent)' : 'transparent'}` }}
                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: isAtrasado ? '#f59e0b' : 'var(--text-primary)' }}>{fmtDate(ag.data_servico)}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{ag.horario_servico?.slice(0,5) || '—'}</div>
                          {isAtrasado && <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>Atrasado</span>}
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', fontSize: 11 }}>{ag.cliente_nome}</div>
                        </td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <span>🚛</span>
                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{ag.tipo_servico}</span>
                          </div>
                          {isFalha && <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>⚠ Falha WA</span>}
                        </td>
                        <td style={{ padding: '9px 10px', maxWidth: 110 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ag.atividade || '—'}</div>
                        </td>
                        <td style={{ padding: '9px 10px', maxWidth: 120 }}>
                          {ag.origem || ag.destino ? (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ag.origem || ''}{ag.origem && ag.destino ? ' → ' : ''}{ag.destino || ''}
                            </div>
                          ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 11 }}>{ag.motorista_nome || '—'}</td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 11 }}>{ag.veiculo_nome || '—'}</td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}><StatusChip status={ag.status} /></td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                          {alerta ? <AlertaChip status={alerta.status} /> : <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <button onClick={() => setModalEditar(ag)} title="Editar" style={{ padding: '3px 6px', borderRadius: 5, background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                              <PencilIcon style={{ width: 11 }} />
                            </button>
                            {ag.responsavel_whatsapp && waLink(ag.responsavel_whatsapp) && (
                              <a href={waLink(ag.responsavel_whatsapp)} target="_blank" rel="noreferrer" title="WhatsApp" style={{ padding: '3px 6px', borderRadius: 5, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', cursor: 'pointer', color: '#25d366', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                                <ChatBubbleLeftRightIcon style={{ width: 11 }} />
                              </a>
                            )}
                            {!['cancelado','concluido'].includes(ag.status) && (
                              <button onClick={() => mudarStatus(ag.id, 'concluido')} title="Concluir" style={{ padding: '3px 6px', borderRadius: 5, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer', color: '#10b981' }}>
                                <CheckCircleIcon style={{ width: 11 }} />
                              </button>
                            )}
                            {!['cancelado','concluido'].includes(ag.status) && (
                              <button onClick={() => mudarStatus(ag.id, 'cancelado')} title="Cancelar" style={{ padding: '3px 6px', borderRadius: 5, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', color: '#ef4444' }}>
                                <XCircleIcon style={{ width: 11 }} />
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

          {/* Footer contagem — igual ao ComprasERP */}
          <div style={{ padding: '5px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
            Mostrando {filtrados.length} de {agendamentos.length} agendamentos
          </div>
        </div>

        {/* ── Painel Direito: Detalhes (sempre visível, 340px fixos) ── */}
        <PainelDetalhe
          ag={selected}
          onClose={() => setSelected(null)}
          onEdit={ag => { setModalEditar(ag); setSelected(null) }}
          onStatusChange={async (id, status) => { await mudarStatus(id, status) }}
          onNovoAgendamento={() => setModalNovo(true)}
        />
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
    </div>
  )
}
