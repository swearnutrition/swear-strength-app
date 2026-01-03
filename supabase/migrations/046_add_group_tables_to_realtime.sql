-- Migration: Add group chat tables to realtime publication
-- This enables real-time updates for group messaging

-- Add group_chats to realtime publication (for group metadata updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_chats;
  END IF;
END $$;

-- Add group_chat_members to realtime publication (for membership changes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_chat_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_chat_members;
  END IF;
END $$;

-- Add group_messages to realtime publication (for new messages)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
  END IF;
END $$;

-- Add group_message_reads to realtime publication (for read receipts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_message_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE group_message_reads;
  END IF;
END $$;
