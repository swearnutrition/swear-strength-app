-- Client booking statistics and check-in usage tracking
-- Migration: 064_client_booking_stats.sql

-- Client booking stats (streaks, flags, favorites)
CREATE TABLE IF NOT EXISTS client_booking_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak_weeks INTEGER NOT NULL DEFAULT 0,
  longest_streak_weeks INTEGER NOT NULL DEFAULT 0,
  no_show_count_90d INTEGER NOT NULL DEFAULT 0,
  cancellation_count_90d INTEGER NOT NULL DEFAULT 0,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  favorite_times JSONB DEFAULT '[]', -- [{ "day": 1, "time": "16:00" }, ...]
  last_streak_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_client_coach_stats UNIQUE (client_id, coach_id)
);

-- Monthly check-in usage tracking
CREATE TABLE IF NOT EXISTS client_checkin_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- First of month (e.g., 2026-01-01)
  used BOOLEAN NOT NULL DEFAULT false,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_client_coach_month UNIQUE (client_id, coach_id, month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_booking_stats_client ON client_booking_stats(client_id);
CREATE INDEX IF NOT EXISTS idx_booking_stats_coach ON client_booking_stats(coach_id);
CREATE INDEX IF NOT EXISTS idx_booking_stats_flagged ON client_booking_stats(coach_id) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_checkin_usage_lookup ON client_checkin_usage(client_id, coach_id, month);

-- Enable RLS
ALTER TABLE client_booking_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_checkin_usage ENABLE ROW LEVEL SECURITY;

-- RLS for stats
CREATE POLICY "Coaches can view their clients stats"
  ON client_booking_stats FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view their own stats"
  ON client_booking_stats FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "System can manage stats"
  ON client_booking_stats FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS for check-in usage
CREATE POLICY "Coaches can view their clients checkin usage"
  ON client_checkin_usage FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view their own checkin usage"
  ON client_checkin_usage FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "System can manage checkin usage"
  ON client_checkin_usage FOR ALL
  USING (true)
  WITH CHECK (true);

-- Updated at trigger
CREATE TRIGGER trigger_booking_stats_updated_at
  BEFORE UPDATE ON client_booking_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();
