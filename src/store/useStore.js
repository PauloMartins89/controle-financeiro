import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

const uuid = () => crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))

// Garante que o valor é um UUID válido (evita FK violations no Supabase)
const isUUID = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

// ─── Demo data (used when Supabase is not configured) ────────────────────────
// Camila Fernanda é a dona do sistema (owner): toda despesa importada é paga por ela
// e pode receber atribuição parcial/total para outras pessoas.
const OWNER_ID = 'owner-camila'
const demoPeople = [
  { id: OWNER_ID, nome: 'Camila Fernanda', apelido: 'Camila', cor: '#a855f7', avatar: 'C', is_owner: true },
  { id: '1', nome: 'Paulo', apelido: 'Paulo', cor: '#6366f1', avatar: 'P' },
  { id: '2', nome: 'Maria', apelido: 'Maria', cor: '#ec4899', avatar: 'M' },
  { id: '3', nome: 'João',  apelido: 'João',  cor: '#10b981', avatar: 'J' },
  { id: '4', nome: 'Ana',   apelido: 'Ana',   cor: '#f59e0b', avatar: 'A' },
]

const demoGroups = [
  { id: '1', nome: 'Casa', cor: '#6366f1', icone: '🏠' },
  { id: '2', nome: 'Viagem Praia', cor: '#10b981', icone: '🏖️' },
  { id: '3', nome: 'Cartão Nubank', cor: '#8b5cf6', icone: '💳' },
  { id: '4', nome: 'Churrasco', cor: '#ef4444', icone: '🥩' },
]

const demoExpenses = [
  {
    id: '1', descricao: 'Aluguel Maio', valor: 2400, data: '2026-05-01',
    categoria: 'Moradia', grupo_id: '1', pago_por: '1',
    participantes: ['1','2','3'], tipo_divisao: 'igual', parcelas: 1,
    parcela_atual: 1, recorrente: true, status: 'pendente', observacoes: ''
  },
  {
    id: '2', descricao: 'Supermercado', valor: 380, data: '2026-05-05',
    categoria: 'Alimentação', grupo_id: '1', pago_por: '2',
    participantes: ['1','2'], tipo_divisao: 'igual', parcelas: 1,
    parcela_atual: 1, recorrente: false, status: 'pendente', observacoes: ''
  },
  {
    id: '3', descricao: 'Passagem aérea', valor: 1560, data: '2026-04-20',
    categoria: 'Viagem', grupo_id: '2', pago_por: '1',
    participantes: ['1','2','3','4'], tipo_divisao: 'igual', parcelas: 3,
    parcela_atual: 1, recorrente: false, status: 'pendente', observacoes: 'Voo Gol GRU→SSA'
  },
  {
    id: '4', descricao: 'Internet', valor: 120, data: '2026-05-10',
    categoria: 'Serviços', grupo_id: '1', pago_por: '1',
    participantes: ['1','2'], tipo_divisao: 'igual', parcelas: 1,
    parcela_atual: 1, recorrente: true, status: 'pago', observacoes: ''
  },
  {
    id: '5', descricao: 'TV + Streaming', valor: 90, data: '2026-05-08',
    categoria: 'Entretenimento', grupo_id: '1', pago_por: '2',
    participantes: ['1','2','3'], tipo_divisao: 'igual', parcelas: 1,
    parcela_atual: 1, recorrente: true, status: 'pendente', observacoes: ''
  },
  {
    id: '6', descricao: 'Churrasqueira', valor: 450, data: '2026-05-09',
    categoria: 'Lazer', grupo_id: '4', pago_por: '3',
    participantes: ['1','2','3','4'], tipo_divisao: 'igual', parcelas: 1,
    parcela_atual: 1, recorrente: false, status: 'pendente', observacoes: ''
  },
]

const demoCards = [
  { id: '1', nome: 'Nubank', bandeira: 'Mastercard', limite: 8000, dia_fechamento: 15, dia_vencimento: 22, cor: '#8b5cf6' },
  { id: '2', nome: 'Itaú', bandeira: 'Visa', limite: 5000, dia_fechamento: 5, dia_vencimento: 12, cor: '#ef4444' },
]

// Veículos: usados para direcionar débitos do Sem Parar à pessoa correta
const demoVehicles = [
  // { id: 'v1', placa: 'BZF5H49', apelido: 'Carro Camila', pessoa_id: OWNER_ID, cor: '#a855f7' },
]

// Fechamentos mensais (snapshots) - histórico congélado por mês
const demoClosures = []

const demoRecurring = [
  { id: '1', descricao: 'Aluguel', valor: 2400, dia_vencimento: 5, categoria: 'Moradia', grupo_id: '1', ativo: true },
  { id: '2', descricao: 'Internet', valor: 120, dia_vencimento: 10, categoria: 'Serviços', grupo_id: '1', ativo: true },
  { id: '3', descricao: 'Netflix', valor: 45, dia_vencimento: 18, categoria: 'Entretenimento', grupo_id: '1', ativo: true },
  { id: '4', descricao: 'Academia', valor: 100, dia_vencimento: 1, categoria: 'Saúde', grupo_id: null, ativo: true },
]

