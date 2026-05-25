-- ============================================================
-- add_maquinas_boletins.sql
-- Infraestrutura de recepção e processamento de boletins
-- enviados pelo campo via WhatsApp
--
-- Depende de: add_maquinas_cadastros.sql (já executado)
--
-- Ordem de criação:
--   1. maquinas_boletim_tipos   → templates de layout de boletim
--   2. maquinas_frentes ALTER   → adiciona FK boletim_tipo_id
--   3. maquinas_colaboradores   → operadores do campo (com telefone_wa)
--   4. maquinas_boletins        → boletins recebidos (raw + status)
--   5. maquinas_boletins_campos → campos extraídos + resultado do match
--   6. maquinas_aliases         → dicionário aprendido (OCR raw → cadastro)
-- ============================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tipos / layouts de boletim
--    Cada workspace cadastra seus formulários físicos com uma imagem
--    limpa (template). O LLM analisa o template e gera campos_json.
--    Ex: "Boletim Padrão v1", "Boletim Frente Sul"
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maquinas_boletim_tipos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  nome         TEXT NOT NULL,    -- "Boletim Padrão v1"
  descricao    TEXT,

  -- URL da imagem do boletim em branco (salva no Storage)
  imagem_url   TEXT,

  -- JSON gerado pelo LLM ao analisar o template:
  -- { "data": { "label": "Data:", "tipo": "data" },
  --   "operador": { "label": "Operador:", "tipo": "colaborador" },
  --   "equipamento": { "label": "Equipamento:", "tipo": "equipamento" },
  --   "frente": { "label": "Frente:", "tipo": "frente" },
  --   "horas_produtivas": { "label": "Hrs Prod.:", "tipo": "numero" },
  --   "horas_manutencao": { "label": "Hrs Manut.:", "tipo": "numero" },
  --   "horas_ociosas":    { "label": "Hrs Ocio.:", "tipo": "numero" },
  --   "observacao":       { "label": "Obs.:", "tipo": "texto" } }
  campos_json  JSONB,

  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maquinas_boletim_tipos_ws_idx
  ON maquinas_boletim_tipos(workspace_id);

ALTER TABLE maquinas_boletim_tipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_maquinas_boletim_tipos" ON maquinas_boletim_tipos;
CREATE POLICY "members_maquinas_boletim_tipos" ON maquinas_boletim_tipos
  FOR ALL USING   (workspace_id IN (SELECT get_my_workspace_ids()))
  WITH CHECK      (workspace_id IN (SELECT get_my_workspace_ids()));


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Adiciona FK boletim_tipo_id em maquinas_frentes
--    Cada frente de trabalho usa um layout específico de boletim.
--    Colaborador → frente → boletim_tipo
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE maquinas_frentes
  ADD COLUMN IF NOT EXISTS boletim_tipo_id UUID
    REFERENCES maquinas_boletim_tipos(id) ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Colaboradores de campo (operadores de máquinas)
