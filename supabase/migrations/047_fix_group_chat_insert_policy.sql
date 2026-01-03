-- Migration: Fix group chat INSERT policy
-- The INSERT policy needs to also verify created_by = auth.uid()

-- Drop the existing policy
DROP POLICY IF EXISTS "Coach can create group chats" ON group_chats;

-- Recreate with proper check that created_by matches the authenticated user
CREATE POLICY "Coach can create group chats"
  ON group_chats FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );
