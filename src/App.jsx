import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
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
import ProspectarClientes from './pages/ProspectarClientes'
import ProspectarDashboard from './pages/ProspectarDashboard'
import ProspectarContratos from './pages/ProspectarContratos'
import ProspectarRelatorios from './pages/ProspectarRelatorios'
import Proventos from './pages/Proventos'
import Importar from './pages/Importar'
import Compras from './pages/Compras'
import ComprasAprovar from './pages/ComprasAprovar'
import ComprasBuscaFornecedor from './pages/ComprasBuscaFornecedor'
import ComprasWorkspace from './pages/ComprasWorkspace'
import ComprasDashboard from './pages/ComprasDashboard'
import ComprasCatalogo from './pages/ComprasCatalogo'
import ComprasCategorias from './pages/ComprasCategorias'
import ComprasCotacoes from './pages/ComprasCotacoes'
import ComprasFornecedores from './pages/ComprasFornecedores'
import ComprasParametros from './pages/ComprasParametros'
import ComprasPedidos from './pages/ComprasPedidos'
import ComprasPesquisaPrecos from './pages/ComprasPesquisaPrecos'
import ComprasRecebimento from './pages/ComprasRecebimento'
import ComprasRelCategoria from './pages/ComprasRelCategoria'
import ComprasRelEconomia from './pages/ComprasRelEconomia'
import ComprasRelFornecedor from './pages/ComprasRelFornecedor'
import CotacaoPublica from './pages/CotacaoPublica'
import AprovarPublica from './pages/AprovarPublica'
import LoteAprovacaoPublica from './pages/LoteAprovacaoPublica'
import RefeicaoPublica from './pages/RefeicaoPublica'
import RefeicaoAprovar from './pages/RefeicaoAprovar'
import RefeicaoConfirmarRestaurante from './pages/RefeicaoConfirmarRestaurante'
import RefeicaoValidar from './pages/RefeicaoValidar'
import Refeicoes from './pages/Refeicoes'
import LiderEpi from './pages/LiderEpi'
import LiderInsumo from './pages/LiderInsumo'
import LiderCadastroFrentes from './pages/LiderCadastroFrentes'
import LiderCadastroEquipes from './pages/LiderCadastroEquipes'
import LiderCadastroColaboradores from './pages/LiderCadastroColaboradores'
import LiderCadastroMaquinas from './pages/LiderCadastroMaquinas'
import LiderCadastroImplementos from './pages/LiderCadastroImplementos'
import LiderCadastroProdutos from './pages/LiderCadastroProdutos'
import LiderCadastroEpis from './pages/LiderCadastroEpis'
import LiderDashboard from './pages/LiderDashboard'
import SmartLiderAdmin from './pages/SmartLiderAdmin'
import LiderTurnos from './pages/LiderTurnos'
import LiderApontamentos from './pages/LiderApontamentos'
import ManutencaoDashboard from './pages/ManutencaoDashboard'
import ManutencaoOS from './pages/ManutencaoOS'
import ManutencaoPreventiva from './pages/ManutencaoPreventiva'
import ManutencaoEquipamentos from './pages/ManutencaoEquipamentos'
import ManutencaoAPIPlanos from './pages/ManutencaoAPIPlanos'
import ManutencaoPlanosPFD from './pages/ManutencaoPlanosPFD'
import AgendaServicos from './pages/AgendaServicos'
import MapaApontamentoMaquina from './pages/MapaApontamentoMaquina'
import MaquinasDashboard from './pages/MaquinasDashboard'
import BoletinsPendencias from './pages/BoletinsPendencias'
import BoletinsDiarios from './pages/BoletinsDiarios'
import EscanearRecibo from './pages/EscanearRecibo'
import NotasFiscais from './pages/NotasFiscais'
import Lancamentos from './pages/Lancamentos'
import Cadastros from './pages/Cadastros'
import FormTemplates from './pages/FormTemplates'
import Faturamento from './pages/Faturamento'
import Pagamentos from './pages/Pagamentos'
import ContasPagar from './pages/ContasPagar'
import LotesCliente from './pages/LotesCliente'
import CentralGerencial from './pages/CentralGerencial'
import FlowCenter from './pages/FlowCenter'
import FlowLab from './pages/FlowLab'
import SimulacaoFluxo from './pages/SimulacaoFluxo'
import Login from './pages/Login'
import Acessos from './pages/Acessos'
import AdminPanel from './pages/AdminPanel'
import Planos from './pages/Planos'
import PlataformaEmpresas from './pages/PlataformaEmpresas'
import PlataformaModulos from './pages/PlataformaModulos'
import PlataformaAuditoria from './pages/PlataformaAuditoria'
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
      // Platform admin sempre tem acesso (verifica via banco)
      const { data: adminRow } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (adminRow) { setAllowed(true); setChecked(true); return }
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

