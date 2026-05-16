import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { supabase } from '../lib/supabase'
import {
  PlusIcon, DocumentArrowUpIcon, MagnifyingGlassIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon, PencilIcon,
  TrashIcon, XMarkIcon, PhotoIcon, ChevronDownIcon,
  DocumentTextIcon, TruckIcon, SparklesIcon,
  Cog6ToothIcon, PhoneIcon, UserPlusIcon, QrCodeIcon,
  PaperAirplaneIcon, ArrowUturnLeftIcon, WrenchScrewdriverIcon,
  NoSymbolIcon, BanknotesIcon, ArrowPathIcon, MapPinIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline'

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIAS = [
  'Alimentação','Transporte','Saúde','Serviços','Material',
  'Equipamento','Viagem','Comunicação','Manutenção','Outros',
]

const TIPO_CORES = {
  despesa:       { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444', label: 'Despesa' },
  receita:       { bg: 'rgba(16,185,129,0.12)', text: '#10b981', label: 'Receita' },
  transferencia: { bg: 'rgba(99,102,241,0.12)', text: '#818cf8', label: 'Transferência' },
}

const STATUS_CONF = {
  rascunho:             { icon: DocumentTextIcon,      color: '#94a3b8', label: 'Rascunho' },
  aguardando_aprovacao: { icon: ClockIcon,             color: '#f59e0b', label: 'Ag. Aprovação' },
  aprovado:             { icon: CheckCircleIcon,       color: '#10b981', label: 'Aprovado' },
  devolvido:            { icon: ArrowUturnLeftIcon,    color: '#f97316', label: 'Devolvido' },
  corrigido:            { icon: WrenchScrewdriverIcon, color: '#6366f1', label: 'Corrigido' },
  reprovado:            { icon: XCircleIcon,           color: '#ef4444', label: 'Reprovado' },
  cancelado:            { icon: NoSymbolIcon,          color: '#64748b', label: 'Cancelado' },
  faturado:             { icon: BanknotesIcon,         color: '#8b5cf6', label: 'Faturado' },
  // aliases legado (registros antigos no banco)
  pendente:             { icon: ClockIcon,             color: '#f59e0b', label: 'Ag. Aprovação' },
  rejeitado:            { icon: XCircleIcon,           color: '#ef4444', label: 'Reprovado' },
}

const FORM_TYPES = {
  padrao:     { label: 'Padrão',     icon: DocumentTextIcon },
  transporte: { label: 'Transporte', icon: TruckIcon },
}

const DEFAULT_KM_ROWS = [
  { tipo: 'ASFALTO', saida: '', entrada: '', total: '' },
  { tipo: 'TERRA',   saida: '', entrada: '', total: '' },
  { tipo: 'ASFALTO', saida: '', entrada: '', total: '' },
  { tipo: 'TERRA',   saida: '', entrada: '', total: '' },
  { tipo: 'ASFALTO', saida: '', entrada: '', total: '' },
  { tipo: 'TERRA',   saida: '', entrada: '', total: '' },
  { tipo: 'ASFALTO', saida: '', entrada: '', total: '' },
  { tipo: 'TERRA',   saida: '', entrada: '', total: '' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function num(v) { return parseFloat(String(v || 0).replace(',', '.')) || 0 }
function calcKmTotais(d = {}) {
  const parseKm = v => { const n = parseFloat(String(v || '').replace(/[^\d.,]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n }
  const rows = (d.km_rows || []).filter(r => r.total && String(r.total).trim() !== '')
  const asfalto = rows.filter(r => r.tipo === 'ASFALTO').reduce((s, r) => s + parseKm(r.total), 0)
  const terra   = rows.filter(r => r.tipo === 'TERRA').reduce((s, r) => s + parseKm(r.total), 0)
  return { asfalto, terra, total: asfalto + terra }
}
function getValorTransporte(d = {}) { return num(d.valor_total) }

function mergeKmRows(ocrRows) {
  const base = DEFAULT_KM_ROWS.map(r => ({ ...r }))
  if (!ocrRows || !ocrRows.length) return base
  ocrRows.forEach((row, i) => { if (i < base.length) base[i] = { ...base[i], ...row } })
  return base
}

async function registrarEvento({ lancamentoId, tipo, statusDe = null, statusPara = null, descricao = null, usuarioId = null, usuarioNome = null, dados = {} }) {
  if (!lancamentoId || !supabase) return
  await supabase.from('lancamento_eventos').insert({
    lancamento_id: lancamentoId,
    tipo,
    status_de:    statusDe,
    status_para:  statusPara,
    descricao,
    usuario_id:   usuarioId,
    usuario_nome: usuarioNome,
    dados,
  })
}

// Configuração visual dos eventos na linha do tempo
const EVENTO_CONF = {
  criado:             { icon: DocumentTextIcon,      color: '#6366f1', label: 'Lançamento criado',          bg: 'rgba(99,102,241,0.12)' },
  recebido_whatsapp:  { icon: PhoneIcon,             color: '#25d366', label: 'Recebido via WhatsApp',      bg: 'rgba(37,211,102,0.12)' },
  processado_ia:      { icon: SparklesIcon,          color: '#818cf8', label: 'Processado pela IA',         bg: 'rgba(129,140,248,0.12)' },
  editado:            { icon: PencilIcon,            color: '#94a3b8', label: 'Editado',                    bg: 'rgba(148,163,184,0.12)' },
  enviado_aprovacao:  { icon: PaperAirplaneIcon,     color: '#f59e0b', label: 'Enviado para aprovação',     bg: 'rgba(245,158,11,0.12)' },
  aprovado:           { icon: CheckCircleIcon,       color: '#10b981', label: 'Aprovado',                   bg: 'rgba(16,185,129,0.12)' },
  devolvido:          { icon: ArrowUturnLeftIcon,    color: '#f97316', label: 'Devolvido para correção',    bg: 'rgba(249,115,22,0.12)' },
  corrigido:          { icon: WrenchScrewdriverIcon, color: '#6366f1', label: 'Corrigido e reenviado',      bg: 'rgba(99,102,241,0.12)' },
  reprovado:          { icon: XCircleIcon,           color: '#ef4444', label: 'Reprovado',                  bg: 'rgba(239,68,68,0.12)' },
  cancelado:          { icon: NoSymbolIcon,          color: '#64748b', label: 'Cancelado',                  bg: 'rgba(100,116,139,0.12)' },
  faturado:           { icon: BanknotesIcon,         color: '#8b5cf6', label: 'Faturado',                   bg: 'rgba(139,92,246,0.12)' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Chips
// ─────────────────────────────────────────────────────────────────────────────
function StatusChip({ status }) {
  const conf = STATUS_CONF[status] || STATUS_CONF.rascunho
  const Icon = conf.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${conf.color}20`, color: conf.color }}>
      <Icon style={{ width: 12, height: 12 }} />{conf.label}
    </span>
  )
}
function TipoChip({ tipo }) {
  const conf = TIPO_CORES[tipo] || TIPO_CORES.despesa
  return <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: conf.bg, color: conf.text }}>{conf.label}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulário de Transporte — DIÁRIO DO MOTORISTA (Casagrande)
// ─────────────────────────────────────────────────────────────────────────────
function FormTransporte({ dados, onChange }) {
  const set = (k, v) => onChange({ ...dados, [k]: v })
  const kmRows = (dados.km_rows && dados.km_rows.length === 8) ? dados.km_rows : mergeKmRows(dados.km_rows)

  function setKmRow(i, field, val) {
    const rows = kmRows.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
    if (field === 'saida' || field === 'entrada') {
      const s = num(field === 'saida' ? val : rows[i].saida)
      const e = num(field === 'entrada' ? val : rows[i].entrada)
      if (s > 0 && e > 0) rows[i] = { ...rows[i], total: String(Math.abs(e - s)) }
    }
    onChange({ ...dados, km_rows: rows })
  }

  const cellInp = (val, onChg, opts = {}) => (
    <input
      type={opts.type || 'text'}
      value={val ?? ''}
      onChange={e => onChg(e.target.value)}
      placeholder={opts.placeholder || ''}
      style={{
        width: '100%', padding: '5px 6px', borderRadius: 5,
        background: 'var(--bg-primary)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', fontSize: 12, outline: 'none',
        boxSizing: 'border-box', textAlign: opts.align || 'left',
      }}
    />
  )

  const fieldInp = (label, key, opts = {}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      <input
        type={opts.type || 'text'}
        placeholder={opts.placeholder || ''}
        value={dados[key] ?? ''}
        onChange={e => set(key, e.target.value)}
        style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
      />
    </div>
  )

  return (
    <div>
      {/* Cabeçalho: DIÁRIO DO MOTORISTA + Nº */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TruckIcon style={{ width: 18, height: 18, color: '#818cf8' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#818cf8', letterSpacing: 0.5 }}>DIÁRIO DO MOTORISTA</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Nº</span>
          <input
            value={dados.numero_diario ?? ''}
            onChange={e => set('numero_diario', e.target.value)}
            placeholder="00000"
            style={{ width: 88, padding: '5px 8px', borderRadius: 6, background: 'var(--bg-primary)', border: '2px solid rgba(99,102,241,0.4)', color: '#818cf8', fontSize: 15, fontWeight: 800, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Empresa / Setor */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Empresa', 'empresa')}
        {fieldInp('Setor', 'setor')}
      </div>
      {/* Cliente / Tipo Atendimento / Módulo */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Cliente', 'cliente')}
        {fieldInp('Tipo Atend.', 'tipo_atendimento', { placeholder: 'PLATAFORMA' })}
        {fieldInp('Módulo', 'modulo')}
      </div>
      {/* Solicitante / CC */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Solicitante', 'solicitante')}
        {fieldInp('CC', 'cc')}
      </div>
      {/* Condutor / Tipo Material / KM Inicial / KM Final */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Condutor', 'condutor')}
        {fieldInp('Tipo Material', 'tipo_material')}
        {fieldInp('KM Inicial', 'km_inicial', { type: 'number' })}
        {fieldInp('KM Final', 'km_final', { type: 'number' })}
      </div>
      {/* Origem / Destino */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Local de Origem', 'local_origem')}
        {fieldInp('Local de Destino', 'local_destino')}
      </div>
      {/* Equipamento / Viagens */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 10, marginBottom: 14 }}>
        {fieldInp('Equipamento', 'equipamento')}
        {fieldInp('Viagens', 'viagens', { type: 'number', placeholder: '1' })}
      </div>

      {/* Tabela KM/HORAS */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
        {/* Cabeçalho da tabela */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border)' }}>
          {['KM/HORAS', 'SAÍDA', 'ENTRADA', 'TOTAL/KM'].map(h => (
            <div key={h} style={{ padding: '7px 8px', fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'center', letterSpacing: 0.5 }}>{h}</div>
          ))}
        </div>

        {/* Linhas ASFALTO / TERRA */}
        {kmRows.map((row, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', borderBottom: '1px solid var(--border)', background: row.tipo === 'ASFALTO' ? 'rgba(99,102,241,0.04)' : 'rgba(245,158,11,0.04)' }}>
            <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: row.tipo === 'ASFALTO' ? '#818cf8' : '#f59e0b', letterSpacing: 0.5 }}>{row.tipo}</span>
            </div>
            <div style={{ padding: '4px 6px' }}>{cellInp(row.saida,   v => setKmRow(i, 'saida',   v), { align: 'center', placeholder: '—' })}</div>
            <div style={{ padding: '4px 6px' }}>{cellInp(row.entrada, v => setKmRow(i, 'entrada', v), { align: 'center', placeholder: '—' })}</div>
            <div style={{ padding: '4px 6px' }}>{cellInp(row.total,   v => setKmRow(i, 'total',   v), { align: 'center', placeholder: '—' })}</div>
          </div>
        ))}

        {/* HORAS 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', borderBottom: '1px solid var(--border)', background: 'rgba(16,185,129,0.04)' }}>
          <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', letterSpacing: 0.5 }}>HORAS</span>
          </div>
          <div style={{ padding: '4px 6px', gridColumn: 'span 2' }}>{cellInp(dados.horas_1_desc, v => set('horas_1_desc', v), { placeholder: 'Descrição' })}</div>
          <div style={{ padding: '4px 6px' }}>{cellInp(dados.horas_1, v => set('horas_1', v), { align: 'center', placeholder: '—' })}</div>
        </div>

        {/* HORAS 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', borderBottom: '1px solid var(--border)', background: 'rgba(16,185,129,0.04)' }}>
          <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', letterSpacing: 0.5 }}>HORAS</span>
          </div>
          <div style={{ padding: '4px 6px', gridColumn: 'span 2' }}>{cellInp(dados.horas_2_desc, v => set('horas_2_desc', v), { placeholder: 'Descrição' })}</div>
          <div style={{ padding: '4px 6px' }}>{cellInp(dados.horas_2, v => set('horas_2', v), { align: 'center', placeholder: '—' })}</div>
        </div>

        {/* DIÁRIAS */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 1fr', background: 'rgba(239,68,68,0.04)' }}>
          <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', letterSpacing: 0.5 }}>DIÁRIAS</span>
          </div>
          <div style={{ padding: '4px 6px', gridColumn: 'span 3' }}>{cellInp(dados.diarias, v => set('diarias', v), { placeholder: '—' })}</div>
        </div>
      </div>

      {/* VALOR R$ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16,185,129,0.08)', border: '2px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>VALOR R$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={dados.valor_total ?? ''}
          onChange={e => set('valor_total', e.target.value)}
          placeholder="0,00"
          style={{ width: 140, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '2px solid rgba(16,185,129,0.4)', color: '#10b981', fontSize: 18, fontWeight: 800, outline: 'none', textAlign: 'right', boxSizing: 'border-box' }}
        />
      </div>

      {/* Placa / Veículo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {fieldInp('Placa', 'placa', { placeholder: 'AAA0000' })}
        {fieldInp('Veículo', 'veiculo')}
      </div>

      {/* ── Composição do Valor ── */}
      <div style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Composição do Valor</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Horas em Espera', 'horas_espera', { type: 'number', placeholder: '0' })}
        {fieldInp('R$ Unit. Espera', 'valor_unit_espera', { type: 'number', placeholder: '0,00' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('Horas Trabalhadas', 'horas_trabalhadas', { type: 'number', placeholder: '0' })}
        {fieldInp('R$ Unit. H. Trabalhadas', 'valor_unit_horas', { type: 'number', placeholder: '0,00' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('KM Rodado Projeto', 'km_projeto', { type: 'number', placeholder: '0' })}
        {fieldInp('R$ Unit. KM Projeto', 'valor_unit_km_projeto', { type: 'number', placeholder: '0,00' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('KM Deslocamento', 'km_deslocamento', { type: 'number', placeholder: '0' })}
        {fieldInp('R$ Unit. KM Desloc.', 'valor_unit_km_deslocamento', { type: 'number', placeholder: '0,00' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {fieldInp('Pedágio', 'pedagio', { type: 'number', placeholder: '0,00' })}
        {fieldInp('Escolta', 'escolta', { type: 'number', placeholder: '0,00' })}
      </div>

      {/* ── Documentos Fiscais ── */}
      <div style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Documentos Fiscais</span>
      </div>
      <div style={{ marginBottom: 10 }}>
        {fieldInp('Nota Fiscal', 'nota_fiscal')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
        {fieldInp('CTE Inicial', 'cte_inicial')}
        {fieldInp('Valor CTE (R$)', 'valor_cte', { type: 'number', placeholder: '0,00' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        {fieldInp('CTE Complementar', 'cte_complementar')}
        {fieldInp('Valor CTE Compl. (R$)', 'valor_cte_complementar', { type: 'number', placeholder: '0,00' })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal principal — cria / edita lançamento
// ─────────────────────────────────────────────────────────────────────────────
function LancamentoModal({ item, workspaceId, userId, onClose, onSaved }) {
  const [tipoForm, setTipoForm] = useState(item?.tipo_formulario || 'padrao')
  const [form, setForm] = useState({
    tipo: 'receita',
    descricao: '',
    valor: '',
    data: new Date().toISOString().slice(0, 10),
    categoria: 'Transporte',
    centro_custo: '',
    status: 'rascunho',
    comprovante_url: '',
    observacoes: '',
    ...item,
    valor: item?.valor != null ? String(item.valor) : '',
  })
  const [dadosExtras, setDadosExtras] = useState(item?.dados_extras || {})
  const [saving, setSaving] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const fileRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (tipoForm === 'transporte') {
      const total = getValorTransporte(dadosExtras)
      setForm(f => ({ ...f, valor: String(total.toFixed(2)), tipo: 'receita' }))
    }
  }, [dadosExtras.valor_total, tipoForm])

  async function handleUpload(file) {
    if (!file || !supabase) return
    setUploadingImg(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `lancamentos/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('comprovantes').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: pub } = supabase.storage.from('comprovantes').getPublicUrl(path)
      set('comprovante_url', pub.publicUrl)
      toast.success('Comprovante anexado')
    } catch (e) {
      toast.error('Erro ao enviar imagem: ' + e.message)
    } finally {
      setUploadingImg(false)
    }
  }

  async function handleSave(statusOverride) {
    const valorFinal = tipoForm === 'transporte'
      ? getValorTransporte(dadosExtras)
      : parseFloat(String(form.valor).replace(',', '.'))
    if (isNaN(valorFinal) || valorFinal < 0) { toast.error('Valor inválido'); return }

    const d = dadosExtras
    const descricaoFinal = form.descricao.trim() || (tipoForm === 'transporte'
      ? `Nº ${d.numero_diario || '—'} | ${d.empresa || ''} | ${d.local_origem || ''} → ${d.local_destino || ''}`.trim()
      : '')
    if (!descricaoFinal) { toast.error('Informe a descrição'); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        status: statusOverride || form.status,
        descricao: descricaoFinal,
        valor: valorFinal,
        tipo_formulario: tipoForm,
        dados_extras: dadosExtras,
        workspace_id: workspaceId,
        user_id: userId,
      }
      delete payload.id
      if (item?.id) {
        // Detecta campos alterados para registrar no evento
        const camposAlterados = []
        const camposVisiveis = {
          descricao: 'Descrição',
          categoria: 'Categoria',
          centro_custo: 'Centro de Custo',
          observacoes: 'Observações',
        }
        Object.entries(camposVisiveis).forEach(([k, label]) => {
          const anterior = String(item[k] || '')
          const novo = String(payload[k] || '')
          if (anterior !== novo) camposAlterados.push({ campo: label, de: anterior || '—', para: novo || '—' })
        })
        // dados_extras: verifica origem e destino
        const extrasCampos = { local_origem: 'Origem', local_destino: 'Destino', placa: 'Placa', condutor: 'Condutor' }
        const itExtras = item?.dados_extras || {}
        Object.entries(extrasCampos).forEach(([k, label]) => {
          const anterior = String(itExtras[k] || '')
          const novo = String(dadosExtras[k] || '')
          if (anterior !== novo) camposAlterados.push({ campo: label, de: anterior || '—', para: novo || '—' })
        })

        const { error } = await supabase.from('lancamentos').update(payload).eq('id', item.id)
        if (error) throw error
        await registrarEvento({ lancamentoId: item.id, tipo: 'editado', usuarioId: userId, dados: { campos_alterados: camposAlterados } })
      } else {
        const { data: inserted, error } = await supabase.from('lancamentos').insert(payload).select('id').single()
        if (error) throw error
        const tipoEvento = statusOverride === 'aguardando_aprovacao' ? 'enviado_aprovacao' : 'criado'
        await registrarEvento({
          lancamentoId: inserted.id,
          tipo: tipoEvento,
          statusPara: statusOverride || form.status || 'rascunho',
          usuarioId: userId,
        })
      }
      toast.success(item?.id ? 'Lançamento atualizado!' : statusOverride === 'aguardando_aprovacao' ? 'Enviado para aprovação!' : 'Rascunho salvo!')
      onSaved()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 16, width: '100%', maxWidth: tipoForm === 'transporte' ? 680 : 540, maxHeight: '92vh', overflowY: 'auto', padding: 28 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {item?.id ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
            <XMarkIcon style={{ width: 22, height: 22 }} />
          </button>
        </div>

        {/* Seletor de tipo de formulário */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>TIPO DE FORMULÁRIO</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(FORM_TYPES).map(([k, v]) => {
              const Icon = v.icon
              return (
                <button key={k} onClick={() => setTipoForm(k)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '9px 12px', borderRadius: 9,
                  border: `2px solid ${tipoForm === k ? '#6366f1' : 'var(--border)'}`,
                  background: tipoForm === k ? 'rgba(99,102,241,0.1)' : 'transparent',
                  color: tipoForm === k ? '#818cf8' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700,
                }}>
                  <Icon style={{ width: 16, height: 16 }} />{v.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── FORMULÁRIO PADRÃO ── */}
        {tipoForm === 'padrao' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>TIPO</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {Object.entries(TIPO_CORES).map(([k, v]) => (
                  <button key={k} onClick={() => set('tipo', k)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${form.tipo === k ? v.text : 'var(--border)'}`, background: form.tipo === k ? v.bg : 'transparent', color: form.tipo === k ? v.text : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>{v.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>DESCRIÇÃO *</label>
              <input style={inputStyle} placeholder="Ex: Compra de material de escritório" value={form.descricao} onChange={e => set('descricao', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>VALOR (R$) *</label>
                <input style={inputStyle} type="number" min="0" step="0.01" placeholder="0,00" value={form.valor} onChange={e => set('valor', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>DATA</label>
                <input style={inputStyle} type="date" value={form.data} onChange={e => set('data', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>CATEGORIA</label>
                <select style={inputStyle} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>CENTRO DE CUSTO</label>
                <input style={inputStyle} placeholder="Ex: Administrativo" value={form.centro_custo} onChange={e => set('centro_custo', e.target.value)} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>STATUS</label>
              <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
                {Object.entries(STATUS_CONF).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>COMPROVANTE</label>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0])} />
              {form.comprovante_url ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={form.comprovante_url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                  <button onClick={() => set('comprovante_url', '')} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remover</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={uploadingImg} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, width: '100%', justifyContent: 'center' }}>
                  <PhotoIcon style={{ width: 16, height: 16 }} />
                  {uploadingImg ? 'Enviando...' : 'Anexar imagem'}
                </button>
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>OBSERVAÇÕES</label>
              <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} placeholder="Informações adicionais..." value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
            </div>
          </div>
        )}

        {/* ── FORMULÁRIO TRANSPORTE ── */}
        {tipoForm === 'transporte' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>DATA</label>
                <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={{ ...inputStyle, padding: '9px 10px' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>STATUS</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} style={{ ...inputStyle, padding: '9px 10px' }}>
                  {Object.entries(STATUS_CONF).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <FormTransporte dados={dadosExtras} onChange={setDadosExtras} />
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>OBSERVAÇÕES</label>
              <textarea style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} placeholder="Observações adicionais..." value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cancelar</button>
          {!item?.id && (
            <button onClick={() => handleSave('aguardando_aprovacao')} disabled={saving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              <PaperAirplaneIcon style={{ width: 15, height: 15 }} />Enviar para Aprovação
            </button>
          )}
          <button onClick={() => handleSave()} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {saving ? 'Salvando...' : item?.id ? 'Salvar alterações' : 'Salvar Rascunho'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Rota do Lançamento
// ─────────────────────────────────────────────────────────────────────────────
function RotaModal({ lancamento, onClose }) {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lancamento?.id || !supabase) return
    setLoading(true)
    supabase
      .from('lancamento_eventos')
      .select('*')
      .eq('lancamento_id', lancamento.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setEventos(data || []); setLoading(false) })
  }, [lancamento?.id])

  if (!lancamento) return null

  const d = lancamento.dados_extras || {}
  const isTransporte = lancamento.tipo_formulario === 'transporte'

  function fmtHora(iso) {
    if (!iso) return ''
    const dt = new Date(iso)
    return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  function fmtDataHora(iso) {
    if (!iso) return ''
    const dt = new Date(iso)
    const hoje = new Date()
    const isHoje = dt.toDateString() === hoje.toDateString()
    const data = isHoje ? 'Hoje' : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    return `${data} · ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }

  const infoStyle  = { display: 'flex', flexDirection: 'column', gap: 2 }
  const labelStyle = { fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.8, textTransform: 'uppercase' }
  const valueStyle = { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header fixo ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 2, borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPinIcon style={{ width: 20, height: 20, color: '#818cf8' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Rota do Lançamento</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {isTransporte ? `Nº ${d.numero_diario || '—'}` : (lancamento.descricao || '—')}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, borderRadius: 6, display: 'flex' }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Resumo ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--bg-primary)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
            {isTransporte ? (
              <>
                <div style={infoStyle}><span style={labelStyle}>Origem</span><span style={valueStyle}>{d.local_origem || '—'}</span></div>
                <div style={infoStyle}><span style={labelStyle}>Destino</span><span style={valueStyle}>{d.local_destino || '—'}</span></div>
                <div style={infoStyle}><span style={labelStyle}>Condutor</span><span style={valueStyle}>{d.condutor || '—'}</span></div>
                <div style={infoStyle}><span style={labelStyle}>Placa</span><span style={valueStyle}>{d.placa || '—'}</span></div>
              </>
            ) : (
              <>
                <div style={{ ...infoStyle, gridColumn: '1 / -1' }}><span style={labelStyle}>Descrição</span><span style={valueStyle}>{lancamento.descricao || '—'}</span></div>
                <div style={infoStyle}><span style={labelStyle}>Categoria</span><span style={valueStyle}>{lancamento.categoria || '—'}</span></div>
              </>
            )}
            <div style={infoStyle}><span style={labelStyle}>Status</span><StatusChip status={lancamento.status} /></div>
            <div style={infoStyle}>
              <span style={labelStyle}>Valor</span>
              <span style={{ ...valueStyle, color: lancamento.tipo === 'receita' ? '#10b981' : '#ef4444', fontSize: 15, fontWeight: 700 }}>{fmtCurrency(lancamento.valor)}</span>
            </div>
          </div>

          {/* ── Linha do tempo ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <ClockIcon style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.8, textTransform: 'uppercase' }}>Histórico de eventos</span>
              {!loading && eventos.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-primary)', borderRadius: 20, padding: '2px 8px', border: '1px solid var(--border)' }}>
                  {eventos.length} evento{eventos.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)', fontSize: 13 }}>Carregando...</div>
            ) : eventos.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px', background: 'var(--bg-primary)', borderRadius: 12, border: '1px dashed var(--border)', gap: 8 }}>
                <MapPinIcon style={{ width: 28, height: 28, color: 'var(--border)' }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>Nenhum evento registrado ainda.</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, textAlign: 'center' }}>O histórico de eventos aparecerá aqui.</p>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {/* trilho vertical */}
                <div style={{ position: 'absolute', left: 14, top: 12, bottom: 12, width: 1, background: 'var(--border)' }} />

                {eventos.map((ev, i) => {
                  const conf = EVENTO_CONF[ev.tipo] || EVENTO_CONF.editado
                  const Icon = conf.icon
                  const campos = ev.dados?.campos_alterados || []
                  const isLast = i === eventos.length - 1
                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: 12, marginBottom: isLast ? 0 : 18, position: 'relative' }}>
                      {/* ícone */}
                      <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                        <Icon style={{ width: 13, height: 13, color: conf.color }} />
                      </div>

                      {/* conteúdo */}
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                        {/* hora + título + data */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{fmtHora(ev.created_at)}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{conf.label}</span>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDataHora(ev.created_at)}</span>
                        </div>

                        {/* actor */}
                        {ev.usuario_nome && (
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>
                            {ev.usuario_nome}
                          </p>
                        )}

                        {/* mudança de status */}
                        {ev.status_de && ev.status_para && (
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--text-secondary)' }}>
                            {STATUS_CONF[ev.status_de]?.label || ev.status_de} → {STATUS_CONF[ev.status_para]?.label || ev.status_para}
                          </p>
                        )}

                        {/* campos alterados */}
                        {campos.map((c, ci) => (
                          <div key={ci} style={{ marginTop: 4, paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
                            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{c.campo}: {c.de || '—'} → {c.para || '—'}</p>
                          </div>
                        ))}

                        {/* motivo / descrição */}
                        {ev.descricao && (
                          <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: '2px solid var(--border)' }}>
                            {ev.tipo === 'devolvido' && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 4 }}>Motivo:</span>}
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ev.descricao}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <button onClick={onClose} style={{ padding: '10px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal de Digitalização
// ─────────────────────────────────────────────────────────────────────────────
function DigitalizacaoModal({ workspaceId, userId, onClose, onSaved }) {
  const [step, setStep]               = useState('upload')
  const [imgFile, setImgFile]         = useState(null)
  const [imgPreview, setImgPreview]   = useState(null)
  const [detectedType, setDetectedType] = useState('padrao')
  const [form, setForm]               = useState(null)
  const [dadosExtras, setDadosExtras] = useState({})
  const [saving, setSaving]           = useState(false)
  const fileRef = useRef()

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return }
    setImgFile(file)
    setImgPreview(URL.createObjectURL(file))
  }

  async function handleScan() {
    if (!imgFile) { toast.error('Selecione uma imagem primeiro'); return }
    setStep('scanning')
    try {
      const b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(imgFile)
      })
      const resp = await fetch('/api/ocr-formulario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64 }),
      })
      if (!resp.ok) throw new Error('Erro na API')
      const data = await resp.json()

      const hoje = new Date().toISOString().slice(0, 10)

      if (data.tipo_formulario === 'transporte') {
        setDetectedType('transporte')
        setDadosExtras({
          ...data,
          km_rows: mergeKmRows(data.km_rows),
        })
        setForm({
          tipo: 'receita',
          descricao: '',
          valor: String(data.valor_total || 0),
          data: data.data || hoje,
          categoria: 'Transporte',
          centro_custo: data.cc || '',
          status: 'rascunho',
          observacoes: data.observacao || '',
          comprovante_url: '',
        })
      } else {
        setDetectedType('padrao')
        setDadosExtras({})
        setForm({
          tipo: data.tipo || 'despesa',
          descricao: data.descricao || '',
          valor: data.valor != null ? String(data.valor) : '',
          data: data.data || hoje,
          categoria: data.categoria || 'Outros',
          centro_custo: data.centro_custo || '',
          status: 'rascunho',
          observacoes: data.observacoes || '',
          comprovante_url: '',
        })
      }
      setStep('review')
    } catch (e) {
      toast.error('Falha ao digitalizar: ' + e.message)
      setStep('upload')
    }
  }

  async function handleSave() {
    const valorFinal = detectedType === 'transporte'
      ? getValorTransporte(dadosExtras)
      : parseFloat(String(form?.valor || '0').replace(',', '.'))
    if (isNaN(valorFinal) || valorFinal < 0) { toast.error('Valor inválido'); return }

    const d = dadosExtras
    const descricao = (detectedType === 'transporte')
      ? `Nº ${d.numero_diario || '—'} | ${d.empresa || ''} | ${d.local_origem || ''} → ${d.local_destino || ''}`.trim()
      : (form?.descricao?.trim() || '')
    if (!descricao) { toast.error('Informe a descrição'); return }

    setSaving(true)
    try {
      let comprovante_url = ''
      if (imgFile && supabase) {
        const ext = imgFile.name.split('.').pop()
        const path = `lancamentos/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('comprovantes').upload(path, imgFile, { upsert: true })
        if (!upErr) {
          const { data: pub } = supabase.storage.from('comprovantes').getPublicUrl(path)
          comprovante_url = pub.publicUrl
        }
      }
      const { data: inserted, error } = await supabase.from('lancamentos').insert({
        ...form,
        descricao,
        valor: valorFinal,
        comprovante_url,
        tipo_formulario: detectedType,
        dados_extras: dadosExtras,
        workspace_id: workspaceId,
        user_id: userId,
      }).select('id').single()
      if (error) throw error
      // Registra: processado pela IA e criado
      if (inserted?.id) {
        await registrarEvento({ lancamentoId: inserted.id, tipo: 'processado_ia', descricao: 'Imagem lida e dados extraídos automaticamente.', usuarioId: userId })
        await registrarEvento({ lancamentoId: inserted.id, tipo: 'criado', statusPara: form.status || 'rascunho', usuarioId: userId })
      }
      toast.success('Formulário digitalizado e lançamento criado!')
      onSaved()
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', borderRadius: 16, width: '100%', maxWidth: detectedType === 'transporte' && step === 'review' ? 680 : 540, maxHeight: '92vh', overflowY: 'auto', padding: 28 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DocumentArrowUpIcon style={{ width: 18, height: 18, color: '#818cf8' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Digitalizar Formulário</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>IA extrai os dados automaticamente</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><XMarkIcon style={{ width: 22, height: 22 }} /></button>
        </div>

        {/* ── UPLOAD ── */}
        {step === 'upload' && (
          <div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
            {imgPreview ? (
              <div style={{ textAlign: 'center' }}>
                <img src={imgPreview} alt="" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 10, border: '1px solid var(--border)', objectFit: 'contain' }} />
                <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button onClick={() => { setImgFile(null); setImgPreview(null) }} style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>Trocar</button>
                  <button onClick={handleScan} style={{ padding: '8px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#4f46e5,#6366f1)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <SparklesIcon style={{ width: 15, height: 15 }} /> Analisar com IA
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', cursor: 'pointer' }}>
                <DocumentArrowUpIcon style={{ width: 44, height: 44, color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Arraste ou clique para selecionar</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Foto do Diário do Motorista ou qualquer documento</p>
              </div>
            )}
          </div>
        )}

        {/* ── SCANNING ── */}
        {step === 'scanning' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <SparklesIcon style={{ width: 44, height: 44, color: '#818cf8', margin: '0 auto 16px' }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Analisando formulário...</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Extraindo dados com IA</p>
          </div>
        )}

        {/* ── REVIEW ── */}
        {step === 'review' && form && (
          <div>
            <div style={{ background: detectedType === 'transporte' ? 'rgba(99,102,241,0.08)' : 'rgba(16,185,129,0.08)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: detectedType === 'transporte' ? '#a5b4fc' : '#6ee7b7', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              {detectedType === 'transporte'
                ? <><TruckIcon style={{ width: 14, height: 14 }} /> Diário do Motorista detectado — revise e confirme os dados.</>
                : <><SparklesIcon style={{ width: 14, height: 14 }} /> Dados extraídos pela IA — revise antes de salvar.</>
              }
            </div>

            {/* Preview da imagem */}
            {imgPreview && (
              <img src={imgPreview} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }} />
            )}

            {/* Data + Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>DATA</label>
                <input type="date" style={inputStyle} value={form.data} onChange={e => setF('data', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>STATUS</label>
                <select style={inputStyle} value={form.status} onChange={e => setF('status', e.target.value)}>
                  {Object.entries(STATUS_CONF).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>

            {/* Formulário de transporte */}
            {detectedType === 'transporte' && (
              <FormTransporte dados={dadosExtras} onChange={setDadosExtras} />
            )}

            {/* Formulário padrão */}
            {detectedType === 'padrao' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input style={inputStyle} placeholder="Descrição" value={form.descricao} onChange={e => setF('descricao', e.target.value)} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input style={inputStyle} type="number" placeholder="Valor (R$)" value={form.valor} onChange={e => setF('valor', e.target.value)} />
                  <select style={inputStyle} value={form.categoria} onChange={e => setF('categoria', e.target.value)}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <input style={inputStyle} placeholder="Centro de custo" value={form.centro_custo} onChange={e => setF('centro_custo', e.target.value)} />
                {form.observacoes && <textarea style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} />}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep('upload')} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Voltar</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 10, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                {saving ? 'Salvando...' : 'Confirmar e Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detalhe expandido de transporte
// ─────────────────────────────────────────────────────────────────────────────
function TransporteDetail({ d = {} }) {
  const kmRows = (d.km_rows || []).filter(r => r.saida || r.entrada || r.total)

  const infoRows = [
    d.numero_diario && ['Nº Diário', d.numero_diario],
    d.empresa       && ['Empresa',    d.empresa],
    d.setor         && ['Setor',      d.setor],
    d.solicitante   && ['Solicitante',d.solicitante],
    d.cc            && ['CC',         d.cc],
    (d.local_origem || d.local_destino) && ['Rota', `${d.local_origem || '—'} → ${d.local_destino || '—'}`],
    d.equipamento   && ['Equipamento',d.equipamento],
    d.placa         && ['Placa',      d.placa],
    d.veiculo       && ['Veículo',    d.veiculo],
    d.diarias       && ['Diárias',    d.diarias],
  ].filter(Boolean)

  return (
    <div>
      {infoRows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8, marginBottom: 12 }}>
          {infoRows.map(([label, value]) => (
            <div key={label}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      )}
      {kmRows.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border)' }}>
            {['', 'SAÍDA', 'ENTRADA', 'TOTAL/KM'].map(h => (
              <div key={h} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>{h}</div>
            ))}
          </div>
          {kmRows.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', borderBottom: i < kmRows.length - 1 ? '1px solid var(--border)' : 'none', background: row.tipo === 'ASFALTO' ? 'rgba(99,102,241,0.04)' : 'rgba(245,158,11,0.04)' }}>
              <div style={{ padding: '5px 8px', fontSize: 10, fontWeight: 800, color: row.tipo === 'ASFALTO' ? '#818cf8' : '#f59e0b', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{row.tipo}</div>
              {[row.saida, row.entrada, row.total].map((v, j) => (
                <div key={j} style={{ padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', textAlign: 'center' }}>{v || '—'}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Painel WhatsApp — cadastro de motoristas
// ─────────────────────────────────────────────────────────────────────────────
function WhatsAppPanel({ workspaceId }) {
  const [motoristas, setMotoristas] = useState([])
  const [loading, setLoading]       = useState(true)
  const [form, setForm]             = useState({ phone_number: '', nome_motorista: '' })
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    setMotoristas(data || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    const phone = form.phone_number.replace(/\D/g, '')
    if (phone.length < 10) { toast.error('Número inválido — use somente dígitos (ex: 5567999990000)'); return }
    if (!form.nome_motorista.trim()) { toast.error('Informe o nome do motorista'); return }
    setSaving(true)
    const { error } = await supabase.from('whatsapp_config').insert({
      workspace_id:   workspaceId,
      phone_number:   phone,
      nome_motorista: form.nome_motorista.trim(),
      ativo:          true,
    })
    if (error) {
      toast.error(error.code === '23505' ? 'Número já cadastrado' : 'Erro: ' + error.message)
    } else {
      toast.success('Motorista cadastrado!')
      setForm({ phone_number: '', nome_motorista: '' })
      load()
    }
    setSaving(false)
  }

  async function handleToggle(id, ativo) {
    await supabase.from('whatsapp_config').update({ ativo }).eq('id', id)
    setMotoristas(prev => prev.map(m => m.id === id ? { ...m, ativo } : m))
  }

  async function handleRemove(id) {
    if (!window.confirm('Remover este motorista?')) return
    await supabase.from('whatsapp_config').delete().eq('id', id)
    setMotoristas(prev => prev.filter(m => m.id !== id))
    toast.success('Removido')
  }

  const webhookUrl = `https://dividiai.app.br/api/webhook-whatsapp`
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }

  return (
    <div>
      {/* Como configurar */}
      <div style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <QrCodeIcon style={{ width: 20, height: 20, color: '#25d366' }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: '#25d366' }}>Configuração Z-API</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 8px' }}>1. Acesse <a href="https://z-api.io" target="_blank" rel="noreferrer" style={{ color: '#25d366' }}>z-api.io</a> e crie uma instância conectando seu WhatsApp.</p>
          <p style={{ margin: '0 0 8px' }}>2. Em <b>Webhook → Ao receber</b>, configure a URL:</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', borderRadius: 7, padding: '8px 12px', margin: '0 0 8px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)' }}>
            {webhookUrl}
            <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copiado!') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#25d366', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>COPIAR</button>
          </div>
          <p style={{ margin: '0 0 4px' }}>3. Nas variáveis de ambiente do Vercel, adicione:</p>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12 }}>
            <li><b>ZAPI_INSTANCE_ID</b> — ID da instância Z-API</li>
            <li><b>ZAPI_TOKEN</b> — Token da instância</li>
            <li><b>SUPABASE_SERVICE_KEY</b> — service_role key do Supabase</li>
            <li><b>WHATSAPP_WEBHOOK_TOKEN</b> — qualquer string secreta (opcional)</li>
          </ul>
        </div>
      </div>

      {/* Adicionar motorista */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px', marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlusIcon style={{ width: 18, height: 18 }} /> Cadastrar Motorista
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>NÚMERO WHATSAPP</label>
            <input style={inputStyle} placeholder="5567999990000 (só dígitos)" value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value.replace(/\D/g, '') }))} />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, display: 'block' }}>DDI + DDD + número (ex: 5567999990000)</span>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>NOME DO MOTORISTA</label>
            <input style={inputStyle} placeholder="Ex: João Silva" value={form.nome_motorista} onChange={e => setForm(f => ({ ...f, nome_motorista: e.target.value }))} />
          </div>
          <button onClick={handleAdd} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#25d366,#128c7e)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, height: 42 }}>
            {saving ? '...' : 'Adicionar'}
          </button>
        </div>
      </div>

      {/* Lista de motoristas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando...</div>
      ) : motoristas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <PhoneIcon style={{ width: 40, height: 40, color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Nenhum motorista cadastrado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {motoristas.map(m => (
            <div key={m.id} style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: `1px solid ${m.ativo ? 'rgba(37,211,102,0.2)' : 'var(--border)'}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: m.ativo ? 'rgba(37,211,102,0.12)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PhoneIcon style={{ width: 17, height: 17, color: m.ativo ? '#25d366' : 'var(--text-secondary)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{m.nome_motorista}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>+{m.phone_number}</div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: m.ativo ? 'rgba(37,211,102,0.1)' : 'rgba(255,255,255,0.05)', color: m.ativo ? '#25d366' : 'var(--text-secondary)' }}>
                {m.ativo ? 'Ativo' : 'Inativo'}
              </span>
              <button onClick={() => handleToggle(m.id, !m.ativo)} style={{ padding: '5px 12px', borderRadius: 7, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>
                {m.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button onClick={() => handleRemove(m.id)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
                <TrashIcon style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Painel de Notificações por Status
// Cada linha = "pessoa X recebe WhatsApp quando o lançamento entrar no status Y"
// ─────────────────────────────────────────────────────────────────────────────
const TODOS_STATUS = [
  { value: 'aguardando_aprovacao', label: '⏳ Aguardando Aprovação' },
  { value: 'aprovado',             label: '✅ Aprovado' },
  { value: 'devolvido',            label: '⚠️ Devolvido' },
  { value: 'corrigido',            label: '🔧 Corrigido / Reenviado' },
  { value: 'reprovado',            label: '❌ Reprovado' },
  { value: 'faturado',             label: '💰 Faturado' },
  { value: 'cancelado',            label: '🚫 Cancelado' },
]

function StatusNotifPanel({ workspaceId }) {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ status: 'aprovado', nome_destinatario: '', phone_number: '' })

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data } = await supabase
      .from('status_notificacoes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('status')
      .order('created_at', { ascending: false })
    setRegistros(data || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    const phone = form.phone_number.replace(/\D/g, '')
    if (phone.length < 10) { toast.error('Número inválido — somente dígitos (ex: 5567999990000)'); return }
    if (!form.nome_destinatario.trim()) { toast.error('Informe o nome do destinatário'); return }
    setSaving(true)
    const { error } = await supabase.from('status_notificacoes').insert({
      workspace_id:     workspaceId,
      status:           form.status,
      nome_destinatario: form.nome_destinatario.trim(),
      phone_number:     phone,
      ativo:            true,
    })
    if (error) {
      toast.error('Erro: ' + error.message)
    } else {
      toast.success('Destinatário adicionado!')
      setForm(f => ({ ...f, nome_destinatario: '', phone_number: '' }))
      load()
    }
    setSaving(false)
  }

  async function handleToggle(id, ativo) {
    await supabase.from('status_notificacoes').update({ ativo }).eq('id', id)
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, ativo } : r))
  }

  async function handleRemove(id) {
    if (!window.confirm('Remover este destinatário?')) return
    await supabase.from('status_notificacoes').delete().eq('id', id)
    setRegistros(prev => prev.filter(r => r.id !== id))
    toast.success('Removido')
  }

  // Agrupa por status para exibição
  const porStatus = TODOS_STATUS.map(s => ({
    ...s,
    items: registros.filter(r => r.status === s.value),
  })).filter(s => s.items.length > 0)

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    background: 'var(--bg-primary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }
  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  return (
    <div>
      {/* Explicação */}
      <div style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <BellAlertIcon style={{ width: 18, height: 18, color: '#818cf8' }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: '#818cf8' }}>Como funciona</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Cadastre aqui <b>quem recebe notificação WhatsApp</b> quando um lançamento entrar em cada etapa.
          Uma mesma pessoa pode estar em múltiplos status — receberá mensagem em cada um.
          O sistema dispara automaticamente ao mudar o status no Faturamento.
        </p>
      </div>

      {/* Formulário de adição */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px', marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlusIcon style={{ width: 17, height: 17 }} /> Adicionar Destinatário
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>ETAPA / STATUS</label>
            <select style={selectStyle} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {TODOS_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>NOME DO DESTINATÁRIO</label>
            <input style={inputStyle} placeholder="Ex: Paulo Gestor" value={form.nome_destinatario} onChange={e => setForm(f => ({ ...f, nome_destinatario: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>WHATSAPP (DDI+DDD+NÚMERO)</label>
            <input style={inputStyle} placeholder="5567999990000" value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value.replace(/\D/g, '') }))} />
          </div>
          <button onClick={handleAdd} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg,#818cf8,#6366f1)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14, height: 42, flexShrink: 0 }}>
            {saving ? '...' : 'Adicionar'}
          </button>
        </div>
      </div>

      {/* Lista agrupada por status */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Carregando...</div>
      ) : registros.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <BellAlertIcon style={{ width: 44, height: 44, color: 'var(--text-secondary)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Nenhum destinatário configurado ainda.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {porStatus.map(grupo => (
            <div key={grupo.value}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                {grupo.label}
                <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 20, background: 'rgba(129,140,248,0.12)', color: '#818cf8', fontWeight: 700 }}>
                  {grupo.items.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {grupo.items.map(r => (
                  <div key={r.id} style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: `1px solid ${r.ativo ? 'rgba(129,140,248,0.2)' : 'var(--border)'}`, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: r.ativo ? 'rgba(129,140,248,0.1)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <PhoneIcon style={{ width: 16, height: 16, color: r.ativo ? '#818cf8' : 'var(--text-secondary)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{r.nome_destinatario}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>+{r.phone_number}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: r.ativo ? 'rgba(129,140,248,0.1)' : 'rgba(255,255,255,0.05)', color: r.ativo ? '#818cf8' : 'var(--text-secondary)' }}>
                      {r.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                    <button onClick={() => handleToggle(r.id, !r.ativo)} style={{ padding: '5px 12px', borderRadius: 7, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>
                      {r.ativo ? 'Pausar' : 'Ativar'}
                    </button>
                    <button onClick={() => handleRemove(r.id)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
                      <TrashIcon style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Lancamentos() {
  const { workspaceId } = useStore()
  const [tab, setTab]                   = useState('lancamentos')
  const [lancamentos, setLancamentos]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [userId, setUserId]             = useState(null)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState('meus')
  const [filterForm, setFilterForm]     = useState('todos')
  const [showModal, setShowModal]       = useState(false)
  const [showDigital, setShowDigital]   = useState(false)
  const [editItem, setEditItem]         = useState(null)
  const [rotaItem, setRotaItem]         = useState(null)
  const [expandedId, setExpandedId]     = useState(null)

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null))
  }, [])

  const loadData = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase
      .from('lancamentos')
      .select('*')
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { toast.error('Erro ao carregar lançamentos'); setLoading(false); return }
    setLancamentos(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleDelete(id) {
    if (!window.confirm('Excluir este lançamento?')) return
    const { error } = await supabase.from('lancamentos').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Lançamento excluído')
    loadData()
  }

  async function handleStatus(id, novoStatus) {
    const lancamento = lancamentos.find(l => l.id === id)
    const statusAnterior = lancamento?.status || null
    const { error } = await supabase.from('lancamentos').update({ status: novoStatus }).eq('id', id)
    if (error) { toast.error('Erro ao atualizar status'); return }
    setLancamentos(prev => prev.map(l => l.id === id ? { ...l, status: novoStatus } : l))
    // Mapeia o status para tipo de evento
    const tipoEvento = novoStatus === 'aguardando_aprovacao' ? 'enviado_aprovacao' : novoStatus
    await registrarEvento({ lancamentoId: id, tipo: tipoEvento, statusDe: statusAnterior, statusPara: novoStatus, usuarioId: userId })
  }

  const filtered = lancamentos.filter(l => {
    if (filterStatus === 'meus') {
      if (l.status !== 'rascunho' && l.status !== 'devolvido') return false
    } else if (filterStatus === 'em_revisao') {
      if (l.status !== 'aguardando_aprovacao' && l.status !== 'corrigido') return false
    } else if (filterStatus !== 'todos' && l.status !== filterStatus) return false
    if (filterForm !== 'todos' && (l.tipo_formulario || 'padrao') !== filterForm) return false
    if (search) {
      const q = search.toLowerCase()
      const d = l.dados_extras || {}
      if (
        !l.descricao?.toLowerCase().includes(q) &&
        !l.centro_custo?.toLowerCase().includes(q) &&
        !d.numero_diario?.toLowerCase().includes(q) &&
        !d.empresa?.toLowerCase().includes(q) &&
        !d.placa?.toLowerCase().includes(q) &&
        !d.solicitante?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const totalReceitas  = filtered.filter(l => l.tipo === 'receita'  && l.status !== 'rejeitado').reduce((s, l) => s + (l.valor || 0), 0)
  const totalDespesas  = filtered.filter(l => l.tipo === 'despesa'  && l.status !== 'rejeitado').reduce((s, l) => s + (l.valor || 0), 0)
  const pendentes = filtered.filter(l => ['rascunho','aguardando_aprovacao','devolvido','corrigido'].includes(l.status)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      <Header title="Lançamentos" subtitle="Diário do Motorista e documentos financeiros" />

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        {[
          { key: 'lancamentos', label: 'Lançamentos',    Icon: DocumentTextIcon },
          { key: 'whatsapp',    label: 'WhatsApp',       Icon: PhoneIcon },
          { key: 'notificacoes', label: 'Notificações',  Icon: BellAlertIcon },
        ].map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px',
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            color: tab === key ? '#818cf8' : 'var(--text-secondary)',
            borderBottom: `2px solid ${tab === key ? '#818cf8' : 'transparent'}`,
            marginBottom: -1,
          }}>
            <Icon style={{ width: 15, height: 15 }} />{label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* ── ABA WHATSAPP ── */}
        {tab === 'whatsapp' && <WhatsAppPanel workspaceId={workspaceId} />}

        {/* ── ABA NOTIFICAÇÕES ── */}
        {tab === 'notificacoes' && <StatusNotifPanel workspaceId={workspaceId} />}

        {/* ── ABA LANÇAMENTOS ── */}
        {tab === 'lancamentos' && <>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'RECEITAS',  value: fmtCurrency(totalReceitas),  color: '#10b981' },
            { label: 'DESPESAS',  value: fmtCurrency(totalDespesas),  color: '#ef4444' },
            { label: 'SALDO',     value: fmtCurrency(totalReceitas - totalDespesas), color: totalReceitas - totalDespesas >= 0 ? '#10b981' : '#ef4444' },
            { label: 'PENDENTES', value: pendentes, color: pendentes > 0 ? '#f59e0b' : 'var(--text-primary)' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '16px 20px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Barra de ações */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-secondary)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar Nº, placa, empresa, solicitante..." style={{ width: '100%', paddingLeft: 34, padding: '9px 12px 9px 34px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <select value={filterForm} onChange={e => setFilterForm(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer' }}>
            <option value="todos">Todos formulários</option>
            <option value="transporte">Diário Motorista</option>
            <option value="padrao">Padrão</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer' }}>
            <option value="meus">Meus lançamentos</option>
            <option value="em_revisao">Em revisão (Faturamento)</option>
            <option value="aprovado">Aprovados</option>
            <option value="faturado">Faturados</option>
            <option value="reprovado">Reprovados</option>
            <option value="cancelado">Cancelados</option>
            <option value="todos">Todos</option>
          </select>
          <button onClick={() => setShowDigital(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
            <DocumentArrowUpIcon style={{ width: 16, height: 16 }} /> Digitalizar
          </button>
          <button onClick={() => { setEditItem(null); setShowModal(true) }} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
            <PlusIcon style={{ width: 16, height: 16 }} /> Novo
          </button>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <TruckIcon style={{ width: 52, height: 52, color: 'var(--text-secondary)', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Nenhum lançamento encontrado.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  {['DATA', 'Nº DM', 'CLIENTE / DESCRIÇÃO', 'ORIGEM', 'DESTINO', 'PLACA', 'KM ASF', 'KM TER', 'KM TOTAL', 'VALOR', 'STATUS', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: (h === 'VALOR' || h === 'KM ASF' || h === 'KM TER' || h === 'KM TOTAL') ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const isTransporte = (l.tipo_formulario || 'padrao') === 'transporte'
                  const d = l.dados_extras || {}
                  const km = isTransporte ? calcKmTotais(d) : null
                  const fmtKm = v => v > 0 ? v.toLocaleString('pt-BR') : '—'
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      {/* DATA */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: 12 }}>{fmtDate(l.data)}</td>
                      {/* Nº DM */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {isTransporte && d.numero_diario
                          ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{d.numero_diario}</span>
                          : <span style={{ color: 'var(--text-secondary)' }}>—</span>
                        }
                      </td>
                      {/* CLIENTE + condutor */}
                      <td style={{ padding: '10px 12px', maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {isTransporte ? (d.cliente || d.empresa || l.descricao) : l.descricao}
                        </div>
                        {d.condutor && <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.condutor}</div>}
                      </td>
                      {/* ORIGEM */}
                      <td style={{ padding: '10px 12px', maxWidth: 160, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isTransporte ? (d.local_origem || '—') : '—'}
                      </td>
                      {/* DESTINO */}
                      <td style={{ padding: '10px 12px', maxWidth: 160, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isTransporte ? (d.local_destino || '—') : '—'}
                      </td>
                      {/* PLACA */}
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap', letterSpacing: 0.5 }}>{d.placa || '—'}</td>
                      {/* KM ASF */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: km?.asfalto > 0 ? 700 : 400, color: km?.asfalto > 0 ? '#818cf8' : 'var(--text-secondary)', fontSize: 12 }}>{fmtKm(km?.asfalto)}</td>
                      {/* KM TER */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: km?.terra > 0 ? 700 : 400, color: km?.terra > 0 ? '#f59e0b' : 'var(--text-secondary)', fontSize: 12 }}>{fmtKm(km?.terra)}</td>
                      {/* KM TOTAL */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: km?.total > 0 ? 800 : 400, color: km?.total > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13 }}>{fmtKm(km?.total)}</td>
                      {/* VALOR */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 700, color: l.tipo === 'receita' ? '#10b981' : l.tipo === 'despesa' ? '#ef4444' : '#818cf8' }}>
                        {fmtCurrency(l.valor)}
                      </td>
                      {/* STATUS */}
                      <td style={{ padding: '10px 12px' }}><StatusChip status={l.status} /></td>
                      {/* AÇÕES */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          {l.status === 'rascunho' && (
                            <button title="Enviar para Aprovação" onClick={() => handleStatus(l.id, 'aguardando_aprovacao')}
                              style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#f59e0b', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <PaperAirplaneIcon style={{ width: 15, height: 15 }} />
                            </button>
                          )}
                          {l.status === 'devolvido' && (
                            <button title="Reenviar corrigido para Aprovação" onClick={() => handleStatus(l.id, 'corrigido')}
                              style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#6366f1', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <ArrowPathIcon style={{ width: 15, height: 15 }} />
                            </button>
                          )}
                          <button title="Editar" onClick={() => { setEditItem(l); setShowModal(true) }}
                            style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <PencilIcon style={{ width: 15, height: 15 }} />
                          </button>
                          <button title="Ver trajetória do item" onClick={() => setRotaItem(l)}
                            style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <MapPinIcon style={{ width: 15, height: 15 }} />
                          </button>
                          {l.comprovante_url && (
                            <button title="Ver comprovante" onClick={() => window.open(l.comprovante_url, '_blank')}
                              style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#818cf8', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <PhotoIcon style={{ width: 15, height: 15 }} />
                            </button>
                          )}
                          <button title="Excluir" onClick={() => handleDelete(l.id)}
                            style={{ padding: 5, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <TrashIcon style={{ width: 15, height: 15 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        </>}
      </div>

      {showModal && (
        <LancamentoModal
          item={editItem}
          workspaceId={workspaceId}
          userId={userId}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSaved={() => { setShowModal(false); setEditItem(null); loadData() }}
        />
      )}
      {showDigital && (
        <DigitalizacaoModal
          workspaceId={workspaceId}
          userId={userId}
          onClose={() => setShowDigital(false)}
          onSaved={() => { setShowDigital(false); loadData() }}
        />
      )}
      {rotaItem && (
        <RotaModal
          lancamento={rotaItem}
          onClose={() => setRotaItem(null)}
        />
      )}
    </div>
  )
}
