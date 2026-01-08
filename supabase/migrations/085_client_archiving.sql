-- Add archiving support for clients
-- Migration: 085_client_archiving.sql

-- Add archived_at column to profiles for soft-delete/archiving clients
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add archived_by column to track who archived the client
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add archive_reason column for notes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS archive_reason TEXT;

-- Index for efficient filtering of archived/active clients
CREATE INDEX IF NOT EXISTS idx_profiles_archived_at
  ON profiles(archived_at)
  WHERE role = 'client';

-- Index for filtering active clients
CREATE INDEX IF NOT EXISTS idx_profiles_active_clients
  ON profiles(id)
  WHERE role = 'client' AND archived_at IS NULL;
