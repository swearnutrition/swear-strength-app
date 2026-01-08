-- Migration: Add invite_id support to allow pre-configuring pending clients
-- This allows coaches to assign packages, habits, programs, and start conversations
-- with clients who have been imported but haven't signed up yet.
-- When the client accepts the invite, the data is migrated from invite_id to client_id.

-- ============================================
-- SESSION PACKAGES
-- ============================================

-- Make client_id nullable and add invite_id
ALTER TABLE session_packages
  ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE session_packages
  ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES invites(id) ON DELETE CASCADE;

-- Add constraint: either client_id or invite_id must be set, but not both
ALTER TABLE session_packages
  ADD CONSTRAINT session_packages_client_or_invite
  CHECK (
    (client_id IS NOT NULL AND invite_id IS NULL) OR
    (client_id IS NULL AND invite_id IS NOT NULL)
  );

-- Index for invite_id lookups
CREATE INDEX IF NOT EXISTS idx_session_packages_invite ON session_packages(invite_id) WHERE invite_id IS NOT NULL;

-- Update RLS policy to allow coach to manage invite-based packages
DROP POLICY IF EXISTS "Coaches can manage their packages" ON session_packages;
CREATE POLICY "Coaches can manage their packages"
  ON session_packages
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- ============================================
-- CLIENT HABITS
-- ============================================

-- Make client_id nullable and add invite_id
ALTER TABLE client_habits
  ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE client_habits
  ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES invites(id) ON DELETE CASCADE;

-- Add constraint: either client_id or invite_id must be set
ALTER TABLE client_habits
  ADD CONSTRAINT client_habits_client_or_invite
  CHECK (
    (client_id IS NOT NULL AND invite_id IS NULL) OR
    (client_id IS NULL AND invite_id IS NOT NULL)
  );

-- Update unique constraint to work with invite_id
ALTER TABLE client_habits DROP CONSTRAINT IF EXISTS client_habits_client_id_habit_template_id_start_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS client_habits_unique_assignment
  ON client_habits (COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid),
                    COALESCE(invite_id, '00000000-0000-0000-0000-000000000000'::uuid),
                    habit_template_id, start_date);

-- Index for invite_id lookups
CREATE INDEX IF NOT EXISTS idx_client_habits_invite ON client_habits(invite_id) WHERE invite_id IS NOT NULL;

-- ============================================
-- USER PROGRAM ASSIGNMENTS
-- ============================================

-- Make user_id nullable and add invite_id
ALTER TABLE user_program_assignments
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE user_program_assignments
  ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES invites(id) ON DELETE CASCADE;

-- Add constraint: either user_id or invite_id must be set
ALTER TABLE user_program_assignments
  ADD CONSTRAINT program_assignments_client_or_invite
  CHECK (
    (user_id IS NOT NULL AND invite_id IS NULL) OR
    (user_id IS NULL AND invite_id IS NOT NULL)
  );

-- Update unique constraint to work with invite_id
ALTER TABLE user_program_assignments DROP CONSTRAINT IF EXISTS user_program_assignments_user_id_program_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS program_assignments_unique
  ON user_program_assignments (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
                               COALESCE(invite_id, '00000000-0000-0000-0000-000000000000'::uuid),
                               program_id);

-- Index for invite_id lookups
CREATE INDEX IF NOT EXISTS idx_program_assignments_invite ON user_program_assignments(invite_id) WHERE invite_id IS NOT NULL;

-- Update RLS to allow coach to manage invite-based assignments
DROP POLICY IF EXISTS "Coaches can manage program assignments for invited clients" ON user_program_assignments;
CREATE POLICY "Coaches can manage program assignments for invited clients"
  ON user_program_assignments
  FOR ALL
  USING (
    -- Coach managing invite-based assignment
    invite_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM invites i
      JOIN profiles p ON p.id = auth.uid()
      WHERE i.id = user_program_assignments.invite_id
      AND i.created_by = auth.uid()
      AND p.role = 'coach'
    )
  )
  WITH CHECK (
    invite_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM invites i
      JOIN profiles p ON p.id = auth.uid()
      WHERE i.id = user_program_assignments.invite_id
      AND i.created_by = auth.uid()
      AND p.role = 'coach'
    )
  );

-- ============================================
-- CONVERSATIONS
-- ============================================

-- Make client_id nullable and add invite_id
ALTER TABLE conversations
  ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES invites(id) ON DELETE CASCADE;

-- Add constraint: either client_id or invite_id must be set
ALTER TABLE conversations
  ADD CONSTRAINT conversations_client_or_invite
  CHECK (
    (client_id IS NOT NULL AND invite_id IS NULL) OR
    (client_id IS NULL AND invite_id IS NOT NULL)
  );

-- Update unique constraint to allow one conversation per client OR per invite
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_client_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_client ON conversations(client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_invite ON conversations(invite_id) WHERE invite_id IS NOT NULL;

-- Index for invite_id lookups
CREATE INDEX IF NOT EXISTS idx_conversations_invite ON conversations(invite_id) WHERE invite_id IS NOT NULL;

-- ============================================
-- FUNCTION: Migrate pending client data on invite acceptance
-- ============================================
CREATE OR REPLACE FUNCTION migrate_pending_client_data(p_invite_id UUID, p_client_id UUID)
RETURNS void AS $$
BEGIN
  -- Migrate session packages
  UPDATE session_packages
  SET client_id = p_client_id, invite_id = NULL
  WHERE invite_id = p_invite_id;

  -- Migrate client habits
  UPDATE client_habits
  SET client_id = p_client_id, invite_id = NULL
  WHERE invite_id = p_invite_id;

  -- Migrate program assignments
  UPDATE user_program_assignments
  SET user_id = p_client_id, invite_id = NULL
  WHERE invite_id = p_invite_id;

  -- Migrate conversations
  UPDATE conversations
  SET client_id = p_client_id, invite_id = NULL
  WHERE invite_id = p_invite_id;

  -- Migrate bookings (already has invite_id support)
  UPDATE bookings
  SET client_id = p_client_id, invite_id = NULL
  WHERE invite_id = p_invite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
