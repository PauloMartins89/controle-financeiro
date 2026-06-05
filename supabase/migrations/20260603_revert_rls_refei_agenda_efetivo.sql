-- ══════════════════════════════════════════════════════════════════════════
-- REVERT: restaura políticas permissivas para refei_*, agenda_* e efetivo
-- Remove as políticas ws_* restritivas por workspace e volta ao
-- comportamento original: qualquer autenticado acessa (sem filtro workspace).
-- ══════════════════════════════════════════════════════════════════════════

-- ─── REFEIÇÕES ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ws_refei_restaurantes"  ON refei_restaurantes;
DROP POLICY IF EXISTS "refei_restaurantes_all" ON refei_restaurantes;
CREATE POLICY "refei_restaurantes_all" ON refei_restaurantes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_refei_equipes"       ON refei_equipes;
DROP POLICY IF EXISTS "refei_equipes_all"      ON refei_equipes;
CREATE POLICY "refei_equipes_all" ON refei_equipes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_refei_colaboradores"  ON refei_colaboradores;
DROP POLICY IF EXISTS "refei_colaboradores_all" ON refei_colaboradores;
CREATE POLICY "refei_colaboradores_all" ON refei_colaboradores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_refei_solicitacoes"  ON refei_solicitacoes;
DROP POLICY IF EXISTS "refei_solicitacoes_all" ON refei_solicitacoes;
CREATE POLICY "refei_solicitacoes_all" ON refei_solicitacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_refei_itens"  ON refei_itens;
DROP POLICY IF EXISTS "refei_itens_all" ON refei_itens;
CREATE POLICY "refei_itens_all" ON refei_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_refei_centros_custo"  ON refei_centros_custo;
DROP POLICY IF EXISTS "refei_centros_custo_all" ON refei_centros_custo;
CREATE POLICY "refei_centros_custo_all" ON refei_centros_custo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_refei_regionais"  ON refei_regionais;
DROP POLICY IF EXISTS "refei_regionais_all" ON refei_regionais;
CREATE POLICY "refei_regionais_all" ON refei_regionais
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_refei_tabela_precos"  ON refei_tabela_precos;
DROP POLICY IF EXISTS "refei_tabela_precos_all" ON refei_tabela_precos;
CREATE POLICY "refei_tabela_precos_all" ON refei_tabela_precos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_refei_parametros"  ON refei_parametros;
DROP POLICY IF EXISTS "refei_parametros_all" ON refei_parametros;
CREATE POLICY "refei_parametros_all" ON refei_parametros
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_refei_fechamentos"  ON refei_fechamentos;
DROP POLICY IF EXISTS "refei_fechamentos_all" ON refei_fechamentos;
CREATE POLICY "refei_fechamentos_all" ON refei_fechamentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── AGENDA ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ws_agendamentos_servicos"          ON agendamentos_servicos;
DROP POLICY IF EXISTS "service_role_all_agendamentos"     ON agendamentos_servicos;
CREATE POLICY "service_role_all_agendamentos" ON agendamentos_servicos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_agendamento_regras"       ON agendamento_regras_alerta;
DROP POLICY IF EXISTS "service_role_all_regras"     ON agendamento_regras_alerta;
CREATE POLICY "service_role_all_regras" ON agendamento_regras_alerta
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_agendamento_alertas"      ON agendamento_alertas;
DROP POLICY IF EXISTS "service_role_all_alertas"    ON agendamento_alertas;
CREATE POLICY "service_role_all_alertas" ON agendamento_alertas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_agendamento_historico"     ON agendamento_historico;
DROP POLICY IF EXISTS "service_role_all_historico"   ON agendamento_historico;
CREATE POLICY "service_role_all_historico" ON agendamento_historico
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_agenda_parametros"                          ON agenda_parametros;
DROP POLICY IF EXISTS "service role all on agenda_parametros"         ON agenda_parametros;
CREATE POLICY "service role all on agenda_parametros" ON agenda_parametros
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_agenda_gestores"  ON agenda_gestores;
CREATE POLICY "ws_agenda_gestores" ON agenda_gestores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_agenda_links"  ON agenda_links_pendentes;
CREATE POLICY "ws_agenda_links" ON agenda_links_pendentes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── EFETIVO ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ws_funcoes_efetivo"  ON funcoes_efetivo;
DROP POLICY IF EXISTS "funcoes_efetivo_all" ON funcoes_efetivo;
CREATE POLICY "funcoes_efetivo_all" ON funcoes_efetivo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_efetivo"  ON efetivo;
DROP POLICY IF EXISTS "efetivo_all" ON efetivo;
CREATE POLICY "efetivo_all" ON efetivo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
