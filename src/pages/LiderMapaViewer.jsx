import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, ImageOverlay, Circle, CircleMarker, useMap } from 'react-leaflet'
import { supabase } from '../lib/supabase'
import 'leaflet/dist/leaflet.css'

// Corrige ícone padrão do Leaflet quebrado em builds Vite
import L from 'leaflet'
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Ajusta view ao bounds do PDF
function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [20, 20] })
  }, [map, bounds])
  return null
}

// Centraliza no ponto GPS quando solicitado
function CenterOnGps({ position, trigger }) {
  const map = useMap()
  useEffect(() => {
    if (trigger && position) map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 16), { duration: 1 })
  }, [trigger]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

const TILES = [
  { id: 'osm',       label: 'Mapa',      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                                attribution: '© OpenStreetMap' },
  { id: 'satellite', label: 'Satélite',  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
]

const S = {
  page:    { width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', fontFamily: 'system-ui, sans-serif' },
  topbar:  { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#1e293b', borderBottom: '1px solid #334155', zIndex: 1000, flexShrink: 0, flexWrap: 'wrap' },
  btn:     { padding: '6px 14px', borderRadius: 7, border: '1px solid #475569', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnAct:  { padding: '6px 14px', borderRadius: 7, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
  btnGps:  { padding: '6px 14px', borderRadius: 7, border: 'none', background: '#22c55e', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
  label:   { color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' },
  slider:  { accentColor: '#3b82f6', width: 80, cursor: 'pointer' },
  badge:   { padding: '3px 8px', borderRadius: 5, background: '#0f172a', color: '#64748b', fontSize: 11, border: '1px solid #334155', whiteSpace: 'nowrap' },
  badgeGps:{ padding: '3px 10px', borderRadius: 5, background: '#052e16', color: '#4ade80', fontSize: 11, border: '1px solid #166534', fontWeight: 700, whiteSpace: 'nowrap' },
  badgeErr:{ padding: '3px 10px', borderRadius: 5, background: '#2d1515', color: '#f87171', fontSize: 11, border: '1px solid #7f1d1d', whiteSpace: 'nowrap' },
}

// Ponto de posição GPS (dot azul pulsante + círculo de precisão)
function GpsDot({ position }) {
  if (!position) return null
  const { lat, lng, accuracy } = position
  return (
    <>
      {/* Círculo de precisão */}
      {accuracy > 0 && (
        <Circle
          center={[lat, lng]}
          radius={accuracy}
          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1.5, dashArray: '4 4' }}
        />
      )}
      {/* Dot principal */}
      <CircleMarker
        center={[lat, lng]}
        radius={10}
        pathOptions={{ color: '#fff', fillColor: '#3b82f6', fillOpacity: 1, weight: 3 }}
      />
      {/* Halo pulsante simulado */}
      <CircleMarker
        center={[lat, lng]}
        radius={18}
        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.18, weight: 0 }}
      />
    </>
  )
}

export default function LiderMapaViewer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [mapa, setMapa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [opacity, setOpacity] = useState(0.85)
  const [tile, setTile] = useState('satellite')
  const [showStreets, setShowStreets] = useState(false)

  // GPS
  const [gpsPos, setGpsPos]       = useState(null)   // { lat, lng, accuracy }
  const [gpsError, setGpsError]   = useState(null)
  const [gpsActive, setGpsActive] = useState(false)
  const [centerTrigger, setCenterTrigger] = useState(0)
  const watchIdRef = useRef(null)
  const firstFixRef = useRef(false)

  // Liga/desliga GPS
  const toggleGps = useCallback(() => {
    if (gpsActive) {
      // Desligar
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
      setGpsActive(false)
      setGpsPos(null)
      setGpsError(null)
      firstFixRef.current = false
    } else {
      // Ligar
      if (!navigator.geolocation) { setGpsError('GPS não disponível neste dispositivo'); return }
      setGpsActive(true)
      setGpsError(null)
      firstFixRef.current = false
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords
          setGpsPos({ lat, lng, accuracy: Math.round(accuracy) })
          setGpsError(null)
          // Centraliza automaticamente no primeiro fix
          if (!firstFixRef.current) {
            firstFixRef.current = true
            setCenterTrigger(t => t + 1)
          }
        },
        (err) => {
          setGpsError(err.code === 1 ? 'Permissão negada' : 'Sinal GPS fraco')
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
      )
    }
  }, [gpsActive])

  // Limpa watch ao desmontar
  useEffect(() => {
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current) }
  }, [])

  useEffect(() => {
    supabase
      .from('lider_mapas')
      .select('id, nome, tipo, imagem_url, sw_lat, sw_lng, ne_lat, ne_lng')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error) setMapa(data)
        setLoading(false)
      })
  }, [id])

  if (loading) return (
    <div style={{ ...S.page, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b', fontSize: 14 }}>Carregando mapa…</div>
    </div>
  )

  if (!mapa) return (
    <div style={{ ...S.page, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#ef4444', fontSize: 14 }}>Mapa não encontrado.</div>
    </div>
  )

  const hasGps = mapa.sw_lat != null && mapa.sw_lng != null && mapa.ne_lat != null && mapa.ne_lng != null
  const bounds = hasGps
    ? [[mapa.sw_lat, mapa.sw_lng], [mapa.ne_lat, mapa.ne_lng]]
    : null
  const center = hasGps
    ? [(mapa.sw_lat + mapa.ne_lat) / 2, (mapa.sw_lng + mapa.ne_lng) / 2]
    : [-15, -52]

  const activeTile = TILES.find(t => t.id === tile)

  return (
    <div style={S.page}>
      {/* ── Topbar ── */}
      <div style={S.topbar}>
        <button style={S.btn} onClick={() => navigate(-1)}>← Voltar</button>

        <div style={{ flex: 1, color: '#f1f5f9', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 80 }}>
          {mapa.nome}
        </div>

        {/* Tiles */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TILES.map(t => (
            <button key={t.id} style={tile === t.id ? S.btnAct : S.btn} onClick={() => setTile(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Ruas sobre satélite */}
        {tile === 'satellite' && (
          <button style={showStreets ? S.btnAct : S.btn} onClick={() => setShowStreets(v => !v)}>
            Ruas
          </button>
        )}

        {/* GPS */}
        <button
          style={gpsActive ? S.btnGps : S.btn}
          onClick={toggleGps}
          title={gpsActive ? 'Desligar GPS' : 'Ligar GPS'}
        >
          📍 {gpsActive ? 'GPS ON' : 'GPS'}
        </button>

        {/* Centralizar na posição */}
        {gpsPos && (
          <button style={S.btnAct} onClick={() => setCenterTrigger(t => t + 1)} title="Centralizar na minha posição">
            ⊕ Ir para mim
          </button>
        )}

        {/* Badge de precisão */}
        {gpsPos && (
          <span style={S.badgeGps}>±{gpsPos.accuracy}m</span>
        )}
        {gpsError && (
          <span style={S.badgeErr}>{gpsError}</span>
        )}

        {/* Opacidade */}
        <span style={S.label}>Opacidade</span>
        <input type="range" min={0} max={1} step={0.05} value={opacity}
          style={S.slider} onChange={e => setOpacity(Number(e.target.value))} />
        <span style={S.badge}>{Math.round(opacity * 100)}%</span>
      </div>

      {/* ── Mapa ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        {!hasGps && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: '#fef3c7', color: '#92400e', padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            Mapa sem coordenadas GPS — sobreposição desativada
          </div>
        )}

        <MapContainer
          center={center}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
        >
          {/* Camada base */}
          <TileLayer url={activeTile.url} attribution={activeTile.attribution} maxZoom={20} />

          {/* Ruas sobre satélite */}
          {tile === 'satellite' && showStreets && (
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
              opacity={0.45}
              maxZoom={20}
            />
          )}

          {/* PDF como overlay georeferenciado */}
          {hasGps && mapa.imagem_url && (
            <ImageOverlay
              url={mapa.imagem_url}
              bounds={bounds}
              opacity={opacity}
              zIndex={400}
            />
          )}

          {/* Ajusta view ao bounds do PDF */}
          {bounds && <FitBounds bounds={bounds} />}

          {/* Ponto GPS ao vivo */}
          <GpsDot position={gpsPos} />

          {/* Centraliza no GPS quando solicitado */}
          <CenterOnGps position={gpsPos} trigger={centerTrigger} />
        </MapContainer>
      </div>
    </div>
  )
}
