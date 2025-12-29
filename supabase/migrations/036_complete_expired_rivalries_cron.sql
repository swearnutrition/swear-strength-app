-- Migration: Set up cron job to auto-complete expired rivalries
-- Runs daily at midnight to complete rivalries that have passed their end date

-- Schedule the cron job to run at midnight every day
SELECT cron.schedule(
  'complete-expired-rivalries',
  '0 0 * * *', -- Run at midnight every day
  $$
  SELECT
    net.http_post(
      url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/complete-expired-rivalries'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Add comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Cron job to auto-complete expired habit rivalries at midnight daily';
