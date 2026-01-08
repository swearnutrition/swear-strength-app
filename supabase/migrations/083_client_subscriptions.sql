-- Migration: Client Subscriptions
-- Supports two types:
-- 1. Hybrid: Monthly session allocation that carries over (capped at 2x monthly)
-- 2. Online Only: Pure subscription tracking with no session allocation

-- ============================================
-- CLIENT SUBSCRIPTIONS TABLE
-- ============================================

CREATE TABLE client_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invite_id UUID REFERENCES invites(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id),

  -- Subscription type: 'hybrid' or 'online_only'
  subscription_type TEXT NOT NULL CHECK (subscription_type IN ('hybrid', 'online_only')),

  -- For hybrid subscriptions only (NULL for online_only)
  monthly_sessions INTEGER,
  available_sessions INTEGER,
  session_duration_minutes INTEGER,

  -- Common fields
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Either client_id or invite_id must be set, but not both
  CONSTRAINT subscription_client_or_invite CHECK (
    (client_id IS NOT NULL AND invite_id IS NULL) OR
    (client_id IS NULL AND invite_id IS NOT NULL)
  ),
  -- Hybrid subscriptions must have session fields set
  CONSTRAINT hybrid_requires_sessions CHECK (
    subscription_type != 'hybrid' OR
    (monthly_sessions IS NOT NULL AND available_sessions IS NOT NULL AND session_duration_minutes IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_subscriptions_coach ON client_subscriptions(coach_id);
CREATE INDEX idx_subscriptions_client ON client_subscriptions(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_subscriptions_invite ON client_subscriptions(invite_id) WHERE invite_id IS NOT NULL;
CREATE INDEX idx_subscriptions_active ON client_subscriptions(coach_id, is_active) WHERE is_active = true;

-- Unique constraint: one active subscription per client per coach
CREATE UNIQUE INDEX idx_subscriptions_unique_client
  ON client_subscriptions(coach_id, client_id)
  WHERE client_id IS NOT NULL AND is_active = true;

CREATE UNIQUE INDEX idx_subscriptions_unique_invite
  ON client_subscriptions(coach_id, invite_id)
  WHERE invite_id IS NOT NULL AND is_active = true;

-- RLS Policies
ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage their subscriptions"
  ON client_subscriptions
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Clients can view their subscriptions"
  ON client_subscriptions
  FOR SELECT
  USING (auth.uid() = client_id);

-- ============================================
-- ADD SUBSCRIPTION_ID TO BOOKINGS
-- ============================================

ALTER TABLE bookings ADD COLUMN subscription_id UUID REFERENCES client_subscriptions(id);

-- Index for subscription lookups on bookings
CREATE INDEX idx_bookings_subscription ON bookings(subscription_id) WHERE subscription_id IS NOT NULL;

-- ============================================
-- FUNCTION: Decrement subscription session
-- ============================================

CREATE OR REPLACE FUNCTION decrement_subscription_session(p_subscription_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE client_subscriptions
  SET
    available_sessions = available_sessions - 1,
    updated_at = now()
  WHERE id = p_subscription_id
    AND available_sessions > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Credit monthly sessions (for cron job)
-- ============================================

CREATE OR REPLACE FUNCTION credit_monthly_subscription_sessions()
RETURNS void AS $$
BEGIN
  UPDATE client_subscriptions
  SET
    available_sessions = LEAST(available_sessions + monthly_sessions, monthly_sessions * 2),
    updated_at = now()
  WHERE is_active = true
    AND subscription_type = 'hybrid';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATE: migrate_pending_client_data function
-- ============================================

CREATE OR REPLACE FUNCTION migrate_pending_client_data(p_invite_id UUID, p_client_id UUID)
RETURNS void AS $$
BEGIN
  -- Migrate session packages
  UPDATE session_packages
  SET client_id = p_client_id, invite_id = NULL
  WHERE invite_id = p_invite_id;

  -- Migrate client habits
  UPDATE client_habits
  SET client_id = p_client_id, invite_id = NULL
  WHERE invite_id = p_invite_id;

  -- Migrate program assignments
  UPDATE user_program_assignments
  SET user_id = p_client_id, invite_id = NULL
  WHERE invite_id = p_invite_id;

  -- Migrate conversations
  UPDATE conversations
  SET client_id = p_client_id, invite_id = NULL
  WHERE invite_id = p_invite_id;

  -- Migrate bookings
  UPDATE bookings
  SET client_id = p_client_id, invite_id = NULL
  WHERE invite_id = p_invite_id;

  -- Migrate subscriptions
  UPDATE client_subscriptions
  SET client_id = p_client_id, invite_id = NULL
  WHERE invite_id = p_invite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CRON JOB: Monthly session credits
-- Note: Requires pg_cron extension to be enabled
-- Run on 1st of each month at 00:00 UTC
-- ============================================

-- Uncomment if pg_cron is available:
-- SELECT cron.schedule(
--   'monthly-subscription-credits',
--   '0 0 1 * *',
--   'SELECT credit_monthly_subscription_sessions()'
-- );
