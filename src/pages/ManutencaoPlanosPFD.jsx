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
  CloudArrowUpIcon,
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
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
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
            {planos.length > 1 && (
              <div style={{ background: surface, borderRadius: 12, border: `1px solid ${border}`, padding: '12px 20px', marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Plano:</span>
                {planos.map(pl => (
                  <button key={pl.id} onClick={() => setPlanoAtivo(pl)} style={{
                    padding: '5px 12px', borderRadius: 20, border: 'none',
                    background: planoAtivo?.id === pl.id ? accent : '#f1f5f9',
                    color: planoAtivo?.id === pl.id ? '#fff' : '#374151',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}>
                    {pl.pfd_publicacoes?.modelo || pl.modelo} · {pl.pfd_publicacoes?.edicao || ''}
                  </button>
                ))}
              </div>
            )}

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
              <PlanoViewer
                plano={planoAtivo || planos[0]}
                intervaloAberto={intervaloAberto}
                setIntervaloAberto={setIntervaloAberto}
                accent={accent} surface={surface} border={border}
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

// ─── Viewer do plano ─────────────────────────────────────────────────────────
function PlanoViewer({ plano, intervaloAberto, setIntervaloAberto, accent, surface, border }) {
  if (!plano) return null
  const intervalos = plano.intervalos || []
  const pub = plano.pfd_publicacoes

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        borderRadius: 12, padding: 24, marginBottom: 20, color: '#fff',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <TruckIcon style={{ width: 40, height: 40, color: '#4ade80', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
            {pub?.fabricante || plano.fabricante} {pub?.modelo || plano.modelo}
          </h2>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
            {pub?.titulo || 'Manual do Operador'}
            {pub?.edicao && ` · ${pub.edicao}`}
            {pub?.serie_inicio && ` · Série ${pub.serie_inicio}${pub.serie_fim ? `–${pub.serie_fim}` : '+'}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
          <Stat label="Intervalos" value={plano.total_intervalos} color="#4ade80" />
          <Stat label="Tarefas" value={plano.total_tarefas} color="#60a5fa" />
          <Stat label="Páginas" value={plano.paginas_usadas?.length || '—'} color="#f472b6" />
        </div>
      </div>

      {/* Mapa de intervalos */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {intervalos.map((iv, i) => (
          <button key={i} onClick={() => setIntervaloAberto(intervaloAberto === i ? null : i)}
            style={{
              padding: '10px 18px', borderRadius: 10, border: 'none',
              background: intervaloAberto === i ? corIntervalo(iv.horas) : `${corIntervalo(iv.horas)}18`,
              color: intervaloAberto === i ? '#fff' : corIntervalo(iv.horas),
              cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.2s',
              boxShadow: intervaloAberto === i ? `0 2px 8px ${corIntervalo(iv.horas)}55` : 'none',
            }}>
            {iv.horas}h
            <span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: 0.8 }}>
              {iv.tarefas?.length || 0} tarefa{iv.tarefas?.length !== 1 ? 's' : ''}
            </span>
          </button>
        ))}
      </div>

      {/* Detalhe do intervalo */}
      {intervaloAberto !== null && intervalos[intervaloAberto] && (
        <IntervaloDetalhe iv={intervalos[intervaloAberto]} surface={surface} border={border} />
      )}

      {/* Lista resumida */}
      {intervaloAberto === null && (
        <div style={{ background: surface, borderRadius: 12, border: `1px solid ${border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${border}` }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>Todos os Intervalos</span>
            <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>Clique em um intervalo acima para ver detalhes</span>
          </div>
          {intervalos.map((iv, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${border}`, cursor: 'pointer', transition: 'background 0.15s' }}
              onClick={() => setIntervaloAberto(i)}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px' }}>
                <span style={{
                  width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                  background: `${corIntervalo(iv.horas)}18`, color: corIntervalo(iv.horas),
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 15, lineHeight: 1.1,
                }}>
                  {iv.horas}
                  <span style={{ fontSize: 9, fontWeight: 600 }}>h</span>
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{iv.nome || `A cada ${iv.horas} horas`}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    {iv.tarefas?.length || 0} tarefa{iv.tarefas?.length !== 1 ? 's' : ''}
                    {iv.tarefas?.length > 0 && ` · ${[...new Set(iv.tarefas.map(t => t.sistema).filter(Boolean))].join(', ')}`}
                  </div>
                </div>
                <ChevronRightIcon style={{ width: 16, height: 16, color: '#9ca3af' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IntervaloDetalhe({ iv, surface, border }) {
  const cor = corIntervalo(iv.horas)
  const sistemas = [...new Set((iv.tarefas || []).map(t => t.sistema).filter(Boolean))]
  return (
    <div style={{ background: surface, borderRadius: 12, border: `2px solid ${cor}40`, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ background: `linear-gradient(135deg, ${cor}22, ${cor}0a)`, padding: '16px 24px', borderBottom: `1px solid ${cor}30`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: cor, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, lineHeight: 1.1, flexShrink: 0 }}>
          {iv.horas}<span style={{ fontSize: 9, fontWeight: 500 }}>h</span>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b' }}>{iv.nome || `A cada ${iv.horas} horas`}</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
            {iv.tarefas?.length || 0} tarefas{sistemas.length > 0 && ` · ${sistemas.join(' · ')}`}
          </p>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Sistema', 'Tarefa', 'Lubrificante / Fluido', 'Capacidade'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: `1px solid ${border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(iv.tarefas || []).map((t, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${border}` }}>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: `${cor}18`, color: cor, fontSize: 11, fontWeight: 700 }}>{t.sistema || '—'}</span>
                </td>
                <td style={{ padding: '10px 16px', color: '#1e293b' }}>{t.tarefa || '—'}</td>
                <td style={{ padding: '10px 16px', color: '#374151', fontSize: 12 }}>{t.codigo_lubrificante || t.codigo || '—'}</td>
                <td style={{ padding: '10px 16px', color: '#374151', fontSize: 12 }}>
                  {t.capacidade ? `${t.capacidade}${t.unidade ? ' ' + t.unidade : ''}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{label}</div>
    </div>
  )
}
