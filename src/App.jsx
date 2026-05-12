import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Sidebar from './components/Sidebar'
import { supabase } from './lib/supabase'
import useStore from './store/useStore'
import Dashboard from './pages/Dashboard'
import Despesas from './pages/Despesas'
import QuemDeve from './pages/QuemDeve'
import Grupos from './pages/Grupos'
import Pessoas from './pages/Pessoas'
import Cartoes from './pages/Cartoes'
import Veiculos from './pages/Veiculos'
import Balanco from './pages/Balanco'
import Recorrentes from './pages/Recorrentes'
import Timeline from './pages/Timeline'
import Previsao from './pages/Previsao'
import Negocios from './pages/Negocios'
import Proventos from './pages/Proventos'
import Importar from './pages/Importar'

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [ready, setReady] = useState(!supabase) // se não tem Supabase, já está pronto
  const set = useStore.setState

  useEffect(() => {
    if (!supabase) return
    const load = async () => {
      const [{ data: pessoas }, { data: grupos }, { data: despesas }, { data: cartoes }, { data: configs }] = await Promise.all([
        supabase.from('pessoas').select('*'),
        supabase.from('grupos').select('*'),
        supabase.from('despesas').select('*').order('data', { ascending: false }),
        supabase.from('cartoes').select('*'),
        supabase.from('configuracoes').select('*'),
      ])
      const loadedPeople = (pessoas || []).map(p => ({ ...p, avatar: p.nome?.[0]?.toUpperCase() || '?' }))
      const update = {
        people:   loadedPeople,
        groups:   grupos || [],
        expenses: despesas || [],
        cards:    cartoes || [],
      }
      // Sincroniza saldoCaixa do banco
      const cfgSaldo = configs?.find(c => c.chave === 'saldoCaixa')
      if (cfgSaldo) update.saldoCaixa = parseFloat(cfgSaldo.valor) || 0
      // Sincroniza currentUser: se o currentUser do localStorage não existe mais
      // nas pessoas do Supabase, atualiza para a primeira pessoa da lista (ou owner)
      const currentUser = useStore.getState().currentUser
      if (loadedPeople.length > 0 && !loadedPeople.find(p => p.id === currentUser?.id)) {
        update.currentUser = loadedPeople.find(p => p.is_owner) || loadedPeople[0]
      }
      set(update)
      setReady(true)
    }
    load()

    // Tempo real — atualiza automaticamente em todos os dispositivos
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'despesas' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cartoes' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pessoas' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grupos' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes' }, () => load())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)', color: '#6366f1', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 48, height: 48, border: '4px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <span style={{ color: '#94a3b8', fontSize: 14 }}>Carregando dados...</span>
    </div>
  )

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/despesas" element={<Despesas />} />
            <Route path="/quem-deve" element={<QuemDeve />} />
            <Route path="/grupos" element={<Grupos />} />
            <Route path="/pessoas" element={<Pessoas />} />
            <Route path="/cartoes" element={<Cartoes />} />
            <Route path="/veiculos" element={<Veiculos />} />
            <Route path="/balanco" element={<Balanco />} />
            <Route path="/recorrentes" element={<Recorrentes />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/previsao" element={<Previsao />} />
            <Route path="/negocios" element={<Negocios />} />
            <Route path="/proventos" element={<Proventos />} />
            <Route path="/importar" element={<Importar />} />
          </Routes>
        </main>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a2035',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            fontSize: 14,
          },
        }}
      />
    </BrowserRouter>
  )
}

