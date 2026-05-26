import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import {
  PlusIcon, PencilIcon, TrashIcon, XMarkIcon,
  MagnifyingGlassIcon, ArrowPathIcon,
  UsersIcon, WrenchScrewdriverIcon, BeakerIcon, CubeIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline'

// ── Tabs ──────────────────────────────────────────────────────────────────────
const ABAS = [
  { key: 'colaboradores', label: 'Colaboradores', icon: UsersIcon },
  { key: 'maquinas',      label: 'Máquinas',      icon: WrenchScrewdriverIcon },
  { key: 'implementos',   label: 'Implementos',   icon: BeakerIcon },
  { key: 'produtos',      label: 'Produtos',      icon: CubeIcon },
  { key: 'epis',          label: 'EPIs',           icon: ShieldCheckIcon },
]

// ── Campos por aba ────────────────────────────────────────────────────────────
const FUNCOES = ['Operador', 'Auxiliar', 'Tratorista', 'Pulverizador', 'Mecânico', 'Motorista', 'Supervisor', 'Outro']
const TIPO_MAQ = ['Trator', 'Pulverizador', 'Colhedora', 'Plantadeira', 'Grade', 'Caminhão', 'Utilitário', 'Outro']
const UNIDADES  = ['L', 'kg', 'sc', 'ton', 'un', 'cx', 'g', 'ml']
const TIPO_PROD = ['Herbicida', 'Inseticida', 'Fungicida', 'Adubo', 'Semente', 'Adjuvante', 'Óleo', 'Outro']
const CAT_EPI   = ['Proteção da Cabeça', 'Proteção dos Olhos', 'Proteção Respiratória', 'Proteção Auditiva', 'Proteção dos Membros Superiores', 'Proteção dos Membros Inferiores', 'Proteção do Tronco', 'Proteção Contra Quedas', 'Outro']

function TabBtn({ aba, current, onClick }) {
  const Icon = aba.icon
  const active = current === aba.key
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
      borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? '#fff' : 'var(--text-secondary)',
      transition: 'all 0.15s',
    }}>
      <Icon style={{ width: 16, height: 16 }} />
      {aba.label}
    </button>
  )
}

// ── Linha de registro ─────────────────────────────────────────────────────────
function Row({ children, ativo, onEdit, onToggle, onDel }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderRadius: 10,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      marginBottom: 8, opacity: ativo ? 1 : 0.5,
    }}>
      <div style={{ flex: 1 }}>{children}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onEdit} title="Editar" style={btnSm('#3b82f6')}>
          <PencilIcon style={{ width: 14 }} />
        </button>
        <button onClick={onToggle} title={ativo ? 'Inativar' : 'Ativar'} style={btnSm(ativo ? '#f59e0b' : '#22c55e')}>
          {ativo ? '⏸' : '▶'}
        </button>
        <button onClick={onDel} title="Excluir" style={btnSm('#ef4444')}>
          <TrashIcon style={{ width: 14 }} />
        </button>
      </div>
    </div>
  )
}
function btnSm(color) {
  return {
    background: color + '20', border: '1px solid ' + color + '50',
    color, borderRadius: 8, padding: '5px 8px', cursor: 'pointer', fontSize: 12,
  }
}

// ── Badge de tipo ──────────────────────────────────────────────────────────────
function Badge({ text }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: 'var(--bg-muted)', color: 'var(--text-secondary)',
    }}>{text}</span>
  )
}

