/**
 * POST /api/extrair-gps-pdf
 * Extrai coordenadas GPS (GPTS) de um GeoPDF (Avenza, IBGE, ArcGIS).
 * Corpo: JSON { pdfBase64: "<base64>" }
 * Resposta: { sw_lat, sw_lng, ne_lat, ne_lng } ou { error }
 */
import { PDFDocument, PDFName } from 'pdf-lib'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '60mb',
    },
  },
}

// Resolve referências indiretas do PDF
function resolve(ctx, obj) {
  if (!obj) return null
  if (obj?.constructor?.name === 'PDFRef') return ctx.lookup(obj)
  return obj
}

// Extrai valor numérico de um objeto PDF
function num(ctx, obj) {
  const r = resolve(ctx, obj)
  if (!r) return null
  if (typeof r.numberValue === 'number') return r.numberValue
  if (typeof r.value === 'function') {
    try { return r.value() } catch { return null }
  }
  return null
}

async function extractGPS(pdfBuffer) {
  const doc = await PDFDocument.load(new Uint8Array(pdfBuffer), {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false,
  })

  const pages = doc.getPages()
  if (!pages.length) return null

  const page = pages[0]
  const ctx  = doc.context

  // VP = ViewPort array no dicionário da página
  const vpRaw = resolve(ctx, page.node.get(PDFName.of('VP')))
  if (!vpRaw) return null

  const vpSize = vpRaw.size?.() ?? 0
  for (let i = 0; i < vpSize; i++) {
    const vpItem = resolve(ctx, vpRaw.get(i))
    if (!vpItem) continue

    const measure = resolve(ctx, vpItem.get?.(PDFName.of('Measure')))
    if (!measure) continue

    const gpts = resolve(ctx, measure.get?.(PDFName.of('GPTS')))
    if (!gpts || (gpts.size?.() ?? 0) < 8) continue

    // GPTS = [lat0, lon0, lat1, lon1, ...] para cada canto
    const vals = []
    for (let j = 0; j < gpts.size(); j++) {
      const v = num(ctx, gpts.get(j))
      if (v !== null) vals.push(v)
    }
    if (vals.length < 8) continue

    const lats = vals.filter((_, idx) => idx % 2 === 0)
    const lons = vals.filter((_, idx) => idx % 2 === 1)

    // BBox da área geográfica (em pts PDF, Y-up)
    const bboxRaw = resolve(ctx, vpItem.get?.(PDFName.of('BBox')))
    let cropRect = null
    if (bboxRaw && (bboxRaw.size?.() ?? 0) >= 4) {
      const bv = []
      for (let k = 0; k < bboxRaw.size(); k++) {
        const v = num(ctx, bboxRaw.get(k))
        if (v !== null) bv.push(v)
      }
      if (bv.length >= 4) {
        const mb = page.getMediaBox()
        cropRect = {
          x0: Math.min(bv[0], bv[2]),
          x1: Math.max(bv[0], bv[2]),
          y0_pdf: Math.min(bv[1], bv[3]),   // rodapé em PDF coords (Y-up)
          y1_pdf: Math.max(bv[1], bv[3]),   // topo em PDF coords (Y-up)
          pageW:  mb.width,
          pageH:  mb.height,
        }
      }
    }

    return {
      sw_lat:   Math.min(...lats),
      sw_lng:   Math.min(...lons),
      ne_lat:   Math.max(...lats),
      ne_lng:   Math.max(...lons),
      cropRect,
    }
  }

  return null
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { pdfBase64 } = req.body
    if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 obrigatório' })

    const pdfBuffer = Buffer.from(pdfBase64, 'base64')
    const result = await extractGPS(pdfBuffer)

    if (!result) {
      return res.status(200).json({
        found: false,
        message: 'PDF não contém metadados de georreferenciamento (GPTS/VP). Use um GeoPDF exportado do Avenza, IBGE ou ArcGIS.',
      })
    }

    return res.status(200).json({ found: true, ...result })
  } catch (err) {
    console.error('[extrair-gps-pdf]', err)
    return res.status(500).json({ error: 'Erro ao processar PDF: ' + err.message })
  }
}
