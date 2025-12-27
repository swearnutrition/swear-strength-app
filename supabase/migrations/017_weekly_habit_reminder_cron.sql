-- Migration: Set up pg_cron job for weekly habit reminders
-- Runs every hour on Sundays to check users in different timezones
-- The Edge Function filters to only send to users where it's ~7 AM local time

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION invoke_weekly_habit_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Call the Edge Function via pg_net
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/weekly-habit-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RAISE LOG 'Weekly habit reminder invoked, request_id: %', request_id;
END;
$$;

-- Schedule the job to run every hour on Sundays
-- This allows us to send emails at 7 AM in each user's timezone
-- Cron expression: minute hour day-of-month month day-of-week
-- "0 * * * 0" = At minute 0 of every hour, only on Sundays
SELECT cron.schedule(
  'weekly-habit-reminder',
  '0 * * * 0',
  'SELECT invoke_weekly_habit_reminder()'
);

-- Note: You need to set these in your Supabase dashboard under Settings > Database > App Settings:
-- app.settings.supabase_url = your Supabase URL
-- app.settings.service_role_key = your service role key
--
-- Or you can use the vault to store secrets:
-- SELECT vault.create_secret('service_role_key', 'your-key-here');
