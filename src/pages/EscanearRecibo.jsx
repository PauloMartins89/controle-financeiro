import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import Header from '../components/Header'
import useStore from '../store/useStore'
import { CATEGORIAS } from '../lib/utils'

// ── Perspective Math ───────────────────────────────────────────────────────────
function gaussianElimination(A, b) {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++)
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
    ;[M[col], M[maxRow]] = [M[maxRow], M[col]]
    if (Math.abs(M[col][col]) < 1e-10) continue
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col]
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j]
    }
  }
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n]
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j]
    x[i] /= M[i][i]
  }
  return x
}

function computeHomography(src, dst) {
  const A = [], b = []
  for (let i = 0; i < 4; i++) {
    const [sx, sy] = src[i], [dx, dy] = dst[i]
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy])
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy])
    b.push(dx, dy)
  }
  const h = gaussianElimination(A, b)
  return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]]
}

function applyH(H, x, y) {
  const w = H[2][0] * x + H[2][1] * y + H[2][2]
  return [
    (H[0][0] * x + H[0][1] * y + H[0][2]) / w,
    (H[1][0] * x + H[1][1] * y + H[1][2]) / w,
  ]
}

function warpPerspective(srcCanvas, corners, outW, outH) {
  const dst = [[0, 0], [outW, 0], [outW, outH], [0, outH]]
  // H maps destination -> source (inverse)
  const H = computeHomography(dst, corners)

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const ctx = out.getContext('2d')
  const srcCtx = srcCanvas.getContext('2d')
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data
  const outImg = ctx.createImageData(outW, outH)
  const sw = srcCanvas.width, sh = srcCanvas.height

  for (let dy = 0; dy < outH; dy++) {
    for (let dx = 0; dx < outW; dx++) {
      const [sx, sy] = applyH(H, dx, dy)
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) continue
      // Bilinear interpolation
      const x0 = Math.floor(sx), y0 = Math.floor(sy)
      const x1 = x0 + 1, y1 = y0 + 1
      const fx = sx - x0, fy = sy - y0
      const di = (dy * outW + dx) * 4
      for (let c = 0; c < 3; c++) {
        const t = srcData[(y0 * sw + x0) * 4 + c] * (1 - fx) + srcData[(y0 * sw + x1) * 4 + c] * fx
        const bt = srcData[(y1 * sw + x0) * 4 + c] * (1 - fx) + srcData[(y1 * sw + x1) * 4 + c] * fx
        outImg.data[di + c] = Math.round(t * (1 - fy) + bt * fy)
      }
      outImg.data[di + 3] = 255
    }
  }
  ctx.putImageData(outImg, 0, 0)
  return out
}

