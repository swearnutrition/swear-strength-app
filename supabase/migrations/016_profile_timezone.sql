-- Migration: Add timezone field to profiles
-- Used for scheduling timezone-aware notifications like weekly habit reminders

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Add a comment explaining the field
COMMENT ON COLUMN profiles.timezone IS 'IANA timezone identifier (e.g., America/New_York, Europe/London)';