// Rota padrão: redireciona para o primeiro módulo habilitado se Dashboard estiver desabilitado
function DefaultRoute() {
  const enabledModules = useStore(s => s.enabledModules)
  if (enabledModules && !enabledModules.includes('dashboard')) {
    const prioridade = [
      { key: 'refeicoes', path: '/refeicoes' },
      { key: 'compras',   path: '/compras' },
      { key: 'lancamentos', path: '/lancamentos' },
      { key: 'central',   path: '/central' },
      { key: 'despesas',  path: '/despesas' },
      { key: 'faturamento', path: '/faturamento' },
    ]
    const primeiro = prioridade.find(m => enabledModules.includes(m.key))
    if (primeiro) return <Navigate to={primeiro.path} replace />
  }
  return <Dashboard />
}

function RequireAdmin({ children }) {
  const location = useLocation()
  const [checked, setChecked] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (!supabase) { setAllowed(true); setChecked(true); return }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data?.user) { setAllowed(false); setChecked(true); return }
      const { data: adminRow } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle()
      setAllowed(!!adminRow)
      setChecked(true)
    })
  }, [])

  if (!checked) return null
  if (!allowed) return <Navigate to="/" replace />
  return children
}

// Protege rota que requer admin da empresa (perfil_id = NULL) ou platform admin.
// Empresa admins têm permissoes = ['*'] mas NÃO são platform admins.
function RequireEmpresaAdmin({ children }) {
  const isPlatformAdmin = useStore(s => s.isPlatformAdmin)
  const permissoes = useStore(s => s.permissoes)
  const isEmpresaAdmin = isPlatformAdmin || permissoes.includes('*')
  const location = useLocation()
  if (!isEmpresaAdmin) return <Navigate to="/" replace state={{ from: location }} />
  return children
}

// Bloqueia rotas não permitidas pelo plataforma_modulos do usuário.
// Redireciona para "/" sem exibir nada.
function ModuloGuard() {
  const location   = useLocation()
  const navigate   = useNavigate()
  const isPlatformAdmin  = useStore(s => s.isPlatformAdmin)
  const plataformaModulos = useStore(s => s.plataformaModulos)

  useEffect(() => {
    if (isPlatformAdmin || plataformaModulos === null) return
    // Rotas sempre acessíveis independente de módulo
    const ALWAYS = ['/', '/acessos', '/perfil', '/plataforma']
    const path = location.pathname
    if (ALWAYS.some(r => path === r || path.startsWith(r + '/'))) return
    const allowed = plataformaModulos.some(r => path === r || path.startsWith(r))
    if (!allowed) navigate('/', { replace: true })
  }, [location.pathname, isPlatformAdmin, plataformaModulos, navigate])

  return null
}

// Protege rota por permissão granular. Usuários sem perfil_id (admin empresa)
// e platform admins sempre têm acesso. Usuários com perfil restrito precisam
// ter a combinação modulo.acao na tabela perfil_permissoes.
function RequirePermissao({ modulo, acao, children }) {
  const isPlatformAdmin = useStore(s => s.isPlatformAdmin)
  const permissoes = useStore(s => s.permissoes)
  const pode = isPlatformAdmin
    || permissoes.includes('*')
    || permissoes.includes(`${modulo}.${acao}`)
  if (!pode) return <Navigate to="/" replace />
  return children
}

