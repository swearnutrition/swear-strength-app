-- Fix booking constraints to support subscriptions and pending client bookings
-- Migration: 084_fix_booking_constraints_for_subscriptions.sql

-- Drop existing constraints
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS session_package_validation;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS booking_client_validation;

-- New unified constraint that handles all booking types:
-- 1. Regular client with package
-- 2. Regular client with subscription (no package needed)
-- 3. One-off booking (has one_off_client_name)
-- 4. Pending client booking (has invite_id, no client_id)
ALTER TABLE bookings ADD CONSTRAINT booking_client_validation CHECK (
  -- Regular booking: must have client_id, no one_off_client_name, no invite_id
  (client_id IS NOT NULL AND one_off_client_name IS NULL AND invite_id IS NULL)
  OR
  -- One-off booking: must have one_off_client_name, no client_id, no invite_id
  (client_id IS NULL AND one_off_client_name IS NOT NULL AND invite_id IS NULL)
  OR
  -- Pending client booking: must have invite_id, no client_id, no one_off_client_name
  (client_id IS NULL AND one_off_client_name IS NULL AND invite_id IS NOT NULL)
);

-- New session/package constraint that allows subscriptions:
-- - Check-ins never need packages
-- - Sessions can have package OR subscription OR neither (for one-off/pending clients)
ALTER TABLE bookings ADD CONSTRAINT session_package_validation CHECK (
  -- Check-ins don't need packages
  (booking_type = 'checkin' AND package_id IS NULL)
  OR
  -- Sessions: can have package, subscription, or neither
  (booking_type = 'session')
);
