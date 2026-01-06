-- Fix the scheduled messages cron job to use Vault for the service role key
-- First, remove the existing job if it exists

SELECT cron.unschedule('process-scheduled-messages');

-- Re-schedule with Vault secret
-- NOTE: You must first add your service_role_key to Supabase Vault:
-- 1. Go to Supabase Dashboard > Settings > Vault
-- 2. Create a new secret named 'service_role_key' with your service role key value

SELECT cron.schedule(
  'process-scheduled-messages',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://lntbidhcbsrytfnnrnwk.supabase.co/functions/v1/process-scheduled-messages',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
