import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

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
  saldoCaixa: 0,
  ownerId: OWNER_ID,

  setCurrentUser: (person) => set({ currentUser: person }),
  setOwnerId: (id) => set(s => ({
    ownerId: id,
    people: s.people.map(p => ({ ...p, is_owner: p.id === id }))
  })),
  getOwner: () => {
    const s = get()
    return s.people.find(p => p.id === s.ownerId) || s.people.find(p => p.is_owner) || s.people[0]
  },

  setSaldoCaixa: (valor) => set({ saldoCaixa: parseFloat(valor) || 0 }),

  pagarFaturaCartao: (cardId) => {
    set(s => ({
      expenses: s.expenses.map(e =>
        e.card_id === cardId && e.status !== 'pago'
          ? { ...e, status: 'pago' }
          : e
      )
    }))
  },

  pagarContaRecorrente: (recurringId) => {
    // Mark as paid this month by storing paid months list
    set(s => {
      const r = s.recurring.find(x => x.id === recurringId)
      if (!r) return {}
      const mes = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
      const pagosMeses = r.pagos_meses || []
      if (pagosMeses.includes(mes)) return {}
      return {
        recurring: s.recurring.map(x =>
          x.id === recurringId ? { ...x, pagos_meses: [...pagosMeses, mes] } : x
        )
      }
    })
  },

  isPagaEsseMes: (recurringId) => {
    const r = get().recurring.find(x => x.id === recurringId)
    if (!r) return false
    const mes = new Date().toISOString().slice(0, 7)
    return (r.pagos_meses || []).includes(mes)
  },

  // ── People ──
  addPerson: async (person) => {
    const newPerson = { ...person, id: Date.now().toString(), avatar: person.nome[0].toUpperCase() }
    if (supabase) {
      const { data, error } = await supabase.from('pessoas').insert([{ id: newPerson.id, nome: newPerson.nome, apelido: newPerson.apelido, cor: newPerson.cor }]).select().single()
      if (!error && data) { set(s => ({ people: [...s.people, { ...newPerson, ...data }] })); return }
    }
    set(s => ({ people: [...s.people, newPerson] }))
  },
  updatePerson: async (id, data) => {
    if (supabase) await supabase.from('pessoas').update(data).eq('id', id)
    set(s => ({ people: s.people.map(p => p.id === id ? { ...p, ...data } : p) }))
  },
  deletePerson: async (id) => {
    if (supabase) await supabase.from('pessoas').delete().eq('id', id)
    set(s => ({ people: s.people.filter(p => p.id !== id) }))
  },

  // ── Groups ──
  addGroup: async (group) => {
    const newGroup = { ...group, id: Date.now().toString() }
    if (supabase) {
      const { data, error } = await supabase.from('grupos').insert([{ id: newGroup.id, nome: newGroup.nome, cor: newGroup.cor, icone: newGroup.icone, descricao: newGroup.descricao }]).select().single()
      if (!error && data) { set(s => ({ groups: [...s.groups, { ...newGroup, ...data }] })); return }
    }
    set(s => ({ groups: [...s.groups, newGroup] }))
  },
  updateGroup: async (id, data) => {
    if (supabase) await supabase.from('grupos').update(data).eq('id', id)
    set(s => ({ groups: s.groups.map(g => g.id === id ? { ...g, ...data } : g) }))
  },
  deleteGroup: async (id) => {
    if (supabase) await supabase.from('grupos').delete().eq('id', id)
    set(s => ({ groups: s.groups.filter(g => g.id !== id) }))
  },

  // ── Expenses ──
  addExpense: async (expense) => {
    const newExp = { ...expense, id: Date.now().toString() }
    if (supabase) {
      const row = { id: newExp.id, descricao: newExp.descricao, valor: newExp.valor, data: newExp.data, categoria: newExp.categoria, grupo_id: newExp.group_id || null, pago_por: newExp.paid_by || null, participantes: newExp.participants || [], tipo_divisao: newExp.split_type || 'igual', porcentagens: newExp.percentages || {}, valores_fixos: newExp.fixed_values || {}, parcelas: newExp.installments || 1, parcela_atual: newExp.current_installment || 1, recorrente: newExp.recurring || false, status: newExp.status || 'pendente', observacoes: newExp.notes || null }
      const { data, error } = await supabase.from('despesas').insert([row]).select().single()
      if (!error && data) { set(s => ({ expenses: [...s.expenses, { ...newExp, ...data }] })); return }
    }
    set(s => ({ expenses: [...s.expenses, newExp] }))
  },
  updateExpense: async (id, data) => {
    if (supabase) await supabase.from('despesas').update(data).eq('id', id)
    set(s => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, ...data } : e) }))
  },
  deleteExpense: async (id) => {
    if (supabase) await supabase.from('despesas').delete().eq('id', id)
    set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }))
  },
  markAsPaid: async (id) => {
    if (supabase) await supabase.from('despesas').update({ status: 'pago' }).eq('id', id)
    set(s => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, status: 'pago' } : e) }))
  },
  markAsPending: async (id) => {
    if (supabase) await supabase.from('despesas').update({ status: 'pendente' }).eq('id', id)
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
    const newCard = { ...card, id: Date.now().toString() }
    if (supabase) {
      const row = { id: newCard.id, nome: newCard.nome, bandeira: newCard.bandeira, limite: newCard.limite || 0, dia_fechamento: newCard.dia_fechamento || 15, dia_vencimento: newCard.dia_vencimento || 22, cor: newCard.cor || '#6366f1' }
      const { data, error } = await supabase.from('cartoes').insert([row]).select().single()
      if (!error && data) { set(s => ({ cards: [...s.cards, { ...newCard, ...data }] })); return }
    }
    set(s => ({ cards: [...s.cards, newCard] }))
  },
  updateCard: async (id, data) => {
    if (supabase) await supabase.from('cartoes').update(data).eq('id', id)
    set(s => ({ cards: s.cards.map(c => c.id === id ? { ...c, ...data } : c) }))
  },
  deleteCard: async (id) => {
    if (supabase) await supabase.from('cartoes').delete().eq('id', id)
    set(s => ({ cards: s.cards.filter(c => c.id !== id) }))
  },

  // ── Vehicles ──
  addVehicle: (vehicle) => {
    const v = {
      ...vehicle,
      placa: String(vehicle.placa || '').toUpperCase().replace(/\s+/g, ''),
      id: `veh_${Date.now()}`,
    }
    set(s => ({ vehicles: [...s.vehicles, v] }))
  },
  updateVehicle: (id, data) => {
    const patch = { ...data }
    if (patch.placa) patch.placa = String(patch.placa).toUpperCase().replace(/\s+/g, '')
    set(s => ({ vehicles: s.vehicles.map(v => v.id === id ? { ...v, ...patch } : v) }))
  },
  deleteVehicle: (id) => {
    set(s => ({ vehicles: s.vehicles.filter(v => v.id !== id) }))
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
  fecharMes: (mes) => {
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
    set(st => ({
      closures: [...st.closures.filter(c => c.mes !== targetMes), snapshot]
        .sort((a, b) => a.mes.localeCompare(b.mes)),
      expenses: st.expenses.map(e => idsParaPagar.has(e.id) ? { ...e, status: 'pago' } : e),
    }))
    return snapshot
  },
  reabrirMes: (mes) => {
    const s = get()
    const closure = s.closures.find(c => c.mes === mes)
    if (!closure) return
    // Reverte status de cada despesa alterada no fechamento
    const revertMap = new Map((closure.expenses_alteradas || []).map(x => [x.id, x.status_anterior]))
    set(st => ({
      closures: st.closures.filter(c => c.mes !== mes),
      expenses: st.expenses.map(e => revertMap.has(e.id) ? { ...e, status: revertMap.get(e.id) } : e),
    }))
  },
  getClosureByMes: (mes) => get().closures.find(c => c.mes === mes) || null,

  // ── Recurring ──
  addRecurring: async (item) => {
    const newItem = { ...item, id: Date.now().toString() }
    set(s => ({ recurring: [...s.recurring, newItem] }))
  },
  updateRecurring: async (id, data) => {
    set(s => ({ recurring: s.recurring.map(r => r.id === id ? { ...r, ...data } : r) }))
  },
  deleteRecurring: async (id) => {
    set(s => ({ recurring: s.recurring.filter(r => r.id !== id) }))
  },

  // ── Settlement ──
  settleDebt: (de, para) => {
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
  addNegocio: (negocio) => {
    const n = { ...negocio, id: `n${Date.now()}` }
    set(s => ({ negocios: [...s.negocios, n] }))
  },
  updateNegocio: (id, data) => {
    set(s => ({ negocios: s.negocios.map(n => n.id === id ? { ...n, ...data } : n) }))
  },
  deleteNegocio: (id) => {
    set(s => ({ negocios: s.negocios.filter(n => n.id !== id) }))
  },

  // ── Proventos ──
  addProvento: (provento) => {
    const p = { ...provento, id: `p${Date.now()}` }
    set(s => ({ proventos: [...s.proventos, p] }))
  },
  updateProvento: (id, data) => {
    set(s => ({ proventos: s.proventos.map(p => p.id === id ? { ...p, ...data } : p) }))
  },
  deleteProvento: (id) => {
    set(s => ({ proventos: s.proventos.filter(p => p.id !== id) }))
  },
  distribuirProvento: (id) => {
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
}),
{
  name: 'rateiopro-storage',
  storage: createJSONStorage(() => localStorage),
  // Only persist the data arrays and currentUser; skip computed/loading state
  partialize: (state) => ({
    // Se Supabase está ativo, não salvar no localStorage os dados que vêm do banco
    ...(supabase ? {} : {
      people:   state.people,
      groups:   state.groups,
      expenses: state.expenses,
      cards:    state.cards,
    }),
    vehicles:    state.vehicles,
    closures:    state.closures,
    recurring:   state.recurring,
    negocios:    state.negocios,
    proventos:   state.proventos,
    currentUser: state.currentUser,
    saldoCaixa:  state.saldoCaixa,
    ownerId:     state.ownerId,
  }),
}
  )
)

export default useStore
