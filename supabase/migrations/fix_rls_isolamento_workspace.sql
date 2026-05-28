-- ══════════════════════════════════════════════════════════════
-- FIX: Isolamento por workspace em tabelas com USING (true)
-- Tabelas afetadas: agendamentos, refeições, efetivo, lider_*
--
-- A função my_workspace_ids() já existe (SECURITY DEFINER).
-- Tabelas com workspace_id UUID → comparação direta.
-- Tabelas com workspace_id TEXT → cast: workspace_id::uuid.
-- Tabelas sem workspace_id próprio → subquery via FK pai.
-- ══════════════════════════════════════════════════════════════

-- ─── 1. AGENDAMENTOS ─────────────────────────────────────────────────────────

-- agendamentos_servicos (workspace_id uuid)
DROP POLICY IF EXISTS "service_role_all_agendamentos" ON agendamentos_servicos;
CREATE POLICY "ws_agendamentos_servicos" ON agendamentos_servicos
  FOR ALL USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id IN (SELECT my_workspace_ids()));

-- agendamento_regras_alerta (workspace_id uuid)
DROP POLICY IF EXISTS "service_role_all_regras" ON agendamento_regras_alerta;
CREATE POLICY "ws_agendamento_regras" ON agendamento_regras_alerta
  FOR ALL USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id IN (SELECT my_workspace_ids()));

-- agendamento_alertas (sem workspace_id — via FK → agendamentos_servicos)
DROP POLICY IF EXISTS "service_role_all_alertas" ON agendamento_alertas;
CREATE POLICY "ws_agendamento_alertas" ON agendamento_alertas
  FOR ALL USING (
    agendamento_id IN (
      SELECT id FROM agendamentos_servicos
      WHERE workspace_id IN (SELECT my_workspace_ids())
    )
  )
  WITH CHECK (
    agendamento_id IN (
      SELECT id FROM agendamentos_servicos
      WHERE workspace_id IN (SELECT my_workspace_ids())
    )
  );

-- agendamento_historico (sem workspace_id — via FK → agendamentos_servicos)
DROP POLICY IF EXISTS "service_role_all_historico" ON agendamento_historico;
CREATE POLICY "ws_agendamento_historico" ON agendamento_historico
  FOR ALL USING (
    agendamento_id IN (
      SELECT id FROM agendamentos_servicos
      WHERE workspace_id IN (SELECT my_workspace_ids())
    )
  )
  WITH CHECK (
    agendamento_id IN (
      SELECT id FROM agendamentos_servicos
      WHERE workspace_id IN (SELECT my_workspace_ids())
    )
  );

-- agenda_parametros (workspace_id uuid)
DROP POLICY IF EXISTS "service role all on agenda_parametros" ON agenda_parametros;
CREATE POLICY "ws_agenda_parametros" ON agenda_parametros
  FOR ALL USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id IN (SELECT my_workspace_ids()));

-- agenda_gestores (workspace_id uuid) — RLS pode não estar habilitado ainda
ALTER TABLE IF EXISTS agenda_gestores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ws_agenda_gestores" ON agenda_gestores;
CREATE POLICY "ws_agenda_gestores" ON agenda_gestores
  FOR ALL USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id IN (SELECT my_workspace_ids()));

-- agenda_links_pendentes (workspace_id uuid)
ALTER TABLE IF EXISTS agenda_links_pendentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ws_agenda_links" ON agenda_links_pendentes;
CREATE POLICY "ws_agenda_links" ON agenda_links_pendentes
  FOR ALL USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id IN (SELECT my_workspace_ids()));

-- ─── 2. REFEIÇÕES ─────────────────────────────────────────────────────────────

-- refei_restaurantes (workspace_id uuid)
DROP POLICY IF EXISTS "refei_restaurantes_all" ON refei_restaurantes;
CREATE POLICY "ws_refei_restaurantes" ON refei_restaurantes
  FOR ALL USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id IN (SELECT my_workspace_ids()));

-- refei_equipes (workspace_id uuid)
DROP POLICY IF EXISTS "refei_equipes_all" ON refei_equipes;
CREATE POLICY "ws_refei_equipes" ON refei_equipes
  FOR ALL USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id IN (SELECT my_workspace_ids()));

-- refei_colaboradores (sem workspace_id — via FK → refei_equipes)
DROP POLICY IF EXISTS "refei_colaboradores_all" ON refei_colaboradores;
CREATE POLICY "ws_refei_colaboradores" ON refei_colaboradores
  FOR ALL USING (
    equipe_id IN (
      SELECT id FROM refei_equipes
      WHERE workspace_id IN (SELECT my_workspace_ids())
    )
  )
  WITH CHECK (
    equipe_id IN (
      SELECT id FROM refei_equipes
      WHERE workspace_id IN (SELECT my_workspace_ids())
    )
  );

