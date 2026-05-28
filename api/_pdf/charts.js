/**
 * api/_pdf/charts.js
 * Helper para gerar PNG de gráficos usando QuickChart (sem dependências).
 * Retorna Buffer pronto para embed em pdfkit via doc.image(buffer, x, y, opts).
 */

const QC_BASE = 'https://quickchart.io/chart'

// Paleta SmartPro (consistente com o app)
export const PALETA = ['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#a855f7','#ec4899','#84cc16','#14b8a6','#f97316']

/**
 * Renderiza um chart.js config para PNG via QuickChart.
 * @param {object} config Chart.js config
 * @param {object} [opts] { width=600, height=380, devicePixelRatio=2, backgroundColor='white' }
 * @returns {Promise<Buffer>} PNG buffer (ou null em caso de falha)
 */
export async function renderChartPNG(config, opts = {}) {
  const { width = 600, height = 380, devicePixelRatio = 2, backgroundColor = 'white' } = opts
  try {
    const body = {
      chart: config,
      width,
      height,
      devicePixelRatio,
      backgroundColor,
      format: 'png',
    }
    const res = await fetch(QC_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
}

/** Pizza/donut padronizada */
export function pizzaConfig({ titulo, labels, data, colors }) {
  return {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors || labels.map((_, i) => PALETA[i % PALETA.length]),
        borderColor: '#fff',
        borderWidth: 2,
      }],
    },
    options: {
      plugins: {
        title: { display: !!titulo, text: titulo, font: { size: 14, weight: 'bold' }, color: '#1e1b4b' },
        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 11 },
          formatter: (v, ctx) => {
            const total = ctx.chart.data.datasets[0].data.reduce((s, x) => s + Number(x || 0), 0)
            if (!total) return ''
            const pct = (Number(v) / total) * 100
            return pct < 5 ? '' : pct.toFixed(0) + '%'
          },
        },
      },
      cutout: '55%',
    },
  }
}

/** Barras verticais padronizadas */
export function barrasConfig({ titulo, labels, data, color = '#6366f1', label = '' }) {
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: color,
        borderRadius: 6,
        maxBarThickness: 36,
      }],
    },
    options: {
      plugins: {
        title: { display: !!titulo, text: titulo, font: { size: 14, weight: 'bold' }, color: '#1e1b4b' },
        legend: { display: !!label },
        datalabels: { display: false },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: '#e5e7eb' }, ticks: { font: { size: 10 } } },
      },
    },
  }
}
