import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import 'leaflet/dist/leaflet.css'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COR_TIPO = {
  asfalto:       '#22c55e',   // verde
  terra_boa:     '#eab308',   // amarelo
  terra:         '#f97316',   // laranja
  terra_ruim:    '#ef4444',   // vermelho
  lavoura_ou_pe: '#a855f7',   // roxo
  parado:        '#94a3b8',   // cinza
  desconhecido:  '#475569',   // cinza escuro
}

function fmtDur(min) {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}
function fmtDist(m) {
  if (m == null) return '—'
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}
function fmtTs(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtVel(ms) {
  if (ms == null) return '—'
  return `${(ms * 3.6).toFixed(0)} km/h`
}

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) {
      const lats = points.map(p => p.lat)
      const lngs = points.map(p => p.lng)
      map.fitBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]], { padding: [30, 30] })
    }
  }, [points])
  return null
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const S = {
  page:    { background: '#F1F5F9', minHeight: '100vh' },
  body:    { padding: '24px 32px', maxWidth: 1200, margin: '0 auto' },
  card:    { background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px 20px', marginBottom: 16 },
  row:     { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  label:   { fontSize: 12, color: '#64748b', marginBottom: 4 },
  val:     { fontSize: 14, fontWeight: 700, color: '#1e293b' },
  btn:     (active) => ({ padding: '7px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: active ? '#3b82f6' : '#fff', color: active ? '#fff' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }),
  sessao:  (sel) => ({ padding: '12px 16px', borderRadius: 10, border: `1px solid ${sel ? '#3b82f6' : '#e2e8f0'}`, background: sel ? '#eff6ff' : '#fff', cursor: 'pointer', marginBottom: 8, transition: 'all 0.12s' }),
  tag:     (cor) => ({ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: cor, marginRight: 4 }),
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function LiderTelemetria() {
  const navigate = useNavigate()
  const [workspaces,   setWorkspaces]   = useState([])
  const [wsId,         setWsId]         = useState('')
  const [sessoes,      setSessoes]      = useState([])
  const [sessaoSel,    setSessaoSel]    = useState(null)
  const [pontos,       setPontos]       = useState([])
  const [loading,      setLoading]      = useState(false)
  const [tileMode,     setTileMode]     = useState('satellite')

  // Carrega workspaces
  useEffect(() => {
    supabase.from('workspaces').select('id, nome').order('nome')
      .then(({ data }) => {
        setWorkspaces(data ?? [])
        if (data?.length) setWsId(data[0].id)
      })
  }, [])

  // Carrega sessões do workspace
  useEffect(() => {
    if (!wsId) return
    setLoading(true)
    setSessaoSel(null)
    setPontos([])
    supabase
      .from('lider_telemetria_sessoes')
      .select(`
        id, iniciado_em, finalizado_em, distancia_total_m,
        duracao_min, pontos_count, velocidade_media_ms,
        lider_perfis!user_id ( nome, matricula )
      `)
      .eq('workspace_id', wsId)
      .order('iniciado_em', { ascending: false })
      .limit(100)
      .then(({ data }) => { setSessoes(data ?? []); setLoading(false) })
  }, [wsId])

  // Carrega pontos da sessão selecionada
  useEffect(() => {
    if (!sessaoSel) return
    supabase
      .from('lider_telemetria_pontos')
      .select('id, lat, lng, speed_ms, tipo_via, ts, accuracy_m')
      .eq('sessao_id', sessaoSel.id)
      .order('ts')
      .limit(5000)
      .then(({ data }) => setPontos(data ?? []))
  }, [sessaoSel])

  // Segmentos coloridos por tipo_via para o Polyline
  const segmentos = []
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1]
    const b = pontos[i]
    segmentos.push({ coords: [[a.lat, a.lng], [b.lat, b.lng]], tipo: b.tipo_via ?? 'desconhecido' })
  }

  const center = pontos.length ? [pontos[0].lat, pontos[0].lng] : [-15, -52]

  return (
    <div style={S.page}>
      <Header />
      <div style={S.body}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>Telemetria de Campo</h2>
        </div>

        {/* Filtro workspace */}
        <div style={S.card}>
          <div style={S.row}>
            <div>
              <div style={S.label}>WORKSPACE</div>
              <select value={wsId} onChange={e => setWsId(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
                {workspaces.map(w => <option key={w.id} value={w.id}>{w.nome}</option>)}
              </select>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>
              {sessoes.length} sessão(ões) · últimas 100
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>

          {/* Lista de sessões */}
          <div>
            {loading && <div style={{ color: '#94a3b8', fontSize: 13, padding: 8 }}>Carregando...</div>}
            {!loading && sessoes.length === 0 && (
              <div style={{ ...S.card, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                Nenhuma sessão registrada ainda.
              </div>
            )}
            {sessoes.map(s => {
              const perfil = s.lider_perfis
              const emAndamento = !s.finalizado_em
              return (
                <div key={s.id} style={S.sessao(sessaoSel?.id === s.id)}
                  onClick={() => { setSessaoSel(s); setPontos([]) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                      {perfil?.nome ?? perfil?.matricula ?? 'Líder'}
                    </div>
                    {emAndamento && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: 99 }}>
                        EM CAMPO
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{fmtTs(s.iniciado_em)}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 12, color: '#475569' }}>
                    <span>⏱ {fmtDur(s.duracao_min)}</span>
                    <span>📍 {fmtDist(s.distancia_total_m)}</span>
                    <span>🚗 {fmtVel(s.velocidade_media_ms)}</span>
                    <span style={{ color: '#94a3b8' }}>{s.pontos_count ?? 0} pts</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mapa */}
          <div style={{ borderRadius: 12, overflow: 'hidden', height: 620, border: '1px solid #e2e8f0', position: 'relative' }}>

            {/* Controles do mapa */}
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', gap: 6 }}>
              {['satellite', 'osm'].map(t => (
                <button key={t} style={S.btn(tileMode === t)} onClick={() => setTileMode(t)}>
                  {t === 'satellite' ? 'Satélite' : 'Mapa'}
                </button>
              ))}
            </div>

            {/* Legenda */}
            {pontos.length > 0 && (
              <div style={{ position: 'absolute', bottom: 24, left: 10, zIndex: 1000, background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
                {Object.entries(COR_TIPO).filter(([k]) => segmentos.some(s => s.tipo === k)).map(([tipo, cor]) => (
                  <div key={tipo} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                    <span style={S.tag(cor)} />
                    {tipo.replace('_', ' ')}
                  </div>
                ))}
              </div>
            )}

            {!sessaoSel && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: 12 }}>
                <div style={{ color: '#94a3b8', fontSize: 14 }}>Selecione uma sessão para ver o trajeto</div>
              </div>
            )}

            <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={true}>
              <TileLayer
                url={tileMode === 'satellite'
                  ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
                attribution={tileMode === 'satellite' ? '© Esri' : '© OpenStreetMap'}
                maxZoom={19}
              />

              {/* Segmentos coloridos */}
              {segmentos.map((seg, i) => (
                <Polyline key={i} positions={seg.coords}
                  pathOptions={{ color: COR_TIPO[seg.tipo] ?? '#475569', weight: 4, opacity: 0.85 }} />
              ))}

              {/* Ponto inicial (verde) e final (vermelho) */}
              {pontos.length > 0 && (
                <>
                  <CircleMarker center={[pontos[0].lat, pontos[0].lng]} radius={8}
                    pathOptions={{ color: '#fff', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }}>
                    <Tooltip permanent={false}>Início</Tooltip>
                  </CircleMarker>
                  <CircleMarker center={[pontos[pontos.length - 1].lat, pontos[pontos.length - 1].lng]} radius={8}
                    pathOptions={{ color: '#fff', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}>
                    <Tooltip permanent={false}>Fim</Tooltip>
                  </CircleMarker>
                  <FitBounds points={pontos} />
                </>
              )}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
