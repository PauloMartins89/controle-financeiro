import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon, XMarkIcon, PencilSquareIcon,
  ChevronDownIcon, ChevronRightIcon, ExclamationTriangleIcon,
  MagnifyingGlassIcon, NoSymbolIcon, ArrowPathIcon,
  DocumentTextIcon, ClockIcon,
} from '@heroicons/react/24/outline'

// ─── helpers ─────────────────────────────────────────────────────────────────
function normalizeAlias(s) {
  return (s || '').trim().toUpperCase().replace(/\s+/g, ' ')
}

function fmtD(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).split('-')
  return `${d}/${m}/${y}`
}

function fmtDt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// campo_tipo → tabela cadastral
const TIPO_TABELA = {
  colaborador: { tabela: 'maquinas_colaboradores', campo: 'nome' },
  equipamento: { tabela: 'maquinas_equipamentos',  campo: 'codigo' },
  classe:      { tabela: 'maquinas_classes',        campo: 'nome' },
  frente:      { tabela: 'maquinas_frentes',        campo: 'nome' },
}

const STATUS_CAMPO_CONFIG = {
  ok:             { label: 'OK',           bg: '#16a34a20', color: '#4ade80', border: '#16a34a40' },
  aprovado:       { label: 'Aprovado',     bg: '#1d4ed820', color: '#60a5fa', border: '#1d4ed840' },
  pendente:       { label: 'Pendente',     bg: '#92400e20', color: '#fbbf24', border: '#92400e40' },
  nao_encontrado: { label: 'Não encontrado', bg: '#7f1d1d20', color: '#f87171', border: '#7f1d1d40' },
  ignorado:       { label: 'Ignorado',     bg: '#1f293730', color: '#64748b', border: '#33415540' },
}

const TIPO_CAMPO_COLOR = {
  colaborador: '#a78bfa',
  equipamento: '#34d399',
  classe:      '#60a5fa',
  frente:      '#fb923c',
  data:        '#94a3b8',
  horas_produtivas:  '#4ade80',
  horas_manutencao:  '#f59e0b',
  horas_ociosas:     '#f87171',
  observacao:        '#94a3b8',
}

