-- Migration: Fix Group Chat RLS Policies v2
-- Uses SECURITY DEFINER function to avoid recursion

-- Create a helper function that bypasses RLS to check membership
CREATE OR REPLACE FUNCTION is_group_chat_member(p_group_chat_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_chat_members
    WHERE group_chat_id = p_group_chat_id
    AND user_id = p_user_id
  );
$$;

-- Create a helper to get user's group IDs
CREATE OR REPLACE FUNCTION get_user_group_chat_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT group_chat_id FROM group_chat_members WHERE user_id = p_user_id;
$$;

-- Drop ALL existing policies on group_chat_members
DROP POLICY IF EXISTS "Users can view group members" ON group_chat_members;
DROP POLICY IF EXISTS "Coach can add group members" ON group_chat_members;
DROP POLICY IF EXISTS "Users can update own membership" ON group_chat_members;
DROP POLICY IF EXISTS "Coach can remove group members" ON group_chat_members;

-- Recreate all policies using the helper functions
CREATE POLICY "Users can view group members"
  ON group_chat_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR group_chat_id IN (SELECT get_user_group_chat_ids(auth.uid()))
  );

CREATE POLICY "Coach can add group members"
  ON group_chat_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own membership"
  ON group_chat_members FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Coach can remove group members"
  ON group_chat_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.created_by = auth.uid()
    )
  );

-- Also fix group_chats SELECT policy to use the helper
DROP POLICY IF EXISTS "Users can view their group chats" ON group_chats;

CREATE POLICY "Users can view their group chats"
  ON group_chats FOR SELECT
  USING (
    id IN (SELECT get_user_group_chat_ids(auth.uid()))
  );

-- Fix group_messages policies
DROP POLICY IF EXISTS "Members can view group messages" ON group_messages;
DROP POLICY IF EXISTS "Members can send group messages" ON group_messages;

CREATE POLICY "Members can view group messages"
  ON group_messages FOR SELECT
  USING (
    is_group_chat_member(group_chat_id, auth.uid())
  );

CREATE POLICY "Members can send group messages"
  ON group_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND is_group_chat_member(group_chat_id, auth.uid())
  );

-- Fix group_message_reads policies
DROP POLICY IF EXISTS "Users can view message read status" ON group_message_reads;
DROP POLICY IF EXISTS "Users can mark messages as read" ON group_message_reads;

CREATE POLICY "Users can view message read status"
  ON group_message_reads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_messages
      WHERE group_messages.id = group_message_reads.message_id
      AND is_group_chat_member(group_messages.group_chat_id, auth.uid())
    )
  );

CREATE POLICY "Users can mark messages as read"
  ON group_message_reads FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM group_messages
      WHERE group_messages.id = group_message_reads.message_id
      AND is_group_chat_member(group_messages.group_chat_id, auth.uid())
    )
  );
