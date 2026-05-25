import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import {
  PlusIcon, PencilIcon, TrashIcon, XMarkIcon, WrenchScrewdriverIcon,
  UsersIcon, ArrowPathIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

const TIPOS_EQUIP = [
  { value: 'maquina',     label: '🚜 Máquina Agrícola' },
  { value: 'veiculo',     label: '🚛 Veículo' },
  { value: 'instalacao',  label: '🏭 Instalação / Estrutura' },
  { value: 'eletrico',    label: '⚡ Equipamento Elétrico' },
  { value: 'hidraulico',  label: '💧 Sistema Hidráulico' },
  { value: 'outros',      label: '🔧 Outros' },
]

const EMPTY_EQUIP = {
  nome: '', codigo: '', tipo: 'maquina', modelo: '', fabricante: '',
  numero_serie: '', ano: '', horimetro_atual: '', observacoes: '', ativo: true,
  cat_modelo_id: '',
}

const EMPTY_TEC = {
  nome: '', especialidade: '', telefone: '', email: '', ativo: true,
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
      background: active ? '#6366f1' : 'transparent',
      color: active ? '#fff' : 'var(--text-secondary)',
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  )
}

export default function ManutencaoEquipamentos() {
  const { workspaceId } = useStore()
  const [aba, setAba] = useState('equipamentos')
  const [equipamentos, setEquipamentos] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [catalogoModelos, setCatalogoModelos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [formEq, setFormEq] = useState(EMPTY_EQUIP)
  const [formTec, setFormTec] = useState(EMPTY_TEC)

  useEffect(() => { if (workspaceId) init(workspaceId) }, [workspaceId]) // eslint-disable-line

  // Carrega catálogo de modelos uma vez (para o vínculo)
  useEffect(() => {
    supabase.from('cat_modelos').select('id,fabricante,familia,modelo').order('fabricante').order('modelo').limit(600)
      .then(({ data }) => setCatalogoModelos(data || []))
  }, [])

  async function init(wid) {
    setLoading(true)
    const [rEq, rTec] = await Promise.all([
      supabase.from('manut_equipamentos').select('*, cat_modelos(fabricante, modelo, familia)').eq('workspace_id', wid).order('nome'),
      supabase.from('manut_tecnicos').select('*').eq('workspace_id', wid).order('nome'),
    ])
    setEquipamentos(rEq.data || [])
    setTecnicos(rTec.data || [])
    setLoading(false)
  }

  // ─── Equipamentos ────────────────────────────────────────────────────────────

  function openNovoEq() {
    setEditId(null)
    setFormEq(EMPTY_EQUIP)
    setShowModal(true)
  }

  function openEditarEq(eq) {
    setEditId(eq.id)
    setFormEq({
      nome: eq.nome || '', codigo: eq.codigo || '', tipo: eq.tipo || 'maquina',
      modelo: eq.modelo || '', fabricante: eq.fabricante || '',
      numero_serie: eq.numero_serie || '', ano: eq.ano ?? '',
      horimetro_atual: eq.horimetro_atual ?? '', observacoes: eq.observacoes || '', ativo: eq.ativo !== false,
      cat_modelo_id: eq.cat_modelo_id || '',
    })
    setShowModal(true)
  }

  async function salvarEq() {
    if (!formEq.nome.trim()) return toast.error('Informe o nome do equipamento')
    setSaving(true)
    const payload = {
      workspace_id: workspaceId,
      nome: formEq.nome.trim(),
      codigo: formEq.codigo || null,
      tipo: formEq.tipo,
      modelo: formEq.modelo || null,
      fabricante: formEq.fabricante || null,
      numero_serie: formEq.numero_serie || null,
      ano: formEq.ano !== '' ? Number(formEq.ano) : null,
      horimetro_atual: formEq.horimetro_atual !== '' ? Number(formEq.horimetro_atual) : null,
      observacoes: formEq.observacoes || null,
      ativo: formEq.ativo,
      cat_modelo_id: formEq.cat_modelo_id || null,
    }
    if (editId) {
      const { error } = await supabase.from('manut_equipamentos').update(payload).eq('id', editId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Equipamento atualizado')
    } else {
      const { error } = await supabase.from('manut_equipamentos').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Equipamento cadastrado')
    }
    setSaving(false)
    setShowModal(false)
    init(workspaceId)
  }

  async function toggleEq(eq) {
    await supabase.from('manut_equipamentos').update({ ativo: !eq.ativo }).eq('id', eq.id)
    init(workspaceId)
  }

  async function deletarEq(eq) {
    if (!confirm(`Excluir equipamento "${eq.nome}"?`)) return
    await supabase.from('manut_equipamentos').delete().eq('id', eq.id)
    toast.success('Excluído')
    init(workspaceId)
  }

  // ─── Técnicos ────────────────────────────────────────────────────────────────

  function openNovoTec() {
    setEditId(null)
    setFormTec(EMPTY_TEC)
    setShowModal(true)
  }

  function openEditarTec(t) {
    setEditId(t.id)
    setFormTec({
      nome: t.nome || '', especialidade: t.especialidade || '',
      telefone: t.telefone || '', email: t.email || '', ativo: t.ativo !== false,
    })
    setShowModal(true)
  }

  async function salvarTec() {
    if (!formTec.nome.trim()) return toast.error('Informe o nome do técnico')
    setSaving(true)
    const payload = {
      workspace_id: workspaceId,
      nome: formTec.nome.trim(),
      especialidade: formTec.especialidade || null,
      telefone: formTec.telefone || null,
      email: formTec.email || null,
      ativo: formTec.ativo,
    }
    if (editId) {
      const { error } = await supabase.from('manut_tecnicos').update(payload).eq('id', editId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Técnico atualizado')
    } else {
      const { error } = await supabase.from('manut_tecnicos').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Técnico cadastrado')
    }
    setSaving(false)
    setShowModal(false)
    init(workspaceId)
  }

  async function toggleTec(t) {
    await supabase.from('manut_tecnicos').update({ ativo: !t.ativo }).eq('id', t.id)
    init(workspaceId)
  }

  async function deletarTec(t) {
    if (!confirm(`Excluir técnico "${t.nome}"?`)) return
    await supabase.from('manut_tecnicos').delete().eq('id', t.id)
    toast.success('Excluído')
    init(workspaceId)
  }

  const isEq = aba === 'equipamentos'

  const filtradoEq = equipamentos.filter(e => !busca || e.nome?.toLowerCase().includes(busca.toLowerCase()) || e.codigo?.toLowerCase().includes(busca.toLowerCase()) || e.tipo?.toLowerCase().includes(busca.toLowerCase()))
  const filtradoTec = tecnicos.filter(t => !busca || t.nome?.toLowerCase().includes(busca.toLowerCase()) || t.especialidade?.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        title="Equipamentos & Técnicos"
        subtitle="Cadastro e gestão de máquinas e equipe técnica"
        action={{ label: isEq ? 'Novo Equipamento' : 'Novo Técnico', icon: PlusIcon, onClick: () => isEq ? openNovoEq() : openNovoTec() }}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--border)' }}>
          <TabBtn active={aba === 'equipamentos'} onClick={() => { setAba('equipamentos'); setBusca('') }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><WrenchScrewdriverIcon style={{ width: 15, height: 15 }} /> Equipamentos ({equipamentos.length})</span>
          </TabBtn>
          <TabBtn active={aba === 'tecnicos'} onClick={() => { setAba('tecnicos'); setBusca('') }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><UsersIcon style={{ width: 15, height: 15 }} /> Técnicos ({tecnicos.length})</span>
          </TabBtn>
        </div>

        {/* Busca */}
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-secondary)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={isEq ? 'Buscar por nome, código...' : 'Buscar por nome, especialidade...'} style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>

        {/* Tabela Equipamentos */}
        {isEq && (
          <div style={cardStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>Equipamento</th>
                  <th style={thStyle}>Código</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Fabricante / Modelo</th>
                  <th style={thStyle}>Ano</th>
                  <th style={thStyle}>Horímetro</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando...</td></tr>
                  : filtradoEq.length === 0
                    ? <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum equipamento cadastrado</td></tr>
                    : filtradoEq.map(eq => {
                      const tc = TIPOS_EQUIP.find(t => t.value === eq.tipo) || { label: eq.tipo || '—' }
                      return (
                        <tr key={eq.id} style={{ borderBottom: '1px solid var(--border)', opacity: eq.ativo ? 1 : 0.55 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={tdStyle}><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{eq.nome}</span></td>
                          <td style={tdStyle}><span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>{eq.codigo || '—'}</span></td>
                          <td style={tdStyle}><span style={{ fontSize: 12 }}>{tc.label}</span></td>
                          <td style={tdStyle}>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{eq.fabricante || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{eq.modelo || ''}</div>
                            {eq.cat_modelo_id && (
                              <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600, marginTop: 2 }}>✓ catálogo</div>
                            )}
                          </td>
                          <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{eq.ano || '—'}</span></td>
                          <td style={tdStyle}><span style={{ fontSize: 12, color: '#0ea5e9' }}>{eq.horimetro_atual != null ? `${Number(eq.horimetro_atual).toLocaleString('pt-BR')}h` : '—'}</span></td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: eq.ativo ? '#10b981' : '#94a3b8' }}>
                              {eq.ativo ? '● Ativo' : '● Inativo'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button title="Editar" onClick={() => openEditarEq(eq)} style={iconBtn('#6366f1')}><PencilIcon style={{ width: 14, height: 14 }} /></button>
                              <button title={eq.ativo ? 'Desativar' : 'Ativar'} onClick={() => toggleEq(eq)} style={iconBtn(eq.ativo ? '#f59e0b' : '#10b981')}>
                                <ArrowPathIcon style={{ width: 14, height: 14 }} />
                              </button>
                              <button title="Excluir" onClick={() => deletarEq(eq)} style={iconBtn('#ef4444')}><TrashIcon style={{ width: 14, height: 14 }} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
              {filtradoEq.filter(e => e.ativo).length} ativos, {filtradoEq.filter(e => !e.ativo).length} inativos
            </div>
          </div>
        )}

        {/* Tabela Técnicos */}
        {!isEq && (
          <div style={cardStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>Técnico</th>
                  <th style={thStyle}>Especialidade</th>
                  <th style={thStyle}>Telefone</th>
                  <th style={thStyle}>E-mail</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando...</td></tr>
                  : filtradoTec.length === 0
                    ? <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum técnico cadastrado</td></tr>
                    : filtradoTec.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', opacity: t.ativo ? 1 : 0.55 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={tdStyle}><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.nome}</span></td>
                        <td style={tdStyle}><span style={{ fontSize: 12, color: '#8b5cf6' }}>{t.especialidade || '—'}</span></td>
                        <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.telefone || '—'}</span></td>
                        <td style={tdStyle}><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.email || '—'}</span></td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: t.ativo ? '#10b981' : '#94a3b8' }}>
                            {t.ativo ? '● Ativo' : '● Inativo'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button title="Editar" onClick={() => openEditarTec(t)} style={iconBtn('#6366f1')}><PencilIcon style={{ width: 14, height: 14 }} /></button>
                            <button title={t.ativo ? 'Desativar' : 'Ativar'} onClick={() => toggleTec(t)} style={iconBtn(t.ativo ? '#f59e0b' : '#10b981')}>
                              <ArrowPathIcon style={{ width: 14, height: 14 }} />
                            </button>
                            <button title="Excluir" onClick={() => deletarTec(t)} style={iconBtn('#ef4444')}><TrashIcon style={{ width: 14, height: 14 }} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Modal Equipamento */}
      {showModal && isEq && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>{editId ? 'Editar Equipamento' : 'Novo Equipamento'}</h3>
              <button onClick={() => setShowModal(false)} style={closeBtnStyle}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Nome *</label>
                  <input value={formEq.nome} onChange={e => setFormEq(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Trator John Deere 6110J" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Código</label>
                  <input value={formEq.codigo} onChange={e => setFormEq(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex: TRA-001" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={formEq.tipo} onChange={e => setFormEq(f => ({ ...f, tipo: e.target.value }))} style={inputStyle}>
                  {TIPOS_EQUIP.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Fabricante</label>
                  <input value={formEq.fabricante} onChange={e => setFormEq(f => ({ ...f, fabricante: e.target.value, cat_modelo_id: '' }))} placeholder="Ex: John Deere" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Modelo</label>
                  <input value={formEq.modelo} onChange={e => setFormEq(f => ({ ...f, modelo: e.target.value, cat_modelo_id: '' }))} placeholder="Ex: 6110J" style={inputStyle} />
                </div>
              </div>
              {/* Vínculo ao catálogo técnico */}
              <div>
                <label style={labelStyle}>Vincular ao Catálogo Técnico</label>
                <select
                  value={formEq.cat_modelo_id}
                  onChange={e => {
                    const sel = catalogoModelos.find(m => m.id === e.target.value)
                    setFormEq(f => ({
                      ...f,
                      cat_modelo_id: e.target.value,
                      fabricante: sel ? sel.fabricante : f.fabricante,
                      modelo: sel ? sel.modelo : f.modelo,
                    }))
                  }}
                  style={inputStyle}
                >
                  <option value="">— nenhum vínculo —</option>
                  {catalogoModelos
                    .filter(m => !formEq.fabricante || m.fabricante.toLowerCase().includes(formEq.fabricante.toLowerCase()))
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.fabricante} — {m.modelo}{m.familia ? ` (${m.familia})` : ''}
                      </option>
                    ))
                  }
                </select>
                {formEq.cat_modelo_id
                  ? <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontWeight: 600 }}>✓ Vinculado — planos de manutenção e documentos técnicos disponíveis</div>
                  : <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Vincule para habilitar planos de manutenção e documentos técnicos do catálogo</div>
                }
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Nº de Série</label>
                  <input value={formEq.numero_serie} onChange={e => setFormEq(f => ({ ...f, numero_serie: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Ano</label>
                  <input type="number" value={formEq.ano} onChange={e => setFormEq(f => ({ ...f, ano: e.target.value }))} placeholder="2022" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Horímetro Atual</label>
                  <input type="number" value={formEq.horimetro_atual} onChange={e => setFormEq(f => ({ ...f, horimetro_atual: e.target.value }))} placeholder="0.0" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Observações</label>
                <textarea value={formEq.observacoes} onChange={e => setFormEq(f => ({ ...f, observacoes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="eqAtivo" checked={formEq.ativo} onChange={e => setFormEq(f => ({ ...f, ativo: e.target.checked }))} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                <label htmlFor="eqAtivo" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>Equipamento Ativo</label>
              </div>
            </div>
            <div style={modalFooterStyle}>
              <button onClick={() => setShowModal(false)} style={btnSecStyle}>Cancelar</button>
              <button onClick={salvarEq} disabled={saving} style={btnPrimStyle}>{saving ? 'Salvando...' : editId ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Técnico */}
      {showModal && !isEq && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ ...modalStyle, maxWidth: 460 }}>
            <div style={modalHeaderStyle}>
              <h3 style={modalTitleStyle}>{editId ? 'Editar Técnico' : 'Novo Técnico'}</h3>
              <button onClick={() => setShowModal(false)} style={closeBtnStyle}><XMarkIcon style={{ width: 20, height: 20 }} /></button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome *</label>
                <input value={formTec.nome} onChange={e => setFormTec(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do técnico" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Especialidade</label>
                <input value={formTec.especialidade} onChange={e => setFormTec(f => ({ ...f, especialidade: e.target.value }))} placeholder="Ex: Mecânica, Elétrica, Hidráulica" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Telefone</label>
                  <input value={formTec.telefone} onChange={e => setFormTec(f => ({ ...f, telefone: e.target.value }))} placeholder="(xx) xxxxx-xxxx" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>E-mail</label>
                  <input type="email" value={formTec.email} onChange={e => setFormTec(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="tecAtivo" checked={formTec.ativo} onChange={e => setFormTec(f => ({ ...f, ativo: e.target.checked }))} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                <label htmlFor="tecAtivo" style={{ fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>Técnico Ativo</label>
              </div>
            </div>
            <div style={modalFooterStyle}>
              <button onClick={() => setShowModal(false)} style={btnSecStyle}>Cancelar</button>
              <button onClick={salvarTec} disabled={saving} style={btnPrimStyle}>{saving ? 'Salvando...' : editId ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const cardStyle = { background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }
const thStyle = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', background: 'var(--bg-secondary)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '10px 14px', verticalAlign: 'middle' }
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }
const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }
const btnPrimStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }
const btnSecStyle = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }
const iconBtn = color => ({ background: `rgba(${color === '#6366f1' ? '99,102,241' : color === '#10b981' ? '16,185,129' : color === '#0ea5e9' ? '14,165,233' : color === '#f59e0b' ? '245,158,11' : color === '#ef4444' ? '239,68,68' : '148,163,184'},0.12)`, border: 'none', color, cursor: 'pointer', borderRadius: 6, padding: '5px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' })
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modalStyle = { background: 'var(--bg-primary)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'auto' }
const modalHeaderStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }
const modalTitleStyle = { margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }
const modalFooterStyle = { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--border)' }
const closeBtnStyle = { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }
