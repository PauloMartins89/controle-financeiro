import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import EscanearRecibo from './pages/EscanearRecibo'
import NotasFiscais from './pages/NotasFiscais'
import Lancamentos from './pages/Lancamentos'
import Faturamento from './pages/Faturamento'
import Pagamentos from './pages/Pagamentos'
import Login from './pages/Login'
import Acessos from './pages/Acessos'
import AdminPanel from './pages/AdminPanel'
import Planos from './pages/Planos'
import { isAdmin } from './lib/admin'
import ChatIA from './components/ChatIA'
import GlobalSearch from './components/GlobalSearch'

// Verifica se assinatura está ativa (trial válido, ativo, ou isento)
function isSubscriptionActive(sub) {
  if (!sub) return false
  if (sub.status === 'isento') return true
  if (sub.status === 'ativo') {
    if (!sub.expires_at) return true // renovação automática sem data
    return new Date(sub.expires_at) > new Date()
  }
  if (sub.status === 'trial') {
    return sub.trial_expires_at && new Date(sub.trial_expires_at) > new Date()
  }
  return false
}

function RequireSubscription({ children }) {
  const [checked, setChecked] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (!supabase) { setAllowed(true); setChecked(true); return }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setAllowed(false); setChecked(true); return }
      // Admin sempre tem acesso
      if (isAdmin(data.user)) { setAllowed(true); setChecked(true); return }
      const { data: sub } = await supabase
        .from('assinaturas')
        .select('status, trial_expires_at, expires_at')
        .eq('user_id', data.user.id)
        .maybeSingle()
      // Se ainda não existe registro, cria trial (fallback para usuários que confirmaram e-mail antes do trigger)
      if (!sub) {
        await supabase.from('assinaturas').upsert({
          user_id: data.user.id,
          email: data.user.email,
          status: 'trial',
          trial_expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
        }, { onConflict: 'user_id' })
        setAllowed(true) // trial recém criado, permite entrar
      } else {
        setAllowed(isSubscriptionActive(sub))
      }
      setChecked(true)
    })
  }, [])

  if (!checked) return null
  if (!allowed) return <Navigate to="/planos" replace />
  return children
}

function RequireAdmin({ children }) {
  const location = useLocation()
  const [checked, setChecked] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (!supabase) { setAllowed(true); setChecked(true); return }
    supabase.auth.getUser().then(({ data }) => {
      setAllowed(isAdmin(data?.user))
      setChecked(true)
    })
  }, [])

  if (!checked) return null
  if (!allowed) return <Navigate to="/" replace />
  return children
}

