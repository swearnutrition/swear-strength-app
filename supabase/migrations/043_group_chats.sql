-- Migration: Group Chats
-- Adds support for group chat functionality

-- Group chats table
CREATE TABLE IF NOT EXISTS group_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group chat members
CREATE TABLE IF NOT EXISTS group_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_chat_id, user_id)
);

-- Group messages
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'gif', 'video')),
  media_url TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message read status (per user)
CREATE TABLE IF NOT EXISTS group_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_chat_members_user ON group_chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_members_group ON group_chat_members(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created ON group_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_group_message_reads_message ON group_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_group_message_reads_user ON group_message_reads(user_id);

-- Enable RLS
ALTER TABLE group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_message_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group_chats
-- Users can view groups they are members of
CREATE POLICY "Users can view their group chats"
  ON group_chats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_chat_id = group_chats.id
      AND group_chat_members.user_id = auth.uid()
    )
  );

-- Only coach (creator) can create groups
CREATE POLICY "Coach can create group chats"
  ON group_chats FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Only coach can update groups
CREATE POLICY "Coach can update group chats"
  ON group_chats FOR UPDATE
  USING (created_by = auth.uid());

-- Only coach can delete groups
CREATE POLICY "Coach can delete group chats"
  ON group_chats FOR DELETE
  USING (created_by = auth.uid());

-- RLS Policies for group_chat_members
-- Users can view members of groups they belong to
CREATE POLICY "Users can view group members"
  ON group_chat_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_chat_members AS gcm
      WHERE gcm.group_chat_id = group_chat_members.group_chat_id
      AND gcm.user_id = auth.uid()
    )
  );

-- Coach can add members
CREATE POLICY "Coach can add group members"
  ON group_chat_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.created_by = auth.uid()
    )
  );

-- Users can update their own membership (for notifications toggle)
CREATE POLICY "Users can update own membership"
  ON group_chat_members FOR UPDATE
  USING (user_id = auth.uid());

-- Coach can remove members
CREATE POLICY "Coach can remove group members"
  ON group_chat_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.created_by = auth.uid()
    )
  );

-- RLS Policies for group_messages
-- Members can view messages in their groups
CREATE POLICY "Members can view group messages"
  ON group_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_chat_id = group_messages.group_chat_id
      AND group_chat_members.user_id = auth.uid()
    )
  );

-- Members can send messages
CREATE POLICY "Members can send group messages"
  ON group_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM group_chat_members
      WHERE group_chat_members.group_chat_id = group_messages.group_chat_id
      AND group_chat_members.user_id = auth.uid()
    )
  );

-- Users can soft-delete their own messages
CREATE POLICY "Users can delete own group messages"
  ON group_messages FOR UPDATE
  USING (sender_id = auth.uid());

-- RLS Policies for group_message_reads
-- Users can view read status for messages they can see
CREATE POLICY "Users can view message read status"
  ON group_message_reads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_messages
      JOIN group_chat_members ON group_chat_members.group_chat_id = group_messages.group_chat_id
      WHERE group_messages.id = group_message_reads.message_id
      AND group_chat_members.user_id = auth.uid()
    )
  );

-- Users can mark messages as read
CREATE POLICY "Users can mark messages as read"
  ON group_message_reads FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM group_messages
      JOIN group_chat_members ON group_chat_members.group_chat_id = group_messages.group_chat_id
      WHERE group_messages.id = group_message_reads.message_id
      AND group_chat_members.user_id = auth.uid()
    )
  );

-- Function to update group_chats.updated_at on new message
CREATE OR REPLACE FUNCTION update_group_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE group_chats
  SET updated_at = NOW()
  WHERE id = NEW.group_chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on new message
DROP TRIGGER IF EXISTS trigger_update_group_chat_timestamp ON group_messages;
CREATE TRIGGER trigger_update_group_chat_timestamp
AFTER INSERT ON group_messages
FOR EACH ROW
EXECUTE FUNCTION update_group_chat_timestamp();
