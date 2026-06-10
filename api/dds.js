import { createClient } from '@supabase/supabase-js'

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  )
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const db     = getDb()
  const action = req.method === 'GET' ? req.query.action : req.body?.action

  // ── GET: listar temas ativos do workspace ─────────────────────────────────
  if (req.method === 'GET' && action === 'temas') {
    const { workspaceId } = req.query
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId obrigatório' })
    const { data, error } = await db
      .from('dds_temas')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('categoria')
      .order('titulo')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ temas: data || [] })
  }

  // ── GET: verificar se já existe registro hoje para o turno ────────────────
  if (req.method === 'GET' && action === 'registro-hoje') {
    const { turnoId } = req.query
    if (!turnoId) return res.status(400).json({ error: 'turnoId obrigatório' })
    const hoje = new Date().toISOString().slice(0, 10)
    const { data } = await db
      .from('dds_registros')
      .select('*, dds_temas(titulo, categoria)')
      .eq('turno_id', turnoId)
      .eq('data', hoje)
      .maybeSingle()
    return res.status(200).json({ registro: data || null })
  }

  // ── GET: histórico de DDS ─────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'historico') {
    const { workspaceId, limit = 50 } = req.query
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId obrigatório' })
    const { data, error } = await db
      .from('dds_registros')
      .select('*, dds_temas(titulo, categoria), dds_assinaturas(id)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'concluido')
      .order('data', { ascending: false })
      .limit(Number(limit))
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ registros: data || [] })
  }

  // ── POST: iniciar DDS (cria registro) ─────────────────────────────────────
  if (req.method === 'POST' && action === 'iniciar') {
    const { workspaceId, turnoId, liderId, temaId, data: dataRefeicao } = req.body || {}
    if (!workspaceId || !turnoId || !temaId) {
      return res.status(400).json({ error: 'workspaceId, turnoId e temaId obrigatórios' })
    }
    const hoje = (dataRefeicao || new Date().toISOString()).slice(0, 10)
    // Evita duplicar o mesmo tema no mesmo turno no mesmo dia
    const { data: existente } = await db
      .from('dds_registros')
      .select('id, status')
      .eq('turno_id', turnoId)
      .eq('data', hoje)
      .eq('tema_id', temaId)
      .maybeSingle()
    if (existente) {
      return res.status(200).json({ registroId: existente.id, jaExistia: true })
    }
    const { data: novo, error } = await db
      .from('dds_registros')
      .insert({ workspace_id: workspaceId, turno_id: turnoId, lider_id: liderId || null, tema_id: temaId, data: hoje })
      .select('id')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ registroId: novo.id, jaExistia: false })
  }

  // ── POST: salvar assinatura de um colaborador ─────────────────────────────
  if (req.method === 'POST' && action === 'assinar') {
    const { registroId, colaboradorId, colaboradorNome, assinaturaSvg } = req.body || {}
    if (!registroId || !colaboradorNome) {
      return res.status(400).json({ error: 'registroId e colaboradorNome obrigatórios' })
    }
    // Upsert por registro + colaborador
    const { error } = await db
      .from('dds_assinaturas')
      .upsert(
        { registro_id: registroId, colaborador_id: colaboradorId || null, colaborador_nome: colaboradorNome, assinatura_svg: assinaturaSvg || null, assinado_em: new Date().toISOString() },
        { onConflict: 'registro_id,colaborador_id' }
      )
    if (error) {
      // Fallback: insert simples se upsert falhar (coluna única pode não existir)
      await db.from('dds_assinaturas').insert({ registro_id: registroId, colaborador_id: colaboradorId || null, colaborador_nome: colaboradorNome, assinatura_svg: assinaturaSvg || null })
    }
    return res.status(200).json({ ok: true })
  }

  // ── POST: concluir DDS ────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'concluir') {
    const { registroId, totalAssinantes } = req.body || {}
    if (!registroId) return res.status(400).json({ error: 'registroId obrigatório' })
    const { error } = await db
      .from('dds_registros')
      .update({ status: 'concluido', total_assinantes: totalAssinantes || 0, concluido_em: new Date().toISOString() })
      .eq('id', registroId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ── POST: salvar/atualizar tema (admin web) ───────────────────────────────
  if (req.method === 'POST' && action === 'salvar-tema') {
    const { id, workspaceId, titulo, categoria, conteudo, imagem_url, ativo } = req.body || {}
    if (!workspaceId || !titulo) return res.status(400).json({ error: 'workspaceId e titulo obrigatórios' })
    if (id) {
      const { error } = await db.from('dds_temas').update({ titulo, categoria: categoria || 'Segurança', conteudo: conteudo || null, imagem_url: imagem_url || null, ativo: ativo !== false }).eq('id', id).eq('workspace_id', workspaceId)
      if (error) return res.status(500).json({ error: error.message })
    } else {
      const { error } = await db.from('dds_temas').insert({ workspace_id: workspaceId, titulo, categoria: categoria || 'Segurança', conteudo: conteudo || null, imagem_url: imagem_url || null })
      if (error) return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ ok: true })
  }

  // ── POST: excluir tema ────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'deletar-tema') {
    const { id, workspaceId } = req.body || {}
    if (!id || !workspaceId) return res.status(400).json({ error: 'id e workspaceId obrigatórios' })
    const { error } = await db.from('dds_temas').delete().eq('id', id).eq('workspace_id', workspaceId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(404).json({ error: 'Ação não encontrada' })
}
