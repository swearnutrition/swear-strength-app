-- Migration: Fix group chat INSERT policy v2
-- Use the is_coach() SECURITY DEFINER function instead of direct subquery

-- Drop the existing policy
DROP POLICY IF EXISTS "Coach can create group chats" ON group_chats;

-- Recreate using is_coach() function which is SECURITY DEFINER
CREATE POLICY "Coach can create group chats"
  ON group_chats FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND is_coach()
  );
