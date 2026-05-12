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
  const set = useStore.setState

  useEffect(() => {
    if (!supabase) return
    const load = async () => {
      const [{ data: pessoas }, { data: grupos }, { data: despesas }, { data: cartoes }] = await Promise.all([
        supabase.from('pessoas').select('*'),
        supabase.from('grupos').select('*'),
        supabase.from('despesas').select('*').order('data', { ascending: false }),
        supabase.from('cartoes').select('*'),
      ])
      // Supabase é fonte única de verdade — sempre sobrescreve estado local
      set({
        people:   (pessoas || []).map(p => ({ ...p, avatar: p.nome?.[0]?.toUpperCase() || '?' })),
        groups:   grupos || [],
        expenses: despesas || [],
        cards:    cartoes || [],
      })
    }
    load()

    // Tempo real — atualiza automaticamente em todos os dispositivos
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'despesas' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cartoes' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pessoas' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grupos' }, () => load())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

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

