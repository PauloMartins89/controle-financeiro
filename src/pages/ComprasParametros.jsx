import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon, CheckCircleIcon, CogIcon,
} from '@heroicons/react/24/outline'

const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5, display: 'block' }
const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }

const PARAMETROS = [
  {
    secao: 'Aprovação',
    items: [
      { key: 'limite_aprovacao_direta', label: 'Limite para aprovação direta (R$)', type: 'number', placeholder: '500', hint: 'Acima deste valor, a solicitação vai para leilão/cotação automática.' },
      { key: 'aprovador_compras_telefone', label: 'WhatsApp do aprovador', type: 'text', placeholder: '5567999990000', hint: 'Número no formato internacional (sem +). Receberá notificações de novas solicitações.' },
    ],
  },
  {
    secao: 'Cotações',
    items: [
      { key: 'prazo_padrao_cotacao', label: 'Prazo padrão para cotação (horas)', type: 'number', placeholder: '48', hint: 'Tempo padrão de resposta esperado dos fornecedores.' },
      { key: 'qtd_minima_cotacoes', label: 'Quantidade mínima de cotações', type: 'number', placeholder: '3', hint: 'Número mínimo de fornecedores que devem responder antes de encerrar o leilão.' },
    ],
  },
  {
    secao: 'Notificações',
    items: [
      { key: 'email_comprador', label: 'E-mail do comprador', type: 'text', placeholder: 'compras@empresa.com', hint: 'Recebe relatórios automáticos e alertas de compras.' },
      { key: 'notificar_recebimento', label: 'Notificar WhatsApp no recebimento', type: 'select', options: [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }], hint: 'Envia mensagem ao aprovador quando um pedido é marcado como recebido.' },
    ],
  },
  {
    secao: 'Pedidos',
    items: [
      { key: 'prefixo_pedido', label: 'Prefixo do número de pedido', type: 'text', placeholder: 'PO-', hint: 'Ex: PO-2025-0001' },
      { key: 'condicao_pagamento_padrao', label: 'Condição de pagamento padrão', type: 'text', placeholder: '30 dias', hint: 'Aparece como padrão nos pedidos emitidos.' },
    ],
  },
]

export default function ComprasParametros() {
  const { workspaceId: wsId } = useStore()
  const [params,    setParams]    = useState({})
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [dirty,     setDirty]     = useState(false)

  const load = useCallback(async (workspaceId) => {
    setLoading(true)
    const keys = PARAMETROS.flatMap(s => s.items.map(i => i.key))
    const { data } = await supabase.from('configuracoes').select('chave,valor').in('chave', keys).eq('workspace_id', workspaceId)
    const map = {}
    ;(data || []).forEach(row => { map[row.chave] = row.valor })
    setParams(map)
    setLoading(false)
    setDirty(false)
  }, [])

  useEffect(() => { if (wsId) load(wsId) }, [wsId, load])

  function handleChange(key, value) {
    setParams(p => ({ ...p, [key]: value }))
    setDirty(true)
  }

  async function handleSave() {
    if (!wsId) return
    setSaving(true)
    const upserts = Object.entries(params).map(([chave, valor]) => ({
      workspace_id: wsId, chave, valor: valor ?? '',
    }))
    const { error } = await supabase.from('configuracoes').upsert(upserts, { onConflict: 'workspace_id,chave' })
    if (error) { toast.error('Erro ao salvar: ' + error.message); setSaving(false); return }
    toast.success('Parâmetros salvos!')
    setSaving(false)
    setDirty(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Parâmetros de Compras"
        subtitle="Configurações do módulo — aprovação, cotações, notificações"
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }}>

        {/* Barra de ação fixa */}
        {dirty && (
          <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0ea5e9', borderRadius: 12, marginBottom: 20, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Há alterações não salvas</span>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '7px 18px', borderRadius: 8, background: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: '#0ea5e9', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircleIcon style={{ width: 15, height: 15 }} />
              {saving ? 'Salvando...' : 'Salvar Agora'}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <ArrowPathIcon style={{ width: 28, height: 28, color: '#0ea5e9', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 660 }}>
            {PARAMETROS.map(secao => (
              <div key={secao.secao} style={{ background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CogIcon style={{ width: 16, height: 16, color: '#0ea5e9' }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{secao.secao}</span>
                </div>
                <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {secao.items.map(item => (
                    <div key={item.key}>
                      <label style={lbl}>{item.label}</label>
                      {item.type === 'select' ? (
                        <select value={params[item.key] || ''} onChange={e => handleChange(item.key, e.target.value)}
                          style={{ ...inp }}>
                          <option value="">— selecionar —</option>
                          {item.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type={item.type}
                          value={params[item.key] || ''}
                          onChange={e => handleChange(item.key, e.target.value)}
                          placeholder={item.placeholder}
                          style={inp}
                        />
                      )}
                      {item.hint && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{item.hint}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button onClick={handleSave} disabled={saving || !dirty}
              style={{ padding: '11px 28px', borderRadius: 10, background: dirty ? '#0ea5e9' : 'var(--bg-secondary)', border: dirty ? 'none' : '1px solid var(--border)', cursor: saving || !dirty ? 'not-allowed' : 'pointer', color: dirty ? '#fff' : 'var(--text-secondary)', fontSize: 14, fontWeight: 800, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7, transition: 'all .2s' }}>
              <CheckCircleIcon style={{ width: 17, height: 17 }} />
              {saving ? 'Salvando...' : 'Salvar Parâmetros'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
