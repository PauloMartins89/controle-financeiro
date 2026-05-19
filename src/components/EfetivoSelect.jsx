import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

/**
 * EfetivoSelect — dropdown reutilizável para selecionar colaboradores do efetivo.
 *
 * Props:
 *   value        {string}   UUID selecionado
 *   onChange     {fn}       (id) => void
 *   flag         {string}   filtra apenas quem tem essa flag ativa (ex: 'pode_aprovar')
 *   placeholder  {string}
 *   disabled     {bool}
 *   style        {object}
 */
export default function EfetivoSelect({ value = '', onChange, flag = null, placeholder = '— Selecionar colaborador —', disabled = false, style = {} }) {
  const { workspaceId } = useStore()
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) return
    let query = supabase
      .from('efetivo')
      .select('id, nome, cargo, funcao_id, funcoes_efetivo(nome)')
      .eq('workspace_id', workspaceId)
      .eq('ativo', true)
      .order('nome')

    if (flag) query = query.eq(flag, true)

    query.then(({ data }) => {
      setOptions(data || [])
      setLoading(false)
    })
  }, [workspaceId, flag])

  return (
    <select
      className="input"
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled || loading}
      style={style}
    >
      <option value="">{loading ? 'Carregando…' : placeholder}</option>
      {options.map(e => (
        <option key={e.id} value={e.id}>
          {e.nome}{e.funcoes_efetivo?.nome ? ` (${e.funcoes_efetivo.nome})` : e.cargo ? ` (${e.cargo})` : ''}
        </option>
      ))}
    </select>
  )
}
