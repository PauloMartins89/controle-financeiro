import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import {
  PlusIcon, TrashIcon, ArrowPathIcon,
  CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────────────────────

const MODULOS = [
  {
    key: 'refeicoes', label: 'Refeições', icon: '🍽️', cor: '#10b981',
    eventos: [
      { key: 'nova_solicitacao', label: 'Nova Solicitação',    descricao: 'Colaborador solicita refeição — notifica supervisor' },
      { key: 'aprovado',         label: 'Aprovado',            descricao: 'Supervisor aprovou — notifica colaborador' },
      { key: 'recusado',         label: 'Recusado',            descricao: 'Supervisor recusou — notifica colaborador' },
    ],
  },
  {
    key: 'compras', label: 'Compras', icon: '🛒', cor: '#f59e0b',
    eventos: [
      { key: 'nova_solicitacao', label: 'Nova Solicitação',    descricao: 'Compra criada — notifica aprovador' },
      { key: 'aprovado',         label: 'Aprovado',            descricao: 'Aprovador confirmou — notifica solicitante' },
      { key: 'recusado',         label: 'Recusado',            descricao: 'Aprovador recusou — notifica solicitante' },
      { key: 'leilao_aberto',    label: 'Leilão Aberto',       descricao: 'Cotações enviadas aos fornecedores' },
      { key: 'compra_paga',      label: 'Compra Paga',         descricao: 'Pagamento confirmado — notifica solicitante' },
    ],
  },
  {
    key: 'lancamentos', label: 'Lançamentos', icon: '📋', cor: '#6366f1',
    eventos: [
      { key: 'aguardando_aprovacao', label: 'Aguardando Aprovação', descricao: 'Lançamento criado — notifica aprovador' },
      { key: 'aprovado',             label: 'Aprovado',             descricao: 'Aprovado — notifica criador' },
      { key: 'devolvido',            label: 'Devolvido',            descricao: 'Devolvido para correção — notifica criador' },
      { key: 'faturado',             label: 'Faturado',             descricao: 'Faturado — notifica aprovador' },
    ],
  },
]

const CANAIS = [
  { key: 'whatsapp', label: '📱 WhatsApp' },
  { key: 'email',    label: '✉️ E-mail' },
  { key: 'ambos',    label: '📱✉️ Ambos' },
]

const TABS = [
  { key: 'mapa',         label: '🗺️ Mapa' },
  { key: 'configuracao', label: '⚙️ Configuração' },
  { key: 'pendentes',    label: '⏳ Pendentes' },
  { key: 'validacao',    label: '🔍 Validação' },
  { key: 'metricas',     label: '📊 Métricas' },
  { key: 'simulador',    label: '🧪 Simulador' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(s) {
  if (!s) return '—'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}min`
  return `${(s / 3600).toFixed(1)}h`
}

function fmtAgo(ts) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'há poucos segundos'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return `há ${Math.floor(diff / 86400)}d`
}

// ── Tab: Mapa ─────────────────────────────────────────────────────────────────

function TabMapa({ workspaceId }) {
  const [rotas, setRotas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('rotas_config')
      .select('*, efetivo(id, nome, celular, email, funcoes_efetivo(nome))')
      .eq('workspace_id', workspaceId)
      .eq('ativo', true)
      .then(({ data }) => { setRotas(data || []); setLoading(false) })
  }, [workspaceId])

  if (loading) return <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando…</p>

  const totalRotas = rotas.length
  const totalOk = rotas.filter(r => {
    const e = r.efetivo
    if (r.canal === 'whatsapp') return e?.usa_whatsapp && e?.celular
    if (r.canal === 'email')    return e?.usa_email && e?.email
    return (e?.usa_whatsapp && e?.celular) && (e?.usa_email && e?.email)
  }).length

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Rotas configuradas', value: totalRotas, cor: '#6366f1' },
          { label: 'Rotas operacionais', value: totalOk, cor: '#10b981' },
          { label: 'Com problema',       value: totalRotas - totalOk, cor: totalRotas - totalOk > 0 ? '#ef4444' : '#6b7280' },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', minWidth: 140 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.cor }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Module trees */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {MODULOS.map(mod => (
          <div key={mod.key} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: `${mod.cor}10` }}>
              <span style={{ fontSize: 18 }}>{mod.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: mod.cor }}>{mod.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
                {rotas.filter(r => r.modulo === mod.key).length} ator(es) configurado(s)
              </span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {mod.eventos.map((ev, i) => {
                const atores = rotas.filter(r => r.modulo === mod.key && r.evento === ev.key)
                return (
                  <div key={ev.key} style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 18px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ width: 210, flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{ev.descricao}</div>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '3px 14px 0', flexShrink: 0 }}>→</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 2 }}>
                      {atores.length === 0 ? (
                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                          ⚠️ sem ator
                        </span>
                      ) : atores.map(a => {
                        const e = a.efetivo
                        const ok = a.canal === 'whatsapp' ? e?.usa_whatsapp && e?.celular
                                 : a.canal === 'email'    ? e?.usa_email && e?.email
                                 : e?.celular && e?.email
                        return (
                          <span key={a.id} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: ok ? `${mod.cor}18` : 'rgba(239,68,68,0.1)', border: `1px solid ${ok ? mod.cor + '35' : 'rgba(239,68,68,0.25)'}`, color: ok ? 'var(--text)' : '#fca5a5' }}>
                            {a.canal === 'whatsapp' ? '📱' : a.canal === 'email' ? '✉️' : '📱✉️'} {e?.nome || '—'}
                            {e?.funcoes_efetivo?.nome && <span style={{ color: 'var(--text-secondary)', marginLeft: 4, fontSize: 11 }}>({e.funcoes_efetivo.nome})</span>}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab: Configuração ─────────────────────────────────────────────────────────

function TabConfiguracao({ workspaceId }) {
  const [rotas, setRotas]     = useState([])
  const [efetivo, setEfetivo] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [moduloSel, setModuloSel] = useState('refeicoes')
  const [form, setForm] = useState({ evento: '', efetivo_id: '', canal: 'whatsapp' })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: e }] = await Promise.all([
      supabase.from('rotas_config')
        .select('*, efetivo(id, nome, funcoes_efetivo(nome))')
        .eq('workspace_id', workspaceId)
        .eq('ativo', true)
        .order('modulo').order('evento'),
      supabase.from('efetivo')
        .select('id, nome, funcoes_efetivo(nome)')
        .eq('workspace_id', workspaceId)
        .eq('ativo', true)
        .order('nome'),
    ])
    setRotas(r || [])
    setEfetivo(e || [])
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const eventosMod = MODULOS.find(m => m.key === moduloSel)?.eventos || []
  const rotasFiltradas = rotas.filter(r => r.modulo === moduloSel)

  async function handleAdd() {
    if (!form.evento || !form.efetivo_id) { toast.error('Selecione evento e colaborador'); return }
    setSaving(true)
    const { error } = await supabase.from('rotas_config').insert({
      workspace_id: workspaceId, modulo: moduloSel,
      evento: form.evento, efetivo_id: form.efetivo_id, canal: form.canal, ativo: true,
    })
    setSaving(false)
    if (error) {
      toast.error(error.code === '23505' ? 'Este ator já está nessa rota' : error.message)
      return
    }
    toast.success('Rota configurada!')
    setForm(f => ({ ...f, evento: '', efetivo_id: '' }))
    load()
  }

  async function handleDelete(id) {
    await supabase.from('rotas_config').delete().eq('id', id)
    toast.success('Rota removida')
    load()
  }

  return (
    <div>
      {/* Module selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {MODULOS.map(m => (
          <button key={m.key} onClick={() => setModuloSel(m.key)}
            style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: moduloSel === m.key ? 700 : 400,
              borderColor: moduloSel === m.key ? m.cor : 'var(--border)',
              background:  moduloSel === m.key ? `${m.cor}18` : 'transparent',
              color:       moduloSel === m.key ? m.cor : 'var(--text-secondary)' }}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, marginBottom: 20, alignItems: 'flex-end' }}>
        <div>
          <label className="label">Evento</label>
          <select className="input" value={form.evento} onChange={e => setForm(f => ({ ...f, evento: e.target.value }))}>
            <option value="">— Selecionar —</option>
            {eventosMod.map(ev => <option key={ev.key} value={ev.key}>{ev.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Colaborador</label>
          <select className="input" value={form.efetivo_id} onChange={e => setForm(f => ({ ...f, efetivo_id: e.target.value }))}>
            <option value="">— Selecionar —</option>
            {efetivo.map(e => (
              <option key={e.id} value={e.id}>
                {e.nome}{e.funcoes_efetivo?.nome ? ` (${e.funcoes_efetivo.nome})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Canal</label>
          <select className="input" value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))}>
            {CANAIS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={handleAdd} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <PlusIcon style={{ width: 15, height: 15 }} /> Adicionar
        </button>
      </div>

      {/* Routes list */}
      {loading ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando…</p>
      ) : rotasFiltradas.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Nenhuma rota configurada para {MODULOS.find(m => m.key === moduloSel)?.label}. Use o formulário acima para adicionar.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Evento', 'Colaborador', 'Função', 'Canal', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rotasFiltradas.map(r => {
              const ev = MODULOS.find(m => m.key === r.modulo)?.eventos.find(e => e.key === r.evento)
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{ev?.label || r.evento}</td>
                  <td style={{ padding: '10px 12px' }}>{r.efetivo?.nome || '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{r.efetivo?.funcoes_efetivo?.nome || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', color: '#a5b4fc' }}>
                      {CANAIS.find(c => c.key === r.canal)?.label || r.canal}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => handleDelete(r.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}>
                      <TrashIcon style={{ width: 14, height: 14 }} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Tab: Pendentes ────────────────────────────────────────────────────────────

