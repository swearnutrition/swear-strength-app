-- Migration: Messaging system for coach-client communication
-- Tables: conversations, messages, announcements, announcement_recipients, push_subscriptions

-- ============================================
-- CONVERSATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

-- Indexes
CREATE INDEX idx_conversations_client ON conversations(client_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

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

-- Coach can update conversations (for last_message_at)
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

-- Clients can update their own conversation (for last_message_at)
CREATE POLICY "Clients can update own conversation"
  ON conversations
  FOR UPDATE
  USING (auth.uid() = client_id);

-- ============================================
-- MESSAGES TABLE
-- ============================================
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

-- Indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_unread ON messages(conversation_id, read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

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

-- ============================================
-- ANNOUNCEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  send_push BOOLEAN NOT NULL DEFAULT FALSE,
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'selected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX idx_announcements_pinned ON announcements(is_pinned, created_at DESC);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Coach can do everything with announcements
CREATE POLICY "Coach can manage announcements"
  ON announcements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Clients can view announcements (via announcement_recipients join)
CREATE POLICY "Clients can view announcements"
  ON announcements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM announcement_recipients
      WHERE announcement_recipients.announcement_id = announcements.id
      AND announcement_recipients.client_id = auth.uid()
    )
  );

-- ============================================
-- ANNOUNCEMENT RECIPIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS announcement_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, client_id)
);

-- Indexes
CREATE INDEX idx_announcement_recipients_announcement ON announcement_recipients(announcement_id);
CREATE INDEX idx_announcement_recipients_client ON announcement_recipients(client_id);
CREATE INDEX idx_announcement_recipients_unread ON announcement_recipients(client_id, read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;

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

-- ============================================
-- PUSH SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Indexes
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

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

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE announcement_recipients;
