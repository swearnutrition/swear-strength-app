-- Schedule the process-scheduled-messages function to run every minute
-- This processes pending scheduled messages that are due

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule the job to run every minute
SELECT cron.schedule(
  'process-scheduled-messages',  -- job name
  '* * * * *',                   -- cron expression: every minute
  $$
  SELECT
    net.http_post(
      url := 'https://lntbidhcbsrytfnnrnwk.supabase.co/functions/v1/process-scheduled-messages',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To remove this job:
-- SELECT cron.unschedule('process-scheduled-messages');
