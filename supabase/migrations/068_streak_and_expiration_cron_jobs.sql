-- Booking streak calculation and package expiration reminders cron jobs
-- Migration: 068_streak_and_expiration_cron_jobs.sql

-- Enable required extensions for cron (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to postgres user (if not already granted)
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================================
-- Weekly Streak Calculation Job
-- Runs every Sunday at 11:00 PM UTC to calculate booking streaks
-- ============================================================================

SELECT cron.schedule(
  'calculate-booking-streaks',  -- job name
  '0 23 * * 0',                 -- cron expression: Sunday at 11:00 PM UTC
  $$
  SELECT
    net.http_post(
      url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/calculate-booking-streaks'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- Daily Package Expiration Reminders (30-day warning)
-- Runs daily at 9:00 AM UTC
-- ============================================================================

SELECT cron.schedule(
  'package-expiration-30-day-reminder',  -- job name
  '0 9 * * *',                            -- cron expression: daily at 9:00 AM UTC
  $$
  SELECT
    net.http_post(
      url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/send-package-expiration-reminders'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
      ),
      body := '{"reminder_days": 30}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- Daily Package Expiration Reminders (7-day warning)
-- Runs daily at 9:30 AM UTC (30 min after 30-day to avoid overlap)
-- ============================================================================

SELECT cron.schedule(
  'package-expiration-7-day-reminder',  -- job name
  '30 9 * * *',                          -- cron expression: daily at 9:30 AM UTC
  $$
  SELECT
    net.http_post(
      url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/send-package-expiration-reminders'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
      ),
      body := '{"reminder_days": 7}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';

-- To view all scheduled jobs:
-- SELECT * FROM cron.job;

-- To view job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- To remove specific jobs:
-- SELECT cron.unschedule('calculate-booking-streaks');
-- SELECT cron.unschedule('package-expiration-30-day-reminder');
-- SELECT cron.unschedule('package-expiration-7-day-reminder');