// ─── componente ──────────────────────────────────────────────────────────────
export default function BoletinsPendencias() {
  const { workspaceId, user } = useStore()

  const [boletins,  setBoletins]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState({})  // boletimId → bool
  const [campos,    setCampos]    = useState({})  // boletimId → campo[]
  const [busy,      setBusy]      = useState({})  // campoId   → bool
  const [editModal, setEditModal] = useState(null) // { campo, boletimId, opcoes, cfg }
  const [editSearch, setEditSearch] = useState('')

  // ── carrega boletins pendentes ─────────────────────────────────────────────
  async function loadBoletins() {
    if (!workspaceId) return
    setLoading(true)
    const { data } = await supabase
      .from('maquinas_boletins')
      .select('*, maquinas_colaboradores(nome, telefone_wa)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pendente_revisao')
      .order('recebido_em', { ascending: false })
    setBoletins(data || [])
    setLoading(false)
  }

  useEffect(() => { loadBoletins() }, [workspaceId])

  // ── expande boletim e carrega campos ──────────────────────────────────────
  async function toggleExpand(boletimId) {
    const isOpen = !!expanded[boletimId]
    setExpanded(prev => ({ ...prev, [boletimId]: !isOpen }))
    if (!isOpen && !campos[boletimId]) {
      const { data } = await supabase
        .from('maquinas_boletins_campos')
        .select('*')
        .eq('boletim_id', boletimId)
        .order('created_at')
      setCampos(prev => ({ ...prev, [boletimId]: data || [] }))
    }
  }

  // ── verifica se todos os campos estão resolvidos → cria lançamento ────────
  async function checkAndFinalize(boletimId, camposAtuais) {
    const todosOk = camposAtuais.every(c => ['ok', 'aprovado', 'ignorado'].includes(c.status_match))
    if (!todosOk) return

    const { data: bol } = await supabase
      .from('maquinas_boletins')
      .select('*, maquinas_colaboradores(nome)')
      .eq('id', boletimId)
      .single()

    const dataBoletim = bol?.data_boletim || new Date().toISOString().slice(0, 10)
    const colabNome   = bol?.maquinas_colaboradores?.nome || 'Colaborador'
    const ocr         = bol?.ocr_raw || {}
    const hDisp  = parseFloat(ocr.horas_disponiveis || ocr.horas_totais    || 0) || null
    const hTrab  = parseFloat(ocr.horas_trabalhadas || ocr.horas_produtivas || 0) || null
    const pct    = hDisp && hTrab ? parseFloat((hTrab / hDisp * 100).toFixed(2)) : null

    const { data: lanc } = await supabase
      .from('lancamentos')
      .insert({
        workspace_id:    workspaceId,
        tipo:            'despesa',
        descricao:       `Boletim ${bol.numero} — ${colabNome} — ${fmtD(dataBoletim)}`,
        valor:           0,
        data:            dataBoletim,
        categoria:       'Máquinas',
        centro_custo:    '',
        status:          'pendente',
        observacoes:     ocr.observacao || ocr.observacoes || '',
        tipo_formulario: 'maquina',
        dados_extras:    {
          boletim_id:         boletimId,
          ocr:                ocr,
          equipamento:        (ocr.equipamento || '').toUpperCase(),
          modelo:             ocr.modelo || '',
          classe_operacional: ocr.classe || ocr.classe_operacional || '',
          frente:             ocr.frente || ocr.frente_de_trabalho || '',
          horas_disponiveis:  hDisp,
          horas_trabalhadas:  hTrab,
          horas_espera:       parseFloat(ocr.horas_espera || ocr.horas_ociosas || 0) || null,
          porcentagem:        pct,
          data:               dataBoletim,
        },
        comprovante_url: bol.imagem_url || '',
      })
      .select('id')
      .single()

    await supabase.from('maquinas_boletins').update({
      status:        'processado',
      processado_em: new Date().toISOString(),
      lancamento_id: lanc?.id || null,
    }).eq('id', boletimId)

    toast.success(`Boletim ${bol.numero} finalizado! Lançamento criado.`)
    setBoletins(prev => prev.filter(b => b.id !== boletimId))
    setCampos(prev => { const n = { ...prev }; delete n[boletimId]; return n })
    setExpanded(prev => { const n = { ...prev }; delete n[boletimId]; return n })
  }

  // ── aprovar proposta do sistema ────────────────────────────────────────────
  async function aprovar(campo, boletimId) {
    if (!campo.valor_match_id) {
      toast.error('Sem proposta para aprovar. Use "Corrigir" para selecionar manualmente.')
      return
    }
    setBusy(prev => ({ ...prev, [campo.id]: true }))
    try {
      await supabase.from('maquinas_aliases').upsert({
        workspace_id: workspaceId,
        campo_tipo:   campo.campo_tipo,
        alias:        normalizeAlias(campo.valor_raw),
        match_id:     campo.valor_match_id,
        match_tabela: campo.match_tabela,
      }, { onConflict: 'workspace_id,campo_tipo,alias' })

      await supabase.from('maquinas_boletins_campos').update({
        status_match: 'aprovado',
        aprovado_por: user?.id || null,
        aprovado_em:  new Date().toISOString(),
      }).eq('id', campo.id)

      const novos = (campos[boletimId] || []).map(c =>
        c.id === campo.id ? { ...c, status_match: 'aprovado' } : c
      )
      setCampos(prev => ({ ...prev, [boletimId]: novos }))
      toast.success('Campo aprovado!')
      await checkAndFinalize(boletimId, novos)
    } finally {
      setBusy(prev => { const n = { ...prev }; delete n[campo.id]; return n })
    }
  }

  // ── ignorar campo ─────────────────────────────────────────────────────────
  async function ignorar(campo, boletimId) {
    setBusy(prev => ({ ...prev, [campo.id]: true }))
    try {
      await supabase.from('maquinas_boletins_campos').update({
        status_match: 'ignorado',
        aprovado_por: user?.id || null,
        aprovado_em:  new Date().toISOString(),
      }).eq('id', campo.id)
      const novos = (campos[boletimId] || []).map(c =>
        c.id === campo.id ? { ...c, status_match: 'ignorado' } : c
      )
      setCampos(prev => ({ ...prev, [boletimId]: novos }))
      await checkAndFinalize(boletimId, novos)
    } finally {
      setBusy(prev => { const n = { ...prev }; delete n[campo.id]; return n })
    }
  }

  // ── abrir modal de correção ───────────────────────────────────────────────
  async function abrirCorrigir(campo, boletimId) {
    const cfg = TIPO_TABELA[campo.campo_tipo]
    if (!cfg) {
      toast.error(`Tipo "${campo.campo_tipo}" não tem tabela cadastral para matching.`)
      return
    }
    const { data } = await supabase
      .from(cfg.tabela)
      .select(`id, ${cfg.campo}`)
      .eq('workspace_id', workspaceId)
      .eq('ativo', true)
      .order(cfg.campo)
    setEditModal({ campo, boletimId, opcoes: data || [], cfg })
    setEditSearch('')
  }

  // ── confirmar correção manual ─────────────────────────────────────────────
  async function confirmarCorrecao(matchId, matchLabel) {
    const { campo, boletimId, cfg } = editModal
    setBusy(prev => ({ ...prev, [campo.id]: true }))
    setEditModal(null)
    try {
      await supabase.from('maquinas_aliases').upsert({
        workspace_id: workspaceId,
        campo_tipo:   campo.campo_tipo,
        alias:        normalizeAlias(campo.valor_raw),
        match_id:     matchId,
        match_tabela: cfg.tabela,
      }, { onConflict: 'workspace_id,campo_tipo,alias' })

      await supabase.from('maquinas_boletins_campos').update({
        status_match:    'aprovado',
        valor_match_id:  matchId,
        match_tabela:    cfg.tabela,
        match_confianca: 100,
        proposta_texto:  matchLabel,
        aprovado_por:    user?.id || null,
        aprovado_em:     new Date().toISOString(),
      }).eq('id', campo.id)

      const novos = (campos[boletimId] || []).map(c =>
        c.id === campo.id
          ? { ...c, status_match: 'aprovado', valor_match_id: matchId, proposta_texto: matchLabel, match_confianca: 100 }
          : c
      )
      setCampos(prev => ({ ...prev, [boletimId]: novos }))
      toast.success('Corrigido e alias salvo!')
      await checkAndFinalize(boletimId, novos)
    } finally {
      setBusy(prev => { const n = { ...prev }; delete n[campo.id]; return n })
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  const pendentesCount = boletins.length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* Título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <ExclamationTriangleIcon style={{ width: 28, height: 28, color: '#fbbf24' }} />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Pendências de Boletins
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Campos não identificados automaticamente aguardando revisão
            </p>
          </div>
          {pendentesCount > 0 && (
            <span style={{
              marginLeft: 'auto', background: '#fbbf2420', color: '#fbbf24',
              border: '1px solid #fbbf2440', borderRadius: 20,
              padding: '4px 14px', fontSize: 13, fontWeight: 700,
            }}>
              {pendentesCount} pendente{pendentesCount !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={loadBoletins}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)', borderRadius: 8, padding: '6px 12px',
              cursor: 'pointer', fontSize: 13,
            }}
          >
            <ArrowPathIcon style={{ width: 15, height: 15 }} />
            Atualizar
          </button>
        </div>

        {/* Estados vazios */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            <ArrowPathIcon style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.5 }} />
            <p>Carregando...</p>
          </div>
        )}

        {!loading && pendentesCount === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: 'var(--bg-card)', borderRadius: 16,
            border: '1px solid var(--border-color)',
          }}>
            <CheckCircleIcon style={{ width: 48, height: 48, color: '#4ade80', margin: '0 auto 16px' }} />
            <p style={{ fontSize: 16, color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 8px' }}>
              Nenhuma pendência!
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Todos os boletins recebidos foram processados automaticamente.
            </p>
          </div>
        )}

        {/* Lista de boletins */}
        {!loading && boletins.map(bol => {
          const isOpen       = !!expanded[bol.id]
          const camposBol    = campos[bol.id] || []
          const pendentes    = camposBol.filter(c => !['ok', 'aprovado', 'ignorado'].includes(c.status_match))
          const colabNome    = bol.maquinas_colaboradores?.nome || '—'
          const colabPhone   = bol.maquinas_colaboradores?.telefone_wa || ''

          return (
            <div key={bol.id} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              marginBottom: 12,
              overflow: 'hidden',
            }}>
              {/* Cabeçalho do boletim */}
              <button
                onClick={() => toggleExpand(bol.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 18px', background: 'transparent', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {isOpen
                  ? <ChevronDownIcon  style={{ width: 18, height: 18, color: 'var(--text-secondary)', flexShrink: 0 }} />
                  : <ChevronRightIcon style={{ width: 18, height: 18, color: 'var(--text-secondary)', flexShrink: 0 }} />
                }

                <DocumentTextIcon style={{ width: 20, height: 20, color: '#60a5fa', flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>
                      {bol.numero || bol.id.slice(0, 8)}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {colabNome}
                      {colabPhone && <span style={{ color: '#64748b', marginLeft: 6 }}>· {colabPhone}</span>}
                    </span>
                    {bol.data_boletim && (
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>
                        📅 {fmtD(bol.data_boletim)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Recebido em {fmtDt(bol.recebido_em)}
                  </div>
                </div>

                {isOpen && camposBol.length > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    color: pendentes.length > 0 ? '#fbbf24' : '#4ade80',
                    background: pendentes.length > 0 ? '#92400e20' : '#16a34a20',
                    border: `1px solid ${pendentes.length > 0 ? '#92400e40' : '#16a34a40'}`,
                    borderRadius: 20, padding: '3px 10px', flexShrink: 0,
                  }}>
                    {pendentes.length > 0
                      ? `${pendentes.length} pendente${pendentes.length !== 1 ? 's' : ''}`
                      : 'todos resolvidos'}
                  </span>
                )}

                {/* imagem thumbnail */}
                {bol.imagem_url && (
                  <a
                    href={bol.imagem_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'block', flexShrink: 0,
                      width: 40, height: 40, borderRadius: 6,
                      overflow: 'hidden', border: '1px solid var(--border-color)',
                    }}
                  >
                    <img
                      src={bol.imagem_url}
                      alt="boletim"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.currentTarget.style.display = 'none' }}
                    />
                  </a>
                )}
              </button>

              {/* Campos expandidos */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px 18px 16px' }}>
                  {camposBol.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
                      Carregando campos...
                    </p>
                  )}
                  {camposBol.map(campo => {
                    const sCfg    = STATUS_CAMPO_CONFIG[campo.status_match] || STATUS_CAMPO_CONFIG.pendente
                    const tipoCor = TIPO_CAMPO_COLOR[campo.campo_tipo] || '#94a3b8'
                    const isBusy  = !!busy[campo.id]
                    const ehMatchavel = !!TIPO_TABELA[campo.campo_tipo]
                    const jáResolvido = ['ok', 'aprovado', 'ignorado'].includes(campo.status_match)

                    return (
                      <div key={campo.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '10px 12px', borderRadius: 10, marginBottom: 6,
                        background: jáResolvido ? '#ffffff08' : '#ffffff0d',
                        border: `1px solid ${jáResolvido ? 'var(--border-color)' : sCfg.border}`,
                        opacity: isBusy ? 0.6 : 1,
                      }}>
                        {/* tipo do campo */}
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: tipoCor,
                          background: tipoCor + '20', border: `1px solid ${tipoCor}40`,
                          borderRadius: 6, padding: '2px 8px',
                          whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1,
                        }}>
                          {campo.campo_tipo}
                        </span>

                        {/* valor raw */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                            {campo.valor_raw || <span style={{ color: '#64748b' }}>(vazio)</span>}
                          </div>
                          {campo.proposta_texto && (
                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                              Proposta: {campo.proposta_texto}
                            </div>
                          )}
                        </div>

                        {/* status badge */}
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: sCfg.color, background: sCfg.bg,
                          border: `1px solid ${sCfg.border}`,
                          borderRadius: 20, padding: '2px 10px',
                          flexShrink: 0, whiteSpace: 'nowrap',
                        }}>
                          {sCfg.label}
                          {campo.match_confianca > 0 && campo.match_confianca < 100 && !jáResolvido
                            ? ` ${Math.round(campo.match_confianca)}%` : ''}
                        </span>

                        {/* ações (só para campos não resolvidos e matcháveis) */}
                        {!jáResolvido && ehMatchavel && (
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {/* ✅ Aprovar proposta */}
                            {campo.valor_match_id && (
                              <button
                                title="Aprovar proposta do sistema"
                                disabled={isBusy}
                                onClick={() => aprovar(campo, bol.id)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  background: '#16a34a20', border: '1px solid #16a34a50',
                                  color: '#4ade80', borderRadius: 7,
                                  padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                }}
                              >
                                <CheckCircleIcon style={{ width: 14, height: 14 }} />
                                Aprovar
                              </button>
                            )}
                            {/* ✏️ Corrigir */}
                            <button
                              title="Selecionar manualmente"
                              disabled={isBusy}
                              onClick={() => abrirCorrigir(campo, bol.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                background: '#1d4ed820', border: '1px solid #1d4ed850',
                                color: '#60a5fa', borderRadius: 7,
                                padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                              }}
                            >
                              <PencilSquareIcon style={{ width: 14, height: 14 }} />
                              Corrigir
                            </button>
                            {/* 🚫 Ignorar */}
                            <button
                              title="Ignorar este campo"
                              disabled={isBusy}
                              onClick={() => ignorar(campo, bol.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                background: '#1f293730', border: '1px solid #33415540',
                                color: '#64748b', borderRadius: 7,
                                padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                              }}
                            >
                              <NoSymbolIcon style={{ width: 14, height: 14 }} />
                              Ignorar
                            </button>
                          </div>
                        )}

                        {/* campos não matcháveis resolvidos */}
                        {jáResolvido && campo.aprovado_em && (
                          <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0 }}>
                            <ClockIcon style={{ width: 11, height: 11, display: 'inline', marginRight: 3 }} />
                            {fmtDt(campo.aprovado_em)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Modal de Correção ─────────────────────────────────────────────── */}
      {editModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={() => setEditModal(null)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 16,
            border: '1px solid var(--border-color)',
            width: '100%', maxWidth: 480,
            maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>

            {/* header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border-color)',
            }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>
                  Corrigir campo: <span style={{ color: TIPO_CAMPO_COLOR[editModal.campo.campo_tipo] || '#94a3b8' }}>
                    {editModal.campo.campo_tipo}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  OCR leu: "{editModal.campo.valor_raw}"
                </div>
              </div>
              <button
                onClick={() => setEditModal(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <XMarkIcon style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* busca */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-primary)', borderRadius: 8,
                border: '1px solid var(--border-color)', padding: '8px 12px',
              }}>
                <MagnifyingGlassIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)', flexShrink: 0 }} />
                <input
                  autoFocus
                  placeholder="Buscar..."
                  value={editSearch}
                  onChange={e => setEditSearch(e.target.value)}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--text-primary)', fontSize: 14, flex: 1,
                  }}
                />
              </div>
            </div>

            {/* lista */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
              {editModal.opcoes
                .filter(o => {
                  const val = o[editModal.cfg.campo] || ''
                  return val.toLowerCase().includes(editSearch.toLowerCase())
                })
                .map(o => {
                  const label = o[editModal.cfg.campo]
                  const isAtual = o.id === editModal.campo.valor_match_id
                  return (
                    <button
                      key={o.id}
                      onClick={() => confirmarCorrecao(o.id, label)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 12px',
                        borderRadius: 8, border: `1px solid ${isAtual ? '#1d4ed850' : 'transparent'}`,
                        background: isAtual ? '#1d4ed820' : 'transparent',
                        color: isAtual ? '#60a5fa' : 'var(--text-primary)',
                        cursor: 'pointer', fontSize: 14, display: 'block',
                        marginBottom: 2,
                      }}
                    >
                      {label}
                      {isAtual && (
                        <span style={{ fontSize: 11, color: '#60a5fa', marginLeft: 8 }}>
                          (proposta atual)
                        </span>
                      )}
                    </button>
                  )
                })}
              {editModal.opcoes.filter(o =>
                (o[editModal.cfg.campo] || '').toLowerCase().includes(editSearch.toLowerCase())
              ).length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: '24px 0' }}>
                  Nenhum registro encontrado.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
