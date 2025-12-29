-- Auto-dismiss coach notifications when client logs a workout
-- This resolves stale "hasn't logged a workout in X days" notifications

-- Function to dismiss workout inactive notifications when a workout is completed
CREATE OR REPLACE FUNCTION dismiss_workout_inactive_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- When a workout log is completed (completed_at is set)
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR OLD.completed_at != NEW.completed_at) THEN
    -- Mark any unread workout_inactive notifications for this client as read
    UPDATE coach_notifications
    SET read = true
    WHERE client_id = NEW.user_id
      AND type = 'workout_inactive'
      AND read = false;

    -- Also update the last_workout_at on the user's assignment
    UPDATE user_program_assignments
    SET last_workout_at = NEW.completed_at
    WHERE user_id = NEW.user_id
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on workout_logs
DROP TRIGGER IF EXISTS dismiss_workout_inactive_on_completion ON workout_logs;
CREATE TRIGGER dismiss_workout_inactive_on_completion
  AFTER INSERT OR UPDATE ON workout_logs
  FOR EACH ROW
  EXECUTE FUNCTION dismiss_workout_inactive_notifications();

-- Add comment
COMMENT ON FUNCTION dismiss_workout_inactive_notifications() IS
  'Automatically marks workout_inactive coach notifications as read when the client completes a workout';
