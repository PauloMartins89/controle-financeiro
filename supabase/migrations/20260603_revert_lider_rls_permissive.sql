-- ══════════════════════════════════════════════════════════════════════════
-- REVERT: restaura política permissiva para tabelas lider_*
-- Remove as políticas ws_* restritivas por workspace e volta ao
-- comportamento original: qualquer autenticado acessa (sem filtro workspace).
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'lider_turnos','lider_mao_obra','lider_apontamentos_maquina',
    'lider_apontamentos_insumo','lider_afericoes',
    'lider_produtividade_equipamento','lider_produtividade_equipe',
    'lider_solicitacoes_epi','lider_solicitacoes_insumo',
    'lider_condicoes_climaticas','lider_ocorrencias','lider_workspace_features',
    'lider_perfis','lider_equipes','lider_frentes',
    'lider_colaboradores','lider_maquinas','lider_implementos',
    'lider_produtos','lider_epis','lider_epcs','lider_fazendas','lider_talhoes',
    'lider_mapas','lider_trajetos','lider_pontos_mapa'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = tbl AND schemaname = 'public') THEN
      -- Remove política restritiva por workspace
      EXECUTE format('DROP POLICY IF EXISTS "ws_%s" ON %I', tbl, tbl);
      -- Garante que a permissiva anterior não existe (evita duplicata)
      EXECUTE format('DROP POLICY IF EXISTS "lider_auth_all" ON %I', tbl);
      -- Restaura: qualquer autenticado pode tudo
      EXECUTE format(
        'CREATE POLICY "lider_auth_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        tbl
      );
    END IF;
  END LOOP;
END $$;