// ── Modal genérico ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, onSave, saving, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 28,
        width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <XMarkIcon style={{ width: 22 }} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
        <button onClick={onSave} disabled={saving} style={{
          marginTop: 20, width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
          background: 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inp = {
  width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border)',
  background: 'var(--bg-muted)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box',
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inp}>
      {options.map(o => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
export default function LiderCadastros() {
  const { workspaceId } = useStore()
  const [aba, setAba] = useState('colaboradores')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [equipes,   setEquipes]   = useState([])

  // ── dados ──
  const [colaboradores, setColabs]    = useState([])
  const [maquinas,      setMaquinas]  = useState([])
  const [implementos,   setImpls]     = useState([])
  const [produtos,      setProdutos]  = useState([])
  const [epis,          setEpis]      = useState([])

  // ── forms ──
  const [fColab, setFColab] = useState({ nome: '', matricula: '', cargo: 'Operador', equipe_id: '', ativo: true })
  const [fMaq,   setFMaq]   = useState({ nome: '', codigo: '', tipo: 'Trator', modelo: '', ativo: true })
  const [fImpl,  setFImpl]  = useState({ nome: '', codigo: '', modelo: '', largura_m: '', volume_recomendado_lha: '', ativo: true })
  const [fProd,  setFProd]  = useState({ nome: '', tipo: 'Herbicida', unidade: 'L', ativo: true })
  const [fEpi,   setFEpi]   = useState({ nome: '', categoria: 'Proteção da Cabeça', ca: '', vida_util_meses: '', ativo: true })

  useEffect(() => { if (workspaceId) init() }, [workspaceId, aba]) // eslint-disable-line

  async function init() {
    setLoading(true)
    const wid = workspaceId
    if (aba === 'colaboradores') {
      const [rC, rE] = await Promise.all([
        supabase.from('lider_colaboradores').select('*, lider_equipes(nome)').eq('workspace_id', wid).order('nome'),
        supabase.from('lider_equipes').select('id, nome').eq('workspace_id', wid).order('nome'),
      ])
      setColabs(rC.data || [])
      setEquipes(rE.data || [])
    } else if (aba === 'maquinas') {
      const { data } = await supabase.from('lider_maquinas').select('*').eq('workspace_id', wid).order('nome')
      setMaquinas(data || [])
    } else if (aba === 'implementos') {
      const { data } = await supabase.from('lider_implementos').select('*').eq('workspace_id', wid).order('nome')
      setImpls(data || [])
    } else if (aba === 'produtos') {
      const { data } = await supabase.from('lider_produtos').select('*').eq('workspace_id', wid).order('nome')
      setProdutos(data || [])
    } else if (aba === 'epis') {
      const { data } = await supabase.from('lider_epis').select('*').eq('workspace_id', wid).order('nome')
      setEpis(data || [])
    }
    setLoading(false)
  }

  // ── abrir modal ──────────────────────────────────────────────────────────────
  function abrirNovo() {
    setEditId(null)
    if (aba === 'colaboradores') setFColab({ nome: '', matricula: '', cargo: 'Operador', equipe_id: equipes[0]?.id ?? '', ativo: true })
    if (aba === 'maquinas')      setFMaq({ nome: '', codigo: '', tipo: 'Trator', modelo: '', ativo: true })
    if (aba === 'implementos')   setFImpl({ nome: '', codigo: '', modelo: '', largura_m: '', volume_recomendado_lha: '', ativo: true })
    if (aba === 'produtos')      setFProd({ nome: '', tipo: 'Herbicida', unidade: 'L', ativo: true })
    if (aba === 'epis')          setFEpi({ nome: '', categoria: 'Proteção da Cabeça', ca: '', vida_util_meses: '', ativo: true })
    setShowModal(true)
  }

  function abrirEditar(item) {
    setEditId(item.id)
    if (aba === 'colaboradores') setFColab({ nome: item.nome, matricula: item.matricula ?? '', cargo: item.cargo ?? 'Operador', equipe_id: item.equipe_id ?? '', ativo: item.ativo })
    if (aba === 'maquinas')      setFMaq({ nome: item.nome, codigo: item.codigo ?? '', tipo: item.tipo ?? 'Trator', modelo: item.modelo ?? '', ativo: item.ativo })
    if (aba === 'implementos')   setFImpl({ nome: item.nome, codigo: item.codigo ?? '', modelo: item.modelo ?? '', largura_m: item.largura_m ?? '', volume_recomendado_lha: item.volume_recomendado_lha ?? '', ativo: item.ativo })
    if (aba === 'produtos')      setFProd({ nome: item.nome, tipo: item.tipo ?? 'Herbicida', unidade: item.unidade ?? 'L', ativo: item.ativo })
    if (aba === 'epis')          setFEpi({ nome: item.nome, categoria: item.categoria ?? 'Proteção da Cabeça', ca: item.ca ?? '', vida_util_meses: item.vida_util_meses ?? '', ativo: item.ativo })
    setShowModal(true)
  }

  // ── salvar ───────────────────────────────────────────────────────────────────
  async function salvar() {
    const wid = workspaceId
    let table, payload
    if (aba === 'colaboradores') { table = 'lider_colaboradores'; payload = { ...fColab, workspace_id: wid } }
    if (aba === 'maquinas')      { table = 'lider_maquinas';      payload = { ...fMaq, workspace_id: wid } }
    if (aba === 'implementos')   { table = 'lider_implementos';   payload = { ...fImpl, workspace_id: wid } }
    if (aba === 'produtos')      { table = 'lider_produtos';      payload = { ...fProd, workspace_id: wid } }
    if (aba === 'epis')          { table = 'lider_epis';          payload = { ...fEpi, workspace_id: wid, vida_util_meses: fEpi.vida_util_meses ? parseInt(fEpi.vida_util_meses) : null } }
    if (!payload.nome?.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const { error } = editId
      ? await supabase.from(table).update(payload).eq('id', editId)
      : await supabase.from(table).insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Atualizado!' : 'Cadastrado!')
    setShowModal(false)
    init()
  }

  // ── toggle ativo ─────────────────────────────────────────────────────────────
  async function toggleAtivo(table, id, atual) {
    const { error } = await supabase.from(table).update({ ativo: !atual }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(!atual ? 'Ativado' : 'Inativado'); init() }
  }

  // ── excluir ──────────────────────────────────────────────────────────────────
  async function excluir(table, id, nome) {
    if (!window.confirm(`Excluir "${nome}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) toast.error('Erro: ' + error.message)
    else { toast.success('Excluído'); init() }
  }

  // ── filtros ──────────────────────────────────────────────────────────────────
  const filtrar = list => list.filter(r => r.nome?.toLowerCase().includes(busca.toLowerCase()))

  // ── renderizar lista ─────────────────────────────────────────────────────────
  function renderLista() {
    if (loading) return <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>Carregando…</p>

    if (aba === 'colaboradores') {
      const list = filtrar(colaboradores)
      return list.length === 0 ? empty() : list.map(c => (
        <Row key={c.id} ativo={c.ativo}
          onEdit={() => abrirEditar(c)}
          onToggle={() => toggleAtivo('lider_colaboradores', c.id, c.ativo)}
          onDel={() => excluir('lider_colaboradores', c.id, c.nome)}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{c.nome}</span>
            {c.matricula && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>#{c.matricula}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <Badge text={c.cargo ?? 'Sem cargo'} />
            {c.lider_equipes && <Badge text={c.lider_equipes.nome} />}
          </div>
        </Row>
      ))
    }

    if (aba === 'maquinas') {
      const list = filtrar(maquinas)
      return list.length === 0 ? empty() : list.map(m => (
        <Row key={m.id} ativo={m.ativo}
          onEdit={() => abrirEditar(m)}
          onToggle={() => toggleAtivo('lider_maquinas', m.id, m.ativo)}
          onDel={() => excluir('lider_maquinas', m.id, m.nome)}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{m.nome}</span>
            {m.codigo && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{m.codigo}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <Badge text={m.tipo ?? 'Sem tipo'} />
            {m.fabricante && <Badge text={m.fabricante} />}
            {m.modelo && <Badge text={m.modelo} />}
          </div>
        </Row>
      ))
    }

    if (aba === 'implementos') {
      const list = filtrar(implementos)
      return list.length === 0 ? empty() : list.map(i => (
        <Row key={i.id} ativo={i.ativo}
          onEdit={() => abrirEditar(i)}
          onToggle={() => toggleAtivo('lider_implementos', i.id, i.ativo)}
          onDel={() => excluir('lider_implementos', i.id, i.nome)}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{i.nome}</span>
            {i.codigo && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{i.codigo}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {i.modelo && <Badge text={i.modelo} />}
            {i.largura_m && <Badge text={`${i.largura_m}m`} />}
            {i.volume_recomendado_lha && <Badge text={`${i.volume_recomendado_lha} L/ha`} />}
          </div>
        </Row>
      ))
    }

    if (aba === 'produtos') {
      const list = filtrar(produtos)
      return list.length === 0 ? empty() : list.map(p => (
        <Row key={p.id} ativo={p.ativo}
          onEdit={() => abrirEditar(p)}
          onToggle={() => toggleAtivo('lider_produtos', p.id, p.ativo)}
          onDel={() => excluir('lider_produtos', p.id, p.nome)}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{p.nome}</span>
            {p.codigo && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>{p.codigo}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <Badge text={p.tipo ?? 'Sem tipo'} />
            <Badge text={p.unidade ?? '—'} />
          </div>
        </Row>
      ))
    }

    if (aba === 'epis') {
      const list = filtrar(epis)
      return list.length === 0 ? empty() : list.map(e => (
        <Row key={e.id} ativo={e.ativo}
          onEdit={() => abrirEditar(e)}
          onToggle={() => toggleAtivo('lider_epis', e.id, e.ativo)}
          onDel={() => excluir('lider_epis', e.id, e.nome)}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{e.nome}</span>
            {e.ca && <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>CA: {e.ca}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {e.categoria && <Badge text={e.categoria} />}
            {e.vida_util_meses && <Badge text={`${e.vida_util_meses} meses`} />}
          </div>
        </Row>
      ))
    }
  }

  function empty() {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
        <p style={{ fontSize: 40, marginBottom: 8 }}>📭</p>
        <p style={{ fontWeight: 700 }}>Nenhum cadastro encontrado</p>
        <p style={{ fontSize: 13 }}>Clique em "+ Novo" para adicionar</p>
      </div>
    )
  }

  // ── contagem ─────────────────────────────────────────────────────────────────
  const totais = {
    colaboradores: colaboradores.filter(r => r.ativo).length,
    maquinas:      maquinas.filter(r => r.ativo).length,
    implementos:   implementos.filter(r => r.ativo).length,
    produtos:      produtos.filter(r => r.ativo).length,
    epis:          epis.filter(r => r.ativo).length,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header titulo="SmartLíder — Cadastros" subtitulo="Gerencie colaboradores, máquinas, implementos e produtos" />

      <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', borderRadius: 12, padding: 6, marginBottom: 24, border: '1px solid var(--border)' }}>
          {ABAS.map(a => (
            <TabBtn key={a.key} aba={a} current={aba} onClick={() => { setAba(a.key); setBusca('') }} />
          ))}
        </div>

        {/* Cards rápidos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
          {ABAS.map(a => {
            const Icon = a.icon
            const n = totais[a.key]
            return (
              <div key={a.key} onClick={() => setAba(a.key)} style={{
                background: 'var(--bg-card)', borderRadius: 12, padding: '16px 18px',
                border: `2px solid ${aba === a.key ? 'var(--primary)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <Icon style={{ width: 20, height: 20, color: 'var(--primary)', marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{n}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{a.label} ativos</p>
              </div>
            )
          })}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, color: 'var(--text-muted)' }} />
            <input
              value={busca} onChange={e => setBusca(e.target.value)}
              placeholder={`Buscar ${ABAS.find(a => a.key === aba)?.label?.toLowerCase()}…`}
              style={{ ...inp, paddingLeft: 36, margin: 0 }}
            />
          </div>
          <button onClick={init} style={{ ...btnSm('#6366f1'), padding: '9px 12px' }} title="Recarregar">
            <ArrowPathIcon style={{ width: 16 }} />
          </button>
          <button onClick={abrirNovo} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
            borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: 'var(--primary)', color: '#fff',
          }}>
            <PlusIcon style={{ width: 16 }} />
            Novo
          </button>
        </div>

        {/* Lista */}
        <div>{renderLista()}</div>
      </div>

      {/* ── Modal Colaborador ──────────────────────────────────────────────── */}
      {showModal && aba === 'colaboradores' && (
        <Modal title={editId ? 'Editar Colaborador' : 'Novo Colaborador'} onClose={() => setShowModal(false)} onSave={salvar} saving={saving}>
          <Field label="Nome *">
            <input style={inp} value={fColab.nome} onChange={e => setFColab(p => ({ ...p, nome: e.target.value }))} placeholder="Nome completo" />
          </Field>
          <Field label="Matrícula">
            <input style={inp} value={fColab.matricula} onChange={e => setFColab(p => ({ ...p, matricula: e.target.value }))} placeholder="Ex: 00123" />
          </Field>
          <Field label="Função / Cargo">
            <Select value={fColab.cargo} onChange={v => setFColab(p => ({ ...p, cargo: v }))} options={FUNCOES} />
          </Field>
          <Field label="Equipe">
            <Select
              value={fColab.equipe_id}
              onChange={v => setFColab(p => ({ ...p, equipe_id: v }))}
              options={[{ value: '', label: '— Sem equipe —' }, ...equipes.map(e => ({ value: e.id, label: e.nome }))]}
            />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={fColab.ativo} onChange={e => setFColab(p => ({ ...p, ativo: e.target.checked }))} />
            Ativo
          </label>
        </Modal>
      )}

      {/* ── Modal Máquina ─────────────────────────────────────────────────── */}
      {showModal && aba === 'maquinas' && (
        <Modal title={editId ? 'Editar Máquina' : 'Nova Máquina'} onClose={() => setShowModal(false)} onSave={salvar} saving={saving}>
          <Field label="Nome *">
            <input style={inp} value={fMaq.nome} onChange={e => setFMaq(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Trator John Deere 6145J" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Código / Frota">
              <input style={inp} value={fMaq.codigo} onChange={e => setFMaq(p => ({ ...p, codigo: e.target.value }))} placeholder="Ex: TR-01" />
            </Field>
            <Field label="Tipo">
              <Select value={fMaq.tipo} onChange={v => setFMaq(p => ({ ...p, tipo: v }))} options={TIPO_MAQ} />
            </Field>
          </div>
          <Field label="Modelo">
            <input style={inp} value={fMaq.modelo} onChange={e => setFMaq(p => ({ ...p, modelo: e.target.value }))} placeholder="Ex: 6145J" />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={fMaq.ativo} onChange={e => setFMaq(p => ({ ...p, ativo: e.target.checked }))} />
            Ativo
          </label>
        </Modal>
      )}

      {/* ── Modal Implemento ──────────────────────────────────────────────── */}
      {showModal && aba === 'implementos' && (
        <Modal title={editId ? 'Editar Implemento' : 'Novo Implemento'} onClose={() => setShowModal(false)} onSave={salvar} saving={saving}>
          <Field label="Nome *">
            <input style={inp} value={fImpl.nome} onChange={e => setFImpl(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Pulverizador Jacto 3000" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Código">
              <input style={inp} value={fImpl.codigo} onChange={e => setFImpl(p => ({ ...p, codigo: e.target.value }))} placeholder="Ex: PB-01" />
            </Field>
            <Field label="Modelo">
              <input style={inp} value={fImpl.modelo} onChange={e => setFImpl(p => ({ ...p, modelo: e.target.value }))} placeholder="Ex: Condor 3000" />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Largura (m)">
              <input style={inp} value={fImpl.largura_m} onChange={e => setFImpl(p => ({ ...p, largura_m: e.target.value }))} placeholder="Ex: 12" type="number" step="0.1" />
            </Field>
            <Field label="Volume recomendado (L/ha)">
              <input style={inp} value={fImpl.volume_recomendado_lha} onChange={e => setFImpl(p => ({ ...p, volume_recomendado_lha: e.target.value }))} placeholder="Ex: 150" type="number" />
            </Field>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={fImpl.ativo} onChange={e => setFImpl(p => ({ ...p, ativo: e.target.checked }))} />
            Ativo
          </label>
        </Modal>
      )}

      {/* ── Modal Produto ──────────────────────────────────────────────────── */}
      {showModal && aba === 'produtos' && (
        <Modal title={editId ? 'Editar Produto' : 'Novo Produto'} onClose={() => setShowModal(false)} onSave={salvar} saving={saving}>
          <Field label="Nome *">
            <input style={inp} value={fProd.nome} onChange={e => setFProd(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Roundup Original" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Tipo / Categoria">
              <Select value={fProd.tipo} onChange={v => setFProd(p => ({ ...p, tipo: v }))} options={TIPO_PROD} />
            </Field>
            <Field label="Unidade">
              <Select value={fProd.unidade} onChange={v => setFProd(p => ({ ...p, unidade: v }))} options={UNIDADES} />
            </Field>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={fProd.ativo} onChange={e => setFProd(p => ({ ...p, ativo: e.target.checked }))} />
            Ativo
          </label>
        </Modal>
      )}

      {/* ── Modal EPI ─────────────────────────────────────────────────────── */}
      {showModal && aba === 'epis' && (
        <Modal title={editId ? 'Editar EPI' : 'Novo EPI'} onClose={() => setShowModal(false)} onSave={salvar} saving={saving}>
          <Field label="Nome *">
            <input style={inp} value={fEpi.nome} onChange={e => setFEpi(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Capacete de Segurança" />
          </Field>
          <Field label="Categoria">
            <Select value={fEpi.categoria} onChange={v => setFEpi(p => ({ ...p, categoria: v }))} options={CAT_EPI} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="CA (Cert. de Aprovação)">
              <input style={inp} value={fEpi.ca} onChange={e => setFEpi(p => ({ ...p, ca: e.target.value }))} placeholder="Ex: 12345" />
            </Field>
            <Field label="Vida útil (meses)">
              <input style={inp} type="number" value={fEpi.vida_util_meses} onChange={e => setFEpi(p => ({ ...p, vida_util_meses: e.target.value }))} placeholder="Ex: 12" />
            </Field>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={fEpi.ativo} onChange={e => setFEpi(p => ({ ...p, ativo: e.target.checked }))} />
            Ativo
          </label>
        </Modal>
      )}
    </div>
  )
}
