import { runOCR } from './_ocr.js'

// POST /api/ocr-formulario
// Thin wrapper â€” lÃ³gica OCR em api/_ocr.js (compartilhada com webhook-whatsapp)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { imageBase64, template } = req.body
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' })

    const json = await runOCR(imageBase64, { template: template || null })
    return res.json(json)
  } catch (e) {
    console.error('[ocr-formulario] error:', e.message)
    return res.status(500).json({
      error: e.message,
      tipo_formulario: 'padrao',
      tipo: 'despesa',
      valor: 0,
      descricao: '',
      data: new Date().toISOString().slice(0, 10),
      categoria: 'Outros',
      centro_custo: '',
      observacoes: '',
    })
  }
}
