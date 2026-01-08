-- Add invite_id to bookings for pending client bookings
-- Migration: 081_booking_pending_clients.sql

-- Add invite_id field (references pending invite for pre-booking)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES invites(id) ON DELETE SET NULL;

-- Create index for invite lookups
CREATE INDEX IF NOT EXISTS idx_bookings_invite_id
  ON bookings(invite_id)
  WHERE invite_id IS NOT NULL;

-- Update constraint to allow pending client bookings
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS booking_client_validation;

ALTER TABLE bookings ADD CONSTRAINT booking_client_validation CHECK (
  -- Regular booking: must have client_id
  (client_id IS NOT NULL AND one_off_client_name IS NULL AND invite_id IS NULL)
  OR
  -- One-off booking: must have one_off_client_name, no client_id
  (client_id IS NULL AND one_off_client_name IS NOT NULL AND invite_id IS NULL)
  OR
  -- Pending client booking: must have invite_id, no client_id, no one_off_client_name
  (client_id IS NULL AND one_off_client_name IS NULL AND invite_id IS NOT NULL)
);

-- Function to link bookings when invite is accepted
CREATE OR REPLACE FUNCTION link_bookings_on_invite_accept()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run when accepted_at changes from NULL to a value
  IF OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL THEN
    -- Find the profile created with this email
    UPDATE bookings
    SET client_id = (
      SELECT id FROM profiles WHERE email = NEW.email LIMIT 1
    ),
    invite_id = NULL
    WHERE invite_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run when invite is accepted
DROP TRIGGER IF EXISTS trigger_link_bookings_on_invite_accept ON invites;
CREATE TRIGGER trigger_link_bookings_on_invite_accept
  AFTER UPDATE ON invites
  FOR EACH ROW
  EXECUTE FUNCTION link_bookings_on_invite_accept();
