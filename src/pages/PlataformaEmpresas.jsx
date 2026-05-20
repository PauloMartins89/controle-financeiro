import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { BuildingOffice2Icon, PlusIcon, MagnifyingGlassIcon, PuzzlePieceIcon, CheckCircleIcon, XCircleIcon, UsersIcon, TrashIcon, UserPlusIcon, EnvelopeIcon } from '@heroicons/react/24/outline'

const PLANOS = ['trial', 'basico', 'profissional', 'enterprise', 'isento']
const STATUS_PLANO = { trial: 'bg-yellow-100 text-yellow-800', basico: 'bg-blue-100 text-blue-800', profissional: 'bg-indigo-100 text-indigo-800', enterprise: 'bg-purple-100 text-purple-800', isento: 'bg-green-100 text-green-800' }

const TODOS_MODULOS = [
  { key: 'dashboard',     label: 'Início / Dashboard',    descricao: 'Tela inicial e visão geral' },
  { key: 'despesas',      label: 'Despesas',              descricao: 'Lançamentos de despesas' },
  { key: 'acertos',       label: 'Acertos',               descricao: 'Acertos e divisão entre pessoas' },
  { key: 'recorrentes',   label: 'Fixos do Mês',          descricao: 'Despesas recorrentes / Fixos do mês' },
  { key: 'cartoes',       label: 'Cartões',               descricao: 'Controle de cartões' },
  { key: 'grupos',        label: 'Grupos',                descricao: 'Grupos e categorias de despesas' },
  { key: 'pessoas',       label: 'Pessoas',               descricao: 'Cadastro de pessoas' },
  { key: 'veiculos',      label: 'Veículos',              descricao: 'Controle de frota' },
  { key: 'timeline',      label: 'Histórico / Timeline',  descricao: 'Linha do tempo financeira' },
  { key: 'balanco',       label: 'Balanço',               descricao: 'Balanço e relatórios' },
  { key: 'previsao',      label: 'Caixa / Previsão',      descricao: 'Orçamento e previsão de caixa' },
  { key: 'proventos',     label: 'Proventos',             descricao: 'Receitas e proventos' },
  { key: 'negocios',      label: 'Negócios',              descricao: 'CRM e oportunidades' },
  { key: 'central',       label: 'Central Gerencial',     descricao: 'Visão gerencial consolidada' },
  { key: 'lancamentos',   label: 'Lançamentos',           descricao: 'Lançamentos financeiros gerencial' },
  { key: 'cadastros',     label: 'Cadastros',             descricao: 'Cadastros gerenciais' },
  { key: 'faturamento',   label: 'Faturamento',           descricao: 'Notas fiscais, contas a receber/pagar' },
  { key: 'compras',       label: 'Compras',               descricao: 'Módulo de compras/cotações' },
  { key: 'refeicoes',     label: 'Refeições',             descricao: 'Controle de refeições' },
  { key: 'importar',      label: 'Importar Extratos',     descricao: 'Importação de extratos bancários' },
  { key: 'escanear',      label: 'Escanear Documentos',   descricao: 'Escaneamento de documentos' },
  { key: 'notas-fiscais', label: 'Notas Fiscais',         descricao: 'Emissão e consulta de notas fiscais' },
  { key: 'chat_ia',       label: 'Chat IA',               descricao: 'Assistente de inteligência artificial' },
]

