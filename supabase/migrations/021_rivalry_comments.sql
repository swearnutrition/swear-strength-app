-- Migration: Rivalry comments and reactions
-- Allows rivals to send messages, reactions, and GIFs to each other

CREATE TABLE IF NOT EXISTS rivalry_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rivalry_id UUID NOT NULL REFERENCES habit_rivalries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Comment content (can be text, emoji reaction, or GIF)
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'reaction', 'gif', 'system')),
  content TEXT, -- Text message or emoji
  gif_url TEXT, -- GIF URL if content_type is 'gif'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rivalry_comments_rivalry ON rivalry_comments(rivalry_id);
CREATE INDEX idx_rivalry_comments_created ON rivalry_comments(rivalry_id, created_at DESC);

-- Enable RLS
ALTER TABLE rivalry_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view comments for rivalries they're part of
CREATE POLICY "Users can view rivalry comments"
  ON rivalry_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM habit_rivalries hr
      WHERE hr.id = rivalry_comments.rivalry_id
      AND (hr.challenger_id = auth.uid() OR hr.opponent_id = auth.uid() OR hr.coach_id = auth.uid())
    )
  );

-- Policy: Users can create comments for rivalries they're part of
CREATE POLICY "Users can create rivalry comments"
  ON rivalry_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM habit_rivalries hr
      WHERE hr.id = rivalry_comments.rivalry_id
      AND (hr.challenger_id = auth.uid() OR hr.opponent_id = auth.uid())
    )
  );

-- Policy: Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON rivalry_comments
  FOR DELETE
  USING (auth.uid() = user_id);