const demoNegocios = [
  {
    id: 'n1', nome: 'Loja Online', descricao: 'E-commerce de produtos eletrônicos',
    cor: '#6366f1', icone: '🛒', ativo: true, tipo: 'empresa',
    socios: [{ pessoa_id: '1', percentual: 60 }, { pessoa_id: '2', percentual: 40 }],
  },
  {
    id: 'n2', nome: 'Restaurante', descricao: 'Restaurante no centro da cidade',
    cor: '#f59e0b', icone: '🍽️', ativo: true, tipo: 'empresa',
    socios: [{ pessoa_id: '1', percentual: 50 }, { pessoa_id: '2', percentual: 50 }],
  },
  {
    id: 'n3', nome: 'App SaaS', descricao: 'Plataforma de software por assinatura',
    cor: '#10b981', icone: '💻', ativo: true, tipo: 'freelance',
    socios: [{ pessoa_id: '1', percentual: 70 }, { pessoa_id: '3', percentual: 30 }],
  },
]

const demoProventos = [
  {
    id: 'p1', negocio_id: 'n1', descricao: 'Receita de vendas — Abril',
    valor: 18500, data: '2026-04-30', categoria: 'Receita de Vendas',
    tipo: 'receita', status: 'distribuido', observacoes: '450 pedidos no mês',
  },
  {
    id: 'p2', negocio_id: 'n1', descricao: 'Receita de vendas — Maio',
    valor: 21200, data: '2026-05-10', categoria: 'Receita de Vendas',
    tipo: 'receita', status: 'pendente', observacoes: '',
  },
  {
    id: 'p3', negocio_id: 'n2', descricao: 'Lucro líquido — Abril',
    valor: 8400, data: '2026-04-30', categoria: 'Lucro',
    tipo: 'distribuicao', status: 'distribuido', observacoes: 'Após despesas operacionais',
  },
  {
    id: 'p4', negocio_id: 'n2', descricao: 'Pró-labore Maio',
    valor: 4000, data: '2026-05-05', categoria: 'Pró-labore',
    tipo: 'pro_labore', status: 'pago', observacoes: '',
  },
  {
    id: 'p5', negocio_id: 'n3', descricao: 'MRR — Maio',
    valor: 12800, data: '2026-05-01', categoria: 'Assinaturas',
    tipo: 'receita', status: 'pendente', observacoes: '64 clientes ativos',
  },
  {
    id: 'p6', negocio_id: 'n3', descricao: 'Dividendos Q1',
    valor: 9600, data: '2026-03-31', categoria: 'Dividendos',
    tipo: 'distribuicao', status: 'distribuido', observacoes: '',
  },
]


// ─── Balance calculation ──────────────────────────────────────────────────────
export function calcularSaldos(expenses, people) {
  // Map personId → net balance (positive = receives, negative = owes)
  const balances = {}
  people.forEach(p => { balances[p.id] = 0 })

  expenses.forEach(exp => {
    if (exp.status === 'pago') return
    const { valor, pago_por, participantes, tipo_divisao, parcelas } = exp
    if (!participantes || participantes.length === 0) return

    const valorParcela = valor / (parcelas || 1)

    let partes = {}
    if (tipo_divisao === 'igual') {
      const share = valorParcela / participantes.length
      participantes.forEach(pid => { partes[pid] = share })
    } else if (tipo_divisao === 'porcentagem' && exp.porcentagens) {
      participantes.forEach(pid => {
        partes[pid] = (valorParcela * (exp.porcentagens[pid] || 0)) / 100
      })
    } else if (tipo_divisao === 'valor_fixo' && exp.valores_fixos) {
      participantes.forEach(pid => {
        partes[pid] = exp.valores_fixos[pid] || 0
      })
    } else {
      const share = valorParcela / participantes.length
      participantes.forEach(pid => { partes[pid] = share })
    }

    // pago_por gets credited back for what others owe
    participantes.forEach(pid => {
      if (pid === pago_por) return
      const amount = partes[pid] || 0
      // pid owes pago_por
      if (balances[pid] !== undefined) balances[pid] -= amount
      if (balances[pago_por] !== undefined) balances[pago_por] += amount
    })
  })

  return balances
}

export function calcularDebitosPorPar(expenses, people) {
  // Returns array of { de: personId, para: personId, valor }
  const pairs = {}

  expenses.forEach(exp => {
    if (exp.status === 'pago') return
    const { valor, pago_por, participantes, tipo_divisao, parcelas } = exp
    if (!participantes || participantes.length === 0) return

    const valorParcela = valor / (parcelas || 1)

    participantes.forEach(pid => {
      if (pid === pago_por) return
      let share = 0
      if (tipo_divisao === 'igual') {
        share = valorParcela / participantes.length
      } else if (tipo_divisao === 'porcentagem' && exp.porcentagens) {
        share = (valorParcela * (exp.porcentagens[pid] || 0)) / 100
      } else if (tipo_divisao === 'valor_fixo' && exp.valores_fixos) {
        share = exp.valores_fixos[pid] || 0
      } else {
        share = valorParcela / participantes.length
      }

      const key = `${pid}→${pago_por}`
      const keyInv = `${pago_por}→${pid}`
      if (pairs[key]) pairs[key] += share
      else if (pairs[keyInv]) {
        pairs[keyInv] -= share
        if (pairs[keyInv] < 0) {
          pairs[key] = -pairs[keyInv]
          delete pairs[keyInv]
        }
      } else {
        pairs[key] = share
      }
    })
  })

  return Object.entries(pairs)
    .filter(([, v]) => v > 0.005)
    .map(([key, valor]) => {
      const [de, para] = key.split('→')
      return { de, para, valor }
    })
    .sort((a, b) => b.valor - a.valor)
}

