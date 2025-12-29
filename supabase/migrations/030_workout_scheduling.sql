-- Add scheduled_days to user_program_assignments
-- Format: array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
-- Example: [1, 3, 5] means Monday, Wednesday, Friday
ALTER TABLE user_program_assignments
ADD COLUMN IF NOT EXISTS scheduled_days INTEGER[] DEFAULT NULL;

-- Add schedule_set_at to track when client set their schedule
ALTER TABLE user_program_assignments
ADD COLUMN IF NOT EXISTS schedule_set_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================
-- COACH NOTIFICATIONS TABLE
-- For notifying coaches about client activity
-- ============================================
CREATE TABLE IF NOT EXISTS coach_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Notification type
  type TEXT NOT NULL CHECK (type IN ('missed_workout', 'workout_completed', 'program_started', 'streak_milestone')),

  -- Content
  title TEXT NOT NULL,
  message TEXT,

  -- Optional references
  assignment_id UUID REFERENCES user_program_assignments(id) ON DELETE CASCADE,
  workout_day_id UUID REFERENCES workout_days(id) ON DELETE SET NULL,

  -- Status
  read BOOLEAN NOT NULL DEFAULT FALSE,

  -- Metadata
  data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for coach notifications
CREATE INDEX IF NOT EXISTS idx_coach_notifications_coach ON coach_notifications(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_notifications_client ON coach_notifications(client_id);
CREATE INDEX IF NOT EXISTS idx_coach_notifications_read ON coach_notifications(coach_id, read);
CREATE INDEX IF NOT EXISTS idx_coach_notifications_created ON coach_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE coach_notifications ENABLE ROW LEVEL SECURITY;

-- Coaches can view their own notifications
CREATE POLICY "Coaches can view own notifications"
  ON coach_notifications FOR SELECT
  USING (auth.uid() = coach_id);

-- Coaches can update their own notifications (mark as read)
CREATE POLICY "Coaches can update own notifications"
  ON coach_notifications FOR UPDATE
  USING (auth.uid() = coach_id);

-- Coaches can delete their own notifications
CREATE POLICY "Coaches can delete own notifications"
  ON coach_notifications FOR DELETE
  USING (auth.uid() = coach_id);

-- System/service role can insert notifications
CREATE POLICY "Service role can insert coach notifications"
  ON coach_notifications FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Update client_notifications type check to include 'schedule_reminder'
-- ============================================
ALTER TABLE client_notifications
DROP CONSTRAINT IF EXISTS client_notifications_type_check;

ALTER TABLE client_notifications
ADD CONSTRAINT client_notifications_type_check
CHECK (type IN ('nudge', 'new_program', 'new_habit', 'rivalry_invite', 'rivalry_comment', 'rivalry_reaction', 'rivalry_gif', 'system', 'schedule_reminder'));
