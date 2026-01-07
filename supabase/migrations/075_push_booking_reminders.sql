-- Migration: Add push booking reminders preference to profiles
-- Migration: 075_push_booking_reminders.sql

-- Add column for push notification preference for booking reminders
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS push_booking_reminders BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN profiles.push_booking_reminders IS 'Whether to send push notifications reminding training/hybrid clients to book sessions';
