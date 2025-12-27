-- Migration: Add notification preferences to profiles
-- Users can opt out of email notifications while still receiving in-app notifications

-- Add notification preferences columns
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email_nudges BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS email_reminders BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS email_weekly_summary BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN profiles.email_nudges IS 'Whether to send email notifications when nudged in a rivalry';
COMMENT ON COLUMN profiles.email_reminders IS 'Whether to send email reminders for habits';
COMMENT ON COLUMN profiles.email_weekly_summary IS 'Whether to send weekly summary emails';
