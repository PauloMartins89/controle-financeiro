import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PuzzlePieceIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

// Mapeamento de todos os módulos disponíveis na plataforma
const TODOS_MODULOS = [
  // ── FinanceiroPro ─────────────────────────────────────────
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
  // ── Gerencial ─────────────────────────────────────────────
  { key: 'central',       label: 'Central Gerencial',     descricao: 'Visão gerencial consolidada' },
  { key: 'lancamentos',   label: 'Lançamentos',           descricao: 'Lançamentos financeiros gerencial' },
  { key: 'cadastros',     label: 'Cadastros',             descricao: 'Cadastros gerenciais' },
  // ── Financeiro ────────────────────────────────────────────
  { key: 'faturamento',   label: 'Faturamento',           descricao: 'Notas fiscais, contas a receber/pagar' },
  // ── Módulos especializados ────────────────────────────────
  { key: 'compras',       label: 'Compras',               descricao: 'Módulo de compras/cotações' },
  { key: 'refeicoes',     label: 'Refeições',             descricao: 'Controle de refeições' },
  // ── Documentos ────────────────────────────────────────────
  { key: 'importar',      label: 'Importar Extratos',     descricao: 'Importação de extratos bancários' },
  { key: 'escanear',      label: 'Escanear Documentos',   descricao: 'Escaneamento de documentos' },
  { key: 'notas-fiscais', label: 'Notas Fiscais',         descricao: 'Emissão e consulta de notas fiscais' },
  // ── IA ────────────────────────────────────────────────────
  { key: 'chat_ia',       label: 'Chat IA',               descricao: 'Assistente de inteligência artificial' },
  // ── Agenda ────────────────────────────────────────────────────────────────
  { key: 'agendamentos',  label: 'Agendamentos',          descricao: 'Agenda de serviços via WhatsApp' },
  // ── Manutenção ────────────────────────────────────────────────────────────
  { key: 'manutencao',    label: 'Manutenção',            descricao: 'Ordens de serviço, preventiva, planos PFD' },
]

export default function PlataformaModulos() {
  const [empresas, setEmpresas] = useState([])
  const [selecionada, setSelecionada] = useState(null)
  const [desabilitados, setDesabilitados] = useState([]) // module_keys com enabled=false
  const [loadingMods, setLoadingMods] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase
      .from('workspaces')
      .select('id, nome, plano')
      .neq('tipo', 'platform')
      .order('nome')
      .then(({ data }) => setEmpresas(data || []))
  }, [])

  async function selecionarEmpresa(emp) {
    setSelecionada(emp)
    setMsg(null)
    setLoadingMods(true)
    const { data } = await supabase
      .from('workspace_modules')
      .select('module_key, enabled')
      .eq('workspace_id', emp.id)
    if (data && data.length > 0) {
      // Workspace já tem configuração: usa whitelist
      // Desabilitados = todos os módulos que NÃO têm enabled=true explícito
      const habilitados = new Set(data.filter(m => m.enabled === true).map(m => m.module_key))
      setDesabilitados(TODOS_MODULOS.map(m => m.key).filter(k => !habilitados.has(k)))
    } else {
      // Workspace sem configuração: todos habilitados por padrão
      setDesabilitados([])
    }
    setLoadingMods(false)
  }

  function toggleModulo(key) {
    setDesabilitados(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  async function salvar() {
    if (!selecionada) return
    setSalvando(true)
    // Upsert uma linha por módulo: enabled=false se estiver na blacklist, enabled=true caso contrário
    const rows = TODOS_MODULOS.map(mod => ({
      workspace_id: selecionada.id,
      module_key: mod.key,
      enabled: !desabilitados.includes(mod.key),
    }))
    const { error } = await supabase
      .from('workspace_modules')
      .upsert(rows, { onConflict: 'workspace_id,module_key' })
    setSalvando(false)
    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar: ' + error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Módulos atualizados com sucesso.' })
    }
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <PuzzlePieceIcon className="w-7 h-7 text-indigo-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Módulos por Empresa</h1>
          <p className="text-sm text-gray-500">Habilite ou desabilite módulos para cada empresa</p>
        </div>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${msg.tipo === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {msg.tipo === 'ok' ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
          {msg.texto}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de empresas */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Empresas</p>
            </div>
            <ul className="divide-y divide-gray-50">
              {empresas.map(emp => (
                <li key={emp.id}>
                  <button
                    onClick={() => selecionarEmpresa(emp)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${selecionada?.id === emp.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''}`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${selecionada?.id === emp.id ? 'text-indigo-700' : 'text-gray-900'}`}>{emp.nome}</p>
                      <p className="text-xs text-gray-400">{emp.plano}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Painel de módulos */}
        <div className="lg:col-span-2">
          {!selecionada ? (
            <div className="bg-white rounded-xl border border-gray-100 flex items-center justify-center py-16 text-gray-400 text-sm">
              Selecione uma empresa para gerenciar os módulos
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">{selecionada.nome}</p>
                <button
                  onClick={salvar}
                  disabled={salvando}
                  className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {salvando ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