-- refei_solicitacoes (workspace_id uuid)
DROP POLICY IF EXISTS "refei_solicitacoes_all" ON refei_solicitacoes;
CREATE POLICY "ws_refei_solicitacoes" ON refei_solicitacoes
  FOR ALL USING     (workspace_id IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id IN (SELECT my_workspace_ids()));

-- refei_itens (sem workspace_id — via FK → refei_solicitacoes)
DROP POLICY IF EXISTS "refei_itens_all" ON refei_itens;
CREATE POLICY "ws_refei_itens" ON refei_itens
  FOR ALL USING (
    solicitacao_id IN (
      SELECT id FROM refei_solicitacoes
      WHERE workspace_id IN (SELECT my_workspace_ids())
    )
  )
  WITH CHECK (
    solicitacao_id IN (
      SELECT id FROM refei_solicitacoes
      WHERE workspace_id IN (SELECT my_workspace_ids())
    )
  );

-- refei_centros_custo (workspace_id TEXT → cast)
DROP POLICY IF EXISTS "allow_all" ON refei_centros_custo;
CREATE POLICY "ws_refei_centros_custo" ON refei_centros_custo
  FOR ALL USING     (workspace_id::uuid IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id::uuid IN (SELECT my_workspace_ids()));

-- refei_regionais (workspace_id TEXT → cast)
DROP POLICY IF EXISTS "allow_all" ON refei_regionais;
CREATE POLICY "ws_refei_regionais" ON refei_regionais
  FOR ALL USING     (workspace_id::uuid IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id::uuid IN (SELECT my_workspace_ids()));

-- refei_tabela_precos (workspace_id TEXT → cast)
DROP POLICY IF EXISTS "allow_all" ON refei_tabela_precos;
CREATE POLICY "ws_refei_tabela_precos" ON refei_tabela_precos
  FOR ALL USING     (workspace_id::uuid IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id::uuid IN (SELECT my_workspace_ids()));

-- refei_parametros (workspace_id TEXT → cast)
DROP POLICY IF EXISTS "allow_all" ON refei_parametros;
CREATE POLICY "ws_refei_parametros" ON refei_parametros
  FOR ALL USING     (workspace_id::uuid IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id::uuid IN (SELECT my_workspace_ids()));

-- refei_fechamentos (workspace_id TEXT → cast)
DROP POLICY IF EXISTS "allow_all" ON refei_fechamentos;
CREATE POLICY "ws_refei_fechamentos" ON refei_fechamentos
  FOR ALL USING     (workspace_id::uuid IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id::uuid IN (SELECT my_workspace_ids()));

-- ─── 3. EFETIVO ──────────────────────────────────────────────────────────────

-- funcoes_efetivo (workspace_id TEXT → cast)
DROP POLICY IF EXISTS "funcoes_efetivo_all" ON funcoes_efetivo;
CREATE POLICY "ws_funcoes_efetivo" ON funcoes_efetivo
  FOR ALL USING     (workspace_id::uuid IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id::uuid IN (SELECT my_workspace_ids()));

-- efetivo (workspace_id TEXT → cast)
DROP POLICY IF EXISTS "efetivo_all" ON efetivo;
CREATE POLICY "ws_efetivo" ON efetivo
  FOR ALL USING     (workspace_id::uuid IN (SELECT my_workspace_ids()))
  WITH CHECK        (workspace_id::uuid IN (SELECT my_workspace_ids()));

-- ─── 4. LIDER_* (workspace_id uuid) ─────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'lider_fazendas','lider_talhoes','lider_frentes','lider_equipes',
    'lider_colaboradores','lider_maquinas','lider_implementos','lider_produtos',
    'lider_epis','lider_epcs','lider_turnos','lider_mao_obra',
    'lider_apontamentos_maquina','lider_apontamentos_insumo','lider_afericoes',
    'lider_produtividade_equipamento','lider_produtividade_equipe',
    'lider_solicitacoes_epi','lider_solicitacoes_insumo'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- só processa se a tabela existir
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = tbl AND schemaname = 'public') THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "lider_auth_all" ON %I', tbl);
      EXECUTE format(
        'CREATE POLICY "ws_%s" ON %I
           FOR ALL USING     (workspace_id IN (SELECT my_workspace_ids()))
           WITH CHECK        (workspace_id IN (SELECT my_workspace_ids()))',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;