// ─── Store ────────────────────────────────────────────────────────────────────
const useStore = create(
  persist(
    (set, get) => ({
  // State
  people: demoPeople,
  groups: demoGroups,
  expenses: demoExpenses,
  cards: demoCards,
  vehicles: demoVehicles,
  closures: demoClosures,
  recurring: demoRecurring,
  negocios: demoNegocios,
  proventos: demoProventos,
  loading: false,
  useSupabase: !!supabase,
  currentUser: demoPeople[0],
  authUserName: null,
  saldoCaixa: 0,
  ownerId: OWNER_ID,
  workspaceId: null,
  enabledModules: null, // null = sem restrição; array = lista de moduleKeys DESABILITADOS (blacklist)
  isPlatformAdmin: false, // true se o usuário logado está na tabela platform_admins
  permissoes: ['*'], // ['*'] = acesso total; array de 'modulo.acao' quando tem perfil restrito

  // Verifica se o usuário tem permissão para modulo+acao
  // ['*'] = admin total (platform admin ou empresa admin sem perfil)
  pode: (modulo, acao) => {
    const { isPlatformAdmin, permissoes } = get()
    if (isPlatformAdmin) return true
    if (permissoes.includes('*')) return true
    return permissoes.includes(`${modulo}.${acao}`)
  },

  setCurrentUser: (person) => set({ currentUser: person }),
  setOwnerId: async (id) => {
    // Garante exclusividade: só uma pessoa pode ser is_owner = true
    if (supabase) {
      // Remove flag de todos, depois marca o selecionado
      await supabase.from('pessoas').update({ is_owner: false }).neq('id', id)
      if (isUUID(id)) await supabase.from('pessoas').update({ is_owner: true }).eq('id', id)
    }
    set(s => ({
      ownerId: id,
      currentUser: s.people.find(p => p.id === id) || s.currentUser,
      people: s.people.map(p => ({ ...p, is_owner: p.id === id }))
    }))
  },
  getOwner: () => {
    const s = get()
    return s.people.find(p => p.id === s.ownerId) || s.people.find(p => p.is_owner) || s.people[0]
  },

  setSaldoCaixa: async (valor) => {
    const v = parseFloat(valor) || 0
    set({ saldoCaixa: v })
    if (supabase) {
      const { workspaceId } = get()
      await supabase.from('configuracoes').upsert(
        { chave: 'saldoCaixa', valor: v, updated_at: new Date().toISOString(), workspace_id: workspaceId },
        { onConflict: 'workspace_id,chave' }
      )
    }
  },

  pagarFaturaCartao: async (cardId) => {
    const ids = get().expenses.filter(e => e.card_id === cardId && e.status !== 'pago').map(e => e.id)
    const uuidIds = ids.filter(isUUID)
    if (supabase && uuidIds.length > 0) {
      await supabase.from('despesas').update({ status: 'pago' }).in('id', uuidIds)
    }
    set(s => ({
      expenses: s.expenses.map(e =>
        e.card_id === cardId && e.status !== 'pago'
          ? { ...e, status: 'pago' }
          : e
      )
    }))
  },

  pagarContaRecorrente: async (recurringId) => {
    const r = get().recurring.find(x => x.id === recurringId)
    if (!r) return
    const mes = new Date().toISOString().slice(0, 7)
    const pagosMeses = r.pagos_meses || []
    if (pagosMeses.includes(mes)) return
    const novosPagos = [...pagosMeses, mes]
    if (supabase && isUUID(recurringId)) await supabase.from('recorrentes').update({ pagos_meses: novosPagos }).eq('id', recurringId)
    set(s => ({
      recurring: s.recurring.map(x =>
        x.id === recurringId ? { ...x, pagos_meses: novosPagos } : x
      )
    }))
  },

  isPagaEsseMes: (recurringId) => {
    const r = get().recurring.find(x => x.id === recurringId)
    if (!r) return false
    const mes = new Date().toISOString().slice(0, 7)
    return (r.pagos_meses || []).includes(mes)
  },

  // ── People ──
  addPerson: async (person) => {
    const newPerson = { ...person, id: uuid(), avatar: person.nome[0].toUpperCase() }
    if (supabase) {
      const { data, error } = await supabase.from('pessoas').insert([{ id: newPerson.id, nome: newPerson.nome, apelido: newPerson.apelido, cor: newPerson.cor, avatar: person.avatar || null, telefone: person.telefone || null, is_owner: newPerson.is_owner || false }]).select().single()
      if (error) console.error('[Supabase] addPerson error:', error.message)
      if (!error && data) { set(s => ({ people: [...s.people, { ...newPerson, ...data }] })); return }
    }
    set(s => ({ people: [...s.people, newPerson] }))
  },
  updatePerson: async (id, data) => {
    if (supabase && isUUID(id)) {
      await supabase.from('pessoas').update(data).eq('id', id)
      // Sincroniza canal do WhatsApp se o telefone mudou
      if (data.telefone !== undefined) {
        const tel = data.telefone?.replace(/\D/g, '') || null
        // Remove canais antigos dessa pessoa
        await supabase.from('canais_mensagem').delete().eq('pessoa_id', id)
        // Cria novo canal se tem telefone
        if (tel) {
          const pessoa = useStore.getState().people.find(p => p.id === id)
          await supabase.from('canais_mensagem').upsert(
            { telefone: tel, pessoa_id: id, owner_id: pessoa?.owner_id || null, ativo: true },
            { onConflict: 'telefone' }
          )
        }
      }
    }
    set(s => ({ people: s.people.map(p => p.id === id ? { ...p, ...data } : p) }))
  },
  deletePerson: async (id) => {
    if (supabase && isUUID(id)) await supabase.from('pessoas').delete().eq('id', id)
    set(s => ({ people: s.people.filter(p => p.id !== id) }))
  },

  // ── Groups ──
  addGroup: async (group) => {
    const newGroup = { ...group, id: uuid() }
    if (supabase) {
      const { data, error } = await supabase.from('grupos').insert([{ id: newGroup.id, nome: newGroup.nome, cor: newGroup.cor, icone: newGroup.icone, descricao: newGroup.descricao }]).select().single()
      if (!error && data) { set(s => ({ groups: [...s.groups, { ...newGroup, ...data }] })); return }
    }
    set(s => ({ groups: [...s.groups, newGroup] }))
  },
  updateGroup: async (id, data) => {
    if (supabase && isUUID(id)) await supabase.from('grupos').update(data).eq('id', id)
    set(s => ({ groups: s.groups.map(g => g.id === id ? { ...g, ...data } : g) }))
  },
  deleteGroup: async (id) => {
    if (supabase && isUUID(id)) await supabase.from('grupos').delete().eq('id', id)
    set(s => ({ groups: s.groups.filter(g => g.id !== id) }))
  },

  // ── Expenses ──
  addExpense: async (expense) => {
    const newExp = { ...expense, id: uuid() }
    if (supabase) {
      // Sanitiza campos UUID: IDs de demo (não-UUID) são convertidos para null
      // para evitar FK violation / erro de tipo no Supabase
      const row = {
        id: newExp.id,
        descricao: newExp.descricao,
        valor: newExp.valor,
        data: newExp.data,
        categoria: newExp.categoria,
        grupo_id: isUUID(newExp.grupo_id) ? newExp.grupo_id : null,
        pago_por: isUUID(newExp.pago_por) ? newExp.pago_por : null,
        participantes: (newExp.participantes || []).filter(isUUID),
        tipo_divisao: newExp.tipo_divisao || 'igual',
        porcentagens: newExp.porcentagens || {},
        valores_fixos: newExp.valores_fixos || {},
        parcelas: newExp.parcelas || 1,
        parcela_atual: newExp.parcela_atual || 1,
        recorrente: newExp.recorrente || false,
        status: newExp.status || 'pendente',
        observacoes: newExp.observacoes || newExp.notas || null,
        card_id: isUUID(newExp.card_id) ? newExp.card_id : null,
        valor_total: newExp.valor_total ?? null,
        lote_parcelamento: newExp.lote_parcelamento || null,
        veiculo_placa: newExp._veiculo || newExp.veiculo_placa || null,
        conta: newExp.conta || null,
      }
      const { data, error } = await supabase.from('despesas').insert([row]).select().single()
      if (error) console.error('[Supabase] addExpense error:', error.message, row)
      if (!error && data) {
        // Mantém _veiculo no estado local em sincronia com veiculo_placa
        const merged = { ...newExp, ...data, _veiculo: data.veiculo_placa || newExp._veiculo || null }
        set(s => ({ expenses: [...s.expenses, merged] }))
        return
      }
    }
    set(s => ({ expenses: [...s.expenses, newExp] }))
  },
  updateExpense: async (id, data) => {
    if (supabase && isUUID(id)) {
      // Sanitiza payload: filtra apenas colunas conhecidas e converte IDs inválidos para null
      const allowed = ['descricao','valor','data','categoria','tipo_divisao','porcentagens','valores_fixos','parcelas','parcela_atual','recorrente','status','observacoes','valor_total','lote_parcelamento','conta']
      const payload = {}
      for (const k of allowed) if (k in data) payload[k] = data[k]
      if ('grupo_id' in data) payload.grupo_id = isUUID(data.grupo_id) ? data.grupo_id : null
      if ('pago_por' in data) payload.pago_por = isUUID(data.pago_por) ? data.pago_por : null
      if ('card_id'  in data) payload.card_id  = isUUID(data.card_id)  ? data.card_id  : null
      if ('participantes' in data) payload.participantes = (data.participantes || []).filter(isUUID)
      if ('_veiculo' in data || 'veiculo_placa' in data) payload.veiculo_placa = data._veiculo || data.veiculo_placa || null
      if (Object.keys(payload).length > 0) {
        const { error } = await supabase.from('despesas').update(payload).eq('id', id)
        if (error) console.error('[Supabase] updateExpense error:', error.message, payload)
      }
    }
    set(s => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, ...data } : e) }))
  },
  deleteExpense: async (id) => {
    if (supabase && isUUID(id)) await supabase.from('despesas').delete().eq('id', id)
    set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }))
  },
  markAsPaid: async (id) => {
    if (supabase && isUUID(id)) await supabase.from('despesas').update({ status: 'pago' }).eq('id', id)
    set(s => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, status: 'pago' } : e) }))
  },
  markAsPending: async (id) => {
    if (supabase && isUUID(id)) await supabase.from('despesas').update({ status: 'pendente' }).eq('id', id)
    set(s => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, status: 'pendente' } : e) }))
  },

  // Limpa participantes "fantasma" (entradas de valor 0 em valores_fixos)
  // herdadas de imports antigos. Aplica apenas em despesas valor_fixo.
  // Retorna a quantidade de despesas afetadas.
  limparParticipantesZerados: () => {
    let afetadas = 0
    set(s => ({
      expenses: s.expenses.map(e => {
        if (e.tipo_divisao !== 'valor_fixo' || !e.valores_fixos) return e
        const novosValores = {}
        Object.entries(e.valores_fixos).forEach(([pid, v]) => {
          if ((parseFloat(v) || 0) > 0.005) novosValores[pid] = v
        })
        const novosParticipantes = Object.keys(novosValores)
        const mudou =
          novosParticipantes.length !== (e.participantes?.length || 0) ||
          Object.keys(e.valores_fixos).length !== novosParticipantes.length
        if (!mudou) return e
        afetadas++
        return { ...e, participantes: novosParticipantes, valores_fixos: novosValores }
      })
    }))
    return afetadas
  },

  // ── Cards ──
  addCard: async (card) => {
    const newCard = { ...card, id: uuid() }
    if (supabase) {
      const row = { id: newCard.id, nome: newCard.nome, bandeira: newCard.bandeira, limite: newCard.limite || 0, dia_fechamento: newCard.dia_fechamento || 15, dia_vencimento: newCard.dia_vencimento || 22, cor: newCard.cor || '#6366f1' }
      const { data, error } = await supabase.from('cartoes').insert([row]).select().single()
      if (!error && data) { set(s => ({ cards: [...s.cards, { ...newCard, ...data }] })); return }
    }
    set(s => ({ cards: [...s.cards, newCard] }))
  },
  updateCard: async (id, data) => {
    if (supabase && isUUID(id)) await supabase.from('cartoes').update(data).eq('id', id)
    set(s => ({ cards: s.cards.map(c => c.id === id ? { ...c, ...data } : c) }))
  },
  deleteCard: async (id) => {
    if (supabase && isUUID(id)) await supabase.from('cartoes').delete().eq('id', id)
    set(s => ({ cards: s.cards.filter(c => c.id !== id) }))
  },

  // ── Vehicles ──
  addVehicle: async (vehicle) => {
    const v = {
      ...vehicle,
      placa: String(vehicle.placa || '').toUpperCase().replace(/\s+/g, ''),
      id: `veh_${Date.now()}`,
    }
    if (supabase) {
      const row = { id: v.id, placa: v.placa, apelido: v.apelido || null, pessoa_id: v.pessoa_id || null, cor: v.cor || '#6366f1' }
      const { data, error } = await supabase.from('veiculos').insert([row]).select().single()
      if (error) console.error('[Supabase] addVehicle error:', error.message)
      if (!error && data) { set(s => ({ vehicles: [...s.vehicles, { ...v, ...data }] })); if (window.loadAppData) window.loadAppData(); return }
    }
    set(s => ({ vehicles: [...s.vehicles, v] }))
    if (window.loadAppData) window.loadAppData();
  },
  updateVehicle: async (id, data) => {
    const patch = { ...data }
    if (patch.placa) patch.placa = String(patch.placa).toUpperCase().replace(/\s+/g, '')
    if ('pessoa_id' in patch && (patch.pessoa_id === '' || patch.pessoa_id === undefined)) patch.pessoa_id = null
    if (supabase) await supabase.from('veiculos').update(patch).eq('id', id)
    set(s => ({ vehicles: s.vehicles.map(v => v.id === id ? { ...v, ...patch } : v) }))
    if (window.loadAppData) window.loadAppData();
  },
  deleteVehicle: async (id) => {
    if (supabase) await supabase.from('veiculos').delete().eq('id', id)
    set(s => ({ vehicles: s.vehicles.filter(v => v.id !== id) }))
    if (window.loadAppData) window.loadAppData();
  },
  getVehicleByPlate: (placa) => {
    if (!placa) return null
    const norm = String(placa).toUpperCase().replace(/\s+/g, '')
    return get().vehicles.find(v => v.placa === norm) || null
  },

  // ── Closures (Fechamento Mensal) ─────────────────────────────────────────
  // Computa um snapshot agregado do mês informado (YYYY-MM), arquiva
  // e LIBERA os cartões marcando todas as despesas do mês como pagas.
  // O status anterior de cada despesa é guardado no snapshot para permitir
  // reabrir o mês e reverter os pagamentos automáticos.
  fecharMes: async (mes) => {
    const s = get()
    const targetMes = mes || new Date().toISOString().slice(0, 7)
    const expensesDoMes = s.expenses.filter(e => (e.data || '').startsWith(targetMes))
    if (expensesDoMes.length === 0) return null

    let total = 0, total_pago = 0, total_pendente = 0
    const por_categoria = {}
    const por_pessoa = {}      // quem pagou
    const por_grupo = {}
    const por_veiculo = {}
    const por_cartao = {}      // total da fatura por card_id
    const cartoes_liberados = new Set()
    const expensesAlteradas = []  // [{ id, status_anterior }] para reverter no reabrir
    for (const e of expensesDoMes) {
      total += e.valor
      if (e.status === 'pago') total_pago += e.valor
      else {
        total_pendente += e.valor
        expensesAlteradas.push({ id: e.id, status_anterior: e.status })
      }
      por_categoria[e.categoria || 'Outros'] = (por_categoria[e.categoria || 'Outros'] || 0) + e.valor
      if (e.pago_por) por_pessoa[e.pago_por] = (por_pessoa[e.pago_por] || 0) + e.valor
      if (e.grupo_id) por_grupo[e.grupo_id] = (por_grupo[e.grupo_id] || 0) + e.valor
      if (e._veiculo) por_veiculo[e._veiculo] = (por_veiculo[e._veiculo] || 0) + e.valor
      if (e.card_id) {
        por_cartao[e.card_id] = (por_cartao[e.card_id] || 0) + e.valor
        cartoes_liberados.add(e.card_id)
      }
    }
    const snapshot = {
      id: `cl_${Date.now()}`,
      mes: targetMes,
      data_fechamento: new Date().toISOString(),
      qtd_despesas: expensesDoMes.length,
      total,
      total_pago,
      total_pendente,
      por_categoria,
      por_pessoa,
      por_grupo,
      por_veiculo,
      por_cartao,
      cartoes_liberados: Array.from(cartoes_liberados),
      expenses_alteradas: expensesAlteradas,
      ticket_medio: expensesDoMes.length ? total / expensesDoMes.length : 0,
    }
    // Substitui se já existe fechamento para o mesmo mês + libera cartões
    const idsParaPagar = new Set(expensesAlteradas.map(x => x.id))
    if (supabase) {
      // Persiste o snapshot e marca despesas como pagas no banco
      await supabase.from('closures').upsert(snapshot, { onConflict: 'user_id,mes' })
      if (idsParaPagar.size > 0) {
        await supabase.from('despesas').update({ status: 'pago' }).in('id', Array.from(idsParaPagar))
      }
    }
    set(st => ({
      closures: [...st.closures.filter(c => c.mes !== targetMes), snapshot]
        .sort((a, b) => a.mes.localeCompare(b.mes)),
      expenses: st.expenses.map(e => idsParaPagar.has(e.id) ? { ...e, status: 'pago' } : e),
    }))
    return snapshot
  },
  reabrirMes: async (mes) => {
    const s = get()
    const closure = s.closures.find(c => c.mes === mes)
    if (!closure) return
    // Reverte status de cada despesa alterada no fechamento
    const revertMap = new Map((closure.expenses_alteradas || []).map(x => [x.id, x.status_anterior]))
    if (supabase) {
      await supabase.from('closures').delete().eq('mes', mes)
      // Reverte status individualmente (status_anterior pode ser diferente para cada uma)
      const grupos = {}
      revertMap.forEach((status, id) => {
        if (!grupos[status]) grupos[status] = []
        grupos[status].push(id)
      })
      for (const [status, ids] of Object.entries(grupos)) {
        if (ids.length > 0) await supabase.from('despesas').update({ status }).in('id', ids)
      }
    }
    set(st => ({
      closures: st.closures.filter(c => c.mes !== mes),
      expenses: st.expenses.map(e => revertMap.has(e.id) ? { ...e, status: revertMap.get(e.id) } : e),
    }))
  },
  getClosureByMes: (mes) => get().closures.find(c => c.mes === mes) || null,

  // ── Recurring ──
  addRecurring: async (item) => {
    const newItem = { ...item, id: uuid(), grupo_id: isUUID(item.grupo_id) ? item.grupo_id : null }
    if (supabase) {
      const row = { id: newItem.id, descricao: newItem.descricao, valor: newItem.valor, dia_vencimento: newItem.dia_vencimento || 5, categoria: newItem.categoria || 'Serviços', grupo_id: newItem.grupo_id, ativo: newItem.ativo !== false, pagos_meses: newItem.pagos_meses || [] }
      const { data, error } = await supabase.from('recorrentes').insert([row]).select().single()
      if (error) console.error('[Supabase] addRecurring error:', error.message)
      if (!error && data) { set(s => ({ recurring: [...s.recurring, { ...newItem, ...data }] })); return }
    }
    set(s => ({ recurring: [...s.recurring, newItem] }))
  },
  updateRecurring: async (id, data) => {
    const patch = { ...data }
    if ('grupo_id' in patch) patch.grupo_id = isUUID(patch.grupo_id) ? patch.grupo_id : null
    if (supabase && isUUID(id)) await supabase.from('recorrentes').update(patch).eq('id', id)
    set(s => ({ recurring: s.recurring.map(r => r.id === id ? { ...r, ...patch } : r) }))
  },
  deleteRecurring: async (id) => {
    if (supabase && isUUID(id)) await supabase.from('recorrentes').delete().eq('id', id)
    set(s => ({ recurring: s.recurring.filter(r => r.id !== id) }))
  },

  // ── Settlement ──
  settleDebt: async (de, para) => {
    const ids = get().expenses
      .filter(exp => exp.status !== 'pago' && exp.pago_por === para && exp.participantes?.includes(de))
      .map(exp => exp.id)
      .filter(isUUID)
    if (supabase && ids.length > 0) {
      await supabase.from('despesas').update({ status: 'pago' }).in('id', ids)
    }
    set(s => ({
      expenses: s.expenses.map(exp => {
        if (exp.status === 'pago') return exp
        if (exp.pago_por === para && exp.participantes?.includes(de)) {
          return { ...exp, status: 'pago' }
        }
        return exp
      })
    }))
  },

  // ── Negócios ──
  addNegocio: async (negocio) => {
    const n = { ...negocio, id: `n${Date.now()}` }
    if (supabase) {
      const row = { id: n.id, nome: n.nome, descricao: n.descricao || null, cor: n.cor || '#6366f1', icone: n.icone || '🏢', ativo: n.ativo !== false, tipo: n.tipo || 'empresa', socios: n.socios || [] }
      const { data, error } = await supabase.from('negocios').insert([row]).select().single()
      if (error) console.error('[Supabase] addNegocio error:', error.message)
      if (!error && data) { set(s => ({ negocios: [...s.negocios, { ...n, ...data }] })); return }
    }
    set(s => ({ negocios: [...s.negocios, n] }))
  },
  updateNegocio: async (id, data) => {
    if (supabase) await supabase.from('negocios').update(data).eq('id', id)
    set(s => ({ negocios: s.negocios.map(n => n.id === id ? { ...n, ...data } : n) }))
  },
  deleteNegocio: async (id) => {
    if (supabase) await supabase.from('negocios').delete().eq('id', id)
    set(s => ({ negocios: s.negocios.filter(n => n.id !== id) }))
  },

  // ── Proventos ──
  addProvento: async (provento) => {
    const p = { ...provento, id: `p${Date.now()}` }
    if (supabase) {
      const row = { id: p.id, negocio_id: p.negocio_id, descricao: p.descricao, valor: p.valor, data: p.data, categoria: p.categoria || 'Receita', tipo: p.tipo || 'receita', status: p.status || 'pendente', observacoes: p.observacoes || null }
      const { data, error } = await supabase.from('proventos').insert([row]).select().single()
      if (error) console.error('[Supabase] addProvento error:', error.message)
      if (!error && data) { set(s => ({ proventos: [...s.proventos, { ...p, ...data }] })); return }
    }
    set(s => ({ proventos: [...s.proventos, p] }))
  },
  updateProvento: async (id, data) => {
    if (supabase) await supabase.from('proventos').update(data).eq('id', id)
    set(s => ({ proventos: s.proventos.map(p => p.id === id ? { ...p, ...data } : p) }))
  },
  deleteProvento: async (id) => {
    if (supabase) await supabase.from('proventos').delete().eq('id', id)
    set(s => ({ proventos: s.proventos.filter(p => p.id !== id) }))
  },
  distribuirProvento: async (id) => {
    if (supabase) await supabase.from('proventos').update({ status: 'distribuido' }).eq('id', id)
    set(s => ({ proventos: s.proventos.map(p => p.id === id ? { ...p, status: 'distribuido' } : p) }))
  },

  // ── Computed – Negócios ──
  getNegocioById: (id) => get().negocios.find(n => n.id === id),

  getProventosPorNegocio: (negocioId) =>
    get().proventos.filter(p => p.negocio_id === negocioId),

  // Calculates each partner's share for a given provento
  calcularDistribuicao: (proventoId) => {
    const provento = get().proventos.find(p => p.id === proventoId)
    if (!provento) return []
    const negocio = get().negocios.find(n => n.id === provento.negocio_id)
    if (!negocio) return []
    return (negocio.socios || []).map(s => ({
      pessoa_id: s.pessoa_id,
      percentual: s.percentual,
      valor: (provento.valor * s.percentual) / 100,
    }))
  },

  // Total received by a person across all distributed proventos
  getTotalProventosPessoa: (pessoaId) => {
    const { proventos, negocios } = get()
    let total = 0
    proventos.forEach(prov => {
      if (prov.status !== 'distribuido' && prov.status !== 'pago') return
      const negocio = negocios.find(n => n.id === prov.negocio_id)
      if (!negocio) return
      const socio = negocio.socios?.find(s => s.pessoa_id === pessoaId)
      if (socio) total += (prov.valor * socio.percentual) / 100
    })
    return total
  },

  getTotalProventosPendentes: () => {
    const { proventos, negocios } = get()
    return proventos
      .filter(p => p.status === 'pendente')
      .reduce((s, p) => s + p.valor, 0)
  },

  getReceitaTotal: () =>
    get().proventos.reduce((s, p) => s + p.valor, 0),

  // ── Computed ──
  getSaldos: () => calcularSaldos(get().expenses, get().people),
  getDebitos: () => calcularDebitosPorPar(get().expenses, get().people),

  // Quem deve para a Camila (ou owner atual): { pessoa_id → { total, despesas: [...] } }
  getDevedoresParaOwner: () => {
    const { expenses, ownerId } = get()
    const devs = {}
    expenses.forEach(exp => {
      if (exp.status === 'pago') return
      if (exp.pago_por !== ownerId) return
      if (!exp.participantes || exp.participantes.length === 0) return
      const valorParcela = (exp.valor || 0) / (exp.parcelas || 1)
      exp.participantes.forEach(pid => {
        if (pid === ownerId) return
        let share = 0
        if (exp.tipo_divisao === 'igual') {
          share = valorParcela / exp.participantes.length
        } else if (exp.tipo_divisao === 'porcentagem' && exp.porcentagens) {
          share = (valorParcela * (exp.porcentagens[pid] || 0)) / 100
        } else if (exp.tipo_divisao === 'valor_fixo' && exp.valores_fixos) {
          share = exp.valores_fixos[pid] || 0
        } else {
          share = valorParcela / exp.participantes.length
        }
        if (share <= 0.005) return
        if (!devs[pid]) devs[pid] = { total: 0, despesas: [] }
        devs[pid].total += share
        devs[pid].despesas.push({ ...exp, _share: share })
      })
    })
    return devs
  },

  getPersonById: (id) => get().people.find(p => p.id === id),
  getGroupById: (id) => get().groups.find(g => g.id === id),

  getTotalPendente: () => {
    return get().expenses
      .filter(e => e.status !== 'pago')
      .reduce((sum, e) => sum + (e.valor || 0), 0)
  },

  getMinhasReceitas: () => {
    const uid = get().currentUser?.id
    const saldos = get().getSaldos()
    return saldos[uid] > 0 ? saldos[uid] : 0
  },

  getMeusDividas: () => {
    const uid = get().currentUser?.id
    const saldos = get().getSaldos()
    return saldos[uid] < 0 ? Math.abs(saldos[uid]) : 0
  },

  // Total que cabe ao usuário pagar = sua cota em cada despesa pendente (não-cartão)
  // + total das faturas de cartão (o usuário paga o banco; outros reembolsam depois).
  // BUG CORRIGIDO: antes somava o valor TOTAL de despesas que o usuário pagou,
  // em vez de apenas a cota dele. Agora sempre calcula a parte proporcional correta.
  getTotalPagar: () => {
    const s = get()
    const uid = s.currentUser?.id
    if (!uid) return 0

    // ── Cota do usuário em despesas não-cartão ──────────────────────────────
    let minhaCota = 0
    s.expenses
      .filter(e => e.status !== 'pago' && !e.card_id)
      .forEach(exp => {
        const parts = exp.participantes || []
        const envolvido = parts.includes(uid) || exp.pago_por === uid
        if (!envolvido) return

        const parcela = (exp.valor || 0) / (exp.parcelas || 1)
        let share = 0

        if (parts.length === 0) {
          // Despesa solo sem participantes: responsabilidade total do pagador
          if (exp.pago_por === uid) share = parcela
        } else if (!parts.includes(uid)) {
          // Usuário é apenas o credor (pago_por) mas não está nos participantes
          // → ele vai receber tudo de volta, sua cota real = 0
          share = 0
        } else if (exp.tipo_divisao === 'igual') {
          share = parcela / parts.length
        } else if (exp.tipo_divisao === 'porcentagem' && exp.porcentagens) {
          share = parcela * (exp.porcentagens[uid] || 0) / 100
        } else if (exp.tipo_divisao === 'valor_fixo' && exp.valores_fixos) {
          share = exp.valores_fixos[uid] || 0
        } else {
          share = parcela / parts.length
        }

        minhaCota += share
      })

    // ── Faturas de cartão (o usuário paga o banco integralmente) ───────────
    const totalFatura = s.cards.reduce((sum, c) =>
      sum + s.expenses
        .filter(e => e.card_id === c.id && e.status !== 'pago')
        .reduce((acc, e) => acc + (e.valor || 0), 0), 0)

    return minhaCota + totalFatura
  },

  // Quanto cabe a OUTRAS pessoas pagar (soma das cotas alheias em despesas pendentes)
  getTotalAlheio: () => {
    const s = get()
    const uid = s.currentUser?.id
    if (!uid) return 0

    let alheio = 0
    s.expenses
      .filter(e => e.status !== 'pago' && !e.card_id)
      .forEach(exp => {
        const parts = exp.participantes || []
        // Caso: uid é pago_por e não está nos participantes → todos os parts devem para uid
        // Caso: uid está nos participantes → iterar partes alheias
        const uidEhCredorPuro = exp.pago_por === uid && !parts.includes(uid)
        if (!uidEhCredorPuro && parts.length <= 1) return // sem rateio real
        if (!uidEhCredorPuro && !parts.includes(uid) && exp.pago_por !== uid) return // uid não envolvido
        const parcela = (exp.valor || 0) / (exp.parcelas || 1)

        if (uidEhCredorPuro) {
          // Todos os participantes devem para o uid — soma o total dos parts
          parts.forEach(pid => {
            let share = 0
            if (exp.tipo_divisao === 'igual') share = parcela / parts.length
            else if (exp.tipo_divisao === 'porcentagem' && exp.porcentagens) share = parcela * (exp.porcentagens[pid] || 0) / 100
            else if (exp.tipo_divisao === 'valor_fixo' && exp.valores_fixos) share = exp.valores_fixos[pid] || 0
            else share = parcela / parts.length
            alheio += share
          })
          return
        }

        parts.forEach(pid => {
          if (pid === uid) return
          let share = 0
          if (exp.tipo_divisao === 'igual') {
            share = parcela / parts.length
          } else if (exp.tipo_divisao === 'porcentagem' && exp.porcentagens) {
            share = parcela * (exp.porcentagens[pid] || 0) / 100
          } else if (exp.tipo_divisao === 'valor_fixo' && exp.valores_fixos) {
            share = exp.valores_fixos[pid] || 0
          } else {
            share = parcela / parts.length
          }
          alheio += share
        })
      })
    return alheio
  },
}),
{
  name: 'rateiopro-storage',
  storage: createJSONStorage(() => localStorage),
  // Only persist the data arrays and currentUser; skip computed/loading state
  partialize: (state) => ({
    // Se Supabase está ativo, não salvar no localStorage os dados que vêm do banco
    ...(supabase ? {} : {
      people:    state.people,
      groups:    state.groups,
      expenses:  state.expenses,
      cards:     state.cards,
      vehicles:  state.vehicles,
      recurring: state.recurring,
      negocios:  state.negocios,
      proventos: state.proventos,
      closures:  state.closures,
      saldoCaixa: state.saldoCaixa,
    }),
    currentUser: supabase ? null : state.currentUser,
    ownerId:     supabase ? null : state.ownerId,
  }),
}
  )
)

export default useStore