--    O telefone_wa é a chave de identificação quando o boletim chega
--    via WhatsApp. A frente determina qual template de boletim usar.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maquinas_colaboradores (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  nome         TEXT NOT NULL,           -- "João Ferreira"
  matricula    TEXT,                    -- código interno opcional, ex: "0042"
  telefone_wa  TEXT,                    -- "5511992345678" — identificação no webhook
  frente_id    UUID
    REFERENCES maquinas_frentes(id) ON DELETE SET NULL,  -- frente padrão

  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maquinas_colaboradores_ws_idx
  ON maquinas_colaboradores(workspace_id);

CREATE INDEX IF NOT EXISTS maquinas_colaboradores_wa_idx
  ON maquinas_colaboradores(telefone_wa)
  WHERE telefone_wa IS NOT NULL;

ALTER TABLE maquinas_colaboradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_maquinas_colaboradores" ON maquinas_colaboradores;
CREATE POLICY "members_maquinas_colaboradores" ON maquinas_colaboradores
  FOR ALL USING   (workspace_id IN (SELECT get_my_workspace_ids()))
  WITH CHECK      (workspace_id IN (SELECT get_my_workspace_ids()));


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Boletins recebidos
--    Um registro por imagem recebida. Ciclo de vida do status:
--    recebido → processando → processado
--                           ↘ pendente_revisao → processado (após revisão admin)
--                           ↘ erro
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maquinas_boletins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Quem enviou e qual template usar
  colaborador_id  UUID REFERENCES maquinas_colaboradores(id) ON DELETE SET NULL,
  boletim_tipo_id UUID REFERENCES maquinas_boletim_tipos(id) ON DELETE SET NULL,

  -- Dados de recepção (WhatsApp)
  wa_from         TEXT NOT NULL,   -- "+5511992345678" — número que enviou a imagem
  imagem_url      TEXT NOT NULL,   -- URL no Storage, ex: "maquinas/boletins/2026/05/22/..."

  -- Número sequencial para rastreamento, ex: "BOL-2026-000047"
  numero          TEXT,

  -- Dados extraídos pelo OCR (saída bruta do GPT-4 Vision)
  ocr_raw         JSONB,

  -- Data do boletim extraída pelo OCR (campo "data" do formulário)
  data_boletim    DATE,

  -- Status de processamento
  -- 'recebido'        → imagem chegou, OCR ainda não rodou
  -- 'processando'     → OCR em andamento
  -- 'processado'      → todos campos ok, lancamento criado
  -- 'pendente_revisao'→ há campos não identificados (aguarda admin)
  -- 'erro'            → falha técnica no OCR ou no processamento
  status          TEXT NOT NULL DEFAULT 'recebido',

  -- Lancamento gerado (preenchido quando status = 'processado')
  lancamento_id   UUID REFERENCES lancamentos(id) ON DELETE SET NULL,

  -- Timestamps
  recebido_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processado_em   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maquinas_boletins_ws_idx
  ON maquinas_boletins(workspace_id);
CREATE INDEX IF NOT EXISTS maquinas_boletins_status_idx
  ON maquinas_boletins(workspace_id, status);
CREATE INDEX IF NOT EXISTS maquinas_boletins_colab_idx
  ON maquinas_boletins(colaborador_id);
CREATE INDEX IF NOT EXISTS maquinas_boletins_data_idx
  ON maquinas_boletins(workspace_id, data_boletim);

ALTER TABLE maquinas_boletins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_maquinas_boletins" ON maquinas_boletins;
CREATE POLICY "members_maquinas_boletins" ON maquinas_boletins
  FOR ALL USING   (workspace_id IN (SELECT get_my_workspace_ids()))
  WITH CHECK      (workspace_id IN (SELECT get_my_workspace_ids()));


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Campos extraídos de cada boletim
--    Um registro por campo identificado. Contém o valor bruto do OCR,
--    o resultado do match contra as tabelas cadastrais e o status.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maquinas_boletins_campos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boletim_id       UUID NOT NULL
    REFERENCES maquinas_boletins(id) ON DELETE CASCADE,

  -- Tipo do campo conforme definido em boletim_tipo.campos_json
  -- Valores possíveis: 'data' | 'colaborador' | 'equipamento' | 'classe'
  --                    'frente' | 'horas_produtivas' | 'horas_manutencao'
  --                    'horas_ociosas' | 'observacao'
  campo_tipo       TEXT NOT NULL,

  -- O que o OCR leu literalmente na imagem
  -- Ex: "JOAO FERREIRA", "EH-03", "FT NORTE", "7,5"
  valor_raw        TEXT,

  -- Resultado do matching contra tabelas cadastrais
  valor_match_id   UUID,    -- UUID do registro encontrado (colaborador_id, equipamento_id, etc.)
  match_tabela     TEXT,    -- tabela onde foi encontrado: 'maquinas_colaboradores', 'maquinas_equipamentos', etc.
  match_confianca  NUMERIC(5,2),  -- 0.00 a 100.00

  -- Status do match:
  -- 'ok'             → ≥ 90% confiança, associado automaticamente (ou via alias)
  -- 'pendente'       → 60–89% confiança, aguarda confirmação do admin
  -- 'nao_encontrado' → < 60%, não há proposta confiável
  -- 'aprovado'       → admin aprovou a associação manualmente
  -- 'ignorado'       → campo opcional sem preenchimento
  status_match     TEXT NOT NULL DEFAULT 'pendente',

  -- Sugestão textual gerada pelo sistema para o admin
  -- Ex: "CAT 320D (EH-07) — 72% de similaridade"
  proposta_texto   TEXT,

  -- Quem aprovou (se foi manual)
  aprovado_por     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em      TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS maquinas_boletins_campos_bol_idx
  ON maquinas_boletins_campos(boletim_id);
CREATE INDEX IF NOT EXISTS maquinas_boletins_campos_status_idx
  ON maquinas_boletins_campos(boletim_id, status_match);

-- Sem RLS própria — acesso controlado via maquinas_boletins (workspace)
ALTER TABLE maquinas_boletins_campos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_maquinas_boletins_campos" ON maquinas_boletins_campos;
CREATE POLICY "members_maquinas_boletins_campos" ON maquinas_boletins_campos
  FOR ALL USING (
    boletim_id IN (
      SELECT id FROM maquinas_boletins
      WHERE workspace_id IN (SELECT get_my_workspace_ids())
    )
  )
  WITH CHECK (
    boletim_id IN (
      SELECT id FROM maquinas_boletins
      WHERE workspace_id IN (SELECT get_my_workspace_ids())
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Aliases aprendidos
--    Cada vez que o admin aprova uma associação ambígua, o par
--    (valor_raw → match_id) é salvo aqui para uso automático futuro.
--    Ex: "CAT 320" → equipamento_id "uuid-eh07"
--        "P. ALVES" → colaborador_id "uuid-pedro"
--        "FT NORTE" → frente_id "uuid-frente-norte"
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maquinas_aliases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  campo_tipo   TEXT NOT NULL,  -- mesmo enum de maquinas_boletins_campos.campo_tipo
  alias        TEXT NOT NULL,  -- texto bruto que veio do OCR (normalizado: trim + upper)
  match_id     UUID NOT NULL,  -- UUID do registro cadastral correto
  match_tabela TEXT NOT NULL,  -- tabela do match_id

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Não duplicar aliases para o mesmo workspace + campo + texto
  UNIQUE (workspace_id, campo_tipo, alias)
);

CREATE INDEX IF NOT EXISTS maquinas_aliases_ws_idx
  ON maquinas_aliases(workspace_id);
CREATE INDEX IF NOT EXISTS maquinas_aliases_lookup_idx
  ON maquinas_aliases(workspace_id, campo_tipo, alias);

ALTER TABLE maquinas_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_maquinas_aliases" ON maquinas_aliases;
CREATE POLICY "members_maquinas_aliases" ON maquinas_aliases
  FOR ALL USING   (workspace_id IN (SELECT get_my_workspace_ids()))
  WITH CHECK      (workspace_id IN (SELECT get_my_workspace_ids()));
