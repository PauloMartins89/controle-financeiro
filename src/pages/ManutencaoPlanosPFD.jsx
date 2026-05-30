import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import {
  MagnifyingGlassIcon, ArrowPathIcon, BookOpenIcon,
  Cog6ToothIcon, CheckCircleIcon, XCircleIcon,
  ClockIcon, ClipboardDocumentListIcon,
  ChevronRightIcon, XMarkIcon, DocumentTextIcon,
  TruckIcon, ArrowTopRightOnSquareIcon, PlusIcon,
  InformationCircleIcon, CpuChipIcon,
  CloudArrowUpIcon, WrenchScrewdriverIcon, BeakerIcon,
  FunnelIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline'

// ── Paleta de cores por intervalo de horas ─────────────────────────────────
const COR_INTERVALO = {
  10: '#16a34a', 25: '#15803d', 50: '#059669',
  100: '#0284c7', 200: '#0369a1', 250: '#1d4ed8',
  500: '#7c3aed', 1000: '#9333ea', 1500: '#c026d3',
  2000: '#db2777', anual: '#d97706', default: '#6b7280',
}
function corIntervalo(horas) {
  return COR_INTERVALO[Number(horas)] || COR_INTERVALO.default
}

const STATUS_CFG = {
  pendente:    { label: 'Pendente',    bg: '#fef9c3', color: '#854d0e', Icon: ClockIcon },
  processando: { label: 'Processando', bg: '#dbeafe', color: '#1e40af', Icon: ArrowPathIcon },
  processado:  { label: 'Processado',  bg: '#dcfce7', color: '#166534', Icon: CheckCircleIcon },
  erro:        { label: 'Erro',        bg: '#fee2e2', color: '#991b1b', Icon: XCircleIcon },
}

const ABAS = [
  { id: 'publicacoes', label: 'Publicações',      Icon: BookOpenIcon },
  { id: 'importar',    label: 'Importar PDF',     Icon: CloudArrowUpIcon },
  { id: 'planos',      label: 'Planos Extraídos', Icon: ClipboardDocumentListIcon },
]

// ═══════════════════════════════════════════════════════════════════════════
export default function ManutencaoPlanosPFD() {
  const navigate = useNavigate()
  const { iconColors: ic } = useStore()
  const wsId = useStore(s => s.workspaceId)
  const accent = ic?.accent || '#3b82f6'
  const surface = ic?.surface || '#fff'
  const border  = ic?.border  || '#e5e7eb'

  const [abaAtiva, setAbaAtiva] = useState('publicacoes')
  const [publicacoes, setPublicacoes] = useState([])
  const [planos, setPlanos] = useState([])
  const [loadingPubs, setLoadingPubs] = useState(false)
  const [loadingPlanos, setLoadingPlanos] = useState(false)
  const [intervaloAberto, setIntervaloAberto] = useState(null)
  const [planoAtivo, setPlanoAtivo] = useState(null)
  const [planTab, setPlanTab] = useState('resumo')
  const [frota, setFrota] = useState([])
  const [busca, setBusca] = useState('')
  const [processando, setProcessando] = useState(false)

  // Formulário de nova publicação
  const [form, setForm] = useState({
    codigo_pub: '', titulo: '', fabricante: 'John Deere', modelo: '',
    familia: '', classificacao: 'Base Unit', serie_inicio: '', serie_fim: '',
    edicao: 'South America', idioma: 'pt', url_pdf: '',
  })
  const [pdfArquivo, setPdfArquivo] = useState(null)
  const fileRef = useRef()

  // Busca TechPubs
  const [buscaJD, setBuscaJD] = useState('')
  const [resultadosJD, setResultadosJD] = useState([])
  const [loadingJD, setLoadingJD] = useState(false)
  const [urlBuscaJD, setUrlBuscaJD] = useState('')

  useEffect(() => { if (wsId) carregarPublicacoes() }, [wsId])
  useEffect(() => { if (wsId && abaAtiva === 'planos') carregarPlanos() }, [wsId, abaAtiva])
  useEffect(() => {
    if (!wsId) return
    supabase.from('manut_equipamentos')
      .select('id,nome,codigo,fabricante,modelo,horimetro_atual,ativo,tipo')
      .eq('workspace_id', wsId).order('nome')
      .then(({ data }) => setFrota(data || []))
  }, [wsId])

  async function carregarPublicacoes() {
    if (!wsId) return
    setLoadingPubs(true)
    const { data } = await supabase
      .from('pfd_publicacoes').select('*')
      .eq('workspace_id', wsId).order('created_at', { ascending: false })
    setPublicacoes(data || [])
    setLoadingPubs(false)
  }

  async function carregarPlanos() {
    if (!wsId) return
    setLoadingPlanos(true)
    const { data } = await supabase
      .from('pfd_planos')
      .select('*, pfd_publicacoes(codigo_pub, titulo, modelo, fabricante, edicao, serie_inicio, serie_fim)')
      .eq('workspace_id', wsId).order('extraido_em', { ascending: false })
    setPlanos(data || [])
    if (data?.length && !planoAtivo) setPlanoAtivo(data[0])
    setLoadingPlanos(false)
  }

  async function buscarNoTechPubs() {
    if (!buscaJD.trim()) return
    setLoadingJD(true); setResultadosJD([]); setUrlBuscaJD('')
    try {
      const params = new URLSearchParams({ kw: buscaJD.trim(), pg: "Operator's Manuals", ln: 'Portuguese' })
      const res = await fetch(`/api/pfd-buscar?${params}`)
      const data = await res.json()
      if (data.resultados?.length > 0) {
        setResultadosJD(data.resultados)
        toast.success(`${data.resultados.length} publicação(ões) encontrada(s)`)
      } else {
        const url = `https://techpubs.deere.com/pt-BR/Search/Equipment?page=0&sug=True&st=model&kw=${encodeURIComponent(buscaJD.trim())}&ln=Portuguese&pg=Operator%27s%20Manuals`
        setUrlBuscaJD(url)
        toast('Abra o TechPubs manualmente', { icon: '🔗' })
      }
    } catch (err) { toast.error('Erro: ' + err.message) }
    setLoadingJD(false)
  }

  function usarResultadoJD(r) {
    setForm(f => ({
      ...f, modelo: r.modelo || '', familia: r.familia || '',
      classificacao: r.classificacao || 'Base Unit',
      serie_inicio: r.serie_inicio || '', serie_fim: r.serie_fim || '',
      edicao: r.edicao || 'South America', fabricante: 'John Deere',
    }))
    setAbaAtiva('importar')
    toast('Dados preenchidos — faça upload do PDF', { icon: '📋' })
  }

  async function salvarEProcessar() {
    if (!form.modelo.trim()) { toast.error('Informe o modelo'); return }
    if (!pdfArquivo && !form.url_pdf.trim()) { toast.error('Selecione o PDF ou informe a URL'); return }
    setProcessando(true)
    try {
      // O INSERT em pfd_publicacoes é feito pela API (usa SERVICE_KEY, sem RLS)
      const payload = {
        workspace_id: wsId,
        modelo: form.modelo.trim(),
        codigo_pub: form.codigo_pub.trim() || undefined,
        titulo: form.titulo.trim() || undefined,
        fabricante: form.fabricante,
        familia: form.familia.trim() || undefined,
        classificacao: form.classificacao,
        serie_inicio: form.serie_inicio.trim() || undefined,
        serie_fim: form.serie_fim.trim() || undefined,
        edicao: form.edicao,
        idioma: form.idioma,
        url_pdf: form.url_pdf.trim() || undefined,
      }

      if (pdfArquivo) {
        // Upload para Supabase Storage (evita limite de 4.5 MB do body Vercel)
        toast('Enviando PDF...', { icon: '📤' })
        const storageKey = `${wsId}/${Date.now()}_${pdfArquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('pfd-manuais')
          .upload(storageKey, pdfArquivo, { contentType: 'application/pdf', upsert: false })
        if (uploadErr) throw new Error('Erro no upload do PDF: ' + uploadErr.message)
        payload.modo = 'storage'
        payload.storage_path = uploadData.path
      } else {
        payload.modo = 'url'; payload.url_pdf = form.url_pdf.trim()
      }

      const res = await fetch('/api/pfd-processar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erro no processamento')

      toast.success(`Plano extraído! ${result.total_intervalos} intervalos, ${result.total_tarefas} tarefas`, { duration: 5000 })
      setForm({ codigo_pub: '', titulo: '', fabricante: 'John Deere', modelo: '', familia: '', classificacao: 'Base Unit', serie_inicio: '', serie_fim: '', edicao: 'South America', idioma: 'pt', url_pdf: '' })
      setPdfArquivo(null); if (fileRef.current) fileRef.current.value = ''
      await carregarPublicacoes(); await carregarPlanos(); setAbaAtiva('planos')
    } catch (err) {
      toast.error('Erro: ' + err.message); await carregarPublicacoes()
    }
    setProcessando(false)
  }

  async function excluirPublicacao(pub) {
    if (!confirm(`Excluir "${pub.titulo || pub.modelo}"? Os planos extraídos também serão removidos.`)) return
    await supabase.from('pfd_publicacoes').delete().eq('id', pub.id)
    setPublicacoes(p => p.filter(x => x.id !== pub.id))
    toast.success('Publicação excluída')
  }

  const pubsFiltradas = publicacoes.filter(p =>
    !busca || [p.modelo, p.titulo, p.codigo_pub, p.fabricante, p.edicao]
      .some(v => v?.toLowerCase().includes(busca.toLowerCase()))
  )

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: ic?.bg || '#f9fafb' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderBottom: `1px solid ${border}`,
        padding: '24px 32px 0', position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'var(--border)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: '#94a3b8', fontSize: 12,
          }}>
            ← Voltar
          </button>
          <CpuChipIcon style={{ width: 24, height: 24, color: accent }} />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>Planos PFD</h1>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
              Motor independente · Importação de manuais técnicos JD TechPubs · Extração IA
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
          {ABAS.map(({ id, label, Icon }) => {
            const ativa = abaAtiva === id
            return (
              <button key={id} onClick={() => setAbaAtiva(id)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', border: 'none', cursor: 'pointer',
                background: ativa ? surface : 'transparent',
                color: ativa ? accent : '#94a3b8',
                borderRadius: '8px 8px 0 0', fontWeight: ativa ? 600 : 400, fontSize: 13,
                borderBottom: ativa ? `2px solid ${accent}` : '2px solid transparent',
              }}>
                <Icon style={{ width: 15, height: 15 }} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ─── ABA: PUBLICAÇÕES ──────────────────────────────────────────── */}
        {abaAtiva === 'publicacoes' && (
          <div>
            {/* Busca TechPubs */}
            <div style={{ background: surface, borderRadius: 12, border: `1px solid ${border}`, padding: 20, marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
                🔍 Buscar modelo no John Deere TechPubs
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={buscaJD} onChange={e => setBuscaJD(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscarNoTechPubs()}
                  placeholder="Ex: 8400R, 6R 175, S780..."
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, fontSize: 14, outline: 'none' }}
                />
                <button onClick={buscarNoTechPubs} disabled={loadingJD} style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none', background: accent,
                  color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {loadingJD
                    ? <ArrowPathIcon style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                    : <MagnifyingGlassIcon style={{ width: 14, height: 14 }} />}
                  Buscar
                </button>
                <a
                  href={`https://techpubs.deere.com/pt-BR/Search/Equipment?page=0&sug=True&st=model&kw=${encodeURIComponent(buscaJD || '')}&ln=Portuguese&pg=Operator%27s%20Manuals`}
                  target="_blank" rel="noreferrer"
                  style={{
                    padding: '8px 14px', borderRadius: 8, border: `1px solid ${border}`,
                    color: '#374151', textDecoration: 'none', fontSize: 13, background: '#f9fafb',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <ArrowTopRightOnSquareIcon style={{ width: 14, height: 14 }} />
                  Abrir TechPubs
                </a>
                <button onClick={() => setAbaAtiva('importar')} style={{
                  padding: '8px 14px', borderRadius: 8, border: `1px solid ${accent}`,
                  color: accent, background: '#eff6ff', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <PlusIcon style={{ width: 14, height: 14 }} />
                  Nova Publicação
                </button>
              </div>

              {urlBuscaJD && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fcd34d', fontSize: 12, color: '#92400e' }}>
                  <InformationCircleIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
                  O TechPubs é renderizado por JavaScript — os PDFs precisam ser baixados manualmente.{' '}
                  <a href={urlBuscaJD} target="_blank" rel="noreferrer" style={{ color: '#b45309', fontWeight: 600 }}>
                    Abrir no TechPubs →
                  </a>{' '}
                  Baixe o PDF e importe pela aba "Importar PDF".
                </div>
              )}

              {resultadosJD.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                    Clique para pré-preencher o formulário de importação:
                  </p>
                  {resultadosJD.map((r, i) => (
                    <div key={i} onClick={() => usarResultadoJD(r)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 14px', borderRadius: 8, border: `1px solid ${border}`,
                        background: '#f9fafb', cursor: 'pointer', marginBottom: 6,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.background = '#f9fafb'}
                    >
                      <TruckIcon style={{ width: 18, height: 18, color: '#16a34a', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{r.modelo}</span>
                        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
                          {r.familia} · {r.classificacao} · Série {r.serie_inicio}{r.serie_fim ? `–${r.serie_fim}` : ''}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: '#166534', fontWeight: 600 }}>
                        {r.edicao}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de publicações */}
            <div style={{ background: surface, borderRadius: 12, border: `1px solid ${border}` }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                  Publicações Cadastradas
                  <span style={{ marginLeft: 8, fontSize: 12, padding: '1px 8px', borderRadius: 20, background: '#f1f5f9', color: '#64748b' }}>
                    {publicacoes.length}
                  </span>
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Filtrar..."
                    style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${border}`, fontSize: 13, width: 180 }} />
                  <button onClick={carregarPublicacoes} disabled={loadingPubs}
                    style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${border}`, background: '#f9fafb', cursor: 'pointer' }}>
                    <ArrowPathIcon style={{ width: 14, height: 14, animation: loadingPubs ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
                </div>
              </div>

              {pubsFiltradas.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
                  <DocumentTextIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 14 }}>
                    {publicacoes.length === 0
                      ? 'Nenhuma publicação importada. Use "Importar PDF" para começar.'
                      : 'Nenhuma publicação encontrada para o filtro.'}
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Código', 'Modelo', 'Edição', 'Série', 'Status', 'Importado em', ''].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: `1px solid ${border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pubsFiltradas.map(pub => {
                        const st = STATUS_CFG[pub.status] || STATUS_CFG.pendente
                        const { Icon: StIcon } = st
                        return (
                          <tr key={pub.id} style={{ borderBottom: `1px solid ${border}`, cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#475569' }}>
                                {pub.codigo_pub || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 700, color: '#1e293b' }}>{pub.modelo}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{pub.fabricante} · {pub.familia}</div>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#374151' }}>{pub.edicao || '—'}</td>
                            <td style={{ padding: '12px 16px', color: '#374151', fontSize: 12 }}>
                              {pub.serie_inicio ? `${pub.serie_inicio}${pub.serie_fim ? ` – ${pub.serie_fim}` : '+'}` : '—'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                                <StIcon style={{ width: 11, height: 11 }} />
                                {st.label}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 11, color: '#9ca3af' }}>
                              {pub.created_at ? new Date(pub.created_at).toLocaleDateString('pt-BR') : '—'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {pub.status === 'processado' && (
                                  <button onClick={() => {
                                    const pl = planos.find(p => p.publicacao_id === pub.id)
                                    if (pl) { setPlanoAtivo(pl); setAbaAtiva('planos') }
                                    else { setAbaAtiva('planos'); carregarPlanos() }
                                  }} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${accent}`, background: '#eff6ff', color: accent, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                    Ver Plano
                                  </button>
                                )}
                                <button onClick={() => excluirPublicacao(pub)}
                                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fee2e2', background: '#fff5f5', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>
                                  <XMarkIcon style={{ width: 12, height: 12 }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── ABA: IMPORTAR PDF ─────────────────────────────────────────── */}
        {abaAtiva === 'importar' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
            <div style={{ background: surface, borderRadius: 12, border: `1px solid ${border}`, padding: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginTop: 0, marginBottom: 20 }}>
                Cadastrar Nova Publicação
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Campo label="Fabricante" required value={form.fabricante} onChange={v => setForm(f => ({ ...f, fabricante: v }))} />
                <Campo label="Modelo" required placeholder="Ex: 8400R" value={form.modelo} onChange={v => setForm(f => ({ ...f, modelo: v }))} />
                <Campo label="Família" placeholder="Ex: Tractors" value={form.familia} onChange={v => setForm(f => ({ ...f, familia: v }))} />
                <CampoSelect label="Classificação" value={form.classificacao} onChange={v => setForm(f => ({ ...f, classificacao: v }))} options={['Base Unit', 'Attachment', 'Engines & Drivetrains']} />
                <Campo label="Série início" placeholder="Ex: 100000" value={form.serie_inicio} onChange={v => setForm(f => ({ ...f, serie_inicio: v }))} />
                <Campo label="Série fim" placeholder="Ex: Current" value={form.serie_fim} onChange={v => setForm(f => ({ ...f, serie_fim: v }))} />
                <CampoSelect label="Edição" value={form.edicao} onChange={v => setForm(f => ({ ...f, edicao: v }))} options={['South America', 'North America', 'Europe', 'Export', 'Worldwide']} />
                <CampoSelect label="Idioma" value={form.idioma} onChange={v => setForm(f => ({ ...f, idioma: v }))} options={['pt', 'en', 'es', 'fr', 'de']} labels={['Português', 'English', 'Español', 'Français', 'Deutsch']} />
                <Campo label="Código da publicação" placeholder="Ex: OMN400413" value={form.codigo_pub} onChange={v => setForm(f => ({ ...f, codigo_pub: v }))} />
                <Campo label="Título (opcional)" placeholder="Ex: Manual do Operador 8400R" value={form.titulo} onChange={v => setForm(f => ({ ...f, titulo: v }))} />
              </div>

              {/* Upload PDF */}
              <div style={{ marginTop: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>PDF do Manual</label>
                <div
                  style={{ border: `2px dashed ${pdfArquivo ? '#16a34a' : border}`, borderRadius: 10, padding: 20, textAlign: 'center', background: pdfArquivo ? '#f0fdf4' : '#f9fafb', cursor: 'pointer' }}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) { setPdfArquivo(f); setForm(ff => ({ ...ff, url_pdf: '' })); toast.success(`PDF: ${f.name}`) }
                    }} />
                  {pdfArquivo ? (
                    <>
                      <CheckCircleIcon style={{ width: 28, height: 28, color: '#16a34a', margin: '0 auto 6px' }} />
                      <p style={{ margin: 0, fontWeight: 700, color: '#166534', fontSize: 14 }}>{pdfArquivo.name}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#4ade80' }}>{(pdfArquivo.size / 1024 / 1024).toFixed(1)} MB</p>
                    </>
                  ) : (
                    <>
                      <CloudArrowUpIcon style={{ width: 28, height: 28, color: '#9ca3af', margin: '0 auto 6px' }} />
                      <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>Clique para selecionar o PDF</p>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>Baixe em techpubs.deere.com e faça upload aqui</p>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
                  <div style={{ flex: 1, height: 1, background: border }} />
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>ou URL direta do PDF</span>
                  <div style={{ flex: 1, height: 1, background: border }} />
                </div>

                <input value={form.url_pdf} onChange={e => { setForm(f => ({ ...f, url_pdf: e.target.value })); if (e.target.value) setPdfArquivo(null) }}
                  placeholder="https://..." style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <button onClick={salvarEProcessar} disabled={processando} style={{
                marginTop: 24, width: '100%', padding: 12, borderRadius: 10, border: 'none',
                background: processando ? '#9ca3af' : accent, color: '#fff',
                cursor: processando ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {processando
                  ? <><ArrowPathIcon style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Processando com IA...</>
                  : <><Cog6ToothIcon style={{ width: 18, height: 18 }} /> Importar e Extrair Plano</>}
              </button>
            </div>

            {/* Painel lateral */}
            <div>
              <div style={{ background: surface, borderRadius: 12, border: `1px solid ${border}`, padding: 24, marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginTop: 0, marginBottom: 14 }}>Como importar</h3>
                {[
                  { n: 1, t: 'Acesse techpubs.deere.com e busque o modelo', link: 'https://techpubs.deere.com/pt-BR/Search/Equipment' },
                  { n: 2, t: 'Selecione "Operator\'s Manuals" em Português' },
                  { n: 3, t: 'Baixe o PDF do manual do operador' },
                  { n: 4, t: 'Preencha os dados do modelo e faça upload' },
                  { n: 5, t: 'A IA extrai os intervalos automaticamente' },
                ].map(s => (
                  <div key={s.n} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.n}</span>
                    <div style={{ fontSize: 13, color: '#374151', paddingTop: 2 }}>
                      {s.t}{s.link && <> <a href={s.link} target="_blank" rel="noreferrer" style={{ color: accent, fontSize: 11 }}>→ abrir</a></>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fffbeb', borderRadius: 12, border: '1px solid #fcd34d', padding: 16 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                  <strong>Extração IA:</strong> O sistema analisa as páginas do PDF procurando tabelas de manutenção periódica (10h, 50h, 100h, 250h, 500h...) e extrai sistemas, tarefas, lubrificantes e capacidades.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA: PLANOS EXTRAÍDOS ─────────────────────────────────────── */}
        {abaAtiva === 'planos' && (
          <div>
            {loadingPlanos ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                <ArrowPathIcon style={{ width: 32, height: 32, margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
                <p>Carregando...</p>
              </div>
            ) : planos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                <ClipboardDocumentListIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: 14 }}>Nenhum plano extraído ainda.</p>
                <button onClick={() => setAbaAtiva('importar')} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, border: 'none', background: accent, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  Importar PDF
                </button>
              </div>
            ) : (
              <PlanoEstrategico
                plano={planoAtivo || planos[0]}
                planos={planos}
                planoAtivo={planoAtivo || planos[0]}
                setPlanoAtivo={setPlanoAtivo}
                planTab={planTab}
                setPlanTab={setPlanTab}
                frota={frota}
                surface={surface}
                border={border}
                navigate={navigate}
                setAbaAtiva={setAbaAtiva}
                intervaloAberto={intervaloAberto}
                setIntervaloAberto={setIntervaloAberto}
              />
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Campo({ label, value, onChange, placeholder, required }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  )
}

function CampoSelect({ label, value, onChange, options, labels }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
        {options.map((opt, i) => <option key={opt} value={opt}>{labels ? labels[i] : opt}</option>)}
      </select>
    </div>
  )
}

// Normaliza intervalo para suportar schema novo (Gemini) e legado (OpenAI)
function normIv(iv) {
  return {
    horas:     iv.intervalo_horas ?? iv.horas ?? 0,
    nome:      iv.titulo_intervalo || iv.nome || `A cada ${iv.intervalo_horas ?? iv.horas ?? 0} horas`,
    tarefas:   iv.tarefas || [],
    status:    iv.status_extracao || 'ok',
    periodo:   iv.periodicidade || 'recorrente',
  }
}

function normTarefa(t) {
  return {
    sistema:             t.sistema || '',
    componente:          t.componente || '',
    tarefa:              t.atividade || t.descricao_tarefa || t.tarefa || '',
    tipo:                t.tipo_atividade || t.tipo || '',
    insumo:              t.insumo_ou_peca || t.lubrificante_fluido || t.codigo_lubrificante || '',
    codigo_peca:         t.codigo_peca || '',
    quantidade:          t.quantidade || (t.capacidade ? `${t.capacidade}${t.unidade ? ' ' + t.unidade : ''}` : ''),
    especificacao:       t.especificacao || '',
    pontos_lubrificacao: t.pontos_lubrificacao || '',
    aviso_seguranca:     t.aviso_seguranca || '',
    pagina_fonte:        t.pagina_fonte ?? null,
    texto_original:      t.texto_original || '',
    condicional:         t.condicional || false,
    aplicabilidade:      t.aplicabilidade || '',
    observacao:          t.observacao || '',
    confianca:           t.confianca || '',
  }
}

const STATUS_EXT = {
  ok:                      { label: 'Extração completa',        bg: '#dcfce7', color: '#166534' },
  falha_extracao:          { label: 'Falha de extração',        bg: '#fee2e2', color: '#991b1b' },
  intervalo_nao_encontrado:{ label: 'Não encontrado no manual', bg: '#f3f4f6', color: '#6b7280' },
  parcial:                 { label: 'Extração parcial',         bg: '#fef9c3', color: '#854d0e' },
}

const BRAND_COLORS_PFD = {
  'John Deere':      { bg: '#367C2B', text: '#FFDE00', initials: 'JD' },
  'Case IH':         { bg: '#C41230', text: '#fff',    initials: 'CIH' },
  'New Holland':     { bg: '#004A9F', text: '#fff',    initials: 'NH' },
  'Valtra':          { bg: '#B10000', text: '#fff',    initials: 'VAL' },
  'Massey Ferguson': { bg: '#CC0000', text: '#fff',    initials: 'MF' },
  'Caterpillar':     { bg: '#FFCD11', text: '#000',    initials: 'CAT' },
  'Komatsu':         { bg: '#FF7A00', text: '#fff',    initials: 'KOM' },
}

function MiniKpiPFD({ label, value, color, icon: Icon, note }) {
  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '11px 14px', border: '1px solid #e2e8f0', minWidth: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
        {Icon && <Icon style={{ width: 12, height: 12, color }} />}
        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value ?? '—'}</div>
      {note && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{note}</div>}
    </div>
  )
}

// ─── Componente estratégico principal ────────────────────────────────────────
function PlanoEstrategico({ plano, planos, planoAtivo, setPlanoAtivo, planTab, setPlanTab, frota, surface, border, navigate, setAbaAtiva, intervaloAberto, setIntervaloAberto }) {
  const intervalos = (plano.intervalos || []).map(normIv)
  const pub = plano.pfd_publicacoes
  const fabricante = pub?.fabricante || plano.fabricante || 'John Deere'
  const modelo = pub?.modelo || plano.modelo || ''

  const todas = intervalos.flatMap(iv => iv.tarefas.map(normTarefa))
  const filtros = todas.filter(t => t.tipo === 'substituicao')

  const fluidosMap = new Map()
  todas.filter(t => t.insumo).forEach(t => { if (!fluidosMap.has(t.insumo)) fluidosMap.set(t.insumo, t) })
  const fluidosUnicos = [...fluidosMap.values()]

  const frotaVinculada = frota.filter(eq => {
    const fab = (eq.fabricante || '').toLowerCase()
    const mod = (eq.modelo || '').toLowerCase()
    const fabRef = fabricante.toLowerCase()
    const modRef = modelo.toLowerCase()
    return fab.includes(fabRef.slice(0, 4)) || mod.includes(modRef.slice(0, 4))
  })

  const totalOk = intervalos.filter(iv => iv.status === 'ok').length
  const statusGeral = totalOk === intervalos.length ? 'completo' : totalOk > 0 ? 'parcial' : 'falha'
  const statusCfg = {
    completo: { label: 'Extração completa', bg: '#dcfce7', color: '#166534' },
    parcial:  { label: 'Extração parcial',  bg: '#fef9c3', color: '#854d0e' },
    falha:    { label: 'Falha de extração', bg: '#fee2e2', color: '#991b1b' },
  }[statusGeral]

  const brand = BRAND_COLORS_PFD[fabricante] || { bg: '#16a34a', text: '#fff', initials: fabricante.slice(0, 3).toUpperCase() }

  const PLAN_TABS = [
    { id: 'resumo',     label: 'Resumo',                            Icon: ClipboardDocumentListIcon },
    { id: 'intervalos', label: 'Intervalos',                        Icon: ClockIcon },
    { id: 'filtros',    label: `Filtros / Peças (${filtros.length})`,        Icon: FunnelIcon },
    { id: 'fluidos',    label: `Fluidos (${fluidosUnicos.length})`,          Icon: BeakerIcon },
    { id: 'frota',      label: `Frota (${frotaVinculada.length})`,           Icon: TruckIcon },
  ]

  return (
    <div>
      {/* ─── Equipment card ─────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 0, boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg, #16a34a, #4ade80, #0ea5e9)' }} />
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Brand badge */}
            <div style={{ width: 68, height: 68, borderRadius: 12, background: brand.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 900, fontSize: 17, color: brand.text, letterSpacing: -0.5 }}>{brand.initials}</span>
            </div>

            {/* Info + KPIs */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: '#0f172a' }}>{fabricante} {modelo}</h2>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: statusCfg.bg, color: statusCfg.color }}>{statusCfg.label}</span>
                {pub?.edicao && <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569' }}>{pub.edicao}</span>}
              </div>
              <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: 13 }}>
                {pub?.titulo || 'Manual do Operador'}
                {pub?.serie_inicio && ` · Série ${pub.serie_inicio}${pub.serie_fim ? `–${pub.serie_fim}` : '+'}`}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <MiniKpiPFD label="Intervalos"   value={plano.total_intervalos || intervalos.length} color="#16a34a" icon={ClockIcon}                 note={`${totalOk} ok`} />
                <MiniKpiPFD label="Tarefas"      value={plano.total_tarefas    || todas.length}       color="#0ea5e9" icon={ClipboardDocumentListIcon} />
                <MiniKpiPFD label="Filtros/Peças" value={filtros.length}                              color="#8b5cf6" icon={FunnelIcon}               note="substituições" />
                <MiniKpiPFD label="Fluidos"      value={fluidosUnicos.length}                         color="#f59e0b" icon={BeakerIcon}               note="únicos" />
                <MiniKpiPFD label="Frota Match"  value={frotaVinculada.length}                        color="#64748b" icon={TruckIcon}               note="equipamentos" />
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              {planos.length > 1 && (
                <select
                  value={planoAtivo?.id || ''}
                  onChange={e => setPlanoAtivo(planos.find(p => p.id === e.target.value))}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
                  {planos.map(pl => (
                    <option key={pl.id} value={pl.id}>{pl.pfd_publicacoes?.modelo || pl.modelo} · {pl.pfd_publicacoes?.edicao || ''}</option>
                  ))}
                </select>
              )}
              <button onClick={() => navigate('/manutencao/operacoes/os')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <WrenchScrewdriverIcon style={{ width: 13, height: 13 }} /> Gerar OS
              </button>
              <button onClick={() => setAbaAtiva('importar')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>
                <CloudArrowUpIcon style={{ width: 13, height: 13 }} /> Importar novo
              </button>
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display: 'flex', borderTop: '1px solid #e2e8f0', overflowX: 'auto' }}>
          {PLAN_TABS.map(t => {
            const ativo = planTab === t.id
            return (
              <button key={t.id} onClick={() => setPlanTab(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 18px', fontSize: 12, fontWeight: ativo ? 700 : 500, color: ativo ? '#16a34a' : '#64748b', background: 'none', border: 'none', borderBottom: ativo ? '2px solid #16a34a' : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
                <t.Icon style={{ width: 14, height: 14 }} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ background: 'white', borderRadius: '0 0 14px 14px', border: '1px solid #e2e8f0', borderTop: 'none', padding: 24, marginBottom: 24 }}>
        {planTab === 'resumo'     && <TabPFDResumo     plano={plano} intervalos={intervalos} todas={todas} filtros={filtros} fluidosUnicos={fluidosUnicos} frotaVinculada={frotaVinculada} statusCfg={statusCfg} />}
        {planTab === 'intervalos' && <TabPFDIntervalos intervalos={intervalos} intervaloAberto={intervaloAberto} setIntervaloAberto={setIntervaloAberto} surface={surface} border={border} />}
        {planTab === 'filtros'    && <TabPFDFiltros    filtros={filtros} intervalos={intervalos} />}
        {planTab === 'fluidos'    && <TabPFDFluidos    fluidosUnicos={fluidosUnicos} intervalos={intervalos} />}
        {planTab === 'frota'      && <TabPFDFrota      frotaVinculada={frotaVinculada} frota={frota} navigate={navigate} fabricante={fabricante} modelo={modelo} />}
      </div>
    </div>
  )
}

// ─── Tab: Resumo ─────────────────────────────────────────────────────────────
function TabPFDResumo({ plano, intervalos, todas, filtros, fluidosUnicos, frotaVinculada, statusCfg }) {
  const pub = plano.pfd_publicacoes
  const sistemas = [...new Set(todas.map(t => t.sistema).filter(Boolean))]
  const tipoFreq = {}
  todas.forEach(t => { if (t.tipo) tipoFreq[t.tipo] = (tipoFreq[t.tipo] || 0) + 1 })

  const TIPO_CFG = {
    verificacao:  { color: '#0284c7', bg: '#e0f2fe',  label: 'Verificação' },
    substituicao: { color: '#7c3aed', bg: '#ede9fe',  label: 'Substituição' },
    lubrificacao: { color: '#16a34a', bg: '#dcfce7',  label: 'Lubrificação' },
    limpeza:      { color: '#0369a1', bg: '#dbeafe',  label: 'Limpeza' },
    ajuste:       { color: '#ca8a04', bg: '#fef9c3',  label: 'Ajuste' },
    inspecao:     { color: '#9333ea', bg: '#f3e8ff',  label: 'Inspeção' },
    outro:        { color: '#64748b', bg: '#f1f5f9',  label: 'Outro' },
  }

  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: statusCfg.bg, border: `1px solid ${statusCfg.color}40`, borderRadius: 8, padding: '5px 12px', marginBottom: 16, fontSize: 11, color: statusCfg.color, fontWeight: 600 }}>
        <ShieldCheckIcon style={{ width: 13, height: 13 }} />
        {statusCfg.label} — extraído por IA do manual oficial
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Identificação */}
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0' }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>Identificação do Manual</h4>
          {[
            ['Fabricante',  pub?.fabricante || plano.fabricante],
            ['Modelo',      pub?.modelo     || plano.modelo],
            ['Edição',      pub?.edicao     || '—'],
            ['Código',      pub?.codigo_pub || '—'],
            ['Série',       pub?.serie_inicio ? `${pub.serie_inicio}${pub.serie_fim ? '–'+pub.serie_fim : '+'}` : '—'],
            ['Idioma',      pub?.idioma === 'pt' ? 'Português' : pub?.idioma || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>{k}</span>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Extração */}
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0' }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>Extração IA</h4>
          {[
            ['Provider',        plano.modelo_ai ? `Gemini (${plano.modelo_ai})` : 'Gemini'],
            ['Intervalos ok',   `${intervalos.filter(iv => iv.status === 'ok').length} / ${intervalos.length}`],
            ['Tarefas',         todas.length],
            ['Com insumo/peça', `${todas.filter(t => t.insumo).length} (${Math.round(todas.filter(t => t.insumo).length / Math.max(todas.length, 1) * 100)}%)`],
            ['Extraído em',     plano.extraido_em ? new Date(plano.extraido_em).toLocaleDateString('pt-BR') : '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>{k}</span>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{v}</span>
            </div>
          ))}
          {sistemas.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Sistemas:</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {sistemas.map(s => <span key={s} style={{ padding: '2px 7px', borderRadius: 5, background: '#e0e7ff', color: '#4338ca', fontSize: 11, fontWeight: 600 }}>{s}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Distribuição por tipo */}
      <div style={{ background: '#f8fafc', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0' }}>
        <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>Distribuição por Tipo de Tarefa</h4>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(tipoFreq).sort((a, b) => b[1] - a[1]).map(([tipo, count]) => {
            const cfg = TIPO_CFG[tipo] || TIPO_CFG.outro
            return (
              <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: cfg.bg }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: cfg.color }}>{count}</span>
                <span style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Intervalos ─────────────────────────────────────────────────────────
function TabPFDIntervalos({ intervalos, intervaloAberto, setIntervaloAberto, surface, border }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {intervalos.map((iv, i) => {
          const cor = corIntervalo(iv.horas)
          const ativo = intervaloAberto === i
          return (
            <button key={i} onClick={() => setIntervaloAberto(ativo ? null : i)}
              style={{ padding: '10px 16px', borderRadius: 10, border: iv.status !== 'ok' ? '1.5px solid #fca5a5' : 'none', background: ativo ? cor : `${cor}18`, color: ativo ? '#fff' : cor, cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.2s', boxShadow: ativo ? `0 2px 8px ${cor}55` : 'none' }}>
              {iv.horas === -1 ? 'Conf.Nec.' : iv.horas === 0 ? 'Amac.' : `${iv.horas}h`}
              <span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: 0.85 }}>
                {iv.status === 'ok' ? `${iv.tarefas.length} tarefas` : iv.status === 'intervalo_nao_encontrado' ? 'não encontrado' : 'falha'}
              </span>
            </button>
          )
        })}
      </div>

      {intervaloAberto !== null && intervalos[intervaloAberto]
        ? <IntervaloDetalhe iv={intervalos[intervaloAberto]} surface={surface} border={border} />
        : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            {intervalos.map((iv, i) => {
              const cor = corIntervalo(iv.horas)
              const stExt = STATUS_EXT[iv.status] || STATUS_EXT.ok
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: i < intervalos.length - 1 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  onClick={() => setIntervaloAberto(i)}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div style={{ width: 46, height: 46, borderRadius: 9, background: `${cor}18`, color: cor, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, lineHeight: 1.1, flexShrink: 0 }}>
                    {iv.horas === -1 ? 'CN' : iv.horas === 0 ? '0' : iv.horas}<span style={{ fontSize: 8 }}>h</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{iv.nome}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{iv.tarefas.length} tarefas</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: stExt.bg, color: stExt.color }}>{stExt.label}</span>
                  <ChevronRightIcon style={{ width: 15, height: 15, color: '#9ca3af' }} />
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

// ─── Tab: Filtros / Peças ────────────────────────────────────────────────────
function TabPFDFiltros({ filtros, intervalos }) {
  if (filtros.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
      <FunnelIcon style={{ width: 36, height: 36, margin: '0 auto 10px', opacity: 0.3 }} />
      <p style={{ margin: 0 }}>Nenhuma substituição extraída.</p>
    </div>
  )

  const bySistema = {}
  filtros.forEach(t => {
    const s = t.sistema || 'Geral'
    if (!bySistema[s]) bySistema[s] = []
    bySistema[s].push(t)
  })

  function findHoras(tarefa) {
    for (const iv of intervalos) {
      if (iv.tarefas.some(t => normTarefa(t).tarefa === tarefa.tarefa)) return iv.horas
    }
    return null
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
        {filtros.length} peças/filtros identificados em {Object.keys(bySistema).length} sistemas.
      </p>
      {Object.entries(bySistema).map(([sistema, tarefas]) => (
        <div key={sistema} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, padding: '5px 0', marginBottom: 6, borderBottom: '1px solid #e2e8f0' }}>
            {sistema}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Atividade', 'Insumo / Peça', 'Cód. Peça', 'Intervalo', 'Pág.'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tarefas.map((t, i) => {
                const h = findHoras(t)
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '9px 12px', color: '#1e293b' }}>{t.tarefa}</td>
                    <td style={{ padding: '9px 12px', color: '#374151' }}>{t.insumo || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                    <td style={{ padding: '9px 12px' }}>
                      {t.codigo_peca
                        ? <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 5, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}>{t.codigo_peca}</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {h !== null && <span style={{ padding: '2px 8px', borderRadius: 20, background: `${corIntervalo(h)}18`, color: corIntervalo(h), fontSize: 11, fontWeight: 700 }}>{h === -1 ? 'Conf.Nec.' : h === 0 ? 'Amac.' : `${h}h`}</span>}
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: '#94a3b8' }}>{t.pagina_fonte || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Fluidos / Lubrificantes ────────────────────────────────────────────
function TabPFDFluidos({ fluidosUnicos, intervalos }) {
  if (fluidosUnicos.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
      <BeakerIcon style={{ width: 36, height: 36, margin: '0 auto 10px', opacity: 0.3 }} />
      <p style={{ margin: 0 }}>Nenhum fluido ou lubrificante identificado.</p>
    </div>
  )

  return (
    <div>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
        {fluidosUnicos.length} fluidos/lubrificantes únicos identificados.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['Insumo / Lubrificante', 'Sistema', 'Tipo', 'Especificação', 'Qtd', 'Aparece em'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fluidosUnicos.map((t, i) => {
            const horasAparece = intervalos
              .filter(iv => iv.tarefas.some(tk => normTarefa(tk).insumo === t.insumo))
              .map(iv => iv.horas)
            return (
              <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{t.insumo}</td>
                <td style={{ padding: '10px 14px', color: '#475569' }}>{t.sistema || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: t.tipo === 'lubrificacao' ? '#dcfce7' : '#ede9fe', color: t.tipo === 'lubrificacao' ? '#166534' : '#7c3aed' }}>
                    {t.tipo === 'lubrificacao' ? 'Lubrificação' : 'Substituição'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569' }}>{t.especificacao || '—'}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#475569' }}>{t.quantidade || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {horasAparece.map(h => (
                      <span key={h} style={{ padding: '1px 6px', borderRadius: 10, background: `${corIntervalo(h)}18`, color: corIntervalo(h), fontSize: 10, fontWeight: 700 }}>
                        {h === -1 ? 'CN' : h === 0 ? 'Amac.' : `${h}h`}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tab: Frota ──────────────────────────────────────────────────────────────
function TabPFDFrota({ frotaVinculada, frota, navigate, fabricante, modelo }) {
  return (
    <div>
      {frotaVinculada.length === 0 ? (
        <div>
          <div style={{ textAlign: 'center', padding: '24px 0 16px', color: '#9ca3af' }}>
            <TruckIcon style={{ width: 36, height: 36, margin: '0 auto 10px', opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#64748b' }}>Nenhum equipamento correspondente na frota</p>
            <p style={{ margin: '4px 0 0', fontSize: 12 }}>Cadastre equipamentos {fabricante} {modelo} em Cadastros → Equipamentos</p>
          </div>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button onClick={() => navigate('/manutencao/cadastros/equipamentos')}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              Ir para Cadastros
            </button>
          </div>
          {frota.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                Frota cadastrada ({frota.length} total — nenhum com {fabricante} / {modelo}):
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {frota.slice(0, 12).map(eq => (
                  <span key={eq.id} style={{ padding: '4px 10px', borderRadius: 20, background: '#f1f5f9', color: '#475569', fontSize: 12 }}>
                    {eq.nome} · {eq.codigo || eq.modelo || eq.tipo}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
            {frotaVinculada.length} equipamento{frotaVinculada.length > 1 ? 's' : ''} correspondente{frotaVinculada.length > 1 ? 's' : ''} na frota. Este plano se aplica a eles.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Equipamento', 'Código', 'Fabricante / Modelo', 'Horímetro', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {frotaVinculada.map(eq => (
                <tr key={eq.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{eq.nome}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {eq.codigo
                      ? <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 5, background: '#f1f5f9', color: '#334155' }}>{eq.codigo}</span>
                      : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#475569', fontSize: 12 }}>{eq.fabricante} {eq.modelo}</td>
                  <td style={{ padding: '10px 14px', color: '#374151', fontSize: 12 }}>
                    {eq.horimetro_atual ? `${Number(eq.horimetro_atual).toLocaleString('pt-BR')} h` : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: eq.ativo ? '#dcfce7' : '#f1f5f9', color: eq.ativo ? '#166534' : '#6b7280' }}>
                      {eq.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => navigate('/manutencao/operacoes/os')}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: 11 }}>
                      Gerar OS
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


function IntervaloDetalhe({ iv, surface, border }) {
  const cor = corIntervalo(iv.horas)
  const tarefas = (iv.tarefas || []).map(normTarefa)
  const sistemas = [...new Set(tarefas.map(t => t.sistema).filter(Boolean))]
  const stExt = STATUS_EXT[iv.status] || STATUS_EXT.ok
  const temCondicional = tarefas.some(t => t.condicional)

  return (
    <div style={{ background: surface, borderRadius: 12, border: `2px solid ${cor}40`, overflow: 'hidden', marginBottom: 20 }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${cor}22, ${cor}0a)`, padding: '16px 24px', borderBottom: `1px solid ${cor}30`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: cor, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, lineHeight: 1.1, flexShrink: 0 }}>
          {iv.horas === 0 ? '0' : iv.horas}<span style={{ fontSize: 9, fontWeight: 500 }}>h</span>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b' }}>{iv.nome}</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
            {tarefas.length} tarefas{sistemas.length > 0 && ` · ${sistemas.join(' · ')}`}
            {iv.periodo === 'uma_vez' && <span style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 600 }}>Única vez</span>}
            {temCondicional && <span style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 600 }}>Tem condicionais</span>}
          </p>
        </div>
        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: stExt.bg, color: stExt.color }}>
          {stExt.label}
        </span>
      </div>

      {/* Mensagem quando sem tarefas */}
      {tarefas.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: stExt.color, background: stExt.bg }}>
          <XCircleIcon style={{ width: 28, height: 28, margin: '0 auto 8px' }} />
          <p style={{ margin: 0, fontWeight: 600 }}>{stExt.label}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>
            {iv.status === 'intervalo_nao_encontrado'
              ? 'Este intervalo não foi encontrado no manual analisado.'
              : 'O intervalo foi detectado no manual mas as tarefas não puderam ser extraídas. Verifique o PDF original.'}
          </p>
        </div>
      )}

      {/* Tabela de tarefas */}
      {tarefas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Sistema', 'Componente', 'Atividade', 'Insumo / Peça', 'Cód. Peça', 'Qtd', 'Especif.'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: `1px solid ${border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tarefas.map((t, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${border}`, background: t.condicional ? '#fffbeb' : 'transparent' }}>
                  <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: `${cor}18`, color: cor, fontSize: 11, fontWeight: 700 }}>{t.sistema || '—'}</span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#475569', fontSize: 12, whiteSpace: 'nowrap' }}>{t.componente || '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ color: '#1e293b' }}>
                      {t.tarefa || '—'}
                      {t.condicional && (
                        <span style={{ marginLeft: 6, padding: '1px 5px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8', fontSize: 10, fontWeight: 700 }}>condicional</span>
                      )}
                    </div>
                    {t.aviso_seguranca && (
                      <div style={{ fontSize: 11, color: '#b45309', marginTop: 3, padding: '2px 6px', background: '#fef3c7', borderRadius: 4, display: 'inline-block' }}>⚠️ {t.aviso_seguranca}</div>
                    )}
                    {t.pontos_lubrificacao && (
                      <div style={{ fontSize: 11, color: '#0369a1', marginTop: 2 }}>📍 {t.pontos_lubrificacao}</div>
                    )}
                    {t.aplicabilidade && (
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontStyle: 'italic' }}>{t.aplicabilidade}</div>
                    )}
                    {t.observacao && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{t.observacao}</div>
                    )}
                    {t.texto_original && t.texto_original !== t.tarefa && (
                      <div style={{ fontSize: 10, color: '#b0b8c1', marginTop: 2, fontStyle: 'italic' }}>Orig: {t.texto_original}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#374151', fontSize: 12 }}>{t.insumo || '—'}</td>
                  <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    {t.codigo_peca
                      ? <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 5, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}>{t.codigo_peca}</span>
                      : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#374151', fontSize: 12, whiteSpace: 'nowrap' }}>{t.quantidade || '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#475569', fontSize: 11, maxWidth: 160 }}>{t.especificacao || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