function RequireAuth({ children }) {
  const location = useLocation()
  const [checked, setChecked] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    if (!supabase) { setAuthed(true); setChecked(true); return }
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
      setChecked(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!checked) return null
  if (!authed) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [ready, setReady] = useState(!supabase)
  const set = useStore.setState

  useEffect(() => {
    if (!supabase) return

    const EMPTY_STATE = {
      people: [], groups: [], expenses: [], cards: [], vehicles: [],
      recurring: [], negocios: [], proventos: [], closures: [],
      saldoCaixa: 0, currentUser: null, ownerId: null,
      workspaceId: null, enabledModules: null,
    }

    const load = async () => {
      const [
        { data: pessoas },
        { data: grupos },
        { data: despesas },
        { data: cartoes },
        { data: configs },
        { data: veiculos },
        { data: recorrentes },
        { data: negocios },
        { data: proventos },
        { data: closures },
        { data: wsMember },
      ] = await Promise.all([
        supabase.from('pessoas').select('*'),
        supabase.from('grupos').select('*'),
        supabase.from('despesas').select('*').order('data', { ascending: false }),
        supabase.from('cartoes').select('*'),
        supabase.from('configuracoes').select('*'),
        supabase.from('veiculos').select('*'),
        supabase.from('recorrentes').select('*'),
        supabase.from('negocios').select('*'),
        supabase.from('proventos').select('*').order('data', { ascending: false }),
        supabase.from('closures').select('*').order('mes', { ascending: true }),
        supabase.from('workspace_members').select('workspace_id').maybeSingle(),
      ])
      // Carrega módulos habilitados do workspace
      const workspaceId = wsMember?.workspace_id || null
      let enabledModules = null
      if (workspaceId) {
        const { data: modulesData } = await supabase
          .from('workspace_modules')
          .select('module_key, enabled')
          .eq('workspace_id', workspaceId)
        if (modulesData) {
          enabledModules = modulesData
            .filter(m => m.enabled)
            .map(m => m.module_key)
        }
      }
      const loadedPeople = (pessoas || []).map(p => ({ ...p, avatar: p.nome?.[0]?.toUpperCase() || '?' }))
      // Auto-migra veículos do localStorage para o Supabase se a tabela estiver vazia
      let vehiclesData = veiculos || []
      if (vehiclesData.length === 0) {
        const localVehicles = useStore.getState().vehicles || []
        if (localVehicles.length > 0) {
          const rows = localVehicles.map(v => ({ id: v.id, placa: v.placa, apelido: v.apelido || null, pessoa_id: v.pessoa_id || null, cor: v.cor || '#6366f1' }))
          const { data: inserted } = await supabase.from('veiculos').upsert(rows, { onConflict: 'id' }).select()
          if (inserted) vehiclesData = inserted
          else vehiclesData = localVehicles
        }
      }
      const update = {
        people:    loadedPeople,
        groups:    grupos || [],
        expenses:  (despesas || []).map(d => ({ ...d, _veiculo: d.veiculo_placa || d._veiculo || null })),
        cards:     cartoes || [],
        vehicles:  vehiclesData,
        recurring: recorrentes || [],
        negocios:  negocios || [],
        proventos: proventos || [],
        closures:  closures || [],
        ownerId:       loadedPeople.find(p => p.is_owner)?.id || null,
        workspaceId:   workspaceId,
        enabledModules: enabledModules,
      }
      // Sincroniza saldoCaixa do banco
      const cfgSaldo = configs?.find(c => c.chave === 'saldoCaixa')
      if (cfgSaldo) update.saldoCaixa = parseFloat(cfgSaldo.valor) || 0
      // Nome do usuário autenticado (user_metadata.full_name ou parte do email)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const rawName = authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || null
      update.authUserName = rawName
        ? rawName.split(' ')[0].charAt(0).toUpperCase() + rawName.split(' ')[0].slice(1)
        : null
      // Auto-cria pessoa + canal na primeira vez que o usuário loga
      // Verifica especificamente se já existe um is_owner=true para este usuário
      const jaTemOwner = loadedPeople.some(p => p.is_owner && p.owner_id === authUser?.id)
      if (!jaTemOwner && authUser) {
        const meta = authUser.user_metadata || {}
        const nomeUsuario = meta.full_name || authUser.email?.split('@')[0] || 'Eu'
        const tel = meta.whatsapp || null
        const pessoaId = crypto.randomUUID()
        const { data: novaPessoa } = await supabase.from('pessoas')
          .insert({ id: pessoaId, nome: nomeUsuario, telefone: tel || null, is_owner: true, owner_id: authUser.id })
          .select().single()
        if (novaPessoa) {
          update.people = [{ ...novaPessoa, avatar: nomeUsuario[0]?.toUpperCase() || '?' }]
          update.currentUser = { ...novaPessoa, avatar: nomeUsuario[0]?.toUpperCase() || '?' }
          if (tel) {
            await supabase.from('canais_mensagem')
              .insert({ telefone: tel, pessoa_id: pessoaId, owner_id: authUser.id, ativo: true })
          }
        }
      }
      // Sincroniza currentUser: se o currentUser do localStorage não existe mais
      // nas pessoas do Supabase, atualiza para a primeira pessoa da lista (ou owner)
      const currentUser = useStore.getState().currentUser
      if (update.people?.length > 0 && !update.people.find(p => p.id === currentUser?.id)) {
        update.currentUser = update.people.find(p => p.is_owner) || update.people[0]
      } else if (loadedPeople.length > 0 && !loadedPeople.find(p => p.id === currentUser?.id)) {
        update.currentUser = loadedPeople.find(p => p.is_owner) || loadedPeople[0]
      }
      set(update)
      setReady(true)
    }
    window.loadAppData = load

    // Tempo real — cria o canal só após carregar (usuário autenticado)
    let channel = null
    function setupChannel() {
      if (channel) supabase.removeChannel(channel)
      channel = supabase
        .channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'despesas' }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cartoes' }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pessoas' }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'grupos' }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes' }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'veiculos' }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'recorrentes' }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'negocios' }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'proventos' }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'closures' }, () => load())
        .subscribe()
    }

    // Limpa o store e recarrega ao trocar de usuário
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        if (channel) { supabase.removeChannel(channel); channel = null }
        set({ ...EMPTY_STATE })
        setReady(true)
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        set({ ...EMPTY_STATE })
        load().then(() => setupChannel())
      }
    })

    load().then(() => setupChannel())

    return () => {
      supabase.removeChannel(channel)
      subscription.unsubscribe()
    }
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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/planos" element={<Planos />} />
        <Route path="/*" element={
          <RequireAuth>
            <RequireSubscription>
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
                  <Route path="/escanear" element={<EscanearRecibo />} />
                  <Route path="/notas-fiscais" element={<NotasFiscais />} />
                  <Route path="/lancamentos" element={<Lancamentos />} />
                  <Route path="/faturamento" element={<Faturamento />} />
                  <Route path="/pagamentos" element={<Pagamentos />} />
                  <Route path="/acessos" element={<RequireAdmin><Acessos /></RequireAdmin>} />
                  <Route path="/admin" element={<RequireAdmin><AdminPanel /></RequireAdmin>} />
                </Routes>
              </main>
            </div>
            <ChatIA />
            <GlobalSearch />
            </RequireSubscription>
          </RequireAuth>
        } />
      </Routes>
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

