-- Migration: Client notifications system
-- Stores in-app notifications for clients (nudges, new programs, new habits, etc.)

CREATE TABLE IF NOT EXISTS client_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Notification type
  type TEXT NOT NULL CHECK (type IN ('nudge', 'new_program', 'new_habit', 'rivalry_invite', 'rivalry_comment', 'system')),

  -- Content
  title TEXT NOT NULL,
  message TEXT,

  -- Optional references
  rivalry_id UUID REFERENCES habit_rivalries(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES client_habits(id) ON DELETE CASCADE,

  -- Status
  read BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user ON client_notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON client_notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_created ON client_notifications(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE client_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON client_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON client_notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON client_notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Coaches and system can insert notifications for users
-- (We'll use service role for inserts from edge functions)
CREATE POLICY "Service role can insert notifications"
  ON client_notifications
  FOR INSERT
  WITH CHECK (TRUE);
