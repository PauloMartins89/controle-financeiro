import { useState, useEffect, useCallback, useRef } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import {
  PlusIcon, TrashIcon, PencilIcon, ArrowPathIcon,
  MagnifyingGlassIcon, MapIcon, XMarkIcon,
  ArrowUpTrayIcon, CodeBracketIcon, CheckIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import * as pdfjsLib from 'pdfjs-dist'

// Worker do pdfjs (Vite resolve via import.meta.url)
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs'
}

// Extrai coordenadas GPS do PDF via API serverless
async function extrairGPSdoPDF(file) {
  const arrayBuffer = await file.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
  const res = await fetch('/api/extrair-gps-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64: base64 }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.found ? data : null
}

// Renderiza página 1 do PDF para Blob PNG (scale 3x ≈ 216 DPI)
async function renderPdfToBlob(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer()
  onProgress(15)
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  onProgress(35)
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 3.0 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  onProgress(75)
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png'))
}

// ─── Paleta ────────────────────────────────────────────────────────────────
const S = {
  pageBg:    '#F1F5F9',
  card:      '#FFFFFF',
  border:    '#E2E8F0',
  shadow:    '0 1px 3px rgba(0,0,0,0.08)',
  text:      '#0F172A',
  textSub:   '#64748B',
  primary:   '#22C55E',
  primaryDk: '#15803D',
  red:       '#EF4444',
  yellow:    '#F59E0B',
  blue:      '#3B82F6',
}

const TIPOS = ['acesso', 'microplanejamento', 'outro']
const TIPO_LABEL = { acesso: 'Acesso', microplanejamento: 'Microplanejamento', outro: 'Outro' }
const TIPO_COLOR = { acesso: '#3B82F6', microplanejamento: '#8B5CF6', outro: '#64748B' }

function fmtBytes(b) {
  if (!b) return '—'
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`
  return `${(b / 1024).toFixed(0)} KB`
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtCoord(v) {
  if (v == null) return '—'
  return Number(v).toFixed(5) + '°'
}

// ─── Modal genérico ─────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: S.card, borderRadius: 12, padding: 28,
        width, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: S.text }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.textSub, fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: S.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inp = {
  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, color: S.text,
  border: `1px solid ${S.border}`, background: S.pageBg, outline: 'none', boxSizing: 'border-box',
}

// ─── Card de mapa ────────────────────────────────────────────────────────────
function MapCard({ mapa, onRename, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: S.card, borderRadius: 12, border: `1px solid ${S.border}`,
        boxShadow: hover ? '0 4px 16px rgba(0,0,0,0.10)' : S.shadow,
        overflow: 'hidden', transition: 'box-shadow 0.15s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', height: 140, background: '#0f172a', overflow: 'hidden' }}>
        {mapa.imagem_url ? (
          <img
            src={mapa.imagem_url}
            alt={mapa.nome}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <MapIcon style={{ width: 40, height: 40, color: '#475569' }} />
          </div>
        )}
        {/* Tipo badge */}
        <span style={{
          position: 'absolute', top: 8, left: 8,
          background: TIPO_COLOR[mapa.tipo] ?? S.textSub,
          color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px',
          borderRadius: 999, textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          {TIPO_LABEL[mapa.tipo] ?? mapa.tipo}
        </span>
      </div>

      {/* Conteúdo */}
      <div style={{ padding: '12px 16px', flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: S.text, marginBottom: 4, lineHeight: 1.3 }}>
          {mapa.nome}
        </div>
        {(mapa.sw_lat != null) && (
          <div style={{ fontSize: 11, color: S.textSub, marginBottom: 2 }}>
            SW {fmtCoord(mapa.sw_lat)}, {fmtCoord(mapa.sw_lng)}
          </div>
        )}
        {(mapa.ne_lat != null) && (
          <div style={{ fontSize: 11, color: S.textSub, marginBottom: 6 }}>
            NE {fmtCoord(mapa.ne_lat)}, {fmtCoord(mapa.ne_lng)}
          </div>
        )}
        <div style={{ fontSize: 11, color: S.textSub }}>
          {fmtBytes(mapa.tamanho_bytes)} · {fmtDate(mapa.criado_em)}
        </div>
      </div>

      {/* Ações */}
      <div style={{
        display: 'flex', borderTop: `1px solid ${S.border}`,
      }}>
        <button onClick={() => onRename(mapa)} style={{
          flex: 1, padding: '9px 0', border: 'none', background: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          fontSize: 12, fontWeight: 600, color: S.textSub,
          borderRight: `1px solid ${S.border}`,
          transition: 'background 0.12s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = S.pageBg}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <PencilIcon style={{ width: 14, height: 14 }} /> Renomear
        </button>
        <button onClick={() => onDelete(mapa)} style={{
          flex: 1, padding: '9px 0', border: 'none', background: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          fontSize: 12, fontWeight: 600, color: S.red,
          transition: 'background 0.12s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <TrashIcon style={{ width: 14, height: 14 }} /> Excluir
        </button>
      </div>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function LiderMapas() {
  const [workspaces,   setWorkspaces]   = useState([])
  const [wsId,         setWsId]         = useState('')
  const [wsSearch,     setWsSearch]     = useState('')
  const [mapas,        setMapas]        = useState([])
  const [loading,      setLoading]      = useState(false)
  const [loadingWs,    setLoadingWs]    = useState(true)
  const [modalAdd,     setModalAdd]     = useState(false)
  const [modalRename,  setModalRename]  = useState(null)  // mapa obj
  const [modalDelete,  setModalDelete]  = useState(null)  // mapa obj
  const [saving,       setSaving]       = useState(false)
  const [novoNome,     setNovoNome]     = useState('')
  const [converting,   setConverting]   = useState(false)  // PDF → PNG em andamento
  const fileRef = useRef(null)

  const emptyForm = { nome: '', tipo: 'acesso', swLat: '', swLng: '', neLat: '', neLng: '', file: null, imgUrl: '' }
  const [form, setForm] = useState(emptyForm)
  const [uploadMode, setUploadMode] = useState('file') // 'file' | 'url'
  const [uploadProgress, setUploadProgress] = useState(0)
  const [gpsAutoExtracted, setGpsAutoExtracted] = useState(false) // GPS extraído automaticamente do PDF

  // ── Carrega workspaces ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('workspaces')
      .select('id, nome')
      .eq('tipo', 'empresa')
      .order('nome')
      .then(({ data }) => { setWorkspaces(data || []); setLoadingWs(false) })
  }, [])

  // ── Carrega mapas do workspace selecionado ──────────────────────────────
  const loadMapas = useCallback(async (wid) => {
    if (!wid) return
    setLoading(true)
    const { data, error } = await supabase
      .from('lider_mapas')
      .select('id, nome, tipo, imagem_url, tamanho_bytes, sw_lat, sw_lng, ne_lat, ne_lng, criado_em')
      .eq('workspace_id', wid)
      .order('criado_em', { ascending: false })
    if (error) toast.error('Erro ao carregar mapas')
    setMapas(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadMapas(wsId) }, [wsId, loadMapas])

  // ── Excluir mapa ────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!modalDelete) return
    setSaving(true)
    try {
      // Remove do storage
      const fname = modalDelete.imagem_url?.split('/').pop()?.split('?')[0]
      if (fname) {
        await supabase.storage.from('mapas-lider').remove([fname])
      }
      // Remove do banco
      const { error } = await supabase.from('lider_mapas').delete().eq('id', modalDelete.id)
      if (error) throw error
      toast.success(`"${modalDelete.nome}" excluído`)
      setMapas(prev => prev.filter(m => m.id !== modalDelete.id))
      setModalDelete(null)
    } catch (e) {
      toast.error('Erro ao excluir: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Renomear mapa ───────────────────────────────────────────────────────
  const handleRename = async () => {
    if (!modalRename || !novoNome.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('lider_mapas')
      .update({ nome: novoNome.trim() })
      .eq('id', modalRename.id)
    if (error) {
      toast.error('Erro ao renomear')
    } else {
      toast.success('Mapa renomeado')
      setMapas(prev => prev.map(m => m.id === modalRename.id ? { ...m, nome: novoNome.trim() } : m))
      setModalRename(null)
    }
    setSaving(false)
  }

  // ── Adicionar mapa (upload imagem + coords) ─────────────────────────────
  const handleAdd = async () => {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    if (!wsId) { toast.error('Selecione um workspace'); return }

    // Valida coordenadas GPS — obrigatórias para cursor funcional no app
    const swLat = parseFloat(String(form.swLat).replace(',', '.'))
    const swLng = parseFloat(String(form.swLng).replace(',', '.'))
    const neLat = parseFloat(String(form.neLat).replace(',', '.'))
    const neLng = parseFloat(String(form.neLng).replace(',', '.'))
    if (!form.swLat || !form.swLng || !form.neLat || !form.neLng ||
        isNaN(swLat) || isNaN(swLng) || isNaN(neLat) || isNaN(neLng)) {
      toast.error('Coordenadas GPS obrigatórias. Use o script Python para GeoPDFs com GPS automático.')
      return
    }
    if (swLat < -90 || swLat > 90 || neLat < -90 || neLat > 90) {
      toast.error('Latitude inválida (deve estar entre -90 e 90)')
      return
    }
    if (swLng < -180 || swLng > 180 || neLng < -180 || neLng > 180) {
      toast.error('Longitude inválida (deve estar entre -180 e 180)')
      return
    }
    if (swLat >= neLat) {
      toast.error('SW Latitude deve ser menor que NE Latitude (SW = sul, NE = norte)')
      return
    }
    if (swLng >= neLng) {
      toast.error('SW Longitude deve ser menor que NE Longitude (SW = oeste, NE = leste)')
      return
    }
    setSaving(true)
    setUploadProgress(0)
    try {
      let publicUrl = ''
      let sizeBytes = 0
      const fileId = crypto.randomUUID()

      if (uploadMode === 'file') {
        if (!form.file) { toast.error('Selecione uma imagem'); setSaving(false); return }
        const ext = form.file.name.split('.').pop().toLowerCase()
        const path = `${fileId}.${ext}`
        setUploadProgress(30)
        const { error: upErr } = await supabase.storage
          .from('mapas-lider')
          .upload(path, form.file, { contentType: form.file.type, upsert: true })
        if (upErr) throw upErr
        setUploadProgress(70)
        const { data: urlData } = supabase.storage.from('mapas-lider').getPublicUrl(path)
        publicUrl = urlData.publicUrl
        sizeBytes = form.file.size
      } else {
        if (!form.imgUrl.trim()) { toast.error('Informe a URL da imagem'); setSaving(false); return }
        publicUrl = form.imgUrl.trim()
      }

      setUploadProgress(85)
      const record = {
        id:            fileId,
        workspace_id:  wsId,
        nome:          form.nome.trim(),
        tipo:          form.tipo,
        imagem_url:    publicUrl,
        tamanho_bytes: sizeBytes || null,
        ativo:         true,
      }
      record.sw_lat = swLat
      record.sw_lng = swLng
      record.ne_lat = neLat
      record.ne_lng = neLng

      const { error: insErr } = await supabase.from('lider_mapas').insert(record)
      if (insErr) throw insErr

      setUploadProgress(100)
      toast.success(`"${form.nome.trim()}" adicionado!`)
      setForm(emptyForm)
      setModalAdd(false)
      loadMapas(wsId)
    } catch (e) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
      setUploadProgress(0)
    }
  }

  const wsFiltrados = workspaces.filter(w =>
    !wsSearch || w.nome.toLowerCase().includes(wsSearch.toLowerCase())
  )
  const wsAtual = workspaces.find(w => w.id === wsId)

  return (
    <div style={{ minHeight: '100vh', background: S.pageBg }}>
      <Header title="Mapas de Campo" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Seletor de workspace ── */}
        <div style={{
          background: S.card, borderRadius: 12, border: `1px solid ${S.border}`,
          padding: '16px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <MapIcon style={{ width: 20, height: 20, color: S.primary, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: S.textSub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
              Workspace (cliente)
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
                <MagnifyingGlassIcon style={{ width: 14, height: 14, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: S.textSub }} />
                <input
                  style={{ ...inp, paddingLeft: 30 }}
                  placeholder="Buscar workspace..."
                  value={wsSearch}
                  onChange={e => setWsSearch(e.target.value)}
                />
              </div>
              <select
                style={{ ...inp, maxWidth: 320 }}
                value={wsId}
                onChange={e => { setWsId(e.target.value); setMapas([]) }}
              >
                <option value="">Selecione um workspace...</option>
                {wsFiltrados.map(w => (
                  <option key={w.id} value={w.id}>{w.nome}</option>
                ))}
              </select>
            </div>
          </div>
          {wsId && (
            <button
              onClick={() => setModalAdd(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                background: S.primary, color: '#fff', border: 'none', borderRadius: 8,
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              <PlusIcon style={{ width: 16, height: 16 }} /> Adicionar Mapa
            </button>
          )}
          {wsId && (
            <button
              onClick={() => loadMapas(wsId)}
              style={{ padding: 8, background: 'none', border: `1px solid ${S.border}`, borderRadius: 8, cursor: 'pointer', color: S.textSub }}
              title="Recarregar"
            >
              <ArrowPathIcon style={{ width: 15, height: 15 }} />
            </button>
          )}
        </div>

        {/* ── Dica GeoPDF ── */}
        {wsId && (
          <div style={{
            background: '#0f172a', borderRadius: 12, padding: '14px 18px',
            marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <CodeBracketIcon style={{ width: 18, height: 18, color: '#4ade80', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>
                Importar GeoPDF (com GPS automático)
              </div>
              <code style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', display: 'block', lineHeight: 1.7 }}>
                python scripts/geopdf_to_supabase.py arquivo.pdf --workspace {wsId} --dpi 600<br />
                python scripts/geopdf_to_supabase.py arquivo.pdf --workspace {wsId} --dpi 600 --replace
              </code>
            </div>
          </div>
        )}

        {/* ── Lista de mapas ── */}
        {!wsId && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: S.textSub }}>
            <MapIcon style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>Selecione um workspace para ver os mapas</div>
          </div>
        )}

        {wsId && loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: S.textSub, fontSize: 14 }}>
            Carregando mapas...
          </div>
        )}

        {wsId && !loading && mapas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: S.textSub }}>
            <MapIcon style={{ width: 40, height: 40, margin: '0 auto 10px', opacity: 0.25 }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>Nenhum mapa cadastrado</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Importe um GeoPDF pelo terminal ou clique em "Adicionar Mapa"</div>
          </div>
        )}

        {mapas.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: S.textSub, marginBottom: 12, fontWeight: 600 }}>
              {mapas.length} mapa{mapas.length !== 1 ? 's' : ''} · {wsAtual?.nome}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}>
              {mapas.map(m => (
                <MapCard
                  key={m.id}
                  mapa={m}
                  onRename={mapa => { setModalRename(mapa); setNovoNome(mapa.nome) }}
                  onDelete={mapa => setModalDelete(mapa)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Modal: Adicionar mapa ── */}
      {modalAdd && (
        <Modal title="Adicionar Mapa" onClose={() => { setModalAdd(false); setForm(emptyForm); setGpsAutoExtracted(false) }} width={520}>
          <Field label="Nome do mapa *">
            <input style={inp} placeholder="Ex: Fazenda Boa Vista — Acesso" value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </Field>

          <Field label="Tipo">
            <select style={inp} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
          </Field>

          {/* Imagem */}
          <Field label="Imagem">
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {['file', 'url'].map(m => (
                <button key={m} onClick={() => setUploadMode(m)} style={{
                  flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${S.border}`,
                  fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  background: uploadMode === m ? S.primary : 'transparent',
                  color: uploadMode === m ? '#fff' : S.textSub,
                }}>
                  {m === 'file' ? '📁 Upload arquivo' : '🔗 URL da imagem'}
                </button>
              ))}
            </div>
            {uploadMode === 'file' ? (
              <div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/tiff,application/pdf,.pdf" style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files[0]
                    if (!file) return
                    const nomeSugerido = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
                    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                      setConverting(true)
                      setGpsAutoExtracted(false)
                      setUploadProgress(5)
                      try {
                        // Executa conversão PNG e extração GPS em paralelo
                        const [blob, gpsData] = await Promise.all([
                          renderPdfToBlob(file, setUploadProgress),
                          extrairGPSdoPDF(file),
                        ])
                        const pngFile = new File([blob], file.name.replace(/\.pdf$/i, '.png'), { type: 'image/png' })
                        setForm(f => ({
                          ...f,
                          file: pngFile,
                          nome: f.nome.trim() ? f.nome : nomeSugerido,
                          ...(gpsData ? {
                            swLat: String(gpsData.sw_lat),
                            swLng: String(gpsData.sw_lng),
                            neLat: String(gpsData.ne_lat),
                            neLng: String(gpsData.ne_lng),
                          } : {})
                        }))
                        if (gpsData) {
                          setGpsAutoExtracted(true)
                          toast.success('GPS extraído automaticamente do PDF!')
                        } else {
                          toast('PDF convertido. Insira as coordenadas GPS manualmente.', { icon: '⚠️' })
                        }
                      } catch (err) {
                        toast.error('Erro ao converter PDF: ' + err.message)
                      } finally {
                        setConverting(false)
                        setUploadProgress(0)
                      }
                    } else if (file.type.startsWith('image/')) {
                      setGpsAutoExtracted(false)
                      setForm(f => ({ ...f, file, nome: f.nome.trim() ? f.nome : nomeSugerido }))
                    } else {
                      toast.error('Formato não suportado. Use PNG, JPG ou PDF.')
                      e.target.value = ''
                    }
                  }} />
                <button onClick={() => fileRef.current?.click()} disabled={converting} style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, border: `2px dashed ${S.border}`,
                  background: S.pageBg, cursor: converting ? 'default' : 'pointer', fontSize: 13, color: S.textSub,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <ArrowUpTrayIcon style={{ width: 16, height: 16 }} />
                  {converting ? 'Convertendo PDF...' : form.file ? form.file.name : 'Selecionar PNG, JPG ou PDF'}
                </button>
              </div>
            ) : (
              <input style={inp} placeholder="https://..." value={form.imgUrl}
                onChange={e => setForm(f => ({ ...f, imgUrl: e.target.value }))} />
            )}
          </Field>

          {/* Coordenadas */}
          <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 14, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: S.textSub, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Coordenadas WGS84 (graus decimais) *
              </div>
              {gpsAutoExtracted
                ? <span style={{ fontSize: 10, color: '#15803D', fontWeight: 700, background: '#DCFCE7', borderRadius: 999, padding: '1px 7px' }}>📍 Extraído do PDF</span>
                : <span style={{ fontSize: 10, color: S.yellow, fontWeight: 700, background: '#FEF3C7', borderRadius: 999, padding: '1px 7px' }}>Obrigatório</span>
              }
            </div>
            <div style={{ fontSize: 12, color: S.textSub, marginBottom: 10, lineHeight: 1.5, background: '#F0FDF4', border: `1px solid #BBF7D0`, borderRadius: 8, padding: '8px 12px' }}>
              📌 Sem coordenadas, o cursor GPS não funciona no app.<br/>
              Para GeoPDFs, use o script Python (GPS automático).
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="SW Latitude *">
                <input style={{ ...inp, borderColor: form.swLat ? S.border : S.yellow }} placeholder="-20.1234" value={form.swLat}
                  onChange={e => setForm(f => ({ ...f, swLat: e.target.value }))} />
              </Field>
              <Field label="SW Longitude *">
                <input style={{ ...inp, borderColor: form.swLng ? S.border : S.yellow }} placeholder="-51.4567" value={form.swLng}
                  onChange={e => setForm(f => ({ ...f, swLng: e.target.value }))} />
              </Field>
              <Field label="NE Latitude *">
                <input style={{ ...inp, borderColor: form.neLat ? S.border : S.yellow }} placeholder="-19.9876" value={form.neLat}
                  onChange={e => setForm(f => ({ ...f, neLat: e.target.value }))} />
              </Field>
              <Field label="NE Longitude *">
                <input style={{ ...inp, borderColor: form.neLng ? S.border : S.yellow }} placeholder="-51.1234" value={form.neLng}
                  onChange={e => setForm(f => ({ ...f, neLng: e.target.value }))} />
              </Field>
            </div>
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div style={{ marginTop: 8, height: 4, background: S.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${uploadProgress}%`, height: '100%', background: S.primary, transition: 'width 0.3s' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => { setModalAdd(false); setForm(emptyForm) }} style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${S.border}`,
              background: 'transparent', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: S.textSub,
            }}>Cancelar</button>
            <button onClick={handleAdd} disabled={saving} style={{
              flex: 2, padding: '10px 0', borderRadius: 8, border: 'none',
              background: saving ? '#86EFAC' : S.primary, color: '#fff',
              fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {saving ? 'Enviando...' : <><PlusIcon style={{ width: 16, height: 16 }} /> Adicionar</>}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Renomear ── */}
      {modalRename && (
        <Modal title="Renomear Mapa" onClose={() => setModalRename(null)}>
          <Field label="Novo nome">
            <input style={inp} value={novoNome} onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()} autoFocus />
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setModalRename(null)} style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${S.border}`,
              background: 'transparent', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: S.textSub,
            }}>Cancelar</button>
            <button onClick={handleRename} disabled={saving || !novoNome.trim()} style={{
              flex: 2, padding: '10px 0', borderRadius: 8, border: 'none',
              background: S.primary, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <CheckIcon style={{ width: 16, height: 16 }} /> Salvar
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Confirmar exclusão ── */}
      {modalDelete && (
        <Modal title="Excluir Mapa" onClose={() => setModalDelete(null)}>
          <p style={{ fontSize: 14, color: S.text, marginBottom: 20, lineHeight: 1.6 }}>
            Tem certeza que deseja excluir o mapa <strong>"{modalDelete.nome}"</strong>?<br />
            <span style={{ color: S.red, fontSize: 12 }}>Esta ação não pode ser desfeita. A imagem será removida do storage.</span>
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setModalDelete(null)} style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${S.border}`,
              background: 'transparent', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: S.textSub,
            }}>Cancelar</button>
            <button onClick={handleDelete} disabled={saving} style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
              background: saving ? '#FCA5A5' : S.red, color: '#fff',
              fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <TrashIcon style={{ width: 15, height: 15 }} /> {saving ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
