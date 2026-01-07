-- Allow booking sessions without packages
-- Migration: 070_allow_sessions_without_packages.sql

-- Drop the strict session package validation constraint
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS session_package_validation;

-- Add a more relaxed constraint:
-- - Check-ins don't need packages
-- - Sessions can optionally have packages (regular clients)
-- - One-off sessions never have packages
ALTER TABLE bookings ADD CONSTRAINT session_package_validation CHECK (
  -- Check-ins don't need packages
  (booking_type = 'checkin' AND package_id IS NULL)
  OR
  -- Regular sessions can optionally have packages (package_id can be NULL or NOT NULL)
  (booking_type = 'session' AND client_id IS NOT NULL)
  OR
  -- One-off sessions don't have packages
  (booking_type = 'session' AND one_off_client_name IS NOT NULL AND package_id IS NULL)
);
