import { HORAS_VALIDAS } from './constants.js'

export function expandGeminiCompact(compact) {
  if (!compact?.iv) throw new Error('Resposta Gemini não contém campo "iv" (intervalos)')
  return {
    equipamento: {
      marca:          compact.eq?.marca         || 'John Deere',
      modelo:         compact.eq?.modelo        || '',
      modelos_cobertos: compact.eq?.modelos_cobertos || compact.eq?.modelos || [],
      codigo_manual:  compact.eq?.codigo_manual || '',
      manual:         compact.eq?.codigo_manual || '',
      regiao:         compact.eq?.regiao        || '',
      serie:          compact.eq?.serie         || '',
      idioma:         compact.eq?.idioma        || 'pt',
      edicao:         compact.eq?.edicao        || '',
    },
    intervalos: compact.iv.map(iv => ({
      intervalo_horas:  iv.h ?? 0,
      titulo_intervalo: iv.n || `A cada ${iv.h} horas`,
      periodicidade:    iv.u || 'recorrente',
      tarefas: (iv.tv || []).map(t => ({
        sistema:             t.s   || '',
        componente:          t.cmp || '',
        atividade:           t.a   || t.d || '',
        descricao_tarefa:    t.a   || t.d || '',
        tipo_atividade:      t.tp  || 'outro',
        tipo:                t.tp  || 'outro',
        insumo_ou_peca:      t.ins || t.l  || '',
        lubrificante_fluido: t.ins || t.l  || '',
        codigo_peca:         t.pn  || '',
        quantidade:          t.qty || t.cap || '',
        capacidade:          t.qty || t.cap || '',
        especificacao:       t.esp || '',
        pontos_lubrificacao: t.pts || '',
        aviso_seguranca:     t.seg || '',
        pagina_fonte:        t.pg  ?? null,
        texto_original:      t.raw || '',
        pecas_citadas:       [],
        condicional:         t.cn  || false,
        aplicabilidade:      t.ap  || '',
        observacao:          t.ob  || '',
        confianca:           t.cf  || 'alta',
      })),
      status_extracao:
        iv.st === 'falha'   ? 'falha_extracao' :
        iv.st === 'nao_enc' ? 'intervalo_nao_encontrado' : 'ok',
    })),
    alertas: [],
  }
}

export function mesclarIntervalos(lista) {
  const mapa = {}
  for (const item of lista) {
    for (const iv of (item.intervalos || [])) {
      const h = Number(iv.horas)
      if (isNaN(h) || !HORAS_VALIDAS.has(h)) continue
      const key = String(h)
      if (!mapa[key]) mapa[key] = { ...iv, horas: h, tarefas: [] }
      for (const t of (iv.tarefas || [])) {
        const exists = mapa[key].tarefas.some(
          ex => ex.tarefa?.toLowerCase() === t.tarefa?.toLowerCase()
        )
        if (!exists) mapa[key].tarefas.push(t)
      }
    }
  }
  return Object.values(mapa).sort((a, b) => Number(a.horas) - Number(b.horas))
}

export function legadoParaNovoSchema(extracaoRaw, fabricanteEquip, modeloEquip, edicao, idioma) {
  return {
    equipamento: {
      marca: fabricanteEquip,
      modelo: modeloEquip,
      modelos_cobertos: [],
      codigo_manual: '',
      manual: '',
      regiao: edicao || '',
      serie: '',
      idioma: idioma || 'pt',
    },
    intervalos: mesclarIntervalos([extracaoRaw]).map(iv => ({
      intervalo_horas: iv.horas,
      titulo_intervalo: iv.nome || `A cada ${iv.horas} horas`,
      periodicidade: (iv.horas === 0 || iv.horas === 600) ? 'uma_vez' : 'recorrente',
      tarefas: (iv.tarefas || []).map(t => ({
        sistema:             t.sistema     || '',
        componente:          t.componente  || '',
        descricao_tarefa:    t.tarefa      || '',
        atividade:           t.tarefa      || '',
        tipo_atividade:      t.tipo        || 'outro',
        tipo:                t.tipo        || 'outro',
        insumo_ou_peca:      t.insumo      || t.codigo_lubrificante || '',
        lubrificante_fluido: t.insumo      || t.codigo_lubrificante || '',
        quantidade:          t.quantidade  || t.capacidade || '',
        capacidade:          t.quantidade  || t.capacidade || '',
        pagina_fonte:        t.pagina      ?? null,
        texto_original:      '',
        pecas_citadas:       [],
        condicional:         t.condicional || false,
        aplicabilidade:      t.condicao    || '',
        observacao:          '',
        confianca:           'media',
      })),
      status_extracao: (iv.tarefas?.length || 0) > 0 ? 'ok' : 'falha_extracao',
    })),
    alertas: [],
  }
}