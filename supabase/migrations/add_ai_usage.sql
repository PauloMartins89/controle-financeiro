-- Tabela para registrar uso da IA por usuário
CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation" ON ai_usage
  FOR ALL USING (user_id = auth.uid());

-- View para consultar uso mensal por usuário
CREATE OR REPLACE VIEW ai_usage_mensal AS
SELECT
  user_id,
  date_trunc('month', created_at) AS mes,
  COUNT(*) AS mensagens,
  SUM(tokens_input + tokens_output) AS tokens_total
FROM ai_usage
GROUP BY user_id, date_trunc('month', created_at);
