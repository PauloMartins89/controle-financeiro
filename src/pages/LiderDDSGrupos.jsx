import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import {
  StatusChip, KpiCard, Toolbar, DataTable, TR, Field, Sel, inp,
} from './LiderCadastroShared'
import { XMarkIcon } from '@heroicons/react/24/outline'

const CORES = [
  { value: '#6366f1', label: '🟣 Índigo'   },
  { value: '#ef4444', label: '🔴 Vermelho'  },
  { value: '#3b82f6', label: '🔵 Azul'     },
  { value: '#10b981', label: '🟢 Verde'    },
  { value: '#f59e0b', label: '🟡 Âmbar'   },
  { value: '#f97316', label: '🟠 Laranja'  },
  { value: '#8b5cf6', label: '🟣 Violeta'  },
  { value: '#14b8a6', label: '🩵 Teal'     },
  { value: '#1e3a5f', label: '🔵 Navy'     },
]

const EMPTY = { nome: '', descricao: '', obrigatorio: false, cor: '#6366f1', ativo: true }

// ── Componente de dupla lista (transfer list) ─────────────────────────────────
function DualList({ disponiveis, associados, buscaDisp, buscaAssoc, selDisp, selAssoc, onClickDisp, onClickAssoc, onAdd, onRemove, setBuscaDisp, setBuscaAssoc }) {
  const pnlStyle = {
    flex: 1, border: '1px solid var(--border)', borderRadius: 10,
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
    background: 'var(--bg-muted)',
  }
  const hdrStyle = {
    padding: '8px 12px', borderBottom: '1px solid var(--border)',
    fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    background: 'var(--bg-card)',
  }
  const listStyle = { flex: 1, overflowY: 'auto', maxHeight: 260, minHeight: 180 }
  const itemStyle = (sel) => ({
    padding: '9px 12px', cursor: 'pointer', fontSize: 13,
    borderBottom: '1px solid var(--border)',
    background: sel ? 'var(--primary)' : 'transparent',
    color: sel ? '#fff' : 'var(--text-primary)',
    fontWeight: sel ? 700 : 400,
    userSelect: 'none',
  })
  const srchStyle = {
    width: '100%', padding: '7px 10px', fontSize: 12,
    background: 'var(--bg-card)', border: 'none', outline: 'none',
    borderBottom: '1px solid var(--border)', color: 'var(--text-primary)',
  }
  const arrBtn = (disabled, onClick, label) => (
    <button
      onClick={onClick} disabled={disabled}
      title={label}
      style={{
        padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
        background: disabled ? 'var(--bg-muted)' : 'var(--primary)',
        color: disabled ? 'var(--text-secondary)' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 700, fontSize: 15, lineHeight: 1,
      }}
    >{label}</button>
  )

  const filtAssoc = associados.filter(l => l.nome.toLowerCase().includes(buscaAssoc.toLowerCase()))
  const filtDisp  = disponiveis.filter(l => l.nome.toLowerCase().includes(buscaDisp.toLowerCase()))

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
      {/* Painel esquerdo — associados */}
      <div style={pnlStyle}>
        <div style={hdrStyle}>👥 Associados ({associados.length})</div>
        <input style={srchStyle} placeholder="Buscar…" value={buscaAssoc} onChange={e => setBuscaAssoc(e.target.value)} />
        <div style={listStyle}>
          {filtAssoc.length === 0
            ? <p style={{ padding: 12, fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Nenhum líder associado</p>
            : filtAssoc.map(l => (
              <div key={l.id} style={itemStyle(selAssoc === l.id)} onClick={() => onClickAssoc(l.id)}>
                {l.matricula ? `${l.matricula} :: ` : ''}{l.nome}
              </div>
            ))
          }
        </div>
      </div>

      {/* Botões centrais */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        {arrBtn(!selDisp,  onAdd,    '←')}
        {arrBtn(!selAssoc, onRemove, '→')}
      </div>

      {/* Painel direito — disponíveis */}
      <div style={pnlStyle}>
        <div style={hdrStyle}>📋 Disponíveis ({disponiveis.length})</div>
        <input style={srchStyle} placeholder="Buscar…" value={buscaDisp} onChange={e => setBuscaDisp(e.target.value)} />
        <div style={listStyle}>
          {filtDisp.length === 0
            ? <p style={{ padding: 12, fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Todos já associados</p>
            : filtDisp.map(l => (
              <div key={l.id} style={itemStyle(selDisp === l.id)} onClick={() => onClickDisp(l.id)}>
                {l.matricula ? `${l.matricula} :: ` : ''}{l.nome}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function LiderDDSGrupos() {
  const { workspaceId } = useStore()

  // lista
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [busca,     setBusca]     = useState('')

  // modal
  const [showModal, setShowModal] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [activeTab, setActiveTab] = useState('dados')
  const [form,      setForm]      = useState(EMPTY)

  // dual-list líderes
  const [todosLideres, setTodosLideres] = useState([])   // todos lider_perfis do workspace
  const [assocIds,     setAssocIds]     = useState(new Set())  // IDs associados ao grupo atual
  const [selAssoc,     setSelAssoc]     = useState(null) // selecionado no painel esquerdo
  const [selDisp,      setSelDisp]      = useState(null) // selecionado no painel direito
  const [buscaAssoc,   setBuscaAssoc]   = useState('')
  const [buscaDisp,    setBuscaDisp]    = useState('')

  useEffect(() => { if (workspaceId) load() }, [workspaceId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    const [{ data: grps }, { data: ldrs }] = await Promise.all([
      supabase.from('dds_grupos')
        .select('id, nome, descricao, obrigatorio, cor, ativo')
        .eq('workspace_id', workspaceId)
        .order('nome'),
      supabase.from('lider_perfis')
        .select('id, matricula, nome')
        .eq('workspace_id', workspaceId)
        .eq('ativo', true)
        .order('nome'),
    ])
    setRecords(grps || [])
    setTodosLideres(ldrs || [])
    setLoading(false)
  }

  async function loadAssociacoes(grupoId) {
    const { data } = await supabase
      .from('dds_grupos_lideres')
      .select('lider_id')
      .eq('grupo_id', grupoId)
    return new Set((data || []).map(r => r.lider_id))
  }

  function f(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function resetDualList() {
    setAssocIds(new Set()); setSelAssoc(null); setSelDisp(null)
    setBuscaAssoc(''); setBuscaDisp('')
  }

  async function openNew() {
    setEditId(null); setForm(EMPTY); setActiveTab('dados'); resetDualList(); setShowModal(true)
  }

  async function openEdit(r) {
    setEditId(r.id)
    setForm({ nome: r.nome, descricao: r.descricao || '', obrigatorio: !!r.obrigatorio, cor: r.cor || '#6366f1', ativo: r.ativo })
    setActiveTab('dados'); resetDualList()
    const ids = await loadAssociacoes(r.id)
    setAssocIds(ids)
    setShowModal(true)
  }

  // move disponível → associado
  function addLider() {
    if (!selDisp) return
    setAssocIds(prev => new Set([...prev, selDisp]))
    setSelDisp(null)
  }

  // move associado → disponível
  function removeLider() {
    if (!selAssoc) return
    setAssocIds(prev => { const s = new Set(prev); s.delete(selAssoc); return s })
    setSelAssoc(null)
  }

  function clickDisp(id) {
    setSelDisp(prev => prev === id ? null : id)
    setSelAssoc(null)
  }

  function clickAssoc(id) {
    setSelAssoc(prev => prev === id ? null : id)
    setSelDisp(null)
  }

  async function save() {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); setActiveTab('dados'); return }
    setSaving(true)

    const payload = {
      workspace_id: workspaceId,
      nome:       form.nome.trim(),
      descricao:  form.descricao || null,
      obrigatorio: form.obrigatorio,
      cor:        form.cor,
      ativo:      form.ativo,
    }

    let grupoId = editId
    if (editId) {
      const { error } = await supabase.from('dds_grupos').update(payload).eq('id', editId)
      if (error) { toast.error(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('dds_grupos').insert(payload).select('id').single()
      if (error) { toast.error(error.message); setSaving(false); return }
      grupoId = data.id
    }

    // Salva associações: apaga todas e reinicia
    await supabase.from('dds_grupos_lideres').delete().eq('grupo_id', grupoId)
    if (assocIds.size > 0) {
      const rows = [...assocIds].map(lid => ({ grupo_id: grupoId, lider_id: lid }))
      const { error } = await supabase.from('dds_grupos_lideres').insert(rows)
      if (error) { toast.error('Erro ao salvar líderes: ' + error.message); setSaving(false); return }
    }

    setSaving(false)
    toast.success(editId ? 'Grupo atualizado!' : 'Grupo criado!')
    setShowModal(false)
    load()
  }

  async function toggle(r) {
    await supabase.from('dds_grupos').update({ ativo: !r.ativo }).eq('id', r.id)
    load()
  }

  async function del(r) {
    if (!confirm(`Excluir grupo "${r.nome}"?\nTemas e sessões vinculadas perderão a associação.`)) return
    const { error } = await supabase.from('dds_grupos').delete().eq('id', r.id)
    if (error) { toast.error(error.message); return }
    toast.success('Grupo excluído')
    load()
  }

  const filtrados = records.filter(r =>
    r.nome.toLowerCase().includes(busca.toLowerCase())
  )
  const ativos = records.filter(r => r.ativo).length

  const associados   = todosLideres.filter(l => assocIds.has(l.id))
  const disponiveis  = todosLideres.filter(l => !assocIds.has(l.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title="Grupos DDS"
        subtitle="Programas temáticos com líderes responsáveis"
        action={{ label: 'Atualizar', icon: ArrowPathIcon, onClick: load }}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          <KpiCard label="Total de grupos" value={records.length} icon="🗂️"  color="#6366f1" />
          <KpiCard label="Grupos ativos"   value={ativos}         icon="✅"  color="#10b981" />
          <KpiCard label="Líderes cadastrados" value={todosLideres.length} icon="👤" color="#3b82f6" />
        </div>

        <Toolbar
          busca={busca} setBusca={setBusca}
          onRefresh={load} onNovo={openNew}
          placeholder="Buscar por nome ou líder…"
        />

        <DataTable
          cols={['Grupo', 'Obrigatório', 'Descrição', 'Status']}
          loading={loading}
          isEmpty={filtrados.length === 0}
        >
          {filtrados.map(r => (
            <TR
              key={r.id}
              ativo={r.ativo}
              onEdit={() => openEdit(r)}
              onToggle={() => toggle(r)}
              onDel={() => del(r)}
              cells={[
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: r.cor || '#6366f1', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>{r.nome}</span>
                </div>,
                r.obrigatorio
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Obrigatório</span>
                  : <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Opcional</span>,
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{r.descricao || '—'}</span>,
                <StatusChip ativo={r.ativo} />,
              ]}
            />
          ))}
        </DataTable>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 16, padding: 0,
            width: '100%', maxWidth: activeTab === 'lideres' ? 680 : 520,
            maxHeight: '92vh', overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            display: 'flex', flexDirection: 'column',
          }}>

            {/* Header do modal */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 24px 0', flexShrink: 0,
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                {editId ? 'Editar Grupo DDS' : 'Novo Grupo DDS'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <XMarkIcon style={{ width: 22 }} />
              </button>
            </div>

            {/* Abas */}
            <div style={{
              display: 'flex', gap: 0, padding: '12px 24px 0',
              borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              {[
                { key: 'dados',   label: 'Dados gerais' },
                { key: 'lideres', label: `Líderes${assocIds.size > 0 ? ` (${assocIds.size})` : ''}` },
              ].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 16px', fontSize: 13, fontWeight: activeTab === t.key ? 700 : 500,
                  color: activeTab === t.key ? 'var(--primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                  marginBottom: -1,
                }}>{t.label}</button>
              ))}
            </div>

            {/* Corpo das abas */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>

              {activeTab === 'dados' && (
                <>
                  <Field label="Nome do grupo *">
                    <input
                      value={form.nome} onChange={e => f('nome', e.target.value)}
                      placeholder="Ex: DDS de Segurança Operacional"
                      style={inp}
                    />
                  </Field>
                  <Field label="DDS obrigatório?">
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[{ v: true, label: '✅ Sim — obrigatório' }, { v: false, label: '⬜ Não — opcional' }].map(opt => (
                        <button
                          key={String(opt.v)}
                          type="button"
                          onClick={() => f('obrigatorio', opt.v)}
                          style={{
                            flex: 1, padding: '10px 0', borderRadius: 9, cursor: 'pointer',
                            fontWeight: 700, fontSize: 13, border: '2px solid',
                            borderColor: form.obrigatorio === opt.v ? (opt.v ? '#ef4444' : '#22c55e') : 'var(--border)',
                            background: form.obrigatorio === opt.v ? (opt.v ? '#ef444418' : '#22c55e18') : 'var(--bg-muted)',
                            color: form.obrigatorio === opt.v ? (opt.v ? '#ef4444' : '#22c55e') : 'var(--text-secondary)',
                          }}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Descrição">
                    <textarea
                      value={form.descricao} onChange={e => f('descricao', e.target.value)}
                      placeholder="Objetivo e escopo do grupo…"
                      rows={3}
                      style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
                    />
                  </Field>
                  <Field label="Cor de identificação">
                    <Sel value={form.cor} onChange={v => f('cor', v)} options={CORES} />
                  </Field>
                  <Field label="Status">
                    <Sel
                      value={form.ativo ? 'ativo' : 'inativo'}
                      onChange={v => f('ativo', v === 'ativo')}
                      options={[{ value: 'ativo', label: 'Ativo' }, { value: 'inativo', label: 'Inativo' }]}
                    />
                  </Field>
                </>
              )}

              {activeTab === 'lideres' && (
                <>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                    Selecione um líder e use as setas para associar (←) ou remover (→) do grupo.
                  </p>
                  <DualList
                    associados={associados}
                    disponiveis={disponiveis}
                    buscaAssoc={buscaAssoc}
                    buscaDisp={buscaDisp}
                    selAssoc={selAssoc}
                    selDisp={selDisp}
                    onClickAssoc={clickAssoc}
                    onClickDisp={clickDisp}
                    onAdd={addLider}
                    onRemove={removeLider}
                    setBuscaAssoc={setBuscaAssoc}
                    setBuscaDisp={setBuscaDisp}
                  />
                </>
              )}
            </div>

            {/* Rodapé com botões */}
            <div style={{ display: 'flex', gap: 10, padding: '0 24px 24px', flexShrink: 0 }}>
              <button onClick={() => setShowModal(false)} disabled={saving} style={{
                flex: 1, padding: '13px 0', borderRadius: 10, border: 'none',
                background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
              }}>Cancelar</button>
              <button onClick={save} disabled={saving} style={{
                flex: 2, padding: '13px 0', borderRadius: 10, border: 'none',
                background: '#22c55e', color: '#fff', fontWeight: 800, fontSize: 15,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
              }}>{saving ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
