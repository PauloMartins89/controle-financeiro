import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PuzzlePieceIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

// Mapeamento de todos os módulos disponíveis na plataforma
const TODOS_MODULOS = [
  { key: 'dashboard',    label: 'Dashboard',         descricao: 'Visão geral financeira' },
  { key: 'despesas',     label: 'Despesas',           descricao: 'Lançamentos de despesas' },
  { key: 'lancamentos',  label: 'Lançamentos',        descricao: 'Lançamentos financeiros' },
  { key: 'cartoes',      label: 'Cartões',            descricao: 'Controle de cartões' },
  { key: 'balanco',      label: 'Balanço',            descricao: 'Balanço e relatórios' },
  { key: 'recorrentes',  label: 'Recorrentes',        descricao: 'Despesas recorrentes' },
  { key: 'previsao',     label: 'Previsão',           descricao: 'Orçamento e previsão' },
  { key: 'efetivo',      label: 'Efetivo',            descricao: 'Controle de efetivo/RH' },
  { key: 'refeicoes',    label: 'Refeições',          descricao: 'Controle de refeições' },
  { key: 'compras',      label: 'Compras',            descricao: 'Módulo de compras/cotações' },
  { key: 'veiculos',     label: 'Veículos',           descricao: 'Controle de frota' },
  { key: 'negocios',     label: 'Negócios',           descricao: 'CRM e oportunidades' },
  { key: 'faturamento',  label: 'Faturamento',        descricao: 'Notas fiscais e faturamento' },
  { key: 'saude',        label: 'Saúde Financeira',   descricao: 'Indicadores de saúde' },
  { key: 'timeline',     label: 'Timeline',           descricao: 'Linha do tempo financeira' },
  { key: 'importar',     label: 'Importar',           descricao: 'Importação de extratos' },
  { key: 'chat_ia',      label: 'Chat IA',            descricao: 'Assistente de inteligência artificial' },
]

export default function PlataformaModulos() {
  const [empresas, setEmpresas] = useState([])
  const [selecionada, setSelecionada] = useState(null)
  const [modulosAtivos, setModulosAtivos] = useState([]) // chaves desabilitadas (blacklist)
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase
      .from('workspaces')
      .select('id, nome, plano, enabled_modules')
      .neq('tipo', 'platform')
      .order('nome')
      .then(({ data }) => setEmpresas(data || []))
  }, [])

  function selecionarEmpresa(emp) {
    setSelecionada(emp)
    // enabled_modules é a BLACKLIST (módulos desabilitados)
    setModulosAtivos(emp.enabled_modules || [])
    setMsg(null)
  }

  function toggleModulo(key) {
    // Módulo na lista = desabilitado; fora da lista = habilitado
    setModulosAtivos(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  async function salvar() {
    if (!selecionada) return
    setSalvando(true)
    const { error } = await supabase
      .from('workspaces')
      .update({ enabled_modules: modulosAtivos })
      .eq('id', selecionada.id)
    setSalvando(false)
    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar: ' + error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Módulos atualizados com sucesso.' })
      setEmpresas(prev => prev.map(e => e.id === selecionada.id ? { ...e, enabled_modules: modulosAtivos } : e))
      setSelecionada(prev => ({ ...prev, enabled_modules: modulosAtivos }))
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
                    <span className="text-xs text-gray-400">
                      {TODOS_MODULOS.length - (emp.enabled_modules?.length || 0)} ativos
                    </span>
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
                {TODOS_MODULOS.map(mod => {
                  const desabilitado = modulosAtivos.includes(mod.key)
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