function RequireAuth({ children }) {  const location = useLocation()
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
  const enabledModules = useStore(s => s.enabledModules)

  // Inicializa o tema antes de qualquer página renderizar
  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'light'
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  useEffect(() => {
    if (!supabase) return

    const EMPTY_STATE = {
      people: [], groups: [], expenses: [], cards: [], vehicles: [],
      recurring: [], negocios: [], proventos: [], closures: [],
      saldoCaixa: 0, currentUser: null, ownerId: null,
      workspaceId: null, enabledModules: null,
      isPlatformAdmin: false, permissoes: ['*'],
      plataformaModulos: null,
    }

    const load = async () => {
      // IMPORTANTE: pegar o user_id ANTES da query de workspace_members
      // (RLS pode estar permissiva e retornar rows de outros usuários)
      const { data: { user: _authUser } } = await supabase.auth.getUser()
      const _authUserId = _authUser?.id || null
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
        { data: wsMembers },
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
        _authUserId
          ? supabase.from('workspace_members').select('workspace_id, perfil_id, ativo, user_id').eq('user_id', _authUserId).eq('ativo', true)
          : Promise.resolve({ data: [] }),
      ])
      // Usa o workspace com mais módulos configurados (usuário pode ter múltiplos)
      const allWorkspaceIds = (wsMembers || []).map(m => m.workspace_id).filter(Boolean)
      const workspaceId = allWorkspaceIds[0] || null
      let enabledModules = null
      if (allWorkspaceIds.length > 0) {
        const { data: modulesData } = await supabase
          .from('workspace_modules')
          .select('module_key, enabled, workspace_id')
          .in('workspace_id', allWorkspaceIds)
        if (modulesData && modulesData.length > 0) {
          // Agrupa por workspace_id
          const byWorkspace = {}
          modulesData.forEach(m => {
            if (!byWorkspace[m.workspace_id]) byWorkspace[m.workspace_id] = []
            byWorkspace[m.workspace_id].push(m)
          })
          // Usa apenas o workspace que tem restrições explícitas (ao menos 1 enabled=false)
          // Ignora workspaces criados pela migration antiga (todos enabled=true)
          const rowsRestritos = Object.values(byWorkspace).find(rows =>
            rows.some(r => r.enabled === false)
          )
          if (rowsRestritos) {
            // Whitelist: apenas módulos com enabled=true nesse workspace
            enabledModules = rowsRestritos
              .filter(r => r.enabled === true)
              .map(r => r.module_key)
          }
          // Se nenhum workspace tem restrição, mantém enabledModules = null (mostra tudo)
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
      // Sincroniza saldoCaixa do banco (filtra pelo workspace correto)
      const cfgSaldo = (configs || []).find(c => c.chave === 'saldoCaixa' && c.workspace_id === workspaceId)
                    || (configs || []).find(c => c.chave === 'saldoCaixa') // fallback p/ registros sem workspace_id
      if (cfgSaldo) update.saldoCaixa = parseFloat(cfgSaldo.valor) || 0
      // Verifica se o usuário é platform admin (substitui check hardcoded de e-mail)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser?.id) {
        const { data: adminRow } = await supabase
          .from('platform_admins')
          .select('id')
          .eq('user_id', authUser.id)
          .maybeSingle()
        update.isPlatformAdmin = !!adminRow
        if (adminRow) update.enabledModules = null // admin sempre vê todos os módulos

        // Carrega permissões: ['*'] = acesso total, array específico quando tem perfil restrito
        let permissoes = ['*'] // default: admin total da empresa (sem perfil_id)
        if (!adminRow) {
          // Filtra pelo registro do USUÁRIO ATUAL (não qualquer membro do workspace)
          const myMember = (wsMembers || []).find(m => m.user_id === authUser.id && m.ativo !== false)
          if (myMember?.perfil_id) {
            // Tem perfil definido → carrega permissões específicas
            const { data: perms } = await supabase
              .from('perfil_permissoes')
              .select('modulo, acao')
              .eq('perfil_id', myMember.perfil_id)
            permissoes = (perms || []).map(p => `${p.modulo}.${p.acao}`)
          }
          // Se perfil_id é NULL → admin da empresa → permissoes = ['*']
        }
        update.permissoes = permissoes

        // Carrega módulos permitidos por usuário (plataforma_usuario_modulos)
        // null = sem restrição; array = whitelist de prefixos de rota
        if (!adminRow && workspaceId) {
          const { data: userMods } = await supabase
            .from('plataforma_usuario_modulos')
            .select('plataforma_modulos!inner(rotas)')
            .eq('user_id', authUser.id)
            .eq('workspace_id', workspaceId)
            .eq('ativo', true)
          if (userMods && userMods.length > 0) {
            update.plataformaModulos = userMods.flatMap(m => m.plataforma_modulos?.rotas || [])
          } else {
            update.plataformaModulos = null
          }
        }
      }
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
      if (channel) { try { supabase.removeChannel(channel) } catch (_) {} channel = null }
      // Nome único evita conflito com canal cacheado pelo supabase-js
      // (StrictMode em dev monta o effect 2x e reusaria o canal já subscrito,
      // o que dispara: "cannot add postgres_changes callbacks ... after subscribe()")
      const channelName = `db-changes:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
      channel = supabase
        .channel(channelName)
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
        if (channel) { try { supabase.removeChannel(channel) } catch (_) {} channel = null }
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
      if (channel) { try { supabase.removeChannel(channel) } catch (_) {} channel = null }
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
        <Route path="/cotacao/:token" element={<CotacaoPublica />} />
        <Route path="/aprovar/:token" element={<AprovarPublica />} />
        <Route path="/lote/:token" element={<LoteAprovacaoPublica />} />
        <Route path="/refeicao/:token" element={<RefeicaoPublica />} />
        <Route path="/refeicao/validar/:token" element={<RefeicaoValidar />} />
        <Route path="/ar/:token" element={<RefeicaoAprovar />} />
        <Route path="/confirmar-restaurante/:token" element={<RefeicaoConfirmarRestaurante />} />
        <Route path="/*" element={
          <RequireAuth>
            <RequireSubscription>
            <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>
              <ModuloGuard />
              <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
              <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <Routes>
                  <Route path="/" element={<DefaultRoute />} />
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
                  <Route path="/prospectar" element={<Navigate to="/prospectar/dashboard" replace />} />
                  <Route path="/prospectar/dashboard" element={<ProspectarDashboard />} />
                  <Route path="/prospectar/buscar" element={<ProspectarClientes />} />
                  <Route path="/prospectar/contratos" element={<ProspectarContratos />} />
                  <Route path="/prospectar/relatorios" element={<ProspectarRelatorios />} />
                  <Route path="/proventos" element={<Proventos />} />
                  <Route path="/importar" element={<Importar />} />
                  <Route path="/escanear" element={<EscanearRecibo />} />
                  <Route path="/notas-fiscais" element={<NotasFiscais />} />
                  <Route path="/lancamentos" element={<Lancamentos />} />
                  <Route path="/cadastros" element={<Cadastros />} />
                  <Route path="/lotes-cliente" element={<LotesCliente />} />
                  <Route path="/form-templates" element={<FormTemplates />} />
                  <Route path="/faturamento" element={<Faturamento />} />
                  <Route path="/pagamentos" element={<Pagamentos />} />
                  <Route path="/contas-pagar" element={<ContasPagar />} />
                  <Route path="/central" element={<CentralGerencial />} />
                  <Route path="/flow-center" element={<FlowCenter />} />
                  <Route path="/flow-lab" element={<FlowLab />} />
                  <Route path="/simulacao-fluxo" element={<SimulacaoFluxo />} />
                  <Route path="/acessos" element={<RequireEmpresaAdmin><Acessos /></RequireEmpresaAdmin>} />
                  <Route path="/admin" element={<RequireAdmin><AdminPanel /></RequireAdmin>} />
                  <Route path="/admin/:section" element={<RequireAdmin><AdminPanel /></RequireAdmin>} />
                  <Route path="/plataforma/empresas" element={<RequireAdmin><PlataformaEmpresas /></RequireAdmin>} />
                  <Route path="/plataforma/modulos" element={<RequireAdmin><PlataformaModulos /></RequireAdmin>} />
                  <Route path="/plataforma/auditoria" element={<RequireAdmin><PlataformaAuditoria /></RequireAdmin>} />
                  <Route path="/compras" element={<ComprasWorkspace />} />
                  <Route path="/compras/dashboard" element={<ComprasDashboard />} />
                  <Route path="/compras/operacoes/requisicoes" element={<Compras />} />
                  <Route path="/compras/operacoes/cotacoes" element={<RequirePermissao modulo="compras" acao="cotar"><ComprasCotacoes /></RequirePermissao>} />
                  <Route path="/compras/operacoes/aprovacoes" element={<RequirePermissao modulo="compras" acao="aprovar"><ComprasAprovar /></RequirePermissao>} />
                  <Route path="/compras/aprovar" element={<RequirePermissao modulo="compras" acao="aprovar"><ComprasAprovar /></RequirePermissao>} />
                  <Route path="/compras/operacoes/recebimento" element={<RequirePermissao modulo="compras" acao="receber"><ComprasRecebimento /></RequirePermissao>} />
                  <Route path="/compras/pedidos" element={<ComprasPedidos />} />
                  <Route path="/compras/cadastros/catalogo" element={<ComprasCatalogo />} />
                  <Route path="/compras/cadastros/fornecedores" element={<ComprasFornecedores />} />
                  <Route path="/compras/cadastros/categorias" element={<ComprasCategorias />} />
                  <Route path="/compras/cadastros/buscar" element={<ComprasBuscaFornecedor />} />
                  <Route path="/compras/buscar-fornecedor" element={<ComprasBuscaFornecedor />} />
                  <Route path="/compras/pesquisa-precos" element={<ComprasPesquisaPrecos />} />
                  <Route path="/compras/parametros" element={<RequirePermissao modulo="compras" acao="parametros"><ComprasParametros /></RequirePermissao>} />
                  <Route path="/compras/relatorios/economia" element={<ComprasRelEconomia />} />
                  <Route path="/compras/relatorios/categoria" element={<ComprasRelCategoria />} />
                  <Route path="/compras/relatorios/fornecedor" element={<ComprasRelFornecedor />} />
                  <Route path="/refeicoes" element={<Refeicoes />} />
                  <Route path="/refeicoes/cadastros/restaurantes" element={<Refeicoes />} />
                  <Route path="/refeicoes/cadastros/precos" element={<Refeicoes />} />
                  <Route path="/refeicoes/cadastros/equipes" element={<Refeicoes />} />
                  <Route path="/refeicoes/cadastros/colaboradores" element={<Refeicoes />} />
                  <Route path="/refeicoes/cadastros/cdc" element={<Refeicoes />} />
                  <Route path="/refeicoes/cadastros/regionais" element={<Refeicoes />} />
                  <Route path="/refeicoes/cadastros/parametros" element={<Refeicoes />} />
                  <Route path="/refeicoes/operacoes/solicitacoes" element={<Refeicoes />} />
                  <Route path="/refeicoes/operacoes/aprovacoes" element={<RequirePermissao modulo="refeicoes" acao="aprovar"><Refeicoes /></RequirePermissao>} />
                  <Route path="/refeicoes/operacoes/fechamentos" element={<RequirePermissao modulo="refeicoes" acao="fechar"><Refeicoes /></RequirePermissao>} />
                  <Route path="/refeicoes/relatorios/rel-equipe" element={<Refeicoes />} />
                  <Route path="/refeicoes/relatorios/rel-restaurante" element={<Refeicoes />} />
                  <Route path="/refeicoes/relatorios/rel-cdc" element={<Refeicoes />} />
                  <Route path="/refeicoes/relatorios/rel-divergencias" element={<Refeicoes />} />
                  <Route path="/lider" element={<Navigate to="/lider/dashboard" replace />} />
                  <Route path="/lider/dashboard" element={<LiderDashboard />} />
                  <Route path="/lider/admin" element={<SmartLiderAdmin />} />
                  <Route path="/lider/turnos" element={<LiderTurnos />} />
                  <Route path="/lider/apontamentos" element={<LiderApontamentos />} />
                  <Route path="/lider/epi/solicitacoes" element={<LiderEpi />} />
                  <Route path="/lider/epi/catalogo" element={<LiderEpi />} />
                  <Route path="/lider/insumo/solicitacoes" element={<LiderInsumo />} />
                  <Route path="/lider/epc/catalogo" element={<LiderEpi />} />
                  <Route path="/lider/cadastros" element={<Navigate to="/lider/cadastros/frentes" replace />} />
                  <Route path="/lider/cadastros/frentes" element={<LiderCadastroFrentes />} />
                  <Route path="/lider/cadastros/equipes" element={<LiderCadastroEquipes />} />
                  <Route path="/lider/cadastros/colaboradores" element={<LiderCadastroColaboradores />} />
                  <Route path="/lider/cadastros/maquinas" element={<LiderCadastroMaquinas />} />
                  <Route path="/lider/cadastros/implementos" element={<LiderCadastroImplementos />} />
                  <Route path="/lider/cadastros/produtos" element={<LiderCadastroProdutos />} />
                  <Route path="/lider/cadastros/epis" element={<LiderCadastroEpis />} />
                  <Route path="/manutencao" element={<Navigate to="/manutencao/dashboard" replace />} />
                  <Route path="/manutencao/dashboard" element={<ManutencaoDashboard />} />
                  <Route path="/manutencao/operacoes/os" element={<ManutencaoOS />} />
                  <Route path="/manutencao/operacoes/preventiva" element={<ManutencaoPreventiva />} />
                  <Route path="/manutencao/cadastros/equipamentos" element={<ManutencaoEquipamentos />} />
                  <Route path="/manutencao/cadastros/tecnicos" element={<ManutencaoEquipamentos />} />
                  <Route path="/manutencao/api-planos" element={<ManutencaoAPIPlanos />} />
                  <Route path="/manutencao/planos-pfd" element={<ManutencaoPlanosPFD />} />
                  <Route path="/agenda-servicos" element={<AgendaServicos />} />
                  <Route path="/mapa-maquina" element={<MapaApontamentoMaquina />} />
                  <Route path="/maquinas/dashboard" element={<MaquinasDashboard />} />
                  <Route path="/maquinas/pendencias" element={<BoletinsPendencias />} />
                  <Route path="/gerencial/boletins-diarios" element={<BoletinsDiarios />} />
                </Routes>
              </main>
            </div>
            {(enabledModules === null || enabledModules?.includes('chat_ia')) && <ChatIA />}
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

