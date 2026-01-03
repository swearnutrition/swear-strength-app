-- Migration: Add scheduled_messages table for scheduled DMs, mass DMs, and announcements

CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('dm', 'mass_dm', 'announcement')),
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'gif', 'video')),
  media_url TEXT,

  -- For single DMs
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,

  -- For mass DMs (array of client IDs)
  recipient_ids UUID[],

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scheduled_messages_coach ON scheduled_messages(coach_id);
CREATE INDEX idx_scheduled_messages_pending ON scheduled_messages(status, scheduled_for)
  WHERE status = 'pending';

-- RLS
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can manage own scheduled messages"
  ON scheduled_messages FOR ALL
  USING (coach_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
