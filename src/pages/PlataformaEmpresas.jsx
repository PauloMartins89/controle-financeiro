import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BuildingOffice2Icon, PlusIcon, MagnifyingGlassIcon, PencilSquareIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

const PLANOS = ['trial', 'basico', 'profissional', 'enterprise', 'isento']
const STATUS_PLANO = { trial: 'bg-yellow-100 text-yellow-800', basico: 'bg-blue-100 text-blue-800', profissional: 'bg-indigo-100 text-indigo-800', enterprise: 'bg-purple-100 text-purple-800', isento: 'bg-green-100 text-green-800' }

export default function PlataformaEmpresas() {
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [novo, setNovo] = useState({ nome: '', cnpj: '', plano: 'trial' })
  const [criando, setCriando] = useState(false)

  useEffect(() => { carregar() }, [])

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

  async function salvarEdicao() {
    if (!editando) return
    setSalvando(true)
    const { error } = await supabase
      .from('workspaces')
      .update({ plano: editando.plano })
      .eq('id', editando.id)
    setSalvando(false)
    if (error) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar: ' + error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Empresa atualizada com sucesso.' })
      setEditando(null)
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

  const filtradas = empresas.filter(e =>
    e.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    e.cnpj?.includes(busca)
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BuildingOffice2Icon className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Empresas</h1>
            <p className="text-sm text-gray-500">Gerencie todos os workspaces da plataforma</p>
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
              <button
                onClick={() => setModalAberto(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
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
        <div className="text-center py-12 text-gray-400">Carregando…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-4 py-3 text-left">CNPJ</th>
                <th className="px-4 py-3 text-left">Plano</th>
                <th className="px-4 py-3 text-left">Usuários</th>
                <th className="px-4 py-3 text-left">Criado em</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtradas.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{emp.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.cnpj || '—'}</td>
                  <td className="px-4 py-3">
                    {editando?.id === emp.id ? (
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-xs"
                        value={editando.plano}
                        onChange={e => setEditando({ ...editando, plano: e.target.value })}
                      >
                        {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PLANO[emp.plano] || 'bg-gray-100 text-gray-700'}`}>
                        {emp.plano || 'trial'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.workspace_members?.[0]?.count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(emp.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    {editando?.id === emp.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={salvarEdicao}
                          disabled={salvando}
                          className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {salvando ? 'Salvando…' : 'Salvar'}
                        </button>
                        <button
                          onClick={() => setEditando(null)}
                          className="px-3 py-1 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditando({ id: emp.id, plano: emp.plano || 'trial' })}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Editar plano"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Nenhuma empresa encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
