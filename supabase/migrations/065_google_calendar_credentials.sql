-- Google Calendar OAuth credentials storage
-- Migration: 065_google_calendar_credentials.sql

CREATE TABLE IF NOT EXISTS google_calendar_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  calendar_id TEXT, -- Which calendar to use (null = primary)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_coach_google_creds UNIQUE (coach_id)
);

-- Booking settings per coach
CREATE TABLE IF NOT EXISTS coach_booking_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_window_days INTEGER NOT NULL DEFAULT 90, -- 3 months
  min_notice_hours INTEGER NOT NULL DEFAULT 12,
  renewal_reminder_threshold INTEGER NOT NULL DEFAULT 2, -- sessions remaining
  session_slot_interval_minutes INTEGER NOT NULL DEFAULT 30,
  checkin_duration_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_coach_booking_settings UNIQUE (coach_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_google_creds_coach ON google_calendar_credentials(coach_id);
CREATE INDEX IF NOT EXISTS idx_booking_settings_coach ON coach_booking_settings(coach_id);

-- Enable RLS
ALTER TABLE google_calendar_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_booking_settings ENABLE ROW LEVEL SECURITY;

-- RLS for google credentials (coach only)
CREATE POLICY "Coaches can manage their own google credentials"
  ON google_calendar_credentials FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- RLS for booking settings
CREATE POLICY "Coaches can manage their own booking settings"
  ON coach_booking_settings FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Clients can view their coach booking settings"
  ON coach_booking_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.client_id = auth.uid() AND b.coach_id = coach_booking_settings.coach_id
    )
    OR EXISTS (
      SELECT 1 FROM session_packages sp
      WHERE sp.client_id = auth.uid() AND sp.coach_id = coach_booking_settings.coach_id
    )
  );

-- Updated at triggers
CREATE TRIGGER trigger_google_creds_updated_at
  BEFORE UPDATE ON google_calendar_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();

CREATE TRIGGER trigger_booking_settings_updated_at
  BEFORE UPDATE ON coach_booking_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();
