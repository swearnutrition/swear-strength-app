-- Schedule the check-workout-activity function to run daily at 9 AM UTC
-- This checks for inactive clients and sends notifications

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule the job to run at 9 AM UTC every day (which is ~1-4 AM PST depending on DST)
-- This calls our edge function via HTTP
SELECT cron.schedule(
  'check-workout-activity-daily',  -- job name
  '0 9 * * *',                      -- cron expression: 9 AM UTC daily
  $$
  SELECT
    net.http_post(
      url := 'https://lntbidhcbsrytfnnrnwk.supabase.co/functions/v1/check-workout-activity',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Note: You may need to set the service_role_key in your database settings
-- Or use the anon key if your function allows it

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To remove a job:
-- SELECT cron.unschedule('check-workout-activity-daily');
