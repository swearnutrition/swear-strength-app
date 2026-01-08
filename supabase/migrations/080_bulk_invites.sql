-- Add fields for bulk invite creation
-- Migration: 080_bulk_invites.sql

-- Add name field (client's name, provided at bulk creation)
ALTER TABLE invites ADD COLUMN IF NOT EXISTS name TEXT;

-- Add client_type field
ALTER TABLE invites ADD COLUMN IF NOT EXISTS client_type client_type;

-- Add invite_sent_at field (null = invite email not sent yet)
ALTER TABLE invites ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ;

-- Create index for pending invites (not accepted, not sent)
CREATE INDEX IF NOT EXISTS idx_invites_pending
  ON invites(created_by, accepted_at, invite_sent_at)
  WHERE accepted_at IS NULL;