export default function PlataformaEmpresas() {
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [msg, setMsg] = useState(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [novo, setNovo] = useState({ nome: '', cnpj: '', plano: 'trial' })
  const [criando, setCriando] = useState(false)

  // Empresa selecionada
  const [selecionada, setSelecionada] = useState(null)
  const [dadosEdit, setDadosEdit] = useState(null)
  const [salvandoDados, setSalvandoDados] = useState(false)

  // Módulos
  const [desabilitados, setDesabilitados] = useState([])
  const [loadingMods, setLoadingMods] = useState(false)
  const [salvandoMods, setSalvandoMods] = useState(false)

  // Tabs
  const [aba, setAba] = useState('dados')

  // Usuários
  const [membros, setMembros] = useState([])
  const [loadingMembros, setLoadingMembros] = useState(false)
  const [novoEmail, setNovoEmail] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [modalCriar, setModalCriar] = useState(false)
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', senha: '' })
  const [criandoUsuario, setCriandoUsuario] = useState(false)

  useEffect(() => { carregar() }, [])

  const apiAdmin = useCallback(async (method, params) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (method === 'GET') {
      const qs = new URLSearchParams(params).toString()
      const res = await fetch(`/api/admin?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      return res.json()
    }
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
    return res.json()
  }, [])

  const carregarMembros = useCallback(async (workspaceId) => {
    setLoadingMembros(true)
    const data = await apiAdmin('GET', { action: 'workspace-members', workspace_id: workspaceId })
    setMembros(data.members || [])
    setLoadingMembros(false)
  }, [apiAdmin])

  async function carregar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, nome, cnpj, plano, tipo, cor, created_at, workspace_members(count)')
      .neq('tipo', 'platform')
      .order('created_at', { ascending: false })
    if (!error) setEmpresas(data || [])
    setLoading(false)
  }

  async function selecionarEmpresa(emp) {
    setSelecionada(emp)
    setDadosEdit({ plano: emp.plano || 'trial' })
    setMsg(null)
    setAba('dados')
    setMembros([])
    setNovoEmail('')
    setModalCriar(false)
    setNovoUsuario({ nome: '', email: '', senha: '' })
    setLoadingMods(true)
    const { data } = await supabase
      .from('workspace_modules')
      .select('module_key, enabled')
      .eq('workspace_id', emp.id)
    if (data && data.length > 0) {
      const habilitados = new Set(data.filter(m => m.enabled === true).map(m => m.module_key))
      setDesabilitados(TODOS_MODULOS.map(m => m.key).filter(k => !habilitados.has(k)))
    } else {
      setDesabilitados([])
    }
    setLoadingMods(false)
  }

  async function salvarDados() {
    if (!selecionada || !dadosEdit) return
    setSalvandoDados(true)
    const { error } = await supabase
      .from('workspaces')
      .update({ plano: dadosEdit.plano })
      .eq('id', selecionada.id)
    setSalvandoDados(false)
    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar dados: ' + error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Dados da empresa atualizados.' })
      setSelecionada(prev => ({ ...prev, plano: dadosEdit.plano }))
      carregar()
    }
    setTimeout(() => setMsg(null), 3000)
  }

  async function salvarModulos() {
    if (!selecionada) return
    setSalvandoMods(true)
    const rows = TODOS_MODULOS.map(mod => ({
      workspace_id: selecionada.id,
      module_key: mod.key,
      enabled: !desabilitados.includes(mod.key),
    }))
    const { error } = await supabase
      .from('workspace_modules')
      .upsert(rows, { onConflict: 'workspace_id,module_key' })
    setSalvandoMods(false)
    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar módulos: ' + error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Módulos atualizados com sucesso.' })
    }
    setTimeout(() => setMsg(null), 3000)
  }

  async function adicionarMembro(e) {
    e.preventDefault()
    if (!novoEmail.trim() || !selecionada) return
    setAdicionando(true)
    const data = await apiAdmin('POST', { action: 'add-member', workspace_id: selecionada.id, email: novoEmail.trim() })
    setAdicionando(false)
    if (data.error) {
      setMsg({ tipo: 'erro', texto: data.error })
    } else {
      setMsg({ tipo: 'ok', texto: `${data.email} adicionado(a) com sucesso.` })
      setNovoEmail('')
      carregarMembros(selecionada.id)
      carregar()
    }
    setTimeout(() => setMsg(null), 4000)
  }

  async function criarEAdicionar(e) {
    e.preventDefault()
    if (!novoUsuario.nome.trim() || !novoUsuario.email.trim() || !novoUsuario.senha.trim()) return
    if (!selecionada) return
    setCriandoUsuario(true)
    const emailLower = novoUsuario.email.trim()

    // 1. Tenta vincular direto (se usuário já existe na plataforma)
    const tentativa = await apiAdmin('POST', {
      action: 'add-member',
      workspace_id: selecionada.id,
      email: emailLower,
    })

    if (!tentativa.error) {
      // Usuário já existia e foi vinculado — confirma e-mail por garantia
      await apiAdmin('POST', { action: 'confirm-email', email: emailLower })
      setCriandoUsuario(false)
      setMsg({ tipo: 'ok', texto: `Usuário ${emailLower} vinculado com sucesso!` })
      setModalCriar(false)
      setNovoUsuario({ nome: '', email: '', senha: '' })
      carregarMembros(selecionada.id)
      carregar()
      setTimeout(() => setMsg(null), 5000)
      return
    }

    // Se já é membro, só informa
    if (tentativa.error.toLowerCase().includes('já é membro')) {
      setCriandoUsuario(false)
      setMsg({ tipo: 'erro', texto: tentativa.error })
      setTimeout(() => setMsg(null), 5000)
      return
    }

    // 2. Usuário não encontrado → cria e vincula
    const criado = await apiAdmin('POST', {
      action: 'create_user',
      nome: novoUsuario.nome.trim(),
      email: emailLower,
      password: novoUsuario.senha,
    })
    if (criado.error) {
      setCriandoUsuario(false)
      setMsg({ tipo: 'erro', texto: criado.error })
      setTimeout(() => setMsg(null), 5000)
      return
    }
    // 3. Vincula ao workspace
    const adicionado = await apiAdmin('POST', {
      action: 'add-member',
      workspace_id: selecionada.id,
      email: emailLower,
    })
    setCriandoUsuario(false)
    if (adicionado.error) {
      setMsg({ tipo: 'erro', texto: 'Usuário criado mas erro ao vincular: ' + adicionado.error })
    } else {
      setMsg({ tipo: 'ok', texto: `Usuário ${emailLower} criado e vinculado com sucesso!` })
      setModalCriar(false)
      setNovoUsuario({ nome: '', email: '', senha: '' })
      carregarMembros(selecionada.id)
      carregar()
    }
    setTimeout(() => setMsg(null), 5000)
  }

  async function confirmarEmail(email) {
    const data = await apiAdmin('POST', { action: 'confirm-email', email })
    if (data.error) {
      setMsg({ tipo: 'erro', texto: data.error })
    } else {
      setMsg({ tipo: 'ok', texto: `E-mail de ${email} confirmado!` })
    }
    setTimeout(() => setMsg(null), 3000)
  }

  async function removerMembro(membroId, email) {
    if (!window.confirm(`Remover "${email}" desta empresa?`)) return
    setRemovendo(membroId)
    const data = await apiAdmin('POST', { action: 'remove-member', member_id: membroId })
    setRemovendo(null)
    if (data.error) {
      setMsg({ tipo: 'erro', texto: data.error })
    } else {
      setMsg({ tipo: 'ok', texto: 'Membro removido.' })
      setMembros(prev => prev.filter(m => m.id !== membroId))
      carregar()
    }
    setTimeout(() => setMsg(null), 3000)
  }

  async function criarEmpresa() {
    if (!novo.nome.trim()) return
    setCriando(true)
    const { error } = await supabase.from('workspaces').insert({
      nome: novo.nome.trim(),
      cnpj: novo.cnpj.trim() || null,
      plano: novo.plano,
      tipo: 'empresa',
    })
    setCriando(false)
    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro ao criar: ' + error.message })
    } else {
      setMsg({ tipo: 'ok', texto: `Empresa "${novo.nome.trim()}" criada com sucesso.` })
      setModalAberto(false)
      setNovo({ nome: '', cnpj: '', plano: 'trial' })
      carregar()
    }
    setTimeout(() => setMsg(null), 4000)
  }

  function toggleModulo(key) {
    setDesabilitados(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const filtradas = empresas.filter(e =>
    e.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    e.cnpj?.includes(busca)
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BuildingOffice2Icon className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Empresas</h1>
            <p className="text-sm text-gray-500">Gerencie workspaces, planos e módulos da plataforma</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{empresas.length} empresa(s)</span>
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Nova Empresa
          </button>
        </div>
      </div>

      {/* Modal nova empresa */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalAberto(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900">Nova Empresa</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Nome da empresa"
                  value={novo.nome}
                  onChange={e => setNovo({ ...novo, nome: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CNPJ</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="00.000.000/0000-00 (opcional)"
                  value={novo.cnpj}
                  onChange={e => setNovo({ ...novo, cnpj: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Plano</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={novo.plano}
                  onChange={e => setNovo({ ...novo, plano: e.target.value })}
                >
                  {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={criarEmpresa}
                disabled={criando || !novo.nome.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {criando ? 'Criando…' : 'Criar Empresa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${msg.tipo === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {msg.tipo === 'ok' ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
          {msg.texto}
        </div>
      )}

      {/* Layout: lista + painel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de empresas */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Buscar por nome ou CNPJ…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando…</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{filtradas.length} empresa(s)</p>
              </div>
              <ul className="divide-y divide-gray-50 max-h-[calc(100vh-320px)] overflow-y-auto">
                {filtradas.map(emp => (
                  <li key={emp.id}>
                    <button
                      onClick={() => selecionarEmpresa(emp)}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${selecionada?.id === emp.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''}`}
                    >
                      <div>
                        <p className={`text-sm font-medium ${selecionada?.id === emp.id ? 'text-indigo-700' : 'text-gray-900'}`}>{emp.nome}</p>
                        <p className="text-xs text-gray-400">{emp.workspace_members?.[0]?.count ?? 0} usuário(s)</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PLANO[emp.plano] || 'bg-gray-100 text-gray-700'}`}>
                        {emp.plano || 'trial'}
                      </span>
                    </button>
                  </li>
                ))}
                {filtradas.length === 0 && (
                  <li className="px-4 py-8 text-center text-gray-400 text-sm">Nenhuma empresa encontrada.</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Painel de detalhes */}
        <div className="lg:col-span-2 space-y-4">
          {!selecionada ? (
            <div className="bg-white rounded-xl border border-gray-100 flex flex-col items-center justify-center py-24 text-gray-400 text-sm gap-2">
              <BuildingOffice2Icon className="w-8 h-8 text-gray-300" />
              Selecione uma empresa para gerenciar
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {/* Header com nome e tabs */}
              <div className="px-4 pt-4 pb-0 border-b border-gray-100">
                <p className="text-base font-bold text-gray-900 mb-3">{selecionada.nome}</p>
                <div className="flex gap-1">
                  {[
                    { key: 'dados', label: 'Dados', icon: BuildingOffice2Icon },
                    { key: 'modulos', label: 'Módulos', icon: PuzzlePieceIcon },
                    { key: 'usuarios', label: 'Usuários', icon: UsersIcon },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setAba(t.key)
                        if (t.key === 'usuarios' && membros.length === 0) carregarMembros(selecionada.id)
                      }}
                      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${aba === t.key ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    >
                      <t.icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aba: Dados */}
              {aba === 'dados' && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
                      <p className="text-sm text-gray-900">{selecionada.nome}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">CNPJ</label>
                      <p className="text-sm text-gray-900">{selecionada.cnpj || '—'}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Plano</label>
                      <select
                        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        value={dadosEdit?.plano || 'trial'}
                        onChange={e => setDadosEdit({ ...dadosEdit, plano: e.target.value })}
                      >
                        {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Usuários</label>
                      <p className="text-sm text-gray-900">{selecionada.workspace_members?.[0]?.count ?? 0}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Criado em</label>
                      <p className="text-sm text-gray-900">{new Date(selecionada.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={salvarDados}
                      disabled={salvandoDados}
                      className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {salvandoDados ? 'Salvando…' : 'Salvar dados'}
                    </button>
                  </div>
                </div>
              )}

              {/* Aba: Módulos */}
              {aba === 'modulos' && (
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                    {loadingMods ? (
                      <div className="col-span-2 text-center py-8 text-gray-400 text-sm">Carregando módulos…</div>
                    ) : TODOS_MODULOS.map(mod => {
                      const desabilitado = desabilitados.includes(mod.key)
                      return (
                        <label
                          key={mod.key}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${desabilitado ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-indigo-200 bg-indigo-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={!desabilitado}
                            onChange={() => toggleModulo(mod.key)}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{mod.label}</p>
                            <p className="text-xs text-gray-500">{mod.descricao}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={salvarModulos}
                      disabled={salvandoMods}
                      className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {salvandoMods ? 'Salvando…' : 'Salvar módulos'}
                    </button>
                  </div>
                </div>
              )}

              {/* Aba: Usuários */}
              {aba === 'usuarios' && (
                <div className="p-4 space-y-4">
                  {/* Modal criar + adicionar */}
                  {modalCriar && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalCriar(false)}>
                      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <UserPlusIcon className="w-5 h-5 text-indigo-600" />
                          <h2 className="text-lg font-bold text-gray-900">Criar e Vincular Usuário</h2>
                        </div>
                        <p className="text-xs text-gray-500">Cria uma nova conta e já vincula à empresa <strong>{selecionada?.nome}</strong>.</p>
                        <form onSubmit={criarEAdicionar} className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                            <input
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              placeholder="Nome completo"
                              value={novoUsuario.nome}
                              onChange={e => setNovoUsuario({ ...novoUsuario, nome: e.target.value })}
                              required autoFocus
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">E-mail *</label>
                            <input
                              type="email"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              placeholder="email@empresa.com.br"
                              value={novoUsuario.email}
                              onChange={e => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Senha *</label>
                            <input
                              type="password"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                              placeholder="Senha de acesso"
                              value={novoUsuario.senha}
                              onChange={e => setNovoUsuario({ ...novoUsuario, senha: e.target.value })}
                              required minLength={6}
                            />
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <button type="button" onClick={() => setModalCriar(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                            <button
                              type="submit"
                              disabled={criandoUsuario}
                              className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                              {criandoUsuario ? 'Criando…' : 'Criar e Vincular'}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Barra de ações */}
                  <div className="flex gap-2">
                    <form onSubmit={adicionarMembro} className="flex gap-2 flex-1">
                      <input
                        type="email"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        placeholder="E-mail de usuário já cadastrado na plataforma…"
                        value={novoEmail}
                        onChange={e => setNovoEmail(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={adicionando || !novoEmail.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        <PlusIcon className="w-4 h-4" />
                        {adicionando ? 'Adicionando…' : 'Adicionar'}
                      </button>
                    </form>
                    <button
                      onClick={() => setModalCriar(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                    >
                      <UserPlusIcon className="w-4 h-4" />
                      Criar usuário
                    </button>
                  </div>

                  {/* Lista de membros */}
                  {loadingMembros ? (
                    <div className="text-center py-8 text-gray-400 text-sm">Carregando usuários…</div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-100">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3 text-left">E-mail</th>
                            <th className="px-4 py-3 text-left">Membro desde</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {membros.map(m => (
                            <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${!m.ativo ? 'opacity-50' : ''}`}>
                              <td className="px-4 py-3 text-gray-900 font-medium">{m.email}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs">{new Date(m.created_at).toLocaleDateString('pt-BR')}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {m.ativo ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => confirmarEmail(m.email)}
                                    className="p-1.5 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                                    title="Confirmar e-mail (corrige 'Email not confirmed')"
                                  >
                                    <EnvelopeIcon className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => removerMembro(m.id, m.email)}
                                    disabled={removendo === m.id}
                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title="Remover da empresa"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {membros.length === 0 && (
                            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Nenhum usuário vinculado.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