// ── Categoria mapping ──────────────────────────────────────────────────────────
const CAT_MAP = {
  alimentacao: 'Alimentação', transporte: 'Transporte', saude: 'Saúde',
  lazer: 'Lazer', moradia: 'Moradia', educacao: 'Educação',
  vestuario: 'Vestuário', servicos: 'Serviços', outros: 'Outros',
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function EscanearRecibo() {
  const navigate = useNavigate()
  const { addExpense, people } = useStore()

  const [step, setStep] = useState('upload') // upload | adjust | scanning | result
  const [imgSrc, setImgSrc] = useState(null)
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 })
  const [corners, setCorners] = useState([[0, 0], [0, 0], [0, 0], [0, 0]])
  const [dragging, setDragging] = useState(null)
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)

  const containerRef = useRef()
  const fileRef = useRef()
  const srcCanvas = useRef(document.createElement('canvas'))

  const DISPLAY_MAX = Math.min(typeof window !== 'undefined' ? window.innerWidth - 48 : 400, 480)
  const displayW = DISPLAY_MAX
  const displayH = imgSize.w > 0 ? Math.round(displayW * imgSize.h / imgSize.w) : 480
  const scaleX = imgSize.w > 0 ? displayW / imgSize.w : 1
  const scaleY = imgSize.h > 0 ? displayH / imgSize.h : 1

  function loadImage(file) {
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      srcCanvas.current.width = img.width
      srcCanvas.current.height = img.height
      srcCanvas.current.getContext('2d').drawImage(img, 0, 0)
      setImgSrc(url)
      setImgSize({ w: img.width, h: img.height })
      const iw = img.width, ih = img.height
      const px = iw * 0.05, py = ih * 0.05
      setCorners([[px, py], [iw - px, py], [iw - px, ih - py], [px, ih - py]])
      setStep('adjust')
    }
    img.onerror = () => toast.error('Erro ao carregar imagem')
    img.src = url
  }

  function getDisplayCorners() {
    return corners.map(([x, y]) => [x * scaleX, y * scaleY])
  }

  function handlePointerDown(idx, e) {
    e.preventDefault()
    e.stopPropagation()
    setDragging(idx)
  }

  function handlePointerMove(e) {
    if (dragging === null) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0
    const nx = Math.max(0, Math.min(imgSize.w, (clientX - rect.left) / scaleX))
    const ny = Math.max(0, Math.min(imgSize.h, (clientY - rect.top) / scaleY))
    setCorners(prev => prev.map((c, i) => i === dragging ? [nx, ny] : c))
  }

  function handlePointerUp() { setDragging(null) }

  async function handleScan() {
    setStep('scanning')
    try {
      const [tl, tr, br, bl] = corners
      const outW = Math.round(Math.max(
        Math.hypot(tr[0] - tl[0], tr[1] - tl[1]),
        Math.hypot(br[0] - bl[0], br[1] - bl[1]),
        20
      ))
      const outH = Math.round(Math.max(
        Math.hypot(bl[0] - tl[0], bl[1] - tl[1]),
        Math.hypot(br[0] - tr[0], br[1] - tr[1]),
        20
      ))

      const warped = warpPerspective(srcCanvas.current, corners, outW, outH)
      const warpedUrl = warped.toDataURL('image/jpeg', 0.85)
      const b64 = warpedUrl.split(',')[1]

      const resp = await fetch('/api/ocr-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64 }),
      })

      if (!resp.ok) throw new Error('Erro na API de OCR')
      const data = await resp.json()
      if (data.error) throw new Error(data.error)

      setResult({
        descricao: data.descricao || '',
        valor: String(data.valor || '0'),
        data: data.data || new Date().toISOString().slice(0, 10),
        categoria: CAT_MAP[data.categoria] || 'Outros',
        warpedUrl,
      })
      setStep('result')
    } catch (e) {
      toast.error('Falha ao escanear: ' + e.message)
      setStep('adjust')
    }
  }

  async function handleSave() {
    if (!result.descricao || !result.valor) {
      toast.error('Preencha descrição e valor')
      return
    }
    setSaving(true)
    try {
      const owner = people.find(p => p.is_owner)
      await addExpense({
        descricao: result.descricao,
        valor: parseFloat(String(result.valor).replace(',', '.')),
        data: result.data,
        categoria: result.categoria,
        pago_por: owner?.id || people[0]?.id || null,
        participantes: owner ? [owner.id] : [],
        tipo_divisao: 'igual',
        status: 'pendente',
      })
      toast.success('Despesa registrada!')
      navigate('/despesas')
    } catch (e) {
      toast.error('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const dCorners = getDisplayCorners()
  const polygonPoints = dCorners.map(([x, y]) => `${x},${y}`).join(' ')

  return (
    <div style={{ padding: '0 0 60px' }}>
      <Header title="Escanear Documento" subtitle="Extraia despesas de comprovantes e notas fiscais" />

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px' }}>

        {/* ── UPLOAD ── */}
        {step === 'upload' && (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📄</div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Escanear Comprovante</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 28, fontSize: 14, lineHeight: 1.6 }}>
              Fotografe ou envie uma imagem de comprovante, nota fiscal ou recibo.<br />
              A IA extrai os dados automaticamente.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  fileRef.current.setAttribute('capture', 'environment')
                  fileRef.current.click()
                }}
              >
                📷 Usar Câmera
              </button>
              <button
                onClick={() => {
                  fileRef.current.removeAttribute('capture')
                  fileRef.current.click()
                }}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
              >
                🖼️ Da Galeria
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => e.target.files[0] && loadImage(e.target.files[0])}
            />
            <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-secondary)' }}>
              Formatos: JPG, PNG, WEBP
            </p>
          </div>
        )}

        {/* ── ADJUST CORNERS ── */}
        {step === 'adjust' && (
          <div>
            <div className="card" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 18 }}>💡</span>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Arraste os <strong style={{ color: 'var(--text-primary)' }}>4 pontos verdes</strong> para delimitar o documento
              </p>
            </div>

            <div
              ref={containerRef}
              style={{
                position: 'relative', width: displayW, height: displayH,
                touchAction: 'none', userSelect: 'none',
                borderRadius: 12, overflow: 'hidden',
                cursor: dragging !== null ? 'grabbing' : 'crosshair',
                border: '2px solid var(--border)',
              }}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchMove={e => { e.preventDefault(); handlePointerMove(e.touches[0]) }}
              onTouchEnd={handlePointerUp}
            >
              <img
                src={imgSrc}
                style={{ width: displayW, height: displayH, display: 'block', objectFit: 'fill' }}
                alt="documento"
                draggable={false}
              />
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <mask id="docMask">
                    <rect width={displayW} height={displayH} fill="white" />
                    <polygon points={polygonPoints} fill="black" />
                  </mask>
                </defs>
                {/* Escurecimento fora da seleção */}
                <rect width={displayW} height={displayH} fill="rgba(0,0,0,0.5)" mask="url(#docMask)" />
                {/* Bordas do polígono */}
                <polygon points={polygonPoints} fill="none" stroke="#00c896" strokeWidth={2.5} strokeDasharray="6 3" />
                {/* Linhas de grade internas */}
                {[1, 2].map(i => {
                  const pts = dCorners
                  const t = i / 3
                  const top = [pts[0][0] + (pts[1][0] - pts[0][0]) * t, pts[0][1] + (pts[1][1] - pts[0][1]) * t]
                  const bot = [pts[3][0] + (pts[2][0] - pts[3][0]) * t, pts[3][1] + (pts[2][1] - pts[3][1]) * t]
                  const left = [pts[0][0] + (pts[3][0] - pts[0][0]) * t, pts[0][1] + (pts[3][1] - pts[0][1]) * t]
                  const right = [pts[1][0] + (pts[2][0] - pts[1][0]) * t, pts[1][1] + (pts[2][1] - pts[1][1]) * t]
                  return (
                    <g key={i}>
                      <line x1={top[0]} y1={top[1]} x2={bot[0]} y2={bot[1]} stroke="rgba(0,200,150,0.4)" strokeWidth={1} />
                      <line x1={left[0]} y1={left[1]} x2={right[0]} y2={right[1]} stroke="rgba(0,200,150,0.4)" strokeWidth={1} />
                    </g>
                  )
                })}
                {/* Handles nos cantos */}
                {dCorners.map(([cx, cy], i) => (
                  <g
                    key={i}
                    onMouseDown={e => handlePointerDown(i, e)}
                    onTouchStart={e => { e.preventDefault(); handlePointerDown(i, e) }}
                    style={{ cursor: 'grab' }}
                  >
                    <circle cx={cx} cy={cy} r={20} fill="transparent" />
                    <circle cx={cx} cy={cy} r={11} fill="#00c896" stroke="white" strokeWidth={3} />
                    <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke="white" strokeWidth={2.5} strokeLinecap="round" />
                    <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke="white" strokeWidth={2.5} strokeLinecap="round" />
                  </g>
                ))}
              </svg>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              <button
                onClick={() => { setStep('upload'); setImgSrc(null) }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
              >
                ← Voltar
              </button>
              <button
                className="btn-primary"
                onClick={handleScan}
                style={{ flex: 2 }}
              >
                ✨ Escanear e Extrair Dados
              </button>
            </div>
          </div>
        )}

        {/* ── SCANNING ── */}
        {step === 'scanning' && (
          <div className="card" style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Analisando documento...</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Aplicando correção de perspectiva e extraindo dados com IA
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#00c896',
                  animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
                }} />
              ))}
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.4)} }`}</style>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === 'result' && result && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
              <img
                src={result.warpedUrl}
                style={{ width: 100, height: 140, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0 }}
                alt="recorte"
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#10b981', marginBottom: 4 }}>✅ Dados extraídos!</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Revise os campos abaixo e confirme para salvar como despesa.
                </p>
              </div>
            </div>

            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Descrição', key: 'descricao', type: 'text' },
                { label: 'Valor (R$)', key: 'valor', type: 'number' },
                { label: 'Data', key: 'data', type: 'date' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
                  <input
                    type={type}
                    value={result[key] ?? ''}
                    onChange={e => setResult(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14 }}
                  />
                </div>
              ))}

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Categoria</div>
                <select
                  value={result.categoria}
                  onChange={e => setResult(prev => ({ ...prev, categoria: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14 }}
                >
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button
                onClick={() => setStep('adjust')}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
              >
                ← Refazer
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 2 }}
              >
                {saving ? '⏳ Salvando...' : '💾 Salvar Despesa'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
