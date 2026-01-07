-- Add support for one-off bookings (clients without accounts)
-- Migration: 069_one_off_bookings.sql

-- Make client_id nullable for one-off bookings
ALTER TABLE bookings ALTER COLUMN client_id DROP NOT NULL;

-- Add one-off client name field
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS one_off_client_name TEXT;

-- Drop the old constraint that required package for sessions
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS checkin_has_no_package;

-- Add new constraint that allows:
-- 1. Sessions with package (regular client)
-- 2. Sessions without package (one-off client with name)
-- 3. Check-ins without package (always)
ALTER TABLE bookings ADD CONSTRAINT booking_client_validation CHECK (
  -- Regular booking: must have client_id
  (client_id IS NOT NULL AND one_off_client_name IS NULL)
  OR
  -- One-off booking: must have one_off_client_name, no client_id
  (client_id IS NULL AND one_off_client_name IS NOT NULL)
);

-- Session bookings for regular clients must have a package
-- One-off sessions don't need a package
ALTER TABLE bookings ADD CONSTRAINT session_package_validation CHECK (
  -- Check-ins don't need packages
  (booking_type = 'checkin' AND package_id IS NULL)
  OR
  -- Regular sessions need packages
  (booking_type = 'session' AND client_id IS NOT NULL AND package_id IS NOT NULL)
  OR
  -- One-off sessions don't need packages
  (booking_type = 'session' AND one_off_client_name IS NOT NULL AND package_id IS NULL)
);

-- Update RLS policy for coaches to view one-off bookings
DROP POLICY IF EXISTS "Coaches can view all their bookings" ON bookings;
CREATE POLICY "Coaches can view all their bookings"
  ON bookings FOR SELECT
  USING (coach_id = auth.uid());

-- Update INSERT policy for coaches to allow one-off bookings (client_id can be NULL)
DROP POLICY IF EXISTS "Coaches can create bookings" ON bookings;
CREATE POLICY "Coaches can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach'
    )
  );

-- Add index for one-off client name searches
CREATE INDEX IF NOT EXISTS idx_bookings_one_off_client_name
  ON bookings(one_off_client_name)
  WHERE one_off_client_name IS NOT NULL;
