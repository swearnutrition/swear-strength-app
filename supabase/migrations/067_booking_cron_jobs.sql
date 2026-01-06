-- Booking reminders cron job
-- Migration: 067_booking_cron_jobs.sql

-- Add reminders_sent column to track which reminders have been sent for each booking
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS reminders_sent TEXT[] DEFAULT '{}';

-- Create index for efficient querying of bookings without reminders
CREATE INDEX IF NOT EXISTS idx_bookings_reminders_pending
  ON bookings(starts_at)
  WHERE status = 'confirmed';

-- Create a function to append reminder types to the reminders_sent array
-- This prevents race conditions and duplicate entries
CREATE OR REPLACE FUNCTION append_booking_reminder(
  p_booking_id UUID,
  p_reminder_type TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE bookings
  SET reminders_sent = CASE
    WHEN NOT (p_reminder_type = ANY(reminders_sent))
    THEN array_append(reminders_sent, p_reminder_type)
    ELSE reminders_sent
  END
  WHERE id = p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION append_booking_reminder(UUID, TEXT) TO service_role;

-- Enable required extensions for cron (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule the booking reminders job to run every hour
-- Runs at minute 0 of every hour to send 24-hour reminders
SELECT cron.schedule(
  'send-booking-reminders',  -- job name
  '0 * * * *',               -- cron expression: every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/send-booking-reminders'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Add comment for documentation
COMMENT ON COLUMN bookings.reminders_sent IS 'Array of reminder types that have been sent for this booking (e.g., booking_reminder, form_reminder)';

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To remove this job:
-- SELECT cron.unschedule('send-booking-reminders');
