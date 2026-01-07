-- Booking nudges table and cron job
-- Migration: 074_booking_nudges.sql

-- Create table to track booking nudge emails sent to clients
-- This prevents spamming clients with too many reminders
CREATE TABLE IF NOT EXISTS booking_nudges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient rate-limiting queries (client + sent_at)
CREATE INDEX IF NOT EXISTS idx_booking_nudges_client_sent
  ON booking_nudges(client_id, sent_at DESC);

-- RLS policies
ALTER TABLE booking_nudges ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for the Edge Function)
CREATE POLICY "Service role full access to booking_nudges"
  ON booking_nudges
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Coaches can view nudges sent to their clients
-- Uses bookings or client_habits tables to verify coach-client relationship
CREATE POLICY "Coaches can view their clients booking nudges"
  ON booking_nudges
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.client_id = booking_nudges.client_id
      AND bookings.coach_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM client_habits
      WHERE client_habits.client_id = booking_nudges.client_id
      AND client_habits.coach_id = auth.uid()
    )
  );

-- Schedule the booking nudge job to run daily at 9 AM UTC
-- This gives clients a gentle reminder to book sessions if they haven't
SELECT cron.schedule(
  'send-booking-nudge',  -- job name
  '0 9 * * *',           -- cron expression: daily at 9:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/send-booking-nudge'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Add comment for documentation
COMMENT ON TABLE booking_nudges IS 'Tracks booking nudge emails sent to training/hybrid clients without upcoming bookings. Rate limited to 1 per week per client.';

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To remove this job:
-- SELECT cron.unschedule('send-booking-nudge');
