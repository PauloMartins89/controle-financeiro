-- ════════════════════════════════════════════════════════════
-- Sistema de assinaturas / controle de acesso por pagamento
-- Execute no SQL Editor do Supabase logado como admin
-- ════════════════════════════════════════════════════════════

-- ── 1. Tabela principal de assinaturas ────────────────────
CREATE TABLE IF NOT EXISTS assinaturas (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email                  text NOT NULL,
  status                 text NOT NULL DEFAULT 'trial',
  -- status: trial | ativo | cancelado | vencido | isento
  plan                   text DEFAULT 'mensal',
  -- plan: mensal | anual | isento
  trial_expires_at       timestamptz DEFAULT (now() + interval '7 days'),
  expires_at             timestamptz,
  -- NULL em ativo = vitalício/renovação automática via webhook
  kiwify_order_id        text,
  kiwify_subscription_id text,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- ── 2. RLS ────────────────────────────────────────────────
ALTER TABLE assinaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_can_read_own" ON assinaturas;
CREATE POLICY "user_can_read_own" ON assinaturas
  FOR SELECT USING (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE: service_role apenas (webhook + admin)

-- ── 3. Trigger updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION update_assinaturas_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_assinaturas_updated_at ON assinaturas;
CREATE TRIGGER set_assinaturas_updated_at
  BEFORE UPDATE ON assinaturas
  FOR EACH ROW EXECUTE FUNCTION update_assinaturas_updated_at();

-- ── 4. Trigger: cria trial automaticamente no signup ──────
-- Dispara quando o usuário confirma o e-mail
CREATE OR REPLACE FUNCTION create_trial_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.assinaturas (user_id, email, status, trial_expires_at)
  VALUES (NEW.id, NEW.email, 'trial', now() + interval '7 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION create_trial_on_signup();

-- ── 5. Marca usuários existentes como isentos ─────────────
INSERT INTO assinaturas (user_id, email, status, trial_expires_at, expires_at, plan)
SELECT id, email, 'isento', NULL, NULL, 'isento'
FROM auth.users
WHERE email IN (
  'ph.mar89s@gmail.com',
  'camila.livia64@gmail.com',
  'novaislivia84@gmail.com'
)
ON CONFLICT (user_id) DO UPDATE
  SET status = 'isento', expires_at = NULL, plan = 'isento', updated_at = now();