function TabPendentes({ workspaceId, onCountChange }) {
  const [pendentes, setPendentes] = useState([])
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('mensagens_whatsapp')
      .select('*')
      .eq('aguardando_resposta', true)
      .is('respondido_em', null)
      .order('created_at', { ascending: false })
      .limit(100)
    const lista = data || []
    setPendentes(lista)
    onCountChange(lista.length)
    setLoading(false)
  }, [onCountChange])

  useEffect(() => { load() }, [load])

  async function forcarOk(id, createdAt) {
    const agora = new Date().toISOString()
    const inicio = new Date(createdAt).getTime()
    const tempoS = Math.floor((Date.now() - inicio) / 1000)
    await supabase.from('mensagens_whatsapp').update({
      respondido_em: agora, resposta_recebida: 'forcado', aguardando_resposta: false, tempo_resposta_s: tempoS,
    }).eq('id', id)
    toast.success('Marcado como respondido')
    load()
  }

  async function ignorar(id) {
    await supabase.from('mensagens_whatsapp').update({ aguardando_resposta: false }).eq('id', id)
    toast.success('Mensagem ignorada')
    load()
  }

  if (loading) return <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando…</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {pendentes.length} mensagem{pendentes.length !== 1 ? 'ns' : ''} aguardando resposta
        </p>
        <button onClick={load}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ArrowPathIcon style={{ width: 14, height: 14 }} /> Atualizar
        </button>
      </div>

      {pendentes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
          <CheckCircleIcon style={{ width: 40, height: 40, margin: '0 auto 12px', color: '#10b981', opacity: 0.7 }} />
          <p style={{ fontSize: 15 }}>Nenhuma mensagem pendente</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pendentes.map(p => {
            const elapsed = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 1000)
            const urgente = elapsed > 3600
            return (
              <div key={p.id} style={{ padding: '14px 16px', borderRadius: 10, border: `1px solid ${urgente ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`, background: urgente ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                      {p.modulo && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>{p.modulo}</span>}
                      <span style={{ fontSize: 12, color: urgente ? '#fca5a5' : 'var(--text-secondary)' }}>{fmtAgo(p.created_at)}</span>
                      {urgente && <span style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600 }}>⚠️ Atrasada</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>📱 {p.telefone}</div>
                    {p.conteudo && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, maxWidth: 520, lineHeight: 1.5 }}>
                        {p.conteudo.slice(0, 200)}{p.conteudo.length > 200 ? '…' : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => forcarOk(p.id, p.created_at)}
                      style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircleIcon style={{ width: 13, height: 13 }} /> Forçar OK
                    </button>
                    <button onClick={() => ignorar(p.id)}
                      style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      Ignorar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab: Validação ────────────────────────────────────────────────────────────

function TabValidacao({ workspaceId }) {
  const [checks, setChecks] = useState([])
  const [running, setRunning] = useState(false)

  async function runChecks() {
    setRunning(true)
    const results = []
    try {
      const [
        { data: aprovadores },
        { data: semCelular },
        { data: semEmail },
        { data: rotasConfig },
        { data: funcoes },
        { data: ativos },
      ] = await Promise.all([
        supabase.from('efetivo').select('id, nome').eq('workspace_id', workspaceId).eq('pode_aprovar', true).eq('ativo', true),
        supabase.from('efetivo').select('nome').eq('workspace_id', workspaceId).eq('usa_whatsapp', true).eq('ativo', true).is('celular', null),
        supabase.from('efetivo').select('nome').eq('workspace_id', workspaceId).eq('usa_email', true).eq('ativo', true).is('email', null),
        supabase.from('rotas_config').select('modulo, evento').eq('workspace_id', workspaceId).eq('ativo', true),
        supabase.from('funcoes_efetivo').select('id').eq('workspace_id', workspaceId).eq('ativo', true),
        supabase.from('efetivo').select('id').eq('workspace_id', workspaceId).eq('ativo', true),
      ])

      const totalEventos = MODULOS.reduce((s, m) => s + m.eventos.length, 0)
      const rotasCriadas = new Set((rotasConfig || []).map(r => `${r.modulo}:${r.evento}`)).size

      results.push(
        {
          ok: (aprovadores?.length || 0) > 0,
          label: 'Existe ao menos 1 aprovador ativo',
          detail: `${aprovadores?.length || 0} aprovador(es) cadastrado(s)`,
        },
        {
          ok: (semCelular?.length || 0) === 0,
          label: 'Atores de WhatsApp têm celular configurado',
          detail: semCelular?.length
            ? `${semCelular.length} sem celular: ${semCelular.map(e => e.nome).join(', ')}`
            : 'OK — todos com celular preenchido',
        },
        {
          ok: (semEmail?.length || 0) === 0,
          label: 'Atores de e-mail têm endereço configurado',
          detail: semEmail?.length
            ? `${semEmail.length} sem e-mail: ${semEmail.map(e => e.nome).join(', ')}`
            : 'OK — todos com e-mail preenchido',
        },
        {
          ok: rotasCriadas > 0,
          label: `Rotas de notificação configuradas (${rotasCriadas}/${totalEventos} eventos)`,
          detail: rotasCriadas === 0
            ? 'Nenhuma rota configurada — vá para ⚙️ Configuração'
            : `${rotasCriadas} evento(s) com ator(es) definido(s)`,
        },
        {
          ok: (funcoes?.length || 0) > 0,
          label: 'Funções cadastradas',
          detail: `${funcoes?.length || 0} função(ões) ativa(s)`,
        },
        {
          ok: (ativos?.length || 0) > 0,
          label: 'Colaboradores cadastrados',
          detail: `${ativos?.length || 0} colaborador(es) ativo(s)`,
        },
      )

      // Pending messages check
      const { count: pendentes } = await supabase
        .from('mensagens_whatsapp')
        .select('id', { count: 'exact', head: true })
        .eq('aguardando_resposta', true)
        .is('respondido_em', null)

      results.push({
        ok: (pendentes || 0) === 0,
        label: 'Sem mensagens aguardando resposta',
        detail: pendentes
          ? `${pendentes} mensagem(ns) sem resposta — veja ⏳ Pendentes`
          : 'Nenhuma pendência no momento',
      })
    } catch (e) {
      toast.error('Erro na validação: ' + e.message)
    }
    setChecks(results)
    setRunning(false)
  }

  const score = checks.filter(c => c.ok).length
  const total = checks.length
  const statusColor = score === total ? '#10b981' : score >= total * 0.7 ? '#f59e0b' : '#ef4444'
  const statusLabel = score === total ? '✓ Tudo OK' : score >= total * 0.7 ? '⚠️ Atenção' : '✗ Problemas'

  return (
    <div>
      {checks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
            Execute o checklist para verificar a saúde das rotas de notificação.
          </p>
          <button className="btn-primary" onClick={runChecks} disabled={running}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {running && <ArrowPathIcon style={{ width: 16, height: 16 }} />}
            {running ? 'Verificando…' : '▶ Executar Validação'}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {score}/{total} verificações OK
              <span style={{ marginLeft: 10, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
            </div>
            <button onClick={runChecks} disabled={running}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <ArrowPathIcon style={{ width: 14, height: 14 }} /> Reverificar
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checks.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 8, border: `1px solid ${c.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, background: c.ok ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)' }}>
                {c.ok
                  ? <CheckCircleIcon style={{ width: 18, height: 18, color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                  : <XCircleIcon    style={{ width: 18, height: 18, color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                }
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Métricas ─────────────────────────────────────────────────────────────

function TabMetricas({ workspaceId }) {
  const [metricas, setMetricas] = useState([])
  const [totalGeral, setTotalGeral] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('mensagens_whatsapp')
      .select('modulo, canal, tempo_resposta_s, respondido_em, direcao')
      .eq('direcao', 'saida')
      .order('created_at', { ascending: false })
      .limit(2000)
      .then(({ data }) => {
        const all = data || []
        setTotalGeral(all.length)
        const grouped = {}
        all.forEach(m => {
          const key = m.modulo || 'outros'
          if (!grouped[key]) grouped[key] = { total: 0, respondidos: 0, tempos: [], canais: {} }
          grouped[key].total++
          if (m.respondido_em) {
            grouped[key].respondidos++
            if (m.tempo_resposta_s) grouped[key].tempos.push(m.tempo_resposta_s)
          }
          const c = m.canal || 'whatsapp'
          grouped[key].canais[c] = (grouped[key].canais[c] || 0) + 1
        })
        const lista = Object.entries(grouped).map(([key, v]) => ({
          modulo: key,
          total: v.total,
          respondidos: v.respondidos,
          taxaResposta: v.total > 0 ? Math.round(v.respondidos / v.total * 100) : 0,
          tempoMedio: v.tempos.length > 0
            ? Math.round(v.tempos.reduce((a, b) => a + b, 0) / v.tempos.length)
            : null,
          canais: v.canais,
        })).sort((a, b) => b.total - a.total)
        setMetricas(lista)
        setLoading(false)
      })
  }, [workspaceId])

  if (loading) return <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Carregando…</p>

  if (metricas.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
        <p style={{ fontSize: 15 }}>Nenhuma mensagem registrada ainda.</p>
        <p style={{ fontSize: 13, marginTop: 4 }}>As métricas aparecerão após o primeiro disparo com campo <code>modulo</code> preenchido.</p>
      </div>
    )
  }

  const maxTotal = Math.max(...metricas.map(m => m.total), 1)

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        {totalGeral} mensagens saídas nos últimos 2000 registros
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {metricas.map(m => {
          const modInfo = MODULOS.find(mod => mod.key === m.modulo)
          return (
            <div key={m.modulo} style={{ padding: '16px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {modInfo?.icon || '📨'} {modInfo?.label || m.modulo}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text)' }}>{m.total}</strong> enviadas</span>
                  <span style={{ color: 'var(--text-secondary)' }}><strong style={{ color: '#6ee7b7' }}>{m.taxaResposta}%</strong> respondidas</span>
                  {m.tempoMedio && (
                    <span style={{ color: 'var(--text-secondary)' }}><strong style={{ color: '#fbbf24' }}>{fmtDuration(m.tempoMedio)}</strong> tempo médio</span>
                  )}
                </div>
              </div>
              {/* Volume bar */}
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', borderRadius: 4, background: modInfo?.cor || '#6366f1', width: `${(m.total / maxTotal) * 100}%`, transition: 'width 0.5s ease' }} />
              </div>
              {/* Response rate bar */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: '#10b981', width: `${m.taxaResposta}%`, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {Object.entries(m.canais).map(([canal, cnt]) => (
                  <span key={canal} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                    {canal === 'whatsapp' ? '📱' : canal === 'email' ? '✉️' : '📨'} {cnt}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tab: Simulador ────────────────────────────────────────────────────────────

function TabSimulador({ workspaceId }) {
  const [modulo, setModulo]         = useState('')
  const [evento, setEvento]         = useState('')
  const [resultado, setResultado]   = useState(null)
  const [running, setRunning]       = useState(false)

  const eventosMod = modulo ? (MODULOS.find(m => m.key === modulo)?.eventos || []) : []

  async function simular() {
    if (!modulo || !evento) { toast.error('Selecione módulo e evento'); return }
    setRunning(true)
    setResultado(null)

    const { data: rotas } = await supabase
      .from('rotas_config')
      .select('canal, efetivo(id, nome, celular, email, usa_whatsapp, usa_email, pode_aprovar, funcoes_efetivo(nome))')
      .eq('workspace_id', workspaceId)
      .eq('modulo', modulo)
      .eq('evento', evento)
      .eq('ativo', true)

    const modInfo = MODULOS.find(m => m.key === modulo)
    const evInfo  = modInfo?.eventos.find(e => e.key === evento)

    const atores = (rotas || []).map(r => {
      const e = r.efetivo
      const problemas = []
      if (r.canal !== 'email') {
        if (!e?.celular)       problemas.push('sem celular')
        if (!e?.usa_whatsapp)  problemas.push('flag usa_whatsapp desativada')
      }
      if (r.canal !== 'whatsapp') {
        if (!e?.email)     problemas.push('sem e-mail')
        if (!e?.usa_email) problemas.push('flag usa_email desativada')
      }
      return {
        nome:      e?.nome || '—',
        funcao:    e?.funcoes_efetivo?.nome,
        canal:     r.canal,
        celular:   e?.celular,
        email:     e?.email,
        ok:        problemas.length === 0,
        problemas,
      }
    })

    setResultado({
      modulo:    modInfo?.label,
      evento:    evInfo?.label,
      descricao: evInfo?.descricao,
      atores,
      timestamp: new Date().toLocaleString('pt-BR'),
    })
    setRunning(false)
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        Simule um disparo em dry-run para ver quais atores receberiam a notificação e se há bloqueios de configuração.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 28, alignItems: 'flex-end' }}>
        <div>
          <label className="label">Módulo</label>
          <select className="input" value={modulo} onChange={e => { setModulo(e.target.value); setEvento(''); setResultado(null) }}>
            <option value="">— Selecionar —</option>
            {MODULOS.map(m => <option key={m.key} value={m.key}>{m.icon} {m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Evento</label>
          <select className="input" value={evento} onChange={e => { setEvento(e.target.value); setResultado(null) }} disabled={!modulo}>
            <option value="">— Selecionar —</option>
            {eventosMod.map(ev => <option key={ev.key} value={ev.key}>{ev.label}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={simular} disabled={running || !modulo || !evento}
          style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <PlayIcon style={{ width: 15, height: 15 }} /> Simular
        </button>
      </div>

      {resultado && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'rgba(99,102,241,0.07)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#a5b4fc' }}>DRY RUN </span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{resultado.modulo}</span>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}> → {resultado.evento}</span>
              {resultado.descricao && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{resultado.descricao}</div>}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'flex-start' }}>Simulado em {resultado.timestamp}</span>
          </div>

          {/* Actors */}
          {resultado.atores.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: '#fca5a5' }}>
              <ExclamationTriangleIcon style={{ width: 28, height: 28, margin: '0 auto 8px' }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>Nenhum ator configurado para esta rota</p>
              <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>Configure atores na aba ⚙️ Configuração</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 16, fontSize: 13 }}>
                <span style={{ color: '#6ee7b7' }}><strong>{resultado.atores.filter(a => a.ok).length}</strong> enviariam com sucesso</span>
                {resultado.atores.some(a => !a.ok) && (
                  <span style={{ color: '#fca5a5' }}><strong>{resultado.atores.filter(a => !a.ok).length}</strong> com bloqueio</span>
                )}
              </div>
              {/* Actor rows */}
              {resultado.atores.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: a.ok ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {a.ok
                      ? <CheckCircleIcon style={{ width: 14, height: 14, color: 'white' }} />
                      : <XCircleIcon    style={{ width: 14, height: 14, color: 'white' }} />
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {a.nome}
                      {a.funcao && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>({a.funcao})</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                      {CANAIS.find(c => c.key === a.canal)?.label || a.canal}
                      {a.celular && <span> · 📱 {a.celular}</span>}
                      {a.email   && <span> · ✉️ {a.email}</span>}
                    </div>
                    {a.problemas.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        {a.problemas.map(p => (
                          <span key={p} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
                            ✗ {p}
                          </span>
                        ))}
                      </div>
                    )}
                    {a.ok && <div style={{ fontSize: 11, color: '#6ee7b7', marginTop: 4 }}>✓ Mensagem seria enviada com sucesso</div>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ConfiguradorRotas() {
  const { workspaceId } = useStore()
  const [tab, setTab]                   = useState('mapa')
  const [pendentesCount, setPendentesCount] = useState(0)

  // Badge inicial de pendentes
  useEffect(() => {
    if (!workspaceId) return
    supabase
      .from('mensagens_whatsapp')
      .select('id', { count: 'exact', head: true })
      .eq('aguardando_resposta', true)
      .is('respondido_em', null)
      .then(({ count }) => setPendentesCount(count || 0))
  }, [workspaceId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header title="Configurador de Rotas" />

      <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Configurador de Rotas</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Mapeie, configure e monitore as rotas de notificação do sistema.
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '10px 16px', border: 'none', cursor: 'pointer', background: 'none', fontSize: 13,
                fontWeight: tab === t.key ? 700 : 400,
                color: tab === t.key ? 'var(--text)' : 'var(--text-secondary)',
                borderBottom: tab === t.key ? '2px solid #6366f1' : '2px solid transparent',
                marginBottom: -1, whiteSpace: 'nowrap', position: 'relative', transition: 'color 0.15s' }}>
              {t.label}
              {t.key === 'pendentes' && pendentesCount > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 10, background: '#ef4444', color: 'white', fontWeight: 700, verticalAlign: 'middle' }}>
                  {pendentesCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'mapa'         && <TabMapa         workspaceId={workspaceId} />}
        {tab === 'configuracao' && <TabConfiguracao  workspaceId={workspaceId} />}
        {tab === 'pendentes'    && <TabPendentes     workspaceId={workspaceId} onCountChange={setPendentesCount} />}
        {tab === 'validacao'    && <TabValidacao     workspaceId={workspaceId} />}
        {tab === 'metricas'     && <TabMetricas      workspaceId={workspaceId} />}
        {tab === 'simulador'    && <TabSimulador     workspaceId={workspaceId} />}
      </div>
    </div>
  )
}
