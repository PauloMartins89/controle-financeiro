// Smoke test do PDF dashboard
import { writeFileSync } from 'node:fs'
import { gerarDashboardPDF } from '../api/_pdf/index.js'
import { COR } from '../api/_pdf/layout.js'

const dados = {
  titulo: 'Relatório Financeiro',
  subtitulo: '01/05/2026 a 28/05/2026',
  empresa: 'ph.mar89s@gmail.com',
  kpis: [
    { label: 'Entradas',  value: 'R$ 12.450,00', color: COR.success, sub: '34 registros' },
    { label: 'Saídas',    value: 'R$ 8.230,15',  color: COR.danger,  sub: '52 registros' },
    { label: 'Saldo',     value: 'R$ 4.219,85',  color: COR.info },
    { label: '% Pago',    value: '78%',          color: COR.primary, sub: '67 de 86' },
  ],
  pizza: {
    titulo: 'Top categorias de despesa',
    labels: ['Aluguel','Folha','Marketing','Energia','Combustível','Outros'],
    data:   [3000, 2200, 1500, 700, 500, 330],
  },
  barras: {
    titulo: 'Saldo diário (entradas − saídas)',
    labels: ['01/05','03/05','05/05','08/05','12/05','15/05','18/05','22/05','25/05','28/05'],
    data:   [200, -150, 800, 300, -500, 1200, 150, -200, 900, 400],
    color:  COR.primary,
  },
}

console.log('Gerando PDF...')
const buf = await gerarDashboardPDF(dados)
writeFileSync('tests/smoke-dashboard.pdf', buf)
console.log('OK →', buf.length, 'bytes — tests/smoke-dashboard.pdf')
