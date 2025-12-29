-- Add schedule preference columns to user_program_assignments
-- ============================================

-- Schedule mode: 'scheduled' (specific days) or 'flexible' (workout whenever)
ALTER TABLE user_program_assignments
ADD COLUMN IF NOT EXISTS schedule_mode TEXT DEFAULT 'flexible'
CHECK (schedule_mode IN ('scheduled', 'flexible'));

-- Reminder threshold in days for flexible mode
-- 2, 3, 4, 7 days, or NULL for "no reminders" (self-paced)
ALTER TABLE user_program_assignments
ADD COLUMN IF NOT EXISTS reminder_threshold INTEGER DEFAULT 3;

-- Prevent duplicate notifications
ALTER TABLE user_program_assignments
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Denormalized last workout timestamp for fast queries
ALTER TABLE user_program_assignments
ADD COLUMN IF NOT EXISTS last_workout_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================
-- TRIGGER: Update last_workout_at on workout completion
-- ============================================

CREATE OR REPLACE FUNCTION update_assignment_last_workout()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if workout was completed
  IF NEW.completed_at IS NOT NULL THEN
    UPDATE user_program_assignments
    SET last_workout_at = NEW.completed_at
    WHERE user_id = NEW.user_id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_last_workout ON workout_logs;

CREATE TRIGGER trigger_update_last_workout
  AFTER INSERT OR UPDATE OF completed_at ON workout_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_last_workout();

-- ============================================
-- Add 'inactive_warning' type to coach_notifications
-- ============================================
ALTER TABLE coach_notifications
DROP CONSTRAINT IF EXISTS coach_notifications_type_check;

ALTER TABLE coach_notifications
ADD CONSTRAINT coach_notifications_type_check
CHECK (type IN ('missed_workout', 'workout_completed', 'program_started', 'streak_milestone', 'inactive_warning'));

-- ============================================
-- Backfill last_workout_at from existing workout_logs
-- ============================================
UPDATE user_program_assignments upa
SET last_workout_at = (
  SELECT MAX(wl.completed_at)
  FROM workout_logs wl
  WHERE wl.user_id = upa.user_id
    AND wl.completed_at IS NOT NULL
)
WHERE upa.is_active = true;
