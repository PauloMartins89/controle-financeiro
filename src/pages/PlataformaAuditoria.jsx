import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ClipboardDocumentListIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline'

const ACOES_COR = {
  login: 'bg-blue-100 text-blue-700',
  logout: 'bg-gray-100 text-gray-600',
  criar: 'bg-green-100 text-green-700',
  editar: 'bg-yellow-100 text-yellow-700',
  deletar: 'bg-red-100 text-red-700',
  aprovar: 'bg-indigo-100 text-indigo-700',
  rejeitar: 'bg-orange-100 text-orange-700',
}

function badgeCor(acao) {
  const base = acao?.toLowerCase()
  for (const [k, v] of Object.entries(ACOES_COR)) {
    if (base?.includes(k)) return v
  }
  return 'bg-gray-100 text-gray-600'
}

export default function PlataformaAuditoria() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')
  const [filtroTabela, setFiltroTabela] = useState('')
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 50

  const carregar = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('logs_auditoria')
      .select(`
        id, acao, tabela, registro_id, ip, created_at,
        dados_depois,
        workspaces(nome),
        users:user_id(email:raw_user_meta_data->email)
      `)
      .order('created_at', { ascending: false })
      .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1)

    if (filtroAcao) q = q.ilike('acao', `%${filtroAcao}%`)
    if (filtroTabela) q = q.ilike('tabela', `%${filtroTabela}%`)

    const { data, error } = await q
    if (!error) setLogs(data || [])
    setLoading(false)
  }, [pagina, filtroAcao, filtroTabela])

  useEffect(() => { carregar() }, [carregar])

  const filtrados = logs.filter(l =>
    !busca ||
    l.acao?.toLowerCase().includes(busca.toLowerCase()) ||
    l.tabela?.toLowerCase().includes(busca.toLowerCase()) ||
    l.workspaces?.nome?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardDocumentListIcon className="w-7 h-7 text-indigo-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Auditoria</h1>
          <p className="text-sm text-gray-500">Histórico de ações em toda a plataforma</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Buscar por ação, tabela ou empresa…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <input
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-36"
          placeholder="Filtrar ação"
          value={filtroAcao}
          onChange={e => { setFiltroAcao(e.target.value); setPagina(0) }}
        />
        <input
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-36"
          placeholder="Filtrar tabela"
          value={filtroTabela}
          onChange={e => { setFiltroTabela(e.target.value); setPagina(0) }}
        />
        <button
          onClick={carregar}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
        >
          <FunnelIcon className="w-4 h-4" />
          Aplicar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando logs…</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Data/Hora</th>
                  <th className="px-4 py-3 text-left">Ação</th>
                  <th className="px-4 py-3 text-left">Tabela</th>
                  <th className="px-4 py-3 text-left">Empresa</th>
                  <th className="px-4 py-3 text-left">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeCor(log.acao)}`}>
                        {log.acao}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{log.tabela || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{log.workspaces?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{log.ip || '—'}</td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhum log encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{filtrados.length} registro(s) exibidos</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina(p => Math.max(0, p - 1))}
                disabled={pagina === 0}
                className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="px-3 py-1">Página {pagina + 1}</span>
              <button
                onClick={() => setPagina(p => p + 1)}
                disabled={logs.length < POR_PAGINA}
                className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                Próxima →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
