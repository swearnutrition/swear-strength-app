-- Migration: Add client type differentiation
-- Client types: online (check-ins only), training (sessions + check-ins), hybrid (limited sessions + check-ins)

-- Add client_type enum
CREATE TYPE client_type AS ENUM ('online', 'training', 'hybrid');

-- Add client_type column to profiles
ALTER TABLE profiles
ADD COLUMN client_type client_type DEFAULT 'online';

-- Add hybrid_sessions_per_month for hybrid clients (configurable per client)
ALTER TABLE profiles
ADD COLUMN hybrid_sessions_per_month INTEGER DEFAULT 4;

-- Add check constraint to ensure hybrid_sessions_per_month is positive
ALTER TABLE profiles
ADD CONSTRAINT hybrid_sessions_positive CHECK (hybrid_sessions_per_month > 0);

-- Create table to track monthly session usage for hybrid clients
CREATE TABLE client_monthly_session_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    month DATE NOT NULL, -- First day of the month (e.g., 2024-01-01)
    sessions_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, coach_id, month)
);

-- Index for efficient lookups
CREATE INDEX idx_client_monthly_session_usage_client ON client_monthly_session_usage(client_id);
CREATE INDEX idx_client_monthly_session_usage_month ON client_monthly_session_usage(month);

-- RLS policies for client_monthly_session_usage
ALTER TABLE client_monthly_session_usage ENABLE ROW LEVEL SECURITY;

-- Coaches can see and manage their clients' usage
CREATE POLICY "Coaches can view their clients session usage"
ON client_monthly_session_usage FOR SELECT
TO authenticated
USING (
    coach_id = auth.uid() OR client_id = auth.uid()
);

CREATE POLICY "Coaches can insert client session usage"
ON client_monthly_session_usage FOR INSERT
TO authenticated
WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update their clients session usage"
ON client_monthly_session_usage FOR UPDATE
TO authenticated
USING (coach_id = auth.uid());

-- Function to increment session usage for hybrid clients
CREATE OR REPLACE FUNCTION increment_hybrid_session_usage(
    p_client_id UUID,
    p_coach_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    current_month DATE;
    new_count INTEGER;
BEGIN
    current_month := DATE_TRUNC('month', NOW())::DATE;

    INSERT INTO client_monthly_session_usage (client_id, coach_id, month, sessions_used)
    VALUES (p_client_id, p_coach_id, current_month, 1)
    ON CONFLICT (client_id, coach_id, month)
    DO UPDATE SET
        sessions_used = client_monthly_session_usage.sessions_used + 1,
        updated_at = NOW()
    RETURNING sessions_used INTO new_count;

    RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement session usage (for cancellations)
CREATE OR REPLACE FUNCTION decrement_hybrid_session_usage(
    p_client_id UUID,
    p_coach_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    current_month DATE;
    new_count INTEGER;
BEGIN
    current_month := DATE_TRUNC('month', NOW())::DATE;

    UPDATE client_monthly_session_usage
    SET
        sessions_used = GREATEST(0, sessions_used - 1),
        updated_at = NOW()
    WHERE client_id = p_client_id
        AND coach_id = p_coach_id
        AND month = current_month
    RETURNING sessions_used INTO new_count;

    RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get remaining sessions for a hybrid client
CREATE OR REPLACE FUNCTION get_hybrid_sessions_remaining(
    p_client_id UUID,
    p_coach_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    current_month DATE;
    sessions_limit INTEGER;
    sessions_used INTEGER;
BEGIN
    current_month := DATE_TRUNC('month', NOW())::DATE;

    -- Get the limit from the client's profile
    SELECT hybrid_sessions_per_month INTO sessions_limit
    FROM profiles
    WHERE id = p_client_id;

    -- Get current usage
    SELECT COALESCE(cmu.sessions_used, 0) INTO sessions_used
    FROM client_monthly_session_usage cmu
    WHERE cmu.client_id = p_client_id
        AND cmu.coach_id = p_coach_id
        AND cmu.month = current_month;

    RETURN GREATEST(0, COALESCE(sessions_limit, 4) - COALESCE(sessions_used, 0));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
