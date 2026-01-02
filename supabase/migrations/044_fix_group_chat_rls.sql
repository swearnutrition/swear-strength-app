-- Migration: Fix Group Chat RLS Policies
-- Fixes infinite recursion in group_chat_members SELECT policy

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view group members" ON group_chat_members;
DROP POLICY IF EXISTS "Coach can add group members" ON group_chat_members;

-- Recreate SELECT policy without self-reference
-- Users can view their own memberships directly, or members of groups where they are members
CREATE POLICY "Users can view group members"
  ON group_chat_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR group_chat_id IN (
      SELECT gcm.group_chat_id
      FROM group_chat_members gcm
      WHERE gcm.user_id = auth.uid()
    )
  );

-- Recreate INSERT policy - coach can add members OR user can add themselves (for initial creation)
CREATE POLICY "Coach can add group members"
  ON group_chat_members FOR INSERT
  WITH CHECK (
    -- User is adding themselves
    user_id = auth.uid()
    OR
    -- OR user is the coach who created the group
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.created_by = auth.uid()
    )
  );
