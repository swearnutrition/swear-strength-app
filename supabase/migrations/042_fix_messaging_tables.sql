-- Fix messaging tables that may have been partially created
-- Add missing columns to announcements table

-- Add missing columns to announcements if they don't exist
DO $$
BEGIN
  -- Add is_pinned if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'is_pinned') THEN
    ALTER TABLE announcements ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- Add send_push if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'send_push') THEN
    ALTER TABLE announcements ADD COLUMN send_push BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- Add target_type if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'target_type') THEN
    ALTER TABLE announcements ADD COLUMN target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'selected'));
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned, created_at DESC);

-- Create conversations table if it doesn't exist
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

-- Create indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_client ON conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- Enable RLS on conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for conversations (to ensure they're correct)
DROP POLICY IF EXISTS "Coach can view all conversations" ON conversations;
DROP POLICY IF EXISTS "Clients can view own conversation" ON conversations;
DROP POLICY IF EXISTS "Coach can create conversations" ON conversations;
DROP POLICY IF EXISTS "Coach can update conversations" ON conversations;
DROP POLICY IF EXISTS "Clients can update own conversation" ON conversations;

-- Coach can view all conversations
CREATE POLICY "Coach can view all conversations"
  ON conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Clients can view their own conversation
CREATE POLICY "Clients can view own conversation"
  ON conversations
  FOR SELECT
  USING (auth.uid() = client_id);

-- Coach can create conversations
CREATE POLICY "Coach can create conversations"
  ON conversations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Coach can update conversations
CREATE POLICY "Coach can update conversations"
  ON conversations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Clients can update their own conversation
CREATE POLICY "Clients can update own conversation"
  ON conversations
  FOR UPDATE
  USING (auth.uid() = client_id);

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'gif', 'video')),
  media_url TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, read_at) WHERE read_at IS NULL;

-- Enable RLS on messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for messages
DROP POLICY IF EXISTS "Coach can view all messages" ON messages;
DROP POLICY IF EXISTS "Clients can view own conversation messages" ON messages;
DROP POLICY IF EXISTS "Coach can insert messages" ON messages;
DROP POLICY IF EXISTS "Clients can insert own conversation messages" ON messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;

-- Coach can view all messages
CREATE POLICY "Coach can view all messages"
  ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Clients can view messages in their conversation
CREATE POLICY "Clients can view own conversation messages"
  ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.client_id = auth.uid()
    )
  );

-- Coach can insert messages
CREATE POLICY "Coach can insert messages"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Clients can insert messages in their conversation
CREATE POLICY "Clients can insert own conversation messages"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.client_id = auth.uid()
    )
  );

-- Users can soft-delete their own messages
CREATE POLICY "Users can delete own messages"
  ON messages
  FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Create announcement_recipients table if it doesn't exist
CREATE TABLE IF NOT EXISTS announcement_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, client_id)
);

-- Create indexes for announcement_recipients
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_announcement ON announcement_recipients(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_client ON announcement_recipients(client_id);
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_unread ON announcement_recipients(client_id, read_at) WHERE read_at IS NULL;

-- Enable RLS on announcement_recipients
ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for announcement_recipients
DROP POLICY IF EXISTS "Coach can manage announcement recipients" ON announcement_recipients;
DROP POLICY IF EXISTS "Clients can view own announcement recipients" ON announcement_recipients;
DROP POLICY IF EXISTS "Clients can update own announcement recipients" ON announcement_recipients;

-- Coach can manage all recipients
CREATE POLICY "Coach can manage announcement recipients"
  ON announcement_recipients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Clients can view their own recipients
CREATE POLICY "Clients can view own announcement recipients"
  ON announcement_recipients
  FOR SELECT
  USING (auth.uid() = client_id);

-- Clients can update their own (mark as read)
CREATE POLICY "Clients can update own announcement recipients"
  ON announcement_recipients
  FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- Create push_subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Create indexes for push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Enable RLS on push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for push_subscriptions
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Coach can view all push subscriptions" ON push_subscriptions;

-- Users can manage their own subscriptions
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Coach can view all subscriptions (for sending notifications)
CREATE POLICY "Coach can view all push subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Enable realtime for messaging tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'announcement_recipients'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE announcement_recipients;
  END IF;
END $$;
