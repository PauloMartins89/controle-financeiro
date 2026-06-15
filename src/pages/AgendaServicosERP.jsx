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
function PainelDetalhe({ ag, onClose, onEdit, onStatusChange }) {
  const [historico, setHistorico] = useState([])
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)
  const [tabD, setTabD] = useState('info')

  useEffect(() => {
    if (!ag?.id) return
    setLoading(true)
    setTabD('info')
    Promise.all([
      supabase.from('agendamento_historico').select('*').eq('agendamento_id', ag.id).order('data_evento', { ascending: false }),
      supabase.from('agendamento_alertas').select('*').eq('agendamento_id', ag.id).order('created_at', { ascending: false }),
    ]).then(([h, a]) => {
      setHistorico(h.data || [])
      setAlertas(a.data || [])
      setLoading(false)
    })
  }, [ag?.id])

  const tipoIcon = {
    criacao: '🟢', edicao: '✏️', alerta_configurado: '🔔', whatsapp_enviado: '📤',
    reenvio_whatsapp: '🔄', falha_whatsapp: '❌', confirmacao_recebida: '✅',
    ajuste_solicitado: '⚠️', cancelamento: '🚫', conclusao: '🏁', em_execucao: '▶️',
  }

  const cfg = STATUS_CONFIG[ag.status] || { color: '#94a3b8' }

  return (
    <div style={{ width: 360, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, borderTop: `3px solid ${cfg.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: 6 }}>
              <StatusChip status={ag.status} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>🚛 {ag.tipo_servico}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {ag.cliente_nome} · {fmtDate(ag.data_servico)}{ag.horario_servico ? ` às ${ag.horario_servico.slice(0, 5)}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
            <XMarkIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Ações rápidas */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <button onClick={() => onEdit(ag)} style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', color: '#6366f1', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <PencilIcon style={{ width: 12, height: 12 }} /> Editar
          </button>
          {!['em_execucao', 'concluido', 'cancelado'].includes(ag.status) && (
            <button onClick={() => onStatusChange(ag.id, 'em_execucao')} style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)', color: '#06b6d4', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <PlayIcon style={{ width: 12, height: 12 }} /> Iniciar
            </button>
          )}
          {ag.status === 'em_execucao' && (
            <button onClick={() => onStatusChange(ag.id, 'concluido')} style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircleIcon style={{ width: 12, height: 12 }} /> Concluir
            </button>
          )}
          {!['cancelado', 'concluido'].includes(ag.status) && (
            <button onClick={() => onStatusChange(ag.id, 'cancelado')} style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <XCircleIcon style={{ width: 12, height: 12 }} /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {[{ key: 'info', label: '📋 Dados' }, { key: 'alertas', label: '🔔 Alertas' }, { key: 'timeline', label: '📅 Timeline' }].map(t => (
          <button key={t.key} onClick={() => setTabD(t.key)} style={{ flex: 1, padding: '9px 4px', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${tabD === t.key ? 'var(--accent)' : 'transparent'}`, color: tabD === t.key ? 'var(--accent)' : 'var(--text-secondary)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {/* ─ ABA: Dados ─ */}
        {tabD === 'info' && (
          <>
            <section style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>DADOS DO SERVIÇO</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Cliente', value: ag.cliente_nome },
                  { label: 'Tipo', value: ag.tipo_servico },
                  { label: 'Atividade', value: ag.atividade },
                  { label: 'Data', value: fmtDate(ag.data_servico) },
                  { label: 'Horário', value: ag.horario_servico?.slice(0, 5) },
                  { label: 'Veículo', value: ag.veiculo_nome },
                ].filter(i => i.value).map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 1 }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {(ag.origem || ag.destino) && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                  {ag.origem && <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><MapPinIcon style={{ width: 11, height: 11 }} /> {ag.origem}</div>}
                  {ag.destino && <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>→ {ag.destino}</div>}
                </div>
              )}
              {ag.observacao && (
                <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 8, borderLeft: '3px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 2 }}>OBSERVAÇÃO</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{ag.observacao}</div>
                </div>
              )}
            </section>

            <section>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>EQUIPE</div>
              {[
                { label: 'Responsável', nome: ag.responsavel_nome, wa: ag.responsavel_whatsapp },
                { label: 'Motorista', nome: ag.motorista_nome, wa: ag.motorista_whatsapp },
                { label: 'Cliente', nome: ag.contato_cliente || ag.cliente_nome, wa: ag.whatsapp_cliente },
              ].filter(p => p.nome || p.wa).map(pessoa => (
                <div key={pessoa.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>{pessoa.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{pessoa.nome || '—'}</div>
                  </div>
                  {pessoa.wa && waLink(pessoa.wa) && (
                    <a href={waLink(pessoa.wa)} target="_blank" rel="noreferrer" style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.2)', color: '#25d366', fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <DevicePhoneMobileIcon style={{ width: 12, height: 12 }} /> WA
                    </a>
                  )}
                </div>
              ))}
            </section>
          </>
        )}

        {/* ─ ABA: Alertas ─ */}
        {tabD === 'alertas' && (
          <div>
            {loading && <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>Carregando...</div>}
            {!loading && alertas.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                <BellAlertIcon style={{ width: 32, height: 32, margin: '0 auto 8px', opacity: 0.3 }} />
                <p style={{ fontSize: 12 }}>Nenhum alerta configurado</p>
              </div>
            )}
            {alertas.map(al => (
              <div key={al.id} style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 8, border: `1px solid ${ALERTA_STATUS_CONFIG[al.status]?.color || '#94a3b8'}22` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{al.destinatario_nome || al.destinatario_whatsapp}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {ANTECEDENCIAS.find(a => a.value === al.antecedencia_minutos)?.label || al.antecedencia_minutos + ' min'} antes
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Envio previsto: {fmtDateTime(al.horario_previsto_envio)}</div>
                    {al.enviado_em && <div style={{ fontSize: 10, color: '#10b981' }}>Enviado: {fmtDateTime(al.enviado_em)}</div>}
                    {al.erro_envio && <div style={{ fontSize: 10, color: '#ef4444' }}>Erro: {al.erro_envio}</div>}
                  </div>
                  <AlertaChip status={al.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─ ABA: Timeline ─ */}
        {tabD === 'timeline' && (
          <div>
            {loading && <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>Carregando...</div>}
            {!loading && historico.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>Nenhum evento registrado</div>}
            {historico.map((ev, i) => (
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
      </div>
    </div>
  )
}

// ─── Componente Principal ──────────────────────────────────────────────────────
export default function AgendaServicosERP() {
  const { workspaceId } = useStore()
  const [agendamentos, setAgendamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroKey, setFiltroKey] = useState('todos')
  const [busca, setBusca] = useState('')
  const [selected, setSelected] = useState(null)
  const [modalNovo, setModalNovo] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)

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

  // Atualiza o item selecionado quando a lista recarregar
  useEffect(() => {
    if (selected) {
      const updated = agendamentos.find(a => a.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [agendamentos]) // eslint-disable-line

  // Contagem por pipeline key
  function countFor(key) {
    if (key === 'todos') return agendamentos.length
    if (key === 'hoje') return agendamentos.filter(a => a.data_servico === hoje && !['cancelado', 'concluido'].includes(a.status)).length
    if (key === 'amanha') return agendamentos.filter(a => a.data_servico === amanha && !['cancelado', 'concluido'].includes(a.status)).length
    if (key === 'semana') return agendamentos.filter(a => a.data_servico > hoje && a.data_servico <= em7dias && !['cancelado', 'concluido'].includes(a.status)).length
    return agendamentos.filter(a => a.status === key).length
  }

  // Filtro
  const filtrados = agendamentos.filter(a => {
    if (busca) {
      const q = busca.toLowerCase()
      if (!`${a.cliente_nome} ${a.tipo_servico} ${a.atividade} ${a.responsavel_nome} ${a.motorista_nome} ${a.veiculo_nome} ${a.origem} ${a.destino}`.toLowerCase().includes(q)) return false
    }
    if (filtroKey === 'todos') return true
    if (filtroKey === 'hoje') return a.data_servico === hoje
    if (filtroKey === 'amanha') return a.data_servico === amanha
    if (filtroKey === 'semana') return a.data_servico > hoje && a.data_servico <= em7dias
    return a.status === filtroKey
  })

  // Ações de status
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

  // Highlight de linha
  function rowBg(ag) {
    if (ag.id === selected?.id) return 'var(--bg-card-hover)'
    if (ag.data_servico === hoje && !['cancelado', 'concluido'].includes(ag.status)) return 'rgba(0,200,150,0.04)'
    if ((ag.agendamento_alertas || []).some(al => al.status === 'falha')) return 'rgba(239,68,68,0.04)'
    return 'transparent'
  }

  // Alerta principal
  function alertaPrincipal(ag) {
    const alertas = ag.agendamento_alertas || []
    return alertas.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null
  }

  // Stats rápidos
  const stats = {
    hoje: agendamentos.filter(a => a.data_servico === hoje && !['cancelado', 'concluido'].includes(a.status)).length,
    execucao: agendamentos.filter(a => a.status === 'em_execucao').length,
    alertasPendentes: agendamentos.flatMap(a => a.agendamento_alertas || []).filter(al => al.status === 'pendente').length,
    falhas: agendamentos.flatMap(a => a.agendamento_alertas || []).filter(al => al.status === 'falha').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header
        title="Agenda — ERP"
        subtitle="Gestão operacional de agendamentos com pipeline e painel de detalhe"
        action={{ label: 'Novo Agendamento', onClick: () => setModalNovo(true) }}
      />

      {/* ── Barra de Stats ── */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        {[
          { label: 'Hoje', value: stats.hoje, color: '#00c896' },
          { label: 'Em Execução', value: stats.execucao, color: '#06b6d4' },
          { label: 'Alertas Pend.', value: stats.alertasPendentes, color: '#f59e0b' },
          { label: 'Falhas WA', value: stats.falhas, color: '#ef4444' },
          { label: 'Total', value: agendamentos.length, color: '#6366f1' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={carregar} style={{ padding: '5px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <ArrowPathIcon style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* ── Layout 3 painéis ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Painel Esquerdo: Pipeline ── */}
        <div style={{ width: 210, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--bg-secondary)', padding: '10px 0' }}>
          {PIPELINE.map(p => {
            if (p.sep) return (
              <div key={p.key} style={{ padding: '10px 14px 4px', fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {p.label}
              </div>
            )
            const count = countFor(p.key)
            const isActive = filtroKey === p.key
            return (
              <button
                key={p.key}
                onClick={() => { setFiltroKey(p.key); setSelected(null) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 14px', border: 'none', cursor: 'pointer',
                  background: isActive ? `${p.color}18` : 'transparent',
                  borderLeft: `3px solid ${isActive ? p.color : 'transparent'}`,
                  color: isActive ? p.color : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: isActive ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13 }}>{p.icon}</span>
                  {p.label}
                </span>
                {count > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: isActive ? p.color : 'rgba(148,163,184,0.2)', color: isActive ? '#fff' : 'var(--text-secondary)', minWidth: 20, textAlign: 'center' }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Painel Central: Lista ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Busca */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <MagnifyingGlassIcon style={{ width: 15, height: 15, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar cliente, tipo, motorista, veículo..."
                style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px 7px 32px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
              />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
            </span>
            <button onClick={() => setModalNovo(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <PlusIcon style={{ width: 14, height: 14 }} /> Novo
            </button>
          </div>

          {/* Lista */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <ArrowPathIcon style={{ width: 28, height: 28, margin: '0 auto 10px', opacity: 0.4 }} />
                <p style={{ fontSize: 13 }}>Carregando...</p>
              </div>
            ) : filtrados.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <CalendarDaysIcon style={{ width: 36, height: 36, margin: '0 auto 10px', opacity: 0.3 }} />
                <p style={{ fontSize: 14, fontWeight: 600 }}>Nenhum agendamento</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>
                  {busca ? 'Nenhum resultado para a busca.' : 'Clique em "+ Novo" para criar o primeiro.'}
                </p>
              </div>
            ) : (
              filtrados.map(ag => {
                const alerta = alertaPrincipal(ag)
                const isHoje = ag.data_servico === hoje
                const isFalha = (ag.agendamento_alertas || []).some(al => al.status === 'falha')
                const isSelected = selected?.id === ag.id

                return (
                  <div
                    key={ag.id}
                    onClick={() => setSelected(isSelected ? null : ag)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: rowBg(ag),
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      borderLeft: `3px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = rowBg(ag) }}
                  >
                    {/* Linha 1: Tipo + Status + Alerta */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isHoje ? 'var(--accent)' : 'var(--text-primary)' }}>
                          🚛 {ag.tipo_servico}
                        </span>
                        {isFalha && <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>⚠ Falha WA</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {alerta && <AlertaChip status={alerta.status} />}
                        <StatusChip status={ag.status} />
                      </div>
                    </div>

                    {/* Linha 2: Cliente + Data */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{ag.cliente_nome}</span>
                      <span style={{ fontSize: 11, color: isHoje ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: isHoje ? 700 : 400 }}>
                        📅 {fmtDate(ag.data_servico)}{ag.horario_servico ? ` · ${ag.horario_servico.slice(0, 5)}` : ''}
                      </span>
                    </div>

                    {/* Linha 3: Equipe + Localização */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      {ag.responsavel_nome && (
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          👤 {ag.responsavel_nome}
                        </span>
                      )}
                      {ag.motorista_nome && (
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          🚗 {ag.motorista_nome}
                        </span>
                      )}
                      {ag.veiculo_nome && (
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>🔩 {ag.veiculo_nome}</span>
                      )}
                      {ag.origem && (
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <MapPinIcon style={{ width: 10, height: 10 }} /> {ag.origem}{ag.destino ? ` → ${ag.destino}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Linha 4: Ações rápidas inline (visíveis só no hover/selected) */}
                    {isSelected && (
                      <div style={{ display: 'flex', gap: 5, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setModalEditar(ag)} style={{ padding: '3px 9px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', border: 'none', color: '#6366f1', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                          Editar
                        </button>
                        {!['em_execucao', 'concluido', 'cancelado'].includes(ag.status) && (
                          <button onClick={() => mudarStatus(ag.id, 'em_execucao')} style={{ padding: '3px 9px', borderRadius: 6, background: 'rgba(6,182,212,0.12)', border: 'none', color: '#06b6d4', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                            Iniciar
                          </button>
                        )}
                        {ag.status === 'em_execucao' && (
                          <button onClick={() => mudarStatus(ag.id, 'concluido')} style={{ padding: '3px 9px', borderRadius: 6, background: 'rgba(16,185,129,0.12)', border: 'none', color: '#10b981', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                            Concluir
                          </button>
                        )}
                        {!['cancelado', 'concluido'].includes(ag.status) && (
                          <button onClick={() => mudarStatus(ag.id, 'cancelado')} style={{ padding: '3px 9px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        )}
                        <button onClick={() => excluir(ag)} style={{ padding: '3px 7px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: 'none', color: '#ef4444', fontSize: 10, cursor: 'pointer' }}>
                          <TrashIcon style={{ width: 11, height: 11 }} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Painel Direito: Detalhe ── */}
        {selected && (
          <PainelDetalhe
            ag={selected}
            onClose={() => setSelected(null)}
            onEdit={ag => { setModalEditar(ag); setSelected(null) }}
            onStatusChange={async (id, status) => { await mudarStatus(id, status) }}
          />
        )}
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
