-- ═══════════════════════════════════════════════════════════════════
-- Configurador de Rotas — tabela de mapeamento modulo+evento → ator
-- Cada linha: "no módulo X, evento Y, notifica o colaborador Z pelo canal C"
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rotas_config (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL,
  owner_id     uuid,
  modulo       text NOT NULL,  -- 'refeicoes' | 'compras' | 'lancamentos'
  evento       text NOT NULL,  -- 'nova_solicitacao' | 'aprovado' | 'recusado' | ...
  efetivo_id   uuid REFERENCES efetivo(id) ON DELETE CASCADE,
  canal        text DEFAULT 'whatsapp',  -- 'whatsapp' | 'email' | 'ambos'
  ativo        boolean DEFAULT true,
  criado_em    timestamptz DEFAULT now(),

  UNIQUE(workspace_id, modulo, evento, efetivo_id)
);

CREATE INDEX IF NOT EXISTS idx_rotas_config_workspace
  ON rotas_config (workspace_id);

CREATE INDEX IF NOT EXISTS idx_rotas_config_lookup
  ON rotas_config (workspace_id, modulo, evento)
  WHERE ativo = true;

ALTER TABLE rotas_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rotas_config_all" ON rotas_config;
CREATE POLICY "rotas_config_all" ON rotas_config
  FOR ALL USING (true) WITH CHECK (true);
