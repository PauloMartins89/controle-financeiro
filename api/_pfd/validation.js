import { INTERVALOS_CRITICOS } from './constants.js'

export function validarExtracao(resultado) {
  const alertas = resultado.alertas ? [...resultado.alertas] : []
  const intervalos = resultado.intervalos || []

  for (const iv of intervalos) {
    const temTarefas = iv.tarefas && iv.tarefas.length > 0
    if (!temTarefas && iv.status_extracao !== 'intervalo_nao_encontrado') {
      iv.status_extracao = 'falha_extracao'
      alertas.push({
        tipo: 'falha_extracao',
        horas: iv.intervalo_horas,
        intervalo: iv.titulo_intervalo || `${iv.intervalo_horas}h`,
        mensagem: `Intervalo ${iv.intervalo_horas}h encontrado mas sem tarefas extraídas`,
      })
    }
  }

  const temFalhaCritica = intervalos.some(iv =>
    INTERVALOS_CRITICOS.includes(iv.intervalo_horas) && iv.status_extracao === 'falha_extracao'
  )

  const totalIntervalos = intervalos.length
  const totalTarefas = intervalos.reduce((acc, iv) => acc + (iv.tarefas?.length || 0), 0)
  const intervalosOk = intervalos.filter(iv => iv.status_extracao === 'ok').length
  const statusGeral = totalIntervalos === 0
    ? 'falha'
    : intervalosOk === totalIntervalos
      ? 'completo'
      : intervalosOk > 0 ? 'parcial' : 'falha'

  return { alertas, temFalhaCritica, statusGeral, totalIntervalos, totalTarefas, intervalosOk }
}