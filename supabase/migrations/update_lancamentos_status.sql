-- Migração: Atualizar campo status na tabela lancamentos
-- Expande os valores possíveis de status para o fluxo completo de aprovação
-- Executar no Supabase SQL Editor

-- Remove check constraint existente se houver
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name
  FROM information_schema.table_constraints tc
  WHERE tc.table_name = 'lancamentos'
    AND tc.constraint_type = 'CHECK'
    AND tc.constraint_name ILIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE lancamentos DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- Adiciona novo check constraint com todos os 8 status possíveis
ALTER TABLE lancamentos
  ADD CONSTRAINT lancamentos_status_check CHECK (
    status IN (
      'rascunho',
      'aguardando_aprovacao',
      'aprovado',
      'devolvido',
      'corrigido',
      'reprovado',
      'cancelado',
      'faturado',
      -- manter compatibilidade com registros antigos
      'pendente',
      'rejeitado'
    )
  );

-- Migrar status antigos para os novos equivalentes
UPDATE lancamentos SET status = 'aguardando_aprovacao' WHERE status = 'pendente';
UPDATE lancamentos SET status = 'reprovado'            WHERE status = 'rejeitado';

-- Após migração, remover os valores antigos do check constraint
ALTER TABLE lancamentos DROP CONSTRAINT lancamentos_status_check;

ALTER TABLE lancamentos
  ADD CONSTRAINT lancamentos_status_check CHECK (
    status IN (
      'rascunho',
      'aguardando_aprovacao',
      'aprovado',
      'devolvido',
      'corrigido',
      'reprovado',
      'cancelado',
      'faturado'
    )
  );

-- Adicionar coluna de histórico de status (opcional, para auditoria futura)
-- ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS status_historico JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN lancamentos.status IS
  'Fluxo: rascunho → aguardando_aprovacao → aprovado → faturado
   Desvios: devolvido (retorno para correção) → corrigido → aprovado
   Finais negativos: reprovado, cancelado';
